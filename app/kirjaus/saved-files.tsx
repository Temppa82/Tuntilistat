import {useEffect,useState} from 'react';
import {savedWorkbooks,downloadWorkbook,type SavedWorkbook} from '@/lib/local-files';
export default function SavedFiles(){
 const [files,setFiles]=useState<SavedWorkbook[]>([]),[error,setError]=useState('');
 useEffect(()=>{let live=true;const refresh=()=>savedWorkbooks().then(f=>{if(live)setFiles(f);}).catch(()=>{if(live)setError('Tallennettuja tiedostoja ei voitu avata.');});void refresh();window.addEventListener('local-workbooks-changed',refresh);return()=>{live=false;window.removeEventListener('local-workbooks-changed',refresh);};},[]);
 return <section className="saved-files"><h2>Puhelimeen tallennetut listat</h2><p className="hint">Nämä XLSX-tiedostot ovat sovelluksen muistissa tällä laitteella. Voit viedä niistä kopion laitteen Tiedostot-sovellukseen. Selaintietojen poistaminen poistaa sovelluksen paikalliset tiedot.</p>{!files.length&&<p>Ei vielä tallennettuja listoja.</p>}{files.map(f=><article key={f.filename}><strong>{f.filename}</strong><small>{new Date(f.updatedAt).toLocaleString('fi-FI')}</small><button className="secondary" onClick={()=>downloadWorkbook(f.filename,f.bytes)}>Vie XLSX</button></article>)}{error&&<p role="alert">{error}</p>}</section>;
}
