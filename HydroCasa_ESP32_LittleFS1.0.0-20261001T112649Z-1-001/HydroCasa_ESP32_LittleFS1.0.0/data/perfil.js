/* HydroCasa — Perfil da residência dinâmico.
   - Painel lateral (botão do cabeçalho) com resumo ao vivo, edição rápida e itens para completar o perfil.
   - Pré-visualização instantânea no cartão de moradores do Painel.
   - Primeiro acesso compacto depois que o perfil estiver configurado.
   Leitura do ledger apenas para exibir. A gravação do perfil passa pelo formulário original (app.js),
   que mantém a validação e as regras do histórico; os valores da conta ficam em HydroFinance. */
(()=>{
'use strict';
const F=window.HydroFinance,C=window.HydroConsumption;
if(!F||!C)return;
const q=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtL=v=>Number.isFinite(v)?v.toLocaleString('pt-BR',{maximumFractionDigits:1})+' L':'—';
const ledger=()=>{try{const d=JSON.parse(localStorage.getItem('hydrocasa_ledger_v2')||'{}');return d&&d.version===2?d:{};}catch{return {};}};
const household=()=>C.maybeProfile(ledger().household);
const personIcon='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/></svg>';
function avatars(n,max=8){
 const count=Math.max(0,Math.min(n||0,max));let html='';
 for(let i=0;i<count;i++)html+=`<span class="pf-avatar" style="--i:${i}">${personIcon}</span>`;
 if(n>max)html+=`<span class="pf-avatar pf-avatar-more">+${n-max}</span>`;
 if(!n)html=`<span class="pf-avatar pf-avatar-empty">?</span>`;
 return html;
}
function monthSummary(){
 const d=ledger(),period=F.resolvePeriod('thisMonth');
 return F.summarize({period,history:d.history||{},currentProfile:d.household,settings:F.read(localStorage),activityRecords:d.activityRecords||{}});
}
function todayInfo(){
 const d=ledger(),k=F.keyOf(new Date()),h=d.history?.[k],p=household();
 const total=h&&h.readings>0?h.total1+h.total2:null,ref=p?p.residents*p.referenceLiters:null;
 return {total,ref,ratio:total!==null&&ref?total/ref:null,partial:h?h.partial!==false:true,profile:p};
}
function completion(){
 const p=household(),s=F.read(localStorage);
 const items=[
  {id:'residents',label:'Informar os moradores',done:!!p,target:'pfResidents'},
  {id:'price',label:'Informar o preço da água (R$/m³)',done:!!s.pricePerM3,target:'pfPrice'},
  {id:'goal',label:'Definir uma meta de gasto mensal',done:!!s.monthlyGoal,target:'pfGoal'},
  {id:'branches',label:'Dar nomes aos ramais (ex.: Cozinha)',done:!!p&&(p.ramal1!=='Ramal 01'||p.ramal2!=='Ramal 02'),target:'pfRamal1'},
  {id:'name',label:'Dar um nome à residência',done:!!s.householdName,target:'pfName'}
 ];
 return {items,done:items.filter(i=>i.done).length};
}

/* ---------- Painel lateral ---------- */
let layer=null,oldFocus=null,refreshTimer=null,dirty=false;
function buildDrawer(){
 layer=document.createElement('div');layer.className='pf-layer';layer.hidden=true;
 layer.innerHTML=`<section class="pf-drawer" role="dialog" aria-modal="true" aria-labelledby="pfTitle">
  <header class="pf-head"><div><span class="pf-kicker">PERFIL DA RESIDÊNCIA</span><h2 id="pfTitle">Sua casa</h2></div><button type="button" class="pf-close" aria-label="Fechar perfil">×</button></header>
  <div class="pf-scroll">
   <section class="pf-hero" aria-live="polite"><div class="pf-avatars" id="pfAvatars"></div><div class="pf-hero-copy"><strong id="pfHeroName"></strong><span id="pfHeroMeta"></span></div>
    <div class="pf-ring" id="pfRing" role="img"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" class="pf-ring-bg"/><circle cx="20" cy="20" r="16" class="pf-ring-fg" id="pfRingFg"/></svg><b id="pfRingText"></b></div></section>
   <section class="pf-stats" aria-label="Resumo ao vivo">
    <article class="pf-stat"><span>Hoje</span><strong id="pfToday">—</strong><div class="pf-meter"><i id="pfTodayBar"></i></div><small id="pfTodayNote"></small></article>
    <article class="pf-stat"><span>Gasto no mês</span><strong id="pfMonth">—</strong><div class="pf-meter"><i id="pfMonthBar"></i></div><small id="pfMonthNote"></small></article>
   </section>
   <section class="pf-todo" id="pfTodo"><h3>Complete seu perfil</h3><ul id="pfTodoList"></ul></section>
   <form class="pf-form" id="pfForm" novalidate>
    <h3>Editar perfil</h3>
    <div class="pf-field pf-residents"><span class="pf-label" id="pfResidentsLabel">Quantas pessoas moram aqui?</span>
     <div class="pf-stepper" role="group" aria-labelledby="pfResidentsLabel"><button type="button" data-step="-1" aria-label="Diminuir moradores">−</button><input id="pfResidents" type="number" min="1" max="100" step="1" inputmode="numeric" aria-labelledby="pfResidentsLabel"><button type="button" data-step="1" aria-label="Aumentar moradores">+</button></div>
     <p class="pf-live" id="pfLive" aria-live="polite"></p></div>
    <label class="pf-field">Nome da residência<input id="pfName" type="text" maxlength="60" placeholder="Ex.: Casa da família Silva"><small>Aparece na capa do relatório em PDF.</small></label>
    <fieldset class="pf-money"><legend>Conta de água</legend>
     <label class="pf-field">Preço por m³ (água + esgoto)<span class="pf-input-money"><span>R$</span><input id="pfPrice" type="number" min="0" max="1000" step="0.01" inputmode="decimal" placeholder="Ex.: 12,50"></span></label>
     <label class="pf-field">Taxa fixa mensal<span class="pf-input-money"><span>R$</span><input id="pfFixed" type="number" min="0" max="10000" step="0.01" inputmode="decimal" placeholder="0,00"></span></label>
     <label class="pf-field">Meta de gasto mensal<span class="pf-input-money"><span>R$</span><input id="pfGoal" type="number" min="0" max="100000" step="0.01" inputmode="decimal" placeholder="Opcional"></span></label>
     <button type="button" class="pf-link" id="pfBillHelp">Não sabe o preço do m³? Calcule pela sua conta →</button>
    </fieldset>
    <details class="pf-advanced"><summary>Ramais, referência e cobertura</summary>
     <label class="pf-field">Nome do ramal 01<input id="pfRamal1" maxlength="32"></label>
     <label class="pf-field">Nome do ramal 02<input id="pfRamal2" maxlength="32"></label>
     <label class="pf-field">O que os sensores cobrem?<select id="pfScope"><option value="branches">Somente os ramais da maquete</option><option value="whole">Toda a residência, sem dupla contagem</option></select></label>
     <label class="pf-field">Referência por pessoa<select id="pfMode"><option value="snis">SNIS 2020 — média nacional (152,1 L/dia)</option><option value="user">Personalizada</option></select></label>
     <label class="pf-field" id="pfRefWrap">Referência personalizada (L/pessoa/dia)<input id="pfRef" type="number" min="1" max="10000" step="any"></label>
     <label class="pf-field">Faixa de comparação (± %)<input id="pfTol" type="number" min="0" max="50" step="any"></label>
    </details>
    <p class="pf-message" id="pfMessage" role="status" aria-live="polite"></p>
    <div class="pf-actions"><button type="submit" class="primary-btn" id="pfSave">Salvar perfil</button><button type="button" class="ghost-btn" id="pfReset">Descartar alterações</button></div>
   </form>
  </div>
  <footer class="pf-foot"><button type="button" class="pf-foot-btn pf-foot-report" id="pfReport">Gerar relatório PDF</button><button type="button" class="pf-foot-btn" id="pfHistory">Ver histórico de consumo</button></footer>
 </section>`;
 document.body.append(layer);
 const form=layer.querySelector('#pfForm');
 layer.querySelector('.pf-close').onclick=close;
 layer.addEventListener('mousedown',e=>{if(e.target===layer)close();});
 document.addEventListener('keydown',e=>{
  if(layer.hidden)return;
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key!=='Tab')return;
  const nodes=[...layer.querySelectorAll('button,input,select,summary,a[href]')].filter(n=>!n.disabled&&n.offsetParent!==null);
  const i=nodes.indexOf(document.activeElement);
  if(e.shiftKey&&i<=0){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0].focus();}
 });
 layer.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const el=q('#pfResidents');el.value=Math.max(1,Math.min(100,(Number(el.value)||0)+Number(b.dataset.step)));markDirty();});
 form.addEventListener('input',markDirty);form.addEventListener('change',markDirty);
 q('#pfMode').addEventListener('change',()=>{q('#pfRefWrap').hidden=q('#pfMode').value!=='user';});
 q('#pfReset').onclick=()=>{fill();setDirty(false);msg('');};
 form.onsubmit=e=>{e.preventDefault();save();};
 q('#pfReport').onclick=()=>{close();window.HydroReport?.open?.();};
 q('#pfBillHelp').onclick=()=>{close();window.HydroReport?.open?.({bill:true});};
 q('#pfHistory').addEventListener('click',()=>{close();const link=q('.page-nav [data-page=consumption]');if(link)link.click();else location.href='?pagina=consumo';});
 layer.querySelector('#pfTodoList').addEventListener('click',e=>{const b=e.target.closest('[data-target]');if(!b)return;const el=q('#'+b.dataset.target);el?.closest('details')?.setAttribute('open','');el?.focus();el?.scrollIntoView({block:'center',behavior:'smooth'});});
}
function msg(text,tone=''){const el=q('#pfMessage');el.textContent=text;el.className='pf-message'+(tone?' is-'+tone:'');}
function setDirty(v){dirty=v;layer.classList.toggle('is-dirty',v);q('#pfSave').disabled=!v;q('#pfReset').hidden=!v;}
function markDirty(){setDirty(true);msg('Alterações ainda não salvas.','pending');renderLive();}
function fill(){
 const p=household()||C.defaults,s=F.read(localStorage);
 q('#pfResidents').value=p.residents||'';q('#pfName').value=s.householdName||'';
 q('#pfPrice').value=s.pricePerM3??'';q('#pfFixed').value=s.fixedMonthly||'';q('#pfGoal').value=s.monthlyGoal??'';
 q('#pfRamal1').value=p.ramal1;q('#pfRamal2').value=p.ramal2;q('#pfScope').value=p.scope;q('#pfMode').value=p.referenceMode;
 q('#pfRef').value=p.referenceLiters;q('#pfTol').value=p.tolerance;q('#pfRefWrap').hidden=p.referenceMode!=='user';
 renderLive();
}
/** Pré-visualização do que vai mudar antes de salvar. */
function renderLive(){
 const n=Number(q('#pfResidents').value),mode=q('#pfMode').value,ref=mode==='user'?Number(q('#pfRef').value):152.1;
 const price=Number(q('#pfPrice').value),fixed=Number(q('#pfFixed').value)||0;
 const valid=Number.isInteger(n)&&n>=1&&n<=100&&ref>0;
 q('#pfAvatars').innerHTML=avatars(valid?n:0);
 if(!valid){q('#pfLive').textContent='Informe de 1 a 100 moradores para calcular a referência da casa.';return;}
 const day=n*ref,month=day*30;
 q('#pfLive').innerHTML=`Referência: <b>${esc(F.m3(day))}</b> por dia · ≈ <b>${esc(F.m3(month,1))}</b> por mês`+(price>0?` · conta esperada ≈ <b>${esc(F.money(month/1000*price+fixed))}</b>/mês`:'');
}
function renderStats(){
 const p=household(),s=F.read(localStorage),t=todayInfo(),c=completion();
 q('#pfHeroName').textContent=s.householdName||'Minha residência';
 q('#pfHeroMeta').textContent=p?`${p.residents} ${p.residents===1?'morador':'moradores'} · ${p.scope==='whole'?'toda a casa monitorada':'ramais monitorados'}`:'Perfil ainda não configurado';
 if(!dirty)q('#pfAvatars').innerHTML=avatars(p?.residents||0);
 const pct=Math.round(c.done/c.items.length*100);
 q('#pfRingFg').style.strokeDasharray=`${pct*1.005} 100.5`;q('#pfRingText').textContent=pct+'%';
 q('#pfRing').setAttribute('aria-label','Perfil '+pct+'% completo');
 q('#pfTodo').hidden=c.done===c.items.length;
 q('#pfTodoList').innerHTML=c.items.map(i=>`<li class="${i.done?'is-done':''}"><span class="pf-check" aria-hidden="true"></span>${i.done?`<span>${esc(i.label)}</span>`:`<button type="button" data-target="${i.target}">${esc(i.label)}</button>`}</li>`).join('');
 // Hoje
 const bar=(el,ratio,tone)=>{el.style.width=Math.max(2,Math.min(100,(ratio||0)*100))+'%';el.dataset.tone=tone;};
 if(t.total===null){q('#pfToday').textContent='Sem leituras';q('#pfTodayNote').textContent=t.ref?'Referência do dia: '+F.m3(t.ref):'Configure os moradores';bar(q('#pfTodayBar'),0,'ok');}
 else{
  q('#pfToday').textContent=F.m3(t.total);
  const tone=t.ratio===null?'ok':t.ratio>1+(t.profile?.tolerance??10)/100?'bad':t.ratio>.8?'warn':'ok';
  q('#pfTodayNote').textContent=t.ratio!==null?F.percent(t.ratio*100)+' da referência diária ('+F.m3(t.ref)+')'+(t.partial?' · parcial':''):'Configure os moradores';
  bar(q('#pfTodayBar'),t.ratio??0,tone);
 }
 // Mês
 try{
  const m=monthSummary().money;
  if(!m.configured){q('#pfMonth').textContent='—';q('#pfMonthNote').innerHTML='<button type="button" class="pf-inline-link" data-target="pfPrice">Informe o preço do m³</button> para ver em reais';bar(q('#pfMonthBar'),0,'ok');q('#pfMonthNote button').onclick=()=>q('#pfPrice').focus();}
  else{
   q('#pfMonth').textContent=F.money(m.measuredWithFixed);
   const goal=m.goal;
   q('#pfMonthNote').textContent=goal?'Previsão '+F.money(m.projectedWithFixed)+' · meta '+F.money(goal):'Previsão do mês: '+F.money(m.projectedWithFixed);
   bar(q('#pfMonthBar'),goal?(m.measuredWithFixed||0)/goal:(m.projectedWithFixed?(m.measuredWithFixed||0)/m.projectedWithFixed:0),goal&&m.goalStatus==='above'?'bad':'ok');
  }
 }catch{}
}
function save(){
 const n=Number(q('#pfResidents').value);
 if(!Number.isInteger(n)||n<1||n>100){msg('Informe de 1 a 100 moradores, sem casas decimais.','error');q('#pfResidents').focus();return;}
 let fin;
 try{fin=F.settings({...F.read(localStorage),pricePerM3:q('#pfPrice').value,fixedMonthly:q('#pfFixed').value,monthlyGoal:q('#pfGoal').value,householdName:q('#pfName').value});}
 catch(err){msg(err.message,'error');return;}
 // Reaproveita o formulário original: mesma validação e mesmas regras do histórico.
 const form=q('#householdForm');if(!form){msg('Formulário do perfil indisponível.','error');return;}
 const mode=q('#pfMode').value;
 q('#residentsInput').value=n;q('#referenceMode').value=mode;
 q('#referenceM3').disabled=mode==='snis';q('#referenceM3').value=mode==='snis'?0.1521:Number(q('#pfRef').value)/1000;
 q('#toleranceInput').value=q('#pfTol').value;q('#scopeInput').value=q('#pfScope').value;
 q('#ramal1Input').value=q('#pfRamal1').value;q('#ramal2Input').value=q('#pfRamal2').value;
 const message=q('#profileMessage');
 const submit=new Event('submit',{cancelable:true,bubbles:true});form.dispatchEvent(submit);
 if(message?.classList.contains('form-error')){msg(message.textContent,'error');return;}
 try{F.write(localStorage,fin);window.dispatchEvent(new CustomEvent('hydrocasa:financeiro',{detail:fin}));}catch(err){msg(err.message,'error');return;}
 setDirty(false);msg('✓ Perfil salvo. As comparações e o relatório já usam os novos valores.','ok');
 q('#pfMessage').tabIndex=-1;q('#pfMessage').focus({preventScroll:true});
 layer.querySelector('.pf-hero').classList.remove('pf-pulse');void layer.offsetWidth;layer.querySelector('.pf-hero').classList.add('pf-pulse');
 renderStats();syncDashboard();
}
function open(focusId){
 if(!layer)buildDrawer();
 oldFocus=document.activeElement;fill();setDirty(false);msg('');renderStats();
 layer.hidden=false;document.body.classList.add('pf-open');
 requestAnimationFrame(()=>{layer.classList.add('is-visible');(focusId?q('#'+focusId):layer.querySelector('.pf-close')).focus();});
 clearInterval(refreshTimer);refreshTimer=setInterval(()=>{if(!layer.hidden)renderStats();},2500);
}
function close(){
 if(!layer||layer.hidden)return;
 if(dirty&&!confirm('Descartar as alterações que não foram salvas?'))return;
 layer.classList.remove('is-visible');clearInterval(refreshTimer);
 setTimeout(()=>{layer.hidden=true;document.body.classList.remove('pf-open');},matchMedia('(prefers-reduced-motion: reduce)').matches?0:180);
 oldFocus?.focus?.();
}
const btn=q('#hydroProfileBtn');
if(btn){btn.onclick=()=>open();btn.setAttribute('aria-label','Abrir perfil da residência');}

