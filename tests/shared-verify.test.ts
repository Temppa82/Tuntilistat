import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {newDraft,normalizeVehicle} from '../lib/capture';
import {XlsxDocument} from '../lib/xlsx-document';
import {pamarkDayList} from '../lib/read-pamark';
import {fillWorkbook} from '../lib/workbook-export';
import {verifySharedMerge} from '../lib/shared-verify';
import {mergePamarkJob,type SyncJob} from '../lib/pamark-sync';
Object.assign(globalThis,{DOMParser,XMLSerializer});

// The real production list: six vehicle sections, several drivers in the headers, thirty-six
// filled days and hundreds of formulas. Losing anything here means losing billing data.
const original=new Uint8Array(readFileSync('work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx'));
const snapshot=(bytes:Uint8Array)=>new XlsxDocument(bytes).snapshot();
const formulaMap=(bytes:Uint8Array)=>Object.fromEntries(Object.entries(snapshot(bytes)).filter(([,c])=>c.formula).map(([a,c])=>[a,c.formula] as const));
const baseFormulaCount=Object.keys(formulaMap(original)).length;
const baseDays=pamarkDayList(original);
const originalSnapshot=snapshot(original);
const headers=Object.entries(originalSnapshot).filter(([a])=>/^A\d+$/.test(a)&&/KULJETTAJA/i.test(String(originalSnapshot[a].value))).map(([a])=>a);
assert.ok(baseFormulaCount>400,'tuotantotiedostossa on satoja kaavoja');
assert.equal(baseDays.length,36);
assert.equal(headers.length,6);

const filled=(vehicle:string,date:string,route:string)=>{const d=newDraft();Object.assign(d.values,{vehicle:normalizeVehicle(vehicle),date,start:'06:00',end:'15:30',startKm:'1000',endKm:'1200',loadingHours:'0,5',stops:'12',route});return d;};
const job=(draft:ReturnType<typeof filled>,extra:Partial<SyncJob>={}):SyncJob=>({id:draft.id,draft,filename:'Pamark ajolista syyskuu 1-2 2026.xlsx',status:'pending',updatedAt:'2026-09-01T00:00:00.000Z',name:'Testi Kuljettaja',...extra});

// A new day lands in its own vehicle section and changes nothing else.
const fresh=job(filled('JTS-790','2026-09-05','Uusi päivä'));
const withFresh=mergePamarkJob(original,fresh);
const freshSnapshot=snapshot(withFresh);
assert.equal(pamarkDayList(withFresh).length,37);
assert.deepEqual(formulaMap(withFresh),formulaMap(original),'kaavat säilyvät täsmälleen');
for(const day of baseDays){
 for(const [address,cell] of Object.entries(originalSnapshot)){
  if(cell.formula)continue;
  const row=Number(address.slice(1));
  if(row!==day.row&&row!==day.routeRow)continue;
  if(`${normalizeVehicle(day.label)}|${day.date}`==='JTS-790|2026-09-05')continue;
  assert.equal(freshSnapshot[address]?.value,cell.value,`${day.label} ${day.date} solu ${address} säilyi`);
 }
}
assert.deepEqual(headers.map(a=>freshSnapshot[a]?.value),headers.map(a=>originalSnapshot[a]?.value),'kuljettajien nimet jäivät ennalleen');
assert.doesNotThrow(()=>new XlsxDocument(withFresh).snapshot(),'yhdistetty tiedosto aukeaa');
console.log('PASS shared merge keeps all 36 existing days and 417 formulas byte-identical in the real list');

// Correcting an own existing day is allowed, and still touches nothing else.
const ownDay=baseDays.find(d=>d.label==='LLT-265'&&d.date==='2026-09-03')!;
const correction=job(filled('LLT-265','2026-09-03','Korjattu reitti'),{confirmedBase:undefined});
const {pamarkFingerprint}=await import('../lib/pamark-target');
correction.draft.pamarkBase=pamarkFingerprint(originalSnapshot,'LLT-265','2026-09-03');
const corrected=mergePamarkJob(original,correction);
const correctedSnapshot=snapshot(corrected);
assert.deepEqual(formulaMap(corrected),formulaMap(original));
assert.equal(pamarkDayList(corrected).length,36,'päivää ei synny lisää korjauksessa');
assert.equal(pamarkDayList(corrected).find(d=>d.label==='LLT-265'&&d.date==='2026-09-03')?.row,ownDay.row);
for(const day of baseDays){
 if(day.label==='LLT-265'&&day.date==='2026-09-03')continue;
 for(const [address,cell] of Object.entries(originalSnapshot)){
  if(cell.formula)continue;
  const row=Number(address.slice(1));
  if(row!==day.row&&row!==day.routeRow)continue;
  assert.equal(correctedSnapshot[address]?.value,cell.value,`${day.label} ${day.date} säilyi korjauksessa`);
 }
}
console.log('PASS own-day correction rewrites one row and preserves every other day and formula');

// The name is not needed for a shared write, and the section is chosen by the registration number.
const nameless=job(filled('ENR-210','2026-09-05','Ilman nimea'),{name:''});
assert.doesNotThrow(()=>mergePamarkJob(original,nameless),'jaettu kirjoitus ei vaadi nimeä');
assert.doesNotThrow(()=>fillWorkbook(original,'pamark',nameless.draft,'',{fresh:false,shared:true}));
assert.throws(()=>fillWorkbook(original,'pamark',nameless.draft,'',{fresh:false}),/kuljettajan nimi/,'paikallinen kirjoitus edellyttää nimeä');
assert.equal(pamarkDayList(mergePamarkJob(original,nameless)).find(d=>d.date==='2026-09-05')?.label,'ENR-210');
console.log('PASS shared write needs no driver name and routes by registration number only');

// A merge that would change another driver's entry, or a formula, is refused before sending.
const tamperedRow=(()=>{const d=new XlsxDocument(withFresh);d.set(`D${baseDays.find(x=>x.label==='MTY-164')!.row}`,99999);return d.bytes();})();
assert.throws(()=>verifySharedMerge(original,tamperedRow,'JTS-790','2026-09-05'),/toisen ajon päivä MTY-164/);
const tamperedFormula=(()=>{const d=new XlsxDocument(withFresh);d.setFormula('H4','0');return d.bytes();})();
assert.throws(()=>verifySharedMerge(original,tamperedFormula,'JTS-790','2026-09-05'),/laskentakaavoja muuttui/);
// A merge that did not actually land the own day is refused too.
assert.throws(()=>verifySharedMerge(original,original,'JTS-790','2026-09-05'),/oma päivä ei ole/);
assert.doesNotThrow(()=>verifySharedMerge(original,withFresh,'JTS-790','2026-09-05'));
console.log('PASS another driver row, a rewritten formula and a vanished own day are all refused before sending');

console.log('PASS shared merge: nothing lost, formulas intact, file never broken');
