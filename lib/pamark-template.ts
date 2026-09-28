/** Verified against Pamark ajolista syyskuu 1-2 2026.xlsx. Does not write or alter the workbook.
 *
 * Every vehicle owns one section. The section header row carries AUTO: and KULJETTAJA:,
 * the day rows follow every other row with the route in between, and the section ends
 * with a Yhteensä: row. The layout is declared once here and used by the target search,
 * the template check, the clearing and the write, so the column letters cannot drift
 * apart from each other.
 */
// Kellonajan muunnosta käytetään molemmissa listoissa, joten se on yksi ja sama.
import { clockToSheetTime } from './hours-template';
export const pamarkTemplate = {
  sourceName: 'Pamark ajolista syyskuu 1-2 2026.xlsx',
  sheet: 'Taulukko1',
  /** AUTO: reg number in the section header. */
  vehicleCell: 'E',
  vehicleLabel: /^AUTO\s*:\s*(.+)$/i,
  driverCell: 'A',
  driverLabel: 'KULJETTAJA:',
  /** First day row of a section, relative to its header row. */
  firstDayOffset: 3,
  /** Day row, route row, day row, ... */
  rowStride: 2,
  daysPerSection: 12,
  /** Yhteensä: row of a section, relative to its header row. */
  totalsOffset: 27,
  totalsLabel: /^Yhteens[aä]/i,
  columns: {
    date: 'A', start: 'B', end: 'C', startKm: 'D', endKm: 'E',
    loadingHours: 'H', stops: 'K',
  } as const,
  /** F, G, I and M stay as the template's own formulas and are never written. */
  computedColumns: ['F', 'G', 'I', 'M'] as const,
  /** Verified minimum a day row must have: the per-day km and hours the totals read. */
  requiredFormulaColumns: ['F', 'I'] as const,
  routeColumn: 'A' as const,
  routeOffset: 1,
} as const;

/** Every editable column of a section, in the order used when checking a free row. */
export const pamarkEntryColumns: string[] = Object.values(pamarkTemplate.columns);

/** The twelve day rows of a section. */
export function pamarkDayRows(headerRow: number): number[] {
  return Array.from({ length: pamarkTemplate.daysPerSection }, (_, i) => headerRow + pamarkTemplate.firstDayOffset + i * pamarkTemplate.rowStride);
}

export function hoursToSheetDuration(hours: number) {
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw new Error('Tarkista tuntimäärä.');
  return hours / 24;
}

const toDateSerial = (date: string) => {
  const parsed = new Date(date + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Virheellinen päivämäärä.');
  return (parsed.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
};

/** Same shape as hoursEntryCells: one validated, declared mapping from a day to cells. */
export function pamarkEntryCells(headerRow: number, row: number, entry: {
  date: string; start: string; end: string; startKm: number; endKm: number;
  loadingHours: number; stops: number; route: string; overnight: boolean;
}): Record<string, string | number> {
  if (!pamarkDayRows(headerRow).includes(row)) throw new Error('Virheellinen ajolistan rivi.');
  const { date, start, end, startKm, endKm, loadingHours, stops, route, overnight } = entry;
  if (![startKm, endKm, stops].every(n => Number.isSafeInteger(n) && n >= 0) || endKm < startKm) throw new Error('Virheellinen kilometrilukema.');
  const c = pamarkTemplate.columns;
  const from = clockToSheetTime(start), to = clockToSheetTime(end, overnight);
  if (to <= from || to - from > 1) throw new Error('Tarkista työpäivän kellonajat.');
  return {
    [`${c.date}${row}`]: toDateSerial(date),
    [`${c.start}${row}`]: from, [`${c.end}${row}`]: to,
    [`${c.startKm}${row}`]: startKm, [`${c.endKm}${row}`]: endKm,
    [`${c.loadingHours}${row}`]: hoursToSheetDuration(loadingHours),
    [`${c.stops}${row}`]: stops,
    [`${pamarkTemplate.routeColumn}${row + pamarkTemplate.routeOffset}`]: `Reitti: ${route.trim()}`,
  };
}
