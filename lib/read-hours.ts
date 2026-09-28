import {type Draft} from './capture';
import {XlsxDocument} from './xlsx-document';
import {hoursTemplate} from './hours-template';
import {sheetDate} from './pamark-target';
import {validateTemplate} from './workbook-export';
export function hoursDays(bytes:Uint8Array,name:string){
 const doc=new XlsxDocument(bytes);validateTemplate(doc,'hours');const s=doc.snapshot();
 if(String(s.A1?.value||'').replace(/^Kuljettaja:\s*/i,'').trim().toLocaleLowerCase('fi')!==name.trim().toLocaleLowerCase('fi'))throw new Error('Tuntilistan kuljettajan nimi ei vastaa omaa nimeäsi.');
 const days=hoursTemplate.entryRows.flatMap(r=>{const v=s[`A${r}`]?.value;if(v==null||v==='')return [];const date=sheetDate(v);if(!date)throw new Error(`Rivin ${r} päivämäärää ei tunnistettu.`);return [date];});
 if(new Set(days).size!==days.length)throw new Error('Tuntilistassa on samalle päivälle useita rivejä.');
 if(new Set(days.map(d=>d.slice(0,7))).size>1)throw new Error('Tuntilistassa on usean kuukauden kirjauksia.');return days;
}
export function existingHoursDay(bytes:Uint8Array,draft:Draft,name:string):Draft|undefined{
 hoursDays(bytes,name);const s=new XlsxDocument(bytes).snapshot(),r=hoursTemplate.entryRows.find(r=>sheetDate(s[`A${r}`]?.value)===draft.values.date);if(!r)return;
 const v=(c:string)=>s[`${c}${r}`]?.value;
 const number=(x:unknown)=>x==null?'':String(x);
 const clock=(x:unknown)=>{if(typeof x==='string'&&/^\d{1,2}:\d{2}$/.test(x))return x.padStart(5,'0');if(typeof x!=='number')return '';const m=Math.round(x*1440)%1440;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;};
 const minutes=(x:unknown)=>{if(typeof x==='number')return String(Math.round(x*1440));if(typeof x==='string'&&/^\d+:\d{2}$/.test(x)){const [h,m]=x.split(':').map(Number);return String(h*60+m);}return number(x);};
 const route=String(s[`A${r+1}`]?.value||'').replace(/^Reitti:\s*/i,'');const parts=/^([A-ZÅÄÖ0-9]{1,6}-[A-ZÅÄÖ0-9]{1,6})\s*\|\s*(.*)$/is.exec(route);
 return {...draft,overnight:typeof v('D')==='number'&&Number(v('D'))>=1,values:{...draft.values,vehicle:parts?parts[1].toUpperCase():'',start:clock(v('B')),end:clock(v('D')),startKm:number(v('C')),endKm:number(v('E')),waiting:minutes(v('H')),breakMinutes:minutes(v('G')),allowance:number(v('I')),foreignAllowance:number(v('J')),sick:number(v('K')),route:parts?parts[2]:route}};
}
