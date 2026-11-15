import { Store, Device, isCloud } from "./store.js";
import { esc, uid, sha, pinHash, randomPin, LANG_FLAG, LANG_NAME, PIN_NAMES } from "./util.js";
import { art } from "./art.js";
import { render, $, $$, toast, modal, confirmBox, pic, avatarHtml, fmtMin, relDay } from "./ui.js";
import { lessonStats, weekSummary, currentStreak, emptyProgress, todayStr, DAY, wstate, stripArticle, norm } from "./srs.js";
import { fileToLines, splitLines, linesToPairs, prepareImage, matchImages, searchOpenverse, fetchImageBlob } from "./import.js";

// ---- Bilder speichern (hohe Auflösung, wenn der Online-Bildspeicher eingerichtet ist) ----
async function storeImageFile(fileOrBlob) {
  const blob = await prepareImage(fileOrBlob, 1200);
  return Store.uploadImage(blob);
}
async function storeImageHit(hit) {
  const blob = await fetchImageBlob(hit);
  if (!blob) return hit.url; // Browser darf das Bild nicht laden → direkt verlinken
  try { return await storeImageFile(blob); } catch { return hit.url; }
}
function warnIfNoStorage() {
  if (isCloud && !Store.imageStorageOk) toast("Hinweis: Der Bildspeicher ist noch nicht eingerichtet – Bilder werden verkleinert gespeichert. Siehe Einstellungen.", 5000);
}

// Suchfenster für lizenzfreie Bilder. Ergebnis: {url, credit, link} | "skip" | "stop" | null
function searchImage(query, { title = "Bild suchen", alt = [], series = false } = {}) {
  return modal(`<h2>${esc(title)}</h2>
    <div class="row" style="flex-wrap:nowrap"><input class="input" id="sq" value="${esc(query)}" aria-label="Suchbegriff"><button class="btn blue small" id="sgo">Suchen</button></div>
    <div class="row small" style="gap:8px">${alt.filter(Boolean).map(a => `<button class="pill" data-q="${esc(a)}" style="border:0;cursor:pointer">${esc(a)}</button>`).join("")}
      <span style="margin-left:auto" class="row"><label class="check"><input type="radio" name="sc" value="illustration" checked> Zeichnungen</label><label class="check"><input type="radio" name="sc" value="photograph"> Fotos</label></span></div>
    <div id="sres" class="img-grid"><p class="muted">Suche läuft …</p></div>
    <p class="small muted" style="margin:0">Lizenzfreie Bilder (Creative Commons) über Openverse. Deutsche oder englische Suchwörter finden meist mehr als französische.</p>
    <div class="row" style="justify-content:flex-end">${series ? `<button class="btn ghost small" data-close="stop">Fertig</button><button class="btn ghost small" data-close="skip">Überspringen ➜</button>` : `<button class="btn ghost small" data-close="">Abbrechen</button>`}</div>`, {
    onMount: (m, close) => {
      const run = async () => {
        const q = m.querySelector("#sq").value.trim(); if (!q) return;
        const cat = m.querySelector("input[name=sc]:checked").value;
        const box = m.querySelector("#sres"); box.innerHTML = `<p class="muted">Suche läuft …</p>`;
        try {
          const hits = await searchOpenverse(q, cat);
          box.innerHTML = hits.length ? hits.map((h, i) => `<button class="img-hit" data-i="${i}" title="${esc(h.credit)}"><img src="${esc(h.thumb)}" alt="" loading="lazy"></button>`).join("")
            : `<p class="muted">Nichts gefunden. Versuche ein anderes Wort (z. B. auf Englisch) oder „Fotos“.</p>`;
          box.querySelectorAll(".img-hit").forEach(b => b.onclick = () => close(hits[+b.dataset.i]));
          box.querySelectorAll("img").forEach(img => img.onerror = () => img.closest(".img-hit")?.remove());
        } catch (e) { box.innerHTML = `<p class="feedback no" style="font-size:1rem">${esc(e.message)}</p>`; }
      };
      m.querySelector("#sgo").onclick = run;
      m.querySelector("#sq").onkeydown = e => { if (e.key === "Enter") run(); };
      m.querySelectorAll("input[name=sc]").forEach(r => r.onchange = run);
      m.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { m.querySelector("#sq").value = b.dataset.q; run(); });
      run();
    },
  });
}
const searchTerm = s => stripArticle(norm(String(s || "").split(/[\/;]/)[0]));
import { say } from "./speech.js";

const T = { cls: null, tab: "overview", students: [], lessons: [], progs: {}, back: null };

// ------------------------------------------------------------------
//  Anmeldung / Klasse anlegen
// ------------------------------------------------------------------
export function teacherLogin(back) {
  T.back = back;
  document.body.classList.remove("teacher-mode");
  const code = Device.get("classCode", "");
  render(`<div class="wrap narrow">
    <div class="row"><button class="btn ghost small" id="back">Zurück</button></div>
    <div class="hero"><h1>Lehrerbereich</h1></div>
    <div class="panel stack">
      <h2>Klasse öffnen</h2>
      <div class="field"><label for="tc">Klassencode</label><input class="input" id="tc" value="${esc(code)}" autocapitalize="characters" placeholder="z. B. SONNE-4821"></div>
      <div class="field"><label for="tp">Lehrer-PIN</label><input class="input" id="tp" type="password" inputmode="numeric" autocomplete="current-password" placeholder="••••"></div>
      <button class="btn green" id="open">Öffnen</button>
      ${!isCloud ? `<p class="small muted" style="margin:0">Zum Ausprobieren: Klassencode <b>DEMO</b>, PIN <b>1234</b>.</p>` : ""}
    </div>
    <div class="panel stack">
      <h2>Neue Klasse anlegen</h2>
      <div class="field"><label for="nn">Name der Klasse</label><input class="input" id="nn" placeholder="z. B. Klasse 4b"></div>
      <div class="field"><label for="nc">Klassencode (für die Kinder)</label><input class="input" id="nc" value="${suggestCode()}" autocapitalize="characters"></div>
      <div class="field"><label for="np">Lehrer-PIN (mind. 4 Ziffern)</label><input class="input" id="np" type="password" inputmode="numeric" autocomplete="new-password"></div>
      <button class="btn blue" id="create">Klasse anlegen</button>
    </div>
  </div>`);
  $("#back").onclick = back;
  $("#open").onclick = async () => {
    const c = Store.normCode($("#tc").value), p = $("#tp").value.trim();
    if (!c || !p) return toast("Bitte Klassencode und PIN eingeben.");
    try {
      const cls = await Store.classExists(c);
      if (!cls) return toast("Diese Klasse gibt es nicht. Bitte den Code prüfen.");
      if ((await sha(`${c}#teacher#${p}`)) !== cls.teacherPinHash) return toast("Die PIN stimmt nicht.");
      Store.code = c; Device.set("classCode", c);
      T.cls = cls; dashboard();
    } catch (e) { toast(e.message); }
  };
  $("#tp").onkeydown = e => { if (e.key === "Enter") $("#open").click(); };
  $("#create").onclick = async () => {
    const name = $("#nn").value.trim(), c = Store.normCode($("#nc").value), p = $("#np").value.trim();
    if (!name) return toast("Bitte einen Namen für die Klasse eingeben.");
    if (c.length < 4) return toast("Der Klassencode braucht mindestens 4 Zeichen.");
    if (!/^\d{4,}$/.test(p)) return toast("Die PIN braucht mindestens 4 Ziffern.");
    try {
      if (await Store.classExists(c)) return toast("Diesen Klassencode gibt es schon. Bitte einen anderen wählen.");
      const cls = { name, teacherPinHash: await sha(`${c}#teacher#${p}`), goal: { title: "Leuchtturm bauen", target: 300 }, allOpen: false, created: Date.now() };
      await Store.createClass(c, cls);
      Device.set("classCode", c);
      T.cls = cls; T.tab = "students"; dashboard();
      toast("Klasse angelegt! Lege jetzt die Kinder an.");
    } catch (e) { toast(e.message); }
  };
}

