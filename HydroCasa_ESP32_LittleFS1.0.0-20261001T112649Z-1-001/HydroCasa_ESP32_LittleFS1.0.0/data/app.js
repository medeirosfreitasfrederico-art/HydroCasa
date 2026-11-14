const M = HydroConsumption;
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
  storageError: false,
  lastValidAt: null,
  syncError: false,
  demoMode: false,
  apiMissing: false,
  household: M.maybeProfile(ledger.household),
  activityRecords: ledger.activityRecords && typeof ledger.activityRecords==="object" ? ledger.activityRecords : {}
};

function fmt(v){ return Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:2}); }
const volume=M.m3;
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function keyForDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function save(){
  try {
    // Cursor and daily totals are persisted together to avoid recounting on reload.
    localStorage.setItem("hydrocasa_ledger_v2",JSON.stringify({version:2,history:state.history,cursor:state.cursor,household:state.household,activityRecords:state.activityRecords}));
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
  const h=ensureDay(k),previous=state.cursor,before=h.total1+h.total2;
  if(!h.readings && state.household) h.profile=M.clone(state.household);
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
  // Volume por hora do dia (gráfico "Quando a água foi usada"); não altera os totais.
  const added=h.total1+h.total2-before;
  if(added>0){
    if(!Array.isArray(h.hours)||h.hours.length!==24)h.hours=Array(24).fill(0);
    h.hours[new Date(now).getHours()]+=added;
  }
  h.readings=(h.readings||0)+1;
  h.snapshots.push({t:now,l1:d.liters1,l2:d.liters2});
  if(h.snapshots.length>250) h.snapshots.shift();
  state.cursor={day:k,device:d.device_id,session:d.session_id,l1:d.liters1,l2:d.liters2,t:now};
  save();
}

async function requestJson(url, options={}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),5000);
  try {
    const response=await fetch(url,{...options,cache:"no-store",signal:controller.signal});
    if(!response.ok) {
      const error=new Error(`HTTP ${response.status}`);
      error.status=response.status;
      throw error;
    }
    const data=await response.json();
    if(!data || data.ok!==true) throw new Error("Resposta inválida do ESP32");
    return data;
  } finally { clearTimeout(timeout); }
}

function validateLive(d){
  for(const key of ["liters1","liters2","flow1_lpm","flow2_lpm"]){
    if(typeof d[key]!=="number" || !Number.isFinite(d[key]) || d[key]<0) throw new Error("Leitura inválida");
  }
  for(const key of ["pulses1","pulses2","uptime_ms"]){
    if(!Number.isInteger(d[key]) || d[key]<0 || d[key]>0xffffffff) throw new Error("Contador inválido");
  }
  if(typeof d.session_id!=="string" || !d.session_id || typeof d.device_id!=="string" || !d.device_id) throw new Error("Firmware incompatível");
  return d;
}

// Static hosting does not provide sensor readings. Never substitute example values.
function enableDemo(){
  state.apiMissing=true;
  state.demoMode=true;
  state.connected=false;
  state.lastValidAt=null;
  setConnectionStatus("semDados","A API do ESP32 não está disponível neste endereço.");
  state.live={liters1:0,liters2:0,flow1_lpm:0,flow2_lpm:0};
  updateLive();
}

async function poll(){
  if(state.apiMissing) return;
  try {
    const d=validateLive(await requestJson("/api/live"));
    const recovered=failures>=3;
    const now=Date.now(),day=keyForDate(new Date(now));
    state.connected=true;
    state.live=d;
    state.lastValidAt=now;
    failures=0;
    setConnectionStatus("online");
    if(recovered) { const n=$("#connectionNoticeText"); if(n)n.textContent="Conexão restabelecida."; }
    addSnapshot(day,d,now);
    updateLive();
    await syncToEsp(d,day);
  } catch(e) {
    state.connected=false;
    failures++;
    setConnectionStatus(failures>=3?"offline":state.lastValidAt?"desatualizados":"carregando",e.name==="AbortError"?"O ESP32 não respondeu a tempo.":navigator.onLine===false?"O navegador está sem conexão.":"Não foi possível consultar o ESP32.");
    if(e.status===404){
      // Static hosts do not expose the ESP32 firmware routes; stop polling permanently.
      enableDemo();
      return;
    }
    if(e.name!=="AbortError") console.warn("HydroCasa: consulta temporariamente indisponível:",e.message);
    updateConnection();
  }
}

