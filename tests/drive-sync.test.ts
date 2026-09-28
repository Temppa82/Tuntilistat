import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import 'fake-indexeddb/auto';
import {connectGoogle,setDriveFolder,findDriveWorkbook,uploadDriveWorkbook,DriveConflict,XLSX_MIME} from '../lib/google-drive';
import {putStored,getStored} from '../lib/local-files';
import {enqueuePamark,flushPamark,syncJobs} from '../lib/pamark-sync';
import {newDraft} from '../lib/capture';
import {fillWorkbook} from '../lib/workbook-export';
Object.assign(globalThis,{DOMParser,XMLSerializer,window:{dispatchEvent:()=>true,google:{accounts:{oauth2:{initTokenClient:(config:{callback:(r:unknown)=>void})=>({requestAccessToken:()=>config.callback({access_token:'test-only-token',expires_in:3600})})}}}}});
Object.assign(globalThis,{localStorage:{getItem:()=>null,setItem:()=>{}}});
await connectGoogle();
await setDriveFolder({id:'test-folder-123',name:'Test folder'});
const template=new Uint8Array(readFileSync('work/template-tests/pamark.xlsx'));
await putStored('template:pamark',{bytes:template,name:'pamark.xlsx'});
const draft=newDraft();Object.assign(draft.values,{vehicle:'ZLC-613',date:'2026-09-02',start:'06:00',end:'15:00',startKm:'1000',endKm:'1200',loadingHours:'0,5',stops:'12',route:'Testireitti'});
const previous=structuredClone(draft);previous.values.date='2026-09-01';
let remote=fillWorkbook(template,'pamark',previous,'Testi',{fresh:true}).bytes;
let version=1,fail=false,conflictOnce=false,puts=0;
const file=()=>({id:'file-123',title:'Pamark ajolista syyskuu 1-2 2026.xlsx',mimeType:XLSX_MIME,etag:`version-${version}`,version:String(version),editable:true});
globalThis.fetch=async(input,options)=>{
 const url=new URL(String(input));
 if(fail)throw new TypeError('offline');
 assert.equal(new Headers(options?.headers).get('Authorization'),'Bearer test-only-token');
 if(url.pathname==='/drive/v2/files'){
  assert.ok(url.searchParams.get('q')?.includes("'test-folder-123' in parents"));
  assert.ok(url.searchParams.get('q')?.includes('syyskuu 1-2 2026.xlsx'));
  return Response.json({items:[file()]});
 }
 if(url.pathname==='/drive/v2/files/file-123'){
  if(url.searchParams.get('alt')!=='media')return Response.json({id:'file-123',etag:`version-${version}`,version:String(version)});
  // Drive compares a media-read If-Match against the content ETag and refuses it every time.
  assert.equal(new Headers(options?.headers).get('If-Match'),null);
  return new Response(remote);
 }
 if(url.pathname==='/upload/drive/v2/files/file-123'){
  puts++;assert.equal(new Headers(options?.headers).get('If-Match'),`version-${version}`);
  if(conflictOnce){conflictOnce=false;version++;return new Response('',{status:412});}
  remote=new Uint8Array(options?.body as Uint8Array);version++;return Response.json(file());
 }
 throw new Error('Unexpected request '+url.pathname);
};
await enqueuePamark(draft,'Testi');fail=true;
await assert.rejects(flushPamark());
assert.equal((await syncJobs())[draft.id].status,'error');
assert.equal((await syncJobs())[draft.id].draft.values.route,'Testireitti');
fail=false;conflictOnce=true;
assert.equal(await flushPamark(),1,'palauttaa lähetettyjen kirjausten määrän');
assert.equal((await syncJobs())[draft.id].status,'synced');assert.equal(puts,2);
assert.doesNotThrow(()=>fillWorkbook(remote,'pamark',previous,'Testi',{fresh:false}));
await enqueuePamark(draft,'Testi');assert.equal(await flushPamark(),1);
assert.equal((await syncJobs())[draft.id].status,'synced');
assert.equal(await flushPamark(),0,'tyhjä jono ei lähetä mitään ja ei lupaa mitään väärää');
assert.equal(await getStored('access_token'),undefined);
globalThis.fetch=async()=>Response.json({items:[file(),file()]});
await assert.rejects(findDriveWorkbook('test-folder-123','Pamark ajolista syyskuu 1-2 2026.xlsx'),/useita/);
globalThis.fetch=async()=>new Response('',{status:412});
await assert.rejects(uploadDriveWorkbook(file(),remote),DriveConflict);
console.log('Drive folder filter, half-month name, local queue, offline retry, conditional write, duplicate prevention and preserved prior days: OK');

