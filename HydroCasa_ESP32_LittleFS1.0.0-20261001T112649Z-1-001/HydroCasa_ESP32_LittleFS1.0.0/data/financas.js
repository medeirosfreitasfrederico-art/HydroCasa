/* HydroCasa — regras puras de períodos, custos e previsões.
   Não lê DOM, ESP32 nem armazenamento por conta própria: recebe cópias dos dados.
   Volumes internos em litros (como no restante do projeto); dinheiro em reais. */
(function(root){
'use strict';
const C=root.HydroConsumption||(typeof require==='function'?require('./consumption.js'):null);
const STORAGE_KEY='hydrocasa:financeiro';
const defaults={version:1,pricePerM3:null,fixedMonthly:0,monthlyGoal:null,householdName:''};
const MAX_DAYS=366;

const pad=n=>String(n).padStart(2,'0');
const keyOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseKey=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k||''));if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3],12);return keyOf(d)===k?d:null;};
const daysInMonth=d=>new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
const isNum=v=>typeof v==='number'&&Number.isFinite(v);

/* ---------- Configuração financeira ---------- */
function settings(input){
 const s={...defaults,...(input&&typeof input==='object'?input:{})};
 const optional=(v,max,label)=>{
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v);if(!Number.isFinite(n)||n<0||n>max)throw new Error(label);return n;
 };
 s.pricePerM3=optional(s.pricePerM3,1000,'Informe um preço por m³ entre R$ 0 e R$ 1.000.');
 if(s.pricePerM3===0)s.pricePerM3=null;
 s.fixedMonthly=optional(s.fixedMonthly,10000,'A taxa fixa mensal deve ficar entre R$ 0 e R$ 10.000.')??0;
 s.monthlyGoal=optional(s.monthlyGoal,100000,'A meta mensal deve ficar entre R$ 0 e R$ 100.000.');
 if(s.monthlyGoal===0)s.monthlyGoal=null;
 s.householdName=String(s.householdName||'').trim().slice(0,60);
 s.version=1;
 return s;
}
function maybeSettings(input){try{return settings(input);}catch{return {...defaults};}}
function read(storage){try{return maybeSettings(JSON.parse(storage.getItem(STORAGE_KEY)||'null'));}catch{return {...defaults};}}
function write(storage,input){const s=settings(input);storage.setItem(STORAGE_KEY,JSON.stringify(s));return s;}
/** Preço médio por m³ a partir da conta: (valor total − taxa fixa) ÷ m³ faturados. */
function priceFromBill({billTotal,billM3,fixedMonthly=0}){
 const total=Number(billTotal),m3=Number(billM3),fixed=Number(fixedMonthly)||0;
 if(!Number.isFinite(total)||total<=0)throw new Error('Informe o valor total da conta.');
 if(!Number.isFinite(m3)||m3<=0||m3>100000)throw new Error('Informe os m³ faturados na conta (veja o campo "consumo" da fatura).');
 if(fixed<0||fixed>=total)throw new Error('A taxa fixa precisa ser menor que o valor total da conta.');
 return Math.round((total-fixed)/m3*100)/100;
}

/* ---------- Formatação ---------- */
function money(v){return isNum(v)?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';}
function m3(liters,digits=3){
 if(!isNum(liters)||liters<0)return '—';
 const n=liters/1000;if(n>0&&n<0.0005&&digits<=3)return '< 0,001 m³';
 return n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits})+' m³';
}
function liters(l){return isNum(l)?Math.round(l).toLocaleString('pt-BR')+' L':'—';}
function percent(v,digits=0){return isNum(v)?v.toLocaleString('pt-BR',{maximumFractionDigits:digits,minimumFractionDigits:digits})+'%':'—';}
function dateLabel(key,opts={day:'2-digit',month:'2-digit',year:'numeric'}){const d=parseKey(key);return d?d.toLocaleDateString('pt-BR',opts):key;}
function costOf(l,s){return s&&isNum(s.pricePerM3)&&isNum(l)?l/1000*s.pricePerM3:null;}

