// Verificação de navegador contra um servidor HTTP local e uma API simulada — nunca o ESP32 físico.
// Executar: node tests/ui-smoke.cjs   (requer Playwright; CHROME_PATH=/caminho/do/chrome é opcional)
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.join(__dirname,'../HydroCasa_ESP32_LittleFS1.0.0-20261001T112649Z-1-001/HydroCasa_ESP32_LittleFS1.0.0/data');
const live={ok:true,device_id:'test-device',session_id:'test-session',liters1:0,liters2:0,flow1_lpm:2,flow2_lpm:1,pulses1:0,pulses2:0,uptime_ms:10000};
const types={'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.jpeg':'image/jpeg'};
const server=http.createServer((req,res)=>{
  const url=req.url.split('?')[0];
  if(url.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(url==='/api/live'?live:{ok:true}));return;}
  const file=path.join(root,url==='/'?'index.html':decodeURIComponent(url.slice(1)));
  if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
// Histórico de 40 dias para o relatório (dia atual fica para a coleta ao vivo).
function seedLedger(){
  const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const profile={residents:2,referenceMode:'snis',referenceLiters:152.1,tolerance:10,scope:'whole',ramal1:'Ramal 01',ramal2:'Ramal 02'};
  const history={};for(let i=1;i<=40;i++){const d=new Date();d.setDate(d.getDate()-i);history[key(d)]={snapshots:[],readings:10,total1:200,total2:100,partial:false,profile};}
  return JSON.stringify({version:2,history,cursor:null,household:null,activityRecords:{}});
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo',locale:'pt-BR',acceptDownloads:true});
    await context.addInitScript(ledger=>{try{if(!sessionStorage.getItem('seeded')){localStorage.setItem('hydrocasa_ledger_v2',ledger);sessionStorage.setItem('seeded','1');}}catch{}},seedLedger());
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    await page.waitForFunction(()=>document.querySelector('#connectionBadge').textContent.includes('Online'));
    assert.match(await page.locator('#flow1').textContent(),/0,002 m³\/min/);
    // A publicação inicial do simulador não pode abrir o diálogo "ESP32 conectado".
    await page.waitForTimeout(2500);
    assert.equal(await page.locator('.demo-dialog-backdrop').count(),0,'diálogo de demonstração indevido');

    // Primeiro acesso: boas-vindas guiada configura moradores, sensores e preço.
    await page.locator('.hc-wiz').waitFor();
    await page.locator('[data-w=next]').click();                 // Começar
    await page.locator('[data-w=plus]').click();                 // 3 → 4 moradores
    assert.match(await page.locator('#hcWizPeopleNote').textContent(),/608 L/);
    await page.locator('[data-w=next]').click();
    await page.locator('[data-spot="2"][data-v="Chuveiro"]').click();
    await page.locator('[data-w=next]').click();
    await page.locator('#hcWizPrice').fill('8');
    await page.locator('[data-w=next]').click();                 // salva
    await page.locator('[data-w=next]').click();                 // Ir para o painel
    await page.locator('.hc-wiz').waitFor({state:'detached'});
    let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('hydrocasa_ledger_v2')).household);
    assert.equal(saved.residents,4);assert.equal(saved.ramal1,'Cozinha');assert.equal(saved.ramal2,'Chuveiro');assert.equal(saved.scope,'whole');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('hydrocasa:financeiro')).pricePerM3),8);
    assert.equal(await page.locator('.pf-strip').isVisible(),true,'faixa de perfil configurado');
    // "Hoje na sua casa": litros, situação em palavras simples, água correndo agora e gráficos.
    await page.waitForFunction(()=>document.querySelector('#hcLiters').textContent!=='—');
    assert.match(await page.locator('#hcVerdict').textContent(),/esperado/);
    assert.match(await page.locator('#hcNow').textContent(),/Água correndo|Nenhuma água/);
    assert.match(await page.locator('#hcGaugeCap').textContent(),/608 L/);
    assert.equal(await page.locator('#hcWeek .hc-day').count(),7);
    assert.match(await page.locator('#hcSplit').textContent(),/Chuveiro/);
    assert.equal(await page.locator('.hero-premium').isVisible(),false,'com perfil, a página começa pelos números');

    // Painel lateral do perfil: edição rápida e valores da conta.
    await page.locator('#hydroProfileBtn').click();
    await page.locator('#pfDrawer, .pf-drawer').waitFor();
    await page.locator('[data-step="1"]').click();
    assert.match(await page.locator('#pfLive').textContent(),/0,761 m³/);
    await page.locator('#pfPrice').fill('10');await page.locator('#pfGoal').fill('150');await page.locator('#pfName').fill('Casa de teste');
    await page.locator('#pfSave').click();
    assert.match(await page.locator('#pfMessage').textContent(),/Perfil salvo/);
    const ledger=await page.evaluate(()=>JSON.parse(localStorage.getItem('hydrocasa_ledger_v2')));
    assert.equal(ledger.household.residents,5);
    const finance=await page.evaluate(()=>JSON.parse(localStorage.getItem('hydrocasa:financeiro')));
    assert.equal(finance.pricePerM3,10);assert.equal(finance.monthlyGoal,150);assert.equal(finance.householdName,'Casa de teste');
    await page.keyboard.press('Escape');
    await page.locator('.pf-layer').waitFor({state:'hidden'});

    // Relatório PDF: período, checklist, cálculo pelo valor da conta e download.
    await page.locator('#hydroReportBtn').click();
    await page.locator('.report-period:has(input[value=lastMonth])').click();
    await page.locator('[data-preset=none]').click();
    assert.equal(await page.locator('#reportDownload').isDisabled(),true,'sem seções o download fica bloqueado');
    await page.locator('[data-preset=all]').click();
    await page.locator('.report-check:has(input[value=method])').click();
    assert.match(await page.locator('#reportCount').textContent(),/11 de 12/);
    // O preço já foi salvo no perfil: a seção da conta abre recolhida e mostra o valor.
    assert.match(await page.locator('#reportBillState').textContent(),/R\$\s?10,00/);
    await page.locator('#reportBill > summary').click();
    await page.locator('.report-helper summary').click();
    await page.locator('#reportBillTotal').fill('150');await page.locator('#reportBillM3').fill('10');await page.locator('#reportFixed').fill('30');
    await page.locator('#reportCalc').click();
    assert.equal(await page.locator('#reportPrice').inputValue(),'12.00');
    await page.waitForTimeout(300);
    assert.match(await page.locator('#reportPreview').textContent(),/R\$/);
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#reportDownload').click()]);
    assert.match(download.suggestedFilename(),/^hydrocasa-relatorio-\d{4}-\d{2}-01_a_\d{4}-\d{2}-\d{2}\.pdf$/);
    const pdf=fs.readFileSync(await download.path());
    assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
    assert.ok((pdf.toString('latin1').match(/\/Type \/Page /g)||[]).length>=2,'PDF com várias páginas');
    assert.match(await page.locator('#reportStatus').textContent(),/Pronto/);
    await page.keyboard.press('Escape');

    // Meu consumo oferece o relatório do período filtrado.
    await page.goto(base+'/?pagina=consumo');
    await page.locator('#consumptionReportBtn').click();
    assert.equal(await page.locator('[name=reportPeriod]:checked').inputValue(),'last7');
    await page.keyboard.press('Escape');

    // Fluxo contínuo real: com limite de 1 min e água correndo há 2 min, o aviso aparece sozinho.
    await page.evaluate(()=>{localStorage.setItem('hydrocasa:vazamento-minutos','1');const n=Date.now();sessionStorage.setItem('hydrocasa:fluxo-continuo',JSON.stringify({r0:{since:n-120000,last:n,flow:2}}));});
    await page.goto(base);await page.waitForFunction(()=>document.querySelector('#connectionBadge').textContent.includes('Online'));
    await page.locator('#hcLeak:not([hidden])').waitFor({timeout:8000});
    assert.match(await page.locator('#hcLeak').textContent(),/sem parar há 2 minutos — Cozinha/);
    assert.doesNotMatch(await page.locator('#hcLeak').textContent(),/TESTE/);
    await page.locator('#hcLeak [data-hc=leak-ok]').click();
    await page.waitForTimeout(2500);
    assert.equal(await page.locator('#hcLeak').isHidden(),true,'"está tudo bem" silencia até a água parar');
    // Justificar consumo: dia, atividade, duração, balanço, editar e desfazer remoção.
    await page.locator('#hcJustify').click();
    await page.locator('#jcForm').waitFor();
    await page.locator('[data-group=banho]').click();await page.locator('[data-variant=shower]').click();await page.locator('[data-min="15"]').click();
    assert.match(await page.locator('#jcResult').textContent(),/675 L/,'5 pessoas × ducha 15 min');
    await page.locator('#jcSubmit').click();
    assert.match(await page.locator('#jcBalance').textContent(),/Banho — ducha/);
    await page.locator('[data-day=yesterday]').click();
    assert.match(await page.locator('#jcBalance').textContent(),/Medido pelos sensores\s*300 L/);
    await page.locator('[data-group=roupa]').click();await page.locator('#jcSubmit').click();
    assert.match(await page.locator('#jcBalance .jc-verdict').textContent(),/Faltam 165 L/);
    await page.locator('[data-remove="0"]').click();
    assert.match(await page.locator('#jcBalance').textContent(),/Nenhuma atividade registrada/);
    await page.locator('#jcUndo').click();
    assert.match(await page.locator('#jcBalance').textContent(),/Roupas/);
    const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('hydrocasa_ledger_v2')).activityRecords);
    assert.equal(Object.values(records).flat().length,2);
    // Aviso de água correndo (teste pela aba Sistema).
    await page.locator('[data-panel=settings]').click();
    await page.locator('#hcLeakTest').click();
    assert.match(await page.locator('#hcLeak').textContent(),/TESTE.*Água correndo sem parar/);
    await page.locator('#hcLeak [data-hc=leak-ok]').click();
    assert.equal(await page.locator('#hcLeak').isHidden(),true);
    await page.locator('[data-panel=activities]').click();
    await page.screenshot({path:'/tmp/hydrocasa-activities-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-panel=dashboard]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Painel sem rolagem lateral no celular');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.locator('#hydroReportBtn').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.keyboard.press('Escape');
    await page.locator('[data-panel=settings]').click();assert.match(await page.locator('#methodologyContent').textContent(),/Fontes e estudos/);
    await page.locator('#themeBtn').click();await page.screenshot({path:'/tmp/hydrocasa-system-mobile-dark.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Browser checks passed: connection, welcome wizard, today summary and charts, profile drawer, finance settings, PDF report (period, checklist, bill helper, download), consumption shortcut, justify-consumption assistant, leak warning, mobile width and dark theme.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