async function syncToEsp(d,day){
  try {
    await requestJson("/api/daily",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({date:day,liters1:d.liters1,liters2:d.liters2})});
    state.syncError=false;
  } catch(e) { state.syncError=true; }
  updateConnection();
}

let pollTimer=null,currentPoll=null,resetPending=false,failures=0;
const connectionState={status:"carregando",lastValidAt:null,reason:"",reconnecting:false};
const connectionLabels={carregando:"Conectando à maquete…",online:"Online",desatualizados:"Dados desatualizados",offline:"Offline",semDados:"Sem dados ainda"};
function setConnectionStatus(status,reason=""){connectionState.status=status;connectionState.reason=reason;connectionState.lastValidAt=state.lastValidAt;
  document.body.dataset.connectionState=status;
}

async function runPoll(){
  if(resetPending) return;
  currentPoll=poll();
  try { await currentPoll; }
  finally {
    currentPoll=null;
    if(!resetPending && !state.apiMissing) pollTimer=setTimeout(runPoll,failures?Math.min(30000,2000*Math.pow(2,Math.min(failures-1,4))):2000);
  }
}

function updateConnection(){
  updateHousehold();
  const b=$("#connectionBadge"),hasReading=state.lastValidAt!==null;
  const stale=hasReading && Date.now()-state.lastValidAt>15000;
  const key=state.demoMode?"semDados":state.connected?(stale?"desatualizados":"online"):connectionState.status;
  const label=connectionLabels[key]||"Offline";
  document.body.dataset.connectionState=key;
  b.className="badge "+(key==="online"?"online":"offline");
  b.textContent=(key==="online"?"● ":"◌ ")+label;
  $("#statusText").textContent=label;
  $("#statusDetail").textContent=state.demoMode?"API indisponível neste servidor — sem medições em tempo real"
    :hasReading?(key==="online"?"Última leitura às ":"Última leitura há "+Math.floor((Date.now()-state.lastValidAt)/1000)+"s · às ")+new Date(state.lastValidAt).toLocaleTimeString("pt-BR")
    : connectionState.reason||"Aguardando primeira leitura válida";
  const warnings=[];
  if(state.storageError) warnings.push("Falha ao salvar no navegador");
  if(state.syncError) warnings.push("Falha ao salvar no ESP32");
  const h=state.history[todayKey()];
  $("#todayDelta").textContent=state.demoMode?"Sem conexão com o sensor • Exibição apenas de registros existentes":warnings.length?warnings.join(" • ")
    : h && h.readings?"Coleta parcial do dia":"Aguardando leituras";
  const notice=$("#connectionNotice"),note=$("#connectionNoticeText"),retry=$("#retryConnection"),help=notice?.querySelector("details");
  if(notice&&note&&retry){
    const loading=key==="carregando";
    notice.hidden=key==="online";
    note.textContent=key==="semDados"?"Sem comunicação com o ESP32 neste endereço.":key==="online"?"Conexão restabelecida.":key==="desatualizados"?"Dados desatualizados. Tentando reconectar…":key==="offline"?"Sem conexão com a maquete"+(state.lastValidAt?" desde "+new Date(state.lastValidAt).toLocaleTimeString("pt-BR"):"")+". Verifique energia e Wi-Fi.":"Conectando à maquete…";
    retry.hidden=key==="online"||state.apiMissing;
    retry.disabled=!!currentPoll || !!resetPending;
    if(help&&key==="online")help.open=false;
  }
  const chartMsg=$("#chartLoadingMessage");if(chartMsg)chartMsg.hidden=!!(h&&h.readings);
  const live=$(".live-dot");
  live.textContent=key==="online"?"AO VIVO":key==="carregando"?"CONECTANDO":key==="desatualizados"?"DADOS ANTIGOS":key==="semDados"?"SEM DADOS":"OFFLINE";
  if(key!=="online"){
    $("#alertContent").className="alert-content neutral";
    $("#alertContent").textContent="Análise indisponível: aguardando conexão e leitura válida.";
  }
}

