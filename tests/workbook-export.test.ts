import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {unzipSync,strFromU8} from 'fflate';
import {XlsxDocument} from '../lib/xlsx-document';
import {fillWorkbook,workbookName,EntryConflict,validateTemplate} from '../lib/workbook-export';
import {newDraft} from '../lib/capture';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const draft=newDraft();
Object.assign(draft.values,{vehicle:'ZLC-613',date:'2026-09-01',start:'06:00',end:'15:00',startKm:'1000',endKm:'1200',waiting:'30',breakMinutes:'45',allowance:'1',foreignAllowance:'0',sick:'0',loadingHours:'0,5',stops:'12',route:'Turku – Salo'});
for(const kind of ['hours','pamark'] as const){
 const original=new Uint8Array(readFileSync(`work/template-tests/${kind}.xlsx`));
 const before=new XlsxDocument(original).snapshot();
 assert.throws(()=>validateTemplate(new XlsxDocument(original),kind==='hours'?'pamark':'hours'));
 const result=fillWorkbook(original,kind,draft,'Testikuljettaja',{fresh:true});
 const after=new XlsxDocument(result.bytes).snapshot();
 assert.equal(after[`A${result.row}`].value,46266);
 for(const [cell,value] of Object.entries(before))if(value.formula)assert.equal(after[cell].formula,value.formula,`${kind} formula ${cell}`);
  // Kaavat, tyylit ja muut osaset säilyvät. Poikkeuksena ovat laskennan
  // käynnistys ja vanhan laskentaketjun poisto, jotka on tehtävä uudelleenlaskennan
  // onnistumiseksi. Muualla mukaan lukuisilla muutoksilla rikottaisiin taulukko.
  const oldZip=unzipSync(original),newZip=unzipSync(result.bytes);
  const recalculation=['xl/workbook.xml','xl/worksheets/sheet1.xml','xl/calcChain.xml','xl/_rels/workbook.xml.rels','[Content_Types].xml'];
  for(const [file,bytes] of Object.entries(oldZip))if(!recalculation.includes(file))assert.deepEqual(newZip[file],bytes,file);
  assert.equal(newZip['xl/calcChain.xml'],undefined,'laskentaketku jäi tiedostoon');
  for(const [file,part,attr,value] of [
   ['xl/_rels/workbook.xml.rels','Relationship','Target','calcChain.xml'],
   ['[Content_Types].xml','Override','PartName','/xl/calcChain.xml'],
  ] as const){
   const doc=new DOMParser().parseFromString(strFromU8(newZip[file]),'application/xml');
   assert.equal(Array.from(doc.getElementsByTagName(part)).filter(el=>el.getAttribute(attr)===value).length,0,`${file} viittaa laskentaketjuun`);
  }
 const oldXml=strFromU8(oldZip['xl/worksheets/sheet1.xml']),newXml=strFromU8(newZip['xl/worksheets/sheet1.xml']);
 for(const tag of ['mergeCells','cols','pageMargins','pageSetup']){
  const re=new RegExp(`<${tag}\\b[^>]*(?:/>|>[\\s\\S]*?</${tag}>)`);
  assert.equal(newXml.match(re)?.[0],oldXml.match(re)?.[0],`${kind} ${tag}`);
 }
 const repeat=fillWorkbook(result.bytes,kind,draft,'Testikuljettaja',{fresh:false});assert.equal(repeat.row,result.row);
 const next=structuredClone(draft);next.values.date='2026-09-02';next.values.startKm='1200';next.values.endKm='1300';
 const second=fillWorkbook(result.bytes,kind,next,'Testikuljettaja',{fresh:false});
 assert.notEqual(second.row,result.row);
 assert.equal(new XlsxDocument(second.bytes).snapshot()[`A${result.row}`].value,46266);
const edit=structuredClone(draft);edit.values.endKm='1400';
  try{fillWorkbook(second.bytes,kind,edit,'Testikuljettaja',{fresh:false});throw new Error('odotettiin EntryConflictia');}
  catch(e){assert.ok(e instanceof EntryConflict,'ristiriita ei ollut EntryConflict');assert.ok(e.diffs.length>0,'ristiriidasta ei toimitettu eroavia soluja');assert.ok(e.diffs.some(d=>d.col.startsWith('E')&&d.old===1200&&d.new===1400),'eriarvoisia soluja puuttui');}
 const corrected=fillWorkbook(second.bytes,kind,edit,'Testikuljettaja',{fresh:false,overwrite:true});
 assert.equal(new XlsxDocument(corrected.bytes).snapshot()[`E${result.row}`].value,1400);
 const otherMonth=structuredClone(draft);otherMonth.values.date='2026-08-31';
 assert.throws(()=>fillWorkbook(result.bytes,kind,otherMonth,'Testikuljettaja',{fresh:false}),/toisen kuukauden/);
 console.log(`${kind}: actual template, input cells, preserved formulas/layout, append, duplicate and conflict checks OK`);
}
assert.equal(workbookName('pamark','2026-09-15','x'),'Pamark ajolista syyskuu 1-2 2026.xlsx');
assert.equal(workbookName('pamark','2026-09-16','x'),'Pamark ajolista syyskuu 2-2 2026.xlsx');
const sick=newDraft();Object.assign(sick.values,{date:'2026-09-01',sick:'1',allowance:'0',foreignAllowance:'0'});
const sickResult=fillWorkbook(new Uint8Array(readFileSync('work/template-tests/hours.xlsx')),'hours',sick,'Testi',{fresh:true});
assert.equal(new XlsxDocument(sickResult.bytes).snapshot().K3.value,1);
assert.equal(new XlsxDocument(sickResult.bytes).snapshot().B3.value,null);
