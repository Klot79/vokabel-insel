// ================================================================
//  Lernlogik – wissenschaftliche Grundlage
// ----------------------------------------------------------------
//  • Verteiltes Wiederholen (Spacing-Effekt; Ebbinghaus, Cepeda et
//    al. 2006): Lernkartei mit 5 Fächern, wachsende Abstände.
//  • Abrufen statt Wiederlesen (Testing-Effekt; Roediger & Karpicke
//    2006): Jede Runde verlangt eine aktive Antwort.
//  • Vom Wiedererkennen zum freien Abrufen: Multiple Choice bringt
//    ein Wort nur bis Fach 2, danach zählen nur Schreiben/Sprechen.
//  • Doppelte Kodierung (Paivio): Bild + Wort + Ton.
//  • Produktionseffekt (MacLeod 2010): laut Sprechen merkt sich besser.
//  • Kleine Portionen: max. 5–6 neue Wörter pro Einheit (Arbeitsgedächtnis).
//  • Fehler kommen in derselben Runde nochmal (kurzer Abstand), sanft
//    zurückgestuft statt auf null (Motivation erhalten).
// ================================================================

export const DAY = 86400000;
// Abstände je Fach (Fach 1 = gleicher Tag, kurz danach)
export const INTERVALS = [0, 10 * 60 * 1000, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY];
export const MASTER_BOX = 4;

export function todayStr(d = new Date()) {
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function emptyProgress() {
  return {
    words: {}, coins: 0, xp: 0, stars: {}, streak: { n: 0, last: null },
    days: {}, owned: [], avatar: { animal: "🐢", color: "#2f9e8f", hat: "" },
    best: {}, badges: [], spoken: 0, typed: 0,
  };
}

export const wkey = (lessonId, wordId) => `${lessonId}:${wordId}`;
export function wstate(prog, lessonId, wordId) {
  return prog.words[wkey(lessonId, wordId)] || { b: 0, d: 0, r: 0, w: 0 };
}

// Ergebnis einer Antwort eintragen
// kind: "intro" | "recog" (wiedererkennen) | "recall" (schreiben/sprechen)
export function grade(prog, lessonId, wordId, correct, kind) {
  const k = wkey(lessonId, wordId);
  const s = { b: 0, d: 0, r: 0, w: 0, ...(prog.words[k] || {}) };
  const now = Date.now();
  if (kind === "intro") {
    if (s.b === 0) { s.b = 1; s.d = now + INTERVALS[1]; }
  } else if (correct) {
    s.r++;
    let nb = s.b;
    if (kind === "recog") nb = s.b < 2 ? s.b + 1 : s.b;
    else nb = Math.min(5, Math.max(1, s.b) + 1);
    if (nb !== s.b || s.d <= now) s.d = now + INTERVALS[nb];
    s.b = nb;
  } else {
    s.w++;
    s.b = s.b >= 3 ? 2 : 1;
    s.d = now + INTERVALS[1];
  }
  s.l = now;
  prog.words[k] = s;
  return s;
}

export function lessonStats(prog, lesson) {
  const n = lesson.words.length || 1;
  let seen = 0, known = 0, master = 0, due = 0;
  const now = Date.now();
  for (const w of lesson.words) {
    const s = wstate(prog, lesson.id, w.id);
    if (s.b >= 1) seen++;
    if (s.b >= 2) known++;
    if (s.b >= MASTER_BOX) master++;
    if (s.b >= 1 && s.d <= now) due++;
  }
  let stars = 0;
  if (lesson.words.length && seen === lesson.words.length) stars = 1;
  if (stars && known / n >= 0.8) stars = 2;
  if (stars === 2 && master / n >= 0.8) stars = 3;
  return { total: lesson.words.length, seen, known, master, due, stars, pct: Math.round((master / n) * 100), knownPct: Math.round((known / n) * 100) };
}

export function overallStats(prog, lessons) {
  let total = 0, known = 0, master = 0, due = 0;
  for (const l of lessons) { const s = lessonStats(prog, l); total += s.total; known += s.known; master += s.master; due += s.due; }
  return { total, known, master, due };
}

// Inseln werden nacheinander freigeschaltet (1 Stern öffnet die nächste)
export function unlockedLessons(prog, lessons, allOpen) {
  const out = [];
  for (let i = 0; i < lessons.length; i++) {
    if (allOpen || i === 0) { out.push(lessons[i]); continue; }
    const prev = lessonStats(prog, lessons[i - 1]);
    if (prev.stars >= 1) out.push(lessons[i]); else break;
  }
  return out;
}

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export { shuffle };

const RECOG = ["mc_fr2tr", "mc_pic2fr", "listen"];

function productionType(pref, canSpeak) {
  if (pref === "write") return "write";
  if (pref === "speak") return "speak";
  const opts = canSpeak ? ["write", "speak", "scramble"] : ["write", "scramble", "write"];
  return opts[Math.floor(Math.random() * opts.length)];
}

function taskFor(s, pref, canSpeak) {
  if (s.b <= 1) return RECOG[Math.floor(Math.random() * RECOG.length)];
  if (s.b === 2) return Math.random() < 0.3 ? RECOG[Math.floor(Math.random() * 3)] : productionType(pref, canSpeak);
  return productionType(pref, canSpeak);
}

// "Heutige Mission": fällige Wörter + wenige neue
export function buildMission(prog, lessons, { pref = "mix", canSpeak = false, maxDue = 8 } = {}) {
  const now = Date.now();
  const due = [], fresh = [];
  for (const l of lessons) for (const w of l.words) {
    const s = wstate(prog, l.id, w.id);
    if (s.b === 0) fresh.push({ l, w, s });
    else if (s.d <= now) due.push({ l, w, s });
  }
  due.sort((a, b) => a.s.d - b.s.d);
  const pickDue = due.slice(0, maxDue);
  const nNew = Math.max(2, 6 - Math.floor(pickDue.length / 2));
  const pickNew = fresh.slice(0, nNew);
  const tasks = [];
  for (const it of pickNew) tasks.push({ type: "intro", ...it });
  const practice = shuffle([
    ...pickNew.map(it => ({ type: RECOG[Math.floor(Math.random() * 2)], ...it })),
    ...pickDue.map(it => ({ type: taskFor(it.s, pref, canSpeak), ...it })),
  ]);
  return [...tasks, ...practice];
}

// Übung auf einer Insel mit gewählter Übungsart
export function buildLessonPractice(prog, lesson, type, n = 10) {
  const now = Date.now();
  const items = lesson.words.map(w => ({ l: lesson, w, s: wstate(prog, lesson.id, w.id) }));
  // Priorität: fällig > unsicher > neu > sicher
  items.sort((a, b) => score(a.s) - score(b.s));
  function score(s) {
    if (s.b >= 1 && s.d <= now) return 0 + s.b;
    if (s.b === 0) return 10;
    return 20 + s.b;
  }
  const pick = shuffle(items.slice(0, Math.min(n, items.length)));
  if (type === "discover") return items.map(it => ({ type: "intro", ...it }));
  return pick.map(it => ({ type, ...it }));
}

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
      if (a === t || a.endsWith(" " + t) || a.includes(t)) return true;
      if (lev(a, t) <= Math.max(1, Math.floor(t.length * 0.25))) return true;
    }
  }
  return false;
}

