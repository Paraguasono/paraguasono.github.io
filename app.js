// Che, Clima — arma la página a partir de datos/pronostico.json
// (ese archivo lo genera scripts/actualizar.py cada 30 minutos; de noche, cada hora).

const ICONOS = { tormenta: "⛈️", lluvia: "🌧️", dudoso: "🌦️", nublado: "☁️", parcial: "⛅", sol: "☀️" };
const ZONA = "America/Argentina/Buenos_Aires";
const HORA_CAMBIO_A_MANANA = 20; // desde las 20 h, el día principal pasa a ser mañana
const UMBRAL_SI = 50;            // % de modelos con lluvia para decir "Sí"
const UMBRAL_DUDAS = 30;         // % para decir "Por las dudas"

let datos = null;
let aciertos = null; // resumen de aciertos (opcional: si no carga, la página anda igual)
let noticias = null; // titulares de otros medios (opcional; los arma scripts/noticias.py)

// Para mostrar primero los titulares que hablan de la ciudad elegida
const ALIAS_NOTICIAS = {
  "caba": ["Buenos Aires", "AMBA", "porteñ"],
  "gba-norte": ["Buenos Aires", "AMBA", "conurbano"],
  "gba-sur-oeste": ["Buenos Aires", "AMBA", "conurbano"],
  "la-plata": ["La Plata", "Buenos Aires"],
  "cordoba": ["Córdoba", "Cordoba"],
  "rosario": ["Rosario", "Santa Fe"],
  "mendoza": ["Mendoza"],
  "tucuman": ["Tucumán", "Tucuman"],
  "mar-del-plata": ["Mar del Plata", "Costa Atlántica"],
};

