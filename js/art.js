// Comic-Grafiken als SVG (gestochen scharf auf jedem Bildschirm, kein Text im Bild)
// Stil: dicke dunkle Kontur, flache kräftige Farben, kleine Glanzlichter.
const K = "#24323f";
const o = (w = 4) => `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (vb, body) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;
const eye = (x, y, r = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${K}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#fff"/>`;
const smile = (x, y, w = 10) => `<path d="M${x - w / 2} ${y} Q${x} ${y + w * 0.7} ${x + w / 2} ${y}" fill="none" ${o(3)}/>`;
const cheeks = (x1, x2, y) => `<circle cx="${x1}" cy="${y}" r="5" fill="#ff8fa3" opacity=".55"/><circle cx="${x2}" cy="${y}" r="5" fill="#ff8fa3" opacity=".55"/>`;

const ART = {
  // ---------- Maskottchen ----------
  parrot: svg("0 0 120 120", `
    <path d="M46 92 L34 116 L48 108 L54 118 L60 96Z" fill="#1c7ed6" ${o()}/>
    <path d="M38 64 Q8 48 14 26 Q30 34 46 58Z" fill="#20c997" ${o()}/>
    <ellipse cx="62" cy="74" rx="28" ry="30" fill="#2fb36a" ${o()}/>
    <ellipse cx="64" cy="82" rx="15" ry="18" fill="#ffd43b" ${o(3)}/>
    <path d="M54 18 Q52 4 63 8 Q64 0 74 8 Q78 14 70 20Z" fill="#ff6b6b" ${o(3)}/>
    <circle cx="62" cy="40" r="24" fill="#2fb36a" ${o()}/>
    <circle cx="70" cy="36" r="9" fill="#fff" ${o(3)}/>${eye(72, 37, 4.5)}
    <path d="M80 42 Q100 42 94 58 Q88 52 78 52Z" fill="#ff922b" ${o(3)}/>
    <circle cx="55" cy="49" r="5" fill="#ff8fa3" opacity=".6"/>
    <path d="M54 102 v10 M70 102 v10 M50 112 h8 M66 112 h8" fill="none" ${o(3)}/>`),

  // ---------- Knöpfe / Navigation ----------
  book: svg("0 0 100 100", `
    <path d="M6 40 V88 Q30 82 50 92 Q70 82 94 88 V40 Z" fill="#1c7ed6" ${o()}/>
    <path d="M50 42 Q30 32 12 36 V80 Q30 76 50 86Z" fill="#fff" ${o()}/>
    <path d="M50 42 Q70 32 88 36 V80 Q70 76 50 86Z" fill="#fff" ${o()}/>
    <path d="M19 48 Q31 46 43 50 M19 58 Q31 56 43 60 M19 68 Q31 66 43 70 M57 50 Q69 46 81 48 M57 60 Q69 56 81 58" fill="none" stroke="#9fb3c8" stroke-width="3" stroke-linecap="round"/>
    <circle cx="50" cy="16" r="10" fill="#ffd43b" ${o(3)}/><rect x="45" y="25" width="10" height="6" rx="2" fill="#ced4da" ${o(3)}/>
    <path d="M32 10 l-6 -4 M68 10 l6 -4 M30 22 h-7 M70 22 h7" fill="none" ${o(3)}/>`),
  clipboard: svg("0 0 100 100", `
    <rect x="16" y="12" width="60" height="80" rx="8" fill="#c97b3f" ${o()}/>
    <rect x="24" y="22" width="44" height="62" rx="4" fill="#fff" ${o(3)}/>
    <rect x="34" y="6" width="24" height="14" rx="4" fill="#adb5bd" ${o(3)}/>
    <path d="M32 54 L42 64 L60 40" fill="none" stroke="#2fb36a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M32 74 H58" fill="none" stroke="#9fb3c8" stroke-width="3" stroke-linecap="round"/>
    <g transform="rotate(35 80 60)"><rect x="74" y="30" width="12" height="48" rx="3" fill="#ffd43b" ${o(3)}/><path d="M74 78 L80 92 L86 78Z" fill="#ffe8cc" ${o(3)}/><rect x="74" y="26" width="12" height="8" rx="2" fill="#ff8fa3" ${o(3)}/></g>`),
  island: svg("0 0 120 100", `
    <ellipse cx="60" cy="82" rx="56" ry="14" fill="#74c0fc" ${o()}/>
    <path d="M20 80 Q60 52 100 80Z" fill="#ffe08a" ${o()}/>
    <path d="M62 78 Q58 52 66 30" fill="none" stroke="${K}" stroke-width="10" stroke-linecap="round"/>
    <path d="M62 78 Q58 52 66 30" fill="none" stroke="#a0673a" stroke-width="5" stroke-linecap="round"/>
    <path d="M66 30 Q48 18 34 30 Q50 26 66 32 Q58 12 70 6 Q70 22 68 30 Q84 14 98 22 Q82 24 68 32 Q88 30 94 44 Q78 34 66 32Z" fill="#2fb36a" ${o(3)}/>
    <circle cx="70" cy="34" r="4" fill="#8d5a2b" ${o(2)}/>
    <path d="M30 88 q6 -4 12 0 M76 90 q6 -4 12 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
  chest: svg("0 0 100 100", `
    <path d="M14 44 Q14 16 50 16 Q86 16 86 44Z" fill="#c97b3f" ${o()}/>
    <rect x="14" y="44" width="72" height="42" rx="4" fill="#a0673a" ${o()}/>
    <rect x="44" y="40" width="12" height="18" rx="3" fill="#ffd43b" ${o(3)}/>
    <path d="M14 58 H86 M30 16 V44 M70 16 V44" fill="none" ${o(3)}/>
    <circle cx="26" cy="38" r="6" fill="#ffd43b" ${o(2)}/><circle cx="72" cy="36" r="6" fill="#ffd43b" ${o(2)}/>
    <path d="M82 10 l4 -6 M90 18 l7 -2 M18 8 l-4 -6" fill="none" ${o(3)}/>`),
  trophy: svg("0 0 100 100", `
    <path d="M28 14 H72 V40 Q72 62 50 62 Q28 62 28 40Z" fill="#ffd43b" ${o()}/>
    <path d="M28 22 Q10 22 12 36 Q14 48 30 48 M72 22 Q90 22 88 36 Q86 48 70 48" fill="none" ${o()}/>
    <rect x="44" y="62" width="12" height="14" fill="#fab005" ${o(3)}/>
    <rect x="30" y="76" width="40" height="12" rx="3" fill="#a0673a" ${o()}/>
    <path d="M50 26 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1Z" fill="#fff" ${o(2)}/>
    <path d="M38 18 Q36 30 38 40" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`),
  map: svg("0 0 100 100", `
    <path d="M14 24 L36 16 L64 24 L86 16 V76 L64 84 L36 76 L14 84Z" fill="#ffe8b0" ${o()}/>
    <path d="M36 16 V76 M64 24 V84" fill="none" stroke="#d9b97a" stroke-width="3"/>
    <path d="M22 70 Q34 52 46 58 Q58 64 62 46" fill="none" stroke="#e8590c" stroke-width="3.5" stroke-dasharray="5 5" stroke-linecap="round"/>
    <path d="M64 30 L76 42 M76 30 L64 42" fill="none" stroke="#e03131" stroke-width="5" stroke-linecap="round"/>`),
  telescope: svg("0 0 100 100", `
    <path d="M40 60 L28 90 M48 60 L50 90 M56 60 L70 90" fill="none" ${o()}/>
    <g transform="rotate(-25 50 46)"><rect x="18" y="38" width="62" height="18" rx="5" fill="#7048e8" ${o()}/><rect x="10" y="40" width="12" height="14" rx="3" fill="#ced4da" ${o(3)}/><rect x="80" y="34" width="10" height="26" rx="3" fill="#ffd43b" ${o(3)}/></g>
    <path d="M84 8 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1Z" fill="#ffd43b" ${o(2)}/>`),
  flame: svg("0 0 100 100", `<path d="M50 6 Q74 30 74 58 Q74 88 50 92 Q26 88 26 60 Q26 44 38 32 Q38 50 48 54 Q42 30 50 6Z" fill="#ff922b" ${o()}/><path d="M50 50 Q62 62 60 76 Q56 86 50 86 Q42 86 40 76 Q40 64 50 50Z" fill="#ffd43b" ${o(3)}/>`),
  coin: svg("0 0 100 100", `<circle cx="50" cy="50" r="40" fill="#ffd43b" ${o()}/><circle cx="50" cy="50" r="28" fill="#fab005" ${o(3)}/><path d="M50 34 l5 10 11 1 -8 7 3 11 -11 -6 -11 6 3 -11 -8 -7 11 -1Z" fill="#fff3bf" ${o(2)}/>`),
  star: svg("0 0 100 100", `<path d="M50 8 l12 26 28 3 -21 19 6 28 -25 -14 -25 14 6 -28 -21 -19 28 -3Z" fill="#ffd43b" ${o()}/><path d="M40 34 L46 30" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`),
  starEmpty: svg("0 0 100 100", `<path d="M50 8 l12 26 28 3 -21 19 6 28 -25 -14 -25 14 6 -28 -21 -19 28 -3Z" fill="#eef1f4" stroke="#c5ced6" stroke-width="4" stroke-linejoin="round"/>`),
  lock: svg("0 0 100 100", `<path d="M30 46 V32 Q30 12 50 12 Q70 12 70 32 V46" fill="none" ${o(6)}/><rect x="20" y="44" width="60" height="46" rx="8" fill="#adb5bd" ${o()}/><circle cx="50" cy="64" r="6" fill="${K}"/><rect x="47" y="64" width="6" height="14" rx="2" fill="${K}"/>`),
  door: svg("0 0 100 100", `<rect x="22" y="8" width="56" height="86" rx="6" fill="#c97b3f" ${o()}/><rect x="32" y="18" width="36" height="28" rx="3" fill="#a0673a" ${o(3)}/><rect x="32" y="54" width="36" height="28" rx="3" fill="#a0673a" ${o(3)}/><circle cx="68" cy="52" r="4" fill="#ffd43b" ${o(2)}/>`),
  games: svg("0 0 100 100", `<rect x="10" y="30" width="80" height="44" rx="22" fill="#7048e8" ${o()}/><path d="M28 44 V60 M20 52 H36" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="66" cy="46" r="5" fill="#ffd43b" ${o(2)}/><circle cx="76" cy="56" r="5" fill="#ff6b6b" ${o(2)}/>`),
  medal: svg("0 0 100 100", `<path d="M34 6 L50 40 L66 6" fill="#1c7ed6" ${o()}/><circle cx="50" cy="62" r="28" fill="#ffd43b" ${o()}/><circle cx="50" cy="62" r="18" fill="#fab005" ${o(3)}/><path d="M50 50 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1Z" fill="#fff" ${o(2)}/>`),
  rocket: svg("0 0 100 100", `<path d="M50 6 Q72 24 70 62 H30 Q28 24 50 6Z" fill="#f1f3f5" ${o()}/><circle cx="50" cy="36" r="9" fill="#74c0fc" ${o(3)}/><path d="M30 50 L16 70 L30 66 M70 50 L84 70 L70 66" fill="#ff6b6b" ${o()}/><path d="M40 62 Q50 92 60 62Z" fill="#ff922b" ${o(3)}/>`),

  // ---------- Bild-PIN (Schlüssel = gespeicherte Werte) ----------
  "🐶": svg("0 0 100 100", `<path d="M22 30 Q8 34 14 62 Q22 64 28 50Z M78 30 Q92 34 86 62 Q78 64 72 50Z" fill="#a0673a" ${o()}/><circle cx="50" cy="52" r="32" fill="#e8b27a" ${o()}/><ellipse cx="50" cy="66" rx="16" ry="12" fill="#fff4e6" ${o(3)}/><ellipse cx="50" cy="58" rx="6" ry="4.5" fill="${K}"/>${eye(38, 46)}${eye(62, 46)}${smile(50, 68, 12)}`),
  "🐱": svg("0 0 100 100", `<path d="M22 40 L24 10 L46 26Z M78 40 L76 10 L54 26Z" fill="#ffa94d" ${o()}/><circle cx="50" cy="54" r="32" fill="#ffa94d" ${o()}/><path d="M24 58 H10 M24 64 L12 70 M76 58 H90 M76 64 L88 70" fill="none" ${o(2)}/>${eye(38, 50)}${eye(62, 50)}<path d="M46 60 L54 60 L50 65Z" fill="#ff8fa3" ${o(2)}/>${smile(50, 68, 12)}`),
  "🦊": svg("0 0 100 100", `<path d="M18 38 L20 6 L44 24Z M82 38 L80 6 L56 24Z" fill="#ff7a2f" ${o()}/><path d="M14 38 Q50 4 86 38 Q86 70 50 92 Q14 70 14 38Z" fill="#ff7a2f" ${o()}/><path d="M18 46 Q34 60 50 92 Q66 60 82 46 Q66 56 50 56 Q34 56 18 46Z" fill="#fff" ${o(3)}/>${eye(36, 44)}${eye(64, 44)}<ellipse cx="50" cy="82" rx="5" ry="4" fill="${K}"/>`),
  "🍎": svg("0 0 100 100", `<path d="M50 30 Q30 16 18 34 Q6 60 26 84 Q38 96 50 86 Q62 96 74 84 Q94 60 82 34 Q70 16 50 30Z" fill="#fa5252" ${o()}/><path d="M50 30 Q50 16 56 8" fill="none" ${o(4)}/><path d="M54 18 Q70 6 80 16 Q66 26 54 18Z" fill="#2fb36a" ${o(3)}/><path d="M30 40 Q26 50 28 58" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7"/>`),
  "🍌": svg("0 0 100 100", `<path d="M80 14 Q92 52 66 78 Q42 98 14 84 Q40 80 56 62 Q72 42 70 18Z" fill="#ffd43b" ${o()}/><path d="M70 18 L74 8 L82 12 L80 16" fill="#a0673a" ${o(3)}/><path d="M62 30 Q64 50 50 66" fill="none" stroke="#fab005" stroke-width="4" stroke-linecap="round"/>`),
  "🍓": svg("0 0 100 100", `<path d="M50 30 Q80 26 82 46 Q82 72 50 94 Q18 72 18 46 Q20 26 50 30Z" fill="#fa5252" ${o()}/><path d="M30 28 Q40 14 50 24 Q60 14 70 28 Q60 36 50 30 Q40 36 30 28Z" fill="#2fb36a" ${o(3)}/><g fill="#ffe066"><circle cx="38" cy="48" r="2.5"/><circle cx="56" cy="46" r="2.5"/><circle cx="66" cy="58" r="2.5"/><circle cx="46" cy="62" r="2.5"/><circle cx="34" cy="64" r="2.5"/><circle cx="56" cy="74" r="2.5"/></g>`),
  "⭐": null, // wird unten auf ART.star gesetzt
  "🌙": svg("0 0 100 100", `<path d="M62 10 Q24 14 22 50 Q22 88 62 90 Q36 78 36 50 Q36 22 62 10Z" fill="#ffd43b" ${o()}/><circle cx="74" cy="30" r="3" fill="#ffd43b" ${o(2)}/><circle cx="80" cy="60" r="4" fill="#ffd43b" ${o(2)}/>`),
  "☀️": svg("0 0 100 100", `<g ${o(5)}><path d="M50 4 V16 M50 84 V96 M4 50 H16 M84 50 H96 M17 17 L26 26 M74 74 L83 83 M83 17 L74 26 M26 74 L17 83"/></g><circle cx="50" cy="50" r="26" fill="#ffd43b" ${o()}/>${eye(42, 46, 3.5)}${eye(58, 46, 3.5)}${smile(50, 58, 12)}`),

  // ---------- Avatar-Tiere (Schlüssel = gespeicherte Werte) ----------
  "🐢": svg("0 0 100 100", `<path d="M22 68 v14 h10 v-12 M54 68 v14 h10 v-12" fill="#8ce99a" ${o()}/><circle cx="80" cy="50" r="15" fill="#8ce99a" ${o()}/>${eye(84, 46, 3.5)}${smile(84, 56, 8)}<path d="M8 70 Q8 26 46 26 Q74 26 74 70Z" fill="#2fb36a" ${o()}/><path d="M24 50 L34 38 H52 L60 50 L52 62 H34Z" fill="#69db7c" ${o(3)}/><path d="M4 70 H78" fill="none" ${o()}/>`),
  "🐻": svg("0 0 100 100", `<circle cx="24" cy="26" r="12" fill="#a0673a" ${o()}/><circle cx="76" cy="26" r="12" fill="#a0673a" ${o()}/><circle cx="50" cy="54" r="34" fill="#a0673a" ${o()}/><ellipse cx="50" cy="66" rx="15" ry="12" fill="#e8b27a" ${o(3)}/><ellipse cx="50" cy="60" rx="6" ry="4.5" fill="${K}"/>${eye(37, 46)}${eye(63, 46)}${smile(50, 68, 10)}`),
  "🐬": svg("0 0 100 100", `<path d="M56 14 Q64 20 62 30 L48 26Z" fill="#4dabf7" ${o()}/><path d="M18 60 Q16 26 52 24 Q84 24 86 52 Q86 76 60 80 Q40 82 30 74 Q20 78 10 74 Q18 70 18 60Z" fill="#4dabf7" ${o()}/><path d="M30 70 Q52 72 78 60" fill="none" stroke="#d0ebff" stroke-width="6" stroke-linecap="round"/>${eye(62, 44)}${smile(74, 56, 8)}`),
  "🦋": svg("0 0 100 100", `<path d="M48 48 Q20 10 10 30 Q6 50 46 54Z M52 48 Q80 10 90 30 Q94 50 54 54Z" fill="#9775fa" ${o()}/><path d="M46 56 Q16 60 22 82 Q34 90 48 62Z M54 56 Q84 60 78 82 Q66 90 52 62Z" fill="#f783ac" ${o()}/><circle cx="26" cy="32" r="5" fill="#ffd43b"/><circle cx="74" cy="32" r="5" fill="#ffd43b"/><rect x="45" y="32" width="10" height="46" rx="5" fill="${K}"/><path d="M48 32 Q42 18 36 16 M52 32 Q58 18 64 16" fill="none" ${o(3)}/>`),
  "🐧": svg("0 0 100 100", `<ellipse cx="50" cy="54" rx="32" ry="36" fill="#343a40" ${o()}/><path d="M28 56 Q28 30 50 30 Q72 30 72 56 Q72 84 50 86 Q28 84 28 56Z" fill="#fff" ${o(3)}/><circle cx="41" cy="46" r="4" fill="${K}"/><circle cx="59" cy="46" r="4" fill="${K}"/><path d="M42 54 L58 54 L50 64Z" fill="#ff922b" ${o(3)}/>`),
  "🐸": svg("0 0 100 100", `<circle cx="30" cy="30" r="14" fill="#69db7c" ${o()}/><circle cx="70" cy="30" r="14" fill="#69db7c" ${o()}/><ellipse cx="50" cy="60" rx="40" ry="28" fill="#69db7c" ${o()}/><circle cx="30" cy="30" r="7" fill="#fff" ${o(2)}/>${eye(31, 31, 3.5)}<circle cx="70" cy="30" r="7" fill="#fff" ${o(2)}/>${eye(71, 31, 3.5)}<path d="M28 64 Q50 82 72 64" fill="#ff8fa3" ${o(3)}/>${cheeks(22, 78, 58)}`),
  "🐙": svg("0 0 100 100", `<path d="M22 60 Q14 80 6 82 M34 66 Q30 86 22 94 M50 68 V94 M66 66 Q70 86 78 94 M78 60 Q86 80 94 82" fill="none" stroke="${K}" stroke-width="12" stroke-linecap="round"/><path d="M22 60 Q14 80 6 82 M34 66 Q30 86 22 94 M50 68 V94 M66 66 Q70 86 78 94 M78 60 Q86 80 94 82" fill="none" stroke="#f783ac" stroke-width="6" stroke-linecap="round"/><path d="M16 50 Q16 10 50 10 Q84 10 84 50 Q84 70 50 70 Q16 70 16 50Z" fill="#f783ac" ${o()}/>${eye(38, 42)}${eye(62, 42)}${smile(50, 54, 10)}`),
  "🦜": null, // = parrot
  "🐼": svg("0 0 100 100", `<circle cx="22" cy="24" r="13" fill="${K}"/><circle cx="78" cy="24" r="13" fill="${K}"/><circle cx="50" cy="54" r="36" fill="#fff" ${o()}/><ellipse cx="36" cy="48" rx="9" ry="12" fill="${K}" transform="rotate(-20 36 48)"/><ellipse cx="64" cy="48" rx="9" ry="12" fill="${K}" transform="rotate(20 64 48)"/><circle cx="37" cy="47" r="3" fill="#fff"/><circle cx="63" cy="47" r="3" fill="#fff"/><ellipse cx="50" cy="62" rx="6" ry="4.5" fill="${K}"/>${smile(50, 70, 10)}`),
  "🦄": svg("0 0 100 100", `<path d="M54 22 L66 0 L64 26Z" fill="#ffd43b" ${o(3)}/><path d="M30 30 Q14 40 18 70 Q26 60 30 52 Q24 70 34 82Z" fill="#f783ac" ${o(3)}/><path d="M30 60 Q24 24 56 22 Q84 24 84 54 Q84 74 66 78 Q52 80 46 72 Q34 74 30 60Z" fill="#fff" ${o()}/><ellipse cx="72" cy="68" rx="10" ry="7" fill="#ffdeeb" ${o(3)}/>${eye(60, 46)}<path d="M38 22 L44 8 L48 24Z" fill="#fff" ${o(3)}/>`),
  "🦖": svg("0 0 100 100", `<path d="M30 26 L36 12 L42 24 L48 8 L54 22 L62 10 L64 26Z" fill="#20c997" ${o(3)}/><path d="M16 64 Q14 26 52 24 Q88 24 88 54 Q88 78 60 80 H30 Q16 78 16 64Z" fill="#51cf66" ${o()}/><path d="M50 66 H84" fill="none" ${o(3)}/><path d="M56 66 l3 6 3 -6 M66 66 l3 6 3 -6 M76 66 l3 6 3 -6" fill="#fff" ${o(2)}/>${eye(62, 44)}<circle cx="80" cy="50" r="2" fill="${K}"/>`),
};
ART["⭐"] = ART.star;
ART["🦜"] = ART.parrot;
ART["🦊"] = ART["🦊"];

// ---------- Hüte (über dem Avatar) ----------
const HATS = {
  "🌸": svg("0 0 100 60", `<g ${o(3)} fill="#f783ac"><circle cx="50" cy="16" r="12"/><circle cx="66" cy="30" r="12"/><circle cx="60" cy="48" r="12"/><circle cx="40" cy="48" r="12"/><circle cx="34" cy="30" r="12"/></g><circle cx="50" cy="34" r="9" fill="#ffd43b" ${o(3)}/>`),
  "🧢": svg("0 0 100 60", `<path d="M14 46 Q14 8 52 8 Q86 10 86 46Z" fill="#1c7ed6" ${o()}/><path d="M80 46 Q98 46 98 56 H60 Z" fill="#1864ab" ${o()}/><circle cx="52" cy="10" r="5" fill="#fff" ${o(2)}/>`),
  "🎀": svg("0 0 100 60", `<path d="M50 30 L14 8 Q6 30 14 52Z M50 30 L86 8 Q94 30 86 52Z" fill="#f06595" ${o()}/><circle cx="50" cy="30" r="10" fill="#e64980" ${o()}/>`),
  "⛑️": svg("0 0 100 60", `<path d="M10 52 Q10 6 50 6 Q90 6 90 52Z" fill="#fa5252" ${o()}/><path d="M44 18 H56 V28 H66 V40 H56 V50 H44 V40 H34 V28 H44Z" fill="#fff" ${o(2)}/>`),
  "🤠": svg("0 0 100 60", `<path d="M2 46 Q50 66 98 46 Q90 38 78 40 L72 12 Q50 2 28 12 L22 40 Q10 38 2 46Z" fill="#c97b3f" ${o()}/><path d="M24 36 Q50 44 76 36" fill="none" stroke="#7a4b20" stroke-width="5"/>`),
  "🎓": svg("0 0 100 60", `<path d="M50 4 L96 20 L50 36 L4 20Z" fill="#343a40" ${o()}/><path d="M24 28 V46 Q50 58 76 46 V28" fill="#343a40" ${o()}/><path d="M86 24 V44" fill="none" stroke="#ffd43b" stroke-width="4"/><circle cx="86" cy="46" r="4" fill="#ffd43b"/>`),
  "🎩": svg("0 0 100 60", `<rect x="28" y="2" width="44" height="44" rx="4" fill="#343a40" ${o()}/><rect x="28" y="30" width="44" height="8" fill="#e03131"/><rect x="10" y="44" width="80" height="12" rx="6" fill="#343a40" ${o()}/>`),
  "👑": svg("0 0 100 60", `<path d="M10 52 L6 12 L30 30 L50 4 L70 30 L94 12 L90 52Z" fill="#ffd43b" ${o()}/><circle cx="50" cy="38" r="6" fill="#e03131" ${o(2)}/><circle cx="26" cy="42" r="4" fill="#4dabf7" ${o(2)}/><circle cx="74" cy="42" r="4" fill="#4dabf7" ${o(2)}/>`),
  "🏴‍☠️": svg("0 0 100 60", `<path d="M4 50 Q50 -6 96 50 Q50 40 4 50Z" fill="#343a40" ${o()}/><circle cx="50" cy="28" r="8" fill="#fff" ${o(2)}/><path d="M40 40 L60 34 M40 34 L60 40" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
};

export function art(key, cls = "") {
  const s = ART[key];
  if (s) return cls ? s.replace("<svg ", `<svg class="${cls}" `) : s;
  return key ? `<span class="${cls}" aria-hidden="true">${key}</span>` : "";
}
export function hat(key) { return HATS[key] || (key ? `<span aria-hidden="true">${key}</span>` : ""); }
export const ANIMAL_KEYS = ["🐢", "🦊", "🐻", "🐬", "🦋", "🐧", "🐸", "🐙", "🦜", "🐼", "🦄", "🦖"];
export const HAT_KEYS = Object.keys(HATS);
