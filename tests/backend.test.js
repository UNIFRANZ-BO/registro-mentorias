// Prueba de humo del backend con una hoja de cálculo simulada (no necesita Google).
// Uso: node tests/backend.test.js        ·  SEP=";" node tests/backend.test.js  → hoja en español
const fs=require('fs'),vm=require('vm');
const SEP=process.env.SEP||',';
const code=fs.readFileSync(require('path').join(__dirname,'..','apps-script','Codigo.gs'),'utf8');
function Sheet(name){this.name=name;this.d=[];this.formulas={};}
Sheet.prototype={
 getName(){return this.name},setName(n){this.name=n;return this},
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
 setActiveSheet(s){this._active=s},getActiveSheet(){return this._active},getActiveRangeList(){return this._active&&this._active._sel?{getRanges:()=>[this._active._sel]}:null}};
const cache={};
const ui={alert:(t,m)=>{console.log('[ALERT]',t,'|',String(m).replace(/\n/g,' / '));return 'YES'},prompt:(t,m)=>({getSelectedButton:()=> 'OK',getResponseText:()=>ctx.__answers.shift()}),ButtonSet:{OK:1,YES_NO:2,OK_CANCEL:3},Button:{YES:'YES',OK:'OK'},createMenu(){const m={addItem(){return m},addSeparator(){return m},addToUi(){}};return m}};
const props={};
const ctx={PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v})},
 SpreadsheetApp:{flush(){},getActive:()=>ss,getActiveSpreadsheet:()=>ss,getUi:()=>ui,newDataValidation:()=>({requireValueInList(){return this},build(){return{}}})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},CacheService:{getScriptCache:()=>({get:k=>cache[k]===undefined?null:cache[k],put:(k,v)=>cache[k]=v,remove:k=>delete cache[k]})},
 Session:{getActiveUser:()=>({getEmail:()=>'rafael@unifranz.edu.bo'})},Utilities:{formatDate:(d)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')},
 ContentService:{createTextOutput:t=>({t,setMimeType(){return this}}),MimeType:{JSON:1,JAVASCRIPT:2}},Logger:{log:console.log},console,__answers:[]};
const fallo=m=>{console.error('FALLA:',m);process.exit(1)};
// ── bases ficticias con las mismas columnas que el Excel real (incluyen CI y celular, que nunca deben salir)
ss.insertSheet('BASEDEDATOSMATERIAS').d=[['Facultad','Carrera','Sem.','Código asignatura','Asignatura','Plan_estudios'],
 ['FCE','NGE',1,'IGC-111 (C)','Introducción a la Gestión Cuantitativa',2026],['FCE','NGE',1,'PIN-111 (P)','Proyecto Integrador I',2026],
 ['FCE','ICO',1,'PIN-111 (P)','Proyecto Integrador I',2026],['FI','SIS',2,'PRG-211 (P)','Programación II',2026],['FI','SIS',3,'BDD-311 (P)','Bases de Datos',2026],
 ['FCS','MED',46367,'ANA-111 (P)','Anatomía',2026],['FCS','MED',1,'ANA-111 (P)','Anatomía',2026],['FCS','MED',2,'FIS-211 (P)','Fisiología',2026]];
ss.insertSheet('BASEDEDATOSEST').d=[['sede','anho_plan_estudio','carrera','primer_nombre','segundo_nombre','primer_apellido','segundo_apellido','ci','correo_institucional','celular'],
 ['CBB',2026,'SIS','RONALD',null,'MENDOZA','VARGAS','6530660','est.ronald.mendoza.va@unifranz.edu.bo','67443917'],
 ['CBB',2026,'NGE','ANA','MARIA','ROJAS','VARGAS','7788990','est.anamaria.rojas.va@unifranz.edu.bo','70000001'],
 ['LPZ',2026,'MED','ROLANDO',null,'QUISPE','CATARI','13755793','est.rolando.quispe.ca@unifranz.edu.bo','71993770'],
 ['CBB',2026,'MED','ROSA',null,'ROJAS','PAZ','5551234','est.rosa.rojas.pa@unifranz.edu.bo','70000002']];
