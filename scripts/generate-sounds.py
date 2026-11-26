"""Generates VYNR's original UI sounds procedurally (no samples, no third-party audio).

Run: python3 scripts/generate-sounds.py  -> writes assets/sounds/*.wav
Every sound is a few additive-synthesis partials with an exponential decay, so
the files are tiny and fully owned by the project.
"""
import math
import os
import struct
import wave

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')


def tone(freq, start, dur, amp=0.5, decay=6.0, partials=((1, 1.0), (2, 0.25), (3, 0.08)), attack=0.006):
    n0, n = int(start * RATE), int(dur * RATE)
    out = {}
    for i in range(n):
        t = i / RATE
        env = (min(1.0, t / attack)) * math.exp(-decay * t)
        s = sum(a * math.sin(2 * math.pi * freq * k * t) for k, a in partials)
        out[n0 + i] = out.get(n0 + i, 0) + amp * env * s
    return out


def mix(length, *layers):
    buf = [0.0] * int(length * RATE)
    for layer in layers:
        for i, v in layer.items():
            if i < len(buf):
                buf[i] += v
    peak = max(1e-9, max(abs(v) for v in buf))
    gain = 0.85 / peak
    # Short fade-out to avoid a click at the end.
    fade = int(0.02 * RATE)
    for i in range(fade):
        buf[-1 - i] *= i / fade
    return [v * gain for v in buf]


def write(name, samples):
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in samples))


# Shutter: a soft two-step click-tick.
write('shutter.wav', mix(0.12, tone(1800, 0, 0.05, 0.4, 60, ((1, 1), (1.5, 0.4))), tone(2600, 0.035, 0.06, 0.3, 70)))
# Identified: rising two-note glint (A5 -> E6).
write('identified.wav', mix(0.45, tone(880, 0, 0.35, 0.5, 9), tone(1318.5, 0.08, 0.37, 0.5, 8)))
# Discovery: a three-note major arpeggio with a soft shimmer.
write('discovery.wav', mix(0.9, tone(659.3, 0, 0.6, 0.45, 6), tone(830.6, 0.09, 0.6, 0.45, 6), tone(987.8, 0.18, 0.7, 0.5, 5),
                          tone(1975.5, 0.18, 0.6, 0.08, 7, ((1, 1),))))
# Rare and above: wider arpeggio ending on an octave, with a low swell underneath.
write('discovery-rare.wav', mix(1.25, tone(220, 0, 1.2, 0.25, 2.5, ((1, 1), (2, 0.5))), tone(659.3, 0.0, 0.6, 0.4, 6), tone(987.8, 0.1, 0.6, 0.4, 6),
                               tone(1318.5, 0.2, 0.7, 0.45, 5), tone(1760, 0.32, 0.9, 0.45, 4), tone(3520, 0.32, 0.7, 0.06, 6, ((1, 1),))))
print('wrote', sorted(os.listdir(OUT)))
