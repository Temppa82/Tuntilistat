import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync,strFromU8} from 'fflate';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {XlsxDocument,xmlSafeText} from '../lib/xlsx-document';
import {emptyWorkbook} from '../lib/workbook-export';
Object.assign(globalThis,{DOMParser,XMLSerializer});
// Chromen jäsentäjä on tiukka: nämä ovat XML 1.0:n sallimat merkistöt ja mitään
// muuta taulukko ei saa sisältää. Tämä on se tarkistus, jota armollinen
// xmldom ei tee, ja jonka takia kaatunut tallennus jäi puhelimen testeistä
// huomaamatta.
const allowed=(code:number)=>code===0x9||code===0xa||code===0xd||(code>=0x20&&code<=0xd7ff)||(code>=0xe000&&code<=0xfffd)||(code>=0x10000&&code<=0x10ffff);
const forbidden=(text:string)=>[...text].filter(c=>!allowed(c.codePointAt(0)!));

// Merkit, jotka puhelimen näppäimistö tai kopiointi voi tuottaa reittiin.
const stripped:Array<[string,string]>=[['NUL','a\u0000b'],['ohjausmerkki','a\u0001b'],['VT','a\u000Bb'],['FS','a\u001Cb'],['U+FFFE','a\uFFFEb'],['U+FFFF','a\uFFFFb'],['yksinäinen yläkorvaaja','a\uD800b'],['yksinäinen alakorvaaja','a\uDC00b'],['katkaistu emoji','a\uD83Db']];
for(const [label,text] of stripped) assert.equal(forbidden(xmlSafeText(text)).length,0,`${label} jäi taulukkoon`);

// Tavallinen suomalainen ja ruotsalainen teksti sekä merkit, jotka ovat
// XML:ssa sallittuja, eivät saa mennä mitään.
const kept:Array<[string,string]>=[['ä ö å','äöå'],['en dash','Turku\u2013Salo'],['nuoli','Turku\u2192Salo'],['pohjoismainen Ł','na\u0141e'],['emoji','Vantaa \uD83D\uDE9A'],['väli','Vantaa \u2013 Helsinki'],['kiinan kieli','北京']];
for(const [label,text] of kept) assert.equal(xmlSafeText(text),text,`${label} muuttui`);

// Oikea reitti, joka kaatoi tallennuksen: kaupunkien erotin oli tavaton merkki.
const route='Reitti: Vantaa \u0000 Helsinki \uD800 \uFEFF Turku';
const doc=new XlsxDocument(emptyWorkbook(new Uint8Array(readFileSync('work/template-tests/pamark.xlsx')),'pamark','2026-09-16','Testikuljettaja'));
doc.set('A4',route);
doc.set('A5','Reitti: Vantaa \u2013 Helsinki \uD83D\uDE9A');
const bytes=doc.bytes();
for(const [path,data] of Object.entries(unzipSync(bytes))) if(path.endsWith('.xml')||path.endsWith('.rels')){
 const text=strFromU8(data);
 assert.equal(forbidden(text).length,0,`${path} sisältää XML:lle kiellettyjä merkkejä`);
}
// Tallennus onnistuu ja tiedosto avautuu uudelleen.
const read=new XlsxDocument(bytes).snapshot();
assert.ok(read.A5.value?.includes('Vantaa'),'hyvä reitti katosi');
assert.ok(!read.A4.value?.includes('\u0000'),'NUL jäi soluun');
console.log('PASS xml chars: taulukko hyväksyy vain XML:n sallimat merkit ja tavallinen reitti säilyy');
