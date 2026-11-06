# Registro de Sesiones de Mentoría · 2026 — UNIFRANZ

Proyecto de Rafael Aramayo (UNIFRANZ, Cochabamba). Reemplaza el Google Form «Registro de Sesiones Realizadas
de Mentorías || 2026» (bitácora de Hermanos Mayores y Docentes Tutores, se llena al final de cada hito).
Hermano de `../encuesta-seguimiento` y `../encuesta-docentes` (misma interfaz y arquitectura; sus CLAUDE.md
explican las lecciones, que se aplican todas). Creado el 11-oct-2026 desde la plantilla del skill
`encuesta-app-unifranz`. Léelo completo antes de tocar código.

## Cómo trabaja Rafael
- Prefiere ejecución directa, poco ida y vuelta y justificaciones breves. No es programador: pasos exactos y qué NO tocar.
- Todo en **castellano neutro** (tú), nunca voseo.
- Aspecto profesional en Sheets: encabezados gris oscuro `#3a3a3a`.

## Estructura
| Ruta | Qué es |
|---|---|
| `src.html` | **Fuente de la app.** Se edita aquí (`__LOGO_FULL__`/`__LOGO_WORD__` = marcadores). |
| `build.py` | Genera `index.html` y valida el JS con `node --check`. Correr siempre tras editar `src.html`. |
| `index.html` | Archivo que se publica. **No editar a mano.** |
| `apps-script/Codigo.gs` | Backend (web app + menú «Mentorías»). |
| `tests/backend.test.js` | Hoja simulada con un SIAR de prueba. Falla si algo no cuadra. |
| `tests/e2e_test.py` | Recorrido completo (Playwright, backend simulado). `python tests/e2e_test.py 390` y `… 1366`. |
| `docs/tutorial/` | Guía PDF del administrador (`python docs/tutorial/build_pdf.py`). **No va al repo.** |
| `entregables/` | Guía PDF, bases v1 (**con CI y celulares**) y `Codigo_para_AppsScript.txt` (copia de `Codigo.gs` para pegar). **No va al repo.** |

## v2.0 · Base única: el reporte del SIAR (05-nov-2026)
Pedido de Rafael: el SIAR (plataforma que llenan los directores de carrera) genera un Excel «Rep. Ficha est.» con las fichas
de nivelación (estudiante × materia, tratamiento y mentor asignado). **Es la única base**; las 3 bases v1 (BASEDEDATOS*) y
PADRON/EXCLUIDOS/AGREGADOS ya no se usan. «Nosotros solo leeremos lo que bota el SIAR, para que los directores no olviden
registrar en el SIAR»: lo que no tiene mentor asignado aparece **«Sin asignación»** (pestaña SIN ASIGNACIÓN para reclamar).

### Flujo de la app
Bienvenida → **Código de acceso** (CONFIG, `NIV2026`, se reparte a directores/mentores) + **Sede** + **Facultad** (solo las que
tienen registros, con conteo) → **¿Quién eres?** (nombres de la columna «Detalle»/asignado del SIAR, DT y HM; buscador; «No estoy
en la lista» → nombre libre + programa, entra directo a «Buscar por materia») → **Estudiantes**: hito (2·3·4) + pestañas
«Mis estudiantes» (sus asignados, agrupados por materia, **ya marcados**) y «Buscar por materia» (todas las materias de esa
sede·facultad por semestre; cada estudiante con «Asignado: X» o «Sin asignación») → **Asistencia y sesión**: Sí/No por
estudiante, sesión del grupo (fecha, horas, actividades, observaciones) y «Otra fecha u horario» por estudiante → Revisión →
Envío → **un código por estudiante** `XXXXX-YYYYYY-NN` (en la hoja `ME-…-NN`, columna «Código de registro»).
- CI enmascarado `•••123` en el front; nunca correos ni celulares. Claves locales `bitniv_draft1`, `bitniv_cola1`, `bitniv_pref1` (recuerda «¿Eres X?»).
- «Registrar otro grupo» vuelve a sus estudiantes con el mismo hito.

