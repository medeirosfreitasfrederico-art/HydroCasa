/* HydroCasa — assistente "Justificar consumo".
   Os sensores medem quanto de água passou, mas não sabem em quê ela foi usada.
   Aqui a pessoa conta o que aconteceu no dia (banho, louça, máquina...) e vê
   quanto da água medida isso explica. Os registros ficam em state.activityRecords
   (mesmo formato de antes) e NUNCA alteram leituras, totais ou snapshots. */
(()=>{'use strict';
const A=window.HydroApp,M=window.HydroConsumption,F=window.HydroFinance;
const panel=document.getElementById('activities');
if(!A||!M||!panel)return;
const {state}=A;
const esc=A.escapeHtml;

/* Ícones de traço simples (24×24), herdam a cor do texto. */
const svg=d=>'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
const ICONS={
  banho:svg('<path d="M4 20V8a4 4 0 0 1 4-4h1a4 4 0 0 1 4 4"/><path d="M10 8h6l1 2H9z"/><path d="M11 13v1M14 13v1M17 13v1M12 16.5v1M15 16.5v1M13 20v1M16 20v1"/>'),
  louca:svg('<circle cx="12" cy="13" r="6"/><circle cx="12" cy="13" r="3"/><path d="M3 5v5a2 2 0 0 0 2 2M5 5v14M21 5c-1.5 0-2.5 2-2.5 4.5S19.5 13 21 13v6"/>'),
  roupa:svg('<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 7h16"/><circle cx="12" cy="14" r="4.2"/><path d="M9.3 14.6c1-.9 1.8.8 2.7 0s1.8-.9 2.7 0"/><path d="M7 5h.01M10 5h.01"/>'),
  rega:svg('<path d="M12 21v-7"/><path d="M12 14c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6zM12 16c0-2.8-2-5-5-5 0 2.8 2 5 5 5z"/><path d="M5 21h14"/>'),
  carro:svg('<path d="M5 16V12l2-4.5A2 2 0 0 1 8.8 6.3h6.4A2 2 0 0 1 17 7.5l2 4.5v4"/><rect x="3.5" y="12" width="17" height="5" rx="1.5"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>'),
  calcada:svg('<path d="M14 3l-4.5 9"/><path d="M7 12h6l2 9H5z"/><path d="M8.5 16.5v4M11.5 16.5v4"/>'),
  piscina:svg('<path d="M3 17c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1"/><path d="M3 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1"/><path d="M8 15V5a2 2 0 0 1 4 0M16 15V5a2 2 0 0 0-4 0M8 9h8"/>'),
  limpeza:svg('<path d="M6 9h12l-1.3 10.2A2 2 0 0 1 14.7 21H9.3a2 2 0 0 1-2-1.8z"/><path d="M8 9a4 4 0 0 1 8 0"/><path d="M10 13.5c1.2.8 2.8.8 4 0"/>')
};

/* Grupos que a pessoa reconhece; cada variante aponta para uma atividade com fonte em consumption.js. */
const GROUPS=[
  {key:'banho',label:'Banho',variants:[['shower-electric','Chuveiro elétrico','água sai mais devagar'],['shower','Ducha','água sai com mais força']]},
  {key:'louca',label:'Lavar louça',variants:[['dishes','Torneira aberta','água correndo o tempo todo'],['dishes-basin','Na cuba ou bacia','enche e lava']]},
  {key:'roupa',label:'Lavar roupa',variants:[['laundry','Máquina de lavar','ciclo completo']]},
  {key:'rega',label:'Regar plantas',variants:[['garden','Com mangueira','']]},
  {key:'carro',label:'Lavar carro',variants:[['car','Com baldes','']]},
  {key:'calcada',label:'Lavar calçada',variants:[['sidewalk','Com mangueira','']]},
  {key:'limpeza',label:'Limpar a casa',variants:[['cleaning','Baldes e panos','você informa os litros']]},
  {key:'piscina',label:'Encher piscina',variants:[['pool','Piscina','você informa os litros']]}
];
const groupOf=id=>GROUPS.find(g=>g.variants.some(v=>v[0]===id))||GROUPS[0];
const COLORS=['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#db2777','#4f46e5','#0d9488'];
const colorOf=id=>COLORS[Math.max(0,GROUPS.indexOf(groupOf(id)))%COLORS.length];
const CUSTOM_CHIPS={cleaning:[[10,'1 balde (10 L)'],[20,'2 baldes'],[50,'50 L']],pool:[[500,'500 L'],[1000,'1.000 L'],[3000,'3.000 L']]};
const MAX_QTY=id=>id==='shower'||id==='shower-electric'||id==='pool'?5:id==='cleaning'?10:20;
const MAX_MIN=60;

const L=v=>{if(!Number.isFinite(v))return '—';const r=v<10?Math.round(v*10)/10:Math.round(v);return r.toLocaleString('pt-BR')+' L';};
const m3=v=>Number.isFinite(v)?(v/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' m³':'—';
const price=()=>{try{return F?F.read(localStorage).pricePerM3:null;}catch{return null;}};
const money=l=>{const p=price();return Number.isFinite(p)&&p>0&&Number.isFinite(l)?(l/1000*p).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):null;};
const residents=()=>state.household&&Number.isInteger(state.household.residents)?state.household.residents:null;
const parseKey=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d,12);};
const dayLabel=k=>{const t=A.todayKey(),y=new Date();y.setDate(y.getDate()-1);
  if(k===t)return 'hoje';if(k===A.keyForDate(y))return 'ontem';
  return parseKey(k).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});};

