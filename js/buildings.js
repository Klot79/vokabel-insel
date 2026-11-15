// Bauwerke der Klassen-Insel (SVG, Comic-Stil). Jedes steht auf y=130, Breite 120.
const K = "#24323f";
const o = (w = 4) => `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

const B = {
  lighthouse: `
    <path d="M40 130 L46 40 H74 L80 130Z" fill="#fff" ${o()}/>
    <path d="M42 106 H78 L77 92 H43Z M44 76 H76 L75 62 H45Z" fill="#e03131"/>
    <path d="M40 130 L46 40 H74 L80 130Z" fill="none" ${o()}/>
    <rect x="52" y="108" width="16" height="22" rx="7" fill="#a0673a" ${o(3)}/>
    <rect x="42" y="34" width="36" height="8" rx="2" fill="#495057" ${o(3)}/>
    <rect x="48" y="14" width="24" height="20" rx="3" fill="#ffe066" class="lamp" ${o(3)}/>
    <path d="M44 14 Q60 -2 76 14Z" fill="#e03131" ${o(3)}/>`,
  bridge: `
    <path d="M4 96 H116" fill="none" ${o(6)}/>
    <path d="M6 96 Q60 34 114 96" fill="none" stroke="#c97b3f" stroke-width="9" stroke-linecap="round"/>
    <path d="M6 96 Q60 34 114 96" fill="none" ${o(3)}/>
    <path d="M30 96 V66 M45 96 V54 M60 96 V50 M75 96 V54 M90 96 V66" ${o(3)}/>
    <rect x="12" y="96" width="14" height="34" fill="#adb5bd" ${o(3)}/><rect x="94" y="96" width="14" height="34" fill="#adb5bd" ${o(3)}/>
    <path d="M26 118 Q60 104 94 118 V130 H26Z" fill="#74c0fc" ${o(3)}/>`,
  castle: `
    <rect x="22" y="60" width="76" height="70" fill="#ced4da" ${o()}/>
    <path d="M22 60 v-10 h10 v10 h10 v-10 h10 v10 h16 v-10 h10 v10 h10 v-10 h10 v10" fill="#ced4da" ${o(3)}/>
    <rect x="8" y="40" width="24" height="90" fill="#adb5bd" ${o()}/><rect x="88" y="40" width="24" height="90" fill="#adb5bd" ${o()}/>
    <path d="M6 42 L20 16 L34 42Z M86 42 L100 16 L114 42Z" fill="#7048e8" ${o(3)}/>
    <path d="M48 130 V104 Q60 90 72 104 V130Z" fill="#a0673a" ${o(3)}/>
    <rect x="16" y="64" width="8" height="12" rx="3" fill="${K}"/><rect x="96" y="64" width="8" height="12" rx="3" fill="${K}"/>
    <path d="M20 16 V4 L32 8 L20 12" fill="#ffd43b" ${o(2)}/>`,
  harbor: `
    <rect x="4" y="104" width="112" height="26" fill="#74c0fc" ${o(3)}/>
    <rect x="10" y="88" width="70" height="12" fill="#c97b3f" ${o(3)}/><path d="M18 100 V124 M44 100 V124 M70 100 V124" ${o(4)}/>
    <rect x="76" y="54" width="34" height="46" fill="#ffd8a8" ${o()}/><path d="M72 56 L93 34 L114 56Z" fill="#e03131" ${o(3)}/>
    <rect x="88" y="74" width="10" height="26" fill="#a0673a" ${o(2)}/>
    <path d="M20 88 V62 H50" fill="none" ${o(4)}/><path d="M50 62 V74" fill="none" ${o(2)}/><rect x="44" y="74" width="12" height="10" fill="#ffd43b" ${o(2)}/>`,
  ship: `
    <path d="M10 98 H110 L96 124 H24Z" fill="#a0673a" ${o()}/>
    <path d="M60 98 V18" ${o(4)}/>
    <path d="M62 22 Q96 50 62 88Z" fill="#fff" ${o(3)}/><path d="M58 30 Q30 56 58 86Z" fill="#f1f3f5" ${o(3)}/>
    <path d="M60 18 L80 24 L60 30" fill="#e03131" ${o(2)}/>
    <circle cx="36" cy="110" r="4" fill="#fff" ${o(2)}/><circle cx="60" cy="110" r="4" fill="#fff" ${o(2)}/><circle cx="84" cy="110" r="4" fill="#fff" ${o(2)}/>
    <path d="M4 128 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="#4dabf7" stroke-width="4"/>`,
  windmill: `
    <path d="M38 130 L46 56 H74 L82 130Z" fill="#fff4e6" ${o()}/>
    <path d="M42 56 L60 38 L78 56Z" fill="#c97b3f" ${o(3)}/>
    <rect x="52" y="104" width="16" height="26" rx="6" fill="#a0673a" ${o(3)}/><circle cx="60" cy="80" r="6" fill="#74c0fc" ${o(2)}/>
    <g transform="rotate(20 60 46)" class="blades"><path d="M60 46 L60 6 L70 10 L66 46Z M60 46 L100 46 L96 56 L60 52Z M60 46 L60 86 L50 82 L54 46Z M60 46 L20 46 L24 36 L60 40Z" fill="#fff" ${o(3)}/></g>
    <circle cx="60" cy="46" r="5" fill="#ffd43b" ${o(2)}/>`,
  treehouse: `
    <rect x="52" y="64" width="16" height="66" fill="#a0673a" ${o()}/>
    <circle cx="60" cy="40" r="34" fill="#69db7c" ${o()}/><circle cx="34" cy="50" r="16" fill="#51cf66" ${o(3)}/><circle cx="88" cy="48" r="16" fill="#51cf66" ${o(3)}/>
    <rect x="34" y="56" width="52" height="30" fill="#ffd8a8" ${o()}/><path d="M30 58 L60 38 L90 58Z" fill="#e03131" ${o(3)}/>
    <rect x="54" y="66" width="12" height="20" fill="#a0673a" ${o(2)}/>
    <path d="M40 86 V130 M50 86 V130 M40 96 H50 M40 108 H50 M40 120 H50" ${o(3)}/>`,
  tent: `
    <path d="M10 130 L60 30 L110 130Z" fill="#ff6b6b" ${o()}/>
    <path d="M36 130 L60 30 L84 130" fill="#fff" ${o(3)}/><path d="M48 130 L60 30 L72 130" fill="#ff6b6b" ${o(3)}/>
    <path d="M50 130 Q60 100 70 130Z" fill="${K}"/>
    <path d="M60 30 V8 L80 14 L60 20" fill="#ffd43b" ${o(3)}/>`,
  balloon: `
    <path d="M60 8 Q100 8 100 48 Q100 76 72 92 H48 Q20 76 20 48 Q20 8 60 8Z" fill="#ff922b" ${o()}/>
    <path d="M60 8 Q78 40 72 92 M60 8 Q42 40 48 92" fill="none" ${o(3)}/><path d="M40 16 Q32 48 48 92 M80 16 Q88 48 72 92" fill="none" stroke="#ffd43b" stroke-width="6"/>
    <path d="M48 92 L50 108 M72 92 L70 108" ${o(3)}/>
    <rect x="46" y="106" width="28" height="22" rx="3" fill="#c97b3f" ${o()}/>`,
  spaceship: `
    <path d="M60 4 Q86 30 84 90 H36 Q34 30 60 4Z" fill="#f1f3f5" ${o()}/>
    <circle cx="60" cy="46" r="11" fill="#74c0fc" ${o(3)}/>
    <path d="M36 70 L14 108 L36 100 M84 70 L106 108 L84 100" fill="#e03131" ${o()}/>
    <rect x="44" y="90" width="32" height="10" fill="#adb5bd" ${o(3)}/>
    <path d="M46 100 Q60 140 74 100Z" fill="#ff922b" class="flame" ${o(3)}/>`,
};

// Bauwerk anzeigen, von unten nach oben zu `pct` Prozent gebaut
let uid = 0;
export function buildingSvg(key, pct = 100, cls = "") {
  const id = "bclip" + (++uid);
  const h = Math.max(0, Math.min(100, pct));
  const top = 140 - (h / 100) * 140;
  const done = h >= 100;
  return `<svg viewBox="0 0 120 140" class="building ${done ? "done" : ""} ${cls}" aria-hidden="true">
    <defs><clipPath id="${id}"><rect x="-10" y="${top}" width="140" height="${150 - top}"/></clipPath></defs>
    <g opacity=".14">${B[key] || B.lighthouse}</g>
    <g clip-path="url(#${id})">${B[key] || B.lighthouse}</g>
    ${done && key === "lighthouse" ? `<path class="beam" d="M60 24 L-20 4 L-20 44Z M60 24 L140 4 L140 44Z" fill="#ffe066" opacity=".55"/>` : ""}
    ${done ? `<g class="sparkle" fill="#ffd43b"><path d="M14 20 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3Z"/><path d="M106 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z"/></g>` : ""}
  </svg>`;
}
export const BUILDING_KEYS = Object.keys(B);
