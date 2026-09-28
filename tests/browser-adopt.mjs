import {chromium} from 'file:///C:/Users/teemu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
// Käyttäjä tuo uuden valmis tuntilistan, mutta sovellus näyttää oman vanhan
// versionsa. Tuonnin on siirryttävä tuodun listan jaksolle, ja tuotu tiedosto on
// saatettava käyttöön yhdellä painalluksella.
const browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext();const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
await page.goto(base);
await page.evaluate(async ()=>{
 const {initialState,steps}=await import('/lib/capture.ts');const {putStored}=await import('/lib/local-files.ts');const {writeLocal}=await import('/lib/local-capture.ts');
 await putStored('setup:complete',true);await putStored('storage:choice',{mode:'browser',name:'Sovellusmuisti'});
 const s=initialState();s.name='Testi Testiajo';s.nameLocked=true;s.active='hours';s.drafts.hours.values.date='2026-09-23';s.drafts.hours.step=steps.hours.length;await writeLocal(s);
});
await page.reload();
const day=()=>page.locator('section').filter({has:page.getByRole('heading',{name:'Avaa päivä',exact:true})});
await day().waitFor();
// Sovellus on syyskuussa, tuotu tiedosto on maaliskuusta 2025.
const before=await day().getByLabel('Päivämäärä').inputValue();
assert.ok(before.startsWith('2026-09'),`sovellus ei ollut syyskuussa vaan ${before}`);
await day().locator('input[type=file]').setInputFiles('work/listat-fixtures/Tuntilista Ajuri.xlsx');
const adopt=page.getByRole('button',{name:/Käytä tuotua tiedostoa/});
await adopt.waitFor();
assert.equal(await day().getByLabel('Päivämäärä').inputValue(),'2025-03-03','käyttöliittymä ei siirtynyt tuodun listan jaksolle');
assert.match(await adopt.innerText(),/Tuntilista Testi0325\.xlsx/);
assert.match(await page.locator('.day-overview summary').innerText(),/\(4\)/,'tuodun listan päivät eivät näy');
await adopt.click();
await page.getByText(/Tiedosto Tuntilista Testi0325\.xlsx on nyt käytössä/).waitFor();
assert.deepEqual(errors,[]);
await browser.close();
console.log('PASS browser: tuotu tiedosto siirtää jaksolle, näkyy listassa ja voidaan ottaa käyttöön');
