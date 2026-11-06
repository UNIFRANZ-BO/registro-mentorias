/** @OnlyCurrentDoc */  // el script solo puede tocar esta hoja, ningún otro archivo de Drive
/**
 * BITÁCORA DE NIVELACIONES · UNIFRANZ  (v2.4)
 * Registro de sesiones de Docentes Tutores y Hermanos Mayores. Reemplaza el Google Form
 * «Registro de Sesiones Realizadas de Mentorías». UNA SOLA BASE: el reporte del SIAR
 * («Rep. Ficha est.»), importado como una pestaña más. De ahí salen los estudiantes, sus materias
 * y quién tiene asignado cada uno (columna «Detalle»).
 *
 * Flujo de la app: Sede + Facultad → «¿Quién eres?» (nombres asignados en el SIAR) → sus
 * estudiantes por materia (o «Buscar por materia») → asistencia y sesión (grupal) → enviar.
 * En RESPUESTAS queda UNA FILA POR ESTUDIANTE Y MATERIA, con un CÓDIGO DE REGISTRO por estudiante.
 *
 * ── PRIMERA VEZ ─────────────────────────────────────────────────────────────
 *   1. Archivo → Importar → sube el Excel del SIAR → «Insertar hojas nuevas» (la pestaña se reconoce
 *      por sus columnas: el nombre no importa).
 *   2. Extensiones → Apps Script → pega este código → Guardar → ejecuta configuracionInicial().
 *   3. Revisa CONFIG (código de acceso, hitos) y CARRERAS (facultad de cada carrera).
 *
 * ── PESTAÑAS ────────────────────────────────────────────────────────────────
 *   Visibles: RESPUESTAS · RESUMEN · SIN ASIGNACIÓN · (el SIAR) · CONFIG · CARRERAS.
 *   Ocultas (menú «Ver u ocultar papelera y bitácora»): PAPELERA, BITACORA y archivos de periodos.
 *
 * ── CADA VEZ QUE SALGA UN REPORTE NUEVO DEL SIAR ─────────────────────────────
 *   Archivo → Importar → Subir → «Insertar nuevas hojas» → menú Mentorías → Actualizar SIAR.
 *   (Se queda con el reporte recién importado, borra el anterior y lo llama BASEDEDATOS.)
 *   Nunca «Reemplazar hoja de cálculo»: reemplaza el archivo entero.
 *   4. Implementar → Nueva implementación → Aplicación web · Ejecutar como: Yo · Acceso: Cualquier persona.
 *
 * ── PARA ACTUALIZAR ESTE CÓDIGO DESPUÉS ─────────────────────────────────────
 *   Implementar → Administrar implementaciones → ✏️ → Versión: «Nueva versión» → Implementar.
 *   (Nunca «Nueva implementación»: cambia la URL.)
 */

const VERSION_APP = '2.4';
const ZONA = 'America/La_Paz';
const H = {             // nombres de pestañas
  CONFIG: 'CONFIG', CARRERAS: 'CARRERAS', SIN_ASIG: 'SIN ASIGNACIÓN',
  RESP: 'RESPUESTAS', PAPELERA: 'PAPELERA', RESUMEN: 'RESUMEN', BITACORA: 'BITACORA'
};
const SEDES = { LPZ: 'La Paz', EAT: 'El Alto', CBB: 'Cochabamba', SCZ: 'Santa Cruz' };
const PROGRAMAS = ['Docente Tutor', 'Hermano Mayor'];
// Facultades y carreras (incluye códigos del plan 2017 que aún aparecen en el SIAR). Se editan en la hoja.
// La facultad se escribe con su nombre en la columna «Facultad» de CARRERAS (lista desplegable).
const FACULTADES_SUGERIDAS = {
  FCEE: 'Ciencias Económicas y Empresariales', FCS: 'Ciencias de la Salud', FCJS: 'Ciencias Jurídicas y Sociales',
  FI: 'Ingeniería', FDTC: 'Diseño y Tecnología Crossmedia'
};
// Pestañas de versiones anteriores que ya no se usan: «Configuración inicial» las borra.
const NOMBRE_SIAR = 'BASEDEDATOS';   // nombre que recibe la pestaña del SIAR al actualizar
const OBSOLETAS = ['PADRON', 'EXCLUIDOS', 'AGREGADOS', 'BASEDEDATOSDOC', 'BASEDEDATOSEST', 'BASEDEDATOSMATERIAS', 'FACULTADES'];
const CARRERAS_SUGERIDAS = [
  ['AFC', 'Auditoría Financiera y Control de Gestión', 'FCEE'], ['ICO', 'Ingeniería Comercial', 'FCEE'], ['IEF', 'Ingeniería Económica y Financiera', 'FCEE'],
  ['NGE', 'Negocios y Gestión Empresarial', 'FCEE'], ['THO', 'Turismo y Hotelería', 'FCEE'], ['GAC', 'Gastronomía y Artes Culinarias', 'FCEE'],
  ['ADM', 'Administración de Empresas', 'FCEE'], ['CPU', 'Contaduría Pública', 'FCEE'], ['AHT', 'Administración de Hotelería y Turismo', 'FCEE'], ['IEC', 'Ingeniería Económica', 'FCEE'],
  ['BYF', 'Bioquímica y Farmacia', 'FCS'], ['ENF', 'Enfermería', 'FCS'], ['MED', 'Medicina', 'FCS'], ['ODO', 'Odontología', 'FCS'],
  ['CPD', 'Comunicación y Periodismo Digital', 'FCJS'], ['DER', 'Derecho', 'FCJS'], ['PSI', 'Psicología', 'FCJS'], ['PER', 'Periodismo', 'FCJS'],
  ['SIS', 'Ingeniería de Sistemas', 'FI'],
  ['ARQ', 'Arquitectura', 'FDTC'], ['DDP', 'Diseño Digital y Producción Transmedia', 'FDTC'], ['PYM', 'Publicidad y Marketing', 'FDTC'], ['DGP', 'Diseño Gráfico y Producción Crossmedia', 'FDTC']
];
// Columnas del reporte del SIAR (se buscan por título, en cualquier orden).
const COLS_SIAR = {
  ficha: ['ficha_id'], detalle: ['detalle_id'], hito: ['hito'], sede: ['sede'], ci: ['c.i.', 'ci', 'carnet'],
  nombre: ['nombre_estudiante', 'estudiante'], correo: ['correo', 'correo_institucional', 'email'], carrera: ['carrera'],
  carcod: ['cod._carrera', 'cod_carrera', 'codigo_carrera'], semestre: ['semestre'], docente: ['docente'], paralelo: ['paralelo'],
  materia: ['materia', 'asignatura'], matcod: ['codigo_materia', 'cod._materia', 'codigo_asignatura'],
  tratamiento: ['tratamiento'], asignado: ['detalle'], resultado: ['resultado'], estado: ['estado_final']
};
const REQ_SIAR = ['ci', 'nombre', 'carcod', 'materia', 'matcod', 'tratamiento', 'asignado'];
const MAX_PRUEBAS = 5;        // envíos PRUEBA- permitidos a la vez en RESPUESTAS
const MAX_EST = 80;           // estudiantes por envío

/* ═════════════════════════════ MENÚ ═════════════════════════════ */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Mentorías')
    .addItem('▶ Abrir registro', 'menuAbrir')
    .addItem('■ Cerrar registro', 'menuCerrar')
    .addSeparator()
    .addItem('↻ Actualizar SIAR (después de pegar un reporte nuevo)', 'menuActualizarSiar')
    .addItem('ⓘ Ver estado del registro', 'menuEstado')
    .addSeparator()
    .addItem('Anular por código (un estudiante o un envío completo)…', 'menuAnular')
    .addItem('Anular las filas seleccionadas en RESPUESTAS', 'menuAnularSeleccion')
    .addItem('Restaurar por código…', 'menuRestaurar')
    .addSeparator()
    .addItem('Iniciar un nuevo periodo…', 'menuNuevoPeriodo')
    .addItem('Reconstruir RESUMEN', 'menuResumen')
    .addItem('Borrar filas de prueba', 'menuBorrarPruebas')
    .addItem('Ver u ocultar papelera y bitácora', 'menuPestanasApoyo')
    .addSeparator()
    .addItem('Configuración inicial / reparar pestañas', 'configuracionInicial')
    .addToUi();
}

