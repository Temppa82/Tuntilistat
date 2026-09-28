import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {unzipSync,strFromU8} from 'fflate';
import {XlsxDocument} from '../lib/xlsx-document';
import {pamarkTemplate,pamarkDayRows} from '../lib/pamark-template';
import {pamarkSections,pamarkDays} from '../lib/pamark-target';
import {pamarkDayList,pamarkDayKey} from '../lib/read-pamark';
import {removeListedDay} from '../lib/remove-day';
import {getStored,putStored,deleteStored,type SavedWorkbook} from '../lib/local-files';
import {dayKey} from '../lib/day-drafts';
import {newDraft} from '../lib/capture';
import {workbookName} from '../lib/workbook-export';
import 'fake-indexeddb/auto';
Object.assign(globalThis,{DOMParser,XMLSerializer,window:{dispatchEvent:()=>true}});
const name='Testikuljettaja';

// Työkopio puhelimen muistista, kuten oikea sovellus tekee. Avain johtuu
// poistettavan päivän päivämäärästä, joten lista tallentuu sen omaan
// puolikauteen eikä uutta tyhjää listaa luoda väärään avaimelle.
const bytes=new Uint8Array(readFileSync('work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx'));
const preview=new XlsxDocument(bytes).snapshot();
const firstDay=pamarkDays(preview)[0];
assert.ok(firstDay,'ajolistasta ei löytynyt päivää poistettavaksi');
const filename=workbookName('pamark',firstDay.date,name);
const record={filename,bytes,kind:'pamark',updatedAt:new Date().toISOString(),savedToFolder:false} satisfies SavedWorkbook;
await putStored(`workbook:${filename}`,record);
const before=new XlsxDocument(record.bytes).snapshot();
const sections=pamarkSections(before);
const vehicle=sections[0].vehicle;
const target=pamarkDays(before).find(d=>d.vehicle===vehicle);
assert.ok(target,'ajolistasta ei löytynyt päivää poistettavaksi');
const row=target.row,routeRow=target.routeRow,headerRow=target.headerRow;

// Kaavat kerätään talteen koko taulukosta, jotta voidaan todeta että poisto ei
// muuttanut yhtään niistä: eivät päivän kaavoja eikä jaettuja yhteensäkaavoja.
const formulaBefore=Object.entries(before).filter(([,cell])=>cell.formula).map(([a,cell])=>[a,cell.formula] as const);
assert.ok(formulaBefore.length>0,'pohjan kaavat puuttuvat');
const sharedBefore=Object.keys(before).length;
const otherDays=pamarkDayList(record.bytes).filter(d=>pamarkDayKey(d)!==pamarkDayKey(target));
assert.ok(otherDays.length>0,'vertailtavia muita päiviä ei ole');

// Päivän välimuistiluonnos on ohjelman muistissa ja pitää hävitä.
const stale=newDraft();Object.assign(stale.values,{vehicle,date:target.date,start:'06:00',end:'15:00',startKm:'1',endKm:'2',loadingHours:'1',stops:'1',route:'vantaa'});
await putStored(dayKey('pamark',name,target.date,vehicle),stale);

const result=await removeListedDay('pamark',target.date,vehicle,name);
assert.equal(result.removed,true,'päivää ei poistettu');
assert.equal(result.row,row,'poistettiin väärä rivi');

const after=new XlsxDocument((await getStored<SavedWorkbook>(`workbook:${filename}`))!.bytes).snapshot();

// 1. Päivän kaikki muokattavat solut ovat tyhjät.
for(const column of Object.values(pamarkTemplate.columns))assert.equal(after[`${column}${row}`]?.value??null,null,`solu ${column}${row} ei tyhjentynyt`);
assert.equal(after[`A${routeRow}`]?.value??null,null,'reittirivi ei tyhjentynyt');

