const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('HydroCasa_ESP32_LittleFS1.0.0-20261001T112649Z-1-001/HydroCasa_ESP32_LittleFS1.0.0/data/index.html','utf8');
const script=html.match(/<script id="consumptionPageScript">([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const ctx=vm.createContext({Date,Number,Error});
vm.runInContext(script.slice(script.indexOf('const dateKey='),script.indexOf('let saved='))+'globalThis.api={datesBetween,summarize};',ctx);
const {datesBetween,summarize}=ctx.api;
test('period includes both endpoints and validates calendar dates and size',()=>{
 assert.equal(datesBetween('2024-02-28','2024-03-01').length,3);
 assert.throws(()=>datesBetween('2026-02-30','2026-03-01'));
 assert.throws(()=>datesBetween('2026-03-02','2026-03-01'));
 assert.throws(()=>datesBetween('2024-01-01','2026-01-01'));
});
test('summary distinguishes measured zero, partial readings and absent days without changing history',()=>{
 const history={'2026-10-01':{readings:2,total1:10,total2:20,partial:true},'2026-10-02':{readings:1,total1:0,total2:0,partial:true}};
 const before=JSON.stringify(history),s=summarize(history,datesBetween('2026-10-01','2026-10-03'));
 assert.equal(s.total,30);assert.equal(s.count,2);assert.equal(s.average,15);assert.equal(s.partial,2);
 assert.equal(s.rows[2].h,null);assert.equal(JSON.stringify(history),before);
});
test('invalid readings do not become zero consumption in period statistics',()=>{
 const s=summarize({'2026-10-01':{readings:1,total1:-1,total2:2}},['2026-10-01']);
 assert.equal(s.count,0);assert.equal(s.average,null);
});
test('about route selects one page and preserves navigation to consumption and dashboard',()=>{
 const elements=new Map(),links=['dashboard','consumption','about'].map(page=>({dataset:{page},setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]}}));
 const q=id=>{if(!elements.has(id))elements.set(id,{hidden:false,focus(){this.focused=true}});return elements.get(id)};
 const context=vm.createContext({q,URLSearchParams,location:{search:'?pagina=sobre'},document:{querySelectorAll:()=>links},render:()=>{},window:{dispatchEvent:()=>{}},Event:function(){}});
 const start=script.indexOf('function route(focus=false)'),end=script.indexOf("document.querySelectorAll('[data-page]').forEach(link=>link.addEventListener",start);
 vm.runInContext(script.slice(start,end)+'globalThis.route=route;',context);
 context.route(true);assert.equal(q('about-page').hidden,false);assert.equal(q('dashboard-page').hidden,true);assert.equal(q('consumption-page').hidden,true);assert.equal(context.document.title,'Sobre nós | HydroCasa');
 for(const [search,page] of [['?pagina=consumo','consumption'],['','dashboard']]){context.location.search=search;context.route();assert.equal(q(page+'-page').hidden,false);assert.equal(q('about-page').hidden,true);}
});
