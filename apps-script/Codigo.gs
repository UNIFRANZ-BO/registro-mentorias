/** @OnlyCurrentDoc */  // el script solo puede tocar esta hoja, ningún otro archivo de Drive
/**
 * REGISTRO DE SESIONES DE MENTORÍA · 2026  (v1.0)
 * Reemplaza el Google Form «Registro de Sesiones Realizadas de Mentorías || 2026».
 * Backend en Google Apps Script, ligado a la hoja que contiene las tres bases:
 *   · docentes (mentores)  → pestaña BASEDEDATOSDOC (o las que diga CONFIG)
 *   · estudiantes          → pestaña BASEDEDATOSEST
 *   · materias             → pestaña BASEDEDATOSMATERIAS
 * Un docente envía de una vez a todos los estudiantes que acompañó en un hito; cada
 * estudiante lleva todas sus materias. En RESPUESTAS queda UNA FILA POR ESTUDIANTE Y MATERIA.
 *
 * ── PRIMERA VEZ ─────────────────────────────────────────────────────────────
 *   1. En la hoja: Extensiones → Apps Script → pega este código → Guardar.
 *   2. Ejecuta configuracionInicial() (autoriza permisos). Crea las pestañas de trabajo
 *      sin tocar las bases.
 *   3. Recarga la hoja: aparece el menú «Mentorías». Revisa CONFIG y CARRERAS y usa
 *      «Mentorías → Actualizar padrón de mentores».
 *   4. Implementar → Nueva implementación → Aplicación web
 *        Ejecutar como: Yo · Quién tiene acceso: Cualquier persona
 *      Copia la URL que termina en /exec y pégala en API_URL_DEFECTO del index.html.
 *
 * ── PARA ACTUALIZAR ESTE CÓDIGO DESPUÉS ─────────────────────────────────────
 *   Implementar → Administrar implementaciones → ✏️ → Versión: «Nueva versión» → Implementar.
 *   (Nunca «Nueva implementación»: cambia la URL.)
 *
 * Todo lo que cambia de un hito o semestre a otro (hitos, bases, planes, sedes, fechas,
 * nombres de carreras, excluidos) se maneja desde la hoja, sin tocar código.
 */

const VERSION_APP = '1.0';
const ZONA = 'America/La_Paz';
const H = {             // nombres de pestañas
  CONFIG: 'CONFIG', CARRERAS: 'CARRERAS', PADRON: 'PADRON', EXCLUIDOS: 'EXCLUIDOS',
  AGREGADOS: 'AGREGADOS', RESP: 'RESPUESTAS', PAPELERA: 'PAPELERA', RESUMEN: 'RESUMEN', BITACORA: 'BITACORA'
};
const SEDES = { LPZ: 'La Paz', EAT: 'El Alto', CBB: 'Cochabamba', SCZ: 'Santa Cruz' };
const PROGRAMAS = ['Docente Tutor', 'Hermano Mayor'];
// Nombres sugeridos. La pestaña CARRERAS manda: ahí se corrigen y los códigos nuevos que
// aparezcan en las bases se agregan solos en amarillo.
const CARRERAS_SUGERIDAS = [
  ['AFC', 'Auditoría Financiera y Control de Gestión'], ['ARQ', 'Arquitectura'], ['BYF', 'Bioquímica y Farmacia'], ['CPD', 'Comunicación y Periodismo Digital'],
  ['DDP', 'Diseño Digital y Producción Transmedia'], ['DER', 'Derecho'], ['ENF', 'Enfermería'], ['GAC', 'Gastronomía y Artes Culinarias'],
  ['ICO', 'Ingeniería Comercial'], ['IEF', 'Ingeniería Económica y Financiera'], ['MED', 'Medicina'], ['NGE', 'Negocios y Gestión Empresarial'],
  ['ODO', 'Odontología'], ['PSI', 'Psicología'], ['PYM', 'Publicidad y Marketing'], ['SIS', 'Ingeniería de Sistemas'], ['THO', 'Turismo y Hotelería']
];
// Columnas que se buscan en las bases de personas (docentes y estudiantes), por nombre y en cualquier orden.
const COLS_BASE = {
  correo: ['correo_institucional', 'correo', 'email', 'correo_electronico', 'mail'],
  sede: ['sede'], modalidad: ['modalidad'],
  plan: ['plan_estudios', 'plan_de_estudios', 'plan_de_estudio', 'anho_plan_estudio', 'anio_plan_estudio', 'plan', 'plan_estudio', 'ano_plan_estudio'],
  carrera: ['carrera', 'cod_carrera', 'codigo_carrera'],
  semestre: ['semestre_pertenencia', 'semestre'],
  ci: ['ci', 'carnet', 'carnet_de_identidad', 'nro_ci', 'documento', 'cedula'],
  programa: ['programa', 'programa_de_apoyo'],
  n1: ['docente', 'estudiante', 'nombre_completo', 'primer_nombre', 'nombres', 'nombre'], n2: ['segundo_nombre'],
  a1: ['primer_apellido', 'apellidos', 'apellido_paterno'], a2: ['segundo_apellido', 'apellido_materno']
};
// Columnas de las bases de materias.
const COLS_MAT = {
  cod: ['codigo_asignatura', 'cod_asignatura', 'codigo', 'sigla', 'codigo_materia'],
  nombre: ['asignatura', 'materia', 'nombre_asignatura', 'nombre_materia'],
  carrera: ['carrera', 'cod_carrera', 'codigo_carrera'],
  sem: ['sem.', 'sem', 'semestre'],
  plan: COLS_BASE.plan
};
const MAIL_RE = /^[a-z0-9._%+-]+@unifranz\.edu\.bo$/;
const CAB_AGREGADOS = ['Email', 'Docente', 'Sede', 'Carrera', 'Plan de estudios', 'Programa', 'Nota'];
const MAX_PRUEBAS = 5;        // envíos PRUEBA- permitidos a la vez en RESPUESTAS (se limpian con «Borrar filas de prueba»)
const MAX_EST = 80;           // estudiantes por envío
const MAX_MAT = 20;           // materias por estudiante
const MAX_RESULTADOS = 12;    // resultados de la búsqueda de estudiantes

/* ═════════════════════════════ MENÚ ═════════════════════════════ */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Mentorías')
    .addItem('▶ Abrir registro', 'menuAbrir')
    .addItem('■ Cerrar registro', 'menuCerrar')
    .addSeparator()
    .addItem('↻ Actualizar padrón de mentores', 'menuActualizarPadron')
    .addItem('ⓘ Ver estado del registro', 'menuEstado')
    .addItem('Revisar las bases (estudiantes y materias)', 'menuRevisarBases')
    .addSeparator()
    .addItem('Anular un envío completo (por código)…', 'menuAnular')
    .addItem('Anular las filas seleccionadas en RESPUESTAS', 'menuAnularSeleccion')
    .addItem('Restaurar un envío anulado…', 'menuRestaurar')
    .addSeparator()
    .addItem('Excluir a un mentor…', 'menuExcluir')
    .addItem('Reincorporar a un mentor excluido…', 'menuReincorporar')
    .addItem('Agregar mentores a mano (pestaña AGREGADOS)', 'menuIrAgregados')
    .addSeparator()
    .addItem('Iniciar un nuevo periodo…', 'menuNuevoPeriodo')
    .addItem('Reconstruir RESUMEN', 'menuResumen')
    .addItem('Borrar filas de prueba', 'menuBorrarPruebas')
    .addSeparator()
    .addItem('Configuración inicial / reparar pestañas', 'configuracionInicial')
    .addToUi();
}

/* ═════════════════════ CONFIGURACIÓN INICIAL ═════════════════════ */
function configuracionInicial() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(ZONA);
  crearConfig_(); crearCarreras_(); hojaSimple_(H.EXCLUIDOS, ['Correo', 'Motivo', 'Fecha', 'Registrado por']);
  hojaSimple_(H.AGREGADOS, CAB_AGREGADOS);
  hojaResp_(); hojaPapelera_(); hojaSimple_(H.BITACORA, ['Fecha', 'Usuario', 'Acción', 'Detalle']);
  const r = generarPadron_();
  limpiarCache_();
  crearResumen_();
  onOpen();
  bitacora_('Configuración inicial', r.texto);
  aviso_('Configuración lista', r.texto + '\n\nRevisa la pestaña CONFIG y los nombres en CARRERAS. Las celdas amarillas en CARRERAS son códigos nuevos sin nombre.');
}

