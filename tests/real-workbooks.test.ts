import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import 'fake-indexeddb/auto';
import {newDraft} from '../lib/capture';
import {XlsxDocument} from '../lib/xlsx-document';
import {findPamarkTarget,pamarkFingerprint} from '../lib/pamark-target';
import {existingPamarkDay} from '../lib/open-pamark';
import {existingHoursDay,hoursDays} from '../lib/read-hours';
import {fillWorkbook,emptyWorkbook,workbookName,EntryConflict} from '../lib/workbook-export';
import {mergePamarkJob,type SyncJob} from '../lib/pamark-sync';
import {importHours} from '../lib/import-hours';
import {getStored,type SavedWorkbook} from '../lib/local-files';
import {dayKey} from '../lib/day-drafts';
Object.assign(globalThis,{DOMParser,XMLSerializer,window:{dispatchEvent:()=>true}});
const pamark=new Uint8Array(readFileSync('work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx'));
const hours=new Uint8Array(readFileSync('work/listat-fixtures/Tuntilista Ajuri.xlsx'));
const before=new XlsxDocument(pamark).snapshot();
const d=newDraft();Object.assign(d.values,{vehicle:'JTS-790',date:'2026-09-01'});
const original=existingPamarkDay(pamark,d)!;assert.equal(original.values.start,'06:00');assert.equal(original.values.startKm,'349717');assert.equal(original.values.stops,'22');assert.equal(original.values.loadingHours,'1');
const fresh=newDraft();Object.assign(fresh.values,{vehicle:'ZLC-613',date:'2026-09-14',start:'06:00',end:'15:00',startKm:'1000',endKm:'1200',loadingHours:'0.5',stops:'12',route:'TESTI'});
assert.equal(findPamarkTarget(before,'ZLC-613',fresh.values.date).row,101);
let filled=fillWorkbook(pamark,'pamark',fresh,'Testi',{fresh:false});assert.equal(existingPamarkDay(filled.bytes,fresh)!.values.route,'TESTI');
// Sama päivä uudelleen ilman korvaamista on sama kirjaus, vaikka yrityksen tiedosto
// olisi ehtinyt kirjoittaa kellonajat tekstinä. Tekstimuoto 16:30 ja luku 0.6875 ovat sama arvo.
assert.doesNotThrow(()=>fillWorkbook(filled.bytes,'pamark',fresh,'Testi',{shared:true,fresh:false}),'identtinen uudelleentallennus ei riitele');
const asText=new XlsxDocument(filled.bytes);asText.set('B101','06:00');asText.set('C101','15:00');
assert.doesNotThrow(()=>fillWorkbook(asText.bytes(),'pamark',fresh,'Testi',{shared:true,fresh:false}),'tekstimuotoinen kellonaika ei eroa omasta luvusta');
const routeChanged=structuredClone(fresh);routeChanged.values.route='Eri reitti';assert.throws(()=>fillWorkbook(asText.bytes(),'pamark',routeChanged,'Testi',{shared:true,fresh:false}),EntryConflict,'oikea eroavaisuus riitelee edelleen');
const after=new XlsxDocument(filled.bytes).snapshot();for(const [a,c] of Object.entries(before)){if(c.formula)assert.equal(after[a].formula,c.formula);if(!c.formula&&/^([A-Z]+)([1-9]|[1-9][0-9])$/.test(a)&&a!=='A98')assert.deepEqual(after[a],c);}
const edit=structuredClone(original);edit.values.route='Korjaus';
const job:SyncJob={id:edit.id,draft:edit,name:'Testi',filename:workbookName('pamark',edit.values.date,'Testi'),status:'pending',updatedAt:''};
const corrected=mergePamarkJob(filled.bytes,job);assert.equal(existingPamarkDay(corrected,edit)!.values.route,'Korjaus');assert.equal(existingPamarkDay(corrected,fresh)!.values.route,'TESTI');
const concurrent=new XlsxDocument(filled.bytes);concurrent.set('K4',23);assert.throws(()=>mergePamarkJob(concurrent.bytes(),job),/erilainen/);
// A full section is readable, but cannot allocate another day.
let full=emptyWorkbook(pamark,'pamark','2026-09-01','Testi');
for(let day=1;day<=12;day++){const n=structuredClone(fresh);n.values.date=`2026-09-${String(day).padStart(2,'0')}`;full=fillWorkbook(full,'pamark',n,'Testi',{fresh:false}).bytes;}
assert.throws(()=>fillWorkbook(full,'pamark',fresh,'Testi',{fresh:false}),/ei ole vapaata/);assert.equal(existingPamarkDay(full,fresh),undefined);
const broken={...before};delete broken.F101;assert.throws(()=>findPamarkTarget(broken,'ZLC-613','2026-09-14'),/pohja/);
const second=structuredClone(fresh);second.values.date='2026-09-25';const late=fillWorkbook(pamark,'pamark',second,'Testi',{fresh:true});assert.equal(late.filename,'Pamark ajolista syyskuu 2-2 2026.xlsx');assert.equal(existingPamarkDay(late.bytes,second)!.values.date,'2026-09-25');
assert.throws(()=>fillWorkbook(pamark,'pamark',second,'Testi',{fresh:false}),/jakson/);
assert.equal((await importHours(hours,'Testi Testiajo')).date,'2025-03-03');assert.deepEqual((await getStored<SavedWorkbook>('workbook:Tuntilista Testi0325.xlsx'))!.bytes,hours);
const hd=newDraft();hd.values.date='2025-03-06';const old=existingHoursDay(hours,hd,'Testi Testiajo')!;assert.equal(old.values.start,'06:00');assert.equal(old.values.startKm,'441519');assert.equal(old.values.route,'Vantaa - Espoo - Vantaa');
Object.assign(old.values,{vehicle:'ZLC-613',end:'15:00',endKm:'441700',waiting:'0',breakMinutes:'30',allowance:'1',foreignAllowance:'0',sick:'0'});const revised=fillWorkbook(hours,'hours',old,'Testi Testiajo',{fresh:false,overwrite:true}).bytes;assert.equal(hoursDays(revised,'Testi Testiajo').length,4);assert.equal(existingHoursDay(revised,old,'Testi Testiajo')!.values.endKm,'441700');
assert.notEqual(dayKey('pamark','Testi','2026-09-01','ZLC-613'),dayKey('pamark','Testi','2026-09-01','JTS-790'));
console.log('PASS real source copies: text times, existing day, Reitti-only free rows, append, own edit, other driver preservation, same-row conflict, full vs malformed, Sep 25 second half, exact hours import and edit/reopen');


