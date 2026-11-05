// Prueba de humo del backend con una hoja de cálculo simulada (no necesita Google).
// Uso: node tests/backend.test.js        ·  SEP=";" node tests/backend.test.js  → hoja en español
const fs=require('fs'),vm=require('vm');
const SEP=process.env.SEP||',';
const code=fs.readFileSync(require('path').join(__dirname,'..','apps-script','Codigo.gs'),'utf8');
function Sheet(name){this.name=name;this.d=[];this.formulas={};}
Sheet.prototype={
 getName(){return this.name},isSheetHidden(){return !!this._hid},hideSheet(){this._hid=true},showSheet(){this._hid=false},setName(n){this.name=n;return this},
 get(r,c){const row=this.d[r-1];return row&&row[c-1]!==undefined?row[c-1]:''},
 set(r,c,v){while(this.d.length<r)this.d.push([]);const row=this.d[r-1];while(row.length<c)row.push('');row[c-1]=v},
 getLastRow(){for(let i=this.d.length;i>0;i--)if(this.d[i-1].some(v=>v!==''&&v!==null))return i;return 0},
 getLastColumn(){return Math.max(0,...this.d.map(r=>{for(let i=r.length;i>0;i--)if(r[i-1]!=='')return i;return 0}))},
 getMaxRows(){return Math.max(1000,this.d.length)},
 getRange(a,b,c,e){if(typeof a==='string')return new Range(this,1,1,1,1);return new Range(this,a,b,c||1,e||1)},
 getDataRange(){return new Range(this,1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn()))},
 getActiveRange(){return this._sel||null},
 appendRow(row){const r=this.getLastRow()+1;row.forEach((v,j)=>this.set(r,j+1,v))},
 deleteRow(r){this.d.splice(r-1,1)},deleteRows(r,n){this.d.splice(r-1,n)},
 clear(){this.d=[];this.formulas={}},createTextFinder(t){return new Range(this,1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn())).createTextFinder(t)},
 copyTo(ss){const s=new Sheet(this.name+' copy');s.d=JSON.parse(JSON.stringify(this.d));ss._sheets.push(s);return s},
 setFrozenRows(){},setFrozenColumns(){},setRowHeight(){},setColumnWidths(){},setColumnWidth(){}
};
function Range(sh,r,c,nr,nc){Object.assign(this,{sh,r,c,nr,nc})}
const chain=['setFontWeight','setFontColor','setBackground','setWrap','setVerticalAlignment','setNumberFormat','setFontSize','setFontFamily','setFontStyle','setDataValidation'];
chain.forEach(m=>Range.prototype[m]=function(){return this});
Object.assign(Range.prototype,{
 setValues(v){if(v.length!==this.nr||v.some(r=>r.length!==this.nc))throw new Error('setValues: tamaño '+v.length+'x'+(v[0]||[]).length+' ≠ rango '+this.nr+'x'+this.nc);v.forEach((row,i)=>row.forEach((x,j)=>{this.sh.set(this.r+i,this.c+j,x);if(typeof x==='string'&&x[0]==='=')this.sh.formulas[(this.r+i)+','+(this.c+j)]=x}));return this},
 setValue(v){this.sh.set(this.r,this.c,v);return this},
 setFormula(f){this.sh.formulas[this.r+','+this.c]=f;return this},
 clearContent(){delete this.sh.formulas[this.r+','+this.c];this.sh.set(this.r,this.c,'');return this},
 // simula la configuración regional: solo «=SUM(2<sep>5)» con el separador de la hoja da 7
 getValue(){const f=this.sh.formulas[this.r+','+this.c];return f==='=SUM(2'+SEP+'5)'?7:(f?'#ERROR!':this.sh.get(this.r,this.c))},
 getValues(){const o=[];for(let i=0;i<this.nr;i++){const row=[];for(let j=0;j<this.nc;j++)row.push(this.sh.get(this.r+i,this.c+j));o.push(row)}return o},
 getRow(){return this.r},getNumRows(){return this.nr},
 createTextFinder(t){const self=this;let entire=false;return{matchEntireCell(x){entire=x;return this},findNext(){for(let i=0;i<self.nr;i++)for(let j=0;j<self.nc;j++){const v=String(self.sh.get(self.r+i,self.c+j)).toLowerCase(),q=String(t).toLowerCase();if(entire?v===q:v.includes(q))return new Range(self.sh,self.r+i,self.c+j,1,1)}return null}}}
});
const ss={_sheets:[],_active:null,getSheetByName(n){return this._sheets.find(s=>s.name===n)||null},insertSheet(n,i){const s=new Sheet(n);if(i===0)this._sheets.unshift(s);else this._sheets.push(s);return s},getSheets(){return this._sheets},setSpreadsheetTimeZone(){},
 setActiveSheet(s){this._active=s},moveActiveSheet(i){const s=this._active;this._sheets.splice(this._sheets.indexOf(s),1);this._sheets.splice(i-1,0,s)},deleteSheet(s){this._sheets.splice(this._sheets.indexOf(s),1)},getActiveSheet(){return this._active},getActiveRangeList(){return this._active&&this._active._sel?{getRanges:()=>[this._active._sel]}:null}};