const doc=ss.insertSheet('BASEDEDATOSDOC');
doc.d=[['Docente','CI','Sede','Carrera','Email','Plan_estudios'],
 ['JUAN CARLOS PEREZ LOPEZ',111,'CBB','SIS','doc.juancarlos.perez.lo@unifranz.edu.bo',2026],
 ['ANA ROJAS VARGAS',222,'LPZ','ICO','DOC.ana.rojas.va@unifranz.edu.bo ',2026],
 ['MARIA DIAZ CRUZ',444,'SCZ','ARQ','doc.maria.diaz.cr@unifranz.edu.bo',2017]];
ss.insertSheet('Hoja 2').d=[['', 'Genérico']];   // otras pestañas de la hoja: no se usan
vm.createContext(ctx);vm.runInContext(code,ctx);
const J=o=>JSON.stringify(o);
ctx.configuracionInicial();
const cfg=ctx.config_();
console.log('CONFIG bases',cfg.docentes,cfg.estudiantes,cfg.materias,'hitos',cfg.hitos);
if(cfg.hitos.join()!=='2,3,4')fallo('hitos de CONFIG');
const PAD=ss.getSheetByName('PADRON');
console.log('PADRON',PAD.getLastRow()-1,J(PAD.d[1]),'| fórmulas',PAD.formulas['2,11'],PAD.formulas['2,12']);
if(PAD.getLastRow()-1!==3)fallo('padrón');
if(SEP===';'&&!/;/.test(PAD.formulas['2,11']))fallo('fórmula del padrón sin «;»');
const get=(a,extra)=>JSON.parse(ctx.doGet({parameter:Object.assign({action:a},extra||{})}).t);
const M='doc.juancarlos.perez.lo@unifranz.edu.bo';
const v1=get('validar',{correo:M});
console.log('validar',J({...v1,materias:v1.materias.length+' materias',carreras:v1.carreras.length+' carreras'}));
if(!v1.habilitado||v1.mentor.nombre!=='Juan'||v1.mentor.programa!=='Docente Tutor'||J(v1).includes('6530660')||J(v1).includes('111,'))fallo('validar');
if(v1.materias.length!==7)fallo('catálogo de materias: '+v1.materias.length);
if(v1.materias.find(m=>m[0]==='ANA-111 (P)')[3]!=='')fallo('semestre 46367 debe quedar vacío');
console.log('validar mayúsc/espacios',get('validar',{correo:'doc.ana.rojas.va@unifranz.edu.bo'}).habilitado);
console.log('validar desconocido',J(get('validar',{correo:'x.y@unifranz.edu.bo'})));
// ── búsqueda de estudiantes
const b0=get('buscar',{correo:M,q:'quispe'});console.log('buscar «quispe» de LPZ desde CBB (todas las sedes, por defecto)',J(b0.resultados.map(x=>x.nombre+' '+x.sede)));
if(b0.resultados.length!==1)fallo('búsqueda en todas las sedes');
ctx.setConfig_('Buscar estudiantes de todas las sedes','NO');
if(get('buscar',{correo:M,q:'quispe'}).resultados.length!==0)fallo('filtro de sede con NO');
const b1=get('buscar',{correo:M,q:'rojas'});console.log('buscar «rojas» (solo su sede CBB)',J(b1));
ctx.setConfig_('Buscar estudiantes de todas las sedes','SÍ');
if(b1.resultados.length!==2||J(b1).includes('7788990')||J(b1).includes('70000001'))fallo('buscar por nombre / filtro de sede / CI expuesto');
const b2=get('buscar',{correo:M,q:'13755793'});console.log('buscar por CI (otra sede)',J(b2));
if(b2.resultados.length!==1||b2.resultados[0].ci!=='•••793')fallo('buscar por CI');
console.log('buscar corto',J(get('buscar',{correo:M,q:'ro'})),'| sin mentor',J(get('buscar',{correo:'x@unifranz.edu.bo',q:'rojas'})));
// ── guardar un envío: 3 estudiantes (uno no asistió, uno registrado a mano)
const hoy=new Date(),iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const pl={id:'ME-AAAAA-BBBBBB',correo:M,hito:3,movil:true,version:'1.0',fecha_local:'x',items:[
 {est:'est.ronald.mendoza.va@unifranz.edu.bo',materias:[{cod:'PRG-211 (P)',car:'SIS'},{cod:'BDD-311 (P)',car:'SIS'},{cod:'PRG-211 (P)',car:'SIS'}],asistio:'Sí',fecha:iso(hoy),hi:'14:00',hf:'15:30',act:'=Repaso de contenidos',obs:''},
 {est:'est.anamaria.rojas.va@unifranz.edu.bo',materias:[{cod:'IGC-111 (C)',car:'NGE'}],asistio:'No'},
 {manual:{ci:'9876543 LP',nombre:'pedro gomez',carrera_cod:'ICO',sede:'CBB'},materias:[{cod:'PIN-111 (P)',car:'ICO'}],asistio:'Sí',fecha:iso(hoy),hi:'9:00',hf:'10:00',act:'Resolución de ejercicios',obs:'Llegó tarde'}]};