/* ---------- Períodos ---------- */
const PERIODS=[
 {id:'today',label:'Hoje',hint:'Somente o dia atual'},
 {id:'yesterday',label:'Ontem',hint:'O dia anterior completo'},
 {id:'day',label:'Um dia específico',hint:'Escolha a data'},
 {id:'last7',label:'Últimos 7 dias',hint:'Hoje e os 6 dias anteriores'},
 {id:'thisMonth',label:'Este mês',hint:'Do dia 1 até o fim do mês, com previsão'},
 {id:'lastMonth',label:'Mês passado',hint:'O mês anterior completo'},
 {id:'month',label:'Um mês específico',hint:'Escolha o mês'},
 {id:'last30',label:'Últimos 30 dias',hint:'Hoje e os 29 dias anteriores'},
 {id:'thisYear',label:'Este ano',hint:'De janeiro até dezembro, com previsão'},
 {id:'lastYear',label:'Ano passado',hint:'Janeiro a dezembro do ano anterior'},
 {id:'custom',label:'Personalizado',hint:'Escolha as datas inicial e final'}
];
function range(fromKey,toKey){
 const a=parseKey(fromKey),b=parseKey(toKey);
 if(!a||!b)throw new Error('Informe datas válidas.');
 if(a>b)throw new Error('A data inicial precisa ser anterior ou igual à data final.');
 const days=[];for(const d=new Date(a);d<=b;d.setDate(d.getDate()+1)){if(days.length>=MAX_DAYS)throw new Error('Escolha um período de até 366 dias.');days.push(keyOf(d));}
 return days;
}
/** Converte a escolha do usuário em datas. opts: {day:'AAAA-MM-DD', month:'AAAA-MM', from, to} */
function resolvePeriod(kind,opts={},now=new Date()){
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
 const shift=n=>{const d=new Date(today);d.setDate(d.getDate()+n);return d;};
 const monthName=d=>d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 let from,to,title;
 switch(kind){
  case 'today':from=to=today;title='Hoje, '+today.toLocaleDateString('pt-BR');break;
  case 'yesterday':from=to=shift(-1);title='Ontem, '+from.toLocaleDateString('pt-BR');break;
  case 'day':{const d=parseKey(opts.day);if(!d)throw new Error('Escolha o dia do relatório.');from=to=d;title=d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});break;}
  case 'last7':from=shift(-6);to=today;title='Últimos 7 dias';break;
  case 'last30':from=shift(-29);to=today;title='Últimos 30 dias';break;
  case 'thisMonth':from=new Date(today.getFullYear(),today.getMonth(),1,12);to=new Date(today.getFullYear(),today.getMonth()+1,0,12);title='Mês de '+monthName(today);break;
  case 'lastMonth':from=new Date(today.getFullYear(),today.getMonth()-1,1,12);to=new Date(today.getFullYear(),today.getMonth(),0,12);title='Mês de '+monthName(from);break;
  case 'month':{const m=/^(\d{4})-(\d{2})$/.exec(String(opts.month||''));if(!m||+m[2]<1||+m[2]>12)throw new Error('Escolha o mês do relatório.');from=new Date(+m[1],+m[2]-1,1,12);to=new Date(+m[1],+m[2],0,12);title='Mês de '+monthName(from);break;}
  case 'thisYear':from=new Date(today.getFullYear(),0,1,12);to=new Date(today.getFullYear(),11,31,12);title='Ano de '+today.getFullYear();break;
  case 'lastYear':from=new Date(today.getFullYear()-1,0,1,12);to=new Date(today.getFullYear()-1,11,31,12);title='Ano de '+(today.getFullYear()-1);break;
  case 'custom':{const days=range(opts.from,opts.to);from=parseKey(days[0]);to=parseKey(days.at(-1));title=from.toLocaleDateString('pt-BR')+' a '+to.toLocaleDateString('pt-BR');break;}
  default:throw new Error('Tipo de período desconhecido.');
 }
 const days=range(keyOf(from),keyOf(to));
 // Datas futuras não têm leitura; servem apenas para a previsão do período.
 const todayKey=keyOf(today);
 return {kind,title,from:days[0],to:days.at(-1),days,todayKey,elapsed:days.filter(d=>d<=todayKey),future:days.filter(d=>d>todayKey),
  label:PERIODS.find(p=>p.id===kind)?.label||'Período'};
}

/* ---------- Resumo do período ---------- */
const validDay=h=>!!(h&&h.readings>0&&isNum(h.total1)&&isNum(h.total2)&&h.total1>=0&&h.total2>=0);
/**
 * Calcula tudo que o relatório e o perfil exibem.
 * input: {period, history, currentProfile, settings, activityRecords, alerts, now}
 */
