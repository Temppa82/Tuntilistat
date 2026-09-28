import {readFileSync,writeFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {XlsxDocument} from '../lib/xlsx-document';
Object.assign(globalThis,{DOMParser,XMLSerializer});
for(const [i,p] of ['../Pamark ajolista syyskuu 1-2 2026.xlsx','../Tuntilista Ajuri.xlsx','work/template-tests/hours.xlsx'].entries()){const s=new XlsxDocument(new Uint8Array(readFileSync(p))).snapshot();writeFileSync(`work/inspect-${i}.txt`,Object.entries(s).filter(([a,c])=>c.value!=null||c.formula).map(([a,c])=>`${a}: ${JSON.stringify(c)}`).join('\n'));console.log(p,Object.keys(s).length);}
