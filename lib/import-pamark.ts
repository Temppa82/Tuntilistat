import {validateDraft,type Draft} from './capture';
import {getStored,putStored,digest,type SavedWorkbook} from './local-files';
import {workbookName,fillWorkbook,EntryConflict,validateTemplate} from './workbook-export';
import {XlsxDocument} from './xlsx-document';
import {pamarkDayList,existingPamarkDayFrom,pamarkDayKey,type PamarkDay} from './read-pamark';
export type PamarkImport = { filename: string; date: string; vehicles: string[]; days: number; written: number; conflicts: string[]; failed: { date: string; reason: string }[] };
const keys = ['start', 'end', 'startKm', 'endKm', 'loadingHours', 'stops', 'route'] as const;
const same = (a: Draft, b: Draft) => a.overnight === b.overnight && keys.every(k => (a.values[k] || '') === (b.values[k] || ''));
// Imports a finished ajolista. Without a local copy the file is kept byte for byte; after that
// every day is merged per vehicle and date, and a differing day is never replaced silently.
export async function importPamark(bytes: Uint8Array, name: string, overwrite = false): Promise<PamarkImport> {
  const doc = new XlsxDocument(bytes);
  validateTemplate(doc, 'pamark');
  const days = pamarkDayList(bytes);
  if (!days.length) throw new Error('Tiedostossa ei ole aloitettuja päivärivejä. Valitse täytetty ajolista.');
  const date = days.map(d => d.date).sort()[0], filename = workbookName('pamark', date, name);
  const vehicles = [...new Set(days.map(d => d.label))];
  const action = async (): Promise<PamarkImport> => {
    const previous = await getStored<SavedWorkbook>(`workbook:${filename}`);
    const keep = async (result: PamarkImport, merged: Uint8Array): Promise<PamarkImport> => {
      if (previous) await putStored(`backup:before-import:${filename}`, previous);
      await putStored(`workbook:${filename}`, { filename, bytes: merged, kind: 'pamark', updatedAt: new Date().toISOString(), savedToFolder: false } satisfies SavedWorkbook);
      // The imported copy is authoritative until explicitly exported, so no older folder file is read over it.
      await putStored(`imported:${filename}`, true);
      window.dispatchEvent(new Event('local-workbooks-changed'));
      return { ...result, filename, vehicles, days: days.length };};
    if (!previous) return keep({ filename, date, vehicles, days: days.length, written: days.length, conflicts: [], failed: [] }, bytes);
    if (await digest(previous.bytes) === await digest(bytes)) return { filename, date, vehicles, days: days.length, written: 0, conflicts: [], failed: [] };
    // Compare parsed days rather than file bytes so re-serialised XLSX is not read as a change.
    let merged = previous.bytes; let written = 0;
    const conflicts: string[] = [], failed: { date: string; reason: string }[] = [];
    const index = new Map<string, PamarkDay[]>();
    for (const d of pamarkDayList(merged)) index.set(pamarkDayKey(d), [...(index.get(pamarkDayKey(d)) || []), d]);
    for (const d of days) {
      const key = pamarkDayKey(d);
      const wanted = existingPamarkDayFrom(bytes, d);
      const current = index.get(key)?.[0] ? existingPamarkDayFrom(merged, index.get(key)![0]) : undefined;
      if (current && same(current, wanted)) continue;
      const problems = Object.values(validateDraft('pamark', wanted)).filter((v, i, a) => a.indexOf(v) === i);
      if (problems.length) { failed.push({ date: `${d.label} ${d.date}`, reason: problems.join(' ') }); continue; }
      try { merged = fillWorkbook(merged, 'pamark', wanted, name, { fresh: false, overwrite }).bytes; written++; }
      catch (e) { if (e instanceof EntryConflict) conflicts.push(`${d.label} ${d.date}`); else failed.push({ date: `${d.label} ${d.date}`, reason: e instanceof Error ? e.message : 'Päivää ei voitu lisätä.' }); }
    }
    if (!written && !overwrite) return { filename, date, vehicles, days: days.length, written, conflicts, failed };
    return keep({ filename, date, vehicles, days: days.length, written, conflicts, failed }, merged);
  };
  return navigator.locks ? navigator.locks.request(`ajolista:${filename}`, action) : action();
}
