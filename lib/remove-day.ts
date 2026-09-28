// Poistaa yhdelle päivälle kirjatut tiedot kokonaan: solut tyhjennetään
// taulukosta ja päivän jälkeen jäänyt välimuistiluonnos hävitetään.
//
// Kaavoja ei kosketa lainkaan. doc.set(…, null) poistaa solusta vain arvon,
// ei <f>-elementtiä, ja doc.bytes() jättää jaettujen kaavojen si- ja
// ref-attribuutit paikalleen. Tuntilistan päiväkohtaiset kaavat (L, M) ja
// yhteensärivi, samoin ajolistan F, G, I, M ja O säilyvät, joten poisto ei
// riko laskentaa.
import { hoursTemplate, hoursEntryColumns } from './hours-template';
import { pamarkTemplate, pamarkEntryColumns } from './pamark-template';
import { findPamarkTarget, sheetDate } from './pamark-target';
import { XlsxDocument } from './xlsx-document';
import { workbookName } from './workbook-export';
import { ensurePeriod } from './period-files';
import { dayKey } from './day-drafts';
import type { ListKind } from './capture';
import { getStored, putStored, deleteStored, sharedDirectory, readWorkbook, writeWorkbook, permit, type SavedWorkbook } from './local-files';

export type RemovedDay = { removed: boolean; filename: string; row?: number };

const listName = (kind: ListKind) => (kind === 'pamark' ? 'Ajolista' : 'Tuntilista');

// Tyhjennetään päivän kaikki kirjattavat solut ja reittirivi. Pelkkä
// päiväsolun tyhjennys ei riitä, vaan reittiteksti jäisi roikkumaan.
// Laskusolut eivät kuulu tyhjennettäviin, joten ne säilyvät.
function clearedCells(kind: ListKind, row: number, routeRow: number): Record<string, null> {
  const cleared: Record<string, null> = {};
  for (const column of kind === 'pamark' ? pamarkEntryColumns : hoursEntryColumns) cleared[`${column}${row}`] = null;
  const routeColumn = kind === 'pamark' ? pamarkTemplate.routeColumn : hoursTemplate.routeColumn;
  cleared[`${routeColumn}${routeRow}`] = null;
  return cleared;
}

// Päivän rivi haetaan päivämäärän perusteella. Tuntilistassa päivä on yksilöity
// päivämäärällä, ajolistassa autolla ja päivämäärällä.
function findRow(doc: XlsxDocument, kind: ListKind, date: string, vehicle: string): { row: number; routeRow: number } | undefined {
  const sheet = doc.snapshot();
  if (kind === 'hours') {
    const row = hoursTemplate.entryRows.find(r => sheetDate(sheet[`A${r}`]?.value) === date);
    return row === undefined ? undefined : { row, routeRow: row + hoursTemplate.routeOffset };
  }
  const target = findPamarkTarget(sheet, vehicle, date, false);
  return target.existing ? { row: target.row, routeRow: target.routeRow } : undefined;
}

async function removeDay(kind: ListKind, date: string, vehicle: string, name: string, required: boolean): Promise<RemovedDay> {
  const filename = workbookName(kind, date, name);
  // Varmistetaan ensin, että jakso on käytettävissä, ja vasta sitten lukitaan
  // tiedosto. Kahden lukon pitäminen päällekkäin olisi turha odotus.
  await ensurePeriod(kind, date, name);
  const action = async (): Promise<RemovedDay> => {
    // Muistiluonnos hävitetään kaikissa tapauksissa, jotta kesken jäänyt
    // täyttö ei jäisi roikkumaan, vaikka päivää ei olisi tallennettu lainkaan.
    const forget = () => deleteStored(dayKey(kind, name, date, vehicle));
    const record = await getStored<SavedWorkbook>(`workbook:${filename}`);
    if (!record?.bytes) {
      if (required) throw new Error(`${listName(kind)} puuttuu.`);
      await forget();
      return { removed: false, filename };
    }
    // Kansio luetaan ennen muokkausta, jotta writeWorkbook huomaa, jos joku
    // kirjoittaa samaan tiedostoon poistamisen aikana.
    const dir = await getStored<boolean>(`imported:${filename}`) ? undefined : await sharedDirectory();
    if (dir) await permit(dir);
    const disk = dir ? await readWorkbook(dir, filename) : undefined;
    const doc = new XlsxDocument(record.bytes);
    let found: { row: number; routeRow: number } | undefined;
    try {
      found = findRow(doc, kind, date, vehicle);
    } catch (e) {
      // Hylkäyksessä riittää, ettei päivää ole tallennettu: esimerkiksi
      // autta, jota listasta ei löydy, ei saa estää lomakkeen tyhjentämistä.
      if (required) throw e;
    }
    if (!found) {
      await forget();
      return { removed: false, filename };
    }
    doc.patch(clearedCells(kind, found.row, found.routeRow));
    const bytes = doc.bytes();
    const saved = { filename, bytes, kind, updatedAt: new Date().toISOString(), savedToFolder: false } satisfies SavedWorkbook;
    await putStored(`workbook:${filename}`, saved);
    if (dir && await writeWorkbook(dir, filename, bytes, disk)) await putStored(`workbook:${filename}`, { ...saved, savedToFolder: true } satisfies SavedWorkbook);
    await forget();
    window.dispatchEvent(new Event('local-workbooks-changed'));
    return { removed: true, filename, row: found.row };
  };
  return navigator.locks ? navigator.locks.request(`ajolista:${filename}`, action) : action();
}

/**
 * Poistaa päivän listanäkymän napista. Turvallinen toistettavaksi: jos päivä on
 * jo poissa, mitään ei kirjoiteta eikä toiminto heitä virhettä.
 */
export function removeListedDay(kind: ListKind, date: string, vehicle: string, name: string): Promise<RemovedDay> {
  return removeDay(kind, date, vehicle, name, true);
}

/**
 * Hylkää keskeneräisen täytön. Poistaa päivän vain jos se on tallennettu, eikä
 * heitä virhettä tyhjästä listasta, joten lomake saa aina tyhjennettua.
 */
export function discardSavedDay(kind: ListKind, date: string, vehicle: string, name: string): Promise<RemovedDay> {
  return removeDay(kind, date, vehicle, name, false);
}
