// Meteo, el asistente de Che, Clima, versión web.
// Es el mismo dibujo que en la app (app/src/componentes/meteo.tsx): si cambiás
// uno, cambiá el otro. Las animaciones están en estilos.css (flota, parpadea,
// la estela titila) y el saludo es una animación del propio dibujo.

const METEO = {
  ROCA: "#8d7b6c", BORDE: "#4f4037", CRATER: "#76655a", BOCA: "#6b2e2e",
  FUEGO: "#ff8a3d", FUEGO_CLARO: "#ffd166", ROJO: "#e63946", AZUL: "#2f6fd0",
  CAJA: "-10 -50 180 225",
};

// Qué cara pone Meteo según la frase del día (misma regla que la app)
function animoDe(situacion, seria, noche) {
  if (seria || situacion === "alerta" || (situacion || "").startsWith("serio_")) return "serio";
  switch (situacion) {
    case "lluvia_todo_el_dia": case "lluvia_franja": case "tormenta_posible": return "lluvia";
    case "ya_paro": return "paro";
    case "dudoso": return "dudoso";
    case "viento": return "viento";
    case "calor": return noche ? "feliz" : "calor";
    case "calorcito": case "lindo": return noche ? "feliz" : "sol";
    case "frio": return "frio";
    case "fresco": return "fresco";
    case "nublado": return "nublado";
    default: return "feliz";
  }
}

function meteoOjos(a) {
  const { BORDE } = METEO;
  if (a === "sol" || a === "calor") {
    return `<rect x="54" y="70" width="28" height="18" rx="7" fill="#1d1d28"/>
      <rect x="84" y="70" width="28" height="18" rx="7" fill="#1d1d28"/>
      <line x1="81" y1="76" x2="85" y2="76" stroke="#1d1d28" stroke-width="3"/>
      <line x1="59" y1="74" x2="66" y2="74" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>
      <line x1="89" y1="74" x2="96" y2="74" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>`;
  }
  if (a === "viento") {
    return `<g stroke="${BORDE}" stroke-width="3.5" stroke-linecap="round">
      <line x1="58" y1="79" x2="78" y2="82"/><line x1="87" y1="82" x2="107" y2="79"/></g>`;
  }
  const [dx, dy] = a === "nublado" ? [1, -4] : a === "pensando" ? [3, -4] : a === "dudoso" ? [-2, 0] : [0, 1];
  const ojo = x => `<g class="meteo-ojo">
      <ellipse cx="${x}" cy="80" rx="11" ry="13" fill="#fff" stroke="${BORDE}" stroke-width="2"/>
      <circle cx="${x + dx}" cy="${81 + dy}" r="5.5" fill="#2b2320"/>
      <circle cx="${x + dx + 2}" cy="${79 + dy}" r="1.8" fill="#fff"/></g>`;
  return ojo(68) + ojo(97);
}

