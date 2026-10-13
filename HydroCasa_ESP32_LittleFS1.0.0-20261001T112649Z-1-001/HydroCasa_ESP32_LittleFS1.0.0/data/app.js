const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function readStored(key, fallback){
  try {
    const value=JSON.parse(localStorage.getItem(key));
    return value && typeof value==="object" && !Array.isArray(value) ? value : fallback;
  } catch(e) { return fallback; }
}

function loadLedger(){
  const stored=readStored("hydrocasa_ledger_v2",null);
  if(stored && stored.version===2 && stored.history && typeof stored.history==="object" && !Array.isArray(stored.history)) return stored;
  // Preserve recoverable legacy totals; the old rolling-window losses cannot be reconstructed.
  const history=readStored("hydrocasa_history",{});
  for(const [key,h] of Object.entries(history)){
    if(!h || !Number.isFinite(h.total1) || !Number.isFinite(h.total2) || h.total1<0 || h.total2<0){delete history[key];continue;}
    h.snapshots=Array.isArray(h.snapshots)?h.snapshots.slice(-250):[];
    h.readings=h.snapshots.length;
    h.partial=true;
  }
  return {version:2,history,cursor:null};
}

const ledger=loadLedger();
const state = {
  live: { liters1:0, liters2:0, flow1_lpm:0, flow2_lpm:0 },
  history: ledger.history,
  justifications: readStored("hydrocasa_justifications",{}),
  monthOffset: 0,
  connected: false,
  cursor: ledger.cursor,
  storageError: false
};

const activities = [
  ["Banho demorado", 80], ["Lavou o carro", 120], ["Lavou a calçada", 100],
  ["Lavou roupa", 110], ["Lavou louça", 35], ["Regou plantas", 25],
  ["Encheu piscina", 300], ["Limpeza da casa", 50]
];

function fmt(v){ return Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function keyForDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function save(){
  try {
    // Cursor and daily totals are persisted together to avoid recounting on reload.
    localStorage.setItem("hydrocasa_ledger_v2",JSON.stringify({version:2,history:state.history,cursor:state.cursor}));
    localStorage.setItem("hydrocasa_justifications",JSON.stringify(state.justifications));
    state.storageError=false;
  } catch(e) { state.storageError=true; }
}

function todayKey(){ return keyForDate(new Date()); }

function ensureDay(k){
  if(!state.history[k]) state.history[k]={snapshots:[],total1:0,total2:0,readings:0,partial:true};
  return state.history[k];
}

function ensureToday(){ ensureDay(todayKey()); }

function addSnapshot(k, d, now=Date.now()){
  const h=ensureDay(k),previous=state.cursor;
  if(previous && previous.day===k && previous.device===d.device_id){
    if(previous.session!==d.session_id){
      // New counting session: keep earlier consumption and add the new session's volume.
      h.total1+=d.liters1;
      h.total2+=d.liters2;
      h.partial=true; // Unobserved consumption before reset/reboot cannot be recovered.
    }else if(d.liters1>=previous.l1 && d.liters2>=previous.l2){
      h.total1+=d.liters1-previous.l1;
      h.total2+=d.liters2-previous.l2;
      if(now-previous.t>10000) h.partial=true;
    }else{
      // Unexpected rollback/wrap: rebase, never subtract recorded consumption.
      h.partial=true;
    }
  }else{
    // First observation or day/device change: do not assign an unknown interval to this day.
    h.partial=true;
    if(previous && state.history[previous.day]) state.history[previous.day].partial=true;
  }
  h.readings=(h.readings||0)+1;
  h.snapshots.push({t:now,l1:d.liters1,l2:d.liters2});
  if(h.snapshots.length>250) h.snapshots.shift();
  state.cursor={day:k,device:d.device_id,session:d.session_id,l1:d.liters1,l2:d.liters2,t:now};
  save();
}

async function poll(){
  try{
    const r=await fetch("/api/live",{cache:"no-store"});
    if(!r.ok) throw new Error();
    const d=await r.json();
    state.connected=true;
    state.live=d;
    ensureToday();
    addSnapshot(todayKey(),d);
    updateLive();
    syncToEsp(d);
  }catch(e){
    state.connected=false;
    updateConnection();
  }
}

let syncBusy=false;
async function syncToEsp(d){
  if(syncBusy) return;
  syncBusy=true;
  try{
    await fetch("/api/daily",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({date:todayKey(),liters1:d.liters1,liters2:d.liters2})});
  }catch(e){} finally{syncBusy=false;}
}

