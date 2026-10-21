/* HydroCasa: UX independente. Não acessa state, history ou APIs de medição. */
(()=>{
'use strict';
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const PROJECT_AFFILIATION='Projeto acadêmico · Engenharia';
const affiliation=q('#heroAcademic');if(affiliation)affiliation.textContent=PROJECT_AFFILIATION;
const names={dashboard:'Visão geral',calendar:'Calendário',analysis:'Análise',activities:'Atividades',settings:'Sistema'};
const nav=q('.dashboard-shortcuts'),area=q('.dashboard-shortcuts-area'),hero=q('#dashboard-page .hero-premium'),guide=q('.getting-started'),house=q('.household-card'),metrics=q('.metrics-grid'),compare=q('.comparison-grid');
if(!nav||!hero||!guide||!house)return;
let interacted=false,guideDismissed=false,fromHistory=false;
try{guideDismissed=localStorage.getItem('hydrocasa:tutorial-oculto')==='1';interacted=sessionStorage.getItem('hydrocasa:navegou')==='1';}catch{}
const tabs=qa('.dashboard-shortcuts .tab');
nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Seções do painel');
nav.addEventListener('keydown',e=>{
 const i=tabs.indexOf(document.activeElement);
 if(i<0)return;
 let target;
 if(e.key==='ArrowRight')target=(i+1)%tabs.length;
 if(e.key==='ArrowLeft')target=(i+tabs.length-1)%tabs.length;
 if(e.key==='Home')target=0;
 if(e.key==='End')target=tabs.length-1;
 if(target!==undefined){e.preventDefault();tabs[target].focus();tabs[target].click();}
});
for(const t of tabs){
 const pane=q('#'+t.dataset.panel);
 t.setAttribute('role','tab');t.id='hydro-tab-'+t.dataset.panel;
 t.setAttribute('aria-controls',t.dataset.panel);
 if(pane){pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',t.id);pane.tabIndex=-1;}
}
const dismiss=document.createElement('button');
dismiss.type='button';dismiss.className='ghost-btn ux-dismiss';dismiss.textContent='Entendi, ocultar';
guide.querySelector('.getting-started-heading')?.append(dismiss);
dismiss.addEventListener('click',()=>{guideDismissed=true;try{localStorage.setItem('hydrocasa:tutorial-oculto','1');}catch{}apply(tabActive());help.focus();});
const help=document.createElement('button');help.type='button';help.className='ghost-btn ux-help';help.textContent='? Ajuda';help.setAttribute('aria-haspopup','dialog');
area.insertBefore(help,nav);
const personalize=document.createElement('details');personalize.className='ux-personalize';personalize.id='personalizar';
const summary=document.createElement('summary');summary.textContent='Personalizar residência';summary.setAttribute('aria-label','Abrir ou fechar perfil da residência');personalize.append(summary);
area.after(personalize);personalize.append(house);
const ledgerProfile=(()=>{try{return JSON.parse(localStorage.getItem('hydrocasa_ledger_v2')||'{}').household}catch{return null}})();
personalize.open=true;
const overlay=document.createElement('div');overlay.className='ux-drawer';overlay.hidden=true;overlay.innerHTML='<section class="ux-drawer-content" role="dialog" aria-modal="true" aria-labelledby="uxHelpTitle"><button type="button" class="ux-help-close" aria-label="Fechar ajuda">×</button><h2 id="uxHelpTitle">Como usar seu painel</h2><div class="ux-help-body"></div></section>';
document.body.append(overlay);
const helpBody=overlay.querySelector('.ux-help-body');
q('#heroTourButton')?.addEventListener('click',()=>q('#openHydroTour')?.click());
const tourWrap=q('#tourLaunchWrap'),tourTrigger=q('#openHydroTour');
if(tourWrap&&tourTrigger){tourTrigger.textContent='✦ Fazer tour guiado';tourWrap.classList.remove('ux-tour-help');}
helpBody.append(guide.querySelector('.getting-started-steps').cloneNode(true));
const drawerProfile=helpBody.querySelector('#guideConfigureProfile');if(drawerProfile){drawerProfile.removeAttribute('id');drawerProfile.addEventListener('click',()=>{closeHelp();navigate('dashboard',true,true);personalize.open=true;});}
const profileLink=q('#guideConfigureProfile');if(profileLink)profileLink.onclick=()=>{personalize.open=true;};
const drawerCalendar=helpBody.querySelector('#guideOpenCalendar');
if(drawerCalendar){drawerCalendar.removeAttribute('id');drawerCalendar.onclick=()=>{closeHelp();navigate('calendar',true,true);};}
let previous=null;
function closeHelp(){overlay.hidden=true;previous?.focus();}
help.onclick=()=>{previous=document.activeElement;overlay.hidden=false;overlay.querySelector('button').focus();};
overlay.querySelector('.ux-help-close').onclick=closeHelp;
overlay.addEventListener('click',e=>{if(e.target===overlay)closeHelp();});
overlay.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();closeHelp();}
 if(e.key==='Tab'){const nodes=qa('.ux-drawer:not([hidden]) button,.ux-drawer:not([hidden]) a');if(!nodes.length)return;const i=nodes.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();nodes[nodes.length-1].focus();}else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0].focus();}}
});