function updateLive(){
  updateConnection();
  const d=state.live;
  const h=state.history[todayKey()]||{total1:0,total2:0};
  const t=(h.total1||0)+(h.total2||0);
  $("#todayTotal").textContent=h.readings?volume(t):"—";
  $("#sensor1Total").textContent=h.readings?volume(h.total1):"—";
  $("#sensor2Total").textContent=h.readings?volume(h.total2):"—";
  $("#split1").textContent=h.readings?volume(h.total1):"—";
  $("#split2").textContent=h.readings?volume(h.total2):"—";
  $("#flow1").textContent=state.lastValidAt!==null?volume(d.flow1_lpm)+"/min":"—";
  $("#flow2").textContent=state.lastValidAt!==null?volume(d.flow2_lpm)+"/min":"—";
  const ratio=t>0&&h.readings?Math.round((h.total1/t)*100):null;
  $("#ratio1").textContent=ratio!==null?ratio+"%":"—";
  $("#donut").dataset.empty=ratio===null?"true":"false";
  $("#donut").style.background=ratio===null?"var(--line)":`conic-gradient(var(--primary) 0 ${ratio}%,var(--primary2) ${ratio}% 100%)`;
  updateChart();
  if(state.connected) updateAlert(t);
  updateAnalysis();
  updateHousehold();
  if($("#calendar").classList.contains("active-panel")) renderCalendar();
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
    const x=state.history[k];vals.push(x&&x.readings?(x.total1+x.total2):null);
  }
  const max=Math.max(10,...vals.filter(v=>v!==null));
  ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue("--line");ctx.lineWidth=1;
  for(let y=1;y<4;y++){ctx.beginPath();ctx.moveTo(0,y*h/4);ctx.lineTo(w,y*h/4);ctx.stroke();}
  ctx.beginPath();
  let previousValid=false;
  vals.forEach((v,i)=>{if(v===null){previousValid=false;return;}const x=i*(w/(vals.length-1)),y=h-28-(v/max)*(h-55);previousValid?ctx.lineTo(x,y):ctx.moveTo(x,y);previousValid=true;});
  ctx.lineWidth=3;ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue("--primary");ctx.stroke();
  vals.forEach((v,i)=>{if(v===null)return;const x=i*(w/(vals.length-1)),y=h-28-(v/max)*(h-55);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle=getComputedStyle(document.body).getPropertyValue("--primary2");ctx.fill()});
  if(typeof window.drawHydroCasaDemoChart==="function")window.drawHydroCasaDemoChart();
}

function updateAlert(){
  const h=state.history[todayKey()];
  const result=M.compareDay(h,state.household,{connected:state.connected});
  const card=$("#alertContent");
  card.className="alert-content "+(result.code==="above"?"warning":"neutral");
  card.textContent=result.label+".";
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
    el.className="day";el.type="button";el.dataset.demoDate=k;
    const today=new Date();today.setHours(0,0,0,0);const dd=new Date(d);dd.setHours(0,0,0,0);
    const h=state.history[k],isFuture=dd>today,isPast=dd<today;
    if(isFuture) el.classList.add("future");
    else if(h && h.readings>0) el.classList.add("has-data");
    else if(isPast) el.classList.add("empty");
    if(dd.getTime()===today.getTime()) el.classList.add("today");
    const count=Array.isArray(state.activityRecords[k])?state.activityRecords[k].length:0;
    if(count)el.classList.add("has-activities");
    const lv=!isFuture?dayLevel(h):null;if(lv&&lv.id)el.dataset.level=lv.id;
    let bottom=isFuture?"":lv?litros(lv.total):"Sem medição";
    el.innerHTML=`<span class="num">${day}</span><span class="day-total">${bottom}</span>${count?`<span class="day-activity-count" aria-hidden="true">✎ ${count}</span>`:""}`;
    el.setAttribute("aria-label",`${day} de ${base.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}: ${isFuture?"ainda não chegou":bottom}${lv&&lv.label?", "+lv.label.toLowerCase():""}${count?`, ${count} atividade(s) registrada(s)`:""}. Abrir resumo do dia.`);
    el.addEventListener("click",()=>openDayModal(d));
    grid.appendChild(el);
  }
}

