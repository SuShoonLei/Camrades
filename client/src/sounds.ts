/** Tiny Web Audio synth — no asset files needed. */

type Tone = { freq: number; dur: number; type?: OscillatorType; gain?: number };

function playTones(tones: Tone[], stagger = 0) {
  try {
    const ctx = new AudioContext();
    tones.forEach((t, i) => {
      const start = ctx.currentTime + i * stagger;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = t.type ?? 'sine';
      osc.frequency.value = t.freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(t.gain ?? 0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + t.dur + 0.05);
    });
    setTimeout(() => void ctx.close(), 2000);
  } catch {
    // Audio may be blocked until user gesture
  }
}

export const sfx = {
  turnStart: () =>
    playTones(
      [
        { freq: 392, dur: 0.12 },
        { freq: 523, dur: 0.12 },
        { freq: 659, dur: 0.2 },
      ],
      0.1,
    ),
  correct: () =>
    playTones(
      [
        { freq: 523, dur: 0.1, type: 'triangle' },
        { freq: 784, dur: 0.18, type: 'triangle', gain: 0.22 },
      ],
      0.08,
    ),
  turnEnd: () =>
    playTones(
      [
        { freq: 440, dur: 0.15 },
        { freq: 349, dur: 0.25 },
      ],
      0.12,
    ),
  gameOver: () =>
    playTones(
      [
        { freq: 523, dur: 0.12 },
        { freq: 659, dur: 0.12 },
        { freq: 784, dur: 0.12 },
        { freq: 1046, dur: 0.35, type: 'triangle', gain: 0.2 },
      ],
      0.1,
    ),
};
