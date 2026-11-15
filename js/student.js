import { Store, Device } from "./store.js";
import { esc, pinHash, PIN_EMOJI, LANG_FLAG } from "./util.js";
import { render, $, $$, toast, modal, pic, hasPic, avatarHtml, sfx, confetti, ICON, stars } from "./ui.js";
import { art, hat, ANIMAL_KEYS, HAT_KEYS } from "./art.js";
import { say, listen, canListen } from "./speech.js";
import {
  emptyProgress, lessonStats, overallStats, unlockedLessons, planLearn, markSeen, countAnswer, fallBack, promote,
  checkWritten, checkSpoken, logActivity, currentStreak, weekSummary, checkBadges, BADGES, wstate, shuffle,
  stripArticle, todayStr, DAY, NEEDED_TODAY, MIN_GAP, BOX_NAMES, wkey,
  weekState, weekLabel, schoolDay, perDayFor, newAllowed, sortLessons, DAILY_GOAL_SEC, todaySeconds, mondayOf,
} from "./srs.js";

const S = { cls: null, student: null, prog: null, lessons: [], classWeekOk: 0 };
let goHome = () => {};
let backToStart = () => {};

// Wort vorlesen; zweimal schnell hintereinander = langsamer
let lastSay = { t: 0, w: "" };
function sayWord(text, lang = "fr") {
  const slow = lastSay.w === text && Date.now() - lastSay.t < 5000;
  lastSay = { t: Date.now(), w: text };
  return say(text, lang, slow ? 0.55 : 0.85);
}

// ------------------------------------------------------------------
//  Anmeldung
// ------------------------------------------------------------------
export async function studentLogin(cls, back) {
  S.cls = cls; backToStart = back;
  document.body.classList.add("kid-mode");
  render(`<div class="wrap narrow"><div class="panel center">Lade Klasse …</div></div>`);
  let students = [], progs = [];
  try { [students, progs] = await Promise.all([Store.list("student"), Store.list("progress")]); }
  catch (e) { render(`<div class="wrap narrow"><div class="panel">${esc(e.message)}</div></div>`); return; }
  const pmap = Object.fromEntries(progs.map(p => [p.id, p]));
  students.sort((a, b) => a.name.localeCompare(b.name, "de"));
  render(`<div class="wrap narrow">
    <div class="row between"><button class="icon-btn" id="back" aria-label="Zurück">${ICON.back}</button><span class="chip">${esc(cls.name || Store.code)}</span></div>
    <div class="hello"><span class="mascot">${art("parrot")}</span><div class="bubble"><h1>Wer bist du?</h1><p>Tippe auf deinen Namen.</p></div></div>
    <div class="kid-grid">${students.map(s => `<button class="kid-btn" data-id="${esc(s.id)}">${avatarHtml(pmap[s.id]?.avatar)}<span>${esc(s.name)}</span></button>`).join("") ||
      `<div class="panel">Noch keine Kinder in dieser Klasse. Die Lehrkraft kann sie im Lehrerbereich anlegen.</div>`}</div>
  </div>`);
  $("#back").onclick = back;
  $$(".kid-btn").forEach(b => b.onclick = () => pinScreen(students.find(s => s.id === b.dataset.id), pmap[b.dataset.id], cls, back));
}

function pinScreen(student, prog, cls, back) {
  let pin = [];
  render(`<div class="wrap narrow">
    <div class="row"><button class="icon-btn" id="back" aria-label="Zurück">${ICON.back}</button></div>
    <div class="panel center stack">
      <div style="justify-self:center">${avatarHtml(prog?.avatar, "lg")}</div>
      <h2>Hallo ${esc(student.name)}!</h2>
      <p class="muted" style="margin:0">Tippe deine 3 Geheim-Bilder.</p>
      <div class="pin-dots" id="dots"></div>
      <div class="pin-pad">${PIN_EMOJI.map(e => `<button data-e="${e}" aria-label="Bild">${art(e)}</button>`).join("")}</div>
      <button class="btn ghost small" id="del" style="justify-self:center">Löschen</button>
    </div></div>`);
  $("#back").onclick = () => studentLogin(cls, back);
  const dots = () => $("#dots").innerHTML = [0, 1, 2].map(i => `<span>${pin[i] ? art(pin[i]) : ""}</span>`).join("");
  dots();
  $("#del").onclick = () => { pin.pop(); dots(); };
  $$(".pin-pad button").forEach(b => b.onclick = async () => {
    if (pin.length >= 3) return;
    sfx.tap(); pin.push(b.dataset.e); dots();
    if (pin.length === 3) {
      const ok = (await pinHash(Store.code, pin)) === student.pinHash;
      if (ok) { Device.set("lastStudent", student.id); await enter(student, back); }
      else { sfx.no(); $("#dots").classList.add("shake"); setTimeout(() => { pin = []; dots(); $("#dots")?.classList.remove("shake"); }, 450); toast("Das war nicht ganz richtig. Probier es nochmal!"); }
    }
  });
}

async function enter(student, back) {
  S.student = student;
  const [lessons, prog, all] = await Promise.all([Store.list("lesson"), Store.getOne("progress", student.id), Store.list("progress")]);
  S.prog = { ...emptyProgress(), ...(prog || {}) };
  S.prog.tests = S.prog.tests || {};
  delete S.prog.id; delete S.prog._updated;
  S.lessons = sortLessons(lessons
    .filter(l => l.words?.length && (l.assigned === "all" || !l.assigned || (Array.isArray(l.assigned) && l.assigned.includes(student.id)))));
  S.prog.memos = S.prog.memos || {}; S.prog.drawings = S.prog.drawings || {};
  S.classWeekOk = all.reduce((sum, p) => sum + weekSummary(p.id === student.id ? S.prog : { days: p.days || {} }).ok, 0);
  goHome = () => home(back);
  home(back);
}

let saveT;
function save(now = false) {
  clearTimeout(saveT);
  const go = async () => {
    for (const l of S.lessons) S.prog.stars[l.id] = lessonStats(S.prog, l).stars;
    try { await Store.put("progress", S.student.id, S.prog); }
    catch (e) { toast("Speichern hat nicht geklappt. Ist das Internet an?"); }
  };
  if (now) return go();
  saveT = setTimeout(go, 1200);
}

// ------------------------------------------------------------------
//  Startseite
// ------------------------------------------------------------------
function topbar() {
  return `<div class="topbar">
    ${avatarHtml(S.prog.avatar, "sm")}
    <span class="name">${esc(S.student.name)}</span>
    <span class="chip fire" title="Tage hintereinander geübt">${art("flame", "ic")} ${currentStreak(S.prog)}</span>
    <span class="chip coin" title="Münzen">${art("coin", "ic")} ${S.prog.coins}</span>
    <nav class="navbtns">
      <button class="nav-btn" id="tb-home" aria-label="Start">${art("map")}</button>
      <button class="nav-btn" id="tb-me" aria-label="Mein Fortschritt">${art("telescope")}</button>
      <button class="nav-btn" id="tb-shop" aria-label="Shop">${art("chest")}</button>
      <button class="nav-btn" id="tb-out" aria-label="Abmelden">${art("door")}</button>
    </nav>
  </div>`;
}
function bindTop() {
  $("#tb-home").onclick = () => goHome();
  $("#tb-me").onclick = () => myProgress();
  $("#tb-shop").onclick = () => shop();
  $("#tb-out").onclick = async () => { await save(true); document.body.classList.remove("kid-mode"); backToStart(); };
}

function home() {
  const unlocked = unlockedLessons(S.prog, S.lessons, S.cls.allOpen);
  const plan = planLearn(S.prog, unlocked);
  const doneToday = S.prog.missionDay === todayStr();
  const goal = S.cls.goal || { title: "Leuchtturm bauen", target: 400 };
  const gp = Math.min(100, Math.round((S.classWeekOk / Math.max(1, goal.target)) * 100));
  const nNew = plan.filter(p => p.kind === "new").length, nRep = plan.length - nNew;

  render(`<div class="wrap">
    ${topbar()}
    <div class="hello">
      <span class="mascot">${art("parrot")}</span>
      <div class="bubble"><h1>Hallo ${esc(S.student.name)}!</h1>
        <p>${plan.length ? `Heute warten <b>${plan.length} Wörter</b> auf dich${nRep && nNew ? ` (${nRep} zum Wiederholen, ${nNew} neue)` : ""}.` : doneToday ? "Super, für heute ist alles geschafft! Du kannst testen oder spielen." : "Alles wiederholt! Du kannst testen oder spielen."}</p>
        <p class="small muted">${esc(encouragement())}</p></div>
      ${goalRing()}
    </div>
    ${weekCard(unlocked)}
    <div class="big-actions">
      <button class="mode-btn learn" id="learn">${art("book", "mode-art")}<span><b>Lernen</b><small>${plan.length ? "mit Hilfen üben" : "nochmal üben"}</small></span></button>
      <button class="mode-btn test" id="test">${art("clipboard", "mode-art")}<span><b>Testen</b><small>Kann ich es schon?</small></span></button>
    </div>
    <div class="panel goal">
      <span class="goal-art">${art("rocket")}</span>
      <div class="stack" style="gap:6px;flex:1;min-width:0">
        <div class="row between"><b>Klassenziel: ${esc(goal.title)}</b><span class="small muted">${S.classWeekOk} / ${goal.target}</span></div>
        <div class="goal-bar"><i style="width:${gp}%"></i></div>
        <span class="small muted">Jede richtige Antwort hilft der ganzen Klasse.</span>
      </div>
    </div>
    ${hardCard()}
    <h2 class="section-title">Meine Inseln</h2>
    <div class="isle-grid">${S.lessons.length ? S.lessons.map(l => islandCard(l, unlocked.includes(l))).join("") : `<div class="panel">Deine Lehrkraft hat noch keine Lektion für dich freigegeben.</div>`}</div>
  </div>`);
  if ($("#weekLearn")) $("#weekLearn").onclick = () => startLearn(null, S.lessons.find(l => l.id === $("#weekLearn").dataset.id));
  if ($("#weekTest")) $("#weekTest").onclick = () => startTest(S.lessons.find(l => l.id === $("#weekTest").dataset.id));
  if ($("#hardGo")) $("#hardGo").onclick = () => practiceHard();
  bindTop();
  $("#learn").onclick = () => startLearn(unlocked);
  $("#test").onclick = () => chooseTest(unlocked);
  bindIslands(unlocked);
}

