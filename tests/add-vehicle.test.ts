import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import 'fake-indexeddb/auto';
import {XlsxDocument} from '../lib/xlsx-document';
import {addVehicleSection,SECTION_STRIDE} from '../lib/add-vehicle';
import {findPamarkTarget,findVehicleHeader,pamarkSections} from '../lib/pamark-target';
import {applyVehicles,defaults} from '../lib/vehicle-settings';
import {newDraft} from '../lib/capture';
import {fillWorkbook} from '../lib/workbook-export';
import {existingPamarkDay} from '../lib/open-pamark';
Object.assign(globalThis,{DOMParser,XMLSerializer,localStorage:{getItem:()=>null},window:{dispatchEvent:()=>true}});
const real=new Uint8Array(readFileSync('work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx'));
const sections0=pamarkSections(new XlsxDocument(real).snapshot());
assert.equal(sections0.length,6);assert.equal(sections0[0].headerRow,1);assert.equal(sections0[1].headerRow,1+SECTION_STRIDE);
// An unknown vehicle has no section until one is added.
assert.equal(findVehicleHeader(new XlsxDocument(real).snapshot(),'ABC-123'),0);
assert.throws(()=>fillWorkbook(real,'pamark',{...newDraft(),values:{...newDraft().values,date:'2026-09-01',vehicle:'ABC-123',start:'06:00',end:'15:00',startKm:'1',endKm:'2',loadingHours:'0.5',stops:'1',route:'x'}},'Testi',{fresh:false}),/Autoa ei löytynyt/);
const added=addVehicleSection(real,'abc-123','Testi Kuljettaja',{consumption:'24',emission:'0.13'});
const s=new XlsxDocument(added).snapshot();
const sections=pamarkSections(s);
assert.equal(sections.length,7);assert.equal(sections[6].headerRow,sections[5].headerRow+SECTION_STRIDE);assert.equal(sections[6].vehicle,'ABC-123');
assert.equal(findVehicleHeader(s,'ABC-123'),sections[6].headerRow);
assert.equal(String(s[`A${sections[6].headerRow}`].value),'KULJETTAJA: Testi Kuljettaja');
assert.equal(String(s[`G${sections[6].headerRow}`].value),'CO2/ 0,13g/ltr');assert.equal(s[`I${sections[6].headerRow}`].value,24);
// The new block carries the same labels and formulas as the others.
const h=sections[6].headerRow;
for(const [col,from] of [['F',1],['G',1],['I',1],['M',1],['O',1]] as const)assert.ok(s[`${col}${h+3}`]?.formula,`${col}${h+3}`);
assert.equal(s[`A${h+3}`]?.value,null);assert.equal(String(s[`A${h+4}`].value),'Reitti:');
assert.equal(String(s[`E${h+27}`].value),'Yhteensä:');
assert.ok(s[`F${h+27}`]?.formula&&s[`O${h+27}`]?.formula&&s[`K${h+27}`]?.formula);
assert.equal(String(s[`M${h+2}`].value),'paik/h');assert.equal(String(s[`O${h+2}`].value),'CO2/g');
// The earlier sections are untouched.
assert.equal(pamarkSections(new XlsxDocument(added).snapshot()).slice(0,6).map(x=>x.headerRow).join(','),sections0.map(x=>x.headerRow).join(','));
// A day can now be written and read back for the new vehicle.
const d=newDraft();Object.assign(d.values,{date:'2026-09-01',vehicle:'ABC-123',start:'06:00',end:'15:00',startKm:'1',endKm:'2',loadingHours:'0.5',stops:'1',route:'Tampere – Turku'});
const filled=fillWorkbook(added,'pamark',d,'Testi',{fresh:false}).bytes;
const back=existingPamarkDay(filled,d)!;
assert.equal(back.values.route,'Tampere – Turku');assert.equal(back.values.start,'06:00');
// A second vehicle cannot reuse the same registration.
assert.throws(()=>addVehicleSection(added,'ABC-123','Testi'),/jo oma osio/);
assert.throws(()=>addVehicleSection(added,'','Testi'),/rekisterinumero/);
// Registering it as fleet data keeps the vehicle settings working.
const fleetApplied=applyVehicles(added,{...defaults,['ABC-123']:{consumption:'24',emission:'0.13'}});
assert.ok(findVehicleHeader(new XlsxDocument(fleetApplied).snapshot(),'ABC-123'));
console.log('PASS: a vehicle missing from the list gets its own section with the same labels, day and totals formulas, a day can be written and read back, the earlier sections stay untouched, a duplicate registration is refused, and fleet settings still apply');
