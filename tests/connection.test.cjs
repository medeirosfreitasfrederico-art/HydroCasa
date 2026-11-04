const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const HydroConsumption=require('../HydroCasa_ESP32_LittleFS1.0.0-20261001T112649Z-1-001/HydroCasa_ESP32_LittleFS1.0.0/data/consumption.js');
const source=fs.readFileSync(path.join(__dirname,'../HydroCasa_ESP32_LittleFS1.0.0-20261001T112649Z-1-001/HydroCasa_ESP32_LittleFS1.0.0/data/app.js'),'utf8');
const valid={ok:true,device_id:'esp32',session_id:'boot-0',liters1:10,liters2:5,flow1_lpm:2,flow2_lpm:1,pulses1:4500,pulses2:2250,uptime_ms:10000};
const response=data=>({ok:true,json:async()=>data});
function setup(fetch){
  const elements=new Map(),timers=new Map(),alerts=[];let id=0;
  const element=s=>{if(!elements.has(s))elements.set(s,{textContent:'',className:'',style:{},dataset:{},hidden:false,disabled:false,classList:{contains:()=>false},querySelector:()=>null});return elements.get(s);};
  const ctx=vm.createContext({HydroConsumption,fetch,AbortController,Date,Math,Number,JSON,
    localStorage:{getItem:()=>null,setItem:()=>{}},document:{querySelector:element,body:{dataset:{}}},navigator:{onLine:true},console:{warn:()=>{}},
    setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:i=>timers.delete(i),
    confirm:()=>true,alert:s=>alerts.push(s)});
  vm.runInContext(source.slice(0,source.indexOf('$("#closeModal")'))+
    '\nupdateChart=()=>{};updateAnalysis=()=>{};updateHousehold=()=>{};'+
    '\nglobalThis.api={state,poll,runPoll,requestJson,validateLive,updateLive};',ctx);
  return {...ctx.api,elements,timers,alerts};
}
test('valid sample renders API flow fields and records last valid time',async()=>{
  const a=setup(async url=>response(url==='/api/live'?valid:{ok:true}));await a.poll();
  assert.equal(a.state.connected,true);assert.ok(a.state.lastValidAt);
  assert.match(a.elements.get('#flow1').textContent,/0,002 m³\/min/);
});
test('HTTP failure preserves last reading and marks it stale',async()=>{
  let fail=false;const a=setup(async url=>fail?{ok:false,status:503}:response(url==='/api/live'?valid:{ok:true}));
  await a.poll();const timestamp=a.state.lastValidAt;fail=true;await a.poll();
  assert.equal(a.state.connected,false);assert.equal(a.state.live.liters1,10);assert.equal(a.state.lastValidAt,timestamp);
  assert.match(a.elements.get('#statusDetail').textContent,/Última leitura há/);
  assert.equal(a.elements.get('.live-dot').textContent,'DADOS ANTIGOS');
});
test('missing, negative, non-finite and incompatible fields are rejected',()=>{
  const a=setup();for(const patch of [{liters1:undefined},{flow1_lpm:-1},{liters2:NaN},{pulses1:1.5},{session_id:''},{liters1:'10'}])
    assert.throws(()=>a.validateLive({...valid,...patch}));
});
test('malformed response does not create a history reading',async()=>{
  const a=setup(async()=>({ok:true,json:async()=>{throw new SyntaxError('bad JSON');}}));await a.poll();
  assert.equal(a.state.connected,false);assert.equal(a.state.lastValidAt,null);assert.equal(Object.keys(a.state.history).length,0);
});
test('a save error is visible without claiming the live device is disconnected',async()=>{
  const a=setup(async url=>url==='/api/live'?response(valid):{ok:false,status:500});await a.poll();
  assert.equal(a.state.connected,true);assert.equal(a.state.syncError,true);
  assert.match(a.elements.get('#todayDelta').textContent,/Falha ao salvar no ESP32/);
});
test('timeout aborts a stalled request and clears its timer',async()=>{
  const a=setup((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))));
  const pending=a.requestJson('/api/live');const rejection=assert.rejects(pending,/aborted/);
  [...a.timers.values()].find(x=>x.ms===5000).fn();await rejection;assert.equal(a.timers.size,0);
});
test('polling schedules another request only after the current cycle ends',async()=>{
  let resolve;const a=setup(url=>url==='/api/live'?new Promise(r=>resolve=r):Promise.resolve(response({ok:true})));
  const pending=a.runPoll();assert.equal([...a.timers.values()].filter(x=>x.ms===2000).length,0);
  resolve(response(valid));await pending;
  assert.equal([...a.timers.values()].filter(x=>x.ms===2000).length,1);
});
test('the public page never calls the unauthenticated reset endpoint',()=>{
  // O reset remoto foi removido da interface até que o firmware exija autorização (docs/reset-security.md).
  assert.equal(/fetch\([^)]*\/api\/reset|requestJson\([^)]*\/api\/reset/.test(source),false);
});
test('initial view does not display absent sensor data as zero',()=>{
  const a=setup();a.updateLive();assert.equal(a.elements.get('#todayTotal').textContent,'—');
  assert.equal(a.elements.get('#flow1').textContent,'—');
  assert.match(a.elements.get('#alertContent').textContent,/indisponível/);
});