const cache={};
const ui={alert:(t,m)=>{console.log('[ALERT]',t,'|',String(m).replace(/\n/g,' / '));return 'YES'},prompt:(t,m)=>({getSelectedButton:()=> 'OK',getResponseText:()=>ctx.__answers.shift()}),ButtonSet:{OK:1,YES_NO:2,OK_CANCEL:3},Button:{YES:'YES',OK:'OK'},createMenu(){const m={addItem(){return m},addSeparator(){return m},addToUi(){}};return m}};
const props={};
const ctx={PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v})},
 SpreadsheetApp:{flush(){},getActive:()=>ss,getActiveSpreadsheet:()=>ss,getUi:()=>ui,newDataValidation:()=>({requireValueInList(){return this},setAllowInvalid(){return this},build(){return{}}})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},CacheService:{getScriptCache:()=>({get:k=>cache[k]===undefined?null:cache[k],put:(k,v)=>cache[k]=v,remove:k=>delete cache[k],getAll:ks=>Object.fromEntries(ks.filter(k=>k in cache).map(k=>[k,cache[k]])),putAll:o=>Object.assign(cache,o),removeAll:ks=>ks.forEach(k=>delete cache[k])})},
 Session:{getActiveUser:()=>({getEmail:()=>'rafael@unifranz.edu.bo'})},Utilities:{formatDate:(d)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')},
 ContentService:{createTextOutput:t=>({t,setMimeType(){return this}}),MimeType:{JSON:1,JAVASCRIPT:2}},Logger:{log:console.log},console,__answers:[]};
const fallo=m=>{console.error('FALLA:',m);process.exit(1)};
const J=o=>JSON.stringify(o);
// ── hoja de la versión anterior: CONFIG con parámetros viejos y RESPUESTAS con otra cabecera y una fila
const cfgV=ss.insertSheet('CONFIG');cfgV.d=[['Parámetro','Valor','Ayuda'],['Registro activo','SÍ',''],['Pestañas de docentes','BASEDEDATOSDOC',''],['Periodo','II-2026','']];
ss.insertSheet('RESPUESTAS').d=[['Marca temporal','ID envío','Correo del mentor'],['x','ME-VIEJO-AAAAAA','a@unifranz.edu.bo']];
// ── SIAR ficticio con las mismas columnas que el reporte real (incluye columnas que no se usan)
const CAB=['Ficha ID','Detalle ID','Hito','Gestión','Sede','Creador(a)','Seguimiento','Estado final','C.I.','Nombre estudiante','Correo','Celular','Carrera','cod. carrera','Semestre','Docente','Paralelo','Materia','Código materia','Necesidades','Tratamiento','Resultado','Detalle','Det. diagnostico'];
const fila=(f,d,h,sede,ci,nom,car,cod,sem,doc,par,mat,mc,trat,asig)=>[f,d,h,'II/2026',sede,'Dir','Seguimiento H2','Cierre pendiente',ci,nom,'est.'+nom.split(' ')[0].toLowerCase()+'@unifranz.edu.bo','70000000',car,cod,String(sem),doc,par,mat,mc,'x',trat,'En proceso',asig,'texto largo'];
ss.insertSheet('PADRON').d=[['Correo']];ss.insertSheet('AGREGADOS').d=[['Email']];
ss.insertSheet('FACULTADES').d=[['Código','Nombre que se ve en la app'],['FCS','Ciencias de la Salud'],['FI','Ingeniería y Tecnología']];
ss.insertSheet('CARRERAS').d=[['Código','Nombre que se ve en la app','Facultad'],['MED','Medicina','FCS'],['SIS','Ingeniería de Sistemas','FI']];
ss.insertSheet('BASEDEDATOS').d=[CAB,
 fila(1,101,2,'La Paz','60715469','ANA ELIZABETH OJEDA GUERRERO','Medicina','MED',1,'VITO RIVAS VARGAS','105','Anatomía Humana','AHU-211 (P)','Docente Tutor','RAFAEL ARAMAYO'),
 fila(1,102,2,'La Paz','60715469','ANA ELIZABETH OJEDA GUERRERO','Medicina','MED',1,'DORCAS OLIDEN','105','Histología','HIS-211 (P)','Apoyo Hermano mayor','JOSEPH MAMANI COPA'),
 fila(1,103,2,'La Paz','60715469','ANA ELIZABETH OJEDA GUERRERO','Medicina','MED',1,'ERIKA QUISBERT','105','Embriología Médica','EME-211 (P)','Ayudantia','ALGUIEN'),
 fila(2,201,2,'La Paz','61783360','GUINA VERONICA GUTIERREZ MAMANI','Medicina','MED',2,'VITO RIVAS VARGAS','105','Anatomía Humana','AHU-211 (P)','Docente Tutor','Rafael  Aramayo'),
 fila(2,202,3,'La Paz','61783360','GUINA VERONICA GUTIERREZ MAMANI','Medicina','MED',2,'ERIKA QUISBERT','105','Embriología Médica','EME-211 (P)','Docente Tutor',null),
 fila(3,301,2,'Cochabamba','1234567','PEDRO GOMEZ RUIZ','Ingeniería de Sistemas','SIS',3,'ANA PAZ','1','Bases de Datos','BDD-311 (P)','Apoyo Hermano mayor','JOSEPH MAMANI COPA'),
 fila(4,401,2,'El Alto','7654321','CARLA SOLIZ','Administración de Empresas','ADM',4,'LUIS PAZ','2','Contabilidad','CON-411 (C)','Docente Tutor','OTRA PERSONA'),
 fila(5,501,2,'El Alto','999888','NUEVO CODIGO','Carrera Nueva','XYZ',1,'X','1','Algo','ALG-111 (C)','Docente Tutor','OTRA PERSONA')];
