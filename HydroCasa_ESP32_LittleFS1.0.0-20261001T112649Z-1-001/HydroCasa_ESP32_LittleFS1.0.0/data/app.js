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
  const h=ensureDay(k),previous=state.cursor;
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
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
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

async function poll(){
  try {
    const d=validateLive(await requestJson("/api/live"));
    const now=Date.now(),day=keyForDate(new Date(now));
    state.connected=true;
    state.live=d;
    state.lastValidAt=now;
    addSnapshot(day,d,now);
    updateLive();
    await syncToEsp(d,day);
  } catch(e) {
    state.connected=false;
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

let pollTimer=null,currentPoll=null,resetPending=false;
async function runPoll(){
  if(resetPending) return;
  currentPoll=poll();
  try { await currentPoll; }
  finally {
    currentPoll=null;
    if(!resetPending) pollTimer=setTimeout(runPoll,2000);
  }
}

function updateConnection(){
  updateHousehold();
  const b=$("#connectionBadge"),hasReading=state.lastValidAt!==null;
  b.className="badge "+(state.connected?"online":"offline");
  b.textContent=state.connected?"● Online":"● Offline";
  $("#statusText").textContent=state.connected?"Monitorando":"Sem conexão";
  $("#statusDetail").textContent=hasReading
    ? (state.connected?"Última leitura: ":"Dados desatualizados desde ")+new Date(state.lastValidAt).toLocaleTimeString("pt-BR")
    : "Aguardando primeira leitura válida";
  const warnings=[];
  if(state.storageError) warnings.push("Falha ao salvar no navegador");
  if(state.syncError) warnings.push("Falha ao salvar no ESP32");
  const h=state.history[todayKey()];
  $("#todayDelta").textContent=warnings.length?warnings.join(" • ")
    : h && h.readings?"Coleta parcial do dia":"Aguardando leituras";
  const live=$(".live-dot");
  live.textContent=state.connected?"AO VIVO":"SEM CONEXÃO";
  if(!state.connected){
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
  const ratio=t?Math.round((h.total1/t)*100):50;
  $("#ratio1").textContent=t?ratio+"%":"—";
  $("#donut").style.background=!t?"var(--line)":`conic-gradient(var(--primary) 0 ${ratio}%,var(--primary2) ${ratio}% 100%)`;
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
}

function updateAlert(){
  const h=state.history[todayKey()];
  const result=M.compareDay(h,state.household,{connected:state.connected});
  const card=$("#alertContent");
  card.className="alert-content "+(result.code==="above"?"warning":"neutral");
  card.textContent=result.label+". Consulte o perfil e a metodologia; esta comparação não confirma desperdício ou vazamento.";
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
    let bottom=isFuture?"Aguardando coleta":h&&h.readings>0?volume(h.total1+h.total2)+(h.partial?" • parcial":""):"Sem informação";
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
  const historical=M.compareDay(h,null,{closed:k<todayKey()});
  showModal(`<span class="eyebrow">RELATÓRIO DIÁRIO</span><h3>${d.toLocaleDateString("pt-BR",{dateStyle:"full"})}</h3>
    <div class="analysis-grid" style="grid-template-columns:1fr 1fr;margin-top:18px">
      <div class="glass-card"><span>${escapeHtml((h.profile||M.defaults).ramal1)}</span><strong>${volume(h.total1)}</strong><small>${r}% do total</small></div>
      <div class="glass-card"><span>${escapeHtml((h.profile||M.defaults).ramal2)}</span><strong>${volume(h.total2)}</strong><small>${total?100-r:0}% do total</small></div>
    </div><p><b>Total: ${volume(total)}.</b> ${h.partial?"Coleta parcial: pode haver consumo não registrado neste dia.":"Consumo registrado neste dia."}</p><p>${escapeHtml(historical.label)}</p><p>${h.profile?escapeHtml(h.profile.residents)+" morador(es) no perfil registrado; referência diária "+volume(h.profile.residents*h.profile.referenceLiters):"Sem perfil de moradores registrado para este dia."}</p>`);
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
  $("#comparisonStatus").textContent=result.label;
  $("#comparisonStatus").className=result.code==="above"?"comparison-above":"";
  $("#comparisonDetail").textContent=result.percent!==undefined?`${fmt(Math.abs(result.percent))}% ${result.percent<0?"abaixo":"acima"} da referência central. Volume observado, sem projeção do restante do dia.`:"Sem conclusão de economia em dias parciais ou ramais que não cobrem toda a casa.";
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
    if(h.readings) h.profileMixed=true;
    else h.profile=M.clone(p);
    if(!Array.isArray(h.profileChanges))h.profileChanges=[];
    h.profileChanges.push({at:now,profile:M.clone(p)});
  }
  state.household=p;save();
  return p;
}

function activityInput(){
  const a=M.activities.find(x=>x.id===$("#activitySelect").value);
  const params={residents:state.household&&state.household.residents,quantity:Number($("#activityQuantity").value),minutes:Number($("#activityMinutes").value),customLiters:$("#customActivityM3").value===""?NaN:Number($("#customActivityM3").value)*1000};
  const liters=M.estimate(a.id,params),raw=$("#activityObservedM3").value;
  const observed=raw===""?null:Number(raw)*1000;
  if(observed!==null&&(!Number.isFinite(observed)||observed<0||observed>1000000))throw new Error("Volume observado inválido.");
  return {a,params,liters,observed};
}

function updateActivityPreview(){
  const el=$("#activityPreview");
  try {
    const {a,params,liters,observed}=activityInput();
    const tolerance=state.household?state.household.tolerance:10;
    const result=observed===null?null:M.classify(observed,liters,tolerance,{complete:true});
    el.textContent=`Estimativa: ${volume(liters)}. ${params.quantity} ocorrência(s)${a.perPerson?" por morador × "+params.residents+" moradores":" da casa"}${a.minutes?" × "+params.minutes+" min por ocorrência":""}.`+(result?` ${result.label} (volume informado manualmente: ${volume(observed)}; faixa ±${fmt(tolerance)}%).`:" Informe o volume total observado após concluir todas essas ocorrências para comparar.");
    el.classList.remove("form-error");
  } catch(e) {el.textContent=e.message;el.classList.add("form-error");}
}

function selectActivity(){
  const a=M.activities.find(x=>x.id===$("#activitySelect").value);
  $("#quantityLabel").textContent=a.perPerson?"Ocorrências por morador":"Ocorrências da casa";
  $("#minutesLabel").hidden=!a.minutes;
  $("#activityMinutes").required=!!a.minutes;
  $("#activityMinutes").disabled=!a.minutes;
  if(a.minutes)$("#activityMinutes").value=a.minutes;
  $("#customActivityLabel").hidden=a.liters!==null;
  $("#customActivityM3").required=a.liters===null;
  $("#customActivityM3").disabled=a.liters!==null;
  $("#activitySource").innerHTML=activitySourceHtml(a);
  updateActivityPreview();
}

function renderActivityLog(){
  const records=Array.isArray(state.activityRecords[todayKey()])?state.activityRecords[todayKey()]:[];
  const legacy=Array.isArray(state.justifications[todayKey()])?state.justifications[todayKey()]:[];
  $("#activityLog").innerHTML=(records.length?records.map((r,i)=>`<div class="activity-entry"><b>${escapeHtml(r.name)}</b><br>Estimativa: ${volume(r.liters)}. ${r.observed===null?"Sem volume observado informado.":"Volume informado manualmente: "+volume(r.observed)+". "+escapeHtml(r.comparison.label)+"."}<br><small>${r.residentsUsed?escapeHtml(r.residentsUsed)+" morador(es); ":""}${escapeHtml(r.quantity)} ocorrência(s)${r.minutes?"; "+escapeHtml(r.minutes)+" min":""}. Fonte: ${escapeHtml(r.sourceName)}.</small><br><button class="ghost-btn" type="button" data-remove-activity="${i}">Remover registro</button></div>`).join(""):"<p>Nenhuma atividade registrada hoje.</p>")+(legacy.length?`<details><summary>Registros anteriores à atualização (${legacy.length})</summary><p>Preservados como estimativas antigas, sem fonte validada. Não entram na nova comparação.</p>${legacy.map(x=>`<p>${escapeHtml(x.name)}: ${volume(x.liters)}</p>`).join("")}</details>`:"");
  $$('[data-remove-activity]').forEach(b=>b.onclick=()=>{records.splice(Number(b.dataset.removeActivity),1);save();renderActivityLog();updateAnalysis();});
}

function setupConsumptionUI(){
  fillProfileForm();
  $("#householdForm").onsubmit=e=>{
    e.preventDefault();
    try {
      applyProfile({residents:Number($("#residentsInput").value),referenceMode:$("#referenceMode").value,referenceLiters:Number($("#referenceM3").value)*1000,tolerance:Number($("#toleranceInput").value),scope:$("#scopeInput").value,ramal1:$("#ramal1Input").value,ramal2:$("#ramal2Input").value});
      $("#profileMessage").textContent=state.storageError?"Perfil aplicado nesta sessão, mas não foi possível salvar no navegador.":"Perfil salvo. Dias anteriores preservados; mudanças durante a coleta impedem uma classificação única do dia.";
      $("#profileMessage").className=state.storageError?"form-error":"";
      updateLive();selectActivity();
    }catch(err){$("#profileMessage").textContent=err.message;$("#profileMessage").className="form-error";}
  };
  for(const [id,delta] of [["residentsMinus",-1],["residentsPlus",1]])$("#"+id).onclick=()=>{const el=$("#residentsInput");el.value=Math.max(1,Math.min(100,(Number(el.value)||0)+delta));};
  $("#referenceMode").onchange=()=>{$("#referenceM3").disabled=$("#referenceMode").value==="snis";if($("#referenceM3").disabled)$("#referenceM3").value=.1521;$("#profileMessage").textContent="Clique em Aplicar perfil para salvar esta alteração.";};
  $("#activitySelect").innerHTML=M.activities.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
  $("#activitySelect").onchange=()=>{$("#activityObservedM3").value="";selectActivity();};
  for(const id of ["activityQuantity","activityMinutes","customActivityM3","activityObservedM3"])$("#"+id).oninput=updateActivityPreview;
  $("#activityForm").onsubmit=e=>{
    e.preventDefault();
    try {
      const {a,params,liters,observed}=activityInput(),k=todayKey(),tolerance=state.household?state.household.tolerance:10;
      if(!Array.isArray(state.activityRecords[k]))state.activityRecords[k]=[];
      state.activityRecords[k].push({name:a.name,id:a.id,liters,observed,quantity:params.quantity,minutes:a.minutes?params.minutes:null,residentsUsed:a.perPerson?params.residents:null,sourceName:M.sources[a.source].name,sourceId:a.source,referenceVersion:"2026-10-13",tolerance,comparison:observed===null?null:M.classify(observed,liters,tolerance,{complete:true}),at:Date.now()});
      save();renderActivityLog();updateAnalysis();
      $("#activityMessage").textContent=state.storageError?"Registro mantido nesta sessão; falha ao salvar no navegador.":"Atividade registrada. O volume dos sensores não foi alterado.";
    }catch(err){$("#activityMessage").textContent=err.message;}
  };
  $("#activityCatalog").innerHTML=M.activities.map(a=>`<article class="glass-card"><h3>${escapeHtml(a.name)}</h3><p class="reference-value">${a.liters===null?"Referência manual":volume(a.liters)}</p>${activitySourceHtml(a)}</article>`).join("");
  $("#methodologyContent").innerHTML=`<p>1 m³ = 1.000 L. Vazão é exibida em m³/min. A precisão exibida não substitui a calibração dos sensores.</p><p>A divisão por moradores é uma média do volume monitorado, sem identificar quem usou a água. Os dois sensores não distinguem atividades automaticamente. Não some ramais em série, pois isso conta a mesma água duas vezes.</p><p>Referências de atividades e referência residencial são comparações alternativas: não são somadas entre si. Estimativas não são subtraídas das medições.</p><p>A faixa inicial de ±10% é uma regra ajustável do projeto, sem caráter normativo. Dias parciais não recebem classificação final abaixo/dentro; a ultrapassagem observada pode ser sinalizada. O histórico atual ainda depende do navegador.</p>${Object.keys(M.sources).map(id=>`<div class="source-inline">${sourceHtml(id)}<p>${escapeHtml(M.sources[id].note)}</p></div>`).join("")}`;
  selectActivity();renderActivityLog();updateHousehold();
}

function showModal(html){$("#modalBody").innerHTML=html;$("#modal").classList.add("open");$("#modal").setAttribute("aria-hidden","false")}
function closeModal(){$("#modal").classList.remove("open");$("#modal").setAttribute("aria-hidden","true")}
$("#closeModal").onclick=closeModal;$(".modal-backdrop").onclick=closeModal;

function openJustification(){
  $('.tab[data-panel="activities"]').click();
  $("#activitySelect").focus();
}

$("#openJustify").onclick=openJustification;$("#openJustify2").onclick=openJustification;
$("#openLegend").onclick=()=>showModal(`<span class="eyebrow">GUIA RÁPIDO</span><h3>Como o HydroCasa funciona</h3><p>Os sensores Hall geram pulsos conforme a água passa. O ESP32 converte pulsos em litros usando o fator de calibração. O LittleFS entrega este painel HTML/CSS/JS diretamente pelo ESP32.</p><p>O navegador usa a data e a hora do computador para organizar o calendário. Os snapshots são enviados ao ESP32 e também ficam no armazenamento local do navegador para a apresentação.</p><p><b>Importante:</b> o fator de 450 pulsos/L é apenas uma referência para sensores YF-S201. Faça uma calibração física para obter uma leitura defensável na apresentação.</p>`);

$$(".tab").forEach(b=>b.onclick=()=>{$$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".panel").forEach(p=>p.classList.remove("active-panel"));$("#"+b.dataset.panel).classList.add("active-panel");if(b.dataset.panel==="calendar")renderCalendar();if(b.dataset.panel==="analysis")updateAnalysis();if(b.dataset.panel==="activities"){selectActivity();renderActivityLog()}});
$("#prevMonth").onclick=()=>{state.monthOffset--;renderCalendar()};$("#nextMonth").onclick=()=>{state.monthOffset++;renderCalendar()};

$("#themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("hydrocasa_theme",document.body.classList.contains("dark")?"dark":"light");updateChart()};
try { if(localStorage.getItem("hydrocasa_theme")==="dark")document.body.classList.add("dark"); } catch(e) {}

$("#resetBtn").onclick=async()=>{
  if(resetPending || !confirm("Zerar os contadores do ESP32? O consumo já registrado será preservado.")) return;
  resetPending=true;
  clearTimeout(pollTimer);
  $("#resetBtn").disabled=true;
  try {
    // Finish the in-flight reading before resetting, avoiding out-of-order snapshots.
    if(currentPoll) await currentPoll;
    await requestJson("/api/reset",{method:"POST"});
    state.connected=false;
    updateConnection();
    alert("Contadores zerados. Aguardando nova leitura; histórico preservado.");
  } catch(e) {
    alert("Não foi possível confirmar o reset. Verifique a conexão antes de tentar novamente.");
  } finally {
    resetPending=false;
    $("#resetBtn").disabled=false;
    pollTimer=setTimeout(runPoll,0);
  }
};

function clock(){
  const d=new Date();$("#clock").textContent=d.toLocaleTimeString("pt-BR");$("#dateLabel").textContent=d.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
}
setInterval(clock,1000);clock();
setupConsumptionUI();ensureToday();renderCalendar();updateLive();
runPoll();
window.addEventListener("resize",updateChart);
