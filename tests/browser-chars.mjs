import {chromium} from 'file:///C:/Users/teemu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext();const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
await page.goto(base);
// Tallennus puhelimen oikeassa selaimessa kaatui, kun reitissä oli merkki,
// jota XML ei salli. Testi kirjoittaa tällaisen merkin ja vaatii, että
// tallennus onnistuu ja tiedosto pysyy luettavana Chromen jäsentäjällä.
const route='Vantaa \u0000 Helsinki \uD800 \uFEFF \uFFFE Turku \u2013 Espoo \uD83D\uDE9A';
const result=await page.evaluate(async ({pamark,route})=>{
 const {initialState,steps}=await import('/lib/capture.ts');
 const {putStored,getStored}=await import('/lib/local-files.ts');
 const {writeLocal}=await import('/lib/local-capture.ts');
 const {XlsxDocument}=await import('/lib/xlsx-document.ts');
 await putStored('setup:complete',true);await putStored('storage:choice',{mode:'browser',name:'Sovellusmuisti'});
 await putStored('workbook:Pamark ajolista syyskuu 1-2 2026.xlsx',{filename:'Pamark ajolista syyskuu 1-2 2026.xlsx',bytes:new Uint8Array(pamark),kind:'pamark',savedToFolder:false});
 const s=initialState();s.name='Testi Testiajo';s.nameLocked=true;s.active='pamark';
 s.drafts.pamark.values.date='2026-09-08';s.drafts.pamark.values.vehicle='JTS-790';
 s.drafts.pamark.values.start='06:00';s.drafts.pamark.values.startKm='1000';
 s.drafts.pamark.values.end='14:00';s.drafts.pamark.values.endKm='1180';
 s.drafts.pamark.values.loadingHours='1.5';s.drafts.pamark.values.stops='2';
 s.drafts.pamark.values.route=route;s.drafts.pamark.step=steps.pamark.length;
 await writeLocal(s);
 const {fillWorkbook}=await import('/lib/workbook-export.ts');
 const draft=s.drafts.pamark;
 const out=fillWorkbook(new Uint8Array(pamark),'pamark',draft,'Testi Testiajo',{fresh:false,overwrite:true});
 // Chromen oma jäsentäjä: tämä hylkää sen, mitä xmldom suostuu.
 const parser=new DOMParser();
 const parts=[];
 const {unzipSync,strFromU8}=await import('/node_modules/fflate/esm/browser.js');
 for(const [name,data] of Object.entries(unzipSync(out.bytes))) if(name.endsWith('.xml')) parts.push([name,parser.parseFromString(strFromU8(data),'application/xml').getElementsByTagName('parsererror').length]);
 const sheet=new XlsxDocument(out.bytes).snapshot();
 return {row:out.row,wrong:parts.filter(([,n])=>n>0),written:sheet[`A${out.row}`].value,routeCell:String(sheet[`A${out.row+1}`]?.value??'')};
},{pamark:[...readFileSync('work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx')],route});
assert.equal(result.wrong.length,0,`selaimen jäsentäjä hylkäsi osan: ${JSON.stringify(result.wrong)}`);
assert.equal(result.routeCell.includes('\u0000'),false,'NUL jäi reittiin');
assert.equal(result.routeCell.includes('\uD800'),false,'yksinäinen korvaaja jäi reittiin');
assert.ok(result.routeCell.includes('Vantaa')&&result.routeCell.includes('Turku')&&result.routeCell.includes('\uD83D\uDE9A'),`reitti katosi: ${result.routeCell}`);
assert.deepEqual(errors,[]);
await browser.close();
console.log('PASS browser chars: reitti jossa on XML:lle kelvottomia merkkejä tallentuu ja tiedosto pysyy luettavana');
