import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import type { SheetSnapshot } from './pamark-target';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const children = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagNameNS(NS, tag));

/** XML 1.0:n sallimat merkistöt. Kaikki muu, myös yksinäinen korvaava
 * merkki, rikkaisi taulukon: selaimen jäsentäjä hylkää koko tiedoston, vaikka
 * testien käyttämä armollinen jäsentäjä olisi sen hyväksynyt. Puhelimen
 * näppäimistö voi tuottaa tällaista tavaraa esimerkiksi kaupunkien väliin, ja
 * siksi kaikki taulukkoon kirjoitettava teksti siistitään tässä. */
const allowedXmlChar = (code: number) =>
  code === 0x9 || code === 0xa || code === 0xd ||
  (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff);

/** Poistaa merkit, jotka eivät kelpaa XML:ään, sekä korvausmerkin U+FFFD.
 * Jälkimmäinen on lakkaava merkki: se syntyy, kun teksti on joskus luettu
 * väärin, eikä siinä ole mitään alkuperäistä. Jos se jäisi soluun, käyttäjä
 * näkisi kaupunkien välissä vihaisen timantin ja tallennus epäonnistuisi. */
export function xmlSafeText(value: string) {
  let out = '';
  // for...of käyttää koodipistettä, joten kelvollinen merkkipari säilyy yhtenä
  // merkkinä ja yksinäinen korvaaja putoaa pois tarkistuksessa.
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (code !== 0xfffd && allowedXmlChar(code)) out += character;
  }
  return out;
}

/** Palauttaa tiedostonosan tekstin, jos se kelpaa XML:ksi. */
export function readableXmlText(text: string) {
  try { return !new DOMParser().parseFromString(text, 'application/xml').getElementsByTagName('parsererror').length; } catch { return false; }
}
function xml(text: string, part: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error(`Tiedosto ei ole tavallinen .xlsx-taulukko (${part}).`);
  // Lukeminen siistii samalla tavalla kuin kirjoittaminen. Näin jo tallennettu
  // taulukko, jossa on kelvottomia merkkejä, avautuu varmasti ja korjaantuu
  // itsestään seuraavassa tallennuksessa.
  const doc = new DOMParser().parseFromString(xmlSafeText(text), 'application/xml');
  // Nimetön virhe on umpikujalle. Kerrotaan mikä osa ei kelpaa, jotta
  // käyttäjä tiedostaa mitä tiedostoa on lähdetty korjaamaan.
  if (doc.getElementsByTagName('parsererror').length) throw new Error(`Taulukon rakenne on vioittunut (${part}). Tiedostoa ei muutettu.`);
  return doc;
}

// Suhteessa oleva kohde on suhteellinen polku, jossa voi olla ../-osiä. Se
// ratkaistaan kansiosta, jossa työkirja on, jotta taulukko löytyy myös
// tiedostosta, jossa polussa on käytetty ..-merkkiä.
function resolvePart(target: string) {
  const parts: string[] = [];
  for (const segment of (target.startsWith('/') ? target.slice(1) : `xl/${target}`).split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') parts.pop(); else parts.push(segment);
  }
  return parts.join('/');
}

