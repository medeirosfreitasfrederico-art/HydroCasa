/* HydroCasa: UX independente. Não acessa state, history ou APIs de medição. */
(()=>{
'use strict';
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const names={dashboard:'Visão geral',calendar:'Calendário',analysis:'Análise',activities:'Atividades',settings:'Sistema'};
const nav=q('.dashboard-shortcuts'),area=q('.dashboard-shortcuts-area'),hero=q('#dashboard-page .hero-premium'),guide=q('.getting-started'),house=q('.household-card'),metrics=q('.metrics-grid'),compare=q('.comparison-grid');
if(!nav||!hero||!guide||!house)return;
let interacted=false,guideDismissed=false,fromHistory=false;
try{guideDismissed=localStorage.getItem('hydrocasa:guia-oculto')==='1';interacted=sessionStorage.getItem('hydrocasa:navegou')==='1';}catch{}
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
dismiss.addEventListener('click',()=>{guideDismissed=true;try{localStorage.setItem('hydrocasa:guia-oculto','1');}catch{}apply(tabActive());help.focus();});
const help=document.createElement('button');help.type='button';help.className='ghost-btn ux-help';help.textContent='? Ajuda';help.setAttribute('aria-haspopup','dialog');
area.insertBefore(help,nav);
const personalize=document.createElement('details');personalize.className='ux-personalize';personalize.id='personalizar';
const summary=document.createElement('summary');summary.textContent='Personalizar residência';summary.setAttribute('aria-label','Abrir ou fechar perfil da residência');personalize.append(summary);
house.before(personalize);personalize.append(house);
const residents=q('#residentsInput');personalize.open=!(residents&&Number(residents.value)>0);
const overlay=document.createElement('div');overlay.className='ux-drawer';overlay.hidden=true;overlay.innerHTML='<section class="ux-drawer-content" role="dialog" aria-modal="true" aria-labelledby="uxHelpTitle"><button type="button" class="ux-help-close" aria-label="Fechar ajuda">×</button><h2 id="uxHelpTitle">Como usar seu painel</h2><div class="ux-help-body"></div></section>';
document.body.append(overlay);
const helpBody=overlay.querySelector('.ux-help-body');
helpBody.append(guide.querySelector('.getting-started-steps').cloneNode(true));
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
function tabActive(){return tabs.find(t=>t.classList.contains('active'))?.dataset.panel||'dashboard';}
function apply(id,scroll=false){
 if(!names[id])id='dashboard';
 for(const tab of tabs){const selected=tab.dataset.panel===id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
 const overview=id==='dashboard';
 guide.hidden=!overview||guideDismissed;
 personalize.hidden=!overview;
 metrics.hidden=!overview;
 compare.hidden=!overview;
 hero.classList.toggle('ux-hero-compact',interacted||!overview);
 hero.hidden=!overview;
 document.body.dataset.uxTab=id;
 document.title=names[id]+' | HydroCasa';
 const pane=q('#'+id);
 if(scroll&&pane){requestAnimationFrame(()=>{pane.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});}
}
function navigate(id,scroll=true,push=true){
 if(!names[id])return;
 if(tabActive()!==id)tabs.find(t=>t.dataset.panel===id)?.click();
 interacted=true;try{sessionStorage.setItem('hydrocasa:navegou','1');}catch{}
 apply(id,scroll);
 if(push&&!fromHistory){const u=new URL(location.href);u.hash=id==='dashboard'?'visao-geral':id==='analysis'?'analise':id==='activities'?'atividades':id==='calendar'?'calendario':'sistema';if(u.href!==location.href)history.pushState({hydroTab:id},'',u);}
}
tabs.forEach(t=>t.addEventListener('click',()=>navigate(t.dataset.panel,true,true)));
const hashToId={'#visao-geral':'dashboard','#calendario':'calendar','#analise':'analysis','#atividades':'activities','#sistema':'settings'};
function routeHash(){const id=hashToId[location.hash.toLowerCase()];if(!id)return;fromHistory=true;navigate(id,true,false);fromHistory=false;}
window.addEventListener('popstate',routeHash);window.addEventListener('hashchange',routeHash);
routeHash();apply(tabActive());
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
