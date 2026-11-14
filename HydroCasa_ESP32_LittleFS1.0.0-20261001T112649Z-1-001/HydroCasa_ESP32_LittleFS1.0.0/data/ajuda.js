/* HydroCasa — botão de ajuda "?".
   Textos de apoio ficam escondidos atrás de um círculo com "?"; ao clicar, a explicação aparece.
   Uso em HTML gerado:  HydroAjuda.html('Texto explicativo')
   Uso em HTML estático: <h3 data-ajuda="Texto explicativo">Título</h3>  (o botão é acrescentado no fim)
   Fecha com Esc, com clique fora ou abrindo outra ajuda. No celular, abre como uma folha na parte de baixo. */
(()=>{'use strict';
let seq=0;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** text pode conter HTML simples (já confiável, escrito pelo próprio site). */
function html(text,label='O que é isto?'){
  const id='hcAjuda'+(++seq);
  return `<span class="hc-help-wrap"><button type="button" class="hc-help" aria-label="${esc(label)}" aria-expanded="false" aria-controls="${id}">?</button><span class="hc-help-pop" id="${id}" role="note" hidden><span class="hc-help-text">${text}</span><button type="button" class="hc-help-close" aria-label="Fechar explicação">×</button></span></span>`;
}
function popOf(b){return document.getElementById(b.getAttribute('aria-controls'));}
function close(b,focus=false){b.setAttribute('aria-expanded','false');const p=popOf(b);if(p){p.hidden=true;p.style.left=p.style.right=p.style.transform='';}if(focus)b.focus();}
function closeAll(except){document.querySelectorAll('.hc-help[aria-expanded="true"]').forEach(b=>{if(b!==except)close(b);});}
function open(b){
  closeAll(b);const p=popOf(b);if(!p)return;
  b.setAttribute('aria-expanded','true');p.hidden=false;
  if(matchMedia('(max-width:600px)').matches)return; // celular: folha fixa embaixo (CSS)
  // Mantém o balão dentro da tela.
  const r=p.getBoundingClientRect(),m=12;
  if(r.right>innerWidth-m){p.style.left='auto';p.style.right='0';p.style.transform='none';}
  else if(r.left<m){p.style.left='0';p.style.right='auto';p.style.transform='none';}
}
function scan(root=document){
  root.querySelectorAll('[data-ajuda]:not([data-ajuda-pronto])').forEach(el=>{
    el.setAttribute('data-ajuda-pronto','');el.insertAdjacentHTML('beforeend',' '+html(esc(el.dataset.ajuda),el.dataset.ajudaRotulo||'O que é isto?'));
  });
}
document.addEventListener('click',e=>{
  const b=e.target.closest('.hc-help');
  if(b){e.preventDefault();b.getAttribute('aria-expanded')==='true'?close(b):open(b);return;}
  const x=e.target.closest('.hc-help-close');
  if(x){const btn=document.querySelector(`.hc-help[aria-controls="${x.closest('.hc-help-pop').id}"]`);if(btn)close(btn,true);return;}
  if(!e.target.closest('.hc-help-pop'))closeAll();
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  const b=document.querySelector('.hc-help[aria-expanded="true"]');if(b){e.stopPropagation();close(b,true);}
},true);
window.HydroAjuda={html,scan,closeAll};
document.addEventListener('DOMContentLoaded',()=>scan());
scan();
})();
