import {chromium} from 'file:///C:/Users/teemu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
// Päivitys 2.10 -> 2.11 vaihtaa tuntilistan tiedostonimen. Käyttäjän puhelimella
// on valmis tuntilista vanhan aliviivanimen alla, ja sen on näyttävä valikossa
// heti: muuten vaikuttaa siltä, ettei valmista listaa saa avattua.
const browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext();const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
await page.goto(base);
await page.evaluate(async ({ready})=>{
 const {initialState,steps}=await import('/lib/capture.ts');const {putStored}=await import('/lib/local-files.ts');const {writeLocal}=await import('/lib/local-capture.ts');
 await putStored('setup:complete',true);await putStored('storage:choice',{mode:'browser',name:'Sovellusmuisti'});
  await putStored('workbook:Tuntilista_Testi0325.xlsx',{filename:'Tuntilista_Testi0325.xlsx',bytes:new Uint8Array(ready),kind:'hours',savedToFolder:false});
 const s=initialState();s.name='Testi Testiajo';s.nameLocked=true;s.active='hours';s.drafts.hours.values.date='2025-03-05';s.drafts.hours.step=steps.hours.length;await writeLocal(s);
},{ready:[...readFileSync('work/listat-fixtures/Tuntilista Ajuri.xlsx')]});
await page.reload();
await page.getByRole('button',{name:'Tunnit Henkilökohtainen tuntilista'}).click();
await page.locator('input[type=date]').first().fill('2025-03-05');
const summary=page.locator('.day-overview summary');
await summary.waitFor();
assert.match(await summary.innerText(),/\(4\)/,'valmiin tuntilistan päivät eivät näyttäneet listassa');
assert.ok(!(await page.locator('.day-overview p.hint').first().innerText()).includes('tiedostoa ei ole vielä'),'valmis tuntilista näytti puuttuvan');
assert.deepEqual((await page.locator('.day-list strong').allInnerTexts()).sort(),['3.3.2025','4.3.2025','5.3.2025','6.3.2025']);
// Päivän avaaminen siirtää vanhan nimen uudeksi.
await page.locator('.day-list button').filter({hasText:'6.3.2025'}).click();
await page.getByText('Vantaa - Espoo - Vantaa',{exact:false}).first().waitFor();
assert.deepEqual(errors,[]);
await browser.close();
console.log('PASS browser: vanhan nimen valmis tuntilista löytyy listasta ja päivä avautuu');
