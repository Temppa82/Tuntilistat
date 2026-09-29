import {useEffect,useState} from 'react';

import type {Draft,ListKind} from '@/lib/capture';

import {validateDraft} from '@/lib/capture';


import {fillWorkbook,workbookName,EntryConflict,type EntryCellDiff} from '@/lib/workbook-export';
import {sheetDate} from '@/lib/pamark-target';

import {getStored,putStored,digest,downloadWorkbook,sharedDirectory,permit,readWorkbook,writeWorkbook,type SavedWorkbook} from '@/lib/local-files';

import {ensurePeriod,storedWorkbook} from '@/lib/period-files';
import {addVehicleSection} from '@/lib/add-vehicle';
import {saveVehicle} from '@/lib/vehicle-settings';

import {loadTemplate,type ListTemplate} from '@/lib/templates';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {prepareGoogle,connectGoogle,connected,savedDriveFolder} from '@/lib/google-drive';
import {enqueuePamark,flushPamark,checkSharedList,forcePendingJobs} from '@/lib/pamark-sync';



export default function LocalSave({kind,draft,name,onNew}:{kind:ListKind;draft:Draft;name:string;onNew:()=>void}){

  const [template,setTemplate]=useState<ListTemplate>(),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState(false),[conflict,setConflict]=useState(false),[unknown,setUnknown]=useState('');
  const [driveBusy,setDriveBusy]=useState(false),[driveMessage,setDriveMessage]=useState(''),[driveError,setDriveError]=useState('');
  // Jaetun ajolistan ristiriita erotetaan muista virheistä, jotta käyttäjä voi
  // päättää oman rivinsä korvaamisesta sen sijaan, että synkronointi jää jumiin.
  // Ristiriita voi kuulua mihin tahansa jonotettuun kirjaukseen, ei vain avoinna
  // olevaan luonnokseen: päivä ja auto varmistavat, että korvaus kohdistuu siihen
  // kirjaukseen, joka dialogissa näkyy.
  const [driveConflict,setDriveConflict]=useState<{diffs:EntryCellDiff[];date:string;vehicle:string}|null>(null);
  // Ristiriidan vanhat arvot näytetään ennen korvaamista, jotta väärä päivä ei
  // mene hiljaa toisen ajurin kirjauksen päälle.
  const [diffs,setDiffs]=useState<EntryCellDiff[]>([]);

  // Päivämäärä ja reitti näytetään omilla riveillään, muut solut soluosoitteensa mukaan.
  const isFilled=(v:unknown)=>v!==null&&v!==undefined&&v!=='';
  const hasReitti=(s:string|number|null|undefined)=>/^Reitti:|^\s*Reitti\b/.test(String(s??''));
  const dayDiffs=diffs.filter(d=>isFilled(d.old)&&!d.col.startsWith('A'));
  const routeDiffs=diffs.filter(d=>d.col.startsWith('A')&&(hasReitti(d.old)||hasReitti(d.new)));
  const dateDiffs=diffs.filter(d=>d.col.startsWith('A')&&!hasReitti(d.old)&&!hasReitti(d.new)&&isFilled(d.old));

 useEffect(()=>{let live=true;loadTemplate(kind).then(t=>{if(live)setTemplate(t);}).catch(()=>setError('Listapohjaa ei voitu avata.'));return()=>{live=false;};},[kind]);

 useEffect(()=>{setSaved(false);setMessage('');},[draft.updatedAt,name]);


 async function save(overwrite=false){

  if(!template)return;setBusy(true);setError('');setConflict(false);setSaved(false);setUnknown('');

  try{

   const filename=workbookName(kind,draft.values.date,name),dir=await getStored<boolean>(`imported:${filename}`)?undefined:await sharedDirectory();if(dir)await permit(dir);await ensurePeriod(kind,draft.values.date,name);

   const operation=async()=>{

    const cached=await getStored<SavedWorkbook>(`workbook:${filename}`);

    const baseline=dir?await readWorkbook(dir,filename):undefined;

    if(cached&&!cached.savedToFolder&&baseline&&await digest(cached.bytes)!==await digest(baseline))throw new Error('Kansion tiedosto ja sovellusmuistin työkopio eroavat. Työkopio säilyy sovellusmuistissa; vie se XLSX-tiedostona ennen kansion tiedoston vaihtamista.');
    const result=fillWorkbook((cached&&!cached.savedToFolder?cached.bytes:baseline||cached?.bytes)||template.bytes,kind,draft,name,{fresh:!baseline&&!cached,overwrite});

    await putStored(`workbook:${filename}`,{filename,bytes:result.bytes,updatedAt:new Date().toISOString(),kind,savedToFolder:false} satisfies SavedWorkbook);

    let savedToFolder=false;
    if(dir&&(savedToFolder=await writeWorkbook(dir,filename,result.bytes,baseline))){await putStored(`workbook:${filename}`,{filename,bytes:result.bytes,updatedAt:new Date().toISOString(),kind,savedToFolder:true} satisfies SavedWorkbook);}

     setSaved(true);setMessage(savedToFolder&&dir?`Tallennettu kansioon ${dir.name}: ${filename}`:kind==='pamark'?'Ajolista on tallessa tällä laitteella.':'Tuntilista on tallessa tällä laitteella.');

    window.dispatchEvent(new Event('local-workbooks-changed'));

   };

    if(navigator.locks)await navigator.locks.request(`ajolista:${filename}`,operation);else await operation();

    navigator.storage?.persist?.().catch(()=>{});

    // Päivä lähetetään jaettuun ajolistaan vain, jos kansio on valittu. Paikallinen tallennus
    // on jo onnistunut, joten jonon puuttuminen ei saa estää sitä.
    const queued=await queueForDrive(filename,overwrite);
    if(queued)setMessage((current)=>current+' Päivä odottaa Driveen lähettämistä.');

   }catch(e){const text=e instanceof Error?e.message:'Tallennus epäonnistui. Luonnos säilyy.';setDiffs(e instanceof EntryConflict?e.diffs:[]);setConflict(e instanceof EntryConflict);
    // A vehicle that is not in the list yet is not an error the driver can fix by typing:
    // offer the new section instead of leaving a dead end.
    if(kind==='pamark'&&/Autoa ei löytynyt listapohjasta/.test(text)&&draft.values.vehicle){setUnknown(draft.values.vehicle);setError(`Autolla ${draft.values.vehicle} ei ole omaa osiota tässä ajolistassa.`);}else setError(text);}finally{setBusy(false);}

  }

  async function queueForDrive(filename:string,overwrite=false){
   if(kind!=='pamark')return false;
   try{if(!await savedDriveFolder())return false;await enqueuePamark(draft,name,{force:overwrite});return true;}
   catch{return false;}
  }

  // Lähettää puhelimessa olevat päivät jaettuun ajolistaan ja tuo yhdistetyn tiedoston
  // takaisin omaan kopioon. Yhdistämisen varmennus huolehtii siitä, ettei muiden
  // kuljettajien rivejä eikä laskentakaavoja muuteta.
  async function syncDrive(){
   if(kind!=='pamark')return;setDriveBusy(true);setDriveError('');setDriveMessage('');setDriveConflict(null);
   try{
    if(!connected()){await prepareGoogle();await connectGoogle();}
    const folder=await savedDriveFolder();
    if(!folder)throw new Error('Valitse jaettu Drive-kansio kohdasta Asetukset.');
    const sent=await flushPamark();
    // Tiedoston tila luetaan vasta lähetyksen jälkeen, muuten ilmoitus kertoisi
    // vanhan päivämäärän eikä sitä, mihin oma kirjaus päätyi.
    const check=await checkSharedList(folder.id,draft.values.date,name);
    const moved=sent?`${sent} ${sent===1?'kirjaus lähetettiin':`kirjausta lähetettiin`} jaettuun ajolistaan. `:'';
    setDriveMessage(check.exists?`Ajolista synkronoitu. ${moved}${check.filename} sisältää nyt ${check.days} päivää${check.vehicles.length?` (${check.vehicles.join(', ')})`:''}.`:'Ajolista luotiin ja päivä lähetettiin jaettuun kansioon.');
   }catch(e){
    if(e instanceof EntryConflict){const job=(e as EntryConflict&{job?:{draft:Draft}}).job;setDriveConflict({diffs:e.diffs?.length?e.diffs:[],date:job?.draft.values.date??draft.values.date,vehicle:job?.draft.values.vehicle??draft.values.vehicle});return;}
    setDriveError(e instanceof Error?e.message:'Synkronointi epäonnistui. Kirjaukset säilyvät puhelimella.');
   }
   finally{setDriveBusy(false);}
  }

  // Dialogin napsautus korvaa nimenomaan sen jonotetun kirjauksen, jonka ristiriita
  // dialogissa näkyy, ja lähettää sen sitten uudelleen. Jos jonossa ei ole sellaista
  // kirjausta, käyttäjä saa siitä erillisen ilmoituksen sen sijaan, että dialogi
  // vain aukeaisi uudelleen kuin mikään ei olisi tapahtunut.
  async function replaceDriveRow(){
   if(!driveConflict)return;setDriveBusy(true);setDriveError('');
   try{
    const forced=await forcePendingJobs(driveConflict.date,driveConflict.vehicle);
    if(!forced){setDriveError('Jonossa ei ollut omaa kirjausta tälle päivälle. Tallenna päivä ensin Tallenna puhelimeen -painikkeella.');return;}
    setDriveConflict(null);
    await syncDrive();
   }catch(e){setDriveError(e instanceof Error?e.message:'Korvaaminen epäonnistui. Kirjaus säilyy lähetysjonossa.');}
   finally{setDriveBusy(false);}
  }

  // Gives the vehicle its own section in the same file, so every vehicle keeps one section.
  async function addVehicle(){
   const reg=draft.values.vehicle;if(!reg||!template)return;setBusy(true);setError('');
   try{
     const filename=workbookName(kind,draft.values.date,name);
     const cached=await storedWorkbook(kind,draft.values.date,name);
    if(!cached?.bytes)throw new Error('Ajolistaa ei ole tallennettu. Avaa päivä ajolistaksi ensin.');
    const bytes=addVehicleSection(cached.bytes,reg,name,{consumption:'0',emission:'0'});
    await saveVehicle(reg,{consumption:'0',emission:'0'});
    const dir=await getStored<boolean>(`imported:${filename}`)?undefined:await sharedDirectory();
    let savedToFolder=false;
    if(dir){await permit(dir);savedToFolder=await writeWorkbook(dir,filename,bytes,await readWorkbook(dir,filename));}
    await putStored(`workbook:${filename}`,{filename,bytes,kind:'pamark',updatedAt:new Date().toISOString(),savedToFolder} satisfies SavedWorkbook);
    setUnknown('');setSaved(false);setMessage(`Autolle ${reg} lisättiin oma osio listaan. Tallenna päivä uudelleen. Päästö- ja kulutusarvot voit asettaa kohdasta Ajoneuvot.`);
    window.dispatchEvent(new Event('local-workbooks-changed'));
   }catch(e){setError(e instanceof Error?e.message:'Auton lisääminen epäonnistui.');}finally{setBusy(false);}
  }

  async function download(){try{const file=await storedWorkbook(kind,draft.values.date,name);if(file)downloadWorkbook(file.filename,file.bytes);}catch{setError('Tiedoston vienti epäonnistui.');}}

 const valid=Object.keys(validateDraft(kind,draft)).length===0;

 return <section className="local-save"><h2>Tallenna puhelimeen</h2><p className="hint">XLSX-tiedosto tallennetaan alussa valittuun paikalliseen kansioon tai sovellusmuistiin. Tallennus toimii ilman internetiä.</p>

 <p className="hint">Oikea tiedosto ja pohja valitaan automaattisesti. Omia pohjia voi vaihtaa asetuksissa.</p>

 <p className="hint">{valid?workbookName(kind,draft.values.date,name):'Täytä puuttuvat kohdat ennen tallennusta.'}</p>

 <button className="primary" disabled={!template||!valid||busy} onClick={()=>void save()}>{busy?'Tallennetaan…':'Tallenna puhelimeen'}</button>

 {kind==='pamark'&&<button className="secondary" disabled={driveBusy||busy} onClick={()=>void syncDrive()}>{driveBusy?'Synkronoidaan…':'Synkronoi Driveen'}</button>}

 {driveMessage&&<p role="status">{driveMessage}</p>}{driveError&&<p className="field-error" role="alert">{driveError}</p>}

 {message&&<p role="status">{message}</p>}{error&&<p className="field-error" role="alert">{error}</p>}

  {conflict&&<Dialog open onOpenChange={v=>{if(!v)setConflict(false);}}><DialogContent><DialogTitle>Päivälle on jo erilainen kirjaus</DialogTitle><DialogDescription>Tiedostossa on samalle päivälle tai samalle autolle jo muita arvoja kuin nämä. Tarkista korvattavat kohdat. Muut päivät ja toisen auton kirjaukset eivät muutu.</DialogDescription><ConflictTarget diffs={diffs} selectedDate={draft.values.date}/>{dayDiffs.length>0&&<dl className="conflict-diffs">{dayDiffs.map(d=><div key={d.col}><dt>{d.col}</dt><dd>{d.old!==''?d.old:'tyhjä'} → {d.new??'tyhjä'}</dd></div>)}</dl>}{routeDiffs.length>0&&<p className="hint">Reitti: {routeDiffs.map(d=>`${d.old!==''?d.old:'tyhjä'} → ${d.new??'tyhjä'}`).join(' · ')}</p>}{dateDiffs.length>0&&<p className="hint">Päivämäärä kohdassa {dateDiffs.map(d=>d.col).join(', ')} poikkeaa. Tarkista valittu päivä.</p>}{dayDiffs.length===0&&routeDiffs.length===0&&dateDiffs.length===0&&<p className="hint">Erilaista ei löytynyt solukohtaisesti. Tarkista valittu päivä.</p>}<p className="hint">Laskukaavat säilyvät.</p><button disabled={busy} onClick={()=>void save(true)}>{busy?'Korvataan…':'Korvaa nämä arvot'}</button><button onClick={()=>setConflict(false)}>Peruuta</button></DialogContent></Dialog>}

  {driveConflict&&<Dialog open onOpenChange={v=>{if(!v)setDriveConflict(null);}}><DialogContent><DialogTitle>Jaetussa ajolistassa on jo tämä kirjaus</DialogTitle><DialogDescription>Jaetussa tiedostossa on jo rivi tälle autolle ja päivälle, ja sen arvot eroavat näistä. Muut autot ja päivät eivät muutu.</DialogDescription><ConflictCells diffs={driveConflict.diffs} selectedDate={driveConflict.date} vehicle={driveConflict.vehicle}/><button disabled={driveBusy} onClick={()=>void replaceDriveRow()}>{driveBusy?'Korvataan ja lähetetään…':'Korvaa jaetun tiedoston rivi omilla arvoilla'}</button><button onClick={()=>setDriveConflict(null)}>Peruuta</button></DialogContent></Dialog>}

  {unknown&&<button className="secondary" disabled={busy} onClick={()=>void addVehicle()}>Lisää auto {unknown} omaan osioonsa listaan</button>}

 {saved&&<><button className="secondary" onClick={()=>void download()}>Vie XLSX laitteen Tiedostot-kansioon</button><button className="secondary" onClick={onNew}>Aloita uusi päivä</button></>}

 </section>;

}

