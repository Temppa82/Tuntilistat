import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync,zipSync,strToU8,strFromU8} from 'fflate';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import 'fake-indexeddb/auto';
import {ensurePeriod,storedWorkbook,useImportedFile} from '../lib/period-files';
import {putStored,getStored,type SavedWorkbook} from '../lib/local-files';
import {XlsxDocument} from '../lib/xlsx-document';
import {workbookName} from '../lib/workbook-export';
Object.assign(globalThis,{DOMParser,XMLSerializer,window:{dispatchEvent:()=>true}});
const name='Testi Testiajo',date='2026-09-16',filename=workbookName('pamark',date,name);
const good=new Uint8Array(readFileSync('work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx'));
const broken=new TextEncoder().encode('Tama ei ole taulukko');

// Virhe kertoo mitä tiedostosta ei voitu lukea, eikä paljasta kirjaston
// sisäistä englanninkielistä tekstiä.
assert.throws(()=>new XlsxDocument(broken),/Tiedosto ei ole luettava xlsx-taulukko/);
assert.throws(()=>new XlsxDocument(broken),(e:Error)=>!/\w\s\w/.test(e.message.replace(/[.!?]/g,''))||/Tiedosto ei ole luettava xlsx-taulukko/.test(e.message));

// Roskainen välimuisti palautetaan tyhjänä, jotta päivälehtiö näyttää "ei
// listaa" eikä jokainen toiminto kaadu vioittuneen tiedoston vuoksi.
await putStored(`workbook:${filename}`,{filename,bytes:broken,kind:'pamark',updatedAt:'2026-01-01',savedToFolder:false} satisfies SavedWorkbook);
assert.equal(await storedWorkbook('pamark',date,name),undefined,'roskainen välimuisti palautettiin');
// Omaa kopiota ei ole eikä sitä saa korvata hiljaa uudella tyhjällä listalla.
await assert.rejects(()=>ensurePeriod('pamark',date,name),/oma kopio tiedostosta .* ei ole luettava taulukko/s);
assert.deepEqual([...(await getStored<SavedWorkbook>(`workbook:${filename}`))!.bytes],[...broken],'roskainen välimuisti korvattiin hiljaa uudella listalla');

// Oma kelpo kopio toimii, ja tallennus onnistuu.
await putStored(`workbook:${filename}`,{filename,bytes:good,kind:'pamark',updatedAt:'2026-01-01',savedToFolder:false} satisfies SavedWorkbook);
const record=await ensurePeriod('pamark',date,name);
assert.equal(record.bytes.byteLength,good.byteLength);
assert.ok(new XlsxDocument(record.bytes).snapshot().A1,'omalta kopiolta ei löydy taulukkoa');
assert.equal((await ensurePeriod('pamark',date,name)).bytes.byteLength,good.byteLength);

// Tuotu tiedosto on kelpo, joten se löytyy ja se voidaan ottaa käyttöön.
await useImportedFile('pamark',filename,good);
assert.equal((await storedWorkbook('pamark',date,name))?.bytes.byteLength,good.byteLength);
assert.equal(await getStored(`imported:${filename}`),true);

// Osa voi olla kansion "worksheet" ilman s-kirjainta. Sellainen tiedosto on
// kelvollinen taulukko, joten sitä ei saa hylätä, ja se säilyy sellaisenaan.
const odd={...unzipSync(good)};
odd['xl/worksheet/sheet1.xml']=odd['xl/worksheets/sheet1.xml'];
delete odd['xl/worksheets/sheet1.xml'];
odd['xl/_rels/workbook.xml.rels']=strToU8(strFromU8(odd['xl/_rels/workbook.xml.rels']).replace('worksheets/sheet1.xml','worksheet/sheet1.xml'));
odd['[Content_Types].xml']=strToU8(strFromU8(odd['[Content_Types].xml']).replace('/xl/worksheets/sheet1.xml','/xl/worksheet/sheet1.xml'));
const oddBytes=zipSync(odd,{level:6});
const oddDoc=new XlsxDocument(oddBytes);
assert.ok(oddDoc.snapshot().A1,'epästandardi osanimi hylättiin');
oddDoc.set('A2','Korjattu');
assert.ok(new XlsxDocument(oddDoc.bytes()).snapshot().A2,'epästandardi osanimi rikkui uudelleenlukemisen');
assert.ok(unzipSync(oddDoc.bytes())['xl/worksheet/sheet1.xml'],'osa nimettiin uudelleen kirjoitettaessa');
console.log('PASS period files: rikkinäinen tiedosto ei jää työkopion lähteeksi eikä kaada tallennusta');
