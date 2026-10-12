"""Genera index.html (archivo que se publica) a partir de src.html + logos en assets/.
Uso:  python3 build.py
"""
import base64, pathlib, re, subprocess, sys
raiz = pathlib.Path(__file__).parent
s = (raiz / 'src.html').read_text(encoding='utf-8')
b64 = lambda f: 'data:image/png;base64,' + base64.b64encode((raiz / 'assets' / f).read_bytes()).decode()
s = s.replace('__LOGO_FULL__', b64('logo_full.png')).replace('__LOGO_WORD__', b64('logo_word.png'))
(raiz / 'index.html').write_text(s, encoding='utf-8')
js = re.search(r'<script>(.*)</script>', s, re.S).group(1)
tmp = raiz / 'tests' / '.check.js'; tmp.write_text(js, encoding='utf-8')
r = subprocess.run(['node', '--check', str(tmp)], capture_output=True, text=True); tmp.unlink()
if r.returncode: print(r.stderr); sys.exit(1)
print(f'index.html generado ({len(s)//1024} KB) · sintaxis JS OK')
