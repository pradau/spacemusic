/**
 * Spatial Music Visualization Demo
 * Instruments on canvas; notes travel between them and trigger layered audio.
 */

import * as Tone from "tone";

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
/** Set to true to log debug state periodically to console. */
const DEBUG_LOG = false;
const DEBUG_LOG_INTERVAL_MS = 5000;

type SynthLike = Tone.PolySynth<Tone.Synth> | Tone.AMSynth | Tone.PluckSynth | Tone.FMSynth | Tone.MonoSynth;

interface InstrumentDef {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  label: string;
  synth: SynthLike;
  loop: Tone.Loop | null;
  /** Number of times the puck has touched this instrument (odd = playing, even = stopped). */
  touchCount: number;
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
let frameCount = 0;
let lastDebugLogTime = 0;

function resize(): void {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  layoutInstruments();
}

function layoutInstruments(): void {
  const centerX = width / 2;
  const centerY = height / 2;
  const r = Math.min(width, height) * 0.32;
  const n = 5;
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
  instruments.forEach((inst) => {
    inst.x += inst.vx;
    inst.y += inst.vy;
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

const INSTRUMENT_PATTERNS: string[][] = [
  ["C4", "E4", "G4", "B4", "C5"],
  ["D4", "F#4", "A4", "C#5", "D5"],
  ["G3", "Bb3", "D4", "F4", "G4"],
  ["A3", "C4", "E4", "G4", "A4"],
  ["E2", "G2", "B2", "E3", "G3"],
];

function createInstruments(positions: { x: number; y: number }[]): InstrumentDef[] {
  const gain = new Tone.Gain(0.32).toDestination();
  const colors = ["#5b9bd5", "#d4755b", "#5bd47a", "#d4a85b", "#9b5bd4"];
  const labels = ["Synth", "AM", "Pluck", "FM", "Bass"];
  const synths: SynthLike[] = [
    new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 },
    }).connect(gain),
    new Tone.AMSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.4 },
    }).connect(gain),
    new Tone.PluckSynth({
      attackNoise: 0.5,
      dampening: 4000,
      resonance: 0.9,
      release: 0.3,
    }).connect(gain),
    new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 12,
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 0.4 },
    }).connect(gain),
    new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      filter: { type: "lowpass", frequency: 800 },
      envelope: { attack: 0.02, decay: 0.4, sustain: 0.5, release: 0.5 },
    }).connect(gain),
  ];
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
    };
  });
}

function getPatternNotes(inst: InstrumentDef): string[] {
  const base = INSTRUMENT_PATTERNS[inst.id] ?? INSTRUMENT_PATTERNS[0]!;
  return inst.id % 2 === 0 ? [...base] : [...base].reverse();
}

function playPatternNow(inst: InstrumentDef): void {
  const notes = getPatternNotes(inst);
  const synth = inst.synth;
  const interval = 0.12 + inst.id * 0.02;
  notes.forEach((note, i) => {
    (synth as { triggerAttackRelease(note: string, dur: string, time?: number): void })
      .triggerAttackRelease(note, "8n", Tone.now() + i * interval);
  });
}

function makePattern(inst: InstrumentDef): void {
  if (inst.loop) {
    inst.loop.dispose();
    inst.loop = null;
  }
  const notes = getPatternNotes(inst);
  const synth = inst.synth;
  const interval = 0.18 + inst.id * 0.02;
  const loopDur = inst.id === 4 ? "1n" : "2n";
  inst.loop = new Tone.Loop((time) => {
    notes.forEach((note, i) => {
      (synth as { triggerAttackRelease(note: string, dur: string, time: number): void })
        .triggerAttackRelease(note, "8n", time + i * interval);
    });
  }, loopDur).start(0);
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

/**
 * First t in [0,1] where segment from (x0,y0) to (x1,y1) intersects circle (cx,cy,r), or null.
 */
function segmentCircleCollisionT(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  r: number
): number | null {
  const vx = x1 - x0;
  const vy = y1 - y0;
  const ux = x0 - cx;
  const uy = y0 - cy;
  const a = vx * vx + vy * vy;
  if (a < 1e-10) return null;
  const b = 2 * (ux * vx + uy * vy);
  const c = ux * ux + uy * uy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrtD = Math.sqrt(disc);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);
  const tFirst = t1 <= t2 ? t1 : t2;
  const tSecond = t1 <= t2 ? t2 : t1;
  if (tFirst >= 0 && tFirst <= 1) return tFirst;
  if (tSecond >= 0 && tSecond <= 1) return tSecond;
  return null;
}

function isFiniteNumber(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n);
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
    const moveAmount = Math.min(PUCK_SPEED, dist);
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

/** Parse hex color "#rrggbb" to [r, g, b] in 0..255. */
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

/** Lerp base hex color toward white by amount (0 = no change, 1 = white). Returns rgb(...) string. */
function pulseColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const r2 = Math.round(r + (255 - r) * amount);
  const g2 = Math.round(g + (255 - g) * amount);
  const b2 = Math.round(b + (255 - b) * amount);
  return `rgb(${r2},${g2},${b2})`;
}

function isInstrumentPlaying(inst: InstrumentDef): boolean {
  return inst.touchCount % 2 === 1;
}

function draw(): void {
  ctx.fillStyle = "#0d0d12";
  ctx.fillRect(0, 0, width, height);
  const t = performance.now() * 0.001;
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
    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(inst.label, inst.x, inst.y);
  });
  travelingNotes.forEach((note) => {
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

function startAudio(): void {
  if (audioStarted) return;
  Tone.start().then(() => {
    Tone.Transport.start();
    audioStarted = true;
    overlay.classList.add("hidden");
    quitBtn.classList.add("visible");
    sendNote(0, 1);
  });
}

function quit(): void {
  quitted = true;
  Tone.Transport.stop();
  instruments.forEach((inst) => {
    if (inst.loop) {
      inst.loop.dispose();
      inst.loop = null;
    }
  });
  travelingNotes.length = 0;
  quitOverlay.classList.remove("hidden");
}

function hideQuitOverlay(): void {
  quitOverlay.classList.add("hidden");
}

const quitBtn = document.getElementById("quit-btn") as HTMLButtonElement;
const quitOverlay = document.getElementById("quit-overlay") as HTMLDivElement;
const quitCloseBtn = document.getElementById("quit-close-btn") as HTMLButtonElement;

startBtn.addEventListener("click", startAudio);
canvas.addEventListener("click", handleClick);
quitBtn.addEventListener("click", quit);
quitCloseBtn.addEventListener("click", hideQuitOverlay);
window.addEventListener("resize", resize);

resize();
tick();
