// Che, Clima — página "Radar".
// Las últimas 2 horas: imagen infrarroja del satélite GOES-19 (NASA GIBS, gratis y
// pública), cada 20 minutos. Los colores son las nubes más altas y frías: las de
// tormenta. Llega con unos 30-40 minutos de demora.
// Antes se usaba el radar de RainViewer, pero no tiene los radares argentinos
// (30-oct-2026: llovía con tormenta en Ezeiza y el mapa venía vacío). El radar
// oficial del SMN no se puede mostrar acá: se enlaza a su página.
// Se puede abrir centrado en un lugar: radar.html?lat=-34.6&lon=-58.4
//
// Después, "las próximas 2 horas": lo que pronostican los 7 modelos (promedio) en
// una cuadrícula que cubre lo que se ve del mapa (cuadros de 25 km o más grandes
// si el mapa está alejado). Se recalcula al mover o acercar el mapa. Lo pide el
// navegador de cada persona a Open-Meteo.

const SATELITE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_Band13_Clean_Infrared/default";
const ZOOM_MAXIMO_SATELITE = 6;   // la NASA lo entrega hasta este detalle
const PASO_SATELITE = 20;         // minutos entre imágenes de la animación
const IMAGENES_SATELITE = 7;      // 2 horas
const ZONA = "America/Argentina/Buenos_Aires";

const parametros = new URLSearchParams(location.search);
const lat = Number(parametros.get("lat"));
const lon = Number(parametros.get("lon"));
const hayLugar = Number.isFinite(lat) && Number.isFinite(lon) && parametros.has("lat");
const zoomPedido = Number(parametros.get("z"));   // opcional: radar.html?lat=..&lon=..&z=5

const oscuro = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
const mapa = L.map("mapa", { zoomControl: true, attributionControl: true })
  .setView(hayLugar ? [lat, lon] : [-36.5, -63.5], zoomPedido >= 3 && zoomPedido <= 10 ? zoomPedido : hayLugar ? 7 : 4);
// El mapa de fondo va en su propia capa, así el filtro del modo oscuro no toca al radar
mapa.createPane("fondo").style.zIndex = 150;
// Mapa oficial argentino (Argenmap, del Instituto Geográfico Nacional): nombres en español
// e Islas Malvinas (el mapa estándar de OpenStreetMap dice "Falkland Islands").
// Tiene versión oscura propia, así que no hace falta invertir colores.
const CAPA_IGN = oscuro ? "argenmap_oscuro" : "capabaseargenmap";
L.tileLayer(`https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/${CAPA_IGN}@EPSG%3A3857@png/{z}/{x}/{y}.png`, {
  pane: "fondo",
  tms: true,
  maxZoom: 10,
  attribution: '<a href="https://www.ign.gob.ar/">Instituto Geográfico Nacional</a> + © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(mapa);
if (hayLugar) L.circleMarker([lat, lon], { radius: 6, color: "#1f5fbf", weight: 3, fillOpacity: 0.9 }).addTo(mapa);
mapa.attributionControl.addAttribution('Satélite: <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> / NOAA GOES-19');

const MODELOS = ["ecmwf_ifs", "gfs_seamless", "icon_seamless", "gem_seamless", "meteofrance_seamless", "ukmo_seamless", "jma_seamless"];
const PASO_MINIMO = 0.25; // grados: cuadros de ~25 km como mínimo (es el detalle de los modelos)
const PUNTOS_POR_LADO = 15; // hasta 15 x 15 puntos, cubriendo lo que se ve del mapa
// Colores por milímetros en la hora (los mismos de la escala del radar)
const COLORES = [[0.1, "#88ddee"], [0.5, "#0099cc"], [2, "#0077aa"], [5, "#ffee00"], [10, "#ffaa00"], [20, "#ff4400"], [40, "#c10000"]];

let cuadros = [];   // [{ mostrar(visible), hora, futuro }]
let actual = 0;
let ultimoRadar = 0; // la imagen de satélite más nueva (después vienen los pronósticos)
let animando = true;
let reloj = null;

function horaLocal(segundos) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date(segundos * 1000));
}

