import {normalizeVehicle,type Draft} from './capture';
import {getStored,putStored,sharedDirectory,permit,readWorkbook,writeWorkbook,type SavedWorkbook} from './local-files';
import {loadTemplate} from './templates';
import {applyVehicles,fleet} from './vehicle-settings';
import {fillWorkbook,workbookName,EntryConflict,emptyWorkbook} from './workbook-export';
import {connected,savedDriveFolder,findDriveWorkbook,downloadDriveWorkbook,uploadDriveWorkbook,createDriveWorkbook,DriveConflict} from './google-drive';
import {pamarkDayList} from './read-pamark';
export type SyncJob={id:string;draft:Draft;name:string;folderId?:string;filename:string;status:'pending'|'synced'|'error';message?:string;updatedAt:string;confirmedBase?:string;force?:boolean};
import {XlsxDocument} from './xlsx-document';
import {pamarkFingerprint} from './pamark-target';
import {verifySharedMerge} from './shared-verify';
export function mergePamarkJob(source:Uint8Array,job:SyncJob):Uint8Array {
 // A confirmed sync is a newer base than the fingerprint the draft was opened with, so a day that
 // moved on in Drive is still recognised as this driver's own row rather than someone else's.
 // An explicitly pushed job (force) is the driver's own row anyway: the lookup is already limited
 // to the same vehicle and date, which only this driver fills. Confirmation makes that forward.
 const base=job.confirmedBase??job.draft.pamarkBase;
 let merged:Uint8Array;
 try{merged=fillWorkbook(source,'pamark',job.draft,job.name,{fresh:false,shared:true}).bytes;}
 catch(e){
  if(!(e instanceof EntryConflict))throw e;
  const current=pamarkFingerprint(new XlsxDocument(source).snapshot(),job.draft.values.vehicle,job.draft.values.date);
  if(!job.force&&(base===undefined||current!==base))throw new EntryConflict(e.diffs);
  merged=fillWorkbook(source,'pamark',job.draft,job.name,{fresh:false,overwrite:true,shared:true}).bytes;
 }
 verifySharedMerge(source,merged,job.draft.values.vehicle,job.draft.values.date);
 return merged;
}
export async function forcePendingJobs(date:string,vehicle:string){
 const folder=await savedDriveFolder();if(!folder)return 0;
 const lockedFn=()=>locked(async()=>{const jobs=await syncJobs();let n=0;for(const [id,j] of Object.entries(jobs)){if(j.folderId===folder.id&&j.status!=='synced'&&j.draft.values.date===date&&normalizeVehicle(j.draft.values.vehicle)===normalizeVehicle(vehicle)){jobs[id]={...j,force:true};n++;}}if(n)await putStored(KEY,jobs);return n;});
 const pushed=await lockedFn();if(pushed)syncChanged();return pushed;
}
const KEY='drive:jobs';
export const syncChanged=()=>window.dispatchEvent(new Event('pamark-sync-changed'));

/**
 * Päivittää oman kopion ja paikallisen kansion vientin jaetun tiedoston yhdistetystä
 * sisällöstä, jotta molemmat ovat samat. Jos kansiota ei voi kirjoittaa, sovelluksen
 * kopio päivittyy silti ja seuraava tallennus huomaa eron eikä korvaa kansiota.
 */
async function mirrorLocalWorkbook(filename:string,bytes:Uint8Array){
 const record:SavedWorkbook={filename,bytes,updatedAt:new Date().toISOString(),kind:'pamark',savedToFolder:false};
 const operation=async()=>{
  const dir=await getStored<boolean>(`imported:${filename}`)?undefined:await sharedDirectory().catch(()=>undefined);
  if(dir)try{await permit(dir);record.savedToFolder=await writeWorkbook(dir,filename,bytes,await readWorkbook(dir,filename));}catch{record.savedToFolder=false;}
  await putStored(`workbook:${filename}`,record);
 };
 if(navigator.locks)await navigator.locks.request(`ajolista:${filename}`,operation);else await operation();
 window.dispatchEvent(new Event('local-workbooks-changed'));
}
export async function syncJobs(){return await getStored<Record<string,SyncJob>>(KEY)||{};}
async function locked<T>(fn:()=>Promise<T>){return navigator.locks?navigator.locks.request('pamark-job-store',fn):fn();}
async function saveJob(job:SyncJob,expectedVersion?:string){await locked(async()=>{const jobs=await syncJobs();if(expectedVersion&&jobs[job.id]?.updatedAt!==expectedVersion)return;jobs[job.id]=job;await putStored(KEY,jobs);});syncChanged();}
export async function enqueuePamark(draft:Draft,name:string,options?:{force?:boolean}){
 const folder=await savedDriveFolder();
 await locked(async()=>{
  const jobs=await syncJobs();
  draft=structuredClone(draft);
  const matches=Object.values(jobs).filter(j=>j.folderId===folder?.id&&j.draft.values.date===draft.values.date&&normalizeVehicle(j.draft.values.vehicle)===normalizeVehicle(draft.values.vehicle));
  const previous=matches.find(j=>j.status!=='synced')||matches.find(j=>j.id===draft.id);
  if(previous?.status==='synced'&&previous.id===draft.id&&previous.confirmedBase)draft.pamarkBase=previous.confirmedBase;
   else if(previous&&previous.status!=='synced'&&draft.pamarkBase===undefined)draft.pamarkBase=previous.draft.pamarkBase;
  for(const [id,j] of Object.entries(jobs))if(id!==draft.id&&j.folderId===folder?.id&&j.draft.values.date===draft.values.date&&normalizeVehicle(j.draft.values.vehicle)===normalizeVehicle(draft.values.vehicle)&&j.status!=='synced')delete jobs[id];
  jobs[draft.id]={id:draft.id,draft:structuredClone(draft),name,folderId:folder?.id,filename:workbookName('pamark',draft.values.date,name),status:'pending',updatedAt:new Date().toISOString(),force:options?.force||undefined};
  await putStored(KEY,jobs);
 });syncChanged();
}
 // Rinnakkainen painallus jakaa saman ajon, ja lähetetty määrä palautuu molemmille.
 let syncing:Promise<number>|undefined;