function updateConnection(){
  const b=$("#connectionBadge");
  b.className="badge "+(state.connected?"online":"offline");
  b.textContent=state.connected?"● Online":"● Offline";
  $("#statusText").textContent=state.connected?"Monitorando":"Sem conexão";
  $("#statusDetail").textContent=state.connected?"ESP32 respondendo":"Verifique Wi-Fi";
}

function updateLive(){
  updateConnection();
  const d=state.live;
  const h=state.history[todayKey()]||{total1:0,total2:0};
  const t=(h.total1||0)+(h.total2||0);
  $("#todayTotal").textContent=fmt(t)+" L";
  $("#sensor1Total").textContent=fmt(h.total1)+" L";
  $("#sensor2Total").textContent=fmt(h.total2)+" L";
  $("#split1").textContent=fmt(h.total1)+" L";
  $("#split2").textContent=fmt(h.total2)+" L";
  $("#flow1").textContent=fmt(d.flow1_lpm)+" L/min";
  $("#flow2").textContent=fmt(d.flow2_lpm)+" L/min";
  const ratio=t?Math.round((h.total1/t)*100):50;
  $("#ratio1").textContent=ratio+"%";
  $("#donut").style.background=`conic-gradient(var(--primary) 0 ${ratio}%,var(--primary2) ${ratio}% 100%)`;
  updateChart();
  updateAlert(t);
  updateAnalysis();
}

