import {mkdirSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {bundledTemplateBytes} from '../lib/templates-data';
import {XlsxDocument} from '../lib/xlsx-document';

// Testien työpohjat luodaan sovellukseen upotetuista listapohjista. Näin testit
// eivät riipu minkään ulkoisen kansion tiedostoista ja koko testisto toimii
// puhtaalla koneella, GitHubissa ja lähdekoodipaketissa. Ajetaan tsx:n kautta,
// koska upotetut moduulit ovat TypeScriptiä.
Object.assign(globalThis,{DOMParser,XMLSerializer});
const dir='work/template-tests';
const listat='work/listat-fixtures';
mkdirSync(dir,{recursive:true});
mkdirSync(listat,{recursive:true});

const hours=bundledTemplateBytes('hours');
const pamark=bundledTemplateBytes('pamark');
// Testipohjien kuljettajanimet kirjoitetaan samaan kuin itse pohjat, jotta
// testit voivat käyttää omaa nimeään eivätkä puhujan oikeaa nimeä. Ajurit
// tunnistavat oman listansa A1-solusta, joten nimen on oltava täsmälleen
// oikea kirjoitettaessa ja luettaessa. Sama koskee Pamarkin KULJETTAJA-otsikoita.
const hoursDoc=new XlsxDocument(hours);
hoursDoc.set('A1','Kuljettaja: Testi Testiajo');
const hoursFixed=hoursDoc.bytes();
const pamarkDoc=new XlsxDocument(pamark);
// Ajolistan jokainen osio kuuluu jollekin kuljettajalle. Testien oma nimi
// kirjoitetaan kaikkiin otsikoihin, jotta kohdennettu päivä löytyy omasta
// osiostaan eikä testi olisi sidoksissa yhden kuljettajan omaan listaan.
const pamarkSnap=new XlsxDocument(pamark).snapshot();
for(const [addr,cell] of Object.entries(pamarkSnap)){
  if(/^\s*KULJETTAJA:/.test(String(cell.value??'')))pamarkDoc.set(addr,'KULJETTAJA: Testi Testiajo');
}
const pamarkFixed=pamarkDoc.bytes();
writeFileSync(`${dir}/hours.xlsx`,hoursFixed);
writeFileSync(`${dir}/pamark.xlsx`,pamarkFixed);

// Alkuperäiset tiedostonimet säilytetään, koska testit ja tuotantokoodi
// tunnistavat ne nimellä. Sisältö tulee upotetusta datasta, joten henkilökohtaiset
// tiedot eivät levity lähdekoodin mukana.
const hoursName='Tuntilista Ajuri.xlsx';
const pamarkName='Pamark ajolista syyskuu 1-2 2026.xlsx';
writeFileSync(`${listat}/${hoursName}`,hoursFixed);
writeFileSync(`${listat}/${pamarkName}`,pamarkFixed);

// ui-hours.xlsx on vain ajojen tulos, ei testin syöte: sitä ei luoda tässä
// eikä ylikirjoiteta, jotta ajon tarkastus ei katoa hiljaa.
if(existsSync(`${dir}/ui-hours.xlsx`))console.log(`${dir}/ui-hours.xlsx säilytettiin (ajojen tulos).`);
// Ajolistoja on yksi tiedosto jaksoa kohden, ja testit listaavat ne hakemistolla.
console.log(`Testipohjat valmis: hours.xlsx ${hoursFixed.length}B, pamark.xlsx ${pamarkFixed.length}B. ${listat}: ${readdirSync(listat).join(', ')}.`);
