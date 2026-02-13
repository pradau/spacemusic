/**
 * Spatial Music Visualization Demo
 * Instruments on canvas; notes travel between them and trigger layered audio.
 */

import * as Tone from "tone";
import { segmentCircleCollisionT } from "./lib/collision";
import { pulseColor } from "./lib/color";
import { transposeNote } from "./lib/transpose";
import { isFiniteNumber } from "./lib/validation";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const overlay = document.getElementById("overlay") as HTMLDivElement;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;

const NOTE_SPEED = 2.5;
/** Puck moves this many pixels per frame (constant speed). */
const PUCK_SPEED = NOTE_SPEED * 2;
/** Instruments move at half the puck speed. */
const INSTRUMENT_SPEED = PUCK_SPEED / 2;
const NOTE_RADIUS = 6;
/** Distance in pixels to target instrument to count as arrived. */
const ARRIVAL_THRESHOLD = 40;
/** Pulse: radius scale range (larger = more visible breathing). */
const PULSE_RADIUS_AMOUNT = 0.18;
/** Pulse: color brightness amount (lerp toward white; higher = more noticeable). */
const PULSE_COLOR_AMOUNT = 0.5;
/** Hit feedback: draw ring for this many seconds after trigger. */
const HIT_FEEDBACK_DURATION_S = 0.25;
/** Set to true to log debug state periodically to console. */
const DEBUG_LOG = false;
const DEBUG_LOG_INTERVAL_MS = 5000;

/** One note in a riff: note name (e.g. "C4") and Tone.js duration (e.g. "8n"). */
interface RiffNote {
  note: string;
  dur: string;
}

/** Semitone offset for key: 0 = C, 1 = C#, 2 = D, ... 11 = B. */
let keySemitones = 0;

type InstrumentSound =
  | Tone.PolySynth<Tone.Synth>
  | Tone.AMSynth
  | Tone.PluckSynth
  | Tone.FMSynth
  | Tone.MonoSynth
  | Tone.Sampler;

interface InstrumentDef {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  label: string;
  synth: InstrumentSound;
  loop: Tone.Loop | null;
  /** Number of times the puck has touched this instrument (odd = playing, even = stopped). */
  touchCount: number;
  /** Transport time when this instrument was last hit (for ring feedback). */
  lastHitTime: number;
}

interface TravelingNote {
  fromId: number;
  toId: number;
  x: number;
  y: number;
}

let width = 0;
let height = 0;
let instruments: InstrumentDef[] = [];
let travelingNotes: TravelingNote[] = [];
let audioStarted = false;
/** When true, do not spawn new notes (after Quit). */
let quitted = false;
/** When false, the Quit button shows "Start" and restarts the demo. */
let demoRunning = false;
let frameCount = 0;
let lastDebugLogTime = 0;
/** User-adjustable: 1 = default puck speed. */
let puckSpeedMultiplier = 1;
/** User-adjustable: 1 = default instrument speed. */
let instrumentSpeedMultiplier = 1;

/** Master gain for all instruments; set in createInstruments so piano Sampler can connect on load. */
let masterGain: Tone.Gain | null = null;
function resize(): void {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  layoutInstruments();
}

const NUM_INSTRUMENTS = 6;

function layoutInstruments(): void {
  const centerX = width / 2;
  const centerY = height / 2;
  const r = Math.min(width, height) * 0.32;
  const n = NUM_INSTRUMENTS;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    positions.push({
      x: centerX + r * Math.cos(a),
      y: centerY + r * Math.sin(a),
    });
  }
  if (instruments.length === 0) {
    instruments = createInstruments(positions);
  } else {
    instruments.forEach((inst) => {
      inst.x = Math.max(inst.radius, Math.min(width - inst.radius, inst.x));
      inst.y = Math.max(inst.radius, Math.min(height - inst.radius, inst.y));
    });
  }
}

