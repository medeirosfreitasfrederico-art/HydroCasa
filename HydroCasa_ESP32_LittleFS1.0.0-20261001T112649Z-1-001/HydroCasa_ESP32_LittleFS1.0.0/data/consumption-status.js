/* Read-only classification. Uses existing actual history and HydroConsumption rules.
   No network, write to storage, iframe communication or simulator access. */
(()=>{'use strict';
const card=document.getElementById('consumptionStatusCard');
const title=document.getElementById('consumptionStatusTitle');
const message=document.getElementById('consumptionStatusMessage');
const context=document.getElementById('consumptionStatusContext');
const icon=document.getElementById('consumptionStatusIcon');
if(!card||!window.HydroConsumption)return;
const M=window.HydroConsumption;
function display(status,heading,detail,info,symbol){
  card.dataset.status=status;
  title.textContent=heading;message.textContent=detail;context.textContent=info;icon.textContent=symbol;
}
function todayKey(){const n=new Date();return [n.getFullYear(),String(n.getMonth()+1).padStart(2,'0'),String(n.getDate()).padStart(2,'0')].join('-');}
function restoreLedger(){
  try{
    const raw=localStorage.getItem('hydrocasa_ledger_v2');
    const data=raw?JSON.parse(raw):null;
    return data&&data.version===2&&data.history&&typeof data.history==='object'&&!Array.isArray(data.history)?data:null;
  }catch{return null;}
}
function render(){
  const ledger=restoreLedger();
  if(!ledger){display('unknown','Aguardando dados','Ainda não há histórico válido disponível para avaliação.','Comparação não disponível','—');return;}
  const history=ledger.history,keys=Object.keys(history).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&k<todayKey()).sort().reverse();
  let chosen=null,configured=false;
  for(const key of keys){
    const day=history[key];
    if(!day||!Number.isFinite(day.total1)||!Number.isFinite(day.total2)||day.total1<0||day.total2<0||!(day.readings>0))continue;
    const profile=M.dayProfile(day,ledger.household);
    if(!profile||profile.scope!=='whole'||day.profileMixed||day.partial!==false)continue;
    configured=true;chosen={key,day,profile};break;
  }
  if(!chosen){
    display('unknown','Aguardando dados','É necessário um dia completo de medições e um perfil que represente toda a residência.','Sem período completo comparável','—');return;
  }
  const {key,day,profile}=chosen;
  const total=day.total1+day.total2,expected=profile.residents*profile.referenceLiters;
  if(!Number.isFinite(total)||expected<=0)return;
  const tolerance=profile.tolerance;const upper=expected*(1+tolerance/100);
  // Existing profile tolerance defines the two above-reference bands; no arbitrary liters threshold.
  const status=total<=expected?'normal':total<=upper?'attention':'high';
  const cfg=profile.referenceMode==='snis'?'SNIS 2020':'referência personalizada';
  const date=key.split('-').reverse().join('/');
  const info=date+' · '+profile.residents+' morador(es) · '+cfg+' · tolerância '+tolerance+'% · último dia completo';
  if(status==='normal')display(status,'Consumo normal','O consumo ficou dentro da referência utilizada.',info,'✓');
  else if(status==='attention')display(status,'Consumo em atenção','O consumo ficou um pouco acima da referência.',info,'!');
  else display(status,'Consumo elevado','O consumo ultrapassou a faixa de tolerância.',info,'!');
}
/* Tom visual do site conforme o gasto (somente apresentação: body[data-gasto]).
   Usa o dia de hoje; sem leituras hoje, o dia mais recente com leituras nos últimos 7 dias.
   O volume do dia só cresce, então um dia parcial acima da faixa já está acima. */
const F=window.HydroFinance;
const strip=document.createElement('div');strip.className='gasto-faixa';strip.id='gastoFaixa';strip.setAttribute('role','status');strip.hidden=true;
document.querySelector('.topbar')?.after(strip);
function demoToday(){
  if(document.body.dataset.demoActive!=='true')return null;
  try{const o=JSON.parse(sessionStorage.getItem('hydrocasa:semana-demo')||'null');const v=o?.values?.[new Date().getDay()];
    if(!Array.isArray(v)||!Number.isInteger(o.residents))return null;
    return {total:(+v[0]||0)+(+v[1]||0),expected:o.residents*152.1,tolerance:10,label:'hoje (demonstração)',scope:'branches'};}catch{return null;}
}
function realDay(){
  const ledger=restoreLedger();if(!ledger)return null;
  const now=new Date();
  for(let age=0;age<7;age++){
    const d=new Date(now);d.setDate(d.getDate()-age);
    const key=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'),day=ledger.history[key];
    if(!day||!(day.readings>0)||!Number.isFinite(day.total1)||!Number.isFinite(day.total2))continue;
    const profile=M.dayProfile(day,ledger.household);if(!profile)return null;
    return {total:day.total1+day.total2,expected:profile.residents*profile.referenceLiters,tolerance:profile.tolerance,scope:profile.scope,
      label:age===0?'hoje':age===1?'ontem':key.split('-').reverse().join('/')};
  }
  return null;
}
function paint(){
  if(!F?.spendingLevel)return;
  const day=demoToday()||realDay();
  const level=day&&day.expected>0?F.spendingLevel((day.total/day.expected-1)*100,day.tolerance):null;
  const active=level&&level.id!=='normal';
  if(active)document.body.dataset.gasto=level.id;else delete document.body.dataset.gasto;
  strip.hidden=!active;
  if(active){
    const pct=Math.round(level.percent).toLocaleString('pt-BR');
    strip.innerHTML='<span class="gasto-faixa-dot" aria-hidden="true"></span><strong>'+level.label+'</strong><span>Consumo de '+day.label+' '+pct+'% acima da referência para os moradores'+(day.scope==='whole'?'':' (comparação ilustrativa)')+'.</span>';
  }
}
function update(){render();paint();}
update();
const target=document.getElementById('todayTotal');
if(target)new MutationObserver(update).observe(target,{childList:true,characterData:true,subtree:true});
new MutationObserver(paint).observe(document.body,{attributes:true,attributeFilter:['data-demo-active']});
window.addEventListener('storage',event=>{if(event.key==='hydrocasa_ledger_v2')update();});
const form=document.getElementById('householdForm');
if(form)form.addEventListener('submit',()=>setTimeout(update,0));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
setInterval(()=>{if(!document.hidden)paint();},5000);
})();