// ---- Belohnungen ----------------------------------------------
export function logActivity(prog, { sec = 0, ans = 0, ok = 0 } = {}) {
  const t = todayStr();
  const d = prog.days[t] || { sec: 0, ans: 0, ok: 0 };
  d.sec += sec; d.ans += ans; d.ok += ok;
  prog.days[t] = d;
  // Serie (Tage in Folge)
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
    const d = prog.days[todayStr(new Date(now.getTime() - i * DAY))];
    if (d) { sec += d.sec; ans += d.ans; ok += d.ok; if (d.ans > 0) daysActive++; }
  }
  return { sec, ans, ok, daysActive };
}

export const BADGES = [
  { id: "first", icon: "🌱", name: "Erste Schritte", desc: "Die erste Übung geschafft", test: (p, o) => Object.keys(p.days).length > 0 },
  { id: "w10", icon: "🐚", name: "10 Wörter", desc: "10 Wörter sicher gelernt", test: (p, o) => o.known >= 10 },
  { id: "w50", icon: "🦀", name: "50 Wörter", desc: "50 Wörter sicher gelernt", test: (p, o) => o.known >= 50 },
  { id: "w100", icon: "🐬", name: "100 Wörter", desc: "100 Wörter sicher gelernt", test: (p, o) => o.known >= 100 },
  { id: "s3", icon: "🔥", name: "3 Tage", desc: "3 Tage hintereinander geübt", test: p => p.streak.n >= 3 },
  { id: "s7", icon: "🌋", name: "7 Tage", desc: "Eine ganze Woche jeden Tag geübt", test: p => p.streak.n >= 7 },
  { id: "speak20", icon: "🎤", name: "Sprech-Profi", desc: "20 Wörter richtig gesprochen", test: p => p.spoken >= 20 },
  { id: "write20", icon: "✏️", name: "Schreib-Profi", desc: "20 Wörter richtig geschrieben", test: p => p.typed >= 20 },
  { id: "star3", icon: "🏝️", name: "Insel-Meister", desc: "Auf einer Insel 3 Sterne", test: p => Object.values(p.stars).some(s => s >= 3) },
  { id: "master", icon: "🧭", name: "Wort-Kapitän", desc: "20 Wörter gemeistert", test: (p, o) => o.master >= 20 },
];

export function checkBadges(prog, lessons) {
  const o = overallStats(prog, lessons);
  const fresh = [];
  for (const b of BADGES) if (!prog.badges.includes(b.id) && b.test(prog, o)) { prog.badges.push(b.id); fresh.push(b); }
  return fresh;
}
