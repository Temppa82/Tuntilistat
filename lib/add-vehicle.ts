import {normalizeVehicle,parseNumber} from './capture';
import {XlsxDocument} from './xlsx-document';
import {pamarkSections} from './pamark-target';
import type {VehicleData} from './vehicle-settings';
// A vehicle block is 32 rows: header, spacer, column labels, twelve two-row days and the totals.
export const SECTION_STRIDE = 32;
const sum = (column: string, first: number) => Array.from({ length: 12 }, (_, i) => `${column}${first + i * 2}`).join('+');
// Adds a vehicle that is not in the list yet. The new block is a copy of the last section's
// labels and formulas, so a later day lookup and the totals behave exactly like the older ones.
export function addVehicleSection(bytes: Uint8Array, reg: string, driver: string, data: VehicleData = { consumption: '0', emission: '0' }): Uint8Array {
  const key = normalizeVehicle(reg);
  if (!key) throw new Error('Anna auton rekisterinumero.');
  const doc = new XlsxDocument(bytes), s = doc.snapshot();
  const sections = pamarkSections(s);
  if (sections.some(x => x.vehicle === key)) throw new Error(`Autolla ${key} on jo oma osio listassa.`);
  const last = sections[sections.length - 1];
  if (!last) throw new Error('Listasta ei löytynyt yhtään auton osiota.');
  const emission = parseNumber(data.emission), consumption = parseNumber(data.consumption);
  if (!Number.isFinite(emission) || !Number.isFinite(consumption)) throw new Error('Anna päästö- ja kulutusarvot asetuksissa.');
  const h = last.headerRow + SECTION_STRIDE, first = h + 3, totals = h + 27;
  const copy = (from: number, to: number) => {
    for (const [address, cell] of Object.entries(s)) {
      if (new RegExp(`^[A-Z]+${from}$`).test(address) && (cell.value != null || cell.formula)) {
        const target = address.replace(String(from), String(to));
        if (cell.formula) doc.setFormula(target, cell.formula.replace(new RegExp(`([A-Z]+)${from}`, 'g'), `$1${to}`));
        else doc.set(target, cell.value as string | number);
      }
    }
  };
  copy(last.headerRow + 2, h + 2);
  doc.set(`A${h}`, `KULJETTAJA: ${driver.trim()}`);
  doc.set(`E${h}`, `AUTO: ${key}`);
  doc.set(`G${h}`, `CO2/ ${String(emission).replace('.', ',')}g/ltr`);
  doc.set(`I${h}`, consumption);
  for (let r = first; r <= h + 25; r += 2) {
    doc.set(`A${r}`, null);
    doc.set(`A${r + 1}`, 'Reitti:');
    doc.setFormula(`F${r}`, `E${r}-D${r}`);
    doc.setFormula(`G${r}`, `C${r}-B${r}-H${r}`);
    doc.setFormula(`I${r}`, `C${r}-B${r}`);
    doc.setFormula(`M${r}`, `K${r}/I${r}/24`);
    doc.setFormula(`O${r}`, `F${r}*($I$${h}/100)*${emission}`);
  }
  doc.set(`E${totals}`, 'Yhteensä:');
  doc.setFormula(`F${totals}`, sum('F', first));
  doc.setFormula(`G${totals}`, sum('G', first));
  doc.setFormula(`H${totals}`, sum('H', first));
  doc.setFormula(`I${totals}`, sum('I', first));
  doc.setFormula(`K${totals}`, sum('K', first));
  doc.setFormula(`M${totals}`, `K${totals}/I${totals}/24`);
  doc.setFormula(`O${totals}`, sum('O', first));
  return doc.bytes();
}