function activityContext(dayKey,h){
 const records=Array.isArray(state.activityRecords[dayKey])?state.activityRecords[dayKey]:[];
 const justified=records.reduce((sum,r)=>sum+(Number.isFinite(r.liters)&&r.liters>0?r.liters:0),0);
 const actual=h&&h.readings>0?h.total1+h.total2:null;
 const profile=h?M.dayProfile(h,state.household):state.household;
 const reference=profile?profile.residents*profile.referenceLiters:null;
 const referenceResult=h&&profile?M.compareDay(h,profile,{closed:dayKey<todayKey(),connected:dayKey<todayKey()||state.connected}):null;
 return {records,justified,actual,profile,reference,referenceResult,hasJustification:justified>0};
}
function activityContextHtml(dayKey,h){
 const x=activityContext(dayKey,h);
 if(!x.hasJustification)return '<p>Nenhuma atividade justificada registrada para este dia.</p>';
 let status='Não há leitura de sensores para comparar.';
 if(x.actual!==null)status=x.actual<=x.justified?'OK — o volume medido está dentro do volume estimado pelas atividades registradas.':'O volume medido supera a estimativa das atividades registradas.';
 return '<p><b>Volume medido:</b> '+(x.actual===null?'sem leitura':volume(x.actual))+'</p><p><b>Volume estimado pelas atividades:</b> '+volume(x.justified)+'</p><p>'+escapeHtml(status)+'</p><p><b>Comparação independente com a referência diária:</b> '+escapeHtml(x.referenceResult?.label||'Indisponível')+(x.reference!==null?' ('+volume(x.reference)+' para '+x.profile.residents+' morador(es)).':'.')+'</p><p class="muted-note">As atividades contextualizam o volume, mas são estimativas informadas e não substituem a medição nem comprovam a causa do consumo.</p>';
}
/* Situação de um dia em linguagem simples (mesmas faixas do Painel). */
const litros=v=>Number.isFinite(v)?(v>0&&v<10?v.toLocaleString("pt-BR",{maximumFractionDigits:1}):Math.round(v).toLocaleString("pt-BR"))+" L":"—";
function dayLevel(h){
  if(!h||!(h.readings>0)||!Number.isFinite(h.total1)||!Number.isFinite(h.total2))return null;
  const p=M.dayProfile(h,state.household),total=h.total1+h.total2;
  if(!p)return {total,id:null,label:"Sem perfil para comparar",profile:null,expected:null};
  const expected=p.residents*p.referenceLiters,F=window.HydroFinance;
  const lv=F&&expected>0?F.spendingLevel((total/expected-1)*100,p.tolerance):null;
  return {total,id:lv?lv.id:null,label:lv?lv.label:"",profile:p,expected};
}
function openDayModal(d){
 const k=keyForDate(d),h=state.history[k],future=d>new Date(),records=Array.isArray(state.activityRecords[k])?state.activityRecords[k]:[];
 if(future){showModal('<span class="eyebrow">CALENDÁRIO</span><h3>'+escapeHtml(d.toLocaleDateString("pt-BR",{dateStyle:"full"}))+'</h3><p>Este dia ainda não chegou.</p>');return;}
 const lv=dayLevel(h),F=window.HydroFinance,fin=F?F.read(localStorage):null,isToday=k===todayKey();
 const cost=lv&&fin&&Number.isFinite(fin.pricePerM3)?F.money(lv.total/1000*fin.pricePerM3):null;
 const names=state.household||M.defaults;
 let c='<span class="eyebrow">CALENDÁRIO</span><h3 class="cal-modal-title">'+escapeHtml(d.toLocaleDateString("pt-BR",{dateStyle:"full"}))+'</h3>';
 if(lv){
   c+='<div class="cal-modal-main" data-level="'+(lv.id||"none")+'"><strong>'+litros(lv.total)+'</strong><span>'+escapeHtml(M.m3(lv.total))+(cost?' · '+escapeHtml(cost):'')+'</span></div>';
   if(lv.expected)c+='<p class="cal-modal-status" data-level="'+(lv.id||"none")+'"><b>'+escapeHtml(isToday&&lv.id==="normal"&&lv.total<=lv.expected?"Até agora, dentro do esperado":lv.label)+'</b> Esperado: até '+litros(lv.expected)+' para '+lv.profile.residents+' morador'+(lv.profile.residents>1?'es':'')+'.'+(lv.profile.scope==="whole"?'':' Comparação ilustrativa.')+'</p>';
   c+='<ul class="cal-modal-points"><li><i class="dot d1"></i>'+escapeHtml(names.ramal1)+'<b>'+litros(h.total1)+'</b></li><li><i class="dot d2"></i>'+escapeHtml(names.ramal2)+'<b>'+litros(h.total2)+'</b></li></ul>';
   if(isToday)c+='<p class="muted-note">O dia ainda está em andamento.</p>';else if(h.partial!==false)c+='<p class="muted-note">Algumas leituras deste dia faltaram (painel fechado ou ESP32 sem conexão), então o total pode estar abaixo do real.</p>';
 }else c+='<p>Não há medições neste dia.</p>';
 const explained=records.reduce((s,r)=>s+(Number.isFinite(r.liters)&&r.liters>0?r.liters:0),0);
 c+='<h4 class="cal-modal-sub">O que foi registrado</h4>';
 c+=records.length?'<ul class="cal-modal-acts">'+records.map(r=>'<li>'+escapeHtml(r.name)+'<b>'+litros(r.liters)+'</b></li>').join('')+'</ul>'+(lv&&lv.total>0?'<p class="muted-note">As atividades explicam '+Math.min(100,Math.round(explained/lv.total*100))+'% da água medida.</p>':''):'<p class="muted-note">Nada registrado. Se algo diferente aconteceu, conte em “Justificar consumo”.</p>';
 c+='<div class="cal-modal-actions"><button type="button" class="primary-btn" id="calendarAddToggle">Justificar consumo deste dia</button></div>';
 showModal(c);
 $("#calendarAddToggle").onclick=()=>{closeModal();if(window.HydroAtividades)window.HydroAtividades.open(k);};
}

