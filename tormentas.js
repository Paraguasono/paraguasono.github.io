// Che, Clima — página "Tormentas".
// Estado por ciudad: lee datos/pronostico.json (alertas del SMN + vigilancia propia).
// Imágenes: directo del servidor público de NOAA.

const URL_ANIMACION = "https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/ssa/GEOCOLOR/GOES19-SSA-GEOCOLOR-900x540.mp4";

function seguro(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// "2026-10-23T20:59:59-03:00" → "21 h" (el SMN pone vencimientos a las xx:59)
function horaRedonda(fechaHora) {
  if (!fechaHora || fechaHora.length < 16) return "";
  let h = Number(fechaHora.slice(11, 13)), m = Number(fechaHora.slice(14, 16));
  if (m >= 55) { h = (h + 1) % 24; m = 0; }
  return m === 0 ? `${h} h` : `${h}:${String(m).padStart(2, "0")} h`;
}

function bloqueCiudad(c) {
  const alertas = c.alertas_smn || [];
  const aviso = c.tormenta;
  if (!alertas.length && !aviso) {
    return `<li class="estado-ciudad"><span class="nombre">${seguro(c.nombre)}</span><span class="chip-estado tranqui">Sin alertas</span></li>`;
  }
  const oficiales = alertas.map(a => `
    <details class="alerta-smn ${seguro(a.color)}">
      <summary><span class="chip-estado ${seguro(a.color)}">${a.tipo === "aviso" ? "Aviso" : "Alerta"} ${seguro(a.color)} SMN</span>
        ${seguro(a.evento)}${a.hasta ? ` · hasta las ${horaRedonda(a.hasta)}` : ""}</summary>
      <p>${seguro(a.descripcion || a.titulo)}</p>
      ${a.instrucciones ? `<p class="explicacion">${seguro(a.instrucciones)}</p>` : ""}
      <p><a href="${seguro(a.link)}" target="_blank" rel="noopener">Ver la alerta oficial del SMN →</a></p>
    </details>`).join("");
  const propio = aviso ? `
    <p class="aviso-propio ${aviso.nivel}">
      <span class="chip-estado ${aviso.nivel === "fuerte" ? "naranja" : "amarilla"}">${aviso.nivel === "fuerte" ? "Tormenta fuerte" : "Posible tormenta"}</span>
      entre las ${seguro(aviso.desde)} y las ${seguro(aviso.hasta)} h${aviso.detalles.length ? ` · ${seguro(aviso.detalles.join(", "))}` : ""}
      <small>(${aviso.fuente === "aeropuerto" ? "reportada por el aeropuerto" : "nuestra vigilancia"})</small>
    </p>` : "";
  return `<li class="estado-ciudad con-alerta"><span class="nombre">${seguro(c.nombre)}</span>${oficiales}${propio}</li>`;
}

async function iniciar() {
  const caja = document.getElementById("estado-ciudades");
  try {
    const r = await fetch("datos/pronostico.json?v=" + Date.now());
    if (!r.ok) throw new Error(r.status);
    const datos = await r.json();
    // Primero las ciudades con alerta
    const ordenadas = [...datos.ciudades].sort((a, b) =>
      ((b.alertas_smn || []).length + (b.tormenta ? 1 : 0)) - ((a.alertas_smn || []).length + (a.tormenta ? 1 : 0)));
    caja.innerHTML = `<h2>Ahora, ciudad por ciudad</h2><ul class="estados">${ordenadas.map(bloqueCiudad).join("")}</ul>`;
    const [f, h] = datos.actualizado.split("T");
    const [, m, d] = f.split("-");
    document.getElementById("actualizado").textContent =
      `Alertas y vigilancia actualizadas el ${Number(d)}/${Number(m)} a las ${h} h (cada 30 minutos).`;
  } catch (e) {
    caja.innerHTML = `<h2>Ahora, ciudad por ciudad</h2><p class="error">No pudimos cargar el estado. Para lo oficial, mirá el
      <a href="https://www.smn.gob.ar/alertas" target="_blank" rel="noopener">SMN</a>.</p>`;
  }

  // Evita que el navegador muestre una imagen vieja guardada (cambia cada 10 minutos)
  const marca = Math.floor(Date.now() / 600000);
  for (const id of ["satelite", "rayos"]) {
    const img = document.getElementById(id);
    img.src = img.src.split("?")[0] + "?t=" + marca;
  }

  // La animación pesa 3,5 MB: solo se baja si la piden
  document.getElementById("ver-animacion").addEventListener("click", e => {
    e.target.remove();
    document.getElementById("animacion").innerHTML =
      `<video class="satelite" src="${URL_ANIMACION}" autoplay loop muted playsinline controls width="900" height="540"></video>`;
  });
}

iniciar();
