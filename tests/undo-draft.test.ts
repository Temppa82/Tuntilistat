// Kumoa palauttaa muutetun kysymyksen alkuperäisen arvon. Historia on
// kysymyskohtainen: vaiheen sisään tullut tila muistetaan heti ensimmäisestä
// muutoksesta, joten Kumoa toimii myös ilman että vaiheesta ehditään siirtyä
// pois, eikä historia täyty merkki kerrallaan.
import assert from 'node:assert/strict';
import {newDraft,type Draft} from '../lib/capture';
import {snapshot,noteStep,undoStep,sameSnapshot,historyLimit,type HistoryEntry} from '../lib/draft-history';

const draft=():Draft=>newDraft();
const at=(step:number,values:Partial<Draft['values']>,overnight=false):Draft=>{const d=draft();d.step=step;d.overnight=overnight;Object.assign(d.values,values);return d;};
// Muistetaan vaihe kuten sovellus: ennen muutosta ja sen jälkeen.
const change=(history:HistoryEntry[],step:number,before:Partial<Draft['values']>,after:Partial<Draft['values']>):HistoryEntry[]=>
 noteStep(history,snapshot(at(step,before)),step,!sameSnapshot(snapshot(at(step,before)),snapshot(at(step,after))));

// Tyhjä historia ei lupaa kumota.
assert.throws(()=>undoStep([]),'tyhjästä historiasta sai kumota');

// Muuttumaton vaihe ei lisää historiaa, vaikka siirrytään pois.
let history:HistoryEntry[]=noteStep([],snapshot(at(0,{})),0,false);
assert.equal(history.length,0,'muuttumaton vaihe lisäsi historian');

// Muutos kirjataan heti, ilman että vaiheesta siirrytään pois.
history=change(history,0,{},{vehicle:'ABC-123'});
assert.equal(history.length,1,'muutos ei tullut historiasta heti');
// Historia sisältää vaiheen sisään tulleet arvot, ei sieltä poislähteneitä.
assert.equal(history[0].values.vehicle,'','historiaan tallentui uusi arvo');
assert.equal(history[0].step,0);

// Kumoa palauttaa arvon ja poistaa merkinnän historiasta.
const {history:rest,entry}=undoStep(history);
assert.equal(rest.length,0,'kumoaminen ei poistanut merkintää');
assert.equal(entry.values.vehicle,'');

// Monta muutosta samassa kysymyksessä eivät hukka alkuperäistä arvoa.
let typed=change([],0,{},{vehicle:'A'});
typed=change(typed,0,{},{vehicle:'AB'});
typed=change(typed,0,{},{vehicle:'ABC-123'});
assert.equal(typed.length,1,'kolme muutosta täytti historian');
assert.equal(undoStep(typed).entry.values.vehicle,'','kirjoitettu teksti jäi palauttamatta');

// Kahden vaiheen jälkeen kumotaan ensin tuorein muutos.
history=change([],0,{},{vehicle:'ABC-123'});
history=change(history,1,{vehicle:'ABC-123'},{vehicle:'ABC-123',start:'06:00'});
assert.equal(history.length,2);
const first=undoStep(history);
assert.equal(first.entry.step,1,'kumoittiin väärä vaihe');
assert.equal(first.entry.values.start,'','aloitusaika jäi palauttamatta');
assert.equal(first.entry.values.vehicle,'ABC-123','rekisterinumero katosi kumoamisessa');
assert.equal(first.history.length,1);
const second=undoStep(first.history);
assert.equal(second.entry.step,0);
assert.equal(second.entry.values.vehicle,'');
assert.equal(second.history.length,0);

// Yö päivän vaihe tallennetaan mukaan, joten kumoaminen palauttaa myös sen.
// Käyttäjä on vaiheessa yö päivä päällä ja poistaa rastin.
let night=change([],4,{end:'23:00'},{end:'23:00'});
night=noteStep(night,snapshot(at(4,{end:'23:00'},true)),4,true);
assert.equal(night.length,1,'yön vaihto ei tullut historiasta');
assert.equal(undoStep(night).entry.overnight,true,'yötä ei palautettu');
// Vaihe, jossa yö on jo valmiiksi päällä, ei lisää merkintää.
night=noteStep(night,snapshot(at(4,{end:'23:00'},true)),4,true);
assert.equal(night.length,1,'yhdentäinen vaihe lisäsi historian');

// Vertailu sisältää arvot ja yö päivän tilan, mutta ei vaiheen numeroa.
assert.ok(sameSnapshot(snapshot(at(0,{})),snapshot(at(3,{}))),'vaihe vaikuttaa vertailuun');
assert.ok(!sameSnapshot(snapshot(at(0,{})),snapshot(at(3,{vehicle:'ABC-123'}))),'eri arvot vertautuivat samoiksi');
assert.ok(!sameSnapshot(snapshot(at(0,{})),snapshot(at(3,{},true))),'yön tila jäi vertailusta huomiotta');

// Historia on rajattu, joten pitkä sessio ei kasvata muistia.
let long:HistoryEntry[]=[];
for(let i=0;i<historyLimit+5;i++)long=change(long,i,{},{stops:String(i)});
assert.equal(long.length,historyLimit,'raja ei rajoittanut historiaa');
assert.equal(long[0].step,5,'vanhin merkintä ei putosi pois');

console.log(`PASS draft history: muutos muistetaan heti, kumoa palauttaa vaiheen sisään tulleet arvot, ${historyLimit} merkinnän raja`);