function crearConfig_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(H.CONFIG);
  const filas = [
    ['Registro activo', 'SÍ', 'SÍ = los mentores pueden registrar sesiones. NO = cerrado.'],
    ['Fecha de apertura', '', 'Opcional. Antes de esta fecha el registro aparece cerrado.'],
    ['Fecha de cierre', '', 'Opcional. Después de esta fecha (incluido el día completo) aparece cerrado.'],
    ['Periodo', 'II-2026', 'Nombre del periodo. Se usa al archivar respuestas en «Nuevo periodo».'],
    ['Hitos habilitados', '2; 3; 4', 'Hitos que el mentor puede elegir, separados por punto y coma. Si dejas uno solo, la app lo usa sin preguntar.'],
    ['Pestañas de docentes', buscarBase_('docente', 'BASEDEDATOSDOC'), 'Pestañas con la base de docentes/mentores (Docente, CI, Sede, Carrera, Email, Plan_estudios), separadas por punto y coma. AGREGADOS se incluye siempre.'],
    ['Pestañas de estudiantes', buscarBase_('primer_nombre', 'BASEDEDATOSEST'), 'Pestañas con la base de estudiantes (sede, carrera, nombres y apellidos, ci, correo_institucional, plan), separadas por punto y coma. Ej.: BASEDEDATOSEST; EST2017'],
    ['Pestañas de materias', buscarBase_('asignatura', 'BASEDEDATOSMATERIAS'), 'Pestañas con la lista de materias (Carrera, Sem., Código asignatura, Asignatura, Plan_estudios), separadas por punto y coma.'],
    ['Planes habilitados', '', 'Planes de los MENTORES que pueden ingresar. Ej.: 2026  ·  2017; 2026  ·  vacío = todos. Estudiantes y materias de cualquier plan se pueden registrar.'],
    ['Sedes habilitadas', '', 'Sedes de los mentores. Códigos: LPZ; EAT; CBB; SCZ  ·  vacío = todas'],
    ['Carreras habilitadas', '', 'Carreras de los mentores. Códigos, ej.: NGE; ICO  ·  vacío = todas'],
    ['Buscar estudiantes de todas las sedes', 'SÍ', 'SÍ = al buscar por nombre, el mentor ve estudiantes de todas las sedes. NO = solo de su sede (por CI los encuentra siempre en cualquier sede).'],
    ['Permitir estudiantes que no están en la base', 'SÍ', 'SÍ = si un estudiante no aparece, el mentor puede registrarlo a mano (CI, nombre y carrera). Esas filas quedan marcadas con «No» en «Estudiante en la base».'],
    ['Mensaje de registro cerrado', 'El registro de sesiones no está disponible en este momento.', 'Texto que ve el mentor cuando está cerrado.']
  ];
  if (!sh) {
    sh = ss.insertSheet(H.CONFIG, 0);
    sh.getRange(1, 1, 1, 3).setValues([['Parámetro', 'Valor', 'Ayuda']]);
    const fh = filas.findIndex(f => f[0] === 'Hitos habilitados');
    sh.getRange(fh + 2, 2).setNumberFormat('@');          // texto: «2; 3; 4» no debe leerse como número
    sh.getRange(2, 1, filas.length, 3).setValues(filas);
  } else {   // agrega solo los parámetros que falten; nunca pisa valores existentes
    const exist = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues().map(r => String(r[0]).trim());
    filas.filter(f => exist.indexOf(f[0]) < 0).forEach(f => sh.appendRow(f));
  }
  sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
  sh.setColumnWidth(1, 270); sh.setColumnWidth(2, 260); sh.setColumnWidth(3, 560);
  sh.setFrozenRows(1);
  ['Registro activo', 'Buscar estudiantes de todas las sedes', 'Permitir estudiantes que no están en la base'].forEach(k => {
    const f = buscarFila_(sh, k);
    if (f) sh.getRange(f, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['SÍ', 'NO'], true).build());
  });
  ['Fecha de apertura', 'Fecha de cierre'].forEach(k => { const f = buscarFila_(sh, k); if (f) sh.getRange(f, 2).setNumberFormat('dd/MM/yyyy'); });
  sh.getRange(2, 2, sh.getLastRow() - 1, 1).setBackground('#fff8e1');
}
// Pestaña `defecto` si existe; si no, la primera (que no sea de trabajo) cuya fila 1 tiene la columna `col`.
function buscarBase_(col, defecto) {
  const ss = SpreadsheetApp.getActive();
  if (ss.getSheetByName(defecto)) return defecto;
  const propias = Object.keys(H).map(k => H[k]);
  const sh = ss.getSheets().find(s => {
    if (propias.indexOf(s.getName()) >= 0 || s.getName().indexOf('RESPUESTAS') === 0 || s.getLastColumn() < 1) return false;
    return cab_(s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0]).indexOf(col) >= 0;
  });
  return sh ? sh.getName() : defecto;
}

function crearCarreras_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(H.CARRERAS);
  if (!sh) {
    sh = ss.insertSheet(H.CARRERAS);
    sh.getRange(1, 1, 1, 2).setValues([['Código', 'Nombre que ve el mentor']]);
    sh.getRange(2, 1, CARRERAS_SUGERIDAS.length, 2).setValues(CARRERAS_SUGERIDAS);
  }
  sh.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
  sh.setColumnWidth(1, 110); sh.setColumnWidth(2, 360); sh.setFrozenRows(1);
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
  const sh = SpreadsheetApp.getActive().getSheetByName(H.CONFIG);
  const c = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => { c[String(r[0]).trim()] = r[1]; });
  const lista = v => String(v || '').split(/[,;\n]/).map(x => norm_(x)).filter(String);
  const pestanas = (v, d) => String(v || d).split(/[,;\n]/).map(x => x.trim()).filter(String);
  const si = (v, d) => /^s/i.test(String(v === undefined || v === '' ? d : v).trim());
  return {
    activa: si(c['Registro activo'], 'SÍ'),
    apertura: c['Fecha de apertura'] instanceof Date ? c['Fecha de apertura'] : null,
    cierre: c['Fecha de cierre'] instanceof Date ? c['Fecha de cierre'] : null,
    periodo: String(c['Periodo'] || '').trim(),
    hitos: String(c['Hitos habilitados'] === undefined ? '2;3;4' : c['Hitos habilitados']).split(/[;\n]/).map(x => x.trim()).filter(String),
    docentes: pestanas(c['Pestañas de docentes'], 'BASEDEDATOSDOC'),
    estudiantes: pestanas(c['Pestañas de estudiantes'], 'BASEDEDATOSEST'),
    materias: pestanas(c['Pestañas de materias'], 'BASEDEDATOSMATERIAS'),
    planes: lista(c['Planes habilitados']), sedes: lista(c['Sedes habilitadas']), carreras: lista(c['Carreras habilitadas']),
    todasSedes: si(c['Buscar estudiantes de todas las sedes'], 'SÍ'),
    manual: si(c['Permitir estudiantes que no están en la base'], 'SÍ'),
    mensaje: String(c['Mensaje de registro cerrado'] || 'El registro de sesiones no está disponible en este momento.')
  };
}
function setConfig_(clave, valor) {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.CONFIG);
  const f = buscarFila_(sh, clave);
  if (f) sh.getRange(f, 2).setValue(valor);
}
function abierta_(cfg) {
  if (!cfg.activa) return false;
  const hoy = new Date();
  if (cfg.apertura && hoy < cfg.apertura) return false;
  if (cfg.cierre) { const fin = new Date(cfg.cierre); fin.setHours(23, 59, 59, 999); if (hoy > fin) return false; }
  return true;
}
function nombresCarreras_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.CARRERAS), m = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => {
    const k = String(r[0]).trim().toUpperCase(); if (k) m[k] = String(r[1] || '').trim() || k;
  });
  return m;
}

/* ═════════════════════════ BASES DE PERSONAS ═════════════════════════ */
const titulo_ = s => String(s || '').toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());
const cab_ = fila => fila.map(h => norm_(h).replace(/\s+/g, '_'));
const indices_ = (cab, cols) => { const idx = {}; Object.keys(cols).forEach(k => { idx[k] = cab.findIndex(h => cols[k].indexOf(h) >= 0); }); return idx; };

