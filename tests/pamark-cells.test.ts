import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {unzipSync,strFromU8} from 'fflate';
import {XlsxDocument} from '../lib/xlsx-document';
import {fillWorkbook, emptyWorkbook} from '../lib/workbook-export';
import {pamarkTemplate, pamarkDayRows, pamarkEntryCells} from '../lib/pamark-template';
import {pamarkSections} from '../lib/pamark-target';
import {applyVehicles, fleet} from '../lib/vehicle-settings';
import {newDraft} from '../lib/capture';
import 'fake-indexeddb/auto';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const name='Testikuljettaja',file='work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx';
const original=new Uint8Array(readFileSync(file));
const before=new XlsxDocument(original).snapshot();
const c=pamarkTemplate.columns;
const sections=pamarkSections(before);
assert.ok(sections.length>=1,'ajolistasta ei löytynyt autoosioita');
const header=sections[0].headerRow;
const vehicle=sections[0].vehicle;
const day=newDraft();
Object.assign(day.values,{vehicle,date:'2026-09-16',start:'06:00',end:'15:00',startKm:'349900',endKm:'350040',waiting:'30',breakMinutes:'45',allowance:'1',foreignAllowance:'0',sick:'0',loadingHours:'1,5',stops:'12',route:'vantaa-helsinki-vantaa'});

// Odotukset luetaan taulukon omista otsikoista, ei arvauksena. Näin testi
// todentaa, että kukin arvo menee juuri siihen soluun, jonka otsikko nimeää.
const labels=new XlsxDocument(original).snapshot();
const headerRow=header+pamarkTemplate.firstDayOffset-1;
const label=(col:string)=>String(labels[`${col}${headerRow}`]?.value??'').trim().toUpperCase();
assert.equal(label(c.date),'PVM.');
assert.equal(label(c.start),'ALKOI');
assert.equal(label(c.end),'PÄÄTTYI');
assert.equal(label(c.startKm),'ALKOI KM');
assert.equal(label(c.endKm),'PÄÄTTYI KM');
assert.equal(label(c.loadingHours),'LAST. H.');
assert.equal(label(c.stops),'PAIKAT');
for(const col of pamarkTemplate.computedColumns)assert.ok(labels[`${col}${header+pamarkTemplate.firstDayOffset}`]?.formula,`laskettava solu ${col} ei ole kaava`);

const result=fillWorkbook(original,'pamark',day,name,{fresh:true});
assert.equal(result.row,header+pamarkTemplate.firstDayOffset);
const after=new XlsxDocument(result.bytes).snapshot();
const at=(col:string)=>after[`${col}${result.row}`];

// Jokainen kirjoitettu arvo on juuri otsikon mukaan, eikä laskettaviin
// sarakkeisiin kosketa.
assert.equal(at(c.date).value,46281,'PVM. ei ole kirjatun päivän sarjanumero');
assert.equal(at(c.start).value,6/24,'ALKOI ei ole aloitusaika');
assert.equal(at(c.end).value,15/24,'PÄÄTTYI ei ole päättymisaika');
assert.equal(at(c.startKm).value,349900,'ALKOI KM ei ole alkukilometri');
assert.equal(at(c.endKm).value,350040,'PÄÄTTYI KM ei ole lopunkilometri');
assert.equal(at(c.loadingHours).value,1.5/24,'LAST. h. ei ole latausaika vuorokausina');
assert.equal(at(c.stops).value,12,'PAIKAT ei ole pysäkkien määrä');
assert.equal(after[`${pamarkTemplate.routeColumn}${result.row+pamarkTemplate.routeOffset}`].value,'Reitti: vantaa-helsinki-vantaa');
for(const col of pamarkTemplate.computedColumns)assert.equal(after[`${col}${result.row}`].formula,before[`${col}${result.row}`].formula,`laskettava ${col} muuttui`);
for(const col of pamarkTemplate.computedColumns)assert.equal(after[`${col}${header+pamarkTemplate.totalsOffset}`].formula,before[`${col}${header+pamarkTemplate.totalsOffset}`].formula,`yhteensä ${col} muuttui`);
assert.equal(after[`${c.date}${result.row+pamarkTemplate.rowStride}`].value,null,'seuraavaan päiväriviin kirjoitettiin');