function suggestCode() {
  const words = ["SONNE", "MOND", "WAL", "INSEL", "STERN", "MEER", "KOMPASS", "ANKER", "MOWE", "KORALLE"];
  return `${words[Math.floor(Math.random() * words.length)]}-${1000 + Math.floor(Math.random() * 9000)}`;
}

// ------------------------------------------------------------------
//  Dashboard-Rahmen
// ------------------------------------------------------------------
async function loadAll() {
  const [students, lessons, progs, cls] = await Promise.all([Store.list("student"), Store.list("lesson"), Store.list("progress"), Store.getOne("class", "main")]);
  T.students = students.sort((a, b) => a.name.localeCompare(b.name, "de"));
  T.lessons = lessons.sort((a, b) => (a.order || 0) - (b.order || 0) || (a.created || 0) - (b.created || 0));
  T.progs = Object.fromEntries(progs.map(p => [p.id, { ...emptyProgress(), ...p }]));
  if (cls) T.cls = cls;
}

async function dashboard() {
  document.body.classList.add("teacher-mode");
  render(`<div class="wrap"><div class="t-panel">Lade Daten …</div></div>`);
  try { await loadAll(); } catch (e) { render(`<div class="wrap"><div class="t-panel">${esc(e.message)}</div></div>`); return; }
  const tabs = [["overview", "📊 Übersicht"], ["lessons", "📚 Lektionen"], ["students", "👧 Kinder"], ["settings", "⚙️ Einstellungen"]];
  render(`<div class="wrap">
    <div class="t-head"><span class="logo">${art("parrot")}</span><h1>${esc(T.cls.name)} <span class="pill">${esc(Store.code)}</span></h1>
      <nav class="tabs">${tabs.map(([k, n]) => `<button data-t="${k}" class="${T.tab === k ? "on" : ""}">${n}</button>`).join("")}</nav>
      <button class="btn ghost small" id="logout">Abmelden</button></div>
    ${!isCloud ? `<div class="banner no-print">Demo-Modus: Daten werden nur auf diesem Gerät gespeichert. Für die ganze Klasse auf allen Geräten bitte Supabase einrichten (siehe Anleitung).</div>` : ""}
    <div id="tab"></div></div>`);
  $$(".tabs button").forEach(b => b.onclick = () => { T.tab = b.dataset.t; $$(".tabs button").forEach(x => x.classList.toggle("on", x === b)); showTab(); });
  $("#logout").onclick = () => { document.body.classList.remove("teacher-mode"); T.back(); };
  showTab();
}

function showTab() {
  const el = $("#tab");
  ({ overview, lessons: lessonsTab, students: studentsTab, settings })[T.tab](el);
}

const assignedTo = (l, sid) => l.assigned === "all" || !l.assigned || (Array.isArray(l.assigned) && l.assigned.includes(sid));
const heatColor = p => p == null ? "#f1f3f5" : p >= 90 ? "#8fd6a8" : p >= 70 ? "#d3f2df" : p >= 40 ? "#ffe8c2" : p > 0 ? "#ffd9cc" : "#fff4ef";

function studentRow(s) {
  const p = T.progs[s.id] || emptyProgress();
  const wk = weekSummary(p);
  const my = T.lessons.filter(l => assignedTo(l, s.id) && l.words?.length);
  let known = 0, total = 0, right = 0, wrong = 0;
  for (const l of my) { const st = lessonStats(p, l); known += st.known; total += st.total; }
  for (const v of Object.values(p.words || {})) { right += v.r || 0; wrong += v.w || 0; }
  const lastDay = Object.keys(p.days || {}).filter(k => p.days[k].ans > 0).sort().pop();
  const lastTs = lastDay ? new Date(lastDay + "T12:00").getTime() : 0;
  const acc = right + wrong ? Math.round(right / (right + wrong) * 100) : null;
  const inactive = !lastTs || Date.now() - lastTs > 5 * DAY;
  return { s, p, wk, my, known, total, acc, lastTs, inactive, pct: total ? Math.round(known / total * 100) : 0 };
}