/* ---------- Estado do formulário ---------- */
const ui={day:A.todayKey(),group:'banho',id:'shower-electric',people:residents()||1,qty:1,minutes:10,custom:null,editing:null,undo:null};
function activity(){return M.activities.find(a=>a.id===ui.id);}
function params(){
  const a=activity();
  return {residents:a.perPerson?ui.people:residents(),quantity:ui.qty,minutes:a.minutes?ui.minutes:undefined,customLiters:a.liters===null?ui.custom:undefined};
}
function estimate(){try{return {liters:M.estimate(ui.id,params())};}catch(e){return {error:e.message};}}

/* ---------- Estrutura do painel ---------- */
panel.innerHTML=`
<div class="section-heading jc-heading"><div><span class="eyebrow">JUSTIFICAR CONSUMO</span><h2>Explique para onde foi a água ${window.HydroAjuda?window.HydroAjuda.html('<strong>Por que justificar?</strong>Os sensores sabem <b>quanto</b> de água passou, mas não <b>em quê</b> ela foi usada. Quando você conta o que aconteceu no dia, o HydroCasa compara a soma das atividades com o que foi medido.<br><br><strong>Como ler o balanço</strong>Se as atividades cobrem a água medida, o consumo está explicado. Se ainda falta muita água sem explicação, pode ser algo que ninguém registrou (descarga, pia) ou um vazamento.<br><br><strong>De onde vêm os valores</strong>(SAAE e Câmara/Sabesp): ducha, cerca de 9 L por minuto; chuveiro elétrico, cerca de 3 L por minuto; louça com a torneira aberta, cerca de 7,8 L por minuto, ou cerca de 20 L na cuba; máquina de 5 kg, cerca de 135 L por ciclo; mangueira, cerca de 18,6 L por minuto; carro com baldes, cerca de 40 L. Na piscina e na limpeza, você informa os litros.<br><br>As atividades são estimativas e <b>nunca mudam</b> o que os sensores mediram.','Como funciona o Justificar consumo'):''}</h2>
<p>Os sensores medem <b>quanto</b> de água passou, mas não sabem <b>em quê</b> ela foi usada. Conte o que aconteceu no dia e veja se isso explica o consumo medido.</p></div></div>
<ol class="jc-how" aria-label="Como funciona">
  <li><span>1</span><div><b>Escolha o dia</b><small>Hoje, ontem ou outra data.</small></div></li>
  <li><span>2</span><div><b>Diga o que foi feito</b><small>Banho, louça, máquina de lavar…</small></div></li>
  <li><span>3</span><div><b>Veja o balanço</b><small>Quanto da água medida ficou explicado.</small></div></li>
</ol>
<div class="jc-grid">
  <form class="glass-card jc-form" id="jcForm" novalidate aria-labelledby="jcFormTitle">
    <h3 id="jcFormTitle" class="sr-only">Registrar uma atividade</h3>
    <fieldset class="jc-step"><legend><span class="jc-num">1</span>Qual dia?</legend>
      <div class="jc-chips" role="radiogroup" aria-label="Dia" id="jcDayChips">
        <button type="button" role="radio" data-day="today">Hoje</button><button type="button" role="radio" data-day="yesterday">Ontem</button><button type="button" role="radio" data-day="other">Outro dia</button>
        <input type="date" id="jcDate" aria-label="Escolher outra data" hidden>
      </div>
    </fieldset>
    <fieldset class="jc-step"><legend><span class="jc-num">2</span>O que foi feito?</legend>
      <div class="jc-tiles" role="radiogroup" aria-label="Atividade" id="jcTiles">${GROUPS.map(g=>`<button type="button" role="radio" class="jc-tile" data-group="${g.key}">${ICONS[g.key]}<span>${g.label}</span></button>`).join('')}</div>
      <div class="jc-variants" id="jcVariants" role="radiogroup" aria-label="Como foi feito"></div>
    </fieldset>
    <fieldset class="jc-step"><legend><span class="jc-num">3</span><span id="jcQtyTitle">Quanto?</span></legend>
      <div class="jc-fields" id="jcFields"></div>
    </fieldset>
    <div class="jc-result" id="jcResult" aria-live="polite"></div>
    <div class="jc-actions"><button type="submit" class="primary-btn jc-submit" id="jcSubmit">Adicionar</button><button type="button" class="ghost-btn" id="jcCancelEdit" hidden>Cancelar edição</button></div>
    <p class="jc-feedback" id="jcFeedback" role="status"></p>
  </form>
  <aside class="glass-card jc-balance" id="jcBalance" aria-labelledby="jcBalanceTitle" aria-live="polite"></aside>
</div>
<div class="jc-toast" id="jcToast" role="status" hidden></div>`;
const $=s=>panel.querySelector(s),$$=s=>[...panel.querySelectorAll(s)];
const dateInput=$('#jcDate');dateInput.max=A.todayKey();
{const min=new Date();min.setFullYear(min.getFullYear()-1);dateInput.min=A.keyForDate(min);}