function updateChart(){
  const c=$("#dailyChart"),ctx=c.getContext("2d");
  const rect=c.getBoundingClientRect(),ratio=window.devicePixelRatio||1;
  c.width=rect.width*ratio;c.height=190*ratio;ctx.scale(ratio,ratio);
  const w=rect.width,h=190;
  ctx.clearRect(0,0,w,h);
  const now=new Date(); const vals=[];
  for(let i=6;i>=0;i--){
    const d=new Date(now);d.setDate(now.getDate()-i);const k=keyForDate(d);
    const x=state.history[k];vals.push(x?(x.total1+x.total2):0);
  }
  const max=Math.max(10,...vals);
  ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue("--line");ctx.lineWidth=1;
  for(let y=1;y<4;y++){ctx.beginPath();ctx.moveTo(0,y*h/4);ctx.lineTo(w,y*h/4);ctx.stroke();}
  ctx.beginPath();
  vals.forEach((v,i)=>{const x=i*(w/(vals.length-1)),y=h-28-(v/max)*(h-55);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
  ctx.lineWidth=3;ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue("--primary");ctx.stroke();
  vals.forEach((v,i)=>{const x=i*(w/(vals.length-1)),y=h-28-(v/max)*(h-55);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle=getComputedStyle(document.body).getPropertyValue("--primary2");ctx.fill()});
}

function updateAlert(total){
  const card=$("#alertContent");
  if(total>250){
    card.className="alert-content warning";
    card.innerHTML=`<div class="alert-icon">!</div><div><strong>Consumo acima do padrão configurado</strong><p>${fmt(total)} L já foram registrados hoje. Você pode registrar uma atividade para contextualizar esse pico.</p></div>`;
  }else{
    card.className="alert-content neutral";
    card.innerHTML=`<div class="alert-icon">✓</div><div><strong>Sem anomalias detectadas</strong><p>O sistema está comparando o consumo com o padrão configurado.</p></div>`;
  }
}

function renderCalendar(){
  const base=new Date();base.setDate(1);base.setMonth(base.getMonth()+state.monthOffset);
  const year=base.getFullYear(),month=base.getMonth();
  $("#monthTitle").textContent=base.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const grid=$("#calendarGrid");grid.innerHTML="";
  const first=new Date(year,month,1).getDay(),days=new Date(year,month+1,0).getDate();
  for(let i=0;i<first;i++) grid.appendChild(document.createElement("div"));
  for(let day=1;day<=days;day++){
    const d=new Date(year,month,day),k=keyForDate(d),el=document.createElement("button");
    el.className="day";el.type="button";
    const today=new Date();today.setHours(0,0,0,0);const dd=new Date(d);dd.setHours(0,0,0,0);
    const h=state.history[k],isFuture=dd>today,isPast=dd<today;
    if(isFuture) el.classList.add("future");
    else if(h && h.readings>0) el.classList.add("has-data");
    else if(isPast) el.classList.add("empty");
    if(dd.getTime()===today.getTime()) el.classList.add("today");
    let bottom=isFuture?"Aguardando coleta":h&&h.readings>0?fmt(h.total1+h.total2)+" L"+(h.partial?" • parcial":""):"Sem informação";
    el.innerHTML=`<span class="num">${day}</span><span class="day-total">${bottom}</span>`;
    el.addEventListener("click",()=>openDayModal(d));
    grid.appendChild(el);
  }
}

function openDayModal(d){
  const k=keyForDate(d),h=state.history[k],future=d>new Date();
  if(future){
    showModal(`<span class="eyebrow">DIA FUTURO</span><h3>Coleta ainda não disponível</h3><p>O dia ${d.toLocaleDateString("pt-BR")} ainda não chegou. Quando chegar, o sistema poderá registrar as leituras usando o relógio do computador.</p>`);
    return;
  }
  if(!h || !h.readings){
    showModal(`<span class="eyebrow">HISTÓRICO</span><h3>Nenhuma informação</h3><p>Não houve nenhuma leitura computada em ${d.toLocaleDateString("pt-BR")}.</p>`);
    return;
  }
  const total=h.total1+h.total2,r=total?Math.round(h.total1/total*100):0;
  showModal(`<span class="eyebrow">RELATÓRIO DIÁRIO</span><h3>${d.toLocaleDateString("pt-BR",{dateStyle:"full"})}</h3>
    <div class="analysis-grid" style="grid-template-columns:1fr 1fr;margin-top:18px">
      <div class="glass-card"><span>Ramal 01</span><strong>${fmt(h.total1)} L</strong><small>${r}% do total</small></div>
      <div class="glass-card"><span>Ramal 02</span><strong>${fmt(h.total2)} L</strong><small>${100-r}% do total</small></div>
    </div><p><b>Total: ${fmt(total)} L.</b> ${h.partial?"Coleta parcial: pode haver consumo não registrado neste dia.":"Consumo registrado neste dia."}</p>`);
}

function updateAnalysis(){
  const h=state.history[todayKey()]||{total1:0,total2:0},raw=h.total1+h.total2;
  const j=(state.justifications[todayKey()]||[]).reduce((a,x)=>a+x.liters,0);
  $("#rawAnalysis").textContent=fmt(raw)+" L";$("#justifiedValue").textContent=fmt(j)+" L";$("#contextualValue").textContent=fmt(Math.max(0,raw-j))+" L";
  const max=Math.max(1,h.total1,h.total2);
  $("#analysisBars").innerHTML=`
    <div class="bar-row"><div class="bar-label"><span>Ramal 01</span><b>${fmt(h.total1)} L</b></div><div class="bar-track"><div class="bar-fill" style="width:${h.total1/max*100}%"></div></div></div>
    <div class="bar-row"><div class="bar-label"><span>Ramal 02</span><b>${fmt(h.total2)} L</b></div><div class="bar-track"><div class="bar-fill" style="width:${h.total2/max*100}%"></div></div></div>`;
}

function showModal(html){$("#modalBody").innerHTML=html;$("#modal").classList.add("open");$("#modal").setAttribute("aria-hidden","false")}
function closeModal(){$("#modal").classList.remove("open");$("#modal").setAttribute("aria-hidden","true")}
$("#closeModal").onclick=closeModal;$(".modal-backdrop").onclick=closeModal;

function openJustification(){
  const k=todayKey(),selected=new Set();
  showModal(`<span class="eyebrow">CONTEXTO DE CONSUMO</span><h3>Registrar atividade</h3>
    <p>Selecione atividades que explicam um consumo maior. Elas <b>não alteram os dados brutos dos sensores</b>; servem apenas para contextualização.</p>
    <div class="choice-grid">${activities.map((a,i)=>`<button class="choice" data-i="${i}"><b>${a[0]}</b><small>estimativa: ${a[1]} L</small></button>`).join("")}</div>
    <div class="modal-actions"><button class="primary-btn" id="saveChoices">Aplicar contexto</button></div>`);
  $$(".choice").forEach(b=>b.onclick=()=>{b.classList.toggle("selected");selected.has(+b.dataset.i)?selected.delete(+b.dataset.i):selected.add(+b.dataset.i)});
  $("#saveChoices").onclick=()=>{
    state.justifications[k]=[...selected].map(i=>({name:activities[i][0],liters:activities[i][1]}));
    save();updateAnalysis();closeModal();
  };
}

$("#openJustify").onclick=openJustification;$("#openJustify2").onclick=openJustification;
$("#openLegend").onclick=()=>showModal(`<span class="eyebrow">GUIA RÁPIDO</span><h3>Como o HydroCasa funciona</h3><p>Os sensores Hall geram pulsos conforme a água passa. O ESP32 converte pulsos em litros usando o fator de calibração. O LittleFS entrega este painel HTML/CSS/JS diretamente pelo ESP32.</p><p>O navegador usa a data e a hora do computador para organizar o calendário. Os snapshots são enviados ao ESP32 e também ficam no armazenamento local do navegador para a apresentação.</p><p><b>Importante:</b> o fator de 450 pulsos/L é apenas uma referência para sensores YF-S201. Faça uma calibração física para obter uma leitura defensável na apresentação.</p>`);

$$(".tab").forEach(b=>b.onclick=()=>{$$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".panel").forEach(p=>p.classList.remove("active-panel"));$("#"+b.dataset.panel).classList.add("active-panel");if(b.dataset.panel==="calendar")renderCalendar();if(b.dataset.panel==="analysis")updateAnalysis()});
$("#prevMonth").onclick=()=>{state.monthOffset--;renderCalendar()};$("#nextMonth").onclick=()=>{state.monthOffset++;renderCalendar()};

$("#themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("hydrocasa_theme",document.body.classList.contains("dark")?"dark":"light");updateChart()};
if(localStorage.getItem("hydrocasa_theme")==="dark")document.body.classList.add("dark");

$("#resetBtn").onclick=async()=>{
  if(!confirm("Zerar os contadores do ESP32? Faça isso apenas antes de uma nova demonstração."))return;
  try{await fetch("/api/reset",{method:"POST"});alert("Contadores zerados.");}catch(e){alert("Não foi possível falar com o ESP32.");}
};

function clock(){
  const d=new Date();$("#clock").textContent=d.toLocaleTimeString("pt-BR");$("#dateLabel").textContent=d.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
}
setInterval(clock,1000);clock();
ensureToday();renderCalendar();updateLive();
setInterval(poll,2000);poll();
window.addEventListener("resize",updateChart);