function updateInstruments(): void {
  const scale = instrumentSpeedMultiplier;
  instruments.forEach((inst) => {
    inst.x += inst.vx * scale;
    inst.y += inst.vy * scale;
    if (inst.x - inst.radius < 0) {
      inst.x = inst.radius;
      inst.vx = -inst.vx;
    }
    if (inst.x + inst.radius > width) {
      inst.x = width - inst.radius;
      inst.vx = -inst.vx;
    }
    if (inst.y - inst.radius < 0) {
      inst.y = inst.radius;
      inst.vy = -inst.vy;
    }
    if (inst.y + inst.radius > height) {
      inst.y = height - inst.radius;
      inst.vy = -inst.vy;
    }
  });
}

/** Per-instrument riffs: melody/bass/drums roles in C minor. Each step has note + Tone duration. */
const INSTRUMENT_RIFFS: RiffNote[][] = [
  // Piano: comping chord tones
  [
    { note: "Eb4", dur: "8n" },
    { note: "G4", dur: "8n" },
    { note: "Bb4", dur: "8n" },
    { note: "G4", dur: "8n" },
    { note: "C4", dur: "4n" },
  ],
  // Bass: walking
  [
    { note: "C2", dur: "4n" },
    { note: "Eb2", dur: "4n" },
    { note: "G2", dur: "4n" },
    { note: "Bb2", dur: "4n" },
    { note: "C3", dur: "2n" },
  ],
  // Drums: groove (pitched as low toms)
  [
    { note: "D3", dur: "8n" },
    { note: "F3", dur: "8n" },
    { note: "D3", dur: "8n" },
    { note: "F3", dur: "8n" },
    { note: "G3", dur: "4n" },
  ],
  // Trumpet: short phrase
  [
    { note: "G4", dur: "8n" },
    { note: "Bb4", dur: "8n" },
    { note: "C5", dur: "4n" },
    { note: "Bb4", dur: "8n" },
    { note: "G4", dur: "2n" },
  ],
  // Sax: melody
  [
    { note: "Eb4", dur: "8n" },
    { note: "F4", dur: "8n" },
    { note: "G4", dur: "4n" },
    { note: "Bb4", dur: "8n" },
    { note: "C5", dur: "4n" },
  ],
  // Guitar: chord stab
  [
    { note: "G3", dur: "8n" },
    { note: "Bb3", dur: "8n" },
    { note: "C4", dur: "4n" },
    { note: "Eb4", dur: "8n" },
    { note: "G4", dur: "2n" },
  ],
];

/** Per-instrument gain trim so perceived volume is roughly equal. */
const INSTRUMENT_GAIN_TRIMS = [0.6, 1.0, 0.8, 0.65, 0.7, 0.6];

function createInstruments(positions: { x: number; y: number }[]): InstrumentDef[] {
  masterGain = new Tone.Gain(0.32).toDestination();
  const colors = ["#5b9bd5", "#8b7355", "#5bd47a", "#d4a85b", "#9b5bd4", "#c95b5b"];
  const labels = ["Piano", "Bass", "Drums", "Trumpet", "Sax", "Guitar"];
  const synths: InstrumentSound[] = [
    // Piano: percussive attack, short decay, low sustain (hammer strike)
    new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.25, sustain: 0.15, release: 0.35 },
    }),
    // Bass: deep, round (upright/double bass)
    new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      filter: { type: "lowpass", frequency: 600 },
      envelope: { attack: 0.02, decay: 0.4, sustain: 0.5, release: 0.5 },
    }),
    // Drums: percussive, short decay (tom/snare-like)
    new Tone.PluckSynth({
      attackNoise: 0.6,
      dampening: 5000,
      resonance: 0.85,
      release: 0.25,
    }),
    // Trumpet: brassy, breathy attack
    new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 14,
      envelope: { attack: 0.06, decay: 0.2, sustain: 0.35, release: 0.35 },
    }),
    // Sax: reedy (FM with lower harmonicity than trumpet)
    new Tone.FMSynth({
      harmonicity: 1.8,
      modulationIndex: 10,
      envelope: { attack: 0.03, decay: 0.25, sustain: 0.5, release: 0.4 },
    }),
    // Guitar: plucked string
    new Tone.PluckSynth({
      attackNoise: 0.4,
      dampening: 3000,
      resonance: 0.95,
      release: 0.4,
    }),
  ];
  synths.forEach((synth, i) => {
    const trim = INSTRUMENT_GAIN_TRIMS[i] ?? 1;
    const instGain = new Tone.Gain(trim);
    synth.connect(instGain);
    instGain.connect(masterGain!);
  });
  return positions.map((p, i) => {
    let vx = (Math.random() - 0.5) * 2 * INSTRUMENT_SPEED;
    let vy = (Math.random() - 0.5) * 2 * INSTRUMENT_SPEED;
    if (vx === 0 && vy === 0) vx = INSTRUMENT_SPEED;
    return {
      id: i,
      x: p.x,
      y: p.y,
      vx,
      vy,
      radius: 28,
      color: colors[i] ?? "#888",
      label: labels[i] ?? String(i),
      synth: synths[i]!,
      loop: null,
      touchCount: 0,
      lastHitTime: 0,
    };
  });
}