/* ---------- Campos dinâmicos ---------- */
function stepper(id,label,value,min,max,hint=''){
  return `<div class="jc-field"><label for="${id}">${label}</label><div class="jc-stepper"><button type="button" data-step="${id}" data-delta="-1" aria-label="Diminuir: ${label}">−</button><input id="${id}" type="number" inputmode="numeric" min="${min}" max="${max}" step="1" value="${value}"><button type="button" data-step="${id}" data-delta="1" aria-label="Aumentar: ${label}">+</button></div>${hint?`<small>${hint}</small>`:''}</div>`;
}
function renderFields(){
  const a=activity(),r=residents(),f=$('#jcFields');let html='';
  // Sem edição manual, "pessoas" acompanha o número de moradores do perfil.
  if(!ui.peopleTouched&&!ui.editing&&r)ui.people=r;
  if(a.perPerson){
    $('#jcQtyTitle').textContent='Quantos banhos e por quanto tempo?';
    html+=stepper('jcPeople','Pessoas que tomaram banho',ui.people,1,r||20,r?`A casa tem ${r} morador${r>1?'es':''}.`:'Configure os moradores no perfil para facilitar.');
    html+=stepper('jcQty','Banhos de cada pessoa',ui.qty,1,MAX_QTY(a.id));
  }else if(a.liters===null){
    $('#jcQtyTitle').textContent='Quanta água, mais ou menos?';
    html+=`<div class="jc-field jc-field-wide"><label for="jcCustom">Litros usados ${a.id==='pool'?'para encher':'em cada limpeza'}</label><div class="jc-liters"><input id="jcCustom" type="number" inputmode="decimal" min="1" max="${a.id==='pool'?100000:1000}" step="any" placeholder="Ex.: ${a.id==='pool'?'1000':'20'}" value="${ui.custom??''}"><span>litros</span></div>
      <div class="jc-chips jc-mini">${(CUSTOM_CHIPS[a.id]||[]).map(([v,t])=>`<button type="button" data-custom="${v}">${t}</button>`).join('')}</div>
      <small>Não existe um valor padrão para isso: use uma estimativa sua. Um balde comum tem cerca de 10 litros.</small></div>`;
    html+=stepper('jcQty','Quantas vezes',ui.qty,1,MAX_QTY(a.id));
  }else{
    $('#jcQtyTitle').textContent=a.minutes?'Quantas vezes e por quanto tempo?':'Quantas vezes?';
    html+=stepper('jcQty',a.id==='laundry'?'Lavagens (ciclos da máquina)':'Quantas vezes',ui.qty,1,MAX_QTY(a.id));
  }
  if(a.minutes){
    html+=`<div class="jc-field jc-field-wide"><label for="jcMinutes">${a.perPerson?'Duração de cada banho':'Duração de cada vez'}</label>
      <div class="jc-chips jc-mini" role="radiogroup" aria-label="Duração rápida">${[5,10,15,20,30].map(v=>`<button type="button" role="radio" data-min="${v}">${v} min</button>`).join('')}</div>
      <div class="jc-minutes"><input id="jcMinutes" type="range" min="1" max="${MAX_MIN}" step="1" value="${ui.minutes}" aria-valuetext="${ui.minutes} minutos"><output for="jcMinutes" id="jcMinutesOut">${ui.minutes} min</output></div></div>`;
  }
  f.innerHTML=html;
  syncChips();
}
function syncChips(){
  $$('#jcDayChips [data-day]').forEach(b=>{const k=b.dataset.day==='today'?A.todayKey():b.dataset.day==='yesterday'?yesterday():null;
    const on=k?ui.day===k&&dateInput.hidden:!dateInput.hidden;b.setAttribute('aria-checked',String(on));b.classList.toggle('on',on);});
  $$('#jcTiles [data-group]').forEach(b=>{const on=b.dataset.group===ui.group;b.setAttribute('aria-checked',String(on));b.classList.toggle('on',on);b.tabIndex=on?0:-1;});
  const g=GROUPS.find(x=>x.key===ui.group),v=$('#jcVariants');
  v.hidden=g.variants.length<2;
  v.innerHTML=g.variants.length<2?'':g.variants.map(([id,name,hint])=>`<button type="button" role="radio" data-variant="${id}" aria-checked="${id===ui.id}" class="${id===ui.id?'on':''}"><b>${name}</b>${hint?`<small>${hint}</small>`:''}</button>`).join('');
  $$('[data-min]').forEach(b=>{const on=Number(b.dataset.min)===ui.minutes;b.classList.toggle('on',on);b.setAttribute('aria-checked',String(on));});
  $$('[data-custom]').forEach(b=>b.classList.toggle('on',Number(b.dataset.custom)===ui.custom));
}
function yesterday(){const d=new Date();d.setDate(d.getDate()-1);return A.keyForDate(d);}