function summarize({period,history={},currentProfile=null,settings:s=defaults,activityRecords={},alerts=[],now=new Date()}){
 const fin=maybeSettings(s),profileNow=C?C.maybeProfile(currentProfile):currentProfile;
 const rows=period.days.map(day=>{
  const raw=history[day],h=validDay(raw)?raw:null,date=parseKey(day);
  const p=(h&&C?C.maybeProfile(h.profile):null)||profileNow;
  const reference=p?p.residents*p.referenceLiters:null;
  const total=h?h.total1+h.total2:null;
  const monthDays=daysInMonth(date);
  const compare=h&&C?C.compareDay(h,p,{closed:day<period.todayKey}):null;
  const tolerance=p?p.tolerance:10;
  const vsReference=h&&reference?total/reference*100-100:null;
  return {day,date,future:day>period.todayKey,h,demo:!!h?.demo,partial:h?h.partial!==false:false,total,r1:h?h.total1:null,r2:h?h.total2:null,
   profile:p,reference,tolerance,vsReference,above:vsReference!==null&&vsReference>tolerance,
   cost:h?costOf(total,fin):null,fixedShare:fin.fixedMonthly/monthDays,goalShare:fin.monthlyGoal?fin.monthlyGoal/monthDays:null,
   status:compare?compare.label:h?'':'Sem leituras',statusCode:compare?compare.code:'none'};
 });
 const data=rows.filter(r=>r.h),elapsed=rows.filter(r=>!r.future);
 const sum=(arr,f)=>arr.reduce((a,r)=>a+(isNum(f(r))?f(r):0),0);
 const measured=sum(data,r=>r.total),r1=sum(data,r=>r.r1),r2=sum(data,r=>r.r2);
 const average=data.length?measured/data.length:null;
 const referenceElapsed=elapsed.every(r=>r.reference===null)?null:sum(elapsed,r=>r.reference);
 const referenceFull=rows.every(r=>r.reference===null)?null:sum(rows,r=>r.reference);
 const referenceWithData=data.every(r=>r.reference===null)?null:sum(data,r=>r.reference);
 // Previsão: os dias sem leitura (passados ou futuros) recebem a média dos dias medidos.
 const projected=average!==null?measured+average*(rows.length-data.length):null;
 const fixedFull=sum(rows,r=>r.fixedShare),fixedElapsed=sum(elapsed,r=>r.fixedShare);
 const goalFull=fin.monthlyGoal?sum(rows,r=>r.goalShare):null,goalElapsed=fin.monthlyGoal?sum(elapsed,r=>r.goalShare):null;
 const price=fin.pricePerM3;
 const withFixed=(v,f)=>v===null?null:v+f;
 const money={
  configured:isNum(price),price,fixedMonthly:fin.fixedMonthly,
  measured:costOf(measured,fin),
  measuredWithFixed:withFixed(costOf(measured,fin),fixedElapsed),
  expected:referenceFull!==null?costOf(referenceFull,fin):null,
  expectedWithFixed:referenceFull!==null?withFixed(costOf(referenceFull,fin),fixedFull):null,
  expectedElapsed:referenceElapsed!==null?costOf(referenceElapsed,fin):null,
  projected:projected!==null?costOf(projected,fin):null,
  projectedWithFixed:projected!==null?withFixed(costOf(projected,fin),fixedFull):null,
  fixedFull,fixedElapsed,
  perDay:average!==null?costOf(average,fin):null,
  goal:goalFull,goalElapsed,
  // Diferença em relação à referência nos dias que têm leitura (comparação justa, mesmos dias).
  vsReferenceSameDays:referenceWithData!==null&&isNum(price)?costOf(measured-referenceWithData,fin):null
 };
 if(money.goal!==null&&money.projectedWithFixed!==null){money.goalRemaining=money.goal-(money.measuredWithFixed??0);money.goalStatus=money.projectedWithFixed>money.goal?'above':'within';money.goalPercent=money.projectedWithFixed/money.goal*100;}
 const residents=profileNow?.residents||data.find(r=>r.profile)?.profile.residents||null;
 const sorted=[...data].sort((a,b)=>b.total-a.total);
 // Atividades: agrupadas por tipo.
 const activityMap=new Map();let activityLiters=0,activityCount=0;
 for(const day of period.days)for(const r of Array.isArray(activityRecords?.[day])?activityRecords[day]:[]){
  if(!r||!isNum(r.liters)||r.liters<0)continue;
  const key=r.id||r.name;const item=activityMap.get(key)||{name:String(r.name||'Atividade'),count:0,occurrences:0,liters:0,days:new Set()};
  item.count++;item.occurrences+=Number(r.quantity)||1;item.liters+=r.liters;item.days.add(day);activityMap.set(key,item);activityLiters+=r.liters;activityCount++;
 }
 const activities=[...activityMap.values()].map(a=>({...a,days:a.days.size,cost:costOf(a.liters,fin),share:activityLiters?a.liters/activityLiters*100:0})).sort((a,b)=>b.liters-a.liters);
 // Alertas criados no período.
 const periodAlerts=(Array.isArray(alerts)?alerts:[]).filter(a=>a&&isNum(a.criadoEm)).map(a=>({...a,day:keyOf(new Date(a.criadoEm))})).filter(a=>a.day>=period.from&&a.day<=period.to).sort((a,b)=>b.criadoEm-a.criadoEm);
 // Agrupamento mensal para períodos longos.
 const months=new Map();
 for(const r of rows){const k=r.day.slice(0,7);const m=months.get(k)||{month:k,days:0,dataDays:0,total:0,r1:0,r2:0,reference:0,hasReference:false};m.days++;if(r.h){m.dataDays++;m.total+=r.total;m.r1+=r.r1;m.r2+=r.r2;}if(r.reference!==null&&!r.future){m.reference+=r.reference;m.hasReference=true;}months.set(k,m);}
 const monthly=[...months.values()].map(m=>({...m,average:m.dataDays?m.total/m.dataDays:null,cost:m.dataDays?costOf(m.total,fin):null,reference:m.hasReference?m.reference:null}));
 // Média por dia da semana (somente dias medidos).
 const week=[0,1,2,3,4,5,6].map(i=>{const list=data.filter(r=>r.date.getDay()===i);return {weekday:i,days:list.length,average:list.length?sum(list,r=>r.total)/list.length:null};});
 const ratio=referenceWithData?measured/referenceWithData*100-100:null;
 const scopeWhole=profileNow?.scope==='whole';
 return {
  period,rows,data,measured,r1,r2,average,projected,referenceElapsed,referenceFull,referenceWithData,ratio,
  coverage:{total:rows.length,elapsed:elapsed.length,future:rows.length-elapsed.length,withData:data.length,partial:data.filter(r=>r.partial&&!r.demo).length,demo:data.filter(r=>r.demo).length,empty:elapsed.length-data.length},
  daysAbove:data.filter(r=>r.above).length,
  peak:sorted[0]||null,lowest:sorted.length>1?sorted.at(-1):null,
  residents,perResident:residents&&data.length?measured/residents:null,perResidentDay:residents&&average!==null?average/residents:null,
  money,settings:fin,profile:profileNow,scopeWhole,
  activities,activityLiters,activityCount,alerts:periodAlerts,monthly,week,
  generatedAt:now
 };
}

