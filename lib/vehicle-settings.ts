import {XlsxDocument} from './xlsx-document';
import {normalizeVehicle,parseNumber} from './capture';
import {getStored,putStored} from './local-files';
export type VehicleData={consumption:string;emission:string};
export type Fleet=Record<string,VehicleData>;
// Extracted from the user's Pamark September 2026 workbook, header columns E/G/I.
export const defaults:Fleet=Object.fromEntries([['JTS-790','24','0.13'],['LLT-265','27','1.2'],['FOM-995','12','0.13'],['ZLC-613','27','0.13'],['MTY-164','27','0.13'],['ENR-210','27','1.2']].map(([reg,consumption,emission])=>[reg,{consumption,emission}]));
export async function fleet():Promise<Fleet>{return {...structuredClone(defaults),...await getStored<Fleet>('vehicles:v1')};}
export async function saveVehicle(reg:string,value:VehicleData){validateVehicle(value);const all=await fleet();all[normalizeVehicle(reg)]={...value};await putStored('vehicles:v1',all);}
export function validateVehicle(value:VehicleData){for(const [key,v] of Object.entries(value)){if(v===''&&!['consumption','emission'].includes(key))continue;const n=parseNumber(v);if(!Number.isFinite(n)||n<0||n>1000000)throw new Error('Anna asetuksiin nolla tai positiivinen luku.');}}
export function applyVehicles(bytes:Uint8Array,values:Fleet,preserveFormulas=false){
 const doc=new XlsxDocument(bytes),s=doc.snapshot();
 for(const [reg,v] of Object.entries(values)){
  validateVehicle(v);const rows=Object.entries(s).filter(([a,c])=>/^E\d+$/.test(a)&&/^AUTO\s*:/i.test(String(c.value))&&normalizeVehicle(String(c.value).replace(/^AUTO\s*:\s*/i,''))===normalizeVehicle(reg));
  if(rows.length!==1)throw new Error(`Auton ${reg} osiota ei tunnistettu.`);const h=Number(rows[0][0].slice(1));
  if(!String(s[`G${h}`]?.value).startsWith('CO2/'))throw new Error('Päästösolun rakennetta ei tunnistettu.');
  doc.set(`I${h}`,parseNumber(v.consumption));doc.set(`G${h}`,`CO2/ ${String(parseNumber(v.emission)).replace('.',',')}g/ltr`);
  if(!preserveFormulas)for(let r=h+3;r<=h+25;r+=2){if(!s[`O${r}`]?.formula)throw new Error('Päästökaavaa ei tunnistettu.');doc.setFormula(`O${r}`,`F${r}*($I$${h}/100)*${parseNumber(v.emission)}`);}
 }
 return doc.bytes();
}
