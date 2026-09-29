import {readFileSync,writeFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {XlsxDocument} from '../lib/xlsx-document';
import {clearTemplate,validateTemplate} from '../lib/workbook-export';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const hours=new Uint8Array(readFileSync('../Tuntilista Ajuri.xlsx'));
const pamark=new Uint8Array(readFileSync('../Pamark ajolista syyskuu 1-2 2026.xlsx'));
const doc=new XlsxDocument(pamark);
const broken=doc.snapshot().O103?.formula;
doc.setFormula('O103','F103*(I100/100)*0.13');
const fixed=doc.bytes();
// Sovelluksen upotettu ajolista ei saa sisältää muiden ajurien kirjauksia:
// ne aiheuttavat valheellisia ristiriitoja uusille päiville. Rakenne, AUTO:
// -rekisteritunnukset, KULJETTAJA-otsikot ja laskukaavat säilyvät. Testien
// täytetty lähde tallennetaan erikseen scripts/real-fixtures.ts:ään.
const clean=new XlsxDocument(fixed);clearTemplate(clean,'pamark');const cleaned=clean.bytes();
validateTemplate(new XlsxDocument(hours),'hours');
validateTemplate(new XlsxDocument(cleaned),'pamark');
const b64=(b)=>Buffer.from(b).toString('base64');
const data=`import type {ListKind} from './capture';\n// Alkuperäiset listapohjat (Tuntilista Ajuri.xlsx ja Pamark ajolista.xlsx) upotettuina.\n// Pamark-pohjasta on puhdistettu päiväkirjaukset; AUTO: -rekisteritunnukset, KULJETTAJA-otsikot,\n// päivärivit ja laskukaavat säilyvät. O103-viite korjattu I100:ksi. Testit käyttävät\n// täytettyä lähdettä scripts/real-fixtures.ts:stä.\nconst base64:Record<ListKind,string>={hours:${JSON.stringify(b64(hours))},pamark:${JSON.stringify(b64(cleaned))}};\nexport function bundledTemplateBytes(kind:ListKind):Uint8Array{const raw=atob(base64[kind]);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;}\n`;
writeFileSync('lib/templates-data.ts',data);
console.log(`lib/templates-data.ts kirjoitettu (hours ${hours.length}B, pamark ${cleaned.length}B). O103: ${broken} -> F103*(I100/100)*0.13.`);