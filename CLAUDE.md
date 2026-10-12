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

## El problema que resuelve
**Las 3 bases son solo referencia** (aclaración de Rafael, 11-oct-2026): el docente registra únicamente a los estudiantes
que no aprobaron (asistan o no); esa condición no está en ninguna base. No hay padrón de estudiantes «pendientes» ni
cobertura sobre los 1857; en PADRON, «Sin registros» puede ser normal (docente sin reprobados).

En el Form había que llenar un formulario **por estudiante y por materia** (CI elegido de una lista), y también
cuando el estudiante no asistió. Un docente con 30 estudiantes × 3 materias llenaba 90 formularios.
Ahora: **un envío por grupo** (hito + N estudiantes), cada estudiante con **todas sus materias**, y si
**no asistió** su ficha termina ahí (sin fecha, horas ni actividades).

## Estructura
| Ruta | Qué es |
|---|---|
| `src.html` | **Fuente de la app.** Se edita aquí (`__LOGO_FULL__`/`__LOGO_WORD__` = marcadores). |
| `build.py` | Genera `index.html` y valida el JS con `node --check`. Correr siempre tras editar `src.html`. |
| `index.html` | Archivo que se publica. **No editar a mano.** |
| `apps-script/Codigo.gs` | Backend (web app + menú «Mentorías»). |
| `tests/backend.test.js` | Hoja simulada con las 3 bases. Falla si algo no cuadra. |
| `tests/e2e_test.py` | Recorrido completo (Playwright, backend simulado). `python tests/e2e_test.py 390` y `… 1366`. |
| `docs/tutorial/` | Guía PDF del administrador (`python docs/tutorial/build_pdf.py`). **No va al repo.** |
| `entregables/` | Guía PDF, `Base_registro_mentorias.xlsx` (3 bases limpias, **con CI y celulares**) y el código para pegar. **No va al repo.** |

## Decisiones
- **Mentores:** base de docentes (`BASEDEDATOSDOC`: Docente, CI, Sede, Carrera, Email, Plan_estudios; 239 al 11-oct-2026).
  Programa: «Docente Tutor» por defecto; «Hermano Mayor» si AGREGADOS lo dice o el correo empieza con `est.`.
- **Estudiantes:** `BASEDEDATOSEST` (sede, anho_plan_estudio, carrera, nombres/apellidos, ci, correo_institucional, celular; 1857).
  Nunca va al front: `?action=buscar` devuelve máx. 12 coincidencias (nombre, carrera, sede, plan, CI enmascarado `•••660`).
  Por CI (≥5 dígitos) y por nombre busca en **todas las sedes** (decisión de Rafael, 11-oct-2026; CONFIG «Buscar estudiantes de todas las sedes», SÍ por defecto; con NO, por nombre solo su sede).
  Cada palabra escrita debe ser comienzo de una palabra del nombre. Si no aparece, el mentor puede **registrarlo a mano**
  (CI, nombre, carrera; CONFIG «Permitir estudiantes que no están en la base»), y la fila queda con «Estudiante en la base = No».
- **Materias:** `BASEDEDATOSMATERIAS` (Facultad, Carrera, Sem., Código asignatura, Asignatura, Plan_estudios; 968 filas, 17 carreras, todo plan 2026).
  Las comunes (PIN-111 «Proyecto Integrador I», etc.) se repiten por carrera. El catálogo (sin datos personales, ~64 KB) va
  en la respuesta de `validar`, en caché del script 10 min (trozos de 40 000 caracteres; «Actualizar padrón» la limpia).
  La app muestra primero las de la carrera y plan del estudiante, por semestre; «todas las carreras» con búsqueda ≥3 letras.
  6 materias tienen `Sem.` = 46367 (fecha mal cargada): quedan en «Sin semestre» y «Revisar las bases» lo avisa.
- **Varias bases:** CONFIG tiene «Pestañas de docentes / de estudiantes / de materias» (separadas por `;`). Columnas por título (`COLS_BASE`, `COLS_MAT`).
- **Filtros de CONFIG** (planes, sedes, carreras) aplican **solo a mentores**. Estudiantes y materias de cualquier plan.
- **Hitos:** CONFIG «Hitos habilitados» = `2; 3; 4` (como el Form). Con uno solo, la app no pregunta.
- **Sesión:** fecha (no futura, ≤ 1 año; servidor tolera 400 días), hora de inicio < conclusión (≤ 10 h), actividades obligatorias
  (chips de sugerencia que agregan texto: Repaso de contenidos, Resolución de ejercicios, Aclaración de dudas, Preparación para la
  evaluación, Revisión de trabajos o tareas, Orientación en técnicas de estudio), observaciones opcionales (1000).
  «Usar la misma fecha y horario / actividades del estudiante anterior» para sesiones grupales.
- No hay «ya respondió»: un mentor puede enviar muchas veces. Duplicados (mismo mentor + estudiante + materia + hito + fecha)
  se guardan igual con **«Posible duplicado = Sí»**.
- Claves locales: `regment_draft1`, `regment_cola1`. IDs de envío `ME-…` (el mentor ve el código sin `ME-`).
- Límites: 80 estudiantes por envío, 20 materias por estudiante.