function persona_(r, idx, origen) {
  const val = k => idx[k] >= 0 ? String(r[idx[k]] === null || r[idx[k]] === undefined ? '' : r[idx[k]]).trim() : '';
  return {
    correo: val('correo').toLowerCase().replace(/\s+/g, ''), ci: val('ci').replace(/\s+/g, ' '),
    sede: val('sede').toUpperCase(), modalidad: val('modalidad').toUpperCase(), plan: val('plan'),
    carrera: val('carrera').toUpperCase(), semestre: val('semestre'), programa: val('programa'),
    n1: val('n1'), n2: val('n2'), a1: val('a1'), a2: val('a2'), origen: origen
  };
}
function leerBase_(sh, req) {
  const datos = sh.getDataRange().getValues();
  if (datos.length < 2) return { filas: [], error: null };
  const idx = indices_(cab_(datos[0]), COLS_BASE);
  const faltan = (req || ['correo', 'carrera']).filter(k => idx[k] < 0);
  if (faltan.length) return { filas: [], error: 'En «' + sh.getName() + '» no encuentro la columna: ' + faltan.join(', ') };
  return { error: null, filas: datos.slice(1).map(r => persona_(r, idx, sh.getName())) };
}
const nombreCompleto_ = e => [e.n1, e.n2, e.a1, e.a2].filter(String).map(titulo_).join(' ').replace(/\s+/g, ' ');

/* ═════════════════════════ PADRÓN DE MENTORES ═════════════════════════ */
const CAB_PADRON = ['Correo', 'Nombre completo', 'Primer nombre', 'Cód. sede', 'Sede', 'Cód. carrera', 'Carrera', 'Plan', 'Programa', 'Pestaña de origen', 'Registros', 'Estado'];
const N_FORMULAS_PADRON = 2;   // las dos últimas columnas son fórmulas vivas

function cumple_(e, cfg) {
  const ok = (lista, v) => !lista.length || lista.indexOf(norm_(v)) >= 0;
  return ok(cfg.planes, e.plan) && ok(cfg.sedes, e.sede) && ok(cfg.carreras, e.carrera);
}
function excluidos_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.EXCLUIDOS), s = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(r => { const c = String(r[0]).trim().toLowerCase(); if (c) s[c] = true; });
  return s;
}
function programa_(e) {
  const p = norm_(e.programa);
  if (p.indexOf('hermano') >= 0) return PROGRAMAS[1];
  if (p.indexOf('docente') >= 0 || p.indexOf('tutor') >= 0) return PROGRAMAS[0];
  return e.correo.indexOf('est.') === 0 ? PROGRAMAS[1] : PROGRAMAS[0];
}
function filaPadron_(e, nombres) {
  return [e.correo, nombreCompleto_(e), titulo_(String(e.n1).split(/\s+/)[0]), e.sede, SEDES[e.sede] || e.sede, e.carrera, nombres[e.carrera] || e.carrera,
    Number(e.plan) || e.plan, programa_(e), e.origen];
}

function generarPadron_() {
  const ss = SpreadsheetApp.getActive(), cfg = config_(), nombres = nombresCarreras_(), exc = excluidos_();
  const errores = [], vistos = {}, salida = [], codigos = {};
  let leidos = 0, fueraFiltro = 0, nExcl = 0, dup = 0;
  cfg.docentes.concat([H.AGREGADOS]).forEach(nombre => {
    const sh = ss.getSheetByName(nombre);
    if (!sh) { if (nombre !== H.AGREGADOS) errores.push('No existe la pestaña de docentes «' + nombre + '»'); return; }
    const b = leerBase_(sh);
    if (b.error) { errores.push(b.error); return; }
    b.filas.filter(e => e.correo).forEach(e => {
      leidos++;
      const manual = nombre === H.AGREGADOS;          // los agregados a mano no pasan por los filtros
      if (!manual && !cumple_(e, cfg)) { fueraFiltro++; return; }
      if (exc[e.correo]) { nExcl++; return; }
      if (vistos[e.correo]) { dup++; return; }
      vistos[e.correo] = true; codigos[e.carrera] = true;
      salida.push(filaPadron_(e, nombres));
    });
  });
  // los códigos de carrera de estudiantes y materias también se registran en CARRERAS
  let nEst = 0;
  cfg.estudiantes.forEach(n => {
    const sh = ss.getSheetByName(n);
    if (!sh) return errores.push('No existe la pestaña de estudiantes «' + n + '»');
    const b = leerBase_(sh, ['carrera']);
    if (b.error) return errores.push(b.error);
    b.filas.forEach(e => { codigos[e.carrera] = true; nEst++; });
  });
  const mats = leerMaterias_(cfg);
  errores.push.apply(errores, mats.errores);
  mats.lista.forEach(m => { codigos[m[2]] = true; });
  const shC = ss.getSheetByName(H.CARRERAS) || (crearCarreras_(), ss.getSheetByName(H.CARRERAS));
  const nuevos = Object.keys(codigos).filter(k => k && !nombres[k]).sort();
  nuevos.forEach(k => { shC.appendRow([k, '']); shC.getRange(shC.getLastRow(), 1, 1, 2).setBackground('#fff59d'); });

  let sh = ss.getSheetByName(H.PADRON);
  if (!sh) sh = ss.insertSheet(H.PADRON);
  sh.clear();
  sepFormulas_(sh);
  sh.getRange(1, 1, 1, CAB_PADRON.length).setValues([CAB_PADRON]).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
  salida.sort((x, y) => (x[3] + x[6] + x[1]).localeCompare(y[3] + y[6] + y[1], 'es'));
  if (salida.length) { sh.getRange(2, 1, salida.length, salida[0].length).setValues(salida); ponerFormulasPadron_(sh, salida.length); }
  sh.setFrozenRows(1); sh.setColumnWidth(1, 300); sh.setColumnWidth(2, 260);

  const texto = 'Padrón: ' + salida.length + ' mentores habilitados.\n' +
    'Filas leídas: ' + leidos + ' · fuera de los filtros: ' + fueraFiltro + ' · excluidos: ' + nExcl + ' · correos repetidos: ' + dup + '.\n' +
    'Estudiantes en las bases: ' + nEst + ' · materias: ' + mats.lista.length + '.' +
    (nuevos.length ? '\nCódigos de carrera nuevos sin nombre: ' + nuevos.join(', ') + ' (complétalos en CARRERAS).' : '') +
    (errores.length ? '\n\n⚠ ' + errores.join('\n⚠ ') : '');
  return { n: salida.length, texto: texto };
}
// «Registros» (filas en RESPUESTAS) y «Estado» vivos. La fórmula cubre exactamente las filas escritas,
// para no inflar getLastRow() con celdas vacías de un ARRAYFORMULA abierto.
function refCorreoResp_() { const c = colLetra_(cabResp_().indexOf('Correo del mentor') + 1); return H.RESP + '!$' + c + '$2:$' + c; }
const NO_PRUEBA_ = () => ',' + H.RESP + '!$B$2:$B,"<>PRUEBA-*"';   // las filas de prueba no cuentan como registros
function ponerFormulasPadron_(sh, n) {
  const k = CAB_PADRON.length - 1, kl = colLetra_(k);
  sh.getRange(2, k).setFormula(fx_('=ARRAYFORMULA(COUNTIFS(' + refCorreoResp_() + ',A2:A' + (n + 1) + NO_PRUEBA_() + '))'));
  sh.getRange(2, k + 1).setFormula(fx_('=ARRAYFORMULA(IF(' + kl + '2:' + kl + (n + 1) + '>0,"Con registros","Sin registros"))'));
}
function formulasPadronFila_(sh, r) {
  const k = CAB_PADRON.length - 1, kl = colLetra_(k);
  sh.getRange(r, k).setFormula(fx_('=COUNTIFS(' + refCorreoResp_() + ',A' + r + NO_PRUEBA_() + ')'));
  sh.getRange(r, k + 1).setFormula(fx_('=IF(' + kl + r + '>0,"Con registros","Sin registros")'));
}

