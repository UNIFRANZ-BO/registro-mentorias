"""Prueba de punta a punta de la app con un backend simulado (no toca la hoja real).
Requisitos: pip install playwright && playwright install chromium
Uso: python tests/e2e_test.py [ancho]   (390 por defecto; genera capturas en tests/shots/)
"""
import asyncio, json, pathlib, sys, unicodedata
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SHOTS = RAIZ / 'tests' / 'shots'; SHOTS.mkdir(exist_ok=True)
API = 'https://script.google.com/macros/s/TESTID/exec'
W = int(sys.argv[1]) if len(sys.argv) > 1 else 390
DB = {}
MENTOR = 'doc.juanperez.lopez.ga@unifranz.edu.bo'
CARR = [{'cod': 'SIS', 'nombre': 'Ingeniería de Sistemas'}, {'cod': 'NGE', 'nombre': 'Negocios y Gestión Empresarial'}, {'cod': 'MED', 'nombre': 'Medicina'}]
MATS = [['PRG-111 (P)', 'Fundamentos de Programación', 'SIS', 1, 2026], ['PIN-111 (P)', 'Proyecto Integrador I', 'SIS', 1, 2026], ['BDD-311 (P)', 'Bases de Datos', 'SIS', 3, 2026],
        ['IGC-111 (C)', 'Introducción a la Gestión Cuantitativa', 'NGE', 1, 2026], ['PIN-111 (P)', 'Proyecto Integrador I', 'NGE', 1, 2026], ['ANA-111 (P)', 'Anatomía Humana', 'MED', '', 2026]]
EST = [{'id': 'est.ronald.mendoza.va@unifranz.edu.bo', 'nombre': 'Ronald Mendoza Vargas', 'ci': '•••660', 'sede': 'CBB', 'sede_nombre': 'Cochabamba', 'carrera_cod': 'SIS', 'carrera': 'Ingeniería de Sistemas', 'plan': 2026, '_ci': '6530660'},
       {'id': 'est.anamaria.rojas.va@unifranz.edu.bo', 'nombre': 'Ana Maria Rojas Vargas', 'ci': '•••990', 'sede': 'CBB', 'sede_nombre': 'Cochabamba', 'carrera_cod': 'NGE', 'carrera': 'Negocios y Gestión Empresarial', 'plan': 2026, '_ci': '7788990'}]
norm = lambda s: unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode()