/* ---------- Resultado ao vivo ---------- */
function renderResult(){
  const a=activity(),r=estimate(),box=$('#jcResult'),submit=$('#jcSubmit');
  const t=A.todayKey();
  submit.textContent=ui.editing?'Salvar alteração':ui.day===t?'Adicionar ao dia de hoje':ui.day===yesterday()?'Adicionar ao dia de ontem':'Adicionar ao dia '+parseKey(ui.day).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  if(r.error){box.className='jc-result is-error';box.innerHTML=`<p>${esc(r.error)}</p>`;submit.disabled=true;return;}
  submit.disabled=false;
  const cost=money(r.liters),src=M.sources[a.source],p=params();
  let saving='';
  if(a.minutes&&ui.minutes>5){
    try{const less=M.estimate(a.id,{...p,minutes:ui.minutes-5});saving=`<p class="jc-tip"><b>Dica:</b> com 5 minutos a menos, seriam cerca de <b>${L(r.liters-less)}</b> a menos.</p>`;}catch{}
  }
  const what=a.perPerson?`${p.residents} pessoa${p.residents>1?'s':''} × ${p.quantity} banho${p.quantity>1?'s':''} × ${ui.minutes} min`
    :a.liters===null?`${p.quantity} × ${L(ui.custom)}`:a.minutes?`${p.quantity} vez${p.quantity>1?'es':''} × ${ui.minutes} min`:`${p.quantity} vez${p.quantity>1?'es':''}`;
  box.className='jc-result';
  box.innerHTML=`<div class="jc-result-main"><span>Isso gasta cerca de</span><strong>${L(r.liters)}</strong><small>${m3(r.liters)}${cost?` · ≈ ${cost}`:''}</small></div>
    <p class="jc-result-what">${esc(what)}</p>${saving}
    <details class="jc-how-calc"><summary>Como calculamos</summary><p>${esc(a.conditions)}</p>
    <p>${a.liters===null?'Usamos o volume que você informou.':`Valor de referência: ${L(a.liters)} ${a.minutes?`em ${a.minutes} min (≈ ${L(a.liters/a.minutes)} por minuto)`:'por vez'}.`} É uma estimativa: não muda o que os sensores mediram.</p>
    <p>Fonte: ${src.url?`<a href="${src.url}" target="_blank" rel="noopener noreferrer">${esc(src.name)}</a>`:esc(src.name)}.</p></details>`;
}

