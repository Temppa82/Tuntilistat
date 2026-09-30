'use client';

import { useEffect,useRef,useState } from 'react';

import { ArrowLeft,ArrowRight,Check,Clock3,Truck,Settings,Route } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';

import { RadioGroup,RadioGroupItem } from '@/components/ui/radio-group';

import { Progress } from '@/components/ui/progress';

import { Dialog,DialogContent,DialogTitle,DialogDescription } from '@/components/ui/dialog';

import { steps,initialState,validateDraft,suggestions,learnCities,newDraft,normalizeVehicle,localDate,rollToToday,displayDate,type CaptureState,type ListKind,type Field } from '@/lib/capture';

import {readLocal,writeLocal} from '@/lib/local-capture';

import LocalSave from './local-save';


import SavedFiles from './saved-files';

import OfflineStatus from './offline-status';

import InitialSetup from './initial-setup';

import VehicleSettings from './vehicle-settings';
import DriveSettings from './drive-settings';

import {getStored,putStored} from '@/lib/local-files';

import {ensurePeriod} from '@/lib/period-files';

import {openPamark,existingPamarkDay,type OpenedPamark} from '@/lib/open-pamark';

import DayBrowser from './day-browser';
import {existingHoursDay} from '@/lib/read-hours';
import {validDate} from '@/lib/capture';
import {dayKey,sameDayValues,hasDayValues} from '@/lib/day-drafts';
import {snapshot,noteStep,sameSnapshot,undoStep,type DraftSnapshot,type HistoryEntry} from '@/lib/draft-history';
import {discardSavedDay} from '@/lib/remove-day';
 const APP_VERSION='2.13.10';