// Busca un correo en el padrón; si no está, lo busca en vivo en las bases (por si la base se actualizó).
function buscarMentor_(correo, cfg) {
  const ss = SpreadsheetApp.getActive();
  if (!MAIL_RE.test(correo)) return { motivo: 'no_encontrado' };
  if (excluidos_()[correo]) return { motivo: 'no_encontrado' };
  const n = CAB_PADRON.length - N_FORMULAS_PADRON;
  const sh = ss.getSheetByName(H.PADRON);
  if (sh && sh.getLastRow() > 1) {
    const f = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(correo).matchEntireCell(true).findNext();
    if (f) return { fila: sh.getRange(f.getRow(), 1, 1, n).getValues()[0] };
  }
  let fuera = false;
  const nombres = nombresCarreras_();
  const hojas = cfg.docentes.concat([H.AGREGADOS]);
  for (let i = 0; i < hojas.length; i++) {
    const b = ss.getSheetByName(hojas[i]);
    if (!b || b.getLastRow() < 2) continue;
    const f = b.createTextFinder(correo).matchEntireCell(true).findNext();
    if (!f) continue;
    const cab = cab_(b.getRange(1, 1, 1, b.getLastColumn()).getValues()[0]);
    const base = persona_(b.getRange(f.getRow(), 1, 1, b.getLastColumn()).getValues()[0], indices_(cab, COLS_BASE), b.getName());
    if (base.correo !== correo) continue;
    if (hojas[i] !== H.AGREGADOS && !cumple_(base, cfg)) { fuera = true; continue; }
    const fila = filaPadron_(base, nombres);
    if (sh) { sh.appendRow(fila); formulasPadronFila_(sh, sh.getLastRow()); }
    return { fila: fila };
  }
  return { motivo: fuera ? 'no_habilitado' : 'no_encontrado' };
}
const perfilMentor_ = (f, nombres) => ({ nombre: f[2], nombre_completo: f[1], sede: f[3], sede_nombre: f[4], carrera_cod: f[5], carrera: nombres[f[5]] || f[6], plan: f[7], programa: f[8] || PROGRAMAS[0] });

/* ═════════════════════════ ESTUDIANTES ═════════════════════════ */
// Lee todas las pestañas de estudiantes. Nunca se envía completa a la app: solo resultados de búsqueda.
function leerEstudiantes_(cfg) {
  const ss = SpreadsheetApp.getActive(), out = [], vistos = {};
  cfg.estudiantes.forEach(n => {
    const sh = ss.getSheetByName(n);
    if (!sh) return;
    const b = leerBase_(sh, ['carrera']);
    if (b.error) return;
    b.filas.forEach(e => {
      const clave = e.correo || (e.ci ? 'ci:' + ciNorm_(e.ci) : '');
      if (!clave || vistos[clave]) return;
      vistos[clave] = true;
      e.clave = clave; e.nombre = nombreCompleto_(e);
      out.push(e);
    });
  });
  return out;
}
const ciNorm_ = s => String(s || '').toLowerCase().replace(/[^0-9a-z]/g, '');
const ciMask_ = s => { const d = String(s || '').replace(/\D/g, ''); return d ? '•••' + d.slice(-3) : ''; };
function estPublico_(e, nombres) {
  return { id: e.clave, nombre: e.nombre, ci: ciMask_(e.ci), sede: e.sede, sede_nombre: SEDES[e.sede] || e.sede, carrera_cod: e.carrera, carrera: nombres[e.carrera] || e.carrera, plan: Number(e.plan) || e.plan };
}
// Por CI (solo dígitos, ≥ 5): coincidencia exacta en cualquier sede. Por nombre: cada palabra
// escrita debe ser el comienzo de una palabra del nombre (ej.: «ana rojas», «rojas v»).
function buscarEstudiantes_(q, mentor, cfg) {
  const qn = norm_(q).replace(/\s+/g, ' ').trim(), digitos = qn.replace(/\D/g, '');
  const todos = indiceEst_(cfg), nombres = nombresCarreras_();
  let res;
  if (digitos.length >= 5 && digitos.length >= qn.replace(/\s/g, '').length - 3) {
    res = todos.filter(e => e.ci && ciNorm_(e.ci).replace(/\D/g, '') === digitos);
  } else {
    const toks = qn.split(' ').filter(String);
    if (qn.replace(/\s/g, '').length < 3) return { ok: true, resultados: [], corto: true };
    res = todos.filter(e => {
      if (!cfg.todasSedes && mentor.sede && e.sede && e.sede !== mentor.sede) return false;
      const pals = norm_(e.nombre).split(/\s+/);
      return toks.every(t => pals.some(p => p.indexOf(t) === 0));
    });
  }
  res.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { ok: true, resultados: res.slice(0, MAX_RESULTADOS).map(e => estPublico_(e, nombres)), mas: res.length > MAX_RESULTADOS, total: res.length };
}

/* ═════════════════════════ MATERIAS ═════════════════════════ */
// Devuelve [cod, nombre, carrera, semestre, plan] sin repetidos (cod + carrera + plan).
function leerMaterias_(cfg) {
  const ss = SpreadsheetApp.getActive(), lista = [], errores = [], vistos = {};
  cfg.materias.forEach(n => {
    const sh = ss.getSheetByName(n);
    if (!sh) { errores.push('No existe la pestaña de materias «' + n + '»'); return; }
    const datos = sh.getDataRange().getValues();
    if (datos.length < 2) return;
    const idx = indices_(cab_(datos[0]), COLS_MAT);
    const faltan = ['cod', 'nombre', 'carrera'].filter(k => idx[k] < 0);
    if (faltan.length) { errores.push('En «' + n + '» no encuentro la columna: ' + faltan.join(', ')); return; }
    const val = (r, k) => idx[k] >= 0 ? String(r[idx[k]] === null || r[idx[k]] === undefined ? '' : r[idx[k]]).trim() : '';
    datos.slice(1).forEach(r => {
      const cod = val(r, 'cod').replace(/\s+/g, ' ').toUpperCase(), nom = val(r, 'nombre').replace(/\s+/g, ' '), car = val(r, 'carrera').toUpperCase();
      if (!cod || !nom || !car) return;
      const semN = Number(val(r, 'sem')), sem = semN >= 1 && semN <= 14 && Math.round(semN) === semN ? semN : '';
      const plan = Number(val(r, 'plan')) || val(r, 'plan');
      const k = cod + '|' + car + '|' + plan;
      if (vistos[k]) return;
      vistos[k] = true;
      lista.push([cod, nom, car, sem, plan]);
    });
  });
  return { lista: lista, errores: errores };
}
// Listas que se guardan en la caché del script, en trozos (límite de 100 KB por clave). Una lista
// vacía no se guarda: así, si una base estaba vacía, basta con llenarla para que se lea de nuevo.
const CACHES = { mat: 600, est: 3600 };   // segundos que dura cada lista
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
    if (lista.length && n <= 60) {
      for (let i = 0; i < n; i++) o[pref + '_' + i] = s.slice(i * T, (i + 1) * T);
      o[pref + '_n'] = String(n);
      cache.putAll(o, CACHES[pref]);
    }
  } catch (e) {}
  return lista;
}
// Catálogo de materias para la app (sin datos personales).
function catalogoMaterias_(cfg) { return cacheLista_('mat', () => leerMaterias_(cfg).lista); }
// Índice de estudiantes para buscar rápido: [clave, nombre, ci, sede, carrera, plan, correo]. Sin celulares.
// Nunca sale entero de la hoja: la app solo recibe resultados de búsqueda.
function indiceEst_(cfg) {
  return cacheLista_('est', () => leerEstudiantes_(cfg).map(e => [e.clave, e.nombre, e.ci, e.sede, e.carrera, e.plan, e.correo]))
    .map(r => ({ clave: r[0], nombre: r[1], ci: r[2], sede: r[3], carrera: r[4], plan: r[5], correo: r[6] }));
}
function limpiarCache_() {
  const cache = CacheService.getScriptCache();
  Object.keys(CACHES).forEach(p => {
    try { const n = Number(cache.get(p + '_n')) || 0; cache.removeAll([p + '_n'].concat(Array.from({ length: n }, (_, i) => p + '_' + i))); } catch (e) {}
  });
}

