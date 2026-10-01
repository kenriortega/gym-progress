#!/usr/bin/env python3
import math
import random
import struct
import sys
import wave

SAMPLE_RATE = 44_100
DURATION = 10.5
BPM = 120
BEAT = 60 / BPM
TAU = math.tau


def envelope(t, attack, decay):
    if t < 0:
        return 0.0
    if t < attack:
        return t / max(attack, 1e-6)
    return math.exp(-(t - attack) / decay)


def kick(dt):
    if dt < 0 or dt > 0.45:
        return 0.0
    env = math.exp(-dt * 10.5)
    phase = TAU * (52 * dt + 46 * (1 - math.exp(-dt * 18)) / 18)
    click = math.exp(-dt * 70) * math.sin(TAU * 170 * dt)
    return 0.90 * env * math.sin(phase) + 0.14 * click


def clap(dt, noise):
    if dt < 0 or dt > 0.24:
        return 0.0
    bursts = sum(math.exp(-((dt - center) / 0.018) ** 2) for center in (0.0, 0.028, 0.058))
    return 0.22 * bursts * noise + 0.06 * math.exp(-dt * 18) * math.sin(TAU * 190 * dt)


def hat(dt, noise, open_hat=False):
    limit = 0.22 if open_hat else 0.07
    if dt < 0 or dt > limit:
        return 0.0
    decay = 20 if open_hat else 62
    metallic = math.sin(TAU * 7_200 * dt) + 0.55 * math.sin(TAU * 9_100 * dt)
    return 0.065 * math.exp(-dt * decay) * (noise * 0.65 + metallic * 0.35)


def conga(dt, frequency, strength=1.0):
    if dt < 0 or dt > 0.30:
        return 0.0
    pitch = frequency + 42 * math.exp(-dt * 24)
    return 0.18 * strength * math.exp(-dt * 12) * math.sin(TAU * pitch * dt)


def bass(dt, frequency):
    if dt < 0 or dt > BEAT * 0.92:
        return 0.0
    env = envelope(dt, 0.012, 0.34)
    fundamental = math.sin(TAU * frequency * dt)
    harmonic = 0.32 * math.sin(TAU * frequency * 2 * dt)
    return 0.22 * env * math.tanh(1.7 * (fundamental + harmonic))


def pluck(dt, frequency):
    if dt < 0 or dt > 0.65:
        return 0.0
    env = envelope(dt, 0.004, 0.20)
    tone = (
        math.sin(TAU * frequency * dt)
        + 0.48 * math.sin(TAU * frequency * 2.01 * dt)
        + 0.22 * math.sin(TAU * frequency * 3.98 * dt)
    )
    return 0.11 * env * tone


def pad(t):
    frequencies = (110.0, 130.81, 164.81, 196.0)
    motion = 0.55 + 0.45 * math.sin(TAU * t / 8.0) ** 2
    return 0.027 * motion * sum(math.sin(TAU * f * t + i * 0.7) for i, f in enumerate(frequencies))


def previous_event(t, step):
    return t - math.floor(t / step) * step


def synth_sample(t, noise):
    value = pad(t)

    value += kick(previous_event(t, BEAT))
    value += clap(previous_event(t - BEAT, BEAT * 2), noise)
    value += hat(previous_event(t - BEAT / 2, BEAT), noise, open_hat=True)
    value += hat(previous_event(t, BEAT / 2), noise)

    bar = BEAT * 4
    conga_pattern = ((0.375, 185, 1.0), (0.875, 220, 0.8), (1.375, 170, 0.9), (1.75, 245, 0.75))
    local_bar = t % bar
    for offset, frequency, strength in conga_pattern:
        value += conga(local_bar - offset, frequency, strength)

    bass_notes = (55.0, 55.0, 65.41, 82.41, 49.0, 55.0, 73.42, 65.41)
    bass_step = BEAT
    bass_index = int(t / bass_step) % len(bass_notes)
    value += bass(previous_event(t, bass_step), bass_notes[bass_index])

    pluck_notes = (220.0, 261.63, 329.63, 293.66, 220.0, 329.63, 392.0, 261.63)
    pluck_step = BEAT / 2
    pluck_time = previous_event(t - BEAT / 4, pluck_step)
    pluck_index = int(max(0, t - BEAT / 4) / pluck_step) % len(pluck_notes)
    value += pluck(pluck_time, pluck_notes[pluck_index])

    fade_in = min(1.0, t / 0.35)
    fade_out = min(1.0, max(0.0, DURATION - t) / 0.65)
    return math.tanh(value * 1.2) * fade_in * fade_out


def main(path):
    random.seed(20260930)
    total_frames = int(SAMPLE_RATE * DURATION)
    delay = int(SAMPLE_RATE * 0.011)
    history = [0.0] * (delay + 1)

    with wave.open(path, "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        frames = bytearray()

        for index in range(total_frames):
            t = index / SAMPLE_RATE
            noise = random.uniform(-1.0, 1.0)
            mono = synth_sample(t, noise)
            history[index % len(history)] = mono
            delayed = history[(index - delay) % len(history)]
            pan = 0.12 * math.sin(TAU * t / 3.5)
            left = mono * (0.88 - pan) + delayed * 0.12
            right = mono * (0.88 + pan) + delayed * 0.12
            peak = max(abs(left), abs(right), 1.0)
            left = max(-1.0, min(1.0, left / peak))
            right = max(-1.0, min(1.0, right / peak))
            frames.extend(struct.pack("<hh", int(left * 32767), int(right * 32767)))

        output.writeframes(frames)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Uso: generate-afro-house.py <output.wav>")
    main(sys.argv[1])
