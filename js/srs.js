// ================================================================
//  Lernlogik – wissenschaftliche Grundlage
// ----------------------------------------------------------------
//  • Successive Relearning (Rawson & Dunlosky 2011, 2013): In jeder
//    Lerneinheit muss ein Wort 2× richtig ABGERUFEN werden (schreiben
//    oder sprechen), danach ist es für heute fertig – kein 3. Mal.
//  • Abstand innerhalb der Einheit (Kornell 2009; Karpicke & Bauernschmidt
//    2011): zwischen zwei Abfragen desselben Wortes liegen mind. 3 andere.
//  • Verteiltes Wiederholen mit wachsenden Pausen (Cepeda et al. 2006):
//    +1 Tag → +3 Tage → +1 Woche → +1 Monat (= gemeistert).
//  • Fehler: Wort fällt zurück auf „Heute lernen“ und braucht wieder
//    2× richtig – schwierige Wörter kommen dadurch öfter.
//  • Testing-Effekt (Roediger & Karpicke 2006): aktives Abrufen statt
//    Wiederlesen. Multiple Choice dient nur zum Aufwärmen neuer Wörter.
//  • Doppelte Kodierung (Paivio) + Produktionseffekt (MacLeod 2010):
//    Bild, Ton und lautes Sprechen.
//  • Kleine Portionen: höchstens 5 neue Wörter pro Einheit.
// ================================================================

export const DAY = 86400000;
// Fächer: 0 neu · 1 heute lernen · 2 nach 1 Tag · 3 nach 3 Tagen · 4 nach 1 Woche · 5 gemeistert (nach 1 Monat)
export const INTERVALS = [0, 0, 1 * DAY, 3 * DAY, 7 * DAY, 30 * DAY];
export const BOX_NAMES = ["neu", "heute", "1 Tag", "3 Tage", "1 Woche", "gemeistert"];
export const MASTER_BOX = 5;
export const SOLID_BOX = 4;
export const NEEDED_TODAY = 2;   // so oft richtig in einer Einheit
export const MIN_GAP = 3;        // so viele andere Wörter dazwischen
export const MAX_NEW = 5;

