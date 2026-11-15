// Beispielklasse "DEMO" für den Demo-Modus (Lehrer-PIN: 1234)
import { sha, pinHash } from "./util.js";
import { emptyProgress, todayStr, checkBadges, mondayOf, DAY, INTERVALS } from "./srs.js";

const W = (fr, tr, emoji) => ({ fr, tr, emoji });

const LESSONS = [
  { id: "l-animaux", title: "Les animaux", icon: "🦁", lang: "de", order: 1, words: [
    W("le chat", "die Katze", "🐱"), W("le chien", "der Hund", "🐶"), W("l'oiseau", "der Vogel", "🐦"),
    W("le poisson", "der Fisch", "🐟"), W("le cheval", "das Pferd", "🐴"), W("la vache", "die Kuh", "🐮"),
    W("le lapin", "das Kaninchen", "🐰"), W("la souris", "die Maus", "🐭"), W("le cochon", "das Schwein", "🐷"),
    W("la poule", "das Huhn", "🐔")] },
  { id: "l-animaux-pt", title: "Les animaux", icon: "🦁", lang: "pt", order: 1, words: [
    W("le chat", "o gato", "🐱"), W("le chien", "o cão", "🐶"), W("l'oiseau", "o pássaro", "🐦"),
    W("le poisson", "o peixe", "🐟"), W("le cheval", "o cavalo", "🐴"), W("la vache", "a vaca", "🐮"),
    W("le lapin", "o coelho", "🐰"), W("la souris", "o rato", "🐭"), W("le cochon", "o porco", "🐷"),
    W("la poule", "a galinha", "🐔")] },
  { id: "l-ecole", title: "À l'école", icon: "🎒", lang: "de", order: 2, words: [
    W("le crayon", "der Bleistift", "✏️"), W("le livre", "das Buch", "📕"), W("le cahier", "das Heft", "📓"),
    W("la gomme", "der Radiergummi", "🧽"), W("les ciseaux", "die Schere", "✂️"), W("le sac", "die Tasche", "🎒"),
    W("la règle", "das Lineal", "📏"), W("la colle", "der Kleber", "🧴"), W("le tableau", "die Tafel", "🟩"),
    W("la maîtresse", "die Lehrerin", "👩‍🏫")] },
  { id: "l-manger", title: "On mange !", icon: "🍎", lang: "de", order: 3, words: [
    W("la pomme", "der Apfel", "🍎"), W("la banane", "die Banane", "🍌"), W("le pain", "das Brot", "🍞"),
    W("le fromage", "der Käse", "🧀"), W("l'eau", "das Wasser", "💧"), W("le lait", "die Milch", "🥛"),
    W("l'œuf", "das Ei", "🥚"), W("la fraise", "die Erdbeere", "🍓")] },
];

const KIDS = [
  ["Emma", "🦊", "#e8590c", "de"], ["Noah", "🐢", "#2f9e8f", "de"], ["Lina", "🦋", "#7048e8", "de"],
  ["Ben", "🐻", "#a0522d", "de"], ["Mia", "🐬", "#1c7ed6", "de"], ["Luca", "🦁", "#f08c00", "de"],
  ["Tiago", "🐙", "#d6336c", "pt"], ["Inês", "🦜", "#2b8a3e", "pt"],
];

export async function seedDemo(local) {
  const rows = await local.get("DEMO", "class");
  if (rows.length) return;
  const code = "DEMO";
  await local.put(code, "class", "main", {
    name: "Klasse 4b (Demo)", teacherPinHash: await sha(`${code}#teacher#1234`),
    goal: { title: "Leuchtturm bauen", target: 1000 }, allOpen: false, report: { enabled: true }, created: Date.now(),
  });
  const ptKids = [], deKids = [];
  const kids = [];
  for (let i = 0; i < KIDS.length; i++) {
    const [name, animal, color, lang] = KIDS[i];
    const id = "s-" + name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const pin = ["🐶", "🍎", "⭐"];
    await local.put(code, "student", id, { name, pinHash: await pinHash(code, pin), pinHint: pin, created: Date.now() });
    (lang === "pt" ? ptKids : deKids).push(id);
    kids.push({ id, animal, color, lang, skill: [0.9, 0.6, 0.75, 0.3, 0.85, 0.5, 0.7, 0.4][i] });
  }
  for (const l of LESSONS) {
    const assigned = l.id === "l-animaux" ? deKids : l.id === "l-animaux-pt" ? ptKids : "all";
    await local.put(code, "lesson", l.id, {
      title: l.title, icon: l.icon, lang: l.lang, order: l.order, assigned, created: Date.now(), week: l.id === "l-manger" ? mondayOf() : "",
      words: l.words.map((w, j) => ({ id: "w" + j, ...w })),
    });
  }
  // Beispiel-Fortschritt der letzten 14 Tage
  for (const k of kids) {
    const p = emptyProgress();
    p.avatar = { animal: k.animal, color: k.color, hat: "" };
    const mine = LESSONS.filter(l => l.id !== "l-manger" && (l.id === "l-animaux" ? k.lang === "de" : l.id === "l-animaux-pt" ? k.lang === "pt" : true));
    let streak = 0, last = null;
    for (let d = 13; d >= 0; d--) {
      if (Math.random() > k.skill) continue;
      const date = todayStr(new Date(Date.now() - d * DAY));
      const ans = 10 + Math.floor(Math.random() * 25);
      const ok = Math.round(ans * (0.55 + k.skill * 0.4));
      p.days[date] = { sec: 240 + Math.floor(Math.random() * 600), ans, ok };
      p.coins += ok; p.xp += ok * 10;
      streak = last === todayStr(new Date(Date.now() - (d + 1) * DAY)) ? streak + 1 : 1; last = date;
    }
    p.streak = { n: streak, last };
    const reach = Math.ceil(mine.length * k.skill);
    mine.slice(0, reach).forEach((l, li) => {
      l.words.forEach((w, j) => {
        const r = Math.random();
        const box = r < k.skill * 0.6 ? 4 + (r < 0.2 ? 1 : 0) : r < k.skill ? 2 + Math.floor(Math.random() * 2) : 1;
        if (li === reach - 1 && j > l.words.length * k.skill) return;
        p.words[`${l.id}:w${j}`] = { b: box, d: Date.now() + (Math.random() < 0.4 ? -DAY : INTERVALS[box]), r: 2 + box * 2, w: Math.floor((1 - k.skill) * 4 * Math.random()) + (j % 4 === 0 ? 2 : 0) };
      });
    });
    p.spoken = Math.floor(k.skill * 25); p.typed = Math.floor(k.skill * 30);
    checkBadges(p, mine.map(l => ({ ...l, words: l.words.map((w, j) => ({ ...w, id: "w" + j })) })));
    await local.put(code, "progress", k.id, p);
  }
}
