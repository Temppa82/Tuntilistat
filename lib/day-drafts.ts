import {normalizeVehicle,steps,type Draft,type ListKind} from './capture';
export const dayKey=(kind:ListKind,name:string,date:string,vehicle:string)=>`day-draft:${kind}:${name.trim().toLocaleLowerCase('fi')}:${date}:${kind==='pamark'?normalizeVehicle(vehicle):''}`;
export function sameDayValues(kind:ListKind,a:Draft,b:Draft){return a.overnight===b.overnight&&steps[kind].every(({field})=>a.values[field]===b.values[field]);}
export function hasDayValues(kind:ListKind,d:Draft){return steps[kind].some(({field})=>!['date','vehicle'].includes(field)&&d.values[field]!=='');}