function mostrar(i) {
  if (!cuadros.length) return;
  cuadros[actual].mostrar(false);
  actual = (i + cuadros.length) % cuadros.length;
  cuadros[actual].mostrar(true);
  document.getElementById("cuadro").value = actual;
  const c = cuadros[actual];
  document.getElementById("hora").textContent = c.futuro ? `${c.hora} h ⏩` : `${c.hora} h`;
  document.getElementById("tipo").textContent = c.futuro
    ? "Pronóstico de los modelos: lluvia en la próxima hora"
    : "Satélite: nubes de tormenta";
  document.getElementById("escala-satelite").hidden = !!c.futuro;
  document.getElementById("escala-modelos").hidden = !c.futuro;
}

// Capa del satélite: deja transparente lo que no es nube, apenas marca las nubes comunes
// (gris) y muestra fuerte los colores (nubes altas y frías: tormenta).
const CapaSatelite = L.TileLayer.extend({
  createTile(coords, listo) {
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = 256;
    const imagen = new Image();
    imagen.crossOrigin = "anonymous";
    imagen.onload = () => {
      const ctx = lienzo.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(imagen, 0, 0, 256, 256);
      try {
        const d = ctx.getImageData(0, 0, 256, 256), p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          const max = Math.max(p[i], p[i + 1], p[i + 2]), min = Math.min(p[i], p[i + 1], p[i + 2]);
          p[i + 3] = max - min > 40 ? 235 : max > 150 ? Math.round((max - 150) * 1.1) : 0;
        }
        ctx.putImageData(d, 0, 0);
      } catch (e) { /* si el navegador no deja leer la imagen, se ve tal cual */ }
      listo(null, lienzo);
    };
    imagen.onerror = () => listo(new Error("sin imagen"), lienzo);
    imagen.src = this.getTileUrl(coords);
    return lienzo;
  },
});

function urlSatelite(milisegundos) {
  return `${SATELITE}/${new Date(milisegundos).toISOString().slice(0, 19)}Z/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;
}

function capaDeSatelite(milisegundos) {
  const capa = new CapaSatelite(urlSatelite(milisegundos), { opacity: 0, maxNativeZoom: ZOOM_MAXIMO_SATELITE, maxZoom: 10, zIndex: 5 }).addTo(mapa);
  return { capa, mostrar: v => capa.setOpacity(v ? 1 : 0) };
}

/** La imagen más nueva que ya publicó la NASA (llegan con demora): se prueba un cuadro de Sudamérica. */
function existeImagen(milisegundos) {
  return new Promise(ok => {
    const prueba = new Image();
    prueba.onload = () => ok(true);
    prueba.onerror = () => ok(false);
    prueba.src = urlSatelite(milisegundos).replace("{z}/{y}/{x}", "3/4/2");
  });
}

async function ultimaImagenSatelite() {
  let t = Math.floor(Date.now() / 600000) * 600000 - 20 * 60000;
  for (let k = 0; k < 12; k++, t -= 600000) if (await existeImagen(t)) return t;
  throw new Error("sin imágenes del satélite");
}

function colorDe(mm) {
  let color = null;
  for (const [desde, c] of COLORES) if (mm >= desde) color = c;
  return color;
}

/** Las próximas 2 horas según los modelos, en todo lo que se ve del mapa. */
async function pronosticoModelos() {
  const b = mapa.getBounds();
  const sur = Math.max(b.getSouth(), -85), norte = Math.min(b.getNorth(), 85);
  const oeste = Math.max(b.getWest(), -180), este = Math.min(b.getEast(), 180);
  const lado = Math.max(norte - sur, este - oeste);
  const PASO = Math.max(PASO_MINIMO, Math.ceil(lado / (PUNTOS_POR_LADO - 1) / PASO_MINIMO) * PASO_MINIMO);
  const puntos = [];
  for (let la = Math.floor(sur / PASO) * PASO; la <= norte + PASO / 2; la += PASO) {
    for (let lo = Math.floor(oeste / PASO) * PASO; lo <= este + PASO / 2; lo += PASO) puntos.push([la, lo]);
  }
  const parametros = new URLSearchParams({
    latitude: puntos.map(p => p[0].toFixed(2)).join(","),
    longitude: puntos.map(p => p[1].toFixed(2)).join(","),
    hourly: "precipitation", models: MODELOS.join(","), forecast_hours: "3", timezone: "GMT",
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${parametros}`);
  if (!r.ok) throw new Error(r.status);
  const datos = await r.json();
  const lista = Array.isArray(datos) ? datos : [datos];
  // Horas 1 y 2: la lluvia de la hora que termina a esa hora (así la da Open-Meteo)
  return [1, 2].map(h => {
    const grupo = L.layerGroup();
    lista.forEach((d, k) => {
      const valores = MODELOS.map(m => (d.hourly[`precipitation_${m}`] || [])[h]).filter(v => v != null);
      if (!valores.length) return;
      const mm = valores.reduce((a, b) => a + b, 0) / valores.length;
      const color = colorDe(mm);
      if (!color) return;
      const [la, lo] = puntos[k];
      L.rectangle([[la - PASO / 2, lo - PASO / 2], [la + PASO / 2, lo + PASO / 2]],
        { stroke: false, fillColor: color, fillOpacity: 0.75, interactive: false }).addTo(grupo);
    });
    const tiempo = Date.parse(lista[0].hourly.time[h] + ":00Z") / 1000;
    return { hora: horaLocal(tiempo), futuro: "modelos", grupo, mostrar: v => (v ? grupo.addTo(mapa) : grupo.remove()) };
  });
}

