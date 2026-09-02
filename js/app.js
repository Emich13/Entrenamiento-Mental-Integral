"use strict";

/**
 * Cuadernillo digital EMI — app sin backend, todo en localStorage.
 *
 * Para sumar un tipo de bloque nuevo: agregar una función al objeto
 * RENDERERS_DE_BLOQUE (ver más abajo) — el resto del código no necesita
 * tocarse ni sabe nada de tipos de bloque específicos.
 */

const STORAGE_KEY = "emi-cuadernillo:respuestas:v1";
const ULTIMA_SEMANA_KEY = "emi-cuadernillo:ultima-semana";
const GUARDADO_DEBOUNCE_MS = 500;

let estado = {}; // { [fieldKey]: string | boolean }
let semanas = []; // [{ id, titulo, datos, seccionEl, itemEl, badgeEl }]
let guardadoTimeout = null;

// ---------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", iniciar);

async function iniciar() {
  estado = cargarEstado();
  cablearBotones();

  try {
    const manifest = await cargarJSON("data/manifest.json");
    const datosPorSemana = await Promise.all(
      manifest.map((entrada) => cargarJSON(`data/${entrada.archivo}`))
    );

    const contenedor = document.getElementById("contenido");
    contenedor.innerHTML = "";

    if (datosPorSemana.length === 0) {
      contenedor.innerHTML = '<p class="vacio">Todavía no hay semanas cargadas.</p>';
      return;
    }

    datosPorSemana.forEach((datos) => {
      const seccionEl = renderizarSemana(datos);
      contenedor.appendChild(seccionEl);
      semanas.push({ id: datos.id, titulo: datos.titulo, datos, seccionEl });
    });

    construirIndiceLateral();
    actualizarTodosLosProgresos();

    const ultima = localStorage.getItem(ULTIMA_SEMANA_KEY);
    const inicial = semanas.find((s) => s.id === ultima) || semanas[0];
    activarSemana(inicial.id);
  } catch (err) {
    console.error(err);
    document.getElementById("contenido").innerHTML =
      '<p class="vacio">No se pudo cargar el cuadernillo. Revisá data/manifest.json y los archivos de cada semana.</p>';
  }
}

async function cargarJSON(ruta) {
  const resp = await fetch(ruta);
  if (!resp.ok) throw new Error(`No se pudo cargar ${ruta}`);
  return resp.json();
}

// ---------------------------------------------------------------------
// Índice lateral
// ---------------------------------------------------------------------

function construirIndiceLateral() {
  const lista = document.getElementById("lista-semanas");
  lista.innerHTML = "";

  semanas.forEach((semana) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "semana-item";
    btn.dataset.semanaId = semana.id;

    const titulo = document.createElement("span");
    titulo.className = "semana-titulo";
    titulo.textContent = semana.titulo;

    const badge = document.createElement("span");
    badge.className = "badge-progreso";

    btn.appendChild(titulo);
    btn.appendChild(badge);
    btn.addEventListener("click", () => {
      activarSemana(semana.id);
      cerrarMenuMovil();
    });

    li.appendChild(btn);
    lista.appendChild(li);

    semana.itemEl = btn;
    semana.badgeEl = badge;
  });
}

function activarSemana(semanaId) {
  semanas.forEach((semana) => {
    const activa = semana.id === semanaId;
    semana.seccionEl.classList.toggle("activa", activa);
    if (semana.itemEl) semana.itemEl.classList.toggle("activo", activa);
  });
  localStorage.setItem(ULTIMA_SEMANA_KEY, semanaId);
}

// ---------------------------------------------------------------------
// Render de una semana completa
// ---------------------------------------------------------------------

function renderizarSemana(datos) {
  const seccion = document.createElement("section");
  seccion.className = "semana-seccion";
  seccion.dataset.semanaId = datos.id;

  const h2 = document.createElement("h2");
  h2.textContent = datos.titulo;
  seccion.appendChild(h2);

  datos.bloques.forEach((bloque, indiceBloque) => {
    seccion.appendChild(renderizarBloque(bloque, datos.id, indiceBloque));
  });

  return seccion;
}

function renderizarBloque(bloque, semanaId, indiceBloque) {
  const wrapper = document.createElement("div");
  wrapper.className = "bloque";

  const header = document.createElement("div");
  header.className = "bloque-header";

  const titulo = document.createElement("span");
  titulo.className = "bloque-titulo";
  titulo.textContent = bloque.titulo || "";
  header.appendChild(titulo);

  if (bloque.pregunta) {
    const pregunta = document.createElement("div");
    pregunta.className = "bloque-pregunta";
    pregunta.textContent = bloque.pregunta;
    header.appendChild(pregunta);
  }

  wrapper.appendChild(header);

  const body = document.createElement("div");
  body.className = "bloque-body";

  const renderer = RENDERERS_DE_BLOQUE[bloque.tipo];
  if (renderer) {
    body.appendChild(renderer(bloque, semanaId, indiceBloque));
  } else {
    const aviso = document.createElement("p");
    aviso.className = "vacio";
    aviso.textContent = `Tipo de bloque no soportado: "${bloque.tipo}"`;
    body.appendChild(aviso);
  }

  wrapper.appendChild(body);
  return wrapper;
}

