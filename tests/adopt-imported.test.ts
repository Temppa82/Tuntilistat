import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import 'fake-indexeddb/auto';
import {XlsxDocument} from '../lib/xlsx-document';
import {putStored,getStored,type SavedWorkbook} from '../lib/local-files';
import {importPamark} from '../lib/import-pamark';
import {useImportedFile,storedWorkbook} from '../lib/period-files';
import {pamarkDayList} from '../lib/read-pamark';
Object.assign(globalThis,{DOMParser,XMLSerializer,window:{dispatchEvent:()=>true}});
const name='Testi Testiajo';
const original=new Uint8Array(readFileSync('work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx'));
const filename='Pamark ajolista syyskuu 1-2 2026.xlsx';

// Puhelimella on oma versio, jossa yhden päivän reitti on vaihdettu.
const phone=new XlsxDocument(original);phone.set('A24','Reitti: OMA REITTI');
await putStored(`workbook:${filename}`,{filename,bytes:phone.bytes(),kind:'pamark',updatedAt:'2026-01-01',savedToFolder:false} satisfies SavedWorkbook);

// Tuotu tiedosto on alkuperäinen. Tuonti ei saa heittää puhelimen päivää pois.
const result=await importPamark(original,name);
assert.equal(result.date,'2026-09-01','tuonnin päivämäärä pitää palautua, jotta käyttöliittymä osaa siirtyä oikealle jaksolle');
const stillPhone=new XlsxDocument((await getStored<SavedWorkbook>(`workbook:${filename}`))!.bytes).snapshot().A24?.value;
assert.equal(stillPhone,'Reitti: OMA REITTI','tuonti ei saa heittää puhelimen päivää pois');

// Käyttäjä valitsee: käytä tuotua tiedostoa. Silloin listan on oltava tuotu.
await useImportedFile('pamark',filename,original);
const adopted=await getStored<SavedWorkbook>(`workbook:${filename}`);
const originalRoute=new XlsxDocument(original).snapshot().A24?.value;
assert.notEqual(originalRoute,'Reitti: OMA REITTI','esimerkkitiedostossa pitää olla alkuperäinen reitti');
assert.equal(new XlsxDocument(adopted!.bytes).snapshot().A24?.value,originalRoute,'tuotua tiedostoa ei otettu käyttöön');
assert.equal(pamarkDayList(adopted!.bytes).length,36,'päivien määrä vaihtui');
// Aiemman version on löytyttävissä varmuuskopiosta.
const backup=await getStored<SavedWorkbook>(`backup:before-import:${filename}`);
assert.ok(backup,'aiemmasta versiosta ei tehty varmuuskopiota');
assert.equal(new XlsxDocument(backup!.bytes).snapshot().A24?.value,'Reitti: OMA REITTI');
// Tuotua kopioa ei saa lukea vanhan kansion tiedoston päälle.
assert.equal(await getStored(`imported:${filename}`),true);
assert.ok(await storedWorkbook('pamark','2026-09-01',name));
console.log('PASS adopt imported: imported file becomes the working list, previous version backed up, imported flag set');