/* Consulta somente leitura do perfil gravado pelo sistema, sem alterar ledger. */
const profileBtn=q('#hydroProfileBtn');
if(profileBtn){
 const layer=document.createElement('div');layer.className='ux-drawer';layer.hidden=true;
 layer.innerHTML='<section class="ux-drawer-content" role="dialog" aria-modal="true" aria-labelledby="hydroProfileTitle"><button type="button" class="ux-help-close" aria-label="Fechar perfil">×</button><h2 id="hydroProfileTitle">Perfil da residência</h2><div id="hydroProfileContent"></div><button type="button" class="ghost-btn" id="hydroProfileEdit">Personalizar residência</button></section>';
 document.body.append(layer);
 let oldFocus=null;
 const closeProfile=()=>{layer.hidden=true;oldFocus?.focus();};
 const content=layer.querySelector('#hydroProfileContent');
 const htmlEscape=v=>String(v).replace(/[&<>"']/g,a=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[a]));
 profileBtn.onclick=()=>{
  oldFocus=document.activeElement;
  let p=null;
  try{p=JSON.parse(localStorage.getItem('hydrocasa_ledger_v2')||'{}').household||null;}catch{}
  const yes=p&&Number.isInteger(p.residents)&&p.residents>0;
  const fmt=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2});
  content.innerHTML=yes?'<dl class="ux-profile-list"><dt>Moradores</dt><dd>'+htmlEscape(p.residents)+'</dd><dt>Abrangência</dt><dd>'+htmlEscape(p.scope==='whole'?'Residência inteira':'Somente ramais monitorados')+'</dd><dt>Referência por pessoa/dia</dt><dd>'+htmlEscape(fmt(p.referenceLiters))+' L</dd><dt>Faixa de comparação</dt><dd>± '+htmlEscape(fmt(p.tolerance))+'%</dd><dt>Ramal 01</dt><dd>'+htmlEscape(p.ramal1||'Ramal 01')+'</dd><dt>Ramal 02</dt><dd>'+htmlEscape(p.ramal2||'Ramal 02')+'</dd></dl>':'<p>O perfil da residência ainda não foi configurado.</p>';
  layer.hidden=false;layer.querySelector('.ux-help-close').focus();
 };
 layer.querySelector('.ux-help-close').onclick=closeProfile;
 layer.querySelector('#hydroProfileEdit').onclick=()=>{closeProfile();document.querySelector('[data-page="dashboard"]')?.click();document.querySelector('.tab[data-panel="dashboard"]')?.click();personalize.open=true;personalize.scrollIntoView({block:'start'});personalize.querySelector('summary')?.focus();};
 layer.addEventListener('click',e=>{if(e.target===layer)closeProfile();});
 layer.addEventListener('keydown',e=>{if(e.key==='Escape'){closeProfile();return;}if(e.key!=='Tab')return;const all=[...layer.querySelectorAll('button:not([disabled]),a[href]')];if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0].focus();}});
}

