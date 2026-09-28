import type { CaptureState } from './capture';
const DB='ajolista-local-v2',STORE='state';
let opened:Promise<IDBDatabase>|undefined;
function database(){return opened??=new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>{opened=undefined;reject(req.error);};});}
// Nimi on tekstiä käytännössä joka paikassa, myös tiedostonimen muodostuksessa.
// Vanhasta tai vioittuneesta tallenteesta tullut muu arvo muunnetaan merkki-
// jonaksi, jottei koko kirjausnäkymä kaadu muunnuksen virheeseen.
function saneName(value:unknown){return typeof value==='string'?value:'';}
export async function readLocal(){const db=await database();return new Promise<CaptureState|null>((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get('profile');req.onsuccess=()=>{const value=req.result;if(value&&value.version!==2){reject(new Error('Tallennetun luonnoksen versiota ei tunnisteta.'));return;}resolve(value?{...value,name:saneName(value.name)}:null);};req.onerror=()=>reject(req.error);});}
export async function writeLocal(value:CaptureState){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite',{durability:'strict'});tx.objectStore(STORE).put(value,'profile');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Tallennus keskeytyi.'));});}
