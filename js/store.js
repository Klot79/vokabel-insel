// Datenspeicher: Supabase (gemeinsam) oder localStorage (Demo-Modus)
// ------------------------------------------------------------------
//  Sicherheits-Update (supabase/update-sicherheit.sql):
//  • Kinder dürfen nur ihren Fortschritt, ihre Zeichnungen und den
//    Klassenziel-Zähler schreiben. Lektionen, Kinder und Einstellungen
//    ändert nur, wer die Lehrer-PIN kennt – die Datenbank prüft das.
//  • Lehrer-PIN und Bild-PINs der Kinder sind für Kinder-Geräte unsichtbar.
//  Ohne das Update funktioniert die App wie vorher („alter Modus“).
// ------------------------------------------------------------------
import { seedDemo } from "./demo.js?v=20261118g";
import { uid, sha } from "./util.js?v=20261118g";

const cfg = window.VOKABEL_CONFIG || {};
export const isCloud = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

const LS_PREFIX = "vi:";
const BUCKET = "vokabel-bilder";

function shrinkBlob(blob, max) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
      const c = document.createElement("canvas");
      c.width = Math.round((img.naturalWidth || max) * r); c.height = Math.round((img.naturalHeight || max) * r);
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); c.toBlob(b => resolve(b || blob), "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
}

// Fehlerarten, auf die die App reagiert
export class ResetError extends Error { constructor() { super("Der Fortschritt wurde von der Lehrkraft zurückgesetzt."); this.reset = true; } }
export class OfflineError extends Error { constructor() { super("Keine Internetverbindung."); this.offline = true; } }

// ---- Demo-Modus: alles im Gerätespeicher (verhält sich wie das Sicherheits-Update) ----
function lsKey(code, kind, id) { return `${LS_PREFIX}${code}|${kind}|${id}`; }
const local = {
  rows(code, kind) {
    const out = [], pre = `${LS_PREFIX}${code}|${kind}|`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(pre)) { try { out.push({ id: k.slice(pre.length), ...JSON.parse(localStorage.getItem(k)) }); } catch {} }
    }
    return out;
  },
  async get(code, kind) { return this.rows(code, kind); },
  async put(code, kind, id, data, teacher) {
    if (kind === "progress" && !teacher) {
      const old = this.rows(code, kind).find(r => r.id === id);
      if (old && (old.data?.gen ?? null) !== (data?.gen ?? null)) throw new ResetError();
    }
    try { localStorage.setItem(lsKey(code, kind, id), JSON.stringify({ data, updated_at: new Date().toISOString() })); }
    catch (e) { throw new Error("Der Gerätespeicher ist voll. Bitte Bilder verkleinern oder Supabase einrichten."); }
  },
  async del(code, kind, id) { localStorage.removeItem(lsKey(code, kind, id)); },
};