export default function CaptureApp(){

 const [state,setState]=useState<CaptureState|null>(null),[status,setStatus]=useState('Ladataan luonnoksia⬦'),[error,setError]=useState(''),[settings,setSettings]=useState(false),[city,setCity]=useState('');

  // Kumoa palauttaa edellisen kysymyksen arvon, joten historia on
  // kysymyskohtainen. Se pidetään vain tämän istunnon muistissa eikä se
  // tallennu luonnoksen mukana, joten se ei kasva rajatta.
  const [history,setHistory]=useState<Record<ListKind,HistoryEntry[]>>({hours:[],pamark:[]}),entered=useRef<Partial<Record<ListKind,DraftSnapshot>>>({});
  // Kertoo, että seuraava tallennus on käyttäjän oma muutos nykyisessä
  // kysymyksessä. Muuten vaiheen sisään tullut arvo päivitetään uuteen, jotta
  // tiedostosta avatut arvot eivät jää kumottaviksi.
  const edited=useRef(false);
  const [notice,setNotice]=useState(''),[discarding,setDiscarding]=useState(false),[discardBusy,setDiscardBusy]=useState(false);

  const [opened,setOpened]=useState<OpenedPamark>(),[opening,setOpening]=useState(false),[openError,setOpenError]=useState(''),[refresh,setRefresh]=useState(0);

 const [difference,setDifference]=useState<{local:ReturnType<typeof newDraft>;file:ReturnType<typeof newDraft>;kind:ListKind;resolve:(d:ReturnType<typeof newDraft>)=>void}>();
 function reconcile(selected:ListKind,local:ReturnType<typeof newDraft>,file:ReturnType<typeof newDraft>){
  if(!hasDayValues(selected,local)||sameDayValues(selected,local,file))return Promise.resolve(file);
  const key=selected+'|'+local.id+'|'+JSON.stringify(file.values);if(reconciled.current===key)return Promise.resolve(local);reconciled.current=key;
  return new Promise<ReturnType<typeof newDraft>>(resolve=>setDifference({local,file,kind:selected,resolve}));
 }
 const currentState=useRef(state);currentState.current=state;const switching=useRef(false);const reconciled=useRef('');const lastImported=useRef<CaptureState['drafts']['pamark']|null>(null);

  useEffect(()=>{const changed=()=>setRefresh(n=>n+1);window.addEventListener('focus',changed);return()=>window.removeEventListener('focus',changed);},[]);

 const [setup,setSetup]=useState<boolean|null>(null),[vehicleMenu,setVehicleMenu]=useState(false);

 useEffect(()=>{getStored<boolean>('setup:complete').then(v=>setSetup(!!v)).catch(()=>setSetup(false));},[]);

 const [errors,setErrors]=useState<Partial<Record<Field,string>>>({});const sequence=useRef(0),queue=useRef(Promise.resolve()),inputRef=useRef<HTMLInputElement>(null);

 useEffect(()=>{let mounted=true;readLocal().then(s=>{if(mounted){const today=localDate();setState(s?{...s,drafts:{hours:rollToToday(s.drafts.hours,today),pamark:rollToToday(s.drafts.pamark,today)}}:initialState());setStatus('Luonnokset säilyvät tällä laitteella.');}}).catch(()=>{if(mounted)setError('Paikallisia luonnoksia ei voitu avata. Älä tyhjennä selaimen tietoja.');});return()=>{mounted=false;};},[]);

  function update(next:CaptureState){
   // Kun sovellus itse vaihtaa päivän sisältöön ilman että luonnos vaihtuu,
   // esimerkiksi tiedostosta avattaessa tai kun luonnos ja tiedosto eriävät,
   // sisään tullut arvo on uusi sisältö. Muuten Kumoa palauttaisi tiedoston
   // vanhat arvot heti avauksen jälkeen.
   const previous=currentState.current;
   if(previous&&!edited.current&&previous.active){const list=previous.active,before=previous.drafts[list],after=next.drafts[list];
    if(before&&after&&!sameSnapshot(snapshot(before),snapshot(after)))entered.current[list]=snapshot(after);}
   edited.current=false;
   currentState.current=next;setState(next);setStatus('Tallennetaan luonnosta⬦');setError('');const current=++sequence.current;queue.current=queue.current.catch(()=>{}).then(()=>writeLocal(next)).then(()=>{if(current===sequence.current)setStatus('Luonnos tallessa tällä laitteella.');}).catch(()=>{if(current===sequence.current){setError('Luonnoksen tallennus ei onnistunut. Pidä tämä sivu auki ja yritä uudelleen.');setStatus('Luonnos ei ole tallentunut.');}});}

 function choose(kind:ListKind){if(!state)return;if(kind==='pamark')setRefresh(n=>n+1);if(state.name.trim().length<3){setError('Kirjoita ensin oma etu- ja sukunimesi.');return;}setErrors({});setCity('');update({...state,name:state.name.trim(),nameLocked:true,active:kind});}

 const kind=state?.active,draft=kind&&state?state.drafts[kind]:null,list=kind?steps[kind]:[],step=draft?list[draft.step]:null;

 useEffect(()=>{if(!setup||!state?.name||!kind||!draft?.values.date)return;let live=true;

  if(kind==='hours'){const original=state.drafts.hours;ensurePeriod(kind,draft.values.date,state.name).then(async file=>{
  if(!live)return;const latest=currentState.current;if(!latest||latest.active!=='hours'||!sameDayValues('hours',original,latest.drafts.hours))return;
  const d=latest.drafts.hours,found=existingHoursDay(file.bytes,d,latest.name);if(!found)return;
  const chosen=await reconcile('hours',d,found);if(!live||currentState.current!==latest)return;
  lastImported.current=chosen===found?found:null;update({...latest,drafts:{...latest.drafts,hours:chosen}});
  }).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};}

 setOpening(true);setOpenError('');setOpened(undefined);

 openPamark(draft.values.date,state.name).then(result=>{if(live)setOpened(result);}).catch(e=>{if(live)setOpenError(e instanceof Error?e.message:'Ajolistan haku epäonnistui.');}).finally(()=>{if(live)setOpening(false);});return()=>{live=false;};

 },[setup,kind,draft?.values.date,state?.name,refresh]);

 useEffect(()=>{if(kind!=='pamark'||!opened?.bytes)return;const latest=currentState.current;if(!latest||latest.active!=='pamark')return;const d=latest.drafts.pamark;if(!d.values.vehicle)return;

 try{const found=existingPamarkDay(opened.bytes,d);if(found){void reconcile('pamark',d,found).then(chosen=>{if(currentState.current!==latest)return;lastImported.current=chosen===found?found:null;update({...latest,drafts:{...latest.drafts,pamark:chosen}});});}}catch(e){setOpenError(e instanceof Error?e.message:'Päivän tietoja ei voitu lukea.');}

  },[opened,kind,draft?.values.vehicle,draft?.id]);

  // Vaihehistoria koskee vain tätä päivää. Uusi luonnos tyhjentää sen, muuten
  // vanha Kumoa palauttaisi toisen päivän arvoja tähän päivään.
  useEffect(()=>{if(!kind||!draft)return;entered.current[kind]=snapshot(draft);setHistory(h=>h[kind].length?{...h,[kind]:[]}:h);},[kind,draft?.id]);

 async function openDay(date:string,vehicle:string,source=false){
  if(switching.current)return;switching.current=true;try{await loadDay(date,vehicle,source);}finally{switching.current=false;}
 }
 async function loadDay(date:string,vehicle:string,source=false){
  const before=currentState.current;if(!before?.active)return;const selected=before.active,old=before.drafts[selected];
  if(!validDate(date)||date>localDate())throw new Error('Valitse kelvollinen päivämäärä.');
  if(selected==='pamark'&&!/^[A-Z0-9ÅÄÖ]{1,6}-[A-Z0-9ÅÄÖ]{1,6}$/.test(normalizeVehicle(vehicle)))throw new Error('Valitse ajoneuvon rekisterinumero, esimerkiksi ABC-123.');
  const imported=lastImported.current;
  if(!imported||imported.id!==old.id||JSON.stringify(imported.values)!==JSON.stringify(old.values)||imported.overnight!==old.overnight)
   await putStored(dayKey(selected,before.name,old.values.date,old.values.vehicle),old);
  const base=newDraft();base.values.date=date;base.values.vehicle=selected==='pamark'?normalizeVehicle(vehicle):'';base.step=steps[selected].length;
  const cached=await getStored<typeof old>(dayKey(selected,before.name,date,vehicle));
  const file=selected==='pamark'?await openPamark(date,before.name):await ensurePeriod('hours',date,before.name);
  const entry=file.bytes?(selected==='pamark'?existingPamarkDay(file.bytes,base):existingHoursDay(file.bytes,base,before.name)):undefined;
  const fileDraft=entry||base;
  if(selected==='pamark'&&file.bytes&&!entry)fileDraft.pamarkBase='absent';
  let next=source?fileDraft:cached?(file.bytes?await reconcile(selected,cached,fileDraft):cached):fileDraft;
  const found=!!entry||!!cached;
  const latest=currentState.current;
  if(!latest||latest.active!==selected||JSON.stringify(latest.drafts[selected])!==JSON.stringify(old))throw new Error('Lomaketta muutettiin haun aikana. Avaa päivä uudelleen.');
  reconciled.current=selected+'|'+next.id+'|'+JSON.stringify(fileDraft.values);
  lastImported.current=next===fileDraft?next:null;
  update({...latest,drafts:{...latest.drafts,[selected]:next}});setErrors({});setError('');
   requestAnimationFrame(()=>document.querySelector('.question-panel')?.scrollIntoView({block:'start'}));
   setStatus((found?(cached&&!source?'Valitun päivän paikallinen luonnos avattu.':'Valitun päivän tiedot avattu tiedostosta.'):'Päivälle ei ole kirjauksia. Voit täyttää uuden päivän.')+('excluded' in file&&file.excluded?' Lähettämätön kirjauksesi ei sovi tiedoston tähän riviin, joten se jäi tallennusjonoon. Muokkaa päivää tiedoston version päälle ja tallenna uudelleen.':''));
 }

  // Tyhjennetään vain juuri poistettu päivä; muut keskeneräiset luonnokset ja
  // toisen listan täyttö säilyvät. Oletuksena näytetään katsausnäkymä, jotta
  // käyttäjä näkee, että päivä on tyhjä eikä vain kadonnut näkyvistä.
  // Tyhjennetyn lomakkeen oletusaskel on 0 eli ensimmäinen kysymys, sama mihin
  // "Aloita uusi päivä" palaa. Aiemmin oletus oli steps.length, joka ohjasi
  // tarkistusnäytölle: sieltä näkyivät vain ajoneuvo ja päivämäärä, ja lomake
  // vaikutti silti olevan keskeneräinen vaikka luonnos oli poistettu.
  function resetForm(selected:ListKind,date:string,vehicle:string,step=0){
   if(!state)return;
   const fresh=newDraft();fresh.values.date=date;fresh.values.vehicle=vehicle;fresh.step=step;
   entered.current[selected]=snapshot(fresh);setHistory(h=>({...h,[selected]:[]}));
   setErrors({});setError('');update({...state,drafts:{...state.drafts,[selected]:fresh}});
  }

  // Poistettu päivä ei saa jäädä lomakkeeseen, jolloin tallennus kirjoittaisi
  // sen heti takaisin listaan.
  function forgetDay(date:string,vehicle:string){
   if(!kind||!draft)return;
   if(draft.values.date!==date)return;
   if(kind==='pamark'&&normalizeVehicle(draft.values.vehicle)!==normalizeVehicle(vehicle))return;
   resetForm(kind,date,kind==='pamark'?normalizeVehicle(vehicle):'');
  }

  // Hylkää keskeneräisen päivän: lomake ja muistiluonnos tyhjentyvät, ja jos päivä
  // on jo tallennettu listaan, se poistetaan myös sieltä ja tallennuskansiosta.
  async function discardDayNow(){
   if(!state||!kind||!draft)return;
   setDiscardBusy(true);
   try{
     const date=draft.values.date,vehicle=kind==='pamark'?normalizeVehicle(draft.values.vehicle):'';
     
    const result=await discardSavedDay(kind,date,vehicle,state.name);
    resetForm(kind,date,vehicle);
    setNotice(result.removed?`Päivän täyttö hylättiin ja päivä poistettiin tiedostosta ${result.filename}. Laskukaavat säilyivät.`:'Päivän täyttö hylättiin. Päivää ei ollut tallennettu tiedostoon, joten tiedostoa ei muutettu.');
    }catch(e){setError(e instanceof Error?e.message:'Päivän hylkääminen epäonnistui.');}
   finally{setDiscardBusy(false);setDiscarding(false);}
  }

  // Palauttaa edellisen kysymyksen arvon ja vie sen takaisin kysymykseen.
  function undo(){
   if(!state||!kind||!draft||!history[kind].length)return;
   const {history:rest,entry}=undoStep(history[kind]);
   setHistory({...history,[kind]:rest});
   entered.current[kind]={values:{...entry.values},overnight:entry.overnight};
   setErrors({});setError('');setNotice('');
   update({...state,drafts:{...state.drafts,[kind]:{...draft,step:entry.step,updatedAt:new Date().toISOString(),values:{...entry.values},overnight:entry.overnight}}});
  }

   // Muutos kirjataan heti, jotta Kumoa toimii myös ennen kuin vaiheesta
  // siirrytään pois. Vaiheelle muistetaan vain sisään tullut tila, joten
  // myöhemmät muutokset palauttavat aina alkuperäisen arvon.
  function noteChange(selected:ListKind,current:NonNullable<typeof draft>){
   edited.current=true;
   const before=entered.current[selected];if(!before)return;
   setHistory(h=>{const next=noteStep(h[selected],before,current.step,true);return next===h[selected]?h:{...h,[selected]:next};});
  }

 function answer(field:Field,value:string){if(!state||!kind||!draft)return;
   if(field==='date'&&validDate(value)&&value!==draft.values.date){void openDay(value,draft.values.vehicle).catch(e=>setError(e.message));return;}
   if(field==='vehicle'&&kind==='pamark'){if(normalizeVehicle(value)!==normalizeVehicle(draft.values.vehicle))void openDay(draft.values.date,value).catch(e=>setError(e.message));return;}
   setNotice('');noteChange(kind,draft);setErrors(e=>({...e,[field]:undefined}));update({...state,drafts:{...state.drafts,[kind]:{...draft,updatedAt:new Date().toISOString(),values:{...draft.values,[field]:value}}}});
  }

  // Siirtyessä pois vaiheesta täydennetään historia niillä muutoksilla, joita
  // ei kirjattu kentän kautta, kuten yövalinnalla.
  function move(index:number,check=false){if(switching.current)return;if(!state||!kind||!draft)return;const found=validateDraft(kind,draft);if(check&&step&&found[step.field]){setErrors(found);inputRef.current?.focus();return;}setErrors({});
   const before=entered.current[kind];if(before)setHistory(h=>{const next=noteStep(h[kind],before,draft.step,!sameSnapshot(before,draft));return next===h[kind]?h:{...h,[kind]:next};});
   entered.current[kind]=snapshot(draft);
   update({...state,drafts:{...state.drafts,[kind]:{...draft,step:index}}});}

 function addCity(value:string){if(!state||!draft||!kind||!value.trim())return;noteChange(kind,draft);const route=[draft.values.route,value.trim()].filter(Boolean).join(' - ');if(route.length>1000)return;update({...state,cities:learnCities(state.cities,value.trim()),drafts:{...state.drafts,[kind]:{...draft,values:{...draft.values,route},updatedAt:new Date().toISOString()}}});setCity('');}

 if(!state)return <main className="capture"><h1>Työpäivän kirjaukset</h1><p role={error?'alert':'status'}>{error||status}</p>{error&&<button className="secondary" onClick={()=>location.reload()}>Yritä uudelleen</button>}</main>;

 if(setup===null)return <main className="capture"><p>Ladataan tallennusasetuksia⬦</p></main>;

 if(!setup)return <main className="capture"><InitialSetup name={state.name} onDone={name=>{update({...state,name,nameLocked:true});setSetup(true);}}/></main>;

 return <main className="capture"><header className="capture-header"><span className="brand-mark"><Route size={24}/></span><strong>Työpäivän kirjaukset</strong><button className="icon-button" aria-label="Asetukset" onClick={()=>setSettings(true)}><Settings/></button></header>

 {difference&&<Dialog open onOpenChange={()=>{}}><DialogContent><DialogTitle>Luonnos ja tiedosto eroavat</DialogTitle><DialogDescription>Valitse, kumpaa jatketaan. Paikallinen luonnos säilyy erikseen.</DialogDescription><dl>{steps[difference.kind].filter(({field})=>difference.local.values[field]!==difference.file.values[field]).map(({field,label})=><div key={field}><dt>{label}</dt><dd>Luonnos: {difference.local.values[field]||'tyhjä'} · Tiedosto: {difference.file.values[field]||'tyhjä'}</dd></div>)}</dl>{difference.local.overnight!==difference.file.overnight&&<p>Seuraavan päivän valinta eroaa.</p>}<button onClick={()=>{difference.resolve(difference.local);setDifference(undefined);}}>Jatka luonnosta</button><button onClick={()=>{void putStored(dayKey(difference.kind,state.name,difference.local.values.date,difference.local.values.vehicle),difference.local).then(()=>{difference.resolve(difference.file);setDifference(undefined);}).catch(e=>setError(e.message));}}>Jatka tiedoston tiedoilla</button></DialogContent></Dialog>}
 <OfflineStatus/><section className="capture-profile"><label htmlFor="capture-name">Oma nimi<input id="capture-name" value={state.name} readOnly={state.nameLocked} placeholder="Etunimi Sukunimi" autoComplete="name" maxLength={100} onChange={e=>update({...state,name:e.target.value})}/></label><p className="hint">{state.nameLocked?'Sama nimi täytetään molempiin listoihin.':'Kirjoita nimi kerran ennen listan valintaa.'}</p></section>

 <nav className="list-choices" aria-label="Täytettävä lista"><button className={kind==='hours'?'selected':''} onClick={()=>choose('hours')}><Clock3/><span><strong>Tunnit</strong><small>Henkilökohtainen tuntilista</small></span></button><button className={kind==='pamark'?'selected':''} onClick={()=>choose('pamark')}><Truck/><span><strong>Pamark ajolista</strong><small>Päivittäiset ajot laskutukseen</small></span></button></nav>

 <p className="draft-status" role="status"><Check size={16}/>{status}</p>{error&&<div className="error-box" role="alert">{error}<button className="secondary" onClick={()=>update(state)}>Yritä tallennusta uudelleen</button></div>}

  {!kind?<section className="capture-start"><h1>Valitse lista ja aloita.</h1><p>Voit täyttää osan aamulla ja jatkaa illalla. Listojen välillä vaihtaminen säilyttää molemmat luonnokset.</p></section>:draft&&<section className="question-panel"><div className="question-progress"><span>{kind==='hours'?'Tunnit':'Pamark ajolista'}</span><span>{Math.min(draft.step+1,list.length)} / {list.length}</span></div><Progress value={Math.min((draft.step+1)/list.length*100,100)}/>

 {step?<form onSubmit={e=>{e.preventDefault();move(draft.step+1,true);}} noValidate><h1 id="question-label">{step.label}</h1>{step.hint&&<p id="question-hint">{step.hint}</p>}

 {step.type==='yesno'?<RadioGroup aria-labelledby="question-label" value={draft.values[step.field]} onValueChange={v=>answer(step.field,v)} className="answer-options"><label><RadioGroupItem value="1"/>Kyllä</label><label><RadioGroupItem value="0"/>Ei</label></RadioGroup>:step.type==='route'?<div><textarea aria-labelledby="question-label" value={draft.values.route} maxLength={1000} onChange={e=>answer('route',e.target.value)} onBlur={()=>update({...state,cities:learnCities(state.cities,draft.values.route)})} placeholder="Vantaa - Espoo - Vantaa"/><div className="city-add"><input aria-label="Lisää kaupunki reittiin" value={city} onChange={e=>setCity(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCity(city);}}} placeholder="Lisää kaupunki"/><button type="button" className="secondary" disabled={!city.trim()} onClick={()=>addCity(city)}>Lisää</button></div><div className="city-suggestions">{suggestions(state.cities,city).map(c=><button type="button" className="secondary" key={c} onClick={()=>addCity(c)}>{c}</button>)}</div></div>:<input key={step.field+draft.id} ref={inputRef} className="question-input" aria-labelledby="question-label" aria-describedby={step.hint?'question-hint':undefined} aria-invalid={!!errors[step.field]} type={step.type==='number'?'text':step.type} inputMode={step.type==='number'?(step.step===.5?'decimal':'numeric'):undefined} step={step.type==='time'?1800:undefined} value={step.field==='vehicle'&&kind==='pamark'?undefined:draft.values[step.field]} defaultValue={step.field==='vehicle'&&kind==='pamark'?draft.values.vehicle:undefined} onBlur={e=>{if(step.field==='vehicle'&&kind==='pamark')answer('vehicle',e.target.value);}} maxLength={step.field==='vehicle'?13:30} autoComplete="off" onChange={e=>{if(step.field!=='vehicle'||kind!=='pamark')answer(step.field,step.field==='vehicle'?normalizeVehicle(e.target.value):e.target.value);}}/>}

  {step.field==='end'&&<label className="check"><Checkbox checked={draft.overnight} onCheckedChange={v=>{noteChange(kind,draft);update({...state,drafts:{...state.drafts,[kind]:{...draft,overnight:v===true}}});}}/>Päättyy seuraavana päivänä</label>}

 {errors[step.field]&&<p className="field-error" role="alert">{errors[step.field]}</p>}

  <div className="question-actions"><button type="button" className="secondary" disabled={draft.step===0} onClick={()=>move(draft.step-1)}><ArrowLeft size={18}/>Edellinen</button><button className="primary" type="submit">{draft.step===list.length-1?'Tarkista':'Seuraava'}<ArrowRight size={18}/></button></div><button type="button" className="text-button" onClick={()=>move(draft.step+1)}>Täytän tämän myöhemmin</button></form>:<div className="capture-review"><h1>Tarkista kirjaukset</h1><dl>{list.map((s,i)=><div key={s.field}><dt>{s.label.replace('?','')}</dt><dd>{s.type==='yesno'?(draft.values[s.field]==='1'?'Kyllä':draft.values[s.field]==='0'?'Ei':'Puuttuu'):draft.values[s.field]||'Puuttuu'}<button className="text-button" onClick={()=>move(i)}>Muokkaa</button></dd></div>)}</dl>{Object.entries(validateDraft(kind,draft)).map(([field,message])=><p className="field-error" key={field}>{list.find(s=>s.field===field)?.label} {message}</p>)}<LocalSave key={kind} kind={kind} draft={draft} name={state.name} onNew={()=>resetForm(kind,localDate(),kind==='pamark'?draft.values.vehicle:'',0)}/></div>}

  <div className="capture-undo"><button type="button" className="text-button" disabled={!history[kind].length} onClick={undo}>Kumoa</button><button type="button" className="text-button discard" onClick={()=>{setNotice('');setDiscarding(true);}}>Hylkää päivä</button></div>
  <p className="hint capture-undo-hint" role="status">{notice||(()=>{const last=history[kind][history[kind].length-1];if(!last)return 'Kumoa palauttaa muutetun kysymyksen alkuperäisen arvon.';const field=list[last.step];return `Kumoa palauttaa vaiheen ${field?field.label.replace('?',''):'Tarkista'}.`;})()}</p>

  </section>}

  {/* Päiväkirja ja tuotu lista ovat toissijaisia työkaluja: varsinainen täyttö
      on yllä, joten puhelimella ei tarvitse selata tyhjää tilaa jokaisen
      kysymyksen kohdalla. Päivä avattaessa vieritetään lomakkeen kohdalle. */}
  {kind&&draft&&<DayBrowser key={kind} kind={kind} draft={draft} name={state.name} onOpen={openDay} onDeleted={forgetDay}/>}

  {kind==='pamark'&&<details className="phone-panel" aria-label="Avattu ajolista"><summary>Pamarkin ajolista</summary>{opening?<p role="status">Avataan ajolistaa⬦</p>:<><p><strong>{opened?.filename}</strong></p><p role="status">{openError||opened?.message}</p><button className="secondary" onClick={()=>setRefresh(n=>n+1)}>Lue ajolista uudelleen</button></>}<p className="hint">Ajolista tallennetaan vain tälle laitteelle. Tuotu valmis ajolista säilyy täysin ennallaan, ja päivät voi lisätä siihen jälkeenpäin.</p></details>}

  <details className="phone-panel"><summary>Tallennetut listat</summary><SavedFiles/></details>

   {discarding&&kind&&draft&&<Dialog open onOpenChange={v=>{if(!v)setDiscarding(false);}}><DialogContent><DialogTitle>Hylkääkö päivän täyttö?</DialogTitle><p className="hint discard-day"><strong>{displayDate(draft.values.date)}</strong>{kind==='pamark'&&draft.values.vehicle&&` · ${draft.values.vehicle}`}</p><DialogDescription>Tämän päivän tiedot poistetaan puhelimen muistista. Jos päivä on jo tallennettu {kind==='pamark'?'ajolistaan':'tuntilistaan'}, se poistetaan myös tiedostosta ja valitusta tallennuskansiosta. Tiedostosta poistamista ei voi perua.</DialogDescription><p className="hint">Laskukaavat säilyvät. Muut päivät ja toisen listan keskeneräinen täyttö eivät muutu.</p><button onClick={()=>void discardDayNow()} disabled={discardBusy}>{discardBusy?'Poistetaan…':'Hylkää päivä'}</button><button onClick={()=>setDiscarding(false)}>Peruuta</button></DialogContent></Dialog>}

  <Dialog modal={false} open={settings} onOpenChange={open=>{setSettings(open);if(!open)setVehicleMenu(false);}}><DialogContent className="capture-settings"><DialogTitle>Asetukset</DialogTitle><DialogDescription>Paikallinen tallennus ja ajoneuvokohtaiset tiedot.</DialogDescription>{vehicleMenu?<VehicleSettings name={state.name}/>:<><button className="primary" onClick={()=>setVehicleMenu(true)}>Ajoneuvot</button><button className="secondary" onClick={()=>{setSettings(false);setSetup(false);}}>Tallennuskansio ja listapohjat</button><DriveSettings name={state.name}/></>}<p className="hint">Tunnit-sovellus v{APP_VERSION} · rakennettu {__BUILD_DATE__}</p></DialogContent></Dialog>

 </main>;

}

