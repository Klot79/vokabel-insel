// ================================================================
//  „Mein eigener Satz“ – kindgerechte Prüfung ohne Server
// ----------------------------------------------------------------
//  Selbstbezug-Effekt (Symons & Johnson 1997): Ein Satz über sich selbst
//  verankert das Wort tiefer. Die App gibt sofort Rückmeldung zu dem,
//  was sich sicher prüfen lässt; den Inhalt beurteilt die Lehrkraft.
// ================================================================
import { stripAccents, stripArticle, norm } from "./srs.js";

export const STARTERS = [
  { fr: "J'ai ", de: "Ich habe …" }, { fr: "J'aime ", de: "Ich mag …" }, { fr: "Je vois ", de: "Ich sehe …" },
  { fr: "Il y a ", de: "Es gibt …" }, { fr: "C'est ", de: "Das ist …" }, { fr: "Je n'aime pas ", de: "Ich mag nicht …" },
  { fr: "Mon ami a ", de: "Mein Freund hat …" }, { fr: "Dans ma maison, il y a ", de: "In meinem Haus gibt es …" },
];

// häufige Wörter einer 4. Klasse (ohne Akzent-Varianten doppelt)
const COMMON = `je j' tu il elle on nous vous ils elles me m' te t' se s' moi toi lui
suis es est sommes êtes sont ai as a avons avez ont aime aimes aiment adore adores vois voit vais va vont mange manges mangent
joue joues jouent bois boit dort dors court cours saute sautes nage nages vole regarde regardes habite habites appelle
fais fait veux veut peux peut prends prend lis lit écris écrit chante danse dessine cherche trouve donne porte
c' ce cet cette ces ça voici voilà il y
un une le la les l' des du de d' au aux à en dans sur sous devant derrière avec pour chez entre
mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs
et ou mais aussi très trop beaucoup bien pas ne n' plus jamais toujours souvent parfois aujourd'hui demain hier maintenant ici là
petit petite petits petites grand grande grands grandes beau belle beaux joli jolie gros grosse bon bonne mauvais
gentil gentille drôle mignon mignonne rapide lent lente nouveau nouvelle vieux vieille super préféré préférée
rouge rouges bleu bleue bleus vert verte verts jaune jaunes noir noire noirs blanc blanche gris grise marron rose orange violet violette
un deux trois quatre cinq six sept huit neuf dix onze douze vingt cent
maman papa frère sœur soeur ami amie amis copain copine famille maison école classe jardin chambre cuisine table chaise
oui non merci bonjour salut matin soir nuit jour midi ans an`.split(/\s+/);

const tokens = s => norm(s).replace(/'/g, "' ").split(/\s+/).filter(Boolean);
const bare = t => stripAccents(t.replace(/'$/, ""));

function genderOf(fr) {
  const x = norm(fr);
  if (/^(le|un) /.test(x)) return "m";
  if (/^(la|une) /.test(x)) return "f";
  if (/^(les|des) /.test(x)) return "p";
  return null; // l' – Geschlecht nicht sichtbar
}
const MASC = ["le", "un", "mon", "ton", "son", "ce", "cet", "du", "au"];
const FEM = ["la", "une", "ma", "ta", "sa", "cette"];

// Prüft einen Satz zum Wort `w` (fr = "le chat").
// lessonWords: alle französischen Wörter der Insel (für die Wortliste)
export function checkSentence(text, w, lessonWords = []) {
  const raw = String(text || "").trim();
  const t = tokens(raw);
  const core = stripAccents(stripArticle(norm(w.fr.split(/\s*\/\s*/)[0])));
  const coreToks = core.split(/\s+/);
  const checks = [];

  // 1. Lernwort benutzt? (auch Mehrzahl mit -s/-x)
  const bt = t.map(bare);
  let pos = -1;
  for (let i = 0; i <= bt.length - coreToks.length; i++) {
    if (coreToks.every((c, j) => bt[i + j] === c || bt[i + j] === c + "s" || bt[i + j] === c + "x")) { pos = i; break; }
  }
  checks.push(pos >= 0 ? { ok: true, txt: `Du hast das Wort „${stripArticle(w.fr)}“ benutzt.` }
                       : { ok: false, txt: `Benutze das Wort „${stripArticle(w.fr)}“ in deinem Satz.` });

  // 2. Länge
  const n = raw.split(/\s+/).filter(Boolean).length;
  checks.push(n >= 3 ? { ok: true, txt: `Dein Satz hat ${n} Wörter.` } : { ok: false, txt: "Schreib mindestens 3 Wörter." });

  // 3. Großbuchstabe und Satzzeichen
  checks.push(/^[A-ZÀÂÇÉÈÊËÎÏÔÛÙÜŸŒ]/.test(raw) ? { ok: true, txt: "Großbuchstabe am Anfang." } : { ok: false, txt: "Beginne mit einem Großbuchstaben." });
  checks.push(/[.!?]\s*$/.test(raw) ? { ok: true, txt: "Satzzeichen am Ende." } : { ok: false, txt: "Setze am Ende einen Punkt (.), ! oder ?." });

  // 4. Artikel passt zum Geschlecht?
  const g = genderOf(w.fr);
  if (pos > 0 && (g === "m" || g === "f")) {
    let det = bt[pos - 1];
    if (MASC.includes(det) && g === "f") checks.push({ ok: false, txt: `„${stripArticle(w.fr)}“ ist weiblich: la ${stripArticle(w.fr)} / une ${stripArticle(w.fr)} / ma …` });
    else if (FEM.includes(det) && g === "m") checks.push({ ok: false, txt: `„${stripArticle(w.fr)}“ ist männlich: le ${stripArticle(w.fr)} / un ${stripArticle(w.fr)} / mon …` });
    else if (MASC.includes(det) || FEM.includes(det)) checks.push({ ok: true, txt: "Der Artikel passt." });
  }

  // 5. Unbekannte Wörter / fehlende Akzente (nur Hinweis)
  // bare Form → alle richtigen Schreibweisen (z. B. "a" → {a, à})
  const known = new Map();
  for (const x of [...COMMON, ...lessonWords.flatMap(f => tokens(f))]) {
    const k = bare(x), v = x.replace(/'$/, "");
    if (!known.has(k)) known.set(k, new Set());
    known.get(k).add(v);
  }
  const unknown = [], accent = [];
  t.forEach(tok => {
    const plain = tok.replace(/'$/, "");
    if (!plain || /^\d+$/.test(plain)) return;
    const b = bare(tok);
    const forms = known.get(b) || known.get(b.replace(/s$/, "")) || known.get(b.replace(/x$/, ""));
    if (!forms) { unknown.push(plain); return; }
    const sing = plain.replace(/[sx]$/, "");
    if (forms.has(plain) || forms.has(sing)) return;          // richtig geschrieben
    accent.push(`${plain} → ${[...forms][0]}${plain.endsWith("s") && ![...forms][0].endsWith("s") ? "s" : ""}`);
  });
  if (accent.length) checks.push({ ok: false, soft: true, txt: `Achte auf die Akzente: ${accent.slice(0, 3).join(", ")}` });
  if (unknown.length) checks.push({ ok: true, soft: true, info: true, txt: `Diese Wörter kenne ich nicht – prüfe die Schreibweise: ${unknown.slice(0, 4).join(", ")}. (Deine Lehrkraft schaut sich den Satz auch an.)` });

  const hard = checks.filter(c => !c.ok && !c.soft);
  return { checks, good: hard.length === 0, perfect: hard.length === 0 && !checks.some(c => c.soft && !c.info) && !unknown.length };
}