function meteoCejas(a) {
  let d = "M58 63 Q68 58 78 63 M87 63 Q97 58 107 63";
  if (a === "serio" || a === "frio") d = "M58 65 L77 59 M88 59 L107 65";
  else if (a === "dudoso" || a === "pensando") d = "M58 64 Q68 61 78 64 M87 56 Q97 49 107 57";
  else if (a === "saludo" || a === "paro") d = "M58 60 Q68 54 78 60 M87 60 Q97 54 107 60";
  if (a === "sol" || a === "calor") d = "M58 62 Q68 58 78 62 M87 62 Q97 58 107 62";
  return `<path d="${d}" stroke="${METEO.BORDE}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
}

function meteoBoca(a) {
  const { BORDE, BOCA } = METEO;
  const trazo = `stroke="${BORDE}" stroke-width="3.5" stroke-linecap="round" fill="none"`;
  switch (a) {
    case "saludo": case "paro":
      return `<path d="M68 98 Q82 120 96 98 Q82 103 68 98 Z" fill="${BOCA}" stroke="${BORDE}" stroke-width="2.5" stroke-linejoin="round"/>
        <ellipse cx="82" cy="108" rx="5" ry="2.6" fill="#e07a7a"/>`;
    case "calor": return `<ellipse cx="82" cy="104" rx="6" ry="7" fill="${BOCA}" stroke="${BORDE}" stroke-width="2"/>`;
    case "viento": return `<ellipse cx="82" cy="104" rx="4" ry="5" fill="${BOCA}" stroke="${BORDE}" stroke-width="2"/>`;
    case "frio": return `<path d="M70 104 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3" stroke="${BORDE}" stroke-width="3" stroke-linecap="round" fill="none" stroke-linejoin="round"/>`;
    case "dudoso": return `<path d="M70 104 Q76 99 82 104 T94 104" ${trazo}/>`;
    case "serio": return `<path d="M73 105 L91 105" ${trazo}/>`;
    case "pensando": return `<path d="M77 105 L90 101" ${trazo}/>`;
    case "lluvia": return `<path d="M74 102 Q82 108 90 102" ${trazo}/>`;
    default: return `<path d="M70 100 Q82 112 94 100" ${trazo}/>`;
  }
}

function meteoBrazos(a) {
  const { BORDE, ROCA } = METEO;
  const t = `stroke="${BORDE}" stroke-width="5" stroke-linecap="round" fill="none"`;
  const mano = ([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${ROCA}" stroke="${BORDE}" stroke-width="2"/>`;
  const izq = a === "pensando" ? ["M40 100 Q52 118 66 113", [68, 112]] : ["M38 98 Q24 106 20 118", [20, 120]];
  let der = ["M127 98 Q140 106 144 118", [144, 120]];
  if (a === "saludo") der = ["M127 92 Q144 78 148 60", [148, 57]];
  if (a === "lluvia") der = ["M126 92 Q138 80 128 64", [127, 62]];
  // El saludo: el brazo derecho se mueve de un lado al otro (3 veces al aparecer)
  const saludo = a === "saludo"
    ? `<animateTransform attributeName="transform" type="rotate" values="0 127 92; 16 127 92; 0 127 92" dur=".52s" repeatCount="3"/>` : "";
  return `<path d="${izq[0]}" ${t}/>${mano(izq[1])}
    <g class="meteo-brazo-der">${saludo}<path d="${der[0]}" ${t}/>${mano(der[1])}</g>`;
}

