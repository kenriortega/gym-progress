#!/usr/bin/env python3
import math
import random
import struct
import sys
import wave

SAMPLE_RATE = 44_100
DURATION = 10.5
BPM = 116
BEAT = 60.0 / BPM
BAR = BEAT * 4
TAU = math.tau


def local_time(t, step, offset=0.0):
    shifted = t - offset
    return shifted - math.floor(shifted / step) * step


def kick(dt):
    if dt < 0 or dt > 0.46:
        return 0.0
    env = math.exp(-dt * 9.2)
    phase = TAU * (47.0 * dt + 45.0 * (1.0 - math.exp(-dt * 18.0)) / 18.0)
    body = math.sin(phase)
    soft_click = math.sin(TAU * 125.0 * dt) * math.exp(-dt * 58.0)
    return 0.72 * body * env + 0.055 * soft_click


def shaker(dt, noise, accent=1.0):
    if dt < 0 or dt > 0.085:
        return 0.0
    metallic = 0.42 * math.sin(TAU * 7350.0 * dt) + 0.25 * math.sin(TAU * 9100.0 * dt)
    return 0.048 * accent * math.exp(-dt * 50.0) * (0.72 * noise + metallic)


def open_hat(dt, noise):
    if dt < 0 or dt > 0.31:
        return 0.0
    shimmer = math.sin(TAU * 6900.0 * dt) + 0.5 * math.sin(TAU * 8700.0 * dt)
    return 0.044 * math.exp(-dt * 13.0) * (0.55 * noise + 0.45 * shimmer)


def rim(dt):
    if dt < 0 or dt > 0.11:
        return 0.0
    return 0.085 * math.exp(-dt * 38.0) * (
        math.sin(TAU * 520.0 * dt) + 0.45 * math.sin(TAU * 1260.0 * dt)
    )


def drum(dt, frequency, strength=1.0):
    if dt < 0 or dt > 0.36:
        return 0.0
    pitch_drop = frequency + 32.0 * math.exp(-dt * 21.0)
    tone = math.sin(TAU * pitch_drop * dt) + 0.24 * math.sin(TAU * pitch_drop * 1.94 * dt)
    return 0.12 * strength * math.exp(-dt * 10.0) * tone


def bass(dt, frequency):
    if dt < 0 or dt > BEAT * 1.35:
        return 0.0
    attack = min(1.0, dt / 0.025)
    release = math.exp(-dt * 2.9)
    fundamental = math.sin(TAU * frequency * dt)
    second = 0.16 * math.sin(TAU * frequency * 2.0 * dt)
    return 0.19 * attack * release * math.tanh(1.35 * (fundamental + second))


def kalimba(dt, frequency):
    if dt < 0 or dt > 1.15:
        return 0.0
    attack = min(1.0, dt / 0.008)
    decay = math.exp(-dt * 3.8)
    tone = (
        math.sin(TAU * frequency * dt)
        + 0.30 * math.sin(TAU * frequency * 2.01 * dt)
        + 0.12 * math.sin(TAU * frequency * 4.02 * dt)
    )
    return 0.052 * attack * decay * tone


def pad(t):
    # Original A-minor voicing with slow movement and a soft sunset texture.
    chord_a = (110.00, 130.81, 164.81, 220.00)
    chord_f = (87.31, 130.81, 174.61, 220.00)
    chord = chord_a if int(t / (BAR * 2)) % 2 == 0 else chord_f
    swell = 0.55 + 0.45 * math.sin(math.pi * ((t % (BAR * 2)) / (BAR * 2))) ** 2
    return 0.020 * swell * sum(
        math.sin(TAU * f * t + idx * 0.61 + 0.04 * math.sin(TAU * 0.18 * t))
        for idx, f in enumerate(chord)
    )


def texture(t, noise):
    breath = 0.008 * noise * (0.45 + 0.55 * math.sin(TAU * 0.10 * t) ** 2)
    distant = 0.009 * math.sin(TAU * 392.0 * t + 1.4 * math.sin(TAU * 0.07 * t))
    return breath + distant


def synth(t, noise):
    value = pad(t) + texture(t, noise)

    # Deep four-on-the-floor pulse.
    value += kick(local_time(t, BEAT))

    # Swung shakers and a restrained off-beat hat.
    eighth = BEAT / 2.0
    step = int(t / eighth)
    swing_offset = 0.045 if step % 2 else 0.0
    value += shaker(local_time(t, eighth, swing_offset), noise, 1.10 if step % 2 else 0.72)
    value += open_hat(local_time(t, BEAT, BEAT / 2.0), noise)

    # Sparse rim and organic hand-drum conversation.
    value += rim(local_time(t, BAR, BEAT * 1.48))
    value += rim(local_time(t, BAR, BEAT * 3.54)) * 0.78
    bar_t = t % BAR
    for offset, freq, strength in (
        (BEAT * 0.72, 174.0, 0.82),
        (BEAT * 1.68, 218.0, 0.70),
        (BEAT * 2.42, 154.0, 0.94),
        (BEAT * 3.28, 202.0, 0.74),
        (BEAT * 3.70, 242.0, 0.56),
    ):
        value += drum(bar_t - offset, freq, strength)

    # Warm syncopated bass, intentionally minimal.
    bass_events = (
        (0.00, 55.00),
        (0.78, 55.00),
        (1.52, 65.41),
        (2.46, 49.00),
        (3.20, 55.00),
    )
    for beat_offset, freq in bass_events:
        event = beat_offset * BEAT
        dt = (t % (BAR * 2)) - event
        if dt < 0:
            dt += BAR * 2
        value += bass(dt, freq)

    # Airy, original kalimba motif; no melody is taken from the reference.
    motif = ((0.34, 440.00), (1.84, 523.25), (2.66, 659.25), (3.42, 523.25))
    for beat_offset, freq in motif:
        value += kalimba(bar_t - beat_offset * BEAT, freq)

    fade_in = min(1.0, t / 0.55)
    fade_out = min(1.0, max(0.0, DURATION - t) / 0.85)
    return math.tanh(value * 1.18) * fade_in * fade_out


def main(path):
    random.seed(1162026)
    total = int(SAMPLE_RATE * DURATION)
    delay_short = int(SAMPLE_RATE * 0.019)
    delay_long = int(SAMPLE_RATE * 0.173)
    history = [0.0] * (delay_long + 1)

    with wave.open(path, "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        frames = bytearray()

        for index in range(total):
            t = index / SAMPLE_RATE
            noise = random.uniform(-1.0, 1.0)
            dry = synth(t, noise)
            history[index % len(history)] = dry
            short = history[(index - delay_short) % len(history)]
            long = history[(index - delay_long) % len(history)]
            pan = 0.075 * math.sin(TAU * t / 4.8)
            left = dry * (0.88 - pan) + short * 0.07 + long * 0.08
            right = dry * (0.88 + pan) + short * 0.11 + long * 0.055
            left = max(-0.98, min(0.98, left))
            right = max(-0.98, min(0.98, right))
            frames.extend(struct.pack("<hh", int(left * 32767), int(right * 32767)))

        output.writeframes(frames)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Uso: generate-deep-afro-house.py <output.wav>")
    main(sys.argv[1])
