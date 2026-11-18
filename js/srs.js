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
// Lernkarten: Selbsteinschätzung getrennt zählen (cr/cw) – nicht in „Treffer“
export function countCard(prog, l, w, knew) {
  const s = { ...wstate(prog, l.id, w.id) };
  knew ? (s.cr = (s.cr || 0) + 1) : (s.cw = (s.cw || 0) + 1);
  prog.cards = (prog.cards || 0) + 1;
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

// Inseln werden freigeschaltet: Wochen-Lektionen ab ihrer Woche,
// andere nacheinander (1 Stern öffnet die nächste)
export function unlockedLessons(prog, lessons, allOpen) {
  const out = [];
  let prevFree = null;
  for (const l of lessons) {
    const ws = weekState(l);
    if (ws === "future") continue;
    if (ws !== "none" || allOpen || !prevFree || lessonStats(prog, prevFree).stars >= 1) out.push(l);
    if (ws === "none") { if (!out.includes(l)) break; prevFree = l; }
  }
  return out;
}
export function sortLessons(lessons) {
  return [...lessons].sort((a, b) => (a.week || "9999") .localeCompare(b.week || "9999") || (a.order || 0) - (b.order || 0) || (a.created || 0) - (b.created || 0));
}

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export { shuffle };

// ---- Wochenplan: eine Lektion pro Schulwoche ---------------------
// „Häufig kurz statt selten lang“: die Wörter einer Wochen-Lektion werden auf
// 5 Schultage verteilt, 5–7 neue pro Tag. Am Freitag: Wochentest.
export function mondayOf(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (x.getDay() + 6) % 7; // 0 = Montag
  x.setDate(x.getDate() - wd);
  return todayStr(x);
}
export function weekNumber(dateStr) {
  const d = new Date(dateStr + "T12:00");
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / DAY + 1) / 7);
}
export function weekLabel(mon) {
  if (!mon) return "";
  const a = new Date(mon + "T12:00"), b = new Date(a.getTime() + 4 * DAY);
  const f = d => `${d.getDate()}.${d.getMonth() + 1}.`;
  return `KW ${weekNumber(mon)} (${f(a)}–${f(b)})`;
}
export function schoolDay(d = new Date()) { const wd = (d.getDay() + 6) % 7; return Math.min(5, wd + 1); } // Mo=1 … Fr/Sa/So=5
export function weekState(lesson, now = new Date()) {
  if (!lesson.week) return "none";
  const thisMon = mondayOf(now);
  return lesson.week === thisMon ? "current" : lesson.week > thisMon ? "future" : "past";
}
export function perDayFor(lesson) { const n = lesson.words.length; return Math.max(5, Math.min(7, Math.ceil(n / 5))); }
// Wie viele neue Wörter dieser Lektion sind heute erlaubt?
export function newAllowed(prog, lesson, now = new Date()) {
  const ws = weekState(lesson, now);
  if (ws === "future") return 0;
  const seen = lesson.words.filter(w => wstate(prog, lesson.id, w.id).b >= 1).length;
  if (ws === "current") return Math.max(0, Math.min(lesson.words.length, perDayFor(lesson) * schoolDay(now)) - seen);
  return Math.max(0, lesson.words.length - seen);
}

// Welche Wörter kommen in die nächste Lerneinheit?
//  1. fällige Wiederholungen (älteste zuerst, max. 10)
//  2. Wörter, die noch auf „heute lernen“ stehen (z. B. nach Fehlern)
//  3. neue Wörter: Wochen-Lektion nach Tagesplan (5–7), sonst höchstens 5
export function planLearn(prog, lessons, { maxReview = 10, maxLearn = 8 } = {}) {
  const now = Date.now();
  const review = [], learn = [], fresh = [];
  const weekly = lessons.some(l => weekState(l) === "current");
  for (const l of lessons) {
    if (weekState(l) === "future") continue;
    let allow = newAllowed(prog, l);
    for (const w of l.words) {
      const s = wstate(prog, l.id, w.id);
      if (s.b === 0) { if (allow > 0) { fresh.push({ l, w, s, kind: "new", cur: weekState(l) === "current" }); allow--; } }
      else if (s.b === 1) learn.push({ l, w, s, kind: "learn" });
      else if (s.d <= now) review.push({ l, w, s, kind: "review" });
    }
  }
  review.sort((a, b) => a.s.d - b.s.d);
  fresh.sort((a, b) => (b.cur ? 1 : 0) - (a.cur ? 1 : 0)); // Wochen-Lektion zuerst
  const r = review.slice(0, maxReview), le = learn.slice(0, maxLearn);
  const maxNew = weekly ? 7 : MAX_NEW;
  const nNew = Math.max(0, Math.min(maxNew, 16 - r.length - le.length));
  return [...r, ...le, ...fresh.slice(0, nNew)];
}