// 2. Kaavat ovat täsmälleen samat, myös jaettujen kaavojen sisältö.
const formulaAfter=Object.entries(after).filter(([,cell])=>cell.formula).map(([a,cell])=>[a,cell.formula] as const);
assert.deepEqual(formulaAfter,formulaBefore,'poisto muutti taulukon kaavoja');
assert.equal(Object.keys(after).length,sharedBefore,'poisto muutti taulukon solujen määrää');
// Jaettujen kaavojen attribuutit säilyvät, joten Excel laskee yhteensärivit.
const xml=strFromU8(unzipSync((await getStored<SavedWorkbook>(`workbook:${filename}`))!.bytes)['xl/worksheets/sheet1.xml']);
const shared=xml.match(/<f t="shared"[^>]*>/g)??[];
assert.ok(shared.length>=24,`jaettuja kaavoja oli vain ${shared.length}`);
assert.ok(shared.every(t=>/si="\d+"/.test(t)),'jaetusta kaavasta puuttuu si-indeksi');
assert.ok(xml.includes('t="shared" ref="F'),'yhteensärivin isäntäkaavan ref-aluetta ei säilynyt');
// Päivän oma laskentakaava on yhä paikallaan, vaikka sen lähteet tyhjennettiin.
for(const column of pamarkTemplate.computedColumns)assert.ok(after[`${column}${row}`]?.formula,`päivän kaava ${column}${row} katosi`);

// 3. Päivä on poistunut listasta ja muut päivät ovat paikallaan.
const list=pamarkDayList((await getStored<SavedWorkbook>(`workbook:${filename}`))!.bytes);
assert.equal(list.filter(d=>pamarkDayKey(d)===pamarkDayKey(target)).length,0,'poistettu päivä on yhä listalla');
assert.equal(list.length,otherDays.length,'poisto muutti päivien määrää');
for(const day of otherDays){
 const still=pamarkDays(after).find(d=>pamarkDayKey(d)===pamarkDayKey(day));
 assert.ok(still,`muu päivä ${day.date} katosi`);
 for(const column of Object.values(pamarkTemplate.columns))assert.equal(after[`${column}${still.row}`]?.value,before[`${column}${day.row}`]?.value,`muun päivän solu ${column} muuttui`);
}

// 4. Ohjelman muistissa oleva päivän luonnos on poistettu.
assert.equal(await getStored(dayKey('pamark',name,target.date,vehicle)),undefined,'päivän välimuistiluonnos jäi talteen');

// 5. Tyhjennetty rivi on käytettävissä uudelle kirjaukselle.
const reused=pamarkDayList((await getStored<SavedWorkbook>(`workbook:${filename}`))!.bytes);
assert.ok(reused.length===otherDays.length);

// 6. Toinen poisto samasta päivästä ei muuta mitään eikä kaadu.
const again=await removeListedDay('pamark',target.date,vehicle,name);
assert.equal(again.removed,false,'poistettu päivä poistettiin uudelleen');
assert.deepEqual(new XlsxDocument((await getStored<SavedWorkbook>(`workbook:${filename}`))!.bytes).snapshot(),after,'toinen poisto muutti taulukkoa');

// 7. Toisen auton päivä poistuu omasta osiostaan eikä koske ensimmäistä.
const otherSection=sections[1];
if(otherSection){
 const otherTarget=pamarkDays(after).find(d=>d.vehicle===otherSection.vehicle);
 if(otherTarget){
  const second=await removeListedDay('pamark',otherTarget.date,otherSection.vehicle,name);
  assert.equal(second.removed,true);
  assert.equal(second.row,otherTarget.row,'poistettiin väärän osion rivi');
  const last=new XlsxDocument((await getStored<SavedWorkbook>(`workbook:${filename}`))!.bytes).snapshot();
  assert.equal(last[`A${routeRow}`]?.value??null,null,'ensimmäisen osion reittirivi täyttyi uudelleen');
  for(const [a,f] of formulaBefore)assert.equal(last[a]?.formula,f,`kaava ${a} muuttui toisen osion poistossa`);
 }
}
await deleteStored(`workbook:${filename}`);
console.log(`PASS remove day: päivä ${target.date} poistettu, ${formulaBefore.length} kaavaa ja ${shared.length} jaettua kaavaa säilyivät`);
