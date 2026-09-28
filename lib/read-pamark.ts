import {newDraft,type Draft} from './capture';
import {XlsxDocument} from './xlsx-document';
import {pamarkDays,type PamarkDay} from './pamark-target';
export type {PamarkDay};
export {pamarkDays};
// All stored days of an ajolista, newest period first, grouped per vehicle by the sheet order.
export function pamarkDayList(bytes:Uint8Array):PamarkDay[]{
  return pamarkDays(new XlsxDocument(bytes).snapshot()).sort((a,b)=>a.headerRow-b.headerRow||a.row-b.row);
}
export function pamarkDayKey(d:PamarkDay){return `${d.vehicle}|${d.date}`;}
const emptyDraft=(day:PamarkDay):Draft=>{const d=newDraft();d.values.date=day.date;d.values.vehicle=day.label;return d;};
// Reads one day back into the capture draft, reusing the same mapping the open path uses.
export function existingPamarkDayFrom(bytes:Uint8Array,day:PamarkDay):Draft{
  const s=new XlsxDocument(bytes).snapshot();
  const value=(c:string)=>s[`${c}${day.row}`]?.value;
  const time=(v:unknown)=>{if(typeof v==='string'&&/^\d{1,2}:\d{2}$/.test(v))return v.padStart(5,'0');if(typeof v!=='number'||!Number.isFinite(v))return '';const mins=Math.round(v*1440)%1440;return `${Math.floor(mins/60).toString().padStart(2,'0')}:${(mins%60).toString().padStart(2,'0')}`;};
  const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?String(v):'';
  const loading=value('H');
  const textTime=typeof loading==='string'&&/^\d{1,2}:\d{2}$/.test(loading)?Number(loading.split(':')[0])+Number(loading.split(':')[1])/60:undefined;
  const draft=emptyDraft(day);
  return {...draft,overnight:typeof value('C')==='number'&&Number(value('C'))>=1,values:{...draft.values,start:time(value('B')),end:time(value('C')),startKm:num(value('D')),endKm:num(value('E')),loadingHours:typeof loading==='number'?String(Math.round(loading*24*1000)/1000):textTime===undefined?'':String(textTime),stops:num(value('K')),route:String(s[`A${day.routeRow}`]?.value||'').replace(/^Reitti:\s*/i,'')}};
}
