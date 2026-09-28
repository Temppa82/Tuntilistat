import {useEffect,useState} from 'react';
export default function OfflineStatus(){
 const [ready,setReady]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{let live=true;const done=()=>{if(live)setReady(true);},fail=()=>setError(true);if('serviceWorker' in navigator)navigator.serviceWorker.ready.then(done);window.addEventListener('offline-ready',done);window.addEventListener('offline-error',fail);return()=>{live=false;window.removeEventListener('offline-ready',done);window.removeEventListener('offline-error',fail);};},[]);
 return <p className="hint" role="status">{error?'Offline-käyttöä ei saatu valmiiksi. Avaa sovellus verkossa uudelleen.':ready?'Valmis offline-käyttöön tällä laitteella.':'Avaa sovellus kerran verkkoyhteydessä, jotta offline-käyttö valmistuu.'}</p>;
}
