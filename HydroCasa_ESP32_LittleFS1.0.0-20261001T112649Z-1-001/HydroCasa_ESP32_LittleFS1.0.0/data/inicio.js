/* HydroCasa — página inicial pensada para quem não é técnico.
   • "Hoje na sua casa": litros do dia, situação em palavras simples, reais e água correndo agora.
   • Gráficos "Quando a água foi usada hoje" (por hora), "Últimos 7 dias" e "Onde a água foi usada".
   • Aviso de água correndo sem parar (possível vazamento ou torneira esquecida).
   • Boas-vindas guiada no primeiro acesso.
   Somente leitura das medições: não altera leituras, totais ou snapshots. */
(()=>{'use strict';
const A=window.HydroApp,M=window.HydroConsumption,F=window.HydroFinance;
const dash=document.getElementById('dashboard-page');
if(!A||!M||!F||!dash)return;
const {state}=A,esc=A.escapeHtml;
const q=s=>document.querySelector(s);
const store={get(k,s=localStorage){try{return s.getItem(k);}catch{return null;}},set(k,v,s=localStorage){try{s.setItem(k,v);}catch{}},del(k,s=localStorage){try{s.removeItem(k);}catch{}}};
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Formatação ---------- */
const num=(v,d=0)=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:0});
const L=v=>!Number.isFinite(v)?'—':v<10&&v>0?num(v,1)+' L':num(Math.round(v))+' L';
const m3=v=>Number.isFinite(v)?(v/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' m³':'—';
const money=v=>Number.isFinite(v)?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
const settings=()=>F.read(localStorage);
const cost=l=>{const p=settings().pricePerM3;return Number.isFinite(p)&&p>0&&Number.isFinite(l)?l/1000*p:null;};
const dayKey=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return A.keyForDate(d);};
const WD=['dom','seg','ter','qua','qui','sex','sáb'];

/* ---------- Níveis em linguagem simples (mesmas faixas do tom do site) ---------- */
const LEVEL={
  normal:{tone:'ok',title:'Dentro do esperado',icon:'✓'},
  leve:{tone:'leve',title:'Um pouco acima do esperado',icon:'!'},
  moderado:{tone:'moderado',title:'Acima do esperado',icon:'!'},
  alto:{tone:'alto',title:'Bem acima do esperado',icon:'!!'},
  extremo:{tone:'extremo',title:'Muito acima do esperado',icon:'!!'}
};
function levelFor(total,expected,tolerance){
  if(!(expected>0)||!Number.isFinite(total))return null;
  const l=F.spendingLevel((total/expected-1)*100,tolerance);return l?l.id:null;
}

/* ---------- Dados: reais primeiro; demonstração só quando ativa e sem dados reais ---------- */
const demoOn=()=>document.body.dataset.demoActive==='true';
function demoWeek(){try{const o=JSON.parse(store.get('hydrocasa:semana-demo',sessionStorage)||'null');return o&&o.version===1&&Array.isArray(o.values)&&o.values.length===7?o:null;}catch{return null;}}
function realDay(k){const h=state.history[k];return h&&h.readings>0&&Number.isFinite(h.total1)&&Number.isFinite(h.total2)?h:null;}
function profile(){return state.household||null;}
function dayData(k){
  const h=realDay(k);
  if(h)return {k,r1:h.total1,r2:h.total2,total:h.total1+h.total2,hours:Array.isArray(h.hours)&&h.hours.length===24?h.hours:null,profile:M.dayProfile(h,state.household),demo:false};
  const w=demoOn()&&demoWeek();
  if(w){const d=new Date(k+'T12:00:00'),v=w.values[d.getDay()];
    // Na demonstração, o dia de hoje cresce ao longo do dia para não mostrar o total antes da hora.
    let f=1;if(k===A.todayKey()){const n=new Date();f=Math.min(1,cumulative(n.getHours()+n.getMinutes()/60));}
    const r1=v[0]*f,r2=v[1]*f;
    return {k,r1,r2,total:r1+r2,hours:hoursFrom(r1+r2,k===A.todayKey()?new Date().getHours():23,f),profile:{...M.defaults,residents:w.residents,scope:'whole'},demo:true};}
  return null;
}
/* Perfil típico de uso residencial ao longo do dia (picos de manhã e à noite) — só para a demonstração. */
const SHAPE=[1,.5,.3,.3,.4,1.5,5,8,6,4,3,3.5,5,4,3,2.5,3,4.5,7,8,6.5,4.5,3,1.8];
const SHAPE_SUM=SHAPE.reduce((a,b)=>a+b,0);
function cumulative(hour){let s=0;for(let i=0;i<24;i++){if(i+1<=hour)s+=SHAPE[i];else{s+=SHAPE[i]*Math.max(0,hour-i);break;}}return s/SHAPE_SUM;}
function hoursFrom(total,upto,f){const full=f>0?total/f:0;return SHAPE.map((s,i)=>i<upto?full*s/SHAPE_SUM:i===upto?Math.max(0,total-SHAPE.slice(0,i).reduce((a,b)=>a+b,0)/SHAPE_SUM*full):0);}