// ------------------------------------------------------------------
//  Übersicht
// ------------------------------------------------------------------
function overview(el) {
  const rows = T.students.map(studentRow);
  const n = rows.length || 1;
  const active = rows.filter(r => r.wk.ans > 0).length;
  const avgPct = Math.round(rows.reduce((s, r) => s + r.pct, 0) / n);
  const weekSec = rows.reduce((s, r) => s + r.wk.sec, 0);
  const weekOk = rows.reduce((s, r) => s + r.wk.ok, 0);
  const goal = T.cls.goal || { title: "Klassenziel", target: 300 };
  const lessons = T.lessons.filter(l => l.words?.length);

  // schwierige Wörter
  const agg = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.p.words || {})) {
    const a = agg[k] || (agg[k] = { r: 0, w: 0, kids: 0 });
    a.r += v.r || 0; a.w += v.w || 0; if ((v.w || 0) > 0) a.kids++;
  }
  const findWord = k => { const [lid, wid] = k.split(":"); const l = T.lessons.find(x => x.id === lid); const w = l?.words.find(x => x.id === wid); return w ? { l, w } : null; };
  const hard = Object.entries(agg).map(([k, a]) => ({ k, ...a, rate: a.w / Math.max(1, a.r + a.w), ...findWord(k) }))
    .filter(x => x.w && x.r + x.w >= 3).sort((a, b) => b.rate - a.rate || b.w - a.w).slice(0, 10);
  const support = rows.filter(r => r.inactive || (r.acc != null && r.acc < 60));

  el.innerHTML = `<div class="stack" style="gap:16px">
    <div class="kpis">
      <div class="kpi"><span class="l">Diese Woche aktiv</span><span class="v">${active} / ${rows.length}</span><span class="s">Kinder mit mind. 1 Übung</span></div>
      <div class="kpi"><span class="l">Wörter sicher (Ø)</span><span class="v">${avgPct} %</span><span class="s">der zugewiesenen Wörter</span></div>
      <div class="kpi"><span class="l">Übungszeit diese Woche</span><span class="v">${fmtMin(weekSec)}</span><span class="s">Ø ${fmtMin(weekSec / n)} pro Kind</span></div>
      <div class="kpi"><span class="l">Klassenziel „${esc(goal.title)}“</span><span class="v">${Math.min(100, Math.round(weekOk / Math.max(1, goal.target) * 100))} %</span><span class="s">${weekOk} / ${goal.target} richtige Antworten</span></div>
    </div>
    <div class="t-panel">
      <div class="row between"><h2>Fortschritt der Klasse</h2>
        <div class="legend"><span><i style="background:#ffd9cc"></i>&lt;40 %</span><span><i style="background:#ffe8c2"></i>40–69 %</span><span><i style="background:#d3f2df"></i>70–89 %</span><span><i style="background:#8fd6a8"></i>≥90 %</span><span><i style="background:#f1f3f5"></i>nicht zugewiesen</span></div></div>
      <p class="small muted" style="margin:0">Prozent = Anteil der Wörter, die das Kind sicher abrufen kann (Lernkartei Fach 2+). Zeile anklicken für Details.</p>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Kind</th><th>Zuletzt</th><th>🔥</th><th>Woche</th><th>Letzte 14 Tage</th><th>Treffer</th><th>Tests</th>${lessons.map(l => `<th title="${esc(l.title)}">${esc(l.icon || "")} ${esc(l.title.slice(0, 10))}${LANG_FLAG[l.lang] ? " " + LANG_FLAG[l.lang] : ""}</th>`).join("")}<th></th></tr></thead>
        <tbody>${rows.map(r => `<tr class="click" data-id="${esc(r.s.id)}">
          <td><div class="row" style="gap:8px;flex-wrap:nowrap">${avatarHtml(r.p.avatar, "sm")}<b>${esc(r.s.name)}</b></div></td>
          <td>${relDay(r.lastTs)}</td>
          <td>${currentStreak(r.p)}</td>
          <td>${fmtMin(r.wk.sec)}</td>
          <td>${spark(r.p)}</td>
          <td>${r.acc == null ? "–" : r.acc + " %"}</td>
          <td>${testCell(r)}</td>
          ${lessons.map(l => { if (!assignedTo(l, r.s.id)) return `<td><span class="heat" style="background:${heatColor(null)}">–</span></td>`; const st = lessonStats(r.p, l); return `<td><span class="heat" style="background:${heatColor(st.knownPct)}" title="${st.known}/${st.total} sicher, ${st.master} gemeistert">${st.knownPct}%</span></td>`; }).join("")}
          <td>${r.inactive ? `<span class="pill warn">inaktiv</span>` : r.acc != null && r.acc < 60 ? `<span class="pill bad">Hilfe?</span>` : `<span class="pill good">gut</span>`}</td>
        </tr>`).join("") || `<tr><td colspan="9" class="muted">Noch keine Kinder angelegt.</td></tr>`}</tbody>
      </table></div>
    </div>
    <div class="grid2">
      <div class="t-panel"><h2>Schwierige Wörter</h2>
        <p class="small muted" style="margin:0">Wörter mit den meisten Fehlern – gut für eine Wiederholung im Unterricht.</p>
        ${hard.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Wort</th><th>Bedeutung</th><th>Fehler</th><th>Kinder</th></tr></thead><tbody>
        ${hard.map(h => `<tr><td><span class="wpic" style="width:34px;height:34px;font-size:1.2rem">${pic(h.w)}</span></td><td><b>${esc(h.w.fr)}</b></td><td>${esc(h.w.tr)}</td><td>${Math.round(h.rate * 100)} %</td><td>${h.kids}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Noch nicht genug Daten.</p>`}
      </div>
      <div class="t-panel"><h2>Brauchen vielleicht Unterstützung</h2>
        ${support.length ? support.map(r => `<div class="row between"><span class="row" style="gap:8px">${avatarHtml(r.p.avatar, "sm")} <b>${esc(r.s.name)}</b></span><span class="row" style="gap:6px">${r.inactive ? `<span class="pill warn">seit ${relDay(r.lastTs)} nicht geübt</span>` : ""}${r.acc != null && r.acc < 60 ? `<span class="pill bad">${r.acc} % Treffer</span>` : ""}</span></div>`).join("") : `<p class="muted">Alle Kinder sind gut dabei. 🎉</p>`}
      </div>
    </div>
  </div>`;
  $$("tr.click", el).forEach(tr => tr.onclick = () => studentDetail(rows.find(r => r.s.id === tr.dataset.id)));
}

function testCell(r) {
  const ts = r.my.map(l => r.p.tests?.[l.id]).filter(Boolean);
  if (!ts.length) return `<span class="muted">–</span>`;
  const passed = ts.filter(t => t.best >= 80).length;
  return `<span class="pill ${passed === ts.length ? "good" : "warn"}" title="${ts.map(t => t.last + " %").join(", ")}">${passed}/${ts.length} ✓</span>`;
}
function spark(p) {
  const vals = Array.from({ length: 14 }, (_, i) => p.days?.[todayStr(new Date(Date.now() - (13 - i) * DAY))]?.ans || 0);
  const mx = Math.max(10, ...vals);
  return `<span class="spark" title="Antworten pro Tag">${vals.map(v => `<i class="${v ? "" : "zero"}" style="height:${v ? Math.max(4, Math.round(v / mx * 26)) : 2}px"></i>`).join("")}</span>`;
}

async function studentDetail(r) {
  const hardWords = [];
  for (const l of r.my) for (const w of l.words) { const s = wstate(r.p, l.id, w.id); if (s.w >= 2 || (s.b === 1 && s.w >= 1)) hardWords.push({ w, s }); }
  hardWords.sort((a, b) => b.s.w - a.s.w);
  const res = await modal(`<div class="row" style="gap:12px">${avatarHtml(r.p.avatar)}<div><h2>${esc(r.s.name)}</h2><span class="muted small">zuletzt aktiv: ${relDay(r.lastTs)} · 🔥 ${currentStreak(r.p)} · 🪙 ${r.p.coins}</span></div></div>
    <div class="stack" style="gap:8px">${r.my.map(l => { const st = lessonStats(r.p, l); return `<div><div class="row between small"><span>${esc(l.icon || "")} ${esc(l.title)} ${"⭐".repeat(st.stars)}</span><span>${st.known}/${st.total} sicher · ${st.master} gemeistert · ${st.due} fällig</span></div><div class="bar"><i style="width:${st.knownPct}%"></i></div></div>`; }).join("") || "Keine Lektionen zugewiesen."}</div>
    <div><b>Übt gerade schwer:</b> ${hardWords.slice(0, 8).map(h => `<span class="pill bad">${esc(h.w.fr)}</span>`).join(" ") || `<span class="muted">nichts Auffälliges</span>`}</div>
    <div><b>Tests:</b> ${r.my.map(l => { const t = r.p.tests?.[l.id]; return t ? `<span class="pill ${t.best >= 80 ? "good" : "warn"}">${esc(l.title)}: ${t.last} % (bestes ${t.best} %, ${t.count}×)</span>` : ""; }).join(" ") || `<span class="muted">noch kein Test</span>`}</div>
    <div><b>Diese Woche:</b> ${r.wk.daysActive} Tage, ${fmtMin(r.wk.sec)}, ${r.wk.ok}/${r.wk.ans} richtig · 🎤 ${r.p.spoken} gesprochen · ✍️ ${r.p.typed} geschrieben</div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost small" data-close="reset">Fortschritt zurücksetzen</button><button class="btn green small" data-close="ok">Schließen</button></div>`);
  if (res === "reset" && await confirmBox(`Den gesamten Fortschritt von ${r.s.name} löschen? Das kann nicht rückgängig gemacht werden.`, "Löschen", "Abbrechen", true)) {
    await Store.del("progress", r.s.id); toast("Fortschritt gelöscht."); dashboard();
  }
}

