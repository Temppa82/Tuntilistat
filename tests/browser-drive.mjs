import {chromium} from 'file:///C:/Users/teemu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {XlsxDocument} from '../lib/xlsx-document.ts';
import {pamarkDayList} from '../lib/read-pamark.ts';
Object.assign(globalThis,{DOMParser,XMLSerializer});

// Koko synkronointipolku oikeassa käyttöliittymässä: tallennus jonottaa päivän, nappi yhdistää,
// lukee jaetun tiedoston, yhdistää oman päivän ja varmistaa ennen lähetystä. Googlein skriptit ja
// Drive-rajapinta on korvattu, joten mitään oikeaa ei kirjoiteta eikä verkkoa käytetä.
const source=readFileSync('work/listat-fixtures/Pamark ajolista syyskuu 1-2 2026.xlsx');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext();
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.BASE_URL||'http://127.0.0.1:5174';

await page.route('**/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:`
window.google={accounts:{oauth2:{initTokenClient:c=>({requestAccessToken:()=>c.callback({access_token:'test-token',expires_in:3600})})}},picker:{DocsView:class{setIncludeFolders(){return this}setSelectFolderEnabled(){return this}setMimeTypes(){return this}},PickerBuilder:class{addView(){return this}setOAuthToken(){return this}setDeveloperKey(){return this}setAppId(){return this}setOrigin(){return this}setLocale(){return this}setCallback(){return this}build(){return{setVisible(){},dispose(){}}}}}};`}));
await page.route('**/js/api.js',r=>r.fulfill({contentType:'application/javascript',body:`window.gapi={load:(n,o)=>o.callback()};`}));

let remote=new Uint8Array(source),version=1,uploads=0,reads=0;
await page.route('https://www.googleapis.com/**',async route=>{
  const url=new URL(route.request().url());
  const file=()=>({id:'copy',title:'Pamark ajolista syyskuu 1-2 2026.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',etag:String(version),version:String(version),editable:true});
  if(url.pathname==='/drive/v2/files')return route.fulfill({json:{items:[file()]}});
  if(url.pathname==='/drive/v2/files/copy'){
    if(url.searchParams.get('alt')!=='media')return route.fulfill({json:{id:'copy',etag:String(version),version:String(version)}});
    reads++;
    return route.fulfill({body:Buffer.from(remote)});
  }
  if(url.pathname==='/upload/drive/v2/files/copy'){
    assert.equal(route.request().headers()['if-match'],String(version),'kirjoitus vaatii version ehto');
    remote=new Uint8Array(await route.request().postDataBuffer());version++;uploads++;
    return route.fulfill({json:file()});
  }
  throw new Error('Odottamaton pyyntö '+url.pathname);
});

await page.goto(base);
await page.evaluate(async({bytes,folder,config})=>{
  const {initialState,steps}=await import('/lib/capture.ts');
  const {putStored}=await import('/lib/local-files.ts');
  const {writeLocal}=await import('/lib/local-capture.ts');
  await putStored('setup:complete',true);
  await putStored('storage:choice',{mode:'browser',name:'Sovellusmuisti'});
  localStorage.setItem('ajolista:google-config',JSON.stringify(config));
  await putStored('drive:folder',folder);
  const s=initialState();
  s.name='Testi Testiajo';s.nameLocked=true;s.active='pamark';
  s.drafts.pamark.values.date='2026-09-05';s.drafts.pamark.values.vehicle='JTS-790';
  s.drafts.pamark.values.start='06:00';s.drafts.pamark.values.end='15:30';
  s.drafts.pamark.values.startKm='1000';s.drafts.pamark.values.endKm='1200';
  s.drafts.pamark.values.loadingHours='0,5';s.drafts.pamark.values.stops='12';s.drafts.pamark.values.route='Selaintestin reitti';
  s.drafts.pamark.step=steps.pamark.length;
  await writeLocal(s);
  const {storeGoogleConfig}=await import('/lib/google-drive.ts');
  storeGoogleConfig(config);
  await putStored(`workbook:Pamark ajolista syyskuu 1-2 2026.xlsx`,{filename:'Pamark ajolista syyskuu 1-2 2026.xlsx',bytes:new Uint8Array(bytes),kind:'pamark',savedToFolder:false});
},{bytes:[...source],folder:{id:'jaettu-kansio',name:'Ajolistat'},config:{clientId:'test',pickerKey:'test',projectNumber:'123'}});
await page.reload();
await page.getByText('Selaintestin reitti',{exact:false}).first().waitFor();

const save=page.getByRole('button',{name:'Tallenna puhelimeen'});
const sync=page.getByRole('button',{name:'Synkronoi Driveen'});
assert.equal(await sync.count(),1,'synkronointinappi on Tallenna-ryhmässä');
assert.equal(await sync.isVisible(),true);
assert.equal(uploads,0,'mitään ei lähetetty ennen napin painallusta');

await save.click();
await page.getByText('Päivä odottaa Driveen lähettämistä.',{exact:false}).waitFor();
assert.equal(uploads,0,'tallennus ei lähetä mitään, vaan jonottaa');

await sync.click();
// Ilmoitus saa kertoa päivämäärän vasta lähetyksen jälkeen, joten tähän ei saa jäädä vanha luku.
const done=page.getByText('1 kirjaus lähetettiin jaettuun ajolistaan.',{exact:false});
await done.waitFor({timeout:120000});
await page.getByText('sisältää nyt 37 päivää',{exact:false}).waitFor({timeout:120000});
assert.equal(uploads,1,'yksi lähetys');
assert.equal(reads,3,'luetaan ennen kirjoitusta ja vielä lähetyksen jälkeen tarkistukseen');

// Jaettuun tiedostoon saapu vain oma päivä, ja se on oikeassa osiossa.
const after=new XlsxDocument(remote).snapshot();
const days=pamarkDayList(remote);
assert.equal(days.length,37,'yksi uusi päivä, muut 36 säilyvät');
const mine=days.find(d=>d.date==='2026-09-05'&&d.label==='JTS-790');
assert.ok(mine,'päivä kirjoitettiin JTS-790-osioon');
assert.equal(after[`B${mine.row}`]?.value,0.25,'alkuaika 06:00');
assert.equal(String(after[`A${mine.routeRow}`]?.value),'Reitti: Selaintestin reitti');
const beforeSnap=new XlsxDocument(new Uint8Array(source)).snapshot();
for(const day of pamarkDayList(new Uint8Array(source))){
 for(const [address,cell] of Object.entries(beforeSnap)){
  if(cell.formula)continue;
  const row=Number(address.slice(1));
  if(row!==day.row&&row!==day.routeRow)continue;
  assert.equal(after[address]?.value,cell.value,`${day.label} ${day.date} solu ${address} säilyi lähetyksessä`);
 }
}
const formulas=(s)=>Object.fromEntries(Object.entries(s).filter(([,c])=>c.formula).map(([a,c])=>[a,c.formula]));
assert.deepEqual(formulas(after),formulas(beforeSnap),'kaavat säilyivät lähetyksessä');
// Oma kopio päivittyi jaetun tiedoston sisältöön.
const local=await page.evaluate(async()=>{const {getStored}=await import('/lib/local-files.ts');return await getStored('workbook:Pamark ajolista syyskuu 1-2 2026.xlsx');});
assert.equal(local.bytes.length,remote.length,'paikallinen kopio on yhdistetty tiedosto');
assert.deepEqual(errors,[]);
await page.screenshot({path:'work/ui-drive-sync.png',fullPage:true});
await browser.close();
console.log('PASS browser: tallennus jonottaa, nappi yhdistää, päivä menee omaan osioon, 36 päivää ja 417 kaavaa säilyvät, oma kopio päivittyy');
