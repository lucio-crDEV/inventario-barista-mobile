// Local operator tool for a private snapshot envelope, not a public download API.
import {parseArgs} from 'node:util';
import {readFile,open,mkdir,unlink,link,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {excelTemplate} from '../data/inventario/export-template.js';
import {privateDestination} from './operations/storage.mjs';
import {generateSnapshotExcel} from '../worker/export-service.js';
const {values}=parseArgs({options:{snapshot:{type:'string'},output:{type:'string'}}});
if(!values.snapshot||!values.output)throw Error('Usa --snapshot ARCHIVO_PRIVADO.json --output COPIA_NUEVA.xlsx');
const input=privateDestination(values.snapshot,'.exports'),output=privateDestination(values.output,'.exports'),original=resolve(excelTemplate.path);
if(input===output||output===original)throw Error('El destino debe ser una copia nueva; el original es de solo lectura.');
if((await stat(input)).size>3000000)throw Error('Captura demasiado grande.');
let envelope;
try {envelope=JSON.parse(await readFile(input,'utf8'));}
catch {throw Error('Captura privada inválida; no se generó un archivo.');}
if(!envelope.snapshot||typeof envelope.sha256!=='string')throw Error('Usa una captura privada de include=source con su hash.');
// The exact stored JSON payload is needed for its source hash, not a reformatted
// approximation. A source response includes this byte-preserving field.
const result=await generateSnapshotExcel({snapshot:envelope.snapshot,payload:envelope.payload,
 sha256:envelope.sha256,templateBytes:new Uint8Array(await readFile(original))});
await mkdir(dirname(output),{recursive:true,mode:0o700});
const temporary=output+'.tmp-'+randomUUID();
const file=await open(temporary,'wx',0o600);
try {
 await file.writeFile(result.bytes);await file.sync();await file.close();
 await link(temporary,output); // Atomic publication, and never overwrites a target.
} catch(error) {await file.close().catch(()=>{});throw error;}
finally {await unlink(temporary);}
console.log(JSON.stringify({path:output,snapshotId:result.snapshotId,snapshotSha256:result.snapshotSha256,
 sha256:result.sha256,bytes:result.bytes.length,review:result.review,recalculateOnOpen:result.recalculateOnOpen},null,2));
