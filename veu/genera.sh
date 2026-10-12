#!/bin/bash
# Genera con la voz de la Joana (edge-tts, gratis) un MP3 por cada texto que el Dojo dice en voz alta.
# Ejecutar después de cambiar cualquier texto hablado: las pruebas fallan si falta alguno.
# Uso: veu/genera.sh
set -e
cd "$(dirname "$0")"
T=../tests
LIBS=~/.local/share/dojo-tools/test/libs/usr/lib/x86_64-linux-gnu
[ -d "$LIBS" ] && export LD_LIBRARY_PATH="$LIBS:$LD_LIBRARY_PATH"
NODE_PATH=$T/node_modules node textos.js > textos.json
UV=$(command -v uv || echo ~/.local/share/dojo-tools/uv-x86_64-unknown-linux-gnu/uv)
"$UV" run -q --with edge-tts python -I - <<'PY'
import json, os, re, subprocess, time

def clave(t):
    # La misma que claveVeu() de index.html (FNV-1a de 32 bits sobre cada carácter)
    h = 0x811c9dc5
    for ch in t:
        h = ((h ^ ord(ch)) * 0x01000193) & 0xffffffff
    return f"{h:08x}"

def para_decir(t):
    # Solo cambia cómo se pronuncia; la clave sale del texto tal cual
    t = t.replace('×', ' per ').replace('−', ' menys ').replace('=', ' és ').replace('+', ' més ')
    t = t.replace('«', '').replace('»', '')
    return re.sub(r'\s+', ' ', t).strip()

textos = json.load(open('textos.json'))
claves = []
for t in textos:
    k = clave(t)
    claves.append(k)
    if not os.path.exists(f'{k}.mp3'):
        # El servicio limita las peticiones (403): una cada 5 s y, si falla, reintentar con más espera
        for intento in range(4):
            r = subprocess.run(['edge-tts', '--voice', 'ca-ES-JoanaNeural', '--text', para_decir(t), '--write-media', f'{k}.tmp'], capture_output=True)
            if r.returncode == 0 and os.path.getsize(f'{k}.tmp') > 1000:
                os.replace(f'{k}.tmp', f'{k}.mp3'); print('nou:', k, t[:60]); break
            time.sleep(30 * (intento + 1))
        else:
            if os.path.exists(f'{k}.tmp'): os.remove(f'{k}.tmp')
            raise SystemExit('edge-tts no responde (403): probar más tarde')
        time.sleep(5)
for f in os.listdir('.'):
    if f.endswith('.mp3') and f[:-4] not in claves:
        os.remove(f); print('esborrat:', f)
json.dump(sorted(k for k in claves if os.path.exists(f'{k}.mp3')), open('index.json', 'w'))
print(len(claves), 'textos')
PY
rm -f textos.json