// ------------------------------------------------------------------
//  Lektionen
// ------------------------------------------------------------------
function lessonsTab(el) {
  el.innerHTML = `<div class="t-panel">
    <div class="row between"><h2>Lektionen (Inseln)</h2><button class="btn green small" id="new">＋ Neue Lektion</button></div>
    <p class="small muted" style="margin:0">Die Reihenfolge bestimmt die Inseln auf der Weltkarte. Die nächste Insel öffnet sich, sobald ein Kind auf der vorherigen einen Stern hat.</p>
    <div class="lesson-list">${T.lessons.map((l, i) => `<div class="lesson-row">
      <span class="ic">${l.iconImg ? `<span class="wpic"><img src="${esc(l.iconImg)}" alt=""></span>` : esc(l.icon || "🏝️")}</span>
      <div><b>${esc(l.title)}</b> <span class="pill">FR → ${LANG_FLAG[l.lang] || ""} ${LANG_NAME[l.lang] || ""}</span><br><span class="small muted">${l.words?.length || 0} Wörter · ${l.assigned === "all" || !l.assigned ? "alle Kinder" : `${l.assigned.length} Kinder`}</span></div>
      <div class="row" style="gap:6px"><button class="btn ghost small" data-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="nach oben">↑</button><button class="btn ghost small" data-down="${i}" ${i === T.lessons.length - 1 ? "disabled" : ""} aria-label="nach unten">↓</button><button class="btn blue small" data-edit="${esc(l.id)}">Bearbeiten</button></div>
    </div>`).join("") || `<p class="muted">Noch keine Lektionen. Lege die erste an – z. B. aus einem Foto deines Vokabelblatts.</p>`}</div></div>`;
  $("#new").onclick = () => editLesson({ id: uid("l-"), title: "", icon: "🏝️", lang: "de", assigned: "all", words: [], order: (T.lessons.at(-1)?.order || 0) + 1, created: Date.now(), _new: true });
  $$("[data-edit]", el).forEach(b => b.onclick = () => editLesson(structuredClone(T.lessons.find(l => l.id === b.dataset.edit))));
  const move = async (i, d) => {
    const a = T.lessons[i], b = T.lessons[i + d];
    T.lessons.forEach((l, k) => l.order = k + 1);
    [a.order, b.order] = [b.order, a.order];
    await Promise.all([Store.put("lesson", a.id, a), Store.put("lesson", b.id, b)]);
    T.lessons.sort((x, y) => x.order - y.order); lessonsTab(el);
  };
  $$("[data-up]", el).forEach(b => b.onclick = () => move(+b.dataset.up, -1));
  $$("[data-down]", el).forEach(b => b.onclick = () => move(+b.dataset.down, 1));
}

