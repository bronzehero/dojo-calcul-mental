"""Voz en catalán con Matxa-TTS v2 (BSC, gratis, en local): un MP3 por texto.
Lo llama veu/genera.sh con el python del venv de Matxa (~/.local/share/matxa-tts/venv).
Uso: python matxa.py <pendientes.json>   (lista de [clave, texto]; escribe <clave>.mp3 en este directorio)
Voz: modelo central, id 0 (VEU_MATXA para cambiarla).
"""
import json, os, re, sys, types
from pathlib import Path

REPO = Path.home() / '.local/share/matxa-tts/Matcha-TTS'
sys.path.insert(0, str(REPO))
for _m in ('gdown', 'wget'):
    sys.modules.setdefault(_m, types.ModuleType(_m))

import av  # noqa: E402
import numpy as np  # noqa: E402
import torch  # noqa: E402
from num2words import num2words  # noqa: E402
from vocos import Vocos  # noqa: E402
from vocos.spectral_ops import ISTFT  # noqa: E402
from matcha.models.matcha_tts import MatchaTTS  # noqa: E402
from matcha.text import text_to_sequence  # noqa: E402
from matcha.utils.utils import intersperse  # noqa: E402

SR = 22050
VEU = int(os.environ.get('VEU_MATXA', 0))

# Nombre de les lletres soltes («amb h», «abans de b»): Matxa no diu una consonant sola
LLETRES = {'b': 'be', 'c': 'ce', 'ç': 'ce trencada', 'd': 'de', 'f': 'efa', 'g': 'ge', 'h': 'hac', 'j': 'jota',
           'k': 'ca', 'l': 'ela', 'm': 'ema', 'n': 'ena', 'p': 'pe', 'q': 'cu', 'r': 'erra', 's': 'essa', 't': 'te',
           'v': 've', 'w': 've doble', 'x': 'ics', 'z': 'zeta'}


def per_matxa(t):
    """Solo cambia cómo se pronuncia (la clave sale del texto original)."""
    t = re.sub(r'\bdues s\b', 'dues esses', t)
    t = re.sub(r"(?<![\w'’·-])([bcçdfghjklmnpqrstvwxz])(?![\w'’·-])", lambda m: LLETRES[m.group(1)], t)
    t = re.sub(r'\d+', lambda m: num2words(int(m.group()), lang='ca'), t)
    t = t.replace('…', ',')
    return re.sub(r'\s+', ' ', t).strip()


def trossos(t, maxim=300):
    """Frases enteras juntas hasta ~300 caracteres: suena más seguido que frase a frase."""
    out, cur = [], ''
    for f in re.split(r'(?<=[.!?:])\s+', t):
        if cur and len(cur) + len(f) + 1 > maxim:
            out.append(cur); cur = f
        else:
            cur = f'{cur} {f}'.strip()
    return out + ([cur] if cur else [])


dev = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
istft = ISTFT(n_fft=1024, hop_length=256, win_length=1024, padding='same').to(dev)
vocos = Vocos.from_pretrained('projecte-aina/alvocat-vocos-22khz', device=dev).to(dev)
model = MatchaTTS.from_pretrained('BSC-LT/matxa-tts-v2-ca-central-graphemes', token_hf=None, device=dev).to(dev).eval()


@torch.inference_mode()
def tts(text):
    x = torch.tensor(intersperse(text_to_sequence(text, ['basic_cleaners']), 0), dtype=torch.long, device=dev)[None]
    xl = torch.tensor([x.shape[-1]], dtype=torch.long, device=dev)
    mel = model.synthesise(x, xl, n_timesteps=32, temperature=0.667, spks=torch.tensor([VEU], device=dev),
                           length_scale=1.0, sway_sampling_coef=-1.0)['mel']
    _, spec = vocos.decode(mel)
    _, bias = vocos.decode(torch.zeros_like(mel))
    s, b = torch.view_as_real(spec), torch.view_as_real(bias)
    mag = torch.clamp(torch.sqrt(s.pow(2).sum(-1)) - torch.sqrt(b.pow(2).sum(-1)) * 0.0025, 0.0)
    ang = torch.atan2(s[..., -1], s[..., 0])
    return istft(torch.complex(mag * torch.cos(ang), mag * torch.sin(ang))).cpu().squeeze().numpy()


def mp3(y, fitxer):
    y = np.concatenate([np.zeros(int(SR * 0.1), np.float32), y, np.zeros(int(SR * 0.15), np.float32)])
    pcm = (np.clip(y, -1, 1) * 32767).astype(np.int16)
    with av.open(fitxer, 'w', format='mp3') as o:
        st = o.add_stream('libmp3lame', rate=SR, layout='mono')
        st.bit_rate = 64000
        fr = av.AudioFrame.from_ndarray(pcm[None], format='s16', layout='mono')
        fr.sample_rate = SR
        for p in st.encode(fr):
            o.mux(p)
        for p in st.encode(None):
            o.mux(p)


dir_ = os.path.dirname(os.path.abspath(__file__))
pendents = json.load(open(sys.argv[1], encoding='utf-8'))
for n, (k, t) in enumerate(pendents, 1):
    parts = []
    for tros in trossos(per_matxa(t)):
        parts += [tts(tros), np.zeros(int(SR * 0.3), np.float32)]
    mp3(np.concatenate(parts[:-1]), os.path.join(dir_, f'{k}.tmp.mp3'))
    os.replace(os.path.join(dir_, f'{k}.tmp.mp3'), os.path.join(dir_, f'{k}.mp3'))
    print(f'matxa {n}/{len(pendents)}: {k} {t[:60]}', flush=True)