function meteoAccesorios(a) {
  const { BORDE, ROJO, AZUL } = METEO;
  let html = "";
  if (a === "calor") html += `<path d="M123 46 Q130 57 123 62 Q116 57 123 46 Z" fill="#7fc4ff" stroke="#3d8fd6" stroke-width="1.2"/>`;
  if (a === "frio") {
    html += `<path d="M50 48 Q80 10 112 46 Q80 36 50 48 Z" fill="${ROJO}" stroke="#a3202c" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="81" cy="21" r="6" fill="#fff"/>`;
  }
  if (a === "frio" || a === "fresco") {
    html += `<path d="M40 113 Q82 131 124 113 L122 124 Q82 142 42 124 Z" fill="${ROJO}" stroke="#a3202c" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M98 127 L106 152 L96 154 L90 129 Z" fill="${ROJO}" stroke="#a3202c" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M58 120 L60 129 M74 124 L75 133 M100 155 L101 151" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>`;
  }
  if (a === "dudoso" || a === "paro") {
    html += `<path d="M17 72 L24 146" stroke="${BORDE}" stroke-width="3" stroke-linecap="round"/>
      <path d="M17 76 L10 122 Q17 128 25 124 Z" fill="${AZUL}" stroke="#1f4f9a" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M24 146 Q25 154 31 152" stroke="${BORDE}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
  }
  return html;
}

function meteoParaguasAbierto() {
  return `<g transform="translate(88 4) rotate(-34)">
    <path d="M0 0 L0 70" stroke="${METEO.BORDE}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M-52 0 Q-50 -42 0 -44 Q50 -42 52 0 Q39 -9 26 0 Q13 -9 0 0 Q-13 -9 -26 0 Q-39 -9 -52 0 Z" fill="${METEO.AZUL}" stroke="#1f4f9a" stroke-width="2" stroke-linejoin="round"/>
    <path d="M0 -44 Q-14 -24 -26 0 M0 -44 Q14 -24 26 0" stroke="#1f4f9a" stroke-width="1.5" fill="none"/>
    <circle cx="0" cy="-46" r="3" fill="#1f4f9a"/></g>`;
}

/**
 * Devuelve el HTML de Meteo con la cara pedida.
 * tam: alto en píxeles. etiqueta: texto para lectores de pantalla ("" = decorativo).
 */
function meteoHTML(a, tam = 120, etiqueta = "Meteo, el asistente de Che, Clima") {
  const { ROCA, BORDE, CRATER, FUEGO, FUEGO_CLARO, CAJA } = METEO;
  const mejillas = a === "serio" ? "" : a === "frio" ? "#8cb8f2" : "#f28c8c";
  const viento = a === "viento" ? `<g stroke="#fff" stroke-opacity=".85" stroke-width="3" stroke-linecap="round" fill="none">
      <path d="M-8 68 Q8 62 24 70"/><path d="M-10 92 Q4 86 18 94"/><path d="M-6 116 Q8 110 22 118"/></g>` : "";
  const estela = `<svg class="meteo-estela" viewBox="${CAJA}" aria-hidden="true">
      <path d="M42 66 C24 40 8 6 -6 -36 C14 -16 30 -6 44 0 C40 -14 40 -28 46 -42 C56 -14 70 10 88 36 Z" fill="${FUEGO}" opacity=".95"/>
      <path d="M52 60 C40 40 30 18 22 -8 C36 4 46 10 56 14 C54 4 56 -6 60 -14 C66 4 74 20 84 40 Z" fill="${FUEGO_CLARO}"/>
      <circle cx="6" cy="-8" r="2.5" fill="${FUEGO_CLARO}"/><circle cx="30" cy="-32" r="2" fill="${FUEGO_CLARO}"/></svg>`;
  const cuerpo = `<svg class="meteo-cuerpo" viewBox="${CAJA}" aria-hidden="true">
      ${viento}
      <path d="M72 126 L68 146 M93 126 L97 146" stroke="${BORDE}" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="64" cy="148" rx="9" ry="5" fill="${BORDE}"/><ellipse cx="101" cy="148" rx="9" ry="5" fill="${BORDE}"/>
      <path d="M80 36 C104 34 126 50 129 76 C132 100 120 124 96 131 C74 137 46 130 36 108 C27 88 32 60 50 46 C58 40 68 37 80 36 Z" fill="${ROCA}" stroke="${BORDE}" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="60" cy="53" rx="11" ry="6" fill="#fff" opacity=".18" transform="rotate(-25 60 53)"/>
      <circle cx="113" cy="106" r="7" fill="${CRATER}" stroke="#a08f80" stroke-width="1.5"/>
      <circle cx="49" cy="111" r="5" fill="${CRATER}" stroke="#a08f80" stroke-width="1.5"/>
      <circle cx="114" cy="58" r="3.5" fill="${CRATER}"/><circle cx="44" cy="78" r="3" fill="${CRATER}"/>
      ${mejillas ? `<g opacity=".5"><ellipse cx="55" cy="96" rx="6" ry="4" fill="${mejillas}"/><ellipse cx="109" cy="96" rx="6" ry="4" fill="${mejillas}"/></g>` : ""}
      ${meteoCejas(a)}${meteoOjos(a)}${meteoBoca(a)}${meteoAccesorios(a)}${meteoBrazos(a)}
      ${a === "lluvia" ? meteoParaguasAbierto() : ""}</svg>`;
  const accesible = etiqueta ? `role="img" aria-label="${etiqueta}"` : `aria-hidden="true"`;
  return `<div class="meteo meteo-${a}" style="height:${tam}px;width:${Math.round(tam * 0.8)}px" ${accesible}>
      <div class="meteo-dentro">${estela}${cuerpo}</div></div>`;
}

// Si lo tocás, salta (igual que en la app)
document.addEventListener("click", ev => {
  const m = ev.target.closest && ev.target.closest(".meteo");
  if (!m) return;
  m.classList.remove("meteo-salta");
  void m.offsetWidth; // reinicia la animación
  m.classList.add("meteo-salta");
});
