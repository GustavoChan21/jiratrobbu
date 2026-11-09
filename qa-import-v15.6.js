const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={globalThis:{}};ctx.window=ctx.globalThis;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('/mnt/data/jira156/csv-import-v15.2.js','utf8'),ctx);
const P=ctx.globalThis.TrobbuCsvImport;
const tests=[]; const t=(name,fn)=>tests.push([name,fn]);

t('CSV simple oficial',()=>{const r=P.parseGoogleSheetsCsv('Titulo*,Producto*,Descripcion\nTarea,ADM,Ok');assert.equal(r.headerCheck.valid,true);assert.equal(r.records[0]['Titulo*'],'Tarea')});
t('BOM UTF-8',()=>{const r=P.parseGoogleSheetsCsv('\uFEFFTitulo*,Producto*\nTarea,ADM');assert.equal(r.headerCheck.valid,true)});
t('Google Sheets con 3 filas previas',()=>{const r=P.parseGoogleSheetsCsv('Plantilla Backlog TROBBU\nInstrucciones\n\nTitulo*,Producto*,Descripcion\nEJEMPLO - fila,ADM,test\nTarea real,AUT,ok');assert.equal(r.headerRowIndex,3);assert.equal(r.headerCheck.valid,true);assert.equal(r.records[1]['Producto*'],'AUT');assert.equal(r.records[1].__rowNumber,6)});
t('Título acentuado',()=>{const r=P.parseGoogleSheetsCsv('Título*,Producto*\nTarea,ADM');assert.equal(r.headerCheck.valid,true);assert.equal(r.headers[0],'Titulo*')});
t('Asterisco separado por espacio',()=>{const r=P.parseGoogleSheetsCsv('Titulo *,Producto *\nTarea,ADM');assert.equal(r.headerCheck.valid,true)});
t('Sin asterisco tolerado',()=>{const r=P.parseGoogleSheetsCsv('Titulo,Producto\nTarea,ADM');assert.equal(r.headerCheck.valid,true);assert.deepEqual(r.headers.slice(0,2),['Titulo*','Producto*'])});
t('NBSP y zero-width',()=>{const r=P.parseGoogleSheetsCsv('\u200BTitulo*\u00A0,\u200BProducto*\nTarea,ADM');assert.equal(r.headerCheck.valid,true)});
t('Separador punto y coma',()=>{const r=P.parseGoogleSheetsCsv('Titulo*;Producto*;Descripcion\nTarea;FIN;Ok');assert.equal(r.delimiter,';');assert.equal(r.headerCheck.valid,true);assert.equal(r.records[0]['Producto*'],'FIN')});
t('Separador tab',()=>{const r=P.parseGoogleSheetsCsv('Titulo*\tProducto*\tDescripcion\nTarea\tSOC\tOk');assert.equal(r.delimiter,'\t');assert.equal(r.headerCheck.valid,true)});
t('Campo con coma entre comillas',()=>{const r=P.parseGoogleSheetsCsv('Titulo*,Producto*,Descripcion\n"Tarea, urgente",ADM,"Texto, prueba"');assert.equal(r.records[0]['Titulo*'],'Tarea, urgente')});
t('Campo multilinea entre comillas',()=>{const r=P.parseGoogleSheetsCsv('Titulo*,Producto*,Descripcion\nTarea,ADM,"Linea 1\nLinea 2"');assert.equal(r.records[0].Descripcion,'Linea 1\nLinea 2')});
t('Comillas escapadas',()=>{const r=P.parseGoogleSheetsCsv('Titulo*,Producto*,Descripcion\nTarea,APP,"Dice ""hola"""');assert.equal(r.records[0].Descripcion,'Dice "hola"')});
t('Fila vacía ignorada',()=>{const r=P.parseGoogleSheetsCsv('Titulo*,Producto*\n\nTarea,ADM\n');assert.equal(r.records.length,1)});
t('Encabezado inválido falla',()=>{const r=P.parseGoogleSheetsCsv('Nombre,Modulo\nTarea,ADM');assert.equal(r.headerCheck.valid,false);assert.equal(r.headerCheck.errors.length,2)});
t('Header detectado después de 10 filas',()=>{const pre=Array.from({length:12},(_,i)=>`nota ${i}`).join('\n');const r=P.parseGoogleSheetsCsv(pre+'\nTitulo*,Producto*\nTarea,ADM');assert.equal(r.headerRowIndex,12);assert.equal(r.headerCheck.valid,true)});
t('Alias Fecha de inicio/entrega',()=>{const r=P.parseGoogleSheetsCsv('Titulo*,Producto*,Fecha de inicio,Fecha de entrega\nTarea,ADM,2026-11-10,2026-11-12');assert.equal(r.headers[2],'Fecha inicio');assert.equal(r.headers[3],'Fecha limite')});

let pass=0;
for(const [name,fn] of tests){try{fn();pass++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e);process.exitCode=1}}
console.log(`RESULT ${pass}/${tests.length}`);
