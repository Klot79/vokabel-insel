// ================================================================
//  Klassenziel: wöchentlich, gemeinsam, selbst-anpassend
// ----------------------------------------------------------------
//  • Punkte = richtige Antworten in „Lernen“ und „Testen“ (Mo–So).
//  • Erste Woche: Startziel (Standard 300).
//  • Jeden Montag passt sich das Ziel an die Vorwoche an:
//      locker erreicht (≥150 %) → bis +50 %, höchstens 80 % des Erreichten
//      erreicht            → bis +15 %, aber höchstens 90 % des Erreichten
//      ≥ 70 % geschafft    → bleibt gleich
//      < 70 % geschafft    → bis −15 % (nie unter 110 % des Erreichten)
//      niemand geübt       → bleibt gleich (Ferien)
//    Grenzen: 10–60 Punkte pro Kind und Woche.
//  • Ergebnis des Glücksrads wird aus Klassencode + Woche berechnet –
//    darum bleibt es bei jedem Kind auf demselben Feld stehen.
// ================================================================
import { Store } from "./store.js";
import { mondayOf, todayStr, DAY } from "./srs.js";

export const BUILDINGS = [
  { key: "lighthouse", name: "Leuchtturm", g: "m" }, { key: "bridge", name: "Brücke", g: "f" }, { key: "castle", name: "Burg", g: "f" },
  { key: "harbor", name: "Hafen", g: "m" }, { key: "ship", name: "Segelschiff", g: "n" }, { key: "windmill", name: "Windmühle", g: "f" },
  { key: "treehouse", name: "Baumhaus", g: "n" }, { key: "tent", name: "Zirkuszelt", g: "n" }, { key: "balloon", name: "Heißluftballon", g: "m" },
  { key: "spaceship", name: "Rakete", g: "f" },
];

export const DEFAULT_REWARDS = [
  "Stopptanz zum Lieblingslied",
  "Bewegungsspiel „Alle, die …“",
  "Witze-Runde",
  "Die Lehrkraft liest eine Geschichte vor",
  "10 Minuten freie Aktivität",
  "Malpause mit leiser Musik",
  "„Ich sehe was …“ auf Französisch",
  "5 Minuten früher in die Pause",
  "Hausaufgaben-Joker für alle",
  "Klassen-Karaoke: ein Lied mitsingen",
];

export const START_TARGET = 300;
const MIN_PER_KID = 10, MAX_PER_KID = 60;
const round10 = x => Math.max(10, Math.round(x / 10) * 10);

export function weekDays(mon) {
  const a = new Date(mon + "T12:00").getTime();
  return Array.from({ length: 7 }, (_, i) => todayStr(new Date(a + i * DAY)));
}
export function weekPoints(progs, mon) {
  const days = weekDays(mon);
  let sum = 0;
  for (const p of progs) for (const d of days) sum += p.days?.[d]?.pts || 0;
  return sum;
}
// An welchem Tag wurde das Ziel erreicht?
export function reachedDay(progs, mon, target) {
  let cum = 0;
  for (const d of weekDays(mon)) {
    for (const p of progs) cum += p.days?.[d]?.pts || 0;
    if (cum >= target) return d;
  }
  return null;
}

export function adapt(prevTarget, achieved, kids) {
  const lo = MIN_PER_KID * kids, hi = MAX_PER_KID * kids;
  let t = prevTarget;
  if (achieved <= 0) t = prevTarget;                                   // Ferien
  else if (achieved >= prevTarget * 1.5) t = Math.min(prevTarget * 1.5, achieved * 0.8);          // viel zu leicht → größerer Schritt
  else if (achieved >= prevTarget) t = Math.min(prevTarget * 1.15, Math.max(prevTarget, achieved * 0.9));
  else if (achieved >= prevTarget * 0.7) t = prevTarget;
  else t = Math.max(prevTarget * 0.85, Math.min(prevTarget, achieved * 1.1));
  return round10(Math.min(hi, Math.max(lo, t)));
}

function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function wheelIndex(code, mon, n) { return hash(`${String(code).toUpperCase()}|${mon}|belohnung`) % n; }
export const rewardsOf = cls => (cls.rewards?.length ? cls.rewards : DEFAULT_REWARDS).slice(0, 12);

// Ziel der laufenden Woche bestimmen (und abgeschlossene Wochen festhalten).
// Gleiche Daten → gleiches Ergebnis auf jedem Gerät.
export async function currentGoal(cls, progs, kids) {
  const mon = mondayOf();
  let rec = null;
  try { rec = await Store.getOne("class", "goals"); } catch {}
  rec = rec ? { weeks: {}, ...rec } : { weeks: {} };
  delete rec.id; delete rec._updated;
  const weeks = rec.weeks;
  let changed = false;
  const start = cls.goal?.start || START_TARGET;
  const auto = cls.goal?.auto !== false;
  const known = Object.keys(weeks).sort();
  if (!weeks[mon]) {
    // Vorwochen (bis zu 8) abschließen, damit die Kette der Anpassung stimmt
    let prevMon = known.filter(k => k < mon).pop();
    let target;
    if (!prevMon) target = start;
    else {
      const pw = weeks[prevMon];
      if (pw.achieved == null) { pw.achieved = weekPoints(progs, prevMon); pw.reached = pw.achieved >= pw.target; pw.day = reachedDay(progs, prevMon, pw.target); }
      target = auto ? adapt(pw.target, pw.achieved, kids) : start;
    }
    weeks[mon] = { target, n: known.length };
    changed = true;
  }
  if (cls.goal?.override && weeks[mon].target !== cls.goal.override) { weeks[mon].target = cls.goal.override; changed = true; }
  // Wochen vor der laufenden: Ergebnis festhalten (falls noch offen)
  for (const k of Object.keys(weeks)) if (k < mon && weeks[k].achieved == null) {
    weeks[k].achieved = weekPoints(progs, k); weeks[k].reached = weeks[k].achieved >= weeks[k].target; weeks[k].day = reachedDay(progs, k, weeks[k].target); changed = true;
  }
  if (changed) { try { await Store.put("class", "goals", rec); } catch {} }

  const order = Object.keys(weeks).sort();
  const builtBefore = order.filter(k => k < mon && weeks[k].reached).length;
  const w = weeks[mon];
  const achieved = weekPoints(progs, mon);
  const reached = achieved >= w.target;
  const rewards = rewardsOf(cls);
  return {
    mon, target: w.target, achieved, reached, day: reached ? reachedDay(progs, mon, w.target) : null,
    building: BUILDINGS[builtBefore % BUILDINGS.length],
    built: order.filter(k => k < mon && weeks[k].reached).map((k, i) => ({ mon: k, ...BUILDINGS[i % BUILDINGS.length], reward: rewards[wheelIndex(Store.code, k, rewards.length)] })),
    rewards, rewardIdx: wheelIndex(Store.code, mon, rewards.length),
    history: order.map(k => ({ mon: k, ...weeks[k] })),
  };
}

// Artikel für Sätze: der/die/das, unser/unsere, zum/zur
export const der = b => ({ m: "der", f: "die", n: "das" })[b.g] || "das";
export const unser = b => b.g === "f" ? "unsere" : "unser";
export const zum = b => b.g === "f" ? "zur fertigen" : "zum fertigen";
