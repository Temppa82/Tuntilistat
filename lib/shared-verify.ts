import {normalizeVehicle} from './capture';
import {XlsxDocument} from './xlsx-document';
import {pamarkDays,type SheetSnapshot} from './pamark-target';

/**
 * Varmistaa ennen lähetystä, että yhdistäminen muutti jaetussa ajolistassa yksin
 * omaa päivää. Muiden kuljettajien käsinkirjatut arvot ja kaikki laskentakaavat
 * vertaillaan solu solulta, ja yhdenkin poikkeaman vuoksi mitään ei lähetetä.
 *
 * Kaavasolujen välimuistiarvot poistetaan tarkoituksella bytes()-kutsussa, jotta
 * taulukko ei näytä vanhoja lukuja. Siksi kaavat vertaillaan itseään eikä niiden
 * arvoja, ja käsinkirjattuja arvoja vertailaan vain kaavoja sisältämättömistä soluista.
 */
export function verifySharedMerge(source:Uint8Array,merged:Uint8Array,vehicle:string,date:string){
 const before=new XlsxDocument(source).snapshot();
 const after=new XlsxDocument(merged).snapshot();
 const formulas=(s:SheetSnapshot)=>Object.fromEntries(Object.entries(s).filter(([,c])=>c.formula).map(([a,c])=>[a,c.formula] as const));
 const originalFormulas=formulas(before),mergedFormulas=formulas(after);
 const brokenFormulas=[...Object.keys(originalFormulas).filter(a=>mergedFormulas[a]!==originalFormulas[a]),...Object.keys(mergedFormulas).filter(a=>!(a in originalFormulas))];
 if(brokenFormulas.length)throw new Error(`Lähetys pysäytettiin: laskentakaavoja muuttui (${brokenFormulas.join(', ')}). Kirjaus säilyi puhelimella ja jaettu tiedosto jäi koskematta.`);
 const target=`${normalizeVehicle(vehicle)}|${date}`;
 for(const day of pamarkDays(before)){
  if(`${normalizeVehicle(day.label)}|${day.date}`===target)continue;
  for(const [address,cell] of Object.entries(before)){
   const row=Number(address.slice(1));
   if(cell.formula||(row!==day.row&&row!==day.routeRow))continue;
   if(after[address]?.value!==cell.value)throw new Error(`Lähetys pysäytettiin: toisen ajon päivä ${day.label} ${day.date} muuttuisi solussa ${address}. Kirjaus säilyi puhelimella ja jaettu tiedosto jäi koskematta.`);
  }
 }
 if(!pamarkDays(after).some(d=>`${normalizeVehicle(d.label)}|${d.date}`===target))throw new Error('Lähetys pysäytettiin: oma päivä ei ole yhdistetyssä ajolistassa. Kirjaus säilyi puhelimella.');
}
