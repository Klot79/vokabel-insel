export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export async function sha(text) {
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 0; for (const ch of text) h = (h * 31 + ch.codePointAt(0)) | 0;
  return "x" + (h >>> 0).toString(16);
}

export const PIN_EMOJI = ["🐶", "🐱", "🦊", "🍎", "🍌", "🍓", "⭐", "🌙", "☀️"];
export const pinHash = (code, pin) => sha(`${String(code).toUpperCase()}#${pin.join("")}`);
export function randomPin() { return Array.from({ length: 3 }, () => PIN_EMOJI[Math.floor(Math.random() * PIN_EMOJI.length)]); }

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const LANG_NAME = { de: "Deutsch", pt: "Português", fr: "Français" };
export const LANG_FLAG = { de: "🇩🇪", pt: "🇵🇹", fr: "🇫🇷" };