vm.createContext(ctx);vm.runInContext(code,ctx);
ctx.configuracionInicial();
const cfg=ctx.config_();
console.log('CONFIG',J(ss.getSheetByName('CONFIG').d.map(r=>r[0]+'='+r[1])));
if(ss.getSheetByName('CONFIG').d.some(r=>r[0]==='Pestañas de docentes'))fallo('parámetro viejo no se borró');
if(!ss._sheets.some(s=>/^RESPUESTAS v1/.test(s.name)))fallo('RESPUESTAS vieja con datos debía archivarse');
if(cfg.clave!=='NIV2026')fallo('CONFIG por defecto');
if(['PADRON','AGREGADOS','FACULTADES'].some(n=>ss.getSheetByName(n)))fallo('pestañas viejas sin borrar');
{const c=k=>(ss.getSheetByName('CARRERAS').d.find(r=>r[0]===k)||[])[2];if(c('MED')!=='Ciencias de la Salud'||c('SIS')!=='Ingeniería y Tecnología'||c('ADM')!=='Ciencias Económicas y Empresariales')fallo('facultad: sigla → nombre '+[c('MED'),c('SIS'),c('ADM')])}
{const vis=ss._sheets.filter(s=>!s._hid).map(s=>s.name).join();console.log('pestañas visibles',vis);if(vis!=='RESPUESTAS,RESUMEN,SIN ASIGNACIÓN,BASEDEDATOS,CONFIG,CARRERAS')fallo('orden de pestañas');
 if(!ss.getSheetByName('PAPELERA')._hid||!ss.getSheetByName('BITACORA')._hid||!ss._sheets.find(s=>/^RESPUESTAS v1/.test(s.name))._hid)fallo('papelera/bitácora/archivo deberían estar ocultas')}