/** Changes existing cell values only. Layout, styles, formulas and other ZIP members are preserved. */
export class XlsxDocument {
  private files: Record<string, Uint8Array>;
  private sheet: Document;
  private workbook: Document;
  private path: string;
  private strings: string[];
  private cells: Map<string, Element>;
  /** Solut, joista poistui XML:lle kelvottomia merkkejä. Kerrotaan käyttäjälle,
   * jotta seuraava kerta on korjattavissa ilman uutta kysymistä. */
  private stripped = new Set<string>();
  constructor(bytes: Uint8Array) {
    if (bytes.byteLength > 10_000_000) throw new Error('Valitse alle 10 Mt:n listapohja.');
    let total = 0;
    // Katkennut tai vieras tiedosto ei saa paljastaa raakaa kirjaston
    // virhettä käyttäjälle. Oma kokorajoitus ohitetaan muuttamatta.
    try {
      this.files = unzipSync(bytes, { filter: f => {
        total += f.originalSize;
        if (total > 50_000_000) throw new Error('Taulukko on liian suuri.');
        return true;
      }});
    } catch (e) {
      if (e instanceof Error && e.message === 'Taulukko on liian suuri.') throw e;
      throw new Error('Tiedosto ei ole luettava xlsx-taulukko. Tiedostoa ei muutettu.');
    }
    if (!this.files['xl/workbook.xml'] || this.files['xl/vbaProject.bin']) throw new Error('Valitse tavallinen .xlsx-taulukko.');
    this.workbook = xml(strFromU8(this.files['xl/workbook.xml']), 'xl/workbook.xml');
    if (children(this.workbook, 'workbookPr').some(el => el.getAttribute('date1904') === '1')) throw new Error('Taulukon päivämääräjärjestelmää ei tueta.');
    const tab = children(this.workbook, 'sheet').find(el => el.getAttribute('name') === 'Taulukko1');
    if (!tab) throw new Error('Pohjasta puuttuu Taulukko1.');
    const rels = xml(strFromU8(this.files['xl/_rels/workbook.xml.rels']), 'xl/_rels/workbook.xml.rels');
    const rel = Array.from(rels.getElementsByTagName('Relationship')).find(el => el.getAttribute('Id') === tab.getAttribute('r:id'));
    this.path = resolvePart(rel?.getAttribute('Target') || '');
    // Osa voi olla kansion "worksheet" myös ilman s-kirjainta. Sellaisia
    // tiedostoa syntyy muualla kuin Microsoftilla, joten sitä ei hylätä.
    if (!/^xl\/worksheets?\/[^/]+\.xml$/.test(this.path) || !this.files[this.path]) throw new Error('Taulukon sijaintia ei tunnistettu.');
    this.sheet = xml(strFromU8(this.files[this.path]), this.path);
    this.cells = new Map(children(this.sheet, 'c').map(el => [el.getAttribute('r')!, el]));
    this.strings = this.files['xl/sharedStrings.xml'] ? children(xml(strFromU8(this.files['xl/sharedStrings.xml']), 'xl/sharedStrings.xml'), 'si').map(el => children(el, 't').map(t => t.textContent || '').join('')) : [];
  }
  snapshot(): SheetSnapshot {
    const out: SheetSnapshot = {};
    for (const [address, el] of this.cells) {
      const raw = children(el, 'v')[0]?.textContent;
      const type = el.getAttribute('t');
      const value = type === 's' ? this.strings[Number(raw)] : type === 'inlineStr' ? children(el, 't').map(t => t.textContent || '').join('') : raw == null ? null : type === 'str' ? raw : Number(raw);
      out[address] = { value, formula: children(el, 'f')[0] ? children(el, 'f')[0].textContent || '#shared:' + children(el, 'f')[0].getAttribute('si') : undefined };
    }
    return out;
  }
  set(address: string, value: string | number | null) {
    const cell = this.cells.get(address);
    if (!cell) throw new Error(`Pohjasta puuttuu solu ${address}. Pohjaa ei muutettu.`);
    if (children(cell, 'f').length) throw new Error(`Solussa ${address} on laskentakaava. Sitä ei korvata.`);
    for (const tag of ['v', 'is']) for (const el of children(cell, tag)) el.parentNode?.removeChild(el);
    cell.removeAttribute('t');
    if (value === null) return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Virheellinen numero.');
      const v = this.sheet.createElementNS(NS, 'v'); v.textContent = String(value); cell.appendChild(v);
    } else {
      // Inline text prevents a route beginning with '=' from becoming a formula.
      cell.setAttribute('t', 'inlineStr');
      const text = xmlSafeText(value);
      if (text !== value) this.stripped.add(address);
      const is = this.sheet.createElementNS(NS, 'is'), t = this.sheet.createElementNS(NS, 't');
      t.setAttribute('xml:space', 'preserve'); t.textContent = text; is.appendChild(t); cell.appendChild(is);
    }
  }
  patch(values: Record<string, string | number | null>) { for (const [a, v] of Object.entries(values)) this.set(a, v); }
  setFormula(address:string,formula:string){
    const cell=this.cells.get(address);if(!cell)throw new Error(`Pohjasta puuttuu solu ${address}.`);
    if(children(cell,'f').some(f=>f.getAttribute('t')==='shared'))throw new Error('Jaettua laskentakaavaa ei muuteta.');
    for(const tag of ['v','is','f'])for(const el of children(cell,tag))el.parentNode?.removeChild(el);
    cell.removeAttribute('t');const f=this.sheet.createElementNS(NS,'f');f.textContent=xmlSafeText(formula);cell.appendChild(f);
  }
  bytes() {
    // Kaavojen välimuistiarvot poistetaan, ettei taulukko näytä vanhoja lukuja.
    for (const cell of this.cells.values()) if (children(cell, 'f').length) for (const v of children(cell, 'v')) v.parentNode?.removeChild(v);
    let calc = children(this.workbook, 'calcPr')[0];
    if (!calc) { calc = this.workbook.createElementNS(NS, 'calcPr'); this.workbook.documentElement.appendChild(calc); }
    calc.setAttribute('calcMode', 'auto'); calc.setAttribute('fullCalcOnLoad', '1'); calc.setAttribute('forceFullCalc', '1');
    // Laskentaa ei ole tehty, ja vanha ketju sekä välimuistiarvot ovat
    // ristiriidassa. Jos ketju jää paikalleen, taulukko pitää tyhjät
    // kaavasolut tyhjänä eikä laske mitään. Taulukko rakentaa riippuvuudet
    // itse, kun ketku ja sen viittaukset poistetaan.
    calc.setAttribute('calcCompleted', '0');
    delete this.files['xl/calcChain.xml'];
    const serializer = new XMLSerializer();
    const written: Array<[string, string]> = [];
    for (const [path, part, match] of [
      ['xl/_rels/workbook.xml.rels', 'Relationship', (el: Element) => el.getAttribute('Target') === 'calcChain.xml'],
      ['[Content_Types].xml', 'Override', (el: Element) => el.getAttribute('PartName') === '/xl/calcChain.xml'],
    ] as const) {
      if (!this.files[path]) continue;
      const doc = xml(strFromU8(this.files[path]), path);
      for (const el of Array.from(doc.getElementsByTagName(part))) if (match(el)) el.parentNode?.removeChild(el);
      written.push([path, serializer.serializeToString(doc)]);
    }
    written.push([this.path, serializer.serializeToString(this.sheet)], ['xl/workbook.xml', serializer.serializeToString(this.workbook)]);
    // Ohjelma ei saa kirjoittaa tiedostoa, jota se ei itse pysty lukemaan.
    // Muuten virhe ilmenee vasta seuraavalla avauksella, jolloin päivädata on
    // jo pudonnut ulos taulukosta eikä sitä voi enää pelastaa. Tarkistus
    // maksaa muutaman millisekunnin ja sulkee tien tällaiseen tiedostoon.
    for (const [path, text] of written) if (!readableXmlText(text)) throw new Error(`Tallennus keskeytyi, koska ${path} ei kelpaa taulukoksi. Tiedostoa ei muutettu.${this.stripped.size?` Poistettu kelvottomia merkkejä soluista ${[...this.stripped].join(', ')}.`:''}`);
    for (const [path, text] of written) this.files[path] = strToU8(text);
    return zipSync(this.files, { level: 6 });
  }
}

