// Che, Clima — dibuja las imágenes y los reels animados para redes, con Meteo,
// dentro del panel privado.
//
// El agente "Publicación del día" deja en su archivo un bloque así:
//
//   ```imagenes
//   { "formato": "historia", "fondo": "alerta", "nivel": "amarilla",
//     "imagenes": [ { "titulo": "...", "texto": "...", "meteo": "serio" } ] }
//   ```
//
// Con eso se arman:
//  - imágenes PNG del tamaño justo (carrusel 1080×1350, historia 1080×1920);
//  - en los reels, un VIDEO animado: Meteo llega volando, flota y parpadea, la lluvia
//    cae, las estrellas titilan y los textos aparecen de a uno.
// Todo se dibuja en el mismo celular: no usa servidores ni gasta minutos de GitHub.
// Usa el mismo dibujo de Meteo que la web (meteo.js).
//
// Cómo está armado: cada imagen ("cuadro") primero se PREPARA (se calcula dónde va
// cada cosa) y después se PINTA en un momento t (segundos desde que empieza ese cuadro).
// La imagen quieta es pintar con t = Infinity (todo ya apareció).

const PLACAS = {
  TAMANOS: { carrusel: [1080, 1350], historia: [1080, 1920], reel: [1080, 1920] },
  LETRA: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  // Fondos: colores de arriba y de abajo, color del texto y qué decoración lleva
  FONDOS: {
    dia:      { arriba: "#2f6fd0", abajo: "#8ec5ff", texto: "#ffffff", nubes: 3 },
    noche:    { arriba: "#0d1424", abajo: "#1f3b70", texto: "#ffffff", estrellas: true },
    lluvia:   { arriba: "#3f4d63", abajo: "#7d8ea6", texto: "#ffffff", gotas: 70 },
    tormenta: { arriba: "#1d2133", abajo: "#45506e", texto: "#ffffff", gotas: 90, rayos: true },
    calor:    { arriba: "#e8590c", abajo: "#ffc94d", texto: "#ffffff", sol: true },
    frio:     { arriba: "#9cc3ef", abajo: "#e6f2ff", texto: "#10223f", nubes: 2 },
    nublado:  { arriba: "#6b7b93", abajo: "#c3cedc", texto: "#ffffff", nubes: 4 },
    alerta:   { arriba: "#151821", abajo: "#262b38", texto: "#ffffff" },
  },
  NIVELES: { amarilla: "#f4c430", naranja: "#f08a24", roja: "#d62828" },
  CARAS: ["feliz", "saludo", "sol", "calor", "lluvia", "paro", "dudoso", "viento", "frio", "fresco", "nublado", "serio", "pensando"],
  // Video
  CUADROS_POR_SEGUNDO: 30,
  TRANSICION: 0.4, // segundos de fundido entre cuadros
};

/** Saca el bloque ```imagenes ... ``` de un texto. Devuelve [datos o null, texto sin el bloque]. */
function separarImagenes(cuerpo) {
  const m = cuerpo.match(/```imagenes\s*\n([\s\S]*?)```/);
  if (!m) return [null, cuerpo];
  let datos = null;
  try { datos = JSON.parse(m[1]); } catch (e) { datos = { error: "El bloque de imágenes no se pudo leer (" + e.message + ")." }; }
  return [datos, cuerpo.replace(m[0], "")];
}

// ---------- Meteo como imagen ----------

function cargarSVG(texto) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error("no se pudo dibujar a Meteo"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(texto);
  });
}

