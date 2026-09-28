// Tuntilistan päivän poisto. Tuntuntilistassa päivä on yksilöity päivämäärällä,
// joten autosta ei ole avainta kuten ajolistassa. Kaavat (L, M) ja yhteensärivi
// 87 ovat samoja kuin ajolistassa, joten ne saavat säilyä koskemattomina.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {unzipSync,strFromU8} from 'fflate';
import {XlsxDocument} from '../lib/xlsx-document';
import {hoursTemplate,hoursEntryColumns} from '../lib/hours-template';
import {hoursDays,existingHoursDay} from '../lib/read-hours';
import {removeListedDay,discardSavedDay} from '../lib/remove-day';
import {getStored,putStored,deleteStored,type SavedWorkbook} from '../lib/local-files';
import {dayKey} from '../lib/day-drafts';
import {newDraft} from '../lib/capture';
import {workbookName} from '../lib/workbook-export';
import 'fake-indexeddb/auto';
Object.assign(globalThis,{DOMParser,XMLSerializer,window:{dispatchEvent:()=>true}});
const name='Testi Testiajo';

// Työkopio puhelimen muistista. Avain johtuu poistettavan päivän päivämäärästä,
// joten tiedosto tallentuu omaan puolikauteensa.
const bytes=new Uint8Array(readFileSync('work/listat-fixtures/Tuntilista Ajuri.xlsx'));
const preview=new XlsxDocument(bytes).snapshot();
// Kuljettajan nimi luetaan pohjasta, koska tuntilistan lukeminen vaatii sen
// osuvan kenttään A1. Näin testi ei riipu siitä, mikä nimi tiedostossa on.
assert.equal(String(preview.A1?.value||'').replace(/^Kuljettaja:\s*/i,'').trim(),name,'pohjan kuljettaja ei täsmää nimeen');

// Valitaan päivä, jossa on oikeasti kirjauksia, jotta tyhjennys todistettaisiin
// tiedoilla eikä vain tyhjällä rivillä. Muuten kohdaksi sattuu puhdas tuntilista.
const entry=hoursTemplate.entryRows.find(r=>preview[`C${r}`]?.value!=null);
assert.ok(entry,'tuntilistasta ei löytynyt kirjauksia sisältävää päivää');
const targetDate=new Date(Date.UTC(1899,11,30)+Number(preview[`A${entry}`]!.value)*86400000).toISOString().slice(0,10);
const routeRow=entry+hoursTemplate.routeOffset;
const filename=workbookName('hours',targetDate,name);
const record={filename,bytes,kind:'hours',updatedAt:new Date().toISOString(),savedToFolder:false} satisfies SavedWorkbook;
await putStored(`workbook:${filename}`,record);
const before=new XlsxDocument(bytes).snapshot();
const otherDays=hoursDays(bytes,name).filter(d=>d!==targetDate);
assert.ok(otherDays.length>0,'vertailtavia muita päiviä ei ole');

const formulaBefore=Object.entries(before).filter(([,cell])=>cell.formula).map(([a,cell])=>[a,cell.formula] as const);
assert.ok(formulaBefore.length>0,'pohjan kaavat puuttuvat');
const cellCountBefore=Object.keys(before).length;

// Päivän välimuistiluonnos on ohjelman muistissa ja pitää hävitä.
const stale=newDraft();Object.assign(stale.values,{vehicle:'ABC-123',date:targetDate,start:'06:00',end:'15:00',startKm:'100',endKm:'200',waiting:'0',breakMinutes:'0',allowance:'0',foreignAllowance:'0',sick:'0',route:'vantaa'});
await putStored(dayKey('hours',name,targetDate,''),stale);

const result=await removeListedDay('hours',targetDate,'',name);
assert.equal(result.removed,true,'päivää ei poistettu');
assert.equal(result.row,entry,'poistettiin väärä rivi');
const stored=await getStored<SavedWorkbook>(`workbook:${filename}`);
const after=new XlsxDocument(stored!.bytes).snapshot();

