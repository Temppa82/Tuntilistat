import assert from 'node:assert/strict';
import {newDraft,rollToToday,displayDate} from '../lib/capture';
const today='2026-09-23';
const empty=newDraft();empty.values.date='2026-09-15';
assert.equal(rollToToday(empty,today).values.date,today);
const filled=newDraft();filled.values.date='2026-09-15';filled.values.vehicle='ABC-123';filled.values.start='07:00';
assert.equal(rollToToday(filled,today).values.date,'2026-09-15');
const same=newDraft();same.values.date=today;same.values.route='Turku – Salo';
assert.equal(rollToToday(same,today).values.date,today);
assert.equal(rollToToday(same,'2026-09-10').values.date,today);
// Päivämäärä näytetään suomalaisena ja ilman nollaa edessä.
assert.equal(displayDate('2026-09-01'),'1.9.2026');
assert.equal(displayDate('2025-12-24'),'24.12.2025');
assert.equal(displayDate('2025-03-06'),'6.3.2025');
// Kelvottomasta päivästä ei näytetä väärää päivämäärää.
assert.equal(displayDate(''),'');
assert.equal(displayDate('31.12.2025'),'');
assert.equal(displayDate('2025-13-45'),'');
assert.equal(displayDate('2025-02-30'),'');
console.log('PASS: empty drafts roll to today, filled drafts keep their date, never rolls backwards, dates display in Finnish form');