/* ═════════════════════ CONFIGURACIÓN INICIAL ═════════════════════ */
function configuracionInicial() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(ZONA);
  crearConfig_(true); crearCarreras_();
  const migr = prepararHoja_(H.RESP, cabResp_()) + prepararHoja_(H.PAPELERA, ['Fecha de anulación', 'Anulado por', 'Motivo'].concat(cabResp_()));
  hojaResp_(); hojaPapelera_(); hojaSimple_(H.BITACORA, ['Fecha', 'Usuario', 'Acción', 'Detalle']);
  const cons = consolidarSiar_();
  const r = actualizarSiar_();
  r.texto = cons + r.texto;
  crearResumen_();
  const borradas = OBSOLETAS.filter(n => ss.getSheetByName(n));
  borradas.forEach(n => ss.deleteSheet(ss.getSheetByName(n)));
  ordenarPestanas_();
  onOpen();
  bitacora_('Configuración inicial', r.texto + (borradas.length ? ' · Pestañas borradas: ' + borradas.join(', ') : ''));
  aviso_('Configuración lista', r.texto + migr +
    (borradas.length ? '\n\nSe borraron las pestañas de la versión anterior, que ya no se usan: ' + borradas.join(', ') + '.' : '') +
    '\n\nRevisa CONFIG (código de acceso, hitos) y la columna «Facultad» de CARRERAS.');
}
const esApoyo_ = n => n === H.PAPELERA || n === H.BITACORA || /^(RESPUESTAS|PAPELERA) /.test(n);
// Orden: RESPUESTAS · RESUMEN · SIN ASIGNACIÓN · SIAR · CONFIG · CARRERAS. PAPELERA, BITACORA y archivos quedan ocultos.
function ordenarPestanas_() {
  const ss = SpreadsheetApp.getActive(), siar = hojaSiar_(), orden = [H.RESP, H.RESUMEN, H.SIN_ASIG, siar ? siar.getName() : '', H.CONFIG, H.CARRERAS];
  let pos = 1;
  orden.forEach(n => { const sh = n && ss.getSheetByName(n); if (sh) { if (sh.isSheetHidden()) sh.showSheet(); ss.setActiveSheet(sh); ss.moveActiveSheet(pos++); } });
  ss.getSheets().forEach(sh => { if (esApoyo_(sh.getName()) && !sh.isSheetHidden()) sh.hideSheet(); });
  const resp = ss.getSheetByName(H.RESP); if (resp) ss.setActiveSheet(resp);
}
function menuPestanasApoyo() {
  const ss = SpreadsheetApp.getActive(), hs = ss.getSheets().filter(sh => esApoyo_(sh.getName()));
  if (!hs.length) return aviso_('Papelera y bitácora', 'No hay pestañas de apoyo.');
  const mostrar = hs.some(sh => sh.isSheetHidden());
  hs.forEach(sh => { if (mostrar) sh.showSheet(); else sh.hideSheet(); });
  if (mostrar) ss.setActiveSheet(hs[0]);
  aviso_('Papelera y bitácora', (mostrar ? 'Ahora se ven: ' : 'Quedaron ocultas: ') + hs.map(sh => sh.getName()).join(', ') +
    '.\nUsa el mismo menú para ' + (mostrar ? 'ocultarlas.' : 'volver a verlas.'));
}
// Si una pestaña existe con otra cabecera (versión anterior): vacía → se reescribe; con datos → se archiva.
function prepararHoja_(nombre, cab) {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(nombre);
  if (!sh || sh.getLastRow() === 0) return '';
  const act = sh.getRange(1, 1, 1, Math.max(cab.length, sh.getLastColumn())).getValues()[0].map(v => String(v).trim());
  if (cab.every((c, i) => act[i] === c)) return '';
  if (sh.getLastRow() < 2) { sh.clear(); return ''; }
  const nuevo = nombre + ' v1 (' + Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd') + ')';
  sh.setName(nuevo);
  return '\n\n«' + nombre + '» tenía datos con el formato anterior: quedó archivada como «' + nuevo + '».';
}

const PARAMS_CONFIG = () => [
  ['Registro activo', 'SÍ', 'SÍ = se pueden registrar sesiones. NO = cerrado.'],
  ['Fecha de apertura', '', 'Opcional. Antes de esta fecha el registro aparece cerrado.'],
  ['Fecha de cierre', '', 'Opcional. Después de esta fecha (incluido el día completo) aparece cerrado.'],
  ['Periodo', 'II-2026', 'Nombre del periodo. Se usa al archivar respuestas en «Nuevo periodo».'],
  ['Hitos habilitados', '2; 3; 4', 'Hitos que se pueden elegir, separados por punto y coma. Con uno solo, la app no pregunta.'],
  ['Tratamientos que se registran', 'Docente Tutor; Apoyo Hermano mayor', 'Valores de la columna «Tratamiento» del SIAR que entran a la app, separados por punto y coma.'],
  ['Sedes habilitadas', '', 'Códigos: LPZ; EAT; CBB; SCZ · vacío = todas'],
  ['Facultades habilitadas', '', 'Nombres como en CARRERAS (ej.: Ciencias de la Salud; Ingeniería) · vacío = todas'],
  ['Código de acceso', 'NIV2026', 'Código que piden la app y que reparten los directores (protege los datos de los estudiantes). Vacío = sin código.'],
  ['Mensaje de registro cerrado', 'El registro de sesiones no está disponible en este momento.', 'Texto que se ve cuando está cerrado.']
];
function crearConfig_(limpiar) {
  const ss = SpreadsheetApp.getActive(), filas = PARAMS_CONFIG(), claves = filas.map(f => f[0]);
  let sh = ss.getSheetByName(H.CONFIG);
  if (!sh) {
    sh = ss.insertSheet(H.CONFIG, 0);
    sh.getRange(1, 1, 1, 3).setValues([['Parámetro', 'Valor', 'Ayuda']]);
    sh.getRange(2, 2, filas.length, 1).setNumberFormat('@');
    sh.getRange(2, 1, filas.length, 3).setValues(filas);
  } else {
    if (limpiar && sh.getLastRow() > 1) {     // quita parámetros de la versión anterior que ya no se usan
      const v = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
      for (let i = v.length - 1; i >= 0; i--) if (String(v[i][0]).trim() && claves.indexOf(String(v[i][0]).trim()) < 0) sh.deleteRow(i + 2);
    }
    const exist = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues().map(r => String(r[0]).trim());
    filas.filter(f => exist.indexOf(f[0]) < 0).forEach(f => sh.appendRow(f));
  }
  sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
  sh.setColumnWidth(1, 250); sh.setColumnWidth(2, 260); sh.setColumnWidth(3, 560); sh.setFrozenRows(1);
  const f = buscarFila_(sh, 'Registro activo');
  if (f) sh.getRange(f, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['SÍ', 'NO'], true).build());
  ['Fecha de apertura', 'Fecha de cierre'].forEach(k => { const r = buscarFila_(sh, k); if (r) sh.getRange(r, 2).setNumberFormat('dd/MM/yyyy'); });
  sh.getRange(2, 2, sh.getLastRow() - 1, 1).setBackground('#fff8e1');
}
// CARRERAS: Código | Nombre | Facultad (nombre). Completa la facultad de los códigos conocidos sin pisar lo escrito.
// Migra la v2.0: siglas de facultad (FCS…) → nombres (los de la pestaña FACULTADES si existía).
function crearCarreras_() {
  const ss = SpreadsheetApp.getActive(), fac = Object.assign({}, FACULTADES_SUGERIDAS), shF = ss.getSheetByName('FACULTADES');
  if (shF && shF.getLastRow() > 1) shF.getRange(2, 1, shF.getLastRow() - 1, 2).getValues().forEach(r => { const k = String(r[0]).trim().toUpperCase(); if (k && String(r[1]).trim()) fac[k] = String(r[1]).trim(); });
  const sug = CARRERAS_SUGERIDAS.map(c => [c[0], c[1], fac[c[2]] || c[2]]);
  let sh = ss.getSheetByName(H.CARRERAS);
  if (!sh) { sh = ss.insertSheet(H.CARRERAS); sh.getRange(1, 1, 1, 3).setValues([['Código', 'Nombre que se ve en la app', 'Facultad']]); sh.getRange(2, 1, sug.length, 3).setValues(sug); }
  else {
    sh.getRange(1, 3).setValue('Facultad');
    const n = Math.max(0, sh.getLastRow() - 1), v = n ? sh.getRange(2, 1, n, 3).getValues() : [], vistos = {};
    v.forEach((r, i) => {
      const k = String(r[0]).trim().toUpperCase(), f = String(r[2]).trim(); vistos[k] = true;
      const c = sug.find(x => x[0] === k);
      if (!f && c) sh.getRange(i + 2, 3).setValue(c[2]);
      else if (fac[f.toUpperCase()]) sh.getRange(i + 2, 3).setValue(fac[f.toUpperCase()]);   // sigla → nombre
    });
    sug.filter(c => !vistos[c[0]]).forEach(c => sh.appendRow(c));
  }
  const nombres = {}; Object.keys(fac).forEach(k => { nombres[fac[k]] = true; });
  if (sh.getLastRow() > 1) sh.getRange(2, 3, sh.getLastRow() - 1, 1).getValues().forEach(r => { if (String(r[0]).trim()) nombres[String(r[0]).trim()] = true; });
  sh.getRange(2, 3, Math.max(1, sh.getMaxRows() - 1), 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(nombres).sort(), true).setAllowInvalid(true).build());
  sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
  sh.setColumnWidth(1, 90); sh.setColumnWidth(2, 340); sh.setColumnWidth(3, 300); sh.setFrozenRows(1);
}
function hojaSimple_(nombre, cab) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, cab.length).setValues([cab]);
  sh.getRange(1, 1, 1, cab.length).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  return sh;
}

