import type { ListKind } from './capture';
type Directory = FileSystemDirectoryHandle & { requestPermission(options: {mode:'readwrite'}): Promise<string> };
type PickerWindow = Window & { showDirectoryPicker?: (options:{mode:'readwrite';id:string})=>Promise<Directory> };
export type SavedWorkbook = { filename:string; bytes:Uint8Array; updatedAt:string; kind:ListKind; savedToFolder:boolean };
let database: Promise<IDBDatabase> | undefined;
function db() { return database ??= new Promise((resolve,reject)=>{
  const request=indexedDB.open('ajolista-files-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('files');
  request.onsuccess=()=>resolve(request.result); request.onerror=()=>{database=undefined;reject(request.error);};
}); }
export async function getStored<T>(key:string):Promise<T|undefined> {
  const database=await db(); return new Promise((resolve,reject)=>{
    const request=database.transaction('files','readonly').objectStore('files').get(key);
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
export async function putStored(key:string,value:unknown) {
  const database=await db();return new Promise<void>((resolve,reject)=>{
    const tx=database.transaction('files','readwrite',{durability:'strict'});tx.objectStore('files').put(value,key);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Tallennus keskeytyi.'));
  });
}
export async function deleteStored(key:string) {
  const database=await db();return new Promise<void>((resolve,reject)=>{
    const tx=database.transaction('files','readwrite',{durability:'strict'});tx.objectStore('files').delete(key);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Poisto keskeytyi.'));
  });
}
export async function savedWorkbooks():Promise<SavedWorkbook[]> {
 const database=await db();return new Promise((resolve,reject)=>{
  const request=database.transaction('files','readonly').objectStore('files').openCursor();const files:SavedWorkbook[]=[];
  request.onsuccess=()=>{const cursor=request.result;if(!cursor){resolve(files.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));return;}if(String(cursor.key).startsWith('workbook:'))files.push(cursor.value);cursor.continue();};request.onerror=()=>reject(request.error);
 });
}
export function supportsFolders(){return typeof (window as PickerWindow).showDirectoryPicker==='function';}
export async function chooseFolder(kind:ListKind) {
  const picker=(window as PickerWindow).showDirectoryPicker;
  if(!picker)throw new Error('Tässä selaimessa tiedosto tallennetaan latauksena.');
  const dir=await picker({mode:'readwrite',id:`ajolista-${kind}`});
  await putStored(`folder:${kind}`,dir);return dir;
}
export async function directory(kind:ListKind){return getStored<Directory>(`folder:${kind}`);}
export type StorageChoice={mode:'folder'|'browser';name:string};
export async function chooseSharedFolder(){
 const picker=(window as PickerWindow).showDirectoryPicker;if(!picker)throw new Error('Selain ei tue pysyvää kansiovalintaa.');
 const dir=await picker({mode:'readwrite',id:'ajolista-shared'});
 await putStored('folder:shared',dir);await putStored('storage:choice',{mode:'folder',name:dir.name} satisfies StorageChoice);return dir;
}
export async function sharedDirectory(){const choice=await getStored<StorageChoice>('storage:choice');return choice?.mode==='folder'?getStored<Directory>('folder:shared'):undefined;}
const unavailable=new WeakSet<Directory>();
function permissionError(error:unknown){return error instanceof Error&&['NotAllowedError','SecurityError','NotSupportedError'].includes(error.name);}
async function useBrowserStorage(dir:Directory){
 unavailable.add(dir);
 await putStored('storage:choice',{mode:'browser',name:'Sovellusmuisti'} satisfies StorageChoice);
}
export async function permit(dir:Directory){
 if(unavailable.has(dir))return;
 try {if(await dir.requestPermission({mode:'readwrite'})!=='granted')await useBrowserStorage(dir);}
 catch(error){if(!permissionError(error))throw error;await useBrowserStorage(dir);}
}
export async function readWorkbook(dir:Directory,filename:string) {
  if(unavailable.has(dir))return undefined;
  try {const file=await(await dir.getFileHandle(filename)).getFile();return new Uint8Array(await file.arrayBuffer());}
  catch(error){if(error instanceof DOMException&&error.name==='NotFoundError')return undefined;if(permissionError(error)){await useBrowserStorage(dir);return undefined;}throw error;}
}
export async function digest(bytes:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
export async function writeWorkbook(dir:Directory, filename:string, bytes:Uint8Array, baseline?:Uint8Array) {
  if(unavailable.has(dir))return false;
  try {
  // Re-read immediately before replacing. Never overwrite a file changed since preparation.
  const latest=await readWorkbook(dir,filename);
  if(unavailable.has(dir))return false;
  if((!!latest!==!!baseline)||(latest&&baseline&&await digest(latest)!==await digest(baseline)))throw new Error('Tiedosto muuttui tallennuksen aikana. Yritä uudelleen, jotta muiden kirjaukset säilyvät.');
  if(unavailable.has(dir))return false;
  const handle=await dir.getFileHandle(filename,{create:true}), writer=await handle.createWritable();
  try {await writer.write(new Uint8Array(bytes));await writer.close();}catch(error){await writer.abort().catch(()=>{});throw error;}
  const saved=await readWorkbook(dir,filename);
  if(unavailable.has(dir))return false;
  if(!saved||await digest(saved)!==await digest(bytes))throw new Error('Tallennetun tiedoston tarkistus epäonnistui. Luonnos säilyy.');
  return true;
  }catch(error){if(!permissionError(error))throw error;await useBrowserStorage(dir);return false;}
}
export function downloadWorkbook(filename:string,bytes:Uint8Array){
  const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
// Avaa puhelimen jakovalikon (sähköposti, WhatsApp jne.) liitteenä olevalla XLSX-tiedostolla.
// Monet selaimet rajoittavat jaettavat tiedostotyypit kuviin, videoihin, ääneen, PDF:ään ja
// tiettyihin tekstitiedostoihin: xlsx ei kelpaa, vaikka canShare antaisi ymmärtää toisin.
// Silloin (tai jos jakovalikkoa ei ole) tiedosto ladataan Tiedostot-kansioon, jotta käyttäjä
// voi liittää sen itse. Peruutus on ainoa sivallisuus, joka ei lataa mitään.
export async function shareWorkbook(filename:string,bytes:Uint8Array):Promise<'shared'|'aborted'|'downloaded'>{
  const type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const shareFile=new File([new Uint8Array(bytes)],filename,{type});
  const withShare=navigator as Navigator&{share?:{({files,title}:{files:File[];title?:string}):Promise<void>};canShare?:(data:{files:File[]})=>boolean};
  if(!withShare.share||!withShare.canShare||!withShare.canShare({files:[shareFile]})){downloadWorkbook(filename,new Uint8Array(bytes));return 'downloaded';}
  try{await withShare.share({files:[shareFile],title:filename});return 'shared';}
  catch(e){if(e instanceof DOMException&&e.name==='AbortError')return 'aborted';downloadWorkbook(filename,new Uint8Array(bytes));return 'downloaded';}
}
