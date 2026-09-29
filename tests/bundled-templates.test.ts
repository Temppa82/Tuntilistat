import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {XlsxDocument} from '../lib/xlsx-document';
import {validateTemplate,emptyWorkbook} from '../lib/workbook-export';
import {applyVehicles,defaults} from '../lib/vehicle-settings';
import {bundledTemplateBytes} from '../lib/templates-data';
import {pamarkDayList} from '../lib/read-pamark';
import {pamarkSections} from '../lib/pamark-target';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const hours=bundledTemplateBytes('hours'),pamark=bundledTemplateBytes('pamark');
assert.doesNotThrow(()=>validateTemplate(new XlsxDocument(hours),'hours'));
assert.doesNotThrow(()=>validateTemplate(new XlsxDocument(pamark),'pamark'));
assert.equal(new XlsxDocument(pamark).snapshot().O103.formula,'F103*(I100/100)*0.13');
// Upotetussa ajolistassa ei saa olla muiden ajurien kirjauksia: ne loivat
// valheellisia ristiriitoja uusille päiville. Rekisteritunnukset ja KULJETTAJA-
// otsikot säilyvät, joten sektioihin osataan silti kohdistaa.
const snap=new XlsxDocument(pamark).snapshot();
assert.equal(pamarkDayList(pamark).length,0,'upotetussa ajolistassa on kirjauksia');
const regs=pamarkSections(snap).map(s=>s.vehicle);
assert.ok(regs.includes('JTS-790')&&regs.includes('ENR-210'),'ajoneuvotunnukset eivät säilyneet pohjassa');
const today='2026-10-01';
const blankHours=emptyWorkbook(hours,'hours',today,'Testi Testiajo');
const blankPamark=applyVehicles(emptyWorkbook(pamark,'pamark',today,'Testi Testiajo'),defaults);
const s=new XlsxDocument(blankPamark).snapshot();
assert.equal(s.I1.value,24);assert.equal(s.I65.value,12);assert.equal(s.O103.formula,'F103*($I$98/100)*0.13');
console.log('PASS: bundled templates validate, driver header set, vehicles applied, broken O103 fixed and rewritten');