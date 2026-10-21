/* TEMPORARY VIEW FIXTURES. Does not touch ESP32 state, ledger or real readings.
   Revert: remove this file, the companion CSS and their index.html tags. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const mock={todayTotal:'0,426 m³',todayDelta:'+ 8,4% em relação à média',
 sensor1Total:'0,258 m³',sensor2Total:'0,168 m³',flow1:'7,2 L/min',flow2:'4,6 L/min',
 perPersonValue:'0,107 m³',householdTarget:'0,440 m³',
 comparisonStatus:'Dentro da referência',ratio1:'61%',rawAnalysis:'0,426 m³',
 justifiedValue:'0,163 m³',contextualValue:'0,107 m³'};
const originals=new Map(),created=[];
let enabled=false;
function hasReal(){
 if(document.body.dataset.connectionState==='online')return true;
 try{const h=JSON.parse(localStorage.getItem('hydrocasa_ledger_v2')||'{}').history||{};
 return Object.values(h).some(x=>x&&x.readings>0);}catch{return true;}
}
function attach(){
 for(const [id,text] of Object.entries(mock)){
  const node=$(id);if(!node)continue;
  const cover=document.createElement('span');cover.className='fixture-view-value';cover.textContent=text;
  cover.setAttribute('aria-hidden','true');node.after(cover);node.classList.add('fixture-view-original');
  created.push(cover);originals.set(id,node);
 }
 const bars=$('analysisBars');if(bars){
  const v=document.createElement('div');v.className='fixture-bars';
  v.innerHTML='<div><span>Ramal 01</span><strong>0,258 m³</strong><i style="--fixture-bar:61%"></i></div><div><span>Ramal 02</span><strong>0,168 m³</strong><i style="--fixture-bar:39%"></i></div>';bars.append(v);created.push(v);
 }
 const chart=$('dailyChart');if(chart){
  const fig=document.createElement('div');fig.className='fixture-chart';fig.setAttribute('role','img');fig.setAttribute('aria-label','Volumes de consumo distribuídos em sete dias');
  const vals=[340,385,317,412,390,461,426];
  fig.innerHTML=vals.map((n,i)=>'<div class="fixture-chart-col"><strong>'+n+' L</strong><i style="--fixture-h:'+(n/500*100)+'%"></i><small>'+['Qui','Sex','Sáb','Dom','Seg','Ter','Qua'][i]+'</small></div>').join('');
  chart.after(fig);created.push(fig);
 }
 const hist=$('historyChart');if(hist){
  const b=document.createElement('div');b.className='fixture-chart fixture-history-chart';
  b.innerHTML=[.34,.385,.317,.412,.39,.461,.426].map((n,i)=>'<div class="fixture-chart-col"><strong>'+n.toLocaleString('pt-BR',{minimumFractionDigits:3})+'</strong><i style="--fixture-h:'+(n/.5*100)+'%"></i><small>'+String(i+15).padStart(2,'0')+'/10</small></div>').join('');
  hist.append(b);created.push(b);
 }
 const table=$('historyRows');if(table){
  const tbody=document.createElement('tbody');tbody.className='fixture-history-rows';
  tbody.innerHTML=[15,16,17,18,19,20,21].map((day,i)=>{const a=[.205,.232,.186,.249,.237,.281,.258][i],b=[.135,.153,.131,.163,.153,.18,.168][i];return '<tr><th scope="row">'+String(day).padStart(2,'0')+'/10/2026</th><td>'+a.toFixed(3).replace('.',',')+'</td><td>'+b.toFixed(3).replace('.',',')+'</td><td>'+(a+b).toFixed(3).replace('.',',')+'</td><td>100%</td><td>Detalhes</td></tr>';}).join('');table.parentNode.insertBefore(tbody,table.nextSibling);created.push(tbody);
 }
 const empty=$('historyEmpty');if(empty)empty.classList.add('fixture-hidden-on');
 const calendar=$('calendarGrid');if(calendar){
  const grid=document.createElement('div');grid.className='fixture-calendar-grid';const offset=4;
  grid.innerHTML=Array.from({length:offset},()=>'<span></span>').join('')+
  Array.from({length:31},(_,i)=>{const v=i+1;return '<span class="'+(v<=21?'fixture-day-has-data':'')+'"><b>'+v+'</b>'+(v<=21?'<small>'+[318,356,402,388,415,341,426][i%7]+' L</small>':'')+'</span>';}).join('');
  calendar.after(grid);created.push(grid);
 }
 const details=$('historyDayDetails');if(details){
  const content=$('historyDayBody');if(content){const card=document.createElement('div');card.className='fixture-day-details';card.innerHTML='<strong>21/10/2026</strong><p>Ramal 01: 0,258 m³ · Ramal 02: 0,168 m³</p><p>Total: 0,426 m³ · Cobertura: 100%</p>';content.append(card);created.push(card);}
 }
}
function update(){const shouldShow=!hasReal();document.body.classList.toggle('hydro-view-fixtures',shouldShow);enabled=shouldShow;}
function start(){attach();update();new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['data-connection-state']});window.addEventListener('storage',update);setInterval(update,5000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();