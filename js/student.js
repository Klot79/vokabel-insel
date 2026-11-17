import { Store, Device, isCloud } from "./store.js?v=20261117k";
import { esc, pinHash, PIN_EMOJI, LANG_FLAG } from "./util.js?v=20261117k";
import { render, $, $$, toast, modal, pic, hasPic, avatarHtml, sfx, confetti, ICON, stars, setSound, isSound } from "./ui.js?v=20261117k";
import { art, hat, ANIMAL_KEYS, HAT_KEYS } from "./art.js?v=20261117k";
import { currentGoal, der, unser, zum } from "./goal.js?v=20261117k";
import { buildingSvg } from "./buildings.js?v=20261117k";
import { uid } from "./util.js?v=20261117k";
import { say, listen, canListen } from "./speech.js?v=20261117k";
import { t, tn, setLang, getLang, UI_LANGS, bForms } from "./i18n.js?v=20261117k";
import {
  emptyProgress, lessonStats, overallStats, unlockedLessons, planLearn, markSeen, countAnswer, fallBack, promote,
  checkWritten, checkSpoken, logActivity, currentStreak, weekSummary, checkBadges, BADGES, wstate, shuffle,
  stripArticle, todayStr, DAY, NEEDED_TODAY, MIN_GAP, BOX_NAMES, wkey,
  weekState, weekLabel, schoolDay, perDayFor, newAllowed, sortLessons, DAILY_GOAL_SEC, todaySeconds, mondayOf,
  writePoint, WRITES_FOR_POINT, countCard,
} from "./srs.js?v=20261117k";

// ---- Ton an/aus (gilt auf diesem Gerät, überall) ----
setSound(!Device.get("audioOff", false));
const autoSay = (t, lang = "fr") => isSound() ? sayWord(t, lang) : null;   // automatisches Vorlesen nur bei Ton an
const audioBtn = () => `<button class="icon-btn audio-toggle" aria-label="${isSound() ? t("Ton ausschalten") : t("Ton einschalten")}" title="${t("Ton an/aus")}">${isSound() ? ICON.speaker : ICON.mute}</button>`;
document.addEventListener("click", e => {
  const b = e.target.closest(".audio-toggle"); if (!b) return;
  const on = !isSound(); setSound(on); Device.set("audioOff", !on);
  if (!on) { try { window.speechSynthesis?.cancel(); } catch {} }
  $$(".audio-toggle").forEach(x => { x.innerHTML = on ? ICON.speaker : ICON.mute; x.setAttribute("aria-label", on ? t("Ton ausschalten") : t("Ton einschalten")); });
  toast(on ? t("Ton an") : t("Ton aus – Wörter werden nur vorgelesen, wenn du auf den Lautsprecher tippst."), 2600);
});

const S = { cls: null, student: null, prog: null, lessons: [], classWeekOk: 0 };
let goHome = () => {};
let backToStart = () => {};

// Kalenderwoche in der gewählten Sprache
const wkLabel = w => weekLabel(w).replace(/^KW/, t("KW"));
// Sprachwahl (Anweisungen auf Deutsch, Französisch oder Portugiesisch)
const langPick = () => `<div class="lang-pick" role="group" aria-label="${t("Sprache")}">${UI_LANGS.map(x => `<button class="lang-btn ${getLang() === x.k ? "on" : ""}" data-lang="${x.k}"><span class="flag-big">${x.flag}</span>${x.name}</button>`).join("")}</div>`;
function bindLangPick(redraw) {
  $$("[data-lang]").forEach(b => b.onclick = () => {
    setLang(b.dataset.lang);
    if (S.prog) { S.prog.uiLang = b.dataset.lang; save(); }
    document.documentElement.lang = getLang();
    redraw();
  });
}
async function chooseLang() {
  const v = await modal(`<h2 class="center">${t("In welcher Sprache möchtest du die Anweisungen?")}</h2>
    <div class="lang-pick">${UI_LANGS.map(x => `<button class="lang-btn ${getLang() === x.k ? "on" : ""}" data-close="${x.k}"><span class="flag-big">${x.flag}</span>${x.name}</button>`).join("")}</div>`);
  if (!v) return;
  setLang(v); S.prog.uiLang = v; save(); document.documentElement.lang = v; goHome();
}

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
  render(`<div class="wrap narrow"><div class="panel center">${t("Lade Klasse …")}</div></div>`);
  let students = [], progs = [];
  try { [students, progs] = await Promise.all([Store.list("student"), Store.list("progress")]); }
  catch (e) { render(`<div class="wrap narrow"><div class="panel">${esc(e.message)}</div></div>`); return; }
  S.cache = { students, progs };
  const pmap = Object.fromEntries(progs.map(p => [p.id, p]));
  students.sort((a, b) => a.name.localeCompare(b.name, "de"));
  render(`<div class="wrap narrow">
    <div class="row between"><button class="icon-btn" id="back" aria-label="${t("Zurück")}">${ICON.back}</button><span class="chip">${esc(cls.name || Store.code)}</span></div>
    <div class="hello"><span class="mascot">${art("parrot")}</span><div class="bubble"><h1>${t("Wer bist du?")}</h1><p>${t("Tippe auf deinen Namen.")}</p></div></div>
    ${langPick()}
    <div class="kid-grid">${students.map(s => `<button class="kid-btn" data-id="${esc(s.id)}">${avatarHtml(pmap[s.id]?.avatar)}<span>${esc(s.name)}</span></button>`).join("") ||
      `<div class="panel">${t("Noch keine Kinder in dieser Klasse. Die Lehrkraft kann sie im Lehrerbereich anlegen.")}</div>`}</div>
  </div>`);
  $("#back").onclick = back;
  bindLangPick(() => studentLogin(cls, back));
  $$(".kid-btn").forEach(b => b.onclick = () => pinScreen(students.find(s => s.id === b.dataset.id), pmap[b.dataset.id], cls, back));
}

function pinScreen(student, prog, cls, back) {
  let pin = [];
  render(`<div class="wrap narrow">
    <div class="row"><button class="icon-btn" id="back" aria-label="${t("Zurück")}">${ICON.back}</button></div>
    <div class="panel center stack">
      <div style="justify-self:center">${avatarHtml(prog?.avatar, "lg")}</div>
      <h2>${t("Hallo {name}!", { name: esc(student.name) })}</h2>
      <p class="muted" style="margin:0">${t("Tippe deine 3 Geheim-Bilder.")}</p>
      <div class="pin-dots" id="dots"></div>
      <div class="pin-pad">${PIN_EMOJI.map(e => `<button data-e="${e}" aria-label="${t("Bild")}">${art(e)}</button>`).join("")}</div>
      <button class="btn ghost small" id="del" style="justify-self:center">${t("Löschen")}</button>
    </div></div>`);
  $("#back").onclick = () => studentLogin(cls, back);
  const dots = () => $("#dots").innerHTML = [0, 1, 2].map(i => `<span>${pin[i] ? art(pin[i]) : ""}</span>`).join("");
  dots();
  $("#del").onclick = () => { pin.pop(); dots(); };
  $$(".pin-pad button").forEach(b => b.onclick = async () => {
    if (pin.length >= 3) return;
    sfx.tap(); pin.push(b.dataset.e); dots();
    if (pin.length === 3) {
      let ok = false;
      try { ok = await Store.checkKidPin(student, await pinHash(Store.code, pin)); } catch (e) { toast(e.message); }
      if (ok) { Device.set("lastStudent", student.id); await enter(student, back); }
      else { sfx.no(); $("#dots").classList.add("shake"); setTimeout(() => { pin = []; dots(); $("#dots")?.classList.remove("shake"); }, 450); toast(t("Das war nicht ganz richtig. Probier es nochmal!")); }
    }
  });
}

async function enter(student, back) {
  S.student = student;
  const cache = S.cache || {};
  const [lessons, all, students] = await Promise.all([Store.list("lesson"), cache.progs || Store.list("progress"), cache.students || Store.list("student")]);
  S.cache = null;
  const prog = all.find(p => p.id === student.id);
  S.prog = { ...emptyProgress(), ...(prog || {}) };
  // Offline gespeicherter Stand, der noch nicht gesendet wurde?
  const pend = Device.get(pendKey());
  if (pend && (pend.gen ?? null) === (S.prog.gen ?? null) && (pend.savedAt || 0) > (S.prog.savedAt || 0)) { S.prog = { ...emptyProgress(), ...pend }; setTimeout(() => save(true), 500); }
  else if (pend) Device.del(pendKey());
  S.prog.tests = S.prog.tests || {};
  if (S.prog.uiLang) { setLang(S.prog.uiLang); document.documentElement.lang = getLang(); }
  delete S.prog.id; delete S.prog._updated;
  S.lessons = sortLessons(lessons
    .filter(l => l.words?.length && (l.assigned === "all" || !l.assigned || (Array.isArray(l.assigned) && l.assigned.includes(student.id)))));
  S.prog.memos = S.prog.memos || {};
  await loadDrawings();
  const allProgs = all.filter(p => p.id !== student.id).concat([S.prog]);
  try { S.goal = await currentGoal(S.cls, allProgs, Math.max(1, students.length)); } catch (e) { S.goal = null; }
  // Gemeinsamer Klassenfortschritt (ohne Namen – keine Rangliste)
  const others = all.filter(p => p.id !== student.id);
  S.classInfo = {
    kids: Math.max(1, students.length),
    othersWeek: others.filter(p => weekSummary({ days: p.days || {} }).ans > 0).length,
    othersToday: others.filter(p => (p.days?.[todayStr()]?.ans || 0) > 0).length,
    othersKnown: others.reduce((sum, p) => sum + Object.values(p.words || {}).filter(s => s.b >= 2).length, 0),
    othersStars: others.reduce((sum, p) => sum + Object.values(p.stars || {}).reduce((a, b) => a + (b || 0), 0), 0),
  };
  goHome = () => home(back);
  home(back);
}

let saveT, retryT, offlineToast = false;
const pendKey = () => `pend:${Store.code}:${S.student?.id}`;
function save(now = false) {
  clearTimeout(saveT);
  const go = async () => {
    if (!S.student) return;
    for (const l of S.lessons) S.prog.stars[l.id] = lessonStats(S.prog, l).stars;
    S.prog.savedAt = Date.now();
    try {
      await Store.put("progress", S.student.id, S.prog);
      Device.del(pendKey()); offlineToast = false; clearTimeout(retryT);
    } catch (e) {
      if (e.reset) return wasReset();
      // Auf dem Gerät zwischenspeichern und später nachsenden
      Device.set(pendKey(), S.prog);
      if (!offlineToast) { offlineToast = true; toast(t("Kein Internet – dein Fortschritt ist auf diesem Gerät gespeichert und wird später gesendet.")); }
      clearTimeout(retryT); retryT = setTimeout(() => save(true), 20000);
    }
  };
  if (now) return go();
  saveT = setTimeout(go, 1200);
}
window.addEventListener("online", () => { if (S.student && Device.get(pendKey())) save(true); });

// Die Lehrkraft hat den Fortschritt zurückgesetzt, während das Kind angemeldet war
let resetShown = false;
async function wasReset() {
  if (resetShown) return; resetShown = true;
  Device.del(pendKey());
  await modal(`<div class="center stack"><div class="result-art">${art("rocket")}</div><h2>${t("Neustart!")}</h2>
    <p style="margin:0">${t("Deine Lehrkraft hat deinen Fortschritt zurückgesetzt. Du beginnst jetzt ganz neu – viel Spaß!")}</p>
    <button class="btn green" data-close="ok">${t("Weiter")}</button></div>`);
  resetShown = false;
  const st = S.student; S.cache = null;
  await enter(st, backToStart);
}

// ---- Zeichnungen: getrennt vom Fortschritt gespeichert (lädt schneller) ----
const artSeparate = () => Store.v2;
async function loadDrawings() {
  S.drawings = S.prog.drawings || {};
  if (!artSeparate()) { S.prog.drawings = S.drawings; return; }
  try {
    const a = await Store.getOne("art", S.student.id);
    const merged = { ...(a?.drawings || {}), ...S.drawings };
    const moved = Object.keys(S.drawings).length > 0;
    S.drawings = merged; delete S.prog.drawings;
    if (moved) { await Store.put("art", S.student.id, { drawings: merged }); save(true); }   // alte Zeichnungen umziehen
  } catch { S.prog.drawings = S.drawings; }
}
async function saveDrawings() {
  if (!artSeparate()) { S.prog.drawings = S.drawings; return save(); }
  try { await Store.put("art", S.student.id, { drawings: S.drawings }); } catch (e) { toast(e.message); }
}

// ---- Münzen aus Spielen: höchstens eine bestimmte Zahl pro Tag ----
function earn(kind, n, cap) {
  const k = todayStr(); const d = S.prog.days[k] || (S.prog.days[k] = { sec: 0, ans: 0, ok: 0 });
  d.gc = d.gc || {};
  const used = d.gc[kind] || 0, give = Math.max(0, Math.min(n, cap - used));
  d.gc[kind] = used + give;
  S.prog.coins += give;
  if (give < n) setTimeout(() => toast(t("Für heute gibt es hier keine Münzen mehr – aber Üben hilft dir trotzdem!"), 3200), 900);
  return give;
}

// ------------------------------------------------------------------
//  Startseite
// ------------------------------------------------------------------
function topbar() {
  return `<div class="topbar">
    ${avatarHtml(S.prog.avatar, "sm")}
    <span class="name">${esc(S.student.name)}</span>
    <span class="chip fire" title="${t("Tage hintereinander geübt")}">${art("flame", "ic")} ${currentStreak(S.prog)}</span>
    <span class="chip coin" title="${t("Münzen")}">${art("coin", "ic")} ${S.prog.coins}</span>
    ${audioBtn()}
    <button class="icon-btn lang-top" id="tb-lang" aria-label="${t("Sprache")}" title="${t("Sprache")}">${UI_LANGS.find(x => x.k === getLang()).flag}</button>
    <nav class="navbtns">
      <button class="nav-btn" id="tb-home" aria-label="${t("Start")}">${art("map")}<small>${t("Start")}</small></button>
      <button class="nav-btn" id="tb-me" aria-label="${t("Mein Fortschritt")}">${art("telescope")}<small>${t("Fortschritt")}</small></button>
      <button class="nav-btn" id="tb-shop" aria-label="${t("Shop")}">${art("chest")}<small>${t("Shop")}</small></button>
      <button class="nav-btn" id="tb-out" aria-label="${t("Abmelden")}">${art("door")}<small>${t("Tschüss")}</small></button>
    </nav>
  </div>`;
}
function bindTop() {
  $("#tb-home").onclick = () => goHome();
  $("#tb-me").onclick = () => myProgress();
  $("#tb-shop").onclick = () => shop();
  $("#tb-lang").onclick = () => chooseLang();
  $("#tb-out").onclick = async () => { await save(true); document.body.classList.remove("kid-mode"); backToStart(); };
}

