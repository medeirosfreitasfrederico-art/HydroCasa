/* Camada de apresentação de alertas. NUNCA grava ledger, snapshot, perfil ou endpoints. */
(()=>{
'use strict';
const q=s=>document.querySelector(s),key='hydrocasa:alertas',demoKey='hydrocasa:alertas:demonstracao';
const fmtDate=t=>new Date(t).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const levels={'Informativo':'ℹ','Atenção':'⚠','Acima do padrão':'▲'};
let history=[],demoHistory=[],observations=[],lastCursor='',focusBefore=null,dialogOpen=false,lastOnline=false;
const safeRead=(storage,k)=>{try{let v=JSON.parse(storage.getItem(k)||'[]');return Array.isArray(v)?v.filter(x=>x&&typeof x.id==='string').slice(0,250):[]}catch{return []}};
history=safeRead(localStorage,key);demoHistory=safeRead(sessionStorage,demoKey);
const persist=demo=>{try{(demo?sessionStorage:localStorage).setItem(demo?demoKey:key,JSON.stringify((demo?demoHistory:history).slice(0,250)))}catch{}};
const bell=document.createElement('button');bell.id='hydroAlertBell';bell.type='button';bell.className='icon-btn alert-bell';bell.setAttribute('aria-haspopup','dialog');bell.setAttribute('aria-label','Abrir alertas');bell.innerHTML='<span aria-hidden="true">♧</span><span id="hydroAlertCount" class="alert-count" hidden>0</span>';
q('.header-actions')?.insertBefore(bell,q('#themeBtn'));
const card=document.createElement('section');card.className='glass-card alerts-overview';card.id='alertsOverview';card.setAttribute('aria-labelledby','alertsOverviewTitle');
card.innerHTML='<div class="alerts-heading"><h3 id="alertsOverviewTitle">Alertas ativos</h3><button type="button" class="ghost-btn" data-open-alerts>Ver todos</button></div><div id="alertsTopList" role="status" aria-live="polite">Dados insuficientes para comparar.</div>';
const dashboard=q('#dashboard .section-heading');if(dashboard)dashboard.after(card);
const backdrop=document.createElement('div');backdrop.className='alerts-backdrop';backdrop.hidden=true;
backdrop.innerHTML='<section class="alerts-drawer" role="dialog" aria-modal="true" aria-labelledby="alertsDrawerTitle"><header><h2 id="alertsDrawerTitle">Alertas do HydroCasa</h2><button type="button" class="icon-btn" id="alertsClose" aria-label="Fechar alertas">×</button></header><div id="alertsList" class="alerts-list"></div></section>';document.body.append(backdrop);
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
 for(const item of list){if(item.status!=='resolvido'&&item.status!=='silenciado'&&!found.has(item.id)){
  // Não resolver alerta de sensor quando a ligação estiver interrompida.
  if(item.tipo==='sensor'&&!lastOnline)continue;
  item.status='resolvido';item.atualizadoEm=now;changed=true;
 }}
 if(changed)persist(demo);
}
function render(){
 const demo=document.body.dataset.demoActive==='true',list=(demo?demoHistory:history).slice().sort((a,b)=>b.criadoEm-a.criadoEm);
 const active=list.filter(a=>a.status==='ativo'),isComparable=realData()?.online&&!!realData()?.profile;
 const empty=isComparable?'Tudo dentro do padrão registrado.':'Dados insuficientes para comparar.';
 q('#hydroAlertCount').hidden=active.length===0;q('#hydroAlertCount').textContent=String(active.length);
 bell.setAttribute('aria-label','Abrir alertas: '+active.length+' ativo(s)');
 const preview=q('#alertsTopList');
 preview.innerHTML=active.length?active.slice(0,3).map(x=>'<p><span aria-hidden="true">'+(levels[x.nivel]||'ℹ')+'</span> <b>'+esc(x.nivel)+'</b> · '+esc(x.mensagem)+'</p>').join(''):'<p>'+empty+'</p>';
 const box=q('#alertsList');box.innerHTML=list.length?list.map(x=>'<article class="alert-entry" data-level="'+esc(x.nivel)+'"><span class="alert-level">'+(levels[x.nivel]||'ℹ')+' '+esc(x.nivel)+(demo?' · Demonstração':'')+'</span><p>'+esc(x.mensagem)+'</p><small>'+fmtDate(x.criadoEm)+' · '+esc(x.status)+'</small><div class="alert-actions">'+(x.status==='ativo'?'<button type="button" data-alert-action="read" data-alert-id="'+esc(x.id)+'">Entendi</button><button type="button" data-alert-action="mute" data-alert-id="'+esc(x.id)+'">Silenciar por hoje</button>':'')+'<button type="button" data-alert-action="detail" data-alert-id="'+esc(x.id)+'">Ver detalhe</button></div></article>').join(''):'<p>'+empty+'</p>';
}
backdrop.addEventListener('click',e=>{
 const btn=e.target.closest('button[data-alert-action]');if(!btn)return;
 const demo=document.body.dataset.demoActive==='true',list=demo?demoHistory:history,item=list.find(x=>x.id===btn.dataset.alertId);if(!item)return;
 if(btn.dataset.alertAction==='detail'){
  close();const target=item.tipo==='atividade'?'activities':'dashboard';document.querySelector('.dashboard-shortcuts .tab[data-panel="'+target+'"]')?.click();
  document.querySelector('#'+target)?.scrollIntoView({block:'start'});return;
 }
 item.status=btn.dataset.alertAction==='read'?'lido':'silenciado';if(item.status==='silenciado')item.silenciadoAte=new Date().setHours(23,59,59,999);
 persist(demo);render();
});
function tick(){
 const d=realData();if(!d)return;
 lastOnline=d.online;
 const demo=document.body.dataset.demoActive==='true';
 // Dados demonstrativos nunca são tratados como sensores.
 const active=HydroAlerts.avaliar({...d,online:!demo&&d.online},d.profile,d.activities).filter(x=>x.tipo==='atividade'||(!demo&&d.online));
 // Na demonstração não há avaliação de sensores: nunca transformar suposições em medições.
 if(!demo){reconcile(false,active,Date.now());}
 // Não cria alerta fictício real ao alternar de fonte.
 render();
}
setInterval(tick,3000);tick();
})();
