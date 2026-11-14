// Che, Clima — página "¿Cuánto acertamos?"
// Lee datos/aciertos.json (lo genera scripts/aciertos.py todos los días).

let datos = null;
let estado = { ciudad: "todas", dias: "30" };

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function seguro(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// 1.25 -> "1,3"
function coma(n, decimales = 1) {
  return n == null ? "–" : n.toFixed(decimales).replace(".", ",");
}

function fechaCorta(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS_SEMANA[dia]} ${d}/${m}`;
}

function nombreFuente(id) {
  return (datos.fuentes.find(f => f.id === id) || {}).nombre || id;
}

// Puesto de "nuestro" entre todas las fuentes (1 = el mejor)
function puesto(fuentes, campo, mayorEsMejor) {
  const valores = Object.values(fuentes).map(f => f[campo]).filter(v => v != null);
  const nuestro = fuentes.nuestro[campo];
  if (nuestro == null) return null;
  const mejores = valores.filter(v => mayorEsMejor ? v > nuestro : v < nuestro).length;
  return { puesto: mejores + 1, de: valores.length };
}

function mejorValor(fuentes, campo, mayorEsMejor) {
  const valores = Object.values(fuentes).map(f => f[campo]).filter(v => v != null);
  return mayorEsMejor ? Math.max(...valores) : Math.min(...valores);
}

// ---------- Bloques ----------

function bloqueTitular(nombre, resumen) {
  const n = resumen.fuentes.nuestro;
  const dias = estado.dias === "7" ? "7" : "30";
  if (!n.lluvia_dias) {
    return `<section class="tarjeta"><p class="frase">Todavía no hay suficientes días medidos para ${seguro(nombre)}.</p></section>`;
  }
  const pLluvia = puesto(resumen.fuentes, "lluvia_aciertos", true);
  const pMax = puesto(resumen.fuentes, "error_max", false);
  const pMin = puesto(resumen.fuentes, "error_min", false);
  const pViento = puesto(resumen.fuentes, "error_viento", false);
  const chip = (titulo, p) => p ? `<span class="puesto ${p.puesto === 1 ? "primero" : ""}">${titulo}: ${p.puesto}° de ${p.de}</span>` : "";
  return `
    <section class="tarjeta principal">
      <p class="cuando">Últimos ${dias} días · ${seguro(nombre)}</p>
      <p class="titular">Acertamos si llovía o no <strong>${n.lluvia_aciertos} de ${n.lluvia_dias}</strong> ${nombre === "todas las ciudades" ? "días-ciudad" : "días"}.</p>
      <p class="frase">Le erramos a la máxima por <strong>${coma(n.error_max)}°</strong> y a la mínima por <strong>${coma(n.error_min)}°</strong> en promedio.</p>
      <div class="puestos">
        ${chip("Lluvia", pLluvia)}${chip("Máxima", pMax)}${chip("Mínima", pMin)}${chip("Viento", pViento)}
      </div>
      <p class="explicacion">El puesto es contra los ${Object.keys(resumen.fuentes).length - 1} modelos solos. 1° = el que mejor anduvo.</p>
    </section>`;
}

function bloqueTabla(resumen) {
  const f = resumen.fuentes;
  const mejor = {
    lluvia: mejorValor(f, "lluvia_aciertos", true),
    max: mejorValor(f, "error_max", false),
    min: mejorValor(f, "error_min", false),
    viento: mejorValor(f, "error_viento", false),
  };
  const celda = (valor, esMejor, texto) => `<td class="${esMejor ? "mejor" : ""}">${texto}</td>`;
  const filas = Object.entries(f)
    .sort((a, b) => (a[0] === "nuestro" ? -1 : b[0] === "nuestro" ? 1 : (b[1].lluvia_aciertos ?? -1) - (a[1].lluvia_aciertos ?? -1)))
    .map(([id, v]) => `
      <tr class="${id === "nuestro" ? "combinado" : ""}">
        <td>${seguro(nombreFuente(id))}</td>
        ${celda(v.lluvia_aciertos, v.lluvia_aciertos != null && v.lluvia_aciertos === mejor.lluvia, v.lluvia_aciertos == null ? "–" : `${v.lluvia_aciertos}/${v.lluvia_dias}`)}
        ${celda(v.error_max, v.error_max === mejor.max, `±${coma(v.error_max)}°`)}
        ${celda(v.error_min, v.error_min === mejor.min, `±${coma(v.error_min)}°`)}
        ${celda(v.error_viento, v.error_viento === mejor.viento, `±${coma(v.error_viento, 0)}`)}
      </tr>`).join("");
  return `
    <section class="tarjeta">
      <h2>Contra cada modelo</h2>
      <div class="tabla-scroll">
        <table class="tabla-modelos">
          <thead><tr><th>Fuente</th><th>Lluvia</th><th>Máx</th><th>Mín</th><th>Viento</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <p class="explicacion">Lluvia: días acertados. Máx, mín y viento (km/h): error promedio, cuanto más chico mejor.
      En verde, el mejor de cada columna. "SMN (modelo)" es el pronóstico numérico que publica el SMN en sus datos abiertos;
      lo medimos desde el 25/10/2026 (con datos cada 3 horas, su máxima y mínima pueden quedar un poco cortas).</p>
    </section>`;
}

function bloqueDias(ciudad) {
  const limite = Number(estado.dias);
  const dias = ciudad.dias.slice(0, limite);
  if (!dias.length) return "";
  const icono = ok => ok == null ? "<span class='nd'>–</span>" : ok ? "<span class='ok'>✓</span>" : "<span class='mal'>✗</span>";
  const siNo = v => v == null ? "–" : v ? "sí" : "no";
  const filas = dias.map(d => {
    const n = d.nuestro, o = d.observado;
    const okLluvia = (n.llueve == null || o.llovio == null) ? null : n.llueve === o.llovio;
    return `
      <li class="dia-medido">
        <span class="fecha">${fechaCorta(d.fecha)}${d.reconstruido ? "<small>reconstruido</small>" : ""}</span>
        <span class="medida">${icono(okLluvia)} Lluvia: dijimos <b>${siNo(n.llueve)}</b>, ${o.llovio == null ? "sin dato" : `llovió <b>${siNo(o.llovio)}</b>`}</span>
        <span class="medida">Máx: dijimos <b>${n.max ?? "–"}°</b>, fue <b>${o.max == null ? "–" : Math.round(o.max)}°</b> · Mín: <b>${n.min ?? "–"}°</b> / <b>${o.min == null ? "–" : Math.round(o.min)}°</b></span>
      </li>`;
  }).join("");
  return `
    <section class="tarjeta">
      <h2>Día por día en ${seguro(ciudad.nombre)}</h2>
      <ul class="dias-medidos">${filas}</ul>
      <p class="explicacion">Observado en el aeropuerto de ${seguro(ciudad.aeropuerto)}.</p>
    </section>`;
}

function bloqueCalibracion(ciudad) {
  const cal = ciudad.calibracion;
  if (!cal || !cal.pesos_max) return "";
  const filas = datos.fuentes.filter(f => f.id !== "nuestro" && f.id !== "smn").map(f => {
    const peso = Math.round((cal.pesos_max[f.id] || 0) * 100);
    const sesgo = cal.sesgo_max[f.id] || 0;
    const texto = Math.abs(sesgo) < 0.1 ? "casi exacto" : `da ${coma(Math.abs(sesgo))}° de ${sesgo > 0 ? "más" : "menos"}`;
    return `
      <tr>
        <td>${seguro(f.nombre)}</td>
        <td class="peso"><span class="barra-peso" style="width:${Math.max(peso, 2)}%"></span><span>${peso}%</span></td>
        <td>${texto}</td>
      </tr>`;
  }).join("");
  return `
    <section class="tarjeta">
      <h2>Cómo pesamos hoy cada modelo en ${seguro(ciudad.nombre)}</h2>
      <div class="tabla-scroll">
        <table class="tabla-modelos tabla-pesos">
          <thead><tr><th>Modelo</th><th>Peso en la máxima</th><th>Su error típico</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <p class="explicacion">Calculado con los últimos ${cal.dias} días. Antes de combinar, a cada modelo le restamos su error típico.
      La mínima y el viento tienen sus propios pesos. En lluvia todos los modelos votan igual: en nuestras pruebas, pesarlos no mejoró los aciertos.</p>
    </section>`;
}

// ---------- Armado ----------

function mostrar() {
  document.querySelectorAll("#ciudades button").forEach(b =>
    b.setAttribute("aria-pressed", b.dataset.id === estado.ciudad ? "true" : "false"));
  document.querySelectorAll(".periodos button").forEach(b =>
    b.setAttribute("aria-pressed", b.dataset.dias === estado.dias ? "true" : "false"));
  if (location.hash !== "#" + estado.ciudad) history.replaceState(null, "", "#" + estado.ciudad);

  let html;
  if (estado.ciudad === "todas") {
    const resumen = datos.general[estado.dias];
    html = bloqueTitular("todas las ciudades", resumen) + bloqueTabla(resumen);
  } else {
    const ciudad = datos.ciudades.find(c => c.id === estado.ciudad) || datos.ciudades[0];
    const resumen = ciudad.resumen[estado.dias];
    html = bloqueTitular(ciudad.nombre, resumen) + bloqueTabla(resumen) + bloqueDias(ciudad) + bloqueCalibracion(ciudad);
  }
  document.getElementById("contenido").innerHTML = html;
}

async function iniciar() {
  try {
    const r = await fetch("datos/aciertos.json?v=" + Date.now());
    if (!r.ok) throw new Error(r.status);
    datos = await r.json();
  } catch (e) {
    document.getElementById("contenido").innerHTML =
      `<p class="error">No pudimos cargar los aciertos. Revisá tu conexión y recargá la página.</p>`;
    return;
  }

  const nav = document.getElementById("ciudades");
  nav.innerHTML = [`<button type="button" data-id="todas" aria-pressed="false">Todas</button>`]
    .concat(datos.ciudades.map(c => `<button type="button" data-id="${seguro(c.id)}" aria-pressed="false">${seguro(c.nombre)}</button>`))
    .join("");
  nav.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b) { estado.ciudad = b.dataset.id; mostrar(); }
  });
  document.querySelector(".periodos").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b) { estado.dias = b.dataset.dias; mostrar(); }
  });

  const pedida = location.hash.slice(1);
  if (pedida && (pedida === "todas" || datos.ciudades.some(c => c.id === pedida))) estado.ciudad = pedida;

  const [fecha, hora] = datos.calculado.split("T");
  const [a, m, d] = fecha.split("-");
  document.getElementById("actualizado").textContent = `Calculado el ${Number(d)}/${Number(m)} a las ${hora} h. Se recalcula todos los días.`;
  mostrar();
}

iniciar();
