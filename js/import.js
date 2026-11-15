// Vokabellisten und Bilder importieren
// Formate Listen: Foto (JPG/PNG/HEIC/WebP), PDF, Word (.docx), Excel (.xlsx/.xls/.ods), CSV/TXT, eingefügter Text
// Formate Bilder: JPG, PNG, WebP, GIF, SVG, BMP, HEIC (HEIC nur in Safari/iPad)

const LIBS = {
  tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
  pdfjs: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  mammoth: "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js",
};
const loaded = {};
function loadScript(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.onload = res;
    s.onerror = () => rej(new Error("Zusatzprogramm konnte nicht geladen werden. Bitte Internetverbindung prüfen."));
    document.head.appendChild(s);
  });
  return loaded[src];
}

const ext = f => (f.name.split(".").pop() || "").toLowerCase();

// ---------- Datei → Textzeilen ----------
export async function fileToLines(file, lang, onStatus = () => {}) {
  const e = ext(file);
  if (["txt", "csv", "tsv"].includes(e) || file.type.startsWith("text/")) return splitLines(await file.text());
  if (["xlsx", "xls", "ods"].includes(e)) {
    onStatus("Lese Tabelle …");
    await loadScript(LIBS.xlsx);
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
    return rows.map(r => r.filter(c => c != null && String(c).trim() !== "").join("\t")).filter(Boolean);
  }
  if (e === "docx") {
    onStatus("Lese Word-Dokument …");
    await loadScript(LIBS.mammoth);
    const { value } = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const doc = new DOMParser().parseFromString(value, "text/html");
    const trs = [...doc.querySelectorAll("tr")];
    if (trs.length) return trs.map(tr => [...tr.children].map(td => td.textContent.trim()).filter(Boolean).join("\t")).filter(Boolean);
    return [...doc.querySelectorAll("p,li")].map(p => p.textContent.trim()).filter(Boolean);
  }
  if (e === "pdf" || file.type === "application/pdf") return pdfToLines(file, lang, onStatus);
  if (file.type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "heic", "heif", "bmp", "gif"].includes(e)) {
    const canvas = await imageToCanvas(file, 2200);
    return ocrCanvas(canvas, lang, onStatus);
  }
  throw new Error(`Das Format .${e} kenne ich nicht. Möglich: Foto, PDF, Word, Excel, CSV, TXT.`);
}

export function splitLines(text) { return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean); }

async function pdfToLines(file, lang, onStatus) {
  onStatus("Öffne PDF …");
  await loadScript(LIBS.pdfjs);
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = Math.min(pdf.numPages, 6);
  let lines = [];
  // 1) PDF mit echtem Text: direkt auslesen (genauer als OCR)
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    lines.push(...textItemsToLines(tc.items));
  }
  if (lines.join("").replace(/\s/g, "").length > 20) return lines;
  // 2) Eingescanntes PDF: Seiten als Bild → OCR
  lines = [];
  for (let p = 1; p <= pages; p++) {
    onStatus(`Seite ${p} von ${pages} wird gelesen …`);
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.2 });
    const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    lines.push(...await ocrCanvas(c, lang, s => onStatus(`Seite ${p}/${pages}: ${s}`)));
  }
  return lines;
}

