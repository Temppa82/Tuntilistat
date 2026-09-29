export type ListKind='hours'|'pamark';
export type Field='vehicle'|'date'|'start'|'startKm'|'end'|'endKm'|'waiting'|'breakMinutes'|'allowance'|'foreignAllowance'|'sick'|'loadingHours'|'stops'|'route';
export type Draft={id:string;step:number;updatedAt:string;values:Record<Field,string>;overnight:boolean;pamarkBase?:string};
export type Step={field:Field;label:string;type:'text'|'date'|'time'|'number'|'yesno'|'route';hint?:string;step?:number};
const common:Step[]=[{field:'vehicle',label:'Ajoneuvo?',type:'text',hint:'Kirjoita rekisterinumero, esimerkiksi ABC-123.'},{field:'date',label:'Päivämäärä',type:'date',hint:'Tämä päivä on valmiina. Voit vaihtaa päivämäärän.'},{field:'start',label:'Aloitusaika?',type:'time'},{field:'startKm',label:'Aloituskilometrit?',type:'number'},{field:'end',label:'Lopetusaika?',type:'time'},{field:'endKm',label:'Lopetuskilometrit?',type:'number'}];
export const steps:Record<ListKind,Step[]>={hours:[...common,{field:'waiting',label:'Odotusaika?',type:'number',hint:'Minuutteina. Jätä tyhjäksi, jos odotusta ei ollut.'},{field:'breakMinutes',label:'Aika tauolla?',type:'number',hint:'Minuutteina. Jätä tyhjäksi, jos taukoa ei ollut.'},{field:'allowance',label:'Puolipäiväraha?',type:'yesno',hint:'Kyllä tallennetaan arvona 1.'},{field:'foreignAllowance',label:'Ulkomaan päiväraha?',type:'yesno',hint:'Kyllä tallennetaan arvona 1.'},{field:'sick',label:'Sairas?',type:'yesno'},{field:'route',label:'Reitti?',type:'route',hint:'Lisää kaupungit ajojärjestyksessä. Aiemmin kirjoittamasi paikat tulevat ehdotuksiksi.'}],pamark:[...common,{field:'loadingHours',label:'Lastausaika? (tunti(a))',type:'number',step:.5,hint:'Tunteina puolen tunnin tarkkuudella: 0 · 0,5 · 1 · 1,5…'},{field:'stops',label:'Paikkoja?',type:'number',hint:'Paikkojen määrä kokonaislukuna.'},{field:'route',label:'Reitti?',type:'route',hint:'Lisää kaupungit ajojärjestyksessä. Aiemmat paikat tulevat ehdotuksiksi.'}]};
export const months=['tammikuu','helmikuu','maaliskuu','huhtikuu','toukokuu','kesäkuu','heinäkuu','elokuu','syyskuu','lokakuu','marraskuu','joulukuu'];
export function localDate(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Helsinki'}).format(new Date());}
// Päivämäärä suomalaisena vahvistuksissa, jotta käyttäjä näkee mitä päivää
// toimenpide koskee. Kelvottomasta päivästä ei näytetä mitään, jottei
// vahvistukseen päädy väärää päivämäärää.
export function displayDate(value:string){if(!validDate(value))return '';return `${Number(value.slice(8,10))}.${Number(value.slice(5,7))}.${value.slice(0,4)}`;}
export function rollToToday(draft:Draft,today:string){if(draft.values.date>=today)return draft;for(const [field,value] of Object.entries(draft.values))if(field!=='date'&&value)return draft;return {...draft,values:{...draft.values,date:today},updatedAt:new Date().toISOString()};}
export function newDraft():Draft{return {id:crypto.randomUUID(),step:0,updatedAt:new Date().toISOString(),overnight:false,values:{vehicle:'',date:localDate(),start:'',startKm:'',end:'',endKm:'',waiting:'',breakMinutes:'',allowance:'',foreignAllowance:'',sick:'',loadingHours:'',stops:'',route:''}};}
export function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
export function parseNumber(value:string){return value.trim()!==''&&/^\d+(?:[.,]\d+)?$/.test(value.trim())?Number(value.replace(',','.')):NaN;}
export function normalizeVehicle(value:string){return value.trim().toUpperCase().replace(/\s+/g,'').replace(/[–—]/g,'-');}
export function routeParts(value:string){return value.split(/\s+[–—-]\s+|\s*→\s*|[;\n]/).map(s=>s.trim()).filter(Boolean);}
export function learnCities(known:Record<string,number>,route:string){const next={...known};for(const city of new Set(routeParts(route))){const key=Object.keys(next).find(k=>k.toLocaleLowerCase('fi')===city.toLocaleLowerCase('fi'))||city;next[key]=(next[key]||0)+1;}return next;}
export function suggestions(known:Record<string,number>,prefix:string){return Object.entries(known).filter(([k])=>k.toLocaleLowerCase('fi').startsWith(prefix.trim().toLocaleLowerCase('fi'))).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'fi')).slice(0,8).map(([k])=>k);}
export function validateDraft(kind:ListKind,draft:Draft){const v=draft.values,errors:Partial<Record<Field,string>>={};
 const sickOnly=kind==='hours'&&v.sick==='1'&&![v.start,v.end,v.startKm,v.endKm].some(Boolean);
 for(const {field,type,step} of steps[kind]){const value=(v[field]||'').trim();if(!value){if(!(field==='waiting'||field==='breakMinutes'||(sickOnly&&['vehicle','start','end','startKm','endKm','waiting','breakMinutes','route'].includes(field))))errors[field]='Täytä tämä kohta.';continue;}
 if(field==='vehicle'&&!/^[A-ZÅÄÖ0-9]{1,6}-[A-ZÅÄÖ0-9]{1,6}$/.test(normalizeVehicle(value)))errors[field]='Anna rekisterinumero, esimerkiksi ABC-123.';
 if(type==='date'&&(!validDate(value)||value>localDate()))errors[field]='Valitse kelvollinen päivämäärä, joka ei ole tulevaisuudessa.';
 if(type==='time'){if(/^([01]\d|2[0-3]):[0-5]\d$/.test(value)){if(!/^([01]\d|2[0-3]):(00|30)$/.test(value))errors[field]='Anna aika puolen tunnin tarkkuudella, esim. 06:00 tai 06:30.';}else errors[field]='Anna kellonaika.';}
 if(type==='yesno'&&!['0','1'].includes(value))errors[field]='Valitse kyllä tai ei.';
 if(type==='number'){const n=parseNumber(value);if(!Number.isFinite(n)||n<0||n>9999999||!Number.isInteger(n/(step||1)))errors[field]=step===.5?'Anna aika puolen tunnin tarkkuudella.':'Anna nolla tai positiivinen kokonaisluku.';}
 if(type==='route'&&value.length>1000)errors[field]='Reitti saa olla enintään 1000 merkkiä.';
 }
 if(!errors.startKm&&!errors.endKm&&parseNumber(v.endKm)<parseNumber(v.startKm))errors.endKm='Loppulukema ei voi alittaa alkulukemaa.';
 if(!errors.start&&!errors.end&&v.start&&v.end){const min=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));const total=min(v.end)-min(v.start)+(draft.overnight?1440:0);if(total<=0||total>1440)errors.end='Tarkista ajat ja seuraavan päivän valinta.';if(kind==='pamark'&&!errors.loadingHours&&parseNumber(v.loadingHours)*60>total)errors.loadingHours='Lastausaika ei voi ylittää työpäivän kestoa.';if(kind==='hours'&&!errors.waiting&&!errors.breakMinutes&&parseNumber(v.waiting)+parseNumber(v.breakMinutes)>total)errors.waiting='Odotus ja tauot ylittävät työpäivän keston.';}
 if(sickOnly&&((parseNumber(v.waiting)||0)>0||(parseNumber(v.breakMinutes)||0)>0))errors.waiting='Pelkkään sairauspäivään ei merkitä odotusta tai taukoja.';
 return errors;
}
export type VehicleSettings={consumption:string;hourPrice:string;loadingPrice:string;dieselExtra:string};
export type CaptureState={version:2;name:string;nameLocked:boolean;active:ListKind|null;drafts:Record<ListKind,Draft>;cities:Record<string,number>;vehicleSettings:Record<string,VehicleSettings>};
export function initialState():CaptureState{return {version:2,name:'',nameLocked:false,active:null,drafts:{hours:newDraft(),pamark:newDraft()},cities:{},vehicleSettings:{}};}