## Contrato app ↔ script
- `GET ?action=ping` → `{ok, servicio:'registro-mentorias-2026', version_app, abierta, periodo, hitos, respuestas}`
- `GET ?action=validar&correo=` → `{ok, habilitado:true, mentor:{nombre, nombre_completo, sede, sede_nombre, carrera_cod, carrera, plan, programa}, hitos, manual, todas_sedes, periodo, previos:{hito:n_estudiantes}, carreras:[{cod,nombre}], materias:[[cod,nombre,carrera,sem,plan]]}` o `{ok, habilitado:false, motivo:'no_encontrado'|'no_habilitado'|'cerrada', mensaje?}`
- `GET ?action=buscar&correo=&q=` → `{ok, resultados:[{id, nombre, ci, sede, sede_nombre, carrera_cod, carrera, plan}], mas, total}` (`id` = correo institucional o `ci:<ci>`)
- `GET ?action=verificar&id=` → `{ok, existe}`
- `POST {action:'guardar', data:{id:'ME-…', correo, hito, items:[{est | manual:{ci,nombre,carrera_cod,sede}, materias:[{cod,car,nombre}], asistio:'Sí'|'No', fecha:'aaaa-mm-dd', hi:'HH:MM', hf, act, obs}], dur_s, movil, fecha_local, version}}`
  → `{ok, id, filas, estudiantes, duplicados}` o `{ok:false, codigo:'no_encontrado'|'no_habilitado'|'cerrada'|'limite_pruebas'|'datos_invalidos', detalle?}`.
  Todo se revalida: mentor contra el padrón, estudiante contra su base (nombre, CI, sede, carrera y plan salen de la base),
  materia contra el catálogo. `datos_invalidos` es definitivo pero la app **conserva el borrador** y vuelve a la revisión.
  `PRUEBA-…` no valida mentor ni hito ni materias; tope 5 envíos de prueba.

## Hoja: pestañas y menú «Mentorías»
- **CONFIG**, **CARRERAS** (los códigos nuevos de las 3 bases se agregan en amarillo), **PADRON** (mentores; columnas vivas
  «Registros» = COUNTIF en RESPUESTAS y «Estado» Con/Sin registros), **EXCLUIDOS**, **AGREGADOS** (Email, Docente, Sede, Carrera,
  Plan de estudios, Programa, Nota), **RESPUESTAS** (fila 1 = contrato, 33 columnas, una fila por estudiante × materia;
  «Horas imputadas» = duración / n.º de materias de esa sesión, para que la suma no duplique horas), **PAPELERA**, **RESUMEN**
  (totales, por hito, por sede y carrera del estudiante, QUERY con las 25 asignaturas con más registros), **BITACORA**.
- Menú: Abrir/Cerrar · Actualizar padrón · Ver estado · **Revisar las bases** · **Anular un envío (por código)** ·
  **Anular las filas seleccionadas** · Restaurar un envío · Excluir/Reincorporar · Agregados · Nuevo periodo · Reconstruir RESUMEN ·
  Borrar filas de prueba · Configuración inicial.
- RESUMEN: los conteos usan `COUNTIFS(ID,"<>",ID,"<>PRUEBA-*")` (solo `"<>PRUEBA-*"` también cuenta celdas vacías). Fórmulas por `fx_`.

## Estado y pendientes (11-oct-2026)
- [x] App v1.0 y script v1.0; pruebas locales OK (390 px, 1366 px, hoja simulada en inglés y español, y con los datos reales del Excel).
- [x] Guía PDF (`entregables/Guia_hoja_registro_mentorias.pdf`, 23 páginas) y base limpia `entregables/Base_registro_mentorias.xlsx`.
- [x] **Hoja en uso:** la de la cuenta **@unifranz** de Rafael, id `1hGgjqS8HSv936lvWirtyc19TG2pZA1SBEwNUKlWmHA0`
  (el dominio sí permite acceso «Cualquier persona»: al principio estaba restringido y la URL pedía login).
  Hay una hoja vacía de más en la cuenta personal («Registro de Mentorías 2026», `1vorJLyJ-oRITRnQjjMEG5qrw47e-4nHtYf-npwGE8iA`): no se usa.
  El conector de Drive de Claude es de la cuenta personal: **no ve la hoja @unifranz**.
- [x] **URL del script:** implementación `AKfycbxtZvLrQlpP…OICug` (11-oct-2026), incrustada en `API_URL_DEFECTO`; ping anónimo OK.
- [x] **Repo** `UNIFRANZ-BO/registro-mentorias` (público, Pages en `main`) → enlace vigente **https://unifranz-bo.github.io/registro-mentorias/?v=2** (v=2: ejemplo de correo sin «doc.»). Ping desde la página publicada OK.
- [ ] Rafael: importar `entregables/Base_registro_mentorias.xlsx` en la hoja @unifranz (Insertar hojas nuevas) y ejecutar
  `configuracionInicial` (o «Actualizar padrón»). Al 11-oct, `validar` con un docente real da `no_encontrado` → bases aún no cargadas.
- [ ] Prueba real (R13 de la guía) y limpieza antes de difundir.
- [x] Rafael confirmó (11-oct): los **Hermanos Mayores también la usan** (vía AGREGADOS con Programa = Hermano Mayor, o una pestaña propia en «Pestañas de docentes»); búsqueda por nombre en todas las sedes.
- [ ] En la hoja ya instalada, CONFIG quedó con «Buscar estudiantes de todas las sedes = NO» (valor viejo): Rafael debe cambiarlo a SÍ.
- [ ] Por confirmar: ¿sirven las sugerencias de actividades?

## Comandos
```bash
export PATH="/c/Program Files/nodejs:$PATH"; export PYTHONIOENCODING=utf-8
python build.py
node tests/backend.test.js && SEP=";" node tests/backend.test.js
python tests/e2e_test.py 390 && python tests/e2e_test.py 1366
python docs/tutorial/build_pdf.py
```