/* ═════════════════════════ RESPUESTAS ═════════════════════════ */
function cabResp_() {
  return [
    'Marca temporal', 'ID envío', 'Correo del mentor', 'Mentor', 'Programa de apoyo', 'Sede del mentor', 'Carrera del mentor', 'Hito',
    'CI del estudiante', 'Estudiante', 'Correo del estudiante', 'Sede del estudiante', 'Cód. carrera del estudiante', 'Carrera del estudiante', 'Plan del estudiante',
    'Estudiante en la base', 'Cód. asignatura', 'Asignatura', 'Semestre de la asignatura', 'Asistió',
    'Fecha de la sesión', 'Hora de inicio', 'Hora de conclusión', 'Duración de la sesión (min)', 'Materias en la sesión', 'Horas imputadas a esta materia',
    'Actividad(es) realizada(s)', 'Observaciones y comentarios', 'Posible duplicado',
    'Periodo', 'Dispositivo', 'Fecha y hora local (dispositivo)', 'Versión app'
  ];
}
function hojaResp_(nombre) {
  const ss = SpreadsheetApp.getActive(), C = cabResp_();
  nombre = nombre || H.RESP;
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, C.length).setValues([C]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#3a3a3a').setWrap(true).setVerticalAlignment('middle');
    sh.setFrozenRows(1); sh.setFrozenColumns(4); sh.setRowHeight(1, 48);
    sh.setColumnWidths(1, C.length, 130); sh.setColumnWidth(3, 260); sh.setColumnWidth(4, 220); sh.setColumnWidth(10, 220); sh.setColumnWidth(18, 260); sh.setColumnWidth(27, 320);
    sh.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm:ss');
    const fs = C.indexOf('Fecha de la sesión') + 1, hi = C.indexOf('Hora de inicio') + 1;
    sh.getRange(2, fs, sh.getMaxRows() - 1, 1).setNumberFormat('dd/MM/yyyy');
    sh.getRange(2, hi, sh.getMaxRows() - 1, 2).setNumberFormat('@');    // «14:30» queda como texto
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
  if (!sh) { sh = ss.insertSheet(H.PAPELERA); sh.getRange(1, 1, 1, C.length).setValues([C]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#7a3b3b').setWrap(true); sh.setFrozenRows(1); }
  return sh;
}
// Filas (número y valores) de RESPUESTAS que pertenecen a un envío.
function filasDeEnvio_(id, sh) {
  sh = sh || SpreadsheetApp.getActive().getSheetByName(H.RESP);
  if (!sh || sh.getLastRow() < 2 || !id) return [];
  const ids = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues(), out = [];
  ids.forEach((r, i) => { if (String(r[0]).trim().toUpperCase() === id) out.push(i + 2); });
  return out.map(n => ({ fila: n, valores: sh.getRange(n, 1, 1, cabResp_().length).getValues()[0] }));
}
// Estudiantes distintos que el mentor ya registró, por hito (para mostrárselo en la app).
function registrosPorHito_(correo) {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.RESP), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  const C = cabResp_(), cC = C.indexOf('Correo del mentor'), cH = C.indexOf('Hito'), cI = C.indexOf('CI del estudiante'), cN = C.indexOf('Estudiante'), vistos = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, cN + 1).getValues().forEach(r => {
    if (String(r[cC]).toLowerCase() !== correo || String(r[1]).indexOf('PRUEBA-') === 0) return;
    const h = String(r[cH]), k = h + '|' + (r[cI] || r[cN]);
    if (vistos[k]) return; vistos[k] = true;
    out[h] = (out[h] || 0) + 1;
  });
  return out;
}
const fmtFecha_ = d => d instanceof Date ? Utilities.formatDate(d, ZONA, 'dd/MM/yyyy') : String(d || '');