// ---- Supabase ----
async function rpc(fn, body) {
  let res;
  try {
    res = await fetch(`${cfg.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch { throw new OfflineError(); }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (/RESET/.test(t)) throw new ResetError();
    const e = new Error(/LEHRER/.test(t) ? "Keine Berechtigung: Bitte als Lehrkraft neu anmelden." : `Verbindung zur Datenbank fehlgeschlagen (${res.status}). ${t.slice(0, 160)}`);
    e.status = res.status; e.body = t;
    throw e;
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// Bei „l'…“-Wörtern ist ein Zusatz wie „(un)“ / „(une)“ unnötig – er fällt automatisch weg
export function cleanFr(fr) {
  const s = String(fr ?? "");
  if (!/(^|[\/;|]\s*)l['’]/i.test(s)) return s;
  return s.replace(/\s*[(\[]\s*(un|une|m|f|masc\.?|fém\.?|fem\.?)\s*[)\]]/gi, "").replace(/\s{2,}/g, " ").trim();
}
function cleanLesson(o) {
  if (o && Array.isArray(o.words)) o.words = o.words.map(w => (w && typeof w.fr === "string" ? { ...w, fr: cleanFr(w.fr) } : w));
  return o;
}

// ---- Klassenschlüssel ------------------------------------------
//  Namen, Lernhilfen, Bild-PIN-Anzeige und Wochenberichte werden auf dem
//  Gerät verschlüsselt (AES-GCM, 256 Bit), bevor sie zur Datenbank gehen.
//  Der Schlüssel steht nur im Klassen-Link hinter „#“ – dieser Teil wird
//  vom Browser nie an einen Server geschickt – und im Gerätespeicher.
// ------------------------------------------------------------------
const b64u = {
  enc: u8 => { let b = ""; u8.forEach(x => b += String.fromCharCode(x)); return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  dec: s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0)),
};
const SEALED = { student: ["name", "help"] };        // stecken zusammen in „sec“
const SEALED_SINGLE = { student: ["pinHint"] };      // bleiben eigene Felder (die Datenbank blendet sie für Kinder aus)
const isReport = (kind, id) => kind === "class" && /^report-/.test(String(id));
const isSealed = v => typeof v === "string" && v.startsWith("v1.");
async function importKey(raw) { return crypto.subtle.importKey("raw", b64u.dec(raw), "AES-GCM", false, ["encrypt", "decrypt"]); }
async function encObj(key, obj, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) }, key, new TextEncoder().encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return "v1." + b64u.enc(out);
}
async function decObj(key, str, aad) {
  const u = b64u.dec(String(str).slice(3));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12), additionalData: new TextEncoder().encode(aad) }, key, u.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}
export class KeyMissingError extends Error { constructor() { super("Auf diesem Gerät fehlt der Klassenschlüssel. Bitte den Klassen-Link öffnen."); this.keyMissing = true; } }

// ---- öffentliche API -----------------------------------------
export const Store = {
  code: null,
  teacherHash: null,       // gesetzt nach erfolgreicher Lehrer-Anmeldung
  v2: !isCloud,            // Sicherheits-Update installiert? (Demo: immer)
  _probe: null,

  normCode(c) { return String(c || "").trim().toUpperCase().replace(/\s+/g, ""); },

  // ---- Klassenschlüssel ----
  _key: null, _keyId: null,
  keyRaw(code = this.code) { return code ? Device.get("key:" + this.normCode(code), null) : null; },
  setKey(code, raw) { Device.set("key:" + this.normCode(code), raw); this._keyId = null; },
  forgetKey(code = this.code) { Device.del("key:" + this.normCode(code)); this._keyId = null; },
  newKeyRaw() { return b64u.enc(crypto.getRandomValues(new Uint8Array(32))); },
  parseKey(text) {   // nimmt einen ganzen Klassen-Link oder nur den Schlüssel
    const t = String(text || "").trim();
    const m = t.match(/[#&?]s=([A-Za-z0-9_-]{40,})/) || t.match(/^([A-Za-z0-9_-]{43})$/);
    const c = t.match(/[#&?]k=([^&]+)/);
    return m ? { key: m[1], code: c ? this.normCode(decodeURIComponent(c[1])) : null } : null;
  },
  async key() {
    const raw = this.keyRaw(); if (!raw) return null;
    const id = this.code + "|" + raw;
    if (this._keyId !== id) { try { this._key = await importKey(raw); } catch { this._key = null; } this._keyId = id; }
    return this._key;
  },
  async keyMatches(cls) {
    const k = await this.key(); if (!k || !cls?.keyCheck) return false;
    try { return (await decObj(k, cls.keyCheck, "check")) === "ok"; } catch { return false; }
  },
  async makeKeyCheck() { const k = await this.key(); if (!k) throw new KeyMissingError(); return encObj(k, "ok", "check"); },
  classLink(code = this.code) {
    const raw = this.keyRaw(code);
    return location.origin + location.pathname + "#k=" + encodeURIComponent(code) + (raw ? "&s=" + raw : "");
  },
  async _seal(kind, id, data) {
    const rep = isReport(kind, id), many = SEALED[kind], single = SEALED_SINGLE[kind];
    if (!rep && !many && !single) return data;
    const k = await this.key();
    if (!k) throw new KeyMissingError();
    const aad = `${kind}|${id}`;
    if (rep) { const { type, week, created } = data; return { type, week, created, sec: await encObj(k, data, aad) }; }
    const out = { ...data }, secret = {};
    delete out.sec;
    for (const f of many || []) if (f in out) { secret[f] = out[f]; delete out[f]; }
    if (many) out.sec = await encObj(k, secret, aad);
    for (const f of single || []) if (f in out && out[f] != null && !isSealed(out[f])) out[f] = await encObj(k, out[f], aad + "|" + f);
    return out;
  },
  async _open(kind, row) {
    if (!row) return row;
    const rep = isReport(kind, row.id), many = SEALED[kind], single = SEALED_SINGLE[kind];
    if (!rep && !many && !single) return row;
    const aad = `${kind}|${row.id}`;
    if (!row.sec) return { ...row, _plain: true };          // noch nicht verschlüsselt (alte Daten)
    const k = await this.key();
    try {
      if (!k) throw 0;
      const sec = await decObj(k, row.sec, aad);
      if (rep) return { ...sec, id: row.id, _updated: row._updated };
      const { sec: _s, ...rest } = row, out = { ...rest, ...sec };
      for (const f of single || []) if (isSealed(out[f])) { try { out[f] = await decObj(k, out[f], aad + "|" + f); } catch { delete out[f]; } }
      return out;
    } catch {
      const { sec: _s, ...rest } = row;
      for (const f of single || []) delete rest[f];
      return { ...rest, name: "", _locked: true };
    }
  },

  // Prüft einmal, ob das Sicherheits-Update in Supabase installiert ist
  ready() {
    if (!isCloud) return Promise.resolve(true);
    if (!this._probe) this._probe = rpc("vs_get_one", { p_code: "____", p_kind: "class", p_id: "main" })
      .then(() => (this.v2 = true)).catch(e => { if (e.offline) { this._probe = null; throw e; } return (this.v2 = false); });
    return this._probe;
  },

  async _get(code, kind) {
    if (!isCloud) return local.get(code, kind);
    await this.ready();
    if (this.v2 && this.teacherHash) return (await rpc("vs_get_t", { p_code: code, p_kind: kind, p_hash: this.teacherHash })) || [];
    return (await rpc("vs_get", { p_code: code, p_kind: kind })) || [];
  },
  async _getOne(code, kind, id) {
    if (!isCloud) return local.rows(code, kind).find(r => r.id === id) || null;
    await this.ready();
    if (this.v2 && !this.teacherHash) { const r = await rpc("vs_get_one", { p_code: code, p_kind: kind, p_id: id }); return (r || [])[0] || null; }
    return (await this._get(code, kind)).find(r => r.id === id) || null;
  },
  async _put(code, kind, id, data) {
    if (!isCloud) return local.put(code, kind, id, data, !!this.teacherHash);
    await this.ready();
    if (this.v2 && this.teacherHash) return rpc("vs_put_t", { p_code: code, p_kind: kind, p_id: id, p_data: data, p_hash: this.teacherHash });
    return rpc("vs_put", { p_code: code, p_kind: kind, p_id: id, p_data: data });
  },
  async _del(code, kind, id) {
    if (!isCloud) return local.del(code, kind, id);
    await this.ready();
    if (this.v2) return rpc("vs_del_t", { p_code: code, p_kind: kind, p_id: id, p_hash: this.teacherHash || "" });
    return rpc("vs_del", { p_code: code, p_kind: kind, p_id: id });
  },

  async classExists(code) {
    code = this.normCode(code);
    if (!isCloud && code === "DEMO") await seedDemo(local);
    const r = await this._getOne(code, "class", "main");
    return r ? { ...r.data, _updated: r.updated_at } : null;
  },

  async list(kind) {
    const rows = await this._get(this.code, kind);
    let out = rows.map(r => ({ id: r.id, ...r.data, _updated: r.updated_at }));
    out = await Promise.all(out.map(o => this._open(kind, o)));
    return kind === "lesson" ? out.map(cleanLesson) : out;
  },
  async getOne(kind, id) {
    const r = await this._getOne(this.code, kind, id);
    const o = r ? await this._open(kind, { id: r.id, ...r.data, _updated: r.updated_at }) : null;
    return kind === "lesson" ? cleanLesson(o) : o;
  },
  async put(kind, id, obj) {
    const { id: _i, _updated, _locked, _plain, ...data } = kind === "lesson" ? cleanLesson({ ...obj }) : obj;
    await this._put(this.code, kind, id, await this._seal(kind, id, data));
  },
  async del(kind, id) { await this._del(this.code, kind, id); },

  // Lehrer-Anmeldung: die Datenbank prüft die PIN (alter Modus: Vergleich hier)
  async teacherLogin(code, pin) {
    code = this.normCode(code);
    const hash = await sha(`${code}#teacher#${pin}`);
    if (isCloud && !this.v2) { this._probe = null; await this.ready(); }   // Update evtl. erst nach dem Öffnen der Seite installiert
    if (isCloud && this.v2) {
      if (!(await rpc("vs_teacher_ok", { p_code: code, p_hash: hash }))) return false;
    } else {
      const cls = await this.classExists(code);
      if (!cls || cls.teacherPinHash !== hash) return false;
    }
    this.code = code; this.teacherHash = hash;
    return true;
  },
  teacherLogout() { this.teacherHash = null; },

  // Kinder-PIN prüfen (mit Update: in der Datenbank, die PIN ist auf dem Gerät nicht sichtbar)
  async checkKidPin(student, hash) {
    if (student.pinHash) return student.pinHash === hash;
    if (isCloud) return !!(await rpc("vs_kid_ok", { p_code: this.code, p_id: student.id, p_hash: hash }));
    return false;
  },

  // Bild speichern: online im Supabase-Speicher (volle Auflösung), sonst als Daten-URL
  async uploadImage(blob) {
    if (isCloud && !this._noBucket) {
      const base = cfg.SUPABASE_URL.replace(/\/$/, "");
      const path = `${this.code}/${uid("img-")}.jpg`;
      try {
        const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
          method: "POST",
          headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`, "Content-Type": blob.type || "image/jpeg", "x-upsert": "false" },
          body: blob,
        });
        if (res.ok) return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
        this._noBucket = true;
        console.warn("Bildspeicher nicht eingerichtet:", res.status, await res.text().catch(() => ""));
      } catch (e) { console.warn(e); }
    }
    const small = await shrinkBlob(blob, 600);
    return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(small); });
  },
  get imageStorageOk() { return isCloud && !this._noBucket; },
  async checkImageStorage() {
    if (!isCloud) return false;
    try {
      const r = await fetch(`${cfg.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/__probe__.jpg`);
      const ok = !/bucket not found/i.test(await r.text());
      if (!ok) this._noBucket = true;
      return ok;
    } catch { return false; }
  },

  async createClass(code, data, pin) {
    code = this.normCode(code);
    this.code = code;
    this.teacherHash = await sha(`${code}#teacher#${pin}`);
    await this._put(code, "class", "main", { ...data, teacherPinHash: this.teacherHash });
  },
};

// Merkt sich Klassencode, Sprache & nicht gesendete Daten auf diesem Gerät
export const Device = {
  get(k, d = null) { try { const v = localStorage.getItem("vi-dev:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("vi-dev:" + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem("vi-dev:" + k); } catch {} },
};

export { uid, sha } from "./util.js?v=20261118g";
