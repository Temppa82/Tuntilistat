import {type Draft,normalizeVehicle,localDate,validDate} from './capture';
import {workbookName} from './workbook-export';
import {ensurePeriod} from './period-files';
import {XlsxDocument} from './xlsx-document';
import {findPamarkTarget,findVehicleHeader,pamarkFingerprint} from './pamark-target';
export type OpenedPamark={filename:string;bytes?:Uint8Array;message:string;source:'drive'|'local'|'draft';folderId?:string;excluded?:boolean};
const inFlight=new Map<string,Promise<OpenedPamark>>();
// Shared syncing is parked. The list is read and written as one local file, so opening a
// day can no longer fail on a network call and never needs a pending-entry merge.
export function openPamark(date:string,name:string):Promise<OpenedPamark>{
  const key=date+'|'+name;const existing=inFlight.get(key);if(existing)return existing;
  const promise=open(date,name).finally(()=>inFlight.delete(key));inFlight.set(key,promise);return promise;
}
async function open(date:string,name:string):Promise<OpenedPamark>{
 if(!validDate(date)||date>localDate())throw new Error('Valitse kelvollinen päivämäärä, joka ei ole tulevaisuudessa.');
 const filename=workbookName('pamark',date,name);
 // No lock of our own here: ensurePeriod already locks this exact filename, and nesting
 // the same lock name would deadlock instead of serialising.
 const record=await ensurePeriod('pamark',date,name);
 if(!record.bytes)throw new Error('Ajolistaa ei voitu avata.');
 return {filename:record.filename,bytes:record.bytes,source:'local',message:record.created?'Uusi ajolista luotiin tälle jaksolle. Täytä päivät tai tuo valmis ajolista.':'Ajolista avattu tältä laitteelta.'};
}
export function existingPamarkDay(bytes:Uint8Array,draft:Draft):Draft|undefined{
  if(!draft.values.vehicle)return;const s=new XlsxDocument(bytes).snapshot();if(!findVehicleHeader(s,draft.values.vehicle))return;const t=findPamarkTarget(s,draft.values.vehicle,draft.values.date,false);if(!t.existing)return;
  const value=(c:string)=>s[`${c}${t.row}`]?.value;
  const time=(v:unknown)=>{if(typeof v==='string'&&/^\d{1,2}:\d{2}$/.test(v))return v.padStart(5,'0');if(typeof v!=='number'||!Number.isFinite(v))return '';const mins=Math.round(v*1440)%1440;return `${Math.floor(mins/60).toString().padStart(2,'0')}:${(mins%60).toString().padStart(2,'0')}`;};
  const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?String(v):'';
  const loading=value('H');const textTime=typeof loading==='string'&&/^\d{1,2}:\d{2}$/.test(loading)?Number(loading.split(':')[0])+Number(loading.split(':')[1])/60:undefined;
  return {...draft,pamarkBase:pamarkFingerprint(s,draft.values.vehicle,draft.values.date),updatedAt:new Date().toISOString(),overnight:typeof value('C')==='number'&&Number(value('C'))>=1,values:{...draft.values,vehicle:normalizeVehicle(draft.values.vehicle),start:time(value('B')),end:time(value('C')),startKm:num(value('D')),endKm:num(value('E')),loadingHours:typeof loading==='number'?String(Math.round(loading*24*1000)/1000):textTime===undefined?'':String(textTime),stops:num(value('K')),route:String(s[`A${t.row+1}`]?.value||'').replace(/^Reitti:\s*/i,'')}};
}
export function pristineDay(draft:Draft){return !['start','end','startKm','endKm','loadingHours','stops','route'].some(k=>draft.values[k as keyof Draft['values']]);}