function updateAnalysis(){
  const h=state.history[todayKey()]||{total1:0,total2:0},raw=h.total1+h.total2;
  const records=Array.isArray(state.activityRecords[todayKey()])?state.activityRecords[todayKey()]:[];
  const j=records.reduce((a,x)=>a+(Number.isFinite(x.liters)?x.liters:0),0);
  $("#rawAnalysis").textContent=h.readings?volume(raw):"—";
  $("#justifiedValue").textContent=records.length?volume(j):"—";
  $("#contextualValue").textContent=h.readings&&h.profile&&!h.profileMixed?volume(raw/h.profile.residents):"—";
  const max=Math.max(1,h.total1,h.total2),p=state.household||M.defaults;
  $("#analysisBars").innerHTML=[1,2].map(i=>`<div class="bar-row"><div class="bar-label"><span>${escapeHtml(p["ramal"+i])}</span><b>${h.readings?volume(h["total"+i]):"—"}</b></div><div class="bar-track"><div class="bar-fill" style="width:${h["total"+i]/max*100}%"></div></div></div>`).join("");
}

function sourceHtml(id){
  const r=M.sources[id];
  return `<b>Fonte: ${escapeHtml(r.name)}</b> — ${r.url?`<a href="${r.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)}</a>`:escapeHtml(r.title)}<br><small>${escapeHtml(r.date)}${r.accessed?" · Consultado em "+r.accessed:""}.</small>`;
}