function islandCard(l, open) {
  const st = lessonStats(S.prog, l);
  return `<button class="isle ${open ? "" : "locked"}" data-id="${esc(l.id)}" aria-label="${esc(l.title)}${open ? "" : " (gesperrt)"}">
    <span class="isle-pic">${l.iconImg ? `<img src="${esc(l.iconImg)}" alt="" loading="lazy">` : art("island")}${open ? "" : `<span class="isle-lock">${art("lock")}</span>`}${open && st.due ? `<span class="due">${st.due}</span>` : ""}</span>
    <span class="isle-name">${esc(l.title)} <span class="flag">${LANG_FLAG[l.lang] || ""}</span></span>
    ${l.week ? `<span class="week-tag ${weekState(l)}">${weekState(l) === "current" ? "diese Woche" : weekState(l) === "future" ? "ab " + esc(weekLabel(l.week).split(" (")[0]) : esc(weekLabel(l.week).split(" (")[0])}</span>` : ""}
    ${stars(st.stars, "sm")}
    ${st.testPassed ? `<span class="test-ok">Test ✓</span>` : ""}
  </button>`;
}
function bindIslands(unlocked) {
  $$(".isle").forEach(b => b.onclick = () => {
    const l = S.lessons.find(x => x.id === b.dataset.id);
    if (b.classList.contains("locked")) { sfx.no(); toast(weekState(l) === "future" ? `Diese Insel öffnet sich in ${weekLabel(l.week)}.` : "Hol dir zuerst einen Stern auf der Insel davor!"); return; }
    islandView(l);
  });
}

function encouragement() {
  const st = currentStreak(S.prog), o = overallStats(S.prog, S.lessons);
  if (st >= 3) return `Schon ${st} Tage hintereinander geübt. Stark!`;
  if (o.known >= 10) return `Du kannst schon ${o.known} Wörter.`;
  return "Ein paar Minuten jeden Tag – so merkt sich dein Kopf die Wörter am besten.";
}

async function askAnswerMode(title) {
  return modal(`<h2 class="center">${esc(title)}</h2>
    <div class="choose">
      <button class="choose-btn" data-close="mix">${art("games")}<b>Gemischt</b><small>Schreiben und Sprechen</small></button>
      <button class="choose-btn" data-close="write">${art("clipboard")}<b>Schreiben</b><small>mit der Tastatur</small></button>
      ${canListen ? `<button class="choose-btn" data-close="speak">${art("parrot")}<b>Sprechen</b><small>ins Mikrofon</small></button>` : ""}
    </div>`);
}

async function startLearn(lessons, onlyLesson) {
  const pool = onlyLesson ? [onlyLesson] : lessons;
  let items = planLearn(S.prog, pool);
  if (!items.length) {
    // alles erledigt: freiwillig üben (ändert die Pausen nicht)
    items = shuffle(pool.flatMap(l => l.words.map(w => ({ l, w, s: wstate(S.prog, l.id, w.id), kind: "extra" })))).slice(0, 8);
    if (!items.length) return toast("Hier gibt es noch keine Wörter.");
    toast("Alles für heute geschafft! Jetzt übst du freiwillig.", 3500);
  }
  const pref = await askAnswerMode("Wie möchtest du üben?");
  if (!pref) return;
  S.prog.pref = pref;
  runLearn(items, { pref, lesson: onlyLesson, mission: !onlyLesson });
}

async function chooseTest(unlocked) {
  if (!unlocked.length) return toast("Noch keine Insel offen.");
  const id = unlocked.length === 1 ? unlocked[0].id : await modal(`<h2 class="center">Welche Insel testen?</h2>
    <div class="isle-grid">${unlocked.map(l => { const st = lessonStats(S.prog, l); return `<button class="isle" data-close="${esc(l.id)}"><span class="isle-pic">${l.iconImg ? `<img src="${esc(l.iconImg)}" alt="">` : art("island")}</span><span class="isle-name">${esc(l.title)}</span>${st.testBest != null ? `<span class="small muted">Bestes: ${st.testBest} %</span>` : ""}</button>`; }).join("")}</div>`);
  const l = S.lessons.find(x => x.id === id);
  if (l) startTest(l);
}
async function startTest(l) {
  const mode = await askAnswerMode(`Test: ${l.title}`);
  if (!mode) return;
  runTest(l, mode);
}

// ------------------------------------------------------------------
//  Insel
// ------------------------------------------------------------------
function islandView(l) {
  const st = lessonStats(S.prog, l);
  render(`<div class="wrap">
    ${topbar()}
    <div class="panel isle-head">
      <span class="isle-pic big">${l.iconImg ? `<img src="${esc(l.iconImg)}" alt="">` : art("island")}</span>
      <div class="stack" style="gap:6px;flex:1;min-width:0">
        <h1>${esc(l.title)}</h1>
        <span class="muted">${st.total} Wörter · Französisch → ${LANG_FLAG[l.lang] || ""}${l.week ? ` · ${esc(weekLabel(l.week))}` : ""}</span>
        ${stars(st.stars)}
        <div class="bar" title="gelernt"><i style="width:${st.knownPct}%"></i></div>
        <span class="small muted">${starHint(st)}${st.testBest != null ? ` · Bester Test: ${st.testBest} %` : ""}</span>
      </div>
    </div>
    <div class="big-actions">
      <button class="mode-btn learn" id="learn">${art("book", "mode-art")}<span><b>Lernen</b><small>${st.due ? `${st.due} Wörter warten` : "freiwillig üben"}</small></span></button>
      <button class="mode-btn test" id="test">${art("clipboard", "mode-art")}<span><b>Testen</b><small>alle ${st.total} Wörter</small></span></button>
    </div>
    <h2 class="section-title">Mehr</h2>
    <div class="acts">
      <button class="act" data-k="shower">${art("shower")}<b>Vokabeldusche</b><small>zuhören und nachsprechen</small></button>
      <button class="act" data-k="words">${art("telescope")}<b>Wörter ansehen</b><small>malen und Eselsbrücken</small></button>
      <button class="act" data-k="match">${art("postit")}<b>Post-its zuordnen</b><small>Wort zum Bild</small></button>
      <button class="act" data-k="sort">${art("baskets")}<b>Sortieren</b><small>${canSortArticle(l) ? "le oder la?" : "kurz oder lang?"}</small></button>
      <button class="act" data-k="move">${art("jump")}<b>Bewegungsrunde</b><small>hüpfen und sprechen</small></button>
      <button class="act" data-k="memory">${art("games")}<b>Memory</b><small>Finde die Paare</small></button>
      <button class="act" data-k="blitz">${art("flame")}<b>Blitzrunde</b><small>60 Sekunden</small></button>
    </div>
  </div>`);
  bindTop();
  $("#learn").onclick = () => startLearn(null, l);
  $("#test").onclick = () => startTest(l);
  $$(".act").forEach(b => b.onclick = () => ({ words: wordList, memory: memoryGame, blitz, shower: vocabShower, match: matchGame, sort: sortGame, move: moveGame })[b.dataset.k](l));
}
function starHint(st) {
  if (st.stars === 0) return "Stern 1: Lerne alle Wörter einmal kennen.";
  if (st.stars === 1) return "Stern 2: 8 von 10 Wörtern 2× richtig geschafft.";
  if (st.stars === 2) return "Stern 3: Wiederhole an verschiedenen Tagen – dann sitzen die Wörter!";
  return "Insel-Meister! Wiederhole ab und zu.";
}

// ------------------------------------------------------------------
//  Bausteine für Übungskarten
// ------------------------------------------------------------------
function distractors(item, n, field) {
  const pool = [];
  const seen = new Set([norm(item.w[field])]);
  const add = (l, w) => { const k = norm(w[field]); if (!seen.has(k) && w[field]) { seen.add(k); pool.push({ l, w }); } };
  for (const w of shuffle(item.l.words)) add(item.l, w);
  if (pool.length < n) for (const l of S.lessons) for (const w of shuffle(l.words)) if (l.lang === item.l.lang || field === "fr") add(l, w);
  return pool.slice(0, n);
}
const norm = s => String(s || "").trim().toLowerCase();

let onQuit = null;
function exFrame({ mode, label, progress, coins }, inner) {
  render(`<div class="wrap narrow ex">
    <div class="ex-top">
      <button class="icon-btn" id="quit" aria-label="Beenden">${ICON.close}</button>
      <div class="ex-progress"><i style="width:${progress}%"></i></div>
      <span class="chip coin">${art("coin", "ic")} ${coins}</span>
    </div>
    <div class="card ${mode}" id="card"><div class="card-tag"><span class="pill ${mode === "test" ? "orange" : "green"}">${mode === "test" ? "Testen" : "Lernen"}</span><span class="small muted">${esc(label || "")}</span></div>${inner}</div></div>`);
  $("#quit").onclick = () => onQuit && onQuit();
}
const speakerBtn = (id = "hear", big = false) => `<button class="round-btn blue ${big ? "big" : ""}" id="${id}" aria-label="Wort anhören" title="Wort anhören">${ICON.speaker}</button>`;
const micBtn = (id = "mic", big = false) => canListen ? `<button class="round-btn coral ${big ? "big" : ""}" id="${id}" aria-label="Sprechen" title="Antwort sprechen">${ICON.mic}</button>` : "";
// Wort-Bild: Bild der Lehrkraft, sonst eigene Zeichnung des Kindes
const withDrawing = (l, w) => (w.img || w.emoji || !l) ? w : (S.prog.drawings?.[wkey(l.id, w.id)] ? { ...w, img: S.prog.drawings[wkey(l.id, w.id)] } : w);
const picBox = (w, l) => { const x = withDrawing(l, w); return hasPic(x) ? `<div class="prompt-pic">${pic(x)}</div>` : ""; };
const memoOf = (l, w) => S.prog.memos?.[wkey(l.id, w.id)] || w.memo || "";