// Same-day corrections before sending replace the pending draft, not the shared row.
const pendingA=structuredClone(draft);pendingA.id='pending-a';pendingA.values.date='2026-09-03';
const pendingB=structuredClone(pendingA);pendingB.id='pending-b';pendingB.values.route='Korjattu reitti';
await enqueuePamark(pendingA,'Testi');await enqueuePamark(pendingB,'Testi');
assert.equal((await syncJobs())['pending-a'],undefined);
assert.equal((await syncJobs())['pending-b'].draft.values.route,'Korjattu reitti');
await putStored('drive:jobs',{});
// Existing conflicting shared day is never overwritten.
const changed=structuredClone(draft);changed.values.endKm='9999';
let writes=0;
globalThis.fetch=async(input,options)=>{
 const url=new URL(String(input));
 if(url.pathname==='/drive/v2/files')return Response.json({items:[file()]});
 if(url.pathname==='/drive/v2/files/file-123')return new Response(remote);
 writes++;throw new Error('Must not write a conflicting shared row');
};
await enqueuePamark(changed,'Testi');await assert.rejects(flushPamark(),/erilainen kirjaus/);assert.equal(writes,0);
await putStored('drive:jobs',{});
// A missing period is created directly in Drive, with no application server.
const {createDriveWorkbook}=await import('../lib/google-drive');
let created=false;
globalThis.fetch=async(input,options)=>{
 const url=new URL(String(input));assert.equal(url.origin,'https://www.googleapis.com');
 if(url.pathname==='/drive/v3/files/generateIds')return Response.json({ids:['generated-test-id']});
 if(url.pathname==='/drive/v2/files')return Response.json({items:[]});
 if(url.pathname==='/upload/drive/v2/files'){
  assert.equal(options?.method,'POST');assert.ok(options?.body instanceof Blob);
  const multipart=await (options!.body as Blob).text();assert.ok(multipart.includes('generated-test-id'));assert.ok(multipart.includes('Pamark ajolista syyskuu 2-2 2026.xlsx'));created=true;return Response.json({...file(),id:'generated-test-id'});
 }
 throw new Error('Unexpected endpoint '+url);
};
await createDriveWorkbook('test-folder-123','Pamark ajolista syyskuu 2-2 2026.xlsx',template);assert.equal(created,true);
console.log('Pending edit deduplication, shared-row conflict refusal, direct Drive creation without backend: OK');

// A precondition Drive keeps refusing is reported once instead of being retried pointlessly.
await putStored('drive:jobs',{});
const stuck=structuredClone(draft);stuck.id='stuck';stuck.values.date='2026-09-04';
const untouched=new Uint8Array(remote);let refusedPuts=0;
globalThis.fetch=async(input,options)=>{
 const url=new URL(String(input));
 if(url.pathname==='/drive/v2/files')return Response.json({items:[{...file(),etag:'version-fixed',version:'7'}]});
 if(url.pathname==='/drive/v2/files/file-123')return url.searchParams.get('alt')==='media'?new Response(remote):Response.json({id:'file-123',etag:'version-fixed',version:'7'});
 if(url.pathname==='/upload/drive/v2/files/file-123'){refusedPuts++;return new Response('',{status:412});}
 throw new Error('Unexpected endpoint '+url.pathname);
};
await enqueuePamark(stuck,'Testi');
await assert.rejects(flushPamark(),/hylkäsi saman version ehdon/);
assert.equal(refusedPuts,2);
assert.deepEqual(remote,untouched);
assert.equal((await syncJobs())[stuck.id].status,'error');
console.log('Refused precondition reported after two identical ETags, shared file left untouched: OK');

