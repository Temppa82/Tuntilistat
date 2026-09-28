import {useEffect,useState} from 'react';
import {localDate,type ListKind} from '@/lib/capture';
import {getStored,putStored,supportsFolders,chooseSharedFolder,sharedDirectory,permit,type StorageChoice} from '@/lib/local-files';
import {validateTemplate} from '@/lib/workbook-export';
import {XlsxDocument} from '@/lib/xlsx-document';
import {ensurePeriod} from '@/lib/period-files';
export default function InitialSetup({name,onDone}:{name:string;onDone:(name:string)=>void}){
 const [driver,setDriver]=useState(name),[storage,setStorage]=useState<StorageChoice>(),[templates,setTemplates]=useState<Partial<Record<ListKind,string>>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{Promise.all([getStored<StorageChoice>('storage:choice'),getStored<{name:string}>('template:hours'),getStored<{name:string}>('template:pamark')]).then(([s,h,p])=>{setStorage(s);setTemplates({hours:h?.name,pamark:p?.name});}).catch(()=>setError('Aloitusasetuksia ei voitu lukea.'));},[]);
 async function action(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Toiminto epäonnistui.');}finally{setBusy(false);}}
 async function template(kind:ListKind,file?:File){if(!file)return;await action(async()=>{const bytes=new Uint8Array(await file.arrayBuffer());validateTemplate(new XlsxDocument(bytes),kind);await putStored(`template:${kind}`,{name:file.name,bytes});setTemplates(t=>({...t,[kind]:file.name}));});}
 return <section className="phone-panel"><h1>Aloitetaan nimestä ja tallennuspaikasta</h1><label>Kuljettajan etu- ja sukunimi<input autoComplete="name" value={driver} onChange={e=>setDriver(e.target.value)} maxLength={100}/></label>
 <h2>Mihin listat tallennetaan?</h2><p>Molemmat listat käyttävät samaa tallennuspaikkaa.</p>
 {supportsFolders()?<button className="primary" disabled={busy} onClick={()=>void action(async()=>{const d=await chooseSharedFolder();setStorage({mode:'folder',name:d.name});})}>Valitse paikallinen kansio</button>:<p className="hint">Tämä puhelinselain ei anna sovellukselle pysyvää kirjoitusoikeutta Tiedostot-sovelluksen kansioon. Listat voidaan tallentaa sovelluksen paikalliseen muistiin ja viedä sieltä Tiedostot-sovellukseen.</p>}
 <button className="secondary" disabled={busy} onClick={()=>void action(async()=>{const s:StorageChoice={mode:'browser',name:'Sovelluksen paikallinen muisti'};await putStored('storage:choice',s);setStorage(s);})}>Käytä sovelluksen paikallista muistia</button>
 {storage&&<p>Tallennuspaikka: <strong>{storage.name}</strong></p>}
  <h2>Listapohjat (vapaaehtoinen)</h2><p className="hint">Sovelluksen mukana tulevat valmiit listapohjat (Tuntilista Ajuri.xlsx ja Pamark ajolista.xlsx). Voit tarvittaessa vaihtaa ne omiin tiedostoihisi; alkuperäisiä ei muuteta.</p>
  {(['hours','pamark'] as const).map(kind=><label key={kind}>{kind==='hours'?'Tuntilista Ajuri.xlsx':'Pamark ajolista.xlsx'}{templates[kind]&&<small> – vaihdettu: {templates[kind]}</small>}<input type="file" accept=".xlsx" disabled={busy} onChange={e=>void template(kind,e.target.files?.[0])}/></label>)}
 <button className="primary" disabled={busy||driver.trim().length<3||!storage} onClick={()=>void action(async()=>{const d=await sharedDirectory();if(d)await permit(d);await ensurePeriod('hours',localDate(),driver.trim());await putStored('setup:complete',true);onDone(driver.trim());})}>{busy?'Valmistellaan…':'Tallenna ja aloita'}</button>
 {error&&<p className="field-error" role="alert">{error}</p>}</section>;
}