// Mikrofon: hört zu, zeigt das Gehörte, liefert die erkannten Möglichkeiten
async function useMic(btn, out) {
  if (btn.classList.contains("on")) return null;
  btn.classList.add("on"); out.textContent = "Ich höre zu …";
  const r = await listen("fr", { onInterim: t => { out.textContent = `„${t}“`; } });
  btn.classList.remove("on");
  if (r.error === "not-allowed" || r.error === "service-not-allowed") { out.textContent = "Das Mikrofon ist nicht erlaubt. Bitte die Lehrkraft, es freizugeben."; return null; }
  if (!r.alts.length) { out.textContent = "Ich habe nichts gehört. Sprich etwas lauter und tippe nochmal."; return null; }
  out.textContent = `Ich habe „${r.alts[0]}“ gehört.`;
  return r.alts;
}

function feedbackBox(ok, w, msg, onNext, auto, memo) {
  const fb = document.createElement("div");
  fb.className = `feedback ${ok ? "ok" : "no"}`;
  fb.innerHTML = ok
    ? `<span>${esc(msg || ["Richtig!", "Super!", "Genau!", "Klasse!"][Math.floor(Math.random() * 4)])}</span>`
    : `<span>${esc(msg || "Nicht ganz. So heißt es:")}</span><span class="sol">${esc(w.fr)} <button class="round-btn blue mini" id="solHear" aria-label="Anhören">${ICON.speaker}</button></span>${memo ? `<span class="memo">${art("bulbArt", "ic")} ${esc(memo)}</span>` : ""}`;
  const btn = document.createElement("button");
  btn.className = "btn green"; btn.textContent = "Weiter";
  let gone = false;
  const go = () => { if (gone) return; gone = true; onNext(); };
  btn.onclick = go;
  fb.appendChild(btn);
  $("#card").appendChild(fb);
  ok ? sfx.ok() : sfx.no();
  if (!ok) { sayWord(w.fr); fb.querySelector("#solHear").onclick = () => sayWord(w.fr); }
  if (ok && auto) setTimeout(go, auto);
  btn.focus();
}

// Eine Abruf-Aufgabe (Schreiben / Sprechen / Buchstabensalat).
// cb({ok, helped, how}) – helped = 🔊 benutzt
function recallTask(item, type, ctx, cb, { test = false } = {}) {
  const { w, l } = item;
  let helped = false;
  const help = () => { helped = true; sayWord(w.fr); if (test) toast("Notfall-Hilfe: zählt im Test nur halb.", 2200); };

  if (type === "speak") {
    exFrame(ctx, `<span class="task-q">Sag das Wort auf Französisch</span>${picBox(w, l)}<div class="word-tr">${esc(w.tr)}</div>
      ${canListen ? `<div class="row center-row">${micBtn("mic", true)}${speakerBtn("hear")}</div><div id="heard" class="heard">Tippe auf das Mikrofon und sprich.</div>`
        : `<div class="row center-row">${speakerBtn("hear")}</div><button class="btn blue" id="reveal">Ich habe es laut gesagt – Lösung zeigen</button>`}`);
    $("#hear").onclick = help;
    if (!canListen) {
      $("#reveal").onclick = () => {
        sayWord(w.fr);
        $("#reveal").outerHTML = `<div class="word-fr">${esc(w.fr)}</div><div class="row center-row"><button class="btn green" id="sOk">Hatte ich richtig</button><button class="btn coral" id="sNo">Noch nicht</button></div>`;
        $("#sOk").onclick = () => cb({ ok: true, helped, how: "speak" });
        $("#sNo").onclick = () => cb({ ok: false, helped, how: "speak" });
      };
      return;
    }
    let tries = 0;
    $("#mic").onclick = async () => {
      const alts = await useMic($("#mic"), $("#heard"));
      if (!alts) return; // nichts gehört → zählt nicht als Versuch
      tries++;
      const ok = checkSpoken(alts, w.fr);
      if (ok || test || tries >= 2) { $("#mic").disabled = true; cb({ ok, helped, how: "speak" }); return; }
      sfx.no(); $("#heard").textContent += " Fast! Hör nochmal genau hin und versuch es nochmal.";
    };
    return;
  }

  if (type === "scramble") {
    const full = w.fr.split(/\s*\/\s*/)[0];
    const low = full.toLowerCase();
    const core = stripArticle(low) === low ? full : full.slice(full.length - stripArticle(low).length);
    const art_ = full.slice(0, full.length - core.length);
    const letters = [...core].filter(c => c !== " ");
    let order = shuffle(letters.map((c, i) => ({ c, i })));
    if (order.map(o => o.c).join("") === letters.join("") && letters.length > 1) order.reverse();
    const placed = [];
    exFrame(ctx, `<span class="task-q">Ordne die Buchstaben</span>${picBox(w, l)}<div class="word-tr">${esc(w.tr)}</div>
      <div class="row center-row">${art_ ? `<span class="word-fr small-fr">${esc(art_.trim())}</span>` : ""}<div class="slots" id="slots"></div>${speakerBtn("hear")}</div>
      <div class="tiles" id="tiles"></div>`);
    $("#hear").onclick = help;
    let tries = 0;
    const draw = () => {
      $("#slots").innerHTML = placed.map((o, k) => `<button class="tile" data-k="${k}">${esc(o.c)}</button>`).join("") || `<span class="muted" style="align-self:center">tippe die Buchstaben</span>`;
      $("#tiles").innerHTML = order.map((o, k) => `<button class="tile ${placed.includes(o) ? "used" : ""}" data-k="${k}">${esc(o.c)}</button>`).join("");
      $$("#tiles .tile").forEach(b => b.onclick = () => { const o = order[+b.dataset.k]; if (placed.includes(o)) return; placed.push(o); sfx.tap(); draw(); if (placed.length === letters.length) done(); });
      $$("#slots .tile").forEach(b => b.onclick = () => { placed.splice(+b.dataset.k, 1); draw(); });
    };
    const done = () => {
      const ok = placed.map(o => o.c).join("").toLowerCase() === letters.join("").toLowerCase();
      if (!ok && tries === 0 && !test) { tries++; sfx.no(); toast("Noch nicht ganz – tippe oben einen Buchstaben an, um ihn zurückzulegen."); return; }
      $$(".tile").forEach(t => t.disabled = true);
      cb({ ok, helped, how: "write" });
    };
    draw();
    return;
  }

  // Schreiben (mit Mikrofon als zweitem Weg)
  exFrame(ctx, `<span class="task-q">Schreib das Wort auf Französisch</span>${picBox(w, l)}<div class="word-tr">${esc(w.tr)}</div>
    <div class="write-row"><input class="input write-in" id="inp" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Antwort">${speakerBtn("hear")}${micBtn("mic")}</div>
    <div id="heard" class="heard"></div>
    <div class="accents">${["é", "è", "ê", "à", "ç", "ô", "î", "û", "ë", "œ", "'"].map(c => `<button data-c="${c}">${c}</button>`).join("")}</div>
    <div class="row center-row">${test ? "" : `<button class="btn ghost" id="hint">${ICON.bulb} Tipp</button>`}<button class="btn green" id="chk">Prüfen</button></div>`);
  const inp = $("#inp"); inp.focus();
  $("#hear").onclick = help;
  $$(".accents button").forEach(b => b.onclick = () => { const p = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, p) + b.dataset.c + inp.value.slice(inp.selectionEnd ?? p); inp.focus(); inp.setSelectionRange(p + 1, p + 1); });
  let hints = 0, tries = 0, finished = false;
  if ($("#hint")) $("#hint").onclick = () => { hints++; helped = true; const t = w.fr.split(/\s*\/\s*/)[0]; inp.value = t.slice(0, Math.min(t.length - 1, hints * Math.max(1, Math.ceil(t.length / 4)))); inp.focus(); };
  const finish = (ok, how, note, kind) => { if (finished) return; finished = true; $("#chk").disabled = true; inp.disabled = true; cb({ ok, helped, how, note, spelling: kind === "accent" || kind === "article" }); };
  const check = () => {
    const r = checkWritten(inp.value, w.fr);
    if (r === "almost" && tries === 0 && !test) { tries++; sfx.no(); toast("Fast! Schau nochmal genau hin."); inp.focus(); return; }
    const ok = r === "perfect" || r === "accent" || r === "article";
    finish(ok, "write", r === "accent" ? `Achte auf die Akzente: ${w.fr}` : r === "article" ? `Denk an den Artikel: ${w.fr}` : "", r);
  };
  $("#chk").onclick = check;
  inp.onkeydown = e => { if (e.key === "Enter" && !finished) check(); };
  if ($("#mic")) $("#mic").onclick = async () => {
    const alts = await useMic($("#mic"), $("#heard"));
    if (!alts) return;
    const ok = checkSpoken(alts, w.fr);
    if (ok) { inp.value = w.fr; finish(true, "speak"); }
    else if (test) finish(false, "speak");
    else { sfx.no(); $("#heard").textContent += " Versuch es nochmal oder schreib es."; }
  };
}

