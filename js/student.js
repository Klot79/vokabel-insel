import { Store, Device } from "./store.js";
import { esc, pinHash, PIN_EMOJI, LANG_FLAG } from "./util.js";
import { render, $, $$, toast, modal, pic, hasPic, avatarHtml, sfx, confetti } from "./ui.js";
import { say, listen, canListen } from "./speech.js";
import {
  emptyProgress, grade, lessonStats, overallStats, unlockedLessons, buildMission, buildLessonPractice,
  checkWritten, checkSpoken, logActivity, currentStreak, weekSummary, checkBadges, BADGES, wstate, shuffle,
  stripArticle, todayStr, DAY,
} from "./srs.js";

const S = { cls: null, student: null, prog: null, lessons: [], classWeekOk: 0 };
let goHome = () => {};

// ------------------------------------------------------------------
//  Anmeldung
// ------------------------------------------------------------------
export async function studentLogin(cls, back) {
  S.cls = cls;
  render(`<div class="wrap narrow"><div class="panel center">Lade Klasse …</div></div>`);
  let students = [], progs = [];
  try { [students, progs] = await Promise.all([Store.list("student"), Store.list("progress")]); }
  catch (e) { render(`<div class="wrap narrow"><div class="panel">${esc(e.message)}</div></div>`); return; }
  const pmap = Object.fromEntries(progs.map(p => [p.id, p]));
  students.sort((a, b) => a.name.localeCompare(b.name, "de"));
  render(`<div class="wrap narrow">
    <div class="row between"><button class="icon-btn" id="back" aria-label="Zurück">⬅️</button>
      <span class="chip">${esc(cls.name || Store.code)}</span></div>
    <div class="hero"><h1>Wer bist du?</h1><p>Tippe auf deinen Namen.</p></div>
    <div class="kid-grid">${students.map(s => `<button class="kid-btn" data-id="${esc(s.id)}">${avatarHtml(pmap[s.id]?.avatar)}<span>${esc(s.name)}</span></button>`).join("") ||
      `<div class="panel">Noch keine Kinder in dieser Klasse. Die Lehrkraft kann sie im Lehrerbereich anlegen.</div>`}</div>
  </div>`);
  $("#back").onclick = back;
  $$(".kid-btn").forEach(b => b.onclick = () => pinScreen(students.find(s => s.id === b.dataset.id), pmap[b.dataset.id], cls, back));
}

function pinScreen(student, prog, cls, back) {
  let pin = [];
  render(`<div class="wrap narrow">
    <div class="row"><button class="icon-btn" id="back" aria-label="Zurück">⬅️</button></div>
    <div class="panel center stack">
      <div style="justify-self:center">${avatarHtml(prog?.avatar, "lg")}</div>
      <h2>Hallo ${esc(student.name)}!</h2>
      <p class="muted" style="margin:0">Tippe deine 3 Geheim-Bilder.</p>
      <div class="pin-dots" id="dots"></div>
      <div class="pin-pad">${PIN_EMOJI.map(e => `<button data-e="${e}" aria-label="${e}">${e}</button>`).join("")}</div>
      <button class="btn ghost small" id="del" style="justify-self:center">⌫ Löschen</button>
    </div></div>`);
  $("#back").onclick = () => studentLogin(cls, back);
  const dots = () => $("#dots").innerHTML = [0, 1, 2].map(i => `<span>${pin[i] || ""}</span>`).join("");
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
  delete S.prog.id; delete S.prog._updated;
  S.lessons = lessons
    .filter(l => l.words?.length && (l.assigned === "all" || !l.assigned || (Array.isArray(l.assigned) && l.assigned.includes(student.id))))
    .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.created || 0) - (b.created || 0));
  S.classWeekOk = all.reduce((sum, p) => sum + weekSummary(p.id === student.id ? S.prog : { days: p.days || {} }).ok, 0);
  if (!all.find(p => p.id === student.id)) S.classWeekOk += 0;
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
//  Startseite mit Weltkarte
// ------------------------------------------------------------------
function topbar() {
  const st = currentStreak(S.prog);
  return `<div class="topbar">
    ${avatarHtml(S.prog.avatar, "sm")}
    <span class="name">${esc(S.student.name)}</span>
    <span class="chip fire" title="Tage hintereinander geübt">🔥 ${st}</span>
    <span class="chip" title="Münzen">🪙 ${S.prog.coins}</span>
    <button class="icon-btn" id="tb-home" aria-label="Weltkarte">🗺️</button>
    <button class="icon-btn" id="tb-me" aria-label="Mein Fortschritt">📈</button>
    <button class="icon-btn" id="tb-shop" aria-label="Shop">🛍️</button>
    <button class="icon-btn" id="tb-out" aria-label="Abmelden">🚪</button>
  </div>`;
}
function bindTop(back) {
  $("#tb-home").onclick = () => home(back);
  $("#tb-me").onclick = () => myProgress(back);
  $("#tb-shop").onclick = () => shop(back);
  $("#tb-out").onclick = async () => { await save(true); back(); };
}