/* ═════════════════════════ LECTURA DE CONFIG ═════════════════════════ */
function config_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.CONFIG), c = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => { c[String(r[0]).trim()] = r[1]; });
  const lista = v => String(v || '').split(/[,;\n]/).map(x => norm_(x)).filter(String);
  return {
    activa: /^s/i.test(String(c['Registro activo'] || 'SÍ').trim()),
    apertura: c['Fecha de apertura'] instanceof Date ? c['Fecha de apertura'] : null,
    cierre: c['Fecha de cierre'] instanceof Date ? c['Fecha de cierre'] : null,
    periodo: String(c['Periodo'] || '').trim(),
    hitos: String(c['Hitos habilitados'] === undefined ? '2;3;4' : c['Hitos habilitados']).split(/[;\n]/).map(x => x.trim()).filter(String),
    tratamientos: String(c['Tratamientos que se registran'] === undefined ? 'Docente Tutor;Apoyo Hermano mayor' : c['Tratamientos que se registran']).split(/[;\n]/).map(x => norm_(x)).filter(String),
    sedes: lista(c['Sedes habilitadas']).map(x => x.toUpperCase()),
    facultades: lista(c['Facultades habilitadas']).map(x => norm_(FACULTADES_SUGERIDAS[x.toUpperCase()] || x)),
    clave: String(c['Código de acceso'] === undefined ? '' : c['Código de acceso']).trim(),
    mensaje: String(c['Mensaje de registro cerrado'] || 'El registro de sesiones no está disponible en este momento.')
  };
}
function setConfig_(clave, valor) { const sh = SpreadsheetApp.getActive().getSheetByName(H.CONFIG), f = buscarFila_(sh, clave); if (f) sh.getRange(f, 2).setValue(valor); }
function abierta_(cfg) {
  if (!cfg.activa) return false;
  const hoy = new Date();
  if (cfg.apertura && hoy < cfg.apertura) return false;
  if (cfg.cierre) { const fin = new Date(cfg.cierre); fin.setHours(23, 59, 59, 999); if (hoy > fin) return false; }
  return true;
}
const claveOk_ = (cfg, clave) => !cfg.clave || norm_(clave) === norm_(cfg.clave);
function tabla_(nombre, ncol) {
  const sh = SpreadsheetApp.getActive().getSheetByName(nombre), m = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, ncol).getValues().forEach(r => { const k = String(r[0]).trim().toUpperCase(); if (k) m[k] = r.slice(1).map(x => String(x || '').trim()); });
  return m;
}
const carreras_ = () => tabla_(H.CARRERAS, 3);          // cod → [nombre, facultad]
// Nombres de facultad que aparecen en CARRERAS, en orden alfabético.
const facultades_ = () => { const m = {}; Object.values(carreras_()).forEach(v => { if (v[1]) m[v[1]] = true; }); return Object.keys(m).sort((a, b) => a.localeCompare(b, 'es')); };

/* ═════════════════════════ SIAR ═════════════════════════ */
const titulo_ = s => String(s || '').toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase()).replace(/\s+/g, ' ').trim();
const cab_ = fila => fila.map(h => norm_(h).replace(/\s+/g, '_'));
const nombreKey_ = s => norm_(s).replace(/\s+/g, ' ');
const ciNorm_ = s => String(s || '').toLowerCase().replace(/[^0-9a-z]/g, '');
const ciMask_ = s => { const d = String(s || '').replace(/\D/g, ''); return d ? '•••' + d.slice(-3) : ''; };
function sedeCod_(v) { const s = norm_(v); for (const k in SEDES) if (s === norm_(k) || s === norm_(SEDES[k])) return k; return String(v || '').trim().toUpperCase(); }
function programa_(trat) { const t = norm_(trat); return t.indexOf('hermano') >= 0 ? PROGRAMAS[1] : t.indexOf('tutor') >= 0 ? PROGRAMAS[0] : titulo_(trat); }
const semMateria_ = cod => { const m = /-\s*(\d)/.exec(String(cod || '')); return m ? +m[1] : ''; };

// Pestaña(s) con el reporte del SIAR: se reconocen por sus columnas (tratamiento, detalle y c.i.), no por el nombre.
function hojasSiar_() {
  const propias = Object.values(H);
  return SpreadsheetApp.getActive().getSheets().filter(sh => {
    const n = sh.getName();
    if (propias.indexOf(n) >= 0 || esApoyo_(n) || sh.getLastColumn() < 3 || sh.getLastRow() < 1) return false;
    const c = cab_(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]);
    return ['tratamiento', 'asignado', 'ci'].every(k => COLS_SIAR[k].some(x => c.indexOf(x) >= 0));
  });
}
// Deja un solo reporte del SIAR: el último importado (el de más a la derecha) queda como BASEDEDATOS y se borran los anteriores.
// Una pestaña BASEDEDATOS vacía (p. ej. tras un intento de importación fallido) también se borra.
function consolidarSiar_() {
  const ss = SpreadsheetApp.getActive(), l = hojasSiar_();
  if (!l.length) return '';
  const nueva = l[l.length - 1], borradas = [];
  l.slice(0, -1).forEach(sh => { borradas.push(sh.getName()); ss.deleteSheet(sh); });
  if (nueva.getName() !== NOMBRE_SIAR) {
    const otra = ss.getSheetByName(NOMBRE_SIAR);
    if (otra && otra.getLastRow() === 0) { borradas.push(NOMBRE_SIAR + ' (vacía)'); ss.deleteSheet(otra); }
    if (!ss.getSheetByName(NOMBRE_SIAR)) nueva.setName(NOMBRE_SIAR);
  }
  return borradas.length ? 'Reporte del SIAR nuevo en «' + nueva.getName() + '». Se borró el anterior: ' + borradas.join(', ') + '.\n' : '';
}
// Si hay más de una, se usa la última (la de más a la derecha); «Actualizar SIAR» las deja en una sola.
function hojaSiar_() { const l = hojasSiar_(); return l.length ? l[l.length - 1] : null; }
// Lee el SIAR (solo las columnas que usa) y devuelve los registros que entran a la app.
// Registro: [clave, nombre, ci, correo, sede, carrera, carreraNombre, facultad, semestreEst, codMateria, materia, semMateria,
//            paralelo, docenteMateria, programa, asignado, hito, ficha, detalle]
function leerSiar_(cfg) {
  const sh = hojaSiar_();
  if (!sh) return { lista: [], error: 'No encuentro el reporte del SIAR. Impórtalo: Archivo → Importar → Subir → «Insertar nuevas hojas» y usa Mentorías → Actualizar SIAR.' };
  const n = sh.getLastRow() - 1;
  if (n < 1) return { lista: [], error: 'La pestaña «' + sh.getName() + '» está vacía.' };
  const cab = cab_(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]), idx = {};
  Object.keys(COLS_SIAR).forEach(k => { idx[k] = cab.findIndex(h => COLS_SIAR[k].indexOf(h) >= 0); });
  const faltan = REQ_SIAR.filter(k => idx[k] < 0);
  if (faltan.length) return { lista: [], error: 'En «' + sh.getName() + '» no encuentro la columna: ' + faltan.join(', ') };
  const col = {};
  Object.keys(idx).forEach(k => { col[k] = idx[k] >= 0 ? sh.getRange(2, idx[k] + 1, n, 1).getValues().map(r => r[0]) : null; });
  const v = (k, i) => col[k] ? String(col[k][i] === null || col[k][i] === undefined ? '' : col[k][i]).trim() : '';
  const cars = carreras_(), lista = [], vistos = {}, trats = cfg.tratamientos;
  for (let i = 0; i < n; i++) {
    const trat = v('tratamiento', i);
    if (trats.length && trats.indexOf(norm_(trat)) < 0) continue;
    const sede = sedeCod_(v('sede', i)), car = v('carcod', i).toUpperCase(), fac = (cars[car] || [])[1] || '';
    if (cfg.sedes.length && cfg.sedes.indexOf(sede) < 0) continue;
    if (cfg.facultades.length && cfg.facultades.indexOf(norm_(fac)) < 0) continue;
    const prog = programa_(trat), mat = v('matcod', i).replace(/\s+/g, ' ').toUpperCase(), ci = v('ci', i);
    const clave = (v('detalle', i) || ciNorm_(ci) + '·' + mat) + '|' + prog;
    if (!ci || !mat || vistos[clave]) continue;
    vistos[clave] = true;
    lista.push([clave, titulo_(v('nombre', i)), ci, v('correo', i).toLowerCase(), sede, car, (cars[car] || [])[0] || v('carrera', i), fac, Number(v('semestre', i)) || '',
      mat, v('materia', i), semMateria_(mat) || Number(v('semestre', i)) || '', v('paralelo', i), titulo_(v('docente', i)), prog, titulo_(v('asignado', i)),
      Number(v('hito', i)) || v('hito', i), v('ficha', i), v('detalle', i)]);
  }
  return { lista: lista, error: null };
}
// Registros del SIAR en caché (1 hora). «Actualizar SIAR» la limpia.
function siar_(cfg) { return cacheLista_('siar', () => leerSiar_(cfg).lista); }