function activitySourceHtml(a){
  return `${sourceHtml(a.source)}<details><summary>Fonte e cálculo</summary><p>${escapeHtml(a.conditions)}</p><p>Referência publicada: ${a.liters===null?"nenhuma; informe uma hipótese própria":volume(a.liters)+" ("+fmt(a.liters)+" L)"}${a.minutes?" em "+a.minutes+" min":" por ocorrência"}.</p><p>${a.minutes?"Estimativa proporcional: volume publicado × duração informada ÷ duração de referência. Pressupõe vazão constante; não é uma nova medição. ":""}${a.perPerson?"Multiplicamos pelas ocorrências por morador e pela quantidade de moradores.":"Multiplicamos apenas pelas ocorrências da casa, sem multiplicar novamente pelos moradores."}</p><p>${escapeHtml(M.sources[a.source].note)}</p></details>`;
}

function updateHousehold(){
  const p=state.household,h=state.history[todayKey()],total=h?h.total1+h.total2:0;
  $("#householdTarget").textContent=p?volume(p.residents*p.referenceLiters):"—";
  $("#targetDetail").textContent=p?`${p.residents} × ${volume(p.referenceLiters)}/pessoa/dia; faixa ±${fmt(p.tolerance)}%.`:"Configure os moradores.";
  $("#perPersonValue").textContent=h&&h.readings&&h.profile&&!h.profileMixed?volume(total/h.profile.residents):"—";
  const result=M.compareDay(h,p,{connected:state.connected});
  const context=activityContext(todayKey(),h);
  const hasActual=!!(h&&h.readings>0&&Number.isFinite(total));
  const contextualOk=hasActual&&context.hasJustification&&total<=context.justified;
  $("#comparisonStatus").textContent=contextualOk?"Dentro do volume justificado":hasActual&&context.hasJustification&&total>context.justified?"Acima do volume justificado":result.label;
  $("#comparisonStatus").className=contextualOk?"comparison-context-ok":result.code==="above"?"comparison-above":"";
  $("#comparisonDetail").textContent=(context.hasJustification?"Atividades estimadas: "+volume(context.justified)+". ":"")+(result.percent!==undefined?`${fmt(Math.abs(result.percent))}% ${result.percent<0?"abaixo":"acima"} da referência central.`:result.label+".")+" Volume observado, sem projeção do restante do dia.";
  const contextDetails=$("#comparisonActivityDetails div");
  if(contextDetails)contextDetails.innerHTML=activityContextHtml(todayKey(),h);
  const names=p||M.defaults;
  $$('[data-ramal]').forEach(el=>el.textContent=names['ramal'+el.dataset.ramal]);
  const source=p?p.referenceMode:$("#referenceMode").value;
  $("#householdSource").innerHTML=sourceHtml(source)+`<details><summary>Fonte e cálculo da referência diária</summary><p>${escapeHtml(M.sources[source].note)}</p><p>Referência da casa = moradores × referência por pessoa/dia. A faixa de ±${p?fmt(p.tolerance):"10"}% é uma convenção ajustável do HydroCasa, não uma norma da fonte. A referência geral já inclui os usos; não somamos atividades a ela.</p></details>`;
}

function fillProfileForm(){
  const p=state.household||M.defaults;
  $("#residentsInput").value=p.residents||"";
  $("#referenceMode").value=p.referenceMode;
  $("#referenceM3").value=p.referenceLiters/1000;
  $("#referenceM3").disabled=p.referenceMode==="snis";
  $("#toleranceInput").value=p.tolerance;
  $("#scopeInput").value=p.scope;
  $("#ramal1Input").value=p.ramal1;$("#ramal2Input").value=p.ramal2;
}

function applyProfile(next,now=Date.now()){
  const p=M.profile(next),k=keyForDate(new Date(now)),h=ensureDay(k);
  const keys=["residents","referenceMode","referenceLiters","tolerance","scope"];
  const changed=!state.household||keys.some(key=>state.household[key]!==p[key]);
  if(changed){
    // Preserve the measured volume, but evaluate it using the newly applied household profile immediately.
    h.profile=M.clone(p);
    h.profileMixed=false;
    if(!Array.isArray(h.profileChanges))h.profileChanges=[];
    h.profileChanges.push({at:now,profile:M.clone(p)});
  }
  state.household=p;save();
  return p;
}

// O assistente de justificativa fica em atividades.js; estas funções mantêm os pontos de chamada.
function selectActivity(){window.HydroAtividades?.refresh();}
function renderActivityLog(){window.HydroAtividades?.refresh();}

