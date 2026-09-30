import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import 'fake-indexeddb/auto';
import {connectGoogle,createDriveWorkbook,findDriveWorkbook,driveRequest,DriveApiError,XLSX_MIME} from '../lib/google-drive';
import {getStored} from '../lib/local-files';
Object.assign(globalThis,{DOMParser,XMLSerializer,window:{dispatchEvent:()=>true,google:{accounts:{oauth2:{initTokenClient:(config:{callback:(r:unknown)=>void})=>({requestAccessToken:()=>config.callback({access_token:'test-only-token',expires_in:3600})})}}}}});
Object.assign(globalThis,{localStorage:{getItem:()=>null,setItem:()=>{}}});
await connectGoogle();
const bytes=new Uint8Array([1,2,3,4]);

// A Drive API error carries the failing endpoint and Google's own reason, so the
// user (and us) can tell exactly which request was refused and why.
globalThis.fetch=async()=>new Response(JSON.stringify({error:{message:'Invalid query'}}),{status:400});
await assert.rejects(driveRequest('/drive/v2/files',{},'test'),e=>{
 assert.ok(e instanceof DriveApiError,'käsittelemätön 400 on DriveApiError');
 assert.equal(e.status,400);
 assert.ok(e.message.includes('Invalid query'),'Googlen oma syy mukana');
 assert.ok(e.message.includes('GET /drive/v2/files'),'epäonnistunut päätepiste mukana');
 return true;
});

// files.list hylkää includeItemsFromAllDrives-parametrin (400); haku yrittää kerran
// ilman sitä ja onnistuu. Muu virhe (esim. verkko) ei käynnistä retryä.
let listCalls=0,hadAllDrives=false,secondOmitsAllDrives=false;
globalThis.fetch=async(input)=>{
 const url=new URL(String(input));
 assert.equal(url.origin,'https://www.googleapis.com');
 if(url.pathname==='/drive/v2/files'){
  listCalls++;
  const all=url.searchParams.get('includeItemsFromAllDrives')==='true';
  if(listCalls===1){hadAllDrives=all;return new Response(JSON.stringify({error:{message:'Invalid query'}}),{status:400});}
  secondOmitsAllDrives=!url.searchParams.has('includeItemsFromAllDrives');
  return Response.json({items:[{id:'file-x',title:'Tuntilista TestiFall2.xlsx',mimeType:XLSX_MIME,etag:'e',version:'1',editable:true}]});
 }
 throw new Error('Unexpected endpoint '+url.pathname);
};
const found=await findDriveWorkbook('test-folder-123','Tuntilista TestiFall2.xlsx');
assert.equal(found?.id,'file-x');
assert.equal(listCalls,2);
assert.equal(hadAllDrives,true);
assert.equal(secondOmitsAllDrives,true);
let offlineCalls=0;
globalThis.fetch=async()=>{offlineCalls++;throw new TypeError('offline');};
await assert.rejects(findDriveWorkbook('test-folder-123','Tuntilista Off.xlsx'),TypeError);
assert.equal(offlineCalls,1,'verkkovirhettä ei yritetä uudelleen');

// generateIds hylätään (400): luonti jatkuu tavallisena lisäyksenä ilman
// esigeneroitua tunnusta ja onnistuu Driven antamalla tunnuksella.
let generateCalls=0,insertCalls=0;const bodies:string[]=[];
const meta=(text:string)=>{const start=text.indexOf('\r\n\r\n')+4;const end=text.indexOf('\r\n--');return JSON.parse(text.slice(start,end)) as {id?:string;title?:string;parents?:{id:string}[]};};
globalThis.fetch=async(input,options)=>{
 const url=new URL(String(input));
 assert.equal(new Headers(options?.headers).get('Authorization'),'Bearer test-only-token');
 if(url.pathname==='/drive/v3/files/generateIds'){generateCalls++;return new Response(JSON.stringify({error:{message:'API not enabled'}}),{status:400});}
 if(url.pathname==='/drive/v2/files')return Response.json({items:[]});
 if(url.pathname==='/upload/drive/v2/files'){
  insertCalls++;bodies.push(await (options!.body as Blob).text());
  if(url.searchParams.get('uploadType')!=='multipart')throw new Error('multipart-uploadia odotettu');
  return Response.json({id:'assigned-id-1',title:'Tuntilista TestiFall1.xlsx',mimeType:XLSX_MIME,etag:'e1',version:'1',editable:true});
 }
 throw new Error('Unexpected endpoint '+url.pathname);
};
const created=await createDriveWorkbook('test-folder-123','Tuntilista TestiFall1.xlsx',bytes);
assert.equal(created.id,'assigned-id-1');
assert.equal(generateCalls,1);
assert.equal(insertCalls,1);
assert.equal(meta(bodies[0]).id,undefined,'lisäys ilman esigeneroitua tunnusta');
assert.equal(meta(bodies[0]).title,'Tuntilista TestiFall1.xlsx');
assert.equal(meta(bodies[0]).parents?.[0].id,'test-folder-123');

// Esigeneroitu tunnus hyväksytään, mutta itse luonti hylätään (400): retry ilman
// tunnusta onnistuu, eikä vanhentunutta tunnusta jää odottamaan uutta yritystä.
let attempts=0;const attemptIds:string[]=[];
globalThis.fetch=async(input,options)=>{
 const url=new URL(String(input));
 if(url.pathname==='/drive/v3/files/generateIds')return Response.json({ids:['pregen-id-9']});
 if(url.pathname==='/drive/v2/files')return Response.json({items:[]});
 if(url.pathname==='/upload/drive/v2/files'){
  attempts++;const text=await (options!.body as Blob).text();
  attemptIds.push(meta(text).id??'');
  if(attempts===1)return new Response(JSON.stringify({error:{message:'Invalid id'}}),{status:400});
  return Response.json({id:'assigned-id-2',title:'Tuntilista TestiFall3.xlsx',mimeType:XLSX_MIME,etag:'e3',version:'3',editable:true});
 }
 throw new Error('Unexpected endpoint '+url.pathname);
};
const retried=await createDriveWorkbook('test-folder-123','Tuntilista TestiFall3.xlsx',bytes);
assert.equal(retried.id,'assigned-id-2');
assert.equal(attempts,2);
assert.deepEqual(attemptIds,['pregen-id-9','']);
assert.equal(await getStored('drive:new:test-folder-123:Tuntilista TestiFall3.xlsx'),undefined,'vanha tunnus poistetaan retryn jälkeen');
console.log('PASS Drive 400 diagnostics and create/list fallbacks: OK');