// Listas que se guardan en la caché del script, en trozos (límite de 100 KB por clave). Una lista vacía no se guarda.
const CACHES = { siar: 3600 };
function cacheLista_(pref, fn) {
  const cache = CacheService.getScriptCache();
  try {
    const n = Number(cache.get(pref + '_n'));
    if (n) {
      const keys = Array.from({ length: n }, (_, i) => pref + '_' + i), t = cache.getAll(keys);
      if (keys.every(k => typeof t[k] === 'string')) return JSON.parse(keys.map(k => t[k]).join(''));
    }
  } catch (e) {}
  const lista = fn();
  try {
    const s = JSON.stringify(lista), T = 40000, n = Math.ceil(s.length / T), o = {};
    if (lista.length && n <= 200) { for (let i = 0; i < n; i++) o[pref + '_' + i] = s.slice(i * T, (i + 1) * T); o[pref + '_n'] = String(n); cache.putAll(o, CACHES[pref]); }
  } catch (e) {}
  return lista;
}
function limpiarCache_() {
  const cache = CacheService.getScriptCache();
  Object.keys(CACHES).forEach(p => { try { const n = Number(cache.get(p + '_n')) || 0; cache.removeAll([p + '_n'].concat(Array.from({ length: n }, (_, i) => p + '_' + i))); } catch (e) {} });
}

// Relee el SIAR: agrega a CARRERAS los códigos nuevos (amarillo), rehace la pestaña SIN ASIGNACIÓN y limpia la caché.
function actualizarSiar_() {
  const ss = SpreadsheetApp.getActive(), cfg = config_();
  limpiarCache_();
  const sinFiltros = Object.assign({}, cfg, { sedes: [], facultades: [] });
  const r = leerSiar_(sinFiltros);
  if (r.error) return { texto: '⚠ ' + r.error };
  const varias = hojasSiar_();
  const cars = carreras_(), shC = ss.getSheetByName(H.CARRERAS), nuevos = {};
  r.lista.forEach(x => { if (x[5] && !cars[x[5]] && !nuevos[x[5]]) nuevos[x[5]] = x[6]; });
  Object.keys(nuevos).sort().forEach(k => { shC.appendRow([k, nuevos[k], '']); shC.getRange(shC.getLastRow(), 1, 1, 3).setBackground('#fff59d'); });
  const sinFac = {}; r.lista.forEach(x => { if (!x[7]) sinFac[x[5]] = true; });
  // pestaña SIN ASIGNACIÓN (para que dirección complete el SIAR)
  const sin = r.lista.filter(x => !x[15]).map(x => [SEDES[x[4]] || x[4], x[7], x[6], x[8], x[1], x[2], x[10], x[9], x[12], x[13], x[14], x[16], x[17]])
    .sort((a, b) => (a[0] + a[1] + a[2] + a[4]).localeCompare(b[0] + b[1] + b[2] + b[4], 'es'));
  let sh = ss.getSheetByName(H.SIN_ASIG);
  if (!sh) sh = ss.insertSheet(H.SIN_ASIG);
  sh.clear();
  const cab = ['Sede', 'Facultad', 'Carrera', 'Semestre', 'Estudiante', 'CI', 'Materia', 'Código materia', 'Paralelo', 'Docente de la materia', 'Programa', 'Hito', 'Ficha SIAR'];
  sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
  if (sin.length) sh.getRange(2, 1, sin.length, cab.length).setValues(sin);
  sh.setFrozenRows(1); sh.setColumnWidth(5, 260); sh.setColumnWidth(7, 260);
  const est = {}, mentores = {}; r.lista.forEach(x => { est[ciNorm_(x[2])] = true; if (x[15]) mentores[x[14] + '|' + nombreKey_(x[15])] = true; });
  const nM = k => Object.keys(mentores).filter(m => m.indexOf(k + '|') === 0).length;
  const texto = 'SIAR leído: ' + r.lista.length + ' combinaciones estudiante × materia (' + Object.keys(est).length + ' estudiantes) con los tratamientos de CONFIG.\n' +
    'Asignados: ' + nM(PROGRAMAS[0]) + ' docentes tutores y ' + nM(PROGRAMAS[1]) + ' hermanos mayores.\n' +
    'Sin asignación: ' + sin.length + ' (ver pestaña «' + H.SIN_ASIG + '»).' +
    (Object.keys(nuevos).length ? '\nCarreras nuevas en CARRERAS (amarillo): ' + Object.keys(nuevos).join(', ') + '.' : '') +
    (Object.keys(sinFac).length ? '\n⚠ Carreras sin facultad en CARRERAS (no aparecen en la app): ' + Object.keys(sinFac).sort().join(', ') + '. Elige su facultad en la columna C.' : '') +
    (varias.length > 1 ? '\n⚠ Hay ' + varias.length + ' pestañas con el reporte del SIAR (' + varias.map(x => '«' + x.getName() + '»').join(', ') + '). Uso «' + varias[varias.length - 1].getName() + '»: borra las demás.' : '');
  return { texto: texto, n: r.lista.length };
}

