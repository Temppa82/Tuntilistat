import type {ListKind} from './capture';
import {getStored,putStored,deleteStored,sharedDirectory,readWorkbook,writeWorkbook,type SavedWorkbook} from './local-files';
import {emptyWorkbook,workbookName,legacyWorkbookNames,validateTemplate} from './workbook-export';
import {loadTemplate} from './templates';
import {XlsxDocument} from './xlsx-document';
import {applyVehicles,fleet} from './vehicle-settings';
// Käyttäjän kansiosta luettua tiedostoa ei saa luottaa vastuetta. Keskeneräinen
// synkronointi, väärä tiedosto tai vieras muu tallenne jää välimuistiin, jolloin
// jokainen tallennus kaatuu turhaan eikä mitään voi kirjoittaa. Lukukelvoton
// tiedosto merkitään, jolloin oma kelpo kopio otetaan sen tilalle ja
// kansion tiedosto korjataan.
function readable(bytes:Uint8Array|undefined){if(!bytes)return undefined;try{new XlsxDocument(bytes);return bytes;}catch{return undefined;}}
export async function ensurePeriod(kind:ListKind,date:string,name:string){
 const filename=workbookName(kind,date,name);
 const action=async()=>{
  const dir=await getStored<boolean>(`imported:${filename}`)?undefined:await sharedDirectory(),raw=dir?await readWorkbook(dir,filename):undefined;
  const disk=readable(raw);
  let cached=await getStored<SavedWorkbook>(`workbook:${filename}`);
   // Vanhan muodon tiedostot nostetaan uuteen nimeen. Muutos kirjoitetaan
   // vasta uuden avaimen onnistuttua, ja vanha avain poistetaan, jotta sama
   // kuukausi ei näy listassa kahteen kertaan.
   let migratedFrom:string|undefined;
   for(const old of legacyWorkbookNames(kind,date,name)){
    if(cached)break;
    cached=await getStored<SavedWorkbook>(`workbook:${old}`);
    if(cached)migratedFrom=old;
    else if(dir){const bytes=readable(await readWorkbook(dir,old));if(bytes){cached={filename:old,bytes,kind,updatedAt:new Date().toISOString(),savedToFolder:true};migratedFrom=old;}}
   }
  // Oma tallennus tarkistetaan samalla tavalla kuin kansion tiedosto. Muuten
  // vioittunut kopio jää ainoaksi lähteeksi, jolloin jokainen tallennus
  // kaatuu eikä päivää voi kirjata.
  const usable=cached&&readable(cached.bytes)?cached:undefined;
  let bytes=usable&&!usable.savedToFolder?usable.bytes:disk||usable?.bytes;
  const folderUnreadable=!!raw&&!disk;
  if(folderUnreadable&&!bytes)throw new Error(`Tiedosto ${filename} käyttäjän kansiossa ei ole luettava taulukko. Tiedostoa ei muutettu. Poista tiedosto kansiosta tai tuo se uudelleen sovellukseen.`);
  if(cached&&!usable&&!bytes)throw new Error(`Sovelluksen oma kopio tiedostosta ${filename} ei ole luettava taulukko, eikä sitä voi käyttää eikä päälle kirjoittaa. Tuotu kopio on ainoa luotettava lähde. Poista tiedosto kansiosta ja tuo se uudelleen sovellukseen. Tiedostoa ei muutettu.`);
  const created=!bytes;
  if(!bytes){const template=await loadTemplate(kind);bytes=emptyWorkbook(template.bytes,kind,date,name);if(kind==='pamark')bytes=applyVehicles(bytes,await fleet(),true);}
  const doc=new XlsxDocument(bytes);validateTemplate(doc,kind);
  if(kind==='hours'&&String(doc.snapshot().A1?.value).replace(/^Kuljettaja:\s*/i,'').trim().toLocaleLowerCase('fi')!==name.trim().toLocaleLowerCase('fi'))throw new Error('Samanniminen tuntilista kuuluu toiselle kuljettajalle. Mitään ei korvattu.');
  // Recoverable copy first, then the user-selected folder if supported.
  const record={filename,bytes,kind,updatedAt:cached?.updatedAt||new Date().toISOString(),savedToFolder:!!disk,created} satisfies SavedWorkbook&{created:boolean};
   await putStored(`workbook:${filename}`,record);
   // Poistetaan vasta uuden kirjauksen onnistuttua. Kansion vanhaa tiedostoa ei
   // poisteta: käyttäjän omaan kansioon ei kosketa turhaan.
   if(migratedFrom)await deleteStored(`workbook:${migratedFrom}`);
  // Kansion lukukelvoton tiedosto korjataan omasta kelvosta kopiosta, jotta
  // käyttäjä ei jää umpikujaan. Vanhan sisältö säilytetään sovelluksessa, joten
  // mitään ei katoa, ja kelvollinen tiedosto kirjoitetaan paikalleen. Jos oma
  // kopio on yhtä lailla kelvoton, yllä heitetään virhe eikä kansiota
  // kosketa lainkaan.
  if(dir&&!disk){
   if(folderUnreadable)await putStored(`backup:unreadable:${filename}`,{filename,bytes:raw as Uint8Array,kind,updatedAt:new Date().toISOString(),savedToFolder:false} satisfies SavedWorkbook);
   record.savedToFolder=await writeWorkbook(dir,filename,bytes);
   await putStored(`workbook:${filename}`,record);
  }
  window.dispatchEvent(new Event('local-workbooks-changed'));return record;
 };
  return navigator.locks?navigator.locks.request(`ajolista:${filename}`,action):action();
 }
