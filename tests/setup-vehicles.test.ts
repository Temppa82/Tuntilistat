import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import 'fake-indexeddb/auto';
import {XlsxDocument} from '../lib/xlsx-document';
import {emptyWorkbook,fillWorkbook,workbookName,legacyWorkbookNames} from '../lib/workbook-export';
import {newDraft} from '../lib/capture';
import {defaults,applyVehicles,saveVehicle} from '../lib/vehicle-settings';
import {putStored,getStored,type SavedWorkbook,writeWorkbook} from '../lib/local-files';
import {ensurePeriod} from '../lib/period-files';
Object.assign(globalThis,{DOMParser,XMLSerializer,window:{dispatchEvent:()=>true}});
const hours=new Uint8Array(readFileSync('work/template-tests/hours.xlsx'));
const pamark=new Uint8Array(readFileSync('work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx'));
assert.equal(workbookName('hours','2026-09-23','Testi Testiajo'),'Tuntilista Testi0926.xlsx');
assert.equal(workbookName('hours','2027-01-02','Anna-Maija Testi'),'Tuntilista Anna-Maija0127.xlsx');
assert.equal(workbookName('pamark','2026-09-23','Testi'),'Pamark ajolista syyskuu 2-2 2026.xlsx');
// Aiemman version aliviivanimi on uuden nimen alku: se kirjataan ja poistetaan.
assert.deepEqual(legacyWorkbookNames('hours','2026-09-23','Testi Testiajo'),['Tuntilista_Testi0926.xlsx','Tuntilista Testi Testiajo syyskuu 2026.xlsx']);
assert.deepEqual(legacyWorkbookNames('pamark','2026-09-23','Testi'),[]);
const blank=emptyWorkbook(pamark,'pamark','2026-09-23','Testi Testiajo');
const old=new XlsxDocument(blank).snapshot();
const filled=applyVehicles(blank,defaults),s=new XlsxDocument(filled).snapshot();
assert.equal(s.I1.value,24);assert.equal(s.I65.value,12);assert.equal(s.I167.value,27);
assert.equal(s.G33.value,'CO2/ 1,2g/ltr');assert.equal(s.O36.formula,'F36*($I$33/100)*1.2');assert.equal(s.O38.formula,'F38*($I$33/100)*1.2');
for(const [cell,value] of Object.entries(old))if(value.formula&&!/^O\d+$/.test(cell))assert.equal(s[cell].formula,value.formula,cell);
const draft=newDraft();Object.assign(draft.values,{vehicle:'ZLC-613',date:'2026-09-23',start:'06:00',end:'15:00',startKm:'1000',endKm:'1200',loadingHours:'0,5',stops:'12',route:'Turku – Salo'});
const day=fillWorkbook(filled,'pamark',draft,'Testi Testiajo',{fresh:false});
const before=new XlsxDocument(day.bytes).snapshot();
const changed=applyVehicles(day.bytes,{'ZLC-613':{consumption:'30,5',emission:'0,2'}});
const after=new XlsxDocument(changed).snapshot();assert.equal(after.I98.value,30.5);assert.equal(after.O101.formula,'F101*($I$98/100)*0.2');
const allowed=new Set(['I98','G98',...Array.from({length:12},(_,i)=>'O'+(101+i*2))]);
for(const key of Object.keys(before))if(!allowed.has(key))assert.deepEqual(after[key],before[key],key);
assert.equal(after.A101.value,before.A101.value);assert.equal(after.A102.value,'Reitti: Turku – Salo');
assert.throws(()=>applyVehicles(blank,{'ZLC-613':{consumption:'-1',emission:'0.2'}}));
await putStored('template:hours',{name:'hours.xlsx',bytes:hours});await putStored('template:pamark',{name:'pamark.xlsx',bytes:pamark});await putStored('storage:choice',{mode:'browser',name:'Paikallinen'});
await saveVehicle('ZLC-613',{consumption:'30.5',emission:'0.2'});
const first=await ensurePeriod('pamark','2026-09-23','Testi Testiajo');assert.equal(new XlsxDocument(first.bytes).snapshot().I98.value,30.5);
await putStored('workbook:'+first.filename,{...first,bytes:changed});
const repeat=await ensurePeriod('pamark','2026-09-24','Testi Testiajo');assert.equal(new XlsxDocument(repeat.bytes).snapshot().A102.value,'Reitti: Turku – Salo');
const legacy=emptyWorkbook(hours,'hours','2026-09-23','Testi Testiajo');
// Edellisen version aliviivanimi nostetaan uuteen nimeen ja vanha avain poistetaan,
// jotta sama kuukausi ei näy listassa kahteen kertaan.
await putStored('workbook:Tuntilista_Testi0926.xlsx',{bytes:legacy,filename:'Tuntilista_Testi0926.xlsx',kind:'hours',updatedAt:'2026-09-23',savedToFolder:false});
const migrated=await ensurePeriod('hours','2026-09-23','Testi Testiajo');
assert.equal(migrated.filename,'Tuntilista Testi0926.xlsx');
assert.deepEqual((await getStored<SavedWorkbook>('workbook:Tuntilista Testi0926.xlsx'))!.bytes,legacy);
assert.equal(await getStored('workbook:Tuntilista_Testi0926.xlsx'),undefined);
// Ja versio 2.2:n koko nimen sisältävä vanhempi nimi.
await putStored('workbook:Tuntilista Testi Testiajo lokakuu 2026.xlsx',{bytes:legacy,filename:'legacy',kind:'hours',updatedAt:'2026-10-05',savedToFolder:false});
const migrated2=await ensurePeriod('hours','2026-10-05','Testi Testiajo');
assert.equal(migrated2.filename,'Tuntilista Testi1026.xlsx');
assert.equal(await getStored('workbook:Tuntilista Testi Testiajo lokakuu 2026.xlsx'),undefined);
await assert.rejects(ensurePeriod('hours','2026-09-23','Testi Toinen'),/toiselle/);
// Selected-folder writes preserve existing files and detect external changes.
let disk:Uint8Array|undefined,writes=0;
const directory={getFileHandle:async(_name:string,options?:{create?:boolean})=>{if(!disk&&!options?.create)throw new DOMException('missing','NotFoundError');return {getFile:async()=>({arrayBuffer:async()=>disk!.buffer}),createWritable:async()=>({write:async(bytes:Uint8Array)=>{writes++;disk=bytes;},close:async()=>{},abort:async()=>{}})};}};
await writeWorkbook(directory as any,'test.xlsx',legacy);assert.equal(writes,1);
await assert.rejects(writeWorkbook(directory as any,'test.xlsx',changed),/muuttui/);assert.equal(writes,1);
console.log('PASS: first-name filenames, blank periods, preserved old entries, first-run initialization, six vehicle defaults, selected vehicle only, emissions formulas, old-name migration, wrong driver and folder conflict protection');
