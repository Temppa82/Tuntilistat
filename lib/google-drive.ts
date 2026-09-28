import { getStored, putStored } from './local-files';
// Browser identifiers, not client secrets. Restrict the API key to this app and Google Picker in Cloud Console.
export type GoogleConfig={clientId:string;pickerKey:string;projectNumber:string};
export function googleConfig():GoogleConfig {try{return JSON.parse(localStorage.getItem('ajolista:google-config')||'null')||{clientId:'',pickerKey:'',projectNumber:''};}catch{return {clientId:'',pickerKey:'',projectNumber:''};}}
export function storeGoogleConfig(config:GoogleConfig){localStorage.setItem('ajolista:google-config',JSON.stringify(config));}
export function saveGoogleConfig(config:GoogleConfig){storeGoogleConfig(config);disconnect();}
const SCOPE='https://www.googleapis.com/auth/drive';
export const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export type DriveFolder={id:string;name:string};
export type DriveFile={id:string;title:string;mimeType:string;etag:string;version:string;parents?:{id:string}[];editable?:boolean};
type TokenResponse={access_token?:string;expires_in?:number;error?:string};
type PickerResult={action:string;docs?:{id:string;name:string;mimeType:string}[]};
type PickerBuilder={addView(v:unknown):PickerBuilder;setOAuthToken(t:string):PickerBuilder;setDeveloperKey(t:string):PickerBuilder;setAppId(t:string):PickerBuilder;setOrigin(t:string):PickerBuilder;setLocale(t:string):PickerBuilder;setCallback(cb:(r:PickerResult)=>void):PickerBuilder;build():{setVisible(v:boolean):void;dispose():void}};
type DocsView={setIncludeFolders(v:boolean):DocsView;setSelectFolderEnabled(v:boolean):DocsView;setMimeTypes(v:string):DocsView};
type GoogleWindow=Window&{google?:{accounts:{oauth2:{initTokenClient(config:{client_id:string;scope:string;callback:(r:TokenResponse)=>void;error_callback:()=>void}):{requestAccessToken(options:{prompt:string}):void}}};picker:{DocsView:new()=>DocsView;PickerBuilder:new()=>PickerBuilder}};gapi?:{load(name:string,options:{callback:()=>void;onerror:()=>void;timeout:number;ontimeout:()=>void}):void}};
let accessToken='',expiresAt=0,loaded:Promise<void>|undefined;
function script(src:string){return new Promise<void>((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.async=true;el.onload=()=>resolve();el.onerror=()=>{el.remove();reject(new Error('Google-yhteyttä ei voitu ladata. Tarkista verkkoyhteys.'));};document.head.appendChild(el);});}
export function prepareGoogle(){const c=googleConfig();if(!c.clientId||!c.pickerKey||!c.projectNumber)return Promise.reject(new Error('Täytä Google-asetukset ensin. Paikallinen tallennus toimii ilman Googlea.'));return loaded??=Promise.all([script('https://accounts.google.com/gsi/client'),script('https://apis.google.com/js/api.js')]).then(()=>new Promise<void>((resolve,reject)=>{(window as GoogleWindow).gapi!.load('picker',{callback:resolve,onerror:()=>reject(new Error('Google Picker ei käynnistynyt.')),timeout:15000,ontimeout:()=>reject(new Error('Google Pickerin lataus aikakatkaistiin.'))});})).catch(e=>{loaded=undefined;throw e;});}
export function connected(){return !!accessToken&&Date.now()<expiresAt;}
export function googlePrepared(){return !!loaded;}
export function disconnect(){accessToken='';expiresAt=0;window.dispatchEvent(new Event('drive-connection-changed'));}
export function connectGoogle(){
 return new Promise<void>((resolve,reject)=>{
  const google=(window as GoogleWindow).google;if(!google)return reject(new Error('Odota Google-yhteyden latautumista.'));
   google.accounts.oauth2.initTokenClient({client_id:googleConfig().clientId,scope:SCOPE,error_callback:()=>reject(new Error(`Google hylkäsi kirjautumisen. Lisää sivun osoite ${location.origin} Cloud Consolessa OAuth-asiakkaan JavaScript-lähteisiin.`)),callback:r=>{
   if(r.error||!r.access_token)return reject(new Error('Google ei myöntänyt Drive-käyttöoikeutta.'));
   accessToken=r.access_token;expiresAt=Date.now()+((r.expires_in||3600)-60)*1000;window.dispatchEvent(new Event('drive-connection-changed'));resolve();
  }}).requestAccessToken({prompt:'select_account'});
 });
}
export function selectDriveFolder(){return new Promise<DriveFolder>((resolve,reject)=>{
 if(!connected())return reject(new Error('Yhdistä ensin Google-tili.'));
 const picker=(window as GoogleWindow).google!.picker;
 const view=new picker.DocsView().setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes('application/vnd.google-apps.folder');
 const config=googleConfig();
 const dialog=new picker.PickerBuilder().addView(view).setOAuthToken(accessToken).setDeveloperKey(config.pickerKey).setAppId(config.projectNumber).setOrigin(location.origin).setLocale('fi').setCallback(data=>{
  if(data.action==='cancel')return settle(()=>reject(new DOMException('Peruttu','AbortError')));
  if(data.action==='picked'){const doc=data.docs?.[0];if(!doc||doc.mimeType!=='application/vnd.google-apps.folder')return settle(()=>reject(new Error('Valitse kansio, ei tiedosto.')));settle(()=>resolve({id:doc.id,name:doc.name}));}
 }).build();
 // Valinta on Googlen oma ikkuna, jonka callback ei aina palaa: ilman vartijata painike jäisi
 // pysyvästi "Odota…"-tilaan. Vartija sulkee dialogin ja vapauttaa käyttöliittymän.
 let open=true;
 const timer=window.setTimeout(()=>{open=false;dialog.dispose();reject(new Error('Kansiovalinta ei vastannut. Liitä kansion linkki kenttään sen sijaan.'));},90000);
 function settle(fn:()=>void){if(!open)return;open=false;window.clearTimeout(timer);dialog.dispose();fn();}
 dialog.setVisible(true);
});}
const ID=/^[-A-Za-z0-9_]{20,}$/;
/** Hyväksyy kansion tunnuksen tai minkä tahansa Drive-linkin, josta tunnus löytyy. */
export function parseDriveFolderId(value:string){
 const text=value.trim();
 if(!text)throw new Error('Liitä jaetun kansion linkki tai tunnus.');
 if(ID.test(text))return text;
 const id=text.split(/[/?#&=]+/).find(p=>ID.test(p));
 if(!id)throw new Error('Kansion tunnusta ei tunnistettu. Liitä kansion linkki Driveista.');
 return id;
}
/** Varmistaa käsin liitetyn kansion oikeaksi kansioksi ja kirjoitettavaksi, lukien vain metatiedot. */
export async function readDriveFolder(value:string){
 if(!connected())throw new Error('Yhdistä Google-tili ensin.');
 const response=await driveRequest(`/drive/v2/files/${encodeURIComponent(parseDriveFolderId(value))}?fields=id,title,mimeType,capabilities(canAddChildren)&supportsAllDrives=true&includeItemsFromAllDrives=true`,{},'kansio');
 const data=await response.json() as {id:string;title?:string;mimeType?:string;capabilities?:{canAddChildren?:boolean}};
 if(data.mimeType!=='application/vnd.google-apps.folder')throw new Error('Antamasi linkki ei ole kansio. Valitse kansio, jossa ajolista sijaitsee.');
 if(data.capabilities?.canAddChildren===false)throw new Error('Sinulla ei ole oikeutta lisätä tiedostoja tähän kansioon.');
 return {id:data.id,name:data.title||'Jaettu kansio'};
}
export function savedDriveFolder(){return getStored<DriveFolder>('drive:folder');}
export async function setDriveFolder(folder:DriveFolder){await putStored('drive:folder',folder);window.dispatchEvent(new Event('drive-connection-changed'));}
export class DriveConflict extends Error {
 etag?:string;
 constructor(phase='tallennus',etag?:string){super(`Jaettu ajolista muuttui samaan aikaan (${phase}). Yritä synkronointia uudelleen.`);this.name='DriveConflict';this.etag=etag;}
}
export async function driveRequest(path:string,options:RequestInit={},phase='tallennus'){
 if(!connected())throw new Error('Google-yhteys on vanhentunut. Yhdistä Google uudelleen asetuksissa.');
 if(!/^\/(?:upload\/)?drive\/v[23]\//.test(path))throw new Error('Virheellinen Google-pyyntö.');
 const response=await fetch('https://www.googleapis.com'+path,{...options,headers:{...Object.fromEntries(new Headers(options.headers)),Authorization:`Bearer ${accessToken}`}});
 if(response.status===401){disconnect();throw new Error('Google-yhteys on vanhentunut. Yhdistä uudelleen asetuksissa.');}
 if(response.status===412)throw new DriveConflict(phase);
 if(!response.ok)throw new Error(response.status===403?'Google esti toiminnon. Tarkista kansion muokkausoikeus ja Drive API:n käyttöönotto.':`Drive-pyyntö epäonnistui (${response.status}). Paikalliset tiedot ovat tallessa.`);
 return response;
}
const quote=(s:string)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
export async function findDriveWorkbook(folderId:string,filename:string){
 const q=`'${quote(folderId)}' in parents and trashed = false and (title = '${quote(filename)}' or title = '${quote(filename.replace(/\.xlsx$/,''))}')`;
 const response=await driveRequest('/drive/v2/files?'+new URLSearchParams({q,fields:'items(id,title,mimeType,etag,version,parents(id),editable),nextPageToken',maxResults:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true'}));
 const data=await response.json() as {items:DriveFile[];nextPageToken?:string};
 if(data.items.length>1||data.nextPageToken)throw new Error('Kansiossa on useita samannimisiä ajolistoja. Tarkista tiedostot ennen synkronointia.');
 return data.items[0];
}
export async function downloadDriveWorkbook(file:DriveFile){
 if(file.mimeType!==XLSX_MIME)throw new Error('Valittu ajolista on Googlen omassa taulukkomuodossa. Tämä synkronointi tarvitsee alkuperäisen .xlsx-ajolistan; mitään ei korvattu.');
 if(file.editable===false)throw new Error('Sinulla ei ole ajolistan muokkausoikeutta.');
 // The media endpoint compares If-Match against the content ETag, not against the metadata ETag
 // that files.list returns, so a precondition here is refused on every sync. Read plainly;
 // the atomic guard belongs on the write, where it still closes the read-modify-write race.

 const response=await driveRequest(`/drive/v2/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`,{},'lataus');
 return new Uint8Array(await response.arrayBuffer());
}
export async function driveFileEtag(fileId:string){
 const response=await driveRequest(`/drive/v2/files/${encodeURIComponent(fileId)}?fields=id,etag,version&supportsAllDrives=true`);
 const data=await response.json() as {etag?:string;version?:string};
 if(!data.etag)throw new Error('Ajolistan version tarkistus puuttuu. Tiedostoa ei korvata.');
 return {etag:data.etag,version:data.version};
}

export async function uploadDriveWorkbook(file:DriveFile,bytes:Uint8Array){
 // Prefer the ETag that files.get reports over the one files.list happened to include, because
 // only the former is guaranteed to be the value the media endpoint compares against. When Drive
 // reports none, driveFileEtag refuses before anything is written.
 const {etag}=await driveFileEtag(file.id);

 try{
  await driveRequest(`/upload/drive/v2/files/${encodeURIComponent(file.id)}?uploadType=media&supportsAllDrives=true`,{method:'PUT',headers:{'Content-Type':XLSX_MIME,'If-Match':etag},body:new Uint8Array(bytes)},'kirjoitus');
 }catch(e){if(e instanceof DriveConflict)e.etag=etag;throw e;}
}
export async function createDriveWorkbook(folderId:string,filename:string,bytes:Uint8Array){
 // Persist a pre-generated ID so a lost response can be retried without another file.
 const key=`drive:new:${folderId}:${filename}`;
 let id=await getStored<string>(key);
 if(!id){const response=await driveRequest('/drive/v3/files/generateIds?count=1&space=drive&type=files',{},'luonti');id=((await response.json()) as {ids:string[]}).ids[0];await putStored(key,id);}
 // Drive has no atomic "create only if filename absent". Recheck before creating;
 // duplicate names are detected after creation and never silently consolidated.
 if(await findDriveWorkbook(folderId,filename))throw new DriveConflict();
 const boundary='ajolista_'+crypto.randomUUID();
 const metadata={id,title:filename,mimeType:XLSX_MIME,parents:[{id:folderId}]};
 const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\n\r\n`,new Uint8Array(bytes),`\r\n--${boundary}--`]);
 let response:Response;
 try{response=await driveRequest('/upload/drive/v2/files?uploadType=multipart&supportsAllDrives=true',{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body},'luonti');}
 catch(error){if(await findDriveWorkbook(folderId,filename))throw new DriveConflict();throw error;}
 return await response.json() as DriveFile;
}