function editLesson(L) {
  const el = $("#tab");
  L.tray = L.tray || [];
  let trayPick = null;
  const draw = () => {
    el.innerHTML = `<div class="stack" style="gap:16px">
    <div class="t-panel">
      <div class="row between"><h2>${L._new ? "Neue Lektion" : "Lektion bearbeiten"}</h2>
        <div class="row" style="gap:6px">${L._new ? "" : `<button class="btn ghost small" id="del">🗑 Löschen</button>`}<button class="btn ghost small" id="cancel">Abbrechen</button><button class="btn green small" id="save">💾 Speichern</button></div></div>
      <div class="grid2">
        <div class="field"><label for="lt">Titel</label><input class="input" id="lt" value="${esc(L.title)}" placeholder="z. B. Les animaux"></div>
        <div class="row" style="align-items:end">
          <div class="field"><label for="li">Inselbild</label>
            <div class="row" style="gap:6px;flex-wrap:nowrap">
              <button class="wpic" id="iconPic" title="Eigenes Bild für die Insel hochladen" style="width:56px;height:56px">${L.iconImg ? `<img src="${esc(L.iconImg)}" alt="">` : esc(L.icon || "🏝️")}</button>
              <input class="input" id="li" value="${esc(L.icon)}" maxlength="4" style="width:64px;text-align:center;font-size:1.3rem" aria-label="Emoji, falls kein Bild">
              <button class="btn ghost small" id="iconSearch" title="Bild suchen">🔍</button>
              ${L.iconImg ? `<button class="btn ghost small" id="iconDel" title="Bild entfernen">✕</button>` : ""}
            </div>
            <input type="file" id="iconFile" class="hidden" accept="image/*,.heic,.svg">
          </div>
          <div class="field" style="flex:1;min-width:160px"><label for="ll">Sprachen</label><select class="input" id="ll"><option value="de" ${L.lang === "de" ? "selected" : ""}>Französisch → Deutsch</option><option value="pt" ${L.lang === "pt" ? "selected" : ""}>Französisch → Portugiesisch</option></select></div>
        </div>
      </div>
      <div class="field"><label>Für wen?</label>
        <div class="row"><label class="check"><input type="radio" name="as" value="all" ${L.assigned === "all" ? "checked" : ""}> Alle Kinder</label><label class="check"><input type="radio" name="as" value="some" ${L.assigned !== "all" ? "checked" : ""}> Nur ausgewählte</label></div>
        <div class="row ${L.assigned === "all" ? "hidden" : ""}" id="kids">${T.students.map(s => `<label class="check"><input type="checkbox" value="${esc(s.id)}" ${Array.isArray(L.assigned) && L.assigned.includes(s.id) ? "checked" : ""}> ${esc(s.name)}</label>`).join("") || `<span class="muted small">Noch keine Kinder angelegt.</span>`}</div>
      </div>
    </div>

    <div class="t-panel">
      <h2>Vokabeln importieren</h2>
      <div class="drop" id="drop">
        <b>📷 Foto, PDF, Word, Excel oder CSV hierher ziehen</b>
        <span class="small muted">oder</span>
        <div class="row" style="justify-content:center"><label class="btn blue small" for="lf">Datei wählen</label><label class="btn ghost small" for="lcam">📷 Foto aufnehmen</label></div>
        <input type="file" id="lf" class="hidden" accept="image/*,.heic,.pdf,.docx,.xlsx,.xls,.ods,.csv,.txt,.tsv">
        <input type="file" id="lcam" class="hidden" accept="image/*" capture="environment">
        <span class="small muted">Die App erkennt Zeilen wie „le chat – die Katze“ oder zweispaltige Tabellen. Danach kannst du alles prüfen und korrigieren.</span>
      </div>
      <details><summary class="small"><b>Oder Liste als Text einfügen</b></summary>
        <div class="stack" style="margin-top:8px"><textarea class="input" id="paste" placeholder="le chat - die Katze&#10;le chien - der Hund&#10;la maison = das Haus"></textarea><button class="btn blue small" id="pasteGo" style="justify-self:start">Text übernehmen</button></div>
      </details>
      <div id="imp"></div>
    </div>

    <div class="t-panel">
      <h2>Bilder hochladen</h2>
      <div class="drop" id="imgDrop">
        <b>🖼 Bilder, einen ganzen Ordner oder eine ZIP-Datei hierher ziehen</b>
        <div class="row" style="justify-content:center"><label class="btn blue small" for="imgs">Bilder wählen</label><label class="btn ghost small" for="imgDir">Ordner wählen</label><label class="btn ghost small" for="imgZip">ZIP-Datei</label></div>
        <input type="file" id="imgs" class="hidden" multiple accept="image/*,.heic,.svg">
        <input type="file" id="imgDir" class="hidden" webkitdirectory multiple>
        <input type="file" id="imgZip" class="hidden" accept=".zip,application/zip">
        <span class="small muted">Du kannst Bilder vor oder nach der Wortliste hochladen. Heißen sie wie das Wort (z. B. <i>chat.jpg</i> oder <i>Katze.png</i>), ordnet die App sie automatisch zu. Gespeichert wird in guter Auflösung (bis 1200 Pixel).</span>
      </div>
      ${(L.tray || []).length ? `<div class="stack" style="gap:6px"><b>Noch nicht zugeordnet (${L.tray.length}):</b><span class="small muted">Tippe ein Bild an und dann bei einem Wort auf das Bild-Feld. ✕ entfernt ein Bild aus der Ablage.</span>
        <div class="tray">${L.tray.map((t, k) => `<div class="tray-item ${trayPick === k ? "sel" : ""}"><button class="wpic" style="width:100%;height:auto;background:none" data-tray="${k}" title="Auswählen"><img src="${esc(t.url)}" alt=""></button><span>${esc(t.name)}</span><button class="btn ghost small" data-untray="${k}" aria-label="Entfernen">✕</button></div>`).join("")}</div></div>` : ""}
    </div>

    <div class="t-panel">
      <div class="row between"><h2>Wörter (${L.words.length})</h2>
        <div class="row" style="gap:6px"><button class="btn ghost small" id="findMissing">🔍 Fehlende Bilder suchen</button><button class="btn blue small" id="add">＋ Wort</button></div></div>
      <p class="small muted" style="margin:0">Ein Klick auf das Bild-Feld ${trayPick != null ? "<b>setzt das ausgewählte Bild aus der Ablage</b>" : "lädt ein Bild hoch"}, 🔍 sucht ein lizenzfreies Bild, 🔊 spricht das Wort vor.</p>
      <div class="tbl-wrap"><table class="tbl words-tbl"><thead><tr><th>Bild</th><th>Französisch</th><th>${LANG_NAME[L.lang]}</th><th>Emoji</th><th>Beispielsatz (optional)</th><th></th></tr></thead>
      <tbody>${L.words.map((w, i) => `<tr data-i="${i}">
        <td><button class="wpic ${trayPick != null ? "target" : ""}" data-pic="${i}" title="Bild ändern">${pic(w)}</button></td>
        <td><input class="input" data-f="fr" value="${esc(w.fr)}" aria-label="Französisch"></td>
        <td><input class="input" data-f="tr" value="${esc(w.tr)}" aria-label="Übersetzung"></td>
        <td><input class="input" data-f="emoji" value="${esc(w.emoji || "")}" style="width:64px;text-align:center" aria-label="Emoji"></td>
        <td><input class="input" data-f="ex" value="${esc(w.ex || "")}" aria-label="Beispielsatz"></td>
        <td class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn ghost small" data-find="${i}" aria-label="Bild suchen" title="Bild suchen">🔍</button><button class="btn ghost small" data-say="${i}" aria-label="Anhören">🔊</button>${w.img ? `<button class="btn ghost small" data-noimg="${i}" title="Bild entfernen">🚫🖼</button>` : ""}<button class="btn ghost small" data-rm="${i}" aria-label="Löschen">✕</button></td>
      </tr>`).join("") || `<tr><td colspan="6" class="muted">Noch keine Wörter. Importiere eine Liste oder füge Wörter einzeln hinzu.</td></tr>`}</tbody></table></div>
      <input type="file" id="onepic" class="hidden" accept="image/*,.heic,.svg">
    </div></div>`;
    bind();
  };

  const syncInputs = () => {
    L.title = $("#lt").value.trim(); L.icon = $("#li").value.trim() || "🏝️"; L.lang = $("#ll").value;
    const mode = $("input[name=as]:checked").value;
    L.assigned = mode === "all" ? "all" : $$("#kids input:checked").map(c => c.value);
    $$(".words-tbl tbody tr[data-i]").forEach(tr => { const w = L.words[+tr.dataset.i]; $$("input[data-f]", tr).forEach(inp => w[inp.dataset.f] = inp.value.trim()); });
  };

  const showImport = pairs => {
    const box = $("#imp");
    if (!pairs.length) { box.innerHTML = `<p class="feedback no" style="font-size:1rem">Ich konnte keine Wörter erkennen. Versuche ein schärferes Foto (gerade, gutes Licht) oder füge die Liste als Text ein.</p>`; return; }
    box.innerHTML = `<div class="stack"><b>${pairs.length} Zeilen erkannt – bitte prüfen:</b>
      <div class="tbl-wrap"><table class="tbl words-tbl"><thead><tr><th><input type="checkbox" id="all" checked aria-label="alle"></th><th>Französisch</th><th>${LANG_NAME[L.lang]}</th></tr></thead><tbody>
      ${pairs.map((p, i) => `<tr><td><input type="checkbox" data-k="${i}" ${p.tr ? "checked" : ""}></td><td><input class="input" data-a="${i}" value="${esc(p.fr)}"></td><td><input class="input" data-b="${i}" value="${esc(p.tr)}"></td></tr>`).join("")}
      </tbody></table></div>
      <div class="row"><button class="btn ghost small" id="swap">⇄ Spalten tauschen</button><button class="btn green small" id="take">Ausgewählte übernehmen</button></div></div>`;
    $("#all").onchange = e => $$("#imp [data-k]").forEach(c => c.checked = e.target.checked);
    $("#swap").onclick = () => pairs.forEach((p, i) => { const a = $(`[data-a="${i}"]`), b = $(`[data-b="${i}"]`); [a.value, b.value] = [b.value, a.value]; });
    $("#take").onclick = () => {
      syncInputs();
      let n = 0;
      pairs.forEach((p, i) => { if ($(`[data-k="${i}"]`).checked) { const fr = $(`[data-a="${i}"]`).value.trim(), tr = $(`[data-b="${i}"]`).value.trim(); if (fr) { L.words.push({ id: uid("w"), fr, tr }); n++; } } });
      const m = autoMatchTray(L);
      toast(`${n} Wörter übernommen${m ? `, ${m} Bilder aus der Ablage zugeordnet` : ""}. Speichern nicht vergessen!`); draw();
    };
  };

  const handleListFile = async (f, input) => {
    if (!f) return;
    if (input) input.value = ""; // gleiche Datei kann danach nochmal gewählt werden
    syncInputs();
    const box = $("#imp");
    box.innerHTML = `<p class="muted" id="st">Lese „${esc(f.name)}“ …</p>`;
    try {
      const lines = await fileToLines(f, L.lang, s => { const st = $("#st"); if (st) st.textContent = s; });
      showImport(linesToPairs(lines));
    } catch (e) { box.innerHTML = `<p class="feedback no" style="font-size:1rem">${esc(e.message)}</p>`; }
  };

  const bind = () => {
    $("#cancel").onclick = () => { T.tab = "lessons"; showTab(); };
    $$("input[name=as]").forEach(r => r.onchange = () => $("#kids").classList.toggle("hidden", r.value === "all" && r.checked));
    $("#ll").onchange = () => { syncInputs(); draw(); };
    $("#lf").onchange = e => handleListFile(e.target.files[0], e.target);
    $("#lcam").onchange = e => handleListFile(e.target.files[0], e.target);
    // Inselbild
    $("#iconPic").onclick = () => { syncInputs(); $("#iconFile").click(); };
    $("#iconFile").onchange = async e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      toast("Bild wird gespeichert …");
      try { L.iconImg = await storeImageFile(f); warnIfNoStorage(); draw(); } catch (err) { toast(err.message, 6000); }
    };
    $("#iconSearch").onclick = async () => {
      syncInputs();
      const hit = await searchImage(L.title || "island", { title: "Bild für die Insel suchen", alt: ["island", "treasure map", L.title] });
      if (hit && hit.url) { toast("Bild wird gespeichert …"); L.iconImg = await storeImageHit(hit); L.iconCredit = hit.credit; warnIfNoStorage(); draw(); }
    };
    $("#iconDel") && ($("#iconDel").onclick = () => { syncInputs(); delete L.iconImg; delete L.iconCredit; draw(); });
    // Bildsuche pro Wort
    const findFor = async (w, opts = {}) => {
      const hit = await searchImage(searchTerm(w.tr) || searchTerm(w.fr), { title: opts.title || `Bild für „${w.fr}“`, alt: [searchTerm(w.tr), searchTerm(w.fr)], series: opts.series });
      if (hit && hit.url) { toast("Bild wird gespeichert …"); w.img = await storeImageHit(hit); w.credit = hit.credit; w.creditUrl = hit.link; }
      return hit;
    };
    $$("[data-find]").forEach(b => b.onclick = async () => { syncInputs(); await findFor(L.words[+b.dataset.find]); warnIfNoStorage(); draw(); });
    $("#findMissing").onclick = async () => {
      syncInputs();
      const missing = L.words.filter(w => w.fr && !w.img);
      if (!missing.length) return toast("Alle Wörter haben schon ein Bild. 👍");
      let n = 0;
      for (let i = 0; i < missing.length; i++) {
        const r = await findFor(missing[i], { series: true, title: `Bild ${i + 1} von ${missing.length}: „${missing[i].fr}“ (${missing[i].tr || "?"})` });
        if (!r || r === "stop") break;
        if (r && r.url) n++;
      }
      warnIfNoStorage(); draw(); toast(`${n} Bilder hinzugefügt. Speichern nicht vergessen!`);
    };
    const drop = $("#drop");
    drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); handleListFile(e.dataTransfer.files[0]); };
    $("#pasteGo").onclick = () => { syncInputs(); const t = $("#paste").value; showImport(linesToPairs(splitLines(t))); };
    $("#add").onclick = () => { syncInputs(); L.words.push({ id: uid("w"), fr: "", tr: "" }); draw(); $$(".words-tbl tbody tr[data-i]").at(-1)?.querySelector("input")?.focus(); };
    $$("[data-rm]").forEach(b => b.onclick = () => { syncInputs(); L.words.splice(+b.dataset.rm, 1); draw(); });
    $$("[data-noimg]").forEach(b => b.onclick = () => { syncInputs(); delete L.words[+b.dataset.noimg].img; draw(); });
    $$("[data-say]").forEach(b => b.onclick = () => { syncInputs(); say(L.words[+b.dataset.say].fr, "fr"); });
    let picFor = null;
    $$("[data-pic]").forEach(b => b.onclick = () => {
      syncInputs();
      if (trayPick != null && L.tray[trayPick]) { L.words[+b.dataset.pic].img = L.tray[trayPick].url; delete L.words[+b.dataset.pic].credit; L.tray.splice(trayPick, 1); trayPick = null; draw(); return; }
      picFor = +b.dataset.pic; $("#onepic").click();
    });
    $$("[data-tray]").forEach(b => b.onclick = () => { syncInputs(); trayPick = trayPick === +b.dataset.tray ? null : +b.dataset.tray; draw(); });
    $$("[data-untray]").forEach(b => b.onclick = () => { syncInputs(); L.tray.splice(+b.dataset.untray, 1); trayPick = null; draw(); });
    const addImages = async files => {
      syncInputs();
      files = files.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|gif|webp|svg|heic|heif|bmp)$/i.test(f.name));
      if (!files.length) return toast("Keine Bilder gefunden.");
      let k = 0;
      for (const f of files) {
        toast(`Bild ${++k} von ${files.length} wird gespeichert …`, 8000);
        try { L.tray.push({ url: await storeImageFile(f), name: f.name.replace(/^.*\//, "") }); } catch (err) { toast(err.message, 6000); }
      }
      const n = autoMatchTray(L);
      warnIfNoStorage(); draw();
      toast(`${files.length} Bilder hochgeladen, ${n} automatisch zugeordnet.${L.tray.length ? ` ${L.tray.length} warten in der Ablage.` : ""} Speichern nicht vergessen!`, 5000);
    };
    $("#imgs").onchange = e => { const f = [...e.target.files]; e.target.value = ""; addImages(f); };
    $("#imgDir").onchange = e => { const f = [...e.target.files]; e.target.value = ""; addImages(f); };
    $("#imgZip").onchange = async e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      try { addImages(await unzipImages(f)); } catch (err) { toast(err.message, 6000); }
    };
    const imgDrop = $("#imgDrop");
    imgDrop.ondragover = e => { e.preventDefault(); imgDrop.classList.add("over"); };
    imgDrop.ondragleave = () => imgDrop.classList.remove("over");
    imgDrop.ondrop = async e => {
      e.preventDefault(); imgDrop.classList.remove("over");
      const files = [];
      const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry?.()).filter(Boolean);
      if (items.length) { for (const it of items) await walkEntry(it, files); } else files.push(...e.dataTransfer.files);
      const zips = files.filter(f => /\.zip$/i.test(f.name));
      for (const z of zips) files.push(...await unzipImages(z).catch(() => []));
      addImages(files.filter(f => !/\.zip$/i.test(f.name)));
    };
    $("#onepic").onchange = async e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f || picFor == null) return;
      toast("Bild wird gespeichert …");
      try { L.words[picFor].img = await storeImageFile(f); delete L.words[picFor].credit; warnIfNoStorage(); draw(); } catch (err) { toast(err.message, 6000); }
    };
    $("#save").onclick = async () => {
      syncInputs();
      L.words = L.words.filter(w => w.fr);
      if (!L.title) return toast("Bitte einen Titel eingeben.");
      if (!L.words.length) return toast("Die Lektion braucht mindestens ein Wort.");
      const missing = L.words.filter(w => !w.tr).length;
      const { _new, ...data } = L;
      try {
        await Store.put("lesson", L.id, data);
        toast(missing ? `Gespeichert. Achtung: ${missing} Wörter ohne Übersetzung.` : "Lektion gespeichert ✔");
        await loadAll(); T.tab = "lessons"; showTab();
      } catch (e) { toast(e.message); }
    };
    $("#del") && ($("#del").onclick = async () => {
      if (!await confirmBox(`Lektion „${L.title}“ löschen? Der Fortschritt der Kinder zu dieser Lektion geht verloren.`, "Löschen", "Abbrechen", true)) return;
      await Store.del("lesson", L.id); await loadAll(); T.tab = "lessons"; showTab(); toast("Lektion gelöscht.");
    });
  };
  draw();
}

