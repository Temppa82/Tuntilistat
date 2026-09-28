// Kumoa-toiminnon vaihehistoria. Vaiheen sisään tullut tila muistetaan heti
// ensimmäisestä muutoksesta, jotta Kumoa toimii myös silloin kun käyttäjä on
// vielä muokkaamassaan kysymyksessä. Yksi Kumoa palauttaa sen kysymyksen
// alkuperäisen arvon, eikä historia täyty merkki kerrallaan.
//
// Historia pidetään vain tämän istunnon muistissa eikä se kuulu tallennettavaan
// luonnokseen, joten se ei kasva rajatta.
import type { Draft, Field } from './capture';

export type DraftSnapshot = { values: Record<Field, string>; overnight: boolean };
export type HistoryEntry = DraftSnapshot & { step: number };
export const historyLimit = 20;

export const snapshot = (draft: Draft): DraftSnapshot => ({ values: { ...draft.values }, overnight: draft.overnight });
export function sameSnapshot(a: DraftSnapshot, b: DraftSnapshot): boolean {
  return a.overnight === b.overnight && (Object.keys(a.values) as Field[]).every(field => a.values[field] === b.values[field]);
}

/**
 * Kirjaa vaiheen sisään tulleen tilan historiaan kerran vaiheelle. Näin monta
 * muutosta samassa kysymyksessä ei hukka alkuperäistä arvoa, ja muuttumaton
 * vaihe ei lisää mitään turhaan. `changed` kertoo onko vaiheessa muutettu
 * mitään, joten pelkkä siirtyminen ei täytä historiaa.
 */
export function noteStep(history: HistoryEntry[], before: DraftSnapshot, step: number, changed: boolean): HistoryEntry[] {
  const top = history[history.length - 1];
  if (top && top.step === step) return history;
  if (!changed) return history;
  return [...history, { values: { ...before.values }, overnight: before.overnight, step }].slice(-historyLimit);
}

/** Palauttaa viimeisimmän muutoksen ja poistaa sen historiasta. Kumoa ei ole peruttavissa itseään. */
export function undoStep(history: HistoryEntry[]): { history: HistoryEntry[]; entry: HistoryEntry } {
  if (!history.length) throw new Error('Ei kumottavia muutoksia.');
  return { history: history.slice(0, -1), entry: history[history.length - 1] };
}
