import {newDraft,validateDraft,type Draft} from './capture';
import {hoursDays,existingHoursDay} from './read-hours';
import {getStored,putStored,digest,type SavedWorkbook} from './local-files';
import {workbookName,fillWorkbook,EntryConflict} from './workbook-export';
export type HoursImport={date:string;filename:string;written:number;conflicts:string[];failed:{date:string;reason:string}[]};
const day=(d:string)=>{const draft=newDraft();draft.values.date=d;return draft;};
const keys=['vehicle','date','start','end','startKm','endKm','waiting','breakMinutes','allowance','foreignAllowance','sick','route'] as const;
const same=(a:Draft,b:Draft)=>a.overnight===b.overnight&&keys.every(k=>(a.values[k]||'')===(b.values[k]||''));
export async function importHours(bytes:Uint8Array,name:string,overwrite=false):Promise<HoursImport>{
  const dates=hoursDays(bytes,name);if(!dates.length)throw new Error('Tiedostossa ei ole aloitettuja päivärivejä. Valitse täytetty tuntilista.');
  const date=dates.slice().sort()[0],filename=workbookName('hours',date,name);
  const action=async():Promise<HoursImport>=>{
   const previous=await getStored<SavedWorkbook>(`workbook:${filename}`);
   const keep=async(result:HoursImport,merged:Uint8Array):Promise<HoursImport>=>{
    if(previous)await putStored(`backup:before-import:${filename}`,previous);
    await putStored(`workbook:${filename}`,{filename,bytes:merged,kind:'hours',updatedAt:new Date().toISOString(),savedToFolder:false} satisfies SavedWorkbook);
    // Imported working copy is authoritative until explicitly exported. Do not read an older folder file over it.
    await putStored(`imported:${filename}`,true);
    window.dispatchEvent(new Event('local-workbooks-changed'));return result;};
   // Nothing local yet: the file is a complete list, so keep it byte for byte.
    if(!previous)return keep({date,filename,written:dates.length,conflicts:[],failed:[]},bytes);
    if(await digest(previous.bytes)===await digest(bytes))return {date,filename,written:0,conflicts:[],failed:[]};
   // Day-wise merge. Days only the phone knows must survive, and a differing day is never
   // replaced silently: it is reported and the driver decides. Comparing parsed days instead
   // of file bytes keeps re-serialised XLSX from looking like a change.
   let merged=previous.bytes;let written=0;const conflicts:string[]=[],failed:{date:string;reason:string}[]=[];
   for(const d of dates){
    const wanted=existingHoursDay(bytes,day(d),name);
    if(!wanted){failed.push({date:d,reason:'Päivän riviä ei voitu lukea.'});continue;}
    const current=existingHoursDay(merged,day(d),name);
    if(current&&same(current,wanted))continue;
    // A started list may hold half-filled days. Name what is missing instead of
    // reporting a bare date the driver cannot act on.
    const problems=Object.values(validateDraft('hours',wanted)).filter((v,i,a)=>a.indexOf(v)===i);
    if(problems.length){failed.push({date:d,reason:problems.join(' ')});continue;}
    try{merged=fillWorkbook(merged,'hours',wanted,name,{fresh:false,overwrite}).bytes;written++;}
    catch(e){if(e instanceof EntryConflict)conflicts.push(d);else failed.push({date:d,reason:e instanceof Error?e.message:'Päivää ei voitu lisätä.'});}
   }
    if(!written&&!overwrite)return {date,filename,written,conflicts,failed};
    return keep({date,filename,written,conflicts,failed},merged);
  };
  return navigator.locks?navigator.locks.request(`ajolista:${filename}`,action):action();
}
