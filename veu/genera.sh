#!/bin/bash
# Genera un MP3 por cada texto que el Dojo dice en voz alta.
# - Explicaciones e instrucciones en catalán: Matxa-TTS v2 (gratis, en local; veu/matxa.py, desde el 8/11/2026).
# - Dictados, palabras sueltas y pistas que nombran letras: la Joana (edge-tts). Matxa dice mal las palabras
#   sueltas («cervell» → «servei») y las vocales sueltas («la e» → «la a»), y en ortografía eso confunde.
# - Los textos que empiezan por «[es] » (palabras de castellano) van con una voz castellana (Elvira).
# Sin el venv de Matxa (~/.local/share/matxa-tts/venv), todo con la Joana.
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
import asyncio, json, os, re, sys, time
import edge_tts, edge_tts.constants

# Desde octubre de 2026 el servidor de siempre (speech.platform.bing.com) responde 403 a la síntesis;
# Edge 155 usa api.msedgeservices.com, que acepta el mismo token (edge-tts, issue #490 / PR #491).
# Cuando edge-tts publique la versión con el cambio, esto sobra.
URL = ('wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1'
       f'?Ocp-Apim-Subscription-Key={edge_tts.constants.TRUSTED_CLIENT_TOKEN}')
for mod in list(sys.modules.values()):
    if getattr(mod, '__name__', '').startswith('edge_tts') and hasattr(mod, 'WSS_URL'):
        mod.WSS_URL = URL

def sintetiza(texto, fichero, voz='ca-ES-JoanaNeural'):
    try:
        asyncio.run(edge_tts.Communicate(texto, voz).save(fichero))
        return True
    except Exception as e:
        print('error:', e)
        return False

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
    # El nom del grup, a l'anglesa («cat's eye»), no lletrejat en català
    t = t.replace('KATSEYE', 'Cats ai')
    # Paréntesis como pausas: «(8 + 1):» lo leía como un emoticono («cara trista»)
    t = re.sub(r'\s*[()]\s*', ', ', t)
    t = re.sub(r',\s*([:,.])', r'\1', t)
    return re.sub(r'\s+', ' ', t).strip()

LLETRA = r"(?<![\w'’·-])([bcçdfghjklmnpqrstvwxz]|ce|hac|ve|be|te|erra|essa|esses|ema)(?![\w'’·-])"
# Las que Matxa dijo mal (comprobado con Whisper el 8/11/2026)
JOANA_SEMPRE = ("Busca-ho al full d'apunts", 'porta hac: he, has', "l'iPad")

def amb_matxa(t):
    if not os.path.exists(os.path.expanduser('~/.local/share/matxa-tts/venv/bin/python')): return False
    if t.startswith('[es] ') or len(t.split()) < 4 or any(x in t for x in JOANA_SEMPRE): return False
    if re.match(r"^[\wà-ü·'-]+\. ", t): return False  # dictado: «cervell. El cervell treballa molt. cervell.»
    if re.search(r"\b(amb|de|la|el|una|dues|sempre|primer|després|davant de)\s+[aeiouàèéíòóú]\b", t): return False
    if re.search(r"(amb|la|una|dues|sempre|primer|després) " + LLETRA, t): return False
    return True

textos = json.load(open('textos.json'))
claves, per_matxa = [], []
for t in textos:
    k = clave(t)
    claves.append(k)
    if not os.path.exists(f'{k}.mp3') and amb_matxa(t):
        per_matxa.append([k, para_decir(t)])
    elif not os.path.exists(f'{k}.mp3'):
        # El servicio limita las peticiones: una cada 2 s y, si falla, reintentar con más espera
        for intento in range(4):
            es = t.startswith('[es] ')
            voz = 'es-ES-ElviraNeural' if es else 'ca-ES-JoanaNeural'
            if sintetiza(para_decir(t[5:] if es else t), f'{k}.tmp', voz) and os.path.getsize(f'{k}.tmp') > 1000:
                os.replace(f'{k}.tmp', f'{k}.mp3'); print('nou:', k, t[:60]); break
            time.sleep(30 * (intento + 1))
        else:
            if os.path.exists(f'{k}.tmp'): os.remove(f'{k}.tmp')
            raise SystemExit('edge-tts no responde: probar más tarde')
        time.sleep(2)
if per_matxa:
    json.dump(per_matxa, open('per-matxa.json', 'w'), ensure_ascii=False)
    import subprocess
    subprocess.run([os.path.expanduser('~/.local/share/matxa-tts/venv/bin/python'), '-I', 'matxa.py', 'per-matxa.json'], check=True)
    os.remove('per-matxa.json')
for f in os.listdir('.'):
    if f.endswith('.mp3') and f[:-4] not in claves:
        os.remove(f); print('esborrat:', f)
json.dump(sorted(k for k in claves if os.path.exists(f'{k}.mp3')), open('index.json', 'w'))
print(len(claves), 'textos')
PY
rm -f textos.json
