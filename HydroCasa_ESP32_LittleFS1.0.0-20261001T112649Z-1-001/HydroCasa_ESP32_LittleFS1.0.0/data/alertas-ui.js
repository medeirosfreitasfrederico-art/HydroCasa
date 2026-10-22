/* Camada de apresentação de alertas. NUNCA grava ledger, snapshot, perfil ou endpoints. */
(()=>{
'use strict';
const q=s=>document.querySelector(s),key='hydrocasa:alertas',demoKey='hydrocasa:alertas:demonstracao';
const fmtDate=t=>new Date(t).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const levels={'Informativo':'ℹ','Atenção':'⚠','Acima do padrão':'▲'};
const guidance={sensor:['O sensor pode ter parado de enviar leituras.','Verifique energia, cabo e conexão do ESP32.'],atividade:['Uma atividade registrada ultrapassou a referência configurada.','Confira duração e quantidade informadas no registro.'],consumo:['O volume registrado está acima da referência configurada.','Confira o perfil da residência e os hábitos do período.'],fluxo:['Foi detectado um comportamento de fluxo que merece verificação.','Verifique torneiras, chuveiros e possíveis vazamentos.']};
const why=a=>guidance[a.tipo]||['Uma condição do monitoramento merece sua atenção.','Confira as leituras, as conexões e as configurações do painel.'];
let history=[],demoHistory=[],observations=[],lastCursor='',focusBefore=null,dialogOpen=false,lastOnline=false;
const safeRead=(storage,k)=>{try{let v=JSON.parse(storage.getItem(k)||'[]');return Array.isArray(v)?v.filter(x=>x&&typeof x.id==='string').slice(0,250):[]}catch{return []}};
history=safeRead(localStorage,key);demoHistory=safeRead(sessionStorage,demoKey);
const persist=demo=>{try{(demo?sessionStorage:localStorage).setItem(demo?demoKey:key,JSON.stringify((demo?demoHistory:history).slice(0,250)))}catch{}};
const bell=q('#hydroAlertBell')||document.createElement('button');
if(!bell.id){bell.id='hydroAlertBell';bell.type='button';bell.className='icon-btn alert-bell';bell.setAttribute('aria-haspopup','dialog');bell.setAttribute('aria-label','Abrir alertas');bell.innerHTML='<span class="hydro-header-icon hydro-header-icon-alert" aria-hidden="true"></span><span id="hydroAlertCount" class="alert-count" hidden>0</span>';q('.header-actions')?.insertBefore(bell,q('#themeBtn'));}
const card=document.createElement('section');card.className='glass-card alerts-overview';card.id='alertsOverview';card.setAttribute('aria-labelledby','alertsOverviewTitle');
card.innerHTML='<div class="alerts-heading"><div><span class="alerts-kicker">ACOMPANHAMENTO</span><h3 id="alertsOverviewTitle">Alertas e orientações</h3><p class="alerts-subtitle">Ocorrências ordenadas por prioridade, sem precisar abrir outra janela.</p></div><button type="button" class="ghost-btn" data-open-alerts>Histórico de alertas</button></div><div id="alertsTopList" class="alerts-inline-list" role="region" aria-label="Alertas atuais">Dados insuficientes para comparar.</div>';
const quickAccess=q('#dashboard-page .dashboard-shortcuts-area');
if(quickAccess)quickAccess.after(card);
else {const dashboard=q('#dashboard .section-heading');if(dashboard)dashboard.after(card);}
card.setAttribute('aria-label','Situação e avisos do monitoramento');
const stateLine=document.createElement('p');stateLine.className='alerts-state-line';stateLine.setAttribute('role','status');stateLine.setAttribute('aria-live','polite');card.querySelector('.alerts-heading').after(stateLine);
const filters=document.createElement('form');filters.className='alerts-filters';filters.setAttribute('aria-label','Filtros do histórico de alertas');
filters.innerHTML='<label>Período <select id="alertPeriod"><option value="all">Todo o histórico</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select></label><label>Gravidade <select id="alertSeverity"><option value="all">Todas</option><option value="Acima do padrão">Acima do padrão</option><option value="Atenção">Atenção</option><option value="Informativo">Informativo</option></select></label><label>Situação <select id="alertState"><option value="all">Todas</option><option value="ativo">Ativos</option><option value="lido">Lidos</option><option value="silenciado">Silenciados</option><option value="resolvido">Resolvidos</option></select></label>';
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
  let item=list.find(x=>x.id===a.id&&x.status!=='resolvido');
  if(item){item.valor=a.valor;item.referencia=a.referencia;item.diferenca=a.diferenca;item.mensagem=a.mensagem;continue;}
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
 const demo=document.body.dataset.demoActive==='true',list=(demo?demoHistory:history).slice().sort((a,b)=>b.criadoEm-a.criadoEm);
 const snapshot=realData();const day=snapshot?.history?.[snapshot?.today];
 const demo=document.body.dataset.demoActive==='true';
 let demoConfigured=false;try{const o=JSON.parse(sessionStorage.getItem('hydrocasa:semana-demo')||'null');demoConfigured=!!(o&&o.version===1&&Number.isInteger(o.days)&&o.days>=1&&o.days<=366&&Array.isArray(o.values)&&o.values.length===7);}catch{}
 const comparable=demo?demoConfigured:!!(snapshot?.online&&snapshot.profile?.scope==='whole'&&snapshot.profile?.referenceLiters>0&&snapshot.profile?.residents>0&&day?.readings>0&&Number.isFinite(day.total1)&&Number.isFinite(day.total2)&&day.total1>=0&&day.total2>=0&&!day.profileMixed);
 const active=list.filter(a=>a.status==='ativo'&&(!a.silenciadoAte||Date.now()>a.silenciadoAte)),isComparable=comparable;
 const empty=isComparable?'Nenhum excesso detectado nos dias avaliados.':'Ainda não há informações suficientes para avaliar o consumo.';
 stateLine.textContent=demo?(active.length?'Demonstração avaliada: '+active.length+' dia(s) acima da referência ilustrativa.':isComparable?'Demonstração avaliada; nenhum dia ultrapassou a referência ilustrativa.':'Configure os dados da demonstração para avaliar o consumo.'):!snapshot?.online?'Sensor offline — verifique a conexão do ESP32.':!day?.readings?'Conectado, mas ainda sem leituras suficientes.':active.length?'Atenção: há '+active.length+' ocorrência(s) que precisam de verificação.':isComparable?'Consumo dentro dos parâmetros configurados.':'Leituras disponíveis; comparação parcial do dia.';
 q('#hydroAlertCount').hidden=active.length===0;q('#hydroAlertCount').textContent=String(active.length);
 bell.setAttribute('aria-label','Abrir alertas: '+active.length+' ativo(s)');
 const preview=q('#alertsTopList');
 const priority={'Acima do padrão':0,'Atenção':1,'Informativo':2};
 const ordered=active.slice().sort((a,b)=>(priority[a.nivel]??3)-(priority[b.nivel]??3)||b.criadoEm-a.criadoEm);
 preview.innerHTML=ordered.length?ordered.map(x=>'<article class="alerts-inline-item" data-level="'+esc(x.nivel)+'"><div class="alerts-inline-icon" aria-hidden="true">'+(levels[x.nivel]||'ℹ')+'</div><div class="alerts-inline-body"><div class="alerts-inline-meta"><strong>'+esc(x.nivel)+'</strong><time>'+fmtDate(x.criadoEm)+'</time></div><p>'+esc(x.mensagem)+'</p><div class="alerts-inline-actions"><button type="button" data-alert-action="detail" data-alert-id="'+esc(x.id)+'">Ver detalhes</button><button type="button" data-alert-action="read" data-alert-id="'+esc(x.id)+'">Entendi</button><button type="button" data-alert-action="mute" data-alert-id="'+esc(x.id)+'">Silenciar hoje</button></div></div></article>').join(''):'<p class="alerts-inline-empty">'+esc(empty)+'</p>';
 const period=q('#alertPeriod')?.value||'all',severity=q('#alertSeverity')?.value||'all',status=q('#alertState')?.value||'all';
 const filtered=list.filter(x=>(period==='all'||Date.now()-x.criadoEm<=Number(period)*86400000)&&(severity==='all'||x.nivel===severity)&&(status==='all'||x.status===status));
 const box=q('#alertsList');box.innerHTML=filtered.length?filtered.map(x=>'<article class="alert-entry" data-level="'+esc(x.nivel)+'"><span class="alert-level">'+(levels[x.nivel]||'ℹ')+' '+esc(x.nivel)+(demo?' · Demonstração':'')+'</span><p>'+esc(x.mensagem)+'</p><p class="alerts-guidance"><strong>Por que importa:</strong> '+esc(why(x)[0])+'</p><p class="alerts-guidance"><strong>O que verificar:</strong> '+esc(why(x)[1])+'</p><small>'+fmtDate(x.criadoEm)+' · '+esc(x.status)+'</small><div class="alert-actions">'+(x.status==='ativo'?'<button type="button" data-alert-action="read" data-alert-id="'+esc(x.id)+'">Entendi</button><button type="button" data-alert-action="mute" data-alert-id="'+esc(x.id)+'">Silenciar por hoje</button>':'')+'<button type="button" data-alert-action="detail" data-alert-id="'+esc(x.id)+'">Ver detalhe</button></div></article>').join(''):'<p>'+empty+'</p>';
}
function handleAlertAction(e){
 const btn=e.target.closest('button[data-alert-action]');if(!btn)return;
 const demo=document.body.dataset.demoActive==='true',list=demo?demoHistory:history,item=list.find(x=>x.id===btn.dataset.alertId);if(!item)return;
 if(btn.dataset.alertAction==='detail'){
  close();const target=item.tipo==='atividade'?'activities':'dashboard';document.querySelector('.dashboard-shortcuts .tab[data-panel="'+target+'"]')?.click();
  document.querySelector('#'+target)?.scrollIntoView({block:'start'});return;
 }
 item.status=btn.dataset.alertAction==='read'?'lido':'silenciado';if(item.status==='silenciado')item.silenciadoAte=new Date().setHours(23,59,59,999);
 persist(demo);render();
}
backdrop.addEventListener('click',handleAlertAction);
card.addEventListener('click',handleAlertAction);
function demoConsumptionAlerts(d){
 const alerts=[];
 let weekly;try{weekly=JSON.parse(sessionStorage.getItem('hydrocasa:semana-demo')||'null');}catch{return alerts;}
 if(!weekly||weekly.version!==1||!Number.isInteger(weekly.days)||weekly.days<1||weekly.days>366||!Number.isInteger(weekly.residents)||weekly.residents<1||!Array.isArray(weekly.values)||weekly.values.length!==7)return alerts;
 const mode=q('#referenceMode')?.value||'snis';
 const perPerson=mode==='user'?Number(q('#referenceM3')?.value)*1000:152.1;
 const residents=weekly.residents;
 const tolerance=Math.max(0,Number(q('#toleranceInput')?.value??10)||0);
 if(!Number.isFinite(perPerson)||perPerson<=0)return alerts;
 const limit=perPerson*residents*(1+tolerance/100);
 const now=new Date();now.setHours(12,0,0,0);
 for(let age=0;age<weekly.days;age++){
  const date=new Date(now);date.setDate(date.getDate()-age);
  const key=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  const real=d?.history?.[key];
  // A simulação nunca substitui nem duplica um dia com leituras reais.
  if(real&&real.readings>0)continue;
  const row=weekly.values[date.getDay()];
  if(!Array.isArray(row)||row.length!==2||!row.every(v=>Number.isFinite(v)&&v>=0))continue;
  const volume=row[0]+row[1];
  if(volume<=limit)continue;
  const pct=Math.round((volume/limit-1)*100);
  alerts.push({id:'demo-consumo:'+key,tipo:'consumo',nivel:'Acima do padrão',alvo:'Residência · '+key,valor:volume,referencia:limit,diferenca:pct,mensagem:'Demonstração de '+key.split('-').reverse().join('/')+': '+fmt(volume)+' L/dia, '+pct+'% acima da faixa ilustrativa de '+fmt(limit)+' L/dia ('+residents+' morador(es), tolerância de '+tolerance+'%). Valores fictícios, não são medições do ESP32.'});
 }
 return alerts;
}
function tick(){
 const d=realData();if(!d)return;
 lastOnline=d.online;
 const demo=document.body.dataset.demoActive==='true';
 // Dados demonstrativos são avaliados separadamente; nunca são apresentados como leituras do ESP32.
 if(demo)reconcile(true,demoConsumptionAlerts(d),Date.now());
 else {
  const active=HydroAlerts.avaliar(d,d.profile,d.activities);
  reconcile(false,active,Date.now());
 }
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
