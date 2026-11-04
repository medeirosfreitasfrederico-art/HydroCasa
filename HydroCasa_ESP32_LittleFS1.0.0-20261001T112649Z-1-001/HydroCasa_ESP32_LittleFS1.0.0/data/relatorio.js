/* HydroCasa — Relatório em PDF.
   Parte 1 (buildPdf): monta o documento a partir de um resumo de HydroFinance.summarize. Testável no Node.
   Parte 2 (interface): janela para escolher período, seções e valores da conta. Somente leitura do histórico:
   nunca grava ledger, snapshots ou perfil; grava apenas as preferências do relatório e os valores da conta. */
(function(root){
'use strict';
const F=root.HydroFinance||(typeof require==='function'?require('./financas.js'):null);
const P=root.HydroPDF||(typeof require==='function'?require('./pdf-simples.js'):null);

const SECTIONS=[
 {id:'summary',group:'Visão geral',title:'Resumo do período',desc:'Volume total, média por dia, dias com leitura e uma conclusão em linguagem simples.',essential:true},
 {id:'money',group:'Dinheiro',title:'Gastos em reais',desc:'Quanto já foi gasto, previsão para o período inteiro, valor esperado e meta mensal.',essential:true},
 {id:'reference',group:'Dinheiro',title:'Comparação com o esperado',desc:'Consumo medido × referência para os moradores, em m³, em % e em reais.',essential:true},
 {id:'chart',group:'Consumo',title:'Gráfico de consumo',desc:'Barras por dia (ou por mês em períodos longos) com a linha de referência.',essential:true},
 {id:'branches',group:'Consumo',title:'Consumo por ramal',desc:'Quanto cada ponto monitorado usou, a participação e o custo de cada um.'},
 {id:'table',group:'Consumo',title:'Tabela detalhada',desc:'Cada dia (ou mês) com volume, custo e situação da coleta.'},
 {id:'insights',group:'Consumo',title:'Destaques e padrões',desc:'Dia de maior e de menor consumo e a média por dia da semana.'},
 {id:'activities',group:'Contexto',title:'Atividades registradas',desc:'Banhos, lavagens e outros usos informados, com volume e custo estimados.'},
 {id:'alerts',group:'Contexto',title:'Alertas do período',desc:'Avisos que o painel gerou nas datas escolhidas.'},
 {id:'tips',group:'Contexto',title:'Dicas para economizar',desc:'Sugestões práticas de acordo com o resultado do período.'},
 {id:'profile',group:'Informações técnicas',title:'Perfil e tarifa usados',desc:'Moradores, referência, ramais e valores da conta usados nos cálculos.'},
 {id:'method',group:'Informações técnicas',title:'Como os números foram calculados',desc:'Fórmulas, limitações das medições e fontes consultadas.'}
];
const COLORS={primary:'#2563eb',violet:'#7c3aed',navy:'#0b1b3f',text:'#10182b',muted:'#5b6577',faint:'#8a94a6',line:'#dfe5ef',soft:'#f2f6fd',softViolet:'#f4f0fe',green:'#047857',greenSoft:'#e8f7f0',amber:'#b45309',amberSoft:'#fdf3e3',red:'#b91c1c',redSoft:'#fdecec',white:'#ffffff'};

/* =====================================================================
   Parte 1 — construção do PDF
   ===================================================================== */
function buildPdf(sum,opt={}){
 const sections=new Set(opt.sections||SECTIONS.map(s=>s.id));
 const fin=sum.settings,profile=sum.profile,period=sum.period,money=sum.money;
 const doc=P.create({title:'Relatório HydroCasa — '+period.title,subject:'Consumo de água e gastos estimados',author:fin.householdName||'HydroCasa',date:sum.generatedAt});
 const W=doc.width,M=42,CW=W-2*M,BOTTOM=790;
 let y=0,sectionNumber=0;
 const L1=v=>Number.isFinite(v)?v.toLocaleString('pt-BR',{maximumFractionDigits:1})+' L':'—';
 const m3=v=>F.m3(v),L=v=>F.liters(v),R=v=>F.money(v),pct=(v,d=0)=>F.percent(v,d);
 const both=v=>v===null||v===undefined?'—':m3(v)+'  ('+L(v)+')';
 const signed=v=>v===null||v===undefined?'—':(v>0?'+':'')+pct(v);
 const signedMoney=v=>v===null||v===undefined?'—':(v>0?'+ ':v<0?'− ':'')+R(Math.abs(v));
 const ramal=i=>(profile&&profile['ramal'+i])||('Ramal 0'+i);
 const long=period.days.length>62;
 const single=period.days.length===1;

 function header(){
  doc.rect(0,0,W,5,{fill:COLORS.primary});doc.rect(W*0.62,0,W*0.38,5,{fill:COLORS.violet});
  doc.text('HydroCasa',M,28,{size:9,bold:true,color:COLORS.primary});
  doc.text('Relatório de consumo de água',M+56,28,{size:9,color:COLORS.muted});
  doc.text(period.title,W-M,28,{size:9,color:COLORS.muted,align:'right'});
  doc.line(M,38,W-M,38,{color:COLORS.line});
 }
 function newPage(){doc.addPage();header();y=62;}
 function ensure(h){if(y+h>BOTTOM)newPage();}
 function fitSize(text,size,bold,max){while(size>7&&doc.textWidth(text,size,bold)>max)size-=.5;return size;}
 function para(text,o={}){
  const size=o.size||9.5,lh=o.lineHeight||size*1.45,x=o.x??M,w=o.width??CW;
  const lines=doc.wrap(text,size,o.bold,w);
  for(const line of lines){ensure(lh);doc.text(line,x,y+size,{size,bold:o.bold,color:o.color||COLORS.text});y+=lh;}
  y+=o.after??4;
 }
 function sectionTitle(id,subtitle,keep=70){
  // keep = altura mínima do conteúdo que precisa ficar junto do título (evita título órfão).
  const s=SECTIONS.find(x=>x.id===id);sectionNumber++;
  ensure(88+keep);if(y>70)y+=10;
  doc.text(String(sectionNumber).padStart(2,'0')+'  ·  '+s.group.toUpperCase(),M,y+8,{size:7.5,bold:true,color:COLORS.primary});
  doc.text(s.title,M,y+27,{size:15,bold:true,color:COLORS.text});
  y+=36;
  if(subtitle){const lines=doc.wrap(subtitle,9,false,CW);lines.forEach((l,i)=>doc.text(l,M,y+9+i*13,{size:9,color:COLORS.muted}));y+=lines.length*13+2;}
  doc.line(M,y+4,W-M,y+4,{color:COLORS.line});y+=16;
 }
 function cards(items,o={}){
  const cols=o.cols||items.length,gap=10,w=(CW-gap*(cols-1))/cols,h=o.height||74;
  for(let i=0;i<items.length;i+=cols){
   ensure(h+10);
   items.slice(i,i+cols).forEach((it,j)=>{
    const x=M+j*(w+gap);
    doc.rect(x,y,w,h,{fill:it.fill||COLORS.soft,radius:8});
    doc.rect(x,y+10,3,h-20,{fill:it.accent||COLORS.primary,radius:1.5});
    doc.text(it.label.toUpperCase(),x+13,y+19,{size:fitSize(it.label.toUpperCase(),7,true,w-22),bold:true,color:COLORS.muted});
    const vs=fitSize(it.value,o.valueSize||17,true,w-24);
    doc.text(it.value,x+13,y+44,{size:vs,bold:true,color:it.color||COLORS.text});
    if(it.note){const lines=doc.wrap(it.note,7.5,false,w-24).slice(0,2);lines.forEach((l,k)=>doc.text(l,x+13,y+57+k*9.5,{size:7.5,color:COLORS.muted}));}
   });
   y+=h+10;
  }
 }
 function callout(title,text,tone='info'){
  const fill={info:COLORS.soft,good:COLORS.greenSoft,warn:COLORS.amberSoft,bad:COLORS.redSoft}[tone],accent={info:COLORS.primary,good:COLORS.green,warn:COLORS.amber,bad:COLORS.red}[tone];
  const lines=doc.wrap(text,9,false,CW-34),h=24+lines.length*12.5+(title?8:0);
  ensure(h+8);
  doc.rect(M,y,CW,h,{fill,radius:8});doc.rect(M,y,4,h,{fill:accent,radius:2});
  let ty=y+16;
  if(title){doc.text(title,M+18,ty,{size:10.5,bold:true,color:accent});ty+=15;}
  lines.forEach(l=>{doc.text(l,M+18,ty,{size:9,color:COLORS.text});ty+=12.5;});
  y+=h+10;
 }
 function kv(rows,o={}){
  for(const r of rows){
   const valueSize=r.strong?10.5:9.5;
   const labelLines=doc.wrap(r.label,9,r.strong,CW*0.58),h=Math.max(20,labelLines.length*12+8)+(r.note?11:0);
   ensure(h);
   if(r.highlight)doc.rect(M,y,CW,h,{fill:COLORS.soft,radius:5});
   labelLines.forEach((l,i)=>doc.text(l,M+8,y+13+i*12,{size:9,bold:r.strong,color:COLORS.text}));
   doc.text(r.value,W-M-8,y+13,{size:valueSize,bold:true,color:r.color||COLORS.text,align:'right'});
   if(r.note)doc.text(r.note,M+8,y+13+labelLines.length*12,{size:7.5,color:COLORS.muted});
   y+=h;
   if(!r.highlight&&!o.noLines)doc.line(M,y,W-M,y,{color:COLORS.line});
  }
  y+=8;
 }
 function bar(x,yy,w,h,ratio,fill,bg=COLORS.line){if(bg)doc.rect(x,yy,w,h,{fill:bg,radius:h/2});const fw=Math.max(0,Math.min(1,ratio))*w;if(fw>0.5)doc.rect(x,yy,Math.max(fw,h),h,{fill,radius:h/2});}
 function table(columns,rows,o={}){
  const rowH=o.rowHeight||17,headH=20;
  const drawHead=()=>{doc.rect(M,y,CW,headH,{fill:COLORS.navy,radius:4});let x=M;for(const c of columns){const tx=c.align==='right'?x+c.width-6:x+6;doc.text(c.label,tx,y+13.5,{size:7.5,bold:true,color:COLORS.white,align:c.align==='right'?'right':'left'});x+=c.width;}y+=headH;};
  ensure(headH+rowH*2);drawHead();
  rows.forEach((row,i)=>{
   if(y+rowH>BOTTOM){newPage();drawHead();}
   if(row.fill||i%2)doc.rect(M,y,CW,rowH,{fill:row.fill||'#f7f9fc'});
   let x=M;
   columns.forEach((c,j)=>{const v=String(row.cells[j]??'');const size=fitSize(v,o.size||8.2,!!row.bold,c.width-10);doc.text(v,c.align==='right'?x+c.width-6:x+6,y+rowH/2+3,{size,bold:!!row.bold||(c.bold&&!row.muted),color:row.color?.[j]||(row.muted?COLORS.faint:COLORS.text),align:c.align==='right'?'right':'left'});x+=c.width;});
   y+=rowH;
  });
  doc.line(M,y,W-M,y,{color:COLORS.line});y+=10;
 }

 /* ---------- Capa e resumo ---------- */
 doc.addPage();
 doc.rect(0,0,W,168,{fill:COLORS.navy});
 doc.rect(0,164,W*0.62,4,{fill:COLORS.primary});doc.rect(W*0.62,164,W*0.38,4,{fill:COLORS.violet});
 let hasLogo=false;
 if(opt.logo){doc.addJpeg('logo',opt.logo.bytes,opt.logo.width,opt.logo.height);hasLogo=doc.image('logo',M,34,54,54);}
 if(!hasLogo){doc.circle(M+27,61,27,{fill:COLORS.primary});doc.text('H',M+27,69,{size:24,bold:true,color:COLORS.white,align:'center'});}
 doc.text('HydroCasa',M+68,52,{size:11,bold:true,color:'#9cc0ff'});
 doc.text('Relatório de consumo de água',M+68,74,{size:20,bold:true,color:COLORS.white});
 doc.text(fin.householdName?fin.householdName:'Monitoramento residencial com ESP32',M+68,92,{size:10,color:'#c9d6f2'});
 doc.text(period.title.charAt(0).toUpperCase()+period.title.slice(1),M,128,{size:13,bold:true,color:COLORS.white});
 const span=period.from===period.to?F.dateLabel(period.from):F.dateLabel(period.from)+' a '+F.dateLabel(period.to);
 doc.text(span+'  ·  '+period.days.length+(period.days.length===1?' dia':' dias'),M,146,{size:9.5,color:'#c9d6f2'});
 doc.text('Gerado em '+sum.generatedAt.toLocaleDateString('pt-BR')+' às '+sum.generatedAt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),W-M,146,{size:8.5,color:'#9fb1d6',align:'right'});
 y=190;
 if(sum.coverage.demo)callout('Atenção: contém dados de demonstração',sum.coverage.demo+' dia(s) deste relatório vêm do modo demonstração. Eles são fictícios, aparecem marcados como "Simulado" e não representam medições reais do ESP32.','warn');

 const verdict=F.verdict(sum);
 if(sections.has('summary')){
  sectionTitle('summary','Os números principais do período escolhido. Os volumes vêm dos sensores; os valores em reais são estimativas com a tarifa informada.');
  cards([
   {label:'Água medida no período',value:m3(sum.measured),note:L(sum.measured)+' somando os dois ramais',accent:COLORS.primary},
   {label:money.configured?'Gasto até agora':'Gasto (sem tarifa)',value:money.configured?R(money.measuredWithFixed):'—',note:money.configured?'Água medida + taxa fixa proporcional':'Informe o preço do m³ para ver em reais',accent:COLORS.violet},
   {label:single?'Média por pessoa':'Média por dia medido',value:single?(sum.perResident!==null?m3(sum.perResident):'—'):m3(sum.average),note:single?(sum.residents?sum.residents+' morador(es)':'Moradores não informados'):(sum.average!==null?L(sum.average)+' por dia':'Sem leituras'),accent:COLORS.primary},
   {label:'Dias com leitura',value:sum.coverage.withData+' de '+sum.coverage.elapsed,note:sum.coverage.future?sum.coverage.future+' dia(s) ainda por vir':'Dias sem leitura não contam como zero',accent:COLORS.violet}
  ],{cols:4});
  const tone={above:'bad',below:'good',within:'good',empty:'warn',unknown:'info'}[verdict.code];
  callout(verdict.title,verdict.text+(sum.coverage.partial?' '+sum.coverage.partial+' dia(s) tiveram coleta parcial: o painel ficou fechado em parte do dia, então o consumo real pode ser maior.':''),tone);
 }

 /* ---------- Dinheiro ---------- */
 if(sections.has('money')){
  const completed=!sum.coverage.future;
  sectionTitle('money',money.configured?'Estimativas calculadas com o preço por m³ e a taxa fixa que você informou. Confira os valores com a sua conta de água.':'Para ver valores em reais, informe o preço do m³ da sua conta de água ao gerar o relatório.',90);
  if(!money.configured){
   callout('Tarifa não configurada','Sem o preço do m³ não é possível converter a água em dinheiro. No HydroCasa, abra Relatório PDF > "Valores da sua conta de água" e informe o preço, ou use "Calcular pela minha conta" com o valor total e os m³ da última fatura.','info');
  }else{
   cards([
    {label:'Gasto até agora',value:R(money.measuredWithFixed),note:'Água medida ('+R(money.measured)+') + taxa fixa ('+R(money.fixedElapsed)+')',accent:COLORS.violet},
    {label:completed?'Estimativa do período':'Previsão do período',value:R(money.projectedWithFixed),note:completed?'Dias sem leitura preenchidos pela média':'Se o ritmo atual continuar até '+F.dateLabel(period.to),accent:COLORS.primary},
    {label:'Esperado pela referência',value:R(money.expectedWithFixed),note:sum.residents?'Para '+sum.residents+' morador(es) no período inteiro':'Configure os moradores',accent:COLORS.green}
   ],{cols:3});
   const missing=sum.coverage.total-sum.coverage.withData;
   const diff=money.projectedWithFixed!==null&&money.expectedWithFixed!==null?money.projectedWithFixed-money.expectedWithFixed:null;
   kv([
    {label:'Preço médio da água por m³ (água + esgoto)',value:R(money.price)},
    {label:'Água medida pelos sensores',value:m3(sum.measured),note:L(sum.measured)},
    {label:'Custo da água medida',value:R(money.measured)},
    {label:'Taxa fixa mensal proporcional aos dias já passados',value:R(money.fixedElapsed),note:'Taxa de '+R(money.fixedMonthly)+' por mês, dividida pelos dias de cada mês'},
    {label:'Total gasto até agora',value:R(money.measuredWithFixed),strong:true,highlight:true},
    {label:missing?missing+' dia(s) sem leitura estimados pela média diária':'Todos os dias do período têm leitura',value:missing&&sum.average!==null?R(F.costOf(sum.average*missing,fin)):'—',note:missing&&sum.average!==null?'Média de '+L(sum.average)+' por dia medido':undefined},
    {label:completed?'Estimativa para o período completo (com taxa fixa)':'Previsão para o período completo (com taxa fixa)',value:R(money.projectedWithFixed),strong:true,highlight:true},
    {label:'Valor esperado pela referência (com taxa fixa)',value:R(money.expectedWithFixed)},
    {label:'Diferença entre a previsão e o esperado',value:signedMoney(diff),color:diff>0?COLORS.red:diff<0?COLORS.green:COLORS.text,strong:true},
    {label:'Custo médio por dia medido',value:R(money.perDay)},
    {label:'Custo por morador no período',value:sum.residents&&money.measured!==null?R(money.measured/sum.residents):'—'}
   ]);
   if(single&&sum.average!==null){
    const dim=F.daysInMonth(F.parseKey(period.from));
    callout('Se todos os dias do mês fossem assim','Repetindo o consumo deste dia por '+dim+' dias, a conta ficaria em torno de '+R(F.costOf(sum.average*dim,fin)+money.fixedMonthly)+' no mês (incluindo a taxa fixa de '+R(money.fixedMonthly)+').','info');
   }
   if(money.goal!==null){
    ensure(78);
    const over=R(money.projectedWithFixed-money.goal);
    const goalText=completed
     ?(money.goalStatus==='above'?'O período terminou acima da meta: a estimativa passou '+over+' do planejado.':'O período terminou dentro da meta, com folga de '+R(money.goal-money.projectedWithFixed)+'.')
     :(money.goalStatus==='above'?'A previsão passa da meta em '+over+'. Vale reduzir o consumo nos próximos dias.':'A previsão está dentro da meta'+(money.goalRemaining>0?'; ainda restam '+R(money.goalRemaining)+' para o período.':'.'));
    doc.rect(M,y,CW,70,{fill:money.goalStatus==='above'?COLORS.redSoft:COLORS.greenSoft,radius:8});
    doc.text('Meta de gasto: '+R(money.goal)+(period.days.length===F.daysInMonth(F.parseKey(period.from))&&period.from.endsWith('-01')?' no mês':' no período'),M+14,y+18,{size:10.5,bold:true,color:money.goalStatus==='above'?COLORS.red:COLORS.green});
    doc.text(goalText,M+14,y+32,{size:8.8,color:COLORS.text});
    const ratioSpent=(money.measuredWithFixed||0)/money.goal,ratioProj=(money.projectedWithFixed||0)/money.goal;
    bar(M+14,y+44,CW-28,9,Math.min(1,ratioProj),money.goalStatus==='above'?'#f2a7a7':'#9fd9bf','#ffffff');
    bar(M+14,y+44,CW-28,9,Math.min(1,ratioSpent),money.goalStatus==='above'?COLORS.red:COLORS.green,null);
    doc.text('Gasto: '+R(money.measuredWithFixed)+' ('+pct(ratioSpent*100)+')',M+14,y+64,{size:7.5,color:COLORS.muted});
    doc.text('Previsão: '+R(money.projectedWithFixed)+' ('+pct(ratioProj*100)+' da meta)',W-M-14,y+64,{size:7.5,color:COLORS.muted,align:'right'});
    y+=80;
   }
  }
 }

 /* ---------- Referência ---------- */
 if(sections.has('reference')){
  sectionTitle('reference','Comparamos a água medida com a referência de consumo por pessoa, somente nos dias que têm leitura — assim a comparação é justa.',120);
  if(sum.referenceWithData===null||!sum.data.length){
   callout('Comparação indisponível',!sum.data.length?'Não há leituras no período.':'Informe quantas pessoas moram na casa para calcular o consumo esperado.','info');
  }else{
   const max=Math.max(sum.measured,sum.referenceWithData)||1;
   ensure(90);
   const label=(t,yy)=>doc.text(t,M,yy,{size:9,bold:true,color:COLORS.text});
   label('Medido nos dias com leitura',y+10);doc.text(both(sum.measured),W-M,y+10,{size:9,bold:true,align:'right'});
   bar(M,y+17,CW,12,sum.measured/max,sum.ratio>(profile?.tolerance??10)?COLORS.red:COLORS.primary);
   label('Esperado para '+sum.residents+' morador(es) nos mesmos dias',y+48);doc.text(both(sum.referenceWithData),W-M,y+48,{size:9,bold:true,align:'right'});
   bar(M,y+55,CW,12,sum.referenceWithData/max,COLORS.green);
   y+=82;
   kv([
    {label:'Diferença em volume',value:(sum.measured>=sum.referenceWithData?'+ ':'− ')+m3(Math.abs(sum.measured-sum.referenceWithData)),strong:true},
    {label:'Diferença percentual',value:signed(sum.ratio),color:sum.ratio>(profile?.tolerance??10)?COLORS.red:sum.ratio<-(profile?.tolerance??10)?COLORS.green:COLORS.text,strong:true},
    {label:'Diferença em reais',value:money.configured?signedMoney(money.vsReferenceSameDays):'Informe a tarifa'},
    {label:'Dias acima da faixa de ±'+pct(profile?.tolerance??10)+' da referência',value:sum.daysAbove+' de '+sum.coverage.withData},
    {label:'Consumo médio por pessoa por dia',value:sum.perResidentDay!==null?L(sum.perResidentDay):'—',note:'Referência usada: '+(profile?L1(profile.referenceLiters):'—')+' por pessoa por dia'}
   ]);
   if(!sum.scopeWhole)para('Observação: no perfil, os sensores cobrem somente parte da casa (ramais da maquete). A referência considera todos os usos de uma residência, então esta comparação serve apenas como ilustração.',{size:8.5,color:COLORS.muted});
  }
 }

 /* ---------- Gráfico ---------- */
 if(sections.has('chart')){
  sectionTitle('chart',long?'Volume total de cada mês, somando os dois ramais. A linha tracejada mostra a referência esperada para o mês.':'Volume de cada dia, separado por ramal. A linha tracejada mostra a referência diária para os moradores.',230);
  const series=long?sum.monthly.map(m=>({label:new Date(m.month+'-15T12:00').toLocaleDateString('pt-BR',{month:'short'}).replace('.',''),a:m.dataDays?m.r1:null,b:m.dataDays?m.r2:null,ref:m.reference})):sum.rows.map(r=>({label:r.day.slice(8)+'/'+r.day.slice(5,7),a:r.r1,b:r.r2,ref:r.future?null:r.reference,demo:r.demo}));
  const values=series.map(s=>(s.a||0)+(s.b||0)),refs=series.map(s=>s.ref||0);
  const max=Math.max(1,...values,...refs)*1.12,h=170,top=y+6,left=M+44,w=CW-44,bottom=top+h;
  ensure(h+50);
  for(let i=0;i<=4;i++){const yy=top+h*i/4;doc.line(left,yy,left+w,yy,{color:'#e8edf5'});doc.text(m3(max*(1-i/4)).replace(' m³',''),left-6,yy+3,{size:7,color:COLORS.faint,align:'right'});}
  doc.text('m³',left-6,top-6,{size:7,bold:true,color:COLORS.faint,align:'right'});
  const step=w/series.length,bw=Math.max(1.5,Math.min(26,step*0.62));
  series.forEach((s,i)=>{
   const x=left+i*step+(step-bw)/2;
   if(s.a===null&&s.b===null){doc.rect(x,bottom-2,bw,2,{fill:'#d6dce6'});}
   else{const ha=(s.a||0)/max*h,hb=(s.b||0)/max*h;doc.rect(x,bottom-ha,bw,ha,{fill:s.demo?'#93b4f5':COLORS.primary});doc.rect(x,bottom-ha-hb,bw,hb,{fill:s.demo?'#c4a8f5':COLORS.violet});}
   const every=Math.ceil(series.length/(long?12:16));
   if(i%every===0||series.length<=16)doc.text(s.label,left+i*step+step/2,bottom+12,{size:6.8,color:COLORS.muted,align:'center'});
  });
  const refPoints=[];series.forEach((s,i)=>{if(s.ref)refPoints.push([left+i*step+step/2,bottom-s.ref/max*h]);});
  if(refPoints.length>1){for(let i=1;i<refPoints.length;i++)doc.line(refPoints[i-1][0],refPoints[i-1][1],refPoints[i][0],refPoints[i][1],{color:COLORS.green,width:1.2,dash:[4,3]});}
  else if(refPoints.length===1)doc.line(left,refPoints[0][1],left+w,refPoints[0][1],{color:COLORS.green,width:1.2,dash:[4,3]});
  y=bottom+24;
  const legend=[[COLORS.primary,ramal(1)],[COLORS.violet,ramal(2)],[COLORS.green,'Referência (tracejado)'],['#d6dce6','Sem leitura']];
  let lx=M;for(const [c,t] of legend){doc.rect(lx,y-7,9,9,{fill:c,radius:2});doc.text(t,lx+13,y,{size:8,color:COLORS.muted});lx+=24+doc.textWidth(t,8);}
  y+=16;
 }

 /* ---------- Ramais ---------- */
 if(sections.has('branches')){
  sectionTitle('branches','Cada ramal representa um ponto monitorado pelos sensores. A participação mostra de onde veio a maior parte do consumo.',100);
  if(!sum.data.length)callout('Sem leituras','Não há medições por ramal neste período.','info');
  else{
   const total=sum.measured||1;
   for(const [i,v,c] of [[1,sum.r1,COLORS.primary],[2,sum.r2,COLORS.violet]]){
    ensure(42);
    doc.text(ramal(i),M,y+10,{size:10,bold:true});
    doc.text(both(v)+(money.configured?'  ·  '+R(F.costOf(v,fin)):''),W-M,y+10,{size:9,bold:true,align:'right'});
    bar(M,y+17,CW-50,10,v/total,c);doc.text(pct(v/total*100),W-M,y+26,{size:9,bold:true,color:c,align:'right'});
    y+=40;
   }
   const top=sum.r1>=sum.r2?1:2,share=(top===1?sum.r1:sum.r2)/total*100;
   para(ramal(top)+' concentrou '+pct(share)+' da água medida no período.'+(share>70?' Quando um ponto concentra a maior parte do consumo, vale começar a economia por ele.':''),{size:9,color:COLORS.muted});
  }
 }

 /* ---------- Tabela ---------- */
 if(sections.has('table')){
  sectionTitle('table',long?'Resumo mês a mês. Para ver cada dia, gere um relatório de um mês específico.':'Cada linha é um dia. "Parcial" significa que o painel não acompanhou o dia inteiro.');
  const money5=v=>money.configured&&v!==null?R(F.costOf(v,fin)):'—';
  if(long){
   table([{label:'Mês',width:96,bold:true},{label:ramal(1),width:78,align:'right'},{label:ramal(2),width:78,align:'right'},{label:'Total',width:82,align:'right'},{label:'Custo',width:72,align:'right'},{label:'Dias medidos',width:CW-406,align:'right'}],
    sum.monthly.map(m=>({cells:[new Date(m.month+'-15T12:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),m.dataDays?m3(m.r1):'—',m.dataDays?m3(m.r2):'—',m.dataDays?m3(m.total):'—',money5(m.dataDays?m.total:null),m.dataDays+' de '+m.days],muted:!m.dataDays})).concat([{cells:['Total',m3(sum.r1),m3(sum.r2),m3(sum.measured),money5(sum.measured),sum.coverage.withData+' de '+sum.coverage.total],bold:true,fill:COLORS.soft}]));
  }else{
   const status=r=>r.future?'A coletar':!r.h?'Sem leitura':r.demo?'Simulado':r.above?'Acima da ref.':r.partial?'Parcial':'Completo';
   table([{label:'Data',width:80,bold:true},{label:ramal(1),width:76,align:'right'},{label:ramal(2),width:76,align:'right'},{label:'Total',width:80,align:'right'},{label:'Custo',width:66,align:'right'},{label:'vs. ref.',width:58,align:'right'},{label:'Situação',width:CW-436}],
    sum.rows.map(r=>({cells:[F.dateLabel(r.day,{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.',''),r.h?m3(r.r1):'—',r.h?m3(r.r2):'—',r.h?m3(r.total):'—',r.h?money5(r.total):'—',r.vsReference!==null?signed(r.vsReference):'—',status(r)],muted:!r.h,
     color:[null,null,null,null,null,r.above?COLORS.red:null,r.above?COLORS.red:r.demo?COLORS.amber:null]})).concat([{cells:['Total',m3(sum.r1),m3(sum.r2),m3(sum.measured),money5(sum.measured),signed(sum.ratio),sum.coverage.withData+' dia(s) medidos'],bold:true,fill:COLORS.soft}]));
  }
 }

 /* ---------- Destaques ---------- */
 if(sections.has('insights')){
  sectionTitle('insights','Padrões que ajudam a entender quando a casa usa mais água.');
  if(!sum.data.length)callout('Sem leituras','Os destaques aparecem quando houver medições no período.','info');
  else{
   const items=[{label:'Dia de maior consumo',value:sum.peak?m3(sum.peak.total):'—',note:sum.peak?F.dateLabel(sum.peak.day,{weekday:'long',day:'2-digit',month:'2-digit'})+(money.configured?' · '+R(sum.peak.cost):''):'',accent:COLORS.red}];
   if(sum.lowest)items.push({label:'Dia de menor consumo',value:m3(sum.lowest.total),note:F.dateLabel(sum.lowest.day,{weekday:'long',day:'2-digit',month:'2-digit'})+(sum.lowest.partial?' · coleta parcial':''),accent:COLORS.green});
   items.push({label:'Média por morador por dia',value:sum.perResidentDay!==null?L(sum.perResidentDay):'—',note:'Volume ÷ moradores; não mede o uso individual',accent:COLORS.violet});
   cards(items,{cols:items.length});
   const week=sum.week.filter(d=>d.days);
   if(week.length>1){
    ensure(30+week.length*20);
    doc.text('Média por dia da semana',M,y+10,{size:10,bold:true});y+=20;
    const names=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'],maxW=Math.max(...week.map(d=>d.average));
    for(const d of [1,2,3,4,5,6,0].map(i=>sum.week[i]).filter(d=>d.days)){
     doc.text(names[d.weekday],M,y+9,{size:8.5,color:COLORS.muted});
     bar(M+70,y+2,CW-190,8,d.average/maxW,d.average===maxW?COLORS.violet:COLORS.primary);
     doc.text(L(d.average)+(d.days>1?' ('+d.days+' dias)':''),W-M,y+9,{size:8.5,bold:true,align:'right'});
     y+=18;
    }
    y+=6;
   }
  }
 }

 /* ---------- Atividades ---------- */
 if(sections.has('activities')){
  sectionTitle('activities','Registros feitos por você na aba Atividades ou no Calendário. São estimativas educativas: não substituem nem são descontadas das medições.');
  if(!sum.activities.length)callout('Nenhuma atividade registrada','Registre banhos, lavagens e outros usos para entender melhor o consumo da casa.','info');
  else{
   table([{label:'Atividade',width:168,bold:true},{label:'Registros',width:60,align:'right'},{label:'Ocorrências',width:70,align:'right'},{label:'Volume estimado',width:92,align:'right'},{label:'Custo',width:66,align:'right'},{label:'Parte',width:CW-456,align:'right'}],
    sum.activities.map(a=>({cells:[a.name,String(a.count),String(a.occurrences),m3(a.liters),money.configured?R(a.cost):'—',pct(a.share)]})).concat([{cells:['Total',String(sum.activityCount),'',m3(sum.activityLiters),money.configured?R(F.costOf(sum.activityLiters,fin)):'—','100%'],bold:true,fill:COLORS.soft}]));
   if(sum.measured>0)para('As atividades registradas somam '+pct(sum.activityLiters/sum.measured*100)+' do volume medido no período.'+(sum.activityLiters>sum.measured?' Como a estimativa supera o medido, confira as durações e ocorrências informadas — ou parte desses usos não passa pelos ramais monitorados.':''),{size:9,color:COLORS.muted});
  }
 }

 /* ---------- Alertas ---------- */
 if(sections.has('alerts')){
  sectionTitle('alerts','Avisos gerados automaticamente pelo painel. Um alerta indica algo para verificar, não um diagnóstico.');
  if(!sum.alerts.length)callout('Nenhum alerta no período','O painel não registrou avisos nestas datas.','good');
  else{
   for(const a of sum.alerts.slice(0,40)){
    const lines=doc.wrap(String(a.mensagem||''),8.8,false,CW-110),h=Math.max(30,16+lines.length*11.5);
    ensure(h+4);
    const tone=a.nivel==='Acima do padrão'||a.nivel==='Crítico'?COLORS.red:a.nivel==='Informativo'?COLORS.primary:COLORS.amber;
    doc.rect(M,y,4,h-4,{fill:tone,radius:2});
    doc.text(String(a.nivel||'Aviso'),M+12,y+11,{size:8,bold:true,color:tone});
    doc.text(new Date(a.criadoEm).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}),W-M,y+11,{size:7.8,color:COLORS.muted,align:'right'});
    lines.forEach((l,i)=>doc.text(l,M+12,y+24+i*11.5,{size:8.8}));
    y+=h+4;
   }
   if(sum.alerts.length>40)para('E mais '+(sum.alerts.length-40)+' alerta(s). Consulte o histórico de alertas no painel.',{size:8.5,color:COLORS.muted});
  }
 }

 /* ---------- Dicas ---------- */
 if(sections.has('tips')){
  sectionTitle('tips','Sugestões gerais. O efeito real depende dos equipamentos e dos hábitos da casa.');
  const tips=[];
  if(verdict.code==='above')tips.push(['Comece pelo que mais pesa','O consumo ficou acima da referência. Veja o dia de maior consumo e o ramal que concentrou mais água para descobrir onde agir primeiro.']);
  if(sum.activities.some(a=>/banho/i.test(a.name)))tips.push(['Banhos mais curtos','Os banhos aparecem entre as atividades registradas. Reduzir alguns minutos por banho costuma ser uma das formas mais simples de economizar.']);
  if(money.configured&&money.goalStatus==='above')tips.push(sum.coverage.future?['Ajuste para cumprir a meta','A previsão passa da meta de gasto. Uma redução de '+R(money.projectedWithFixed-money.goal)+' no período coloca a conta de volta dentro do planejado.']:['Planeje o próximo período','O período passou da meta em '+R(money.projectedWithFixed-money.goal)+'. Use os dias e o ramal de maior consumo deste relatório para definir onde economizar.']);
  if(sum.coverage.partial||sum.coverage.empty)tips.push(['Melhore a coleta','Deixe o painel aberto e o ESP32 ligado durante o dia: dias parciais ou sem leitura deixam as estimativas menos precisas.']);
  tips.push(['Torneira fechada','Feche a torneira enquanto escova os dentes, ensaboa a louça ou faz a barba.']);
  tips.push(['Máquina cheia','Use a máquina de lavar e a lava-louças com a capacidade completa.']);
  tips.push(['Vassoura em vez de mangueira','Para limpar calçadas e quintais, prefira vassoura e balde à mangueira aberta.']);
  tips.push(['Fique de olho em vazamentos','Com tudo fechado, observe o hidrômetro por alguns minutos: se ele girar, pode haver vazamento.']);
  tips.slice(0,7).forEach(([t,text],i)=>{
   const lines=doc.wrap(text,9,false,CW-40),h=20+lines.length*12;ensure(h+4);
   doc.circle(M+10,y+10,10,{fill:i<2&&verdict.code==='above'?COLORS.violet:COLORS.primary});doc.text(String(i+1),M+10,y+13.5,{size:9,bold:true,color:COLORS.white,align:'center'});
   doc.text(t,M+30,y+13,{size:10,bold:true});
   lines.forEach((l,k)=>doc.text(l,M+30,y+27+k*12,{size:9,color:COLORS.muted}));
   y+=h+8;
  });
 }

 /* ---------- Perfil ---------- */
 if(sections.has('profile')){
  sectionTitle('profile','Valores configurados no painel e usados em todos os cálculos deste relatório.');
  kv([
   {label:'Nome da residência',value:fin.householdName||'Não informado'},
   {label:'Moradores',value:profile?String(profile.residents):'Não configurado'},
   {label:'Referência por pessoa por dia',value:profile?L1(profile.referenceLiters)+(profile.referenceMode==='snis'?' (SNIS 2020)':' (personalizada)'):'—'},
   {label:'Referência diária da casa',value:profile?both(profile.residents*profile.referenceLiters):'—'},
   {label:'Faixa de comparação',value:profile?'± '+pct(profile.tolerance):'—'},
   {label:'O que os sensores cobrem',value:profile?.scope==='whole'?'Toda a residência':'Somente os ramais'},
   {label:'Nomes dos ramais',value:ramal(1)+' / '+ramal(2)},
   {label:'Preço por m³ (água + esgoto)',value:money.configured?R(money.price):'Não informado'},
   {label:'Taxa fixa mensal',value:R(fin.fixedMonthly)},
   {label:'Meta de gasto mensal',value:fin.monthlyGoal?R(fin.monthlyGoal):'Não definida'}
  ]);
 }

 /* ---------- Metodologia ---------- */
 if(sections.has('method')){
  sectionTitle('method','Para que qualquer pessoa consiga conferir as contas.');
  const items=[
   ['Volume','Os sensores de vazão geram pulsos que o ESP32 converte em litros (fator de calibração). 1 m³ = 1.000 litros.'],
   ['Custo da água','Custo = volume em m³ × preço por m³ informado. O preço deve incluir água e esgoto; muitas contas cobram tarifas por faixa, então o valor é uma média.'],
   ['Taxa fixa','A taxa fixa mensal é dividida pelos dias de cada mês e somada conforme os dias do período.'],
   ['Previsão','Média diária dos dias medidos × dias sem leitura (passados ou futuros) + volume já medido. Supõe que o ritmo se mantém.'],
   ['Referência','Moradores × referência por pessoa por dia. O padrão é a média nacional do SNIS 2020 (152,1 L por habitante por dia): um indicador histórico, não uma meta individual.'],
   ['Limitações','Dias com coleta parcial podem subestimar o consumo. Dias sem leitura não contam como zero. As atividades são estimativas e não alteram as medições. O relatório não detecta vazamentos automaticamente.'],
   ['Fontes','MDR/SNIS — Diagnóstico de abastecimento de água (dados de 2020); exemplos de atividades: SAAE Ambiental de Santa Fé do Sul e Câmara dos Deputados/EcoCâmara. Detalhes na página "Fontes e estudos" do HydroCasa.']
  ];
  for(const [t,text] of items){ensure(30);doc.text(t,M,y+10,{size:9.5,bold:true,color:COLORS.primary});y+=15;para(text,{size:9,after:6});}
 }

 /* ---------- Rodapés ---------- */
 const total=doc.pageCount;
 for(let i=1;i<=total;i++){
  doc.setPage(i);
  doc.line(M,812,W-M,812,{color:COLORS.line});
  doc.text('HydroCasa · Valores em reais são estimativas; confira sempre a sua conta de água.',M,825,{size:7,color:COLORS.faint});
  doc.text('Página '+i+' de '+total,W-M,825,{size:7,bold:true,color:COLORS.muted,align:'right'});
 }
 return {bytes:doc.output(),pages:total};
}

function fileName(period){return 'hydrocasa-relatorio-'+period.from+(period.to!==period.from?'_a_'+period.to:'')+'.pdf';}
const api={SECTIONS,buildPdf,fileName};
root.HydroReport=Object.assign(root.HydroReport||{},api);
if(typeof module==='object'&&module.exports)module.exports=api;
if(typeof document==='undefined')return;

/* =====================================================================
   Parte 2 — interface
   ===================================================================== */
const PREF_KEY='hydrocasa:relatorio:preferencias';
const q=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readJSON=(storage,key,fallback)=>{try{const v=JSON.parse(storage.getItem(key)||'null');return v??fallback;}catch{return fallback;}};
const icon='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';
const downloadIcon='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"/></svg>';

function readLedger(){
 const data=readJSON(localStorage,'hydrocasa_ledger_v2',{});
 return {history:data&&data.version===2&&data.history&&typeof data.history==='object'?data.history:{},household:data?.household||null,activityRecords:data?.activityRecords&&typeof data.activityRecords==='object'?data.activityRecords:{}};
}
/** Dias fictícios da "semana demonstrativa" (sessionStorage), nunca misturados a dias reais. */
function readDemoHistory(real,profile){
 const o=readJSON(sessionStorage,'hydrocasa:semana-demo',null);
 if(!o||o.version!==1||!Number.isInteger(o.days)||!Array.isArray(o.values)||o.values.length!==7)return {};
 const rows={},today=new Date();today.setHours(12,0,0,0);
 for(let age=0;age<Math.min(o.days,366);age++){const d=new Date(today);d.setDate(d.getDate()-age);const k=F.keyOf(d);if(real[k]?.readings>0)continue;const v=o.values[d.getDay()];if(!Array.isArray(v))continue;rows[k]={total1:+v[0]||0,total2:+v[1]||0,readings:1,partial:false,profile:profile||undefined,demo:true};}
 return rows;
}
function hasDemo(){return !!readJSON(sessionStorage,'hydrocasa:semana-demo',null);}

let overlay=null,lastFocus=null,objectUrl=null,previewTimer=null;
const PERIOD_ICONS={today:'◷',yesterday:'↺',day:'▣',last7:'7',thisMonth:'▦',lastMonth:'◧',month:'▤',last30:'30',thisYear:'◫',lastYear:'◰',custom:'⇆'};

function build(){
 overlay=document.createElement('div');overlay.className='report-overlay';overlay.hidden=true;
 const groups=[...new Set(SECTIONS.map(s=>s.group))];
 overlay.innerHTML=`<section class="report-dialog" role="dialog" aria-modal="true" aria-labelledby="reportTitle" aria-describedby="reportIntro">
 <header class="report-head"><span class="report-head-icon">${icon}</span><div><span class="report-kicker">RELATÓRIO EM PDF</span><h2 id="reportTitle">Monte seu relatório de consumo</h2><p id="reportIntro">Escolha o período, marque o que deve aparecer e baixe um PDF completo com a água usada e os gastos em reais.</p></div><button type="button" class="report-close" aria-label="Fechar relatório">×</button></header>
 <form class="report-body" id="reportForm" novalidate>
  <div class="report-main">
   <fieldset class="report-step"><legend><span class="report-step-num">1</span>Qual período você quer ver?</legend>
    <div class="report-periods">${F.PERIODS.map(p=>`<label class="report-period"><input type="radio" name="reportPeriod" value="${p.id}"><span class="report-period-icon" aria-hidden="true">${PERIOD_ICONS[p.id]}</span><span class="report-period-text"><strong>${esc(p.label)}</strong><small>${esc(p.hint)}</small></span></label>`).join('')}</div>
    <div class="report-period-extra">
     <label data-extra="day" hidden>Dia do relatório<input type="date" id="reportDay"></label>
     <label data-extra="month" hidden>Mês do relatório<input type="month" id="reportMonth"></label>
     <label data-extra="custom" hidden>De<input type="date" id="reportFrom"></label>
     <label data-extra="custom" hidden>Até<input type="date" id="reportTo"></label>
    </div>
    <p class="report-period-range" id="reportRange" aria-live="polite"></p>
   </fieldset>
   <fieldset class="report-step"><legend><span class="report-step-num">2</span>O que o relatório deve conter?</legend>
    <p class="report-step-help">Tudo vem marcado. Desmarque o que não quiser no PDF.</p>
    <div class="report-check-tools"><button type="button" class="ghost-btn" data-preset="all">Marcar tudo</button><button type="button" class="ghost-btn" data-preset="essential">Só o essencial</button><button type="button" class="ghost-btn" data-preset="none">Desmarcar tudo</button><span class="report-count" id="reportCount" aria-live="polite"></span></div>
    <div class="report-checklist">${groups.map(g=>`<div class="report-group"><h3>${esc(g)}</h3>${SECTIONS.filter(s=>s.group===g).map(s=>`<label class="report-check"><input type="checkbox" name="reportSection" value="${s.id}" checked><span class="report-check-box" aria-hidden="true"></span><span class="report-check-text"><strong>${esc(s.title)}</strong><small>${esc(s.desc)}</small></span></label>`).join('')}</div>`).join('')}</div>
    <label class="report-demo" id="reportDemoWrap" hidden><input type="checkbox" id="reportIncludeDemo"> Incluir os dias de demonstração (aparecem marcados como “Simulado”)</label>
   </fieldset>
   <details class="report-step report-bill" id="reportBill"><summary><span class="report-step-num">3</span><span class="report-bill-title">Valores da sua conta de água</span><em id="reportBillState"></em></summary>
    <p class="report-step-help">Usados para transformar a água em reais. Ficam salvos neste navegador e também aparecem no Perfil da residência.</p>
    <div class="report-bill-grid">
     <label>Preço por m³ (água + esgoto)<span class="report-money"><span>R$</span><input type="number" id="reportPrice" min="0" max="1000" step="0.01" inputmode="decimal" placeholder="Ex.: 12,50"></span></label>
     <label>Taxa fixa mensal<span class="report-money"><span>R$</span><input type="number" id="reportFixed" min="0" max="10000" step="0.01" inputmode="decimal" placeholder="0,00"></span><small>Valor cobrado todo mês, mesmo sem consumo. Deixe 0 se não houver.</small></label>
     <label>Meta de gasto mensal<span class="report-money"><span>R$</span><input type="number" id="reportGoal" min="0" max="100000" step="0.01" inputmode="decimal" placeholder="Opcional"></span></label>
     <label>Nome na capa do relatório<input type="text" id="reportName" maxlength="60" placeholder="Ex.: Casa da família Silva"></label>
    </div>
    <details class="report-helper"><summary>Não sei o preço do m³ — calcular pela minha conta</summary>
     <p>Pegue a última conta de água e informe o <b>valor total</b> e o <b>consumo em m³</b> (aparece como “consumo” ou “volume faturado”).</p>
     <div class="report-helper-grid"><label>Valor total da conta<span class="report-money"><span>R$</span><input type="number" id="reportBillTotal" min="0" step="0.01" inputmode="decimal"></span></label><label>Consumo na conta<span class="report-money report-unit"><input type="number" id="reportBillM3" min="0" step="0.1" inputmode="decimal"><span>m³</span></span></label><button type="button" class="secondary-btn" id="reportCalc">Calcular preço</button></div>
     <p id="reportCalcMsg" role="status"></p>
    </details>
   </details>
  </div>
  <aside class="report-preview" aria-labelledby="reportPreviewTitle">
   <h3 id="reportPreviewTitle">Prévia do relatório</h3>
   <div class="report-preview-body" id="reportPreview" aria-live="polite"></div>
   <button type="submit" class="primary-btn report-download" id="reportDownload">${downloadIcon}<span>Baixar relatório em PDF</span></button>
   <p class="report-status" id="reportStatus" role="status" aria-live="polite"></p>
   <a class="ghost-btn report-open" id="reportOpen" hidden target="_blank" rel="noopener">Abrir o PDF em nova aba</a>
  </aside>
 </form></section>`;
 document.body.append(overlay);
 const form=overlay.querySelector('#reportForm');
 overlay.querySelector('.report-close').onclick=close;
 overlay.addEventListener('mousedown',e=>{if(e.target===overlay)close();});
 document.addEventListener('keydown',e=>{
  if(overlay.hidden)return;
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key!=='Tab')return;
  const nodes=[...overlay.querySelectorAll('button,input,select,summary,a[href]:not([hidden])')].filter(n=>!n.disabled&&n.offsetParent!==null);
  if(!nodes.length)return;const i=nodes.indexOf(document.activeElement);
  if(e.shiftKey&&i<=0){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0].focus();}
 });
 form.addEventListener('change',onChange);form.addEventListener('input',onChange);
 overlay.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const p=b.dataset.preset;form.querySelectorAll('[name=reportSection]').forEach(c=>c.checked=p==='all'||(p==='essential'&&SECTIONS.find(s=>s.id===c.value).essential));onChange();});
 overlay.querySelector('#reportCalc').onclick=()=>{
  const msg=overlay.querySelector('#reportCalcMsg');
  try{const price=F.priceFromBill({billTotal:Number(q('#reportBillTotal').value),billM3:Number(q('#reportBillM3').value),fixedMonthly:Number(q('#reportFixed').value)||0});
   q('#reportPrice').value=price.toFixed(2);msg.className='report-ok';msg.textContent='Preço calculado: '+F.money(price)+' por m³'+(Number(q('#reportFixed').value)?' (já descontada a taxa fixa).':'.');saveBill();onChange();}
  catch(err){msg.className='form-error';msg.textContent=err.message;}
 };
 form.onsubmit=e=>{e.preventDefault();generate();};
}
function selectedPeriod(){return overlay.querySelector('[name=reportPeriod]:checked')?.value||'thisMonth';}
function periodOptions(){return {day:q('#reportDay').value,month:q('#reportMonth').value,from:q('#reportFrom').value,to:q('#reportTo').value};}
function selectedSections(){return [...overlay.querySelectorAll('[name=reportSection]:checked')].map(c=>c.value);}
function billInput(){return {...F.read(localStorage),pricePerM3:q('#reportPrice').value,fixedMonthly:q('#reportFixed').value,monthlyGoal:q('#reportGoal').value,householdName:q('#reportName').value};}
function saveBill(){try{const s=F.write(localStorage,billInput());window.dispatchEvent(new CustomEvent('hydrocasa:financeiro',{detail:s}));return s;}catch(err){return null;}}
function syncExtras(){
 const kind=selectedPeriod();
 overlay.querySelectorAll('[data-extra]').forEach(l=>{l.hidden=l.dataset.extra!==kind;l.querySelector('input').required=!l.hidden;});
 overlay.querySelectorAll('.report-period').forEach(l=>l.classList.toggle('is-selected',l.querySelector('input').checked));
}
function currentSummary(){
 const ledger=readLedger(),period=F.resolvePeriod(selectedPeriod(),periodOptions());
 const includeDemo=q('#reportIncludeDemo').checked&&!q('#reportDemoWrap').hidden;
 const history=includeDemo?{...ledger.history,...readDemoHistory(ledger.history,ledger.household)}:ledger.history;
 let fin;try{fin=F.settings(billInput());}catch{fin=F.read(localStorage);}
 return F.summarize({period,history,currentProfile:ledger.household,settings:fin,activityRecords:ledger.activityRecords,alerts:readJSON(localStorage,'hydrocasa:alertas',[]),now:new Date()});
}
function onChange(e){
 syncExtras();
 const count=selectedSections().length;
 q('#reportCount').textContent=count+' de '+SECTIONS.length+' seções';
 q('#reportDownload').disabled=!count;
 overlay.querySelectorAll('.report-check').forEach(l=>l.classList.toggle('is-off',!l.querySelector('input').checked));
 if(e&&e.target&&['reportPrice','reportFixed','reportGoal','reportName'].includes(e.target.id))saveBill();
 const s=F.read(localStorage);
 q('#reportBillState').textContent=s.pricePerM3?F.money(s.pricePerM3)+'/m³':'Não configurado';
 q('#reportBillState').className=s.pricePerM3?'is-set':'';
 clearTimeout(previewTimer);previewTimer=setTimeout(renderPreview,120);
 q('#reportStatus').textContent='';q('#reportOpen').hidden=true;
 savePrefs();
}
function renderPreview(){
 const box=q('#reportPreview'),btn=q('#reportDownload');
 try{
  const sum=currentSummary(),sections=selectedSections();
  q('#reportRange').textContent=(sum.period.from===sum.period.to?F.dateLabel(sum.period.from):F.dateLabel(sum.period.from)+' até '+F.dateLabel(sum.period.to))+' · '+sum.period.days.length+(sum.period.days.length===1?' dia':' dias');
  const pages=sections.length?buildPdf(sum,{sections}).pages:0;
  const m=sum.money,v=F.verdict(sum);
  box.innerHTML=`<p class="report-preview-period"><strong>${esc(sum.period.title.charAt(0).toUpperCase()+sum.period.title.slice(1))}</strong></p>
  <dl class="report-preview-list">
   <div><dt>Água medida</dt><dd>${esc(F.m3(sum.measured))}</dd></div>
   <div><dt>Dias com leitura</dt><dd>${sum.coverage.withData} de ${sum.coverage.elapsed}</dd></div>
   <div><dt>Gasto até agora</dt><dd>${m.configured?esc(F.money(m.measuredWithFixed)):'<span class="report-muted">sem tarifa</span>'}</dd></div>
   <div><dt>${sum.coverage.future?'Previsão do período':'Estimativa do período'}</dt><dd>${m.configured&&m.projectedWithFixed!==null?esc(F.money(m.projectedWithFixed)):'—'}</dd></div>
   <div><dt>Esperado (referência)</dt><dd>${m.configured&&m.expectedWithFixed!==null?esc(F.money(m.expectedWithFixed)):'—'}</dd></div>
  </dl>
  <p class="report-verdict report-verdict-${v.code}">${esc(v.title)}</p>
  <p class="report-pages">${sections.length?`<b>${sections.length}</b> seções · cerca de <b>${pages}</b> ${pages===1?'página':'páginas'}`:'Marque pelo menos uma seção.'}</p>
  ${!m.configured&&sections.some(id=>id==='money'||id==='reference')?'<button type="button" class="report-hint" data-open-bill>Informe o preço do m³ para ver os valores em reais →</button>':''}
  ${!sum.coverage.withData?'<p class="report-hint-text">Ainda não há leituras neste período; o PDF explicará como registrar o consumo.</p>':''}`;
  box.querySelector('[data-open-bill]')?.addEventListener('click',()=>{const d=q('#reportBill');d.open=true;q('#reportPrice').focus();});
  btn.disabled=!sections.length;
 }catch(err){box.innerHTML='<p class="form-error">'+esc(err.message)+'</p>';q('#reportRange').textContent='';btn.disabled=true;}
}
function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify({period:selectedPeriod(),sections:selectedSections(),includeDemo:q('#reportIncludeDemo').checked}));}catch{}}
async function loadLogo(){
 try{
  const img=new Image();img.src='hydrocasa-symbol.png';await img.decode();
  const c=document.createElement('canvas');c.width=c.height=180;const ctx=c.getContext('2d');
  ctx.fillStyle='#0b1b3f';ctx.fillRect(0,0,180,180);ctx.drawImage(img,0,0,180,180);
  const data=c.toDataURL('image/jpeg',.92).split(',')[1],bin=atob(data),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return {bytes,width:180,height:180};
 }catch{return null;}
}
async function generate(){
 const status=q('#reportStatus'),btn=q('#reportDownload'),open=q('#reportOpen');
 const form=q('#reportForm');
 for(const input of form.querySelectorAll('[data-extra]:not([hidden]) input')){if(!input.value){status.className='form-error report-status';status.textContent='Preencha a data do período escolhido.';input.focus();return;}}
 const sections=selectedSections();
 if(!sections.length){status.className='form-error report-status';status.textContent='Marque pelo menos uma seção para gerar o relatório.';return;}
 btn.disabled=true;btn.classList.add('is-busy');status.className='report-status';status.textContent='Gerando o PDF…';
 try{
  saveBill();
  const sum=currentSummary(),logo=await loadLogo();
  const {bytes,pages}=buildPdf(sum,{sections,logo});
  const blob=new Blob([bytes],{type:'application/pdf'}),name=fileName(sum.period);
  if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=objectUrl;a.download=name;document.body.append(a);a.click();a.remove();
  status.className='report-status report-ok';status.innerHTML='✓ Pronto! <b>'+esc(name)+'</b> ('+pages+' '+(pages===1?'página':'páginas')+') foi baixado.';
  open.href=objectUrl;open.hidden=false;
  window.dispatchEvent(new CustomEvent('hydrocasa:relatorio-gerado',{detail:{name,pages,bytes:bytes.length}}));
 }catch(err){status.className='form-error report-status';status.textContent='Não foi possível gerar o PDF: '+err.message;}
 finally{btn.disabled=false;btn.classList.remove('is-busy');}
}
/** Abre a janela. opts: {period:'thisMonth'|..., day, month, from, to} */
function open(opts={}){
 if(!overlay)build();
 lastFocus=document.activeElement;
 const prefs=readJSON(localStorage,PREF_KEY,{});
 const kind=opts.period||prefs.period||'thisMonth';
 const radio=overlay.querySelector(`[name=reportPeriod][value="${kind}"]`)||overlay.querySelector('[name=reportPeriod][value=thisMonth]');radio.checked=true;
 const today=F.keyOf(new Date());
 q('#reportDay').value=opts.day||q('#reportDay').value||today;q('#reportDay').max=today;
 q('#reportMonth').value=opts.month||q('#reportMonth').value||today.slice(0,7);
 q('#reportFrom').value=opts.from||q('#reportFrom').value||today.slice(0,8)+'01';
 q('#reportTo').value=opts.to||q('#reportTo').value||today;
 const saved=Array.isArray(prefs.sections)?new Set(prefs.sections):null;
 overlay.querySelectorAll('[name=reportSection]').forEach(c=>c.checked=saved?saved.has(c.value):true);
 const demo=hasDemo();q('#reportDemoWrap').hidden=!demo;q('#reportIncludeDemo').checked=demo&&prefs.includeDemo!==false&&!Object.keys(readLedger().history).length;
 const s=F.read(localStorage);
 q('#reportPrice').value=s.pricePerM3??'';q('#reportFixed').value=s.fixedMonthly||'';q('#reportGoal').value=s.monthlyGoal??'';q('#reportName').value=s.householdName||'';
 q('#reportBill').open=!s.pricePerM3||!!opts.bill;
 q('#reportStatus').textContent='';q('#reportOpen').hidden=true;q('#reportCalcMsg').textContent='';
 overlay.hidden=false;document.body.classList.add('report-modal-open');
 onChange();renderPreview();
 requestAnimationFrame(()=>(opts.bill?q('#reportPrice'):radio).focus());
}
function close(){if(!overlay||overlay.hidden)return;overlay.hidden=true;document.body.classList.remove('report-modal-open');lastFocus?.focus?.();}

/* ---------- Pontos de acesso ---------- */
function mountEntryPoints(){
 // 1) Cabeçalho: sempre visível, em todas as páginas.
 const actions=q('.header-actions');
 if(actions&&!q('#hydroReportBtn')){
  const b=document.createElement('button');b.type='button';b.id='hydroReportBtn';b.className='report-header-btn';b.setAttribute('aria-haspopup','dialog');b.title='Gerar relatório em PDF';
  b.innerHTML=icon+'<span>Relatório PDF</span>';b.onclick=()=>open();
  actions.insertBefore(b,q('#hydroProfileBtn')||actions.firstChild);
 }
 // 2) Painel: cartão de destaque com atalhos de período.
 const anchor=q('#alertsOverview')||q('#dashboard-page .dashboard-shortcuts-area');
 if(anchor&&!q('#reportCta')){
  const card=document.createElement('section');card.id='reportCta';card.className='report-cta';card.setAttribute('aria-labelledby','reportCtaTitle');
  card.innerHTML=`<div class="report-cta-icon" aria-hidden="true">${icon}</div><div class="report-cta-copy"><span class="report-kicker">NOVO · RELATÓRIO COMPLETO</span><h2 id="reportCtaTitle">Baixe o relatório da sua água em PDF</h2><p>Consumo, quanto já foi gasto, a previsão da conta e o valor esperado para os moradores — em um arquivo fácil de ler e compartilhar.</p></div><div class="report-cta-actions"><div class="report-cta-quick" role="group" aria-label="Atalhos de período"><button type="button" data-quick="today">Hoje</button><button type="button" data-quick="thisMonth">Este mês</button><button type="button" data-quick="lastMonth">Mês passado</button><button type="button" data-quick="lastYear">Ano passado</button></div><button type="button" class="primary-btn report-cta-main">${downloadIcon}<span>Gerar relatório PDF</span></button></div>`;
  card.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>open({period:b.dataset.quick}));
  card.querySelector('.report-cta-main').onclick=()=>open();
  anchor.after(card);
  // Mostra apenas na Visão geral, como os demais cartões de resumo.
  const sync=()=>{card.hidden=(document.body.dataset.uxTab||'dashboard')!=='dashboard';};
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-ux-tab']});sync();
 }
 // 3) Meu consumo: usa o período filtrado na página.
 const refresh=q('#refreshConsumption');
 if(refresh&&!q('#consumptionReportBtn')){
  const wrap=document.createElement('div');wrap.className='report-page-actions';refresh.replaceWith(wrap);
  const b=document.createElement('button');b.type='button';b.id='consumptionReportBtn';b.className='primary-btn report-inline-btn';b.innerHTML=icon+'<span>Gerar relatório PDF deste período</span>';
  b.onclick=()=>{const from=q('#historyFrom')?.value,to=q('#historyTo')?.value,sel=q('#historyPeriod')?.value;const map={today:'today',week:'last7',month:'thisMonth'};open(map[sel]?{period:map[sel]}:from&&to?{period:'custom',from,to}:{});};
  wrap.append(b,refresh);
 }
}
root.HydroReport.open=open;root.HydroReport.close=close;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountEntryPoints);else mountEntryPoints();
// Os alertas criam o cartão de visão geral depois; reposiciona o destaque quando ele surgir.
window.addEventListener('load',()=>{const cta=q('#reportCta'),alerts=q('#alertsOverview');if(cta&&alerts&&alerts.nextElementSibling!==cta)alerts.after(cta);});
})(typeof globalThis!=='undefined'?globalThis:this);