const CAR=ss.getSheetByName('CARRERAS');console.log('CARRERAS últimas',J(CAR.d.slice(-2)));
if(!CAR.d.some(r=>r[0]==='XYZ'&&r[1]==='Carrera Nueva'))fallo('carrera nueva en amarillo');
const SA=ss.getSheetByName('SIN ASIGNACIÓN');console.log('SIN ASIGNACIÓN',J(SA.d));
if(SA.getLastRow()!==2||SA.d[1][4]!=='Guina Veronica Gutierrez Mamani')fallo('pestaña sin asignación');
const get=(a,extra)=>JSON.parse(ctx.doGet({parameter:Object.assign({action:a},extra||{})}).t);
console.log('ping',J(get('ping')));
// ── inicio y lista
if(get('inicio',{clave:'mal'}).motivo!=='clave')fallo('código de acceso');
const ini=get('inicio',{clave:'niv2026'});console.log('inicio',J(ini));
if(!ini.ok||ini.sedes.map(s=>s.cod).join()!=='LPZ,EAT,CBB'||ini.conteo['LPZ|Ciencias de la Salud']!==4)fallo('inicio');
if(get('lista',{clave:'x',sede:'LPZ',fac:'Ciencias de la Salud'}).ok)fallo('lista sin código');
const L=get('lista',{clave:'NIV2026',sede:'LPZ',fac:'Ciencias de la Salud'});console.log('lista LPZ·FCS',J(L.registros));
if(L.registros.length!==4||J(L).includes('60715469')||J(L).includes('@unifranz')||J(L).includes('70000000'))fallo('lista: cantidad o datos sensibles');
const reg=(nom,mat)=>L.registros.find(r=>r[1].startsWith(nom)&&r[6]===mat);
if(reg('Guina','AHU-211 (P)')[12]!=='Rafael Aramayo'||reg('Guina','EME-211 (P)')[12]!=='')fallo('asignado');
if(reg('Ana','AHU-211 (P)')[8]!==2)fallo('semestre de la materia por el código');
// ── guardar
const hoy=new Date(),iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const post=d=>JSON.parse(ctx.doPost({postData:{contents:J({action:'guardar',data:d})}}).t);
const ses={asistio:'Sí',fecha:iso(hoy),hi:'14:00',hf:'15:30',act:'Repaso',obs:''};
const pl={id:'ME-AAAAA-BBBBBB',clave:'NIV2026',hito:2,mentor:{nombre:'rafael aramayo',programa:'Docente Tutor'},movil:true,version:'2.0',items:[
 Object.assign({keys:[reg('Ana','AHU-211 (P)')[0]]},ses),
 Object.assign({keys:[reg('Guina','AHU-211 (P)')[0],reg('Guina','EME-211 (P)')[0]]},ses)]};
const g1=post(pl);console.log('guardar',J(g1));
if(!g1.ok||g1.filas!==3||g1.codigos.length!==2||g1.codigos[1].codigo!=='AAAAA-BBBBBB-02')fallo('guardar');
const R=ss.getSheetByName('RESPUESTAS'),C=ctx.cabResp_(),val=(r,t)=>R.get(r,C.indexOf(t)+1);
for(let r=2;r<=4;r++)console.log('  fila',r,['Código de registro','Mentor','Programa de apoyo','Mentor figura en el SIAR','Sede','Facultad','CI del estudiante','Estudiante','Asignatura','Docente de la materia','Asignado en el SIAR','Asignación','Materias en la sesión','Horas imputadas a esta materia'].map(t=>J(val(r,t))).join(' | '));
if(val(2,'Mentor')!=='Rafael Aramayo'||val(2,'Mentor figura en el SIAR')!=='Sí'||val(2,'Asignación')!=='Asignado a quien registra'||val(2,'CI del estudiante')!=='60715469'||val(2,'Facultad')!=='Ciencias de la Salud')fallo('fila 1');
if(val(4,'Asignación')!=='Sin asignación en el SIAR'||val(4,'Horas imputadas a esta materia')!==0.75||val(3,'Código de registro')!=='ME-AAAAA-BBBBBB-02')fallo('fila 3');
if(post(pl).duplicado!==true||R.getLastRow()!==4)fallo('reintento');
// mentor que no figura en el SIAR (Hermano Mayor) y que registra a un estudiante asignado a otra persona
const g2=post({...pl,id:'ME-CCCCC-DDDDDD',mentor:{nombre:'Juan Nuevo Perez',programa:'Hermano Mayor'},items:[{keys:[reg('Ana','HIS-211 (P)')[0]],asistio:'No'}]});console.log('mentor fuera del SIAR',J(g2));
if(val(5,'Mentor figura en el SIAR')!=='No'||val(5,'Asignación')!=='Asignado a otra persona'||val(5,'Fecha de la sesión')!=='')fallo('mentor fuera del SIAR');
const malos={'código de acceso':{...pl,id:'ME-E1XXX-XXXXXX',clave:'mal'},'hito':{...pl,id:'ME-E2XXX-XXXXXX',hito:9},'clave inexistente':{...pl,id:'ME-E3XXX-XXXXXX',items:[{keys:['nada|Docente Tutor'],asistio:'No'}]},
 'dos estudiantes en un ítem':{...pl,id:'ME-E4XXX-XXXXXX',items:[{keys:[reg('Ana','AHU-211 (P)')[0],reg('Guina','AHU-211 (P)')[0]],asistio:'No'}]},'sin nombre':{...pl,id:'ME-E5XXX-XXXXXX',mentor:{nombre:'Rafael',programa:'Docente Tutor'}},
 'programa':{...pl,id:'ME-E6XXX-XXXXXX',mentor:{nombre:'Rafael Aramayo',programa:'Ayudante'}},'horario':{...pl,id:'ME-E7XXX-XXXXXX',items:[Object.assign({keys:[reg('Ana','AHU-211 (P)')[0]]},ses,{hf:'13:00'})]}};
