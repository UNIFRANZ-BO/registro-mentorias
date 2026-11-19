"""Prueba de punta a punta de la app (v2, SIAR) con un backend simulado (no toca la hoja real).
Requisitos: pip install playwright && playwright install chromium
Uso: python tests/e2e_test.py [ancho]   (390 por defecto; genera capturas en tests/shots/)
"""
import asyncio, json, pathlib, sys, time
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SHOTS = RAIZ / 'tests' / 'shots'; SHOTS.mkdir(exist_ok=True)
API = 'https://script.google.com/macros/s/TESTID/exec'
W = int(sys.argv[1]) if len(sys.argv) > 1 else 390
DB, VIAS = {}, []
FALLAS = {'mentores': 0}
CLAVE = 'NIV2026'
# [clave, nombre, ciParcial, codCarrera, carrera, semEst, codMateria, materia, semMateria, paralelo, docente, programa, asignado, hito]
REGS = [
    ['101|Docente Tutor', 'Ana Ojeda Guerrero', '•••469', 'MED', 'Medicina', 1, 'AHU-211 (P)', 'Anatomía Humana', 2, '105', 'Vito Rivas Vargas', 'Docente Tutor', 'Rafael Aramayo', 2],
    ['201|Docente Tutor', 'Guina Gutierrez Mamani', '•••360', 'MED', 'Medicina', 2, 'AHU-211 (P)', 'Anatomía Humana', 2, '105', 'Vito Rivas Vargas', 'Docente Tutor', 'Rafael Aramayo', 2],
    ['202|Docente Tutor', 'Guina Gutierrez Mamani', '•••360', 'MED', 'Medicina', 2, 'EME-211 (P)', 'Embriología Médica', 2, '105', 'Erika Quisbert', 'Docente Tutor', 'Rafael Aramayo', 3],
    ['102|Hermano Mayor', 'Ana Ojeda Guerrero', '•••469', 'MED', 'Medicina', 1, 'HIS-211 (P)', 'Histología', 2, '105', 'Dorcas Oliden', 'Hermano Mayor', 'Joseph Mamani Copa', 2],
]

async def backend(route, req):
    q = parse_qs(urlparse(req.url).query)
    if req.method == 'POST' and FALLAS.get('post', 0) > 0:
        FALLAS['post'] -= 1
        return await route.abort()
    if req.method == 'POST':
        d = json.loads(req.post_data)['data']
        DB[d['id']] = d
        cods = [{'codigo': d['id'][3:] + '-%02d' % (i + 1), 'estudiante': n} for i, n in enumerate(d.get('nombres', []))]
        return await route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, body=json.dumps({'ok': True, 'id': d['id'], 'codigos': cods, 'duplicados': 0}))
    a, cb = q.get('action', ['ping'])[0], q.get('callback', [''])[0]
    if VERIF['bloq'] and a in ('guardar', 'verificar'):      # sin red para guardar (también el plan B y C)
        return await route.abort()
    if a == 'mentores' and FALLAS['mentores'] > 0:      # simula una red inestable: el primer intento (fetch + JSONP) falla
        FALLAS['mentores'] -= 1
        return await route.abort()
    VIAS.append('jsonp' if cb else 'fetch')
    clave = q.get('clave', [''])[0].upper()
    if a == 'mentores':
        out = ({'ok': False, 'motivo': 'clave', 'requiere_clave': True} if clave != CLAVE else
               {'ok': True, 'abierta': True, 'hitos': ['2', '3', '4'], 'mentores': [['Joseph Mamani Copa', 'Hermano Mayor', 1, [['LPZ', 'La Paz', 'Ciencias de la Salud']]], ['Rafael Aramayo', 'Docente Tutor', 2, [['LPZ', 'La Paz', 'Ciencias de la Salud']]]]})
    elif a == 'inicio':
        out = ({'ok': False, 'motivo': 'clave', 'requiere_clave': True} if clave != CLAVE else
               {'ok': True, 'abierta': True, 'hitos': ['2', '3', '4'], 'sedes': [{'cod': 'LPZ', 'nombre': 'La Paz'}, {'cod': 'CBB', 'nombre': 'Cochabamba'}],
                'facultades': [{'cod': 'Ciencias de la Salud', 'nombre': 'Ciencias de la Salud'}, {'cod': 'Ingeniería', 'nombre': 'Ingeniería'}], 'conteo': {'LPZ|Ciencias de la Salud': 4, 'CBB|Ingeniería': 1}})
    elif a == 'lista':
        out = {'ok': True, 'registros': REGS} if clave == CLAVE and q.get('mentor') else {'ok': False, 'motivo': 'clave'}
    else:
        out = {'ok': True, 'existe': q.get('id', [''])[0] in DB}
    if not cb:
        return await route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, body=json.dumps(out))
    await route.fulfill(status=200, headers={'Content-Type': 'application/javascript'}, body=f'{cb}({json.dumps(out)});')

