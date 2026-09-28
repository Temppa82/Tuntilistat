import {useEffect,useState} from 'react';
import {prepareGoogle,connectGoogle,connected,disconnect,googlePrepared,selectDriveFolder,readDriveFolder,savedDriveFolder,setDriveFolder,googleConfig,storeGoogleConfig,saveGoogleConfig,type DriveFolder} from '@/lib/google-drive';
import {syncStep} from '@/lib/sync-step';
import {localDate} from '@/lib/capture';
import {flushPamark,syncJobs,checkSharedList,type SyncJob} from '@/lib/pamark-sync';
export default function DriveSettings({name}:{name:string}){
  const [ready,setReady]=useState(googlePrepared),[online,setOnline]=useState(false),[folder,setFolder]=useState<DriveFolder>(),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[jobs,setJobs]=useState<SyncJob[]>([]),[config,setConfig]=useState(googleConfig),[network,setNetwork]=useState(navigator.onLine),[link,setLink]=useState('');
  // Kentät tallentuvat suoraan, joten pääpainike ei koskaan käytä vanhoja arvoja. Yhdistetty yhteys katkaistaan vasta Tallenna-painalluksesta.
  function change(patch:Partial<typeof config>){const next={...config,...patch};setConfig(next);storeGoogleConfig(next);}
 useEffect(()=>{let live=true;const refresh=()=>{setOnline(connected());setNetwork(navigator.onLine);Promise.all([savedDriveFolder(),syncJobs()]).then(([f,j])=>{if(live){setFolder(f);setJobs(Object.values(j));}}).catch(()=>{if(live)setError('Tallennettuja kirjauksia ei voitu lukea.');});};refresh();const events=['pamark-sync-changed','drive-connection-changed','online','offline','focus'];events.forEach(e=>window.addEventListener(e,refresh));const timer=window.setInterval(()=>{if(live)setOnline(connected());},15000);return()=>{live=false;events.forEach(e=>window.removeEventListener(e,refresh));window.clearInterval(timer);};},[]);
 async function action(fn:()=>Promise<void>){setBusy(true);setError('');setMessage('');try{await fn();setOnline(connected());}catch(e){setOnline(connected());if(!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Google-yhteys epäonnistui.');}finally{setBusy(false);}}
  const pending=jobs.filter(j=>j.status!=='synced');
  const step=syncStep({network,connected:online,ready,folderId:folder?.id,pending});
  const configured=!!(config.clientId&&config.pickerKey&&config.projectNumber);
 async function nextStep(){
  if(!navigator.onLine)throw new Error('Yhdistä puhelin internetiin. Kirjaukset säilyvät tällä laitteella.');
  if(!connected()){
   if(!ready){await prepareGoogle();setReady(true);setMessage('Paina seuraavaksi Kirjaudu Googleen. Kirjauksia ei vielä lähetetty.');return;}
   await connectGoogle();setMessage('Google yhdistetty. '+(folder?'Paina Synkronoi lähettääksesi tallennetut kirjaukset.':'Valitse seuraavaksi jaettu Drive-kansio.'));return;
  }
  if(!folder||step.action==='folder'){const selected=await selectDriveFolder();await setDriveFolder(selected);setFolder(selected);setMessage('Kansio valittu. Paina Synkronoi lähettääksesi tallennetut kirjaukset.');return;}
  const current=Object.values(await syncJobs()).filter(j=>j.status!=='synced'&&(!j.folderId||j.folderId===folder.id));
  if(!current.length){setMessage('Ei lähetettäviä kirjauksia tässä kansiossa. Tallenna valmis Pamark-päivä ensin Tallenna puhelimeen -painikkeella. Pelkkä luonnos ei siirry Driveen.');return;}
  await flushPamark();setMessage('Valitun kansion kirjaukset on synkronoitu ja tarkistettu.');
 }

  return <section className="drive-settings"><h2>Synkronoi Pamark Driveen</h2><p className="hint">Vain painikkeella. Tunnit säilyvät tällä laitteella. Synkronointi hakee uusimman ajolistan ja yhdistää omat päiväkirjaukset muiden tietoihin.</p>
  <p className="hint">Alla Google-projektin julkiset selainasetukset. Ne tallentuvat vain tälle laitteelle, eikä asiakassalaisuutta tarvita.</p>
  <label>OAuth-asiakastunnus<input value={config.clientId} onChange={e=>change({clientId:e.target.value.trim()})}/></label>
  <label>Google Picker API -avain<input value={config.pickerKey} onChange={e=>change({pickerKey:e.target.value.trim()})}/></label>
  <label>Google-projektin numero<input inputMode="numeric" value={config.projectNumber} onChange={e=>change({projectNumber:e.target.value.trim()})}/></label>
  <button className="secondary" disabled={busy} onClick={()=>void action(async()=>{saveGoogleConfig(config);setReady(false);setMessage('Asetukset tallennettu vain tälle laitteelle. Kirjaudu Googleen uudelleen.');})}>Tallenna ja aloita alusta</button>
  {!configured&&<p className="field-error" role="alert">Täytä kaikki kolme kenttää. Sen jälkeen voit valmistella yhteyden.</p>}
  <p className="hint">Tämän sivun osoite: <strong>{location.origin}</strong>. Lisää se Cloud Consolessa OAuth-asiakkaan JavaScript-lähteisiin, muuten Google hylkää kirjautumisen (virhe 400 origin_mismatch).</p>
  {online&&<><label>Jaetun kansion linkki tai tunnus<input value={link} placeholder="https://drive.google.com/drive/folders/…" onChange={e=>setLink(e.target.value.trim())}/></label><button className="secondary" disabled={busy||!link} onClick={()=>void action(async()=>{const read=await readDriveFolder(link);await setDriveFolder(read);setFolder(read);setMessage(`Kansio yhdistetty: ${read.name}. Mitään ei kirjoitettu.`);})}>Yhdistä kansio linkistä</button><button className="secondary" disabled={busy} onClick={()=>void action(async()=>{const selected=await selectDriveFolder();await setDriveFolder(selected);setFolder(selected);setMessage(`Kansio valittu: ${selected.name}.`);})}>{folder?`Vaihda kansio: ${folder.name}`:'Valitse kansio Googlen valikoosta'}</button><button className="text-button" onClick={()=>{disconnect();setOnline(false);}}>Katkaise yhteys</button></>}
  {folder&&<p>Kansio: <strong>{folder.name}</strong></p>}<p>Odottavia kirjauksia: {pending.length}</p>
  {online&&folder&&<button className="secondary" disabled={busy} onClick={()=>void action(async()=>{const check=await checkSharedList(folder.id,localDate(),name);setMessage(check.exists?`Yhteys toimii. ${check.filename} löytyi ja sisältää ${check.days} päivää${check.vehicles.length?` (${check.vehicles.join(', ')})`:''}. Mitään ei kirjoitettu.`:'Yhteys toimii, mutta tiedostoa ei ole vielä. Sovellus luo sen, kun ensimmäisen päivän lähetät.');})}>Tarkista yhteys (ei kirjoita)</button>}
  <p role="status">{step.message}</p><button className="primary" disabled={busy||!configured} onClick={()=>void action(nextStep)}>{busy?'Odota…':step.label}</button>
 {pending.some(j=>j.folderId&&j.folderId!==folder?.id)&&<p className="hint">Osa kirjauksista kuuluu toiseen kansioon. Valitse niiden alkuperäinen kansio synkronointiin.</p>}
 {pending.map(j=><p className="hint" key={j.id}>{j.draft.values.date} · {j.draft.values.vehicle} · {j.message||'Tallessa puhelimessa'}</p>)}
 {message&&<p role="status">{message}</p>}{error&&<p className="field-error" role="alert">{error}</p>}
 <p className="hint">Google pyytää Drive-käyttöoikeuden. Sovellus käsittelee vain valitsemaasi kansiota. Google-kirjautumista tai verkkoyhteyttä ei tarvita päivän kirjaamiseen.</p></section>;
}
