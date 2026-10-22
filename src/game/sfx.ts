export function createSfx() {
  let ctx: AudioContext | null = null;

  function ac() {
    if (typeof AudioContext === "undefined") return null;
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function tone(freq: number, dur: number, type: OscillatorType, gain: number, at = 0) {
    const a = ac();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    const t = a.currentTime + at;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  return {
    unlock() {
      try {
        ac();
      } catch {
        ctx = null;
      }
    },
    step() {
      tone(78 + Math.random() * 26, 0.05, "sine", 0.025);
    },
    pickup() {
      const a = ac();
      if (!a) return;
      const o = a.createOscillator();
      const g = a.createGain();
      const t = a.currentTime;
      o.type = "triangle";
      o.frequency.setValueAtTime(480, t);
      o.frequency.exponentialRampToValueAtTime(860, t + 0.09);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g);
      g.connect(a.destination);
      o.start(t);
      o.stop(t + 0.18);
    },
    gate() {
      tone(392, 0.22, "sine", 0.04);
      tone(523, 0.28, "sine", 0.03, 0.08);
    },
    boo() {
      tone(340, 0.16, "sine", 0.05);
      tone(168, 0.42, "triangle", 0.045, 0.06);
    },
    moan() {
      tone(150, 0.32, "sine", 0.028);
      tone(96, 0.46, "triangle", 0.022, 0.08);
    },
    shot() {
      tone(180, 0.04, "square", 0.04);
      tone(90, 0.07, "sawtooth", 0.03, 0.01);
    },
    hit() {
      tone(520, 0.05, "square", 0.03);
      tone(240, 0.08, "triangle", 0.025, 0.02);
    },
    slash() {
      tone(240, 0.05, "sawtooth", 0.03);
      tone(130, 0.08, "triangle", 0.025, 0.02);
    },
    cut() {
      tone(620, 0.07, "square", 0.028);
      tone(180, 0.14, "sawtooth", 0.035, 0.02);
    },
    hurt() {
      tone(72, 0.26, "sawtooth", 0.055);
      tone(46, 0.38, "sine", 0.045, 0.04);
    },
    lose() {
      tone(220, 0.24, "triangle", 0.05);
      tone(146, 0.36, "sine", 0.04, 0.1);
      tone(92, 0.48, "sine", 0.035, 0.2);
    },
    win() {
      tone(523, 0.26, "sine", 0.05, 0);
      tone(659, 0.28, "sine", 0.05, 0.09);
      tone(784, 0.36, "sine", 0.045, 0.18);
    },
    dispose() {
      const c = ctx;
      ctx = null;
      if (c) void c.close();
    },
  };
}
