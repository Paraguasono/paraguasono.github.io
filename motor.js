// GENERADO desde app/src/motor (el mismo cálculo que la app). No editar a mano: cd app && npm run motor-web

// src/motor/util.ts
function promedio(valores, pesos) {
  let suma2 = 0;
  let total = 0;
  valores.forEach((v, i) => {
    if (v === null || v === void 0) return;
    const p = pesos ? pesos[i] : 1;
    suma2 += v * p;
    total += p;
  });
  if (total === 0) return null;
  return suma2 / total;
}
function mediana(valores) {
  const limpios = valores.filter((v) => v !== null && v !== void 0).sort((a, b) => a - b);
  if (!limpios.length) return null;
  const medio = Math.floor(limpios.length / 2);
  return limpios.length % 2 ? limpios[medio] : (limpios[medio - 1] + limpios[medio]) / 2;
}
function redondear(valor, decimales = 0) {
  if (valor === null || valor === void 0) return null;
  const factor = 10 ** decimales;
  const x = valor * factor;
  const piso = Math.floor(x);
  const diferencia = x - piso;
  if (decimales > 0) return redondearConDecimales(valor, decimales);
  if (diferencia === 0.5) return piso % 2 === 0 ? piso : piso + 1;
  return Math.round(x);
}
function redondearConDecimales(valor, decimales) {
  const signo = valor < 0 ? -1 : 1;
  const [entero, fraccion] = Math.abs(valor).toFixed(Math.min(100, decimales + 25)).split(".");
  const conservado = fraccion.slice(0, decimales);
  const cola = fraccion.slice(decimales);
  let subir;
  if (cola[0] > "5") subir = true;
  else if (cola[0] < "5") subir = false;
  else if (/[1-9]/.test(cola.slice(1))) subir = true;
  else subir = Number((entero + conservado).slice(-1)) % 2 === 1;
  let resultado = Number(`${entero}.${conservado}`);
  if (subir) resultado = Number((resultado + 10 ** -decimales).toFixed(decimales));
  return signo * resultado;
}
function fnv1a(texto) {
  let h = 2166136261;
  const bytes = new TextEncoder().encode(texto);
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function distanciaKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
var DIAS_SEMANA = ["lunes", "martes", "mi\xE9rcoles", "jueves", "viernes", "s\xE1bado", "domingo"];
function diaSemana(fecha) {
  const [a, m, d] = fecha.split("-").map(Number);
  const domingo0 = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return DIAS_SEMANA[(domingo0 + 6) % 7];
}
function ahoraEnLugar(desfaseSegundos, ahoraMs = Date.now()) {
  const local = new Date(ahoraMs + desfaseSegundos * 1e3);
  return local.toISOString().slice(0, 16);
}

// src/motor/combinar.ts
var FRANJAS = [
  // clave, desde (incl.), hasta (excl.), texto
  ["madrugada", 0, 6, "de madrugada"],
  ["manana", 6, 12, "a la ma\xF1ana"],
  ["tarde", 12, 19, "a la tarde"],
  ["noche", 19, 24, "a la noche"]
];
var horaDe = (h) => Number(h.slice(11, 13));
var suma = (xs) => xs.reduce((a, b) => a + b, 0);
function resumenDiaDeUnModelo(serie, indices, horas, umbrales) {
  const tomar = (v) => indices.map((i) => {
    var _a;
    return (_a = serie[v]) == null ? void 0 : _a[i];
  }).filter((x) => x !== null && x !== void 0);
  const temps = tomar("temperature_2m");
  const lluvia = tomar("precipitation");
  if (!temps.length) return null;
  const mmFranja = umbrales.lluvia.mm_en_una_franja_para_contar_lluvia_en_esa_franja;
  const franjas = {};
  for (const [clave, desde, hasta] of FRANJAS) {
    const valores = indices.filter((i) => horaDe(horas[i]) >= desde && horaDe(horas[i]) < hasta).map((i) => {
      var _a;
      return (_a = serie.precipitation) == null ? void 0 : _a[i];
    }).filter((x) => x !== null && x !== void 0);
    franjas[clave] = valores.length ? suma(valores) >= mmFranja : null;
  }
  const nubes = indices.filter((i) => horaDe(horas[i]) >= 9 && horaDe(horas[i]) <= 18).map((i) => {
    var _a;
    return (_a = serie.cloud_cover) == null ? void 0 : _a[i];
  }).filter((x) => x !== null && x !== void 0);
  const rafagas = tomar("wind_gusts_10m");
  const cape = tomar("cape");
  const viento = tomar("wind_speed_10m");
  const sensacion = tomar("apparent_temperature");
  const uv = tomar("uv_index");
  return {
    max: Math.max(...temps),
    min: Math.min(...temps),
    mm: lluvia.length ? suma(lluvia) : null,
    llueve: lluvia.length ? suma(lluvia) >= umbrales.lluvia.mm_en_el_dia_para_que_un_modelo_cuente_lluvia : null,
    franjas,
    viento: viento.length ? Math.max(...viento) : 0,
    rafagas: rafagas.length ? Math.max(...rafagas) : null,
    nubes: nubes.length ? suma(nubes) / nubes.length : null,
    cape: cape.length ? Math.max(...cape) : null,
    st_max: sensacion.length ? Math.max(...sensacion) : null,
    st_min: sensacion.length ? Math.min(...sensacion) : null,
    uv: uv.length ? Math.max(...uv) : null
  };
}
function tipoDeCielo(prob, cape, nubes, umbrales) {
  if (prob >= umbrales.lluvia.porcentaje_de_modelos_para_decir_que_llueve) {
    if (cape !== null && cape >= umbrales.tormenta.cape_para_decir_que_puede_haber_tormenta) return "tormenta";
    return "lluvia";
  }
  if (prob >= umbrales.lluvia.porcentaje_de_modelos_para_decir_dia_dudoso) return "dudoso";
  if (nubes !== null && nubes >= umbrales.cielo.nubosidad_para_decir_nublado) return "nublado";
  if (nubes !== null && nubes >= umbrales.cielo.nubosidad_para_decir_parcialmente_nublado) return "parcial";
  return "sol";
}
function lluviaYCielo(resumenes, pesos, umbrales) {
  const votos = [];
  resumenes.forEach((r, k) => {
    if (r && r.llueve !== null) votos.push([r.llueve, pesos[k]]);
  });
  const pesoTotal = suma(votos.map((v) => v[1]));
  const pesoLluvia = suma(votos.filter((v) => v[0]).map((v) => v[1]));
  const prob = pesoTotal ? redondear(100 * pesoLluvia / pesoTotal) : 0;
  const franjasLluvia = [];
  for (const [clave] of FRANJAS) {
    const v = [];
    resumenes.forEach((r, k) => {
      const f = r == null ? void 0 : r.franjas[clave];
      if (r && f !== null && f !== void 0) v.push([f, pesos[k]]);
    });
    const total = suma(v.map((x) => x[1]));
    if (total && suma(v.filter((x) => x[0]).map((x) => x[1])) / total >= 0.5) franjasLluvia.push(clave);
  }
  const cape = mediana(resumenes.map((r) => r ? r.cape : null));
  const nubes = promedio(resumenes.map((r) => r ? r.nubes : null), pesos);
  return {
    prob_lluvia: prob,
    modelos_con_lluvia: votos.filter((v) => v[0]).length,
    modelos_total: votos.length,
    mm: redondear(mediana(resumenes.map((r) => r ? r.mm : null)), 1),
    franjas_lluvia: franjasLluvia,
    rafagas: redondear(promedio(resumenes.map((r) => r ? r.rafagas : null), pesos)),
    nubes: redondear(nubes),
    cape: redondear(cape),
    cielo: tipoDeCielo(prob, cape, nubes, umbrales)
  };
}
function corregir(r, modelo, cal) {
  var _a, _b, _c, _d, _e, _f;
  if (!r || !cal) return r;
  return {
    ...r,
    max: r.max - ((_b = (_a = cal.sesgo_max) == null ? void 0 : _a[modelo]) != null ? _b : 0),
    min: r.min - ((_d = (_c = cal.sesgo_min) == null ? void 0 : _c[modelo]) != null ? _d : 0),
    viento: r.viento - ((_f = (_e = cal.sesgo_viento) == null ? void 0 : _e[modelo]) != null ? _f : 0)
  };
}
function combinar(horas, porModelo, ids, calibracion, umbrales, momento) {
  var _a, _b, _c, _d;
  const cal = calibracion;
  const iguales = ids.map(() => 1);
  const pesos = (v) => ids.map((m) => {
    var _a2, _b2;
    return (_b2 = (_a2 = cal == null ? void 0 : cal[`pesos_${v}`]) == null ? void 0 : _a2[m]) != null ? _b2 : 1;
  });
  const pesosTempHora = pesos("max").map((a, i) => (a + pesos("min")[i]) / 2);
  const sesgoTempHora = {};
  for (const m of ids) sesgoTempHora[m] = (((_b = (_a = cal == null ? void 0 : cal.sesgo_max) == null ? void 0 : _a[m]) != null ? _b : 0) + ((_d = (_c = cal == null ? void 0 : cal.sesgo_min) == null ? void 0 : _c[m]) != null ? _d : 0)) / 2;
  const hoy = momento.slice(0, 10);
  const horaActual = momento.slice(0, 13) + ":00";
  const fechas = [...new Set(horas.map((h) => h.slice(0, 10)))].sort();
  const dias = [];
  for (const fecha of fechas) {
    const indices = horas.map((h, i) => h.startsWith(fecha) ? i : -1).filter((i) => i >= 0);
    const resumenes = ids.map((m) => resumenDiaDeUnModelo(porModelo[m], indices, horas, umbrales));
    const corregidos = resumenes.map((r, k) => corregir(r, ids[k], cal));
    const ponderado = (v) => promedio(corregidos.map((r) => r ? r[v] : null), pesos(v));
    const dia = {
      fecha,
      dia_semana: diaSemana(fecha),
      max: redondear(ponderado("max")),
      min: redondear(ponderado("min")),
      viento: redondear(ponderado("viento")),
      // Sensación térmica e índice UV: promedio simple de los modelos que los dan
      st_max: redondear(promedio(resumenes.map((r) => r ? r.st_max : null), iguales)),
      st_min: redondear(promedio(resumenes.map((r) => r ? r.st_min : null), iguales)),
      uv: redondear(promedio(resumenes.map((r) => r ? r.uv : null), iguales)),
      ...lluviaYCielo(resumenes, iguales, umbrales),
      por_modelo: Object.fromEntries(resumenes.map((r, k) => [ids[k], r ? {
        max: redondear(r.max),
        min: redondear(r.min),
        mm: redondear(r.mm, 1),
        rafagas: redondear(r.rafagas)
      } : null]))
    };
    if (fecha === hoy) {
      const restantes = indices.filter((i) => horas[i] >= horaActual);
      if (restantes.length && restantes.length < indices.length) {
        const resto = lluviaYCielo(ids.map((m) => resumenDiaDeUnModelo(porModelo[m], restantes, horas, umbrales)), iguales, umbrales);
        if (resto.nubes === null) {
          resto.nubes = dia.nubes;
          resto.cielo = tipoDeCielo(resto.prob_lluvia, resto.cape, dia.nubes, umbrales);
        }
        resto.desde = horaActual.slice(11, 16);
        dia.resto_del_dia = resto;
      }
    }
    dias.push(dia);
  }
  const proximas = [];
  horas.forEach((h, i) => {
    if (h < horaActual || proximas.length >= 24) return;
    const valor = (v) => promedio(ids.map((m) => {
      var _a2;
      return (_a2 = porModelo[m][v]) == null ? void 0 : _a2[i];
    }), iguales);
    const temp = promedio(ids.map((m) => {
      var _a2;
      const t = (_a2 = porModelo[m].temperature_2m) == null ? void 0 : _a2[i];
      return t === null || t === void 0 ? null : t - sesgoTempHora[m];
    }), pesosTempHora);
    proximas.push({
      hora: h,
      temp: redondear(temp),
      prob: redondear(valor("precipitation_probability")),
      mm: redondear(valor("precipitation"), 1),
      rafagas: redondear(valor("wind_gusts_10m")),
      nubes: redondear(valor("cloud_cover")),
      st: redondear(valor("apparent_temperature"))
    });
  });
  return { dias, horas: proximas };
}
function textoFranjas(franjas) {
  const textos = FRANJAS.filter((f) => franjas.includes(f[0])).map((f) => f[3]);
  if (!textos.length) return "";
  if (textos.length === 1) return textos[0];
  return textos.slice(0, -1).join(", ") + " y " + textos[textos.length - 1];
}

// src/motor/frases.ts
function situacion(dia, umbrales) {
  var _a, _b;
  const uLluvia = umbrales.lluvia;
  const uTemp = umbrales.temperatura;
  const uSerio = umbrales.tono_serio;
  const maxima = (_a = dia.max) != null ? _a : 20;
  const minima = (_b = dia.min) != null ? _b : 15;
  const rafagas = dia.rafagas || 0;
  if (maxima >= uSerio.maxima_calor_extremo) return ["serio_calor", true];
  if (rafagas >= uSerio.rafagas_viento_fuerte) return ["serio_viento", true];
  if (dia.ya_paro) return ["ya_paro", false];
  if (dia.prob_lluvia >= uLluvia.porcentaje_de_modelos_para_decir_que_llueve) {
    if (dia.cielo === "tormenta") return ["tormenta_posible", false];
    if (dia.franjas_lluvia.length >= uLluvia.franjas_con_lluvia_para_decir_todo_el_dia) return ["lluvia_todo_el_dia", false];
    if (dia.franjas_lluvia.length) return ["lluvia_franja", false];
    return ["dudoso", false];
  }
  if (rafagas >= umbrales.viento.rafagas_para_frase_de_viento) return ["viento", false];
  if (dia.prob_lluvia >= uLluvia.porcentaje_de_modelos_para_decir_dia_dudoso) return ["dudoso", false];
  if (maxima >= uTemp.maxima_para_frase_de_calor) return ["calor", false];
  if (maxima <= uTemp.maxima_para_frase_de_frio || minima <= uTemp.minima_para_frase_de_frio) return ["frio", false];
  if (minima <= uTemp.minima_para_frase_de_fresco) return ["fresco", false];
  if (maxima >= uTemp.maxima_para_frase_de_calorcito) return ["calorcito", false];
  if (dia.cielo === "nublado") return ["nublado", false];
  if (dia.cielo === "sol") return ["lindo", false];
  return ["templado", false];
}
var TEMAS_TEMPERATURA = /* @__PURE__ */ new Set(["calor", "frio", "fresco", "calorcito", "templado", "serio_calor"]);
var TEMAS_VIENTO = /* @__PURE__ */ new Set(["viento", "serio_viento"]);
function complementos(dia, clave, umbrales) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  if (clave.startsWith("serio_")) return [];
  const uTemp = umbrales.temperatura;
  const uViento = umbrales.viento;
  const maxima = (_a = dia.max) != null ? _a : 20;
  const minima = (_b = dia.min) != null ? _b : 15;
  const rafagas = dia.rafagas || 0;
  const extras = [];
  if (!TEMAS_VIENTO.has(clave) && rafagas >= ((_c = uViento.rafagas_para_comentario_de_viento) != null ? _c : 40)) extras.push("mas_viento");
  const dif = (_d = uTemp.diferencia_sensacion_para_comentario) != null ? _d : 4;
  let sensacion = null;
  if (dia.st_max != null && dia.max != null && dia.st_max - dia.max >= dif) sensacion = "mas_sensacion_calor";
  else if (dia.st_min != null && dia.min != null && dia.min - dia.st_min >= dif) sensacion = "mas_sensacion_frio";
  if (sensacion) extras.push(sensacion);
  else if (!TEMAS_TEMPERATURA.has(clave)) {
    if (maxima >= uTemp.maxima_para_frase_de_calor) extras.push("mas_calor");
    else if (maxima >= uTemp.maxima_para_frase_de_calorcito) extras.push("mas_calorcito");
    else if (maxima <= uTemp.maxima_para_frase_de_frio || minima <= uTemp.minima_para_frase_de_frio) extras.push("mas_frio");
    else if (maxima - minima >= ((_e = uTemp.diferencia_max_min_para_comentario) != null ? _e : 12)) extras.push("mas_amplitud");
    else if (minima <= uTemp.minima_para_frase_de_fresco) extras.push("mas_fresco");
    else if (maxima <= ((_f = uTemp.maxima_para_comentario_de_fresquito) != null ? _f : 18)) extras.push("mas_fresquito");
    else extras.push("mas_templado");
  }
  if (dia.uv != null && dia.uv >= ((_h = (_g = umbrales.uv) == null ? void 0 : _g.indice_para_comentario) != null ? _h : 8)) extras.push("mas_uv");
  return extras;
}
function adaptarDia(texto, cuando) {
  const mayus = cuando.charAt(0).toUpperCase() + cuando.slice(1);
  return texto.replace(/\bHoy\b/g, mayus).replace(/\bhoy\b/g, cuando);
}
function elegir(dia, idLugar, frases, umbrales, cuando = "hoy") {
  var _a;
  const [clave, seria] = situacion(dia, umbrales);
  const opciones = ((_a = frases[clave]) == null ? void 0 : _a.length) ? frases[clave] : frases.templado;
  let plantilla = opciones[fnv1a(`${idLugar}${dia.fecha}${clave}`) % opciones.length];
  let franja = textoFranjas(dia.franjas_lluvia) || "hoy";
  if (cuando !== "hoy") {
    plantilla = adaptarDia(plantilla, cuando);
    franja = adaptarDia(franja, cuando);
  }
  const valores = {
    max: String(dia.max),
    min: String(dia.min),
    rafagas: String(dia.rafagas),
    st_max: String(dia.st_max),
    st_min: String(dia.st_min),
    uv: String(dia.uv),
    franja,
    Franja: franja.charAt(0).toUpperCase() + franja.slice(1)
  };
  const rellenar = (t) => t.replace(/\{(\w+)\}/g, (todo, k) => k in valores ? valores[k] : todo);
  let texto = rellenar(plantilla);
  for (const extra of complementos(dia, clave, umbrales)) {
    const opcionesExtra = frases[extra];
    if (!(opcionesExtra == null ? void 0 : opcionesExtra.length)) continue;
    let agregado = opcionesExtra[fnv1a(`${idLugar}${dia.fecha}${extra}`) % opcionesExtra.length];
    if (cuando !== "hoy") agregado = adaptarDia(agregado, cuando);
    texto += " " + rellenar(agregado);
  }
  return { texto, situacion: clave, seria };
}
function vistaParaFrase(dia, umbrales) {
  const resto = dia.resto_del_dia;
  if (!resto) return dia;
  const u = umbrales.lluvia;
  return {
    ...dia,
    ...resto,
    ya_paro: dia.prob_lluvia >= u.porcentaje_de_modelos_para_decir_que_llueve && resto.prob_lluvia < u.porcentaje_de_modelos_para_decir_dia_dudoso
  };
}

