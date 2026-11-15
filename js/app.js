import { Store, Device, isCloud } from "./store.js";
import { render, $, toast } from "./ui.js";
import { esc } from "./util.js";
import { studentLogin } from "./student.js";
import { teacherLogin } from "./teacher.js";

// Link mit Klassencode: …/#k=SONNE-4821
const m = location.hash.match(/k=([^&]+)/);
if (m) { Device.set("classCode", Store.normCode(decodeURIComponent(m[1]))); history.replaceState(null, "", location.pathname); }

function start() {
  document.body.classList.remove("teacher-mode");
  const code = Device.get("classCode", "");
  render(`<div class="wrap narrow">
    <div class="hero"><div style="font-size:4.5rem">🏝️</div><h1>Vokabel-Insel</h1><p>Entdecke Wörter, sammle Sterne, segle von Insel zu Insel.</p></div>
    <div class="role-grid">
      <button class="role-card" id="kid"><span class="em">🧒</span><b>Ich bin ein Kind</b><span class="muted">${code ? `Klasse ${esc(code)}` : "Los geht's!"}</span></button>
      <button class="role-card" id="teacher"><span class="em">🧑‍🏫</span><b>Lehrkraft</b><span class="muted">Lektionen & Fortschritt</span></button>
    </div>
    ${!isCloud ? `<p class="center" style="color:#fff;font-size:.9rem">Demo-Modus · zum Ausprobieren Klassencode <b>DEMO</b> (Kinder-PIN 🐶🍎⭐, Lehrer-PIN 1234)</p>` : ""}
  </div>`);
  $("#kid").onclick = () => code ? openClass(code) : enterCode();
  $("#teacher").onclick = () => teacherLogin(start);
}

function enterCode() {
  render(`<div class="wrap narrow">
    <div class="row"><button class="icon-btn" id="back" aria-label="Zurück">⬅️</button></div>
    <div class="hero"><h1>Klassencode</h1><p>Den Code bekommst du von deiner Lehrkraft.</p></div>
    <div class="panel stack">
      <input class="input" id="code" style="font-size:1.8rem;text-align:center;font-family:var(--f-display);text-transform:uppercase" autocapitalize="characters" autocomplete="off" placeholder="SONNE-4821" aria-label="Klassencode">
      <button class="btn big green" id="go">Weiter ➜</button>
    </div></div>`);
  $("#back").onclick = start;
  const go = () => { const c = Store.normCode($("#code").value); if (c) openClass(c, true); };
  $("#go").onclick = go;
  $("#code").onkeydown = e => { if (e.key === "Enter") go(); };
  $("#code").focus();
}

async function openClass(code, fresh = false) {
  render(`<div class="wrap narrow"><div class="panel center">Suche Klasse …</div></div>`);
  try {
    const cls = await Store.classExists(code);
    if (!cls) { toast("Diese Klasse gibt es nicht. Frag deine Lehrkraft nach dem Code."); Device.del("classCode"); return fresh ? enterCode() : start(); }
    Store.code = Store.normCode(code);
    Device.set("classCode", Store.code);
    studentLogin(cls, start);
  } catch (e) {
    render(`<div class="wrap narrow"><div class="panel stack"><b>Keine Verbindung</b><span>${esc(e.message)}</span><button class="btn" id="re">Nochmal versuchen</button><button class="btn ghost" id="other">Anderen Klassencode eingeben</button></div></div>`);
    $("#re").onclick = () => openClass(code);
    $("#other").onclick = enterCode;
  }
}

start();