// Wiedererkennen (nur zum Aufwärmen neuer Wörter)
function recogTask(item, ctx, cb) {
  const { w, l } = item;
  const types = ["fr2tr", "pic2fr", "listen"].filter(t => t !== "pic2fr" || true);
  const type = types[Math.floor(Math.random() * types.length)];
  const field = type === "pic2fr" ? "fr" : "tr";
  const opts = shuffle([{ l, w }, ...distractors(item, 3, field)]);
  const usePics = type === "listen" && opts.every(o => hasPic(o.w));
  let head;
  if (type === "fr2tr") head = `<span class="task-q">Was bedeutet das?</span><div class="row center-row"><div class="word-fr">${esc(w.fr)}</div>${speakerBtn("hear")}</div>`;
  else if (type === "pic2fr") head = `<span class="task-q">Wie heißt das auf Französisch?</span>${picBox(w, l)}<div class="word-tr">${esc(w.tr)}</div>`;
  else head = `<span class="task-q">Hör gut zu! Was passt?</span><div class="row center-row">${speakerBtn("hear", true)}</div>`;
  exFrame(ctx, `${head}<div class="choices">${opts.map((o, i) => `<button class="choice" data-i="${i}">${usePics ? `<span class="pic">${pic(o.w)}</span>` : esc(o.w[field])}</button>`).join("")}</div>`);
  if ($("#hear")) $("#hear").onclick = () => sayWord(w.fr);
  if (type !== "pic2fr") sayWord(w.fr);
  let done = false;
  $$(".choice").forEach(b => b.onclick = () => {
    const o = opts[+b.dataset.i];
    if (field === "fr") say(o.w.fr, "fr");
    if (done) return; done = true;
    const ok = o.w === w;
    b.classList.add(ok ? "right" : "wrong");
    if (!ok) $$(".choice").find(x => opts[+x.dataset.i].w === w)?.classList.add("right");
    cb(ok);
  });
}

function introCard(item, ctx, cb) {
  const { w, l } = item;
  exFrame(ctx, `<span class="task-q">Neues Wort</span>${picBox(w, l)}
    <div class="row center-row"><div class="word-fr">${esc(w.fr)}</div>${speakerBtn("hear")}</div>
    <div class="word-tr">${LANG_FLAG[l.lang] || ""} ${esc(w.tr)}</div>
    ${w.ex ? `<div class="small muted">„${esc(w.ex)}“</div>` : ""}
    ${memoOf(l, w) ? `<div class="memo">${art("bulbArt", "ic")} <span>${esc(memoOf(l, w))}</span></div>` : ""}
    <div class="row center-row">${canListen ? micBtn("mic") + `<span class="small muted">Sprich es nach!</span>` : `<span class="small muted">Sprich das Wort laut nach!</span>`}<button class="btn ghost small" id="draw">Malen</button></div>
    <div id="heard" class="heard"></div>
    <button class="btn green big" id="nxt">Weiter</button>`);
  $("#hear").onclick = () => sayWord(w.fr);
  sayWord(w.fr);
  if ($("#mic")) $("#mic").onclick = async () => {
    const alts = await useMic($("#mic"), $("#heard"));
    if (!alts) return;
    if (checkSpoken(alts, w.fr)) { $("#heard").textContent += " Toll ausgesprochen!"; sfx.ok(); }
    else $("#heard").textContent += " Hör nochmal hin und versuch es nochmal.";
  };
  $("#draw").onclick = () => drawWord(l, w, () => {});
  $("#nxt").onclick = cb;
}

// ------------------------------------------------------------------
//  LERNEN – Einheit nach „2× richtig mit Abstand“
// ------------------------------------------------------------------
function runLearn(items, opts) {
  const extra = items.every(i => i.kind === "extra");
  // neue Wörter zwischen die Wiederholungen streuen
  const rev = items.filter(i => i.kind !== "new"), neu = items.filter(i => i.kind === "new");
  const ordered = [];
  while (rev.length || neu.length) { if (rev.length) ordered.push(rev.shift()); if (rev.length) ordered.push(rev.shift()); if (neu.length) ordered.push(neu.shift()); }
  const q = ordered.map((it, i) => ({
    ...it,
    phase: it.kind === "new" ? "intro" : it.kind === "review" || it.kind === "extra" ? "recall" : "recog",
    need: it.kind === "review" || it.kind === "extra" ? 1 : NEEDED_TODAY,
    last: -100 + i, recalls: 0, done: false,
  }));
  const st = { pos: 0, ok: 0, ans: 0, coins: 0, t0: Date.now(), doneWords: 0, lastItem: null,
    starsBefore: Object.fromEntries(S.lessons.map(l => [l.id, lessonStats(S.prog, l).stars])) };
  const totalSteps = () => q.reduce((s, it) => s + (it.done ? 0 : (it.phase === "intro" ? 2 : it.phase === "recog" ? 1 : 0) + it.need), 0);
  const startSteps = totalSteps();

  const pick = () => {
    const open = q.filter(it => !it.done);
    if (!open.length) return null;
    let el = open.filter(it => st.pos - it.last > MIN_GAP);
    if (!el.length) el = open.filter(it => it !== st.lastItem);
    if (!el.length) el = open;
    el.sort((a, b) => a.last - b.last);
    return el[0];
  };
  const recallType = it => {
    const p = opts.pref;
    if (p === "write") return it.recalls === 0 && it.kind !== "review" && Math.random() < 0.4 ? "scramble" : "write";
    if (p === "speak") return canListen ? "speak" : "write";
    if (it.recalls === 0 && it.kind !== "review") return Math.random() < 0.5 ? "scramble" : "write";
    return canListen && Math.random() < 0.5 ? "speak" : "write";
  };

  const next = () => {
    const it = pick();
    if (!it) return finish();
    st.lastItem = it;
    const ctx = { mode: "learn", label: opts.lesson ? opts.lesson.title : "Lernen", progress: Math.round((1 - totalSteps() / Math.max(1, startSteps)) * 100), coins: st.coins };
    const after = () => { it.last = st.pos; st.pos++; save(); };

    if (it.phase === "intro") {
      return introCard(it, ctx, () => { if (!extra) markSeen(S.prog, it.l, it.w); it.phase = "recog"; after(); next(); });
    }
    if (it.phase === "recog") {
      return recogTask(it, ctx, ok => {
        st.ans++; if (ok) st.ok++;
        countAnswer(S.prog, it.l, it.w, ok);
        if (ok) { it.phase = "recall"; after(); feedbackBox(true, it.w, "", next, 900); }
        else { after(); feedbackBox(false, it.w, "", next); }
      });
    }
    recallTask(it, recallType(it), ctx, ({ ok, helped, how, note }) => {
      st.ans++;
      countAnswer(S.prog, it.l, it.w, ok);
      if (ok) {
        st.ok++; st.coins += 1;
        if (how === "speak") S.prog.spoken++; else S.prog.typed++;
        if (helped) { after(); return feedbackBox(true, it.w, "Mit Hilfe geschafft! Das Wort kommt gleich nochmal – dann ohne Hilfe.", next); }
        it.recalls++; it.need--;
        if (it.need <= 0) {
          it.done = true; st.doneWords++; st.coins += 2; sfx.coin();
          let msg = "Für heute geschafft!";
          if (!extra) { const s = promote(S.prog, it.l, it.w); msg += ` Das Wort kommt ${s.b === 2 ? "morgen" : `in ${BOX_NAMES[s.b]}`} wieder.`; }
          after(); return feedbackBox(true, it.w, note || msg, next, 1500);
        }
        after(); return feedbackBox(true, it.w, note || "Richtig! Gleich nochmal – nach ein paar anderen Wörtern.", next, 1200);
      }
      // Fehler: zurück auf „heute lernen“, wieder 2× richtig nötig
      if (!extra) fallBack(S.prog, it.l, it.w);
      it.need = extra ? 1 : NEEDED_TODAY; it.kind = it.kind === "extra" ? "extra" : "learn";
      after(); feedbackBox(false, it.w, "Nicht ganz – das Wort kommt gleich nochmal. So heißt es:", next, 0, memoOf(it.l, it.w));
    });
  };

  const finish = () => {
    const sec = Math.round((Date.now() - st.t0) / 1000);
    logActivity(S.prog, { sec, ans: st.ans, ok: st.ok });
    S.prog.coins += st.coins; S.prog.xp += st.ok * 10;
    S.classWeekOk += st.ok;
    if (opts.mission && planLearn(S.prog, unlockedLessons(S.prog, S.lessons, S.cls.allOpen)).length === 0) S.prog.missionDay = todayStr();
    const newStars = S.lessons.filter(l => lessonStats(S.prog, l).stars > (st.starsBefore[l.id] || 0));
    const badges = checkBadges(S.prog, S.lessons);
    save(true);
    sfx.win(); confetti(newStars.length || badges.length ? 200 : 90);
    render(`<div class="wrap narrow"><div class="card result">
      <div class="result-art">${art("trophy")}</div>
      <h1>Super gemacht!</h1>
      <p class="muted" style="margin:0">${st.doneWords} ${st.doneWords === 1 ? "Wort" : "Wörter"} für heute geschafft · ${st.ok} von ${st.ans} Antworten richtig.</p>
      <p class="small muted" style="margin:0">Die geschafften Wörter machen jetzt Pause und kommen später wieder. So bleiben sie im Kopf.</p>
      <div class="reward-row"><span class="reward">${art("coin", "ic")} +${st.coins}</span><span class="reward">${art("flame", "ic")} ${currentStreak(S.prog)}</span></div>
      ${newStars.map(l => `<div class="feedback ok">${art("star", "ic")} Neuer Stern auf „${esc(l.title)}“!</div>`).join("")}
      ${badges.map(b => `<div class="feedback ok">${art(b.icon, "ic")} Neues Abzeichen: ${esc(b.name)}</div>`).join("")}
      <button class="btn green big" id="done">Weiter</button>
    </div></div>`);
    $("#done").onclick = () => opts.lesson ? islandView(opts.lesson) : goHome();
  };

  onQuit = () => { if (st.ans) finish(); else (opts.lesson ? islandView(opts.lesson) : goHome()); };
  next();
}