/* ---------- Estrutura ---------- */
const ICON={
  drop:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z" fill="currentColor"/></svg>',
  tap:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h9a3 3 0 0 1 3 3v1h3v-2"/><path d="M8 9V6h4v3M6 6h8"/><path d="M17.5 17c0 1.1-.7 2-1.5 2s-1.5-.9-1.5-2 1.5-3 1.5-3 1.5 1.9 1.5 3z"/></svg>',
  warn:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>'
};
const hoje=document.createElement('section');hoje.id='hojeResumo';hoje.className='hc-hoje';hoje.setAttribute('aria-labelledby','hcHojeTitle');
hoje.innerHTML=`
<div class="hc-leak" id="hcLeak" role="alert" hidden></div>
<div class="hc-hoje-grid">
  <div class="hc-main">
    <div class="hc-kicker"><span class="hc-live-dot" aria-hidden="true"></span><span id="hcHojeTitle">HOJE NA SUA CASA</span><span class="hc-date" id="hcDate"></span><span class="hc-demo-tag" id="hcDemoTag" hidden>DEMONSTRAÇÃO</span></div>
    <div class="hc-big"><strong id="hcLiters">—</strong><span id="hcLitersUnit">litros</span></div>
    <p class="hc-sub" id="hcSub">Aguardando as leituras do ESP32…</p>
    <div class="hc-money" id="hcMoney"></div>
    <div class="hc-verdict" id="hcVerdict" data-tone="neutral"></div>
  </div>
  <div class="hc-gauge-wrap">
    <div class="hc-gauge" id="hcGauge" role="img" aria-label="Comparação com o esperado">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="hc-g-track" cx="60" cy="60" r="50"/><circle class="hc-g-fill" id="hcGaugeFill" cx="60" cy="60" r="50" pathLength="100"/><circle class="hc-g-over" id="hcGaugeOver" cx="60" cy="60" r="50" pathLength="100"/></svg>
      <div class="hc-g-center"><strong id="hcGaugePct">—</strong><span>do esperado</span></div>
    </div>
    <p class="hc-gauge-cap" id="hcGaugeCap">Informe os moradores para comparar.</p>
  </div>
  <div class="hc-now" id="hcNow" aria-live="polite">
    <span class="hc-now-title">AGORA</span>
    <div class="hc-now-body" id="hcNowBody"></div>
  </div>
</div>
<div class="hc-facts" id="hcFacts"></div>
<p class="hc-tip" id="hcTip"></p>
<div class="hc-actions">
  <button type="button" class="primary-btn" id="hcJustify">Justificar o consumo de hoje</button>
  <button type="button" class="ghost-btn" id="hcReport">Baixar relatório em PDF</button>
  <button type="button" class="ghost-btn hc-link" id="hcTour">Como funciona? Fazer o tour</button>
</div>`;
const anchor=q('#dashboard-page .hero-premium');
(anchor||q('#dashboard-page .dashboard-shortcuts-area'))?.after(hoje);
const $=id=>document.getElementById(id);

/* Gráficos no início da aba Visão geral. */
const charts=document.createElement('div');charts.className='hc-charts';charts.id='usoGraficos';
charts.innerHTML=`
<article class="glass-card hc-chart-card hc-hours"><div class="hc-chart-head"><div><h3>Quando a água foi usada hoje</h3><p id="hcHoursSub">Litros em cada hora do dia.</p></div><span class="hc-chip" id="hcHoursPeak"></span></div><div class="hc-bars hc-bars-24" id="hcHours" role="img"></div><div class="hc-axis hc-axis-24" aria-hidden="true">${[0,3,6,9,12,15,18,21].map(h=>`<span style="left:${(h+.5)/24*100}%">${h}h</span>`).join('')}</div></article>
<article class="glass-card hc-chart-card hc-week"><div class="hc-chart-head"><div><h3>Últimos 7 dias</h3><p>Cada barra é um dia. A linha tracejada é o esperado para os moradores.</p></div></div><div class="hc-bars hc-bars-7" id="hcWeek" role="img"></div><div class="hc-legend" id="hcWeekLegend"></div></article>
<article class="glass-card hc-chart-card hc-split"><div class="hc-chart-head"><div><h3>Onde a água foi usada hoje</h3><p>Cada sensor mede um ponto da casa.</p></div></div><div id="hcSplit"></div></article>`;
hoje.after(charts);

/* Números técnicos ficam recolhidos para não confundir. */
const tech=document.createElement('details');tech.className='hc-tecnico';tech.id='numerosDetalhados';
tech.innerHTML='<summary><span><b>Ver todos os números</b><small>Volumes em m³, vazão de cada sensor, referência e status técnico.</small></span></summary><div class="hc-tecnico-body"></div>';
const metrics=q('#dashboard-page .metrics-grid');
if(metrics){metrics.before(tech);const body=tech.querySelector('.hc-tecnico-body');for(const el of [q('#consumptionStatusCard'),metrics,q('#dashboard-page .comparison-grid')])if(el)body.append(el);}
/* Dados demonstrativos: ferramenta de apresentação, vai para a aba Sistema. */
const studio=$('demoDataStudio'),settingsPanel=$('settings');
if(studio&&settingsPanel){settingsPanel.querySelector('.settings-grid')?.after(studio);}

