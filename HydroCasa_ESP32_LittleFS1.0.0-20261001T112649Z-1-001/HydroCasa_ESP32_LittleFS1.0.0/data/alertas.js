/* Motor puro de regras: não lê armazenamento, DOM ou ESP32. Entradas são cópias de dados. */
(function(root){
'use strict';
const C=root.HydroAlertConfig||(typeof require==='function'?require('./alertas-config.js'):null);
const num=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const fmt=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:1});
const result=(id,tipo,nivel,alvo,valor,referencia,mensagem)=>({id,tipo,nivel,alvo,valor,referencia,diferenca:referencia>0?Math.round((valor/referencia-1)*100):null,mensagem});
const complete=d=>!!(d&&d.readings>0&&d.partial===false&&!d.profileMixed&&num(d.total1)&&num(d.total2));
function atividadeDuracao(d,p,registros){
 const alerts=[];for(const [day,items] of Object.entries(registros||{}))for(const [i,r] of (Array.isArray(items)?items:[]).entries()){
  const a=d.catalog?.find(x=>x.id===r.id);if(!a?.minutes||!num(r.minutes)||r.minutes<=a.minutes*C.activityRatio)continue;
  alerts.push(result('duracao:'+day+':'+i+':'+r.id,'atividade','Atenção',r.name,r.minutes,a.minutes, r.name+' de '+fmt(r.minutes)+' min: mais longo que o comum ('+fmt(a.minutes)+' min). Diminuir alguns minutos economiza água.'));
 }return alerts;
}
function atividadeTotal(d,p,registros){
 const alerts=[];for(const [day,items] of Object.entries(registros||{}))for(const [i,r] of (Array.isArray(items)?items:[]).entries()){
  const a=d.catalog?.find(x=>x.id===r.id);if(!a||!num(a.liters)||a.liters===0||!num(r.liters)||!num(r.quantity)||!r.quantity)continue;
  const base=a.liters*r.quantity*(a.perPerson?(Number.isInteger(r.residentsUsed)?r.residentsUsed:NaN):1);
  if(!Number.isFinite(base)||base<=0||r.liters<=base*C.activityRatio)continue;
  alerts.push(result('volume-atividade:'+day+':'+i+':'+r.id,'atividade','Atenção',r.name,r.liters,base,r.name+' gastou cerca de '+fmt(r.liters)+' L, mais que o comum ('+fmt(base)+' L). Confira se o tempo e o número de vezes estão certos.'));
 }return alerts;
}
function consumoDiario(d,p){
 if(!d.online||!p||p.scope!=='whole'||!num(p.referenceLiters)||!p.referenceLiters||!Number.isInteger(p.residents)||p.residents<1)return null;
 const day=d.today, h=d.history?.[day];if(!h||!(h.readings>0)||!Number.isFinite(h.total1)||!Number.isFinite(h.total2)||h.total1<0||h.total2<0)return null;
 const base=p.referenceLiters*p.residents,threshold=base*(1+Math.max(C.dailyTolerancePercent,Number(p.tolerance)||0)/100),volume=h.total1+h.total2;
 if(volume<=threshold)return null;
 return result('consumo:'+day,'sensor','Acima do padrão','Residência',volume,threshold,(h.partial?'Hoje a casa já usou ':'Neste dia a casa usou ')+fmt(volume)+' L, '+fmt((volume/threshold-1)*100)+'% além do limite de '+fmt(threshold)+' L para '+p.residents+' moradores.'+(h.partial?' O dia ainda não terminou.':'')+' Veja onde a água foi mais usada.');
}
function fluxoContinuo(d){
 if(!d.online||!Array.isArray(d.observations))return [];
 const out=[];for(const ramal of [1,2]){
  const series=d.observations.filter(x=>num(x.t)&&num(x['flow'+ramal])&&d.now-x.t<=C.continuousMinutes*60000+30000).sort((a,b)=>a.t-b.t);
  if(series.length<C.continuousConfirmations)continue;
  let seq=[];for(const point of series){if(point['flow'+ramal]>C.minimumFlow&&(seq.length===0||point.t-seq[seq.length-1].t<=15000))seq.push(point);else seq=point['flow'+ramal]>C.minimumFlow?[point]:[];}
  if(seq.length>=C.continuousConfirmations&&seq[seq.length-1].t-seq[0].t>=C.continuousMinutes*60000)
   out.push(result('fluxo:'+ramal,'sensor','Atenção','Ramal '+('0'+ramal).slice(-2),(seq[seq.length-1].t-seq[0].t)/60000,C.continuousMinutes,'Água correndo sem parar há '+fmt((seq[seq.length-1].t-seq[0].t)/60000)+' min no Ramal '+('0'+ramal).slice(-2)+'. Veja se ficou alguma torneira aberta.'));
 }return out;
}
function picoVazao(d){
 if(!d.online)return [];
 const out=[];for(const ramal of [1,2]){
  const samples=(d.observations||[]).filter(x=>num(x['flow'+ramal])&&x['flow'+ramal]>0).slice(-C.peakSamples-1);
  if(samples.length<C.peakSamples+1)continue;
  const current=samples[samples.length-1]['flow'+ramal],prior=samples.slice(0,-1),avg=prior.reduce((s,x)=>s+x['flow'+ramal],0)/prior.length;
  if(avg>=C.peakMinimumLpm&&current>avg*C.peakMultiplier)out.push(result('pico:'+ramal,'sensor','Atenção','Ramal '+ramal,current,avg,'A água está saindo com mais força que o normal no Ramal '+('0'+ramal).slice(-2)+': '+fmt(current)+' L por minuto (o comum é '+fmt(avg)+'). Vale conferir.'));
 }return out;
}
function concentracao(d){
 if(!d.online)return [];
 const days=Object.entries(d.history||{}).filter(([k,h])=>k<d.today&&complete(h)&&h.total1+h.total2>0).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,C.shareHistoryDays);
 if(days.length<C.minimumHistoryDays)return [];
 const now=d.history?.[d.today];if(!complete(now)||now.total1+now.total2<=0)return [];
 const sum=days.reduce((s,[k,h])=>s+h.total1+h.total2,0),prior1=days.reduce((s,[k,h])=>s+h.total1,0)/sum,share1=now.total1/(now.total1+now.total2);
 return [1,2].flatMap(ramal=>{
  const current=ramal===1?share1:1-share1,prior=ramal===1?prior1:1-prior1;
  return (current-prior)*100>C.shareIncreasePoints?[result('concentracao:'+ramal+':'+d.today,'sensor','Atenção','Ramal '+ramal,current*100,prior*100,'O Ramal '+('0'+ramal).slice(-2)+' usou '+fmt(current*100)+'% da água de hoje; normalmente fica em '+fmt(prior*100)+'%. Vale conferir.')]:[];
 });
}
function tendencia(d){
 if(!d.online)return null;
 const days=Object.entries(d.history||{}).filter(([k,h])=>k<d.today&&complete(h)).sort((a,b)=>b[0].localeCompare(a[0]));
 if(days.length<C.trendRecentDays+C.trendPreviousDays)return null;
 const recent=days.slice(0,C.trendRecentDays),previous=days.slice(C.trendRecentDays,C.trendRecentDays+C.trendPreviousDays);
 const avg=arr=>arr.reduce((s,[k,h])=>s+h.total1+h.total2,0)/arr.length;
 const a=avg(recent),b=avg(previous);
 if(b<=0||a<=b*C.trendRatio)return null;
 return result('tendencia:'+d.today,'sensor','Atenção','Residência',a,b,'Nos últimos dias a casa usou '+fmt(a)+' L por dia, '+fmt((a/b-1)*100)+'% a mais que antes ('+fmt(b)+' L por dia). Algo mudou na rotina?');
}
function sensorParado(d){
 if(!d.online)return [];
 const out=[];const points=(d.observations||[]).filter(x=>num(x.t)).sort((a,b)=>a.t-b.t);
 for(const ramal of [1,2]){
  const other=ramal===1?2:1;
  const seq=points.filter(x=>d.now-x.t<=C.silentSensorMinutes*60000+30000);
  if(seq.length<C.continuousConfirmations)continue;
  const first=seq[0],last=seq[seq.length-1];
  if(last.t-first.t<C.silentSensorMinutes*60000||!num(first['pulse'+ramal])||!num(last['pulse'+ramal])||last['pulse'+ramal]!==first['pulse'+ramal])continue;
  if(!seq.every(x=>num(x['pulse'+ramal])&&x['pulse'+ramal]===first['pulse'+ramal]&&x['flow'+other]>C.minimumFlow))continue;
  out.push(result('sem-pulso:'+ramal,'sensor','Informativo','Ramal '+ramal,C.silentSensorMinutes,C.silentSensorMinutes,'O sensor do Ramal '+('0'+ramal).slice(-2)+' não está medindo água enquanto o outro mede. Confira se ele está bem ligado.'));
 }return out;
}
const rules=[atividadeDuracao,atividadeTotal,consumoDiario,fluxoContinuo,picoVazao,concentracao,tendencia,sensorParado];
function avaliar(dados,perfil,atividades){
 const all=[];for(const rule of rules){const v=rule(dados,perfil,atividades);if(Array.isArray(v))all.push(...v);else if(v)all.push(v);}return all;
}
const api={config:C,rules:{atividadeDuracao,atividadeTotal,consumoDiario,fluxoContinuo,picoVazao,concentracao,tendencia,sensorParado},avaliar};
root.HydroAlerts=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
