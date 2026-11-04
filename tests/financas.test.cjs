// Regras de períodos, custos e previsões do relatório (sem navegador, rede ou sensor).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const dir='../HydroCasa_ESP32_LittleFS1.0.0-20261001T112649Z-1-001/HydroCasa_ESP32_LittleFS1.0.0/data/';
globalThis.HydroConsumption=require(dir+'consumption.js');
const F=require(dir+'financas.js');
const now=new Date(2026,10,4,10); // 04/11/2026
const profile={residents:2,referenceMode:'snis',referenceLiters:152.1,tolerance:10,scope:'whole',ramal1:'Cozinha',ramal2:'Banheiro'};

test('periods resolve to the expected calendar ranges',()=>{
  const p=(k,o)=>F.resolvePeriod(k,o,now);
  assert.deepEqual([p('today').from,p('today').to],['2026-11-04','2026-11-04']);
  assert.equal(p('yesterday').from,'2026-11-03');
  assert.equal(p('last7').days.length,7);assert.equal(p('last7').from,'2026-10-29');
  assert.equal(p('last30').days.length,30);
  const month=p('thisMonth');assert.equal(month.from,'2026-11-01');assert.equal(month.to,'2026-11-30');assert.equal(month.elapsed.length,4);assert.equal(month.future.length,26);
  assert.deepEqual([p('lastMonth').from,p('lastMonth').to],['2026-10-01','2026-10-31']);
  assert.deepEqual([p('month',{month:'2024-02'}).from,p('month',{month:'2024-02'}).to],['2024-02-01','2024-02-29']);
  assert.equal(p('thisYear').days.length,365);
  assert.deepEqual([p('lastYear').from,p('lastYear').to],['2025-01-01','2025-12-31']);
  assert.equal(p('day',{day:'2026-10-20'}).days.length,1);
  assert.equal(p('custom',{from:'2026-10-01',to:'2026-10-10'}).days.length,10);
});
test('invalid period choices give clear messages',()=>{
  assert.throws(()=>F.resolvePeriod('day',{day:'2026-02-30'},now),/dia/);
  assert.throws(()=>F.resolvePeriod('custom',{from:'2026-10-10',to:'2026-10-01'},now),/anterior/);
  assert.throws(()=>F.resolvePeriod('custom',{from:'2024-01-01',to:'2026-01-01'},now),/366/);
  assert.throws(()=>F.resolvePeriod('month',{month:'2026-13'},now),/mês/);
});
test('settings validate money values and normalise empty fields',()=>{
  const s=F.settings({pricePerM3:'12.5',fixedMonthly:'',monthlyGoal:0,householdName:'  Casa Azul  '});
  assert.equal(s.pricePerM3,12.5);assert.equal(s.fixedMonthly,0);assert.equal(s.monthlyGoal,null);assert.equal(s.householdName,'Casa Azul');
  assert.throws(()=>F.settings({pricePerM3:-1}),/preço/);
  assert.equal(F.maybeSettings({pricePerM3:'abc'}).pricePerM3,null);
});
test('price per m³ can be derived from the water bill',()=>{
  assert.equal(F.priceFromBill({billTotal:180,billM3:15,fixedMonthly:30}),10);
  assert.throws(()=>F.priceFromBill({billTotal:100,billM3:0}),/m³/);
  assert.throws(()=>F.priceFromBill({billTotal:20,billM3:5,fixedMonthly:25}),/taxa fixa/);
});
test('monthly summary computes spent, expected and projected money',()=>{
  const period=F.resolvePeriod('thisMonth',{},now);
  const history={
    '2026-11-01':{readings:5,total1:200,total2:100,partial:false,profile},
    '2026-11-02':{readings:5,total1:150,total2:50,partial:false,profile},
    '2026-11-04':{readings:3,total1:80,total2:20,partial:true,profile}
  };
  const s=F.summarize({period,history,currentProfile:profile,settings:{pricePerM3:10,fixedMonthly:30,monthlyGoal:200},now});
  assert.equal(s.measured,600);assert.equal(s.coverage.withData,3);assert.equal(s.coverage.empty,1);assert.equal(s.coverage.future,26);
  assert.equal(s.average,200);
  assert.equal(s.money.measured,6);                      // 0,6 m³ × R$ 10
  assert.ok(Math.abs(s.money.fixedFull-30)<1e-9);       // mês inteiro = 1 taxa fixa
  assert.ok(Math.abs(s.money.fixedElapsed-4)<1e-9);     // 4 de 30 dias
  assert.equal(s.projected,6000);                        // 200 L × 30 dias
  assert.equal(s.money.projectedWithFixed,90);           // 6 m³ × 10 + 30
  assert.ok(Math.abs(s.referenceFull-2*152.1*30)<1e-6);
  assert.ok(Math.abs(s.money.expected-91.26)<1e-6);
  assert.equal(s.money.goalStatus,'within');
  assert.equal(s.r1,430);assert.equal(s.r2,170);
  assert.equal(s.peak.day,'2026-11-01');assert.equal(s.lowest.day,'2026-11-04');
  assert.equal(s.perResident,300);
});
test('summary without tariff keeps volumes and leaves money empty',()=>{
  const period=F.resolvePeriod('today',{},now);
  const s=F.summarize({period,history:{'2026-11-04':{readings:1,total1:10,total2:5,partial:true}},currentProfile:profile,now});
  assert.equal(s.money.configured,false);assert.equal(s.money.measured,null);assert.equal(s.measured,15);
  assert.equal(F.money(s.money.measured),'—');
});
test('invalid readings are not counted as zero consumption',()=>{
  const period=F.resolvePeriod('last7',{},now);
  const s=F.summarize({period,history:{'2026-11-03':{readings:1,total1:-1,total2:4},'2026-11-02':{readings:0,total1:0,total2:0}},currentProfile:profile,now});
  assert.equal(s.coverage.withData,0);assert.equal(s.average,null);assert.equal(s.projected,null);
  assert.equal(F.verdict(s).code,'empty');
});
test('activities and alerts are grouped inside the chosen period only',()=>{
  const period=F.resolvePeriod('last7',{},now);
  const activityRecords={'2026-11-03':[{id:'shower',name:'Banho',liters:270,quantity:2},{id:'shower',name:'Banho',liters:135,quantity:1}],'2026-10-01':[{id:'car',name:'Carro',liters:40}]};
  const alerts=[{id:'a',criadoEm:new Date(2026,10,3,9).getTime(),mensagem:'x'},{id:'b',criadoEm:new Date(2026,8,1).getTime()}];
  const s=F.summarize({period,history:{},currentProfile:profile,settings:{pricePerM3:10},activityRecords,alerts,now});
  assert.equal(s.activities.length,1);assert.equal(s.activities[0].liters,405);assert.equal(s.activities[0].occurrences,3);
  assert.ok(Math.abs(s.activities[0].cost-4.05)<1e-9);
  assert.equal(s.alerts.length,1);assert.equal(s.alerts[0].id,'a');
});
test('verdict explains the comparison in plain language',()=>{
  const period=F.resolvePeriod('yesterday',{},now);
  const s=F.summarize({period,history:{'2026-11-03':{readings:4,total1:300,total2:100,partial:false,profile}},currentProfile:profile,now});
  const v=F.verdict(s);assert.equal(v.code,'above');assert.match(v.title,/acima/);
});
test('formatters use Brazilian conventions',()=>{
  assert.equal(F.money(1234.5).replace(/\s/g,' '),'R$ 1.234,50');
  assert.equal(F.m3(456),'0,456 m³');assert.equal(F.liters(1234.4),'1.234 L');
});