/* ---------- Balanço do dia ---------- */
let lastBalance='';
function records(k=ui.day){return Array.isArray(state.activityRecords[k])?state.activityRecords[k]:[];}
function renderBalance(){
  const k=ui.day,h=state.history[k],list=records(k);
  const measured=h&&h.readings>0&&Number.isFinite(h.total1)&&Number.isFinite(h.total2)?h.total1+h.total2:null;
  const explained=list.reduce((s,x)=>s+(Number.isFinite(x.liters)&&x.liters>0?x.liters:0),0);
  const prof=M.dayProfile(h,state.household),expected=prof?prof.residents*prof.referenceLiters:null;
  const base=Math.max(measured||0,explained,1);
  const pct=measured?Math.min(100,explained/measured*100):null;
  let verdict,tone;
  if(measured===null){tone='neutral';verdict=`<b>Ainda não há medição para ${esc(dayLabel(k))}.</b> Você pode registrar mesmo assim; o balanço aparece quando houver leitura dos sensores.`;}
  else if(!list.length){tone='neutral';verdict=`<b>Nada registrado ainda.</b> Os sensores mediram ${L(measured)}. Adicione o que foi feito para explicar esse consumo.`;}
  else if(explained>=measured){tone='ok';verdict=`<b>Consumo explicado.</b> As atividades registradas cobrem toda a água medida${explained>measured*1.5?' — talvez algum valor esteja acima do real':''}.`;}
  else{const gap=measured-explained;tone=gap>measured*.3?'warn':'partial';
    verdict=`<b>Faltam ${L(gap)} sem explicação.</b> ${tone==='warn'?'Se ninguém usou água para mais nada, vale conferir se há torneira pingando ou vazamento.':'Pode ser descarga, torneira da pia ou outro uso pequeno.'}`;}
  const segs=list.map((x,i)=>Number.isFinite(x.liters)&&x.liters>0?`<span style="width:${x.liters/base*100}%;background:${colorOf(x.id)}" title="${esc(x.name)}: ${L(x.liters)}"></span>`:'').join('');
  const above=measured!==null&&expected?measured-expected:null;
  const html=`
    <div class="jc-bal-head"><span class="eyebrow">BALANÇO DO DIA</span><h3>${esc(dayLabel(k).replace(/^\w/,c=>c.toUpperCase()))}</h3><small>${parseKey(k).toLocaleDateString('pt-BR')}</small></div>
    <div class="jc-bal-nums">
      <div><span>Medido pelos sensores</span><strong>${measured===null?'—':L(measured)}</strong></div>
      <div><span>Explicado por você</span><strong>${L(explained)}</strong></div>
    </div>
    <div class="jc-bar" role="img" aria-label="${pct===null?'Sem medição':Math.round(pct)+'% da água medida está explicada'}">
      <div class="jc-bar-fill">${segs}</div>${measured!==null?`<i class="jc-bar-mark" style="left:${Math.min(100,measured/base*100)}%"><em>medido</em></i>`:''}
    </div>
    <p class="jc-bar-caption">${pct===null?'':`<b>${Math.round(pct)}%</b> da água medida tem explicação`}</p>
    <div class="jc-verdict is-${tone}">${verdict}</div>
    ${above!==null?`<p class="jc-ref">${above>0?`Esse dia passou <b>${L(above)}</b> do esperado para ${prof.residents} morador${prof.residents>1?'es':''} (${L(expected)}).`:`Esse dia ficou <b>dentro do esperado</b> para ${prof.residents} morador${prof.residents>1?'es':''} (${L(expected)}).`}</p>`:''}
    <h4 class="jc-list-title">Registrado neste dia <span>${list.length}</span></h4>
    ${list.length?`<ul class="jc-list">${list.map((x,i)=>`<li style="--c:${colorOf(x.id)}"><span class="jc-li-icon">${ICONS[groupOf(x.id).key]}</span><div><b>${esc(x.name)}</b><small>${esc(describe(x))}</small></div><strong>${L(x.liters)}</strong><div class="jc-li-actions"><button type="button" class="ghost-btn" data-edit="${i}" aria-label="Editar ${esc(x.name)}">Editar</button><button type="button" class="ghost-btn" data-remove="${i}" aria-label="Remover ${esc(x.name)}">Remover</button></div></li>`).join('')}</ul>`
      :'<p class="jc-empty">Nenhuma atividade registrada neste dia.</p>'}
    `;
  const box=$('#jcBalance');if(html===lastBalance)return;
  // Mantém o foco do teclado no mesmo botão quando o balanço é atualizado ao vivo.
  const f=document.activeElement,keep=box.contains(f)&&f.dataset?(f.dataset.edit!==undefined?`[data-edit="${f.dataset.edit}"]`:f.dataset.remove!==undefined?`[data-remove="${f.dataset.remove}"]`:null):null;
  box.innerHTML=html;lastBalance=html;
  if(keep)box.querySelector(keep)?.focus({preventScroll:true});
}
function describe(x){
  const parts=[];
  if(x.residentsUsed)parts.push(x.residentsUsed+' pessoa'+(x.residentsUsed>1?'s':''));
  parts.push(x.quantity+(x.residentsUsed?' banho'+(x.quantity>1?'s':'')+' cada':' vez'+(x.quantity>1?'es':'')));
  if(x.minutes)parts.push(x.minutes+' min');
  return parts.join(' · ');
}