// Tagesziel: 5 Minuten (Routine statt Marathon)
export const DAILY_GOAL_SEC = 300;
export function todaySeconds(prog) { return prog.days?.[todayStr()]?.sec || 0; }
export function countDueToday(prog, lessons) { return planLearn(prog, lessons).length; }

// ---- Antwort prüfen (kindgerecht tolerant) ---------------------
export function stripAccents(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
export function norm(s) {
  return String(s || "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[’`´]/g, "'").replace(/[.!?,;:¿¡"«»()]/g, " ").replace(/\s+/g, " ").trim();
}
const ARTICLES = /^(le |la |les |l'|l |un |une |des |du |de la |de l'|o |a |os |as |um |uma |der |die |das |ein |eine )/;
export function stripArticle(s) { return s.replace(ARTICLES, "").trim(); }
// Mehrere richtige Formen: „/“, „;“, „|“ – und Komma zwischen Formen mit Artikel
// („le cheveu, les cheveux“ → „le cheveu“ ODER „les cheveux“). „oui, merci“ bleibt ein Ausdruck.
export function forms(target) {
  return String(target ?? "").split(/\s*[\/;|]\s*/).flatMap(part => {
    const bits = part.split(/\s*,\s*/).filter(b => b.trim());
    return bits.length > 1 && bits.every(b => ARTICLES.test(norm(b) + " ")) ? bits : [part];
  }).map(x => x.trim()).filter(Boolean);
}
export const firstForm = target => forms(target)[0] || String(target ?? "");
// Einzahl + Mehrzahl in einem Eintrag („la dent, les dents“) → ["la dent", "les dents"], sonst null
export function pairForms(target) {
  const s = String(target ?? "");
  if (/[\/;|]/.test(s)) return null;
  const bits = s.split(/\s*,\s*/).map(x => x.trim()).filter(Boolean);
  return bits.length === 2 && bits.every(b => ARTICLES.test(norm(b) + " ")) ? bits : null;
}
export function variants(target) {
  const v = forms(target).map(norm).filter(Boolean);
  if (pairForms(target)) v.push(norm(target));          // beide Formen in einem Feld zählen auch
  return v;
}

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
// Französische Aussprache grob vereinfachen („le visage“ ≈ „visaj“), damit die
// Spracherkennung auch passt, wenn sie ein gleich klingendes Wort versteht
export function frPhon(str) {
  const words = stripAccents(stripArticle(norm(str))).replace(/['-]/g, " ").split(" ").filter(Boolean);
  return words.map(w => {
    w = w.replace(/^h/, "").replace(/(eaux|eau|aux|au)/g, "o").replace(/(ai|ei)/g, "e").replace(/(er|ez|et)$/, "e")
      .replace(/qu/g, "k").replace(/c(?=[eiy])/g, "s").replace(/c/g, "k").replace(/ph/g, "f").replace(/gn/g, "n").replace(/g(?=[eiy])/g, "j")
      .replace(/oi/g, "wa").replace(/ou/g, "u").replace(/ill/g, "y").replace(/y/g, "i")
      .replace(/(an|en|am|em)(?![aeiou])/g, "A").replace(/(on|om)(?![aeiou])/g, "O").replace(/(ain|ein|in|im|un)(?![aeiou])/g, "I")
      .replace(/h/g, "").replace(/([a-z])\1+/g, "$1");
    return w.replace(/[esxtdp]+$/, "") || w;            // stumme Endungen
  }).join("");
}

// Spracherkennung: großzügig, Artikel und Akzente egal, gleich klingende Wörter zählen
export function checkSpoken(alternatives, target) {
  const targets = variants(target).map(t => stripAccents(stripArticle(t)));
  const ptargets = forms(target).map(frPhon).filter(Boolean);
  for (const alt of alternatives) {
    const a = stripAccents(stripArticle(norm(alt)));
    if (!a) continue;
    for (const t of targets) {
      if (a === t || a.endsWith(" " + t) || (t.length >= 3 && a.includes(t))) return true;
      if (lev(a, t) <= Math.max(1, Math.floor(t.length * 0.25))) return true;
    }
    const pa = frPhon(alt);
    for (const pt of ptargets) {
      if (!pa) continue;
      if (pa === pt || (pt.length >= 3 && pa.includes(pt))) return true;
      if (lev(pa, pt) <= Math.max(1, Math.floor(pt.length * 0.3))) return true;
    }
  }
  return false;
}

// Rechtschreib-Vergleich für die Fehleranzeige: welche Buchstaben stimmen, fehlen, sind zu viel?
// Liefert [{t:"ok"|"sub"|"del"|"ins", c: getippt, r: richtig}]
export function spellDiff(typed, target) {
  const a = [...String(typed || "").trim()], b = [...String(target || "").trim()];
  const eq = (x, y) => x.toLowerCase() === y.toLowerCase();
  const m = a.length, n = b.length;
  const D = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (eq(a[i - 1], b[j - 1]) ? 0 : 1));
  const out = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (eq(a[i - 1], b[j - 1]) ? 0 : 1)) {
      out.push(eq(a[i - 1], b[j - 1]) ? { t: "ok", c: a[i - 1], r: b[j - 1] } : { t: "sub", c: a[i - 1], r: b[j - 1] }); i--; j--;
    } else if (j > 0 && D[i][j] === D[i][j - 1] + 1) { out.push({ t: "ins", r: b[j - 1] }); j--; }
    else { out.push({ t: "del", c: a[i - 1] }); i--; }
  }
  return out.reverse();
}
// Die Form, die am besten zur Eingabe passt (für die Fehleranzeige)
export function closestForm(typed, target) {
  const fs = forms(target), a = norm(typed);
  return fs.reduce((best, f) => (lev(a, norm(f)) < lev(a, norm(best)) ? f : best), fs[0] || String(target || ""));
}

// ---- Tagebuch & Belohnungen ------------------------------------
export function logActivity(prog, { sec = 0, ans = 0, ok = 0, pts = 0, wp = 0 } = {}) {
  const t = todayStr();
  const d = prog.days[t] || { sec: 0, ans: 0, ok: 0 };
  d.sec += sec; d.ans += ans; d.ok += ok; d.pts = (d.pts || 0) + pts; d.wp = (d.wp || 0) + wp; // wp = Wörter fürs Klassenziel // pts = Punkte fürs Klassenziel (nur Lernen/Testen)
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
  { id: "class1", icon: "medal", name: "Klassen-Baumeister", desc: "Mit der Klasse ein Bauwerk fertig gebaut", test: p => (p.classWins || 0) >= 1 },
  { id: "class5", icon: "trophy", name: "Insel-Architekt", desc: "5 Bauwerke mit der Klasse", test: p => (p.classWins || 0) >= 5 },
];

export function checkBadges(prog, lessons) {
  const o = overallStats(prog, lessons);
  const fresh = [];
  for (const b of BADGES) if (!prog.badges.includes(b.id) && b.test(prog, o)) { prog.badges.push(b.id); fresh.push(b); }
  return fresh;
}

// ---- Klassenziel: ein Wort zählt, wenn es 3× richtig GESCHRIEBEN wurde ----
// (pro Wort höchstens 1 Klassenpunkt pro Woche – Wiederholen in späteren Wochen zählt wieder)
export const WRITES_FOR_POINT = 3;
export function writePoint(prog, l, w) {
  const k = wkey(l.id, w.id);
  const s = { ...wstate(prog, l.id, w.id) };
  s.wc = (s.wc || 0) + 1;
  const mon = mondayOf();
  let point = 0, shown = s.wc, already = false;
  if (s.wc >= WRITES_FOR_POINT) {
    shown = WRITES_FOR_POINT;
    if (s.cpw !== mon) { point = 1; s.cpw = mon; } else already = true;
    s.wc = 0;
  }
  prog.words[k] = s;
  return { point, count: shown, already };
}