// Lukee tallennetun työkopion nykyisen tai vanhan nimen alta. Nimen vaihto ei
// saa piilottaa puhelimella jo olevaa listaa, joten vanha avain hyväksytään
// luettavaksi. Tulos kannetaan uudella nimellä, jotta tallennus jatkuu uuteen
// avaimeen. Lukeminen ei poista mitään.
export async function storedWorkbook(kind:ListKind,date:string,name:string){
  const filename=workbookName(kind,date,name);
  const current=await getStored<SavedWorkbook>(`workbook:${filename}`);
  // Roskainen välimuisti palautetaan tyhjänä, jotta päivälehtiö näyttää
  // "ei listaa" sen sijaan että jokainen toiminto kaatuu vioittuneen tiedoston vuoksi.
  if(current?.bytes&&readable(current.bytes))return current;
  for(const old of legacyWorkbookNames(kind,date,name)){
   const legacy=await getStored<SavedWorkbook>(`workbook:${old}`);
   if(legacy?.bytes&&readable(legacy.bytes))return {...legacy,filename};
  }
  return undefined;
 }
// Asettaa käyttäjän tuoman tiedoston työkopion käyttöön sellaisenaan. Tuonti
 // sulauttaa puhelimen päivät tiedostoon, joten puhelimella oleva vanha versio
 // jää näkyviin. Tämä on se valinta, jolla tuotu tiedosto halutaan katsottaa
 // ja käyttää. Aiempi versio varmuuskopioidaan ensin, joten mitään ei menetä.
export async function useImportedFile(kind:ListKind,filename:string,bytes:Uint8Array){
  const previous=await getStored<SavedWorkbook>(`workbook:${filename}`);
  if(previous)await putStored(`backup:before-import:${filename}`,previous);
  await putStored(`workbook:${filename}`,{filename,bytes,kind,updatedAt:new Date().toISOString(),savedToFolder:false} satisfies SavedWorkbook);
  // Tuotu kopio on virallinen, joten vanhaa kansiotiedostoa ei lueta sen päälle.
  await putStored(`imported:${filename}`,true);
  window.dispatchEvent(new Event('local-workbooks-changed'));
}