/* ---------- Ações ---------- */
function refresh(){if(!panel.isConnected)return;renderFields();renderResult();renderBalance();}
function softRefresh(){renderResult();renderBalance();}
function pick(id){const a=M.activities.find(x=>x.id===id);if(!a)return;ui.id=id;ui.group=groupOf(id).key;if(a.minutes&&!ui.editing)ui.minutes=Math.min(MAX_MIN,a.id.startsWith('shower')?10:a.minutes);if(a.liters===null&&!ui.editing)ui.custom=null;ui.qty=Math.min(ui.qty,MAX_QTY(id));refresh();}
function setDay(k){ui.day=k;if(ui.editing)cancelEdit(false);renderBalance();renderResult();syncChips();}
function toast(html,undo){
  const t=$('#jcToast');clearTimeout(toast.timer);t.innerHTML=html+(undo?' <button type="button" id="jcUndo">Desfazer</button>':'');t.hidden=false;
  if(undo)$('#jcUndo').onclick=()=>{undo();t.hidden=true;};
  toast.timer=setTimeout(()=>{t.hidden=true;},6000);
}
function cancelEdit(render=true){ui.editing=null;$('#jcCancelEdit').hidden=true;panel.classList.remove('jc-editing');if(render)refresh();}
function commit(){A.save();A.refresh();window.dispatchEvent(new CustomEvent('hydrocasa:atividades'));}

