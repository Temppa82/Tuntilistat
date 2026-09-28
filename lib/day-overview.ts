import type {ListKind} from './capture';
import {workbookName} from './workbook-export';
import {storedWorkbook} from './period-files';
import {hoursDays} from './read-hours';
import {pamarkDayList} from './read-pamark';
export type DayOverview = { key: string; date: string; vehicle: string; label: string; sub: string };
const fi = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.${d.slice(0, 4)}`;
// Every day of the list the given date belongs to, so the whole period can be checked and edited
// without knowing the dates in advance. The vehicle is the primary key of an ajolista day.
export async function dayOverview(kind: ListKind, date: string, name: string): Promise<{ filename: string; days: DayOverview[]; missing: boolean }> {
  const filename = workbookName(kind, date, name);
  // Also finds a list stored under an older filename, so a rename cannot hide it.
  const stored = await storedWorkbook(kind, date, name);
  if (!stored?.bytes) return { filename, days: [], missing: true };
  if (kind === 'hours') {
    const days = hoursDays(stored.bytes, name).sort();
    return { filename, missing: false, days: days.map(d => ({ key: d, date: d, vehicle: '', label: fi(d), sub: 'Tuntilista' })) };
  }
  const days = pamarkDayList(stored.bytes).sort((a, b) => a.headerRow - b.headerRow || a.row - b.row);
  return { filename, missing: false, days: days.map(d => ({ key: `${d.vehicle}|${d.date}`, date: d.date, vehicle: d.label, label: `${d.label} · ${fi(d.date)}`, sub: 'Ajolista' })) };
}