/* ---------- Cartão de moradores do Painel ---------- */
const card=q('.household-card'),controls=card?.querySelector('.household-controls');
let crowd=null,preview=null,billHint=null,syncCard=()=>{};
if(card&&controls){
 crowd=document.createElement('div');crowd.className='pf-avatars pf-avatars-inline';crowd.setAttribute('aria-hidden','true');
 controls.append(crowd);
 preview=document.createElement('p');preview.className='pf-live pf-live-card';preview.id='householdLivePreview';preview.setAttribute('aria-live','polite');
 controls.after(preview);
 billHint=document.createElement('button');billHint.type='button';billHint.className='pf-link pf-bill-hint';
 billHint.onclick=()=>open('pfPrice');
 preview.after(billHint);
 const sync=syncCard=()=>{
  const n=Number(q('#residentsInput').value),s=F.read(localStorage);
  const mode=q('#referenceMode').value,ref=mode==='user'?Number(q('#referenceM3').value)*1000:152.1;
  const ok=Number.isInteger(n)&&n>=1&&n<=100&&ref>0;
  const before=crowd.childElementCount;crowd.innerHTML=avatars(ok?n:0,6);
  if(ok&&crowd.childElementCount>before)crowd.lastElementChild?.classList.add('pf-pop');
  preview.innerHTML=ok?`Para <b>${n} ${n===1?'morador':'moradores'}</b>, a referência é <b>${esc(F.m3(n*ref))}</b> por dia (≈ ${esc(F.m3(n*ref*30,1))} por mês)`+(s.pricePerM3?`, cerca de <b>${esc(F.money(n*ref*30/1000*s.pricePerM3+(s.fixedMonthly||0)))}</b> na conta do mês.`:'.'):'Informe quantas pessoas moram na casa para ver a referência de consumo.';
  billHint.textContent=s.pricePerM3?'Conta de água: '+F.money(s.pricePerM3)+'/m³ · editar valores →':'Informe o preço da água para ver estimativas em reais →';
 };
 ['input','change'].forEach(ev=>card.addEventListener(ev,sync));
 card.querySelectorAll('#residentsMinus,#residentsPlus').forEach(b=>b.addEventListener('click',()=>setTimeout(sync)));
 card.querySelector('#householdForm')?.addEventListener('submit',()=>setTimeout(syncDashboard));
 window.addEventListener('hydrocasa:financeiro',sync);
 sync();
}

