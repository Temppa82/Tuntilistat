import {chromium} from 'file:///C:/Users/teemu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
// Tuntilistan päivän poisto, vaiheittainen Kumoa ja koko päivän hylkäys
// kokeillaan oikeassa selaimessa, koska vain siinä syntyy taulukon lukeva
// jäsentäjä. Tarkistetaan että kaavat säilyvät ja että lomake tyhjentyy.
const browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext();const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const name='Testi Testiajo';
const fi=d=>`${Number(d.slice(8,10))}.${Number(d.slice(5,7))}.${d.slice(0,4)}`;
await page.goto(base);

// Päivä, jossa on oikeaa kirjausta, ja vapaa päivä samasta kuukaudesta. Molemmat
// osoittavat samaan tiedostoon, joten lista pysyy yhtenä. Luonnoksen rekisteri-
// numero täyttää päivämäärän, jotteirollToToday siirrä tyhjää luonnosta tälle
// päivälle, ja hasDayValues ei laske sitä päivän kirjaukseksi.
const setup=await page.evaluate(async ({hours,name})=>{
 const {initialState,steps}=await import('/lib/capture.ts');
 const {putStored}=await import('/lib/local-files.ts');
 const {writeLocal}=await import('/lib/local-capture.ts');
 const {workbookName}=await import('/lib/workbook-export.ts');
 const {XlsxDocument}=await import('/lib/xlsx-document.ts');
 const {dayOverview}=await import('/lib/day-overview.ts');
 const {dayKey}=await import('/lib/day-drafts.ts');
 const {hoursTemplate}=await import('/lib/hours-template.ts');
 const sheet=new XlsxDocument(new Uint8Array(hours)).snapshot();
 const row=hoursTemplate.entryRows.find(r=>sheet[`C${r}`]?.value!=null);
 const date=new Date(Date.UTC(1899,11,30)+Number(sheet[`A${row}`].value)*86400000).toISOString().slice(0,10);
 const file=workbookName('hours',date,name);
 await putStored('setup:complete',true);
 await putStored('storage:choice',{mode:'browser',name:'Sovellusmuisti'});
 await putStored(`workbook:${file}`,{filename:file,bytes:new Uint8Array(hours),kind:'hours',savedToFolder:false,updatedAt:new Date().toISOString()});
 const overview=await dayOverview('hours',date,name);
 // Muistissa oleva päivän luonnos, joka on poistettava.
 await putStored(dayKey('hours',name,date,''),{id:'x',step:0,updatedAt:'',overnight:false,values:{vehicle:'ABC-123',date,start:'06:00',startKm:'1',end:'14:00',endKm:'9',waiting:'0',breakMinutes:'0',allowance:'0',foreignAllowance:'0',sick:'0',route:'vantaa'}});
 const s=initialState();s.name=name;s.nameLocked=true;s.active='hours';
 s.drafts.hours.values.date=date;s.drafts.hours.values.vehicle='ABC-123';s.drafts.hours.step=steps.hours.length;
 await writeLocal(s);
 return {file,date,row,count:overview.days.length,days:overview.days.map(d=>d.date),formulas:Object.entries(sheet).filter(([,c])=>c.formula).length,cells:Object.keys(sheet).length};
},{hours:[...readFileSync('work/listat-fixtures/Tuntilista Ajuri.xlsx')],name});
assert.ok(setup.count>=2,'tuntilistassa on oltava vähintään kaksi päivää');
assert.ok(setup.days.includes(setup.date),'poistettava päivä ei ole listalla');

// --- Tuntilistan päivän poisto listanäkymästä ---
await page.reload();
const rows=page.locator('.day-list li');
await rows.first().waitFor();
assert.equal(await rows.count(),setup.count,'päivärivien määrä ei täsmää luettuun listaan');
// Poista on nyt myös tuntilistassa, ei vain ajolistassa.
assert.equal(await page.locator('.day-list li button.day-remove').count(),setup.count,'poistanappi puuttuu tuntilistan riveiltä');
// Kohdistetaan poistettava päivä omaan riviinsä, koska lista on päivätjärjestyksessä.
const targetRow=page.locator('.day-list li',{hasText:fi(setup.date)});
assert.equal(await targetRow.count(),1,'poistettavaa päivää ei ole listalla');
assert.ok((await targetRow.innerText()).includes(fi(setup.date)),'päivän otsikko ei näy listalla');

