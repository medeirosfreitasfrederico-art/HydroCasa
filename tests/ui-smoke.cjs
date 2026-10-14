// Browser integration checks against a local HTTP fixture, never the physical ESP32.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.join(__dirname,'../HydroCasa_ESP32_LittleFS1.0.0-20261001T112649Z-1-001/HydroCasa_ESP32_LittleFS1.0.0/data');
const live={ok:true,device_id:'test-device',session_id:'test-session',liters1:0,liters2:0,flow1_lpm:2,flow2_lpm:1,pulses1:0,pulses2:0,uptime_ms:10000};
const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/api/live'?live:{ok:true}));return;}
  const file=path.join(root,req.url==='/'?'index.html':req.url.slice(1));
  if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>document.querySelector('#connectionBadge').textContent.includes('Online'));
    await page.evaluate(async()=>{if(currentPoll)await currentPoll;clearTimeout(pollTimer);});
    assert.match(await page.locator('#flow1').textContent(),/0,002 m³\/min/);
    await page.locator('#residentsInput').fill('4');await page.locator('#householdForm button[type=submit]').click();
    assert.equal(await page.locator('#householdTarget').textContent(),'0,6084 m³');
    assert.match(await page.locator('#profileMessage').textContent(),/salvo/);
    await page.locator('[data-panel=activities]').click();
    await page.locator('#activityMinutes').fill('5');
    assert.match(await page.locator('#activityPreview').textContent(),/0,060 m³/);
    assert.match(await page.locator('#activitySource').textContent(),/SAAE/);
    await page.locator('#activityObservedM3').fill('0.075');
    assert.match(await page.locator('#activityPreview').textContent(),/Acima/);
    await page.locator('#activityForm button[type=submit]').click();
    assert.match(await page.locator('#activityLog').textContent(),/0,075 m³/);
    await page.locator('#activitySelect').selectOption('dishes');await page.locator('#activityQuantity').fill('2');
    assert.match(await page.locator('#activityPreview').textContent(),/0,234 m³/);
    await page.locator('#activitySource summary').click();assert.ok(await page.locator('#activitySource a').getAttribute('href'));
    await page.locator('#activitySelect').selectOption('pool');await page.locator('#customActivityM3').fill('2');
    assert.match(await page.locator('#activityPreview').textContent(),/4,000 m³/);
    const ledger=await page.evaluate(()=>JSON.parse(localStorage.getItem('hydrocasa_ledger_v2')));
    assert.equal(ledger.household.residents,4);
    const today=await page.evaluate(()=>todayKey());assert.equal(ledger.activityRecords[today][0].residentsUsed,4);
    await page.reload();await page.waitForFunction(()=>document.querySelector('#connectionBadge').textContent.includes('Online'));
    assert.equal(await page.locator('#residentsInput').inputValue(),'4');
    await page.locator('[data-panel=activities]').click();assert.match(await page.locator('#activityLog').textContent(),/chuveiro elétrico/);
    await page.screenshot({path:'/tmp/hydrocasa-activities-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.screenshot({path:'/tmp/hydrocasa-activities-mobile.png',fullPage:true});
    await page.locator('[data-panel=settings]').click();assert.match(await page.locator('#methodologyContent').textContent(),/2020/);
    await page.locator('#themeBtn').click();await page.screenshot({path:'/tmp/hydrocasa-system-mobile-dark.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Browser checks passed: household, m³, source links, activity formulas/logs, reload, mobile width and dark theme.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