// Check vetorial inteiro: entrada suave de opacidade e escala ao confirmar o salvamento.
// Recriar os elementos reinicia a animação a cada confirmação, sem temporizadores.
function profileFeedback(message, saved=false, error=false){
  const el=$("#profileMessage");
  el.className=error?"form-error":saved?"profile-feedback saved":"profile-feedback";
  el.textContent="";
  if(saved){
    const icon=document.createElement("span");
    icon.className="profile-success-icon";
    icon.setAttribute("aria-hidden","true");
    const check='<svg viewBox="0 0 32 32" focusable="false"><path d="M8 16.5l5.2 5.2L24 10.8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    icon.innerHTML=check;
    el.appendChild(icon);
  }
  const text=document.createElement("span");
  text.textContent=message;
  el.appendChild(text);
}
function profilePending(){
  profileFeedback("Alterações pendentes. Clique em Aplicar perfil para salvar.");
}

// Mensagens de validação junto ao campo, mantendo a validação nativa do navegador.
function setupFieldFeedback(form){
  form.addEventListener("invalid",event=>{
    const field=event.target;
    if(!field.id)return;
    const details=field.closest("details");if(details)details.open=true;
    const id=field.id+"-error";
    let note=document.getElementById(id);
    if(!note){
      note=document.createElement("small");note.id=id;note.className="field-error";
      (field.closest(".stepper")||field).insertAdjacentElement("afterend",note);
    }
    note.textContent="Atenção: "+field.validationMessage;
    field.setAttribute("aria-invalid","true");
    const ids=new Set((field.getAttribute("aria-describedby")||"").split(" ").filter(Boolean));
    ids.add(id);field.setAttribute("aria-describedby",[...ids].join(" "));
  },true);
  form.addEventListener("input",event=>{
    const field=event.target,id=field.id+"-error",note=document.getElementById(id);
    if(note){note.remove();field.removeAttribute("aria-invalid");
      const ids=(field.getAttribute("aria-describedby")||"").split(" ").filter(x=>x!==id);
      if(ids.length)field.setAttribute("aria-describedby",ids.join(" "));else field.removeAttribute("aria-describedby");
    }
  });
}
function setupConsumptionUI(){
  setupFieldFeedback($("#householdForm"));
  fillProfileForm();
  $("#householdForm").addEventListener("input",profilePending);
  $("#householdForm").addEventListener("change",profilePending);
  $("#householdForm").onsubmit=e=>{
    e.preventDefault();
    try {
      applyProfile({residents:Number($("#residentsInput").value),referenceMode:$("#referenceMode").value,referenceLiters:Number($("#referenceM3").value)*1000,tolerance:Number($("#toleranceInput").value),scope:$("#scopeInput").value,ramal1:$("#ramal1Input").value,ramal2:$("#ramal2Input").value});
      profileFeedback(state.storageError?"Perfil aplicado nesta sessão, mas não foi possível salvar no navegador.":"Perfil salvo.", !state.storageError, state.storageError);
      const notice=$("#profileDayNotice"),day=state.history[todayKey()];
      notice.hidden=!(day&&day.profileMixed);
      notice.textContent=notice.hidden?"":"Atenção: o perfil mudou durante a coleta. A comparação deste dia fica indisponível; os volumes registrados são preservados.";
      updateLive();selectActivity();
    }catch(err){profileFeedback(err.message,false,true);}
  };
  for(const [id,delta] of [["residentsMinus",-1],["residentsPlus",1]])$("#"+id).onclick=()=>{const el=$("#residentsInput");el.value=Math.max(1,Math.min(100,(Number(el.value)||0)+delta));profilePending();};
  $("#referenceMode").onchange=()=>{$("#referenceM3").disabled=$("#referenceMode").value==="snis";if($("#referenceM3").disabled)$("#referenceM3").value=.1521;profilePending();};
  $("#methodologyContent").textContent="Consulte a página Fontes e estudos para referências, métodos e documentação.";
  $("#sourcesPageContent").innerHTML=`<h2>Metodologia e referências</h2><p>1 m³ = 1.000 L. As estimativas não substituem medições dos sensores nem são subtraídas do volume real.</p><p>A média SNIS é histórica, não um limite individual. A margem de comparação é configurável no perfil.</p>`+Object.keys(M.sources).map(id=>`<div class="source-inline"><p>${sourceHtml(id)}</p><p>${escapeHtml(M.sources[id].note)}</p></div>`).join("")+`<h3>Exemplos por atividade</h3>`+M.activities.map(item=>`<div class="source-inline"><b>${escapeHtml(item.name)}</b><p>${escapeHtml(item.conditions)}</p><p>${sourceHtml(item.source)}</p></div>`).join("");

  selectActivity();renderActivityLog();updateHousehold();
}