await targetRow.locator('button.day-remove').click();
const dialog=page.getByRole('dialog');
await dialog.waitFor();
const text=await dialog.innerText();
assert.ok(text.includes(fi(setup.date)),'vahvistus ei näytä päivää');
// Tuntilistassa päivä tunnistuu päivämäärällä, joten autokohtaa ei kysytä.
assert.ok(!text.includes('Ajoneuvo'),'tuntilistan vahvistus kysyi autoa');
await dialog.getByRole('button',{name:'Peruuta'}).click();
await dialog.waitFor({state:'detached'});
assert.equal(await rows.count(),setup.count,'peruutus muutti listaa');

await targetRow.locator('button.day-remove').click();
await dialog.waitFor();
await dialog.getByRole('button',{name:'Poista päivä'}).click();
await page.waitForFunction(n=>document.querySelectorAll('.day-list li').length===n,setup.count-1);
const removed=await page.evaluate(async ({file,date,name})=>{
 const {getStored}=await import('/lib/local-files.ts');
 const {XlsxDocument}=await import('/lib/xlsx-document.ts');
 const {hoursDays}=await import('/lib/read-hours.ts');
 const {dayKey}=await import('/lib/day-drafts.ts');
 const record=await getStored(`workbook:${file}`);
 const sheet=new XlsxDocument(record.bytes).snapshot();
 return {days:hoursDays(record.bytes,name),draft:await getStored(dayKey('hours',name,date,'')),
  formulas:Object.entries(sheet).filter(([,c])=>c.formula).length,cells:Object.keys(sheet).length};
},{file:setup.file,date:setup.date,name});
assert.ok(!removed.days.includes(setup.date),'poistettu päivä on yhä taulukossa');
assert.equal(removed.days.length,setup.count-1,'poisto muutti päivien määrää');
assert.equal(removed.formulas,setup.formulas,`kaavojen määrä muuttui: ${removed.formulas}`);
assert.equal(removed.cells,setup.cells,'poisto muutti solujen määrää');
assert.equal(removed.draft,undefined,'päivän välimuistiluonnos jäi sovellusmuistiin');
// Poistettu päivä ei saa jäädä lomakkeeseen, muuten tallennus kirjoittaisi sen
// heti takaisin. Katsausnäkymässä vain päivämäärä on täytetty.
assert.equal(await page.locator('.capture-review dd',{hasText:'Puuttuu'}).count(),11,'lomake ei tyhjentynyt');

// --- Vaiheittainen Kumoa ---
const free='2025-03-20';
await page.evaluate(async ({name,free})=>{
 const {initialState}=await import('/lib/capture.ts');
 const {writeLocal}=await import('/lib/local-capture.ts');
 const s=initialState();s.name=name;s.nameLocked=true;s.active='hours';
 s.drafts.hours.values.date=free;s.drafts.hours.values.vehicle='ABC-123';
 await writeLocal(s);
},{name,free});
await page.reload();
const undo=page.locator('.capture-undo button',{hasText:'Kumoa'});
const input=page.locator('.question-input');
await input.waitFor();
// Avattuun vaiheeseen ei ole muutettu mitään, joten kumoa ei ole käytettävissä.
assert.equal(await undo.isDisabled(),true,'kumoa oli käytettävissä ilman muutoksia');
assert.equal(await input.inputValue(),'ABC-123','rekisterinumero ei ollut valmiiksi täytetty');

// Täyttö aiheuttaa tallennuksen, jonka tilateksti vaihtuu ja siirtää sivun
// asettelua. Odotetaan rauha ennen klikkausta, muuten klikkaus voi osua
// väärään painikkeeseen.
const settle=()=>page.getByText('Luonnos tallessa tällä laitteella.',{exact:true}).waitFor();

