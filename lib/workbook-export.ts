import { XlsxDocument } from './xlsx-document';
import { findPamarkTarget, sheetDate, type SheetSnapshot } from './pamark-target';
import { pamarkTemplate, pamarkDayRows, pamarkEntryColumns, pamarkEntryCells } from './pamark-template';
import { hoursTemplate, hoursEntryCells } from './hours-template';
import { months, normalizeVehicle, parseNumber, validateDraft, validDate, type Draft, type ListKind } from './capture';

export type EntryCellDiff = { col: string; old: string | number | null | undefined; new: string | number | null | undefined };
export class EntryConflict extends Error {
  diffs: EntryCellDiff[] = [];
  constructor(diffs: EntryCellDiff[] = []) {
    super('Tälle päivälle on jo erilainen kirjaus. Tarkista tiedosto ennen korvaamista.');
    this.name = 'EntryConflict';
    this.diffs = diffs;
  }
}
export function workbookName(kind: ListKind, date: string, name: string) {
  if (!validDate(date)) throw new Error('Virheellinen päivämäärä.');
  const [y, m, d] = date.split('-').map(Number);
  const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().slice(0, 80);
  // Ajolistan tiedoston nimi kertoo jakson, jonka päivät lista sisältää:
  // päivät 1-15 ovat "1-2" ja päivät 16-30 ovat "2-2".
  return kind === 'pamark' ? `Pamark ajolista ${months[m - 1]} ${d <= 15 ? 1 : 2}-2 ${y}.xlsx` : `Tuntilista ${safeName.split(/\s+/)[0]}${String(m).padStart(2,'0')}${String(y).slice(-2)}.xlsx`;
}
// Aiemmat versiot nimesivät tuntilistan aliviivalla. Vanhat nimet on löydettävä,
// muuten jo kirjatut päivät näyttäisivät kadonneilta nimen vaihtuessa. Uusi
// nimi syntyy vanhasta korvaamalla ensimmäisen välin aliviivalla, joten mitään
// muuta ei tarvitse arvata jälkikäteen.
export function legacyWorkbookNames(kind: ListKind, date: string, name: string) {
  if (kind !== 'hours') return [];
  const [y, m] = date.split('-').map(Number);
  return [
    workbookName(kind, date, name).replace(' ', '_'),
    `Tuntilista ${name.trim()} ${months[m - 1]} ${y}.xlsx`,
  ];
}
export function emptyWorkbook(bytes:Uint8Array,kind:ListKind,date:string,name:string){
 if(!validDate(date)||name.trim().length<3)throw new Error('Tarkista nimi ja päivämäärä.');
 const doc=new XlsxDocument(bytes);validateTemplate(doc,kind);clearTemplate(doc,kind);
 if(kind==='hours'){doc.set('A1',`Kuljettaja: ${name.trim()}`);doc.set('G1',`VUOSI/KUUKAUSI: ${date.slice(0,4)}/${Number(date.slice(5,7))}`);}
 return doc.bytes();
}
const pamarkHeaders = (s: SheetSnapshot) => Object.keys(s).filter(a => new RegExp(`^${pamarkTemplate.vehicleCell}\\d+$`).test(a) && pamarkTemplate.vehicleLabel.test(String(s[a].value))).map(a => Number(a.slice(1))).sort((a,b)=>a-b);
export function validateTemplate(doc: XlsxDocument, kind: ListKind) {
  const s = doc.snapshot();
  if (kind === 'hours') {
    if (String(s.H2?.value).trim() !== 'Ventat' || String(s.K2?.value).trim() !== 'Sairas pv.' || !s.L3?.formula || !s.M3?.formula || hoursTemplate.entryRows.some(r => !s[`L${r}`]?.formula || !s[`M${r}`]?.formula)) throw new Error(`Valitse ${hoursTemplate.sourceName} -pohja. Tämä tiedosto ei vastaa tuntilistan rakennetta.`);
  } else {
    // Vain todennettu vähimmäismäärä vaaditaan. Liian tiukka tarkistus hylkäisi
    // oman listan, jossa jokin päivärivi on tyhjä kaavoja, ja estäisi tallennuksen.
    const headers = pamarkHeaders(s);
    if (!headers.length || headers.some(h => !pamarkTemplate.requiredFormulaColumns.every(c => s[`${c}${h+pamarkTemplate.firstDayOffset}`]?.formula))) throw new Error('Tiedosto ei vastaa Pamarkin ajolistan rakennetta. Jokaisella autolla on oma AUTO: -osio.');
  }
}
export function clearTemplate(doc: XlsxDocument, kind: ListKind) {
  const s = doc.snapshot();
  const clear = (a: string, value: string | null = null) => { if (s[a] && !s[a].formula) doc.set(a, value); };
  if (kind === 'hours') for (const r of hoursTemplate.entryRows) {
    for (const c of 'ABCDEFGHIJK') clear(`${c}${r}`);
    clear(`A${r+1}`, 'Reitti:');
  } else for (const h of pamarkHeaders(s)) {
    clear(`${pamarkTemplate.driverCell}${h}`, `${pamarkTemplate.driverLabel}`);
    for (const r of pamarkDayRows(h)) {
      for (const c of pamarkEntryColumns) clear(`${c}${r}`);
      clear(`${pamarkTemplate.routeColumn}${r + pamarkTemplate.routeOffset}`);
    }
  }
}
function checkPeriod(s: SheetSnapshot, rows: number[], kind: ListKind, date: string) {
  for (const row of rows) {
    const raw = s[`A${row}`]?.value;
    if (raw == null || raw === '') continue;
    const found = sheetDate(raw);
    if (!found) throw new Error(`Rivin ${row} päivämäärää ei tunnistettu.`);
    if (found.slice(0,7) !== date.slice(0,7) || (kind === 'pamark' && (Number(found.slice(8))<=15)!==(Number(date.slice(8))<=15))) throw new Error('Tiedostossa on toisen kuukauden tai jakson kirjauksia. Valitse oikea tiedosto.');
  }
}
export function validatePamarkPeriod(bytes:Uint8Array,date:string){const doc=new XlsxDocument(bytes);validateTemplate(doc,'pamark');const s=doc.snapshot();checkPeriod(s,pamarkHeaders(s).flatMap(h=>pamarkDayRows(h)),'pamark',date);}
export function fillWorkbook(bytes: Uint8Array, kind: ListKind, draft: Draft, name: string, options: {fresh: boolean; overwrite?: boolean; shared?: boolean}) {
  const errors = validateDraft(kind, draft);
  if (Object.keys(errors).length) throw new Error('Täytä ja tarkista kaikki päivän tiedot ennen tallennusta.');
  // In the shared list the section is chosen by the registration number, so no name is needed
  // and the names already in the file are left exactly as they are.
  if (!options.shared && name.trim().length < 3) throw new Error('Kirjoita kuljettajan nimi.');
  const doc = new XlsxDocument(bytes); validateTemplate(doc, kind);
  if (options.fresh) clearTemplate(doc, kind);
  const s = doc.snapshot(), v = draft.values;
  let row: number, existing: boolean, patch: Record<string, string | number | null>;
  if (kind === 'hours') {
    checkPeriod(s, hoursTemplate.entryRows, kind, v.date);
    if (!options.fresh && String(s.A1?.value).replace(/^Kuljettaja:\s*/i,'').trim().toLocaleLowerCase('fi') !== name.trim().toLocaleLowerCase('fi')) throw new Error('Tuntilista kuuluu toiselle kuljettajalle.');
    const matches = hoursTemplate.entryRows.filter(r=>sheetDate(s[`A${r}`]?.value)===v.date);
    if (matches.length > 1) throw new Error('Päivälle löytyi useita rivejä. Tarkista tuntilista.');
    existing = matches.length === 1;
    row = matches[0] ?? hoursTemplate.entryRows.find(r => [...'ABCDEFGHIJK'].every(c => s[`${c}${r}`]?.value == null || s[`${c}${r}`]?.value === '') && /^\s*(Reitti:)?\s*$/.test(String(s[`A${r+1}`]?.value || '')))!;
    if (!row) throw new Error('Tuntilistan kaikki päivärivit ovat käytössä.');
    if(v.sick==='1'&&![v.start,v.end,v.startKm,v.endKm].some(Boolean)) {
      patch=Object.fromEntries(['B','C','D','E','G','H'].map(c=>[`${c}${row}`,null]));
      Object.assign(patch,{[`A${row}`]:(Date.parse(v.date+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000,[`I${row}`]:Number(v.allowance),[`J${row}`]:Number(v.foreignAllowance),[`K${row}`]:1,[`A${row+1}`]:`Reitti: ${[normalizeVehicle(v.vehicle),v.route||'Sairas'].filter(Boolean).join(' | ')}`});
    }else patch = hoursEntryCells(row, {vehicle:normalizeVehicle(v.vehicle),date:v.date,start:v.start,end:v.end,startKm:parseNumber(v.startKm),endKm:parseNumber(v.endKm),waiting:parseNumber(v.waiting),breakMinutes:parseNumber(v.breakMinutes),allowance:v.allowance==='1',foreignAllowance:v.foreignAllowance==='1',sick:v.sick==='1',route:v.route,overnight:draft.overnight});
  } else {
    const rows = pamarkHeaders(s).flatMap(h=>pamarkDayRows(h));
    checkPeriod(s, rows, kind, v.date);
    const target = findPamarkTarget(s, v.vehicle, v.date); row=target.row; existing=target.existing;
    patch = pamarkEntryCells(target.headerRow, target.row, {
      date: v.date, start: v.start, end: v.end,
      startKm: parseNumber(v.startKm), endKm: parseNumber(v.endKm),
      loadingHours: parseNumber(v.loadingHours), stops: parseNumber(v.stops),
      route: v.route, overnight: draft.overnight,
    });
    // A shared vehicle may have several drivers during the period: do not replace other names.
    if (!options.shared) {
      const prior = String(s[`A${target.headerRow}`]?.value || '').replace(/^KULJETTAJA:\s*/i,'').trim();
      const names = prior.split(' / ').filter(Boolean);
      if (!names.some(n=>n.toLowerCase()===name.trim().toLowerCase())) names.push(name.trim());
      doc.set(`A${target.headerRow}`, `KULJETTAJA: ${names.join(' / ')}`);
    }
  }
  if (existing && !options.overwrite && Object.entries(patch).some(([a,value])=> {
    const old=s[a]?.value;
    if (a===`A${row}`) return sheetDate(old)!==v.date;
    return typeof value==='number' && typeof old==='number' ? Math.abs(value-old)>1e-9 : old!==value;
  })) {
    const diffs: EntryCellDiff[] = Object.entries(patch).map(([addr,value])=>({
      col:addr,
      old: s[addr]?.value ?? null,
      new: value ?? null
    }));
    const conflict = new EntryConflict(diffs);
    throw conflict;
  }
  doc.patch(patch);
  if (kind==='hours') { doc.set('A1',`Kuljettaja: ${name.trim()}`); doc.set('G1',`VUOSI/KUUKAUSI: ${v.date.slice(0,4)}/${Number(v.date.slice(5,7))}`); }
  return {bytes:doc.bytes(),row,filename:workbookName(kind,v.date,name)};
}