/* ---------- Render: hoje ---------- */
function expectedFor(p){return p&&p.residents>0?p.residents*p.referenceLiters:null;}
function names(){const p=profile()||M.defaults;return [p.ramal1||'Ramal 01',p.ramal2||'Ramal 02'];}
function liveFresh(){return state.connected&&state.lastValidAt&&Date.now()-state.lastValidAt<15000;}
function renderHoje(){
  const t=dayData(A.todayKey()),p=t?.profile||profile(),exp=expectedFor(p),tol=p?.tolerance??10;
  const now=new Date();
  $('hcDate').textContent=now.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  $('hcDemoTag').hidden=!t?.demo;
  hoje.dataset.demo=t?.demo?'true':'false';
  // Total
  if(t){$('hcLiters').textContent=num(Math.round(t.total));$('hcLitersUnit').textContent=Math.round(t.total)===1?'litro':'litros';
    $('hcSub').innerHTML=`É o mesmo que <b>${m3(t.total)}</b> — a unidade usada na conta de água.`;}
  else{$('hcLiters').textContent='—';$('hcLitersUnit').textContent='litros';
    $('hcSub').textContent=state.demoMode?'Este endereço não recebe dados do ESP32. Abra o site pelo endereço do ESP32 para ver as medições.':liveFresh()?'Nenhuma água passou pelos sensores hoje.':'Aguardando as leituras do ESP32…';}
  // Dinheiro
  const s=settings(),c=t?cost(t.total):null;
  if(c!==null){
    let proj='';try{if(!t.demo){const sum=F.summarize({period:F.resolvePeriod('thisMonth',{},now),history:state.history,currentProfile:state.household,settings:s,now});if(Number.isFinite(sum.money.projectedWithFixed))proj=`<span>Previsão da conta do mês: <b>${money(sum.money.projectedWithFixed)}</b></span>`;}}catch{}
    $('hcMoney').innerHTML=`<span>Custo de hoje: <b>${money(c)}</b></span>${proj}`;
  }else $('hcMoney').innerHTML=s.pricePerM3?'':`<button type="button" class="hc-inline-btn" data-hc="price">Quer ver em reais? Informe o preço da água →</button>`;
  // Situação
  const v=$('hcVerdict');let pct=null;
  if(!p){v.dataset.tone='neutral';v.innerHTML=`<span class="hc-v-icon" aria-hidden="true">?</span><div><b>Quantas pessoas moram aqui?</b><small>Com isso, o HydroCasa diz se o consumo está dentro do esperado.</small></div><button type="button" class="primary-btn" data-hc="wizard">Configurar</button>`;}
  else if(!t){v.dataset.tone='neutral';v.innerHTML=`<span class="hc-v-icon" aria-hidden="true">…</span><div><b>Sem medições hoje ainda</b><small>Esperado para ${p.residents} morador${p.residents>1?'es':''}: até ${L(exp)} por dia.</small></div>`;}
  else{
    pct=t.total/exp*100;const id=levelFor(t.total,exp,tol)||'normal',lv=LEVEL[id];
    const scopeNote=p.scope==='whole'?'':' Comparação ilustrativa: os sensores medem só alguns pontos da casa.';
    let detail;
    if(id==='normal')detail=t.total<=exp?`Faltam <b>${L(exp-t.total)}</b> para chegar ao esperado de hoje (${L(exp)} para ${p.residents} morador${p.residents>1?'es':''}).`:`Ficou só um pouco acima de ${L(exp)}, dentro da margem de ${num(tol)}%.`;
    else detail=`Passou <b>${L(t.total-exp)}</b> do esperado (${L(exp)} para ${p.residents} morador${p.residents>1?'es':''}). Se houve um motivo, registre em “Justificar consumo”.`;
    v.dataset.tone=lv.tone;v.innerHTML=`<span class="hc-v-icon" aria-hidden="true">${lv.icon}</span><div><b>${id==='normal'&&t.total<=exp?'Até agora, dentro do esperado':lv.title}</b><small>${detail}${scopeNote}</small></div>`;
  }
  // Medidor
  const fill=$('hcGaugeFill'),over=$('hcGaugeOver');
  if(pct===null){fill.style.strokeDasharray='0 100';over.style.strokeDasharray='0 100';fill.style.opacity=0;over.style.opacity=0;$('hcGaugePct').textContent='—';$('hcGauge').dataset.tone='neutral';
    $('hcGaugeCap').textContent=p?'Aguardando medições.':'Informe os moradores para comparar.';}
  else{const a=Math.min(100,pct),b=Math.min(100,Math.max(0,pct-100));
    // Abaixo de 1% o traço arredondado viraria um ponto solto; nesse caso não desenha.
    fill.style.strokeDasharray=`${a} 100`;over.style.strokeDasharray=`${b} 100`;fill.style.opacity=a<1?0:1;over.style.opacity=b<1?0:1;
    $('hcGaugePct').textContent=num(Math.round(pct))+'%';$('hcGauge').dataset.tone=$('hcVerdict').dataset.tone;
    $('hcGauge').setAttribute('aria-label',`Hoje: ${num(Math.round(pct))}% do esperado para os moradores`);
    $('hcGaugeCap').innerHTML=`Esperado: até <b>${L(exp)}</b> por dia<br><small>${p.residents} × ${num(p.referenceLiters,1)} L por pessoa (média nacional SNIS)</small>`;}
  renderNow(t);renderFacts(t,exp);renderTip(t);
}
function renderNow(t){
  const [n1,n2]=names(),body=$('hcNowBody'),now=$('hcNow');
  if(t?.demo&&!liveFresh()){now.dataset.state='demo';body.innerHTML=`<p class="hc-now-off">Modo demonstração: os valores são fictícios. Conecte o ESP32 para ver a água passando em tempo real.</p>`;return;}
  if(!liveFresh()){now.dataset.state='off';body.innerHTML=`<p class="hc-now-off"><b>${state.demoMode?'Sem ESP32 neste endereço':'Sem conexão com o ESP32'}</b>${state.lastValidAt?'Última leitura às '+new Date(state.lastValidAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Verifique se o ESP32 está ligado e no mesmo Wi-Fi.'}</p>`;return;}
  const f=[state.live.flow1_lpm||0,state.live.flow2_lpm||0],min=window.HydroAlertConfig?.minimumFlow??0.05,running=f.map(x=>x>min);
  now.dataset.state=running.some(Boolean)?'flow':'idle';
  body.innerHTML=running.some(Boolean)
    ?`<div class="hc-now-flow">${ICON.tap}<div><b>Água correndo</b><span>${num(f[0]+f[1],1)} litros por minuto</span></div></div><ul>${[0,1].map(i=>`<li class="${running[i]?'on':''}"><i aria-hidden="true"></i>${esc(i?n2:n1)}<b>${running[i]?num(f[i],1)+' L/min':'parado'}</b></li>`).join('')}</ul>`
    :`<div class="hc-now-flow is-idle">${ICON.tap}<div><b>Nenhuma água correndo</b><span>Todas as saídas monitoradas estão fechadas.</span></div></div><ul>${[n1,n2].map(n=>`<li><i aria-hidden="true"></i>${esc(n)}<b>parado</b></li>`).join('')}</ul>`;
}
function renderFacts(t,exp){
  const out=[];
  if(t&&t.total>0){
    const buckets=t.total/10;out.push(`<div><span>Equivale a</span><b>${num(Math.max(1,Math.round(buckets)))} balde${Math.round(buckets)>1?'s':''}</b><small>de 10 litros</small></div>`);
    const y=dayData(dayKey(-1));
    if(y&&y.total>0){const n=new Date(),frac=t.demo?1:Math.max(.05,(n.getHours()*60+n.getMinutes())/1440);
      out.push(`<div><span>Ontem, no dia todo</span><b>${L(y.total)}</b><small>${t.total>=y.total?'hoje já passou de ontem':'hoje: '+num(Math.round(t.total/y.total*100))+'% disso até agora'}</small></div>`);}
    const days=[...Array(7)].map((_,i)=>dayData(dayKey(-(i+1)))).filter(Boolean);
    if(days.length>=2){const avg=days.reduce((s,d)=>s+d.total,0)/days.length;out.push(`<div><span>Média por dia</span><b>${L(avg)}</b><small>últimos ${days.length} dias</small></div>`);}
  }
  $('hcFacts').innerHTML=out.join('');$('hcFacts').hidden=!out.length;
}
/* Dica ligada ao ponto que mais gastou hoje (pelo nome que a pessoa deu ao sensor). */
const TIPS=[
  [/banh|chuv|ducha/i,'No chuveiro, cada minuto conta: uma ducha gasta cerca de 9 litros por minuto. Fechar a água ao se ensaboar ajuda muito.'],
  [/cozinh|pia|lou[cç]/i,'Na cozinha, lavar a louça com a cuba cheia gasta cerca de 20 litros; com a torneira aberta por 15 minutos, cerca de 117 litros.'],
  [/lavand|roup|m[aá]quina|tanque/i,'Junte roupa e use a máquina sempre cheia: cada ciclo de 5 kg gasta cerca de 135 litros.'],
  [/jard|extern|quintal|horta|rega/i,'Regar com mangueira por 10 minutos gasta cerca de 186 litros. Prefira regador e horários mais frescos.'],
  [/descarg|vaso|sanit/i,'Uma descarga com vazamento pode gastar muita água sem ninguém perceber. Observe se a água continua escorrendo no vaso.']
];
function renderTip(t){
  const [n1,n2]=names();let tip='Uma torneira pingando desperdiça água o dia inteiro. Se o painel mostrar água correndo sem ninguém usar, verifique.';
  if(t&&t.total>0){const top=t.r1>=t.r2?n1:n2,share=Math.round(Math.max(t.r1,t.r2)/t.total*100);
    const found=TIPS.find(([re])=>re.test(top));if(found)tip=`<b>${esc(top)}</b> usou ${share}% da água de hoje. ${found[1]}`;
    else tip=`<b>${esc(top)}</b> usou ${share}% da água de hoje. ${tip}`;}
  $('hcTip').innerHTML='<span class="hc-tip-label">Dica</span> '+tip;
}