/* ═════════════════════════ WEB APP ═════════════════════════ */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const accion = p.action || 'ping';
  let out;
  try {
    if (accion === 'ping') {
      const sh = SpreadsheetApp.getActive().getSheetByName(H.RESP), cfg = config_();
      out = { ok: true, servicio: 'registro-mentorias-2026', version_app: VERSION_APP, abierta: abierta_(cfg), periodo: cfg.periodo, hitos: cfg.hitos, respuestas: sh ? Math.max(0, sh.getLastRow() - 1) : 0 };
    } else if (accion === 'validar') out = validar_(p.correo);
    else if (accion === 'buscar') out = buscar_(p.correo, p.q);
    else if (accion === 'verificar') out = { ok: true, id: p.id || '', existe: existeId_(String(p.id || '').toUpperCase()) };
    else if (accion === 'guardar') out = guardar_(JSON.parse(p.data || '{}'));
    else out = { ok: false, error: 'Acción desconocida' };
  } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return responder_(out, p.callback);
}
function doPost(e) {
  let out;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = guardar_(body.data || body);
  } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return responder_(out);
}
function responder_(obj, cb) {
  const json = JSON.stringify(obj);
  if (cb && /^[A-Za-z_$][\w$]{0,80}$/.test(cb)) return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function validar_(correoIn) {
  const cfg = config_();
  if (!abierta_(cfg)) return { ok: true, habilitado: false, motivo: 'cerrada', mensaje: cfg.mensaje };
  const correo = String(correoIn || '').trim().toLowerCase();
  const r = buscarMentor_(correo, cfg);
  if (!r.fila) return { ok: true, habilitado: false, motivo: r.motivo };
  const nombres = nombresCarreras_();
  return {
    ok: true, habilitado: true, mentor: perfilMentor_(r.fila, nombres),
    hitos: cfg.hitos, manual: cfg.manual, todas_sedes: cfg.todasSedes, periodo: cfg.periodo,
    previos: registrosPorHito_(correo),
    carreras: Object.keys(nombres).map(k => ({ cod: k, nombre: nombres[k] })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    materias: catalogoMaterias_(cfg)
  };
}
function buscar_(correoIn, q) {
  const cfg = config_();
  if (!abierta_(cfg)) return { ok: false, motivo: 'cerrada', mensaje: cfg.mensaje };
  const correo = String(correoIn || '').trim().toLowerCase();
  const r = buscarMentor_(correo, cfg);
  if (!r.fila) return { ok: false, motivo: r.motivo };
  return buscarEstudiantes_(String(q || '').slice(0, 80), { sede: r.fila[3] }, cfg);
}

// Un envío = varios estudiantes, cada uno con varias materias. Todo se valida en el servidor:
// el mentor contra el padrón, los estudiantes contra su base y las materias contra la suya.
function guardar_(d) {
  if (!d || typeof d !== 'object') throw new Error('Datos vacíos');
  const id = txt_(d.id, 60).toUpperCase();
  if (!/^(ME|PRUEBA)-[A-Z0-9-]{4,40}$/.test(id)) throw new Error('ID inválido');
  const prueba = id.indexOf('PRUEBA-') === 0;
  const correo = String(d.correo || '').trim().toLowerCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const sh = hojaResp_();
    if (existeId_(id, sh)) return { ok: true, id: id, duplicado: true };
    const cfg = config_();
    let mentor;
    if (prueba) {     // los envíos PRUEBA- no validan al mentor: se limitan para que nadie pueda llenar la hoja con ellos
      const ids = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues() : [], vistos = {};
      ids.forEach(r => { const s = String(r[0]); if (s.indexOf('PRUEBA-') === 0) vistos[s] = true; });
      if (Object.keys(vistos).length >= MAX_PRUEBAS) return { ok: false, codigo: 'limite_pruebas' };
      mentor = [correo, 'PRUEBA', 'Prueba', 'CBB', 'Cochabamba', '', '', '', PROGRAMAS[0]];
    } else {
      if (!abierta_(cfg)) return { ok: false, codigo: 'cerrada' };
      const r = buscarMentor_(correo, cfg);
      if (!r.fila) return { ok: false, codigo: r.motivo };
      mentor = r.fila;
    }
    const v = validarEnvio_(d, cfg, prueba);
    if (v.error) return { ok: false, codigo: 'datos_invalidos', detalle: v.error };
    const filas = [], dupes = clavesExistentes_(sh), ahora = new Date();
    const extra = [cfg.periodo, d.movil ? 'Móvil' : 'Computadora', txt_(d.fecha_local, 40), txt_(d.version, 10)];
    let nDup = 0;
    v.items.forEach(it => {
      const n = it.materias.length, dur = it.dur;
      it.materias.forEach(m => {
        const clave = [correo, ciNorm_(it.est.ci) || norm_(it.est.nombre), m.cod, String(v.hito), it.fecha ? fmtFecha_(it.fecha) : ''].join('|');
        const dup = !!dupes[clave]; if (dup) nDup++; dupes[clave] = true;
        filas.push([ahora, id, correo, mentor[1], mentor[8] || PROGRAMAS[0], mentor[3], mentor[5], v.hito,
          it.est.ci, it.est.nombre, it.est.correo, it.est.sede, it.est.carrera, it.est.carrera_nombre, it.est.plan,
          it.est.enBase ? 'Sí' : 'No', m.cod, m.nombre, m.sem, it.asistio,
          it.fecha || '', it.hi, it.hf, dur, it.asistio === 'Sí' ? n : '', dur === '' ? '' : Math.round(dur / 60 / n * 10000) / 10000,
          it.act, it.obs, dup ? 'Sí' : ''].concat(extra));
      });
    });
    sh.getRange(sh.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
    return { ok: true, id: id, filas: filas.length, estudiantes: v.items.length, duplicados: nDup };
  } finally { lock.releaseLock(); }
}
function clavesExistentes_(sh) {
  const out = {};
  if (sh.getLastRow() < 2) return out;
  const C = cabResp_(), c = k => C.indexOf(k);
  sh.getRange(2, 1, sh.getLastRow() - 1, C.length).getValues().forEach(r => {
    out[[String(r[c('Correo del mentor')]).toLowerCase(), ciNorm_(r[c('CI del estudiante')]) || norm_(r[c('Estudiante')]), String(r[c('Cód. asignatura')]).toUpperCase(),
      String(r[c('Hito')]), r[c('Fecha de la sesión')] ? fmtFecha_(r[c('Fecha de la sesión')]) : ''].join('|')] = true;
  });
  return out;
}
function validarEnvio_(d, cfg, prueba) {
  const hito = String(d.hito === undefined || d.hito === null ? '' : d.hito).trim();
  if (!hito || (!prueba && cfg.hitos.length && cfg.hitos.indexOf(hito) < 0)) return { error: 'Hito no habilitado: ' + hito };
  const items = Array.isArray(d.items) ? d.items : [];
  if (!items.length || items.length > MAX_EST) return { error: 'Cantidad de estudiantes inválida' };
  const nombres = nombresCarreras_();
  const ests = {}; indiceEst_(cfg).forEach(e => { ests[e.clave] = e; });
  const cat = {}, porCod = {}; catalogoMaterias_(cfg).forEach(m => { cat[m[0] + '|' + m[2]] = m; if (!porCod[m[0]]) porCod[m[0]] = m; });
  const hoy = new Date(), out = [], usados = {};
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {}, n = 'Estudiante ' + (i + 1) + ': ';
    // estudiante
    let est;
    const e = ests[String(it.est || '').toLowerCase()];
    if (e) est = { ci: e.ci, nombre: e.nombre, correo: e.correo, sede: e.sede, carrera: e.carrera, carrera_nombre: nombres[e.carrera] || e.carrera, plan: Number(e.plan) || e.plan, enBase: true };
    else if (it.manual && (cfg.manual || prueba)) {
      const m = it.manual, ci = txt_(m.ci, 20), nom = titulo_(txt_(m.nombre, 120)), car = String(m.carrera_cod || '').trim().toUpperCase().slice(0, 10);
      if (!ci || ciNorm_(ci).length < 4 || nom.split(/\s+/).length < 2) return { error: n + 'faltan el CI o el nombre completo' };
      est = { ci: ci, nombre: nom, correo: '', sede: String(m.sede || '').toUpperCase().slice(0, 5), carrera: car, carrera_nombre: nombres[car] || car, plan: Number(m.plan) || '', enBase: false };
    } else return { error: n + 'no se encontró en la base' };
    const kEst = ciNorm_(est.ci) || norm_(est.nombre);
    if (usados[kEst]) return { error: n + 'está repetido en el envío' };
    usados[kEst] = true;
    // materias
    const mats = Array.isArray(it.materias) ? it.materias : [], vistas = {}, materias = [];
    if (!mats.length || mats.length > MAX_MAT) return { error: n + 'cantidad de materias inválida' };
    for (let j = 0; j < mats.length; j++) {
      const mj = mats[j] || {}, cod = String(mj.cod || '').replace(/\s+/g, ' ').trim().toUpperCase(), car = String(mj.car || '').toUpperCase();
      const m = cat[cod + '|' + car] || cat[cod + '|' + est.carrera] || porCod[cod];
      if (!m) { if (prueba) { materias.push({ cod: txt_(cod, 30), nombre: txt_(mj.nombre, 150), sem: '' }); continue; } return { error: n + 'materia desconocida ' + cod }; }
      if (vistas[m[0]]) continue;
      vistas[m[0]] = true;
      materias.push({ cod: m[0], nombre: m[1], sem: m[3] });
    }
    // asistencia y sesión
    const asistio = siNo_(it.asistio);
    if (!asistio) return { error: n + 'falta indicar si asistió' };
    const r = { est: est, materias: materias, asistio: asistio, fecha: '', hi: '', hf: '', dur: '', act: '', obs: '' };
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
  return { hito: /^\d+$/.test(hito) ? Number(hito) : hito, items: out };
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
function menuAbrir() { setConfig_('Registro activo', 'SÍ'); bitacora_('Abrir registro', ''); aviso_('Registro abierto', 'Los mentores ya pueden registrar sesiones.' + avisoFechas_()); }
function menuCerrar() { setConfig_('Registro activo', 'NO'); bitacora_('Cerrar registro', ''); aviso_('Registro cerrado', 'Nadie puede registrar sesiones hasta que lo abras de nuevo.'); }
function avisoFechas_() { const c = config_(); return (c.apertura || c.cierre) ? '\n(Recuerda que también rigen las fechas de CONFIG.)' : ''; }

function menuActualizarPadron() {
  const r = generarPadron_();
  limpiarCache_();
  bitacora_('Actualizar padrón', r.texto);
  aviso_('Padrón actualizado', r.texto);
}
function menuEstado() {
  const ss = SpreadsheetApp.getActive(), cfg = config_();
  const pad = ss.getSheetByName(H.PADRON), resp = ss.getSheetByName(H.RESP);
  const nPad = pad ? Math.max(0, pad.getLastRow() - 1) : 0;
  let nFilas = 0; const envios = {}, mentores = {};
  if (resp && resp.getLastRow() > 1) resp.getRange(2, 2, resp.getLastRow() - 1, 2).getValues().forEach(r => {
    if (!r[0] || String(r[0]).indexOf('PRUEBA-') === 0) return;
    nFilas++; envios[r[0]] = true; mentores[String(r[1]).toLowerCase()] = true;
  });
  const nM = Object.keys(mentores).length;
  aviso_('Estado del registro',
    'Estado: ' + (abierta_(cfg) ? 'ABIERTO' : 'CERRADO') + '\nPeriodo: ' + cfg.periodo + ' · Hitos habilitados: ' + (cfg.hitos.join(', ') || 'todos') +
    '\nFiltros de mentores → planes: ' + (cfg.planes.join(', ') || 'todos') + ' · sedes: ' + (cfg.sedes.join(', ').toUpperCase() || 'todas') +
    ' · carreras: ' + (cfg.carreras.join(', ').toUpperCase() || 'todas') +
    '\nBases → docentes: ' + cfg.docentes.join(', ') + ' · estudiantes: ' + cfg.estudiantes.join(', ') + ' · materias: ' + cfg.materias.join(', ') +
    '\n\nMentores en el padrón: ' + nPad + '\nMentores que ya registraron: ' + nM + (nPad ? ' (' + Math.round(nM / nPad * 100) + '%)' : '') +
    '\nEnvíos recibidos: ' + Object.keys(envios).length + ' · filas (estudiante × materia): ' + nFilas);
}
// Diagnóstico de las bases de estudiantes y materias (no modifica nada).
function menuRevisarBases() {
  const ss = SpreadsheetApp.getActive(), cfg = config_(), nombres = nombresCarreras_(), L = [];
  cfg.estudiantes.forEach(n => {
    const sh = ss.getSheetByName(n);
    if (!sh) return L.push('⚠ Estudiantes: no existe la pestaña «' + n + '».');
    const b = leerBase_(sh, ['carrera']);
    if (b.error) return L.push('⚠ ' + b.error);
    const ci = {}, co = {}; let dCi = 0, dCo = 0, sinCi = 0, sinCo = 0;
    b.filas.forEach(e => { const c = ciNorm_(e.ci); if (!c) sinCi++; else if (ci[c]) dCi++; else ci[c] = 1; if (!e.correo) sinCo++; else if (co[e.correo]) dCo++; else co[e.correo] = 1; });
    L.push('Estudiantes «' + n + '»: ' + b.filas.length + ' filas · sin CI: ' + sinCi + ' · CI repetidos: ' + dCi + ' · sin correo: ' + sinCo + ' · correos repetidos: ' + dCo);
  });
  const ms = leerMaterias_(cfg);
  ms.errores.forEach(e => L.push('⚠ ' + e));
  const sinSem = ms.lista.filter(m => m[3] === '').length, cars = {};
  ms.lista.forEach(m => { cars[m[2]] = (cars[m[2]] || 0) + 1; });
  L.push('Materias: ' + ms.lista.length + ' (por carrera: ' + Object.keys(cars).sort().map(k => k + ' ' + cars[k]).join(', ') + ')');
  if (sinSem) L.push('⚠ ' + sinSem + ' materias con el semestre vacío o mal escrito (ej.: una fecha). Aparecen igual, en «Sin semestre».');
  const sinNombre = Object.keys(cars).filter(k => !nombres[k]);
  if (sinNombre.length) L.push('⚠ Códigos de carrera sin nombre en CARRERAS: ' + sinNombre.join(', ') + ' (usa «Actualizar padrón» para agregarlos).');
  limpiarCache_();
  aviso_('Revisión de las bases', L.join('\n'));
}

// Anular = mover filas a PAPELERA (nada se pierde).
function moverAPapelera_(sh, filas, motivo) {
  const pap = hojaPapelera_(), quien = usuario_(), ahora = new Date();
  filas.slice().sort((a, b) => b.fila - a.fila).forEach(f => { pap.appendRow([ahora, quien, motivo || '(sin motivo)'].concat(f.valores)); sh.deleteRow(f.fila); });
}
const idEnvio_ = s => { const id = String(s || '').toUpperCase().replace(/\s+/g, ''); return /^(ME|PRUEBA)-/.test(id) ? id : 'ME-' + id; };   // el mentor ve el código sin «ME-»
function menuAnular() {
  const ui = SpreadsheetApp.getUi();
  const t = pedir_('Anular un envío', 'Código del envío (columna «ID envío» de RESPUESTAS, ej.: ME-ABC12-XYZ987).\nSe anulan TODAS las filas de ese envío:', true);
  if (!t) return;
  const id = idEnvio_(t), sh = SpreadsheetApp.getActive().getSheetByName(H.RESP);
  const fs = filasDeEnvio_(id, sh);
  if (!fs.length) return aviso_('Sin filas', 'No hay filas con el ID ' + id + ' en RESPUESTAS.');
  const v = fs[0].valores, ests = {}; fs.forEach(f => { ests[f.valores[9]] = true; });
  const motivo = pedir_('Motivo', 'Envío encontrado:\n• Mentor: ' + v[3] + ' (' + v[2] + ')\n• Hito ' + v[7] + ' · enviado el ' + fmtFecha_(v[0]) + '\n• ' + Object.keys(ests).length + ' estudiantes · ' + fs.length + ' filas\n\nEscribe el motivo de la anulación (queda en la bitácora):', true);
  if (motivo === null) return;
  if (ui.alert('Confirmar anulación', '¿Anular las ' + fs.length + ' filas del envío ' + id + '?\n\nSe moverán a PAPELERA (se pueden restaurar).', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { moverAPapelera_(sh, filasDeEnvio_(id, sh), motivo); } finally { lock.releaseLock(); }
  bitacora_('Anular envío', id + ' · ' + v[2] + ' · ' + fs.length + ' filas · motivo: ' + (motivo || '—'));
  aviso_('Envío anulado', 'Listo. Las ' + fs.length + ' filas quedaron en PAPELERA.');
}
function menuAnularSeleccion() {
  const ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive(), sh = ss.getActiveSheet();
  if (!sh || sh.getName() !== H.RESP) return aviso_('Primero selecciona filas', 'Ve a la pestaña RESPUESTAS, selecciona las filas que quieres anular (basta una celda de cada fila; con Ctrl puedes marcar varias) y vuelve a usar esta opción.');
  const rl = ss.getActiveRangeList(), nums = {};
  (rl ? rl.getRanges() : [sh.getActiveRange()]).forEach(r => { for (let i = 0; i < r.getNumRows(); i++) { const n = r.getRow() + i; if (n >= 2 && n <= sh.getLastRow()) nums[n] = true; } });
  const filas = Object.keys(nums).map(Number);
  if (!filas.length) return aviso_('Sin filas', 'La selección no incluye filas de respuestas (la fila 1 es la cabecera).');
  if (filas.length > 300) return aviso_('Demasiadas filas', 'Seleccionaste ' + filas.length + ' filas. Para anular un envío completo usa «Anular un envío completo (por código)».');
  const motivo = pedir_('Motivo', 'Se anularán ' + filas.length + ' filas de RESPUESTAS.\nEscribe el motivo (queda en la bitácora):', true);
  if (motivo === null) return;
  if (ui.alert('Confirmar anulación', '¿Mover ' + filas.length + ' filas a PAPELERA?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { moverAPapelera_(sh, filas.map(n => ({ fila: n, valores: sh.getRange(n, 1, 1, cabResp_().length).getValues()[0] })), motivo); } finally { lock.releaseLock(); }
  bitacora_('Anular filas seleccionadas', filas.length + ' filas · motivo: ' + (motivo || '—'));
  aviso_('Filas anuladas', 'Listo. Las ' + filas.length + ' filas quedaron en PAPELERA.');
}
function menuRestaurar() {
  const ui = SpreadsheetApp.getUi();
  const t = pedir_('Restaurar un envío', 'ID del envío a restaurar (columna «ID envío» de PAPELERA, ej.: ME-ABC12-XYZ987).\nSe restauran todas sus filas que estén en PAPELERA:', true);
  if (!t) return;
  const id = idEnvio_(t), pap = SpreadsheetApp.getActive().getSheetByName(H.PAPELERA);
  if (!pap || pap.getLastRow() < 2) return aviso_('Papelera vacía', 'No hay filas anuladas.');
  const ids = pap.getRange(2, 5, pap.getLastRow() - 1, 1).getValues(), filas = [];
  ids.forEach((r, i) => { if (String(r[0]).trim().toUpperCase() === id) filas.push(i + 2); });
  if (!filas.length) return aviso_('No encontrado', 'No hay filas con el ID ' + id + ' en PAPELERA.');
  if (ui.alert('Confirmar', '¿Restaurar ' + filas.length + ' filas del envío ' + id + '?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const resp = hojaResp_(), n = cabResp_().length;
  filas.sort((a, b) => b - a).forEach(f => { resp.appendRow(pap.getRange(f, 4, 1, n).getValues()[0]); pap.deleteRow(f); });
  bitacora_('Restaurar envío', id + ' · ' + filas.length + ' filas');
  aviso_('Restaurado', 'Las ' + filas.length + ' filas volvieron a RESPUESTAS.');
}

function menuExcluir() {
  const correo = pedir_('Excluir mentor', 'Correo institucional del mentor que NO debe registrar sesiones:');
  if (!correo) return;
  const motivo = pedir_('Motivo', 'Motivo de la exclusión (ej.: ya no es docente tutor):', true);
  if (motivo === null) return;
  const ss = SpreadsheetApp.getActive(), ex = ss.getSheetByName(H.EXCLUIDOS);
  if (excluidos_()[correo]) return aviso_('Ya estaba excluido', correo);
  ex.appendRow([correo, motivo, new Date(), usuario_()]);
  const pad = ss.getSheetByName(H.PADRON);
  if (pad && pad.getLastRow() > 1) { const f = pad.getRange(2, 1, pad.getLastRow() - 1, 1).createTextFinder(correo).matchEntireCell(true).findNext(); if (f) pad.deleteRow(f.getRow()); }
  bitacora_('Excluir mentor', correo + ' · ' + motivo);
  aviso_('Mentor excluido', correo + ' ya no podrá ingresar. Sus registros anteriores no se tocan (si no deben contar, anúlalos).');
}
function menuReincorporar() {
  const correo = pedir_('Reincorporar mentor', 'Correo institucional a quitar de EXCLUIDOS:');
  if (!correo) return;
  const ex = SpreadsheetApp.getActive().getSheetByName(H.EXCLUIDOS);
  if (!ex || ex.getLastRow() < 2) return aviso_('Sin excluidos', 'La lista está vacía.');
  const vals = ex.getRange(2, 1, ex.getLastRow() - 1, 1).getValues();
  let n = 0;
  for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]).trim().toLowerCase() === correo) { ex.deleteRow(i + 2); n++; }
  if (!n) return aviso_('No estaba excluido', correo);
  bitacora_('Reincorporar mentor', correo);
  aviso_('Reincorporado', correo + ' vuelve a estar habilitado si cumple los filtros de CONFIG (o si está en AGREGADOS). Se sumará al padrón cuando ingrese o al actualizar el padrón.');
}
function menuIrAgregados() {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.AGREGADOS) || hojaSimple_(H.AGREGADOS, CAB_AGREGADOS);
  SpreadsheetApp.getActive().setActiveSheet(sh);
  aviso_('Agregar mentores a mano', 'Escribe una fila por mentor (Email, Docente, Sede LPZ/EAT/CBB/SCZ, código de Carrera, Plan de estudios, Programa).\nPrograma: «Docente Tutor» o «Hermano Mayor» (si lo dejas vacío, los correos est.… cuentan como Hermano Mayor).\nQuienes estén aquí quedan habilitados aunque no cumplan los filtros de CONFIG.\nAl terminar usa «Actualizar padrón de mentores».');
}

function menuNuevoPeriodo() {
  const ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive(), cfg = config_();
  const nuevo = pedir_('Nuevo periodo', 'Periodo actual: ' + cfg.periodo + '\n\nLas respuestas actuales se guardarán en la pestaña «RESPUESTAS ' + cfg.periodo + '» y RESPUESTAS quedará vacía.\n\nEscribe el nombre del NUEVO periodo (ej.: I-2027):', true);
  if (!nuevo) return;
  const archivo = 'RESPUESTAS ' + (cfg.periodo || Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd'));
  if (ss.getSheetByName(archivo)) return aviso_('Ya existe', 'Ya hay una pestaña «' + archivo + '». Cambia el nombre del periodo actual en CONFIG y vuelve a intentar.');
  if (ui.alert('Confirmar', '¿Archivar ' + cfg.periodo + ' e iniciar ' + nuevo + '?\n\nDespués revisa en CONFIG los hitos, las bases y los filtros, y actualiza el padrón.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const resp = ss.getSheetByName(H.RESP);
    resp.copyTo(ss).setName(archivo);
    if (resp.getLastRow() > 1) resp.deleteRows(2, resp.getLastRow() - 1);
    setConfig_('Periodo', nuevo);
  } finally { lock.releaseLock(); }
  crearResumen_();
  bitacora_('Nuevo periodo', cfg.periodo + ' → ' + nuevo + ' (archivo: ' + archivo + ')');
  aviso_('Nuevo periodo iniciado', 'Respuestas de ' + cfg.periodo + ' archivadas en «' + archivo + '».\nAhora: revisa CONFIG → Actualizar padrón → Abrir registro.');
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
  const HI = R(col('Hito')), SE = R(col('Sede del estudiante')), CA = R(col('Cód. carrera del estudiante'));
  const P = c => H.PADRON + '!$' + c + '$2:$' + c, PE = colLetra_(CAB_PADRON.length);
  const real = '"<>PRUEBA-*"', W = 8, rows = [], fmt = [];
  const push = (r, t) => { while (r.length < W) r.push(''); rows.push(r); if (t) fmt.push([rows.length, t]); };
  const sedes = Object.keys(SEDES);
  const cnt = cond => '=COUNTIFS(' + ID + ',"<>",' + ID + ',' + real + (cond ? ',' + cond : '') + ')';   // «<>PRUEBA-*» solo también contaría celdas vacías
  const uni = cond => '=IFERROR(COUNTUNIQUEIFS(' + CI + ',' + ID + ',' + real + (cond ? ',' + cond : '') + '),0)';
  const hrs = cond => '=SUMIFS(' + HR + ',' + ID + ',' + real + (cond ? ',' + cond : '') + ')';

  push(['RESUMEN · Registro de Sesiones de Mentoría'], 'titulo');
  push(['Se actualiza solo. Excluye filas de prueba (ID que empieza con PRUEBA-). Un «registro» es una fila: un estudiante en una materia.'], 'nota');
  push(['']);
  push(['Registros (estudiante × materia)', cnt('')], 'total');
  push(['Estudiantes atendidos (distintos)', uni('')], 'total');
  push(['Estudiantes que asistieron al menos una vez', uni(AS + ',"Sí"')], 'total');
  push(['Registros con asistencia', cnt(AS + ',"Sí"')], 'total');
  push(['Registros sin asistencia', cnt(AS + ',"No"')], 'total');
  push(['% de asistencia (registros)', '=IFERROR(B7/B4,0)'], 'totalpct');
  push(['Horas de mentoría', hrs('')], 'totalh');
  push(['Mentores en el padrón', '=COUNTA(' + P('A') + ')'], 'total');
  push(['Mentores que ya registraron', '=COUNTIF(' + P(PE) + ',"Con registros")'], 'total');
  push(['']);
  const hitos = cfg.hitos.length ? cfg.hitos : ['2', '3', '4'];
  const qh = h => /^\d+$/.test(h) ? h : '"' + h + '"';
  push(['POR HITO', 'Registros', 'Estudiantes', 'Asistieron', 'No asistieron', '% asistencia', 'Horas'], 'cab');
  hitos.forEach(h => { const r = rows.length + 1, c = HI + ',' + qh(h); push(['Hito ' + h, cnt(c), uni(c), cnt(c + ',' + AS + ',"Sí"'), cnt(c + ',' + AS + ',"No"'), '=IFERROR(D' + r + '/B' + r + ',0)', hrs(c)], 'fila'); });
  push(['']);
  push(['POR SEDE DEL ESTUDIANTE', 'Registros', 'Estudiantes', 'Asistieron', 'No asistieron', '% asistencia', 'Horas', 'Mentores con registros / en padrón'], 'cab');
  sedes.forEach(s => { const r = rows.length + 1, c = SE + ',"' + s + '"'; push([SEDES[s], cnt(c), uni(c), cnt(c + ',' + AS + ',"Sí"'), cnt(c + ',' + AS + ',"No"'), '=IFERROR(D' + r + '/B' + r + ',0)', hrs(c),
    '=COUNTIFS(' + P('D') + ',"' + s + '",' + P(PE) + ',"Con registros")&" / "&COUNTIF(' + P('D') + ',"' + s + '")'], 'fila'); });
  push(['']);
  push(['POR CARRERA DEL ESTUDIANTE', 'Registros', 'Estudiantes', 'Asistieron', 'No asistieron', '% asistencia', 'Horas'], 'cab');
  const shC = ss.getSheetByName(H.CARRERAS);
  const cods = shC && shC.getLastRow() > 1 ? shC.getRange(2, 1, shC.getLastRow() - 1, 2).getValues().filter(r => String(r[0]).trim()) : [];
  cods.forEach(rw => {
    const k = String(rw[0]).trim().toUpperCase(), r = rows.length + 1, c = CA + ',"' + k + '"';
    push([k + ' · ' + (rw[1] || k), cnt(c), uni(c), cnt(c + ',' + AS + ',"Sí"'), cnt(c + ',' + AS + ',"No"'), '=IFERROR(D' + r + '/B' + r + ',"–")', hrs(c)], 'fila');
  });
  push(['']);
  // Ranking de asignaturas: QUERY sobre RESPUESTAS (las 25 con más registros).
  const cA = col('Asignatura'), cB = col('ID envío');
  push(['ASIGNATURAS CON MÁS REGISTROS (25 primeras)', 'Registros'], 'cab');
  push(['=IFERROR(QUERY(' + H.RESP + '!$A$2:$' + colLetra_(C.length) + ',"select ' + cA + ', count(' + cB + ') where ' + cB + ' is not null and not ' + cB + ' starts with \'PRUEBA-\' group by ' + cA + ' order by count(' + cB + ') desc limit 25 label count(' + cB + ') \'\'",0),"Todavía no hay registros")']);
  for (let i = 0; i < 25; i++) push(['']);
  push(['Los mentores con su número de registros están en la pestaña PADRON (columnas «Registros» y «Estado»).'], 'nota');

  rs.getRange(1, 1, rows.length, W).setValues(rows.map(r => r.map(v => typeof v === 'string' && v.charAt(0) === '=' ? fx_(v) : v)));
  rs.setColumnWidth(1, 400); rs.setColumnWidths(2, W - 1, 110); rs.setColumnWidth(8, 230);
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
// Separador de argumentos de las fórmulas: depende de la configuración regional de la hoja
// («,» en inglés; «;» en español y otras con coma decimal). Se prueba escribiendo =SUM(2,5)
// en la celda A1 de una pestaña recién vaciada y se guarda en las propiedades del script.
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