// The connection check reports what the shared folder holds and never writes.
await putStored('drive:jobs',{});
const {checkSharedList}=await import('../lib/pamark-sync');
const beforeCheck=structuredClone(remote);let checkWrites=0;
globalThis.fetch=async(input)=>{
  const url=new URL(String(input));
  if(url.pathname.startsWith('/upload/')){checkWrites++;throw new Error('The connection check must not write');}
  if(url.pathname==='/drive/v2/files')return Response.json({items:[file()]});
  if(url.pathname==='/drive/v2/files/file-123')return new Response(remote);
  throw new Error('Unexpected endpoint '+url.pathname);
};
const found=await checkSharedList('test-folder-123','2026-09-02','Testi');
assert.deepEqual(found,{filename:'Pamark ajolista syyskuu 1-2 2026.xlsx',exists:true,days:2,vehicles:['ZLC-613'],size:beforeCheck.length});
assert.equal(checkWrites,0);
assert.deepEqual(remote,beforeCheck);
assert.equal((await syncJobs())['stuck'],undefined);
globalThis.fetch=async(input)=>{
  const url=new URL(String(input));
  if(url.pathname==='/drive/v2/files')return Response.json({items:[]});
  throw new Error('Unexpected endpoint '+url.pathname);
};
assert.deepEqual(await checkSharedList('test-folder-123','2026-10-05','Testi'),{filename:'Pamark ajolista lokakuu 1-2 2026.xlsx',exists:false,days:0,vehicles:[],size:0});
assert.equal(checkWrites,0);
console.log('Connection check reads the shared file, counts days, reports a missing period and writes nothing: OK');

// A folder linked by hand is verified as a real, writable folder, so the Picker is not a single point of failure.
const {parseDriveFolderId,readDriveFolder}=await import('../lib/google-drive');
const folderId='1AbCdEfGhIjKlMnOpQrStUvWxYz-2345678901';
assert.equal(parseDriveFolderId(folderId),folderId);
assert.equal(parseDriveFolderId(`https://drive.google.com/drive/folders/${folderId}`),folderId);
assert.equal(parseDriveFolderId(`https://drive.google.com/drive/folders/${folderId}?usp=sharing`),folderId);
assert.equal(parseDriveFolderId(`https://drive.google.com/drive/u/0/folders/${folderId}/view`),folderId);
assert.equal(parseDriveFolderId(`https://drive.google.com/open?id=${folderId}`),folderId);
assert.equal(parseDriveFolderId(`drive.google.com/drive/folders/${folderId}#list`),folderId);
for(const bad of ['','   ','kansio','https://drive.google.com/drive/my-drive']){
  await assert.rejects(Promise.resolve().then(()=>parseDriveFolderId(bad)),/(?=.)/,'should reject '+JSON.stringify(bad));
}
let folderReads=0;
globalThis.fetch=async(input)=>{
  const url=new URL(String(input));
  if(url.pathname!=='/drive/v2/files/'+folderId)throw new Error('Unexpected endpoint '+url.pathname);
  folderReads++;
  assert.ok(url.searchParams.get('supportsAllDrives')==='true');
  if(url.searchParams.get('fields')?.includes('canAddChildren'))return Response.json({id:folderId,title:'Ajolistat',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
  throw new Error('Unexpected request '+url.searchParams.toString());
};
assert.deepEqual(await readDriveFolder(`https://drive.google.com/drive/folders/${folderId}`),{id:folderId,name:'Ajolistat'});
assert.equal(folderReads,1,'metadata is read once, nothing is written');
globalThis.fetch=async()=>Response.json({id:'file-9',title:'Ajolista syyskuu 1-2 2026.xlsx',mimeType:XLSX_MIME});
await assert.rejects(readDriveFolder('file-9-abcdefghijklmnopqrstuv'),/ei ole kansio/);
globalThis.fetch=async()=>Response.json({id:folderId,title:'Ajolistat',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:false}});
await assert.rejects(readDriveFolder(folderId),/oikeutta lisätä tiedostoja/);
console.log('Hand-linked folder parsed from any Drive URL, verified read-only as writable folder, wrong kind refused: OK');