// Evita que un texto externo (por ejemplo un METAR) se interprete como HTML
function seguro(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Fecha y hora actual en Argentina, como texto "2026-10-22T18:05"
function ahoraArgentina() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// Minutos entre dos horas "AAAA-MM-DDTHH:MM" (las dos en hora argentina)
function minutosEntre(desde, hasta) {
  return Math.round((Date.parse(hasta + ":00Z") - Date.parse(desde + ":00Z")) / 60000);
}

// "Próximas 3 horas": con la hora actual y las 3 siguientes (misma regla que la app).
// Una hora "llueve" si la probabilidad es 50% o más, o si los modelos dan 0,5 mm o más.
function textoProximasHoras(horas) {
  const tramo = horas.slice(0, 4);
  if (!tramo.length) return "";
  const llueve = h => (h.prob ?? 0) >= 50 || (h.mm ?? 0) >= 0.5;
  const hora = h => Number(h.hora.slice(11, 13));
  if (llueve(tramo[0])) {
    const para = tramo.findIndex(h => !llueve(h));
    return para === -1 ? "Llueve ahora y sigue en las próximas horas." : `Llueve ahora; para cerca de las ${hora(tramo[para])}.`;
  }
  const empieza = tramo.find(llueve);
  if (empieza) return `Empieza a llover cerca de las ${hora(empieza)}.`;
  const quizas = tramo.find(h => (h.prob ?? 0) >= 30);
  if (quizas) return `Puede caer algo cerca de las ${hora(quizas)}.`;
  return "Sin lluvia en las próximas 3 horas.";
}

// ¿El aeropuerto reporta lluvia AHORA? (solo si la medición es de menos de 90 minutos)
function lloviendoEnAeropuerto(ciudad, ahora) {
  const obs = ciudad.ahora;
  if (!obs || minutosEntre(obs.hora, ahora) > 90) return null;
  return /tormenta|granizo|chaparr|lluvia|llovizna|nieve/.test(obs.tiempo || "") ? obs : null;
}

// Índice UV en palabras (escala de la OMS)
function nivelUV(uv) {
  return uv >= 11 ? "extremo" : uv >= 8 ? "muy alto" : uv >= 6 ? "alto" : uv >= 3 ? "moderado" : "bajo";
}

// "Sensación térmica de 9° a 15°. Índice UV máximo: 8 (muy alto)."
function lineaSensacionUV(dia) {
  const partes = [];
  if (dia.st_max != null && dia.st_min != null) partes.push(`Sensación térmica de ${dia.st_min}° a ${dia.st_max}°.`);
  if (dia.uv != null) partes.push(`Índice UV máximo: ${dia.uv} (${nivelUV(dia.uv)}).`);
  return partes.join(" ");
}

function respuestaParaguas(prob) {
  if (prob >= UMBRAL_SI) return { clase: "si", texto: "Sí", icono: "☂️" };
  if (prob >= UMBRAL_DUDAS) return { clase: "dudas", texto: "Por las dudas", icono: "🌂" };
  return { clase: "no", texto: "No", icono: "😎" };
}

function nombreDia(dia, hoy) {
  const dif = Math.round((Date.parse(dia.fecha) - Date.parse(hoy)) / 86400000);
  if (dif === 0) return "Hoy";
  if (dif === 1) return "Mañana";
  return dia.dia_semana;
}

const TEXTO_FRANJA = { madrugada: "de madrugada", manana: "a la mañana", tarde: "a la tarde", noche: "a la noche" };
function cuandoLlueve(dia) {
  const t = dia.franjas_lluvia.map(f => TEXTO_FRANJA[f]);
  if (!t.length) return "";
  if (t.length >= 3) return "casi todo el día";
  return t.join(" y ");
}

function fechaCorta(fechaIso) {
  const [a, m, d] = fechaIso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

// ---------- Bloques de la página ----------

// "2026-10-23T20:59:59-03:00" → "21 h" (el SMN pone vencimientos a las xx:59)
function horaRedonda(fechaHora) {
  if (!fechaHora || fechaHora.length < 16) return "";
  let h = Number(fechaHora.slice(11, 13)), m = Number(fechaHora.slice(14, 16));
  if (m >= 55) { h = (h + 1) % 24; m = 0; }
  return m === 0 ? `${h} h` : `${h}:${String(m).padStart(2, "0")} h`;
}

// Alerta oficial del SMN (primero) y nuestra vigilancia de tormentas, bien visibles
function bannerAlertas(ciudad) {
  const alertas = ciudad.alertas_smn || [];
  const aviso = ciudad.tormenta;
  let html = alertas.map(a => `
    <div class="banner-alerta ${seguro(a.color)}" role="alert">
      <strong>⚠️ ${a.tipo === "aviso" ? "Aviso" : "Alerta"} ${seguro(a.color)} del SMN: ${seguro(a.evento.toLowerCase())}</strong>
      ${a.hasta ? `Hasta las ${horaRedonda(a.hasta)}. ` : ""}<a href="${seguro(a.link)}" target="_blank" rel="noopener">Ver la alerta oficial</a>
    </div>`).join("");
  if (aviso) {
    html += `
    <div class="banner-alerta ${aviso.nivel === "fuerte" ? "naranja" : "amarilla"}" role="alert">
      <strong>⛈️ ${aviso.nivel === "fuerte" ? "Tormenta fuerte" : "Posible tormenta"} entre las ${seguro(aviso.desde)} y las ${seguro(aviso.hasta)} h</strong>
      ${aviso.fuente === "aeropuerto" ? `${seguro(aviso.detalles.join(", "))}. Último reporte del aeropuerto.` : "Según nuestra vigilancia de los modelos."} <a href="tormentas.html">Ver satélite y detalles</a>
    </div>`;
  }
  return html;
}

// Para hoy, la lluvia que importa es la de lo que queda del día, no la que ya pasó
function vistaDelDia(dia) {
  return dia.resto_del_dia ? { ...dia, ...dia.resto_del_dia } : dia;
}

function bloquePrincipal(ciudad, diaCompleto, hoy) {
  const dia = vistaDelDia(diaCompleto);
  const r = respuestaParaguas(dia.prob_lluvia);
  const cuando = cuandoLlueve(dia);
  const frase = dia.frase;
  // Las alertas solo se muestran en el día de hoy
  const banner = dia.fecha === hoy ? bannerAlertas(ciudad) : "";
  const hora = Number(ahoraArgentina().slice(11, 13));
  const noche = hora >= 20 || hora < 7;
  const periodo = diaCompleto.resto_del_dia ? `Para lo que queda del día (desde las ${dia.desde} h): ` : "";
  return `
    <section class="tarjeta principal">
      <p class="cuando">${nombreDia(dia, hoy)} en ${seguro(ciudad.nombre)} · ${fechaCorta(dia.fecha)}</p>
      ${banner}
      ${escenaHTML(dia.cielo, noche, meteoHTML(animoDe(frase.situacion, frase.seria || !!banner, noche), 142))}
      <p class="globo arriba ${frase.seria ? "seria" : ""}"><span class="sr">Meteo dice: </span>${seguro(frase.texto)}</p>
      ${dia.fecha === hoy ? lineaProximas(ciudad) : ""}
      <div class="respuesta ${r.clase}" role="status">
        <span class="icono" aria-hidden="true">${r.icono}</span>
        <span>¿Paraguas? ${r.texto}</span>
      </div>
      <dl class="datos">
        <div class="dato"><dt>Máxima</dt><dd>${dia.max}°</dd></div>
        <div class="dato"><dt>Mínima</dt><dd>${dia.min}°</dd></div>
        <div class="dato"><dt>Lluvia</dt><dd>${dia.prob_lluvia}%${dia.mm ? ` <small>${dia.mm} mm</small>` : ""}</dd></div>
      </dl>
      <p class="explicacion">
        ${periodo}${dia.modelos_con_lluvia} de ${dia.modelos_total} modelos dan lluvia${cuando ? `, sobre todo ${cuando}` : ""}.
        Ráfagas de hasta ${dia.rafagas ?? "–"} km/h. ${lineaSensacionUV(diaCompleto)}
      </p>
    </section>`;
}

// Línea "Próximas 3 horas" de la tarjeta principal
function lineaProximas(ciudad) {
  const ahora = ahoraArgentina();
  const horaActual = ahora.slice(0, 13);
  const texto = textoProximasHoras(ciudad.horas.filter(h => h.hora.slice(0, 13) >= horaActual));
  if (!texto) return "";
  const obs = lloviendoEnAeropuerto(ciudad, ahora);
  const medido = obs ? ` En ${seguro(obs.nombre)} se mide ${seguro(obs.tiempo)} ahora.` : "";
  const radar = ciudad.lat != null ? `radar.html?lat=${ciudad.lat}&lon=${ciudad.lon}` : "radar.html";
  return `<p class="proximas"><strong>Próximas 3 horas:</strong> ${texto}${medido} <a href="${radar}">Ver radar →</a></p>`;
}

function bloqueAhora(ciudad, ahora) {
  const obs = ciudad.ahora;
  if (!obs) return "";
  const hace = minutosEntre(obs.hora, ahora);
  // Si la observación tiene más de 3 horas, no la mostramos como "ahora"
  if (hace > 180) return "";
  const viento = obs.viento != null ? `Viento ${obs.viento} km/h${obs.rafagas ? `, ráfagas ${obs.rafagas}` : ""}.` : "";
  return `
    <section class="tarjeta">
      <h2>Ahora en ${seguro(obs.nombre)}</h2>
      <div class="ahora">
        <span class="temp">${obs.temp ?? "–"}°</span>
        <span class="tiempo">${seguro(obs.tiempo)}</span>
        <p class="detalle">${viento} Medido a las ${obs.hora.slice(11, 16)} (hace ${hace} min).</p>
      </div>
    </section>`;
}

function bloqueHoras(ciudad) {
  // Si los datos tienen unas horas, no mostramos las horas que ya pasaron
  const horaActual = ahoraArgentina().slice(0, 13);
  const horas = ciudad.horas.filter(h => h.hora.slice(0, 13) >= horaActual);
  if (!horas.length) return "";
  const columnas = horas.map(h => {
    const prob = h.prob ?? 0;
    return `
      <div class="hora" title="${h.mm ?? 0} mm">
        <span class="h">${h.hora.slice(11, 13)} h</span>
        <span class="t">${h.temp}°</span>
        <span class="barra-caja" aria-hidden="true"><span class="barra" style="height:${Math.max(prob, 2)}%"></span></span>
        <span class="p">${prob}%</span>
      </div>`;
  }).join("");
  return `
    <section class="tarjeta">
      <h2>Próximas 24 horas</h2>
      <div class="horas">${columnas}</div>
      <p class="leyenda">La barra es la probabilidad de lluvia de cada hora.</p>
    </section>`;
}

function bloqueDias(dias, hoy) {
  if (!dias.length) return "";
  const filas = dias.map(d => {
    const r = respuestaParaguas(d.prob_lluvia);
    return `
      <li class="dia">
        <span class="nombre">${nombreDia(d, hoy)}
          <span class="sub">Paraguas: ${r.texto.toLowerCase()} · lluvia ${d.prob_lluvia}%</span>
        </span>
        <span class="icono" aria-label="${d.cielo}">${ICONOS[d.cielo] || ""}</span>
        <span class="temps">${d.max}° <span>${d.min}°</span></span>
      </li>`;
  }).join("");
  return `<section class="tarjeta"><h2>Próximos días</h2><ul class="dias">${filas}</ul></section>`;
}

function bloqueModelos(dia, modelos) {
  const filas = modelos.map(m => {
    const v = dia.por_modelo[m.id];
    if (!v) return "";
    return `<tr><td>${seguro(m.nombre)}</td><td>${v.max}°</td><td>${v.min}°</td><td>${v.mm ?? "–"}</td></tr>`;
  }).join("");
  return `
    <section class="tarjeta">
      <details>
        <summary>Qué dice cada modelo</summary>
        <table class="tabla-modelos">
          <thead><tr><th>Modelo</th><th>Máx</th><th>Mín</th><th>mm</th></tr></thead>
          <tbody>
            ${filas}
            <tr class="combinado"><td>Nuestro pronóstico</td><td>${dia.max}°</td><td>${dia.min}°</td><td>${dia.mm ?? "–"}</td></tr>
          </tbody>
        </table>
        <p class="explicacion">${seguro(datos.metodo)}</p>
      </details>
    </section>`;
}

function bloqueAciertos(ciudad) {
  if (ciudad.esUbicacion) {
    if (!ciudad.medida) return bloqueAciertosGeneral();
    ciudad = { ...ciudad, id: ciudad.medida.id, nombre: ciudad.medida.nombre };
  }
  const enlace = `<a class="ver-mas" href="aciertos.html#${seguro(ciudad.id)}">Ver el ranking completo →</a>`;
  const medida = aciertos && aciertos.ciudades.find(c => c.id === ciudad.id);
  const n = medida && medida.resumen["30"].fuentes.nuestro;
  if (!n || !n.lluvia_dias) {
    return `
      <section class="tarjeta">
        <h2>¿Cuánto acertamos?</h2>
        <p class="explicacion" style="margin:0">Todavía estamos juntando días para medir ${seguro(ciudad.nombre)}.</p>
        ${enlace}
      </section>`;
  }
  // Rango de error de los modelos solos, para comparar
  const modelos = Object.entries(medida.resumen["30"].fuentes).filter(([id]) => id !== "nuestro").map(([, v]) => v.error_max).filter(v => v != null);
  const coma = x => x.toFixed(1).replace(".", ",");
  return `
    <section class="tarjeta resumen-aciertos">
      <h2>¿Cuánto acertamos? · últimos 30 días</h2>
      <p class="titular">En ${seguro(ciudad.nombre)} acertamos si llovía o no <strong>${n.lluvia_aciertos} de ${n.lluvia_dias}</strong> días.</p>
      <p class="explicacion" style="margin:0">Le erramos a la máxima por ${coma(n.error_max)}° en promedio
      (los modelos solos, entre ${coma(Math.min(...modelos))}° y ${coma(Math.max(...modelos))}°).</p>
      ${enlace}
    </section>`;
}

function bloqueAciertosGeneral() {
  const n = aciertos && aciertos.general["30"].fuentes.nuestro;
  if (!n || !n.lluvia_dias) return "";
  return `
    <section class="tarjeta resumen-aciertos">
      <h2>¿Cuánto acertamos? · últimos 30 días</h2>
      <p class="titular">En las 9 ciudades que medimos acertamos si llovía o no <strong>${n.lluvia_aciertos} de ${n.lluvia_dias}</strong> días-ciudad.</p>
      <a class="ver-mas" href="aciertos.html">Ver el ranking completo →</a>
    </section>`;
}

function haceCuanto(iso) {
  const minutos = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  return horas < 24 ? `hace ${horas} h` : "ayer";
}

// "Qué dicen los medios": solo título, medio, hora y enlace a la nota original
function bloqueNoticias(ciudad) {
  if (!noticias || !Array.isArray(noticias.noticias) || !noticias.noticias.length) return "";
  const id = ciudad.esUbicacion ? (ciudad.medida && ciudad.medida.id) : ciudad.id;
  const claves = (ALIAS_NOTICIAS[id] || []).map(k => k.toLowerCase());
  const deAca = n => claves.some(k => String(n.titulo).toLowerCase().includes(k)) ? 1 : 0;
  const lista = noticias.noticias
    .filter(n => /^https?:\/\//.test(n.enlace))
    .map((n, i) => ({ n, i }))
    .sort((a, b) => deAca(b.n) - deAca(a.n) || a.i - b.i)
    .slice(0, 6)
    .map(({ n }) => `
      <li>
        <a href="${seguro(n.enlace)}" target="_blank" rel="noopener noreferrer nofollow">${seguro(n.titulo)}</a>
        <span class="noticia-fuente">${seguro(n.medio)} · ${haceCuanto(n.fecha)}</span>
      </li>`).join("");
  return `
    <section class="tarjeta noticias">
      <h2>Qué dicen los medios</h2>
      <ul class="lista-noticias">${lista}</ul>
      <p class="explicacion" style="margin:10px 0 0">Titulares de otros medios, con enlace a la nota original.</p>
    </section>`;
}

// ---------- Armado ----------

function marcarElegida(id) {
  try { localStorage.setItem("ciudad", id); } catch (e) { /* modo privado: no pasa nada */ }
  if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  document.querySelectorAll("#ciudades button").forEach(b =>
    b.setAttribute("aria-pressed", b.dataset.id === id ? "true" : "false"));
}

function mostrar(idCiudad) {
  if (idCiudad === "aqui") return mostrarUbicacion();
  const ciudad = datos.ciudades.find(c => c.id === idCiudad) || datos.ciudades[0];
  marcarElegida(ciudad.id);
  dibujar(ciudad);
}

// ---------- Tu ubicación ----------
// Se usa solo en el navegador: el punto va a Open-Meteo para pedir el pronóstico,
// y el cálculo es EL MISMO que el de la app (motor.js se genera desde la app).

let ubicacion = null;   // { ciudad, cuando }: el último pronóstico de donde estás
let datosApp = null;    // umbrales, frases, correcciones y alertas (datos/app.json)

function distanciaKm(a, b, c, d) {
  const r = x => x * Math.PI / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function pedirUbicacion() {
  return new Promise((ok, mal) => {
    if (!navigator.geolocation) return mal(new Error("Este navegador no da la ubicación."));
    navigator.geolocation.getCurrentPosition(ok, e => mal(new Error(
      e.code === 1 ? "No diste permiso para usar tu ubicación." : "No pudimos saber dónde estás.")),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 });
  });
}

async function pronosticoDeUbicacion() {
  const pos = await pedirUbicacion();
  const lat = pos.coords.latitude, lon = pos.coords.longitude;
  const motor = await import("./motor.js?v=1");
  if (!datosApp) {
    const r = await fetch("datos/app.json?v=" + Math.floor(Date.now() / 600000));
    if (!r.ok) throw new Error("No pudimos cargar los datos.");
    datosApp = await r.json();
  }
  const crudo = await motor.traerModelos(lat, lon, datosApp.modelos.map(m => m.id));
  // Mismo identificador que la app (coordenadas con 2 decimales): misma frase en los dos lados
  const p = motor.calcular({ id: `${lat.toFixed(2)},${lon.toFixed(2)}`, nombre: "tu ubicación", lat, lon }, datosApp, crudo);
  // La ciudad medida más cercana (hasta 40 km): su aeropuerto para "Ahora en…" y sus aciertos
  const cercana = datos.ciudades
    .filter(c => c.lat != null)
    .map(c => ({ c, km: distanciaKm(lat, lon, c.lat, c.lon) }))
    .sort((a, b) => a.km - b.km)[0];
  const medida = cercana && cercana.km <= 40 ? cercana.c : null;
  return {
    id: "aqui", nombre: "tu ubicación", lat, lon, esUbicacion: true,
    dias: p.dias, horas: p.horas, alertas_smn: p.alertas, tormenta: p.tormenta,
    ahora: medida ? medida.ahora : null,
    medida: medida ? { id: medida.id, nombre: medida.nombre } : null,
  };
}

async function mostrarUbicacion() {
  marcarElegida("aqui");
  if (ubicacion && Date.now() - ubicacion.cuando < 15 * 60 * 1000) return dibujar(ubicacion.ciudad);
  document.getElementById("contenido").innerHTML = `<p class="cargando">Buscando dónde estás…</p>`;
  try {
    ubicacion = { ciudad: await pronosticoDeUbicacion(), cuando: Date.now() };
    if (location.hash === "#aqui") dibujar(ubicacion.ciudad);
  } catch (e) {
    // Sin ubicación: la primera ciudad, con el aviso de por qué
    const ciudad = datos.ciudades[0];
    marcarElegida(ciudad.id);
    dibujar(ciudad);
    document.getElementById("contenido").insertAdjacentHTML("afterbegin",
      `<p class="viejo">${seguro(e.message)} Te mostramos ${seguro(ciudad.nombre)}; podés elegir otra ciudad arriba o tocar 📍 para reintentar.</p>`);
  }
}

function dibujar(ciudad) {
  const ahora = ahoraArgentina();
  const hoy = ahora.slice(0, 10);
  const hora = Number(ahora.slice(11, 13));
  const dias = ciudad.dias.filter(d => d.fecha >= hoy);
  // Después de las 20 h, lo que importa es mañana
  const indicePrincipal = hora >= HORA_CAMBIO_A_MANANA && dias.length > 1 ? 1 : 0;
  const principal = dias[indicePrincipal];
  if (!principal) {
    document.getElementById("contenido").innerHTML = `<p class="error">No hay pronóstico disponible ahora. Probá en un rato.</p>`;
    return;
  }

  const atraso = minutosEntre(datos.actualizado, ahora);
  const aviso = !ciudad.esUbicacion && atraso > 180
    ? `<p class="viejo">Ojo: estos datos son de hace ${Math.round(atraso / 60)} horas. Puede que algo haya cambiado.</p>`
    : "";

  // Dos columnas en computadora; en el celular se ven en fila y las noticias van al final (ver estilos.css)
  document.getElementById("contenido").innerHTML =
    aviso +
    `<div class="columna">` +
    bloquePrincipal(ciudad, principal, hoy) +
    bloqueAhora(ciudad, ahora) +
    bloqueNoticias(ciudad) +
    `</div><div class="columna">` +
    bloqueHoras(ciudad) +
    bloqueDias(dias.slice(indicePrincipal + 1), hoy) +
    bloqueModelos(principal, datos.modelos) +
    bloqueAciertos(ciudad) +
    `</div>`;

  document.getElementById("actualizado").textContent = ciudad.esUbicacion
    ? `Calculado recién para tu ubicación con los 7 modelos${ciudad.medida ? `, corregido con lo que medimos en ${ciudad.medida.nombre}` : ""}. Tu ubicación no se guarda.`
    : `Actualizado: ${fechaCorta(datos.actualizado.slice(0, 10))} a las ${datos.actualizado.slice(11, 16)} h (se actualiza cada 30 minutos; de noche, cada hora).`;
}

async function iniciar() {
  // Meteo saluda en la cabecera
  document.getElementById("marca-meteo").innerHTML = meteoHTML("saludo", 64, "");
  try {
    // "?v=" evita que el navegador muestre una versión vieja guardada
    const respuesta = await fetch("datos/pronostico.json?v=" + Date.now());
    if (!respuesta.ok) throw new Error(respuesta.status);
    datos = await respuesta.json();
    try {
      const r = await fetch("datos/aciertos.json?v=" + Date.now());
      if (r.ok) aciertos = await r.json();
    } catch (e) { /* sin aciertos: se muestra el resto igual */ }
    try {
      const r = await fetch("datos/noticias.json?v=" + Math.floor(Date.now() / 600000));
      if (r.ok) noticias = await r.json();
    } catch (e) { /* sin noticias: se muestra el resto igual */ }
  } catch (e) {
    document.getElementById("contenido").innerHTML =
      `<p class="error">No pudimos cargar el pronóstico. Revisá tu conexión y recargá la página.</p>`;
    return;
  }

  const nav = document.getElementById("ciudades");
  nav.innerHTML = `<button type="button" data-id="aqui" aria-pressed="false">📍 Mi ubicación</button>` +
    datos.ciudades.map(c =>
      `<button type="button" data-id="${seguro(c.id)}" aria-pressed="false">${seguro(c.nombre)}</button>`).join("");
  nav.addEventListener("click", e => {
    const boton = e.target.closest("button");
    if (boton) mostrar(boton.dataset.id);
  });

  // Qué mostrar: lo del link, o lo que eligió la última vez; la primera vez, su ubicación
  let guardada = null;
  try { guardada = localStorage.getItem("ciudad"); } catch (e) { /* sin acceso: primera vez */ }
  mostrar(location.hash.slice(1) || guardada || (navigator.geolocation ? "aqui" : datos.ciudades[0].id));
}

iniciar();