function tabActive(){return tabs.find(t=>t.classList.contains('active'))?.dataset.panel||'dashboard';}
function apply(id,scroll=false){
 if(!names[id])id='dashboard';
 for(const tab of tabs){const selected=tab.dataset.panel===id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
 const overview=id==='dashboard';
 guide.hidden=!overview||guideDismissed;
 personalize.hidden=!overview;
 metrics.hidden=!overview;
 compare.hidden=!overview;
 hero.classList.toggle('ux-hero-compact',!overview);
 hero.hidden=!overview;
 document.body.dataset.uxTab=id;
 document.title=names[id]+' | HydroCasa';
 const pane=q('#'+id);
 if(scroll&&pane){requestAnimationFrame(()=>{pane.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});pane.focus({preventScroll:true});});}
}
function navigate(id,scroll=true,push=true){
 if(!names[id])return;
 if(tabActive()!==id){tabs.find(t=>t.dataset.panel===id)?.click();}
 interacted=true;try{sessionStorage.setItem('hydrocasa:navegou','1');}catch{}
 apply(id,scroll);
 if(push&&!fromHistory){const u=new URL(location.href);u.hash=id==='dashboard'?'visao-geral':id==='analysis'?'analise':id==='activities'?'atividades':id==='calendar'?'calendario':'sistema';if(u.href!==location.href)history.pushState({hydroTab:id},'',u);}
}
tabs.forEach(t=>t.addEventListener('click',()=>{if(!fromHistory)navigate(t.dataset.panel,true,true);}));
const hashToId={'#visao-geral':'dashboard','#calendario':'calendar','#analise':'analysis','#atividades':'activities','#sistema':'settings'};
function routeHash(){const id=hashToId[location.hash.toLowerCase()]||'dashboard';fromHistory=true;if(tabActive()!==id){tabs.find(t=>t.dataset.panel===id)?.click();}apply(id,location.hash.length>0);fromHistory=false;}
window.addEventListener('popstate',routeHash);window.addEventListener('hashchange',routeHash);
// Carregamentos e F5 sempre iniciam no cabeçalho, sem rolar para a aba.
const initialTab=hashToId[location.hash.toLowerCase()]||'dashboard';
fromHistory=true;
if(tabActive()!==initialTab)tabs.find(t=>t.dataset.panel===initialTab)?.click();
apply(initialTab,false);
fromHistory=false;
try{history.scrollRestoration='manual';}catch{}
const scrollToPageTop=()=>window.scrollTo({top:0,left:0,behavior:'instant'});
scrollToPageTop();
window.addEventListener('load',scrollToPageTop,{once:true});
window.addEventListener('pageshow',scrollToPageTop);
document.querySelectorAll('a[href="#top"],[aria-label*="voltar ao topo" i]').forEach(link=>{
 link.addEventListener('click',event=>{
  event.preventDefault();
  const url=new URL(location.href);url.hash='top';
  history.replaceState(history.state,'',url);
  window.scrollTo({top:0,left:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 });
});
q('#heroPrimaryLink')?.addEventListener('click',e=>{e.preventDefault();navigate('dashboard',false,false);q('.metrics-grid')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});
function repaint(){
 const live=document.body.dataset.connectionState==='online';
 const map=q('.pipe-diagram'),tag=q('.water-map .live-dot');
 if(map)map.classList.toggle('ux-no-live',!live);
 if(tag)tag.textContent=live?'● AO VIVO':'◌ SEM LEITURA ATUAL';
 const d=q('#donut');if(d)d.dataset.uxEmpty=d.dataset.empty==='true'?'true':'false';
 const theme=q('#themeBtn');if(theme){const dark=document.body.classList.contains('dark');theme.setAttribute('aria-pressed',String(dark));theme.setAttribute('aria-label',dark?'Ativar modo claro':'Ativar modo escuro');}
 const status=q('#statusText');if(status&&status.textContent.trim()==='Monitorando'&&!live)status.textContent='Aguardando conexão';
 const time=q('#clock');if(time&&(time.textContent.trim()==='--:--:--'||time.textContent.trim()===''))time.textContent=new Date().toLocaleTimeString('pt-BR');
}
new MutationObserver(repaint).observe(document.body,{attributes:true,attributeFilter:['class','data-connection-state']});
setInterval(repaint,1500);repaint();
const legend=q('.diagram-legend');
if(legend){legend.innerHTML='<span>Entrada: abastecimento</span><span>Y: divisão da água</span><span>S1: sensor do ramal 01</span><span>S2: sensor do ramal 02</span><span>Depósito / reuso: saída da maquete</span>';}
})();
