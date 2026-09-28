import {spawnSync} from 'node:child_process';
import {readdirSync,existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';

// Testit luetaan suhteessa projektin juuriin, ei tests-kansioon: ne käyttävät
// polkuja kuten ../Listat/... ja work/template-tests/.... Ajetaan siis aina
// projektin juuresta, jotta sama komento toimii myös uudessa koneessa.
// Vaatii etukäteen rakennetun dist-kansion: offline.test.mjs tarkistaa
// juuri tehdyn service workerin, joten npm test ajaa buildin ensin.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const tsx=join(root,'node_modules','tsx','dist','cli.mjs');
const node=process.execPath;

// Lähdekoodipaketissa ei ole binäärisiä testipohjia, vaan ne luodaan
// sovellukseen upotetuista listapohjista. Ajetaan vain puuttuville.
const fixtures=[
  ...['hours.xlsx','pamark.xlsx'].map(f=>join(root,'work','template-tests',f)),
  join(root,'work','listat-fixtures','Tuntilista Ajuri.xlsx'),
  join(root,'work','listat-fixtures','Pamark ajolista syyskuu 1-2 2026.xlsx'),
];
if(fixtures.some(f=>!existsSync(f))){
  mkdirSync(join(root,'work','template-tests'),{recursive:true});
  const made=spawnSync(node,[tsx,join(root,'scripts','make-test-fixtures.mjs')],{cwd:root,encoding:'utf8'});
  if(made.status!==0){
    console.error('Testipohjien luonti epäonnistui:\n'+made.stdout+made.stderr);
    process.exit(1);
  }
  console.log(made.stdout.trim()+'\n');
}

const tests=readdirSync(join(root,'tests')).filter(f=>f.endsWith('.test.ts')||f==='offline.test.mjs').sort();

let failed=0;
for(const name of tests){
 const file=join('tests',name);
 const args=name.endsWith('.mjs')?[file]:[tsx,file];
 const run=spawnSync(node,args,{cwd:root,encoding:'utf8'});
 const out=((run.stdout||'')+(run.stderr||'')).trim();
 if(run.status===0){
  const pass=out.split(/\r?\n/).find(l=>l.startsWith('PASS'));
  console.log(`OK    ${name}${pass?`\n        ${pass}`:''}`);
 }else{
  failed++;
  console.log(`FAIL  ${name}\n${out}\n`);
 }
}
console.log(failed?`\n${failed}/${tests.length} testiä epäonnistui.`:`\nKaikki ${tests.length} testiä meni läpi.`);
if(failed)process.exit(1);