### Lectura del SIAR (`leerSiar_`)
- Pestaña: CONFIG «Pestaña del SIAR» (`SIAR`); si no existe, `SIAR` o la que empiece con «Rep. Ficha» (nombre al importar el Excel) → `hojaSiar_`.
- Columnas por título normalizado (`COLS_SIAR`): c.i., nombre_estudiante, cod._carrera, codigo_materia, materia, tratamiento,
  **detalle** (mentor asignado), detalle_id, ficha_id, hito, sede (nombre → LPZ/EAT/CBB/SCZ), docente (de la materia), paralelo, semestre.
- Filtra CONFIG «Tratamientos que se registran» (`Docente Tutor; Apoyo Hermano mayor`) → programa «Docente Tutor»/«Hermano Mayor».
- Semestre de la materia = primer dígito tras «-» del código (AHU-211 → 2).
- Facultad = CARRERAS col C. Oficial: FCEE NGE ICO THO IEF AFC (+GAC ADM CPU AHT IEC) · FDTC PYM DDP ARQ (+DGP) · FCS MED ODO BYF ENF ·
  FI SIS · FCJS CPD DER PSI (+PER). **Los nombres largos de FACULTADES son supuestos: Rafael debe confirmarlos.**
- Caché del script 1 h en trozos (`cacheLista_`); el menú «Actualizar SIAR» la limpia, agrega carreras nuevas en amarillo y rehace SIN ASIGNACIÓN.
- Con el SIAR real (05-nov): 5682 filas → 2791 registros, 1059 estudiantes, 78 DT y 215 HM asignados, 737 sin asignación; lista mayor LPZ·FCS 753 (144 KB).

### Contrato app ↔ script (v2.0)
- `GET ?action=ping` → `{ok, servicio:'bitacora-nivelaciones', version_app:'2.0', abierta, periodo, requiere_clave, respuestas}`
- `GET ?action=inicio&clave=` → `{ok, abierta, hitos, sedes:[{cod,nombre}], facultades:[{cod,nombre}], conteo:{'SEDE|FAC':n}}` o `{ok:false, motivo:'clave'}`
- `GET ?action=lista&clave=&sede=&fac=` → `{ok, registros:[[clave, nombre, ciMask, carCod, carNom, semEst, matCod, matNom, semMat, paralelo, docente, programa, asignado, hito]]}`
  (`clave` = detalle_id|programa)
- `GET ?action=verificar&id=` → `{ok, existe}`
- `POST {action:'guardar', data:{id:'ME-XXXXX-YYYYYY', clave, sede, fac, hito, mentor:{nombre, programa}, items:[{keys:[…], asistio, fecha, hi, hf, act, obs}], nombres, dur_s, movil, fecha_local, version}}`
  → `{ok, id, filas, estudiantes, duplicados, codigos:[{codigo, estudiante}]}`. Revalida clave, hito, que las keys existan y sean del mismo CI.
  «Asignación»: Asignado a quien registra / Asignado a otra persona / Sin asignación en el SIAR; «Mentor figura en el SIAR» Sí/No.
- RESPUESTAS: 37 columnas (`cabResp_`), una fila por estudiante × materia, «Horas imputadas» = duración / materias de la sesión.

### Hoja y menú «Mentorías» (v2.0)
- Pestañas: CONFIG, CARRERAS (Código | Nombre | Facultad), FACULTADES, el SIAR, SIN ASIGNACIÓN, RESPUESTAS, PAPELERA, RESUMEN, BITACORA.
- CONFIG: Registro activo, fechas, Periodo, Hitos habilitados, Pestaña del SIAR, Tratamientos, Sedes, Facultades, **Código de acceso**, mensaje de cerrado.
- Menú: Abrir/Cerrar · **Actualizar SIAR** (tras pegar un reporte nuevo) · Ver estado · **Anular por código** (un estudiante `…-NN` o el envío completo) ·
  Anular filas seleccionadas · Restaurar por código · Nuevo periodo · Reconstruir RESUMEN · Borrar filas de prueba · Configuración inicial.
- `configuracionInicial` migra desde v1: limpia parámetros obsoletos de CONFIG, agrega columna Facultad, y si RESPUESTAS/PAPELERA tienen
  datos con la cabecera vieja las renombra «RESPUESTAS v1 (fecha)». Avisa qué pestañas viejas sobran (PADRON, EXCLUIDOS, AGREGADOS, BASEDEDATOS*).
