/**
 * Spatial Music Visualization Demo
 * Instruments on canvas; notes travel between them and trigger layered audio.
 */

import * as Tone from "tone";
import { segmentCircleCollisionT } from "./lib/collision";
import { pulseColor } from "./lib/color";
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
/** When false, the Quit button shows "Start" and restarts the demo. */
let demoRunning = false;
let frameCount = 0;
let lastDebugLogTime = 0;
/** User-adjustable: 1 = default puck speed. */
let puckSpeedMultiplier = 1;
/** User-adjustable: 1 = default instrument speed. */
let instrumentSpeedMultiplier = 1;

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
  const startTime = Tone.Transport.seconds;
  inst.loop = new Tone.Loop((time) => {
    notes.forEach((note, i) => {
      (synth as { triggerAttackRelease(note: string, dur: string, time: number): void })
        .triggerAttackRelease(note, "8n", time + i * interval);
    });
  }, loopDur).start(startTime);
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
    demoRunning = true;
    overlay.classList.add("hidden");
    quitBtn.classList.add("visible");
    quitBtn.textContent = "Quit";
    speedPanel.classList.remove("speed-panel-hidden");
    sendNote(0, 1);
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
const puckSpeedInput = document.getElementById("puck-speed") as HTMLInputElement;
const instrumentSpeedInput = document.getElementById("instrument-speed") as HTMLInputElement;

startBtn.addEventListener("click", startAudio);
canvas.addEventListener("click", handleClick);
quitBtn.addEventListener("click", handleQuitOrStart);
quitCloseBtn.addEventListener("click", hideQuitOverlay);
puckSpeedInput.addEventListener("input", () => {
  puckSpeedMultiplier = parseFloat(puckSpeedInput.value) || 1;
});
instrumentSpeedInput.addEventListener("input", () => {
  instrumentSpeedMultiplier = parseFloat(instrumentSpeedInput.value) || 1;
});
window.addEventListener("resize", resize);

resize();
tick();