// ------------------------------------------------------------------
//  TESTEN – jedes Wort einmal, ohne Hilfen
// ------------------------------------------------------------------
function runTest(l, mode) {
  const words = shuffle(l.words).slice(0, 25);
  const res = [];
  let i = 0, coins = 0;
  const t0 = Date.now();
  const typeFor = k => mode === "write" ? "write" : mode === "speak" ? (canListen ? "speak" : "write") : (canListen && k % 2 ? "speak" : "write");
  const next = () => {
    if (i >= words.length) return finish();
    const w = words[i];
    const ctx = { mode: "test", label: `Test: ${l.title} · ${i + 1} von ${words.length}`, progress: Math.round(i / words.length * 100), coins };
    recallTask({ l, w }, typeFor(i), ctx, ({ ok, helped, how, spelling }) => {
      if (ok && spelling) helped = true; // Rechtschreibung: Akzent/Artikel fehlt = halber Punkt
      res.push({ w, ok, helped, spelling });
      countAnswer(S.prog, l, w, ok);
      if (ok && !helped) {
        coins += 2;
        const s = wstate(S.prog, l.id, w.id);
        if (s.b < 2 || s.d <= Date.now()) promote(S.prog, l, w);
        if (how === "speak") S.prog.spoken++; else S.prog.typed++;
      } else fallBack(S.prog, l, w);
      i++; save();
      // im Test keine Lösung zeigen – nur kurz weiter
      if (ok) { sfx.ok(); setTimeout(next, 500); }
      else { sfx.no(); setTimeout(next, 500); }
    }, { test: true });
  };
  const finish = () => {
    const score = Math.round(res.reduce((s, r) => s + (r.ok ? (r.helped ? 0.5 : 1) : 0), 0) / Math.max(1, res.length) * 100);
    const prev = S.prog.tests[l.id] || { best: 0, count: 0 };
    S.prog.tests[l.id] = { best: Math.max(prev.best || 0, score), last: score, date: todayStr(), count: (prev.count || 0) + 1, n: res.length };
    const passed = score >= 80;
    if (passed) coins += 10;
    S.prog.coins += coins;
    const ok = res.filter(r => r.ok && !r.helped).length;
    logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: res.length, ok });
    S.classWeekOk += ok;
    const badges = checkBadges(S.prog, S.lessons);
    save(true);
    if (passed) { sfx.win(); confetti(200); }
    const wrong = res.filter(r => !r.ok || r.helped);
    render(`<div class="wrap narrow"><div class="card result">
      <div class="result-art">${art(passed ? "medal" : "book")}</div>
      <h1>${score} %</h1>
      <p style="margin:0;font-size:1.2rem">${passed ? "Test bestanden! Du kannst die Wörter richtig gut." : score >= 50 ? "Schon gut! Ein paar Wörter brauchen noch Übung." : "Gut, dass du getestet hast! Jetzt weißt du, was du üben kannst."}</p>
      <div class="reward-row"><span class="reward">${art("coin", "ic")} +${coins}</span>${passed ? `<span class="reward">${art("star", "ic")} Test-Stern</span>` : ""}</div>
      ${wrong.length ? `<div class="stack" style="text-align:left"><b>Diese Wörter üben wir noch:</b>${wrong.map((r, k) => `<div class="word-row">${hasPic(r.w) ? `<span class="wpic">${pic(r.w)}</span>` : ""}<span><b>${esc(r.w.fr)}</b> – ${esc(r.w.tr)}${r.spelling ? ` <span class="pill orange">Rechtschreibung</span>` : r.helped && r.ok ? ` <span class="pill">mit Hilfe</span>` : ""}</span><button class="round-btn blue mini" data-say="${k}" aria-label="Anhören">${ICON.speaker}</button></div>`).join("")}</div>` : ""}
      ${badges.map(b => `<div class="feedback ok">${art(b.icon, "ic")} Neues Abzeichen: ${esc(b.name)}</div>`).join("")}
      <div class="row center-row">${wrong.length ? `<button class="btn green big" id="learnWrong">Diese Wörter lernen</button>` : ""}<button class="btn ghost" id="back">Zur Insel</button></div>
    </div></div>`);
    $$("[data-say]").forEach(b => b.onclick = () => sayWord(wrong[+b.dataset.say].w.fr));
    if ($("#learnWrong")) $("#learnWrong").onclick = async () => {
      const pref = await askAnswerMode("Wie möchtest du üben?");
      if (!pref) return;
      runLearn(wrong.map(r => ({ l, w: r.w, s: wstate(S.prog, l.id, r.w.id), kind: "learn" })), { pref, lesson: l });
    };
    $("#back").onclick = () => islandView(l);
  };
  onQuit = () => { if (res.length) finish(); else islandView(l); };
  next();
}

// ------------------------------------------------------------------
//  Wörter ansehen (Notfall-Nachschlagen mit Ton und Mikrofon)
// ------------------------------------------------------------------
function wordList(l) {
  render(`<div class="wrap">${topbar()}
    <div class="row"><button class="btn ghost small" id="back">${ICON.back} ${esc(l.title)}</button></div>
    <div class="word-cards">${l.words.map((w, k) => { const s = wstate(S.prog, l.id, w.id); return `<div class="word-card">
      ${hasPic(withDrawing(l, w)) ? `<div class="wc-pic">${pic(withDrawing(l, w))}</div>` : ""}
      <div class="wc-fr">${esc(w.fr)}</div><div class="wc-tr">${esc(w.tr)}</div>
      <div class="row center-row">${speakerBtn("h" + k).replace('id="h', 'data-k="' + k + '" id="h')}${canListen ? `<button class="round-btn coral" data-m="${k}" aria-label="Nachsprechen">${ICON.mic}</button>` : ""}</div>
      <div class="small muted" id="o${k}">${s.b >= 2 ? "gelernt" : s.b === 1 ? "wird geübt" : "neu"}</div>
      ${memoOf(l, w) ? `<div class="memo small">${art("bulbArt", "ic")} ${esc(memoOf(l, w))}</div>` : ""}
      <div class="row center-row"><button class="btn ghost small" data-draw="${k}">Malen</button><button class="btn ghost small" data-memo="${k}">Eselsbrücke</button></div></div>`; }).join("")}</div></div>`);
  bindTop();
  $("#back").onclick = () => islandView(l);
  $$("[data-draw]").forEach(b => b.onclick = () => drawWord(l, l.words[+b.dataset.draw], () => wordList(l)));
  $$("[data-memo]").forEach(b => b.onclick = async () => {
    const w = l.words[+b.dataset.memo], key = wkey(l.id, w.id);
    const r = await modal(`<h2>Eselsbrücke für „${esc(w.fr)}“</h2><p class="small muted" style="margin:0">Eine Merkhilfe, ein Reim oder ein Bild im Kopf. Beispiel: „le chat – der Kater schaut auf den <b>Schatz</b>“.</p>
      <textarea class="input" id="mm" style="font-family:inherit;min-height:90px">${esc(S.prog.memos[key] || w.memo || "")}</textarea>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost small" data-close="">Abbrechen</button><button class="btn green small" id="ok">Speichern</button></div>`,
      { onMount: (m, close) => { m.querySelector("#mm").focus(); m.querySelector("#ok").onclick = () => close(m.querySelector("#mm").value.trim() || "__leer__"); } });
    if (!r) return;
    if (r === "__leer__") delete S.prog.memos[key]; else S.prog.memos[key] = r.slice(0, 200);
    save(); wordList(l);
  });
  $$("[data-k]").forEach(b => b.onclick = () => sayWord(l.words[+b.dataset.k].fr));
  $$("[data-m]").forEach(b => b.onclick = async () => {
    const k = +b.dataset.m, out = $("#o" + k);
    const alts = await useMic(b, out);
    if (alts) { const ok = checkSpoken(alts, l.words[k].fr); out.textContent += ok ? " Super ausgesprochen!" : " Hör nochmal hin."; ok ? sfx.ok() : sfx.no(); }
  });
}

// ------------------------------------------------------------------
//  Memory
// ------------------------------------------------------------------
function memoryGame(l) {
  const words = shuffle(l.words).slice(0, Math.min(6, l.words.length));
  const cards = shuffle(words.flatMap(w => [{ w, side: "fr" }, { w, side: "b" }]));
  let open = [], pairs = 0, moves = 0, lock = false;
  const t0 = Date.now();
  render(`<div class="wrap narrow">
    <div class="ex-top"><button class="icon-btn" id="quit" aria-label="Beenden">${ICON.close}</button><b class="ex-title">Memory – ${esc(l.title)}</b><span class="chip" id="mv">Züge: 0</span></div>
    <div class="memory" id="mem">${cards.map((c, i) => `<button class="mem" data-i="${i}" aria-label="Karte ${i + 1}">${art("parrot")}</button>`).join("")}</div></div>`);
  $("#quit").onclick = () => islandView(l);
  $$(".mem").forEach(b => b.onclick = () => {
    const c = cards[+b.dataset.i];
    if (lock || b.classList.contains("open") || b.classList.contains("done")) return;
    b.classList.add("open");
    b.innerHTML = c.side === "fr" ? `<span class="t">${esc(c.w.fr)}</span>` : hasPic(c.w) ? (c.w.img ? `<img src="${esc(c.w.img)}" alt="">` : `<span class="e">${esc(c.w.emoji)}</span>`) : `<span class="t">${esc(c.w.tr)}</span>`;
    if (c.side === "fr") sayWord(c.w.fr);
    open.push(b);
    if (open.length === 2) {
      moves++; $("#mv").textContent = `Züge: ${moves}`;
      const [a, d] = open.map(x => cards[+x.dataset.i]);
      if (a.w === d.w && a.side !== d.side) {
        sfx.ok(); open.forEach(x => x.classList.replace("open", "done")); open = []; pairs++;
        if (pairs === words.length) {
          const coins = Math.max(3, words.length * 2 - Math.max(0, moves - words.length));
          S.prog.coins += coins;
          logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: words.length, ok: words.length });
          S.classWeekOk += words.length;
          checkBadges(S.prog, S.lessons); save(true);
          setTimeout(() => { sfx.win(); confetti(); modal(`<div class="center stack"><div class="result-art">${art("trophy")}</div><h2>Alle Paare gefunden!</h2><p class="muted" style="margin:0">${moves} Züge</p><div class="reward-row"><span class="reward">${art("coin", "ic")} +${coins}</span></div><button class="btn green" data-close="ok">Weiter</button></div>`).then(() => islandView(l)); }, 500);
        }
      } else {
        lock = true;
        setTimeout(() => { open.forEach(x => { x.classList.remove("open"); x.innerHTML = art("parrot"); }); open = []; lock = false; }, 1100);
      }
    }
  });
}