- RESUMEN: totales, DT/HM que registraron, sin asignación, por programa/hito/sede/facultad/carrera, ranking de asignaturas y de mentores.

## v2.1 · Hoja simple (05-nov-2026, pedido de Rafael: «hay demasiadas pestañas, debe ser más simple»)
- Visibles: RESPUESTAS · RESUMEN · SIN ASIGNACIÓN · el SIAR · CONFIG · CARRERAS (`ordenarPestanas_`). Ocultas: PAPELERA, BITACORA,
  «RESPUESTAS/PAPELERA …» (menú «Ver u ocultar papelera y bitácora»). `configuracionInicial` borra `OBSOLETAS` (PADRON, EXCLUIDOS,
  AGREGADOS, BASEDEDATOSDOC/EST/MATERIAS, FACULTADES).
- **Sin pestaña FACULTADES:** CARRERAS col C = **nombre** de la facultad (desplegable); la facultad se identifica por su nombre en
  inicio/lista/RESPUESTAS (el `cod` que recibe la app es el nombre). Migra siglas → nombres. CONFIG «Facultades habilitadas» acepta nombres o siglas.
- **El SIAR se reconoce por columnas** (`hojasSiar_`: tratamiento + detalle + c.i.), el nombre no importa: en la hoja real se llama
  **«BASEDEDATOS»**. Ya no existe el parámetro «Pestaña del SIAR». Si hay varias, usa la de más a la derecha y avisa.
- **Reimportar el SIAR:** con .xlsx Sheets solo ofrece «Insertar nuevas hojas» (las de «hoja actual» son para CSV; «Reemplazar hoja de
  cálculo» reemplaza el ARCHIVO entero). «Actualizar SIAR» llama `consolidarSiar_`: se queda con el SIAR de más a la derecha, borra los
  anteriores (y una BASEDEDATOS vacía) y lo renombra `NOMBRE_SIAR` = BASEDEDATOS. Solo menú: no requiere Nueva versión.
- 05-nov: borré por conector las pestañas viejas de la hoja real; «RESPUESTAS v1 (2026-11-05)» (5 filas reales del 27-oct) quedó oculta.

## v2.2 · Directo a la asistencia (05-nov-2026, pedido de Rafael)
- «El paso 3 no tiene sentido: es lo asignado por el SIAR». Al tocar su nombre el mentor va **directo a «Asistencia y sesión»**
  (hito arriba, sus asignados con sus materias debajo del nombre, Asistió/No asistió, botón «Quitar» por estudiante y
  «+ Agregar estudiante de otra materia» → pantalla `est` = búsqueda por materia, que vuelve a la asistencia).
  Quien elige «No estoy en la lista» empieza en `est` (no tiene asignados). Ya no hay pestañas «Mis estudiantes / Buscar por materia».
- Asignación por materia: un estudiante puede tener la materia A con un mentor y la B con otro; cada mentor solo ve las suyas y
  registra por separado (filas estudiante × materia, códigos propios). Si registra una materia ajena: «Asignado a otra persona».

## v2.3 · Asistencia por semestre y materia (05-nov-2026, pedido de Rafael)
- «Algunos docentes tienen clase con un semestre un día y con otro semestre otro día». La asistencia se agrupa
  **semestre → materia** (desplegables; abiertas si hay ≤ 15 filas), cada fila = estudiante × materia, con «Todos asistieron /
  Nadie asistió» por materia. **Solo se registra lo marcado** (Asistió/No asistió; tocar de nuevo desmarca); ya no hay «Quitar».
- Estado por clave del SIAR: `S.asis[clave]`, `S.propio[clave]`; `S.sel` = solo agregados a mano; `visRegs()` = asignados + agregados.
  `selEst()` arma los ítems del envío: mismo estudiante + misma asistencia + mismo horario → un ítem (un código). El script no cambió.

## v2.4 (05-nov-2026, pedidos de Rafael)
- Una materia = un grupo (clave = código de materia), sin separar por carrera ni por docente de la materia («el docente base
  confunde»); los encabezados ya no muestran docente. Cada fila: carrera · semestre · paralelo · CI enmascarado.
- **Sin código de acceso:** CONFIG «Código de acceso» vacío en la hoja real (el enlace solo se comparte con DT y HM). Escribir uno lo reactiva;
  la app lo pide sola. Con el código vacío, nombres y CI parcial de la lista quedan visibles para quien tenga el enlace.
