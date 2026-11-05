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
- [ ] **No publicar el front v2.0 (push) hasta que el ping de la hoja diga `version_app:'2.0'`**: la app v2 llama a `inicio`/`lista`
  y rompería el enlace vigente. Luego push y enlace `?v=11`.
- [ ] Prueba real y actualizar la guía PDF (`docs/tutorial/`) al flujo SIAR.

## Comandos
```bash
export PATH="/c/Program Files/nodejs:$PATH"; export PYTHONIOENCODING=utf-8
python build.py
node tests/backend.test.js && SEP=";" node tests/backend.test.js
python tests/e2e_test.py 390 && python tests/e2e_test.py 1366
python docs/tutorial/build_pdf.py
```