// ------------------------------------------------------------------
//  Blitzrunde (60 Sekunden)
// ------------------------------------------------------------------
function blitz(l) {
  const seen = l.words.filter(w => wstate(S.prog, l.id, w.id).b >= 1);
  const pool = seen.length >= 3 ? seen : l.words;
  let score = 0, wrong = 0, left = 60, timer;
  const t0 = Date.now();
  render(`<div class="wrap narrow">
    <div class="ex-top"><button class="icon-btn" id="quit" aria-label="Beenden">${ICON.close}</button>
      <div class="ex-progress"><i id="tbar" style="width:100%"></i></div><span class="chip" id="sc">${art("flame", "ic")} 0</span></div>
    <div class="card" id="card"></div></div>`);
  const end = () => {
    clearInterval(timer);
    const best = S.prog.best["blitz:" + l.id] || 0;
    const rec = score > best;
    if (rec) S.prog.best["blitz:" + l.id] = score;
    S.prog.coins += score;
    logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: score + wrong, ok: score });
    S.classWeekOk += score;
    checkBadges(S.prog, S.lessons); save(true);
    if (rec && score > 0) { sfx.win(); confetti(); }
    render(`<div class="wrap narrow"><div class="card result"><div class="result-art">${art("flame")}</div>
      <h1>${score} richtig!</h1>
      <p class="muted" style="margin:0">${rec && score ? "Neuer persönlicher Rekord!" : `Dein Rekord: ${best}`}</p>
      <div class="reward-row"><span class="reward">${art("coin", "ic")} +${score}</span></div>
      <div class="row center-row"><button class="btn blue" id="again">Nochmal</button><button class="btn green" id="back">Zur Insel</button></div></div></div>`);
    $("#again").onclick = () => blitz(l);
    $("#back").onclick = () => islandView(l);
  };
  $("#quit").onclick = () => { clearInterval(timer); islandView(l); };
  const round = () => {
    const w = pool[Math.floor(Math.random() * pool.length)];
    const other = distractors({ l, w }, 1, "tr")[0]?.w;
    const opts = shuffle([w, other].filter(Boolean));
    $("#card").innerHTML = `<div class="row center-row"><div class="word-fr">${esc(w.fr)}</div>${speakerBtn("hear")}</div><div class="choices">${opts.map((o, i) => `<button class="choice" data-i="${i}">${esc(o.tr)}</button>`).join("")}</div>`;
    $("#hear").onclick = () => sayWord(w.fr);
    $$("#card .choice").forEach(b => b.onclick = () => {
      const ok = opts[+b.dataset.i] === w;
      ok ? (score++, sfx.ok()) : (wrong++, sfx.no());
      countAnswer(S.prog, l, w, ok);
      $("#sc").innerHTML = `${art("flame", "ic")} ${score}`;
      b.classList.add(ok ? "right" : "wrong");
      setTimeout(round, ok ? 250 : 700);
    });
  };
  timer = setInterval(() => { left--; const tb = $("#tbar"); if (tb) tb.style.width = (left / 60 * 100) + "%"; if (left <= 0) end(); }, 1000);
  round();
}

// ------------------------------------------------------------------
//  Mein Fortschritt
// ------------------------------------------------------------------
function myProgress() {
  const o = overallStats(S.prog, S.lessons);
  const wk = weekSummary(S.prog);
  const boxes = [0, 0, 0, 0, 0, 0];
  for (const l of S.lessons) for (const w of l.words) boxes[wstate(S.prog, l.id, w.id).b]++;
  const maxB = Math.max(1, ...boxes.slice(1));
  const start = new Date(Date.now() - 27 * DAY);
  const cal = Array.from({ length: 28 }, (_, i) => { const d = new Date(start.getTime() + i * DAY); const k = todayStr(d); return { k, on: (S.prog.days[k]?.ans || 0) > 0, today: k === todayStr(), n: d.getDate() }; });
  const colors = ["", "#ff6f4f", "#ffc531", "#8bd17c", "#2fb36a", "#1c7ed6"];
  render(`<div class="wrap">
    ${topbar()}
    <div class="panel stack">
      <h1>Mein Fortschritt</h1>
      <div class="kpis">
        <div class="kpi"><span class="v">${o.known}</span><span class="l">Wörter gelernt</span></div>
        <div class="kpi"><span class="v">${o.master}</span><span class="l">Wörter gemeistert</span></div>
        <div class="kpi"><span class="v">${currentStreak(S.prog)}</span><span class="l">Tage hintereinander</span></div>
        <div class="kpi"><span class="v">${Math.round(wk.sec / 60)}</span><span class="l">Minuten diese Woche</span></div>
      </div>
    </div>
    <div class="grid2">
      <div class="panel stack"><h3>Meine Lernkartei</h3>
        <p class="small muted" style="margin:0">Jedes Wort wandert nach rechts, wenn du es weißt. Die Pausen werden immer länger – ganz rechts bleibt es für immer im Kopf.</p>
        <div class="boxes">${[1, 2, 3, 4, 5].map(b => `<div class="col"><b>${boxes[b]}</b><i style="height:${Math.round(boxes[b] / maxB * 90) + 4}px;background:${colors[b]}"></i><span>${["", "heute", "1 Tag", "3 Tage", "1 Woche", "Profi"][b]}</span></div>`).join("")}</div>
      </div>
      <div class="panel stack"><h3>Meine Übungstage</h3>
        <div class="cal">${cal.map(c => `<div class="${c.on ? "on" : ""} ${c.today ? "today" : ""}" title="${c.k}">${c.n}</div>`).join("")}</div>
      </div>
    </div>
    <div class="panel stack"><h3>Meine Inseln</h3>
      ${S.lessons.map(l => { const st = lessonStats(S.prog, l); return `<div class="stack" style="gap:4px"><div class="row between"><b>${esc(l.title)}</b><span class="row" style="gap:8px">${st.testBest != null ? `<span class="pill ${st.testPassed ? "green" : ""}">Test ${st.testBest} %</span>` : ""}${stars(st.stars, "sm")}</span></div><div class="bar"><i style="width:${st.knownPct}%"></i></div></div>`; }).join("") || `<span class="muted">Noch keine Inseln.</span>`}
    </div>
    <div class="panel stack"><h3>Abzeichen</h3>
      <div class="badges">${BADGES.map(b => `<div class="badge ${S.prog.badges.includes(b.id) ? "" : "off"}">${art(b.icon, "badge-art")}<b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`).join("")}</div>
    </div>
  </div>`);
  bindTop();
}

// ------------------------------------------------------------------
//  Shop (Avatar gestalten)
// ------------------------------------------------------------------
const PRICES_A = { "🐢": 0, "🦊": 0, "🐻": 0, "🐬": 0, "🦋": 20, "🐧": 30, "🐸": 30, "🐙": 40, "🦜": 40, "🐼": 50, "🦄": 80, "🦖": 100 };
const PRICES_H = { "": 0, "🌸": 10, "🧢": 15, "🎀": 15, "⛑️": 25, "🤠": 30, "🎓": 40, "🎩": 50, "🏴‍☠️": 60, "👑": 80 };
const COLORS = ["#2f9e8f", "#1c7ed6", "#7048e8", "#d6336c", "#e8590c", "#f08c00", "#2b8a3e", "#495057"];