- Pantalla 02: «Selecciona tu nombre» · «Estimado docente tutor o hermano mayor: por favor, busca tu nombre en la lista y selecciónalo.»

## v2.5 · Asistencia por estudiante y semestre (06-nov-2026, pedido de Rafael)
- Grupos = semestre de la materia (desplegables). Cada estudiante aparece **una vez por semestre**, con sus materias de ese semestre
  como botones (todas marcadas; se desmarcan las no trabajadas en la sesión). Si tiene materias de otro semestre, aparece de nuevo allí.
- Estado: fila = `filaKey(r)` = estKey + '#' + semestre de la materia; `S.asis`/`S.propio` por fila; `S.matOff[claveSIAR]` = materia desmarcada.
  Un ítem del envío = una fila marcada con sus materias marcadas. Un estudiante puede ir en varios ítems (varios semestres):
  el script (v2.4) lo acepta, rechaza solo la misma materia dos veces y le da **un solo código** por estudiante.

## v2.6 · Entrar directo con el nombre (06-nov-2026, pedido de Rafael)
- El SIAR NO trae correos de mentores («Correo» = estudiante; «Detalle» = solo nombre, 4 filas con correo escrito a mano), así que
  no se puede validar por correo sin volver a cruzar bases. Se eligió: primera pantalla = **«Selecciona tu nombre»** con TODOS los DT y HM
  del SIAR (`?action=mentores` → `[nombre, programa, n.º est., [[sede, nombre sede, facultad]]]`, ~18 KB); al elegir,
  `?action=lista&mentor=&prog=` trae los registros de las sedes·facultades donde tiene asignados. Sin «No estoy en la lista».
  La pantalla de código de acceso solo aparece si CONFIG tiene código. `inicio` sigue en el script (no lo usa la app).
- `limpiaAsignado_` quita «Correo docente …@…» de «Detalle». Tras pegar el script: Nueva versión + **Actualizar SIAR** (limpia la caché).
- **Orden de publicación:** el front 2.6 necesita el script 2.6 (acción `mentores`): primero el script, después el push.

## Historia v1.x (11 al 27-oct-2026, ya reemplazada)
- v1: correo docente validado contra BASEDEDATOSDOC, ficha por estudiante con materias del catálogo, un envío por grupo.
- v1.4: GET por `fetch` con `credentials:'omit'` (JSONP de respaldo) — dispositivos con varias cuentas Google fallaban con JSONP. **Sigue vigente.**
- v1.5–1.7: hito dentro de la ficha, búsqueda por carrera, sin registro a mano, Hermanos Mayores = cualquier estudiante.
- Hoja en uso (cuenta institucional): **«Formulario Nivelaciones Unifranz»** `1vewoz9wt61HArnFJu4Xe4BlO1slPuMe3RA9GzM6WAe0`;
  script `AKfycbxwv1mH1KPy…DyDq8Q` en `API_URL_DEFECTO`. Los conectores de Drive/Sheets de Claude son de la cuenta institucional.
  Al 05-nov tenía 5 filas reales en RESPUESTAS (v1, 27-oct).

## Estado y pendientes (05-nov-2026)
- [x] v2.0 local: pruebas del script (SEP «,» y «;»), simulación con el SIAR real, e2e 390 y 1366 OK. Commit local `81db1e4`+.
- [ ] Rafael: importar el Excel del SIAR en la hoja (Archivo → Importar → Insertar hojas nuevas), pegar script v2.0,
  `configuracionInicial`, **Nueva versión** de la implementación. Confirmar nombres de FACULTADES y el código de acceso.
- [x] Front v2.1 publicado (`?v=11`) el 05-nov. Falta que Rafael pegue el script v2.1 y lo implemente como Nueva versión.
- [ ] Prueba real y actualizar la guía PDF (`docs/tutorial/`) al flujo SIAR.

## Comandos
```bash
export PATH="/c/Program Files/nodejs:$PATH"; export PYTHONIOENCODING=utf-8
python build.py
node tests/backend.test.js && SEP=";" node tests/backend.test.js
python tests/e2e_test.py 390 && python tests/e2e_test.py 1366
python docs/tutorial/build_pdf.py
```