function showModal(html){$("#modalBody").innerHTML=html;$("#modal").classList.add("open");$("#modal").setAttribute("aria-hidden","false")}
function closeModal(){$("#modal").classList.remove("open");$("#modal").setAttribute("aria-hidden","true")}
$("#closeModal").onclick=closeModal;$(".modal-backdrop").onclick=closeModal;

function openJustification(){
  if(window.HydroAtividades)window.HydroAtividades.open();
  else $('.tab[data-panel="activities"]').click();
}

for(const id of ["openJustify","openJustify2"]){const b=document.getElementById(id);if(b)b.onclick=openJustification;}
$("#openLegend").onclick=()=>showModal(`<span class="eyebrow">GUIA RÁPIDO</span><h3>Como o HydroCasa funciona</h3><p>Os sensores Hall geram pulsos conforme a água passa. O ESP32 converte pulsos em litros usando o fator de calibração. O LittleFS entrega este painel HTML/CSS/JS diretamente pelo ESP32.</p><p>O navegador usa a data e a hora do computador para organizar o calendário. Os snapshots são enviados ao ESP32 e também ficam no armazenamento local do navegador para a apresentação.</p><p><b>Importante:</b> o fator de 450 pulsos/L é apenas uma referência para sensores YF-S201. Faça uma calibração física para obter uma leitura defensável na apresentação.</p>`);

$$(".tab").forEach(b=>b.onclick=()=>{$$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".panel").forEach(p=>p.classList.remove("active-panel"));$("#"+b.dataset.panel).classList.add("active-panel");if(b.dataset.panel==="calendar")renderCalendar();if(b.dataset.panel==="analysis")updateAnalysis();if(b.dataset.panel==="activities"){selectActivity();renderActivityLog()}});
$("#prevMonth").onclick=()=>{state.monthOffset--;renderCalendar()};$("#nextMonth").onclick=()=>{state.monthOffset++;renderCalendar()};

$("#themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("hydrocasa_theme",document.body.classList.contains("dark")?"dark":"light");updateChart()};
try { if(localStorage.getItem("hydrocasa_theme")==="dark")document.body.classList.add("dark"); } catch(e) {}

// Remote reset is deliberately unavailable to public clients.
// Firmware must require server-side authorization before this action can be reintroduced.

function clock(){
  const d=new Date();$("#clock").textContent=d.toLocaleTimeString("pt-BR");$("#dateLabel").textContent=d.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
}
setInterval(clock,1000);clock();
// Ponte explícita para os módulos de interface (atividades.js, inicio.js).
window.HydroApp={state,save,todayKey,keyForDate,volume,escapeHtml,
  refresh(){renderCalendar();updateAnalysis();updateHousehold();if(typeof window.HydroInicio?.refresh==="function")window.HydroInicio.refresh();}};
setupConsumptionUI();ensureToday();renderCalendar();updateLive();
if(location.hostname.endsWith(".vercel.app")) enableDemo();
else runPoll();
window.addEventListener("resize",updateChart);
$("#retryConnection").addEventListener("click",()=>{
 if(state.apiMissing || currentPoll || resetPending)return;
 clearTimeout(pollTimer);runPoll();
});
window.addEventListener("online",()=>{if(!state.apiMissing && !currentPoll){clearTimeout(pollTimer);runPoll();}});
window.addEventListener("offline",()=>{connectionState.reason="O navegador está sem internet.";updateConnection();});
setInterval(()=>{if(!document.hidden)updateConnection();},1000);
