import {chromium} from 'file:///C:/Users/teemu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext({acceptDownloads:true});let page=await context.newPage();
await page.goto('http://127.0.0.1:5175');await page.evaluate(()=>navigator.serviceWorker.ready);
await page.evaluate(async (bytes)=>{
 async function put(dbName,store,key,value){const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore(store);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}
 const draft=()=>({id:crypto.randomUUID(),step:12,updatedAt:new Date().toISOString(),overnight:false,values:Object.fromEntries(['vehicle','date','start','startKm','end','endKm','waiting','breakMinutes','allowance','foreignAllowance','sick','loadingHours','stops','route'].map(k=>[k,'']))});
 const h=draft();Object.assign(h.values,{date:'2025-03-10',sick:'1',allowance:'0',foreignAllowance:'0',route:'Testipäivä'});const p=draft();p.values.date='2026-09-25';
 await put('ajolista-files-v1','files','setup:complete',true);await put('ajolista-files-v1','files','storage:choice',{mode:'browser',name:'Sovellusmuisti'});await put('ajolista-files-v1','files','imported:Tuntilista Testi0325.xlsx',true);
 await put('ajolista-files-v1','files','workbook:Tuntilista Testi0325.xlsx',{filename:'Tuntilista Testi0325.xlsx',kind:'hours',bytes:new Uint8Array(bytes),savedToFolder:false});
 await put('ajolista-local-v2','state','profile',{version:2,name:'Testi Testiajo',nameLocked:true,active:'hours',drafts:{hours:h,pamark:p},cities:{},vehicleSettings:{}});
},[...readFileSync('work/listat-fixtures/Tuntilista Ajuri.xlsx')]);
await page.reload();await page.getByRole('button',{name:'Tallenna puhelimeen',exact:true}).click();await page.getByText('Tuntilista on tallessa tällä laitteella.',{exact:true}).waitFor();
const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Vie XLSX laitteen Tiedostot-kansioon'}).click();const download=await downloaded;assert.equal(download.suggestedFilename(),'Tuntilista Testi0325.xlsx');await download.saveAs('work/browser-export.xlsx');
const reopened=await context.newPage();await page.close();await context.setOffline(true);page=reopened;await page.goto('http://127.0.0.1:5175');await page.locator('.capture-review').waitFor();assert.ok((await page.locator('.capture-review').innerText()).includes('Testipäivä'));
assert.ok(await page.evaluate(()=>!!navigator.serviceWorker.controller));await browser.close();console.log('PASS production browser: actual hours copy new day save, XLSX download, offline close/reopen with service worker and retained entry');