/* ---------- Gráficos ---------- */
function renderHours(){
  const t=dayData(A.todayKey()),box=$('hcHours'),hours=t?.hours,cur=new Date().getHours();
  if(!hours||!hours.some(v=>v>0)){
    box.innerHTML=`<p class="hc-empty">${t?'Este gráfico começa a ser preenchido a partir de agora, a cada leitura do ESP32.':'Sem medições hoje ainda.'}</p>`;$('hcHoursPeak').hidden=true;
    $('hcHoursSub').textContent='Litros em cada hora do dia.';box.setAttribute('aria-label','Sem dados por hora');return;}
  const max=Math.max(...hours,1),peak=hours.indexOf(Math.max(...hours));
  box.innerHTML=hours.map((v,i)=>`<div class="hc-bar${i===cur?' is-now':''}${i>cur?' is-future':''}${i===peak?' is-peak':''}" style="--h:${v/max*100}%"><span class="hc-bar-fill"></span><span class="hc-tt">${i}h–${i+1}h: <b>${L(v)}</b></span></div>`).join('');
  $('hcHoursPeak').hidden=false;$('hcHoursPeak').textContent=`Maior uso: ${peak}h–${peak+1}h (${L(hours[peak])})`;
  $('hcHoursSub').textContent=t.demo?'Distribuição ilustrativa ao longo do dia (demonstração).':'Litros em cada hora do dia. Passe o mouse sobre as barras.';
  box.setAttribute('aria-label',`Uso por hora hoje; maior uso entre ${peak}h e ${peak+1}h, com ${L(hours[peak])}`);
}
function renderWeek(){
  const days=[...Array(7)].map((_,i)=>{const k=dayKey(i-6);return {k,d:dayData(k),today:i===6};});
  const p=profile(),exp=expectedFor(p),tol=p?.tolerance??10;
  const max=Math.max(exp?exp*1.15:0,...days.map(x=>x.d?.total||0),1);
  const box=$('hcWeek');
  if(!days.some(x=>x.d)){box.innerHTML='<p class="hc-empty">Sem medições nos últimos 7 dias.</p>';$('hcWeekLegend').innerHTML='';return;}
  box.innerHTML=days.map(({k,d,today})=>{const dt=new Date(k+'T12:00:00'),lv=d&&exp?levelFor(d.total,exp,tol):null;
    return `<div class="hc-bar hc-day${today?' is-now':''}" data-level="${lv||'none'}" style="--h:${d?d.total/max*100:0}%"><span class="hc-val">${d?L(d.total):'—'}</span><span class="hc-bar-fill"></span><span class="hc-day-label">${today?'hoje':WD[dt.getDay()]}<small>${dt.getDate()}</small></span><span class="hc-tt">${dt.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})}: <b>${d?L(d.total):'sem leitura'}</b>${today&&d?' (até agora)':''}</span></div>`;}).join('')
    +(exp?`<i class="hc-ref-line" style="bottom:${exp/max*100}%"></i>`:'');
  box.setAttribute('aria-label','Consumo dos últimos 7 dias: '+days.map(x=>(x.today?'hoje':WD[new Date(x.k+'T12:00:00').getDay()])+' '+(x.d?L(x.d.total):'sem leitura')).join(', '));
  $('hcWeekLegend').innerHTML=exp?`<span><i class="lg-line"></i>esperado: ${L(exp)} por dia</span><span><i class="lg-ok"></i>dentro</span><span><i class="lg-leve"></i>um pouco acima</span><span><i class="lg-up"></i>acima</span><span><i class="lg-high"></i>bem acima</span>`:'<span>Informe os moradores para ver o esperado.</span>';
}
function renderSplit(){
  const t=dayData(A.todayKey()),[n1,n2]=names(),box=$('hcSplit');
  if(!t){box.innerHTML='<p class="hc-empty">Sem medições hoje ainda.</p>';return;}
  const rows=[[n1,t.r1,1],[n2,t.r2,2]],f=[state.live.flow1_lpm||0,state.live.flow2_lpm||0],min=window.HydroAlertConfig?.minimumFlow??0.05;
  box.innerHTML=rows.map(([n,v,i])=>{const pct=t.total?v/t.total*100:0;return `<div class="hc-split-row s${i}"><div class="hc-split-top"><b>${esc(n)}${liveFresh()&&f[i-1]>min?' <span class="hc-flowing">● correndo</span>':''}</b><span>${L(v)} · <b>${num(Math.round(pct))}%</b></span></div><div class="hc-split-track"><span style="width:${pct}%"></span></div></div>`;}).join('')
    +`<p class="hc-split-note">${t.total<=0?'Nenhuma água passou pelos sensores hoje. ':''}Total de hoje: <b>${L(t.total)}</b>${cost(t.total)!==null?' · '+money(cost(t.total)):''}</p>`;
}

