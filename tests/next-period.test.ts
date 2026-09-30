import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import 'fake-indexeddb/auto';
import {connectGoogle} from '../lib/google-drive';
import {nextPeriodStart,nextPamarkPeriod,prepareNextPeriodWorkbook} from '../lib/pamark-sync';
import {XlsxDocument} from '../lib/xlsx-document';
import {validateTemplate} from '../lib/workbook-export';
import {pamarkDayList} from '../lib/read-pamark';
Object.assign(globalThis,{DOMParser,XMLSerializer,window:{dispatchEvent:()=>true,google:{accounts:{oauth2:{initTokenClient:(config:{callback:(r:unknown)=>void})=>({requestAccessToken:()=>config.callback({access_token:'test-only-token',expires_in:3600})})}}}}});
Object.assign(globalThis,{localStorage:{getItem:()=>null,setItem:()=>{}}});
await connectGoogle();

// Seuraava jakso meneillään olevan jakson mukaan: 1-15 -> 16., 16-30 -> tulevan kuukauden 1.
assert.equal(nextPeriodStart('2026-09-30'),'2026-10-01');
assert.equal(nextPeriodStart('2026-10-01'),'2026-10-16');
assert.equal(nextPeriodStart('2026-10-15'),'2026-10-16');
assert.equal(nextPeriodStart('2026-10-16'),'2026-11-01');
assert.equal(nextPeriodStart('2026-12-31'),'2027-01-01');
assert.equal(nextPamarkPeriod('Testi','2026-09-30').filename,'Pamark ajolista lokakuu 1-2 2026.xlsx');
const expected=nextPamarkPeriod('Testi').filename;

// Tyhjä ajolista luodaan oikean rakenteen mukaisena jaettuun kansioon, kun sitä ei vielä ole.
let creates=0;let payload:Uint8Array|undefined;let title='';
globalThis.fetch=async(input,options)=>{
 const url=new URL(String(input));
 if(url.pathname==='/drive/v3/files/generateIds')return Response.json({ids:['prep-id']});
 if(url.pathname==='/drive/v2/files')return Response.json({items:[]});
 if(url.pathname==='/upload/drive/v2/files'){
  creates++;
  const body=Buffer.from(await (options!.body as Blob).arrayBuffer());
  const id=body.subarray(0,body.indexOf(Buffer.from('\r\n'))).toString();
  const marker=Buffer.from('\r\n'+id),first=body.indexOf(marker);
  const jsonStart=body.indexOf(Buffer.from('\r\n\r\n'),id.length)+4;
  const meta=String(body.subarray(jsonStart,first));
  title=((JSON.parse(meta) as {title:string}).title);
  const dataStart=body.indexOf(Buffer.from('\r\n\r\n'),first+marker.length)+4;
  const dataEnd=body.indexOf(Buffer.from('\r\n'+id+'--'),dataStart);
  payload=new Uint8Array(body.subarray(dataStart,dataEnd));
  return Response.json({id:'prep-id',title,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',etag:'e1',version:'1',editable:true});
 }
 throw new Error('Unexpected endpoint '+url.pathname);
};
const created=await prepareNextPeriodWorkbook('test-folder-123','Testi');
assert.equal(created.created,true);
assert.equal(creates,1);
assert.equal(title,expected);
assert.ok(payload,'tyhjä lista ladattiin Driveen');
const doc=new XlsxDocument(payload!);validateTemplate(doc,'pamark');
assert.equal(pamarkDayList(payload!).length,0,'listassa ei ole päiviä');
console.log('PASS next period: tyhja ajolista luodaan Driveen valmiiksi oikealla rakenteella ja jakson laskennalla');

// Olemassa olevaa ajolistaa ei korvata, eikä tiedostoa luoda silloin.
let uploads=0;
globalThis.fetch=async(input)=>{
 const url=new URL(String(input));
 if(url.pathname==='/drive/v2/files')return Response.json({items:[{id:'file-x',title:expected,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',etag:'e',version:'1',editable:true}]});
 if(url.pathname.startsWith('/upload/'))uploads++;
 throw new Error('Unexpected endpoint '+url.pathname);
};
const existing=await prepareNextPeriodWorkbook('test-folder-123','Testi');
assert.equal(existing.created,false);
assert.equal(uploads,0,'olemassa olevaan ei kirjoiteta');
console.log('PASS next period: olemassa olevaa listaa ei korvata');