/* ═════════════════════════ RESPUESTAS ═════════════════════════ */
function cabResp_() {
  return [
    'Marca temporal', 'ID envío', 'Código de registro', 'Mentor', 'Programa de apoyo', 'Mentor figura en el SIAR', 'Hito', 'Sede', 'Facultad',
    'CI del estudiante', 'Estudiante', 'Correo del estudiante', 'Cód. carrera', 'Carrera', 'Semestre del estudiante',
    'Cód. asignatura', 'Asignatura', 'Paralelo', 'Docente de la materia', 'Asignado en el SIAR', 'Asignación',
    'Asistió', 'Fecha de la sesión', 'Hora de inicio', 'Hora de conclusión', 'Duración de la sesión (min)', 'Materias en la sesión', 'Horas imputadas a esta materia',
    'Actividad(es) realizada(s)', 'Observaciones y comentarios', 'Posible duplicado', 'Ficha SIAR', 'Detalle SIAR',
    'Periodo', 'Dispositivo', 'Fecha y hora local (dispositivo)', 'Versión app'
  ];
}
const ASIGNACION = { mia: 'Asignado a quien registra', otro: 'Asignado a otra persona', sin: 'Sin asignación en el SIAR' };
function hojaResp_(nombre) {
  const ss = SpreadsheetApp.getActive(), C = cabResp_();
  nombre = nombre || H.RESP;
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, C.length).setValues([C]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#3a3a3a').setWrap(true).setVerticalAlignment('middle');
    sh.setFrozenRows(1); sh.setFrozenColumns(3); sh.setRowHeight(1, 48);
    sh.setColumnWidths(1, C.length, 130); sh.setColumnWidth(4, 230); sh.setColumnWidth(11, 230); sh.setColumnWidth(17, 260); sh.setColumnWidth(29, 320);
    sh.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm:ss');
    sh.getRange(2, C.indexOf('Fecha de la sesión') + 1, sh.getMaxRows() - 1, 1).setNumberFormat('dd/MM/yyyy');
    sh.getRange(2, C.indexOf('Hora de inicio') + 1, sh.getMaxRows() - 1, 2).setNumberFormat('@');
    sh.getRange(2, C.indexOf('CI del estudiante') + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
  } else {
    const act = sh.getRange(1, 1, 1, C.length).getValues()[0];
    for (let i = 0; i < C.length; i++) if (String(act[i]).trim() !== C[i])
      throw new Error('La fila 1 de «' + nombre + '» no coincide en la columna ' + (i + 1) + '. Esperado: «' + C[i] + '». No se guardó nada.');
  }
  return sh;
}
function hojaPapelera_() {
  const ss = SpreadsheetApp.getActive(), C = ['Fecha de anulación', 'Anulado por', 'Motivo'].concat(cabResp_());
  let sh = ss.getSheetByName(H.PAPELERA);
  if (!sh) sh = ss.insertSheet(H.PAPELERA);
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, C.length).setValues([C]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#7a3b3b').setWrap(true); sh.setFrozenRows(1); }
  return sh;
}
const fmtFecha_ = d => d instanceof Date ? Utilities.formatDate(d, ZONA, 'dd/MM/yyyy') : String(d || '');
// Código «ME-ABCDE-XYZ123» = envío completo; «ME-ABCDE-XYZ123-03» = un estudiante de ese envío.
function codigo_(s) { const id = String(s || '').toUpperCase().replace(/\s+/g, ''); return /^(ME|PRUEBA)-/.test(id) ? id : 'ME-' + id; }
function filasPorCodigo_(sh, cod, colId, colReg) {
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(colId, colReg)).getValues(), out = [];
  v.forEach((r, i) => { if (String(r[colId - 1]).toUpperCase() === cod || String(r[colReg - 1]).toUpperCase() === cod) out.push(i + 2); });
  return out;
}