// Bilder aus der Ablage per Dateiname den Wörtern ohne Bild zuordnen
function autoMatchTray(L) {
  if (!L.tray?.length) return 0;
  const { matched } = matchImages(L.tray, L.words.filter(w => !w.img));
  for (const m of matched) { m.w.img = m.f.url; L.tray.splice(L.tray.indexOf(m.f), 1); }
  return matched.length;
}
// Ordner beim Hineinziehen durchsuchen
function walkEntry(entry, out) {
  return new Promise(res => {
    if (entry.isFile) entry.file(f => { out.push(f); res(); }, () => res());
    else if (entry.isDirectory) {
      const r = entry.createReader(), all = [];
      const read = () => r.readEntries(async ents => { if (!ents.length) { for (const e of all) await walkEntry(e, out); res(); } else { all.push(...ents); read(); } }, () => res());
      read();
    } else res();
  });
}
// Bilder aus einer ZIP-Datei holen
async function unzipImages(file) {
  if (!window.JSZip) await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"; sc.onload = res; sc.onerror = () => rej(new Error("ZIP-Programm konnte nicht geladen werden.")); document.head.appendChild(sc); });
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const out = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || name.startsWith("__MACOSX") || /(^|\/)\./.test(name)) continue;
    const m = name.match(/\.(jpe?g|png|gif|webp|svg|bmp)$/i); if (!m) continue;
    const blob = await entry.async("blob");
    const type = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp" }[m[1].toLowerCase()];
    out.push(new File([blob], name.split("/").pop(), { type }));
  }
  if (!out.length) throw new Error("In der ZIP-Datei sind keine Bilder.");
  return out;
}