panel.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.day){if(b.dataset.day==='other'){dateInput.hidden=false;dateInput.value=ui.day;dateInput.focus();try{dateInput.showPicker?.();}catch{}syncChips();}else{dateInput.hidden=true;setDay(b.dataset.day==='today'?A.todayKey():yesterday());}return;}
  if(b.dataset.group){const g=GROUPS.find(x=>x.key===b.dataset.group);pick(g.key===ui.group?ui.id:g.variants[0][0]);return;}
  if(b.dataset.variant){pick(b.dataset.variant);return;}
  if(b.dataset.min){ui.minutes=Number(b.dataset.min);const r=$('#jcMinutes');if(r){r.value=ui.minutes;$('#jcMinutesOut').textContent=ui.minutes+' min';}syncChips();renderResult();return;}
  if(b.dataset.custom){ui.custom=Number(b.dataset.custom);$('#jcCustom').value=ui.custom;syncChips();renderResult();return;}
  if(b.dataset.step){const input=$('#'+b.dataset.step);const v=Math.max(Number(input.min),Math.min(Number(input.max),(Number(input.value)||0)+Number(b.dataset.delta)));input.value=v;input.dispatchEvent(new Event('input',{bubbles:true}));return;}
  if(b.dataset.remove!==undefined){
    const k=ui.day,list=records(k),i=Number(b.dataset.remove),[removed]=list.splice(i,1);if(!removed)return;
    if(ui.editing&&ui.editing.day===k)cancelEdit(false);
    commit();refresh();
    toast(`<b>${esc(removed.name)}</b> removido.`,()=>{if(!Array.isArray(state.activityRecords[k]))state.activityRecords[k]=[];state.activityRecords[k].splice(i,0,removed);commit();refresh();});
    return;}
  if(b.dataset.edit!==undefined){
    const x=records()[Number(b.dataset.edit)];if(!x)return;
    ui.editing={day:ui.day,index:Number(b.dataset.edit)};ui.id=x.id;ui.group=groupOf(x.id).key;ui.qty=x.quantity||1;
    if(x.minutes)ui.minutes=Math.round(x.minutes);if(x.residentsUsed)ui.people=x.residentsUsed;
    const a=M.activities.find(y=>y.id===x.id);if(a&&a.liters===null)ui.custom=Math.round(x.liters/(x.quantity||1)*10)/10;
    $('#jcCancelEdit').hidden=false;panel.classList.add('jc-editing');refresh();$('#jcForm').scrollIntoView({block:'start',behavior:'smooth'});
    $('#jcFeedback').textContent='Editando '+x.name+'. Ajuste os valores e salve.';return;}
});
$('#jcCancelEdit').onclick=()=>{cancelEdit();$('#jcFeedback').textContent='';};
dateInput.addEventListener('change',()=>{if(dateInput.value&&dateInput.value<=A.todayKey())setDay(dateInput.value);});
$('#jcTiles').addEventListener('keydown',e=>{
  const tiles=$$('#jcTiles [data-group]'),i=tiles.findIndex(t=>t.dataset.group===ui.group);let n=null;
  if(e.key==='ArrowRight'||e.key==='ArrowDown')n=(i+1)%tiles.length;if(e.key==='ArrowLeft'||e.key==='ArrowUp')n=(i+tiles.length-1)%tiles.length;
  if(n!==null){e.preventDefault();tiles[n].click();$$('#jcTiles [data-group]')[n].focus();}
});
panel.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='jcPeople'){ui.people=Math.round(Number(t.value));ui.peopleTouched=true;}
  else if(t.id==='jcQty')ui.qty=Math.round(Number(t.value));
  else if(t.id==='jcMinutes'){ui.minutes=Number(t.value);$('#jcMinutesOut').textContent=ui.minutes+' min';t.setAttribute('aria-valuetext',ui.minutes+' minutos');syncChips();}
  else if(t.id==='jcCustom'){ui.custom=t.value===''?null:Number(t.value);syncChips();}
  else return;
  renderResult();
});
$('#jcForm').addEventListener('submit',e=>{
  e.preventDefault();
  const r=estimate(),fb=$('#jcFeedback');
  if(r.error){fb.textContent=r.error;fb.className='jc-feedback is-error';return;}
  const a=activity(),p=params();
  const record={name:a.name,id:a.id,liters:r.liters,observed:null,quantity:p.quantity,minutes:a.minutes?ui.minutes:null,
    residentsUsed:a.perPerson?p.residents:null,sourceName:M.sources[a.source].name,sourceId:a.source,referenceVersion:'2026-10-13',
    tolerance:state.household?state.household.tolerance:10,comparison:null,at:Date.now()};
  if(ui.editing){
    const list=records(ui.editing.day);record.at=list[ui.editing.index]?.at||record.at;list[ui.editing.index]=record;cancelEdit(false);
    fb.textContent='Alteração salva.';
  }else{
    if(!Array.isArray(state.activityRecords[ui.day]))state.activityRecords[ui.day]=[];
    state.activityRecords[ui.day].push(record);
    fb.textContent=`${a.name} adicionado a ${dayLabel(ui.day)}: ${L(r.liters)}.`;
  }
  fb.className='jc-feedback is-ok';
  commit();refresh();
  const last=$('.jc-list li:last-child');if(last){last.classList.add('jc-new');}
  if(state.storageError)fb.textContent+=' (não foi possível salvar no navegador; o registro vale só nesta sessão.)';
});

/* ---------- API pública ---------- */
function open(dayKey){
  if(dayKey&&/^\d{4}-\d{2}-\d{2}$/.test(dayKey)&&dayKey<=A.todayKey()){ui.day=dayKey;const t=A.todayKey();dateInput.hidden=dayKey===t||dayKey===yesterday();if(!dateInput.hidden)dateInput.value=dayKey;}
  document.querySelector('.tab[data-panel="activities"]')?.click();
  refresh();
  requestAnimationFrame(()=>{panel.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});$('#jcTiles .on')?.focus({preventScroll:true});});
}
window.HydroAtividades={open,refresh,groups:GROUPS};
/* Dia virou enquanto a página estava aberta: "hoje" passa a ser o novo dia. */
let lastToday=A.todayKey();
setInterval(()=>{const t=A.todayKey();if(t!==lastToday){if(ui.day===lastToday)ui.day=t;lastToday=t;dateInput.max=t;refresh();}else if(!document.hidden&&ui.day===t&&panel.classList.contains('active-panel'))renderBalance();},5000);
refresh();
})();