function home(back) {
  const unlocked = unlockedLessons(S.prog, S.lessons, S.cls.allOpen);
  const mission = buildMission(S.prog, unlocked, { pref: S.prog.pref, canSpeak: canListen });
  const doneToday = S.prog.missionDay === todayStr();
  const goal = S.cls.goal || { title: "Leuchtturm bauen", target: 400 };
  const gp = Math.min(100, Math.round((S.classWeekOk / Math.max(1, goal.target)) * 100));
  const o = overallStats(S.prog, S.lessons);
  const cur = unlocked.find(l => lessonStats(S.prog, l).stars < 3) || unlocked[unlocked.length - 1];
  const greet = encouragement(o);

  render(`<div class="wrap">
    ${topbar()}
    <div class="panel mission">
      <span class="big-em">${doneToday && !mission.length ? "🏆" : "🧭"}</span>
      <div class="stack" style="gap:4px">
        <h2>${doneToday ? "Mission geschafft!" : "Deine Mission heute"}</h2>
        <span class="muted">${mission.length ? `${new Set(mission.map(t => t.w.id + t.l.id)).size} Wörter · ca. ${Math.max(3, Math.round(mission.length * 0.45))} Minuten` : "Alles wiederholt! Spiel auf den Inseln weiter."}</span>
        <span class="small">${esc(greet)}</span>
      </div>
      ${mission.length ? `<button class="btn big green" id="go">${doneToday ? "Nochmal" : "Los geht's"} ▶</button>` : ""}
    </div>
    <div class="panel stack" style="gap:8px">
      <div class="row between"><b>🏗️ Klassenziel: ${esc(goal.title)}</b><span class="small muted">${S.classWeekOk} / ${goal.target} richtige Antworten diese Woche</span></div>
      <div class="goal-bar"><i style="width:${gp}%"></i></div>
      <span class="small muted">Jede richtige Antwort hilft der ganzen Klasse.</span>
    </div>
    <div class="map" id="map">
      <svg class="route" id="route" aria-hidden="true"></svg>
      <div class="islands">${S.lessons.length ? S.lessons.map(l => {
        const st = lessonStats(S.prog, l);
        const open = unlocked.includes(l);
        return `<button class="island ${open ? "" : "locked"}" data-id="${esc(l.id)}" aria-label="${esc(l.title)}${open ? "" : " (gesperrt)"}">
          ${l === cur ? `<span class="ship" style="left:-6px;top:10px">⛵</span>` : ""}
          <span class="land">${l.iconImg ? `<img src="${esc(l.iconImg)}" alt="" loading="lazy">` : esc(l.icon || "🏝️")}</span>
          ${open ? "" : `<span class="lock">🔒</span>`}
          ${open && st.due ? `<span class="due">${st.due} 🔁</span>` : ""}
          <span class="label">${esc(l.title)} ${LANG_FLAG[l.lang] || ""}</span>
          <span class="stars">${"⭐".repeat(st.stars)}${"☆".repeat(3 - st.stars)}</span>
        </button>`;
      }).join("") : `<div class="panel center">Deine Lehrkraft hat noch keine Lektion für dich freigegeben.</div>`}</div>
    </div>
  </div>`);
  bindTop(back);
  $("#go") && ($("#go").onclick = () => startMission(unlocked));
  $$(".island").forEach(b => b.onclick = () => {
    const l = S.lessons.find(x => x.id === b.dataset.id);
    if (b.classList.contains("locked")) { sfx.no(); toast("Hol dir zuerst einen ⭐ auf der Insel davor!"); return; }
    islandView(l, back);
  });
  drawRoute();
}

function drawRoute() {
  const map = $("#map"), svg = $("#route");
  if (!map || !svg) return;
  const mr = map.getBoundingClientRect();
  const pts = $$(".land", map).map(el => { const r = el.getBoundingClientRect(); return [r.left - mr.left + r.width / 2, r.top - mr.top + r.height / 2]; });
  if (pts.length < 2) return;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    d += ` C${x0},${(y0 + y1) / 2} ${x1},${(y0 + y1) / 2} ${x1},${y1}`;
  }
  svg.setAttribute("viewBox", `0 0 ${mr.width} ${mr.height}`);
  svg.innerHTML = `<path d="${d}" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="5" stroke-dasharray="2 14" stroke-linecap="round"/>`;
}

function encouragement(o) {
  const st = currentStreak(S.prog);
  if (st >= 3) return `Super, schon ${st} Tage hintereinander! Bleib dran.`;
  if (o.known >= 10) return `Du kannst schon ${o.known} Wörter. Toll!`;
  if (o.known > 0) return `Schon ${o.known} Wörter gelernt. Jeden Tag ein bisschen hilft am meisten.`;
  return "Ein paar Minuten jeden Tag – so lernt dein Kopf am besten.";
}

