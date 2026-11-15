// Vorlesen (Sprachausgabe) und Spracherkennung – beides im Browser eingebaut
const LANGS = { fr: ["fr-FR", "fr-CA", "fr"], de: ["de-DE", "de-AT", "de"], pt: ["pt-PT", "pt-BR", "pt"] };

let voices = [];
function loadVoices() { try { voices = window.speechSynthesis?.getVoices() || []; } catch { voices = []; } }
loadVoices();
if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = loadVoices;

function pickVoice(lang) {
  if (!voices.length) loadVoices();
  for (const code of LANGS[lang] || [lang]) {
    const cands = voices.filter(v => v.lang && v.lang.toLowerCase().replace("_", "-").startsWith(code.toLowerCase()));
    if (cands.length) {
      // natürlichere Stimmen bevorzugen
      return cands.find(v => /premium|enhanced|natural|google|amélie|thomas|audrey|joana|anna/i.test(v.name)) || cands[0];
    }
  }
  return null;
}

export const canSpeakOut = !!window.speechSynthesis;

export function say(text, lang = "fr", rate = 0.85) {
  return new Promise(resolve => {
    if (!window.speechSynthesis || !text) return resolve(false);
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/\s*\/\s*/g, ", "));
      const v = pickVoice(lang);
      if (v) u.voice = v;
      u.lang = v?.lang || (LANGS[lang] || [lang])[0];
      u.rate = rate;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      window.speechSynthesis.speak(u);
      setTimeout(() => resolve(true), 6000);
    } catch { resolve(false); }
  });
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = !!SR;

// Hört zu und liefert mögliche erkannte Wörter
export function listen(lang = "fr", { onStart, onInterim } = {}) {
  return new Promise(resolve => {
    if (!SR) return resolve({ alts: [], error: "unsupported" });
    let rec;
    try { rec = new SR(); } catch { return resolve({ alts: [], error: "unsupported" }); }
    rec.lang = (LANGS[lang] || [lang])[0];
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 5;
    const alts = new Set();
    let done = false, err = null;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); try { rec.stop(); } catch {} resolve({ alts: [...alts], error: alts.size ? null : err }); };
    rec.onstart = () => onStart && onStart();
    rec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        for (let j = 0; j < r.length; j++) if (r[j].transcript) alts.add(r[j].transcript);
        if (onInterim) onInterim(r[0].transcript);
        if (r.isFinal) setTimeout(finish, 150);
      }
    };
    rec.onerror = e => { err = e.error || "error"; if (err !== "no-speech") finish(); };
    rec.onend = () => finish();
    const timer = setTimeout(finish, 7000);
    try { rec.start(); } catch (e) { err = "start"; finish(); }
  });
}
