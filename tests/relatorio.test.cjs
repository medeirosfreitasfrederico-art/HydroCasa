// Gerador de PDF e montagem do relatório (sem navegador).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const dir='../HydroCasa_ESP32_LittleFS1.0.0-20261001T112649Z-1-001/HydroCasa_ESP32_LittleFS1.0.0/data/';
globalThis.HydroConsumption=require(dir+'consumption.js');
const F=require(dir+'financas.js');
const P=require(dir+'pdf-simples.js');
const R=require(dir+'relatorio.js');
const now=new Date(2026,10,18,15);
const profile={residents:3,referenceMode:'snis',referenceLiters:152.1,tolerance:10,scope:'whole',ramal1:'Cozinha',ramal2:'Banheiro'};
function history(days=60){const h={};for(let i=0;i<days;i++){const d=new Date(now);d.setDate(d.getDate()-i);if(i%7===3)continue;h[F.keyOf(d)]={readings:20,total1:300+i,total2:150,partial:i===0,profile};}return h;}
const latin1=bytes=>Buffer.from(bytes).toString('latin1');

/** Confere se cada entrada do xref aponta para o início do objeto correspondente. */
function assertValidXref(bytes){
  const s=latin1(bytes);
  assert.ok(s.startsWith('%PDF-1.4'));assert.ok(s.trimEnd().endsWith('%%EOF'));
  const start=Number(/startxref\n(\d+)/.exec(s)[1]);
  assert.ok(s.slice(start).startsWith('xref'),'startxref aponta para a tabela');
  const entries=[...s.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map(m=>Number(m[1]));
  entries.forEach((offset,i)=>assert.ok(s.slice(offset).startsWith(`${i+1} 0 obj`),'objeto '+(i+1)));
  return s;
}
test('WinAnsi encoding keeps Portuguese accents, m³ and currency symbols',()=>{
  const bytes=P.encode('ção m³ R$ – “ok” ≈ ✓');
  assert.deepEqual(bytes.slice(0,3),[0xE7,0xE3,0x6F]);
  assert.ok(bytes.includes(0xB3),'³');assert.ok(bytes.includes(0x96),'–');assert.ok(bytes.includes(0x93),'“');
  assert.ok(!bytes.includes(63),'nenhum caractere vira "?"');
  assert.ok(P.textWidth('WWW',10,true)>P.textWidth('iii',10,false));
});
test('PDF writer produces a structurally valid multi-page file',()=>{
  const d=P.create({title:'Teste ção'});d.addPage();d.text('Olá',40,40);d.rect(40,60,100,20,{fill:'#2563eb',radius:6});d.addPage();d.text('Página 2',40,40);
  const s=assertValidXref(d.output());
  assert.equal((s.match(/\/Type \/Page /g)||[]).length,2);
  assert.match(s,/\/Title <FEFF/);
});
test('long text is wrapped inside the given width',()=>{
  const d=P.create();const lines=d.wrap('palavra '.repeat(60),10,false,200);
  assert.ok(lines.length>5);for(const l of lines)assert.ok(P.textWidth(l,10,false)<=200+0.01);
});
test('full monthly report has every section, footers and valid structure',()=>{
  const period=F.resolvePeriod('thisMonth',{},now);
  const sum=F.summarize({period,history:history(),currentProfile:profile,settings:{pricePerM3:12,fixedMonthly:30,monthlyGoal:200,householdName:'Casa Teste'},
    activityRecords:{[F.keyOf(now)]:[{id:'shower',name:'Banho — ducha',liters:270,quantity:2}]},alerts:[{id:'a',nivel:'Atenção',mensagem:'Fluxo contínuo',criadoEm:now.getTime()}],now});
  const {bytes,pages}=R.buildPdf(sum,{});
  const s=assertValidXref(bytes);
  assert.ok(pages>=4);
  assert.equal((s.match(/\/Type \/Page /g)||[]).length,pages);
  const text=hex=>Buffer.from(P.encode(hex)).toString('hex').toUpperCase();
  for(const t of ['Gastos em reais','Comparação com o esperado','Tabela detalhada','Dicas para economizar','Casa Teste','Página 1 de '+pages])
    assert.ok(s.includes(text(t)),'contém: '+t);
});
test('unchecked sections are left out of the PDF',()=>{
  const period=F.resolvePeriod('lastMonth',{},now);
  const sum=F.summarize({period,history:history(),currentProfile:profile,settings:{pricePerM3:12},now});
  const only=R.buildPdf(sum,{sections:['summary','money']}),all=R.buildPdf(sum,{});
  const hexOf=t=>Buffer.from(P.encode(t)).toString('hex').toUpperCase();
  const s=latin1(only.bytes);
  assert.ok(s.includes(hexOf('Gastos em reais')));
  assert.ok(!s.includes(hexOf('Tabela detalhada')));assert.ok(!s.includes(hexOf('Como os números foram calculados')));
  assert.ok(only.pages<all.pages);
});
test('reports still work without readings, profile or tariff',()=>{
  for(const kind of ['today','yesterday','last7','thisYear','lastYear']){
    const period=F.resolvePeriod(kind,{},now);
    const sum=F.summarize({period,history:{},currentProfile:null,now});
    const {bytes,pages}=R.buildPdf(sum,{});assertValidXref(bytes);assert.ok(pages>=2,kind);
  }
});
test('long periods are summarised by month and file names describe the period',()=>{
  const period=F.resolvePeriod('lastYear',{},now);
  const sum=F.summarize({period,history:history(400),currentProfile:profile,settings:{pricePerM3:12},now});
  assert.equal(sum.monthly.length,12);
  assert.equal(R.fileName(period),'hydrocasa-relatorio-2025-01-01_a_2025-12-31.pdf');
  assert.equal(R.fileName(F.resolvePeriod('today',{},now)),'hydrocasa-relatorio-2026-11-18.pdf');
  assertValidXref(R.buildPdf(sum,{}).bytes);
});
test('section catalogue has unique ids with plain-language descriptions',()=>{
  const ids=R.SECTIONS.map(s=>s.id);assert.equal(new Set(ids).size,ids.length);
  for(const s of R.SECTIONS){assert.ok(s.title&&s.desc.length>20&&s.group);}
  assert.ok(R.SECTIONS.filter(s=>s.essential).length>=3);
});
