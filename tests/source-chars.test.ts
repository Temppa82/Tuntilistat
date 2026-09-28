import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
// Tämä vika asui tiedostossa, jota yksikään testi ei lukenut, ja se rikkoi
// koko tallennuksen. Siksi lähdekoodit merkitään tarkistetaan myös täällä.
const ROOTS=['app','components','lib','tests','scripts'];
const SKIP=/\.(png|jpg|jpeg|gif|xlsx|zip|ico)$/;
const files:string[]=[];
const walk=(p:string)=>{if(statSync(p).isDirectory()){for(const e of readdirSync(p))walk(join(p,e));}else files.push(p);};
for(const root of ROOTS)try{walk(root);}catch{/* puuttuva kohde ei ole virhe */}

const broken:Array<[string,number]>=[];
for(const file of files){
  if(SKIP.test(file))continue;
  const at=[...readFileSync(file,'utf8')].findIndex(c=>{const k=c.codePointAt(0)!;return k===0xfffd||(k<0x20&&k!==9&&k!==10&&k!==13);});
  if(at>=0)broken.push([file,at]);
}
assert.deepEqual(broken,[],`näissä tiedostoissa on rikkoutunut merkki: ${broken.map(([f,i])=>`${f}@${i}`).join(', ')}`);

const app=readFileSync('app/kirjaus/capture-app.tsx','utf8');
// Kaupunkien väliin meni ennen U+FFFD ja ohjausmerkki, jotka päätyivät soluun
// ja rikkoivat taulukon. Erotin on tavallinen tavuviiva.
assert.ok(app.includes(".join(' - ')"),'kaupunkien erotin ei ole tavallinen tavuviiva');
assert.ok(app.includes('placeholder="Vantaa - Espoo - Vantaa"'),'reitin esimerkkitekstissä on rikkoutunut merkki');
// Suomalaisessa levikissä on A, A ja O. Ne olivat kadonneet tarkistuksesta, jolloin
// levykit hylattiin virheellisesti.
const plate=app.match(/\/\^\[A-Z0-9[^\]]*\]\{1,6\}-\[A-Z0-9[^\]]*\]\{1,6\}\$\//)?.[0];
assert.ok(plate,'rekisterinumeron tarkistusta ei löytynyt');
const characters=new RegExp(`[${plate.slice(plate.indexOf('[')+1,plate.indexOf(']'))}]`);
for(const good of ['ABC-123','åä-1','ABC-999'])assert.ok(characters.test(good),`${good} pitäisi kelvata`);
console.log(`PASS source chars: ${files.length} lähdetiedostoa puhdas, reittierotin ja levikkitarkistus kunnossa`);