async def backend(route, req):
    q = parse_qs(urlparse(req.url).query)
    if req.method == 'POST':
        d = json.loads(req.post_data)['data']
        DB[d['id']] = d
        return await route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, body=json.dumps({'ok': True, 'id': d['id'], 'filas': 4, 'duplicados': 0}))
    a, cb = q.get('action', ['ping'])[0], q.get('callback', [''])[0]
    if a == 'validar':
        out = ({'ok': True, 'habilitado': True, 'hitos': ['2', '3', '4'], 'manual': True, 'todas_sedes': False, 'previos': {'2': 4}, 'carreras': CARR, 'materias': MATS,
                'mentor': {'nombre': 'Juan', 'nombre_completo': 'Juan Perez Lopez', 'sede': 'CBB', 'sede_nombre': 'Cochabamba', 'carrera_cod': 'SIS', 'carrera': 'Ingeniería de Sistemas', 'plan': 2026, 'programa': 'Docente Tutor'}}
               if q['correo'][0] == MENTOR else {'ok': True, 'habilitado': False, 'motivo': 'no_encontrado'})
    elif a == 'buscar':
        t = norm(q['q'][0]); dig = ''.join(c for c in t if c.isdigit())
        r = [e for e in EST if (e['_ci'] == dig if len(dig) >= 5 else all(any(p.startswith(w) for p in norm(e['nombre']).split()) for w in t.split()))]
        out = {'ok': True, 'resultados': [{k: v for k, v in e.items() if k != '_ci'} for e in r], 'mas': False}
    else:
        out = {'ok': True, 'existe': q.get('id', [''])[0] in DB}
    await route.fulfill(status=200, headers={'Content-Type': 'application/javascript'}, body=f'{cb}({json.dumps(out)});')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={'width': W, 'height': 844 if W < 600 else 800}, is_mobile=W < 600, has_touch=W < 600)).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('https://script.google.com/**', backend)
        url = (RAIZ / 'index.html').as_uri() + '?api=' + API
        await pg.goto(url); await pg.wait_for_timeout(1500)
        shot = lambda n, full=False: pg.screenshot(path=str(SHOTS / f'{W}_{n}.png'), full_page=full)
        scr = lambda: pg.evaluate('S.scr')
        await shot('00_bienvenida')
        await pg.click('#start'); await pg.wait_for_timeout(1000)
        await pg.fill('#mailIn', 'nadie@unifranz.edu.bo'); await pg.click('#btnVerify'); await pg.wait_for_timeout(1300)
        assert 'No encontramos' in await pg.inner_text('#mailMsg')
        await pg.fill('#mailIn', ' DOC.JuanPerez.Lopez.ga@unifranz.edu.bo '); await pg.click('#btnVerify'); await pg.wait_for_timeout(2200)
        assert await scr() == 'hito', await scr()
        assert 'Ya registraste 4' in await pg.inner_text('#stage'); await shot('01_hito')
        await pg.click('.opt[data-v="3"]'); await pg.wait_for_timeout(1500)
        assert await scr() == 'hub'; await shot('02_hub_vacio')

        # ── estudiante 1: búsqueda por nombre, 2 materias, asistió, sesión, actividades
        await pg.click('#btnAdd'); await pg.wait_for_timeout(900)
        await pg.fill('#q', 'ronald mend'); await pg.wait_for_timeout(1300)
        await shot('03_buscar')
        await pg.click('#sres .opt'); await pg.wait_for_timeout(1500)
        assert await scr() == 'mat', await scr()
        assert await pg.locator('#mwrap .opt').count() == 3, 'materias propias de SIS'
        await pg.click('#mwrap .opt[data-k="PRG-111 (P)|SIS"]'); await pg.click('#mwrap .opt[data-k="BDD-311 (P)|SIS"]')
        await pg.click('#mtg'); await pg.fill('#mq', 'gestion'); await pg.wait_for_timeout(400)
        assert await pg.locator('#mwrap .opt').count() == 1, 'búsqueda en todas las carreras'
        await shot('04_materias')
        await pg.click('#mtg'); await pg.wait_for_timeout(300)
        await pg.click('#btnNext'); await pg.wait_for_timeout(1000)
        assert await scr() == 'asis'
        await pg.click('.duo .opt[data-v="Sí"]'); await pg.wait_for_timeout(1500)
        assert await scr() == 'ses';
        await pg.click('#btnNext'); await pg.wait_for_timeout(500)
        assert await scr() == 'ses', 'sin horas no debe avanzar'
        await pg.fill('#fHi', '15:00'); await pg.fill('#fHf', '14:00'); await pg.wait_for_timeout(200)
        assert 'posterior' in await pg.inner_text('#dur')
        await pg.fill('#fHf', '16:30'); await pg.wait_for_timeout(200)
        assert '1 h 30 min' in await pg.inner_text('#dur'); await shot('05_sesion')
        await pg.click('#btnNext'); await pg.wait_for_timeout(1000)
        assert await scr() == 'act'
        await pg.click('.achip[data-a="Repaso de contenidos"]'); await pg.click('.achip[data-a="Aclaración de dudas"]')
        assert await pg.input_value('#tAct') == 'Repaso de contenidos; Aclaración de dudas'
        await pg.click('.achip[data-a="Repaso de contenidos"]')
        assert await pg.input_value('#tAct') == 'Aclaración de dudas', await pg.input_value('#tAct')
        await pg.fill('#tObs', 'Necesita más práctica.'); await shot('06_actividades')
        await pg.click('#btnNext'); await pg.wait_for_timeout(1300)
        assert await scr() == 'hub' and await pg.evaluate('S.items.length') == 1

        # ── el borrador sobrevive a recargar la página
        await pg.reload(); await pg.wait_for_timeout(1500)
        assert '1 estudiante' in await pg.inner_text('.resume')
        await pg.click('#cont'); await pg.wait_for_timeout(1200)
        assert await scr() == 'hub' and await pg.evaluate('S.items.length') == 1

        # ── estudiante 2: por CI, no asistió → vuelve solo a la lista
        await pg.click('#btnAdd'); await pg.wait_for_timeout(900)
        await pg.fill('#q', '7788990'); await pg.press('#q', 'Enter'); await pg.wait_for_timeout(900)
        await pg.click('#sres .opt'); await pg.wait_for_timeout(1500)
        await pg.click('#mwrap .opt[data-k="IGC-111 (C)|NGE"]'); await pg.click('#btnNext'); await pg.wait_for_timeout(1000)
        await pg.click('.duo .opt[data-v="No"]'); await pg.wait_for_timeout(1600)
        assert await scr() == 'hub' and await pg.evaluate('S.items.length') == 2
        # ── el mismo estudiante no puede repetirse
        await pg.click('#btnAdd'); await pg.wait_for_timeout(900)
        await pg.fill('#q', 'ronald'); await pg.wait_for_timeout(1300); await pg.click('#sres .opt'); await pg.wait_for_timeout(500)
        assert 'ya está en la lista' in await pg.inner_text('#toast')
        # ── estudiante 3: registrado a mano, copia fecha/horario y actividades del anterior
        await pg.click('#tgMan'); await pg.fill('#mCi', '9876543'); await pg.fill('#mNom', 'Pedro Gomez Ruiz'); await pg.select_option('#mCar', 'NGE')
        await shot('07_manual')
        await pg.click('#btnNext'); await pg.wait_for_timeout(1000)
        assert await scr() == 'mat'
        await pg.click('#mwrap .opt[data-k="PIN-111 (P)|NGE"]'); await pg.click('#btnNext'); await pg.wait_for_timeout(1000)
        await pg.click('.duo .opt[data-v="Sí"]'); await pg.wait_for_timeout(1500)
        await pg.click('#cpy'); assert await pg.input_value('#fHi') == '15:00'
        await pg.click('#btnNext'); await pg.wait_for_timeout(1000)
        await pg.click('#cpy'); await pg.click('#btnNext'); await pg.wait_for_timeout(1300)
        assert await pg.evaluate('S.items.length') == 3
        await shot('08_hub', True)
        # ── editar el 2 (cambiar a «asistió») y volver a «No»: no deben quedar datos de sesión
        await pg.click('[data-ed="1"]'); await pg.wait_for_timeout(900)
        assert await scr() == 'est'
        await pg.click('#btnNext'); await pg.wait_for_timeout(900); await pg.click('#btnNext'); await pg.wait_for_timeout(900)
        await pg.click('.duo .opt[data-v="No"]'); await pg.wait_for_timeout(1600)
        assert await scr() == 'hub' and await pg.evaluate('S.items.length') == 3

        await pg.click('#btnNext'); await pg.wait_for_timeout(1200)
        assert await scr() == 'review'; await shot('09_revision', True)
        await pg.click('#btnNext'); await pg.wait_for_timeout(3000)
        await shot('10_fin')
        assert len(DB) == 1, 'el registro no llegó al backend'
        d = list(DB.values())[0]
        print(json.dumps(d, ensure_ascii=False)[:1500])
        assert d['id'].startswith('ME-') and d['hito'] == '3' and d['correo'] == MENTOR and len(d['items']) == 3
        i1, i2, i3 = d['items']
        assert i1['est'] == EST[0]['id'] and [m['cod'] for m in i1['materias']] == ['PRG-111 (P)', 'BDD-311 (P)'] and i1['asistio'] == 'Sí'
        assert i1['hi'] == '15:00' and i1['hf'] == '16:30' and i1['act'] == 'Aclaración de dudas' and i1['obs'] == 'Necesita más práctica.'
        assert i2['asistio'] == 'No' and 'fecha' not in i2 and 'act' not in i2
        assert 'est' not in i3 and i3['manual']['ci'] == '9876543' and i3['manual']['carrera_cod'] == 'NGE' and i3['hi'] == '15:00' and i3['act'] == 'Aclaración de dudas'
        assert await pg.evaluate("localStorage.getItem('regment_draft1')") is None, 'el borrador debe borrarse al enviar'
        await pg.click('#otro'); await pg.wait_for_timeout(1200)
        assert await scr() == 'hub' and await pg.evaluate('S.items.length') == 0 and await pg.evaluate('S.hito') == '3'
        assert not errs, errs
        print('OK · errores JS:', errs)
        await b.close()

asyncio.run(main())