// ------------------------------------------------------------------
//  Kinder
// ------------------------------------------------------------------
function studentsTab(el) {
  el.innerHTML = `<div class="grid2">
    <div class="t-panel no-print"><h2>Kinder hinzufügen</h2>
      <div class="field"><label for="names">Vornamen, einer pro Zeile</label><textarea class="input" id="names" placeholder="Emma&#10;Noah&#10;Inês" style="font-family:inherit"></textarea></div>
      <button class="btn green small" id="addk" style="justify-self:start">Hinzufügen</button>
      <p class="small muted" style="margin:0">Jedes Kind bekommt automatisch eine Bild-PIN aus 3 Bildern. Bitte nur Vornamen verwenden (Datenschutz).</p>
    </div>
    <div class="t-panel"><div class="row between"><h2>PIN-Karten</h2><button class="btn ghost small no-print" id="print">🖨 Drucken</button></div>
      <p class="small muted no-print" style="margin:0">Zum Ausschneiden und Verteilen. Klassencode: <b>${esc(Store.code)}</b></p>
      <div class="pin-cards">${T.students.map(s => `<div class="pin-card"><b>${esc(s.name)}</b><span class="p">${(s.pinHint || []).map(e => art(e)).join("") || "—"}</span><span class="small muted">Code: ${esc(Store.code)}</span></div>`).join("") || `<span class="muted">Noch keine Kinder.</span>`}</div>
    </div>
  </div>
  <div class="t-panel no-print" style="margin-top:16px"><h2>Alle Kinder (${T.students.length})</h2>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Bild-PIN</th><th></th></tr></thead><tbody>
    ${T.students.map(s => `<tr><td><b>${esc(s.name)}</b></td><td><span class="pin-inline">${(s.pinHint || []).map(e => art(e)).join("")}</span> <span class="small muted">${(s.pinHint || []).map(e => PIN_NAMES[e] || e).join(", ")}</span></td><td class="row" style="gap:6px;justify-content:flex-end"><button class="btn ghost small" data-pin="${esc(s.id)}">Neue PIN</button><button class="btn ghost small" data-ren="${esc(s.id)}">Umbenennen</button><button class="btn ghost small" data-delk="${esc(s.id)}">Entfernen</button></td></tr>`).join("")}
    </tbody></table></div></div>`;
  $("#print").onclick = () => window.print();
  $("#addk").onclick = async () => {
    const names = splitLines($("#names").value).map(n => n.slice(0, 30));
    if (!names.length) return toast("Bitte mindestens einen Namen eingeben.");
    for (const name of names) {
      const pin = randomPin(), id = uid("s-");
      await Store.put("student", id, { name, pinHash: await pinHash(Store.code, pin), pinHint: pin, created: Date.now() });
    }
    toast(`${names.length} Kinder angelegt.`); await loadAll(); studentsTab(el);
  };
  $$("[data-pin]", el).forEach(b => b.onclick = async () => {
    const s = T.students.find(x => x.id === b.dataset.pin); const pin = randomPin();
    await Store.put("student", s.id, { ...s, pinHash: await pinHash(Store.code, pin), pinHint: pin });
    toast(`Neue PIN für ${s.name}: ${pin.map(e => PIN_NAMES[e] || e).join(", ")}`); await loadAll(); studentsTab(el);
  });
  $$("[data-ren]", el).forEach(b => b.onclick = async () => {
    const s = T.students.find(x => x.id === b.dataset.ren);
    const r = await modal(`<h2>Umbenennen</h2><input class="input" id="rn" value="${esc(s.name)}"><div class="row" style="justify-content:flex-end"><button class="btn ghost small" data-close="">Abbrechen</button><button class="btn green small" id="ok">Speichern</button></div>`,
      { onMount: (m, close) => { const i = m.querySelector("#rn"); i.focus(); m.querySelector("#ok").onclick = () => close(i.value.trim()); } });
    if (r) { await Store.put("student", s.id, { ...s, name: r.slice(0, 30) }); await loadAll(); studentsTab(el); }
  });
  $$("[data-delk]", el).forEach(b => b.onclick = async () => {
    const s = T.students.find(x => x.id === b.dataset.delk);
    if (!await confirmBox(`${s.name} und den ganzen Lernfortschritt entfernen?`, "Entfernen", "Abbrechen", true)) return;
    await Store.del("student", s.id); await Store.del("progress", s.id); await loadAll(); studentsTab(el);
  });
}

