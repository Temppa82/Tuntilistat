import {readFileSync,writeFileSync} from 'node:fs';
const file=process.argv[2];
const original=readFileSync(file);
const text=original.toString('utf8');
// Kaksinkertainen koodaus: UTF-8 tavut luettiin Latin-1:na ja kirjoitettiin
// takaisin UTF-8:na. Palautus: Latin-1-tavut -> UTF-8.
const repaired=Buffer.from(text,'latin1').toString('utf8');
const before=(text.match(/\u00C3(.)/g)||[]).length;
const after=(repaired.match(/\u00C3(.)/g)||[]).length;
if(before===0){console.log(`${file}: ei mojibakea, ei muutettu`);process.exit(0);}
if(after>=before){console.log(`${file}: palautus ei onnistunut (${before} -> ${after}), jätetään koskematon`);process.exit(1);}
writeFileSync(file,Buffer.from(repaired,'utf8'));
console.log(`${file}: palautettu ${before} -> ${after} mojibake-sekvenssiä`);
