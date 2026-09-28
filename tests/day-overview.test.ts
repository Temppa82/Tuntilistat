import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import 'fake-indexeddb/auto';
import {workbookName} from '../lib/workbook-export';
import {putStored,getStored,type SavedWorkbook} from '../lib/local-files';
import {dayOverview} from '../lib/day-overview';
import {importHours} from '../lib/import-hours';
Object.assign(globalThis,{DOMParser,XMLSerializer,window:{dispatchEvent:()=>true}});
// Oikea valmis tuntilista, sama jota käyttäjä tuo puhelimeen.
const ready=new Uint8Array(readFileSync('work/listat-fixtures/Tuntilista Ajuri.xlsx'));
const name='Testi Testiajo';

// Päivitys ei saa piilottaa olemassa olevaa listaa. Puhelimella on vanha
// talletus version 2.10 aliviivanimen alla, ja se on löydettävä uudella
// nimellä, vaikkei päivää ole vielä avattu. Aliviivanimi muodostuu uuden nimen
// etunimestä, joten sen on oltava uuden nimen alku.
const legacyName='Tuntilista_Testi0325.xlsx';
await putStored(`workbook:${legacyName}`,{filename:legacyName,bytes:ready,kind:'hours',updatedAt:'2025-03-03',savedToFolder:false} satisfies SavedWorkbook);
const found=await dayOverview('hours','2025-03-03',name);
assert.equal(found.missing,false,'vanhan nimen alla oleva tuntilista jäi näkymättömäksi');
assert.equal(found.filename,'Tuntilista Testi0325.xlsx','nimen pitää olla uusi, jotta tallennus jatkuu oikeaan avaimeseen');
const days=['2025-03-03','2025-03-04','2025-03-05','2025-03-06'];
assert.deepEqual(found.days.map(d=>d.date),days,'päivät eivät löytyneet vanhan nimen takaa');
assert.equal(await getStored(`workbook:${legacyName}`)!==undefined,true,'lukeminen ei saa poistaa vanhaa tallennusta');

// Tuotu valmis tuntilista näkyy heti uuden nimen alla.
await importHours(ready,name);
const imported=await dayOverview('hours','2025-03-03',name);
assert.equal(imported.missing,false);
assert.deepEqual(imported.days.map(d=>d.date),days);

// Tuntematon kuukausi on edelleen puuttuva, ei virhe.
const empty=await dayOverview('hours','2030-01-05',name);
assert.equal(empty.missing,true);
assert.equal(empty.filename,workbookName('hours','2030-01-05',name));
console.log('PASS day overview: legacy filename found with its days, imported ready list visible, unknown month missing, storage untouched');