/* ---------- Água correndo sem parar ---------- */
const LEAK_KEY='hydrocasa:fluxo-continuo',LIMIT_KEY='hydrocasa:vazamento-minutos';
const limitMin=()=>{const v=Number(store.get(LIMIT_KEY));return [1,5,10,20,30,60].includes(v)?v:(window.HydroAlertConfig?.continuousMinutes||20);};
let leak=(()=>{try{return JSON.parse(store.get(LEAK_KEY,sessionStorage)||'null')||{};}catch{return {};}})();
let leakTest=false;
function trackLeak(){
  if(!liveFresh())return;
  const now=Date.now(),min=window.HydroAlertConfig?.minimumFlow??0.05,f=[state.live.flow1_lpm||0,state.live.flow2_lpm||0];
  for(const i of [0,1]){const r=leak['r'+i];
    if(f[i]>min){if(!r||now-r.last>20000)leak['r'+i]={since:now,last:now,flow:f[i]};else{r.last=now;r.flow=f[i];}}
    else if(r&&now-r.last>20000)delete leak['r'+i];
    else if(r&&f[i]<=min){/* uma leitura parada encerra o fluxo contínuo */delete leak['r'+i];}
  }
  store.set(LEAK_KEY,JSON.stringify(leak),sessionStorage);
}
function renderLeak(){
  const box=$('hcLeak'),[n1,n2]=names(),lim=limitMin()*60000,now=Date.now();
  let hit=null;
  if(leakTest)hit={name:n1,mins:limitMin()+2,flow:6,test:true};
  else for(const i of [0,1]){const r=leak['r'+i];if(r&&liveFresh()&&now-r.since>=lim&&leak['ok'+i]!==r.since){const mins=(now-r.since)/60000;if(!hit||mins>hit.mins)hit={i,name:i?n2:n1,mins,flow:r.flow,since:r.since};}}
  document.body.classList.toggle('hc-leak-on',!!hit);
  if(!hit){box.hidden=true;box.innerHTML='';return;}
  box.hidden=false;
  const html=`<span class="hc-leak-icon">${ICON.warn}</span><div class="hc-leak-copy"><b>${hit.test?'[TESTE] ':''}Água correndo sem parar há ${num(Math.floor(hit.mins))} minuto${Math.floor(hit.mins)>1?'s':''} — ${esc(hit.name)}</b>
    <span>Cerca de ${num(hit.flow,1)} litros por minuto, sem pausa. Pode ser uma torneira esquecida aberta, uma descarga com defeito ou um vazamento.</span>
    <details><summary>Como verificar</summary><ol><li>Confira se alguma torneira, chuveiro ou mangueira ficou aberta em ${esc(hit.name)}.</li><li>Olhe o vaso sanitário: água escorrendo sem parar indica defeito na descarga.</li><li>Feche todas as saídas: se o painel continuar mostrando água correndo, pode haver vazamento no cano.</li></ol></details></div>
    <div class="hc-leak-actions"><button type="button" data-hc="leak-ok">${hit.test?'Encerrar teste':'Está tudo bem, é uso normal'}</button></div>`;
  if(box.dataset.key!==String(hit.test||hit.since)+Math.floor(hit.mins)){box.innerHTML=html;box.dataset.key=String(hit.test||hit.since)+Math.floor(hit.mins);box.dataset.i=hit.i??'';}
}