Object.keys(malos).forEach(k=>{const r=post(malos[k]);console.log('  rechazo ·',k,'→',J(r));if(r.ok)fallo('debió rechazar: '+k)});
if(R.getLastRow()!==5)fallo('un envío inválido escribió filas');
// posible duplicado
const g3=post({...pl,id:'ME-FFFFF-GGGGGG',items:[pl.items[0]]});if(g3.duplicados!==1)fallo('posible duplicado');
// ── anular por código de estudiante, restaurar y anular envío completo
ctx.__answers=['aaaaa-bbbbbb-02','error de carga'];ctx.menuAnular();
console.log('tras anular estudiante 02: resp',R.getLastRow()-1,'papelera',ss.getSheetByName('PAPELERA').getLastRow()-1);
if(R.getLastRow()-1!==3||ss.getSheetByName('PAPELERA').getLastRow()-1!==2)fallo('anular un estudiante');
ctx.__answers=['AAAAA-BBBBBB-02'];ctx.menuRestaurar();if(R.getLastRow()-1!==5)fallo('restaurar');
ctx.__answers=['ME-AAAAA-BBBBBB','envío equivocado'];ctx.menuAnular();if(R.getLastRow()-1!==2)fallo('anular envío');
// ── filtros de CONFIG: facultad
ctx.setConfig_('Facultades habilitadas','FCS');ctx.menuActualizarSiar();
const ini2=get('inicio',{clave:'NIV2026'});if(ini2.conteo['EAT|Ciencias Económicas y Empresariales']||!ini2.conteo['LPZ|Ciencias de la Salud'])fallo('filtro de facultad');
ctx.setConfig_('Facultades habilitadas','');ctx.menuActualizarSiar();
// ── pruebas y tope
const pr=i=>post({id:'PRUEBA-T'+i+'XYZ-TEST1',mentor:{nombre:'Prueba Tecnica',programa:'Docente Tutor'},hito:2,items:[{prueba:true,asistio:'No'}]});
const tope=[];for(let i=0;i<7;i++){const r=pr(i);tope.push(r.ok?'ok':r.codigo)}console.log('pruebas',tope.join(','));
if(!tope.includes('limite_pruebas')||tope[0]!=='ok')fallo('pruebas');
ctx.menuEstado();ctx.menuBorrarPruebas();
ctx.__answers=['I-2027'];ctx.menuNuevoPeriodo();
const rs=ss.getSheetByName('RESUMEN');for(let r=1;r<=rs.getLastRow();r++){const t=[1,2].map(c=>String(rs.get(r,c)).slice(0,150)).join(' || ');if(t.replace(/[ |]/g,''))console.log(r,t)}
if(SEP===';'){const f=String(rs.get(4,2));if(!/;/.test(f))fallo('RESUMEN sin «;»: '+f)}
{const h=ss.getSheetByName('BASEDEDATOS');h.name='Rep. Ficha est.';const r=ctx.leerSiar_(ctx.config_());if(r.error||!r.lista.length)fallo('no encuentra «Rep. Ficha est.»: '+r.error);h.name='BASEDEDATOS'}
{const vieja=ss.getSheetByName('BASEDEDATOS'),datos=vieja.d;vieja.d=[];ss.insertSheet('Rep. Ficha est.').d=datos;ctx.menuActualizarSiar();const sh=ss._sheets.filter(x=>x.name==='BASEDEDATOS'||x.name==='Rep. Ficha est.');if(sh.length!==1||sh[0].name!=='BASEDEDATOS'||!sh[0].d.length)fallo('reimportación: '+ss._sheets.map(x=>x.name));const i3=get('inicio',{clave:'NIV2026'});if(!i3.sedes.length)fallo('tras reimportar no hay sedes');const v=ss._sheets.filter(x=>!x._hid).map(x=>x.name).join();if(v!=='RESPUESTAS,RESUMEN,SIN ASIGNACIÓN,BASEDEDATOS,CONFIG,CARRERAS')fallo('orden tras reimportar '+v)}
const cab=ctx.cabResp_();if(new Set(cab).size!==cab.length)fallo('cabecera con títulos repetidos');
console.log('\nOK · todas las comprobaciones pasaron (SEP='+SEP+')');