// 1. Kirjattavat solut ja reittirivi ovat tyhjät. Laskusolut L ja M jätetään
//    koskematta, joten ne säilyvät.
for(const column of hoursEntryColumns)assert.equal(after[`${column}${entry}`]?.value??null,null,`solu ${column}${entry} ei tyhjentynyt`);
assert.equal(after[`A${routeRow}`]?.value??null,null,'reittirivi ei tyhjentynyt');
for(const column of hoursTemplate.computedColumns)assert.equal(after[`${column}${entry}`]?.formula,before[`${column}${entry}`]?.formula,`laskusolu ${column}${entry} muuttui`);

// 2. Kaavat ja solumäärä täsmälleen ennallaan, myös jaettujen kaavojen sisältö.
const formulaAfter=Object.entries(after).filter(([,cell])=>cell.formula).map(([a,cell])=>[a,cell.formula] as const);
assert.deepEqual(formulaAfter,formulaBefore,'poisto muutti taulukon kaavoja');
assert.equal(Object.keys(after).length,cellCountBefore,'poisto muutti taulukon solujen määrää');
const xml=strFromU8(unzipSync(stored!.bytes)['xl/worksheets/sheet1.xml']);
const shared=xml.match(/<f t="shared"[^>]*>/g)??[];
assert.ok(shared.every(t=>/si="\d+"/.test(t)),'jaetusta kaavasta puuttuu si-indeksi');

// 3. Päivä on poistunut listasta ja muut päivät ovat paikallaan.
const left=hoursDays(stored!.bytes,name);
assert.ok(!left.includes(targetDate),'poistettu päivä on yhä listalla');
assert.equal(left.length,otherDays.length,'poisto muutti päivien määrää');
for(const day of otherDays){
 const row=hoursTemplate.entryRows.find(r=>new Date(Date.UTC(1899,11,30)+Number(after[`A${r}`]?.value)*86400000).toISOString().slice(0,10)===day);
 assert.ok(row,`muu päivä ${day} katosi`);
 for(const column of hoursEntryColumns)assert.deepEqual(after[`${column}${row}`]?.value??null,before[`${column}${row!}`]?.value??null,`muun päivän solu ${column} muuttui`);
}

// 4. Ohjelman muistissa oleva päivän luonnos on poistettu.
assert.equal(await getStored(dayKey('hours',name,targetDate,'')),undefined,'päivän välimuistiluonnos jäi talteen');

// 5. Toinen poisto samasta päivästä ei muuta mitään eikä kaadu.
const again=await removeListedDay('hours',targetDate,'',name);
assert.equal(again.removed,false,'poistettu päivä poistettiin uudelleen');
assert.deepEqual(new XlsxDocument((await getStored<SavedWorkbook>(`workbook:${filename}`))!.bytes).snapshot(),after,'toinen poisto muutti taulukkoa');

// 6. Tyhjennetty päiväsolu on vapaana uudelle kirjaukselle.
const found=existingHoursDay(stored!.bytes,{...newDraft(),values:{...newDraft().values,date:targetDate}},name);
assert.equal(found,undefined,'poistettu päivä luetaan yhä kirjauksena');

// 7. Hylkäys ei kaadu, vaikka listaa ei ole lainkaan, ja siivoaa silti muistin.
await deleteStored(`workbook:${filename}`);
const orphan=newDraft();Object.assign(orphan.values,{date:targetDate,start:'06:00'});
await putStored(dayKey('hours',name,targetDate,''),orphan);
const discarded=await discardSavedDay('hours',targetDate,'',name);
assert.equal(discarded.removed,false,'poistettiin päivä jota ei ollut');
assert.equal(await getStored(dayKey('hours',name,targetDate,'')),undefined,'hylkäys jätti luonnoksen muistiin');

console.log(`PASS remove hours day: päivä ${targetDate} (rivi ${entry}) poistettu, ${formulaBefore.length} kaavaa säilyvät${shared.length?` ja ${shared.length} jaettua kaavaa`:''}`);
