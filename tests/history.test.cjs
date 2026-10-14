const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const HydroConsumption=require('../HydroCasa_ESP32_LittleFS1.0.0-20261001T112649Z-1-001/HydroCasa_ESP32_LittleFS1.0.0/data/consumption.js');
const source=fs.readFileSync(path.join(__dirname,'../HydroCasa_ESP32_LittleFS1.0.0-20261001T112649Z-1-001/HydroCasa_ESP32_LittleFS1.0.0/data/app.js'),'utf8');
function setup(values={}){
  const storage=new Map(Object.entries(values));
  const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
  const ctx=vm.createContext({HydroConsumption,localStorage,Date,Math,Number,JSON});
  const profileCode=source.slice(source.indexOf('function applyProfile('),source.indexOf('function activityInput('));
  vm.runInContext(source.slice(0,source.indexOf('async function poll()'))+profileCode+'\nglobalThis.api={state,addSnapshot,save,applyProfile};',ctx);
  return {...ctx.api,storage,localStorage};
}
const day='2026-10-13';
const sample=(liters1,liters2=0,session_id='boot-0',device_id='esp32')=>({liters1,liters2,session_id,device_id});
test('daily total survives more than 250 snapshots',()=>{
  const a=setup();for(let i=0;i<=300;i++)a.addSnapshot(day,sample(i),i*2000);
  assert.equal(a.state.history[day].total1,300);assert.equal(a.state.history[day].snapshots.length,250);
});
test('reset preserves earlier total and counts new session',()=>{
  const a=setup();a.addSnapshot(day,sample(100));a.addSnapshot(day,sample(110));
  a.addSnapshot(day,sample(0,0,'boot-1'));a.addSnapshot(day,sample(5,0,'boot-1'));
  assert.equal(a.state.history[day].total1,15);
});
test('reboot between polls adds new session volume and flags partial coverage',()=>{
  const a=setup();a.addSnapshot(day,sample(100));a.addSnapshot(day,sample(110));a.addSnapshot(day,sample(5,0,'new-boot-0'));
  assert.equal(a.state.history[day].total1,15);assert.equal(a.state.history[day].partial,true);
});
test('reload and duplicate response do not double count',()=>{
  const a=setup();a.addSnapshot(day,sample(0));a.addSnapshot(day,sample(10));
  const b=setup(Object.fromEntries(a.storage));b.addSnapshot(day,sample(10));b.addSnapshot(day,sample(12));
  assert.equal(b.state.history[day].total1,12);
});
test('midnight does not assign an unknown cross-day interval',()=>{
  const a=setup();a.addSnapshot(day,sample(0));a.addSnapshot(day,sample(10));
  a.addSnapshot('2026-10-14',sample(25));a.addSnapshot('2026-10-14',sample(28));
  assert.equal(a.state.history[day].total1,10);assert.equal(a.state.history['2026-10-14'].total1,3);
});
test('counter rollback preserves recorded liters',()=>{
  const a=setup();a.addSnapshot(day,sample(100));a.addSnapshot(day,sample(110));a.addSnapshot(day,sample(2));a.addSnapshot(day,sample(4));
  assert.equal(a.state.history[day].total1,12);
});
test('another device establishes a new baseline',()=>{
  const a=setup();a.addSnapshot(day,sample(0));a.addSnapshot(day,sample(10));a.addSnapshot(day,sample(90,0,'boot-0','other'));
  assert.equal(a.state.history[day].total1,10);
});
test('zero measurement is a recorded reading',()=>{
  const a=setup();a.addSnapshot(day,sample(0));a.addSnapshot(day,sample(0));
  assert.equal(a.state.history[day].total1,0);assert.equal(a.state.history[day].readings,2);
});
test('legacy total is preserved and marked partial',()=>{
  const a=setup({hydrocasa_history:JSON.stringify({[day]:{total1:15,total2:5,snapshots:[{l1:15,l2:5}]}})});
  a.addSnapshot(day,sample(500,500));a.addSnapshot(day,sample(502,503));
  assert.equal(a.state.history[day].total1,17);assert.equal(a.state.history[day].total2,8);
});
test('malformed JSON and storage quota failure do not stop in-memory collection',()=>{
  const a=setup({hydrocasa_ledger_v2:'{broken',hydrocasa_history:'{broken'});
  a.localStorage.setItem=()=>{throw new Error('quota');};a.addSnapshot(day,sample(0));a.addSnapshot(day,sample(3));
  assert.equal(a.state.history[day].total1,3);assert.equal(a.state.storageError,true);
});

test('profile changes preserve measured totals and historical residents across reload',()=>{
  const a=setup(),t=new Date(2026,9,13,12).getTime();
  a.applyProfile({residents:2,scope:'whole'},t);
  a.addSnapshot(day,sample(0),t);a.addSnapshot(day,sample(20),t+2000);
  a.applyProfile({residents:4,scope:'whole'},t+3000);
  assert.equal(a.state.history[day].total1,20);
  assert.equal(a.state.history[day].profile.residents,2);
  assert.equal(a.state.history[day].profileMixed,true);
  const b=setup(Object.fromEntries(a.storage));
  assert.equal(b.state.household.residents,4);
  assert.equal(b.state.history[day].profile.residents,2);
  b.addSnapshot('2026-10-14',sample(25),t+86400000);
  assert.equal(b.state.history['2026-10-14'].profile.residents,4);
});
test('first profile after collection starts cannot retroactively classify the day',()=>{
  const a=setup(),t=new Date(2026,9,13,12).getTime();
  a.addSnapshot(day,sample(0),t);a.applyProfile({residents:3,scope:'whole'},t+1000);
  assert.equal(a.state.history[day].profileMixed,true);
  assert.equal(HydroConsumption.compareDay(a.state.history[day],a.state.household).code,'unknown');
});