/* ═════════════════════════ WEB APP ═════════════════════════ */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const accion = p.action || 'ping';
  let out;
  try {
    if (accion === 'ping') {
      const sh = SpreadsheetApp.getActive().getSheetByName(H.RESP), cfg = config_();
      out = { ok: true, servicio: 'bitacora-nivelaciones', version_app: VERSION_APP, abierta: abierta_(cfg), periodo: cfg.periodo, hitos: cfg.hitos, requiere_clave: !!cfg.clave, respuestas: sh ? Math.max(0, sh.getLastRow() - 1) : 0 };
    } else if (accion === 'inicio') out = inicio_(p.clave);
    else if (accion === 'lista') out = lista_(p.clave, p.sede, p.fac);
    else if (accion === 'verificar') out = { ok: true, id: p.id || '', existe: existeId_(String(p.id || '').toUpperCase()) };
    else if (accion === 'guardar') out = guardar_(JSON.parse(p.data || '{}'));
    else out = { ok: false, error: 'Acción desconocida' };
  } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return responder_(out, p.callback);
}
function doPost(e) {
  let out;
  try { const body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); out = guardar_(body.data || body); }
  catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return responder_(out);
}
function responder_(obj, cb) {
  const json = JSON.stringify(obj);
  if (cb && /^[A-Za-z_$][\w$]{0,80}$/.test(cb)) return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// Sedes y facultades con registros en el SIAR (sin datos personales).
function inicio_(clave) {
  const cfg = config_();
  if (!abierta_(cfg)) return { ok: true, abierta: false, mensaje: cfg.mensaje };
  if (!claveOk_(cfg, clave)) return { ok: false, motivo: 'clave', requiere_clave: true };
  const l = siar_(cfg), fn = facultades_(), cs = {}, cf = {};
  l.forEach(x => { cs[x[4]] = (cs[x[4]] || 0) + 1; const k = x[4] + '|' + x[7]; cf[k] = (cf[k] || 0) + 1; });
  return {
    ok: true, abierta: true, periodo: cfg.periodo, hitos: cfg.hitos,
    sedes: Object.keys(SEDES).filter(k => cs[k]).map(k => ({ cod: k, nombre: SEDES[k] })),
    facultades: fn.map(f => ({ cod: f, nombre: f })),
    conteo: cf
  };
}
// Registros de una sede y facultad para la app: nombre, CI parcial, carrera, materia, asignado… (sin correos ni celulares).
function lista_(clave, sede, fac) {
  const cfg = config_();
  if (!abierta_(cfg)) return { ok: false, motivo: 'cerrada', mensaje: cfg.mensaje };
  if (!claveOk_(cfg, clave)) return { ok: false, motivo: 'clave' };
  const S = String(sede || '').toUpperCase(), F = norm_(fac);
  const regs = siar_(cfg).filter(x => x[4] === S && norm_(x[7]) === F)
    .map(x => [x[0], x[1], ciMask_(x[2]), x[5], x[6], x[8], x[9], x[10], x[11], x[12], x[13], x[14], x[15], x[16]]);
  return { ok: true, registros: regs };
}

// Un envío: un mentor, un hito y varios estudiantes; cada estudiante con sus materias (claves del SIAR).
function guardar_(d) {
  if (!d || typeof d !== 'object') throw new Error('Datos vacíos');
  const id = txt_(d.id, 60).toUpperCase();
  if (!/^(ME|PRUEBA)-[A-Z0-9]{4,12}-[A-Z0-9]{4,12}$/.test(id)) throw new Error('ID inválido');
  const prueba = id.indexOf('PRUEBA-') === 0;
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const sh = hojaResp_();
    if (existeId_(id, sh)) return { ok: true, id: id, duplicado: true };
    const cfg = config_();
    if (prueba) {
      const ids = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues() : [], vistos = {};
      ids.forEach(r => { const s = String(r[0]); if (s.indexOf('PRUEBA-') === 0) vistos[s] = true; });
      if (Object.keys(vistos).length >= MAX_PRUEBAS) return { ok: false, codigo: 'limite_pruebas' };
    } else {
      if (!abierta_(cfg)) return { ok: false, codigo: 'cerrada' };
      if (!claveOk_(cfg, d.clave)) return { ok: false, codigo: 'clave' };
    }
    const v = validarEnvio_(d, cfg, prueba);
    if (v.error) return { ok: false, codigo: 'datos_invalidos', detalle: v.error };
    const C = cabResp_(), dupes = clavesExistentes_(sh), ahora = new Date(), filas = [], codigos = [];
    const extra = [cfg.periodo, d.movil ? 'Móvil' : 'Computadora', txt_(d.fecha_local, 40), txt_(d.version, 10)];
    let nDup = 0;
    const codEst = {};
    v.items.forEach(it => {
      const ke = ciNorm_(it.regs[0][2]), n = it.regs.length;
      if (!codEst[ke]) { codEst[ke] = id + '-' + ('0' + (codigos.length + 1)).slice(-2); codigos.push({ codigo: codEst[ke].replace(/^ME-/, ''), estudiante: it.regs[0][1] }); }
      const cod = codEst[ke];
      it.regs.forEach(x => {
        const clave = [nombreKey_(v.mentor.nombre), ciNorm_(x[2]), x[9], String(v.hito), it.fecha ? fmtFecha_(it.fecha) : ''].join('|');
        const dup = !!dupes[clave]; if (dup) nDup++; dupes[clave] = true;
        const asig = !x[15] ? ASIGNACION.sin : nombreKey_(x[15]) === nombreKey_(v.mentor.nombre) ? ASIGNACION.mia : ASIGNACION.otro;
        filas.push([ahora, id, cod, v.mentor.nombre, v.mentor.programa, v.mentor.enSiar ? 'Sí' : 'No', v.hito, SEDES[x[4]] || x[4], x[7],
          String(x[2]), x[1], x[3], x[5], x[6], x[8], x[9], x[10], x[12], x[13], x[15] || '', asig,
          it.asistio, it.fecha || '', it.hi, it.hf, it.dur, it.asistio === 'Sí' ? n : '', it.dur === '' ? '' : Math.round(it.dur / 60 / n * 10000) / 10000,
          it.act, it.obs, dup ? 'Sí' : '', x[17], x[18]].concat(extra));
      });
    });
    if (filas[0].length !== C.length) throw new Error('Fila de ' + filas[0].length + ' columnas para ' + C.length + ' títulos');
    sh.getRange(sh.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
    return { ok: true, id: id, filas: filas.length, estudiantes: codigos.length, duplicados: nDup, codigos: codigos };
  } finally { lock.releaseLock(); }
}
function clavesExistentes_(sh) {
  const out = {};
  if (sh.getLastRow() < 2) return out;
  const C = cabResp_(), c = k => C.indexOf(k);
  sh.getRange(2, 1, sh.getLastRow() - 1, C.length).getValues().forEach(r => {
    out[[nombreKey_(r[c('Mentor')]), ciNorm_(r[c('CI del estudiante')]), String(r[c('Cód. asignatura')]).toUpperCase(), String(r[c('Hito')]),
      r[c('Fecha de la sesión')] ? fmtFecha_(r[c('Fecha de la sesión')]) : ''].join('|')] = true;
  });
  return out;
}
function validarEnvio_(d, cfg, prueba) {
  const hito = String(d.hito === undefined || d.hito === null ? '' : d.hito).trim();
  if (!hito || (!prueba && cfg.hitos.length && cfg.hitos.indexOf(hito) < 0)) return { error: 'Hito no habilitado: ' + hito };
  const m = d.mentor || {}, nombre = titulo_(txt_(m.nombre, 120)), programa = String(m.programa || '').trim();
  if (nombre.split(' ').length < 2) return { error: 'Falta el nombre completo de quien registra' };
  if (PROGRAMAS.indexOf(programa) < 0 && !prueba) return { error: 'Programa de apoyo inválido' };
  const items = Array.isArray(d.items) ? d.items : [];
  if (!items.length || items.length > MAX_EST) return { error: 'Cantidad de estudiantes inválida' };
  const todos = siar_(cfg), por = {}, asignados = {};
  todos.forEach(x => { por[x[0]] = x; if (x[15]) asignados[nombreKey_(x[15])] = true; });
  const hoy = new Date(), out = [], usados = {};
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {}, n = 'Estudiante ' + (i + 1) + ': ';
    let regs;
    if (prueba && it.prueba) regs = [['PRUEBA', 'Estudiante De Prueba', '0000000', '', 'CBB', 'SIS', 'Ingeniería de Sistemas', 'FI', 1, 'PRUEBA-000', 'Materia de prueba', 1, '', '', programa, '', hito, '', '']];
    else {
      const keys = Array.isArray(it.keys) ? it.keys : [];
      if (!keys.length || keys.length > 20) return { error: n + 'sin materias' };
      regs = [];
      for (const k of keys) {
        const x = por[String(k)];
        if (!x) return { error: n + 'una materia ya no está en el SIAR' };
        if (regs.length && ciNorm_(x[2]) !== ciNorm_(regs[0][2])) return { error: n + 'materias de estudiantes distintos' };
        if (!regs.some(r => r[9] === x[9])) regs.push(x);      // misma materia por dos tratamientos: una sola fila
      }
    }
    const kEst = ciNorm_(regs[0][2]);
    for (const x of regs) { const u = kEst + '|' + x[9]; if (usados[u]) return { error: n + 'la materia ' + x[10] + ' está dos veces en el envío' }; usados[u] = true; }
    const asistio = siNo_(it.asistio);
    if (!asistio) return { error: n + 'falta indicar si asistió' };
    const r = { regs: regs, asistio: asistio, fecha: '', hi: '', hf: '', dur: '', act: '', obs: '' };
    if (asistio === 'Sí') {
      const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(it.fecha || ''));
      if (!f) return { error: n + 'fecha inválida' };
      const fecha = new Date(+f[1], +f[2] - 1, +f[3]);
      if (fecha.getMonth() !== +f[2] - 1 || fecha - hoy > 36 * 3600 * 1000 || hoy - fecha > 400 * 86400 * 1000) return { error: n + 'fecha fuera de rango' };
      const hi = hora_(it.hi), hf = hora_(it.hf);
      if (hi === null || hf === null || hf <= hi || hf - hi > 600) return { error: n + 'horario inválido' };
      const act = txt_(it.act, 1000);
      if (!act) return { error: n + 'faltan las actividades realizadas' };
      Object.assign(r, { fecha: fecha, hi: hhmm_(hi), hf: hhmm_(hf), dur: hf - hi, act: act, obs: txt_(it.obs, 1000) });
    }
    out.push(r);
  }
  return { hito: /^\d+$/.test(hito) ? Number(hito) : hito, mentor: { nombre: nombre, programa: programa, enSiar: !!asignados[nombreKey_(nombre)] }, items: out };
}
function hora_(s) { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim()); if (!m || +m[1] > 23 || +m[2] > 59) return null; return +m[1] * 60 + +m[2]; }
const hhmm_ = n => ('0' + Math.floor(n / 60)).slice(-2) + ':' + ('0' + n % 60).slice(-2);
function txt_(v, max) { let s = (v === null || v === undefined) ? '' : String(v).trim().slice(0, max || 500); if (/^[=+\-@]/.test(s)) s = "'" + s; return s; }
function siNo_(v) { const s = String(v || '').trim(); return /^s/i.test(s) ? 'Sí' : /^n/i.test(s) ? 'No' : ''; }
function existeId_(id, sh) {
  if (!id) return false;
  sh = sh || SpreadsheetApp.getActive().getSheetByName(H.RESP);
  if (!sh || sh.getLastRow() < 2) return false;
  return !!sh.getRange(2, 2, sh.getLastRow() - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
}

/* ═════════════════════════ ACCIONES DEL MENÚ ═════════════════════════ */
function menuAbrir() { setConfig_('Registro activo', 'SÍ'); bitacora_('Abrir registro', ''); aviso_('Registro abierto', 'Ya se pueden registrar sesiones.'); }
function menuCerrar() { setConfig_('Registro activo', 'NO'); bitacora_('Cerrar registro', ''); aviso_('Registro cerrado', 'Nadie puede registrar sesiones hasta que lo abras de nuevo.'); }
function menuActualizarSiar() {
  crearConfig_(false); crearCarreras_();
  const cons = consolidarSiar_();
  const r = actualizarSiar_();
  r.texto = cons + r.texto;
  ordenarPestanas_();
  bitacora_('Actualizar SIAR', r.texto);
  aviso_('SIAR actualizado', r.texto);
}
function menuEstado() {
  const ss = SpreadsheetApp.getActive(), cfg = config_(), resp = ss.getSheetByName(H.RESP);
  let nFilas = 0; const envios = {}, mentores = {}, regs = {};
  if (resp && resp.getLastRow() > 1) resp.getRange(2, 2, resp.getLastRow() - 1, 3).getValues().forEach(r => {
    if (!r[0] || String(r[0]).indexOf('PRUEBA-') === 0) return;
    nFilas++; envios[r[0]] = true; regs[r[1]] = true; mentores[nombreKey_(r[2])] = true;
  });
  aviso_('Estado del registro',
    'Estado: ' + (abierta_(cfg) ? 'ABIERTO' : 'CERRADO') + ' · Periodo: ' + cfg.periodo + ' · Hitos: ' + (cfg.hitos.join(', ') || 'todos') +
    '\nCódigo de acceso: ' + (cfg.clave || '(sin código)') + ' · Sedes: ' + (cfg.sedes.join(', ') || 'todas') + ' · Facultades: ' + (cfg.facultades.join(', ') || 'todas') +
    '\n\nMentores que registraron: ' + Object.keys(mentores).length + '\nEnvíos: ' + Object.keys(envios).length + ' · estudiantes registrados: ' + Object.keys(regs).length + ' · filas (estudiante × materia): ' + nFilas);
}
function moverAPapelera_(sh, nums, motivo) {
  const pap = hojaPapelera_(), quien = usuario_(), ahora = new Date(), n = cabResp_().length;
  nums.slice().sort((a, b) => b - a).forEach(f => { pap.appendRow([ahora, quien, motivo || '(sin motivo)'].concat(sh.getRange(f, 1, 1, n).getValues()[0])); sh.deleteRow(f); });
}
function menuAnular() {
  const ui = SpreadsheetApp.getUi();
  const t = pedir_('Anular por código', 'Escribe el código.\n• De un estudiante (ej.: K3F9A-7XQ2MD-03): anula solo sus filas.\n• De un envío (ej.: K3F9A-7XQ2MD): anula todo el envío.', true);
  if (!t) return;
  const cod = codigo_(t), sh = SpreadsheetApp.getActive().getSheetByName(H.RESP);
  const nums = filasPorCodigo_(sh, cod, 2, 3);
  if (!nums.length) return aviso_('Sin filas', 'No hay filas con el código ' + cod + ' en RESPUESTAS.');
  const v = sh.getRange(nums[0], 1, 1, cabResp_().length).getValues()[0], ests = {};
  nums.forEach(f => { ests[sh.getRange(f, 11).getValue()] = true; });
  const motivo = pedir_('Motivo', 'Encontrado:\n• Mentor: ' + v[3] + ' (' + v[4] + ')\n• Hito ' + v[6] + ' · enviado el ' + fmtFecha_(v[0]) + '\n• ' + Object.keys(ests).length + ' estudiante(s) · ' + nums.length + ' fila(s)\n\nEscribe el motivo (queda en la bitácora):', true);
  if (motivo === null) return;
  if (ui.alert('Confirmar anulación', '¿Mover ' + nums.length + ' fila(s) del código ' + cod + ' a PAPELERA?\nSe pueden restaurar. Después el mentor puede volver a registrar.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { moverAPapelera_(sh, filasPorCodigo_(sh, cod, 2, 3), motivo); } finally { lock.releaseLock(); }
  bitacora_('Anular', cod + ' · ' + v[3] + ' · ' + nums.length + ' filas · motivo: ' + (motivo || '—'));
  aviso_('Anulado', 'Listo. ' + nums.length + ' fila(s) quedaron en PAPELERA.');
}
function menuAnularSeleccion() {
  const ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive(), sh = ss.getActiveSheet();
  if (!sh || sh.getName() !== H.RESP) return aviso_('Primero selecciona filas', 'Ve a RESPUESTAS, selecciona las filas a anular (basta una celda de cada fila) y vuelve a usar esta opción.');
  const rl = ss.getActiveRangeList(), nums = {};
  (rl ? rl.getRanges() : [sh.getActiveRange()]).forEach(r => { for (let i = 0; i < r.getNumRows(); i++) { const n = r.getRow() + i; if (n >= 2 && n <= sh.getLastRow()) nums[n] = true; } });
  const filas = Object.keys(nums).map(Number);
  if (!filas.length) return aviso_('Sin filas', 'La selección no incluye filas de respuestas.');
  if (filas.length > 300) return aviso_('Demasiadas filas', 'Seleccionaste ' + filas.length + ' filas. Usa «Anular por código».');
  const motivo = pedir_('Motivo', 'Se anularán ' + filas.length + ' fila(s). Escribe el motivo:', true);
  if (motivo === null) return;
  if (ui.alert('Confirmar anulación', '¿Mover ' + filas.length + ' fila(s) a PAPELERA?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { moverAPapelera_(sh, filas, motivo); } finally { lock.releaseLock(); }
  bitacora_('Anular filas seleccionadas', filas.length + ' filas · motivo: ' + (motivo || '—'));
  aviso_('Filas anuladas', 'Listo. ' + filas.length + ' fila(s) quedaron en PAPELERA.');
}
function menuRestaurar() {
  const ui = SpreadsheetApp.getUi();
  const t = pedir_('Restaurar por código', 'Código del estudiante o del envío a restaurar (columnas «ID envío» o «Código de registro» de PAPELERA):', true);
  if (!t) return;
  const cod = codigo_(t), pap = SpreadsheetApp.getActive().getSheetByName(H.PAPELERA);
  const nums = filasPorCodigo_(pap, cod, 5, 6);
  if (!nums.length) return aviso_('No encontrado', 'No hay filas con el código ' + cod + ' en PAPELERA.');
  if (ui.alert('Confirmar', '¿Restaurar ' + nums.length + ' fila(s) del código ' + cod + '?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const resp = hojaResp_(), n = cabResp_().length;
  nums.sort((a, b) => b - a).forEach(f => { resp.appendRow(pap.getRange(f, 4, 1, n).getValues()[0]); pap.deleteRow(f); });
  bitacora_('Restaurar', cod + ' · ' + nums.length + ' filas');
  aviso_('Restaurado', nums.length + ' fila(s) volvieron a RESPUESTAS.');
}
function menuNuevoPeriodo() {
  const ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive(), cfg = config_();
  const nuevo = pedir_('Nuevo periodo', 'Periodo actual: ' + cfg.periodo + '\n\nLas respuestas actuales pasarán a «RESPUESTAS ' + cfg.periodo + '» y RESPUESTAS quedará vacía.\n\nNombre del NUEVO periodo (ej.: I-2027):', true);
  if (!nuevo) return;
  const archivo = 'RESPUESTAS ' + (cfg.periodo || Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd'));
  if (ss.getSheetByName(archivo)) return aviso_('Ya existe', 'Ya hay una pestaña «' + archivo + '». Cambia el Periodo en CONFIG y vuelve a intentar.');
  if (ui.alert('Confirmar', '¿Archivar ' + cfg.periodo + ' e iniciar ' + nuevo + '?\n\nDespués pega el SIAR nuevo y usa «Actualizar SIAR».', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { const resp = ss.getSheetByName(H.RESP); resp.copyTo(ss).setName(archivo); if (resp.getLastRow() > 1) resp.deleteRows(2, resp.getLastRow() - 1); setConfig_('Periodo', nuevo); }
  finally { lock.releaseLock(); }
  crearResumen_();
  bitacora_('Nuevo periodo', cfg.periodo + ' → ' + nuevo + ' (archivo: ' + archivo + ')');
  aviso_('Nuevo periodo iniciado', 'Respuestas de ' + cfg.periodo + ' archivadas en «' + archivo + '».');
}
function menuResumen() { crearResumen_(); aviso_('RESUMEN', 'Pestaña RESUMEN reconstruida.'); }
function menuBorrarPruebas() {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.RESP);
  if (!sh || sh.getLastRow() < 2) return aviso_('Sin filas', 'No hay respuestas.');
  const ids = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
  let n = 0;
  for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]).indexOf('PRUEBA-') === 0) { sh.deleteRow(i + 2); n++; }
  bitacora_('Borrar filas de prueba', n + ' filas');
  aviso_('Filas de prueba', 'Borradas: ' + n);
}

/* ═════════════════════════ RESUMEN (fórmulas vivas) ═════════════════════════ */
function crearResumen_() {
  const ss = SpreadsheetApp.getActive(), cfg = config_();
  let rs = ss.getSheetByName(H.RESUMEN);
  if (!rs) rs = ss.insertSheet(H.RESUMEN);
  rs.clear();
  sepFormulas_(rs);
  const C = cabResp_();
  const col = t => { const i = C.indexOf(t); if (i < 0) throw new Error('Columna no encontrada: ' + t); return colLetra_(i + 1); };
  const R = c => H.RESP + '!$' + c + '$2:$' + c;
  const ID = R(col('ID envío')), CI = R(col('CI del estudiante')), AS = R(col('Asistió')), HR = R(col('Horas imputadas a esta materia'));
  const HI = R(col('Hito')), SE = R(col('Sede')), FA = R(col('Facultad')), CA = R(col('Cód. carrera')), PR = R(col('Programa de apoyo')), ME = R(col('Mentor')), AG = R(col('Asignación'));
  const real = '"<>PRUEBA-*"', W = 8, rows = [], fmt = [];
  const push = (r, t) => { while (r.length < W) r.push(''); rows.push(r); if (t) fmt.push([rows.length, t]); };
  const cnt = cond => '=COUNTIFS(' + ID + ',"<>",' + ID + ',' + real + (cond ? ',' + cond : '') + ')';   // «<>PRUEBA-*» solo también contaría celdas vacías
  const uni = cond => '=IFERROR(COUNTUNIQUEIFS(' + CI + ',' + ID + ',' + real + (cond ? ',' + cond : '') + '),0)';
  const hrs = cond => '=SUMIFS(' + HR + ',' + ID + ',' + real + (cond ? ',' + cond : '') + ')';
  const fila = (lbl, c) => { const r = rows.length + 1; push([lbl, cnt(c), uni(c), cnt(c + ',' + AS + ',"Sí"'), cnt(c + ',' + AS + ',"No"'), '=IFERROR(D' + r + '/B' + r + ',0)', hrs(c)], 'fila'); };
  const cabT = t => push([t, 'Registros', 'Estudiantes', 'Asistieron', 'No asistieron', '% asistencia', 'Horas'], 'cab');

  push(['RESUMEN · Bitácora de nivelaciones'], 'titulo');
  push(['Se actualiza solo. Excluye filas de prueba. Un «registro» es una fila: un estudiante en una materia.'], 'nota');
  push(['']);
  push(['Registros (estudiante × materia)', cnt('')], 'total');
  push(['Estudiantes atendidos (distintos)', uni('')], 'total');
  push(['Estudiantes que asistieron al menos una vez', uni(AS + ',"Sí"')], 'total');
  push(['Registros con asistencia', cnt(AS + ',"Sí"')], 'total');
  push(['Registros sin asistencia', cnt(AS + ',"No"')], 'total');
  push(['% de asistencia (registros)', '=IFERROR(B7/B4,0)'], 'totalpct');
  push(['Horas de mentoría', hrs('')], 'totalh');
  push(['Docentes tutores que registraron', '=IFERROR(COUNTUNIQUEIFS(' + ME + ',' + ID + ',' + real + ',' + PR + ',"' + PROGRAMAS[0] + '"),0)'], 'total');
  push(['Hermanos mayores que registraron', '=IFERROR(COUNTUNIQUEIFS(' + ME + ',' + ID + ',' + real + ',' + PR + ',"' + PROGRAMAS[1] + '"),0)'], 'total');
  push(['Registros de estudiantes sin asignación en el SIAR', cnt(AG + ',"' + ASIGNACION.sin + '"')], 'total');
  push(['Combinaciones sin asignación en el SIAR (pestaña ' + H.SIN_ASIG + ')', "=MAX(0,COUNTA('" + H.SIN_ASIG + "'!A:A)-1)"], 'total');
  push(['']);
  cabT('POR PROGRAMA DE APOYO'); PROGRAMAS.forEach(g => fila(g, PR + ',"' + g + '"')); push(['']);
  const qh = h => /^\d+$/.test(h) ? h : '"' + h + '"';
  cabT('POR HITO'); (cfg.hitos.length ? cfg.hitos : ['2', '3', '4']).forEach(h => fila('Hito ' + h, HI + ',' + qh(h))); push(['']);
  cabT('POR SEDE'); Object.keys(SEDES).forEach(s => fila(SEDES[s], SE + ',"' + SEDES[s] + '"')); push(['']);
  cabT('POR FACULTAD'); facultades_().forEach(f => fila(f, FA + ',"' + f + '"')); push(['']);
  const enSiar = {}; try { leerSiar_(Object.assign({}, cfg, { sedes: [], facultades: [] })).lista.forEach(x => { enSiar[x[5]] = true; }); } catch (e) {}
  const cars = Object.entries(carreras_()).filter(([k]) => !Object.keys(enSiar).length || enSiar[k]);   // solo carreras presentes en el SIAR
  cabT('POR CARRERA'); cars.forEach(([k, v]) => fila(k + ' · ' + v[0], CA + ',"' + k + '"')); push(['']);
  // Rankings con QUERY (filas variables al final)
  const L = colLetra_(C.length), cB = col('ID envío'), q = (c, lim) => '=IFERROR(QUERY(' + H.RESP + '!$A$2:$' + L + ',"select ' + c + ', count(' + cB + ') where ' + cB + ' is not null and not ' + cB + ' starts with \'PRUEBA-\' group by ' + c + ' order by count(' + cB + ') desc limit ' + lim + ' label count(' + cB + ') \'\'",0),"Todavía no hay registros")';
  push(['ASIGNATURAS CON MÁS REGISTROS (25 primeras)', 'Registros'], 'cab'); push([q(col('Asignatura'), 25)]); for (let i = 0; i < 25; i++) push(['']);
  push(['MENTORES (registros por mentor)', 'Registros'], 'cab'); push([q(col('Mentor'), 500)]);

  rs.getRange(1, 1, rows.length, W).setValues(rows.map(r => r.map(v => typeof v === 'string' && v.charAt(0) === '=' ? fx_(v) : v)));
  rs.setColumnWidth(1, 430); rs.setColumnWidths(2, W - 1, 110);
  rs.getRange(1, 1, rows.length, W).setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
  fmt.forEach(f => {
    const n = f[0], t = f[1];
    if (t === 'titulo') rs.getRange(n, 1).setFontSize(14).setFontWeight('bold');
    if (t === 'nota') rs.getRange(n, 1).setFontColor('#777777').setFontStyle('italic');
    if (t === 'total') rs.getRange(n, 1, 1, 2).setFontWeight('bold').setFontSize(12);
    if (t === 'totalpct') rs.getRange(n, 1, 1, 2).setFontWeight('bold').setFontSize(12).setNumberFormat('0.0%');
    if (t === 'totalh') rs.getRange(n, 1, 1, 2).setFontWeight('bold').setFontSize(12).setNumberFormat('0.0');
    if (t === 'cab') rs.getRange(n, 1, 1, W).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
    if (t === 'fila') { rs.getRange(n, 6).setNumberFormat('0.0%'); rs.getRange(n, 7).setNumberFormat('0.0'); }
  });
}

/* ═════════════════════════ UTILIDADES ═════════════════════════ */
function norm_(s) { return String(s === null || s === undefined ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
// Separador de argumentos de las fórmulas según la configuración regional de la hoja («,» o «;»).
function sepFormulas_(sh) {
  try {
    const c = sh.getRange(1, 1);
    for (const s of [',', ';']) {
      c.setFormula('=SUM(2' + s + '5)'); SpreadsheetApp.flush();
      if (c.getValue() === 7) { c.clearContent(); PropertiesService.getScriptProperties().setProperty('SEP', s); return s; }
    }
    c.clearContent();
  } catch (e) {}
  return sep_();
}
function sep_() { try { return PropertiesService.getScriptProperties().getProperty('SEP') || ','; } catch (e) { return ','; } }
// Cambia las comas separadoras por «;» si hace falta (las comas dentro de "texto" no se tocan).
function fx_(f) { return sep_() === ',' ? f : f.replace(/("[^"]*")|,/g, (m, q) => q || ';'); }
function colLetra_(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function buscarFila_(sh, clave) {
  if (!sh || sh.getLastRow() < 1) return 0;
  const v = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 0; i < v.length; i++) if (String(v[i][0]).trim() === clave) return i + 1;
  return 0;
}
function usuario_() { try { return Session.getActiveUser().getEmail() || 'administrador'; } catch (e) { return 'administrador'; } }
function bitacora_(accion, detalle) {
  try { const sh = SpreadsheetApp.getActive().getSheetByName(H.BITACORA) || hojaSimple_(H.BITACORA, ['Fecha', 'Usuario', 'Acción', 'Detalle']); sh.appendRow([new Date(), usuario_(), accion, String(detalle || '').slice(0, 2000)]); } catch (e) {}
}
function aviso_(titulo, texto) { try { SpreadsheetApp.getUi().alert(titulo, texto, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { Logger.log(titulo + '\n' + texto); } }
function pedir_(titulo, texto, crudo) {
  const ui = SpreadsheetApp.getUi(), r = ui.prompt(titulo, texto, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  const t = r.getResponseText().trim();
  return crudo ? t : t.toLowerCase();
}