function home() {
  const unlocked = unlockedLessons(S.prog, S.lessons, S.cls.allOpen);
  const plan = planLearn(S.prog, unlocked);
  const doneToday = S.prog.missionDay === todayStr();

  const nNew = plan.filter(p => p.kind === "new").length, nRep = plan.length - nNew;

  render(`<div class="wrap">
    ${topbar()}
    <div class="hello">
      <span class="mascot">${art("parrot")}</span>
      <div class="bubble"><h1>${t("Hallo {name}!", { name: esc(S.student.name) })}</h1>
        <p>${plan.length ? (nRep && nNew ? t("Heute warten <b>{n} Wörter</b> auf dich ({r} zum Wiederholen, {k} neue).", { n: plan.length, r: nRep, k: nNew }) : t("Heute warten <b>{n} Wörter</b> auf dich.", { n: plan.length })) : doneToday ? t("Super, für heute ist alles geschafft! Du kannst testen oder spielen.") : t("Alles wiederholt! Du kannst testen oder spielen.")}</p>
        <p class="small muted">${esc(encouragement())}</p>
        ${plan.length ? `<button class="btn green today-btn" id="learn">▶ ${tn(plan.length, "Heute üben ({n} Wort)", "Heute üben ({n} Wörter)")}</button>` : ""}</div>
      ${goalRing()}
    </div>
    ${weekCard(unlocked)}
    <h2 class="section-title">${t("Wähle deine Insel zum Lernen")}</h2>
    <div class="isle-grid">${S.lessons.length ? S.lessons.map(l => islandCard(l, unlocked.includes(l))).join("") : `<div class="panel">${t("Deine Lehrkraft hat noch keine Lektion für dich freigegeben.")}</div>`}</div>
    ${classPanel()}
    ${hardCard()}
  </div>`);
  if ($("#weekTest")) $("#weekTest").onclick = () => startTest(S.lessons.find(l => l.id === $("#weekTest").dataset.id));
  if ($("#hardGo")) $("#hardGo").onclick = () => practiceHard();
  if ($("#wheelBtn")) $("#wheelBtn").onclick = () => showWheel(false);
  maybeCelebrate();
  bindTop();
  if ($("#learn")) $("#learn").onclick = () => startLearn(unlocked);   // fällige Wiederholungen aller Inseln
  bindIslands(unlocked);
}

function islandCard(l, open) {
  const st = lessonStats(S.prog, l), waiting = open ? planLearn(S.prog, [l]).length : 0;
  return `<button class="isle ${open ? "" : "locked"}" data-id="${esc(l.id)}" aria-label="${esc(l.title)}${open ? "" : " " + t("(gesperrt)")}">
    <span class="isle-pic">${l.iconImg ? `<img src="${esc(l.iconImg)}" alt="" loading="lazy">` : art("island")}${open ? "" : `<span class="isle-lock">${art("lock")}</span>`}${waiting ? `<span class="due">${t("{n} warten", { n: waiting })}</span>` : ""}</span>
    <span class="isle-name">${esc(l.title)} <span class="flag">${LANG_FLAG[l.lang] || ""}</span></span>
    ${l.week ? `<span class="week-tag ${weekState(l)}">${weekState(l) === "current" ? t("diese Woche") : weekState(l) === "future" ? t("ab {w}", { w: esc(wkLabel(l.week).split(" (")[0]) }) : esc(wkLabel(l.week).split(" (")[0])}</span>` : ""}
    ${stars(st.stars, "sm")}
    ${st.testPassed ? `<span class="test-ok">Test ✓</span>` : ""}
  </button>`;
}
function bindIslands(unlocked) {
  $$(".isle").forEach(b => b.onclick = () => {
    const l = S.lessons.find(x => x.id === b.dataset.id);
    if (b.classList.contains("locked")) { sfx.no(); toast(weekState(l) === "future" ? t("Diese Insel öffnet sich in {w}.", { w: wkLabel(l.week) }) : t("Hol dir zuerst einen Stern auf der Insel davor!")); return; }
    islandView(l);
  });
}

function encouragement() {
  const st = currentStreak(S.prog), o = overallStats(S.prog, S.lessons);
  if (st >= 3) return t("Schon {n} Tage hintereinander geübt. Stark!", { n: st });
  if (o.known >= 10) return t("Du kannst schon {n} Wörter.", { n: o.known });
  return t("Ein paar Minuten jeden Tag – so merkt sich dein Kopf die Wörter am besten.");
}

async function askAnswerMode(title, learn = false, rec = "") {
  const v = await modal(`<h2 class="center">${esc(title)}</h2>
    ${learn ? `<p class="center small muted" style="margin:0">${t("Dein Lernweg: von 1 nach 4. Neue Wörter fängst du am besten bei 1 an.")}</p>` : ""}
    <div class="choose ${learn ? "choose4" : ""}">
      ${learn ? `<button class="choose-btn" data-close="cards"><span class="step">1</span>${art("book")}<b>${t("Lernkarten")}</b><small>${t("Karte umdrehen und merken")}</small></button>
      <button class="choose-btn" data-close="copy"><span class="step">2</span>${art("postit")}<b>${t("Abschreiben")}</b><small>${t("Wort sehen und abschreiben")}</small></button>
      <button class="choose-btn" data-close="write"><span class="step">3</span>${art("clipboard")}<b>${t("Aus dem Kopf schreiben")}</b><small>${t("ohne das Wort zu sehen")}</small></button>
      ${canListen ? `<button class="choose-btn" data-close="speak"><span class="step">4</span>${art("mascotHead")}<b>${t("Sprechen")}</b><small>${t("ins Mikrofon")}</small></button>` : ""}
      <button class="choose-btn" data-close="mix"><span class="step pro">${t("Profi")}</span>${art("games")}<b>${t("Gemischt")}</b><small>${t("Schreiben und Sprechen")}</small></button>`
        : `<button class="choose-btn" data-close="write">${art("clipboard")}<b>${t("Schreiben")}</b><small>${t("mit der Tastatur")}</small></button>
      ${canListen ? `<button class="choose-btn" data-close="speak">${art("mascotHead")}<b>${t("Sprechen")}</b><small>${t("ins Mikrofon")}</small></button>` : ""}
      <button class="choose-btn" data-close="mix">${art("games")}<b>${t("Gemischt")}</b><small>${t("Schreiben und Sprechen")}</small></button>`}
    </div>`, { onMount: m => {
      const b = rec && m.querySelector(`[data-close="${rec}"]`);
      if (b) { b.classList.add("rec"); b.insertAdjacentHTML("afterbegin", `<span class="rec-tag">⭐ ${t("Empfohlen")}</span>`); }
    } });
  return v;
}
// Was passt gerade am besten? Neue Wörter: erst Lernkarten, sonst aus dem Kopf schreiben
const recommendFor = items => items.some(i => i.kind === "new") ? "cards" : "write";

async function startLearn(lessons, onlyLesson) {
  const pool = onlyLesson ? [onlyLesson] : lessons;
  let items = planLearn(S.prog, pool);
  if (!items.length) {
    // alles erledigt: freiwillig üben (ändert die Pausen nicht)
    items = shuffle(pool.flatMap(l => l.words.map(w => ({ l, w, s: wstate(S.prog, l.id, w.id), kind: "extra" })))).slice(0, 8);
    if (!items.length) return toast(t("Hier gibt es noch keine Wörter."));
    toast(t("Alles für heute geschafft! Jetzt übst du freiwillig."), 3500);
  }
  const pref = await askAnswerMode(t("Wie möchtest du üben?"), true, recommendFor(items));
  if (!pref) return;
  S.prog.pref = pref;
  runLearn(items, { pref, lesson: onlyLesson, mission: !onlyLesson });
}

async function chooseTest(unlocked) {
  if (!unlocked.length) return toast(t("Noch keine Insel offen."));
  const id = unlocked.length === 1 ? unlocked[0].id : await modal(`<h2 class="center">${t("Welche Insel testen?")}</h2>
    <div class="isle-grid">${unlocked.map(l => { const st = lessonStats(S.prog, l); return `<button class="isle" data-close="${esc(l.id)}"><span class="isle-pic">${l.iconImg ? `<img src="${esc(l.iconImg)}" alt="">` : art("island")}</span><span class="isle-name">${esc(l.title)}</span>${st.testBest != null ? `<span class="small muted">${t("Bestes: {n} %", { n: st.testBest })}</span>` : ""}</button>`; }).join("")}</div>`);
  const l = S.lessons.find(x => x.id === id);
  if (l) startTest(l);
}
async function startTest(l) {
  const mode = await askAnswerMode(t("Test: {t}", { t: l.title }));
  if (!mode) return;
  runTest(l, mode);
}

// ------------------------------------------------------------------
//  Insel
// ------------------------------------------------------------------
function islandView(l) {
  const st = lessonStats(S.prog, l), waiting = planLearn(S.prog, [l]).length;
  render(`<div class="wrap">
    ${topbar()}
    <button class="btn ghost small back-home" id="backHome">← ${t("Zurück zur Startseite")}</button>
    <div class="panel isle-head">
      <span class="isle-pic big">${l.iconImg ? `<img src="${esc(l.iconImg)}" alt="">` : art("island")}</span>
      <div class="stack" style="gap:6px;flex:1;min-width:0">
        <h1>${esc(l.title)}</h1>
        <span class="muted">${t("{n} Wörter · Französisch →", { n: st.total })} ${LANG_FLAG[l.lang] || ""}${l.week ? ` · ${esc(wkLabel(l.week))}` : ""}</span>
        ${stars(st.stars)}
        <div class="bar" title="${t("gelernt")}"><i style="width:${st.knownPct}%"></i></div>
        <span class="small muted">${starHint(st)}${st.testBest != null ? " · " + t("Bester Test: {n} %", { n: st.testBest }) : ""}</span>
      </div>
    </div>
    <div class="big-actions">
      <button class="mode-btn learn" id="learn">${art("book", "mode-art")}<span><b>${t("Lernen")}</b><small>${waiting ? tn(waiting, "{n} Wort wartet", "{n} Wörter warten") : t("alles geschafft – freiwillig üben")}</small></span></button>
      <button class="mode-btn test" id="test">${art("clipboard", "mode-art")}<span><b>${t("Testen")}</b><small>${t("alle {n} Wörter", { n: st.total })}</small></span></button>
    </div>
    <h2 class="section-title">${t("Mehr üben")}</h2>
    ${actsHtml(l)}
  </div>`);
  bindTop();
  $("#learn").onclick = () => startLearn(null, l);
  $("#test").onclick = () => startTest(l);
  $("#backHome").onclick = () => goHome();
  bindActs(l);
}