VERIF = {'bloq': False}
async def page_route_block(pg): VERIF['bloq'] = True
async def page_route_unblock(pg): VERIF['bloq'] = False

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={'width': W, 'height': 844 if W < 600 else 800}, is_mobile=W < 600, has_touch=W < 600)).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('https://script.google.com/**', backend)
        await pg.goto((RAIZ / 'index.html').as_uri() + '?api=' + API); await pg.wait_for_timeout(1500)
        shot = lambda n, full=False: pg.screenshot(path=str(SHOTS / f'{W}_{n}.png'), full_page=full)
        scr = lambda: pg.evaluate('S.scr')
        await shot('00_bienvenida')
        # ── código de acceso, sede y facultad
        await pg.click('#start'); await pg.wait_for_timeout(1300)
        assert await scr() == 'inicio' and await pg.locator('#cClave').count() == 1, 'pide el código de acceso'
        await pg.fill('#cClave', 'malo'); await pg.click('#btnNext'); await pg.wait_for_timeout(1200)
        assert 'no es correcto' in await pg.inner_text('#cMsg')
        assert 'ok' in await pg.get_attribute('#srv', 'class'), 'indicador verde tras el ping'
        FALLAS['mentores'] = 2
        await pg.fill('#cClave', 'niv2026'); await pg.click('#btnNext'); await pg.wait_for_timeout(4500)
        assert FALLAS['mentores'] == 0 and 'ok' in await pg.get_attribute('#srv', 'class'), 'reintenta y se recupera'
        assert await scr() == 'mentor', 'tras el código va directo a «Selecciona tu nombre»'
        await shot('01_nombre')
        # ── ¿quién eres?
        assert await pg.locator('#mlist [data-m]').count() == 0 and await pg.locator('[data-gm]').count() == 2, 'listas plegadas'
        await pg.click('[data-gm="Docente Tutor"]'); await pg.wait_for_timeout(200)
        assert await pg.locator('#mlist [data-m]').count() == 1
        await pg.click('[data-gm="Docente Tutor"]'); await pg.wait_for_timeout(200)
        assert await pg.locator('#mlist [data-m]').count() == 0
        await pg.fill('#qm', 'rafa'); await pg.wait_for_timeout(200)
        assert await pg.locator('#mlist [data-m]').count() == 1
        await shot('02_mentor')
        await pg.click('#mlist [data-m]'); await pg.wait_for_timeout(1200)
        # ── directo a la asistencia: estudiantes por semestre, con sus materias debajo
        assert await scr() == 'ses', 'tras elegir el nombre va directo a la asistencia'
        assert await pg.locator('.gas').count() == 1 and await pg.locator('.asisrow').count() == 2, 'un semestre abierto con 2 estudiantes'
        assert '2do semestre' in await pg.inner_text('#lest')
        assert 'hito' in (await pg.inner_text('#fmsg')).lower(), ('falta el hito', errs)
        await pg.click('[data-hito="3"]'); await pg.wait_for_timeout(200)
        assert 'marca quién asistió' in (await pg.inner_text('#fmsg'))
        await pg.click('[data-g="s2"]'); await pg.wait_for_timeout(200)
        assert await pg.locator('.asisrow').count() == 0, 'el semestre se cierra'
        await pg.click('[data-g="s2"]'); await pg.wait_for_timeout(200)
        await shot('03_asistencia', True)
        assert await pg.locator('#agregar').count() == 0, 'sin «Agregar estudiante de otra materia»'
        guina = pg.locator('.asisrow', has_text='Gutierrez')
        assert await guina.locator('.mt').count() == 2, 'Guina: una fila con sus 2 materias'
        assert await pg.locator('#fF').is_visible() and not await pg.locator('#secAct').is_visible(), 'fecha arriba; actividades ocultas sin asistentes'
        # ── «Todos asistieron» del semestre; tocar de nuevo desmarca (Ana no se registra)
        await pg.click('[data-gt="Sí"][data-g2="s2"]'); await pg.wait_for_timeout(200)
        await pg.locator('.asisrow', has_text='Ojeda').locator('[data-a="Sí"]').click(); await pg.wait_for_timeout(200)
        assert await pg.locator('.asisrow.si').count() == 1
        # desmarcar y volver a marcar una materia; sin materias da error
        await guina.locator('[data-mt="202|Docente Tutor"]').click(); await pg.wait_for_timeout(150)
        await guina.locator('[data-mt="201|Docente Tutor"]').click(); await pg.wait_for_timeout(150)
        assert 'al menos una materia' in await pg.inner_text('#fmsg')
        await guina.locator('[data-mt="201|Docente Tutor"]').click(); await guina.locator('[data-mt="202|Docente Tutor"]').click(); await pg.wait_for_timeout(150)
        await pg.fill('#fHi', '15:00'); await pg.fill('#fHf', '16:30'); await pg.fill('#tAct', 'Repaso de contenidos')
        await guina.locator('[data-otra]').click(); await pg.wait_for_timeout(200)
        await guina.locator('[data-p="hi"]').fill('17:00'); await guina.locator('[data-p="hf"]').fill('17:45')
        assert 'Todo listo' in await pg.inner_text('#fmsg')
        await shot('05_sesion', True)
        # el borrador sobrevive a recargar
        await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.click('#cont'); await pg.wait_for_timeout(1200)
        assert await scr() == 'ses' and 'Todo listo' in await pg.inner_text('#fmsg')
        await pg.click('#btnNext'); await pg.wait_for_timeout(1200)
        assert await scr() == 'review'; await shot('06_revision', True)
        await pg.click('#btnNext'); await pg.wait_for_timeout(2800)
        await shot('07_fin', True)
        assert len(DB) == 1, 'el registro no llegó al backend'
        d = list(DB.values())[0]
        print(json.dumps(d, ensure_ascii=False)[:1200])
        assert d['clave'] == 'niv2026' and d['sede'] == 'LPZ' and d['fac'] == 'Ciencias de la Salud' and d['hito'] == '3'
        assert d['mentor'] == {'nombre': 'Rafael Aramayo', 'programa': 'Docente Tutor'}
        it = {tuple(sorted(x['keys'])): x for x in d['items']}
        assert sorted(it) == [('201|Docente Tutor', '202|Docente Tutor')], ('solo lo marcado', sorted(it))
        g = it[('201|Docente Tutor', '202|Docente Tutor')]
        assert g['asistio'] == 'Sí' and g['hi'] == '17:00' and g['hf'] == '17:45' and g['act'] == 'Repaso de contenidos'
        assert await pg.locator('.codes div').count() == 1
        assert await pg.evaluate("localStorage.getItem('bitniv_draft1')") is None
        # ── registrar otro grupo: vuelve a la asistencia, sin marcas y con el mismo hito
        await pg.click('#otro'); await pg.wait_for_timeout(1200)
        assert await scr() == 'ses' and await pg.evaluate('visRegs().length') == 3 and await pg.evaluate('Object.keys(S.asis).length') == 0 and await pg.evaluate('S.hito') == '3'
        # ── cambiar de persona: el hermano mayor ve solo a su estudiante
        await pg.click('[data-act=prev]'); await pg.wait_for_timeout(1000)
        assert await scr() == 'mentor' and await pg.locator('#noEstoy').count() == 0
        await pg.fill('#qm', 'joseph'); await pg.wait_for_timeout(200)
        await pg.click('#mlist [data-m]'); await pg.wait_for_timeout(1500)
        assert await scr() == 'ses' and await pg.locator('.asisrow').count() == 1 and 'Histología' in await pg.inner_text('#lest')
        # ── sin conexión de verdad: 3 intentos, aviso con «Reintentar», indicador rojo; al volver la red, entra
        FALLAS['mentores'] = 6
        await pg.evaluate('PRE = null; showWelcome()'); await pg.wait_for_timeout(800)
        await pg.click('#start, #fresh'); await pg.wait_for_timeout(7000)
        assert 'Sin conexión' in await pg.inner_text('#stage') and 'off' in await pg.get_attribute('#srv', 'class'), ('aviso tras 3 intentos', FALLAS, await pg.inner_text('#stage'), await pg.evaluate('S.scr'))
        await shot('08_sin_conexion')
        FALLAS['mentores'] = 0
        await pg.click('#fin'); await pg.wait_for_timeout(1500)
        assert await scr() == 'mentor' and 'ok' in await pg.get_attribute('#srv', 'class')
        # ── envío sin conexión: queda pendiente, se ve en el inicio y llega una sola vez
        await pg.fill('#qm', 'joseph'); await pg.wait_for_timeout(200)
        await pg.click('#mlist [data-m]'); await pg.wait_for_timeout(1500)
        await pg.click('[data-hito="2"]'); await pg.locator('.asisrow [data-a="No"]').first.click(); await pg.wait_for_timeout(200)
        assert not await pg.locator('#secAct').is_visible() and await pg.locator('#tObs').is_visible(), 'nadie asistió: sin actividades, con observaciones'
        await pg.fill('#fHi', ''); await pg.fill('#fHf', ''); await pg.wait_for_timeout(150)
        assert 'hora' in (await pg.inner_text('#fmsg')).lower(), 'pide el horario aunque nadie asista'
        await pg.fill('#fHi', '08:00'); await pg.fill('#fHf', '09:30'); await pg.fill('#tObs', 'No se presentó')
        await pg.click('#btnNext'); await pg.wait_for_timeout(1000)
        antes = len(DB); FALLAS['post'] = 99; FALLAS['mentores'] = 0
        await page_route_block(pg)
        await pg.click('#btnNext')
        t_ini = time.time()
        for _ in range(120):
            await pg.wait_for_timeout(500)
            if await pg.evaluate("JSON.parse(localStorage.getItem('bitniv_cola1')||'[]').length") == 1: break
        print('tiempo hasta quedar en cola: %.1f s' % (time.time() - t_ini))
        await pg.wait_for_timeout(500)
        assert len(DB) == antes and await pg.evaluate("JSON.parse(localStorage.getItem('bitniv_cola1')||'[]').length") == 1, ('quedó en la cola', len(DB), antes, await pg.evaluate("localStorage.getItem('bitniv_cola1')"), await pg.inner_text('#stage'))
        await pg.evaluate('showWelcome()'); await pg.wait_for_timeout(800)
        assert 'Tienes 1 registro sin enviar' in await pg.inner_text('#pendBox')
        await shot('09_pendiente')
        FALLAS['post'] = 0; await page_route_unblock(pg)
        await pg.click('#pendGo'); await pg.wait_for_timeout(3000)
        assert len(DB) == antes + 1 and await pg.inner_text('#pendBox') == '', 'se envió una vez y el aviso desaparece'
        ult = list(DB.values())[-1]['items'][0]
        assert ult['asistio'] == 'No' and ult['hi'] == '08:00' and ult['hf'] == '09:30' and ult['fecha'] and ult['obs'] == 'No se presentó', ult
        await pg.click('#pendGo') if await pg.locator('#pendGo').count() else None
        assert len(DB) == antes + 1
        assert VIAS and 'jsonp' not in VIAS, ('las consultas deben ir por fetch', VIAS)
        assert not errs, errs
        print('OK · errores JS:', errs)
        await b.close()

asyncio.run(main())
