import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {workbookName,legacyWorkbookNames} from '../lib/workbook-export';
// Ajolistan tiedoston nimi kertoo jakson, jonka päivät lista sisältää:
// päivät 1-15 ovat "1-2" ja päivät 16-30 ovat "2-2". Molemmat puoliskot ovat
// eri tiedostoja, eikä kumpaanka saa unohtaa.
const name='Testi Testiajo';
assert.equal(workbookName('pamark','2026-09-01',name),'Pamark ajolista syyskuu 1-2 2026.xlsx');
assert.equal(workbookName('pamark','2026-09-15',name),'Pamark ajolista syyskuu 1-2 2026.xlsx');
assert.equal(workbookName('pamark','2026-09-16',name),'Pamark ajolista syyskuu 2-2 2026.xlsx');
assert.equal(workbookName('pamark','2026-09-30',name),'Pamark ajolista syyskuu 2-2 2026.xlsx');
assert.equal(workbookName('pamark','2026-10-16',name),'Pamark ajolista lokakuu 2-2 2026.xlsx');
assert.equal(workbookName('pamark','2026-10-01',name),'Pamark ajolista lokakuu 1-2 2026.xlsx');
assert.notEqual(workbookName('pamark','2026-09-20',name),workbookName('pamark','2026-09-05',name));
// Tuntilista nimi on edelleen etunimi kk vv. Ajurin oma etunimi tulee nimestä,
// joten testi tarkistaa muotoa oman testinimensä avulla.
assert.equal(workbookName('hours','2026-09-20',name),'Tuntilista Testi0926.xlsx');
assert.equal(workbookName('hours','2025-03-03',name),'Tuntilista Testi0325.xlsx');
// Käyttäjän olemassa oleva tiedosto on löydettävissä siltä päivältä, jolta jakso alkaa.
const months=['tammikuu','helmikuuu','maaliskuuu','huhtikuuu','toukokuu','kesäkuu','heinäkuu','elokuu','syyskuu','lokakuu','marraskuu','joulukuu'];
for(const f of readdirSync('work/listat-fixtures').filter(f=>/^Pamark ajolista .*\.xlsx$/.test(f))){
 const m=/^Pamark ajolista (\w+) (\d)-2 (\d{4})\.xlsx$/.exec(f);
 assert.ok(m,`tiedoston ${f} nimeä ei voi jäsentää`);
 const month=months.indexOf(m![1])+1;assert.notEqual(month,0,`tuntematon kuukausi ${m![1]}`);
 const firstDay=m![2]==='1'?1:16;
 const iso=`${m![3]}-${String(month).padStart(2,'0')}-${String(firstDay).padStart(2,'0')}`;
 assert.equal(workbookName('pamark',iso,name),f,`tiedosto ${f} ei löydy päivältä ${iso}`);
}
// Jakso vaihtuu täsmälleen 16. päivänä.
for(const d of [14,15,16,17])assert.equal(workbookName('pamark',`2026-09-${d}`,name),`Pamark ajolista syyskuu ${d<16?1:2}-2 2026.xlsx`);
// Tuntilistan vanhat nimet ovat edelleen tuettuja.
assert.deepEqual(legacyWorkbookNames('hours','2026-09-20',name),['Tuntilista_Testi0926.xlsx',`Tuntilista Testi Testiajo syyskuu 2026.xlsx`]);
assert.deepEqual(legacyWorkbookNames('pamark','2026-09-20',name),[]);
console.log('PASS workbook name: ajolista 1-2 on päivät 1-15 ja 2-2 on päivät 16-30, ja olemassa oleva tiedosto löytyy');