export type SharedListCheck={filename:string;exists:boolean;days:number;vehicles:string[];size:number};

/**
 * Lukee jaetun kansion ajolistan kirjoittamatta siihen mitään. Varmistaa
 * käyttöoikeudet, tiedoston löytymisen ja sen, että tiedosto aukeaa, ennen kuin
 * mitään lähetetään. Jaettu tiedosto sisältää myös muiden kuljettajien rivit,
 * joten autot ja päivät luetaan suoraan tiedoston sisällöstä.
 */
export async function checkSharedList(folderId:string,date:string,name:string):Promise<SharedListCheck>{
 if(!connected())throw new Error('Yhdistä Google-tili ensin.');
 const filename=workbookName('pamark',date,name);
 const file=await findDriveWorkbook(folderId,filename);
 if(!file)return {filename,exists:false,days:0,vehicles:[],size:0};
 const bytes=await downloadDriveWorkbook(file);
 const days=pamarkDayList(bytes);
 return {filename,exists:true,days:days.length,vehicles:[...new Set(days.map(d=>d.label))].sort(),size:bytes.length};
}

export function flushPamark(){return syncing??=flush().finally(()=>{syncing=undefined;});}
 async function flush(){
  if(!connected())throw new Error('Yhdistä Google-tili asetuksissa. Kirjaukset odottavat tällä laitteella.');
  const folder=await savedDriveFolder();if(!folder)throw new Error('Valitse jaettu Drive-kansio asetuksissa.');
  const template=await loadTemplate('pamark');
  const jobs=Object.values(await syncJobs()).filter(j=>j.status!=='synced').sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt));
  let sent=0;
  for(const job of jobs){
   if(job.folderId&&job.folderId!==folder.id)continue;
  job.folderId=folder.id;
  try{
    let refused='';for(let attempt=0;attempt<3;attempt++){
    try{
     const file=await findDriveWorkbook(folder.id,job.filename);
     const source=file?await downloadDriveWorkbook(file):applyVehicles(emptyWorkbook(template.bytes,'pamark',job.draft.values.date,job.name),await fleet(),true);
     const result={bytes:mergePamarkJob(source,job)};
     
     if(file)await uploadDriveWorkbook(file,result.bytes);else{
      // A second lookup narrows the first-file creation window and catches a concurrent creator.
      if(await findDriveWorkbook(folder.id,job.filename))throw new DriveConflict();
      await createDriveWorkbook(folder.id,job.filename,result.bytes);
     }
      const confirmed=await findDriveWorkbook(folder.id,job.filename);
      if(!confirmed)throw new Error('Drive-tallennusta ei voitu vahvistaa. Yritä uudelleen.');
      // Reapplying without overwrite must be idempotent; this verifies the saved day's actual cells.
      const verified=await downloadDriveWorkbook(confirmed);
      fillWorkbook(verified,'pamark',job.draft,job.name,{fresh:false,shared:true});
      job.confirmedBase=pamarkFingerprint(new XlsxDocument(verified).snapshot(),job.draft.values.vehicle,job.draft.values.date);
      await mirrorLocalWorkbook(job.filename,verified);
      break;
     }catch(e){
      if(!(e instanceof DriveConflict)||attempt>=2)throw e;
      // A real concurrent edit changes the ETag, so the retry reads a new one. The same ETag
      // refused twice means Drive will not accept this precondition at all, and another try
      // with it cannot help. Report that instead of looping.
      if(e.etag&&e.etag===refused)throw new Error('Google hylkäsi saman version ehdon kahdesti peräkkäin. Ajolistaa ei muutettu, ja kirjaus säilyi puhelimella.');
      refused=e.etag||'';
     }
   }
    sent++;
    await saveJob({...job,status:'synced',message:'Tallennettu ja tarkistettu Drivessä.'},job.updatedAt);
   }catch(e){const message=e instanceof Error?e.message:'Synkronointi epäonnistui.';await saveJob({...job,status:'error',message},job.updatedAt);if(e instanceof Error)throw e;throw new Error(message);}
  }
  // Nappi kertoo kappaleen, joten lähetetty määrä palautuu sille tiedoston tilan lukemiseen jälkeen.
  return sent;
 }
