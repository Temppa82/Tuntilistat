import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import 'fake-indexeddb/auto';
import {putStored,getStored,type SavedWorkbook} from '../lib/local-files';
import {fillWorkbook} from '../lib/workbook-export';
import {newDraft} from '../lib/capture';
import {importPamark} from '../lib/import-pamark';
import {pamarkDayList} from '../lib/read-pamark';
import {XlsxDocument} from '../lib/xlsx-document';
Object.assign(globalThis,{DOMParser,XMLSerializer,localStorage:{getItem:()=>null},window:{dispatchEvent:()=>true}});
let requests=0;globalThis.fetch=async()=>{requests++;throw new TypeError('offline');};
const template=new Uint8Array(readFileSync('work/template-tests/pamark.xlsx'));
const real=new Uint8Array(readFileSync('work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx'));
const hours=new Uint8Array(readFileSync('work/listat-fixtures/Tuntilista Ajuri.xlsx'));
await putStored('template:pamark',{name:'pamark.xlsx',bytes:template});
await putStored('storage:choice',{mode:'browser'});
const day=(vehicle:string,date:string,route:string)=>{const d=newDraft();Object.assign(d.values,{vehicle,date,start:'06:00',end:'15:00',startKm:'1000',endKm:'1200',loadingHours:'0.5',stops:'12',route});return d;};
const first=fillWorkbook(template,'pamark',day('JTS-790','2026-09-01','Turku – Salo'),'Testi',{fresh:true}).bytes;
const second=fillWorkbook(first,'pamark',day('LLT-265','2026-09-02','Helsinki – Pori'),'Testi',{fresh:false}).bytes;
const filename='Pamark ajolista syyskuu 1-2 2026.xlsx';
// A finished list with no local copy is kept exactly as it arrived.
const firstImport=await importPamark(second,'Testi');
assert.equal(firstImport.filename,filename);assert.equal(firstImport.days,2);assert.equal(firstImport.written,2);assert.deepEqual(firstImport.conflicts,[]);assert.deepEqual(firstImport.failed,[]);
assert.deepEqual([...(await getStored<SavedWorkbook>('workbook:'+filename))!.bytes],[...second]);
assert.ok(await getStored<boolean>('imported:'+filename));
// The same file again is not a change.
const again=await importPamark(second,'Testi');assert.equal(again.written,0);assert.deepEqual(again.conflicts,[]);assert.deepEqual(again.failed,[]);
// A day added on the phone survives a later import of the same list.
let local=(await getStored<SavedWorkbook>('workbook:'+filename))!.bytes;
const own=day('FOM-995','2026-09-04','Vantaa – Espoo');
local=fillWorkbook(local,'pamark',own,'Testi',{fresh:false}).bytes;
await putStored('workbook:'+filename,{filename,bytes:local,kind:'pamark',updatedAt:new Date().toISOString(),savedToFolder:false});
const afterOwn=await importPamark(second,'Testi');
assert.equal(afterOwn.written,0);assert.deepEqual(afterOwn.conflicts,[]);
const merged=pamarkDayList((await getStored<SavedWorkbook>('workbook:'+filename))!.bytes);
assert.deepEqual(merged.map(d=>d.vehicle+'|'+d.date).sort(),['FOM-995|2026-09-04','JTS-790|2026-09-01','LLT-265|2026-09-02']);
// A day that differs is reported, not replaced. The explicit overwrite takes the incoming list.
const changed=fillWorkbook(second,'pamark',day('JTS-790','2026-09-01','Tampere – Turku'),'Testi',{fresh:false,overwrite:true}).bytes;
const conflict=await importPamark(changed,'Testi');
assert.equal(conflict.written,0);assert.deepEqual(conflict.conflicts,['JTS-790 2026-09-01']);
let after=(await getStored<SavedWorkbook>('workbook:'+filename))!.bytes;
assert.ok(pamarkDayList(after).length===3);
const before=after;
const forced=await importPamark(changed,'Testi',true);
assert.equal(forced.written,1);assert.deepEqual(forced.conflicts,[]);
after=(await getStored<SavedWorkbook>('workbook:'+filename))!.bytes;
assert.notDeepEqual([...after],[...before]);
const route=new XlsxDocument(after).snapshot();
const rewritten=pamarkDayList(after).find(d=>d.vehicle==='JTS-790'&&d.date==='2026-09-01')!;
assert.equal(String(route[`A${rewritten.routeRow}`].value).replace(/^Reitti:\s*/i,''),'Tampere – Turku');
// The days only the phone knows are still there after the overwrite.
assert.ok(pamarkDayList(after).some(d=>d.vehicle==='FOM-995'&&d.date==='2026-09-04'));
// A list the driver already has is kept as a backup.
assert.deepEqual([...(await getStored<SavedWorkbook>('backup:before-import:'+filename))!.bytes],[...before]);
// A tuntilista is not an ajolista.
await assert.rejects(importPamark(hours,'Testi'),/rakenne/);
// A real ajolista imports and reports its own period.
const realResult=await importPamark(real,'Testi');
assert.ok(realResult.days>0);assert.equal(realResult.vehicles.length>0,true);
assert.equal(requests,0);
console.log('PASS: ajolista import keeps the first file byte for byte, skips an unchanged re-import, keeps phone-only days, reports a differing day and only replaces it on explicit overwrite, backs the previous copy up, refuses a tuntilista and imports a real ajolista, all without network access');