/** Meteo en capas: estela, cuerpo y (si tiene ojos abiertos) el cuerpo con los ojos cerrados para parpadear. */
const _meteoCache = {};
function imagenesDeMeteo(cara) {
  if (!PLACAS.CARAS.includes(cara)) cara = "feliz";
  if (_meteoCache[cara]) return _meteoCache[cara];
  const caja = document.createElement("div");
  caja.innerHTML = meteoHTML(cara, 100, "");
  const [estela, cuerpo] = caja.querySelectorAll("svg");
  const preparar = svg => {
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", "800");
    svg.setAttribute("height", "1000");
    svg.removeAttribute("class");
    svg.querySelectorAll("animateTransform").forEach(a => a.remove()); // quieto: lo movemos nosotros
    return new XMLSerializer().serializeToString(svg);
  };
  const textoEstela = preparar(estela);
  const textoCuerpo = preparar(cuerpo);
  let textoCerrado = null;
  if (cuerpo.querySelector(".meteo-ojo")) {
    const copia = cuerpo.cloneNode(true);
    copia.querySelectorAll(".meteo-ojo").forEach(g => {
      const x = Number(g.querySelector("ellipse").getAttribute("cx"));
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", `M${x - 10} 80 Q${x} 87 ${x + 10} 80`);
      p.setAttribute("stroke", METEO.BORDE); p.setAttribute("stroke-width", "3.5");
      p.setAttribute("stroke-linecap", "round"); p.setAttribute("fill", "none");
      g.replaceWith(p);
    });
    textoCerrado = new XMLSerializer().serializeToString(copia);
  }
  _meteoCache[cara] = Promise.all([cargarSVG(textoEstela), cargarSVG(textoCuerpo), textoCerrado ? cargarSVG(textoCerrado) : null])
    .then(([estela, cuerpo, cerrado]) => ({ estela, cuerpo, cerrado }));
  return _meteoCache[cara];
}

// ---------- Textos ----------

/** Parte un texto en renglones que entren en "ancho". */
function renglones(ctx, texto, ancho) {
  const salida = [];
  for (const parrafo of String(texto || "").split("\n")) {
    let linea = "";
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = linea ? linea + " " + palabra : palabra;
      if (ctx.measureText(prueba).width > ancho && linea) { salida.push(linea); linea = palabra; }
      else linea = prueba;
    }
    salida.push(linea);
  }
  return salida;
}

/** Elige el tamaño de letra más grande con el que el bloque entra en el alto disponible. */
function medirBloque(ctx, texto, ancho, tamMax, tamMin, peso, altoMax, interlineado) {
  let ultimo = null;
  for (let tam = tamMax; tam >= tamMin; tam -= 2) {
    ctx.font = `${peso} ${tam}px ${PLACAS.LETRA}`;
    const lineas = renglones(ctx, texto, ancho);
    ultimo = { tam, lineas, alto: lineas.length * tam * interlineado, peso, interlineado };
    if (ultimo.alto <= altoMax) break;
  }
  return ultimo;
}

// ---------- Ayudas de animación ----------

