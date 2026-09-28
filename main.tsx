import React from 'react';
import {createRoot} from 'react-dom/client';
import CaptureApp from './app/kirjaus/capture-app';
import './app/globals.css';
import './app/kirjaus/capture.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><CaptureApp/></React.StrictMode>);
if(import.meta.env.PROD&&'serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>window.dispatchEvent(new Event('offline-ready'))).catch(()=>window.dispatchEvent(new Event('offline-error')));});}