// src/motor/tormentas.ts
var CODIGOS_TORMENTA = [95, 96, 99];
var CODIGOS_GRANIZO = [96, 99];
var ORDEN_COLOR = { amarilla: 1, naranja: 2, roja: 3 };
function vigilar(horas, porModelo, umbrales, momento) {
  var _a, _b, _c;
  const u = umbrales.tormenta;
  const desdeHora = momento.slice(0, 13) + ":00";
  const indices = horas.map((h, i) => h >= desdeHora ? i : -1).filter((i) => i >= 0).slice(0, u.horas_a_vigilar);
  const horasConTormenta = [];
  const rafagas = [];
  const lluvias = [];
  const modelosGranizo = /* @__PURE__ */ new Set();
  for (const i of indices) {
    const conSenal = [];
    for (const [modelo, serie] of Object.entries(porModelo)) {
      const codigo = (_a = serie.weather_code) == null ? void 0 : _a[i];
      const cape = (_b = serie.cape) == null ? void 0 : _b[i];
      const lluvia = (_c = serie.precipitation) == null ? void 0 : _c[i];
      const senal = codigo != null && CODIGOS_TORMENTA.includes(codigo) || cape != null && lluvia != null && cape >= u.cape_para_senal_de_tormenta && lluvia >= u.mm_por_hora_para_senal_de_tormenta;
      if (senal) {
        conSenal.push(modelo);
        if (codigo != null && CODIGOS_GRANIZO.includes(codigo)) modelosGranizo.add(modelo);
      }
    }
    if (conSenal.length >= u.modelos_que_deben_coincidir) {
      horasConTormenta.push(horas[i]);
      rafagas.push(mediana(conSenal.map((m) => {
        var _a2;
        return (_a2 = porModelo[m].wind_gusts_10m) == null ? void 0 : _a2[i];
      })));
      lluvias.push(Math.max(...conSenal.map((m) => {
        var _a2;
        return ((_a2 = porModelo[m].precipitation) == null ? void 0 : _a2[i]) || 0;
      })));
    }
  }
  if (!horasConTormenta.length) return null;
  const validas = rafagas.filter((r) => r !== null);
  const rafagaMax = validas.length ? Math.max(...validas) : null;
  const lluviaMax = lluvias.length ? Math.max(...lluvias) : 0;
  const granizo = modelosGranizo.size >= u.modelos_con_granizo_para_avisarlo;
  const fuerte = granizo || (rafagaMax || 0) >= u.rafagas_para_tormenta_fuerte || lluviaMax >= u.mm_por_hora_para_lluvia_intensa;
  const detalles = [];
  if (granizo) detalles.push("posible granizo");
  if (rafagaMax && rafagaMax >= 50) detalles.push(`r\xE1fagas de hasta ${redondear(rafagaMax)} km/h`);
  if (lluviaMax >= u.mm_por_hora_para_lluvia_intensa) detalles.push("lluvia muy intensa en poco tiempo");
  const ultima = horasConTormenta[horasConTormenta.length - 1];
  return {
    nivel: fuerte ? "fuerte" : "posible",
    desde: String(Number(horasConTormenta[0].slice(11, 13))),
    hasta: String((Number(ultima.slice(11, 13)) + 1) % 24),
    dia: horasConTormenta[0].slice(0, 10),
    detalles,
    rafagas: redondear(rafagaMax)
  };
}
function dentro(lat, lon, poligono) {
  let adentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [yi, xi] = poligono[i];
    const [yj, xj] = poligono[j];
    if (yi > lat !== yj > lat && lon < (xj - xi) * (lat - yi) / (yj - yi || 1e-12) + xi) adentro = !adentro;
  }
  return adentro;
}
function alertasPara(lat, lon, alertas, ahoraMs = Date.now()) {
  const vigentes = alertas.filter((a) => a.mensaje !== "Cancel" && (!a.hasta || new Date(a.hasta).getTime() >= ahoraMs) && a.poligonos.some((p) => dentro(lat, lon, p)));
  vigentes.sort((a, b) => (ORDEN_COLOR[b.color] || 0) - (ORDEN_COLOR[a.color] || 0) || Number(a.tipo !== "aviso") - Number(b.tipo !== "aviso"));
  const vistos = /* @__PURE__ */ new Set();
  return vigentes.filter((a) => {
    const clave = `${a.tipo}|${a.evento}|${a.color}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}
function descripcionBreve(alerta, oracionesMax = 2, largoMax = 230) {
  let texto = (alerta.descripcion || "").split(/\s+/).filter(Boolean).join(" ");
  if (!texto) return "";
  const inicio = "El \xE1rea ser\xE1 afectada por ";
  if (texto.startsWith(inicio)) texto = "Se esperan " + texto.slice(inicio.length);
  const oraciones = texto.split(". ").join(".\n").split("\n").map((o) => o.trim()).filter(Boolean);
  let breve = "";
  for (const o of oraciones.slice(0, oracionesMax)) {
    const junto = (breve + " " + o).trim();
    if (breve && junto.length > largoMax) break;
    breve = junto;
  }
  return breve.endsWith(".") ? breve : breve + ".";
}
function textoDelDia(dia, umbrales) {
  const u = umbrales.lluvia;
  const franjas = dia.franjas_lluvia;
  let lluvia;
  if (dia.prob_lluvia >= u.porcentaje_de_modelos_para_decir_que_llueve) {
    if (franjas.length >= u.franjas_con_lluvia_para_decir_todo_el_dia) lluvia = "lluvia casi todo el d\xEDa";
    else lluvia = franjas.length ? `lluvia ${textoFranjas(franjas)}` : "lluvia";
  } else if (dia.prob_lluvia >= u.porcentaje_de_modelos_para_decir_dia_dudoso) lluvia = "puede llover";
  else lluvia = "sin lluvia prevista";
  let texto = `Para hoy: ${lluvia}`;
  if (dia.max != null && dia.min != null) texto += `, m\xE1xima de ${dia.max}\xB0 y m\xEDnima de ${dia.min}\xB0`;
  if (dia.rafagas) texto += `, r\xE1fagas de hasta ${dia.rafagas} km/h`;
  return texto + ".";
}
function resumenSerio(alertas, aviso, dia, umbrales) {
  if (!alertas.length && !aviso) return null;
  const partes = [];
  if (alertas.length) {
    const breve = descripcionBreve(alertas[0]);
    if (breve) partes.push(breve);
  } else if (aviso) {
    const que = aviso.nivel === "fuerte" ? "Tormenta fuerte" : "Posible tormenta";
    let texto = `${que} entre las ${aviso.desde} y las ${aviso.hasta} h`;
    if (aviso.detalles.length) texto += ": " + aviso.detalles.join(", ");
    texto += "." + (aviso.nivel === "fuerte" ? " Evit\xE1 circular y asegur\xE1 objetos sueltos." : " Ten\xE9 a mano el paraguas y atenci\xF3n al cielo.");
    partes.push(texto);
  }
  partes.push(textoDelDia(dia, umbrales));
  return partes.join(" ");
}

// src/motor/pronostico.ts
var URL_DATOS_APP = "https://checlima.com.ar/datos/app.json";
var URL_OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
var DISTANCIA_MAXIMA_KM = 40;
var VARIABLES = [
  "temperature_2m",
  "precipitation_probability",
  "precipitation",
  "wind_speed_10m",
  "wind_gusts_10m",
  "cloud_cover",
  "cape",
  "weather_code",
  "apparent_temperature",
  "uv_index"
];
async function traerDatosApp() {
  const r = await fetch(`${URL_DATOS_APP}?v=${Math.floor(Date.now() / 6e5)}`);
  if (!r.ok) throw new Error(`No se pudieron bajar los datos (${r.status})`);
  return r.json();
}
async function traerModelos(lat, lon, ids) {
  var _a, _b;
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: VARIABLES.join(","),
    models: ids.join(","),
    timezone: "auto",
    forecast_days: "7"
  });
  const r = await fetch(`${URL_OPEN_METEO}?${params}`);
  if (!r.ok) throw new Error(`Open-Meteo no respondi\xF3 (${r.status})`);
  const d = await r.json();
  const horas = d.hourly.time;
  const vacio = horas.map(() => null);
  const porModelo = {};
  for (const m of ids) {
    porModelo[m] = {};
    for (const v of VARIABLES) porModelo[m][v] = (_a = d.hourly[`${v}_${m}`]) != null ? _a : vacio;
  }
  return { horas, porModelo, desfaseSegundos: (_b = d.utc_offset_seconds) != null ? _b : -10800 };
}
function ciudadMedidaCercana(lat, lon, ciudades) {
  let mejor = null;
  let distancia = Infinity;
  for (const c of ciudades) {
    const d = distanciaKm(lat, lon, c.lat, c.lon);
    if (d < distancia) {
      distancia = d;
      mejor = c;
    }
  }
  return mejor && distancia <= DISTANCIA_MAXIMA_KM && mejor.calibracion ? mejor : null;
}
function nombreDelDia(fecha, hoy) {
  const diferencia = Math.round((Date.parse(fecha) - Date.parse(hoy)) / 864e5);
  if (diferencia === 0) return "hoy";
  if (diferencia === 1) return "ma\xF1ana";
  return "el " + diaSemana(fecha);
}
function calcular(lugar, datos, crudo, ahoraMs = Date.now()) {
  var _a, _b, _c, _d, _e, _f;
  const momento = ahoraEnLugar(crudo.desfaseSegundos, ahoraMs);
  const hoy = momento.slice(0, 10);
  const ids = datos.modelos.map((m) => m.id);
  const cercana = ciudadMedidaCercana(lugar.lat, lugar.lon, datos.ciudades_medidas);
  const { dias, horas } = combinar(crudo.horas, crudo.porModelo, ids, (_a = cercana == null ? void 0 : cercana.calibracion) != null ? _a : null, datos.umbrales, momento);
  for (const dia of dias) {
    dia.frase = elegir(vistaParaFrase(dia, datos.umbrales), lugar.id, datos.frases, datos.umbrales, nombreDelDia(dia.fecha, hoy));
  }
  const alertas = alertasPara(lugar.lat, lugar.lon, datos.alertas_smn, ahoraMs);
  const kmAeropuerto = (_c = (_b = datos.umbrales.tormenta) == null ? void 0 : _b.km_para_usar_tormenta_del_aeropuerto) != null ? _c : 25;
  const delAeropuerto = (_e = (_d = datos.ciudades_medidas.find((c) => c.tormenta_aeropuerto && distanciaKm(lugar.lat, lugar.lon, c.lat, c.lon) <= kmAeropuerto)) == null ? void 0 : _d.tormenta_aeropuerto) != null ? _e : null;
  const tormenta = (_f = vigilar(crudo.horas, crudo.porModelo, datos.umbrales, momento)) != null ? _f : delAeropuerto;
  const deHoy = dias.find((d) => d.fecha === hoy);
  const serio = deHoy ? resumenSerio(alertas, tormenta, vistaParaFrase(deHoy, datos.umbrales), datos.umbrales) : null;
  if (serio && deHoy) deHoy.frase = { texto: serio, situacion: "alerta", seria: true };
  return {
    lugar,
    momento,
    dias: dias.filter((d) => d.fecha >= hoy),
    horas,
    alertas,
    tormenta,
    corregidoCon: cercana
  };
}
async function pronosticoDe(lugar, datos) {
  const crudo = await traerModelos(lugar.lat, lugar.lon, datos.modelos.map((m) => m.id));
  return calcular(lugar, datos, crudo);
}
export {
  URL_DATOS_APP,
  VARIABLES,
  calcular,
  ciudadMedidaCercana,
  pronosticoDe,
  traerDatosApp,
  traerModelos
};
