/** Verified against the bundled driver list template. Does not write or alter the workbook. */
export const hoursTemplate = {
  sourceName: 'Tuntilista Ajuri.xlsx',
  sheet: 'Taulukko1',
  driver: 'A1',
  month: 'G1',
  entryRows: Array.from({ length: 28 }, (_, i) => 3 + i * 3),
  columns: {
    date: 'A', start: 'B', startKm: 'C', end: 'D', endKm: 'E',
    refuelling: 'F', breakMinutes: 'G', waiting: 'H',
    halfAllowance: 'I', foreignAllowance: 'J', sick: 'K',
  },
  // L/M and all summary formulas remain untouched. Route rows are merged A:M.
  computedColumns: ['L', 'M'],
  routeColumn: 'A',
  routeOffset: 1,
} as const;

/**
 * Kirjattavat solut. F (Tankkaus) täytetään käsin, joten se kuuluu päivän
 * poistettaviin soluihin. L ja M ovat laskukaavoja, eivätkä koskeudu.
 */
export const hoursEntryColumns: readonly string[] = Object.values(hoursTemplate.columns);

export function minutesToSheetDuration(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) throw new Error('Virheellinen kesto.');
  return minutes / 1440;
}

export function clockToSheetTime(clock: string, nextDay = false) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) throw new Error('Virheellinen kellonaika.');
  const [h, m] = clock.split(':').map(Number);
  // Existing end-start formulas work over midnight when the end value includes one day.
  return (h * 60 + m) / 1440 + (nextDay ? 1 : 0);
}

export function hoursEntryCells(row: number, entry: {
  vehicle: string; date: string; start: string; end: string; startKm: number; endKm: number;
  breakMinutes: number; waiting: number; allowance: boolean; foreignAllowance: boolean;
  sick: boolean; route: string; overnight: boolean;
}): Record<string, string | number> {
  if (!hoursTemplate.entryRows.includes(row)) throw new Error('Virheellinen tuntilistan rivi.');
  const date = new Date(entry.date + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== entry.date) throw new Error('Virheellinen päivämäärä.');
  if (![entry.startKm, entry.endKm].every(n => Number.isSafeInteger(n) && n >= 0) || entry.endKm < entry.startKm) throw new Error('Virheellinen kilometrilukema.');
  const start = clockToSheetTime(entry.start), end = clockToSheetTime(entry.end, entry.overnight);
  if (end <= start || end - start > 1) throw new Error('Tarkista työpäivän kellonajat.');
  return {
    [`A${row}`]: (date.getTime() - Date.UTC(1899, 11, 30)) / 86400000,
    [`B${row}`]: start, [`C${row}`]: entry.startKm,
    [`D${row}`]: end, [`E${row}`]: entry.endKm,
    [`G${row}`]: minutesToSheetDuration(entry.breakMinutes),
    [`H${row}`]: minutesToSheetDuration(entry.waiting),
    [`I${row}`]: Number(entry.allowance), [`J${row}`]: Number(entry.foreignAllowance),
    [`K${row}`]: Number(entry.sick),
    [`A${row + 1}`]: `Reitti: ${entry.vehicle.trim().toUpperCase()} | ${entry.route.trim()}`,
  };
}
