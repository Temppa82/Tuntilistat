import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {unzipSync} from 'fflate';
import {XlsxDocument} from '../lib/xlsx-document';
import {hoursDays} from '../lib/read-hours';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const oldBytes=new Uint8Array(readFileSync('work/listat-fixtures/Tuntilista Ajuri.xlsx')),bytes=new Uint8Array(readFileSync('work/browser-export.xlsx'));
const before=new XlsxDocument(oldBytes).snapshot(),after=new XlsxDocument(bytes).snapshot();
assert.deepEqual(hoursDays(bytes,'Testi Testiajo'),['2025-03-03','2025-03-04','2025-03-05','2025-03-06','2025-03-10']);
for(const [a,c] of Object.entries(before)){if(c.formula)assert.equal(after[a].formula,c.formula);else if(Number(a.replace(/\D/g,''))>=3&&Number(a.replace(/\D/g,''))<=13)assert.deepEqual(after[a],c,a);}
const oldZip=unzipSync(oldBytes),newZip=unzipSync(bytes);for(const [p,b] of Object.entries(oldZip))if(!['xl/workbook.xml','xl/worksheets/sheet1.xml'].includes(p))assert.deepEqual(newZip[p],b,p);
assert.equal(after.A16.value,'Reitti: Testipäivä');console.log('PASS browser-export XLSX: all original four days preserved, fifth day saved, formulas/styles/other ZIP entries preserved');
