type State={network:boolean;connected:boolean;ready:boolean;folderId?:string;pending:{folderId?:string}[]};
export function syncStep(s:State){
 if(!s.network)return {action:'offline',label:'Tarkista verkkoyhteys',message:'Ei verkkoyhteyttä. Kirjaukset säilyvät puhelimessa. Synkronointi tarvitsee internetin.'};
 if(!s.connected)return {action:s.ready?'connect':'prepare',label:s.ready?'Kirjaudu Googleen':'Valmistele Google-yhteys',message:'Google-yhteys puuttuu tai on vanhentunut. Yhdistä Google ennen synkronointia.'};
 if(!s.folderId)return {action:'folder',label:'Valitse jaettu Drive-kansio',message:'Valitse kansio, jossa yhteinen Pamarkin ajolista sijaitsee.'};
 if(!s.pending.length)return {action:'empty',label:'Tarkista lähetettävät kirjaukset',message:'Ei lähetettäviä kirjauksia. Tallenna valmis Pamark-päivä ensin Tallenna puhelimeen -painikkeella. Luonnosta ei lähetetä Driveen.'};
 if(!s.pending.some(j=>!j.folderId||j.folderId===s.folderId))return {action:'folder',label:'Vaihda Drive-kansio',message:'Odottavat kirjaukset kuuluvat toiseen Drive-kansioon. Valitse niiden alkuperäinen kansio.'};
 return {action:'sync',label:'Synkronoi',message:'Valmis synkronointiin. Painike lähettää tähän kansioon tallennetut päiväkirjaukset.'};
}
