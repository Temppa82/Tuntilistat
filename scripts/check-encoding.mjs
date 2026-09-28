import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';

// Kaksinkertainen UTF-8-koodaus on tässä projektissa tapahtunut kerran ja se
// rikkoo koko käyttöliittymän tekstit ilman että käännös tai testi huomaa sitä.
// Tavallinen suomenkieli ei sisällä U+00C3 -merkkiä, joten sen löytyminen
// on varma merkki vahingosta. Tarkistus ajetaan ennen buildia.
const ROOTS=['app','components','lib','tests','scripts','public','main.tsx','index.html','env.d.ts','vite.config.ts','README.md'];
const SKIP=/\.(png|jpg|jpeg|gif|xlsx|zip|ico)$/;
const files=[];
const walk=p=>{if(statSync(p).isDirectory()){for(const e of readdirSync(p))walk(join(p,e));}else files.push(p);};
for(const root of ROOTS){try{walk(root);}catch{/* puuttuva kohde ei ole virhe */}}

const bad=[];
for(const file of files){
  if(SKIP.test(file))continue;
  let text;try{text=readFileSync(file,'utf8');}catch{continue;}
  const hit=text.match(/\u00C3./);
  if(hit)bad.push({file,index:text.indexOf(hit),sample:text.slice(Math.max(0,text.indexOf(hit)-15),text.indexOf(hit)+15).replace(/\s+/g,' ')});
}

if(bad.length){
  console.error(`Koodausvirhe: ${bad.length} tiedostoa on kaksinkertaisesti UTF-8-koodattu.`);
  for(const b of bad)console.error(`  ${b.file}: ...${b.sample}...`);
  console.error('\nKorjaus: muunnetaan tiedoston teksti takaisin UTF-8:ksi (Latin-1 -> UTF-8).');
  console.error('Esimerkiksi: node scripts/repair-encoding.mjs <tiedosto>');
  process.exit(1);
}

// Toinen tapa, jolla merkistö on tässä projektissa rikkoutunut: merkki on
// korvattu lakkaavalla merkillä U+FFFD ja sen perään on tullut ohjausmerkki.
// Se on johtanut siihen, että sovellus kirjoitti itse taulukkoon merkin, jota
// XML ei salli, ja kaikki tallennukset epäonnistuivat. Tavallinen suomalainen
// teksti ei sisällä U+FFFD:tä eikä ohjausmerkkejä, joten niiden löytyminen on
// varma merkki vahingosta. Tarkistus ajetaan ennen buildia.
const broken=[];
for(const file of files){
  if(SKIP.test(file))continue;
  let text;try{text=readFileSync(file,'utf8');}catch{continue;}
  const at=[...text].findIndex(c=>{const k=c.codePointAt(0);return k===0xfffd||(k<0x20&&k!==9&&k!==10&&k!==13);});
  if(at>=0)broken.push({file,index:at,sample:text.slice(Math.max(0,at-20),at+20).replace(/\s+/g,' ').replace(/\uFFFD/g,'?')});
}
if(broken.length){
  console.error(`Merkkivirhe: ${broken.length} tiedostoa sisältää U+FFFD-tä tai ohjausmerkkiä.`);
  for(const b of broken)console.error(`  ${b.file}: ...${b.sample}...`);
  console.error('\nNämä merkit eivät kuulu suomenkieliseen tekstiin. Ne on korjattava käsin.');
  process.exit(1);
}
console.log(`Koodaus ok: ${files.length} tiedostoa, ei kaksinkertaista UTF-8:ta eikä rikkoutuneita merkkejä.`);
