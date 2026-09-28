import {getStored,putStored,sharedDirectory,readWorkbook,writeWorkbook,permit,type SavedWorkbook} from './local-files';
import {applyVehicles,type VehicleData} from './vehicle-settings';
import {ensurePeriod} from './period-files';
import {workbookName} from './workbook-export';
import {XlsxDocument} from './xlsx-document';
import {connected,savedDriveFolder,findDriveWorkbook,downloadDriveWorkbook,uploadDriveWorkbook,DriveConflict} from './google-drive';
export async function updateLocalVehicle(reg:string,values:VehicleData,date:string,name:string){
 const dir=await sharedDirectory();if(dir)await permit(dir);await ensurePeriod('pamark',date,name);const filename=workbookName('pamark',date,name);
 const action=async()=>{const disk=dir?await readWorkbook(dir,filename):undefined;const cached=await getStored<SavedWorkbook>(`workbook:${filename}`);if(!disk&&!cached)throw new Error('Ajolista puuttuu.');const bytes=applyVehicles(disk||cached!.bytes,{[reg]:values});
 await putStored(`workbook:${filename}`,{filename,bytes,kind:'pamark',updatedAt:new Date().toISOString(),savedToFolder:false} satisfies SavedWorkbook);
 if(dir&&await writeWorkbook(dir,filename,bytes,disk)){await putStored(`workbook:${filename}`,{filename,bytes,kind:'pamark',updatedAt:new Date().toISOString(),savedToFolder:true} satisfies SavedWorkbook);}window.dispatchEvent(new Event('local-workbooks-changed'));};
 if(navigator.locks)await navigator.locks.request(`ajolista:${filename}`,action);else await action();
}
export async function updateDriveVehicle(reg:string,values:VehicleData,date:string,name:string){
 if(!connected())throw new Error('Kirjaudu Googleen Synkronoi Pamark Driveen -kohdassa.');const folder=await savedDriveFolder();if(!folder)throw new Error('Valitse jaettu Drive-kansio.');const filename=workbookName('pamark',date,name);
 for(let attempt=0;attempt<3;attempt++)try{
  const file=await findDriveWorkbook(folder.id,filename);if(!file)throw new Error('Jakson ajolista puuttuu Drivestä. Synkronoi ensin päivän kirjaus.');
  const bytes=applyVehicles(await downloadDriveWorkbook(file),{[reg]:values});await uploadDriveWorkbook(file,bytes);
  const confirmed=await findDriveWorkbook(folder.id,filename);if(!confirmed)throw new Error('Päivitystä ei voitu vahvistaa.');
  const latest=await downloadDriveWorkbook(confirmed);const actual=new XlsxDocument(latest).snapshot(),expected=new XlsxDocument(applyVehicles(latest,{[reg]:values})).snapshot();
  const header=Object.keys(expected).find(k=>/^E\d+$/.test(k)&&String(expected[k].value).replace(/^AUTO\s*:\s*/i,'').trim()===reg);if(!header)throw new Error('Auton päivitystä ei voitu vahvistaa.');const h=Number(header.slice(1));
  if(['G','I'].some(c=>actual[`${c}${h}`]?.value!==expected[`${c}${h}`]?.value)||Array.from({length:12},(_,i)=>h+3+i*2).some(r=>actual[`O${r}`]?.formula!==expected[`O${r}`]?.formula))throw new Error('Asetukset muuttuivat päivityksen jälkeen. Tarkista ajolista.');return;
 }catch(e){if(e instanceof DriveConflict&&attempt<2)continue;throw e;}
}