// ---------------------------------------------------------------------
// Renderizadores por tipo de bloque
//
// Cada renderer recibe (bloque, semanaId, indiceBloque) y devuelve el
// elemento a insertar dentro de .bloque-body. Para agregar un tipo
// nuevo en el futuro, sumar una entrada acá sin tocar el resto.
// ---------------------------------------------------------------------

const RENDERERS_DE_BLOQUE = {
  texto_libre(bloque, semanaId, bi) {
    const contenedor = document.createElement("div");

    if (Array.isArray(bloque.subpreguntas) && bloque.subpreguntas.length > 0) {
      bloque.subpreguntas.forEach((sub, si) => {
        const grupo = document.createElement("div");
        grupo.className = "subpregunta";

        const texto = document.createElement("span");
        texto.className = "subpregunta-texto";
        texto.textContent = sub;
        grupo.appendChild(texto);

        grupo.appendChild(crearCampoTextarea(`${semanaId}.b${bi}.${si}`));
        contenedor.appendChild(grupo);
      });
    } else {
      contenedor.appendChild(crearCampoTextarea(`${semanaId}.b${bi}`));
    }

    return contenedor;
  },

  lista_numerada(bloque, semanaId, bi) {
    const contenedor = document.createElement("div");
    const cantidad = bloque.cantidad_items || 0;

    for (let i = 0; i < cantidad; i++) {
      const fila = document.createElement("div");
      fila.className = "lista-item";

      const num = document.createElement("span");
      num.className = "lista-num";
      num.textContent = `${i + 1}.`;

      fila.appendChild(num);
      fila.appendChild(crearCampoInput(`${semanaId}.b${bi}.${i}`));
      contenedor.appendChild(fila);
    }

    return contenedor;
  },

  checkbox_semana(bloque, semanaId, bi) {
    const scroll = document.createElement("div");
    scroll.className = "tabla-scroll";

    const tabla = document.createElement("table");
    tabla.className = "tabla-campo check-semana";

    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    trHead.appendChild(document.createElement("th"));
    (bloque.dias || []).forEach((dia) => {
      const th = document.createElement("th");
      th.textContent = dia;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    tabla.appendChild(thead);

    const tbody = document.createElement("tbody");
    (bloque.filas || []).forEach((etiquetaFila, fi) => {
      const tr = document.createElement("tr");
      const tdEtiqueta = document.createElement("td");
      tdEtiqueta.textContent = etiquetaFila;
      tr.appendChild(tdEtiqueta);

      (bloque.dias || []).forEach((_dia, di) => {
        const td = document.createElement("td");
        td.appendChild(crearCampoCheckbox(`${semanaId}.b${bi}.${fi}.${di}`));
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);

    scroll.appendChild(tabla);
    return scroll;
  },

  tabla(bloque, semanaId, bi) {
    // "filas" acepta dos formas:
    // - un número: N filas en blanco, todas las columnas editables (ej. horario libre).
    // - un array de etiquetas: una fila fija por etiqueta (ej. los días de la
    //   semana), con esa etiqueta de solo lectura en la primera columna y las
    //   columnas editables al lado.
    const scroll = document.createElement("div");
    scroll.className = "tabla-scroll";

    const tabla = document.createElement("table");
    tabla.className = "tabla-campo";

    const columnas = bloque.columnas || [];
    const filas = bloque.filas || 0;
    const etiquetasFijas = Array.isArray(filas) ? filas : null;
    const cantidadFilas = etiquetasFijas ? etiquetasFijas.length : filas;

    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    if (etiquetasFijas) trHead.appendChild(document.createElement("th"));
    columnas.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    tabla.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let fi = 0; fi < cantidadFilas; fi++) {
      const tr = document.createElement("tr");

      if (etiquetasFijas) {
        const tdEtiqueta = document.createElement("td");
        tdEtiqueta.textContent = etiquetasFijas[fi];
        tr.appendChild(tdEtiqueta);
      }

      columnas.forEach((_col, ci) => {
        const td = document.createElement("td");
        td.appendChild(crearCampoInput(`${semanaId}.b${bi}.${fi}.${ci}`));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    tabla.appendChild(tbody);

    scroll.appendChild(tabla);
    return scroll;
  },
};

// ---------------------------------------------------------------------
// Campos editables: creación + autoguardado
// ---------------------------------------------------------------------

function crearCampoTextarea(key) {
  const el = document.createElement("textarea");
  el.className = "campo";
  el.dataset.key = key;
  el.rows = 3;
  el.value = typeof estado[key] === "string" ? estado[key] : "";
  el.addEventListener("input", () => onCampoModificado(el));
  return el;
}

function crearCampoInput(key) {
  const el = document.createElement("input");
  el.type = "text";
  el.className = "campo";
  el.dataset.key = key;
  el.value = typeof estado[key] === "string" ? estado[key] : "";
  el.addEventListener("input", () => onCampoModificado(el));
  return el;
}

function crearCampoCheckbox(key) {
  const el = document.createElement("input");
  el.type = "checkbox";
  el.className = "campo";
  el.dataset.key = key;
  el.checked = estado[key] === true;
  el.addEventListener("change", () => onCampoModificado(el));
  return el;
}

function onCampoModificado(el) {
  const key = el.dataset.key;
  estado[key] = el.type === "checkbox" ? el.checked : el.value;

  const seccion = el.closest(".semana-seccion");
  if (seccion) actualizarProgreso(seccion.dataset.semanaId);

  programarGuardado();
}

// ---------------------------------------------------------------------
// Progreso por semana (genérico: cuenta cualquier .campo, sin importar
// de qué tipo de bloque venga)
// ---------------------------------------------------------------------

function actualizarProgreso(semanaId) {
  const semana = semanas.find((s) => s.id === semanaId);
  if (!semana || !semana.badgeEl) return;

  const campos = semana.seccionEl.querySelectorAll(".campo");
  const total = campos.length;
  let completos = 0;
  campos.forEach((campo) => {
    const lleno = campo.type === "checkbox" ? campo.checked : campo.value.trim() !== "";
    if (lleno) completos++;
  });

  semana.badgeEl.textContent = `${completos}/${total}`;
  semana.badgeEl.classList.toggle("completo", total > 0 && completos === total);
}

function actualizarTodosLosProgresos() {
  semanas.forEach((semana) => actualizarProgreso(semana.id));
}

// ---------------------------------------------------------------------
// Guardado en localStorage (debounced)
// ---------------------------------------------------------------------

function cargarEstado() {
  try {
    const crudo = localStorage.getItem(STORAGE_KEY);
    return crudo ? JSON.parse(crudo) : {};
  } catch (err) {
    console.warn("No se pudo leer el progreso guardado, se empieza de cero.", err);
    return {};
  }
}

function programarGuardado() {
  clearTimeout(guardadoTimeout);
  mostrarInfoGuardado("Guardando…");
  guardadoTimeout = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    mostrarInfoGuardado(`Guardado ${new Date().toLocaleTimeString()}`);
  }, GUARDADO_DEBOUNCE_MS);
}

function mostrarInfoGuardado(texto) {
  const el = document.getElementById("guardado-info");
  if (el) el.textContent = texto;
}

// ---------------------------------------------------------------------
// Exportar / importar progreso
// ---------------------------------------------------------------------

function exportarProgreso() {
  const payload = {
    app: "emi-cuadernillo-digital",
    version: 1,
    exportadoEn: new Date().toISOString(),
    respuestas: estado,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fecha = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `emi-cuadernillo-progreso-${fecha}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importarProgreso(archivo) {
  const lector = new FileReader();
  lector.onload = () => {
    let parseado;
    try {
      parseado = JSON.parse(lector.result);
    } catch (err) {
      alert("El archivo elegido no es un JSON válido.");
      return;
    }

    const respuestas = parseado && typeof parseado === "object"
      ? (parseado.respuestas && typeof parseado.respuestas === "object" ? parseado.respuestas : parseado)
      : null;

    if (!respuestas) {
      alert("El archivo no tiene el formato esperado.");
      return;
    }

    const ok = confirm(
      "Esto va a reemplazar todas las respuestas guardadas en este dispositivo por las del archivo importado. ¿Continuar?"
    );
    if (!ok) return;

    estado = respuestas;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    aplicarEstadoATodosLosCampos();
    actualizarTodosLosProgresos();
    mostrarInfoGuardado(`Progreso importado ${new Date().toLocaleTimeString()}`);
  };
  lector.readAsText(archivo);
}

function aplicarEstadoATodosLosCampos() {
  document.querySelectorAll(".campo").forEach((campo) => {
    const key = campo.dataset.key;
    if (campo.type === "checkbox") {
      campo.checked = estado[key] === true;
    } else {
      campo.value = typeof estado[key] === "string" ? estado[key] : "";
    }
  });
}

// ---------------------------------------------------------------------
// Botonera y menú móvil
// ---------------------------------------------------------------------

function cablearBotones() {
  document.getElementById("btn-exportar").addEventListener("click", exportarProgreso);

  const inputImportar = document.getElementById("input-importar");
  document.getElementById("btn-importar").addEventListener("click", () => inputImportar.click());
  inputImportar.addEventListener("change", (ev) => {
    const archivo = ev.target.files[0];
    if (archivo) importarProgreso(archivo);
    inputImportar.value = "";
  });

  document.getElementById("btn-menu").addEventListener("click", abrirMenuMovil);
  document.getElementById("btn-close-menu").addEventListener("click", cerrarMenuMovil);
  document.getElementById("overlay").addEventListener("click", cerrarMenuMovil);
}

function abrirMenuMovil() {
  document.getElementById("sidebar").classList.add("abierto");
  document.getElementById("overlay").classList.add("visible");
  document.getElementById("btn-menu").setAttribute("aria-expanded", "true");
}

function cerrarMenuMovil() {
  document.getElementById("sidebar").classList.remove("abierto");
  document.getElementById("overlay").classList.remove("visible");
  document.getElementById("btn-menu").setAttribute("aria-expanded", "false");
}