await input.fill('XYZ-789');
await settle();
await page.getByRole('button',{name:'Seuraava'}).click();
await page.getByText('2 / 12').waitFor();
assert.equal(await undo.isDisabled(),false,'kumoa ei aktivoitunut muutoksen jälkeen');
assert.ok((await page.locator('.capture-undo-hint').innerText()).includes('Ajoneuvo'),'kumoa ei kerro kumottavaa vaihetta');
await undo.click();
// Takaisin omaan kysymykseen ja edelliseen arvoon, ei tyhjään kenttään.
await page.getByText('1 / 12').waitFor();
assert.equal(await input.inputValue(),'ABC-123','kumoa ei palauttanut edellistä arvoa');
assert.equal(await page.locator('#question-label').innerText(),'Ajoneuvo?','kumoa ei palannut omaan kysymykseen');
assert.equal(await undo.isDisabled(),true,'kumoa jäi käytettävään tyhjään historiaan');

// Kumoa on käytettävissä heti ensimmäisestä muutoksesta, vaikka vaiheesta ei ole
// poistuttu. Näin kenttään kirjoitettu arvo ei jää kumoamatta, vaikka käyttäjä
// huomaa virheen vasta myöhemmin.
await input.fill('XYZ-789');
await settle();
assert.equal(await undo.isDisabled(),false,'kumoa ei aktivoitunut ennen vaiheesta poistumista');
assert.ok((await page.locator('.capture-undo-hint').innerText()).includes('Ajoneuvo'),'kumoa ei kerro kumottavaa vaihetta ennen poistumista');
await undo.click();
await page.getByText('1 / 12').waitFor();
assert.equal(await input.inputValue(),'ABC-123','kumoa ei palauttanut arvoa ennen vaiheesta poistumista');
assert.equal(await page.locator('#question-label').innerText(),'Ajoneuvo?','kumoa vei väärään kysymykseen');
assert.equal(await undo.isDisabled(),true,'kumoa jäi käytettävään tyhjään historiaan');

// --- Koko päivän hylkäys keskeneräisestä täytöstä ---
// Ajoneuvosta päivämäärään ja sitten aloitusajatunnille, jolloin luonnoksessa on
// muutakin kuin pelkkä päivämäärä.
await page.getByRole('button',{name:'Seuraava'}).click();
await page.getByText('2 / 12').waitFor();
await page.getByRole('button',{name:'Seuraava'}).click();
await page.getByText('3 / 12').waitFor();
assert.equal(await page.locator('#question-label').innerText(),'Aloitusaika?','väärä kysymys avautui');
await input.fill('06:00');
await settle();
const discard=page.locator('.capture-undo button.discard');
await discard.click();
await dialog.waitFor();
assert.ok((await dialog.innerText()).includes('Hylkääkö päivän täyttö?'),'hylkäyksen vahvistus puuttuu');
await dialog.getByRole('button',{name:'Peruuta'}).click();
await dialog.waitFor({state:'detached'});
assert.equal(await input.inputValue(),'06:00','hylkäyksen peruutus unohti kysymyksen');
await discard.click();
await dialog.waitFor();
await dialog.getByRole('button',{name:'Hylkää päivä'}).click();
await page.getByText('Päivän täyttö hylättiin',{exact:false}).waitFor();
// Päivää ei ollut tallennettu, joten lomake tyhjentyi mutta tiedosto ei muuttunut.
assert.equal(await page.locator('.capture-review dd',{hasText:'Puuttuu'}).count(),11,'hylkäys ei tyhjentänyt lomaketta');
assert.ok((await page.locator('.capture-undo-hint').innerText()).includes('Päivän täyttö hylättiin'),'hylkäyksestä ei kerrottu');
const kept=await page.evaluate(async file=>{const {getStored}=await import('/lib/local-files.ts');const {XlsxDocument}=await import('/lib/xlsx-document.ts');
 const sheet=new XlsxDocument((await getStored(`workbook:${file}`)).bytes).snapshot();
 return {formulas:Object.entries(sheet).filter(([,c])=>c.formula).length,cells:Object.keys(sheet).length};},setup.file);