// Textstücke einer PDF-Seite zu Zeilen gruppieren; große Lücken = Spaltentrenner
function textItemsToLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4], y = it.transform[5], w = it.width || it.str.length * 5, h = Math.abs(it.transform[3]) || 10;
    let row = rows.find(r => Math.abs(r.y - y) < h * 0.5);
    if (!row) { row = { y, h, parts: [] }; rows.push(row); }
    row.parts.push({ x, w, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map(r => {
    r.parts.sort((a, b) => a.x - b.x);
    let out = "", lastEnd = null;
    for (const p of r.parts) {
      if (lastEnd != null) { const gap = p.x - lastEnd; out += gap > r.h * 2 ? "\t" : gap > r.h * 0.15 ? " " : ""; }
      out += p.s; lastEnd = p.x + p.w;
    }
    return out.trim();
  }).filter(Boolean);
}

async function ocrCanvas(canvas, lang, onStatus) {
  onStatus("Texterkennung wird geladen (beim ersten Mal ca. 20 Sekunden) …");
  await loadScript(LIBS.tesseract);
  const langs = lang === "pt" ? "fra+por" : "fra+deu";
  const res = await window.Tesseract.recognize(canvas, langs, {
    logger: m => { if (m.status === "recognizing text") onStatus(`Text wird erkannt … ${Math.round(m.progress * 100)} %`); },
  });
  const data = res.data;
  // Zeilen mit Wortpositionen → große Lücken als Spaltentrenner
  if (data.lines?.length) {
    return data.lines.map(line => {
      const ws = line.words || [];
      if (!ws.length) return line.text.trim();
      const hgt = ws.reduce((s, w) => s + (w.bbox.y1 - w.bbox.y0), 0) / ws.length;
      let out = "", last = null;
      for (const w of ws) { if (last) out += (w.bbox.x0 - last.bbox.x1) > hgt * 1.6 ? "\t" : " "; out += w.text; last = w; }
      return out.trim();
    }).filter(s => s && /[a-zA-ZÀ-ÿ]/.test(s));
  }
  return splitLines(data.text);
}

// ---------- Zeilen → Wortpaare ----------
const SEPS = [/\t+/, /\s+\|\s+/, /\s*[–—]\s*/, /\s+-\s+/, /\s*=\s*/, /\s*:\s+/, /\s*;\s*/, /\s{2,}/, /\s*,\s*/];
const FR_HINT = /^(le|la|les|l'|l’|un|une|des|du)\b|[éèêàçùûôîœë]/i;

export function linesToPairs(lines) {
  const pairs = [];
  for (let raw of lines) {
    let line = raw.replace(/^\s*(\d+[.)]|[-•*·▪●])\s*/, "").trim();
    if (!line || line.length > 120) continue;
    if (/^(français|französisch|francais|deutsch|português|portugiesisch|mot|wort|vocabulaire)\b/i.test(line) && line.split(/\s+/).length <= 3) continue;
    let parts = null;
    for (const s of SEPS) { const p = line.split(s).map(x => x.trim()).filter(Boolean); if (p.length >= 2) { parts = [p[0], p.slice(1).join(" ")]; break; } }
    if (parts) pairs.push({ fr: clean(parts[0]), tr: clean(parts[1]) });
    else pairs.push({ fr: clean(line), tr: "" });
  }
  // Spalten vertauscht? (Französisch rechts)
  const a = pairs.filter(p => FR_HINT.test(p.fr)).length, b = pairs.filter(p => FR_HINT.test(p.tr)).length;
  if (b > a * 1.5 && b >= 2) pairs.forEach(p => { [p.fr, p.tr] = [p.tr, p.fr]; });
  // einzelne vertauschte Zeile: links deutscher/portugiesischer Artikel, rechts französisch
  const OTHER_ART = /^(der|die|das|ein|eine|o|a|os|as|um|uma)\s/i;
  pairs.forEach(p => { if (p.tr && OTHER_ART.test(p.fr) && FR_HINT.test(p.tr)) [p.fr, p.tr] = [p.tr, p.fr]; });
  return pairs.filter(p => p.fr);
}
const clean = s => s.replace(/[|_]+$/g, "").replace(/\s+/g, " ").replace(/^["'„“]+|["'“”]+$/g, "").trim();

// ---------- Bilder ----------
export function imageToCanvas(file, max = 320) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * r)); c.height = Math.max(1, Math.round(img.height * r));
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error(`„${file.name}“ kann dieser Browser nicht öffnen${/hei[cf]$/i.test(file.name) ? " (HEIC geht nur in Safari – oder vorher als JPG speichern)" : ""}.`)); };
    img.src = url;
  });
}

export async function imageToDataUrl(file, max = 320) {
  if (ext(file) === "svg" || file.type === "image/svg+xml") {
    const txt = await file.text();
    if (txt.length > 150000) throw new Error("SVG ist zu groß.");
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(txt)));
  }
  const c = await imageToCanvas(file, max);
  return c.toDataURL("image/jpeg", 0.82);
}

const key = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/\.[a-z0-9]+$/, "").replace(/^(le|la|les|l|un|une|des|der|die|das|o|a|os|as)[\s_'’-]+/, "").replace(/[^a-z0-9]/g, "");

// Bilder per Dateiname den Wörtern zuordnen (z. B. chat.jpg → le chat, Katze.png → die Katze)
export function matchImages(files, words) {
  const matched = [], unmatched = [];
  for (const f of files) {
    const k = key(f.name);
    const w = words.find(w => key(w.fr) === k || key(w.tr) === k) || words.find(w => k.length >= 3 && (key(w.fr).includes(k) || k.includes(key(w.fr)) || key(w.tr) === k));
    if (w && !matched.some(m => m.w === w)) matched.push({ f, w }); else unmatched.push(f);
  }
  return { matched, unmatched };
}
