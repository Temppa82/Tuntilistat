import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync,strFromU8} from 'fflate';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {XlsxDocument} from '../lib/xlsx-document';
import {fillWorkbook,emptyWorkbook} from '../lib/workbook-export';
import {hoursTemplate} from '../lib/hours-template';
import type {Draft} from '../lib/capture';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const sheetOf=(files:Record<string,Uint8Array>)=>{
 const doc=new DOMParser().parseFromString(strFromU8(files['xl/worksheets/sheet1.xml']),'application/xml');
 const types=new Map<string,string|undefined>(),values=new Map<string,unknown>(),formulas=new Map<string,string|undefined>();
 for(const c of Array.from(doc.getElementsByTagName('c') as any) as any[]){
  const a=c.getAttribute('r')!;
  types.set(a,c.getAttribute('t')??undefined);
  values.set(a,c.getElementsByTagName('v')[0]?.textContent??null);
  formulas.set(a,c.getElementsByTagName('f')[0]?.textContent??undefined);
 }
 return {types,values,formulas};
};
// Kerää kaavojen viittaamat solut. Kirjainta edeltävä kirjain estää väärät
// osumat (esimerkiksi LOG10 -> ei saa lukea G10:ksi).
const refs=(f:string)=>[...f.matchAll(/(?<![A-Za-z0-9_!$])\$?([A-Z]{1,3})\$?(\d+)/g)].map(m=>`${m[1]}${m[2]}`);

const template=new Uint8Array(readFileSync('work/listat-fixtures/Tuntilista Ajuri.xlsx'));
const before=sheetOf(unzipSync(template));
const draft={id:'x',step:0,updatedAt:'',overnight:false,values:{vehicle:'JTS-790',date:'2025-03-03',start:'06:00',startKm:'100',end:'14:00',endKm:'260',waiting:'30',breakMinutes:'45',allowance:'1',foreignAllowance:'0',sick:'0',loadingHours:'',stops:'',route:'Helsinki'}} as unknown as Draft;
const written=fillWorkbook(template,'hours',draft,'Testi Testiajo',{fresh:false,overwrite:true});
const out=unzipSync(written.bytes),after=sheetOf(out);

// 1. Jokainen pohjan kaava on yhä paikallaan ja muuttumaton.
for(const [address,formula] of before.formulas)assert.equal(after.formulas.get(address),formula,`kaava ${address} muuttui tai katosi`);
// 2. Kaikki kaavojen syöttösolut ovat numeroita tai tyhjiä. Yksi tekstiarvo
//    riittää nollaamaan koko yhteenvetson.
const broken:string[]=[];
for(const [address,formula] of after.formulas){
 if(!formula)continue;
 for(const r of refs(formula)){
  const t=after.types.get(r);
  if(t==='s'||t==='inlineStr'||t==='str')broken.push(`${address} luetaan solusta ${r} joka on tekstiä`);
 }
}
assert.deepEqual(broken,[],`kaavojen syöttösoluissa on tekstiä: ${broken.slice(0,5).join('; ')}`);
// 3. Kirjatun päivän laskennalliset solut ovat numeroita.
for(const a of ['A3','B3','C3','D3','E3','G3','H3','I3','J3','K3']){
 assert.notEqual(after.types.get(a),'s',`solu ${a} jäi yhteiseksi tekstiksi`);
 assert.notEqual(after.types.get(a),'inlineStr',`solu ${a} kirjoitettiin tekstinä mutta kaava käyttää sitä numerona`);
}
// 4. Yhteenvetsokaavat ovat edelleen olemassa ja laskettavissa.
for(const a of ['F87','G87','H87','I87','J87'])assert.ok(after.formulas.get(a),`yhteenveto ${a} katosi`);
// 5. Laskenta käynnistyy uudelleen eikä vanhaa ketjua jää jälkeen.
const wb=new DOMParser().parseFromString(strFromU8(out['xl/workbook.xml']),'application/xml');
const calcPr=Array.from(wb.getElementsByTagName('calcPr') as any)[0] as any;
assert.equal(calcPr?.getAttribute('fullCalcOnLoad'),'1','laskenta ei käynnisty avattaessa');
assert.equal(calcPr?.getAttribute('calcCompleted'),'0','laskenta on merkitty valmiiksi vaikka sitä ei ole tehty');
assert.equal(out['xl/calcChain.xml'],undefined,'vanha laskentaketju jäi tiedostoon ja estää uudelleenlaskennan');
const types=new DOMParser().parseFromString(strFromU8(out['[Content_Types].xml']),'application/xml');
assert.equal(Array.from(types.getElementsByTagName('Override') as any).some((o:any)=>o.getAttribute('PartName')==='/xl/calcChain.xml'),false,'calcChain jäi sisältötyyppiluetteloon');
const rels=new DOMParser().parseFromString(strFromU8(out['xl/_rels/workbook.xml.rels']),'application/xml');
assert.equal(Array.from(rels.getElementsByTagName('Relationship') as any).some((r:any)=>r.getAttribute('Target')==='calcChain.xml'),false,'calcChain jäi suhteisiin');
// 6. Tyhjä lista säilyttää kaavat.
const blank=unzipSync(emptyWorkbook(template,'hours','2025-03-03','Testi Testiajo'));
for(const [address,formula] of before.formulas)assert.equal(sheetOf(blank).formulas.get(address),formula,`tyhjä lista rikkoi kaavan ${address}`);
assert.ok(hoursTemplate.entryRows.length);
console.log('PASS xlsx formulas: kaavat säilyvät, syöttösolut ovat numeroita ja laskenta käynnistyy');