function ConflictTarget({diffs,selectedDate,vehicle}:{diffs:EntryCellDiff[];selectedDate:string;vehicle?:string}){
  if(!diffs.length)return null;
  const row=/^\D*(\d+)$/.exec(diffs[0].col)?.[1];
  const storedA=diffs.find(d=>d.col==='A'+row)?.old;
  const parsed=sheetDate(storedA);
  const stored=storedA==null||storedA===''
    ?'ei päivämäärää'
    :`${parsed??'tunnistamaton arvo '+(String(storedA))}`;
  return <p className="hint">{vehicle?`Kirjaus ${vehicle} ${selectedDate}: `:''}Kohderivi {row??'?'}: siinä olevan päivän arvo {stored} · kirjattava päivä {selectedDate}.</p>;
}

function ConflictCells({diffs,selectedDate,vehicle}:{diffs:EntryCellDiff[];selectedDate:string;vehicle?:string}){
  const isFilled=(v:unknown)=>v!==null&&v!==undefined&&v!=='';
  const hasReitti=(s:string|number|null|undefined)=>/^Reitti:|^\s*Reitti\b/.test(String(s??''));
  const day=diffs.filter(d=>isFilled(d.old)&&!d.col.startsWith('A'));
  const route=diffs.filter(d=>d.col.startsWith('A')&&(hasReitti(d.old)||hasReitti(d.new)));
  const date=diffs.filter(d=>d.col.startsWith('A')&&!hasReitti(d.old)&&!hasReitti(d.new)&&isFilled(d.old));
  if(diffs.length===0)return <p className="hint">Erilaista ei löytynyt solukohtaisesti. Tarkista valittu päivä.</p>;
  return <><ConflictTarget diffs={diffs} selectedDate={selectedDate} vehicle={vehicle}/>{day.length>0&&<dl className="conflict-diffs">{day.map(d=><div key={d.col}><dt>{d.col}</dt><dd>{d.old!==''?d.old:'tyhjä'} → {d.new??'tyhjä'}</dd></div>)}</dl>}{route.length>0&&<p className="hint">Reitti: {route.map(d=>`${d.old!==''?d.old:'tyhjä'} → ${d.new??'tyhjä'}`).join(' · ')}</p>}{date.length>0&&<p className="hint">Päivämäärä kohdassa {date.map(d=>d.col).join(', ')} poikkeaa. Tarkista valittu päivä.</p>}<p className="hint">Laskukaavat säilyvät.</p></>;
}

