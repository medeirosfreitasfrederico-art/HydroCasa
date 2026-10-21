/* MODO TEMPORÁRIO DE TESTES — apagar este arquivo e seu CSS para reverter.
 * Somente sessionStorage de simulação. Nunca altera estado/DOM de leituras reais.
 * Os valores são cenários de BANHOS, não duas medições independentes de ramais.
 */
(()=>{
'use strict';
const STORE='hydrocasa:simulacao',q=id=>document.getElementById(id);
const limits=[[1,10],[1,30],[1,4],[3,20],[7,365]];
let values=null,previous='',hasReal=false,blocked=false;
const valid=v=>Array.isArray(v)&&v.length===5&&v.every((n,i)=>Number.isFinite(n)&&n>=limits[i][0]&&n<=limits[i][1])&&[7,30,365].includes(v[4]);
const fmt=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2});
const realPresent=()=>{
 try{const d=JSON.parse(localStorage.getItem('hydrocasa_ledger_v2')||'{}');return !!Object.values(d.history||{}).some(x=>x&&x.readings>0)}catch{return true}
};
const online=()=>document.body.dataset.connectionState==='online';
const roots=[
 ['dashboard','Visão geral'],
 ['calendar','Calendário'],
 ['analysis','Análise'],
 ['activities','Atividades'],
 ['consumption-page','Meu consumo'],
];
const boxes=new Map();
for(const [id,name] of roots){
 const el=q(id);if(!el)continue;
 const box=document.createElement('section');box.className='sim-test-panel';box.hidden=true;
 box.setAttribute('aria-label','Demonstração temporária de '+name);
 box.innerHTML='<div class="sim-test-head"><span class="sim-test-mark">◈ DEMONSTRAÇÃO · TESTE TEMPORÁRIO</span><button type="button" class="sim-test-hide">Ocultar teste</button></div><h3>Pré-visualização com dados fictícios</h3><p class="sim-test-description">Somente projeção de banhos. Nenhuma leitura é atribuída aos sensores, ao calendário ou ao histórico real.</p><div class="sim-test-values"></div><div class="sim-test-plot" role="img"></div><div class="sim-test-table"></div><p class="sim-test-hint">Altere os controles na aba Simulador para atualizar os resultados deste teste.</p>';
 const heading=el.querySelector('.section-heading')||el.querySelector('header')||el.firstElementChild;
 if(heading)heading.after(box);else el.prepend(box);
 box.querySelector('.sim-test-hide').onclick=()=>{blocked=true;for(const b of boxes.values())b.hidden=true;};
 boxes.set(id,box);
}
function buildSvg(daily,period){
 const pts=Array.from({length:7},(_,i)=>({day:i+1,liters:daily})),max=Math.max(1,daily*1.18);
 const width=680,height=190,base=150;
 const rects=pts.map((p,i)=>{const bar=p.liters/max*112,x=62+i*86;return '<rect x="'+x+'" y="'+(base-bar)+'" width="48" height="'+bar+'" rx="5" fill="#4a86f7" /><text x="'+(x+24)+'" y="170" text-anchor="middle" fill="currentColor" font-size="12">Dia '+p.day+'</text>';}).join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" aria-hidden="true" focusable="false"><line x1="43" y1="'+base+'" x2="657" y2="'+base+'" stroke="currentColor" opacity=".4"/><text x="6" y="18" fill="currentColor" font-size="12">Litros</text>'+rects+'</svg>';
}
function render(){
 const real=realPresent()||online();
 if(!values||real||blocked){for(const b of boxes.values())b.hidden=true;return;}
 const [people,minutes,showers,flow,days]=values,daily=people*minutes*showers*flow,total=daily*days;
 const valuesHtml='<div><span>Moradores (somente teste)</span><strong>'+fmt(people)+'</strong></div><div><span>Banhos por dia</span><strong>'+fmt(people*showers)+'</strong></div><div><span>Consumo estimado/dia</span><strong>'+fmt(daily)+' L</strong></div><div><span>Consumo em '+days+' dias</span><strong>'+fmt(total)+' L</strong></div><div><span>Estimativa por morador/dia</span><strong>'+fmt(daily/people)+' L</strong></div>';
 const table='<table><caption>Projeção ilustrativa: 7 dias de banhos com os mesmos parâmetros</caption><thead><tr><th scope="col">Dia de teste</th><th scope="col">Volume estimado (L)</th></tr></thead><tbody>'+Array.from({length:7},(_,i)=>'<tr><th scope="row">'+(i+1)+'</th><td>'+fmt(daily)+'</td></tr>').join('')+'</tbody></table>';
 for(const b of boxes.values()){b.hidden=false;b.querySelector('.sim-test-values').innerHTML=valuesHtml;b.querySelector('.sim-test-plot').innerHTML=buildSvg(daily,days);b.querySelector('.sim-test-plot').setAttribute('aria-label','Gráfico de demonstração: '+fmt(daily)+' litros estimados por dia ao longo de sete dias, sem leituras reais.');b.querySelector('.sim-test-table').innerHTML=table;}
}
try{const d=JSON.parse(sessionStorage.getItem(STORE)||'null');if(valid(d?.v))values=d.v;}catch{}
window.addEventListener('message',event=>{
 if(event.source!==q('simulatorFrame')?.contentWindow||event.origin!=='null')return;
 if(event.data?.type==='hydrocasa-demo-clear'){values=null;render();return;}
 if(event.data?.type==='hydrocasa-demo-values'&&valid(event.data.v)){values=event.data.v;blocked=false;render();}
});
q('demoClear')?.addEventListener('click',()=>{values=null;render();});
q('demoUseReal')?.addEventListener('click',()=>{values=null;render();});
window.addEventListener('storage',render);
new MutationObserver(render).observe(document.body,{attributes:true,attributeFilter:['data-connection-state']});
setInterval(render,3500);
render();
})();