async function startMission(unlocked) {
  const choice = await modal(`<h2 class="center">Wie möchtest du heute üben?</h2>
    <div class="acts">
      <button class="act" data-close="mix"><span class="em">🎲</span><b>Gemischt</b><small>von allem etwas</small></button>
      <button class="act" data-close="write"><span class="em">✍️</span><b>Schreiben</b></button>
      ${canListen ? `<button class="act" data-close="speak"><span class="em">🎤</span><b>Sprechen</b></button>` : ""}
    </div>`);
  if (!choice) return;
  S.prog.pref = choice;
  const tasks = buildMission(S.prog, unlocked, { pref: choice, canSpeak: canListen });
  runSession(tasks, { title: "Mission", mission: true });
}

// ------------------------------------------------------------------
//  Insel
// ------------------------------------------------------------------
function islandView(l, back) {
  const st = lessonStats(S.prog, l);
  const acts = [
    ["discover", "👀", "Entdecken", "Bild, Wort & Ton"],
    ["mc_fr2tr", "🧩", "Quiz", "Was bedeutet das?"],
    ["listen", "👂", "Hören", "Welches Bild passt?"],
    ["write", "✍️", "Schreiben", "Schreib das Wort"],
    ["speak", "🎤", "Sprechen", canListen ? "Sag das Wort" : "Sag es laut"],
    ["scramble", "🔤", "Buchstabensalat", "Ordne die Buchstaben"],
    ["memory", "🃏", "Memory", "Finde die Paare"],
    ["blitz", "⚡", "Blitzrunde", "60 Sekunden"],
  ];
  render(`<div class="wrap">
    ${topbar()}
    <div class="panel stack">
      <div class="row">${l.iconImg ? `<span class="wpic" style="width:72px;height:72px"><img src="${esc(l.iconImg)}" alt=""></span>` : `<span style="font-size:3rem">${esc(l.icon || "🏝️")}</span>`}
        <div class="stack" style="gap:2px;margin-right:auto"><h2 style="font-size:1.8rem">${esc(l.title)}</h2>
        <span class="muted">${st.total} Wörter · Français → ${LANG_FLAG[l.lang] || ""}</span></div>
        <span style="font-size:2rem">${"⭐".repeat(st.stars)}${"☆".repeat(3 - st.stars)}</span></div>
      <div class="stack" style="gap:6px">
        <div class="row between small"><span>Sicher gelernt: <b>${st.known}</b> / ${st.total}</span><span>Gemeistert: <b>${st.master}</b></span></div>
        <div class="bar"><i style="width:${Math.round(st.known / Math.max(1, st.total) * 100)}%"></i></div>
      </div>
      <div class="small muted">${starHint(st)}</div>
    </div>
    <div class="acts">${acts.map(([k, em, n, d]) => `<button class="act" data-k="${k}"><span class="em">${em}</span><b>${n}</b><small>${d}</small></button>`).join("")}</div>
  </div>`);
  bindTop(back);
  $$(".act").forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (k === "memory") return memoryGame(l);
    if (k === "blitz") return blitz(l);
    let tasks = buildLessonPractice(S.prog, l, k === "discover" ? "discover" : k, 10);
    if (k === "listen" && !l.words.every(hasPic)) tasks = tasks.map(t => ({ ...t, type: "listen" }));
    runSession(tasks, { title: l.title, lesson: l });
  });
}

function starHint(st) {
  if (st.stars === 0) return "⭐ 1: Entdecke alle Wörter einmal.";
  if (st.stars === 1) return "⭐ 2: Lerne 8 von 10 Wörtern sicher (Schreiben oder Sprechen).";
  if (st.stars === 2) return "⭐ 3: Wiederhole an verschiedenen Tagen – dann bleiben die Wörter für immer!";
  return "Du bist Insel-Meister! Wiederhole ab und zu, damit es so bleibt.";
}

// ------------------------------------------------------------------
//  Übungs-Motor
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