function animar(si) {
  animando = si;
  const boton = document.getElementById("reproducir");
  boton.textContent = si ? "⏸" : "▶";
  boton.setAttribute("aria-label", si ? "Pausar la animación" : "Reproducir la animación");
  clearInterval(reloj);
  if (si) reloj = setInterval(() => {
    // Se queda un poco más en el último cuadro (el de ahora)
    mostrar(actual === cuadros.length - 1 ? 0 : actual + 1);
  }, 700);
}

async function cargar() {
  try {
    const ultima = await ultimaImagenSatelite();
    // Saca las capas de la carga anterior (se recarga cada 10 minutos)
    cuadros.forEach(c => { c.mostrar(false); if (c.capa) mapa.removeLayer(c.capa); });
    cuadros = [];
    for (let k = IMAGENES_SATELITE - 1; k >= 0; k--) {
      const t = ultima - k * PASO_SATELITE * 60000;
      cuadros.push({ hora: horaLocal(t / 1000), ...capaDeSatelite(t) });
    }
    ultimoRadar = cuadros.length - 1;
    try {
      cuadros.push(...await pronosticoModelos());
    } catch (e) { /* sin pronóstico: queda solo el satélite */ }
    const cuadro = document.getElementById("cuadro");
    cuadro.max = cuadros.length - 1;
    actual = 0;
    mostrar(ultimoRadar);
    document.getElementById("estado").textContent =
      `Última imagen del satélite: ${cuadros[ultimoRadar].hora} h (llega con unos 40 minutos de demora). ` +
      (cuadros.length > ultimoRadar + 1 ? "Al final de la animación ⏩: la lluvia que pronostican los modelos para las próximas 2 horas." : "");
    animar(true);
  } catch (e) {
    document.getElementById("estado").textContent = "No pudimos cargar el satélite. Probá de nuevo en un rato.";
  }
}

// Al mover o acercar el mapa, el pronóstico se vuelve a pedir para lo que se ve
let esperaModelos = null;
let pedidoModelos = 0;
async function actualizarModelos() {
  const pedido = ++pedidoModelos;
  let nuevos;
  try { nuevos = await pronosticoModelos(); } catch (e) { return; }
  if (pedido !== pedidoModelos || !cuadros.length) return;   // llegó uno más nuevo
  cuadros.filter(c => c.futuro).forEach(c => c.mostrar(false));
  cuadros = cuadros.filter(c => !c.futuro).concat(nuevos);
  document.getElementById("cuadro").max = cuadros.length - 1;
  actual = Math.min(actual, cuadros.length - 1);
  cuadros.forEach((c, k) => c.mostrar(k === actual));
}
mapa.on("moveend", () => {
  clearTimeout(esperaModelos);
  esperaModelos = setTimeout(actualizarModelos, 900);
});

document.getElementById("reproducir").addEventListener("click", () => animar(!animando));
document.getElementById("cuadro").addEventListener("input", e => { animar(false); mostrar(Number(e.target.value)); });
// Con "reducir movimiento", arranca quieto en la imagen de ahora
if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  cargar().then(() => { animar(false); mostrar(ultimoRadar); });
} else {
  cargar();
}
setInterval(cargar, 10 * 60 * 1000);