/* ---------- Primeiro acesso compacto ---------- */
const start=q('#hydroInicio');let strip=null;
function syncDashboard(){
 const p=household(),s=F.read(localStorage);
 syncCard();
 if(!start)return;
 const expanded=(()=>{try{return sessionStorage.getItem('hydrocasa:guia-aberto')==='1';}catch{return false;}})();
 start.classList.toggle('pf-start-done',!!p&&!expanded);
 const details=q('#personalizar'),summary=details?.querySelector('summary');
 if(p&&summary)summary.textContent='✓ Etapa 1 concluída — '+p.residents+' '+(p.residents===1?'morador':'moradores')+' (abrir para editar)';
 if(!strip){
  strip=document.createElement('div');strip.className='pf-strip';
  start.prepend(strip);
  strip.addEventListener('click',e=>{
   const a=e.target.closest('[data-strip]');if(!a)return;
   if(a.dataset.strip==='edit')open();
   if(a.dataset.strip==='guide'){const now=!start.classList.contains('pf-start-done');try{sessionStorage.setItem('hydrocasa:guia-aberto',now?'0':'1');}catch{}syncDashboard();if(!now){const d=q('#personalizar');if(d)d.open=true;}}
  });
 }
 strip.hidden=!p;
 if(p){
  const t=todayInfo();
  strip.innerHTML=`<div class="pf-avatars pf-avatars-strip" aria-hidden="true">${avatars(p.residents,5)}</div>
  <div class="pf-strip-copy"><span class="pf-kicker">PERFIL CONFIGURADO ✓</span><strong>${esc(s.householdName||'Sua residência')} · ${p.residents} ${p.residents===1?'morador':'moradores'}</strong>
  <span>Referência ${esc(F.m3(p.residents*p.referenceLiters))}/dia${s.pricePerM3?' · água a '+esc(F.money(s.pricePerM3))+'/m³':''}${t.total!==null?' · hoje: '+esc(F.m3(t.total)):''}</span></div>
  <div class="pf-strip-actions"><button type="button" class="primary-btn" data-strip="edit">Editar perfil</button><button type="button" class="ghost-btn" data-strip="guide" aria-expanded="${start.classList.contains('pf-start-done')?'false':'true'}">${start.classList.contains('pf-start-done')?'Ver guia de primeiro acesso':'Ocultar guia'}</button></div>`;
  if(details&&start.classList.contains('pf-start-done'))details.open=false;
 }
}
window.addEventListener('hydrocasa:financeiro',syncDashboard);
window.addEventListener('storage',e=>{if(e.key==='hydrocasa_ledger_v2'||e.key===F.STORAGE_KEY)syncDashboard();});
syncDashboard();
setInterval(()=>{if(strip&&!strip.hidden&&!document.hidden)syncDashboard();},10000);
window.HydroProfile={open,close};
})();