function runSession(tasks, opts) {
  if (!tasks.length) { toast("Hier gibt es gerade nichts zu üben."); return goHome(); }
  const state = { q: [...tasks], i: 0, ok: 0, ans: 0, coins: 0, combo: 0, t0: Date.now(), retried: new Set(), starsBefore: Object.fromEntries(S.lessons.map(l => [l.id, lessonStats(S.prog, l).stars])) };

  const next = () => {
    state.i++;
    if (state.i >= state.q.length) return finish();
    show();
  };

  const answered = (task, correct, kind, extra = {}) => {
    if (kind !== "intro") { state.ans++; if (correct) { state.ok++; state.combo++; } else state.combo = 0; }
    grade(S.prog, task.l.id, task.w.id, correct, kind);
    if (correct && kind !== "intro") {
      const c = 1 + (state.combo >= 3 ? 1 : 0) - (extra.hint ? 1 : 0);
      if (c > 0) { state.coins += c; sfx.coin(); }
      if (task.type === "speak") S.prog.spoken++;
      if (task.type === "write" || task.type === "scramble") S.prog.typed++;
    }
    if (!correct && kind !== "intro") {
      const key = task.l.id + task.w.id;
      if (!state.retried.has(key)) {
        state.retried.add(key);
        const again = { ...task, type: kind === "recall" ? task.type : "mc_pic2fr" };
        state.q.splice(Math.min(state.q.length, state.i + 3), 0, again);
      }
    }
    save();
  };

  const finish = () => {
    const sec = Math.round((Date.now() - state.t0) / 1000);
    logActivity(S.prog, { sec, ans: state.ans, ok: state.ok });
    const bonus = state.ans >= 5 ? 5 : 0;
    S.prog.coins += state.coins + bonus;
    S.prog.xp += state.ok * 10;
    S.classWeekOk += state.ok;
    if (opts.mission) S.prog.missionDay = todayStr();
    const newStars = S.lessons.filter(l => lessonStats(S.prog, l).stars > (state.starsBefore[l.id] || 0));
    const badges = checkBadges(S.prog, S.lessons);
    save(true);
    const pct = state.ans ? Math.round(state.ok / state.ans * 100) : 100;
    sfx.win(); confetti(newStars.length || badges.length ? 200 : 90);
    render(`<div class="wrap narrow"><div class="card">
      <div class="result-big">${pct >= 90 ? "🏆" : pct >= 60 ? "🌟" : "💪"}</div>
      <h2 style="font-size:2rem">${pct >= 90 ? "Fantastisch!" : pct >= 60 ? "Gut gemacht!" : "Super, dass du geübt hast!"}</h2>
      <p class="muted" style="margin:0">${state.ans ? `${state.ok} von ${state.ans} richtig.` : "Du hast neue Wörter entdeckt."} ${pct < 60 ? "Fehler sind beim Lernen ganz normal – die Wörter kommen bald wieder." : ""}</p>
      <div class="reward-row"><span class="reward">🪙 +${state.coins + bonus}</span><span class="reward">🔥 ${currentStreak(S.prog)} ${currentStreak(S.prog) === 1 ? "Tag" : "Tage"}</span></div>
      ${newStars.map(l => `<div class="feedback ok">⭐ Neuer Stern auf „${esc(l.title)}“!</div>`).join("")}
      ${badges.map(b => `<div class="feedback ok">${b.icon} Neues Abzeichen: ${esc(b.name)}</div>`).join("")}
      <button class="btn big green" id="done">Weiter ➜</button>
    </div></div>`);
    $("#done").onclick = () => opts.lesson ? islandView(opts.lesson, () => goHome()) : goHome();
  };

  const frame = inner => render(`<div class="wrap narrow">
    <div class="ex-top"><button class="icon-btn" id="quit" aria-label="Beenden">✖️</button>
      <div class="ex-progress"><i style="width:${Math.round(state.i / state.q.length * 100)}%"></i></div>
      <span class="chip">🪙 ${state.coins}</span></div>
    <div class="card" id="card">${inner}</div></div>`);

  const bindQuit = () => $("#quit").onclick = () => { if (state.ans || state.i) finish(); else goHome(); };

  function feedback(ok, task, msg = "") {
    const fb = document.createElement("div");
    fb.className = `feedback ${ok ? "ok" : "no"}`;
    fb.innerHTML = ok
      ? `<span>${["Richtig! 🎉", "Super! ⭐", "Genau! 👍", "Klasse! 🙌"][Math.floor(Math.random() * 4)]} ${esc(msg)}</span>`
      : `<span>${esc(msg || "Nicht ganz. So heißt es:")}</span><span class="sol">${esc(task.w.fr)}</span>`;
    const btn = document.createElement("button");
    btn.className = "btn green"; btn.textContent = "Weiter ➜"; btn.onclick = next;
    fb.appendChild(btn);
    $("#card").appendChild(fb);
    ok ? sfx.ok() : sfx.no();
    if (!ok || msg) say(task.w.fr, "fr");
    btn.focus();
  }

  function show() {
    const task = state.q[state.i];
    const { w, l } = task;
    const speakerBtn = `<button class="speak-btn" id="hear" aria-label="Anhören">🔊</button>`;
    const bindHear = () => { const b = $("#hear"); if (b) b.onclick = () => say(w.fr, "fr"); };

    if (task.type === "intro") {
      frame(`<span class="task-q">Neues Wort ✨</span>
        <div class="prompt-pic">${pic(w)}</div>
        <div class="word-fr">${esc(w.fr)}</div>
        ${speakerBtn}
        <div class="word-tr">${LANG_FLAG[l.lang] || ""} ${esc(w.tr)}</div>
        ${w.ex ? `<div class="small muted">„${esc(w.ex)}“</div>` : ""}
        <div class="row" style="justify-content:center">
          ${canListen ? `<button class="btn blue" id="repeat">🎤 Nachsprechen</button>` : `<span class="small muted">Sprich das Wort laut nach!</span>`}
          <button class="btn green" id="nxt">Weiter ➜</button></div>
        <div id="heard" class="small muted"></div>`);
      bindQuit(); bindHear(); say(w.fr, "fr");
      if ($("#repeat")) $("#repeat").onclick = async () => {
        const b = $("#repeat"); b.disabled = true; b.textContent = "🎤 Ich höre …";
        const r = await listen("fr");
        b.disabled = false; b.textContent = "🎤 Nachsprechen";
        const ok = checkSpoken(r.alts, w.fr);
        $("#heard").textContent = ok ? "Toll ausgesprochen! 🎉" : r.alts.length ? `Ich habe „${r.alts[0]}“ gehört. Hör nochmal hin und versuch es nochmal.` : "Ich habe nichts gehört. Sprich etwas lauter.";
        ok ? sfx.ok() : null;
      };
      $("#nxt").onclick = () => { answered(task, true, "intro"); next(); };
      return;
    }

    if (task.type === "mc_fr2tr" || task.type === "mc_pic2fr" || task.type === "listen") {
      const field = task.type === "mc_pic2fr" ? "fr" : "tr";
      const opts = shuffle([{ l, w }, ...distractors(task, 3, field)]);
      const usePics = task.type === "listen" && opts.every(o => hasPic(o.w));
      let head;
      if (task.type === "mc_fr2tr") head = `<span class="task-q">Was bedeutet das?</span><div class="word-fr">${esc(w.fr)}</div>${speakerBtn}`;
      else if (task.type === "mc_pic2fr") head = `<span class="task-q">Wie heißt das auf Französisch?</span>${hasPic(w) ? `<div class="prompt-pic">${pic(w)}</div>` : ""}<div class="word-tr">${esc(w.tr)}</div>`;
      else head = `<span class="task-q">Hör gut zu! Was passt?</span>${speakerBtn}`;
      frame(`${head}<div class="choices">${opts.map((o, i) => `<button class="choice" data-i="${i}">${usePics ? `<span class="pic">${pic(o.w)}</span>` : esc(o.w[field])}</button>`).join("")}</div>`);
      bindQuit(); bindHear();
      if (task.type !== "mc_pic2fr") say(w.fr, "fr");
      let done = false;
      $$(".choice").forEach(b => b.onclick = () => {
        const o = opts[+b.dataset.i];
        if (field === "fr") say(o.w.fr, "fr");
        if (done) return; done = true;
        const ok = o.w === w;
        b.classList.add(ok ? "right" : "wrong");
        if (!ok) $$(".choice").find(x => opts[+x.dataset.i].w === w)?.classList.add("right");
        answered(task, ok, "recog");
        if (ok) { sfx.ok(); setTimeout(next, field === "fr" ? 1200 : 800); }
        else feedback(false, task);
      });
      return;
    }

    if (task.type === "write") {
      let hints = 0;
      frame(`<span class="task-q">Schreib das Wort auf Französisch</span>
        ${hasPic(w) ? `<div class="prompt-pic">${pic(w)}</div>` : ""}
        <div class="word-tr">${esc(w.tr)}</div>
        <input class="input write-in" id="inp" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Antwort">
        <div class="accents">${["é", "è", "ê", "à", "ç", "ô", "î", "û", "ë", "œ", "'"].map(c => `<button data-c="${c}">${c}</button>`).join("")}</div>
        <div class="row" style="justify-content:center"><button class="btn ghost" id="hint">💡 Tipp</button><button class="btn green" id="chk">Prüfen ✔</button></div>`);
      bindQuit();
      const inp = $("#inp"); inp.focus();
      $$(".accents button").forEach(b => b.onclick = () => { const p = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, p) + b.dataset.c + inp.value.slice(inp.selectionEnd ?? p); inp.focus(); inp.setSelectionRange(p + 1, p + 1); });
      $("#hint").onclick = () => { hints++; const target = w.fr.split(/\s*\/\s*/)[0]; inp.value = target.slice(0, Math.min(target.length - 1, hints * Math.max(1, Math.ceil(target.length / 4)))); inp.focus(); };
      let tries = 0;
      const check = () => {
        const r = checkWritten(inp.value, w.fr);
        if (r === "almost" && tries === 0) { tries++; sfx.no(); toast("Fast! Schau nochmal genau hin. 🔍"); inp.focus(); return; }
        $("#chk").disabled = true; $("#hint").disabled = true; inp.disabled = true;
        const ok = r === "perfect" || r === "accent" || r === "article";
        answered(task, ok, "recall", { hint: hints > 0 });
        feedback(ok, task, r === "accent" ? `Achte auf die Akzente: ${w.fr}` : r === "article" ? `Denk an den Artikel: ${w.fr}` : "");
      };
      $("#chk").onclick = check;
      inp.onkeydown = e => { if (e.key === "Enter" && !$("#chk").disabled) check(); };
      return;
    }

    if (task.type === "speak") {
      frame(`<span class="task-q">${canListen ? "Sag das Wort auf Französisch" : "Sag das Wort laut auf Französisch"}</span>
        ${hasPic(w) ? `<div class="prompt-pic">${pic(w)}</div>` : ""}
        <div class="word-tr">${esc(w.tr)}</div>
        ${canListen ? `<button class="mic" id="mic" aria-label="Sprechen">🎤</button><div id="heard" class="muted">Tippe aufs Mikrofon und sprich.</div>`
          : `<button class="btn blue" id="reveal">Lösung zeigen 👀</button>`}`);
      bindQuit();
      if (!canListen) {
        $("#reveal").onclick = () => {
          say(w.fr, "fr");
          $("#reveal").outerHTML = `<div class="word-fr">${esc(w.fr)}</div><div class="row" style="justify-content:center">
            <button class="btn green" id="self-ok">👍 Hatte ich richtig</button><button class="btn coral" id="self-no">👎 Noch nicht</button></div>`;
          $("#self-ok").onclick = () => { answered(task, true, "recall"); sfx.ok(); next(); };
          $("#self-no").onclick = () => { answered(task, false, "recall"); next(); };
        };
        return;
      }
      let tries = 0;
      $("#mic").onclick = async () => {
        const m = $("#mic"); if (m.classList.contains("on")) return;
        m.classList.add("on"); $("#heard").textContent = "Ich höre zu …";
        const r = await listen("fr", { onInterim: t => { const h = $("#heard"); if (h) h.textContent = `„${t}“`; } });
        m.classList.remove("on");
        if (r.error === "not-allowed" || r.error === "service-not-allowed") {
          $("#heard").textContent = "Das Mikrofon ist nicht erlaubt. Bitte die Lehrkraft, es in den Einstellungen freizugeben.";
          return;
        }
        const ok = checkSpoken(r.alts, w.fr);
        tries++;
        if (ok) { m.disabled = true; answered(task, true, "recall"); feedback(true, task); return; }
        if (tries < 2) { sfx.no(); $("#heard").innerHTML = r.alts.length ? `Ich habe „${esc(r.alts[0])}“ gehört. Versuch es nochmal!` : "Ich habe nichts gehört. Sprich deutlich ins Mikrofon."; return; }
        m.disabled = true; answered(task, false, "recall"); feedback(false, task, "Hör gut zu und sprich es nach:");
      };
      return;
    }

    if (task.type === "scramble") {
      const full = w.fr.split(/\s*\/\s*/)[0];
      const core = stripArticle(full.toLowerCase()) === full.toLowerCase() ? full : full.slice(full.length - stripArticle(full.toLowerCase()).length);
      const art = full.slice(0, full.length - core.length);
      const letters = [...core].filter(c => c !== " ");
      let order = shuffle(letters.map((c, i) => ({ c, i })));
      if (order.map(o => o.c).join("") === letters.join("") && letters.length > 1) order.reverse();
      const placed = [];
      frame(`<span class="task-q">Ordne die Buchstaben</span>
        ${hasPic(w) ? `<div class="prompt-pic">${pic(w)}</div>` : ""}
        <div class="word-tr">${esc(w.tr)}</div>
        <div class="row" style="justify-content:center;gap:6px">${art ? `<span class="word-fr" style="font-size:1.6rem">${esc(art.trim())}</span>` : ""}<div class="slots" id="slots"></div></div>
        <div class="tiles" id="tiles"></div>`);
      bindQuit();
      const draw = () => {
        $("#slots").innerHTML = placed.map((o, k) => `<button class="tile" data-k="${k}">${esc(o.c)}</button>`).join("") || `<span class="muted" style="align-self:center">tippe die Buchstaben</span>`;
        $("#tiles").innerHTML = order.map((o, k) => `<button class="tile ${placed.includes(o) ? "used" : ""}" data-k="${k}">${esc(o.c)}</button>`).join("");
        $$("#tiles .tile").forEach(b => b.onclick = () => { const o = order[+b.dataset.k]; if (placed.includes(o)) return; placed.push(o); sfx.tap(); draw(); if (placed.length === letters.length) done(); });
        $$("#slots .tile").forEach(b => b.onclick = () => { placed.splice(+b.dataset.k, 1); draw(); });
      };
      let tries = 0;
      const done = () => {
        const ok = placed.map(o => o.c).join("").toLowerCase() === letters.join("").toLowerCase();
        if (!ok && tries === 0) { tries++; sfx.no(); toast("Noch nicht ganz – tippe einen Buchstaben oben an, um ihn zurückzulegen."); return; }
        $$(".tile").forEach(t => t.disabled = true);
        answered(task, ok, "recall");
        feedback(ok, task);
      };
      draw();
      return;
    }
  }

  show();
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
    <div class="ex-top"><button class="icon-btn" id="quit" aria-label="Beenden">✖️</button><b style="color:#fff;font-family:var(--f-display);font-size:1.4rem;flex:1">🃏 Memory – ${esc(l.title)}</b><span class="chip" id="mv">Züge: 0</span></div>
    <div class="memory" id="mem">${cards.map((c, i) => `<button class="mem" data-i="${i}" aria-label="Karte ${i + 1}">❓</button>`).join("")}</div></div>`);
  $("#quit").onclick = () => islandView(l, goHome);
  $$(".mem").forEach(b => b.onclick = () => {
    const c = cards[+b.dataset.i];
    if (lock || b.classList.contains("open") || b.classList.contains("done")) return;
    b.classList.add("open");
    b.innerHTML = c.side === "fr" ? `<span class="t">${esc(c.w.fr)}</span>` : hasPic(c.w) ? (c.w.img ? `<img src="${esc(c.w.img)}" alt="">` : `<span class="e">${esc(c.w.emoji)}</span>`) : `<span class="t">${esc(c.w.tr)}</span>`;
    if (c.side === "fr") say(c.w.fr, "fr");
    open.push(b);
    if (open.length === 2) {
      moves++; $("#mv").textContent = `Züge: ${moves}`;
      const [a, d] = open.map(x => cards[+x.dataset.i]);
      if (a.w === d.w && a.side !== d.side) {
        sfx.ok(); open.forEach(x => x.classList.replace("open", "done")); open = []; pairs++;
        if (wstate(S.prog, l.id, a.w.id).b >= 1) grade(S.prog, l.id, a.w.id, true, "recog");
        if (pairs === words.length) {
          const coins = Math.max(3, words.length * 2 - Math.max(0, moves - words.length));
          S.prog.coins += coins;
          logActivity(S.prog, { sec: Math.round((Date.now() - t0) / 1000), ans: words.length, ok: words.length });
          S.classWeekOk += words.length;
          checkBadges(S.prog, S.lessons); save(true);
          setTimeout(() => { sfx.win(); confetti(); modal(`<div class="center stack"><div class="result-big">🃏</div><h2>Alle Paare gefunden!</h2><p class="muted" style="margin:0">${moves} Züge</p><div class="reward-row"><span class="reward">🪙 +${coins}</span></div><button class="btn green" data-close="ok">Weiter ➜</button></div>`).then(() => islandView(l, goHome)); }, 500);
        }
      } else {
        lock = true;
        setTimeout(() => { open.forEach(x => { x.classList.remove("open"); x.textContent = "❓"; }); open = []; lock = false; }, 1100);
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
    <div class="ex-top"><button class="icon-btn" id="quit" aria-label="Beenden">✖️</button>
      <div class="ex-progress"><i id="tbar" style="width:100%"></i></div><span class="chip" id="sc">⚡ 0</span></div>
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
    render(`<div class="wrap narrow"><div class="card"><div class="result-big">⚡</div>
      <h2 style="font-size:2rem">${score} richtig!</h2>
      <p class="muted" style="margin:0">${rec && score ? "Neuer persönlicher Rekord! 🎉" : `Dein Rekord: ${best}`}</p>
      <div class="reward-row"><span class="reward">🪙 +${score}</span></div>
      <div class="row" style="justify-content:center"><button class="btn blue" id="again">Nochmal ⚡</button><button class="btn green" id="back">Zur Insel</button></div></div></div>`);
    $("#again").onclick = () => blitz(l);
    $("#back").onclick = () => islandView(l, goHome);
  };
  $("#quit").onclick = () => { clearInterval(timer); islandView(l, goHome); };
  const round = () => {
    const w = pool[Math.floor(Math.random() * pool.length)];
    const other = distractors({ l, w }, 1, "tr")[0]?.w;
    const opts = shuffle([w, other].filter(Boolean));
    $("#card").innerHTML = `<div class="word-fr">${esc(w.fr)}</div><div class="choices">${opts.map((o, i) => `<button class="choice" data-i="${i}">${esc(o.tr)}</button>`).join("")}</div>`;
    $$("#card .choice").forEach(b => b.onclick = () => {
      const ok = opts[+b.dataset.i] === w;
      if (ok) { score++; sfx.ok(); if (wstate(S.prog, l.id, w.id).b >= 1) grade(S.prog, l.id, w.id, true, "recog"); }
      else { wrong++; sfx.no(); grade(S.prog, l.id, w.id, false, "recog"); }
      $("#sc").textContent = `⚡ ${score}`;
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
function myProgress(back) {
  const o = overallStats(S.prog, S.lessons);
  const wk = weekSummary(S.prog);
  const boxes = [0, 0, 0, 0, 0, 0];
  for (const l of S.lessons) for (const w of l.words) boxes[wstate(S.prog, l.id, w.id).b]++;
  const maxB = Math.max(1, ...boxes.slice(1));
  const today = new Date();
  const start = new Date(today.getTime() - 27 * DAY);
  const cal = Array.from({ length: 28 }, (_, i) => { const d = new Date(start.getTime() + i * DAY); const k = todayStr(d); return { k, on: (S.prog.days[k]?.ans || 0) > 0, today: k === todayStr(), n: d.getDate() }; });
  render(`<div class="wrap">
    ${topbar()}
    <div class="panel stack">
      <h2 style="font-size:1.8rem">Mein Fortschritt</h2>
      <div class="kpis">
        <div class="kpi"><span class="v">${o.known}</span><span class="l">Wörter sicher gelernt</span></div>
        <div class="kpi"><span class="v">${o.master}</span><span class="l">Wörter gemeistert 🏅</span></div>
        <div class="kpi"><span class="v">🔥 ${currentStreak(S.prog)}</span><span class="l">Tage hintereinander</span></div>
        <div class="kpi"><span class="v">${Math.round(wk.sec / 60)}</span><span class="l">Minuten diese Woche</span></div>
      </div>
    </div>
    <div class="grid2">
      <div class="panel stack"><h3>Meine Lernkartei</h3>
        <p class="small muted" style="margin:0">Jedes Wort wandert nach rechts, wenn du es richtig weißt. Ganz rechts bleibt es für immer im Kopf!</p>
        <div class="boxes">${[1, 2, 3, 4, 5].map(b => `<div class="col"><b>${boxes[b]}</b><i style="height:${Math.round(boxes[b] / maxB * 90) + 4}px;background:${["", "#ff6f4f", "#ffc531", "#8bd17c", "#2f9e5e", "#17628f"][b]}"></i><span>${["", "neu", "übe", "gut", "sicher", "Profi"][b]}</span></div>`).join("")}</div>
      </div>
      <div class="panel stack"><h3>Meine Übungstage</h3>
        <div class="cal">${cal.map(c => `<div class="${c.on ? "on" : ""} ${c.today ? "today" : ""}" title="${c.k}">${c.n}</div>`).join("")}</div>
      </div>
    </div>
    <div class="panel stack"><h3>Meine Inseln</h3>
      ${S.lessons.map(l => { const st = lessonStats(S.prog, l); return `<div class="stack" style="gap:4px"><div class="row between"><span>${esc(l.icon || "🏝️")} <b>${esc(l.title)}</b></span><span>${"⭐".repeat(st.stars)}${"☆".repeat(3 - st.stars)} <span class="small muted">${st.known}/${st.total}</span></span></div><div class="bar"><i style="width:${Math.round(st.known / Math.max(1, st.total) * 100)}%"></i></div></div>`; }).join("") || `<span class="muted">Noch keine Inseln.</span>`}
    </div>
    <div class="panel stack"><h3>Abzeichen</h3>
      <div class="badges">${BADGES.map(b => `<div class="badge ${S.prog.badges.includes(b.id) ? "" : "off"}"><span class="em">${b.icon}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`).join("")}</div>
    </div>
  </div>`);
  bindTop(back);
}

// ------------------------------------------------------------------
//  Shop (Avatar gestalten)
// ------------------------------------------------------------------
const ANIMALS = [["🐢", 0], ["🦊", 0], ["🐻", 0], ["🐬", 0], ["🦋", 20], ["🐧", 30], ["🐸", 30], ["🐙", 40], ["🦜", 40], ["🐼", 50], ["🦄", 80], ["🦖", 100]];
const HATS = [["", 0], ["🌸", 10], ["🧢", 15], ["🎀", 15], ["⛑️", 25], ["🤠", 30], ["🎓", 40], ["🎩", 50], ["👑", 80], ["🏴‍☠️", 60]];
const COLORS = ["#2f9e8f", "#1c7ed6", "#7048e8", "#d6336c", "#e8590c", "#f08c00", "#2b8a3e", "#495057"];

function shop(back) {
  const av = S.prog.avatar;
  const owned = new Set(S.prog.owned);
  const item = (kind, [e, price]) => {
    const has = price === 0 || owned.has(kind + e);
    const sel = av[kind] === e;
    return `<button data-kind="${kind}" data-e="${esc(e)}" data-p="${price}" class="${sel ? "sel" : ""}"><span class="em">${e || "🚫"}</span><small>${sel ? "✔ an" : has ? "anziehen" : `🪙 ${price}`}</small></button>`;
  };
  render(`<div class="wrap">
    ${topbar()}
    <div class="panel stack center">
      <div style="justify-self:center;margin-top:20px">${avatarHtml(av, "lg")}</div>
      <p class="muted" style="margin:0">Du hast <b>🪙 ${S.prog.coins}</b> Münzen. Münzen bekommst du für jede richtige Antwort.</p>
    </div>
    <div class="panel stack"><h3>Tier</h3><div class="shop">${ANIMALS.map(a => item("animal", a)).join("")}</div></div>
    <div class="panel stack"><h3>Hut</h3><div class="shop">${HATS.map(h => item("hat", h)).join("")}</div></div>
    <div class="panel stack"><h3>Farbe</h3><div class="row">${COLORS.map(c => `<button class="icon-btn" data-color="${c}" aria-label="Farbe" style="background:${c};${av.color === c ? "outline:4px solid var(--sun)" : ""}"></button>`).join("")}</div></div>
  </div>`);
  bindTop(back);
  $$(".shop button").forEach(b => b.onclick = () => {
    const { kind, e } = b.dataset; const p = +b.dataset.p;
    const key = kind + e;
    if (p > 0 && !owned.has(key)) {
      if (S.prog.coins < p) { sfx.no(); toast(`Dir fehlen noch ${p - S.prog.coins} Münzen. Weiter üben! 💪`); return; }
      S.prog.coins -= p; S.prog.owned.push(key); sfx.coin(); confetti(60);
    }
    S.prog.avatar = { ...S.prog.avatar, [kind]: e };
    save(); shop(back);
  });
  $$("[data-color]").forEach(b => b.onclick = () => { S.prog.avatar = { ...S.prog.avatar, color: b.dataset.color }; save(); shop(back); });
}
