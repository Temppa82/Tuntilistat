import {useEffect,useState} from 'react';
import {localDate,normalizeVehicle,type Draft,type ListKind} from '@/lib/capture';
import {importHours} from '@/lib/import-hours';
import {importPamark} from '@/lib/import-pamark';
import {dayOverview,type DayOverview} from '@/lib/day-overview';
import {ensurePeriod,useImportedFile} from '@/lib/period-files';
import {removeListedDay} from '@/lib/remove-day';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
const fi=(d:string)=>`${Number(d.slice(8,10))}.${Number(d.slice(5,7))}.`;
export default function DayBrowser({kind,draft,name,onOpen,onDeleted}:{kind:ListKind;draft:Draft;name:string;onOpen:(date:string,vehicle:string,source:boolean)=>Promise<void>;onDeleted:(date:string,vehicle:string)=>void}){
  const [date,setDate]=useState(draft.values.date),[vehicle,setVehicle]=useState(draft.values.vehicle),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[pending,setPending]=useState<{bytes:Uint8Array;conflicts:string[]}>();
  const [days,setDays]=useState<DayOverview[]>(),[missing,setMissing]=useState(false),[file,setFile]=useState(''),[revision,setRevision]=useState(0);
  const [removing,setRemoving]=useState<DayOverview>();
  // Tuotu tiedosto pidetään näkyvissä, jotta sen voi ottaa käyttöön. Tuonti itse
  // sulauttaa puhelimen päivät, joten ilman tätä valintaa käyttäjä jatkaa
  // katsomasta vanhaa listaa eikä näe mitään tuomaansa.
  const [imported,setImported]=useState<{filename:string;date:string;bytes:Uint8Array}>();
  useEffect(()=>{setDate(draft.values.date);setVehicle(draft.values.vehicle);},[draft.values.date,draft.values.vehicle,kind]);
  // Read what is actually stored, not what the phone remembers, so the overview always matches the file.
  useEffect(()=>{let live=true;dayOverview(kind,date,name).then(r=>{if(live){setDays(r.days);setMissing(r.missing);setFile(r.filename);}}).catch(()=>{if(live){setDays([]);setMissing(true);}});return()=>{live=false;};},[kind,date,name,revision,draft.updatedAt]);
  async function run(fn:()=>Promise<void>){setBusy(true);setMessage('');try{await fn();}catch(e){setMessage(e instanceof Error?e.message:'Toiminto epäonnistui.');}finally{setBusy(false);}}
  async function doImport(bytes:Uint8Array,overwrite:boolean){
   if(kind==='pamark'){
    const result=await importPamark(bytes,name,overwrite);
    setDate(result.date);setImported({filename:result.filename,date:result.date,bytes});setRevision(r=>r+1);setPending(result.conflicts.length?{bytes,conflicts:result.conflicts}:undefined);
    if(result.conflicts.length)setMessage(`Tuotiin ${result.written} päivää. Päivät ${result.conflicts.join(', ')} poikkeavat puhelimen kirjauksista, joten niitä ei korvattu.`);
    else if(result.failed.length)setMessage(`Tuotiin ${result.written} päivää. Näitä ei voitu tuoda, koska tiedossa on puute: ${result.failed.slice(0,5).map(f=>`${f.date} (${f.reason})`).join('; ')}${result.failed.length>5?` ja ${result.failed.length-5} muuta`:''}. Täydät tiedot listaan ja tuo tiedosto uudelleen.`);
    else if(!result.written)setMessage(`Ajolista ${result.filename} oli puhelimella olevan version kanssa samankaltainen, joten mitään ei muutettu.`);
    else setMessage(`Ajolista tuotu tiedostona ${result.filename}: ${result.days} päivää ${result.vehicles.length} autosta. Avaa päivät listanäkymästä.`);
    return;}
   const result=await importHours(bytes,name,overwrite);
   setDate(result.date);setImported({filename:result.filename,date:result.date,bytes});await onOpen(result.date,'',true);setRevision(r=>r+1);setPending(result.conflicts.length?{bytes,conflicts:result.conflicts}:undefined);
   if(result.conflicts.length)setMessage(`Tuotiin ${result.written} päivää. Päivät ${result.conflicts.map(fi).join(', ')} poikkeavat puhelimen kirjauksista, joten niitä ei korvattu.`);
   else if(result.failed.length)setMessage(`Tuotiin ${result.written} päivää. Näitä ei voitu tuoda, koska tiedossa on puute: ${result.failed.slice(0,5).map(f=>`${fi(f.date)} (${f.reason})`).join('; ')}${result.failed.length>5?` ja ${result.failed.length-5} muuta`:''}. Täydät tiedot tuntilistaan ja tuo tiedosto uudelleen.`);
   else if(!result.written)setMessage('Tuntilista oli puhelimella olevan version kanssa samankaltainen, joten mitään ei muutettu.');
   else setMessage(`Tuntilista tuotu paikallisesti: ${result.written} päivää. Päivät on nyt avattavissa listanäkymästä.`);
  }
  const adoptImported=()=>run(async()=>{if(!imported)return;await useImportedFile(kind,imported.filename,imported.bytes);setImported(undefined);await onOpen(imported.date,kind==='pamark'?vehicle:'',true);setRevision(r=>r+1);setMessage(`Tiedosto ${imported.filename} on nyt käytössä. Aiempi versio on varmuuskopioitu.`);});
  const pick=(d:DayOverview)=>{setDate(d.date);if(d.vehicle)setVehicle(d.vehicle);return run(()=>onOpen(d.date,d.vehicle,true));};
  // Poistetaan ensin valinta, jotta vahvistus ei jää auki, jos kirjoitus
  // kaatuu. Päivä katoaa listasta itsestään, koska tyhjennetyn rivin
  // päivämäärä ei enää löydy luettavaksi päiväksi.
  const confirmRemove=(d:DayOverview)=>run(async()=>{
   if(!removing)return;
   setRemoving(undefined);
   const result=await removeListedDay(kind,d.date,d.vehicle,name);
   setRevision(r=>r+1);
   onDeleted(d.date,d.vehicle);
   setMessage(result.removed
    ?(kind==='pamark'?`Poistettiin ${d.label} autosta ${d.vehicle}. `:`Poistettiin ${d.label}. `)+`Tiedot on poistettu puhelimen muistista ja tiedostosta ${result.filename}. Taulukon laskukaavat säilyivät.`
    :`${d.label} oli jo poistettu ${kind==='pamark'?'ajolistasta':'tuntilistasta'}, joten mitään ei muutettu.`);
  });
  // Ajolistan päivät ryhmitellään ajoneuvon mukaan omiksi pudotusvalikoikseen,
  // jottei koko listan avaaminen täytä ruutua tuntikaudelta. Avoinna on juuri
  // se ajoneuvo, jonka kirjausta parhaillaan tehdään.
  const groups=kind==='pamark'&&days?days.reduce((m,d)=>{const v=d.vehicle||'–';(m[v]=m[v]||[]).push(d);return m;},{} as Record<string,DayOverview[]>):null;
  return <section className="phone-panel"><h2>Avaa päivä</h2><p className="hint">Katsele aiempia päiviä tai jatka keskeneräistä kirjausta. Nykyinen luonnos säilyy.</p><label>Päivämäärä<input type="date" max={localDate()} value={date} disabled={busy} onChange={e=>setDate(e.target.value)}/></label>{kind==='pamark'&&<label>Ajoneuvo<input value={vehicle} disabled={busy} onChange={e=>setVehicle(normalizeVehicle(e.target.value))}/></label>}<button className="primary" disabled={busy} onClick={()=>void run(()=>onOpen(date,vehicle,false))}>{busy?'Avataan…':'Avaa päivän tiedot'}</button><button type="button" className="text-button" disabled={busy} onClick={()=>void run(()=>onOpen(date,vehicle,true))}>Avaa tiedoston versio</button><p className="hint">Avaa päivän tiedot palauttaa keskeneräisen luonnoksen, jos sellainen on. Avaa tiedoston versio näyttää tallennetun tiedoston ja säilyttää luonnoksen erikseen.</p>

  <label>Tuo valmis {kind==='pamark'?'ajolista':'tuntilista'} (.xlsx)<input type="file" accept=".xlsx" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void run(async()=>{if(file.size>20*1024*1024)throw new Error('Tiedosto on liian suuri.');await doImport(new Uint8Array(await file.arrayBuffer()),false);});}}/></label>
  <p className="hint">{kind==='pamark'?'Tuotu ajolista säilyy sellaisenaan. Puhelimella lisäämäsi päivät säilyvät myös myöhemmissä tuonneissa.':'Ensimmäinen tuonti säilyttää tiedoston sellaisenaan. Puhelimelle jääneet päivät säilyvät myöhemmissä tuonneissa.'}</p>
  {pending&&<button className="secondary" disabled={busy} onClick={()=>void run(()=>doImport(pending.bytes,true))}>Korvaa puhelimen kirjaukset ({kind==='pamark'?pending.conflicts.join(', '):pending.conflicts.map(fi).join(', ')})</button>}
  {imported&&<><p className="hint">Tuotu tiedosto {imported.filename} on valmis, mutta käytössä on edelleen puhelimella oleva versio. Tuonti sulauttaa puhelimen päivät, joten lista ei vaihdu itsestään.</p><button className="primary" disabled={busy} onClick={()=>void adoptImported()}>Käytä tuotua tiedostoa {imported.filename}</button></>}

  <details className="day-overview"><summary>Listan kaikki päivät{days?.length?` (${days.length})`:''}</summary>
   <p className="hint">{file}{missing?' – tiedostoa ei ole vielä.':''}</p>
   {missing&&<button className="secondary" disabled={busy} onClick={()=>void run(async()=>{await ensurePeriod(kind,date,name);setRevision(r=>r+1);setMessage(`Tyhjä ${kind==='pamark'?'ajolista':'tuntilista'} luotiin tiedostoksi ${file}. Lisää päivät kirjaamalla tai tuo valmis tiedosto.`);})}>Luo tyhjä {kind==='pamark'?'ajolista':'tuntilista'}</button>}
   {!missing&&!days?.length&&<p className="hint">Listassa ei ole vielä päivärivejä. Voit silti avata päivän yllä olevalla päivämäärällä.</p>}
   {kind==='pamark'?groups&&Object.entries(groups).map(([v,list])=><details className="day-group" open={v===normalizeVehicle(draft.values.vehicle)} key={v}><summary>{v} · {list.length} {list.length===1?'päivä':'päivää'}</summary><ul className="day-list">{list.map(d=><li key={d.key}><button type="button" className="secondary" disabled={busy} onClick={()=>void pick(d)}><strong>{d.label}</strong><small>Avaa {d.vehicle}</small></button><button type="button" className="day-remove" disabled={busy} onClick={()=>setRemoving(d)}>Poista</button></li>)}</ul></details>):<ul className="day-list">{days?.map(d=><li key={d.key}><button type="button" className="secondary" disabled={busy} onClick={()=>void pick(d)}><strong>{d.label}</strong><small>Tuntilista</small></button><button type="button" className="day-remove" disabled={busy} onClick={()=>setRemoving(d)}>Poista</button></li>)}</ul>}
    {!!days?.length&&<p className="hint">{kind==='pamark'?'Rekisteri on pääavain: sama päivä eri autolla on oma kirjauksensa. ':''}Valitse päivä avataksesi ja muokataksesi sen tietoja. Poista poistaa koko päivän {kind==='pamark'?'autosta':''}.</p>}
   </details>
   {removing&&<Dialog open onOpenChange={v=>{if(!v)setRemoving(undefined);}}><DialogContent><DialogTitle>Poistetaanko päivä?</DialogTitle><DialogDescription>Päivän tiedot poistetaan puhelimen muistista ja tiedostosta {file}. Poistoa ei voi perua, eikä aiempiin tallennuksiin voi palata.</DialogDescription><dl><div><dt>Päivä</dt><dd>{removing.label}</dd></div>{kind==='pamark'&&<div><dt>Ajoneuvo</dt><dd>{removing.vehicle}</dd></div>}</dl><p className="hint">Päivän laskukaavat säilyvät, joten muut kirjaukset eivät muutu.</p><button onClick={()=>void confirmRemove(removing)}>Poista päivä</button><button onClick={()=>setRemoving(undefined)}>Peruuta</button></DialogContent></Dialog>}
  {message&&<p role="status">{message}</p>}</section>;
}
