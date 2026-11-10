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
const summary=document.createElement('summary');summary.textContent='Etapa 1 — Quantas pessoas moram na residência?';summary.setAttribute('aria-label','Abrir ou fechar perfil da residência');personalize.append(summary);
const startProfile=q('#hydroStartProfile');
if(startProfile){startProfile.append(personalize);}else{area.after(personalize);}
personalize.append(house);
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

/* O painel do Perfil da residência (botão do cabeçalho) fica em perfil.js. */

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


/* Reset local independente: não chama APIs, não toca na lógica do ESP32 nem altera cálculos. */
(()=>{
'use strict';
const open=document.getElementById('hydroResetOpen');
const dialog=document.getElementById('hydroResetDialog');
const agree=document.getElementById('hydroResetAgree');
const confirm=document.getElementById('hydroResetConfirm');
const cancel=document.getElementById('hydroResetCancel');
const feedback=document.getElementById('hydroResetFeedback');
if(!open||!dialog||!agree||!confirm||!cancel||!feedback)return;
const keyPattern=/^hydrocasa(?:[.:_-]|$)/i;
function removeProjectKeys(storage){
 const keys=[];
 for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key&&keyPattern.test(key))keys.push(key);}
 keys.forEach(key=>storage.removeItem(key));
}
open.addEventListener('click',()=>{
 agree.checked=false;confirm.disabled=true;feedback.hidden=true;feedback.textContent='';
 if(typeof dialog.showModal==='function')dialog.showModal();
 else if(window.confirm('Apagar os dados do HydroCasa salvos neste navegador? Essa ação não apaga os dados internos do ESP32.')){
  performReset();
 }
});
agree.addEventListener('change',()=>{confirm.disabled=!agree.checked;});
cancel.addEventListener('click',()=>dialog.close());
function performReset(){
 confirm.disabled=true;cancel.disabled=true;
 try{
  removeProjectKeys(window.localStorage);
  removeProjectKeys(window.sessionStorage);
  // Impede apenas que o cenário automático padrão reapareça após a limpeza.
  window.sessionStorage.setItem('hydrocasa:reset-local-pendente','1');
  window.location.replace(window.location.pathname);
 }catch(e){
  feedback.textContent='Não foi possível concluir a limpeza neste navegador. Verifique as permissões de armazenamento e tente novamente.';
  feedback.hidden=false;cancel.disabled=false;confirm.disabled=!agree.checked;
 }
}
confirm.addEventListener('click',()=>{if(!agree.checked)return;performReset();});
})();