const limitar = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const suave = p => 1 - Math.pow(1 - p, 3);                      // arranca rápido, frena al final
const conRebote = p => 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2); // se pasa un poquito y vuelve
function generadorAzar(semilla) { // números "al azar" pero siempre iguales: la imagen no cambia entre corridas
  let s = semilla;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

// ---------- Preparar y pintar un cuadro ----------

/** Calcula dónde va cada cosa de una imagen. */
async function prepararCuadro(datos, item, numero, total) {
  const formato = PLACAS.TAMANOS[datos.formato] ? datos.formato : "historia";
  const [W, H] = PLACAS.TAMANOS[formato];
  const nombreFondo = PLACAS.FONDOS[item.fondo || datos.fondo] ? (item.fondo || datos.fondo) : "dia";
  const f = PLACAS.FONDOS[nombreFondo];
  const esAlerta = nombreFondo === "alerta";
  const M = 90; // margen de los costados
  // En historias y reels, Instagram y TikTok tapan arriba (nombre de la cuenta) y abajo
  // (respuestas, descripción). Ahí no ponemos nada importante.
  const vertical = formato !== "carrusel";
  const arriba = vertical ? 210 : M;
  const abajo = vertical ? 250 : 64;
  const medidor = document.createElement("canvas").getContext("2d");

  let y = arriba + 60;
  let franja = null;
  if (esAlerta) {
    franja = { y, color: PLACAS.NIVELES[datos.nivel] || PLACAS.NIVELES.amarilla, nivel: datos.nivel || "amarilla" };
    y += 170;
  } else {
    y += 40;
  }

  // Meteo abajo (en vertical, centrado: a la derecha están los botones de las apps)
  const altoMeteo = Math.round(H * (vertical ? 0.3 : 0.32));
  const anchoMeteo = Math.round(altoMeteo * 0.8);
  const meteo = {
    x: vertical ? (W - anchoMeteo) / 2 : W - M - anchoMeteo + 20,
    y: H - abajo - 50 - altoMeteo, w: anchoMeteo, h: altoMeteo,
    capas: await imagenesDeMeteo(esAlerta ? "serio" : item.meteo).catch(() => null),
  };

  // Título y texto: lo más grande posible sin pisar a Meteo
  const ancho = W - 2 * M;
  const disponible = meteo.y - y - 30;
  const titulo = item.titulo ? medirBloque(medidor, item.titulo, ancho, vertical ? 120 : 96, 52, 900, disponible * 0.55, 1.1) : null;
  if (titulo) { titulo.y = y; y += titulo.alto + 44; }
  const restante = meteo.y - 30 - y;
  const texto = item.texto ? medirBloque(medidor, item.texto, ancho, vertical ? 66 : 56, 30, 500, restante, 1.32) : null;
  if (texto) texto.y = y;

  // El degradé del fondo se pinta una sola vez
  const fondo = document.createElement("canvas");
  fondo.width = W; fondo.height = H;
  const g0 = fondo.getContext("2d");
  const g = g0.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, f.arriba); g.addColorStop(1, f.abajo);
  g0.fillStyle = g; g0.fillRect(0, 0, W, H);

  // Decoración (posiciones fijas para que la imagen siempre salga igual)
  const azar = generadorAzar(7 + numero);
  const estrellas = f.estrellas ? Array.from({ length: 70 }, () => ({ x: azar() * W, y: azar() * H * 0.75, r: 1.5 + azar() * 3, a: 0.3 + azar() * 0.6, fase: azar() * 6 })) : [];
  const gotas = Array.from({ length: f.gotas || 0 }, () => ({ x: azar() * (W + 200), y: azar() * H, a: 0.12 + azar() * 0.2, v: 1300 + azar() * 600 }));
  const nubes = Array.from({ length: f.nubes || 0 }, (_, i) => ({ x: azar() * W, y: arriba + 120 + i * 210 + azar() * 80, s: 0.8 + azar() * 0.8, v: 12 + azar() * 22, a: 0.14 + azar() * 0.12 }));

  return {
    formato, W, H, M, f, esAlerta, vertical, arriba, abajo, franja, meteo, titulo, texto, fondo,
    estrellas, gotas, nubes, numero, total,
  };
}

function pintarNube(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 60 * s, 0, 7); ctx.arc(x + 70 * s, y - 25 * s, 75 * s, 0, 7);
  ctx.arc(x + 150 * s, y, 60 * s, 0, 7); ctx.rect(x, y - 10 * s, 150 * s, 60 * s);
  ctx.fill();
}

/**
 * Pinta un cuadro en el momento t (segundos desde que empieza; Infinity = imagen quieta).
 * entrada = true en el primer cuadro del video: Meteo llega volando.
 */
