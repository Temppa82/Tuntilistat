import {chromium} from 'file:///C:/Users/teemu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

// Tuntilistan 'Lähetä Driveen' ja 'Jaa' -polut oikeassa käyttöliittymässä. Google- ja
// Drive-rajapinta on korvattu, joten mitään oikeaa ei kirjoiteta eikä verkkoa käytetä.
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext();
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const filename='Tuntilista Testi0926.xlsx';

await page.route('**/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:`
window.google={accounts:{oauth2:{initTokenClient:c=>({requestAccessToken:()=>c.callback({access_token:'test-token',expires_in:3600})})}},picker:{DocsView:class{setIncludeFolders(){return this}setSelectFolderEnabled(){return this}setMimeTypes(){return this}},PickerBuilder:class{addView(){return this}setOAuthToken(){return this}setDeveloperKey(){return this}setAppId(){return this}setOrigin(){return this}setLocale(){return this}setCallback(){return this}build(){return{setVisible(){},dispose(){}}}}}};`}));
await page.route('**/js/api.js',r=>r.fulfill({contentType:'application/javascript',body:`window.gapi={load:(n,o)=>o.callback()};`}));

// Jakovalikko korvataan tallennettavalla jonolla, jotta testi näkee, mitä jaettaisiin.
// Rajatapauksena jakovalikko voi myös hylätä tiedoston: Chrome ei tue xlsx-jakoa, jolloin
// se hylkää NotAllowedError-virheellä. Sovelluksen on ladattava tiedosto silloin.
await context.addInitScript(()=>{
 Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});
 Object.defineProperty(navigator,'share',{value:data=>{
  if(window.__shareReject)return Promise.reject(new DOMException('Permission denied','NotAllowedError'));
  (window.__shares=(window.__shares||[])).push({files:(data.files||[]).map(f=>f.name)});
 },configurable:true});
});

let remote=undefined,version=1,creates=0,uploads=0,reads=0,lists=0;
await page.route('https://www.googleapis.com/**',async route=>{
  const url=new URL(route.request().url());
  const file=()=>({id:'tunti',title:filename,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',etag:String(version),version:String(version),editable:true});
  if(url.pathname==='/drive/v2/files'){lists++;return route.fulfill({json:{items:remote?[file()]:[]}});}
  if(url.pathname==='/drive/v2/files/tunti'){
    if(url.searchParams.get('alt')==='media'){reads++;return route.fulfill({body:Buffer.from(remote)});}
    return route.fulfill({json:{id:'tunti',etag:String(version),version:String(version)}});
  }
  if(url.pathname==='/upload/drive/v2/files/tunti'){
    assert.equal(route.request().headers()['if-match'],String(version),'kirjoitus vaatii version ehdon');
    remote=new Uint8Array(await route.request().postDataBuffer());version++;uploads++;
    return route.fulfill({json:file()});
  }
  if(url.pathname==='/drive/v3/files/generateIds')return route.fulfill({json:{ids:['uusi-tunti']}});
  if(url.pathname==='/upload/drive/v2/files'&&url.searchParams.get('uploadType')==='multipart'){
    // Moniosainen luonti: ensin JSON-metatiedot, sitten varsinainen XLSX-binääri
    // omalla Content-Type-otsikollaan ja tyhjällä rivillä. Binääri poimitaan
    // rajojemerkkien välistä, jotta tarkistus vertaa oikeita tavuja.
    const body=Buffer.from(await route.request().postDataBuffer());
    const id=body.subarray(0,body.indexOf(Buffer.from('\r\n'))).toString();
    const marker=Buffer.from('\r\n'+id);
    const first=body.indexOf(marker);
    const jsonStart=body.indexOf(Buffer.from('\r\n\r\n'),id.length)+4;
    const meta=String(body.subarray(jsonStart,first));
    assert.ok(meta.includes(`"title":"${filename}"`),'luotu tiedosto sai oikean nimen');
    const dataStart=body.indexOf(Buffer.from('\r\n\r\n'),first+marker.length)+4;
    const dataEnd=body.indexOf(Buffer.from('\r\n'+id+'--'),dataStart);
    assert.ok(dataEnd>dataStart,'valmiin tiedoston raja löytyi');
    creates++;remote=new Uint8Array(body.subarray(dataStart,dataEnd));
    return route.fulfill({json:file()});
  }
  throw new Error('Odottamaton pyyntö '+url.pathname);
});

await page.goto(base);
await page.evaluate(async()=>{
  const {initialState,steps}=await import('/lib/capture.ts');
  const {putStored}=await import('/lib/local-files.ts');
  const {writeLocal}=await import('/lib/local-capture.ts');
  const {ensurePeriod}=await import('/lib/period-files.ts');
  await putStored('setup:complete',true);
  await putStored('storage:choice',{mode:'browser',name:'Sovellusmuisti'});
  localStorage.setItem('ajolista:google-config',JSON.stringify({clientId:'test',pickerKey:'test',projectNumber:'123'}));
  await putStored('drive:folder',{id:'jaettu-kansio',name:'Ajolistat'});
  await ensurePeriod('hours','2026-09-01','Testi Testiajo');
  const s=initialState();s.name='Testi Testiajo';s.nameLocked=true;s.active='hours';
  Object.assign(s.drafts.hours.values,{vehicle:'ABC-123',date:'2026-09-01',start:'06:00',end:'15:00',startKm:'1000',endKm:'1050',waiting:'0',breakMinutes:'0',allowance:'0',foreignAllowance:'0',sick:'0',route:'Vantaa - Espoo'});
  s.drafts.hours.step=steps.hours.length;
  await writeLocal(s);
});
await page.reload();
await page.getByText('Vantaa - Espoo',{exact:false}).first().waitFor();

await page.getByRole('button',{name:'Tallenna puhelimeen'}).click();
await page.getByText('Tuntilista on tallessa tällä laitteella.',{exact:true}).waitFor();
assert.equal(lists,0,'mitään ei lähetetty ennen napin painallusta');

// 1) Ei tiedostoa kansiossa: nappi luo tuntilistan jaettavaan kansioon.
await page.getByRole('button',{name:'Lähetä Driveen'}).click();
await page.getByText('Tuntilista lähetetty jaettuun kansioon',{exact:false}).waitFor({timeout:120000});
assert.equal(creates,1,'tiedosto luotiin');assert.equal(uploads,0,'ei viedä vaan luodaan');
assert.ok(remote&&remote.length>5000,'kansioon ilmestyi oikean sisältöinen tiedosto');
const workbookLength=remote.length;

// 2) Samanniminen erilainen tiedosto: ei korvata ennen nimenomaista valintaa.
remote=new Uint8Array([0x09,0x09,0x09,0x09]);
await page.getByRole('button',{name:'Lähetä Driveen'}).click();
await page.getByText('Kansiossa on jo erilainen versio tästä tuntilistasta.',{exact:false}).waitFor({timeout:120000});
assert.equal(uploads,0,'erilaista versiota ei korvattu ilman valintaa');
await page.getByRole('button',{name:'Lähetä silti ja korvaa kansion version'}).click();
await page.getByText('Tuntilista korvattiin Drivessä',{exact:false}).waitFor({timeout:120000});
assert.equal(uploads,1,'korvaava lähetys tehtiin');assert.equal(remote.length,workbookLength,'kansion versio on nyt oma sisältö');

// 3) Sama sisältö jo Drivessä: mitään ei lähetetä uudelleen.
await page.getByRole('button',{name:'Lähetä Driveen'}).click();
await page.getByText('Tuntilista on jo Drivessä',{exact:false}).waitFor({timeout:120000});
assert.equal(uploads,1,'samaa sisältöä ei lähetetä toisen kerran');

// 4) Jaa: jakovalikko saa liitteenä oikean tiedoston.
await page.getByRole('button',{name:'Jaa',exact:true}).click();
await page.waitForFunction(()=>window.__shares&&window.__shares.length===1,{timeout:15000});
assert.deepEqual(await page.evaluate(()=>window.__shares[0].files),[filename],'jakovalikko sai tuntilistan liitteeksi');

// 5) Jaa ilman jakovalikkoa: tiedosto ladataan Tiedostot-kansioon.
await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});});
const download=page.waitForEvent('download');
await page.getByRole('button',{name:'Jaa',exact:true}).click();
assert.equal((await download).suggestedFilename(),filename,'varavalinta latasi tuntilistan');

// 6) Jakovalikko hylkää xlsx:n: Chrome antaa canShare:n ymmärtää tuen olevan olemassa,
//    mutta share hylkää NotAllowedError: 'Permission denied'. Silloin ladataan
//    Tiedostot-kansioon ja näytetään selkokielinen viesti, ei raakaa virhettä.
await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});window.__shareReject=true;});
const fallback=page.waitForEvent('download');
await page.getByRole('button',{name:'Jaa',exact:true}).click();
assert.equal((await fallback).suggestedFilename(),filename,'hylätty xlsx-jako laskeutuu lataukseksi');
await page.getByText('ladattiin Tiedostot-kansioon',{exact:false}).waitFor({timeout:15000});
assert.equal(await page.getByText('Permission denied',{exact:false}).count(),0,'raakaa hakkuvirhettä ei näytetä käyttäjälle');

assert.deepEqual(errors,[]);
await page.screenshot({path:'work/ui-hours-drive.png',fullPage:true});
await browser.close();
console.log('PASS browser: tuntilista lähtee Driveen (luonti/korvaus/jarjestys) ja Jaa (jakovalikko + latausvaravalinnat + xlsx-kielto)');