// Cielo animado de la tarjeta principal, versión web.
// Es el mismo que el de la app (app/src/componentes/escena.tsx): sol que gira,
// luna con estrellas de noche, nubes que pasan, gotas y relámpagos.
// Los colores y animaciones están en estilos.css ("Cielo animado").

/**
 * cielo: sol, parcial, nublado, dudoso, lluvia o tormenta (lo calcula el motor).
 * noche: luna y estrellas en vez del sol.
 * adentro: lo que va adelante del cielo (Meteo).
 */
function escenaHTML(cielo, noche, adentro = "") {
  const lluvioso = cielo === "lluvia" || cielo === "tormenta" || cielo === "dudoso";
  // Clase de color del fondo (en estilos.css, con su versión para modo oscuro)
  const tono = cielo === "tormenta" ? "tormenta" : noche ? "noche" : lluvioso || cielo === "nublado" ? "gris" : "despejado";
  const nubes = cielo === "sol" ? 0 : cielo === "parcial" ? 1 : cielo === "dudoso" ? 2 : 3;
  const gotas = cielo === "tormenta" ? 16 : cielo === "lluvia" ? 12 : cielo === "dudoso" ? 5 : 0;
  const astro = cielo === "sol" || cielo === "parcial" || cielo === "dudoso" || (noche && cielo !== "tormenta");

  let html = "";
  if (noche) {
    html += [12, 30, 55, 70, 88].map((x, i) =>
      `<span class="estrella" style="left:${x}%;top:${14 + (i % 3) * 22}px;animation-delay:${i * 350}ms"></span>`).join("");
  }
  if (astro) {
    html += noche
      ? `<span class="luna"><span class="luna-sombra"></span></span>`
      : `<span class="sol"><span class="sol-rayos">${Array.from({ length: 8 }, (_, i) =>
          `<i style="transform:rotate(${i * 45}deg) translateY(-44px)"></i>`).join("")}</span><span class="sol-centro"></span></span>`;
  }
  for (let i = 0; i < nubes; i++) {
    const escala = i === 1 ? 0.8 : 1;
    const duracion = 26 + i * 9;              // segundos en cruzar
    const fase = (0.25 + i * 0.3) % 1;        // cada nube arranca en otro punto
    html += `<span class="nube-viaje" style="top:${10 + i * 22}px;animation-duration:${duracion}s;animation-delay:-${(fase * duracion).toFixed(1)}s">
      <span class="nube" style="--e:${escala}"><i class="b1"></i><i class="b2"></i><i class="b3"></i></span></span>`;
  }
  for (let i = 0; i < gotas; i++) {
    const rapida = cielo === "tormenta";
    html += `<span class="gota${rapida ? " rapida" : ""}" style="left:calc(${((100 / gotas) * i).toFixed(2)}% + ${(i * 37) % 17}px);animation-delay:-${(i * 173) % 900}ms"></span>`;
  }
  if (cielo === "tormenta") html += `<span class="relampago"></span>`;

  // Color de las nubes (depende del cielo, no de la hora)
  const nube = cielo === "tormenta" ? "tormenta" : lluvioso || cielo === "nublado" ? "gris" : "clara";
  return `<div class="cielo cielo-${tono} nubes-${nube}">
      <div class="cielo-fondo" aria-hidden="true">${html}</div>${adentro}</div>`;
}