// Jaetut kaavat pitävät tunnisteensa, muuten yhteensä-rivi lakkaa laskemasta.
const sheet=(bytes:Uint8Array)=>{
 const doc=new DOMParser().parseFromString(strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']),'application/xml');
 return new Map(Array.from(doc.getElementsByTagName('c')).map(el=>[el.getAttribute('r')!,Array.from(el.getElementsByTagName('f')).map(f=>[f.getAttribute('t'),f.getAttribute('si'),f.getAttribute('ref'),f.textContent].join('|')).join(';')]));
};
const oldFormulas=sheet(original),newFormulas=sheet(result.bytes);
let shared=0;
for(const [address,value] of oldFormulas){
 if(!value)continue;
 if(value.includes('shared'))shared++;
 assert.equal(newFormulas.get(address),value,`kaava ${address} muuttui`);
}
assert.ok(shared>0,'oikea ajolista ei sisältänyt jaettuja kaavoja');

// Jokainen syötetty arvo validoidaan kuten tuntilistassa, joten virheellinen
// luku ei pääse taulukkoon hiljaista.
const entry={date:'2026-09-17',start:'06:00',end:'15:00',startKm:1000,endKm:1200,loadingHours:1,stops:12,route:'Pori',overnight:false};
for(const [label,broken] of [
 ['loppukilometri alle alkukilometri',{...entry,endKm:999}],
 ['murtolukema',{...entry,endKm:1200.5}],
 ['negatiivinen pysäkkimäärä',{...entry,stops:-1}],
 ['liian pitkä latausaika',{...entry,loadingHours:30}],
 ['päättymisaika ennen aloitusaikaa',{...entry,end:'05:00'}],
 ['virheellinen päivämäärä',{...entry,date:'2026-13-40'}],
] as const)assert.throws(()=>pamarkEntryCells(header,result.row,broken),Error,label);
assert.throws(()=>pamarkEntryCells(header,header+4,entry),/Virheellinen ajolistan rivi/);
assert.deepEqual(Object.keys(pamarkEntryCells(header,result.row,entry)).sort(),[`A${result.row}`,`A${result.row+1}`,`B${result.row}`,`C${result.row}`,`D${result.row}`,`E${result.row}`,`H${result.row}`,`K${result.row}`].sort());
assert.deepEqual(pamarkDayRows(header),[4,6,8,10,12,14,16,18,20,22,24,26]);

// Toinen auto kirjoitetaan omaan osioonsa, ei ensimmäisen päivälle.
const other=sections[1];
if(other){
 const second=structuredClone(day);second.values.vehicle=other.vehicle;second.values.date='2026-09-16';
 const written=fillWorkbook(result.bytes,'pamark',second,name,{fresh:false});
 assert.equal(written.row,other.headerRow+pamarkTemplate.firstDayOffset);
 assert.equal(new XlsxDocument(written.bytes).snapshot()[`A${result.row}`].value,46281,'ensimmäisen auton päivä katosi');
}

// Oma polku: ohjelma luo uuden listan tyhjästä ja kirjaa päivän jokaiselle
// auton osiolle. Kaikkien osioiden on kelvattava, muuten tallennus estyy.
let fresh=emptyWorkbook(new Uint8Array(readFileSync('work/template-tests/pamark.xlsx')),'pamark','2026-09-16',name);
fresh=applyVehicles(fresh,await fleet(),true);
const freshSections=pamarkSections(new XlsxDocument(fresh).snapshot());
assert.ok(freshSections.length>1,'uuteen listaan ei tullut useita auton osioita');
for(const section of freshSections){
 const each=structuredClone(day);each.values.vehicle=section.vehicle;
 const written=fillWorkbook(fresh,'pamark',each,name,{fresh:false});
 assert.equal(written.row,section.headerRow+pamarkTemplate.firstDayOffset,`auton ${section.vehicle} päivä ei mennyt omaan osioonsa`);
 assert.equal(new XlsxDocument(written.bytes).snapshot()[`A${written.row}`].value,46281);
 fresh=written.bytes;
}
console.log('PASS pamark cells: jokainen arvo menee otsikon mukaiseen soluun, kaavat ja validointi kunnossa');