// Weitere Übungen (Insel und Startseite)
function actsHtml(l) {
  const G = [
    ["🎧", "Hören & Sprechen", [
      ["shower", "shower", "Vokabeldusche", "zuhören und nachsprechen"],
      ["rec", "mascotHead", "Meine Vokabeldusche", "selbst aufnehmen und anhören"],
      ["move", "jump", "Bewegungsrunde", "hüpfen und sprechen"]]],
    ["🎲", "Spielen", [
      ["memory", "games", "Memory", "Finde die Paare"],
      ["match", "postit", "Post-its zuordnen", "Wort zum Bild"],
      ["sort", "baskets", "Sortieren", canSortArticle(l) ? "le oder la?" : "kurz oder lang?"],
      ["blitz", "flame", "Blitzrunde", "60 Sekunden"]]],
    ["✏️", "Schreiben, Malen & Zuhause", [
      ["net", "bulbArt", "Wortnetz", "neue Wörter ans Kopfwort knüpfen"],
      ["words", "telescope", "Wörter ansehen", "malen und Eselsbrücken"],
      ["paper", "clipboard", "Test für zu Hause", "zum Ausdrucken"]]],
  ];
  return G.map(([ic, name, A]) => `<h3 class="act-group"><span aria-hidden="true">${ic}</span> ${t(name)}</h3><div class="acts">${A.map(([k, a, n, sub]) => `<button class="act" data-k="${k}">${art(a)}<b>${t(n)}</b><small>${t(sub)}</small></button>`).join("")}</div>`).join("");
}
function bindActs(l) {
  const F = { words: wordList, memory: memoryGame, blitz, shower: vocabShower, match: matchGame, sort: sortGame, move: moveGame, rec: recordShower, net: wordNet, paper: homeTest };
  $$(".act[data-k]").forEach(b => b.onclick = () => F[b.dataset.k](l));
}
function starHint(st) {
  if (st.stars === 0) return t("Stern 1: Lerne alle Wörter einmal kennen.");
  if (st.stars === 1) return t("Stern 2: 8 von 10 Wörtern 2× richtig geschafft.");
  if (st.stars === 2) return t("Stern 3: Wiederhole an verschiedenen Tagen – dann sitzen die Wörter!");
  return t("Insel-Meister! Wiederhole ab und zu.");
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
function exFrame({ mode, label, progress, coins, skip, skipNote, switchMode }, inner) {
  render(`<div class="wrap narrow ex">
    <div class="ex-top">
      <button class="icon-btn" id="quit" aria-label="${t("Beenden")}">${ICON.close}</button>
      <div class="ex-progress"><i style="width:${progress}%"></i></div>
      ${switchMode ? `<button class="btn ghost small switch-btn" id="switchMode" title="${t("Übungsart wechseln")}">⇄ ${t("Übungsart")}</button>` : ""}
      ${audioBtn()}
      <span class="chip coin">${art("coin", "ic")} ${coins}</span>
    </div>
    <div class="card ${mode}" id="card"><div class="card-tag"><span class="pill ${mode === "test" ? "orange" : "green"}">${mode === "test" ? t("Testen") : t("Lernen")}</span><span class="small muted">${esc(label || "")}</span></div>${inner}</div>
    ${skip ? `<div class="ex-foot"><button class="btn ghost skip-btn" id="skip">${t("Überspringen")} ⏭</button><span class="small muted">${esc(skipNote || "")}</span></div>` : ""}</div>`);
  $("#quit").onclick = () => onQuit && onQuit();
  // Überspringen / Übungsart wechseln – nur solange die Aufgabe noch offen ist
  const open = () => !$("#card .feedback") && !$("#card .flash-after:not([hidden])") && !$("#card .copy-box.ok");
  if (skip) $("#skip").onclick = () => { if (!open()) return; sfx.tap(); skip(); };
  if (switchMode) $("#switchMode").onclick = () => { if (!open()) return toast(t("Tippe zuerst auf „Weiter“.")); switchMode(); };
}
const speakerBtn = (id = "hear", big = false) => `<button class="round-btn blue ${big ? "big" : ""}" id="${id}" aria-label="${t("Wort anhören")}" title="${t("Wort anhören")}">${ICON.speaker}</button>`;
const micBtn = (id = "mic", big = false) => canListen ? `<button class="round-btn coral ${big ? "big" : ""}" id="${id}" aria-label="${t("Sprechen")}" title="${t("Antwort sprechen")}">${ICON.mic}</button>` : "";
// Wort-Bild: Bild der Lehrkraft, sonst eigene Zeichnung des Kindes
const withDrawing = (l, w) => (w.img || w.emoji || !l) ? w : (S.drawings?.[wkey(l.id, w.id)] ? { ...w, img: S.drawings[wkey(l.id, w.id)] } : w);
const picBox = (w, l) => { const x = withDrawing(l, w); return hasPic(x) ? `<div class="prompt-pic">${pic(x)}</div>` : ""; };
const memoOf = (l, w) => S.prog.memos?.[wkey(l.id, w.id)] || w.memo || "";

// Mikrofon: hört zu, zeigt das Gehörte, liefert die erkannten Möglichkeiten
async function useMic(btn, out) {
  if (btn.classList.contains("on")) return null;
  btn.classList.add("on"); out.textContent = t("Ich höre zu …");
  const r = await listen("fr", { onInterim: t => { out.textContent = `„${t}“`; } });
  btn.classList.remove("on");
  if (r.error === "not-allowed" || r.error === "service-not-allowed") { out.textContent = t("Das Mikrofon ist nicht erlaubt. Bitte die Lehrkraft, es freizugeben."); return null; }
  if (!r.alts.length) { out.textContent = t("Ich habe nichts gehört. Sprich etwas lauter und tippe nochmal."); return null; }
  out.textContent = t("Ich habe „{x}“ gehört.", { x: r.alts[0] });
  return r.alts;
}

// Deutliche Rückmeldung: großes ✓/✗, Farbe, Klang, immer Schreibweise + Aussprache
// Motivierende Sprüche (zufällig, nie zweimal hintereinander derselbe)
const MOTTO_OK = [
  "Weiter so – du bist ein echter Vokabel-Profi!",
  "Stark! Das Wort sitzt.",
  "Du wirst immer besser!",
  "Wow, das war perfekt!",
  "Bravo! Darauf kannst du stolz sein.",
  "Super gemacht – auf zum nächsten Wort!",
  "Dein Gehirn hat gerade ein Wort gespeichert. Klasse!",
];
const MOTTO_OK_SPEAK = [
  "Toll ausgesprochen – man versteht dich super!",
  "Dein Französisch klingt richtig gut!",
  "Très bien! Du sprichst wie ein Profi.",
];
const MOTTO_NO = [
  "Kein Problem – aus Fehlern lernt man!",
  "Fast geschafft! Beim nächsten Mal klappt es.",
  "Nicht aufgeben – jedes Üben macht dich stärker!",
  "Fehler sind Lernhelfer. Weiter geht's!",
  "Auch Profis üben viel. Du bist auf einem guten Weg!",
  "Atme tief durch – du schaffst das!",
];
const MOTTO_NO_SPEAK = [
  "Hör gut zu, sprich es nach – gleich sitzt es!",
  "Mutig gesprochen! Hör dir das Wort an und versuch es nochmal.",
  "Sprich langsam und deutlich – du schaffst das!",
];
let lastMotto = "";
function motto(ok, spoken) {
  const list = ok ? (spoken ? [...MOTTO_OK_SPEAK, ...MOTTO_OK_SPEAK, ...MOTTO_OK] : MOTTO_OK) : (spoken ? [...MOTTO_NO_SPEAK, ...MOTTO_NO_SPEAK, ...MOTTO_NO] : MOTTO_NO);
  let m; do { m = list[Math.floor(Math.random() * list.length)]; } while (m === lastMotto && list.length > 1);
  lastMotto = m;
  return t(m);
}

function feedbackBox(ok, w, msg, onNext, auto, memo, x = {}) {
  const card = $("#card");
  card.classList.remove("flash-ok", "flash-no"); void card.offsetWidth; card.classList.add(ok ? "flash-ok" : "flash-no");
  const fb = document.createElement("div");
  fb.className = `feedback ${ok ? "ok" : "no"}`;
  const dots = x.wc ? `<div class="wc-dots" title="${t("richtig geschrieben")}">${Array.from({ length: WRITES_FOR_POINT }, (_, i) => `<span class="${i < x.wc ? "on" : ""}">✍</span>`).join("")}<small>${t("{a} von {b}× richtig geschrieben", { a: x.wc, b: WRITES_FOR_POINT })}</small></div>` : "";
  fb.innerHTML = `
    <div class="fb-head"><span class="fb-icon">${ok ? ICON.check : ICON.cross}</span><span class="fb-title">${esc(msg || t(ok ? ["Richtig!", "Super!", "Genau!", "Klasse!"][Math.floor(Math.random() * 4)] : "Nicht ganz."))}</span></div>
    <div class="fb-motto">${ok ? "🌟" : "💪"} ${esc(motto(ok, !!x.heard || x.how === "speak"))}</div>
    ${x.heard ? `<div class="fb-heard">${t("Du hast gesagt: „{x}“", { x: esc(x.heard) })}</div>` : x.typed && !ok ? `<div class="fb-heard">${t("Du hast geschrieben: „{x}“", { x: esc(x.typed) })}</div>` : ""}
    <div class="fb-sol"><span class="small">${t("So schreibt man es:")}</span><span class="sol">${esc(w.fr)}</span><button class="round-btn blue" id="solHear" aria-label="${t("So spricht man es aus")}">${ICON.speaker}</button><span class="small">${t("So spricht man es aus")}</span></div>
    ${dots}
    ${x.point ? `<div class="fb-point">${art("rocket", "ic")} ${t("+1 Wort für die Klasse!")}</div>` : x.already ? `<div class="small">${t("Dieses Wort hat diese Woche schon für die Klasse gezählt.")}</div>` : ""}
    ${!ok && memo ? `<span class="memo">${art("bulbArt", "ic")} ${esc(memo)}</span>` : ""}`;
  const btn = document.createElement("button");
  btn.className = `btn ${ok ? "green" : "coral"} big`; btn.textContent = t("Weiter");
  let gone = false;
  const go = () => { if (gone) return; gone = true; onNext(); };
  btn.onclick = go;
  fb.appendChild(btn);
  card.appendChild(fb);
  ok ? sfx.ok() : sfx.no();
  if (x.point) setTimeout(() => sfx.coin(), 450);
  fb.querySelector("#solHear").onclick = () => sayWord(w.fr);
  if (ok && auto) setTimeout(go, Math.max(auto, 3200));   // Zeit zum Lesen des Spruchs
  fb.scrollIntoView({ block: "nearest", behavior: "smooth" });
  btn.focus({ preventScroll: true });
}

// Eine Abruf-Aufgabe (Schreiben / Sprechen / Buchstabensalat).
// cb({ok, helped, how}) – helped = 🔊 benutzt
function recallTask(item, type, ctx, cb, { test = false } = {}) {
  const { w, l } = item;
  let helped = false;
  const help = () => { helped = true; sayWord(w.fr); if (test) toast(t("Notfall-Hilfe: zählt im Test nur halb."), 2200); };

  if (type === "speak") {
    exFrame(ctx, `<span class="task-q">${t("Sag das Wort auf Französisch")}</span>${picBox(w, l)}<div class="word-tr">${esc(w.tr)}</div>
      ${canListen ? `<div class="row center-row">${micBtn("mic", true)}${speakerBtn("hear")}</div><div id="heard" class="heard">${t("Tippe auf das Mikrofon und sprich.")}</div>`
        : `<div class="row center-row">${speakerBtn("hear")}</div><button class="btn blue" id="reveal">${t("Ich habe es laut gesagt – Lösung zeigen")}</button>`}`);
    $("#hear").onclick = help;
    if (!canListen) {
      $("#reveal").onclick = () => {
        $("#reveal").outerHTML = `<div class="word-fr">${esc(w.fr)}</div><div class="row center-row"><button class="btn green" id="sOk">${t("Hatte ich richtig")}</button><button class="btn coral" id="sNo">${t("Noch nicht")}</button></div>`;
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
      if (ok || test || tries >= 2) { $("#mic").disabled = true; cb({ ok, helped, how: "speak", heard: alts[0] }); return; }
      sfx.no();
      const card = $("#card"); card.classList.remove("flash-ok", "flash-no"); void card.offsetWidth; card.classList.add("flash-no");
      $("#heard").innerHTML = `<div class="retry-box"><b>${t("Ich habe „{x}“ gehört.", { x: esc(alts[0]) })}</b><span class="fb-motto">💪 ${esc(motto(false, true))}</span><span class="small">${t("Tippe auf 🔊, hör genau hin und versuch es nochmal.")}</span></div>`;
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
    exFrame(ctx, `<span class="task-q">${t("Ordne die Buchstaben")}</span>${picBox(w, l)}<div class="word-tr">${esc(w.tr)}</div>
      <div class="row center-row">${art_ ? `<span class="word-fr small-fr">${esc(art_.trim())}</span>` : ""}<div class="slots" id="slots"></div>${speakerBtn("hear")}</div>
      <div class="tiles" id="tiles"></div>`);
    $("#hear").onclick = help;
    let tries = 0;
    const draw = () => {
      $("#slots").innerHTML = placed.map((o, k) => `<button class="tile" data-k="${k}">${esc(o.c)}</button>`).join("") || `<span class="muted" style="align-self:center">${t("tippe die Buchstaben")}</span>`;
      $("#tiles").innerHTML = order.map((o, k) => `<button class="tile ${placed.includes(o) ? "used" : ""}" data-k="${k}">${esc(o.c)}</button>`).join("");
      $$("#tiles .tile").forEach(b => b.onclick = () => { const o = order[+b.dataset.k]; if (placed.includes(o)) return; placed.push(o); sfx.tap(); draw(); if (placed.length === letters.length) done(); });
      $$("#slots .tile").forEach(b => b.onclick = () => { placed.splice(+b.dataset.k, 1); draw(); });
    };
    const done = () => {
      const ok = placed.map(o => o.c).join("").toLowerCase() === letters.join("").toLowerCase();
      if (!ok && tries === 0 && !test) { tries++; sfx.no(); toast(t("Noch nicht ganz – tippe oben einen Buchstaben an, um ihn zurückzulegen.")); return; }
      $$(".tile").forEach(t => t.disabled = true);
      cb({ ok, helped, how: "scramble" });
    };
    draw();
    return;
  }

  // Schreiben (mit Mikrofon als zweitem Weg)
  exFrame(ctx, `<span class="task-q">${t("Schreib das Wort auf Französisch")}</span>${picBox(w, l)}<div class="word-tr">${esc(w.tr)}</div>
    <div class="write-row"><input class="input write-in" id="inp" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${t("Antwort")}">${speakerBtn("hear")}${micBtn("mic")}</div>
    <div id="heard" class="heard"></div>
    <div class="accents">${["é", "è", "ê", "à", "ç", "ô", "î", "û", "ë", "œ", "'"].map(c => `<button data-c="${c}">${c}</button>`).join("")}</div>
    <div class="row center-row">${test ? "" : `<button class="btn ghost" id="hint">${ICON.bulb} ${t("Tipp")}</button>`}<button class="btn green" id="chk">${t("Prüfen")}</button></div>`);
  const inp = $("#inp"); inp.focus();
  $("#hear").onclick = help;
  $$(".accents button").forEach(b => b.onclick = () => { const p = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, p) + b.dataset.c + inp.value.slice(inp.selectionEnd ?? p); inp.focus(); inp.setSelectionRange(p + 1, p + 1); });
  let hints = 0, tries = 0, finished = false;
  if ($("#hint")) $("#hint").onclick = () => { hints++; helped = true; const sol = w.fr.split(/\s*\/\s*/)[0]; inp.value = sol.slice(0, Math.min(sol.length - 1, hints * Math.max(1, Math.ceil(sol.length / 4)))); inp.focus(); };
  let heardText = "";
  const finish = (ok, how, note, kind) => { if (finished) return; finished = true; $("#chk").disabled = true; inp.disabled = true; cb({ ok, helped, how, note, spelling: kind === "accent" || kind === "article", heard: heardText, typed: inp.value }); };
  const check = () => {
    const r = checkWritten(inp.value, w.fr);
    if (r === "almost" && tries === 0 && !test) { tries++; sfx.no(); toast(t("Fast! Schau nochmal genau hin.")); inp.focus(); return; }
    const ok = r === "perfect" || r === "accent" || r === "article";
    finish(ok, "write", r === "accent" ? t("Achte auf die Akzente: {w}", { w: w.fr }) : r === "article" ? t("Denk an den Artikel: {w}", { w: w.fr }) : "", r);
  };
  $("#chk").onclick = check;
  inp.onkeydown = e => { if (e.key === "Enter" && !finished) check(); };
  if ($("#mic")) $("#mic").onclick = async () => {
    const alts = await useMic($("#mic"), $("#heard"));
    if (!alts) return;
    const ok = checkSpoken(alts, w.fr);
    if (ok) { inp.value = w.fr; heardText = alts[0]; finish(true, "speak"); }
    else if (test) { heardText = alts[0]; finish(false, "speak"); }
    else { sfx.no(); $("#heard").textContent += " " + t("Versuch es nochmal oder schreib es."); }
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
  if (type === "fr2tr") head = `<span class="task-q">${t("Was bedeutet das?")}</span><div class="row center-row"><div class="word-fr">${esc(w.fr)}</div>${speakerBtn("hear")}</div>`;
  else if (type === "pic2fr") head = `<span class="task-q">${t("Wie heißt das auf Französisch?")}</span>${picBox(w, l)}<div class="word-tr">${esc(w.tr)}</div>`;
  else head = `<span class="task-q">${t("Hör gut zu! Was passt?")}</span><div class="row center-row">${speakerBtn("hear", true)}</div>`;
  exFrame(ctx, `${head}<div class="choices">${opts.map((o, i) => `<button class="choice" data-i="${i}">${usePics ? `<span class="pic">${pic(o.w)}</span>` : esc(o.w[field])}</button>`).join("")}</div>`);
  if ($("#hear")) $("#hear").onclick = () => sayWord(w.fr);
  let done = false;
  $$(".choice").forEach(b => b.onclick = () => {
    const o = opts[+b.dataset.i];
    if (field === "fr" && isSound()) say(o.w.fr, "fr");
    if (done) return; done = true;
    const ok = o.w === w;
    b.classList.add(ok ? "right" : "wrong");
    if (!ok) $$(".choice").find(x => opts[+x.dataset.i].w === w)?.classList.add("right");
    cb(ok);
  });
}

function introCard(item, ctx, cb, writeMode = false, copyOnly = false) {
  const { w, l } = item;
  exFrame(ctx, `<span class="task-q">${copyOnly ? t("Schreib das Wort ab") : t("Neues Wort")}</span>${picBox(w, l)}
    <div class="row center-row"><div class="word-fr">${esc(w.fr)}</div>${speakerBtn("hear")}</div>
    <div class="word-tr">${LANG_FLAG[l.lang] || ""} ${esc(w.tr)}</div>
    ${w.ex ? `<div class="small muted">„${esc(w.ex)}“</div>` : ""}
    ${memoOf(l, w) ? `<div class="memo">${art("bulbArt", "ic")} <span>${esc(memoOf(l, w))}</span></div>` : ""}
    <div class="row center-row">${canListen ? micBtn("mic") + `<span class="small muted">${t("Sprich es nach!")}</span>` : `<span class="small muted">${t("Sprich das Wort laut nach!")}</span>`}<button class="btn ghost small" id="draw">${t("Malen")}</button></div>
    <div id="heard" class="heard"></div>
    ${writeMode ? `<div class="copy-box"><span class="small"><b>${t("Schreib das Wort ab:")}</b></span>
      <div class="write-row"><input class="input write-in" id="cpy" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${t("Wort abschreiben")}"></div>
      <div class="accents">${["é", "è", "ê", "à", "ç", "ô", "î", "û", "ë", "œ", "'"].map(c => `<button data-c="${c}">${c}</button>`).join("")}</div>
      <div id="cpyRes" class="small"></div></div>` : ""}
    <button class="btn green big" id="nxt">${writeMode ? t("Prüfen") : t("Weiter")}</button>`);
  $("#hear").onclick = () => sayWord(w.fr);   // nur auf Knopfdruck vorlesen
  if ($("#mic")) $("#mic").onclick = async () => {
    const alts = await useMic($("#mic"), $("#heard"));
    if (!alts) return;
    if (checkSpoken(alts, w.fr)) { $("#heard").textContent += " " + t("Toll ausgesprochen!"); sfx.ok(); }
    else $("#heard").textContent += " " + t("Hör nochmal hin und versuch es nochmal.");
  };
  $("#draw").onclick = () => drawWord(l, w, () => {});
  if (!writeMode) { $("#nxt").onclick = cb; return; }
  const inp = $("#cpy");
  $$(".copy-box .accents button").forEach(b => b.onclick = () => { const p = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, p) + b.dataset.c + inp.value.slice(inp.selectionEnd ?? p); inp.focus(); inp.setSelectionRange(p + 1, p + 1); });
  let checked = false;
  const check = () => {
    if (checked) return cb();
    if (!inp.value.trim()) { toast(t("Schreib das Wort zuerst ab.")); inp.focus(); return; }
    const r = checkWritten(inp.value, w.fr);
    if (r === "perfect") {
      checked = true; inp.disabled = true; sfx.ok();
      $(".copy-box").classList.add("ok");
      $("#cpyRes").innerHTML = `<b>${t("🌟 Richtig abgeschrieben!")}</b>`;
      $("#nxt").textContent = t("Weiter");
    } else {
      sfx.no(); $(".copy-box").classList.remove("ok"); $(".copy-box").classList.add("no");
      $("#cpyRes").innerHTML = `<b>${t("Schau nochmal genau hin – Buchstabe für Buchstabe.")}</b> 💪`;
      inp.focus();
    }
  };
  $("#nxt").onclick = check;
  inp.onkeydown = e => { if (e.key === "Enter") check(); };
}

// Lernkarte: vorne Bedeutung (Deutsch bzw. Portugiesisch) + Bild, hinten Französisch + Bild
function flashCard(item, ctx, cb) {
  const { w, l } = item;
  const p = picBox(w, l);
  exFrame(ctx, `<span class="task-q">${t("Tippe auf die Karte, um sie umzudrehen.")}</span>
    <button class="flash" id="flash" aria-label="${t("Karte umdrehen")}">
      <span class="flash-in">
        <span class="flash-face front">${p}<span class="flash-word tr">${LANG_FLAG[l.lang] || ""} ${esc(w.tr)}</span><span class="flash-hint">↻ ${t("umdrehen")}</span></span>
        <span class="flash-face back">${p}<span class="flash-word fr">${esc(w.fr)}</span><span class="flash-hint">↻ ${t("umdrehen")}</span></span>
      </span>
    </button>
    <div id="after" class="flash-after" hidden>
      <div class="row center-row">${speakerBtn("hear", true)}<span class="small muted">${t("Wort vorlesen lassen")}</span></div>
      <div class="row center-row"><button class="btn green big" id="knew">${t("Wusste ich")}</button><button class="btn coral big" id="notyet">${t("Wusste ich nicht")}</button></div>
    </div>`);
  const card = $("#flash");
  card.onclick = () => {
    card.classList.toggle("flipped"); sfx.tap();
    $("#after").hidden = false;
  };
  $("#hear").onclick = () => sayWord(w.fr);   // nur auf Wunsch vorlesen
  $("#knew").onclick = () => cb(true);
  $("#notyet").onclick = () => cb(false);
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
  const st = { pos: 0, ok: 0, ans: 0, coins: 0, wp: 0, t0: Date.now(), doneWords: 0, lastItem: null,
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
    if (p === "write") return "write";
    if (p === "speak") return canListen ? "speak" : "write";
    if (it.recalls === 0 && it.kind !== "review") return Math.random() < 0.5 ? "scramble" : "write";
    return canListen && Math.random() < 0.5 ? "speak" : "write";
  };

  const next = () => {
    const it = pick();
    if (!it) return finish();
    st.lastItem = it;
    const ctx = { mode: "learn", label: opts.lesson ? opts.lesson.title : t("Lernen"), progress: Math.round((1 - totalSteps() / Math.max(1, startSteps)) * 100), coins: st.coins,
      // Überspringen: Wort kommt später in dieser Runde wieder, zählt nicht als Fehler
      skip: q.filter(x => !x.done).length > 1 ? () => { it.last = st.pos; st.pos++; next(); } : null,
      skipNote: t("Das Wort kommt später nochmal."),
      // Übungsart wechseln, ohne die Runde zu beenden
      switchMode: async () => {
        const p = await askAnswerMode(t("Übungsart wechseln"), true, opts.pref);
        if (!p || p === opts.pref) return;
        opts.pref = p; S.prog.pref = p; st.lastItem = null; next();
      } };
    const after = () => { it.last = st.pos; st.pos++; save(); };

    if (opts.pref === "cards") {
      return flashCard(it, ctx, knew => {
        // Selbsteinschätzung fließt in die Wiederholungen ein (wie beim Schreiben/Sprechen)
        if (!extra && it.kind === "new") markSeen(S.prog, it.l, it.w);
        st.ans++;
        countCard(S.prog, it.l, it.w, knew);            // eigene Zählung: Selbsteinschätzung, nicht „Treffer“
        if (knew) {
          st.ok++; st.coins += 1; sfx.ok(); it.recalls++; it.need--;
          if (it.need <= 0) {
            it.done = true; st.doneWords++;
            // Lernkarten bringen ein Wort höchstens bis „morgen wieder“ – weiter nur mit Schreiben/Sprechen
            if (!extra && wstate(S.prog, it.l.id, it.w.id).b <= 1) { promote(S.prog, it.l, it.w); toast(t("Für heute geschafft! Das Wort kommt morgen wieder."), 2200); }
            else toast(t("Gut gewusst! Schreib das Wort jetzt noch aus dem Kopf – dann wandert es weiter."), 2600);
          } else toast(t("Gut! Die Karte kommt gleich nochmal – nach ein paar anderen Karten."), 2200);
        } else {
          sfx.no();
          if (!extra) fallBack(S.prog, it.l, it.w);     // nicht gewusst → wieder öfter üben
          it.need = extra ? 1 : NEEDED_TODAY; if (it.kind !== "extra") it.kind = "learn";
          toast(t("Kein Problem – die Karte kommt gleich nochmal."), 2200);
        }
        after(); next();
      });
    }
    if (opts.pref === "copy") {
      return introCard(it, ctx, () => {
        if (!extra && it.kind === "new") markSeen(S.prog, it.l, it.w);
        it.done = true; st.doneWords++; st.coins += 1; S.prog.copied = (S.prog.copied || 0) + 1;
        after(); next();
      }, true, true);
    }
    if (it.phase === "intro") {
      return introCard(it, ctx, () => { if (!extra) markSeen(S.prog, it.l, it.w); it.phase = opts.pref === "write" ? "recall" : "recog"; after(); next(); }, opts.pref === "write");
    }
    if (it.phase === "recog" && opts.pref === "write") it.phase = "recall";
    if (it.phase === "recog") {
      return recogTask(it, ctx, ok => {
        st.ans++; if (ok) st.ok++;
        countAnswer(S.prog, it.l, it.w, ok);
        if (ok) { it.phase = "recall"; after(); feedbackBox(true, it.w, "", next, 900); }
        else { after(); feedbackBox(false, it.w, "", next); }
      });
    }
    recallTask(it, recallType(it), ctx, ({ ok, helped, how, note, heard, typed }) => {
      st.ans++;
      countAnswer(S.prog, it.l, it.w, ok);
      const fx = { heard: how === "speak" ? heard : "", typed, how };
      if (ok) {
        st.ok++; st.coins += 1;
        if (how === "speak") S.prog.spoken++; else S.prog.typed++;
        if (how === "write" && !helped) { const r = writePoint(S.prog, it.l, it.w); st.wp += r.point; fx.wc = r.count; fx.point = r.point; fx.already = r.already; }
        if (helped) { after(); return feedbackBox(true, it.w, t("Mit Hilfe geschafft! Das Wort kommt gleich nochmal – dann ohne Hilfe."), next, 0, "", fx); }
        it.recalls++; it.need--;
        if (it.need <= 0) {
          it.done = true; st.doneWords++; st.coins += 2; sfx.coin();
          let msg = t("Für heute geschafft!");
          if (!extra) { const s = promote(S.prog, it.l, it.w); msg = t(`Für heute geschafft! Das Wort kommt ${({ 2: "morgen", 3: "in 3 Tagen", 4: "in einer Woche", 5: "in einem Monat" })[s.b] || "später"} wieder.`); }
          after(); return feedbackBox(true, it.w, note || msg, next, 2600, "", fx);
        }
        after(); return feedbackBox(true, it.w, note || t("Richtig! Gleich nochmal – nach ein paar anderen Wörtern."), next, 2400, "", fx);
      }
      // Fehler: zurück auf „heute lernen“, wieder 2× richtig nötig
      if (!extra) fallBack(S.prog, it.l, it.w);
      it.need = extra ? 1 : NEEDED_TODAY; it.kind = it.kind === "extra" ? "extra" : "learn";
      after(); feedbackBox(false, it.w, t("Nicht ganz – das Wort kommt gleich nochmal."), next, 0, memoOf(it.l, it.w), fx);
    });
  };

  const finish = () => {
    const sec = Math.round((Date.now() - st.t0) / 1000);
    const copy = opts.pref === "copy", cards = opts.pref === "cards";
    logActivity(S.prog, { sec, ans: cards || copy ? 0 : st.ans, ok: cards || copy ? 0 : st.ok, pts: st.ok, wp: st.wp });
    if (cards || copy) st.coins = earn(opts.pref, st.coins, 10);
    else S.prog.coins += st.coins;
    S.prog.xp += st.ok * 10;
    if (S.goal) S.goal.achieved += st.wp;
    if (opts.mission && planLearn(S.prog, unlockedLessons(S.prog, S.lessons, S.cls.allOpen)).length === 0) S.prog.missionDay = todayStr();
    const newStars = S.lessons.filter(l => lessonStats(S.prog, l).stars > (st.starsBefore[l.id] || 0));
    const badges = checkBadges(S.prog, S.lessons);
    save(true);
    sfx.win(); confetti(newStars.length || badges.length ? 200 : 90);
    const mission = offlineMission(items.map(x => x.w));
    render(`<div class="wrap narrow"><div class="card result">
      <div class="result-art">${art("trophy")}</div>
      <h1>${t("Super gemacht!")}</h1>
      <p class="muted" style="margin:0">${cards ? tn(st.doneWords, "{n} Lernkarte gewusst.", "{n} Lernkarten gewusst.") : copy ? tn(st.doneWords, "{n} Wort abgeschrieben.", "{n} Wörter abgeschrieben.") : tn(st.doneWords, "{n} Wort für heute geschafft · {ok} von {ans} Antworten richtig.", "{n} Wörter für heute geschafft · {ok} von {ans} Antworten richtig.", { ok: st.ok, ans: st.ans })}</p>
      ${st.wp ? `<div class="fb-point">${art("rocket", "ic")} ${tn(st.wp, "{n} Wort für das Klassenziel!", "{n} Wörter für das Klassenziel!")}</div>` : ""}
      <p class="small muted" style="margin:0">${cards ? t("Toll! Probier die Wörter jetzt beim Schreiben oder Sprechen.") : copy ? t("Gut abgeschrieben! Jetzt kannst du die Wörter aus dem Kopf schreiben.") : t("Die geschafften Wörter machen jetzt Pause und kommen später wieder. So bleiben sie im Kopf.")}</p>
      <div class="reward-row"><span class="reward">${art("coin", "ic")} +${st.coins}</span><span class="reward">${art("flame", "ic")} ${currentStreak(S.prog)}</span></div>
      ${newStars.map(l => `<div class="feedback ok">${art("star", "ic")} ${t("Neuer Stern auf „{t}“!", { t: esc(l.title) })}</div>`).join("")}
      ${badges.map(b => `<div class="feedback ok">${art(b.icon, "ic")} ${t("Neues Abzeichen: {n}", { n: esc(t(b.name)) })}</div>`).join("")}
      ${mission.html}
      <button class="btn green big" id="done">${t("Weiter")}</button>
    </div></div>`);
    mission.bind();
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
  const skipped = new Set();
  const res = [];
  let i = 0, coins = 0, wp = 0;
  const t0 = Date.now();
  const typeFor = k => mode === "write" ? "write" : mode === "speak" ? (canListen ? "speak" : "write") : (canListen && k % 2 ? "speak" : "write");
  const next = () => {
    if (i >= words.length) return finish();
    const w = words[i];
    const ctx = { mode: "test", label: t("Test: {t} · {i} von {n}", { t: l.title, i: i + 1, n: words.length }), progress: Math.round(i / words.length * 100), coins,
      // Überspringen: das Wort kommt am Ende des Tests (einmal) nochmal
      skip: !skipped.has(w) && i < words.length - 1 ? () => { skipped.add(w); words.splice(i, 1); words.push(w); next(); } : null,
      skipNote: t("Im Test kommt das Wort am Ende nochmal."),
      switchMode: async () => { const p = await askAnswerMode(t("Übungsart wechseln")); if (p && p !== mode) { mode = p; next(); } } };
    recallTask({ l, w }, typeFor(i), ctx, ({ ok, helped, how, spelling, heard, typed }) => {
      if (ok && spelling) helped = true; // Rechtschreibung: Akzent/Artikel fehlt = halber Punkt
      res.push({ w, ok, helped, spelling });
      countAnswer(S.prog, l, w, ok);
      const fx = { heard: how === "speak" ? heard : "", typed, how };
      if (ok && !helped) {
        coins += 2;
        if (how === "write") { const r = writePoint(S.prog, l, w); wp += r.point; fx.wc = r.count; fx.point = r.point; fx.already = r.already; }
        const s = wstate(S.prog, l.id, w.id);
        if (s.b === 0) markSeen(S.prog, l, w);            // noch nie gelernt → erst „heute lernen“
        else if (s.b < 2 || s.d <= Date.now()) promote(S.prog, l, w);
        if (how === "speak") S.prog.spoken++; else S.prog.typed++;
      } else fallBack(S.prog, l, w);
      i++; save();
      const title = t(ok ? (spelling ? "Fast richtig – achte auf die Schreibweise." : helped ? "Richtig – mit Hilfe (zählt halb)." : "Richtig!") : "Leider falsch.");
      feedbackBox(ok, w, title, next, ok && !helped ? 2200 : 0, ok ? "" : memoOf(l, w), fx);
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
    logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: res.length, ok, pts: ok, wp });
    if (S.goal) S.goal.achieved += wp;
    const badges = checkBadges(S.prog, S.lessons);
    save(true);
    if (passed) { sfx.win(); confetti(200); }
    const wrong = res.filter(r => !r.ok || r.helped);
    render(`<div class="wrap narrow"><div class="card result">
      <div class="result-art">${art(passed ? "medal" : "book")}</div>
      <h1>${score} %</h1>
      <p style="margin:0;font-size:1.2rem">${t(passed ? "Test bestanden! Du kannst die Wörter richtig gut." : score >= 50 ? "Schon gut! Ein paar Wörter brauchen noch Übung." : "Gut, dass du getestet hast! Jetzt weißt du, was du üben kannst.")}</p>
      <div class="reward-row"><span class="reward">${art("coin", "ic")} +${coins}</span>${passed ? `<span class="reward">${art("star", "ic")} ${t("Test-Stern")}</span>` : ""}</div>
      ${wrong.length ? `<div class="stack" style="text-align:left"><b>${t("Diese Wörter üben wir noch:")}</b>${wrong.map((r, k) => `<div class="word-row">${hasPic(r.w) ? `<span class="wpic">${pic(r.w)}</span>` : ""}<span><b>${esc(r.w.fr)}</b> – ${esc(r.w.tr)}${r.spelling ? ` <span class="pill orange">${t("Rechtschreibung")}</span>` : r.helped && r.ok ? ` <span class="pill">${t("mit Hilfe")}</span>` : ""}</span><button class="round-btn blue mini" data-say="${k}" aria-label="${t("Anhören")}">${ICON.speaker}</button></div>`).join("")}</div>` : ""}
      ${badges.map(b => `<div class="feedback ok">${art(b.icon, "ic")} ${t("Neues Abzeichen: {n}", { n: esc(t(b.name)) })}</div>`).join("")}
      <div class="row center-row">${wrong.length ? `<button class="btn green big" id="learnWrong">${t("Diese Wörter lernen")}</button>` : ""}<button class="btn ghost" id="back">${t("Zur Insel")}</button></div>
    </div></div>`);
    $$("[data-say]").forEach(b => b.onclick = () => sayWord(wrong[+b.dataset.say].w.fr));
    if ($("#learnWrong")) $("#learnWrong").onclick = async () => {
      const pref = await askAnswerMode(t("Wie möchtest du üben?"), true, "write");
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
      <div class="row center-row">${speakerBtn("h" + k).replace('id="h', 'data-k="' + k + '" id="h')}${canListen ? `<button class="round-btn coral" data-m="${k}" aria-label="${t("Nachsprechen")}">${ICON.mic}</button>` : ""}</div>
      <div class="small muted" id="o${k}">${t(s.b >= 2 ? "gelernt" : s.b === 1 ? "wird geübt" : "neu")}</div>
      ${memoOf(l, w) ? `<div class="memo small">${art("bulbArt", "ic")} ${esc(memoOf(l, w))}</div>` : ""}
      <div class="row center-row"><button class="btn ghost small" data-draw="${k}">${t("Malen")}</button><button class="btn ghost small" data-memo="${k}">${t("Eselsbrücke")}</button></div></div>`; }).join("")}</div></div>`);
  bindTop();
  $("#back").onclick = () => islandView(l);
  $$("[data-draw]").forEach(b => b.onclick = () => drawWord(l, l.words[+b.dataset.draw], () => wordList(l)));
  $$("[data-memo]").forEach(b => b.onclick = async () => {
    const w = l.words[+b.dataset.memo], key = wkey(l.id, w.id);
    const r = await modal(`<h2>${t("Eselsbrücke für „{w}“", { w: esc(w.fr) })}</h2><p class="small muted" style="margin:0">${t("Eine Merkhilfe, ein Reim oder ein Bild im Kopf. Beispiel: „le chat – der Kater schaut auf den <b>Schatz</b>“.")}</p>
      <textarea class="input" id="mm" style="font-family:inherit;min-height:90px">${esc(S.prog.memos[key] || w.memo || "")}</textarea>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost small" data-close="">${t("Abbrechen")}</button><button class="btn green small" id="ok">${t("Speichern")}</button></div>`,
      { onMount: (m, close) => { m.querySelector("#mm").focus(); m.querySelector("#ok").onclick = () => close(m.querySelector("#mm").value.trim() || "__leer__"); } });
    if (!r) return;
    if (r === "__leer__") delete S.prog.memos[key]; else S.prog.memos[key] = r.slice(0, 200);
    save(); wordList(l);
  });
  $$("[data-k]").forEach(b => b.onclick = () => sayWord(l.words[+b.dataset.k].fr));
  $$("[data-m]").forEach(b => b.onclick = async () => {
    const k = +b.dataset.m, out = $("#o" + k);
    const alts = await useMic(b, out);
    if (alts) { const ok = checkSpoken(alts, l.words[k].fr); out.textContent += " " + t(ok ? "Super ausgesprochen!" : "Hör nochmal hin."); ok ? sfx.ok() : sfx.no(); }
  });
}

// ------------------------------------------------------------------
//  Memory
// ------------------------------------------------------------------
function memoryGame(l) {
  // nur die Lernsprache: französisches Wort ↔ Bild (keine Übersetzung)
  const withPic = l.words.map(w => withDrawing(l, w)).filter(hasPic);
  if (withPic.length < 3) { toast(t("Für Memory brauchen mindestens 3 Wörter ein Bild. Male Bilder unter „Wörter ansehen“!"), 3600); return; }
  const words = shuffle(withPic).slice(0, Math.min(6, withPic.length));
  const cards = shuffle(words.flatMap(w => [{ w, side: "fr" }, { w, side: "b" }]));
  let open = [], pairs = 0, moves = 0, lock = false;
  const t0 = Date.now();
  render(`<div class="wrap narrow">
    <div class="ex-top"><button class="icon-btn" id="quit" aria-label="${t("Beenden")}">${ICON.close}</button><b class="ex-title">${t("Memory – {t}", { t: esc(l.title) })}</b>${audioBtn()}<span class="chip" id="mv">${t("Züge: {n}", { n: 0 })}</span></div>
    <div class="memory" id="mem">${cards.map((c, i) => `<button class="mem" data-i="${i}" aria-label="${t("Karte {n}", { n: i + 1 })}">${art("mascotHead")}</button>`).join("")}</div></div>`);
  $("#quit").onclick = () => islandView(l);
  $$(".mem").forEach(b => b.onclick = () => {
    const c = cards[+b.dataset.i];
    if (lock || b.classList.contains("open") || b.classList.contains("done")) return;
    b.classList.add("open");
    b.innerHTML = c.side === "fr" ? `<span class="t">${esc(c.w.fr)}</span>` : c.w.img ? `<img src="${esc(c.w.img)}" alt="">` : `<span class="e">${esc(c.w.emoji)}</span>`;
    if (c.side === "fr") autoSay(c.w.fr);
    open.push(b);
    if (open.length === 2) {
      moves++; $("#mv").textContent = t("Züge: {n}", { n: moves });
      const [a, d] = open.map(x => cards[+x.dataset.i]);
      if (a.w === d.w && a.side !== d.side) {
        sfx.ok(); open.forEach(x => x.classList.replace("open", "done")); open = []; pairs++;
        if (pairs === words.length) {
          const coins = earn("memory", Math.max(3, words.length * 2 - Math.max(0, moves - words.length)), 15);
          logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: words.length, ok: words.length });
          checkBadges(S.prog, S.lessons); save(true);
          setTimeout(() => { sfx.win(); confetti(); modal(`<div class="center stack"><div class="result-art">${art("trophy")}</div><h2>${t("Alle Paare gefunden!")}</h2><p class="muted" style="margin:0">${t("{n} Züge", { n: moves })}</p><div class="reward-row"><span class="reward">${art("coin", "ic")} +${coins}</span></div><button class="btn green" data-close="ok">${t("Weiter")}</button></div>`).then(() => islandView(l)); }, 500);
        }
      } else {
        lock = true;
        setTimeout(() => { open.forEach(x => { x.classList.remove("open"); x.innerHTML = art("mascotHead"); }); open = []; lock = false; }, 1100);
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
    <div class="ex-top"><button class="icon-btn" id="quit" aria-label="${t("Beenden")}">${ICON.close}</button>
      <div class="ex-progress"><i id="tbar" style="width:100%"></i></div>${audioBtn()}<span class="chip" id="sc">${art("flame", "ic")} 0</span></div>
    <div class="card" id="card"></div></div>`);
  const end = () => {
    clearInterval(timer);
    const best = S.prog.best["blitz:" + l.id] || 0;
    const rec = score > best;
    if (rec) S.prog.best["blitz:" + l.id] = score;
    const got = earn("blitz", score, 15);
    logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: score + wrong, ok: score });
    checkBadges(S.prog, S.lessons); save(true);
    if (rec && score > 0) { sfx.win(); confetti(); }
    render(`<div class="wrap narrow"><div class="card result"><div class="result-art">${art("flame")}</div>
      <h1>${t("{n} richtig!", { n: score })}</h1>
      <p class="muted" style="margin:0">${rec && score ? t("Neuer persönlicher Rekord!") : t("Dein Rekord: {n}", { n: best })}</p>
      <div class="reward-row"><span class="reward">${art("coin", "ic")} +${got}</span></div>
      <div class="row center-row"><button class="btn blue" id="again">${t("Nochmal")}</button><button class="btn green" id="back">${t("Zur Insel")}</button></div></div></div>`);
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
      <h1>${t("Mein Fortschritt")}</h1>
      <div class="kpis">
        <div class="kpi"><span class="v">${o.known}</span><span class="l">${t("Wörter gelernt")}</span></div>
        <div class="kpi"><span class="v">${o.master}</span><span class="l">${t("Wörter gemeistert")}</span></div>
        <div class="kpi"><span class="v">${currentStreak(S.prog)}</span><span class="l">${t("Tage hintereinander")}</span></div>
        <div class="kpi"><span class="v">${Math.round(wk.sec / 60)}</span><span class="l">${t("Minuten diese Woche")}</span></div>
      </div>
    </div>
    <div class="grid2">
      <div class="panel stack"><h3>${t("Meine Lernkartei")}</h3>
        <p class="small muted" style="margin:0">${t("Jedes Wort wandert nach rechts, wenn du es weißt. Die Pausen werden immer länger – ganz rechts bleibt es für immer im Kopf.")}</p>
        <div class="boxes">${[1, 2, 3, 4, 5].map(b => `<div class="col"><b>${boxes[b]}</b><i style="height:${Math.round(boxes[b] / maxB * 90) + 4}px;background:${colors[b]}"></i><span>${t(["", "heute", "1 Tag", "3 Tage", "1 Woche", "Profi"][b])}</span></div>`).join("")}</div>
      </div>
      <div class="panel stack"><h3>${t("Meine Übungstage")}</h3>
        <div class="cal">${cal.map(c => `<div class="${c.on ? "on" : ""} ${c.today ? "today" : ""}" title="${c.k}">${c.n}</div>`).join("")}</div>
      </div>
    </div>
    <div class="panel stack"><h3>${t("Meine Inseln")}</h3>
      ${S.lessons.map(l => { const st = lessonStats(S.prog, l); return `<div class="stack" style="gap:4px"><div class="row between"><b>${esc(l.title)}</b><span class="row" style="gap:8px">${st.testBest != null ? `<span class="pill ${st.testPassed ? "green" : ""}">Test ${st.testBest} %</span>` : ""}${stars(st.stars, "sm")}</span></div><div class="bar"><i style="width:${st.knownPct}%"></i></div></div>`; }).join("") || `<span class="muted">${t("Noch keine Inseln.")}</span>`}
    </div>
    <div class="panel stack"><h3>${t("Abzeichen")}</h3>
      <div class="badges">${BADGES.map(b => `<div class="badge ${S.prog.badges.includes(b.id) ? "" : "off"}">${art(b.icon, "badge-art")}<b>${esc(t(b.name))}</b><small>${esc(t(b.desc))}</small></div>`).join("")}</div>
    </div>
  </div>`);
  bindTop();
}

// ------------------------------------------------------------------
//  Shop (Avatar gestalten)
// ------------------------------------------------------------------
const PRICES_A = { "🦊": 0, "🐈": 0, "😺": 0, "😸": 20, "🐺": 30, "🐢": 0, "🐻": 0, "🐬": 0, "🦋": 20, "🐧": 30, "🐸": 30, "🐙": 40, "🦜": 40, "🐼": 50, "🦄": 80, "🦖": 100 };
const PRICES_H = { "": 0, "🌸": 10, "🧢": 15, "🎀": 15, "⛑️": 25, "🤠": 30, "🎓": 40, "🎩": 50, "🏴‍☠️": 60, "👑": 80 };
const COLORS = ["#2f9e8f", "#1c7ed6", "#7048e8", "#d6336c", "#e8590c", "#f08c00", "#2b8a3e", "#495057"];

function shop() {
  const av = S.prog.avatar;
  const owned = new Set(S.prog.owned);
  const item = (kind, key, price) => {
    const has = price === 0 || owned.has(kind + key);
    const sel = av[kind] === key;
    const look = kind === "animal" ? art(key) : key ? hat(key) : `<span class="none">${t("ohne")}</span>`;
    return `<button data-kind="${kind}" data-e="${esc(key)}" data-p="${price}" class="${sel ? "sel" : ""}"><span class="shop-art">${look}</span><small>${sel ? t("ausgewählt") : has ? t("auswählen") : `${art("coin", "ic")} ${price}`}</small></button>`;
  };
  render(`<div class="wrap">
    ${topbar()}
    <div class="panel shop-head">
      <div>${avatarHtml(av, "lg")}</div>
      <div><h1>${t("Mein Avatar")}</h1><p class="muted" style="margin:0">${t("Du hast {coin} <b>{n}</b> Münzen. Münzen bekommst du für richtige Antworten.", { coin: art("coin", "ic"), n: S.prog.coins })}</p></div>
    </div>
    <div class="panel stack"><h3>${t("Tier")}</h3><div class="shop">${ANIMAL_KEYS.map(k => item("animal", k, PRICES_A[k] ?? 30)).join("")}</div></div>
    <div class="panel stack"><h3>${t("Hut")}</h3><div class="shop">${["", ...HAT_KEYS].map(k => item("hat", k, PRICES_H[k] ?? 30)).join("")}</div></div>
    <div class="panel stack"><h3>${t("Farbe")}</h3><div class="row">${COLORS.map(c => `<button class="color-dot" data-color="${c}" aria-label="${t("Farbe")}" style="background:${c};${av.color === c ? "outline:4px solid #ffc531;outline-offset:2px" : ""}"></button>`).join("")}</div></div>
  </div>`);
  bindTop();
  $$(".shop button").forEach(b => b.onclick = () => {
    const { kind, e } = b.dataset; const p = +b.dataset.p;
    const key = kind + e;
    if (p > 0 && !owned.has(key)) {
      if (S.prog.coins < p) { sfx.no(); toast(t("Dir fehlen noch {n} Münzen. Weiter üben!", { n: p - S.prog.coins })); return; }
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
  return `<div class="ring" style="--p:${pct}" title="${t("Tagesziel: 5 Minuten")}"><div><b>${pct >= 100 ? "✓" : min}</b><small>${pct >= 100 ? t("geschafft") : t("von 5 Min.")}</small></div></div>`;
}
function weekCard(unlocked) {
  const cur = S.lessons.filter(l => weekState(l) === "current");
  if (!cur.length) return "";
  return cur.map(l => {
    const day = schoolDay(), per = perDayFor(l), st = lessonStats(S.prog, l);
    const mon = new Date(mondayOf() + "T12:00");
    const dots = ["Mo", "Di", "Mi", "Do", "Fr"].map((d, i) => { const k = todayStr(new Date(mon.getTime() + i * DAY)); const on = (S.prog.days[k]?.ans || 0) > 0; return `<span class="day ${on ? "on" : ""} ${i + 1 === day && new Date().getDay() % 6 ? "today" : ""}">${t(d)}</span>`; }).join("");
    const newToday = newAllowed(S.prog, l);
    const isFri = day >= 5;
    const wt = S.prog.tests[l.id];
    return `<div class="panel week-card">
      <span class="isle-pic small-pic">${l.iconImg ? `<img src="${esc(l.iconImg)}" alt="">` : art("island")}</span>
      <div class="stack" style="gap:6px;flex:1;min-width:0">
        <div class="row between"><b class="wk-title">${t("Diese Woche: {t}", { t: esc(l.title) })}</b><span class="small muted">${esc(wkLabel(l.week))}</span></div>
        <div class="days">${dots}</div>
        <span class="small">${st.seen < st.total ? `${newToday ? t("Heute <b>{n} neue Wörter</b>", { n: Math.min(7, newToday) }) : t("Heute nur Wiederholung")} · ${t("{p} pro Tag, damit es leicht bleibt.", { p: per })}` : t("Alle Wörter kennengelernt! Jetzt wiederholen und testen.")} ${wt && wt.date >= mondayOf() ? "· " + t("Wochentest: <b>{n} %</b>", { n: wt.last }) : ""}</span>
        <div class="row"><button class="btn ${isFri ? "orange" : "ghost"} small" id="weekTest" data-id="${esc(l.id)}">${isFri ? t("Freitag: Wochentest!") : t("Wochentest")}</button></div>
      </div></div>`;
  }).join("");
}
function hardWords() {
  const out = [];
  for (const l of S.lessons) for (const w of l.words) { const s = wstate(S.prog, l.id, w.id), wr = (s.w || 0) + (s.cw || 0); if (wr >= 2 || (s.b === 1 && wr >= 1)) out.push({ l, w, s: { ...s, w: wr } }); }
  return out.sort((a, b) => b.s.w - a.s.w);
}
function hardCard() {
  const h = hardWords();
  if (!h.length) return "";
  return `<div class="panel hard-card"><div class="stack" style="gap:6px;flex:1;min-width:0"><b>${t("Meine schwierigen Wörter ({n})", { n: h.length })}</b>
    <div class="row" style="gap:6px">${h.slice(0, 8).map(x => `<span class="pill orange">${esc(x.w.fr)}</span>`).join("")}${h.length > 8 ? `<span class="small muted">…</span>` : ""}</div></div>
    <button class="btn coral small" id="hardGo">${t("Üben")}</button></div>`;
}
async function practiceHard() {
  const h = hardWords().slice(0, 8);
  const pref = await askAnswerMode(t("Schwierige Wörter üben"), true, "write");
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
    <div class="ex-top"><button class="icon-btn" id="quit" aria-label="${t("Beenden")}">${ICON.close}</button><b class="ex-title">${t("Vokabeldusche – {t}", { t: esc(l.title) })}</b></div>
    <div class="card shower-card" id="card"></div>
    <div class="row center-row"><button class="btn blue" id="pp">${t("Pause")}</button><button class="btn ghost" id="sl">${t("Langsamer")}</button></div>
    <p class="center small muted">${t("Hör zu und sprich jedes Wort laut nach. Am besten jeden Tag einmal – auch beim Anziehen oder Frühstücken.")}</p></div>`);
  const end = () => { stop = true; window.speechSynthesis?.cancel(); logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000) }); save(); };
  $("#quit").onclick = () => { end(); islandView(l); };
  $("#pp").onclick = () => { playing = !playing; $("#pp").textContent = playing ? t("Pause") : t("Weiter"); if (playing) loop(); else window.speechSynthesis?.cancel(); };
  $("#sl").onclick = () => { slow = !slow; $("#sl").textContent = slow ? t("Normal") : t("Langsamer"); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let running = false;
  async function loop() {
    if (running) return; running = true;
    while (playing && !stop) {
      const w = words[i % words.length];
      const card = $("#card"); if (!card) break;
      card.innerHTML = `${picBox(w, l)}<div class="word-fr">${esc(w.fr)}</div><div class="word-tr" id="trl" style="visibility:hidden">${esc(w.tr)}</div><div class="small muted">${t("{i} von {n}", { i: i % words.length + 1, n: words.length })}</div>`;
      await say(w.fr, "fr", slow ? 0.55 : 0.8); if (!playing || stop) break;
      await wait(1800); if (!playing || stop) break;           // Zeit zum Nachsprechen
      const trl = $("#trl"); if (trl) trl.style.visibility = "visible";
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
    <div class="ex-top"><button class="icon-btn" id="quit" aria-label="${t("Beenden")}">${ICON.close}</button><b class="ex-title">${t("Post-its zuordnen")}</b>${audioBtn()}<span class="chip" id="pt">0 / ${words.length}</span></div>
    <p class="center muted" style="margin:0">${t("Tippe ein Post-it an und dann das passende Bild.")}</p>
    <div class="match">
      <div class="postits">${words.map((w, k) => `<button class="postit" data-p="${k}" style="background:${colors[k % 5]};transform:rotate(${(k % 2 ? 2 : -2)}deg)">${esc(w.fr)}</button>`).join("")}</div>
      <div class="targets">${right.map((w, k) => `<button class="target" data-t="${k}">${hasPic(withDrawing(l, w)) ? `<span class="pic">${pic(withDrawing(l, w))}</span>` : ""}<span>${esc(w.tr)}</span></button>`).join("")}</div>
    </div></div>`);
  $("#quit").onclick = () => islandView(l);
  $$(".postit").forEach(b => b.onclick = () => { if (b.classList.contains("done")) return; $$(".postit").forEach(x => x.classList.remove("sel")); b.classList.add("sel"); pick = +b.dataset.p; autoSay(words[pick].fr); });
  $$(".target").forEach(b => b.onclick = () => {
    if (pick == null || b.classList.contains("done")) return;
    const w = words[pick], tg = right[+b.dataset.t];
    const ok = w === tg;
    countAnswer(S.prog, l, w, ok);
    if (ok) {
      sfx.ok(); done++;
      const pb = $(`[data-p="${pick}"]`); pb.classList.add("done"); pb.classList.remove("sel");
      b.classList.add("done"); b.insertAdjacentHTML("beforeend", `<span class="stuck" style="background:${pb.style.background}">${esc(w.fr)}</span>`);
      pick = null; $("#pt").textContent = `${done} / ${words.length}`;
      if (done === words.length) {
        const coins = earn("match", Math.max(2, words.length * 2 - errors), 15); logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: words.length + errors, ok: words.length });
        save(true);
        setTimeout(() => { sfx.win(); confetti(); modal(`<div class="center stack"><div class="result-art">${art("postit")}</div><h2>${t("Alle Post-its kleben!")}</h2><div class="reward-row"><span class="reward">${art("coin", "ic")} +${coins}</span></div><button class="btn green" data-close="ok">${t("Weiter")}</button></div>`).then(() => islandView(l)); }, 500);
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
  const bins = byArt ? [{ k: "le", name: "le", sub: t("männlich"), col: "#d0ebff" }, { k: "la", name: "la", sub: t("weiblich"), col: "#ffdeeb" }]
    : [{ k: "short", name: t("kurz"), sub: t("bis 5 Buchstaben"), col: "#d3f9d8" }, { k: "long", name: t("lang"), sub: t("mehr Buchstaben"), col: "#fff3bf" }];
  const keyOf = w => byArt ? artOf(w.fr) : (stripArticle(w.fr.toLowerCase()).replace(/[^a-zàâçéèêëîïôûùüÿœ]/g, "").length <= 5 ? "short" : "long");
  const shown = w => byArt ? stripArticle(w.fr.toLowerCase()) : w.fr;
  let i = 0, ok = 0;
  const t0 = Date.now();
  const draw = () => {
    if (i >= pool.length) {
      const coins = earn("sort", ok * 2, 15);
      logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: pool.length, ok }); save(true);
      sfx.win(); if (ok >= pool.length - 1) confetti();
      return render(`<div class="wrap narrow"><div class="card result"><div class="result-art">${art("baskets")}</div><h1>${t("{ok} von {n} richtig sortiert!", { ok, n: pool.length })}</h1>
        <p class="muted" style="margin:0">${t(byArt ? "Tipp: Lerne jedes Wort immer mit seinem Artikel – le oder la." : "Lange Wörter darfst du in Silben zerlegen.")}</p>
        <div class="reward-row"><span class="reward">${art("coin", "ic")} +${coins}</span></div>
        <div class="row center-row"><button class="btn blue" id="again">${t("Nochmal")}</button><button class="btn green" id="back">${t("Zur Insel")}</button></div></div></div>`), $("#again").onclick = () => sortGame(l), $("#back").onclick = () => islandView(l);
    }
    const w = pool[i];
    render(`<div class="wrap narrow">
      <div class="ex-top"><button class="icon-btn" id="quit" aria-label="${t("Beenden")}">${ICON.close}</button><b class="ex-title">${t("Sortieren: {x}", { x: t(byArt ? "le oder la?" : "kurz oder lang?") })}</b><span class="chip">${i + 1} / ${pool.length}</span></div>
      <div class="card">${picBox(w, l)}<div class="row center-row"><div class="word-fr">${esc(shown(w))}</div>${speakerBtn("hear")}</div><div class="word-tr">${esc(w.tr)}</div>
      <div class="bins">${bins.map(b => `<button class="bin" data-k="${b.k}" style="background:${b.col}"><b>${b.name}</b><small>${b.sub}</small></button>`).join("")}</div></div></div>`);
    $("#quit").onclick = () => islandView(l);
    $("#hear").onclick = () => sayWord(w.fr);
    $$(".bin").forEach(b => b.onclick = () => {
      const good = b.dataset.k === keyOf(w);
      if (good) { ok++; sfx.ok(); } else sfx.no();
      b.classList.add(good ? "right" : "wrong");
      toast(good ? t("Richtig: {w}", { w: w.fr }) : t("Es heißt: {w}", { w: w.fr }), 1400);
      if (!good) autoSay(w.fr);
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
      const mission = offlineMission(words);
      const got = earn("move", ok * 2, 15); logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: words.length, ok }); save(true);
      sfx.win(); confetti();
      render(`<div class="wrap narrow"><div class="card result"><div class="result-art">${art("jump")}</div><h1>${t("Super bewegt!")}</h1><p class="muted" style="margin:0">${t("{ok} von {n} Wörtern richtig gesagt.", { ok, n: words.length })}</p><p class="small muted" style="margin:0">${t("Bewegung hilft dem Kopf beim Merken.")}</p>
        <div class="reward-row"><span class="reward">${art("coin", "ic")} +${got}</span></div>${mission.html}<button class="btn green big" id="back">${t("Zur Insel")}</button></div></div>`);
      mission.bind();
      return $("#back").onclick = () => islandView(l);
    }
    const w = words[i], [mv, txt] = MOVES[i % MOVES.length];
    render(`<div class="wrap narrow">
      <div class="ex-top"><button class="icon-btn" id="quit" aria-label="${t("Beenden")}">${ICON.close}</button><b class="ex-title">${t("Bewegungsrunde")}</b>${audioBtn()}<span class="chip">${i + 1} / ${words.length}</span></div>
      <div class="card"><div class="move-art">${art(mv)}</div><h2>${esc(t(txt))}</h2>
        <p style="margin:0">${t("… und sag dabei laut auf Französisch:")}</p>${picBox(w, l)}<div class="word-tr">${esc(w.tr)}</div>
        <div class="row center-row">${micBtn("mic", true)}${speakerBtn("hear")}</div><div id="heard" class="heard"></div>
        <div class="row center-row"><button class="btn ghost" id="show">${t("Lösung zeigen")}</button></div></div></div>`);
    $("#quit").onclick = () => islandView(l);
    let used = false;
    $("#hear").onclick = () => { used = true; sayWord(w.fr); };
    const next = (good) => { countAnswer(S.prog, l, w, good); if (good) ok++; i++; setTimeout(show, good ? 900 : 1600); };
    if ($("#mic")) $("#mic").onclick = async () => {
      const alts = await useMic($("#mic"), $("#heard")); if (!alts) return;
      const good = checkSpoken(alts, w.fr);
      $("#heard").textContent += " " + (good ? t("Super!") : t("Es heißt: {w}", { w: w.fr }));
      good ? sfx.ok() : (sfx.no(), autoSay(w.fr));
      next(good && !used);
    };
    $("#show").onclick = () => {
      autoSay(w.fr);
      $("#show").outerHTML = `<div class="word-fr">${esc(w.fr)}</div><div class="row center-row"><button class="btn green" id="y">${t("Hatte ich richtig")}</button><button class="btn coral" id="n">${t("Noch nicht")}</button></div>`;
      $("#y").onclick = () => next(!used); $("#n").onclick = () => next(false);
    };
  };
  show();
}

// ------------------------------------------------------------------
//  Offline-Mission: eine Aufgabe ohne Bildschirm (Bewegung, Kreide, Abfragen)
// ------------------------------------------------------------------
const OFFLINE = [
  "Lauf einmal um den Tisch und sag bei jeder Runde laut ein Wort: {ws}",
  "Hüpfe bei jeder Silbe von „{w}“ – so lange, bis du es auswendig kannst.",
  "Schreib „{w}“ draußen mit Kreide auf den Boden – oder mit dem Finger in die Luft.",
  "Lass dich zu Hause abfragen: Wie heißt „{tr}“ auf Französisch?",
  "Steh auf einem Bein und buchstabiere „{w}“.",
  "Wirf einen Ball hoch und sag bei jedem Fangen ein Wort: {ws}",
  "Schreib „{w}“ auf einen Zettel und kleb ihn an eine passende Stelle zu Hause.",
];
function offlineMission(words) {
  const ws = shuffle(words.filter(Boolean)).slice(0, 3);
  if (!ws.length) return { html: "", bind() {} };
  const task = t(OFFLINE[Math.floor(Math.random() * OFFLINE.length)], { w: esc(ws[0].fr), tr: esc(ws[0].tr), ws: ws.map(w => `<b>${esc(w.fr)}</b>`).join(", ") });
  return {
    html: `<div class="offline-card"><div class="offline-head">${art("jump", "ic")}<b>${t("Offline-Mission")}</b></div><p>${task}</p><small class="muted">${t("Ohne Bildschirm – Bewegung hilft dem Kopf beim Merken.")}</small><button class="btn ghost" id="offDone">${t("Erledigt!")}</button></div>`,
    bind() {
      const b = $("#offDone"); if (!b) return;
      b.onclick = () => { const c = earn("offline", 3, 6); save(); sfx.coin(); b.disabled = true; b.innerHTML = c ? `${t("Super!")} ${art("coin", "ic")} +${c}` : t("Super!"); };
    },
  };
}

// ------------------------------------------------------------------
//  Meine Vokabeldusche: Wörter selbst aufnehmen und anhören
//  (Aufnahmen bleiben nur im Speicher dieses Geräts und verschwinden beim Verlassen)
// ------------------------------------------------------------------
const playUrl = url => new Promise(r => { const a = new Audio(url); a.onended = r; a.onerror = r; a.play().catch(r); });
function recordShower(l) {
  if (!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder)) {
    modal(`<div class="center stack"><div class="result-art">${art("mascotHead")}</div><h2>${t("Aufnehmen geht hier leider nicht")}</h2><p class="muted" style="margin:0">${t("Dieses Gerät oder dieser Browser erlaubt keine Aufnahmen. Probier die Vokabeldusche zum Zuhören.")}</p><button class="btn green" data-close="ok">${t("OK")}</button></div>`).then(() => islandView(l));
    return;
  }
  const words = [...l.words];
  const recs = new Map();
  let i = 0, stream = null, rec = null, stopTimer = null, paid = false, stop = false;
  const t0 = Date.now();
  const cleanup = () => { stop = true; clearTimeout(stopTimer); try { if (rec?.state === "recording") rec.stop(); } catch {} try { stream?.getTracks().forEach(x => x.stop()); } catch {} stream = null; recs.forEach(u => URL.revokeObjectURL(u)); recs.clear(); window.speechSynthesis?.cancel(); };
  const quit = () => { logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000) }); save(); cleanup(); islandView(l); };
  const top = sub => `<div class="ex-top"><button class="icon-btn" id="quit" aria-label="${t("Beenden")}">${ICON.close}</button><b class="ex-title">${t("Meine Vokabeldusche")}</b>${sub}</div>`;

  async function startRec(btn) {
    try { if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { toast(t("Bitte erlaube das Mikrofon, damit du dich aufnehmen kannst."), 3200); return; }
    const chunks = [], idx = i;
    rec = new MediaRecorder(stream);
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      if (stop) return;
      if (recs.has(idx)) URL.revokeObjectURL(recs.get(idx));
      recs.set(idx, URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || "audio/webm" })));
      if (idx === i) draw();
      playUrl(recs.get(idx));
    };
    rec.start();
    btn.classList.add("recording"); btn.innerHTML = `■ ${t("Stopp")}`;
    stopTimer = setTimeout(() => { if (rec?.state === "recording") rec.stop(); }, 6000);
  }

  function draw() {
    if (i >= words.length) return finale();
    const w = words[i];
    render(`<div class="wrap narrow">${top(`<span class="chip">${i + 1} / ${words.length}</span>`)}
      <div class="card">${picBox(w, l)}<div class="row center-row"><div class="word-fr">${esc(w.fr)}</div>${speakerBtn("hear")}</div><div class="word-tr">${esc(w.tr)}</div>
        <p class="small muted center" style="margin:0">${t("Hör dir das Wort an. Dann nimm dich auf: zuerst Französisch, dann die Übersetzung.")}</p>
        <div class="row center-row"><button class="btn coral" id="rec">● ${t("Aufnehmen")}</button><button class="btn blue" id="play" ${recs.has(i) ? "" : "disabled"}>▶ ${t("Meine Stimme")}</button></div>
        <div class="row center-row"><button class="btn ghost" id="prev" ${i ? "" : "disabled"}>${t("Zurück")}</button><button class="btn green" id="next">${recs.has(i) ? t("Weiter") : t("Überspringen")}</button></div>
      </div>
      <p class="center small muted">${t("Deine Aufnahmen bleiben nur auf diesem Gerät und werden nicht gespeichert.")}</p></div>`);
    $("#quit").onclick = quit;
    $("#hear").onclick = () => sayWord(w.fr);
    $("#rec").onclick = e => { const b = e.currentTarget; if (rec?.state === "recording") { clearTimeout(stopTimer); rec.stop(); } else startRec(b); };
    $("#play").onclick = () => { if (recs.has(i)) playUrl(recs.get(i)); };
    $("#prev").onclick = () => { if (rec?.state === "recording") return; i--; draw(); };
    $("#next").onclick = () => { if (rec?.state === "recording") return; i++; draw(); };
  }

  function finale() {
    const n = recs.size;
    let coins = 0;
    if (!paid && n) { paid = true; coins = earn("rec", n * 2, 12); logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000) }); save(true); sfx.win(); confetti(80); }
    render(`<div class="wrap narrow">${top("")}
      <div class="card result"><div class="result-art">${art("shower")}</div>
        <h1>${n ? tn(n, "Deine Vokabeldusche ist fertig: {n} Wort!", "Deine Vokabeldusche ist fertig: {n} Wörter!") : t("Noch keine Aufnahme")}</h1>
        <p class="muted" style="margin:0">${t("Hör dir deine eigene Stimme an. Klingt sie wie das Original?")}</p>
        <div class="card shower-card" id="card" style="min-height:0"></div>
        ${coins ? `<div class="reward-row"><span class="reward">${art("coin", "ic")} +${coins}</span></div>` : ""}
        <div class="row center-row">${n ? `<button class="btn blue" id="all">▶ ${t("Alles abspielen")}</button>` : ""}<button class="btn ghost" id="again">${t("Neu aufnehmen")}</button><button class="btn green" id="back">${t("Zur Insel")}</button></div>
      </div></div>`);
    $("#quit").onclick = quit; $("#back").onclick = quit;
    $("#again").onclick = () => { i = 0; draw(); };
    if ($("#all")) $("#all").onclick = async () => {
      $("#all").disabled = true;
      const list = [...recs.entries()].sort((a, b) => a[0] - b[0]);
      for (const [k, url] of list) {
        if (stop) return; const card = $("#card"); if (!card) return;
        const w = words[k];
        card.innerHTML = `${picBox(w, l)}<div class="word-fr">${esc(w.fr)}</div><div class="word-tr">${esc(w.tr)}</div>`;
        await playUrl(url); await new Promise(r => setTimeout(r, 900));
      }
      if ($("#all")) $("#all").disabled = false;
    };
  }
  draw();
}

// ------------------------------------------------------------------
//  Test für zu Hause: kleiner Papier-Test zum Ausdrucken (mit Lösungen zum Umknicken)
// ------------------------------------------------------------------
function homeTest(l) {
  const ranked = shuffle(l.words).sort((a, b) => wstate(S.prog, l.id, a.id).b - wstate(S.prog, l.id, b.id).b);
  const ws = shuffle(ranked.slice(0, Math.min(10, ranked.length)));
  const date = new Date().toLocaleDateString(getLang() === "pt" ? "pt-PT" : getLang() === "fr" ? "fr-FR" : "de-DE");
  render(`<div class="wrap narrow">
    <div class="ex-top no-print"><button class="icon-btn" id="quit" aria-label="${t("Beenden")}">${ICON.close}</button><b class="ex-title">${t("Test für zu Hause")}</b></div>
    <div class="panel stack no-print">
      <p style="margin:0">${t("So geht's: Test ausdrucken und die französischen Wörter mit Artikel aufschreiben. Danach das Blatt unten umknicken und mit den Lösungen vergleichen – auf die Rechtschreibung achten!")}</p>
      <div class="row"><button class="btn green" id="print">${t("Drucken")}</button><button class="btn ghost" id="other">${t("Andere Wörter")}</button></div>
    </div>
    <div class="sheet">
      <div class="sheet-head"><b>Plapperlapapp · ${esc(l.title)}</b><span>${t("Name")}: ${esc(S.student?.name || "")}</span><span>${t("Datum")}: ${esc(date)}</span></div>
      <p class="sheet-task">${t("Schreib das französische Wort mit Artikel.")}</p>
      <ol class="sheet-list">${ws.map(w => `<li><span class="q">${esc(w.tr)}</span><span class="line"></span></li>`).join("")}</ol>
      <div class="fold">✂ ${t("Hier umknicken – Lösungen")}</div>
      <ol class="sheet-sol">${ws.map(w => `<li>${esc(w.fr)}</li>`).join("")}</ol>
      <p class="sheet-score">${t("Richtig: ____ von {n}", { n: ws.length })}</p>
    </div></div>`);
  $("#quit").onclick = () => islandView(l);
  $("#other").onclick = () => homeTest(l);
  $("#print").onclick = () => window.print();
}

// ------------------------------------------------------------------
//  Wortnetz: ein bekanntes Kopfwort in der Mitte, neue Wörter drumherum
// ------------------------------------------------------------------
function wordNet(l) {
  if (l.words.length < 3) { toast(t("Für ein Wortnetz braucht die Insel mindestens 3 Wörter.")); return; }
  // Mitte = Thema der Insel (die Lehrkraft hat diese Wörter zusammengestellt → sie gehören zusammen).
  // Bis zu 2 Wörter, die das Kind schon kann, hängen als gelbe Kopfwörter im Netz; die neuen schreibt es dazu.
  const ranked = shuffle(l.words).map(w => ({ w, b: wstate(S.prog, l.id, w.id).b }));
  const knownW = ranked.filter(x => x.b >= 2).slice(0, 2).map(x => x.w);
  const newW = ranked.filter(x => !knownW.includes(x.w)).sort((a, b) => a.b - b.b).slice(0, 6 - knownW.length).map(x => x.w);
  const outer = shuffle([...knownW, ...newW]);
  const solved = new Map(knownW.map(w => [outer.indexOf(w), "known"]));
  const toWrite = outer.length - knownW.length;
  let sel = outer.findIndex((_, k) => !solved.has(k)), tries = 0, ok = 0;
  const t0 = Date.now();
  const pos = k => { const a = (-90 + (k * 360) / outer.length) * Math.PI / 180; return { x: 50 + 37 * Math.cos(a), y: 50 + 37 * Math.sin(a) }; };
  const nextOpen = from => { for (let d = 1; d <= outer.length; d++) { const k = (from + d) % outer.length; if (!solved.has(k)) return k; } return -1; };
  const node = (x, k) => {
    const p = pos(k), px = withDrawing(l, x);
    return `<button class="net-node ${solved.get(k) === "known" ? "known" : solved.has(k) ? "done" : ""} ${k === sel ? "sel" : ""}" data-n="${k}" style="left:${p.x}%;top:${p.y}%">${hasPic(px) ? `<span class="pic">${pic(px)}</span>` : ""}${solved.has(k) ? `<b>${esc(x.fr)}</b>` : `<small>${esc(x.tr)}</small>`}</button>`;
  };

  function draw() {
    const w = outer[sel], done = [...solved.values()].filter(v => v !== "known").length;
    render(`<div class="wrap narrow">
      <div class="ex-top"><button class="icon-btn" id="quit" aria-label="${t("Beenden")}">${ICON.close}</button><b class="ex-title">${t("Wortnetz")}</b>${audioBtn()}<span class="chip">${done} / ${toWrite}</span></div>
      <p class="center muted" style="margin:0">${knownW.length ? t("Alle Wörter gehören zum Thema in der Mitte. Die gelben Kopfwörter kennst du schon – knüpfe die neuen daran!") : t("Alle Wörter gehören zum Thema in der Mitte. Knüpfe sie daran!")}</p>
      <div class="net">
        <svg class="net-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${outer.map((_, k) => { const p = pos(k); return `<line x1="50" y1="50" x2="${p.x}" y2="${p.y}" class="${solved.get(k) === "known" ? "known" : solved.has(k) ? "on" : ""}"/>`; }).join("")}</svg>
        <div class="net-node center" style="left:50%;top:50%"><span class="pic">${l.iconImg ? `<img src="${esc(l.iconImg)}" alt="">` : l.icon ? `<span>${esc(l.icon)}</span>` : art("island")}</span><b>${esc(l.title)}</b><small>${t("Thema")}</small></div>
        ${outer.map(node).join("")}
      </div>
      ${sel >= 0 ? `<div class="card net-ask">
        <b>${t("Wie heißt „{tr}“ auf Französisch?", { tr: esc(w.tr) })}</b>
        <div class="row center-row write-row"><input class="answer" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${t("Französisch schreiben …")}"><button class="btn green" id="chk">${t("Prüfen")}</button></div>
        <div class="row center-row"><button class="btn ghost" id="hint">${t("Tipp")}</button>${speakerBtn("hear")}</div>
        <div id="msg" class="small"></div>
      </div>` : ""}
    </div>`);
    $("#quit").onclick = () => { logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000) }); save(); islandView(l); };
    $$(".net-node[data-n]").forEach(b => b.onclick = () => { const k = +b.dataset.n; if (solved.has(k)) { autoSay(outer[k].fr); return; } sel = k; tries = 0; draw(); });
    if (sel < 0) return;
    const inp = $("#ans"); inp.focus();
    let helped = false;
    $("#hear").onclick = () => { helped = true; sayWord(w.fr); };
    $("#hint").onclick = () => { helped = true; const s = w.fr.split(/\s*\/\s*/)[0]; inp.value = s.slice(0, Math.max(1, Math.ceil(s.length / 3))); inp.focus(); };
    const check = () => {
      const r = checkWritten(inp.value, w.fr);
      if (r === "perfect" || r === "accent") {
        const self = !helped && tries === 0;
        countAnswer(S.prog, l, w, self); if (self) ok++;
        solved.set(sel, self || "help"); sfx.ok(); autoSay(w.fr);
        if (r === "accent") toast(t("Achte auf die Akzente: {w}", { w: w.fr }), 2200);
        if (solved.size === outer.length) { setTimeout(finale, 600); return; }
        sel = nextOpen(sel); tries = 0; setTimeout(draw, 500);
        return;
      }
      tries++; sfx.no();
      if (tries >= 2) {
        if (tries === 2) countAnswer(S.prog, l, w, false);
        $("#msg").innerHTML = `${t("Es heißt: {w}", { w: `<b>${esc(w.fr)}</b>` })} – ${t("Schreib es einmal ab.")}`; autoSay(w.fr);
        helped = true; inp.value = ""; inp.focus();
      } else $("#msg").textContent = r === "article" ? t("Denk an den Artikel!") : r === "almost" ? t("Fast! Schau genau hin.") : t("Noch nicht. Versuch es nochmal!");
    };
    $("#chk").onclick = check;
    inp.onkeydown = e => { if (e.key === "Enter") check(); };
  }

  function finale() {
    const coins = earn("net", Math.max(2, ok * 2), 15);
    logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: toWrite, ok }); save(true);
    sfx.win(); confetti(); sel = -1; draw();
    const mission = offlineMission(outer);
    modal(`<div class="center stack"><div class="result-art">${art("bulbArt")}</div><h2>${t("Dein Wortnetz ist fertig!")}</h2>
      <p class="muted" style="margin:0">${t("{ok} von {n} Wörtern ohne Hilfe geschrieben.", { ok, n: toWrite })}</p>
      <div class="reward-row"><span class="reward">${art("coin", "ic")} +${coins}</span></div>${mission.html}
      <div class="row center-row"><button class="btn blue" data-close="again">${t("Nochmal")}</button><button class="btn green" data-close="ok">${t("Zur Insel")}</button></div></div>`).then(v => (v === "again" ? wordNet(l) : islandView(l)));
    mission.bind();
  }
  draw();
}

// ------------------------------------------------------------------
//  Malen: eigenes Bild zum Wort (doppelte Kodierung)
// ------------------------------------------------------------------
function drawWord(l, w, after) {
  const key = wkey(l.id, w.id);
  const COLS = ["#24323f", "#e03131", "#f08c00", "#ffd43b", "#2fb36a", "#1c7ed6", "#7048e8", "#a0673a"];
  modal(`<h2 class="center">${t("Mal „{w}“", { w: esc(w.fr) })}</h2><p class="center small muted" style="margin:0">${t("{tr} – wer selbst malt, merkt sich das Wort besser.", { tr: esc(w.tr) })}</p>
    <canvas id="cv" width="480" height="480" class="draw-canvas"></canvas>
    <div class="row center-row">${COLS.map((c, i) => `<button class="color-dot ${i ? "" : "on"}" data-c="${c}" style="background:${c}" aria-label="${t("Farbe")}"></button>`).join("")}</div>
    <div class="row center-row"><button class="btn ghost small" id="thin">${t("Dünn")}</button><button class="btn ghost small" id="thick">${t("Dick")}</button><button class="btn ghost small" id="clr">${t("Alles löschen")}</button></div>
    <div class="row center-row"><button class="btn ghost" data-close="">${t("Abbrechen")}</button><button class="btn green" id="ok">${t("Speichern")}</button></div>`, {
    onMount: (m, close) => {
      const cv = m.querySelector("#cv"), x = cv.getContext("2d");
      x.fillStyle = "#fff"; x.fillRect(0, 0, 480, 480); x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = COLS[0]; x.lineWidth = 10;
      const old = S.drawings[key];
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
        const keys = Object.keys(S.drawings);
        if (!S.drawings[key] && keys.length >= 40) delete S.drawings[keys[0]]; // Platz sparen
        S.drawings[key] = small.toDataURL("image/jpeg", 0.7);
        saveDrawings(); earn("draw", 2, 10); save(); sfx.coin(); toast(t("Bild gespeichert! Es erscheint jetzt bei diesem Wort."));
        close("ok"); after && after();
      };
    },
  });
}

// ------------------------------------------------------------------
//  Gemeinsamer Klassenfortschritt (Zusammenhalt statt Rangliste)
// ------------------------------------------------------------------
function classPanel() {
  const g = S.goal;
  if (!g) return "";
  const ci = S.classInfo || { kids: 1, othersWeek: 0, othersToday: 0, othersKnown: 0, othersStars: 0 };
  const meWeek = weekSummary(S.prog).ans > 0 ? 1 : 0;
  const meToday = (S.prog.days?.[todayStr()]?.ans || 0) > 0 ? 1 : 0;
  const myKnown = Object.values(S.prog.words || {}).filter(s => s.b >= 2).length;
  const myStars = S.lessons.reduce((a, l) => a + lessonStats(S.prog, l).stars, 0);
  const gp = Math.min(100, Math.round(g.achieved / Math.max(1, g.target) * 100));
  const left = Math.max(0, g.target - g.achieved);
  const reached = g.achieved >= g.target;
  const myPts = weekDaysPts(S.prog, g.mon);
  const bf = bForms(g.building);
  const msg = reached ? t("Geschafft! {our} ist fertig!", bf) :
    gp >= 75 ? t("Fast fertig! Nur noch {n} Wörter.", { n: left }) :
    gp >= 50 ? t("Mehr als die Hälfte steht! Noch {n} Wörter.", { n: left }) :
    gp >= 25 ? t("Das Fundament steht! Noch {n} Wörter.", { n: left }) :
    t("Noch {n} Wörter bis {tothe}.", { n: left, ...bf });
  return `<div class="panel class-panel ${reached ? "reached" : ""}">
    <div class="row between"><h2 class="cp-title">${esc(t("Unsere Klasse baut: {name}", bf))}</h2><span class="chip">${t("{a} / {b} Wörter", { a: g.achieved, b: g.target })}</span></div>
    <div class="cp-main">
      <div class="cp-build">${buildingSvg(g.building.key, gp)}</div>
      <div class="stack" style="gap:10px;min-width:0">
        <div class="goal-track"><div class="goal-bar big"><i style="width:${gp}%"></i></div>
          <div class="milestones">${[25, 50, 75, 100].map(st => `<span class="ms ${gp >= st ? "on" : ""}" style="left:${st}%">${art(gp >= st ? "star" : "starEmpty")}</span>`).join("")}</div></div>
        <p class="cp-msg">${esc(msg)}</p>
        ${reached ? `<button class="btn orange" id="wheelBtn">${esc(t("Unsere Belohnung: {r}", { r: t(g.rewards[g.rewardIdx]) }))}</button>` : `<span class="small muted">${esc(t("Wenn {the} fertig ist, dreht sich das Glücksrad für eine Klassenbelohnung!", bf))}</span>`}
      </div>
    </div>
    <div class="cp-stats">
      <div><b>${ci.othersWeek + meWeek} / ${ci.kids}</b><span>${t("Kinder haben diese Woche geübt")}</span></div>
      <div><b>${ci.othersToday + meToday}</b><span>${t(ci.othersToday + meToday === 1 ? "Kind hat heute schon geübt" : "Kinder haben heute schon geübt")}</span></div>
      <div><b>${ci.othersKnown + myKnown}</b><span>${t("Wörter kennt ihr zusammen")}</span></div>
      <div><b>${g.built.length}</b><span>${t(g.built.length === 1 ? "Bauwerk steht schon auf der Klassen-Insel" : "Bauwerke stehen schon auf der Klassen-Insel")}</span></div>
    </div>
    ${g.built.length ? `<div class="class-isle"><b>${t("Unsere Klassen-Insel")}</b><div class="built">${g.built.map(b => `<div class="built-item" title="${esc(bForms(b).name)} – ${esc(t(b.reward))}">${buildingSvg(b.key, 100, "small")}<small>${esc(bForms(b).name)}</small></div>`).join("")}</div></div>` : ""}
    <span class="small muted">${tn(myPts, "So zählt es: Ein Wort hilft der Klasse, wenn du es <b>3× richtig geschrieben</b> hast. Dein Beitrag diese Woche: <b>{n}</b> Wort – jedes Kind schafft mindestens 7!", "So zählt es: Ein Wort hilft der Klasse, wenn du es <b>3× richtig geschrieben</b> hast. Dein Beitrag diese Woche: <b>{n}</b> Wörter – jedes Kind schafft mindestens 7!")}</span>
  </div>`;
}
function weekDaysPts(p, mon) {
  const a = new Date(mon + "T12:00").getTime(); let s = 0;
  for (let i = 0; i < 7; i++) s += p.days?.[todayStr(new Date(a + i * DAY))]?.wp || 0;
  return s;
}

// Ziel erreicht → einmal pro Kind feiern + Glücksrad
function maybeCelebrate() {
  const g = S.goal;
  if (!g || g.achieved < g.target) return;
  S.prog.celebrated = S.prog.celebrated || {};
  if (S.prog.celebrated[g.mon]) return;
  S.prog.celebrated[g.mon] = true;
  S.prog.classWins = (S.prog.classWins || 0) + 1;
  S.prog.coins += 10;
  checkBadges(S.prog, S.lessons); save(true);
  sfx.win(); confetti(220);
  setTimeout(() => showWheel(true), 600);
}

// Glücksrad: Ergebnis steht fest (für alle Kinder gleich), Nadel stoppt mittig im Feld
function showWheel(first) {
  const g = S.goal, R = g.rewards, n = R.length, idx = g.rewardIdx, seg = 360 / n;
  const cols = ["#ff8a3d", "#2fb36a", "#2b9ad1", "#ffc531", "#d6336c", "#7048e8", "#20c997", "#f76707", "#1c7ed6", "#e64980", "#82c91e", "#845ef7"];
  const cx = 160, cy = 160, r = 150;
  const pt = (a, rr = r) => [cx + rr * Math.sin(a * Math.PI / 180), cy - rr * Math.cos(a * Math.PI / 180)];
  const slices = R.map((txt0, i) => {
    const txt = t(txt0);
    const a0 = i * seg, a1 = (i + 1) * seg, [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    const mid = a0 + seg / 2, [tx, ty] = pt(mid, r * 0.6);
    const short = txt.length > 18 ? txt.slice(0, 17) + "…" : txt;
    return `<path d="M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z" fill="${cols[i % cols.length]}" stroke="#fff" stroke-width="3"/>
      <text x="${tx}" y="${ty}" transform="rotate(${mid - 90} ${tx} ${ty})" text-anchor="middle" dominant-baseline="central" font-size="10.5" font-weight="700" fill="#fff" font-family="Andika, sans-serif">${esc(short)}</text>`;
  }).join("");
  // Feld idx soll oben (unter der Nadel) mittig stehen
  const final = 360 * 6 - (idx * seg + seg / 2);
  modal(`<div class="center stack">
    <h2>${first ? esc(t("Geschafft! {our} ist fertig!", bForms(g.building))) : t("Unser Glücksrad")}</h2>
    <p class="muted" style="margin:0">${t(first ? "Die ganze Klasse hat zusammen das Ziel erreicht. Das Glücksrad entscheidet die Belohnung:" : "Das Rad bleibt bei allen Kindern auf demselben Feld stehen.")}</p>
    <div class="wheel-wrap">
      <svg viewBox="0 0 320 320" class="wheel" id="wheel" style="transform:rotate(${first ? 0 : final}deg)">${slices}<circle cx="160" cy="160" r="22" fill="#fff" stroke="#24323f" stroke-width="4"/></svg>
      <svg viewBox="0 0 40 50" class="needle"><path d="M20 48 L4 8 Q20 -4 36 8Z" fill="#e03131" stroke="#24323f" stroke-width="3" stroke-linejoin="round"/></svg>
    </div>
    <div class="reward-result" id="rr" ${first ? "hidden" : ""}>${art("trophy", "ic")} <b>${esc(t(R[idx]))}</b></div>
    ${first ? `<div class="reward-row"><span class="reward">${art("coin", "ic")} +10</span><span class="reward">${art("medal", "ic")} ${t("Klassen-Baumeister")}</span></div>` : ""}
    <p class="small muted" style="margin:0">${t("Die Lehrkraft sucht einen passenden Moment für die Belohnung aus.")}</p>
    <button class="btn green" data-close="ok">${t("Super!")}</button></div>`, {
    onMount: m => {
      if (!first) return;
      const w = m.querySelector("#wheel");
      requestAnimationFrame(() => { w.style.transition = "transform 5.5s cubic-bezier(.12,.75,.18,1)"; w.style.transform = `rotate(${final}deg)`; });
      setTimeout(() => { m.querySelector("#rr").hidden = false; sfx.win(); confetti(120); }, 5700);
    },
  });
}