const post=d=>JSON.parse(ctx.doPost({postData:{contents:J({action:'guardar',data:d})}}).t);
const g1=post(pl);console.log('guardar',J(g1));
if(!g1.ok||g1.filas!==4||g1.estudiantes!==3)fallo('guardar');
console.log('guardar mismo id (reintento)',J(post(pl)));
const R=ss.getSheetByName('RESPUESTAS'),C=ctx.cabResp_();
if(R.getLastRow()!==5)fallo('el reintento duplicó filas');
const val=(r,t)=>R.get(r,C.indexOf(t)+1);
for(let r=2;r<=5;r++)console.log('  fila',r,['Hito','CI del estudiante','Estudiante','Estudiante en la base','Cód. asignatura','Asignatura','Semestre de la asignatura','Asistió','Hora de inicio','Duración de la sesión (min)','Materias en la sesión','Horas imputadas a esta materia','Actividad(es) realizada(s)','Observaciones y comentarios','Posible duplicado'].map(t=>J(val(r,t))).join(' | '));
if(val(2,'Duración de la sesión (min)')!==90||val(2,'Materias en la sesión')!==2||val(2,'Horas imputadas a esta materia')!==0.75)fallo('duración/horas');
if(val(2,'Actividad(es) realizada(s)')!=="'=Repaso de contenidos")fallo('apóstrofo en texto con =');
if(val(4,'Fecha de la sesión')!==''||val(4,'Asistió')!=='No')fallo('no asistió debe quedar sin sesión');
if(val(5,'Estudiante en la base')!=='No'||val(5,'Estudiante')!=='Pedro Gomez'||val(5,'Hora de inicio')!=='09:00')fallo('estudiante manual');
if(val(2,'CI del estudiante')!=='6530660'||val(2,'Carrera del estudiante')!=='Ingeniería de Sistemas')fallo('datos del estudiante desde la base');
// mismo estudiante, materia, hito y fecha en otro envío → se guarda marcado como posible duplicado
const g2=post({...pl,id:'ME-CCCCC-DDDDDD',items:[pl.items[0]]});console.log('posible duplicado',J(g2));
if(g2.duplicados!==2||val(6,'Posible duplicado')!=='Sí')fallo('posible duplicado');
// errores de validación
const malos={
 'hito no habilitado':{...pl,id:'ME-E1-XXXXXX',hito:1},
 'estudiante inventado':{...pl,id:'ME-E2-XXXXXX',items:[{...pl.items[0],est:'est.no.existe@unifranz.edu.bo'}]},
 'materia inventada':{...pl,id:'ME-E3-XXXXXX',items:[{...pl.items[0],materias:[{cod:'XXX-999',car:'SIS'}]}]},
 'hora fin antes de inicio':{...pl,id:'ME-E4-XXXXXX',items:[{...pl.items[0],hi:'16:00',hf:'15:00'}]},
 'fecha futura':{...pl,id:'ME-E5-XXXXXX',items:[{...pl.items[0],fecha:'2099-01-01'}]},
 'sin actividades':{...pl,id:'ME-E6-XXXXXX',items:[{...pl.items[0],act:'  '}]},
 'estudiante repetido':{...pl,id:'ME-E7-XXXXXX',items:[pl.items[0],pl.items[0]]},
 'mentor desconocido':{...pl,id:'ME-E8-XXXXXX',correo:'x@unifranz.edu.bo'}};
