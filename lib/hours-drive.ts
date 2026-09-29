import {connected,findDriveWorkbook,downloadDriveWorkbook,uploadDriveWorkbook,createDriveWorkbook} from './google-drive';
import {digest} from './local-files';

// Tuntilista on kuljettajan oma, ei jaettu kuten Pamarkin ajolista. Lähetys korvaa
// kokonaisen tiedoston, joten ristiriita on erilainen kuin sulautuksessa: onko saman
// niminen tiedosto jo kansiossa ja eroaako se omasta kopiosta. Käyttäjä päättää, haluaako
// hän korvata sen. Mitään ei korvata ilman nimenomaista valintaa.
export class HoursDriveConflict extends Error {
 constructor(){super('Kansioon on jo tallennettu toisenlainen versio tästä tuntilistasta. Lähetä vain jos haluat korvata sen.');this.name='HoursDriveConflict';}
}
export type HoursDriveOutcome='created'|'uploaded'|'unchanged';
export async function sendHoursWorkbook(folderId:string,filename:string,bytes:Uint8Array,overwrite=false):Promise<HoursDriveOutcome>{
 if(!connected())throw new Error('Yhdistä Google-tili asetuksissa.');
 const file=await findDriveWorkbook(folderId,filename);
 if(!file){await createDriveWorkbook(folderId,filename,bytes);await verifyHoursDrive(folderId,filename,bytes);return 'created';}
 const remote=await downloadDriveWorkbook(file);
 if(await digest(remote)===await digest(bytes))return 'unchanged';
 if(!overwrite)throw new HoursDriveConflict();
 await uploadDriveWorkbook(file,bytes);
 await verifyHoursDrive(folderId,filename,bytes);return 'uploaded';
}
// Vahvistus lukee tallennetun tiedoston takaisin ja vertaa sitä omiin tietoihin,
// jotta käyttäjä ei luule lähetystä onnistuneeksi jos Drive ei ottanut sisältöä vastaan.
async function verifyHoursDrive(folderId:string,filename:string,bytes:Uint8Array){
 const confirmed=await findDriveWorkbook(folderId,filename);
 if(!confirmed)throw new Error('Drive-tallennusta ei voitu vahvistaa. Yritä uudelleen.');
 if(await digest(await downloadDriveWorkbook(confirmed))!==await digest(bytes))throw new Error('Driven tarkistus ei mennyt läpi. Tiedosto säilyy puhelimella; yritä uudelleen.');
 return true;
}