// ------------------------------------------------------------------
//  Einstellungen
// ------------------------------------------------------------------
function settings(el) {
  const g = T.cls.goal || { title: "Leuchtturm bauen", target: 300 };
  const link = location.origin + location.pathname + "#k=" + encodeURIComponent(Store.code);
  el.innerHTML = `<div class="grid2">
    <div class="t-panel"><h2>Klasse</h2>
      <div class="field"><label for="cn">Name</label><input class="input" id="cn" value="${esc(T.cls.name)}"></div>
      <div class="field"><label for="gt">Klassenziel (Name)</label><input class="input" id="gt" value="${esc(g.title)}"></div>
      <div class="field"><label for="gn">Klassenziel: richtige Antworten pro Woche</label><input class="input" id="gn" type="number" min="10" value="${g.target}"></div>
      <p class="small muted" style="margin:0">Richtwert: ca. 40–60 richtige Antworten pro Kind und Woche.</p>
      <label class="check"><input type="checkbox" id="ao" ${T.cls.allOpen ? "checked" : ""}> Alle Inseln von Anfang an offen (sonst nacheinander)</label>
      <button class="btn green small" id="sv" style="justify-self:start">Speichern</button>
    </div>
    <div class="t-panel"><h2>Link für die Kinder</h2>
      <p class="small" style="margin:0">Mit diesem Link ist der Klassencode schon eingetragen. Als Lesezeichen auf dem iPad-Home-Bildschirm speichern (Teilen → „Zum Home-Bildschirm“).</p>
      <input class="input" id="lnk" value="${esc(link)}" readonly>
      <button class="btn blue small" id="cp" style="justify-self:start">Link kopieren</button>
      <h2 style="margin-top:8px">Lehrer-PIN ändern</h2>
      <div class="field"><label for="np1">Neue PIN</label><input class="input" id="np1" type="password" inputmode="numeric" autocomplete="new-password"></div>
      <button class="btn ghost small" id="pinsv" style="justify-self:start">PIN ändern</button>
    </div>
    <div class="t-panel"><h2>Sicherung</h2>
      <p class="small muted" style="margin:0">Alle Lektionen, Kinder und Fortschritte als Datei sichern oder wiederherstellen.</p>
      <div class="row"><button class="btn blue small" id="exp">⬇ Sicherung herunterladen</button><label class="btn ghost small" for="impf">⬆ Sicherung einspielen</label><input type="file" id="impf" class="hidden" accept=".json"></div>
      <h2 style="margin-top:8px">Speicherort</h2>
      <p class="small" style="margin:0">${isCloud ? "✅ Online-Datenbank (Supabase) ist verbunden. Alle Geräte sehen dieselben Daten." : "⚠️ Demo-Modus: Daten liegen nur auf diesem Gerät. Für die Klassenübersicht Supabase einrichten (README, Schritt 2)."}</p>
      ${isCloud ? `<p class="small" style="margin:0" id="bucketState">Bildspeicher: wird geprüft …</p>` : ""}
    </div>
  </div>`;
  $("#sv").onclick = async () => {
    T.cls = { ...T.cls, name: $("#cn").value.trim() || T.cls.name, goal: { title: $("#gt").value.trim() || "Klassenziel", target: Math.max(10, +$("#gn").value || 300) }, allOpen: $("#ao").checked };
    await Store.put("class", "main", T.cls); toast("Gespeichert ✔");
  };
  if ($("#bucketState")) Store.checkImageStorage().then(ok => {
    const el = $("#bucketState"); if (!el) return;
    el.innerHTML = ok ? "✅ Bildspeicher eingerichtet: Bilder werden in hoher Auflösung gespeichert."
      : "⚠️ Bildspeicher noch nicht eingerichtet: Bilder werden verkleinert gespeichert. Zum Einrichten in Supabase im SQL Editor die Datei <b>supabase/setup-bilder.sql</b> ausführen.";
  });
  $("#cp").onclick = async () => { try { await navigator.clipboard.writeText(link); toast("Link kopiert."); } catch { $("#lnk").select(); toast("Bitte den markierten Link kopieren."); } };
  $("#pinsv").onclick = async () => {
    const p = $("#np1").value.trim(); if (!/^\d{4,}$/.test(p)) return toast("Die PIN braucht mindestens 4 Ziffern.");
    T.cls = { ...T.cls, teacherPinHash: await sha(`${Store.code}#teacher#${p}`) }; await Store.put("class", "main", T.cls); $("#np1").value = ""; toast("PIN geändert ✔");
  };
  $("#exp").onclick = async () => {
    const data = { app: "vokabel-insel", version: 1, code: Store.code, exported: new Date().toISOString(), class: T.cls, students: T.students, lessons: T.lessons, progress: Object.entries(T.progs).map(([id, p]) => ({ ...p, id })) };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `vokabel-insel-${Store.code}-${todayStr()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $("#impf").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d.app !== "vokabel-insel") throw new Error("Das ist keine Sicherung dieser App.");
      if (!await confirmBox(`Sicherung vom ${new Date(d.exported).toLocaleDateString("de")} einspielen? Vorhandene Einträge mit gleicher ID werden überschrieben.`, "Einspielen")) return;
      const { teacherPinHash, ...clsRest } = d.class || {};
      await Store.put("class", "main", { ...T.cls, ...clsRest });
      for (const s of d.students || []) await Store.put("student", s.id, s);
      for (const l of d.lessons || []) await Store.put("lesson", l.id, l);
      for (const p of d.progress || []) await Store.put("progress", p.id, p);
      toast("Sicherung eingespielt ✔"); dashboard();
    } catch (err) { toast(err.message); }
  };
}