/* ---------- Boas-vindas guiada ---------- */
const WELCOME_KEY='hydrocasa:boas-vindas';
const SPOTS=['Cozinha','Banheiro','Chuveiro','Lavanderia','Área externa','Jardim'];
let wiz=null;
function wizard(){
  if(wiz)return;
  const p=profile()||M.defaults,s=settings();
  const data={residents:p.residents||3,ramal1:p.ramal1&&p.ramal1!=='Ramal 01'?p.ramal1:'Cozinha',ramal2:p.ramal2&&p.ramal2!=='Ramal 02'?p.ramal2:'Banheiro',scope:profile()?p.scope:'whole',price:s.pricePerM3||'',step:0};
  const prev=document.activeElement;
  wiz=document.createElement('div');wiz.className='hc-wiz-layer';
  wiz.innerHTML=`<section class="hc-wiz" role="dialog" aria-modal="true" aria-labelledby="hcWizTitle"><div class="hc-wiz-progress"><span id="hcWizBar"></span></div><button type="button" class="hc-wiz-close" data-w="close" aria-label="Fechar">×</button><div class="hc-wiz-body" id="hcWizBody"></div><div class="hc-wiz-foot"><button type="button" class="ghost-btn" data-w="back">Voltar</button><span id="hcWizCount"></span><button type="button" class="primary-btn" data-w="next">Continuar</button></div></section>`;
  document.body.append(wiz);document.body.classList.add('hc-wiz-open');
  const body=wiz.querySelector('#hcWizBody'),steps=5;
  const chipRow=(n)=>`<div class="hc-wiz-chips">${SPOTS.map(x=>`<button type="button" data-spot="${n}" data-v="${x}" class="${data['ramal'+n]===x?'on':''}">${x}</button>`).join('')}</div>`;
  function paint(){
    const st=data.step;
    wiz.querySelector('#hcWizBar').style.width=((st+1)/steps*100)+'%';
    wiz.querySelector('#hcWizCount').textContent=`${st+1} de ${steps}`;
    wiz.querySelector('[data-w=back]').style.visibility=st===0||st===4?'hidden':'visible';
    const next=wiz.querySelector('[data-w=next]');next.textContent=st===0?'Começar':st===3?(data.price?'Continuar':'Pular por agora'):st===4?'Ir para o painel':'Continuar';
    if(st===0)body.innerHTML=`<div class="hc-wiz-hero">${ICON.drop}</div><h2 id="hcWizTitle">Bem-vindo ao HydroCasa</h2><p class="hc-wiz-lead">Em 1 minuto o painel fica pronto para a sua casa.</p>
      <ul class="hc-wiz-list"><li><b>Veja quanta água a casa usa</b>em litros, ao vivo, medida pelos sensores.</li><li><b>Saiba se está normal</b>comparando com o esperado para quem mora aí.</li><li><b>Descubra onde e quando</b>a água foi usada — e receba aviso se ficar correndo sem parar.</li></ul>`;
    if(st===1)body.innerHTML=`<span class="hc-wiz-step">PASSO 1</span><h2 id="hcWizTitle">Quantas pessoas moram na casa?</h2><p>Usamos isso para calcular o consumo esperado por dia. Não muda o que os sensores medem.</p>
      <div class="hc-wiz-people"><button type="button" data-w="minus" aria-label="Menos uma pessoa">−</button><output id="hcWizPeople">${data.residents}</output><button type="button" data-w="plus" aria-label="Mais uma pessoa">+</button></div>
      <p class="hc-wiz-note" id="hcWizPeopleNote">Esperado: até <b>${L(data.residents*152.1)}</b> por dia (${data.residents} × 152,1 L, média brasileira).</p>`;
    if(st===2)body.innerHTML=`<span class="hc-wiz-step">PASSO 2</span><h2 id="hcWizTitle">Onde estão os sensores?</h2><p>Dê um nome fácil para cada ponto medido. Ele aparece nos gráficos e nos avisos.</p>
      <label class="hc-wiz-field">Sensor 1<input id="hcWizR1" maxlength="32" value="${esc(data.ramal1)}"></label>${chipRow(1)}
      <label class="hc-wiz-field">Sensor 2<input id="hcWizR2" maxlength="32" value="${esc(data.ramal2)}"></label>${chipRow(2)}
      <fieldset class="hc-wiz-scope"><legend>Os sensores medem toda a água da casa?</legend>
        <label><input type="radio" name="hcScope" value="whole" ${data.scope==='whole'?'checked':''}><span><b>Sim</b>Toda a água passa por eles (como na maquete).</span></label>
        <label><input type="radio" name="hcScope" value="branches" ${data.scope!=='whole'?'checked':''}><span><b>Não, só alguns pontos</b>A comparação com o esperado fica apenas ilustrativa.</span></label></fieldset>`;
    if(st===3)body.innerHTML=`<span class="hc-wiz-step">PASSO 3 · OPCIONAL</span><h2 id="hcWizTitle">Quanto custa a água?</h2><p>Para mostrar o gasto em reais e a previsão da conta. Você pode pular e informar depois.</p>
      <label class="hc-wiz-field">Preço por m³ (R$)<input id="hcWizPrice" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Ex.: 12,50" value="${data.price}"></label>
      <details class="hc-wiz-calc"><summary>Não sei o preço — calcular pela minha conta</summary><p>Na conta de água, procure o <b>valor total</b> e o <b>consumo em m³</b> do mês.</p>
      <div class="hc-wiz-calc-row"><label>Valor da conta (R$)<input id="hcWizBill" type="number" min="0" step="0.01" inputmode="decimal"></label><label>Consumo (m³)<input id="hcWizM3" type="number" min="0" step="0.1" inputmode="decimal"></label><button type="button" class="ghost-btn" data-w="calc">Calcular</button></div><p class="hc-wiz-note" id="hcWizCalcMsg"></p></details>`;
    if(st===4)body.innerHTML=`<div class="hc-wiz-hero is-done">✓</div><h2 id="hcWizTitle">Tudo pronto!</h2><p class="hc-wiz-lead">${data.residents} morador${data.residents>1?'es':''} · ${esc(data.ramal1)} e ${esc(data.ramal2)}${data.price?' · água a '+money(Number(data.price))+'/m³':''}</p>
      <p>Você pode mudar isso quando quiser no botão de perfil, no topo da página.</p><button type="button" class="hc-wiz-tour" data-w="tour">✦ Fazer o tour guiado pelo painel</button>`;
    requestAnimationFrame(()=>(body.querySelector('input:not([type=radio]),output')?.closest('.hc-wiz-people')?.querySelector('[data-w=plus]')||body.querySelector('input:not([type=radio])')||wiz.querySelector('[data-w=next]')).focus());
  }
  function collect(){
    if(data.step===2){data.ramal1=(q('#hcWizR1').value.trim()||'Ramal 01').slice(0,32);data.ramal2=(q('#hcWizR2').value.trim()||'Ramal 02').slice(0,32);data.scope=wiz.querySelector('[name=hcScope]:checked')?.value||'whole';}
    if(data.step===3){const v=q('#hcWizPrice').value;data.price=v===''?'':Math.max(0,Number(v));}
  }
  function save(){
    const set=(id,v)=>{const el=$(id);if(el)el.value=v;};
    set('residentsInput',data.residents);set('scopeInput',data.scope);set('ramal1Input',data.ramal1);set('ramal2Input',data.ramal2);
    const form=$('householdForm');form?.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
    if(data.price!==''&&Number(data.price)>0){try{const fin=F.write(localStorage,{...settings(),pricePerM3:Number(data.price)});window.dispatchEvent(new CustomEvent('hydrocasa:financeiro',{detail:fin}));}catch{}}
    store.set(WELCOME_KEY,'feito');
  }
  function close(){wiz.remove();wiz=null;document.body.classList.remove('hc-wiz-open');store.set(WELCOME_KEY,store.get(WELCOME_KEY)||'adiado');refresh();prev?.focus?.();}
  wiz.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b){if(e.target===wiz)close();return;}
    const w=b.dataset.w;
    if(b.dataset.spot){const n=b.dataset.spot;q('#hcWizR'+n).value=b.dataset.v;wiz.querySelectorAll(`[data-spot="${n}"]`).forEach(x=>x.classList.toggle('on',x===b));return;}
    if(w==='close'){close();return;}
    if(w==='minus'||w==='plus'){data.residents=Math.max(1,Math.min(20,data.residents+(w==='plus'?1:-1)));q('#hcWizPeople').textContent=data.residents;q('#hcWizPeopleNote').innerHTML=`Esperado: até <b>${L(data.residents*152.1)}</b> por dia (${data.residents} × 152,1 L, média brasileira).`;return;}
    if(w==='calc'){try{const pr=F.priceFromBill({billTotal:Number(q('#hcWizBill').value),billM3:Number(q('#hcWizM3').value),fixedMonthly:0});q('#hcWizPrice').value=pr.toFixed(2);q('#hcWizCalcMsg').textContent=`Preço médio: ${money(pr)} por m³ (incluindo taxas).`;data.price=pr;wiz.querySelector('[data-w=next]').textContent='Continuar';}catch(err){q('#hcWizCalcMsg').textContent=err.message;}return;}
    if(w==='back'){collect();data.step=Math.max(0,data.step-1);paint();return;}
    if(w==='next'){collect();if(data.step===3)save();if(data.step===4){close();return;}data.step++;paint();return;}
    if(w==='tour'){close();setTimeout(()=>$('openHydroTour')?.click(),150);}
  });
  wiz.addEventListener('input',e=>{if(e.target.id==='hcWizPrice'){wiz.querySelector('[data-w=next]').textContent=e.target.value?'Continuar':'Pular por agora';}});
  wiz.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();close();}
    if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();wiz.querySelector('[data-w=next]').click();}
    if(e.key==='Tab'){const f=[...wiz.querySelectorAll('button,input,summary')].filter(x=>x.offsetParent&&getComputedStyle(x).visibility!=='hidden');const i=f.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus();}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();}}
  });
  paint();
}

