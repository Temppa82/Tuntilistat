import {chromium} from 'file:///C:/Users/teemu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
// Poistopainikkoa painetaan oikeassa selaimessa, koska vain siinä syntyy
// taulukon lukeva jäsentäjä. Tarkistetaan, että päivä katoaa listasta, solut
// tyhjentyvät ja jokainen kaava säilyy.
const browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext();const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
await page.goto(base);
const setup=await page.evaluate(async ({pamark})=>{
 const {initialState,steps}=await import('/lib/capture.ts');
 const {putStored,getStored}=await import('/lib/local-files.ts');
 const {writeLocal}=await import('/lib/local-capture.ts');
 const {dayOverview}=await import('/lib/day-overview.ts');
 const {dayKey}=await import('/lib/day-drafts.ts');
 const file='Pamark ajolista syyskuu 1-2 2026.xlsx';
 await putStored('setup:complete',true);
 await putStored('storage:choice',{mode:'browser',name:'Sovellusmuisti'});
 await putStored(`workbook:${file}`,{filename:file,bytes:new Uint8Array(pamark),kind:'pamark',savedToFolder:false,updatedAt:new Date().toISOString()});
 const name='Testi Testiajo';
 const overview=await dayOverview('pamark','2026-09-01',name);
 const first=overview.days[0];
 // Päivälle jätetään välimuistiluonnos, joka myös on poistettava.
 await putStored(dayKey('pamark',name,first.date,first.vehicle),{id:'x',step:0,updatedAt:'',overnight:false,values:{vehicle:first.vehicle,date:first.date,start:'06:00',startKm:'1',end:'14:00',endKm:'9',loadingHours:'1',stops:'1',route:'vantaa'}});
 const s=initialState();s.name=name;s.nameLocked=true;s.active='pamark';
 s.drafts.pamark.values.date=first.date;s.drafts.pamark.values.vehicle=first.vehicle;
 s.drafts.pamark.step=steps.pamark.length;await writeLocal(s);
 return {file,count:overview.days.length,first};
},{pamark:[...readFileSync('work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx')]});
assert.ok(setup.count>=2,'päivälehtiössä on oltava vähintään kaksi päivää');
await page.reload();
const rows=page.locator('.day-list li');
// Päivälista on oletuksena kiinni ja aukeaa aktiivisen ajoneuvon kohdalta.
await page.locator('.day-overview summary').click();
await rows.first().waitFor();
assert.equal(await rows.count(),setup.count,'päivärivien määrä ei täsmää luettuun listaan');

// Nappi on avaamispainikkeen vieressä eikä sen sisällä, joten HTML on kelvollinen.
assert.equal(await page.locator('.day-list li button.day-remove').count(),setup.count);
assert.equal(await page.locator('.day-list button button').count(),0,'napin sisällä on toinen nappi');
// Poistanappi ei saa viedä koko rivin leveyttä, vaan sen on oltava napautettava.
const box=await rows.first().evaluate(li=>{const a=li.querySelector('button:first-child').getBoundingClientRect(),b=li.querySelector('button.day-remove').getBoundingClientRect();
 return {open:Math.round(a.width),remove:Math.round(b.width),openTop:Math.round(a.top),removeTop:Math.round(b.top),removeH:Math.round(b.height),openH:Math.round(a.height),over:li.scrollWidth-li.clientWidth};});
assert.ok(box.remove<box.open,`poist-nappi on koko rivin levyinen: ${JSON.stringify(box)}`);
assert.ok(box.remove>44,`poist-nappi on liian kapea: ${box.remove}px`);
assert.ok(Math.abs(box.openTop-box.removeTop)<=1&&Math.abs(box.openH-box.removeH)<=1,`napit eivät ole samalla rivillä: ${JSON.stringify(box)}`);
assert.ok(box.over<=0,`rivi ylitää ${box.over}px`);

await page.locator('.day-list li button.day-remove').first().click();
const dialog=page.getByRole('dialog');
await dialog.waitFor();
assert.ok((await dialog.innerText()).includes(setup.first.vehicle),'vahvistus ei näytä autoa');
assert.ok((await dialog.innerText()).includes('Poista päivä'),'vahvistuksessa ei ole vahvistusnappia');
// Peruutus ei saa muuta mitään.
await dialog.getByRole('button',{name:'Peruuta'}).click();
await dialog.waitFor({state:'detached'});
assert.equal(await rows.count(),setup.count,'peruutus muutti listaa');

await page.locator('.day-list li button.day-remove').first().click();
await dialog.waitFor();
await dialog.getByRole('button',{name:'Poista päivä'}).click();
await page.getByText('Poistettiin',{exact:false}).waitFor();
// Päivälehtiö lukee päivät tallennetusta tiedostosta, joten lista päivittyy
// vasta luvun valmistuttua. Odotetaan se sen sijaan että todettaisiin heti.
await page.waitForFunction(n=>document.querySelectorAll('.day-list li').length===n,setup.count-1);
assert.equal(await rows.count(),setup.count-1,'poistettu päivä on yhä listalla');

const state=await page.evaluate(async ({file,first})=>{
 const {getStored}=await import('/lib/local-files.ts');
 const {XlsxDocument}=await import('/lib/xlsx-document.ts');
 const {dayKey}=await import('/lib/day-drafts.ts');
 const record=await getStored(`workbook:${file}`);
 const before=await getStored(`backup:none`);
 const sheet=new XlsxDocument(record.bytes).snapshot();
 return {sheet,draft:await getStored(dayKey('pamark','Testi Testiajo',first.date,first.vehicle)),before};
},{file:setup.file,first:setup.first});

// Solut tyhjentyivät ja päivä katosi listalta.
const removed=await page.evaluate(async ({file,first})=>{
 const {getStored}=await import('/lib/local-files.ts');
 const {pamarkDayList}=await import('/lib/read-pamark.ts');
 const {XlsxDocument}=await import('/lib/xlsx-document.ts');
 const record=await getStored(`workbook:${file}`);
 const {findPamarkTarget}=await import('/lib/pamark-target.ts');
 const sheet=new XlsxDocument(record.bytes).snapshot();
 const target=findPamarkTarget(sheet,first.vehicle,first.date,false);
 return {still:target.existing,days:pamarkDayList(record.bytes).length,total:Object.entries(sheet).filter(([,c])=>c.formula).length,shared:Object.entries(sheet).filter(([,c])=>(c.formula||'').startsWith('#shared:')).length,row:target.row};
},{file:setup.file,first:setup.first});
assert.equal(removed.still,false,'poistettu päivä löytyy yhä taulukosta');
assert.equal(removed.days,setup.count-1,'taulukossa on yhä poistettu päivä');
// Kaavat ovat tallella. Yhteensärivillä on 6 isäntäkaavaa, jotka kantavat
// itse kaavatekstinsä, ja 18 jatkosolua, joilla on vain jaetun kaavan indeksi.
assert.equal(removed.total,417,`kaavojen määrä muuttui: ${removed.total}`);
assert.equal(removed.shared,18,`jaettujen kaavojen määrä muuttui: ${removed.shared}`);
assert.equal(state.draft,undefined,'päivän välimuistiluonnos jäi sovellusmuistiin');
assert.deepEqual(errors,[]);
await page.screenshot({path:'work/ui-poista.png',fullPage:true});
await browser.close();
console.log('PASS browser remove: vahvistus, peruutus, päivä poistuu listalta, solut tyhjät, 417 kaavaa ja 18 jaettua säilyvät, muistin luonnos hävitty');