function getRiff(inst: InstrumentDef): RiffNote[] {
  const base = INSTRUMENT_RIFFS[inst.id] ?? INSTRUMENT_RIFFS[0]!;
  if (keySemitones === 0) return base;
  return base.map((r) => ({ note: transposeNote(r.note, keySemitones), dur: r.dur }));
}

function playPatternNow(inst: InstrumentDef): void {
  const riff = getRiff(inst);
  const synth = inst.synth;
  let time = Tone.now();
  riff.forEach((r) => {
    const durSec = Tone.Time(r.dur).toSeconds();
    (synth as { triggerAttackRelease(note: string, dur: string, time?: number): void })
      .triggerAttackRelease(r.note, r.dur, time);
    time += durSec;
  });
}

function makePattern(inst: InstrumentDef): void {
  if (inst.loop) {
    inst.loop.dispose();
    inst.loop = null;
  }
  const riff = getRiff(inst);
  const synth = inst.synth;
  const totalRiffSec = riff.reduce((sum, r) => sum + Tone.Time(r.dur).toSeconds(), 0);
  const startTime = Math.max(0, Tone.Transport.seconds + 0.02);
  inst.loop = new Tone.Loop((time) => {
    let t = time;
    riff.forEach((r) => {
      const durSec = Tone.Time(r.dur).toSeconds();
      (synth as { triggerAttackRelease(note: string, dur: string, time: number): void })
        .triggerAttackRelease(r.note, r.dur, t);
      t += durSec;
    });
  }, totalRiffSec).start(startTime);
}

function stopInstrument(inst: InstrumentDef): void {
  if (inst.loop) {
    inst.loop.dispose();
    inst.loop = null;
  }
}

/** Pick a random instrument id that is not the given one. */
function randomOtherInstrumentId(currentId: number): number {
  const others = instruments.filter((i) => i.id !== currentId).map((i) => i.id);
  if (others.length === 0) return currentId;
  return others[Math.floor(Math.random() * others.length)]!;
}

/**
 * On puck arrival: increment touch count. Odd count = turn on (play); even count = turn off (stop).
 * Optionally chain by sending the puck to a random next instrument.
 */
function triggerInstrument(id: number, chain: boolean): void {
  const inst = instruments.find((i) => i.id === id);
  if (!inst || !audioStarted) return;
  inst.touchCount += 1;
  if (inst.touchCount % 2 === 1) {
    inst.lastHitTime = performance.now() * 0.001;
    playPatternNow(inst);
    makePattern(inst);
  } else {
    stopInstrument(inst);
  }
  if (chain) {
    const nextId = randomOtherInstrumentId(id);
    if (nextId !== id) sendNote(id, nextId);
  }
}

function getInstrumentAt(x: number, y: number): InstrumentDef | undefined {
  return instruments.find((inst) => {
    const dx = x - inst.x;
    const dy = y - inst.y;
    return Math.hypot(dx, dy) <= inst.radius;
  });
}

function sendNote(fromId: number, toId: number): void {
  if (fromId === toId || instruments.length === 0) return;
  const from = instruments.find((i) => i.id === fromId);
  const to = instruments.find((i) => i.id === toId);
  if (!from || !to) return;
  travelingNotes.push({
    fromId,
    toId,
    x: from.x,
    y: from.y,
  });
}