Object.keys(malos).forEach(k=>{const r=post(malos[k]);console.log('  rechazo ·',k,'→',J(r));if(r.ok)fallo('debió rechazar: '+k)});
if(R.getLastRow()!==7)fallo('un envío inválido escribió filas');
// lo que ve el mentor al volver a entrar
console.log('previos',J(get('validar',{correo:M}).previos));
// cerrar
ctx.menuCerrar();console.log('cerrado',J(get('validar',{correo:M})),J(post({...pl,id:'ME-F1-XXXXXX'})));ctx.menuAbrir();
// anular un envío por código (sin el prefijo ME-, como lo ve el mentor) y restaurarlo
ctx.__answers=['aaaaa-bbbbbb','Se equivocó de hito'];ctx.menuAnular();
console.log('tras anular: resp',R.getLastRow()-1,'papelera',ss.getSheetByName('PAPELERA').getLastRow()-1);
if(R.getLastRow()-1!==2)fallo('anular envío');
ctx.__answers=['ME-AAAAA-BBBBBB'];ctx.menuRestaurar();console.log('tras restaurar: resp',R.getLastRow()-1);
if(R.getLastRow()-1!==6)fallo('restaurar');
// anular filas seleccionadas
ss.setActiveSheet(R);R._sel=new Range(R,2,3,2,1);ctx.__answers=['fila mal cargada'];ctx.menuAnularSeleccion();
console.log('tras anular selección: resp',R.getLastRow()-1);if(R.getLastRow()-1!==4)fallo('anular selección');
// excluir / reincorporar / agregados (Hermano Mayor)
ctx.__answers=['doc.ana.rojas.va@unifranz.edu.bo','Ya no es tutora'];ctx.menuExcluir();console.log('validar excluida',J(get('validar',{correo:'doc.ana.rojas.va@unifranz.edu.bo'})));
ctx.__answers=['doc.ana.rojas.va@unifranz.edu.bo'];ctx.menuReincorporar();
ss.getSheetByName('AGREGADOS').appendRow(['est.luis.hm.xx@unifranz.edu.bo','LUIS HERMANO MAYOR','CBB','SIS',2026,'','apoyo']);
const vh=get('validar',{correo:'est.luis.hm.xx@unifranz.edu.bo'});console.log('agregado hermano mayor',J(vh.mentor));
if(vh.mentor.programa!=='Hermano Mayor')fallo('programa Hermano Mayor');
// base nueva de estudiantes: se agrega en CONFIG sin tocar código
ss.insertSheet('EST2017').d=[['sede','anho_plan_estudio','carrera','primer_nombre','primer_apellido','ci','correo_institucional'],['CBB',2017,'ADM','CARLA','SOLIZ','4445556','est.carla.soliz.xx@unifranz.edu.bo']];
ctx.setConfig_('Pestañas de estudiantes','BASEDEDATOSEST; EST2017');
const b3=get('buscar',{correo:M,q:'carla'});console.log('buscar en base nueva',J(b3.resultados));
if(b3.resultados.length!==1)fallo('base nueva de estudiantes');
ctx.menuActualizarPadron();console.log('CARRERAS amarillas',J(ss.getSheetByName('CARRERAS').d.slice(-2)));
ctx.menuRevisarBases();
// prueba + tope
const pr=i=>post({id:'PRUEBA-T'+i+'XYZ',correo:'prueba@unifranz.edu.bo',hito:2,items:[{manual:{ci:'12345',nombre:'Estudiante Prueba',carrera_cod:'SIS'},materias:[{cod:'PRG-211 (P)',car:'SIS'}],asistio:'No'}]});
const tope=[];for(let i=0;i<7;i++){const r=pr(i);tope.push(r.ok?'ok':r.codigo)}console.log('pruebas',tope.join(','));
if(!tope.includes('limite_pruebas'))fallo('tope de pruebas');
ctx.menuEstado();
ctx.menuBorrarPruebas();
// nuevo periodo
ctx.__answers=['I-2027'];ctx.menuNuevoPeriodo();console.log('pestañas',ss._sheets.map(s=>s.name).join(','),'| resp',R.getLastRow()-1,'| periodo',ctx.config_().periodo);
const rs=ss.getSheetByName('RESUMEN');for(let r=1;r<=rs.getLastRow();r++){const t=[1,2,8].map(c=>String(rs.get(r,c)).slice(0,130)).join(' || ');if(t.replace(/[ |]/g,''))console.log(r,t)}
if(SEP===';'){const f=String(rs.get(4,2));if(!/;/.test(f)||/,"<>/.test(f))fallo('RESUMEN sin «;»: '+f)}
const cab=ctx.cabResp_();if(new Set(cab).size!==cab.length)fallo('cabecera con títulos repetidos');
console.log('\nOK · todas las comprobaciones pasaron (SEP='+SEP+')');