export function todayStr(d = new Date()) {
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function emptyProgress() {
  return {
    words: {}, coins: 0, xp: 0, stars: {}, tests: {}, streak: { n: 0, last: null },
    days: {}, owned: [], avatar: { animal: "🐢", color: "#2f9e8f", hat: "" },
    best: {}, badges: [], spoken: 0, typed: 0,
  };
}

export const wkey = (lessonId, wordId) => `${lessonId}:${wordId}`;
export function wstate(prog, lessonId, wordId) {
  return prog.words[wkey(lessonId, wordId)] || { b: 0, d: 0, r: 0, w: 0 };
}
function put(prog, l, w, s) { s.l = Date.now(); prog.words[wkey(l.id, w.id)] = s; return s; }

// Neues Wort gesehen → kommt in „heute lernen“
export function markSeen(prog, l, w) {
  const s = { ...wstate(prog, l.id, w.id) };
  if (s.b === 0) { s.b = 1; s.d = Date.now(); }
  return put(prog, l, w, s);
}
// Antwort zählt in der Statistik (richtig/falsch)
export function countAnswer(prog, l, w, ok) {
  const s = { ...wstate(prog, l.id, w.id) };
  ok ? s.r++ : s.w++;
  return put(prog, l, w, s);
}
// Fehler: zurück auf „heute lernen“
export function fallBack(prog, l, w) {
  const s = { ...wstate(prog, l.id, w.id) };
  s.b = 1; s.d = Date.now();
  return put(prog, l, w, s);
}
// Wort für heute geschafft → nächstes Fach, längere Pause
export function promote(prog, l, w) {
  const s = { ...wstate(prog, l.id, w.id) };
  const nb = s.b <= 1 ? 2 : Math.min(MASTER_BOX, s.b + 1);
  s.d = Date.now() + (s.b === MASTER_BOX ? 60 * DAY : INTERVALS[nb]);
  s.b = nb;
  return put(prog, l, w, s);
}

export function lessonStats(prog, lesson) {
  const n = lesson.words.length || 1;
  let seen = 0, known = 0, solid = 0, master = 0, due = 0;
  const now = Date.now();
  for (const w of lesson.words) {
    const s = wstate(prog, lesson.id, w.id);
    if (s.b >= 1) seen++;
    if (s.b >= 2) known++;
    if (s.b >= SOLID_BOX) solid++;
    if (s.b >= MASTER_BOX) master++;
    if (s.b === 1 || (s.b >= 2 && s.d <= now)) due++;
  }
  let stars = 0;
  if (lesson.words.length && seen === lesson.words.length) stars = 1;
  if (stars && known / n >= 0.8) stars = 2;
  if (stars === 2 && solid / n >= 0.8) stars = 3;
  const t = prog.tests?.[lesson.id];
  return { total: lesson.words.length, seen, known, solid, master, due, stars, testBest: t?.best ?? null, testPassed: (t?.best ?? 0) >= 80,
    pct: Math.round((master / n) * 100), knownPct: Math.round((known / n) * 100), solidPct: Math.round((solid / n) * 100) };
}

export function overallStats(prog, lessons) {
  let total = 0, known = 0, solid = 0, master = 0, due = 0;
  for (const l of lessons) { const s = lessonStats(prog, l); total += s.total; known += s.known; solid += s.solid; master += s.master; due += s.due; }
  return { total, known, solid, master, due };
}

// Inseln werden nacheinander freigeschaltet (1 Stern öffnet die nächste)
export function unlockedLessons(prog, lessons, allOpen) {
  const out = [];
  for (let i = 0; i < lessons.length; i++) {
    if (allOpen || i === 0) { out.push(lessons[i]); continue; }
    if (lessonStats(prog, lessons[i - 1]).stars >= 1) out.push(lessons[i]); else break;
  }
  return out;
}

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export { shuffle };

// Welche Wörter kommen in die nächste Lerneinheit?
//  1. fällige Wiederholungen (älteste zuerst, max. 10)
//  2. Wörter, die noch auf „heute lernen“ stehen (z. B. nach Fehlern)
//  3. ein paar neue Wörter (max. 5, weniger wenn viel zu wiederholen ist)
export function planLearn(prog, lessons, { maxReview = 10, maxLearn = 8 } = {}) {
  const now = Date.now();
  const review = [], learn = [], fresh = [];
  for (const l of lessons) for (const w of l.words) {
    const s = wstate(prog, l.id, w.id);
    if (s.b === 0) fresh.push({ l, w, s, kind: "new" });
    else if (s.b === 1) learn.push({ l, w, s, kind: "learn" });
    else if (s.d <= now) review.push({ l, w, s, kind: "review" });
  }
  review.sort((a, b) => a.s.d - b.s.d);
  const r = review.slice(0, maxReview), le = learn.slice(0, maxLearn);
  const nNew = Math.max(0, Math.min(MAX_NEW, 14 - r.length - le.length));
  return [...r, ...le, ...fresh.slice(0, nNew)];
}
export function countDueToday(prog, lessons) { return planLearn(prog, lessons).length; }

// ---- Antwort prüfen (kindgerecht tolerant) ---------------------
export function stripAccents(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
export function norm(s) {
  return String(s || "").toLowerCase().replace(/[’`´]/g, "'").replace(/[.!?,;:¿¡"«»()]/g, " ").replace(/\s+/g, " ").trim();
}
const ARTICLES = /^(le |la |les |l'|l |un |une |des |du |de la |de l'|o |a |os |as |um |uma |der |die |das |ein |eine )/;
export function stripArticle(s) { return s.replace(ARTICLES, "").trim(); }
export function variants(target) { return String(target).split(/\s*[\/;|]\s*/).map(norm).filter(Boolean); }

export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// Rückgabe: perfect | accent | article | almost | wrong
export function checkWritten(input, target) {
  const a = norm(input);
  if (!a) return "wrong";
  let best = "wrong";
  for (const t of variants(target)) {
    if (a === t) return "perfect";
    if (stripAccents(a) === stripAccents(t)) best = "accent";
    else if (best !== "accent" && stripArticle(a) === stripArticle(t) && stripArticle(t) !== t) best = "article";
    else if (best === "wrong" && stripAccents(stripArticle(t)).length >= 4 && lev(stripAccents(stripArticle(a)), stripAccents(stripArticle(t))) <= 1) best = "almost";
  }
  return best;
}

// Spracherkennung: großzügig, Artikel und Akzente egal
export function checkSpoken(alternatives, target) {
  const targets = variants(target).map(t => stripAccents(stripArticle(t)));
  for (const alt of alternatives) {
    const a = stripAccents(stripArticle(norm(alt)));
    for (const t of targets) {
      if (!a) continue;
      if (a === t || a.endsWith(" " + t) || (t.length >= 3 && a.includes(t))) return true;
      if (lev(a, t) <= Math.max(1, Math.floor(t.length * 0.25))) return true;
    }
  }
  return false;
}

// ---- Tagebuch & Belohnungen ------------------------------------
export function logActivity(prog, { sec = 0, ans = 0, ok = 0 } = {}) {
  const t = todayStr();
  const d = prog.days[t] || { sec: 0, ans: 0, ok: 0 };
  d.sec += sec; d.ans += ans; d.ok += ok;
  prog.days[t] = d;
  if (prog.streak.last !== t) {
    const y = todayStr(new Date(Date.now() - DAY));
    prog.streak.n = prog.streak.last === y ? prog.streak.n + 1 : 1;
    prog.streak.last = t;
  }
}

export function currentStreak(prog) {
  const t = todayStr(), y = todayStr(new Date(Date.now() - DAY));
  return prog.streak.last === t || prog.streak.last === y ? prog.streak.n : 0;
}

export function weekSummary(prog, now = new Date()) {
  let sec = 0, ans = 0, ok = 0, daysActive = 0;
  for (let i = 0; i < 7; i++) {
    const d = prog.days?.[todayStr(new Date(now.getTime() - i * DAY))];
    if (d) { sec += d.sec; ans += d.ans; ok += d.ok; if (d.ans > 0) daysActive++; }
  }
  return { sec, ans, ok, daysActive };
}

export const BADGES = [
  { id: "first", icon: "rocket", name: "Erste Schritte", desc: "Die erste Übung geschafft", test: p => Object.keys(p.days).length > 0 },
  { id: "w10", icon: "book", name: "10 Wörter", desc: "10 Wörter gelernt", test: (p, o) => o.known >= 10 },
  { id: "w50", icon: "medal", name: "50 Wörter", desc: "50 Wörter gelernt", test: (p, o) => o.known >= 50 },
  { id: "w100", icon: "trophy", name: "100 Wörter", desc: "100 Wörter gelernt", test: (p, o) => o.known >= 100 },
  { id: "s3", icon: "flame", name: "3 Tage", desc: "3 Tage hintereinander geübt", test: p => p.streak.n >= 3 },
  { id: "s7", icon: "flame", name: "7 Tage", desc: "Eine ganze Woche jeden Tag", test: p => p.streak.n >= 7 },
  { id: "speak20", icon: "parrot", name: "Sprech-Profi", desc: "20 Wörter richtig gesprochen", test: p => p.spoken >= 20 },
  { id: "write20", icon: "clipboard", name: "Schreib-Profi", desc: "20 Wörter richtig geschrieben", test: p => p.typed >= 20 },
  { id: "test1", icon: "star", name: "Test bestanden", desc: "Einen Test mit 80 % geschafft", test: p => Object.values(p.tests || {}).some(t => t.best >= 80) },
  { id: "star3", icon: "island", name: "Insel-Meister", desc: "Auf einer Insel 3 Sterne", test: p => Object.values(p.stars).some(s => s >= 3) },
  { id: "master", icon: "chest", name: "Wort-Kapitän", desc: "20 Wörter gemeistert", test: (p, o) => o.master >= 20 },
];

export function checkBadges(prog, lessons) {
  const o = overallStats(prog, lessons);
  const fresh = [];
  for (const b of BADGES) if (!prog.badges.includes(b.id) && b.test(prog, o)) { prog.badges.push(b.id); fresh.push(b); }
  return fresh;
}