/* ---------- Configuração do aviso na aba Sistema ---------- */
const leakCard=document.createElement('article');leakCard.className='glass-card hc-leak-settings';leakCard.innerHTML=`<div><span class="eyebrow">AVISO DE ÁGUA CORRENDO</span><h3>Avisar quando a água ficar correndo sem parar</h3><p>O painel mostra um alerta vermelho no topo quando um sensor mede água passando, sem pausa, pelo tempo escolhido. Ajuda a perceber torneiras esquecidas e vazamentos.</p></div>
<div class="hc-leak-controls"><label>Avisar depois de<select id="hcLeakLimit">${[1,5,10,20,30,60].map(v=>`<option value="${v}">${v} minuto${v>1?'s':''}</option>`).join('')}</select></label><button type="button" class="ghost-btn" id="hcLeakTest">Mostrar um aviso de teste</button><button type="button" class="ghost-btn" id="hcWizAgain">Refazer configuração inicial</button></div>`;
settingsPanel?.querySelector('.settings-grid')?.after(leakCard);
const limitSel=$('hcLeakLimit');if(limitSel){limitSel.value=String(limitMin());limitSel.onchange=()=>{store.set(LIMIT_KEY,limitSel.value);renderLeak();};}
$('hcLeakTest')?.addEventListener('click',()=>{leakTest=true;document.querySelector('.tab[data-panel="dashboard"]')?.click();renderLeak();requestAnimationFrame(()=>window.scrollTo({top:0,behavior:reduce()?'auto':'smooth'}));});
$('hcWizAgain')?.addEventListener('click',wizard);

