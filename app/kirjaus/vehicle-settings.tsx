import {useEffect,useState} from 'react';
import {fleet,saveVehicle,type Fleet} from '@/lib/vehicle-settings';
import {localDate} from '@/lib/capture';
import {updateLocalVehicle} from '@/lib/update-vehicle-file';
export default function VehicleSettings({name}:{name:string}){
 const [all,setAll]=useState<Fleet>({}),[reg,setReg]=useState(''),[date,setDate]=useState(localDate),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{fleet().then(setAll).catch(()=>setError('Ajoneuvoasetuksia ei voitu lukea.'));},[]);
 async function action(fn:()=>Promise<void>){setBusy(true);setMessage('');setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Päivitys epäonnistui.');}finally{setBusy(false);}}
 const value=all[reg];
 return <section><h2>Ajoneuvot</h2>{!reg?<div className="vehicle-list">{Object.keys(all).map(r=><button className="secondary" key={r} onClick={()=>{setReg(r);setMessage('');setError('');}}>{r}</button>)}</div>:value&&<><button className="secondary" disabled={busy} onClick={()=>setReg('')}>Takaisin ajoneuvoihin</button><h3>{reg}</h3>
 <label>Kulutus (l / 100 km)<input inputMode="decimal" value={value.consumption} onChange={e=>setAll({...all,[reg]:{...value,consumption:e.target.value}})}/></label>
 <label>CO₂-kerroin (g/ltr, pohjan yksikkö)<input inputMode="decimal" value={value.emission} onChange={e=>setAll({...all,[reg]:{...value,emission:e.target.value}})}/></label>
 <p className="hint">Pohja-arvot ovat yrityksen ajolistasta. Kerroin siirtyy myös tämän auton päästölaskentaan. Hintatiedot on jätetty pois.</p>
 <label>Päivitettävän jakson päivämäärä<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
  <button className="primary" disabled={busy||!date} onClick={()=>void action(async()=>{await saveVehicle(reg,value);await updateLocalVehicle(reg,value,date,name);setMessage('Asetukset tallennettu ja tämän auton tiedot päivitetty paikalliseen ajolistaan.');})}>Tallenna asetukset ja päivitä paikallinen lista</button>
  <p className="hint">Kerroin siirtyy myös tämän auton päästölaskentaan. Uusi jakson tiedosto saa tallennetut asetukset luotaessa. Asetukset eivät muuta jo kirjattuja päiviä.</p></>}
 {message&&<p role="status">{message}</p>}{error&&<p role="alert" className="field-error">{error}</p>}</section>;
}
