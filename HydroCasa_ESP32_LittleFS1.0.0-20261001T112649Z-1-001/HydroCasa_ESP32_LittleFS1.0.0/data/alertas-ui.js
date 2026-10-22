/* Camada de apresentação de alertas. NUNCA grava ledger, snapshot, perfil ou endpoints. */
(()=>{
'use strict';
const q=s=>document.querySelector(s),key='hydrocasa:alertas',demoKey='hydrocasa:alertas:demonstracao',removedKey='hydrocasa:alertas:removidos',demoRemovedKey='hydrocasa:alertas:demonstracao:removidos';
const fmtDate=t=>new Date(t).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const levels={'Informativo':'ℹ','Atenção':'⚠','Acima do padrão':'▲','Leve':'●','Moderado':'▲','Crítico':'⬆'};
const guidance={sensor:['O sensor pode ter parado de enviar leituras.','Verifique energia, cabo e conexão do ESP32.'],atividade:['Uma atividade registrada ultrapassou a referência configurada.','Confira duração e quantidade informadas no registro.'],consumo:['O volume registrado está acima da referência configurada.','Confira o perfil da residência e os hábitos do período.'],fluxo:['Foi detectado um comportamento de fluxo que merece verificação.','Verifique torneiras, chuveiros e possíveis vazamentos.']};
const why=a=>guidance[a.tipo]||['Uma condição do monitoramento merece sua atenção.','Confira as leituras, as conexões e as configurações do painel.'];
let history=[],demoHistory=[],observations=[],lastCursor='',focusBefore=null,dialogOpen=false,lastOnline=false;
const safeRead=(storage,k)=>{try{let v=JSON.parse(storage.getItem(k)||'[]');return Array.isArray(v)?v.filter(x=>x&&typeof x.id==='string').slice(0,250):[]}catch{return []}};
history=safeRead(localStorage,key);demoHistory=safeRead(sessionStorage,demoKey);
const readRemoved=(storage,k)=>{try{const v=JSON.parse(storage.getItem(k)||'[]');return new Set(Array.isArray(v)?v.filter(x=>typeof x==='string').slice(-2000):[])}catch{return new Set()}};
const removedReal=readRemoved(localStorage,removedKey),removedDemo=readRemoved(sessionStorage,demoRemovedKey);
const removedSet=demo=>demo?removedDemo:removedReal;
// A exclusão bloqueia apenas a mesma versão do alerta. Se o valor/referência mudar,
// uma nova ocorrência pode ser mostrada normalmente.
const alertSignature=a=>String(a.id)+'|'+String(a.valor??'')+'|'+String(a.referencia??'')+'|'+String(a.mensagem??'');
const isRemoved=(demo,a)=>removedSet(demo).has(alertSignature(a));
const persistRemoved=demo=>{try{(demo?sessionStorage:localStorage).setItem(demo?demoRemovedKey:removedKey,JSON.stringify([...removedSet(demo)].slice(-2000)))}catch{}};
// Carrega separadamente as exclusões: elas não podem desaparecer quando o histórico atingir seu limite.
try{const v=JSON.parse(localStorage.getItem(removedKey)||'[]');if(Array.isArray(v))v.filter(x=>typeof x==='string').slice(-2000).forEach(x=>removedReal.add(x))}catch{}
try{const v=JSON.parse(sessionStorage.getItem(demoRemovedKey)||'[]');if(Array.isArray(v))v.filter(x=>typeof x==='string').slice(-2000).forEach(x=>removedDemo.add(x))}catch{}
const persist=demo=>{try{(demo?sessionStorage:localStorage).setItem(demo?demoKey:key,JSON.stringify((demo?demoHistory:history).slice(0,250)))}catch{}};
const bell=document.createElement('button');bell.id='hydroAlertBell';bell.type='button';bell.className='icon-btn alert-bell';bell.setAttribute('aria-haspopup','dialog');bell.setAttribute('aria-label','Abrir alertas');bell.innerHTML='<span class="hydro-header-icon hydro-header-icon-alert" aria-hidden="true"></span><span id="hydroAlertCount" class="alert-count" hidden>0</span>';
q('.header-actions')?.insertBefore(bell,q('#themeBtn'));
const card=document.createElement('section');card.className='glass-card alerts-overview';card.id='alertsOverview';card.setAttribute('aria-labelledby','alertsOverviewTitle');
card.innerHTML='<div class="alerts-heading"><div><span class="alerts-kicker">ACOMPANHAMENTO</span><h3 id="alertsOverviewTitle">Alertas e orientações</h3><p class="alerts-subtitle">Ocorrências ordenadas por prioridade, sem precisar abrir outra janela.</p></div><button type="button" class="ghost-btn" data-open-alerts>Histórico de alertas</button></div><div id="alertsTopList" class="alerts-inline-list" role="region" aria-label="Alertas atuais">Dados insuficientes para comparar.</div>';
const quickAccess=q('#dashboard-page .dashboard-shortcuts-area');
if(quickAccess)quickAccess.after(card);
else {const dashboard=q('#dashboard .section-heading');if(dashboard)dashboard.after(card);}
card.setAttribute('aria-label','Situação e avisos do monitoramento');
/* Expansao progressiva somente na versao desktop, sem alterar os alertas. */
let alertPreviewVisible=3;
const alertExpandButton=document.createElement('button');
alertExpandButton.type='button';
alertExpandButton.className='ghost-btn alerts-expand-button';
alertExpandButton.setAttribute('aria-controls','alertsTopList');
card.querySelector('#alertsTopList').after(alertExpandButton);
function updateAlertPreviewLimit(){
 const items=[...card.querySelectorAll('#alertsTopList .alerts-inline-item')];
 const desktop=window.innerWidth>700;
 items.forEach((item,i)=>{item.hidden=desktop&&i>=alertPreviewVisible;});
 const left=Math.max(0,items.length-alertPreviewVisible);
 alertExpandButton.hidden=!desktop||left===0;
 alertExpandButton.textContent='Mostrar mais ('+Math.min(3,left)+') ↓';
 alertExpandButton.setAttribute('aria-label','Exibir mais '+Math.min(3,left)+' alertas');
}
alertExpandButton.addEventListener('click',()=>{alertPreviewVisible+=3;updateAlertPreviewLimit();});
window.addEventListener('resize',updateAlertPreviewLimit);
const stateLine=document.createElement('p');stateLine.className='alerts-state-line';stateLine.setAttribute('role','status');stateLine.setAttribute('aria-live','polite');card.querySelector('.alerts-heading').after(stateLine);
const filters=document.createElement('form');filters.className='alerts-filters';filters.setAttribute('aria-label','Filtros do histórico de alertas');
filters.innerHTML='<label>De <input type="date" id="alertDateFrom"></label><label>Até <input type="date" id="alertDateTo"></label><label>Gravidade <select id="alertSeverity"><option value="all">Todas</option><option value="Crítico">Críticos</option><option value="Moderado">Moderados</option><option value="Leve">Leves</option><option value="Acima do padrão">Outros acima do padrão</option><option value="Atenção">Atenção</option><option value="Informativo">Informativo</option></select></label><label>Situação <select id="alertState"><option value="all">Todas</option><option value="ativo">Ativos</option><option value="lido">Lidos</option><option value="silenciado">Silenciados</option><option value="resolvido">Resolvidos</option></select></label>';
const backdrop=document.createElement('div');backdrop.className='alerts-backdrop';backdrop.hidden=true;
backdrop.innerHTML='<section class="alerts-drawer" role="dialog" aria-modal="true" aria-labelledby="alertsDrawerTitle"><header><h2 id="alertsDrawerTitle">Alertas do HydroCasa</h2><button type="button" class="icon-btn" id="alertsClose" aria-label="Fechar alertas">×</button></header><div id="alertsList" class="alerts-list"></div></section>';document.body.append(backdrop);q('#alertsList')?.before(filters);filters.addEventListener('change',render);
const toast=document.createElement('div');toast.className='alerts-toast';toast.hidden=true;toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');document.body.append(toast);let toastTimer=null;
function close(){backdrop.hidden=true;dialogOpen=false;focusBefore?.focus?.();}
function open(){focusBefore=document.activeElement;backdrop.hidden=false;dialogOpen=true;render();q('#alertsClose')?.focus();}
bell.onclick=open;q('[data-open-alerts]')?.addEventListener('click',open);q('#alertsClose').onclick=close;
backdrop.addEventListener('click',e=>{if(e.target===backdrop)close();});
backdrop.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();close();return}
 if(e.key!=='Tab')return;
 const els=[...backdrop.querySelectorAll('button:not([disabled]),a[href]')],first=els[0],last=els[els.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function realData(){
 // state é apenas lido: o app.js usa este objeto como fonte de dados.
 const s=typeof state==='object'?state:null;if(!s)return null;
 const today=new Date();const k=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 const online=s.connected===true&&Number.isFinite(s.lastValidAt)&&Date.now()-s.lastValidAt<=HydroAlertConfig.staleSeconds*1000;
 const cursor=s.cursor;
 if(online&&cursor&&Number.isFinite(cursor.t)&&cursor.t!==lastCursor&&s.live){
  observations.push({t:Date.now(),flow1:s.live.flow1_lpm,flow2:s.live.flow2_lpm,pulse1:s.live.pulses1,pulse2:s.live.pulses2});
  observations=observations.filter(x=>Date.now()-x.t<=Math.max(31,HydroAlertConfig.continuousMinutes+1)*60000).slice(-2000);
  lastCursor=cursor.t;
 }
 if(!online)observations=[];
 return {online,now:Date.now(),today:k,history:s.history||{},catalog:HydroConsumption.activities,observations,profile:s.household,activities:s.activityRecords||{}};
}
function reconcile(demo,active,now){
 const list=demo?demoHistory:history,found=new Set(active.map(a=>a.id));let changed=false;
 for(const a of active){
  // Exclusões ficam num registro separado e prevalecem sobre qualquer reconciliação automática.
  if(isRemoved(demo,a))continue;
  let item=list.find(x=>x.id===a.id&&x.status!=='resolvido');
  if(item){item.valor=a.valor;item.referencia=a.referencia;item.diferenca=a.diferenca;item.nivel=a.nivel;item.dataOcorrencia=a.dataOcorrencia||item.dataOcorrencia;item.mensagem=a.mensagem;continue;}
  let recent=list.find(x=>x.id===a.id&&now-x.criadoEm<HydroAlertConfig.repeatMinutes*60000);
  if(recent){recent.status='ativo';recent.valor=a.valor;recent.mensagem=a.mensagem;recent.atualizadoEm=now;changed=true;continue;}
  item={...a,status:'ativo',criadoEm:now,atualizadoEm:now};list.unshift(item);changed=true;
  if(!demo&&a.nivel==='Acima do padrão'){toast.textContent=a.mensagem;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,6500);}
 }
 for(const item of list){if(item.status==='silenciado'&&item.silenciadoAte&&now>item.silenciadoAte){item.status='ativo';item.silenciadoAte=null;changed=true;}
  if(item.status!=='resolvido'&&item.status!=='silenciado'&&!found.has(item.id)){
  // Não resolver alerta de sensor quando a ligação estiver interrompida.
  if(item.tipo==='sensor'&&!lastOnline)continue;
  item.status='resolvido';item.atualizadoEm=now;changed=true;
 }}
 if(changed)persist(demo);
}
function render(){
 const demo=document.body.dataset.demoActive==='true',removed=removedSet(demo),list=(demo?demoHistory:history).filter(x=>x.status!=='removido'&&!isRemoved(demo,x)).slice().sort((a,b)=>b.criadoEm-a.criadoEm);
 const snapshot=realData();const day=snapshot?.history?.[snapshot?.today];
 const comparable=!!(snapshot?.online&&snapshot.profile?.scope==='whole'&&snapshot.profile?.referenceLiters>0&&snapshot.profile?.residents>0&&day?.readings>0&&Number.isFinite(day.total1)&&Number.isFinite(day.total2)&&day.total1>=0&&day.total2>=0&&!day.profileMixed);
 const active=list.filter(a=>a.status==='ativo'&&(!a.silenciadoAte||Date.now()>a.silenciadoAte)),isComparable=comparable;
 const empty=isComparable?'Nenhum problema detectado nas condições avaliadas.':'Ainda não há informações suficientes para avaliar o consumo.';
 stateLine.textContent=!snapshot?.online?'Sensor offline — verifique a conexão do ESP32.':!day?.readings?'Conectado, mas ainda sem leituras suficientes.':active.length?'Atenção: há '+active.length+' ocorrência(s) que precisam de verificação.':isComparable?'Consumo dentro dos parâmetros configurados.':'Leituras disponíveis; comparação parcial do dia.';
 q('#hydroAlertCount').hidden=active.length===0;q('#hydroAlertCount').textContent=String(active.length);
 bell.setAttribute('aria-label','Abrir alertas: '+active.length+' ativo(s)');
 const preview=q('#alertsTopList');
 const priority={'Acima do padrão':0,'Atenção':1,'Informativo':2};
 const ordered=active.slice().sort((a,b)=>(priority[a.nivel]??3)-(priority[b.nivel]??3)||b.criadoEm-a.criadoEm);
 preview.innerHTML=ordered.length?ordered.map(x=>'<article class="alerts-inline-item" data-level="'+esc(x.nivel)+'"><div class="alerts-inline-icon" aria-hidden="true">'+(levels[x.nivel]||'ℹ')+'</div><div class="alerts-inline-body"><div class="alerts-inline-meta"><strong>'+esc(x.nivel)+'</strong><time>'+fmtDate(x.criadoEm)+'</time></div><p>'+esc(x.mensagem)+'</p><div class="alerts-inline-actions"><button type="button" data-alert-action="read" data-alert-id="'+esc(x.id)+'">Entendi</button><button type="button" data-alert-action="mute" data-alert-id="'+esc(x.id)+'">Silenciar por hoje</button><button type="button" data-alert-action="remove" data-alert-id="'+esc(x.id)+'">Remover</button></div></div></article>').join(''):'<p class="alerts-inline-empty">'+esc(empty)+'</p>';
 updateAlertPreviewLimit();
 const from=q('#alertDateFrom')?.value||'',to=q('#alertDateTo')?.value||'',severity=q('#alertSeverity')?.value||'all',status=q('#alertState')?.value||'all';
 const filtered=list.filter(x=>{const day=x.dataOcorrencia||(Number.isFinite(x.criadoEm)?new Date(x.criadoEm).toLocaleDateString('en-CA'):new Date().toLocaleDateString('en-CA'));return (!from||day>=from)&&(!to||day<=to)&&(severity==='all'||x.nivel===severity)&&(status==='all'||x.status===status)});
 const box=q('#alertsList');box.innerHTML=filtered.length?filtered.map(x=>'<article class="alert-entry" data-level="'+esc(x.nivel)+'"><span class="alert-level">'+(levels[x.nivel]||'ℹ')+' '+esc(x.nivel)+(demo?' · Demonstração':'')+'</span><p>'+esc(x.mensagem)+'</p><p class="alerts-guidance"><strong>Por que importa:</strong> '+esc(why(x)[0])+'</p><p class="alerts-guidance"><strong>O que verificar:</strong> '+esc(why(x)[1])+'</p><small>'+fmtDate(x.criadoEm)+' · '+esc(x.status)+'</small><div class="alert-actions">'+(x.status==='ativo'?'<button type="button" data-alert-action="read" data-alert-id="'+esc(x.id)+'">Entendi</button><button type="button" data-alert-action="mute" data-alert-id="'+esc(x.id)+'">Silenciar por hoje</button>':'')+'<button type="button" data-alert-action="remove" data-alert-id="'+esc(x.id)+'">Remover</button></div></article>').join(''):'<p>'+empty+'</p>';
}
function handleAlertAction(e){
 const btn=e.target.closest('button[data-alert-action]');if(!btn)return;
 const demo=document.body.dataset.demoActive==='true',list=demo?demoHistory:history,item=list.find(x=>x.id===btn.dataset.alertId);if(!item)return;
 if(btn.dataset.alertAction==='remove'){
  // Mantém uma marca persistente para impedir que o tick recrie o alerta ativo.
  item.status='removido';item.removidoEm=Date.now();removedSet(demo).add(alertSignature(item));persistRemoved(demo);persist(demo);render();return;
 }
 item.status=btn.dataset.alertAction==='read'?'lido':'silenciado';if(item.status==='silenciado')item.silenciadoAte=new Date().setHours(23,59,59,999);
 persist(demo);render();
}
backdrop.addEventListener('click',handleAlertAction);
card.addEventListener('click',handleAlertAction);
function dailyConsumptionAnomalies(d){
 const out=[],demo=document.body.dataset.demoActive==='true';
 const profile=d?.profile;
 let weekly=null;try{weekly=JSON.parse(sessionStorage.getItem('hydrocasa:semana-demo')||'null')}catch{}
 const reference=Number(profile?.referenceLiters),residents=Number(profile?.residents);
 const tolerance=Math.max(0,Number(profile?.tolerance)||0);
 if(!Number.isFinite(reference)||reference<=0||!Number.isInteger(residents)||residents<1)return out;
 const threshold=reference*residents*(1+Math.max(HydroAlertConfig.dailyTolerancePercent,tolerance)/100);
 const add=(date,total,source)=>{
  if(!Number.isFinite(total)||total<0||total<=threshold)return;
  const excess=(total/threshold-1)*100;
  const nivel=excess>=50?'Crítico':excess>=25?'Moderado':'Leve';
  const id='anomalia-consumo:'+date;
  out.push({id,tipo:'consumo',nivel,alvo:'Residência · '+date,valor:total,referencia:threshold,diferenca:Math.round(excess),dataOcorrencia:date,mensagem:(source==='demo'?'Demonstração fictícia · ':'')+date.split('-').reverse().join('/')+': '+fmt(total)+' L no dia, '+Math.round(excess)+'% acima da referência de '+fmt(threshold)+' L. Classificação: '+nivel+'.'+(source==='demo'?' Este valor é simulado, não uma leitura do ESP32.':'')});
 };
 for(const [date,row] of Object.entries(d?.history||{})){
  if(row&&row.readings>0&&!row.profileMixed&&Number.isFinite(row.total1)&&Number.isFinite(row.total2))add(date,row.total1+row.total2,'real');
 }
 if(weekly&&weekly.version===1&&Number.isInteger(weekly.days)&&weekly.days>=1&&weekly.days<=366&&Array.isArray(weekly.values)&&weekly.values.length===7){
  const today=new Date();today.setHours(12,0,0,0);
  for(let age=0;age<weekly.days;age++){
   const date=new Date(today);date.setDate(date.getDate()-age);
   const key=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
   const real=d?.history?.[key];if(real&&real.readings>0)continue;
   const row=weekly.values[date.getDay()];
   if(Array.isArray(row)&&row.length===2&&row.every(v=>Number.isFinite(v)&&v>=0))add(key,row[0]+row[1],'demo');
  }
 }
 return out;
}
function tick(){
 const d=realData();if(!d)return;
 lastOnline=d.online;
 const demo=document.body.dataset.demoActive==='true';
 // Dados demonstrativos nunca são tratados como sensores.
 const active=HydroAlerts.avaliar({...d,online:!demo&&d.online},d.profile,d.activities).filter(x=>x.tipo==='atividade'||(!demo&&d.online));
 const anomalies=dailyConsumptionAnomalies(d);
 reconcile(demo,[...active,...anomalies],Date.now());

 // Marcadores apenas visuais nas atividades efetivamente listadas.
 const alertNames=new Set(history.filter(x=>x.status==='ativo'&&x.tipo==='atividade').map(x=>x.alvo));
 document.querySelectorAll('#activityLog .activity-entry').forEach(entry=>{
  const name=entry.querySelector('b')?.textContent;const existing=entry.querySelector('.activity-alert-badge');
  if(alertNames.has(name)&&!existing){const badge=document.createElement('span');badge.className='activity-alert-badge';badge.textContent='⚠ Atenção';badge.title='Esta atividade tem uma estimativa acima da referência; consulte os alertas.';entry.querySelector('b')?.after(badge);}
  if(!alertNames.has(name))existing?.remove();
 });
 render();
}
setInterval(tick,3000);tick();
})();