function updateNotes(): void {
  const toRemove: number[] = [];
  const minDist = 1e-6;

  travelingNotes.forEach((note, idx) => {
    if (!isFiniteNumber(note.x) || !isFiniteNumber(note.y)) {
      toRemove.push(idx);
      return;
    }
    const targetInst = instruments.find((i) => i.id === note.toId);
    if (!targetInst) {
      toRemove.push(idx);
      return;
    }
    const dx = targetInst.x - note.x;
    const dy = targetInst.y - note.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= ARRIVAL_THRESHOLD) {
      triggerInstrument(note.toId, true);
      toRemove.push(idx);
      return;
    }

    const safeDist = Math.max(dist, minDist);
    const puckSpeed = Math.max(0.5, PUCK_SPEED * puckSpeedMultiplier);
    const moveAmount = Math.min(puckSpeed, dist);
    const xNew = note.x + (dx / safeDist) * moveAmount;
    const yNew = note.y + (dy / safeDist) * moveAmount;

    let firstCollision: { inst: InstrumentDef; t: number } | null = null;
    for (const inst of instruments) {
      if (inst.id === note.fromId) continue;
      const t = segmentCircleCollisionT(note.x, note.y, xNew, yNew, inst.x, inst.y, inst.radius);
      if (t != null && (firstCollision == null || t < firstCollision.t)) {
        firstCollision = { inst, t };
      }
    }

    if (firstCollision) {
      triggerInstrument(firstCollision.inst.id, true);
      toRemove.push(idx);
      return;
    }

    note.x = xNew;
    note.y = yNew;
  });
  toRemove.reverse().forEach((i) => travelingNotes.splice(i, 1));

  if (!quitted && audioStarted && instruments.length > 0 && travelingNotes.length === 0) {
    const fromId = instruments[Math.floor(Math.random() * instruments.length)]!.id;
    const toId = randomOtherInstrumentId(fromId);
    if (toId !== fromId) sendNote(fromId, toId);
  }
}

function isInstrumentPlaying(inst: InstrumentDef): boolean {
  return inst.touchCount % 2 === 1;
}

/**
 * SVG path strings for instrument icons (24x24 viewBox, center 12,12).
 * Each path is drawn with fill then stroke; multi-part paths share one fill color.
 */
const INSTRUMENT_ICON_PATHS: string[] = [
  // 0 Piano: keyboard body
  "M 2 8 L 22 8 L 22 16 L 2 16 Z",
  // 1 Bass: upright body and neck outline
  "M 9 11 Q 9 20 12 21 Q 15 20 15 11 Q 15 4 12 3 Q 9 4 9 11 Z",
  // 2 Drums: drum head
  "M 12 12 m -8 0 a 8 8 0 1 1 16 0 a 8 8 0 1 1 -16 0",
  // 3 Trumpet: mouthpiece + valve block + bell
  "M 3 12 L 9 10 L 9 14 Z M 9 12 L 14 11 L 14 13 L 9 12 M 14 12 L 20 10 L 23 12 L 20 14 Z",
  // 4 Sax: silhouette (neck, body, upturned bell)
  "M 3 12 Q 5 8 9 7 Q 13 6 16 9 L 20 7 L 22 10 L 20 14 Q 17 17 13 18 Q 9 19 6 16 Q 4 14 3 12 Z",
  // 5 Guitar: body
  "M 12 5 L 12 19 M 8 19 Q 12 23 16 19 Q 16 13 12 9 Q 8 13 8 19 Z",
];
/** Stroke-only paths for details (keys, neck, valves, etc.); drawn after main path. */
const INSTRUMENT_ICON_STROKES: string[] = [
  "M 5 7 L 5 17 M 8 7 L 8 17 M 11 7 L 11 17 M 14 7 L 14 17 M 17 7 L 17 17 M 20 7 L 20 17",
  "M 12 3 L 12 21",
  "M 12 12 m -4 0 a 4 4 0 1 1 8 0 a 4 4 0 1 1 -8 0",
  "M 11 11 L 11 13 M 14 11 L 14 13 M 17 11 L 17 13",
  "M 8 10 L 10 8 M 14 12 L 16 10 M 19 12 L 21 10",
  "M 12 8 L 16 6 L 16 10",
];

