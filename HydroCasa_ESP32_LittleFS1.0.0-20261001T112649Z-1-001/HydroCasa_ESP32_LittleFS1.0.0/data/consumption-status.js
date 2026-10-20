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
render();
const target=document.getElementById('todayTotal');
if(target)new MutationObserver(render).observe(target,{childList:true,characterData:true,subtree:true});
window.addEventListener('storage',event=>{if(event.key==='hydrocasa_ledger_v2')render();});
const form=document.getElementById('householdForm');
if(form)form.addEventListener('submit',()=>setTimeout(render,0));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
})();