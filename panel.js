// Che, Clima — panel privado.
//
// La página es pública (GitHub Pages), pero sin iniciar sesión no muestra nada:
// los datos están en Supabase y la base solo se los da a administradores
// (tabla "admins", que se maneja únicamente desde el editor SQL de Supabase).
// Esta página no está enlazada desde ningún lado y les pide a los buscadores que no la muestren.

const SUPABASE_URL = "https://ndoadyifimgxisindzkx.supabase.co";
const SUPABASE_KEY = "sb_publishable_pqR7kR87pDMdH-pOAaFHuA_hnohVoRU"; // pública a propósito
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
});

const SECCIONES = [
  ["resumen", "☀️ Resumen del día"],
  ["calendario", "🗓️ Calendario"],
  ["reporte", "📊 Reportes"],
  ["publicacion", "🎬 Publicaciones"],
  ["comentario", "💬 Comentarios"],
  ["evento", "⚡ Eventos"],
  ["noticia", "📰 Noticias"],
];

const caja = document.getElementById("panel");
let items = [];
let programadas = []; // cola de Instagram (lo aprobado)
let pedidos = [];     // pedidos de "✨ Crear publicación"
let seccion = "resumen";

function seguro(t) {
  return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function pantallaEntrar(mensaje = "") {
  caja.innerHTML = `
    <section class="tarjeta">
      <h2>Entrar</h2>
      <p class="frase">Este panel es solo para administradores de Che, Clima.</p>
      ${mensaje ? `<p class="viejo">${seguro(mensaje)}</p>` : ""}
      <button class="boton" id="entrar">Entrar con Google</button>
    </section>`;
  document.getElementById("entrar").addEventListener("click", () =>
    db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } }));
}

function dibujar() {
  const lista = items.filter(i => i.tipo === seccion);
  const botones = SECCIONES.map(([id, texto]) =>
    `<button type="button" data-id="${id}" aria-pressed="${id === seccion}">${texto}</button>`).join("");
  const conImagenes = []; // publicaciones para completar después (imágenes, botones, Instagram)
  const contenido = lista.length
    ? lista.map(i => {
        const [datosImg, texto] = separarImagenes(i.cuerpo);
        let cajaImg = "";
        if (i.tipo === "publicacion") {
          const base = (i.archivo || "").split("/").pop().replace(/\.md$/, "") || i.fecha || "pieza";
          conImagenes.push({ datos: datosImg, texto, archivo: i.archivo, fecha: i.fecha, prefijo: "checlima-" + base });
          const hora = texto.match(/Subir a las:\**\s*(\d{1,2}:\d{2})/);
          const tipo = /-auto-/.test(base) ? "🤖 Automática" : /-pedido-/.test(base) ? "✨ A pedido" : /fijada/.test(base) ? "📌 Para fijar" : /reel/i.test(base) || (datosImg && datosImg.formato === "reel") ? "🎬 Reel"
            : /espontanea/.test(base) ? "💡 Espontánea" : datosImg && datosImg.formato === "historia" ? "📱 Historia" : "🖼️ Publicación";
          cajaImg = `${hora ? `<p class="hora-sugerida">${tipo} · 🕒 Subir a las <b>${seguro(hora[1])}</b></p>` : ""}
            <div class="imagenes" data-n="${conImagenes.length - 1}"><p class="vacio">Dibujando las imágenes…</p></div>`;
        }
        return `
        <section class="tarjeta item" data-fecha="${seguro(i.fecha || "")}">
          <p class="fecha-item">${i.fecha ? seguro(i.fecha.split("-").reverse().join("/")) : ""} · actualizado ${seguro(new Date(i.actualizado).toLocaleString("es-AR", { hour12: false }))}</p>
          ${cajaImg}
          <div class="contenido-md">${DOMPurify.sanitize(marked.parse(texto))}</div>
        </section>`;
      }).join("")
    : `<section class="tarjeta"><p class="vacio">Todavía no hay nada acá. Cuando el agente de esta sección trabaje, aparece solo.</p></section>`;
  caja.innerHTML = `<nav class="pestanas" aria-label="Secciones del panel">${botones}</nav>${contenido}
    <p class="explicacion"><button type="button" id="salir" class="boton" style="background:transparent;color:var(--marca);padding:8px 0">Salir del panel</button></p>`;
  // Celdas con mucho texto: ancho cómodo para que no queden filas altísimas en el celular
  caja.querySelectorAll(".contenido-md td").forEach(td => { if (td.textContent.length > 40) td.classList.add("largo"); });
  caja.querySelectorAll(".imagenes").forEach(div => mostrarPublicacion(div, conImagenes[Number(div.dataset.n)]));
  // Imágenes guardadas en la carpeta privada (ej. la imagen automática de las 7)
  caja.querySelectorAll("img[data-ruta]").forEach(async img => {
    const r = await db.storage.from("redes").createSignedUrl(img.dataset.ruta, 3600);
    if (r.data) img.src = r.data.signedUrl; else img.alt = "No se pudo cargar la imagen";
  });
  // Comentarios: cada respuesta sugerida lleva su botón para copiar
  if (seccion === "resumen") botonesDeIdeas();
  if (seccion === "comentario") {
    caja.querySelectorAll(".contenido-md blockquote").forEach(bq => {
      const texto = bq.textContent.trim();
      if (texto.startsWith("Parece spam")) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "boton secundario copiar-sugerencia"; b.textContent = "📋 Copiar respuesta";
      b.addEventListener("click", () => copiar(texto, b));
      bq.after(b);
    });
  }
  caja.querySelector(".pestanas").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b) { seccion = b.dataset.id; dibujar(); }
  });
  document.getElementById("salir").addEventListener("click", async () => { await db.auth.signOut(); pantallaEntrar(); });
}