assert.deepEqual(kept,{formulas:setup.formulas,cells:setup.cells},'hylkäys muutti tallennettua tiedostoa');

// --- Tallennetun päivän hylkäys poistaa sen myös tiedostosta ---
const target=setup.days.find(d=>d!==setup.date);
await page.locator('.day-list li',{hasText:fi(target)}).locator('button').first().click();
await page.getByText('Tarkista kirjaukset').waitFor();
await page.locator('.capture-undo button.discard').click();
await dialog.waitFor();
await dialog.getByRole('button',{name:'Hylkää päivä'}).click();
await page.getByText('poistettiin tiedostosta',{exact:false}).waitFor();
const gone=await page.evaluate(async ({file,name,target})=>{const {getStored}=await import('/lib/local-files.ts');const {hoursDays}=await import('/lib/read-hours.ts');
 return {days:hoursDays((await getStored(`workbook:${file}`)).bytes,name)};},{file:setup.file,name,target});
assert.ok(!gone.days.includes(target),'hylkatty päivä on yhä tiedostossa');
assert.equal(gone.days.length,setup.count-2,'hylkäys poisti väärän määrän päiviä');

// --- Sama Kumoa ja hylkäys Pamarkin ajolistalla ---
// Ajolistan päivä tunnistuu autosta ja päivämäärästä, joten vahvistuksessa
// kysytän autoa. Kumoa ja hylkäys toimivat molemmilla listoilla.
const pam=await page.evaluate(async ({bytes,name})=>{
 const {initialState,steps}=await import('/lib/capture.ts');
 const {putStored}=await import('/lib/local-files.ts');
 const {writeLocal}=await import('/lib/local-capture.ts');
 const {pamarkDayList}=await import('/lib/read-pamark.ts');
 const {existingPamarkDay}=await import('/lib/open-pamark.ts');
 const {XlsxDocument}=await import('/lib/xlsx-document.ts');
 const {dayKey}=await import('/lib/day-drafts.ts');
 const {newDraft}=await import('/lib/capture.ts');
 const file='Pamark ajolista syyskuu 1-2 2026.xlsx';
 await putStored(`workbook:${file}`,{filename:file,bytes:new Uint8Array(bytes),kind:'pamark',savedToFolder:false,updatedAt:new Date().toISOString()});
 const days=pamarkDayList(new Uint8Array(bytes));
 const own=days.filter(d=>d.label==='JTS-790');
 const date=own[0].date;
 // Tiedoston päivän sisältö ladataan lomakkeelle käynnistyksessä, joten kumoan
 // kuuluu palautua juuri tiedoston reitti eikä omaan luonnostoon.
 const base=newDraft();base.values.date=date;base.values.vehicle='JTS-790';
 const route=existingPamarkDay(new Uint8Array(bytes),base).values.route;
 await putStored(dayKey('pamark',name,date,'JTS-790'),{id:'p',step:0,updatedAt:'',overnight:false,values:{vehicle:'JTS-790',date,start:'06:00',startKm:'1',end:'10:00',endKm:'5',waiting:'0',breakMinutes:'0',allowance:'0',foreignAllowance:'0',sick:'0',route:'vantaa-helsinki'}});
 const s=initialState();s.name=name;s.nameLocked=true;s.active='pamark';
 s.drafts.pamark.values.date=date;s.drafts.pamark.values.vehicle='JTS-790';s.drafts.pamark.step=steps.pamark.length;
 await writeLocal(s);
 // Ajolistan lista näyttää koko tiedoston päivät, joten vertailuluku on kaikki.
 const sheet=new XlsxDocument(new Uint8Array(bytes)).snapshot();
 return {file,date,vehicle:'JTS-790',count:days.length,own:own.length,size:bytes.length,route,
  formulas:Object.entries(sheet).filter(([,c])=>c.formula).length,cells:Object.keys(sheet).length};
},{bytes:[...readFileSync('work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx')],name});
await page.reload();
await page.getByText('Ajoneuvo',{exact:true}).first().waitFor();
assert.equal(await page.locator('.day-list li').count(),pam.count,'ajolistan päivärivit eivät täsmää');
// Kumoa toimii myös ajolistalla.
const pamUndo=page.locator('.capture-undo button',{hasText:'Kumoa'});
assert.equal(await pamUndo.isDisabled(),true,'kumoa oli käytettävissä ilman muutoksia');
await page.getByText('Tarkista kirjaukset').waitFor();
// Muokkaa avaa reitin kysymyksen, jonka arvo kumoa palauttaa.
await page.locator('.capture-review dl > div',{hasText:'Reitti'}).getByRole('button',{name:'Muokkaa'}).click();
await page.locator('textarea').waitFor();
await page.locator('textarea').fill('vantaa-helsinki-kerava');
await settle();
// Kumoa toimii heti muutoksen jälkeen myös ajolistalla, joten vaiheesta ei
// tarvitse poistua kumottaakseen.
assert.equal(await pamUndo.isDisabled(),false,'kumoa ei aktivoitunut ajolistalla heti muutoksen jälkeen');
assert.ok((await page.locator('.capture-undo-hint').innerText()).includes('Reitti'),'kumoa ei kerro kumottavaa vaihetta ajolistalla');
await pamUndo.click();
await page.locator('textarea').waitFor();
assert.equal(await page.locator('textarea').inputValue(),pam.route,'kumoa ei palauttanut tiedoston reittiä ajolistalla');
assert.equal(await pamUndo.isDisabled(),true,'kumoa jäi käytettävään historiaan ajolistalla');
// Hylkäys poistaa päivän myös ajolistan tiedostosta ja kysyy vahvistuksessa autoa.
await page.getByRole('button',{name:'Hylkää päivä'}).click();
await dialog.waitFor();
const pamText=await dialog.innerText();
assert.ok(pamText.includes(fi(pam.date)),'ajolistan vahvistus ei näytä päivää');
assert.ok(pamText.includes('JTS-790'),'ajolistan vahvistus ei kysy autoa');
await dialog.getByRole('button',{name:'Hylkää päivä'}).click();
await page.getByText('poistettiin tiedostosta',{exact:false}).waitFor();
const pamGone=await page.evaluate(async ({file,vehicle})=>{const {getStored}=await import('/lib/local-files.ts');const {pamarkDayList}=await import('/lib/read-pamark.ts');const {XlsxDocument}=await import('/lib/xlsx-document.ts');
 const record=await getStored(`workbook:${file}`);
 const days=pamarkDayList(record.bytes);
 const sheet=new XlsxDocument(record.bytes).snapshot();
 return {own:days.filter(d=>d.label===vehicle),count:days.length,
  formulas:Object.entries(sheet).filter(([,c])=>c.formula).length,cells:Object.keys(sheet).length};},{file:pam.file,vehicle:pam.vehicle});
assert.ok(!pamGone.own.some(d=>d.date===pam.date),'hylätty ajolistapäivä on yhä tiedostossa');
assert.equal(pamGone.count,pam.count-1,'ajolistasta poistui väärä määrä päiviä');
// Kaavat ja solumäärä säilyvät, kuten tuntilistassa.
assert.equal(pamGone.formulas,pam.formulas,`kaavojen määrä muuttui: ${pamGone.formulas}`);
assert.equal(pamGone.cells,pam.cells,'poisto muutti solujen määrää');

assert.deepEqual(errors,[]);
await page.screenshot({path:'work/ui-hylkaa.png',fullPage:true});
await browser.close();
console.log('PASS browser discard: tuntilistan Poista, Kumoa heti muutoksen jälkeen ja vaiheittain, hylkäys tyhjentää lomakkeen ja poistaa tallennetun päivän, sama ajolistalla');