function pintarCuadro(ctx, c, t, entrada = false) {
  const quieto = !isFinite(t);
  const tt = quieto ? 0 : t;          // tiempo para lo que se mueve siempre
  const { W, H, M, f } = c;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.drawImage(c.fondo, 0, 0);

  // Estrellas que titilan
  ctx.fillStyle = "#ffffff";
  for (const e of c.estrellas) {
    ctx.globalAlpha = quieto ? e.a : e.a * (0.55 + 0.45 * Math.sin(tt * 2.2 + e.fase));
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill();
  }
  // Sol que late (calor)
  if (f.sol) {
    const r = 150 + (quieto ? 0 : 10 * Math.sin(tt * 2));
    const halo = ctx.createRadialGradient(W - 140, c.arriba + 120, 20, W - 140, c.arriba + 120, r * 2.2);
    halo.addColorStop(0, "rgba(255,240,180,.75)"); halo.addColorStop(1, "rgba(255,240,180,0)");
    ctx.globalAlpha = 1; ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H * 0.6);
  }
  // Nubes que se corren despacio
  ctx.fillStyle = "#ffffff";
  for (const n of c.nubes) {
    ctx.globalAlpha = n.a;
    const x = ((n.x + tt * n.v) % (W + 400)) - 300;
    pintarNube(ctx, x, n.y, n.s);
  }
  // Lluvia que cae
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.lineCap = "round";
  for (const g of c.gotas) {
    ctx.globalAlpha = g.a;
    const y = (g.y + tt * g.v) % (H + 60) - 60;
    const x = g.x - (tt * g.v * 0.3) % (W + 200);
    const xx = x < -100 ? x + W + 200 : x;
    ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx - 14, y + 46); ctx.stroke();
  }
  // Relámpago de vez en cuando (tormenta)
  if (f.rayos && !quieto) {
    const ciclo = tt % 4.3;
    if (ciclo > 3.9 && ciclo < 4.02 || ciclo > 4.1 && ciclo < 4.16) {
      ctx.globalAlpha = 0.28; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    }
  }
  ctx.globalAlpha = 1;

  // Arriba: la marca y, en carruseles, el número de placa
  ctx.fillStyle = f.texto; ctx.textBaseline = "top";
  ctx.globalAlpha = 0.85;
  ctx.font = `800 40px ${PLACAS.LETRA}`;
  ctx.fillText("Che, Clima", M, c.arriba - 20);
  if (c.formato === "carrusel" && c.total > 1) {
    ctx.font = `600 34px ${PLACAS.LETRA}`;
    const n = `${c.numero}/${c.total}`;
    ctx.fillText(n, W - M - ctx.measureText(n).width, c.arriba - 16);
  }
  ctx.globalAlpha = 1;

  // Alerta: franja del color del nivel (late suave)
  if (c.franja) {
    ctx.fillStyle = c.franja.color;
    ctx.globalAlpha = quieto ? 1 : 0.88 + 0.12 * Math.sin(tt * 4);
    ctx.fillRect(0, c.franja.y, W, 120);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.franja.nivel === "roja" ? "#ffffff" : "#1b1b1b";
    ctx.font = `900 56px ${PLACAS.LETRA}`; ctx.textBaseline = "middle";
    ctx.fillText(`⚠ ALERTA ${c.franja.nivel.toUpperCase()}`, M, c.franja.y + 62);
    ctx.textBaseline = "top";
  }

  // Título y texto: aparecen subiendo un poco
  const aparecer = (desde) => quieto ? 1 : suave(limitar((t - desde) / 0.45));
  ctx.fillStyle = f.texto;
  if (c.titulo) {
    const p = aparecer(entrada ? 0.7 : 0.15);
    ctx.globalAlpha = p;
    ctx.font = `${c.titulo.peso} ${c.titulo.tam}px ${PLACAS.LETRA}`;
    c.titulo.lineas.forEach((l, i) => ctx.fillText(l, M, c.titulo.y + (1 - p) * 50 + i * c.titulo.tam * c.titulo.interlineado));
  }
  if (c.texto) {
    const p = aparecer(entrada ? 1.05 : 0.5);
    ctx.globalAlpha = p;
    ctx.font = `${c.texto.peso} ${c.texto.tam}px ${PLACAS.LETRA}`;
    c.texto.lineas.forEach((l, i) => ctx.fillText(l, M, c.texto.y + (1 - p) * 40 + i * c.texto.tam * c.texto.interlineado));
  }
  ctx.globalAlpha = 1;

  // Meteo: flota, se inclina apenas, parpadea; en el primer cuadro llega volando
  const m = c.meteo;
  if (m.capas) {
    const escala = m.h / 1000;
    const tranquilo = c.esAlerta; // con alerta, movimientos mínimos
    let dx = 0, dy = quieto ? 0 : (tranquilo ? 6 : 16) * escala * 3 * Math.sin(tt * 2 * Math.PI / 2.4);
    let giro = quieto || tranquilo ? 0 : 0.045 * Math.sin(tt * 2 * Math.PI / 3.1);
    if (entrada && !quieto && !tranquilo) {
      const p = limitar(t / 0.9);
      const e = conRebote(p);
      dx += (1 - e) * -700; dy += (1 - e) * -1000;
      giro += (1 - p) * -0.5;
    }
    // Punto de giro: el centro de la roca (en proporción del dibujo)
    const px = m.x + m.w * 0.511, py = m.y + m.h * 0.604;
    ctx.save();
    ctx.translate(px + dx, py + dy);
    ctx.rotate(giro);
    // La estela titila
    const titila = quieto ? 1 : 1 + 0.05 * Math.sin(tt * 2 * Math.PI * 2.5);
    ctx.save(); ctx.scale(titila, titila);
    ctx.drawImage(m.capas.estela, -m.w * 0.511, -m.h * 0.604, m.w, m.h);
    ctx.restore();
    const parpadea = !quieto && m.capas.cerrado && (tt % 3.2) > 3.04;
    ctx.drawImage(parpadea ? m.capas.cerrado : m.capas.cuerpo, -m.w * 0.511, -m.h * 0.604, m.w, m.h);
    ctx.restore();
  }

  // Sin pie: las imágenes no llevan la dirección de la web (decisión de Marcos, 27-oct-2026)
  ctx.restore();
}

