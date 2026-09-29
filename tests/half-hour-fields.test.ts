import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {XlsxDocument} from '../lib/xlsx-document';
import {fillWorkbook} from '../lib/workbook-export';
import {steps,validateDraft,newDraft} from '../lib/capture';
import {hoursTemplate} from '../lib/hours-template';
import {existingHoursDay} from '../lib/read-hours';
Object.assign(globalThis,{DOMParser,XMLSerializer});

// 1) Kaikki aloitus- ja lopetusajat vain puolen tunnin tarkkuudella.
const hours=newDraft();
Object.assign(hours.values,{vehicle:'ABC-123',date:'2025-03-03',start:'06:00',end:'15:00',startKm:'1000',endKm:'1200',waiting:'',breakMinutes:'',allowance:'1',foreignAllowance:'0',sick:'0',route:'Vantaa - Espoo'});
assert.deepEqual(validateDraft('hours',hours),{},'kokonaiset tunnit kelpaavat');
assert.deepEqual(validateDraft('hours',{...hours,values:{...hours.values,start:'06:30',end:'15:30'}}),{},'puolet tunnit kelpaavat');
for(const bad of ['06:15','06:45','09:07','00:01','23:59']){
 const found=validateDraft('hours',{...hours,values:{...hours.values,start:bad}});
 assert.match(found.start??'',/puolen tunnin/,`alku ${bad} hylätään: ${found.start??'ei virhettä'}`);
}
const endBad=validateDraft('hours',{...hours,values:{...hours.values,end:'16:40'}});
assert.match(endBad.end??'',/puolen tunnin/,'loppu 16:40 hylätään');
// Valinta koskee myös Pamarkin ajolistaa, joka jakaa samat ajan kentät.
const pamark=newDraft();
Object.assign(pamark.values,{vehicle:'ABC-123',date:'2026-09-01',start:'07:30',end:'16:00',startKm:'1000',endKm:'1200',loadingHours:'1',stops:'12',route:'Turku - Salo'});
assert.deepEqual(validateDraft('pamark',pamark),{},'pamarkin puolen tunnin ajat hyväksytään');
const pamarkBad=validateDraft('pamark',{...pamark,values:{...pamark.values,end:'16:15'}});
assert.match(pamarkBad.end??'',/puolen tunnin/,'pamarkin loppu 16:15 hylätään');

// 2) Odotus ja tauko saa jäädä tyhjäksi: se tarkoittaa, ettei kumpaakaan ollut.
assert.equal(validateDraft('hours',hours).waiting,undefined,'tyhjä odotus ei ole virhe');
assert.equal(validateDraft('hours',hours).breakMinutes,undefined,'tyhjä tauko ei ole virhe');
const noWait=newDraft();Object.assign(noWait.values,{vehicle:'ABC-123',date:'2025-03-03',start:'06:00',end:'15:00',startKm:'1000',endKm:'1200',waiting:'',breakMinutes:'',allowance:'1',foreignAllowance:'0',sick:'0',route:'Vantaa - Espoo'});

// Taulukkoon kirjoitetaan nolla, jotta laskukaavat pysyvät numeroina eivätkä
// tyhjä kohta hajoita yhteenvetoja.
const template=new Uint8Array(readFileSync('work/listat-fixtures/Tuntilista Ajuri.xlsx'));
const written=fillWorkbook(template,'hours',{...noWait,values:{...noWait.values,route:'Vantaa'}},'Testi Testiajo',{fresh:false,overwrite:true});
const snapshot=new XlsxDocument(written.bytes).snapshot();
for(const col of ['G','H']){
 assert.equal(snapshot[`${col}${hoursTemplate.entryRows[0]}`].value,0,`${col}-sarakkeeseen kirjoitetaan nolla kun kohta on tyhjä`);
}
const readBack=existingHoursDay(written.bytes,noWait,'Testi Testiajo')!;
assert.equal(readBack.values.waiting,'0','tyhjä odotus luetaan nollaksi');
assert.equal(readBack.values.breakMinutes,'0','tyhjä tauko luetaan nollaksi');

// 3) Pamarkin lastausaika-kenttä näyttää yksikön tunti(a).
const loading=steps.pamark.find(s=>s.field==='loadingHours')!;
assert.equal(loading.label,'Lastausaika? (tunti(a))','lastausajan määre tunti(a) näkyy otsikossa');
console.log('PASS puolen tunnin ajat, tyhjä odotus/tauko tarkoittaa ei ollut, ja lastausajan määre tunti(a)');