/** Draw instrument icon from Path2D (centered at x,y, scaled to fit inside radius r). */
function drawInstrumentAvatar(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, r: number, color: string): void {
  const s = r * 0.5;
  const scale = s / 12;
  const lw = Math.max(1, 2 / scale);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-12, -12);
  ctx.fillStyle = color;
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const mainPath = new Path2D(INSTRUMENT_ICON_PATHS[id] ?? INSTRUMENT_ICON_PATHS[0]!);
  ctx.fill(mainPath);
  ctx.stroke(mainPath);

  const strokePathStr = INSTRUMENT_ICON_STROKES[id];
  if (strokePathStr) {
    ctx.strokeStyle = "#1a1a1a";
    ctx.stroke(new Path2D(strokePathStr));
  }
  ctx.restore();
}

function draw(): void {
  const t = performance.now() * 0.001;
  const nowSec = t;

  const bgGradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.6);
  bgGradient.addColorStop(0, "#12121a");
  bgGradient.addColorStop(0.5, "#0d0d12");
  bgGradient.addColorStop(1, "#08080c");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  instruments.forEach((inst) => {
    const playing = isInstrumentPlaying(inst);
    const phase = inst.id * 1.2;
    const breathRate = 1.8 + inst.id * 0.25;
    const colorRate = 2.2 + inst.id * 0.2;
    const breath = playing ? Math.sin(t * breathRate + phase) : 0;
    const colorPhase = playing ? Math.sin(t * colorRate + phase * 0.7) : 0;
    const radius = playing
      ? inst.radius * (1 + PULSE_RADIUS_AMOUNT * breath)
      : inst.radius;
    const fillStyle = playing
      ? pulseColor(inst.color, PULSE_COLOR_AMOUNT * (0.5 + 0.5 * colorPhase))
      : inst.color;
    ctx.beginPath();
    ctx.arc(inst.x, inst.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (nowSec - inst.lastHitTime < HIT_FEEDBACK_DURATION_S && inst.lastHitTime > 0) {
      const alpha = 1 - (nowSec - inst.lastHitTime) / HIT_FEEDBACK_DURATION_S;
      ctx.strokeStyle = `rgba(255, 255, 200, ${alpha * 0.9})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(inst.x, inst.y, radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawInstrumentAvatar(ctx, inst.id, inst.x, inst.y, inst.radius, "#fff");

    ctx.fillStyle = "#fff";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(inst.label, inst.x, inst.y + inst.radius - 10);
  });

  travelingNotes.forEach((note) => {
    const glowR = NOTE_RADIUS * 2.2;
    ctx.beginPath();
    ctx.arc(note.x, note.y, glowR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(232, 224, 200, 0.35)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(note.x, note.y, NOTE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#e8e0c8";
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

function tick(): void {
  frameCount += 1;
  try {
    updateInstruments();
    updateNotes();
    draw();
    if (DEBUG_LOG) {
      const now = performance.now();
      if (now - lastDebugLogTime >= DEBUG_LOG_INTERVAL_MS) {
        lastDebugLogTime = now;
        console.log("[spacemusic] frame=" + frameCount + " notes=" + travelingNotes.length + " instruments=" + instruments.length);
      }
    }
  } catch (err) {
    console.error("[spacemusic] tick error:", err);
  }
  requestAnimationFrame(tick);
}

function handleClick(e: MouseEvent): void {
  if (!audioStarted) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const inst = getInstrumentAt(x, y);
  if (inst) {
    const nextId = randomOtherInstrumentId(inst.id);
    sendNote(inst.id, nextId);
  }
}

/** Sparse piano sample map (casio set); Sampler repitches to cover riff range. */
const PIANO_SAMPLER_URLS: Record<string, string> = {
  A1: "A1.mp3",
  "A#1": "As1.mp3",
  B1: "B1.mp3",
  C2: "C2.mp3",
  "C#2": "Cs2.mp3",
  D2: "D2.mp3",
  "D#2": "Ds2.mp3",
  E2: "E2.mp3",
  F2: "F2.mp3",
  "F#2": "Fs2.mp3",
  G2: "G2.mp3",
  "G#2": "Gs2.mp3",
  A2: "A2.mp3",
};

const PIANO_SAMPLER_BASE_URL = "https://tonejs.github.io/audio/casio/";

function startAudio(): void {
  if (audioStarted) return;
  Tone.start().then(() => {
    Tone.Transport.bpm.value = parseFloat(bpmInput.value) || 100;
    Tone.Transport.start();
    audioStarted = true;
    demoRunning = true;
    overlay.classList.add("hidden");
    quitBtn.classList.add("visible");
    quitBtn.textContent = "Quit";
    speedPanel.classList.remove("speed-panel-hidden");
    sendNote(0, 1);

    if (instruments.length > 0 && masterGain) {
      const pianoSampler = new Tone.Sampler({
        urls: PIANO_SAMPLER_URLS,
        baseUrl: PIANO_SAMPLER_BASE_URL,
        onload: () => {
          const inst = instruments[0];
          if (!inst || !masterGain) return;
          const oldSynth = inst.synth;
          if (oldSynth && "dispose" in oldSynth) {
            oldSynth.disconnect();
            oldSynth.dispose();
          }
          const trim = INSTRUMENT_GAIN_TRIMS[0] ?? 1;
          const pianoGain = new Tone.Gain(trim);
          pianoSampler.connect(pianoGain);
          pianoGain.connect(masterGain);
          inst.synth = pianoSampler;
        },
      });
    }
  });
}

function quit(): void {
  quitted = true;
  demoRunning = false;
  Tone.Transport.stop();
  instruments.forEach((inst) => {
    if (inst.loop) {
      inst.loop.dispose();
      inst.loop = null;
    }
  });
  travelingNotes.length = 0;
  quitOverlay.classList.remove("hidden");
  quitBtn.textContent = "Start";
}

function restart(): void {
  quitted = false;
  demoRunning = true;
  Tone.Transport.start();
  quitOverlay.classList.add("hidden");
  quitBtn.textContent = "Quit";
  const fromId = instruments[Math.floor(Math.random() * instruments.length)]!.id;
  const toId = randomOtherInstrumentId(fromId);
  if (toId !== fromId) sendNote(fromId, toId);
}

function handleQuitOrStart(): void {
  if (demoRunning) quit();
  else restart();
}

function hideQuitOverlay(): void {
  quitOverlay.classList.add("hidden");
}

const quitBtn = document.getElementById("quit-btn") as HTMLButtonElement;
const quitOverlay = document.getElementById("quit-overlay") as HTMLDivElement;
const quitCloseBtn = document.getElementById("quit-close-btn") as HTMLButtonElement;
const speedPanel = document.getElementById("speed-panel") as HTMLDivElement;
const panelToggle = document.getElementById("panel-toggle") as HTMLButtonElement;
const bpmInput = document.getElementById("bpm") as HTMLInputElement;
const keySelect = document.getElementById("key") as HTMLSelectElement;
const puckSpeedInput = document.getElementById("puck-speed") as HTMLInputElement;
const instrumentSpeedInput = document.getElementById("instrument-speed") as HTMLInputElement;

startBtn.addEventListener("click", startAudio);
panelToggle.addEventListener("click", () => {
  const minimized = speedPanel.classList.toggle("speed-panel-minimized");
  panelToggle.textContent = minimized ? "+" : "−";
  panelToggle.title = minimized ? "Expand panel" : "Collapse panel";
  panelToggle.setAttribute("aria-label", minimized ? "Expand controls panel" : "Collapse controls panel");
});
canvas.addEventListener("click", handleClick);
quitBtn.addEventListener("click", handleQuitOrStart);
quitCloseBtn.addEventListener("click", hideQuitOverlay);
bpmInput.addEventListener("input", () => {
  Tone.Transport.bpm.value = parseFloat(bpmInput.value) || 100;
});
keySelect.addEventListener("change", () => {
  keySemitones = parseInt(keySelect.value, 10) || 0;
});
puckSpeedInput.addEventListener("input", () => {
  puckSpeedMultiplier = parseFloat(puckSpeedInput.value) || 1;
});
instrumentSpeedInput.addEventListener("input", () => {
  instrumentSpeedMultiplier = parseFloat(instrumentSpeedInput.value) || 1;
});
window.addEventListener("resize", resize);

resize();
tick();
