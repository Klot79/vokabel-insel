// Datenspeicher: Supabase (gemeinsam) oder localStorage (Demo-Modus)
import { seedDemo } from "./demo.js";

const cfg = window.VOKABEL_CONFIG || {};
export const isCloud = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

const LS_PREFIX = "vi:";

function lsKey(code, kind, id) { return `${LS_PREFIX}${code}|${kind}|${id}`; }

const local = {
  async get(code, kind) {
    const out = [];
    const pre = `${LS_PREFIX}${code}|${kind}|`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(pre)) {
        try { out.push({ id: k.slice(pre.length), ...JSON.parse(localStorage.getItem(k)) }); } catch {}
      }
    }
    return out;
  },
  async put(code, kind, id, data) {
    try {
      localStorage.setItem(lsKey(code, kind, id), JSON.stringify({ data, updated_at: new Date().toISOString() }));
    } catch (e) {
      throw new Error("Der Gerätespeicher ist voll. Bitte Bilder verkleinern oder Supabase einrichten.");
    }
  },
  async del(code, kind, id) { localStorage.removeItem(lsKey(code, kind, id)); },
};

async function rpc(fn, body) {
  const res = await fetch(`${cfg.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: cfg.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Verbindung zur Datenbank fehlgeschlagen (${res.status}). ${t.slice(0, 160)}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

const cloud = {
  async get(code, kind) { return (await rpc("vs_get", { p_code: code, p_kind: kind })) || []; },
  async put(code, kind, id, data) { await rpc("vs_put", { p_code: code, p_kind: kind, p_id: id, p_data: data }); },
  async del(code, kind, id) { await rpc("vs_del", { p_code: code, p_kind: kind, p_id: id }); },
};

const backend = isCloud ? cloud : local;

// ---- öffentliche API -----------------------------------------
export const Store = {
  code: null,

  normCode(c) { return String(c || "").trim().toUpperCase().replace(/\s+/g, ""); },

  async classExists(code) {
    code = this.normCode(code);
    if (!isCloud && code === "DEMO") await seedDemo(local);
    const rows = await backend.get(code, "class");
    const r = rows.find(r => r.id === "main");
    return r ? { ...r.data, _updated: r.updated_at } : null;
  },

  async list(kind) {
    const rows = await backend.get(this.code, kind);
    return rows.map(r => ({ id: r.id, ...r.data, _updated: r.updated_at }));
  },
  async getOne(kind, id) {
    const rows = await backend.get(this.code, kind);
    const r = rows.find(x => x.id === id);
    return r ? { id: r.id, ...r.data, _updated: r.updated_at } : null;
  },
  async put(kind, id, obj) {
    const { id: _i, _updated, ...data } = obj;
    await backend.put(this.code, kind, id, data);
  },
  async del(kind, id) { await backend.del(this.code, kind, id); },

  async createClass(code, data) {
    code = this.normCode(code);
    await backend.put(code, "class", "main", data);
    this.code = code;
  },
};

// Merkt sich Klassencode & letzte Rolle auf diesem Gerät
export const Device = {
  get(k, d = null) { try { const v = localStorage.getItem("vi-dev:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("vi-dev:" + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem("vi-dev:" + k); } catch {} },
};

export { uid, sha } from "./util.js";