function shop() {
  const av = S.prog.avatar;
  const owned = new Set(S.prog.owned);
  const item = (kind, key, price) => {
    const has = price === 0 || owned.has(kind + key);
    const sel = av[kind] === key;
    const look = kind === "animal" ? art(key) : key ? hat(key) : `<span class="none">ohne</span>`;
    return `<button data-kind="${kind}" data-e="${esc(key)}" data-p="${price}" class="${sel ? "sel" : ""}"><span class="shop-art">${look}</span><small>${sel ? "an" : has ? "anziehen" : `${art("coin", "ic")} ${price}`}</small></button>`;
  };
  render(`<div class="wrap">
    ${topbar()}
    <div class="panel shop-head">
      <div>${avatarHtml(av, "lg")}</div>
      <div><h1>Mein Avatar</h1><p class="muted" style="margin:0">Du hast ${art("coin", "ic")} <b>${S.prog.coins}</b> Münzen. Münzen bekommst du für richtige Antworten.</p></div>
    </div>
    <div class="panel stack"><h3>Tier</h3><div class="shop">${ANIMAL_KEYS.map(k => item("animal", k, PRICES_A[k] ?? 30)).join("")}</div></div>
    <div class="panel stack"><h3>Hut</h3><div class="shop">${["", ...HAT_KEYS].map(k => item("hat", k, PRICES_H[k] ?? 30)).join("")}</div></div>
    <div class="panel stack"><h3>Farbe</h3><div class="row">${COLORS.map(c => `<button class="color-dot" data-color="${c}" aria-label="Farbe" style="background:${c};${av.color === c ? "outline:4px solid #ffc531;outline-offset:2px" : ""}"></button>`).join("")}</div></div>
  </div>`);
  bindTop();
  $$(".shop button").forEach(b => b.onclick = () => {
    const { kind, e } = b.dataset; const p = +b.dataset.p;
    const key = kind + e;
    if (p > 0 && !owned.has(key)) {
      if (S.prog.coins < p) { sfx.no(); toast(`Dir fehlen noch ${p - S.prog.coins} Münzen. Weiter üben!`); return; }
      S.prog.coins -= p; S.prog.owned.push(key); sfx.coin(); confetti(60);
    }
    S.prog.avatar = { ...S.prog.avatar, [kind]: e };
    save(); shop();
  });
  $$("[data-color]").forEach(b => b.onclick = () => { S.prog.avatar = { ...S.prog.avatar, color: b.dataset.color }; save(); shop(); });
}

// ------------------------------------------------------------------
//  Startseite: Wochenkarte, Tagesziel, schwierige Wörter
// ------------------------------------------------------------------
function goalRing() {
  const sec = todaySeconds(S.prog), pct = Math.min(100, Math.round(sec / DAILY_GOAL_SEC * 100));
  const min = Math.min(5, Math.floor(sec / 60));
  return `<div class="ring" style="--p:${pct}" title="Tagesziel: 5 Minuten"><div><b>${pct >= 100 ? "✓" : min}</b><small>${pct >= 100 ? "geschafft" : "von 5 Min."}</small></div></div>`;
}
function weekCard(unlocked) {
  const cur = S.lessons.filter(l => weekState(l) === "current");
  if (!cur.length) return "";
  return cur.map(l => {
    const day = schoolDay(), per = perDayFor(l), st = lessonStats(S.prog, l);
    const mon = new Date(mondayOf() + "T12:00");
    const dots = ["Mo", "Di", "Mi", "Do", "Fr"].map((d, i) => { const k = todayStr(new Date(mon.getTime() + i * DAY)); const on = (S.prog.days[k]?.ans || 0) > 0; return `<span class="day ${on ? "on" : ""} ${i + 1 === day && new Date().getDay() % 6 ? "today" : ""}">${d}</span>`; }).join("");
    const newToday = newAllowed(S.prog, l);
    const isFri = day >= 5;
    const t = S.prog.tests[l.id];
    return `<div class="panel week-card">
      <span class="isle-pic small-pic">${l.iconImg ? `<img src="${esc(l.iconImg)}" alt="">` : art("island")}</span>
      <div class="stack" style="gap:6px;flex:1;min-width:0">
        <div class="row between"><b class="wk-title">Diese Woche: ${esc(l.title)}</b><span class="small muted">${esc(weekLabel(l.week))}</span></div>
        <div class="days">${dots}</div>
        <span class="small">${st.seen < st.total ? `Heute ${newToday ? `<b>${Math.min(7, newToday)} neue Wörter</b>` : "nur Wiederholung"} · ${per} pro Tag, damit es leicht bleibt.` : "Alle Wörter kennengelernt! Jetzt wiederholen und testen."} ${t && t.date >= mondayOf() ? `· Wochentest: <b>${t.last} %</b>` : ""}</span>
        <div class="row"><button class="btn green small" id="weekLearn" data-id="${esc(l.id)}">Wochenwörter lernen</button><button class="btn ${isFri ? "orange" : "ghost"} small" id="weekTest" data-id="${esc(l.id)}">${isFri ? "Freitag: Wochentest!" : "Wochentest"}</button></div>
      </div></div>`;
  }).join("");
}
function hardWords() {
  const out = [];
  for (const l of S.lessons) for (const w of l.words) { const s = wstate(S.prog, l.id, w.id); if (s.w >= 2 || (s.b === 1 && s.w >= 1)) out.push({ l, w, s }); }
  return out.sort((a, b) => b.s.w - a.s.w);
}
function hardCard() {
  const h = hardWords();
  if (!h.length) return "";
  return `<div class="panel hard-card"><div class="stack" style="gap:6px;flex:1;min-width:0"><b>Meine schwierigen Wörter (${h.length})</b>
    <div class="row" style="gap:6px">${h.slice(0, 8).map(x => `<span class="pill orange">${esc(x.w.fr)}</span>`).join("")}${h.length > 8 ? `<span class="small muted">…</span>` : ""}</div></div>
    <button class="btn coral small" id="hardGo">Üben</button></div>`;
}
async function practiceHard() {
  const h = hardWords().slice(0, 8);
  const pref = await askAnswerMode("Schwierige Wörter üben");
  if (!pref) return;
  runLearn(h.map(x => ({ ...x, kind: x.s.b === 1 ? "learn" : "extra" })), { pref });
}

// ------------------------------------------------------------------
//  Vokabeldusche: hören – nachsprechen – Bedeutung hören
// ------------------------------------------------------------------
function vocabShower(l) {
  let i = 0, playing = true, slow = false, stop = false;
  const t0 = Date.now();
  const words = [...l.words];
  render(`<div class="wrap narrow">
    <div class="ex-top"><button class="icon-btn" id="quit" aria-label="Beenden">${ICON.close}</button><b class="ex-title">Vokabeldusche – ${esc(l.title)}</b></div>
    <div class="card shower-card" id="card"></div>
    <div class="row center-row"><button class="btn blue" id="pp">Pause</button><button class="btn ghost" id="sl">Langsamer</button></div>
    <p class="center small muted">Hör zu und sprich jedes Wort laut nach. Am besten jeden Tag einmal – auch beim Anziehen oder Frühstücken.</p></div>`);
  const end = () => { stop = true; window.speechSynthesis?.cancel(); logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000) }); save(); };
  $("#quit").onclick = () => { end(); islandView(l); };
  $("#pp").onclick = () => { playing = !playing; $("#pp").textContent = playing ? "Pause" : "Weiter"; if (playing) loop(); else window.speechSynthesis?.cancel(); };
  $("#sl").onclick = () => { slow = !slow; $("#sl").textContent = slow ? "Normal" : "Langsamer"; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let running = false;
  async function loop() {
    if (running) return; running = true;
    while (playing && !stop) {
      const w = words[i % words.length];
      const card = $("#card"); if (!card) break;
      card.innerHTML = `${picBox(w, l)}<div class="word-fr">${esc(w.fr)}</div><div class="word-tr" id="trl" style="visibility:hidden">${esc(w.tr)}</div><div class="small muted">${i % words.length + 1} von ${words.length}</div>`;
      await say(w.fr, "fr", slow ? 0.55 : 0.8); if (!playing || stop) break;
      await wait(1800); if (!playing || stop) break;           // Zeit zum Nachsprechen
      const t = $("#trl"); if (t) t.style.visibility = "visible";
      await say(w.tr, l.lang || "de", 0.9); if (!playing || stop) break;
      await say(w.fr, "fr", slow ? 0.55 : 0.8); if (!playing || stop) break;
      await wait(1200);
      i++;
    }
    running = false;
  }
  loop();
}

// ------------------------------------------------------------------
//  Post-its zuordnen (Wort ↔ Bild/Bedeutung)
// ------------------------------------------------------------------
function matchGame(l) {
  const words = shuffle(l.words).slice(0, Math.min(5, l.words.length));
  const right = shuffle(words);
  let pick = null, done = 0, errors = 0;
  const t0 = Date.now();
  const colors = ["#fff3a8", "#ffd6e7", "#d3f9d8", "#d0ebff", "#ffe8cc"];
  render(`<div class="wrap narrow">
    <div class="ex-top"><button class="icon-btn" id="quit" aria-label="Beenden">${ICON.close}</button><b class="ex-title">Post-its zuordnen</b><span class="chip" id="pt">0 / ${words.length}</span></div>
    <p class="center muted" style="margin:0">Tippe ein Post-it an und dann das passende Bild.</p>
    <div class="match">
      <div class="postits">${words.map((w, k) => `<button class="postit" data-p="${k}" style="background:${colors[k % 5]};transform:rotate(${(k % 2 ? 2 : -2)}deg)">${esc(w.fr)}</button>`).join("")}</div>
      <div class="targets">${right.map((w, k) => `<button class="target" data-t="${k}">${hasPic(withDrawing(l, w)) ? `<span class="pic">${pic(withDrawing(l, w))}</span>` : ""}<span>${esc(w.tr)}</span></button>`).join("")}</div>
    </div></div>`);
  $("#quit").onclick = () => islandView(l);
  $$(".postit").forEach(b => b.onclick = () => { if (b.classList.contains("done")) return; $$(".postit").forEach(x => x.classList.remove("sel")); b.classList.add("sel"); pick = +b.dataset.p; sayWord(words[pick].fr); });
  $$(".target").forEach(b => b.onclick = () => {
    if (pick == null || b.classList.contains("done")) return;
    const w = words[pick], t = right[+b.dataset.t];
    const ok = w === t;
    countAnswer(S.prog, l, w, ok);
    if (ok) {
      sfx.ok(); done++;
      const pb = $(`[data-p="${pick}"]`); pb.classList.add("done"); pb.classList.remove("sel");
      b.classList.add("done"); b.insertAdjacentHTML("beforeend", `<span class="stuck" style="background:${pb.style.background}">${esc(w.fr)}</span>`);
      pick = null; $("#pt").textContent = `${done} / ${words.length}`;
      if (done === words.length) {
        const coins = Math.max(2, words.length * 2 - errors);
        S.prog.coins += coins; logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: words.length + errors, ok: words.length });
        S.classWeekOk += words.length; save(true);
        setTimeout(() => { sfx.win(); confetti(); modal(`<div class="center stack"><div class="result-art">${art("postit")}</div><h2>Alle Post-its kleben!</h2><div class="reward-row"><span class="reward">${art("coin", "ic")} +${coins}</span></div><button class="btn green" data-close="ok">Weiter</button></div>`).then(() => islandView(l)); }, 500);
      }
    } else { errors++; sfx.no(); b.classList.add("shake"); setTimeout(() => b.classList.remove("shake"), 400); }
  });
}

// ------------------------------------------------------------------
//  Sortieren: le oder la? (sonst: kurz oder lang)
// ------------------------------------------------------------------
const artOf = fr => { const x = fr.trim().toLowerCase(); return x.startsWith("le ") ? "le" : x.startsWith("la ") ? "la" : x.startsWith("un ") ? "le" : x.startsWith("une ") ? "la" : null; };
function canSortArticle(l) { const a = l.words.map(w => artOf(w.fr)); return a.filter(x => x === "le").length >= 2 && a.filter(x => x === "la").length >= 2; }
function sortGame(l) {
  const byArt = canSortArticle(l);
  const pool = shuffle(l.words.filter(w => !byArt || artOf(w.fr))).slice(0, 8);
  const bins = byArt ? [{ k: "le", name: "le", sub: "männlich", col: "#d0ebff" }, { k: "la", name: "la", sub: "weiblich", col: "#ffdeeb" }]
    : [{ k: "short", name: "kurz", sub: "bis 5 Buchstaben", col: "#d3f9d8" }, { k: "long", name: "lang", sub: "mehr Buchstaben", col: "#fff3bf" }];
  const keyOf = w => byArt ? artOf(w.fr) : (stripArticle(w.fr.toLowerCase()).replace(/[^a-zàâçéèêëîïôûùüÿœ]/g, "").length <= 5 ? "short" : "long");
  const shown = w => byArt ? stripArticle(w.fr.toLowerCase()) : w.fr;
  let i = 0, ok = 0;
  const t0 = Date.now();
  const draw = () => {
    if (i >= pool.length) {
      const coins = ok * 2; S.prog.coins += coins;
      logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: pool.length, ok }); S.classWeekOk += ok; save(true);
      sfx.win(); if (ok >= pool.length - 1) confetti();
      return render(`<div class="wrap narrow"><div class="card result"><div class="result-art">${art("baskets")}</div><h1>${ok} von ${pool.length} richtig sortiert!</h1>
        <p class="muted" style="margin:0">${byArt ? "Tipp: Lerne jedes Wort immer mit seinem Artikel – le oder la." : "Lange Wörter darfst du in Silben zerlegen."}</p>
        <div class="reward-row"><span class="reward">${art("coin", "ic")} +${coins}</span></div>
        <div class="row center-row"><button class="btn blue" id="again">Nochmal</button><button class="btn green" id="back">Zur Insel</button></div></div></div>`), $("#again").onclick = () => sortGame(l), $("#back").onclick = () => islandView(l);
    }
    const w = pool[i];
    render(`<div class="wrap narrow">
      <div class="ex-top"><button class="icon-btn" id="quit" aria-label="Beenden">${ICON.close}</button><b class="ex-title">Sortieren: ${byArt ? "le oder la?" : "kurz oder lang?"}</b><span class="chip">${i + 1} / ${pool.length}</span></div>
      <div class="card">${picBox(w, l)}<div class="row center-row"><div class="word-fr">${esc(shown(w))}</div>${speakerBtn("hear")}</div><div class="word-tr">${esc(w.tr)}</div>
      <div class="bins">${bins.map(b => `<button class="bin" data-k="${b.k}" style="background:${b.col}"><b>${b.name}</b><small>${b.sub}</small></button>`).join("")}</div></div></div>`);
    $("#quit").onclick = () => islandView(l);
    $("#hear").onclick = () => sayWord(w.fr);
    $$(".bin").forEach(b => b.onclick = () => {
      const good = b.dataset.k === keyOf(w);
      if (good) { ok++; sfx.ok(); } else sfx.no();
      b.classList.add(good ? "right" : "wrong");
      toast(good ? `Richtig: ${w.fr}` : `Es heißt: ${w.fr}`, 1400);
      if (!good) sayWord(w.fr);
      setTimeout(() => { i++; draw(); }, good ? 700 : 1500);
    });
  };
  draw();
}

// ------------------------------------------------------------------
//  Bewegungsrunde: bewegen und dabei das Wort sagen
// ------------------------------------------------------------------
const MOVES = [
  ["jump", "Hüpfe 3× wie ein Hase"], ["star", "Mach 3 Hampelmänner"], ["flame", "Steh auf einem Bein"],
  ["rocket", "Streck dich ganz hoch zur Decke"], ["games", "Lauf einmal um den Tisch"], ["parrot", "Flattere mit den Armen wie ein Papagei"],
];
function moveGame(l) {
  const words = shuffle(l.words).slice(0, Math.min(6, l.words.length));
  let i = 0, ok = 0;
  const t0 = Date.now();
  const show = () => {
    if (i >= words.length) {
      S.prog.coins += ok * 2; logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: words.length, ok }); S.classWeekOk += ok; save(true);
      sfx.win(); confetti();
      render(`<div class="wrap narrow"><div class="card result"><div class="result-art">${art("jump")}</div><h1>Super bewegt!</h1><p class="muted" style="margin:0">${ok} von ${words.length} Wörtern richtig gesagt.</p><p class="small muted" style="margin:0">Bewegung hilft dem Kopf beim Merken.</p>
        <div class="reward-row"><span class="reward">${art("coin", "ic")} +${ok * 2}</span></div><button class="btn green big" id="back">Zur Insel</button></div></div>`);
      return $("#back").onclick = () => islandView(l);
    }
    const w = words[i], [mv, txt] = MOVES[i % MOVES.length];
    render(`<div class="wrap narrow">
      <div class="ex-top"><button class="icon-btn" id="quit" aria-label="Beenden">${ICON.close}</button><b class="ex-title">Bewegungsrunde</b><span class="chip">${i + 1} / ${words.length}</span></div>
      <div class="card"><div class="move-art">${art(mv)}</div><h2>${esc(txt)}</h2>
        <p style="margin:0">… und sag dabei laut auf Französisch:</p>${picBox(w, l)}<div class="word-tr">${esc(w.tr)}</div>
        <div class="row center-row">${micBtn("mic", true)}${speakerBtn("hear")}</div><div id="heard" class="heard"></div>
        <div class="row center-row"><button class="btn ghost" id="show">Lösung zeigen</button></div></div></div>`);
    $("#quit").onclick = () => islandView(l);
    let used = false;
    $("#hear").onclick = () => { used = true; sayWord(w.fr); };
    const next = (good) => { countAnswer(S.prog, l, w, good); if (good) ok++; i++; setTimeout(show, good ? 900 : 1600); };
    if ($("#mic")) $("#mic").onclick = async () => {
      const alts = await useMic($("#mic"), $("#heard")); if (!alts) return;
      const good = checkSpoken(alts, w.fr);
      $("#heard").textContent += good ? " Super!" : ` Es heißt: ${w.fr}`;
      good ? sfx.ok() : (sfx.no(), sayWord(w.fr));
      next(good && !used);
    };
    $("#show").onclick = () => {
      sayWord(w.fr);
      $("#show").outerHTML = `<div class="word-fr">${esc(w.fr)}</div><div class="row center-row"><button class="btn green" id="y">Hatte ich richtig</button><button class="btn coral" id="n">Noch nicht</button></div>`;
      $("#y").onclick = () => next(!used); $("#n").onclick = () => next(false);
    };
  };
  show();
}

// ------------------------------------------------------------------
//  Malen: eigenes Bild zum Wort (doppelte Kodierung)
// ------------------------------------------------------------------
function drawWord(l, w, after) {
  const key = wkey(l.id, w.id);
  const COLS = ["#24323f", "#e03131", "#f08c00", "#ffd43b", "#2fb36a", "#1c7ed6", "#7048e8", "#a0673a"];
  modal(`<h2 class="center">Mal „${esc(w.fr)}“</h2><p class="center small muted" style="margin:0">${esc(w.tr)} – wer selbst malt, merkt sich das Wort besser.</p>
    <canvas id="cv" width="480" height="480" class="draw-canvas"></canvas>
    <div class="row center-row">${COLS.map((c, i) => `<button class="color-dot ${i ? "" : "on"}" data-c="${c}" style="background:${c}" aria-label="Farbe"></button>`).join("")}</div>
    <div class="row center-row"><button class="btn ghost small" id="thin">Dünn</button><button class="btn ghost small" id="thick">Dick</button><button class="btn ghost small" id="clr">Alles löschen</button></div>
    <div class="row center-row"><button class="btn ghost" data-close="">Abbrechen</button><button class="btn green" id="ok">Speichern</button></div>`, {
    onMount: (m, close) => {
      const cv = m.querySelector("#cv"), x = cv.getContext("2d");
      x.fillStyle = "#fff"; x.fillRect(0, 0, 480, 480); x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = COLS[0]; x.lineWidth = 10;
      const old = S.prog.drawings[key];
      if (old) { const im = new Image(); im.onload = () => x.drawImage(im, 0, 0, 480, 480); im.src = old; }
      let down = false;
      const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 480 / r.width, (e.clientY - r.top) * 480 / r.height]; };
      cv.onpointerdown = e => { down = true; cv.setPointerCapture(e.pointerId); const [a, b] = pos(e); x.beginPath(); x.moveTo(a, b); x.lineTo(a + .1, b + .1); x.stroke(); };
      cv.onpointermove = e => { if (!down) return; const [a, b] = pos(e); x.lineTo(a, b); x.stroke(); };
      cv.onpointerup = cv.onpointercancel = () => { down = false; };
      m.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { x.strokeStyle = b.dataset.c; m.querySelectorAll("[data-c]").forEach(o => o.classList.toggle("on", o === b)); });
      m.querySelector("#thin").onclick = () => x.lineWidth = 5;
      m.querySelector("#thick").onclick = () => x.lineWidth = 18;
      m.querySelector("#clr").onclick = () => { x.fillStyle = "#fff"; x.fillRect(0, 0, 480, 480); };
      m.querySelector("#ok").onclick = () => {
        const small = document.createElement("canvas"); small.width = small.height = 200;
        small.getContext("2d").drawImage(cv, 0, 0, 200, 200);
        const keys = Object.keys(S.prog.drawings);
        if (!S.prog.drawings[key] && keys.length >= 40) delete S.prog.drawings[keys[0]]; // Platz sparen
        S.prog.drawings[key] = small.toDataURL("image/jpeg", 0.7);
        S.prog.coins += 2; save(); sfx.coin(); toast("Bild gespeichert! Es erscheint jetzt bei diesem Wort.");
        close("ok"); after && after();
      };
    },
  });
}
