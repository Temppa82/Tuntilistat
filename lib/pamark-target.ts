// Read-only target selection. The adapter must supply raw cell values, not formatted display text.
import { pamarkTemplate, pamarkDayRows, pamarkEntryColumns } from './pamark-template';
export type SheetCell = { value?: string | number | null; formula?: string };
export type SheetSnapshot = Record<string, SheetCell>;
const vehicleKey = (s: string) => s.toUpperCase().replace(/\s/g, '').replace(/[–—]/g, '-');
const empty = (c?: SheetCell) => !!c?.formula || c?.value == null || String(c.value).trim() === '';

export function sheetDate(value: SheetCell['value']): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 61 && value < 2958466) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  let date = text;
  const fi = /^(\d{1,2})\.(\d{1,2})[.\-](\d{2}|\d{4})\.?$/.exec(text);
  if (fi) date = `${fi[3].length === 2 ? '20' : ''}${fi[3]}-${fi[2].padStart(2, '0')}-${fi[1].padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + 'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

export type PamarkTarget = { headerRow: number; row: number; routeRow: number; existing: boolean };
// Every vehicle owns one section. Readers use this to tell "not in the list yet" apart from
// a broken list, so a new vehicle is reported instead of failing the whole day.
export type PamarkSection = { headerRow: number; vehicle: string; label: string };
export function pamarkSections(sheet: SheetSnapshot): PamarkSection[] { return vehicleSections(sheet).map(({ row, vehicle, label }) => ({ headerRow: row, vehicle, label })); }
export function findVehicleHeader(sheet: SheetSnapshot, vehicle: string): number {
  const matches = vehicleSections(sheet).filter(h => h.vehicle === vehicleKey(vehicle));
  if (matches.length > 1) throw new Error('Autolle löytyi useita osioita. Tarkista pohja.');
  return matches[0]?.row ?? 0;
}
export function pamarkFingerprint(sheet: SheetSnapshot, vehicle: string, date: string): string {
  if (!findVehicleHeader(sheet, vehicle)) return 'absent';
  const t = findPamarkTarget(sheet, vehicle, date, false);
  if (!t.existing) return 'absent';
  return JSON.stringify([...pamarkEntryColumns.map(c=>sheet[`${c}${t.row}`]),sheet[`A${t.routeRow}`]].map(c=>({value:c?.value??null,formula:c?.formula??null})));
}
function vehicleSections(sheet: SheetSnapshot) {
  return Object.entries(sheet).flatMap(([address, cell]) => {
    const pos = new RegExp(`^${pamarkTemplate.vehicleCell}(\\d+)$`).exec(address);
    const label = typeof cell.value === 'string' ? pamarkTemplate.vehicleLabel.exec(cell.value.trim()) : null;
    return pos && label ? [{ row: Number(pos[1]), vehicle: vehicleKey(label[1]), label: label[1].trim() }] : [];
  }).sort((a, b) => a.row - b.row);
}
export type PamarkDay = { vehicle: string; label: string; date: string; headerRow: number; row: number; routeRow: number };
// Every stored day of every vehicle section, so a list can be listed and checked as a whole.
export function pamarkDays(sheet: SheetSnapshot): PamarkDay[] {
  const headers = vehicleSections(sheet);
  const days: PamarkDay[] = [];
  headers.forEach((h, i) => {
    const next = headers[i + 1]?.row ?? Infinity;
    for (const row of pamarkDayRows(h.row)) {
      if (row >= next) break;
      const date = sheetDate(sheet[`A${row}`]?.value);
      if (date) days.push({ vehicle: h.vehicle, label: h.label, date, headerRow: h.row, row, routeRow: row + pamarkTemplate.routeOffset });
    }
  });
  return days;
}
export function findPamarkTarget(sheet: SheetSnapshot, vehicle: string, date: string, requireFree = true): PamarkTarget {
  if (sheetDate(date) !== date) throw new Error('Virheellinen päivämäärä.');
  const headers = vehicleSections(sheet);
  const matches = headers.filter(h => h.vehicle === vehicleKey(vehicle));
  if (matches.length !== 1) throw new Error(matches.length ? 'Autolle löytyi useita osioita. Tarkista pohja.' : 'Autoa ei löytynyt listapohjasta.');
  const header = matches[0].row;
  const next = headers.find(h => h.row > header)?.row ?? Infinity;
  const totals = Object.entries(sheet).filter(([address, cell]) => {
    const pos = new RegExp(`^${pamarkTemplate.vehicleCell}(\\d+)$`).exec(address);
    return pos && Number(pos[1]) > header && Number(pos[1]) < next && typeof cell.value === 'string' && pamarkTemplate.totalsLabel.test(cell.value.trim());
  }).map(([address]) => Number(address.slice(1))).sort((a, b) => a - b)[0];
  if (!totals || totals !== header + pamarkTemplate.totalsOffset) throw new Error('Auton osion rakenne poikkeaa hyväksytystä pohjasta.');
  const rows = pamarkDayRows(header);
  const existing = rows.filter(row => sheetDate(sheet[`A${row}`]?.value) === date);
  if (existing.length > 1) throw new Error('Samalle autolle ja päivälle löytyi useita rivejä.');
  if (existing.length) return { headerRow: header, row: existing[0], routeRow: existing[0] + pamarkTemplate.routeOffset, existing: true };
  if (!requireFree) return {headerRow:header,row:0,routeRow:0,existing:false};
  // Formula columns are intentionally excluded; all editable cells, including the route, must be empty.
  if (rows.some(r => !sheet[`A${r}`] || !pamarkTemplate.requiredFormulaColumns.every(c => sheet[`${c}${r}`]?.formula) || !sheet[`${pamarkTemplate.routeColumn}${r + pamarkTemplate.routeOffset}`])) throw new Error('Auton osion päivärivit ovat puutteelliset. Tarkista listapohja.');
  const routeFree = (r: number) => { const c = sheet[`${pamarkTemplate.routeColumn}${r + pamarkTemplate.routeOffset}`]; return empty(c) || /^\s*Reitti\s*:\s*$/i.test(String(c?.value)); };
  const row = rows.find(r => pamarkEntryColumns.every(c => empty(sheet[`${c}${r}`])) && routeFree(r));
  if (!row) throw new Error('Auton osiossa ei ole vapaata ajopäiväriviä.');
  return { headerRow: header, row, routeRow: row + pamarkTemplate.routeOffset, existing: false };
}
