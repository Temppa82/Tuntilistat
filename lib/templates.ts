import type {ListKind} from './capture';
import {bundledTemplateBytes} from './templates-data';
import {XlsxDocument} from './xlsx-document';
import {validateTemplate} from './workbook-export';
import {getStored,putStored} from './local-files';
export type ListTemplate={name:string;bytes:Uint8Array};
const bundledNames:Record<ListKind,string>={hours:'Tuntilista Ajuri.xlsx',pamark:'Pamark ajolista.xlsx'};
export async function loadTemplate(kind:ListKind):Promise<ListTemplate>{
 const stored=await getStored<ListTemplate>(`template:${kind}`);
 if(stored)return stored;
 const bytes=bundledTemplateBytes(kind);
 validateTemplate(new XlsxDocument(bytes),kind);
 const template={name:bundledNames[kind],bytes};
 try{await putStored(`template:${kind}`,template);}catch{}
 return template;
}