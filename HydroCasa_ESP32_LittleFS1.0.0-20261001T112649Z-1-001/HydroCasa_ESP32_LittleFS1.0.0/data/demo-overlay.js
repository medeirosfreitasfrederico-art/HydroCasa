/* Camada somente visual. NÃO modifica app.js, ledger, histórico, calendário nem APIs. */
(()=>{
'use strict';
const KEY='hydrocasa:simulacao';
const $=id=>document.getElementById(id);
const frame=$('simulatorFrame'),notice=$('demoNotice'),clear=$('demoClear');
const limits=[[1,10],[1,30],[1,4],[3,20],[7,365]];
let simulation=null,source='nenhuma',hadReal=false,prompted=false,dialog=null,blockedAfterClear=false;
const valid=v=>Array.isArray(v)&&v.length===5&&v.every((n,i)=>typeof n==='number'&&Number.isFinite(n)&&n>=limits[i][0]&&n<=limits[i][1])&&[7,30,365].includes(v[4]);
function hasRealHistory(){
 try{
  const raw=localStorage.getItem('hydrocasa_ledger_v2'),ledger=raw?JSON.parse(raw):null;
  return !!(ledger&&ledger.version===2&&ledger.history&&Object.values(ledger.history).some(d=>d&&d.readings>0&&Number.isFinite(d.total1)&&Number.isFinite(d.total2)));
 }catch{return false;}
}
function isRealOnline(){return document.body.dataset.connectionState==='online'&&$('statusDetail')?.textContent.includes('Última leitura');}
function fmt(l){return (l/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' m³';}
const map=[['todayTotal',v=>fmt(v[0]*v[1]*v[2]*v[3])],['perPersonValue',v=>fmt(v[1]*v[2]*v[3])],['householdTarget',v=>'—'],['comparisonStatus',v=>'Apenas cenário de banhos'],['sensor1Total',v=>'—'],['sensor2Total',v=>'—'],['flow1',v=>'—'],['flow2',v=>'—'],['ratio1',v=>'—']];
const overlays=new Map();
for(const [id] of map){const node=$(id);if(!node)continue;const parent=node.parentElement;const shown=document.createElement('span');shown.className='demo-value';shown.hidden=true;shown.setAttribute('aria-label','Demonstração, valor fictício');parent.append(shown);overlays.set(id,{node,shown});}
function update(){
 const real=hasRealHistory()||isRealOnline();
 const useDemo=!!simulation&&!real;
 source=real?'esp32':useDemo?'simulacao':'nenhuma';
 document.body.dataset.demoActive=useDemo?'true':'false';
 notice.hidden=!useDemo;
 if(useDemo){
  const v=simulation,perDay=v[0]*v[1]*v[2]*v[3];
  for(const [id,fn] of map){const p=overlays.get(id);if(!p)continue;p.shown.textContent=fn(v);p.shown.hidden=false;p.node.classList.add('demo-covered');}
  $('demoNotice')?.setAttribute('data-volume',String(perDay));
 }else for(const {node,shown} of overlays.values()){node.classList.remove('demo-covered');shown.hidden=true;}
 const chart=$('dailyChart');
 if(chart)chart.parentElement.classList.toggle('demo-chart-empty',useDemo);
 const estimated=$('demoRecentPreview');
 if(estimated){
  estimated.hidden=!useDemo;
  if(useDemo){
   const daily=simulation[0]*simulation[1]*simulation[2]*simulation[3];
   estimated.querySelector('[data-demo-daily]').textContent=fmt(daily);
   estimated.querySelector('[data-demo-week]').textContent=fmt(daily*7);
  }
 }
 const demoLink=$('demoUseReal');
 if(demoLink)demoLink.hidden=!(simulation&&real);

}
function store(v){
 simulation=v;
 try{sessionStorage.setItem(KEY,JSON.stringify({version:1,v}));}catch{}
 update();
}
function erase(){
 simulation=null;
 blockedAfterClear=true;
 try{sessionStorage.removeItem(KEY);}catch{}
 update();
 frame?.contentWindow?.postMessage({type:'hydrocasa-demo-clear-inputs'},'*');
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
function watch(){const real=hasRealHistory()||isRealOnline();if(real&&!hadReal&&simulation&&!prompted){let asked=false;try{asked=sessionStorage.getItem(KEY+':asked')==='1'}catch{}if(!asked)showDecision();}hadReal=real;update();}
window.addEventListener('message',event=>{
 if(event.source!==frame?.contentWindow||event.origin!=='null'||!event.data||typeof event.data!=='object')return;
 if(event.data.type==='hydrocasa-demo-clear'){erase();return;}
 if(event.data.type!=='hydrocasa-demo-values'||!valid(event.data.v)||blockedAfterClear)return;
 // Dados hipotéticos não atravessam a fronteira do histórico real.
 store(event.data.v);
});
clear?.addEventListener('click',erase);
$('demoUseReal')?.addEventListener('click',()=>erase());
frame?.addEventListener('load',()=>{blockedAfterClear=false;});
new MutationObserver(watch).observe(document.body,{attributes:true,attributeFilter:['data-connection-state']});
window.addEventListener('storage',watch);
setInterval(watch,1500);
watch();
})();