/** Texto curto e claro sobre a situação do período, para pessoas sem conhecimento técnico. */
function verdict(sum){
 if(!sum.data.length)return {code:'empty',title:'Sem leituras no período',text:'Não há medições registradas nestes dias. Conecte o ESP32 e mantenha o painel aberto para registrar o consumo.'};
 if(sum.ratio===null)return {code:'unknown',title:'Configure os moradores',text:'Informe quantas pessoas moram na casa para comparar o consumo com uma referência.'};
 const tol=sum.profile?.tolerance??10,r=sum.ratio;
 const scope=sum.scopeWhole?'':' Como os sensores medem só parte da casa, a comparação é apenas ilustrativa.';
 if(r>tol)return {code:'above',title:`Consumo ${percent(r)} acima da referência`,text:`Nos dias medidos, a casa usou mais água do que a referência de ${sum.residents} morador(es).${scope}`};
 if(r<-tol)return {code:'below',title:`Consumo ${percent(Math.abs(r))} abaixo da referência`,text:`Nos dias medidos, o consumo ficou abaixo da referência de ${sum.residents} morador(es).${scope}`};
 return {code:'within',title:'Consumo dentro da faixa de referência',text:`O consumo dos dias medidos ficou dentro da faixa de ±${percent(tol)} da referência.${scope}`};
}

/**
 * Nível de gasto para o tom visual do site.
 * percent = quanto o consumo ficou acima da referência (ex.: 30 = 30% acima).
 * Até a tolerância do perfil é "normal"; as faixas seguintes nunca começam antes dela.
 */
const LEVELS=[
 {id:'leve',label:'Levemente acima',upTo:25},
 {id:'moderado',label:'Moderadamente acima',upTo:50},
 {id:'alto',label:'Gasto alto',upTo:100},
 {id:'extremo',label:'Extremamente acima',upTo:Infinity}
];
function spendingLevel(percent,tolerance=10){
 if(!isNum(percent))return null;
 const tol=isNum(tolerance)&&tolerance>=0?tolerance:10;
 if(percent<=tol)return {id:'normal',label:'Dentro da referência',percent};
 const level=LEVELS.find(l=>percent<=Math.max(l.upTo,tol))||LEVELS.at(-1);
 return {id:level.id,label:level.label,percent};
}

const api={STORAGE_KEY,defaults,MAX_DAYS,PERIODS,LEVELS,spendingLevel,settings,maybeSettings,read,write,priceFromBill,money,m3,liters,percent,dateLabel,costOf,keyOf,parseKey,daysInMonth,range,resolvePeriod,summarize,verdict};
root.HydroFinance=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