/* ---------- Eventos ---------- */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-hc]');if(!b)return;
  const a=b.dataset.hc;
  if(a==='wizard')wizard();
  if(a==='price'){if(window.HydroProfile)window.HydroProfile.open();else wizard();}
  if(a==='leak-ok'){if(leakTest)leakTest=false;else{const i=$('hcLeak').dataset.i;const r=leak['r'+i];if(r){leak['ok'+i]=r.since;store.set(LEAK_KEY,JSON.stringify(leak),sessionStorage);}}renderLeak();}
});
$('hcJustify').onclick=()=>window.HydroAtividades?.open(A.todayKey());
$('hcReport').onclick=()=>$('hydroReportBtn')?.click();
$('hcTour').onclick=()=>$('openHydroTour')?.click();

function syncProfileClass(){document.body.classList.toggle('hc-perfil-ok',!!profile());}
function refresh(){syncProfileClass();renderHoje();renderHours();renderWeek();renderSplit();renderLeak();}
/* Mesmo "dia de hoje" para o tom do site (consumption-status.js), inclusive na demonstração. */
function today(){const t=dayData(A.todayKey());if(!t)return null;const p=t.profile||profile();if(!p)return null;
  return {total:t.total,expected:expectedFor(p),tolerance:p.tolerance??10,scope:p.scope,label:t.demo?'hoje (demonstração)':'hoje'};}
window.HydroInicio={refresh,wizard,today};
refresh();
window.dispatchEvent(new Event('hydrocasa:inicio-pronto'));
let last=0;
setInterval(()=>{trackLeak();if(document.hidden)return;const n=Date.now();if(n-last>=2000){last=n;refresh();}},2000);
window.addEventListener('hydrocasa:financeiro',refresh);
window.addEventListener('hydrocasa:atividades',refresh);
window.addEventListener('storage',e=>{if(e.key==='hydrocasa_ledger_v2'||e.key===F.STORAGE_KEY)refresh();});
new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['data-demo-active']});
$('householdForm')?.addEventListener('submit',()=>setTimeout(refresh,0));
/* Primeiro acesso: abre as boas-vindas quando ainda não há perfil e nada foi decidido antes. */
const isDashboard=!new URLSearchParams(location.search).get('pagina');
if(!profile()&&!store.get(WELCOME_KEY)&&isDashboard)setTimeout(()=>{if(!document.querySelector('.demo-dialog-backdrop,.hydro-tour-layer:not([hidden])'))wizard();},700);
})();
