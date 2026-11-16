import { esc } from "./util.js";
import { art, hat } from "./art.js";

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const app = () => document.getElementById("app");

export function render(html) {
  const el = app();
  el.innerHTML = html;
  window.scrollTo(0, 0);
  return el;
}

let toastT;
export function toast(msg, ms = 2600) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms);
}

export function modal(html, { onMount } = {}) {
  return new Promise(resolve => {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(bg);
    const close = v => { bg.remove(); resolve(v); };
    bg.addEventListener("click", e => {
      if (e.target === bg) close(null);
      const b = e.target.closest("[data-close]");
      if (b) close(b.dataset.close);
    });
    onMount && onMount(bg.firstElementChild, close);
  });
}

export async function confirmBox(text, yes = "Ja", no = "Abbrechen", danger = false) {
  const r = await modal(`<p style="font-size:1.1rem;margin:0">${esc(text)}</p>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost small" data-close="no">${esc(no)}</button>
    <button class="btn small ${danger ? "coral" : "green"}" data-close="yes">${esc(yes)}</button></div>`);
  return r === "yes";
}

// Bild eines Wortes: hochgeladenes Bild oder Emoji
export function pic(w, cls = "") {
  if (w.img) return `<img src="${esc(w.img)}" alt="" class="${cls}" loading="lazy" decoding="async"${w.credit ? ` title="${esc(w.credit)}"` : ""}>`;
  if (w.emoji) return `<span aria-hidden="true">${esc(w.emoji)}</span>`;
  return `<span class="no-pic" aria-hidden="true">${art("book")}</span>`;
}
export const hasPic = w => !!(w.img || w.emoji);

export function avatarHtml(av = {}, size = "") {
  return `<span class="avatar ${size}" style="background:${esc(av.color || "#2b9ad1")}1f;box-shadow:inset 0 0 0 3px ${esc(av.color || "#2b9ad1")}">${av.hat ? `<span class="hat">${hat(av.hat)}</span>` : ""}${art(av.animal || "🐢", "av-art")}</span>`;
}

// Einfache Symbole für Knöpfe (weiß, folgen der Textfarbe)
export const ICON = {
  speaker: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  back: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  mute: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>`,
  cross: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  bulb: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>`,
};
export function stars(n, size = "") { return `<span class="stars ${size}" aria-label="${n} von 3 Sternen">${[0, 1, 2].map(i => art(i < n ? "star" : "starEmpty")).join("")}</span>`; }

// ---- Töne (ohne Dateien, WebAudio) ----
let ac;
let soundOn = true;
export function setSound(v) { soundOn = !!v; }
export const isSound = () => soundOn;
function tone(freq, dur = .12, type = "sine", when = 0, vol = .18) {
  if (!soundOn) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ac.currentTime + when);
    g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + when + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(ac.currentTime + when); o.stop(ac.currentTime + when + dur + .02);
  } catch {}
}
export const sfx = {
  ok() { tone(660, .12, "triangle", 0, .22); tone(880, .12, "triangle", .1, .22); tone(1320, .22, "triangle", .2, .22); },
  no() { tone(392, .16, "square", 0, .07); tone(262, .32, "square", .16, .07); },
  coin() { tone(1200, .07, "square", 0, .06); tone(1600, .1, "square", .07, .06); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .18, "triangle", i * .12)); },
  tap() { tone(500, .04, "sine", 0, .06); },
};

// ---- Konfetti ----
export function confetti(n = 120) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas"); c.id = "confetti";
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  const W = c.width = innerWidth, H = c.height = innerHeight;
  const cols = ["#ffc531", "#ff6f4f", "#2f9e5e", "#2b9ad1", "#7048e8"];
  const ps = Array.from({ length: n }, () => ({ x: Math.random() * W, y: -20 - Math.random() * H * .5, vx: (Math.random() - .5) * 4, vy: 2 + Math.random() * 4, r: Math.random() * 6.28, s: 6 + Math.random() * 8, c: cols[Math.floor(Math.random() * cols.length)] }));
  let f = 0;
  (function loop() {
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += .05; p.r += .1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
    if (++f < 160) requestAnimationFrame(loop); else c.remove();
  })();
}

export function fmtMin(sec) { const m = Math.round(sec / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; }
export function relDay(ts) {
  if (!ts) return "noch nie";
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return "heute"; if (d === 1) return "gestern"; return `vor ${d} Tagen`;
}