// ---------- Publicaciones: imágenes, reel animado, textos e Instagram ----------

/** Texto de una sección "## Título" del Markdown (hasta la próxima sección). */
function seccionMd(texto, titulo) {
  const m = texto.match(new RegExp("##\\s*" + titulo + "[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)"));
  return m ? m[1].trim() : "";
}

/** Hora sugerida por el agente ("Subir a las: 10:00"), o 12:30. */
function horaSugerida(texto) {
  const m = texto.match(/Subir a las:\**\s*(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "12:30";
}

async function cargarProgramadas() {
  const r = await db.from("programadas").select("id, archivo, formato, hora, texto, estado, detalle, enlace, archivos")
    .order("creada", { ascending: false }).limit(60);
  programadas = r.error ? [] : r.data; // si la tabla todavía no existe, el panel igual funciona
}

const fechaHora = iso => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

async function copiar(texto, boton) {
  try { await navigator.clipboard.writeText(texto); const antes = boton.textContent; boton.textContent = "✔ Copiado"; setTimeout(() => (boton.textContent = antes), 1500); }
  catch (e) { prompt("Copiá el texto:", texto); }
}

async function mostrarPublicacion(div, pub) {
  const { datos, texto, prefijo } = pub;
  const textoIG = seccionMd(texto, "Texto para Instagram");
  const textoTT = seccionMd(texto, "Texto para TikTok");
  let lista = [], video = null;
  if (datos && datos.error) { div.innerHTML = `<p class="viejo">${seguro(datos.error)}</p>`; return; }
  try {
    if (datos) {
      lista = await dibujarTodas(datos, prefijo);
      if (datos.formato === "reel") video = await prepararVideo(datos);
    }
  } catch (e) {
    div.innerHTML = `<p class="viejo">No se pudieron dibujar las imágenes (${seguro(e.message)}).</p>`; return;
  }
  if (!div.isConnected) return; // cambiaste de pestaña mientras dibujaba
  const encuestas = lista.map((x, n) => x.encuesta
    ? `<li>Imagen ${n + 1}: agregá el sticker de encuesta «${seguro(x.encuesta.pregunta)}» con ${x.encuesta.opciones.map(seguro).join(" / ")}</li>` : "").join("");
  div.innerHTML = `
    ${video ? `<canvas class="reproductor" width="1080" height="1920" hidden></canvas>` : ""}
    <div class="miniaturas"></div>
    <div class="botonera">
      ${video ? `<button type="button" class="boton ver">▶️ Ver el reel (${Math.round(video.total)} s)</button>
                 <button type="button" class="boton grabar">🎬 Grabar y guardar el video</button>` : ""}
      ${lista.length ? `<button type="button" class="boton guardar secundario">📲 Guardar ${video ? "los cuadros" : lista.length === 1 ? "la imagen" : `las ${lista.length} imágenes`}</button>` : ""}
      ${textoIG ? `<button type="button" class="boton secundario copiar-ig">📋 Copiar texto de Instagram</button>` : ""}
      ${textoTT ? `<button type="button" class="boton secundario copiar-tt">📋 Copiar texto de TikTok</button>` : ""}
    </div>
    <p class="estado-video vacio" hidden></p>
    ${encuestas ? `<ul class="ayuda-encuesta">${encuestas}</ul>` : ""}
    <div class="instagram"></div>`;
  const mini = div.querySelector(".miniaturas");
  lista.forEach(({ canvas, nombre }) => {
    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/jpeg", 0.85); img.alt = nombre;
    mini.appendChild(img);
  });
  const reproductor = div.querySelector(".reproductor");
  const estado = div.querySelector(".estado-video");
  let frenar = null;
  const verVideo = () => {
    reproductor.hidden = false; mini.hidden = true;
    if (frenar) frenar();
    frenar = reproducirVideo(reproductor, video, () => { frenar = null; });
  };
  // Graba el reel (tarda lo que dura) y devuelve el archivo de video
  const grabar = async () => {
    reproductor.hidden = false; mini.hidden = true; if (frenar) { frenar(); frenar = null; }
    estado.hidden = false;
    div.querySelectorAll("button").forEach(b => (b.disabled = true));
    try {
      return await grabarVideo(reproductor, video, prefijo, p => (estado.textContent = `Grabando el video… ${Math.round(p * 100)}% (no salgas de esta pantalla)`));
    } finally {
      div.querySelectorAll("button").forEach(b => (b.disabled = false));
      estado.hidden = true;
    }
  };
  div.querySelector(".ver")?.addEventListener("click", verVideo);
  div.querySelector(".grabar")?.addEventListener("click", async () => {
    try { await guardarArchivos([await grabar()]); }
    catch (e) { estado.hidden = false; estado.textContent = "No se pudo grabar el video: " + e.message; }
  });
  div.querySelector(".guardar")?.addEventListener("click", () => guardarImagenes(lista));
  div.querySelector(".copiar-ig")?.addEventListener("click", e => copiar(textoIG, e.target));
  div.querySelector(".copiar-tt")?.addEventListener("click", e => copiar(textoTT, e.target));
  if (datos) mostrarInstagram(div.querySelector(".instagram"), pub, lista, textoIG, video ? grabar : null);
}

/** Caja de Instagram: estado de lo programado, o el formulario para aprobar y programar. */
function mostrarInstagram(caja, pub, lista, textoIG, grabar) {
  const prog = programadas.find(x => x.archivo === pub.archivo && x.estado !== "cancelada");
  if (prog && prog.estado === "pendiente") {
    caja.innerHTML = `<p class="estado-ig">🕒 <b>Programada en Instagram</b> para el ${fechaHora(prog.hora)}.
      Si Instagram todavía no está conectado, queda en espera.</p>
      <button type="button" class="boton secundario cancelar">Cancelar</button>`;
    caja.querySelector(".cancelar").addEventListener("click", async () => {
      if (!confirm("¿Cancelar esta publicación programada?")) return;
      const r = await db.from("programadas").update({ estado: "cancelada", actualizada: new Date().toISOString() }).eq("id", prog.id);
      if (r.error) return alert("No se pudo cancelar: " + r.error.message);
      await db.storage.from("redes").remove(prog.archivos);
      await Promise.all([cargarProgramadas(), cargarPedidos()]); mostrarInstagram(caja, pub, lista, textoIG, grabar);
    });
    return;
  }
  if (prog && prog.estado === "publicando") { caja.innerHTML = `<p class="estado-ig">⏳ Publicando en Instagram…</p>`; return; }
  if (prog && prog.estado === "publicada") {
    caja.innerHTML = `<p class="estado-ig">✅ <b>Publicada en Instagram</b> el ${fechaHora(prog.hora)}${prog.enlace ? ` · <a href="${seguro(prog.enlace)}" target="_blank" rel="noopener">verla</a>` : ""}</p>`;
    return;
  }
  const fecha = pub.fecha || new Date().toISOString().slice(0, 10);
  let valor = `${fecha}T${horaSugerida(pub.texto)}`;
  if (new Date(valor) < new Date(Date.now() + 5 * 60000)) { // si ya pasó, en 15 minutos
    const d = new Date(Date.now() + 15 * 60000);
    valor = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  caja.innerHTML = `
    ${prog && prog.estado === "error" ? `<p class="viejo">⚠️ La vez anterior no se pudo publicar: ${seguro(prog.detalle || "error desconocido")}. Podés volver a aprobarla.</p>` : ""}
    <details class="programar">
      <summary>📅 Programar en Instagram</summary>
      <label>Día y hora <input type="datetime-local" class="hora" value="${valor}"></label>
      <label>Texto <textarea class="texto" rows="7">${seguro(textoIG)}</textarea></label>
      <p class="vacio">Se publica sola a esa hora (puede demorar hasta 30 minutos). ${grabar ? "Primero se graba el reel: tarda lo que dura el video." : ""}</p>
      <button type="button" class="boton aprobar">✅ Aprobar y programar</button>
      <p class="estado-ig vacio" hidden></p>
    </details>`;
  const aviso = caja.querySelector(".estado-ig");
  caja.querySelector(".aprobar").addEventListener("click", async e => {
    const hora = new Date(caja.querySelector(".hora").value);
    const texto = caja.querySelector(".texto").value.trim();
    if (isNaN(hora)) return alert("Elegí día y hora.");
    if (!confirm(`¿Aprobar y publicar en Instagram el ${fechaHora(hora.toISOString())}?`)) return;
    e.target.disabled = true; aviso.hidden = false;
    try {
      let archivos;
      if (grabar) archivos = [await grabar()];
      else { aviso.textContent = "Preparando las imágenes…"; archivos = await canvasAArchivos(lista, "image/jpeg"); }
      const rutas = [];
      for (let n = 0; n < archivos.length; n++) {
        aviso.textContent = `Subiendo ${n + 1} de ${archivos.length}…`;
        const ruta = `${pub.fecha || "sin-fecha"}/${Date.now()}-${archivos[n].name}`;
        const r = await db.storage.from("redes").upload(ruta, archivos[n], { contentType: archivos[n].type });
        if (r.error) throw new Error(r.error.message);
        rutas.push(ruta);
      }
      const r = await db.from("programadas").insert({ archivo: pub.archivo, formato: pub.datos.formato, hora: hora.toISOString(), texto, archivos: rutas });
      if (r.error) { await db.storage.from("redes").remove(rutas); throw new Error(r.error.message); }
      await cargarProgramadas(); mostrarInstagram(caja, pub, lista, textoIG, grabar);
    } catch (err) {
      aviso.textContent = "No se pudo programar: " + err.message;
      e.target.disabled = false;
    }
  });
}

// ---------- "✨ Crear publicación" en las ideas del resumen del día ----------

const normalizarIdea = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

async function cargarPedidos() {
  const r = await db.from("pedidos_contenido").select("id, idea, fecha, estado, archivo").order("id", { ascending: false }).limit(100);
  pedidos = r.error ? [] : r.data; // si la tabla todavía no existe, el panel igual funciona
}

function estadoPedido(boton, pedido) {
  if (!pedido) return;
  boton.disabled = true;
  boton.textContent = pedido.estado === "lista" ? "✅ Lista en Publicaciones"
    : pedido.estado === "error" ? "⚠️ No se pudo armar" : "⏳ En preparación (sale a las 9, 12, 15, 18 o 21)";
}

function botonesDeIdeas() {
  caja.querySelectorAll("section.item").forEach(sec => {
    const fecha = sec.dataset.fecha;
    const titulo = [...sec.querySelectorAll(".contenido-md h2")].find(h => /ideas para redes/i.test(h.textContent));
    if (!titulo || !fecha) return;
    let lista = titulo.nextElementSibling;
    while (lista && !/^(UL|OL)$/.test(lista.tagName)) lista = lista.nextElementSibling;
    if (!lista) return;
    lista.querySelectorAll(":scope > li").forEach(li => {
      const idea = li.textContent.trim();
      const b = document.createElement("button");
      b.type = "button"; b.className = "boton secundario crear-pub"; b.textContent = "✨ Crear publicación";
      estadoPedido(b, pedidos.find(p => p.fecha === fecha && normalizarIdea(p.idea) === normalizarIdea(idea)));
      b.addEventListener("click", async () => {
        if (!confirm("¿Armar una publicación con esta idea? Aparece en Publicaciones en la próxima revisión (9, 12, 15, 18 o 21 h), para que la apruebes.")) return;
        b.disabled = true; b.textContent = "Pidiendo…";
        const r = await db.from("pedidos_contenido").insert({ idea: idea.slice(0, 600), fecha }).select("id, idea, fecha, estado, archivo");
        if (r.error) { b.disabled = false; b.textContent = "✨ Crear publicación"; return alert("No se pudo pedir: " + r.error.message); }
        pedidos.unshift(r.data[0]);
        estadoPedido(b, r.data[0]);
      });
      li.appendChild(document.createElement("br"));
      li.appendChild(b);
    });
  });
}

async function iniciar() {
  const { data } = await db.auth.getSession();
  if (!data.session) return pantallaEntrar();
  const { data: esAdmin, error } = await db.rpc("es_admin");
  if (error || !esAdmin) {
    await db.auth.signOut();
    return pantallaEntrar("Esta cuenta no tiene acceso al panel.");
  }
  const r = await db.from("panel_contenido").select("archivo, tipo, fecha, titulo, cuerpo, actualizado")
    .order("fecha", { ascending: false, nullsFirst: false }).order("actualizado", { ascending: false }).limit(120);
  if (r.error) {
    caja.innerHTML = `<section class="tarjeta"><p class="viejo">No se pudo cargar el panel (${seguro(r.error.message)}).</p></section>`;
    return;
  }
  items = r.data;
  await cargarProgramadas();
  dibujar();
}

iniciar();
