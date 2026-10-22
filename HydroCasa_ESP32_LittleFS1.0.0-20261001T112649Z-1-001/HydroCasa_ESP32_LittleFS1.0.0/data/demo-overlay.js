/* Camada somente visual. NÃO modifica app.js, ledger, histórico, calendário nem APIs. */
(()=>{
'use strict';
const KEY='hydrocasa:simulacao';
const WEEK_KEY='hydrocasa:semana-demo';
const $=id=>document.getElementById(id);
const frame=$('simulatorFrame'),notice=$('demoNotice'),clear=$('demoClear');
const demoInfoButton=document.createElement('button');
demoInfoButton.type='button';demoInfoButton.id='demoInfoButton';demoInfoButton.className='demo-info-fab';
demoInfoButton.setAttribute('aria-label','Aviso sobre dados simulados');demoInfoButton.setAttribute('aria-haspopup','dialog');demoInfoButton.title='Sobre os dados simulados';demoInfoButton.textContent='!';
demoInfoButton.hidden=true;
document.body.appendChild(demoInfoButton);
const demoInfoOverlay=document.createElement('div');
demoInfoOverlay.className='demo-info-overlay';demoInfoOverlay.hidden=true;
demoInfoOverlay.innerHTML='<section class="demo-info-dialog" role="dialog" aria-modal="true" aria-labelledby="demoInfoTitle" aria-describedby="demoInfoDescription"><button type="button" class="demo-info-close" aria-label="Fechar aviso" title="Fechar">×</button><span class="demo-info-kicker">HYDROCASA · MODO DEMONSTRAÇÃO</span><h2 id="demoInfoTitle">Estes dados são simulados</h2><p id="demoInfoDescription">As informações exibidas neste momento são fictícias e servem apenas para demonstrar as funções do HydroCasa. Elas não representam o consumo real de uma residência.</p><div class="demo-info-note"><strong>Quer usar o HydroCasa na sua casa?</strong><p>Para acompanhar medições reais, é necessário conectar um ESP32 equipado com sensores de vazão instalados na tubulação e configurar o dispositivo para enviar as leituras ao painel. O ESP32 e o site precisam estar configurados para se comunicar pela rede; dependendo da hospedagem e do navegador, pode ser necessário ajustar a conexão local.</p></div><p class="demo-info-foot">Enquanto a demonstração estiver ativa, considere os números, gráficos e comparações como exemplos — não como medições reais.</p><button type="button" class="primary-btn demo-info-understood">Entendi</button></section>';
document.body.appendChild(demoInfoOverlay);
const demoInfoClose=demoInfoOverlay.querySelector('.demo-info-close'),demoInfoOk=demoInfoOverlay.querySelector('.demo-info-understood');
let demoInfoActivated=false;
let demoInfoReturnFocus=null;
function closeDemoInfo(){demoInfoOverlay.hidden=true;document.body.classList.remove('demo-info-open');demoInfoReturnFocus?.focus?.();}
function openDemoInfo(){demoInfoReturnFocus=document.activeElement;demoInfoOverlay.hidden=false;document.body.classList.add('demo-info-open');demoInfoClose?.focus();}
demoInfoButton.addEventListener('click',openDemoInfo);
demoInfoClose.addEventListener('click',closeDemoInfo);demoInfoOk.addEventListener('click',closeDemoInfo);
demoInfoOverlay.addEventListener('click',event=>{if(event.target===demoInfoOverlay)closeDemoInfo();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!demoInfoOverlay.hidden){event.preventDefault();closeDemoInfo();}});

const limits=[[1,10],[1,30],[1,4],[3,20],[7,365]];
let simulation=null,weekly=null,source='nenhuma',hadReal=false,prompted=false,dialog=null,blockedAfterClear=false,wasWeeklyDemo=false;
const valid=v=>Array.isArray(v)&&v.length===5&&v.every((n,i)=>typeof n==='number'&&Number.isFinite(n)&&n>=limits[i][0]&&n<=limits[i][1])&&[7,30,365].includes(v[4]);
const validWeekly=o=>!!o&&o.version===1&&Number.isInteger(o.residents)&&o.residents>=1&&o.residents<=100&&Number.isInteger(o.days)&&o.days>=1&&o.days<=366&&Array.isArray(o.values)&&o.values.length===7&&o.values.every(d=>Array.isArray(d)&&d.length===2&&d.every(n=>Number.isFinite(n)&&n>=0&&n<=100000));
function hasRealHistory(){
 try{
  const raw=localStorage.getItem('hydrocasa_ledger_v2'),ledger=raw?JSON.parse(raw):null;
  return !!(ledger&&ledger.version===2&&ledger.history&&Object.values(ledger.history).some(d=>d&&d.readings>0&&Number.isFinite(d.total1)&&Number.isFinite(d.total2)));
 }catch{return false;}
}
function isRealOnline(){return document.body.dataset.connectionState==='online'&&$('statusDetail')?.textContent.includes('Última leitura');}
function fmt(l){return (l/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' m³';}
const map=[['todayTotal',v=>fmt(v[0]*v[1]*v[2]*v[3])],['perPersonValue',v=>fmt(v[1]*v[2]*v[3])],['householdTarget',v=>'—'],['comparisonStatus',v=>'Apenas cenário de banhos'],['sensor1Total',v=>'—'],['sensor2Total',v=>'—'],['flow1',v=>'—'],['flow2',v=>'—'],['ratio1',v=>'—']];
const directIds=['split1','split2','targetDetail','perPersonDetail','comparisonDetail','alertContent'];
const directOriginals=new Map(directIds.map(id=>[id,$(id)]).filter(x=>x[1]).map(([id,node])=>[id,{node,text:node.textContent,className:node.className}]));
function demoProfile(residents){const mode=$('referenceMode')?.value||'snis';const ref=mode==='user'?Number($('referenceM3')?.value)*1000:152.1;const people=Number(residents||$('residentsInput')?.value||3);const tolerance=Number($('toleranceInput')?.value??10);return {residents:Number.isInteger(people)&&people>0?people:3,reference:Number.isFinite(ref)&&ref>0?ref:152.1,tolerance:Number.isFinite(tolerance)&&tolerance>=0?tolerance:10,mode};}
function showUpdatedPopup(){let toast=$('demoUpdatedToast');if(!toast){toast=document.createElement('div');toast.id='demoUpdatedToast';toast.className='demo-updated-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.innerHTML='<span aria-hidden="true">✓</span><div><strong>Dados simulados atualizados</strong><small>O painel foi atualizado com os valores personalizados.</small></div>';document.body.append(toast);}toast.classList.add('is-visible');clearTimeout(popupTimer);popupTimer=setTimeout(()=>toast?.classList.remove('is-visible'),3600);}
let popupTimer=null;
const overlays=new Map();
for(const [id] of map){const node=$(id);if(!node)continue;const parent=node.parentElement;const shown=document.createElement('span');shown.className='demo-value';shown.hidden=true;shown.setAttribute('aria-label','Demonstração, valor fictício');parent.append(shown);overlays.set(id,{node,shown});}
function update(){
 const real=hasRealHistory()||isRealOnline();
 const useDemo=!!(simulation||weekly)&&!real;
 source=real?'esp32':useDemo?'simulacao':'nenhuma';
 document.body.dataset.demoActive=useDemo?'true':'false';
 demoInfoButton.hidden=!(useDemo&&demoInfoActivated);
 if(!useDemo&&!demoInfoOverlay.hidden)closeDemoInfo();
 document.body.dataset.demoWeekly=useDemo&&!!weekly?'true':'false';
 notice.hidden=!useDemo;
 const weekToday=weekly?.values?.[new Date().getDay()];
 const weekDaily=weekToday?weekToday[0]+weekToday[1]:0;
 const profile=demoProfile(weekly?.residents),referenceTotal=profile.residents*profile.reference;
 const excessive=!!weekly&&weekDaily>referenceTotal*(1+profile.tolerance/100);
 if(useDemo){
  const v=simulation;
  for(const [id,fn] of map){
   const p=overlays.get(id);if(!p)continue;
   if(weekly){
    const custom={todayTotal:fmt(weekDaily),perPersonValue:fmt(weekDaily/weekly.residents),householdTarget:fmt(referenceTotal),comparisonStatus:excessive?'Acima da referência ilustrativa':'Dentro da faixa ilustrativa',sensor1Total:fmt(weekToday[0]),sensor2Total:fmt(weekToday[1]),flow1:(weekToday[0]/1440).toLocaleString('pt-BR',{maximumFractionDigits:2})+' L/min',flow2:(weekToday[1]/1440).toLocaleString('pt-BR',{maximumFractionDigits:2})+' L/min',ratio1:(weekDaily?Math.round(weekToday[0]/weekDaily*100):0)+'%'};
    p.shown.textContent=custom[id]??'—';
   }else p.shown.textContent=fn(v);
   p.shown.hidden=false;p.node.classList.add('demo-covered');
  }
  if(weekly){
   const setText=(id,value)=>{const node=$(id);if(node)node.textContent=value;};
   setText('split1',fmt(weekToday[0]));setText('split2',fmt(weekToday[1]));
   const donut=$('donut'),share=weekDaily?Math.round(weekToday[0]/weekDaily*100):0;if(donut){donut.dataset.empty=weekDaily?'false':'true';donut.style.background=weekDaily?`conic-gradient(var(--primary) 0 ${share}%,var(--primary2) ${share}% 100%)`:'var(--line)';}
   setText('targetDetail',profile.residents+' morador(es) × '+fmt(profile.reference)+' por pessoa/dia · '+(profile.mode==='user'?'referência personalizada':'referência histórica SNIS 2020'));
   setText('perPersonDetail','Volume simulado ÷ '+weekly.residents+' morador(es). Não representa consumo individual medido.');
   setText('comparisonDetail',(excessive?'O cenário ultrapassa a referência em '+Math.round((weekDaily/referenceTotal-1)*100)+'%. ':'')+'Comparação ilustrativa com tolerância de '+profile.tolerance+'%; '+(profile.mode==='user'?'hipótese definida no perfil.':'referência histórica, não meta universal.'));
   const alert=$('alertContent');if(alert){alert.className='alert-content '+(excessive?'warning':'neutral');alert.textContent=excessive?'⚠ Consumo simulado elevado: '+fmt(weekDaily)+' no dia, acima da faixa ilustrativa de '+fmt(referenceTotal*(1+profile.tolerance/100))+' ('+profile.tolerance+'% de tolerância). Revise os valores personalizados; isso não é uma medição real nem diagnóstico de desperdício.':'Demonstração: o consumo personalizado está dentro da faixa ilustrativa configurada. Os valores não são medições reais.';}
  }else{for(const [id,item] of directOriginals){item.node.textContent=item.text;item.node.className=item.className;}}
  $('demoNotice')?.setAttribute('data-volume',String(weekly?weekDaily:v[0]*v[1]*v[2]*v[3]));
  const label=$('demoNotice')?.querySelector('span');
  if(label)label.textContent=weekly?'◈ Demonstração: padrão semanal personalizado. Valores fictícios, sem alterar as medições reais.':'◈ Demonstração: dados fictícios de banhos. Conecte o ESP32 para ver medições reais.';
 }else for(const {node,shown} of overlays.values()){node.classList.remove('demo-covered');shown.hidden=true;}
 const chart=$('dailyChart');
 if(chart)chart.parentElement.classList.toggle('demo-chart-empty',useDemo);
 const estimated=$('demoRecentPreview');
 if(estimated){
  estimated.hidden=!useDemo||!simulation||!!weekly;
  if(useDemo&&simulation&&!weekly){
   const daily=simulation[0]*simulation[1]*simulation[2]*simulation[3];
   estimated.querySelector('[data-demo-daily]').textContent=fmt(daily);
   estimated.querySelector('[data-demo-week]').textContent=fmt(daily*7);
  }
 }
 const demoLink=$('demoUseReal');
 if(demoLink)demoLink.hidden=!((simulation||weekly)&&real);
 drawWeeklyCalendar(real&&hasRealHistory()||real&&isRealOnline());
 if(!useDemo&&wasWeeklyDemo){for(const [id,item] of directOriginals){item.node.textContent=item.text;item.node.className=item.className;}wasWeeklyDemo=false;}
 if(useDemo&&weekly)wasWeeklyDemo=true;
}
function store(v){
 demoInfoActivated=true;
 simulation=v;weekly=null;
 try{sessionStorage.setItem(KEY,JSON.stringify({version:1,v}));sessionStorage.removeItem(WEEK_KEY);}catch{}
 update();
}
function erase(){
 simulation=null;weekly=null;
 blockedAfterClear=true;
 try{sessionStorage.removeItem(KEY);sessionStorage.removeItem(WEEK_KEY);}catch{}
 update();
 frame?.contentWindow?.postMessage({type:'hydrocasa-demo-clear-inputs'},'*');
 const form=$('demoDataStudio');
 form?.querySelectorAll('[data-demo-weekday]').forEach(input=>input.value='0');
 if($('demoResidents'))$('demoResidents').value='1';
 if($('demoPeriod'))$('demoPeriod').value='7';
 if($('demoCustomPeriod'))$('demoCustomPeriod').value='14';
 if($('demoCustomPeriodWrap'))$('demoCustomPeriodWrap').hidden=true;
 renderWeekSummary();
 drawWeeklyCalendar(false);
}
function showDecision(){
 if(dialog||prompted)return;prompted=true;
 try{sessionStorage.setItem(KEY+':asked','1');}catch{}
 const prior=document.activeElement;
 dialog=document.createElement('div');dialog.className='demo-dialog-backdrop';
 dialog.innerHTML='<div class="demo-dialog" role="alertdialog" aria-modal="true" aria-labelledby="demoDialogTitle" aria-describedby="demoDialogMessage"><h2 id="demoDialogTitle">ESP32 conectado</h2><p id="demoDialogMessage">O ESP32 foi conectado. Deseja remover os dados da demonstração para exibir somente as medições reais?</p><div class="demo-dialog-actions"><button type="button" data-choice="clear" class="primary-btn">Remover demonstração e usar ESP32</button><button type="button" data-choice="keep" class="ghost-btn">Manter demonstração apenas no Simulador</button></div></div>';
 document.body.append(dialog);
 const controls=[...dialog.querySelectorAll('button')];
 const close=keep=>{if(!keep)erase();dialog.remove();dialog=null;prior?.focus?.();update();};
 controls[0].addEventListener('click',()=>close(false));controls[1].addEventListener('click',()=>close(true));
 dialog.addEventListener('click',e=>{if(e.target===dialog)close(true);});
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close(true)}else if(e.key==='Tab'){const i=controls.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();controls[1].focus()}else if(!e.shiftKey&&i===1){e.preventDefault();controls[0].focus()}}});
 controls[0].focus();
}
try{const o=JSON.parse(sessionStorage.getItem(KEY)||'null');if(o?.version===1&&valid(o.v))simulation=o.v;}catch{}
try{const o=JSON.parse(sessionStorage.getItem(WEEK_KEY)||'null');if(validWeekly(o))weekly=o;}catch{}
function watch(){const real=hasRealHistory()||isRealOnline();if(real&&!hadReal&&(simulation||weekly)&&!prompted){let asked=false;try{asked=sessionStorage.getItem(KEY+':asked')==='1'}catch{}if(!asked)showDecision();}hadReal=real;update();}
window.addEventListener('message',event=>{
 if(event.source!==frame?.contentWindow||event.origin!=='null'||!event.data||typeof event.data!=='object')return;
 if(event.data.type==='hydrocasa-demo-clear'){erase();return;}
 if(event.data.type!=='hydrocasa-demo-values'||!valid(event.data.v)||blockedAfterClear)return;
 // Dados hipotéticos não atravessam a fronteira do histórico real.
 store(event.data.v);
});
clear?.addEventListener('click',erase);
$('demoUseReal')?.addEventListener('click',()=>erase());
function readWeekForm(){
 const residents=Number($('demoResidents')?.value),periodValue=$('demoPeriod')?.value,days=periodValue==='custom'?Number($('demoCustomPeriod')?.value):Number(periodValue);
 const values=Array.from({length:7},(_,day)=>[1,2].map(r=>Number(document.querySelector('[data-demo-weekday="'+day+'"][data-demo-ramal="'+r+'"]')?.value)));
 if(!Number.isInteger(residents)||residents<1||residents>100)throw Error('Informe de 1 a 100 moradores.');
 if(!Number.isInteger(days)||days<1||days>366)throw Error('Escolha de 1 a 366 dias para a demonstração.');
 if(values.some(row=>row.some(v=>!Number.isFinite(v)||v<0||v>100000)))throw Error('Cada ramal deve ficar entre 0 e 100.000 litros por dia.');
 return {version:1,residents,days,values};
}
function renderWeekSummary(){
 const box=$('demoWeekSummary');if(!box)return;
 try{
  const o=readWeekForm(),week=o.values.reduce((s,v)=>s+v[0]+v[1],0),daily=week/7;
  box.textContent='Padrão semanal: '+week.toLocaleString('pt-BR',{maximumFractionDigits:1})+' L · média diária: '+daily.toLocaleString('pt-BR',{maximumFractionDigits:1})+' L · período de '+o.days+' dias: aproximadamente '+(daily*o.days).toLocaleString('pt-BR',{maximumFractionDigits:1})+' L ('+fmt(daily*o.days)+' no total).';
 }catch(e){box.textContent=e.message;}
}
function applyWeek(){
 try{
  const o=readWeekForm();demoInfoActivated=true;weekly=o;simulation=null;
  try{sessionStorage.setItem(WEEK_KEY,JSON.stringify(o));sessionStorage.removeItem(KEY);}catch{}
  blockedAfterClear=false;update();renderWeekSummary();showUpdatedPopup();
 }catch(e){const box=$('demoWeekSummary');if(box)box.textContent=e.message;}
}
$('demoApplyWeek')?.addEventListener('click',applyWeek);
$('demoClearWeek')?.addEventListener('click',erase);
const customPeriodWrap=$('demoCustomPeriodWrap'),periodSelect=$('demoPeriod');
function syncCustomPeriod(){if(customPeriodWrap)customPeriodWrap.hidden=periodSelect?.value!=='custom';renderWeekSummary();}
periodSelect?.addEventListener('change',syncCustomPeriod);
$('demoDataStudio')?.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',renderWeekSummary));
syncCustomPeriod();
// Reutiliza a mesma estrutura de modal do detalhamento dos dias do calendário.
const demoDetails=$('demoDataDetails'),modal=$('modal'),modalBody=$('modalBody'),closeModalButton=$('closeModal'),backdrop=modal?.querySelector('.modal-backdrop');
if(demoDetails&&modal&&modalBody){
 const originalParent=demoDetails.parentNode,originalNext=demoDetails.nextSibling;
 const summary=demoDetails.querySelector(':scope > summary');
 let openedFromDemo=false;
 if(summary&&!summary.querySelector('.demo-modal-close')){
  const close=document.createElement('button');close.type='button';close.className='demo-modal-close';close.setAttribute('aria-label','Fechar personalização');close.title='Fechar';close.textContent='×';summary.appendChild(close);
  close.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closeDemoModal();});
 }
 function restoreDemoDetails(){
  if(originalParent&&demoDetails.parentNode!==originalParent){
   if(originalNext&&originalNext.parentNode===originalParent)originalParent.insertBefore(demoDetails,originalNext);
   else originalParent.appendChild(demoDetails);
  }
  demoDetails.open=false;
 }
 function closeDemoModal(){
  if(!openedFromDemo)return;
  openedFromDemo=false;
  modal.classList.remove('open','demo-editor-open');
  modal.setAttribute('aria-hidden','true');
  restoreDemoDetails();
 }
 function openDemoModal(event){
  event?.preventDefault();
  if(openedFromDemo)return;
  openedFromDemo=true;
  demoDetails.open=true;
  modalBody.replaceChildren(demoDetails);
  modal.classList.add('open','demo-editor-open');
  modal.setAttribute('aria-hidden','false');
 }
 summary?.addEventListener('click',openDemoModal);
 closeModalButton?.addEventListener('click',closeDemoModal);
 backdrop?.addEventListener('click',closeDemoModal);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDemoModal();});
}
function drawWeeklyCalendar(real){
 const grid=$('calendarGrid');if(!grid)return;
 const active=!!weekly;
 const now=new Date();now.setHours(0,0,0,0);
 grid.querySelectorAll('.day[data-demo-date]').forEach(cell=>{
  const total=cell.querySelector('.day-total');if(!total)return;
  const key=cell.dataset.demoDate,parts=key.split('-').map(Number),date=new Date(parts[0],parts[1]-1,parts[2]);date.setHours(0,0,0,0);
  const age=Math.round((now-date)/86400000);
  let badge=cell.querySelector('.demo-day-value');
  if(active&&age>=0&&age<weekly.days){
   const row=weekly.values[date.getDay()],liters=row[0]+row[1];
   if(!badge){badge=document.createElement('span');badge.className='demo-day-value';badge.setAttribute('aria-label','Valor fictício de demonstração');total.insertAdjacentElement('afterend',badge);}
   badge.textContent='◈ Demo · '+fmt(liters/1000);
   cell.classList.add('demo-day-has-data');
   cell.title='Demonstração fictícia: Ramal 1 '+fmt(row[0])+' L; Ramal 2 '+fmt(row[1])+' L. O valor real, se houver, permanece acima.';
  }else{
   badge?.remove();cell.classList.remove('demo-day-has-data');cell.removeAttribute('title');
  }
 });
}
renderWeekSummary();
const calendarGrid=$('calendarGrid');
if(calendarGrid)new MutationObserver(()=>drawWeeklyCalendar(hasRealHistory()||isRealOnline())).observe(calendarGrid,{childList:true});

frame?.addEventListener('load',()=>{blockedAfterClear=false;});
new MutationObserver(watch).observe(document.body,{attributes:true,attributeFilter:['data-connection-state']});
window.addEventListener('storage',watch);
setInterval(watch,1500);
watch();
})();