/** Dibuja una imagen quieta. Devuelve un canvas. */
async function dibujarPlaca(datos, item, numero, total) {
  const c = await prepararCuadro(datos, item, numero, total);
  const lienzo = document.createElement("canvas");
  lienzo.width = c.W; lienzo.height = c.H;
  pintarCuadro(lienzo.getContext("2d"), c, Infinity);
  return lienzo;
}

/** Dibuja todas las imágenes de un bloque. Devuelve [{canvas, nombre, encuesta}]. */
async function dibujarTodas(datos, prefijo) {
  const lista = Array.isArray(datos.imagenes) ? datos.imagenes : [];
  const salida = [];
  for (let i = 0; i < lista.length; i++) {
    const canvas = await dibujarPlaca(datos, lista[i], i + 1, lista.length);
    salida.push({ canvas, nombre: `${prefijo}-${String(i + 1).padStart(2, "0")}.png`, encuesta: lista[i].encuesta || null });
  }
  return salida;
}

// ---------- Video del reel ----------

/** Prepara el video: cada cuadro dura según cuánto texto tiene (para que dé tiempo a leerlo). */
async function prepararVideo(datos) {
  const lista = Array.isArray(datos.imagenes) ? datos.imagenes : [];
  const cuadros = [];
  let inicio = 0;
  for (let i = 0; i < lista.length; i++) {
    const c = await prepararCuadro({ ...datos, formato: "reel" }, lista[i], i + 1, lista.length);
    const letras = (lista[i].titulo || "").length + (lista[i].texto || "").length;
    const dura = limitar(2.2 + letras / 28, 3, 6) + (i === 0 ? 0.6 : 0); // el primero, un poco más por la llegada de Meteo
    cuadros.push({ c, inicio, dura });
    inicio += dura;
  }
  return { cuadros, total: inicio + 0.5, W: 1080, H: 1920 };
}

/** Pinta el video en el segundo "s". Entre cuadro y cuadro hace un fundido. */
function pintarVideo(ctx, video, s, auxiliar) {
  const { cuadros } = video;
  let i = cuadros.findIndex(q => s < q.inicio + q.dura);
  if (i < 0) i = cuadros.length - 1;
  const q = cuadros[i];
  const t = s - q.inicio;
  if (i > 0 && t < PLACAS.TRANSICION) {
    const ant = cuadros[i - 1];
    pintarCuadro(ctx, ant.c, s - ant.inicio, i - 1 === 0);
    const a = auxiliar.getContext("2d");
    pintarCuadro(a, q.c, t, false);
    ctx.save(); ctx.globalAlpha = suave(t / PLACAS.TRANSICION); ctx.drawImage(auxiliar, 0, 0); ctx.restore();
  } else {
    pintarCuadro(ctx, q.c, t, i === 0);
  }
}

