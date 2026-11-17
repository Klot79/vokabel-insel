import { Store, Device, isCloud } from "./store.js?v=20261117k";
import { render, $, toast } from "./ui.js?v=20261117k";
import { esc } from "./util.js?v=20261117k";
import { art } from "./art.js?v=20261117k";
import { studentLogin } from "./student.js?v=20261117k";
import { teacherLogin } from "./teacher.js?v=20261117k";
import { t, setLang, getLang, UI_LANGS } from "./i18n.js?v=20261117k";

const langRow = () => `<div class="lang-pick">${UI_LANGS.map(x => `<button class="lang-btn ${getLang() === x.k ? "on" : ""}" data-lang="${x.k}"><span class="flag-big">${x.flag}</span>${x.name}</button>`).join("")}</div>`;
const bindLang = redraw => document.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { setLang(b.dataset.lang); document.documentElement.lang = getLang(); redraw(); });
document.documentElement.lang = getLang();

// Link mit Klassencode: …/#k=SONNE-4821
const m = location.hash.match(/k=([^&]+)/);
if (m) { Device.set("classCode", Store.normCode(decodeURIComponent(m[1]))); history.replaceState(null, "", location.pathname); }

function start() {
  document.body.classList.remove("teacher-mode", "kid-mode");
  const code = Device.get("classCode", "");
  render(`<div class="wrap narrow">
    <div class="start-top"><button class="teacher-link" id="teacher" aria-label="${t("Lehrkraft")}">${art("clipboard")}<span>${t("Lehrkraft")}</span></button></div>
    <div class="hero"><span class="mascot">${art("parrot")}</span><h1>Plapperlapapp</h1><p>${t("Französisch üben, Sterne sammeln, von Insel zu Insel segeln.")}</p></div>
    <button class="role-card kid start-kid" id="kid"><span class="art-bg">${art("book")}</span><b>${t("Los geht's!")}</b><span>${code ? t("Klasse {c}", { c: esc(code) }) : t("Ich bin ein Kind")}</span></button>
    ${langRow()}
    ${!isCloud ? `<p class="center small muted">Demo-Modus · zum Ausprobieren Klassencode <b>DEMO</b> (Kinder-PIN Hund, Apfel, Stern · Lehrer-PIN 1234)</p>` : ""}
  </div>`);
  $("#kid").onclick = () => code ? openClass(code) : enterCode();
  $("#teacher").onclick = () => teacherLogin(start);
  bindLang(start);
}

function enterCode() {
  render(`<div class="wrap narrow">
    <div class="row"><button class="btn ghost small" id="back">${t("Zurück")}</button></div>
    <div class="hello"><span class="mascot">${art("parrot")}</span><div class="bubble"><h1>${t("Klassencode")}</h1><p>${t("Den Code bekommst du von deiner Lehrkraft.")}</p></div></div>
    <div class="panel stack">
      <input class="input" id="code" style="font-size:1.8rem;text-align:center;font-family:var(--f-display);text-transform:uppercase" autocapitalize="characters" autocomplete="off" placeholder="SONNE-4821" aria-label="${t("Klassencode")}">
      <button class="btn big green" id="go">${t("Weiter ➜")}</button>
    </div></div>`);
  $("#back").onclick = start;
  const go = () => { const c = Store.normCode($("#code").value); if (c) openClass(c, true); };
  $("#go").onclick = go;
  $("#code").onkeydown = e => { if (e.key === "Enter") go(); };
  $("#code").focus();
}

async function openClass(code, fresh = false) {
  render(`<div class="wrap narrow"><div class="panel center">${t("Suche Klasse …")}</div></div>`);
  try {
    const cls = await Store.classExists(code);
    if (!cls) { toast(t("Diese Klasse gibt es nicht. Frag deine Lehrkraft nach dem Code.")); Device.del("classCode"); return fresh ? enterCode() : start(); }
    Store.code = Store.normCode(code);
    Device.set("classCode", Store.code);
    studentLogin(cls, start);
  } catch (e) {
    render(`<div class="wrap narrow"><div class="panel stack"><b>${t("Keine Verbindung")}</b><span>${esc(e.message)}</span><button class="btn" id="re">${t("Nochmal versuchen")}</button><button class="btn ghost" id="other">${t("Anderen Klassencode eingeben")}</button></div></div>`);
    $("#re").onclick = () => openClass(code);
    $("#other").onclick = enterCode;
  }
}

start();