/** Reproduce el video en un canvas visible (para verlo antes de aprobar). Devuelve una función para frenarlo. */
function reproducirVideo(lienzo, video, alTerminar) {
  const ctx = lienzo.getContext("2d");
  const auxiliar = document.createElement("canvas");
  auxiliar.width = video.W; auxiliar.height = video.H;
  const t0 = performance.now();
  let seguir = true;
  (function paso() {
    if (!seguir) return;
    const s = (performance.now() - t0) / 1000;
    pintarVideo(ctx, video, Math.min(s, video.total), auxiliar);
    if (s >= video.total) { alTerminar && alTerminar(); return; }
    requestAnimationFrame(paso);
  })();
  return () => { seguir = false; };
}

/**
 * Graba el video en tiempo real (tarda lo mismo que dura el reel) y devuelve un archivo.
 * En iPhone sale en MP4; en algunas compus, en WebM (al publicar se pasa a MP4).
 * El canvas tiene que estar visible en la página mientras graba.
 */
async function grabarVideo(lienzo, video, nombre, alProgreso) {
  if (!lienzo.captureStream || !window.MediaRecorder) throw new Error("este navegador no puede grabar video");
  const tipos = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  const tipo = tipos.find(t => MediaRecorder.isTypeSupported(t)) || "";
  const ctx = lienzo.getContext("2d");
  const auxiliar = document.createElement("canvas");
  auxiliar.width = video.W; auxiliar.height = video.H;
  pintarVideo(ctx, video, 0, auxiliar);
  const flujo = lienzo.captureStream(PLACAS.CUADROS_POR_SEGUNDO);
  const grabador = new MediaRecorder(flujo, tipo ? { mimeType: tipo, videoBitsPerSecond: 8000000 } : undefined);
  const partes = [];
  grabador.ondataavailable = e => { if (e.data && e.data.size) partes.push(e.data); };
  const termino = new Promise(ok => { grabador.onstop = ok; });
  grabador.start(250);
  const t0 = performance.now();
  await new Promise(ok => {
    (function paso() {
      const s = (performance.now() - t0) / 1000;
      pintarVideo(ctx, video, Math.min(s, video.total), auxiliar);
      alProgreso && alProgreso(Math.min(1, s / video.total));
      if (s >= video.total) return ok();
      requestAnimationFrame(paso);
    })();
  });
  grabador.stop();
  await termino;
  flujo.getTracks().forEach(p => p.stop());
  const tipoFinal = (grabador.mimeType || tipo || "video/webm").split(";")[0];
  const extension = tipoFinal.includes("mp4") ? "mp4" : "webm";
  return new File([new Blob(partes, { type: tipoFinal })], `${nombre}.${extension}`, { type: tipoFinal });
}

// ---------- Guardar en el celular ----------

/** Guarda archivos: en el celular abre "Compartir" (ahí está "Guardar imágenes/video"); en la compu los descarga. */
async function guardarArchivos(archivos) {
  if (navigator.canShare && navigator.canShare({ files: archivos })) {
    try { await navigator.share({ files: archivos }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  for (const a of archivos) {
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(a); enlace.download = a.name;
    document.body.appendChild(enlace); enlace.click(); enlace.remove();
    await new Promise(r => setTimeout(r, 300));
  }
}

/** Pasa canvas a archivos de imagen (PNG para guardar; JPG para Instagram). */
function canvasAArchivos(lista, tipo = "image/png") {
  return Promise.all(lista.map(({ canvas, nombre }) =>
    new Promise(ok => canvas.toBlob(b => ok(new File([b], tipo === "image/jpeg" ? nombre.replace(/\.png$/, ".jpg") : nombre, { type: tipo })), tipo, 0.92))));
}

async function guardarImagenes(lista) {
  await guardarArchivos(await canvasAArchivos(lista));
}
