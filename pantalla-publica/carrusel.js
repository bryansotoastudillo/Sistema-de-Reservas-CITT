(() => {
  const area = document.getElementById("panel-carousel");
  const puntos = document.getElementById("car-dots");
  const numeracion = document.getElementById("car-num");
  const progreso = document.getElementById("car-fill");
  const gradiente = document.getElementById("car-grad");
  const origenContenido = new URL("./contenido/", document.baseURI);
  const claveCache = "citt-catalogo-pantalla";
  const formatoArchivo = /^[0-9a-f-]{36}\.(?:png|jpe?g)$/;
  let catalogo = recuperarCatalogo();
  let revisionMostrada;
  let tarjetas = [];
  let actual = -1;
  let visor;
  let visitaPlano = 0;

  function validarCatalogo(datos) {
    if (!Number.isSafeInteger(datos?.revision) || !Array.isArray(datos.imagenes)
      || !datos.imagenes.every(imagen => typeof imagen.nombre === "string" && formatoArchivo.test(imagen.archivo))) {
      throw new Error("Catálogo de pantalla inválido");
    }
    return datos;
  }

  function recuperarCatalogo() {
    try {
      return validarCatalogo(JSON.parse(localStorage.getItem(claveCache)));
    } catch {
      return { revision: -1, imagenes: [] };
    }
  }

  async function consultarCatalogo() {
    try {
      const respuesta = await fetch(new URL("catalogo.json", origenContenido), {
        cache: "no-store", signal: AbortSignal.timeout(3000),
      });
      if (!respuesta.ok) throw new Error("Catálogo de pantalla no disponible");
      catalogo = validarCatalogo(await respuesta.json());
      try { localStorage.setItem(claveCache, JSON.stringify(catalogo)); } catch { /* almacenamiento opcional */ }
    } catch (error) {
      console.warn("[Pantalla] Se conserva el último catálogo disponible.", error);
    }
  }

  async function abrirPlano(tarjeta) {
    const visita = ++visitaPlano;
    tarjeta.aviso.hidden = false;
    tarjeta.aviso.textContent = "Cargando plano de ocupación…";
    try {
      const modulo = await import("https://administracion.cittvalparaiso.cl/visor-plano-citt.js");
      if (visita !== visitaPlano) return;
      visor = modulo.montarPlanoCitt(tarjeta.elemento);
      tarjeta.aviso.hidden = true;
    } catch {
      if (visita === visitaPlano) tarjeta.aviso.textContent = "El plano de ocupación no está disponible.";
    }
  }

  function cerrarPlano() {
    visitaPlano++;
    visor?.desmontar();
    visor = undefined;
  }

  function crearTarjetas() {
    cerrarPlano();
    tarjetas.forEach(tarjeta => tarjeta.elemento.remove());
    puntos.replaceChildren();
    actual = -1;
    tarjetas = [...catalogo.imagenes, null].map(imagen => {
      const elemento = document.createElement("div");
      elemento.className = "slide";
      const punto = document.createElement("div");
      punto.className = "dot";
      puntos.append(punto);
      area.insertBefore(elemento, gradiente);
      if (imagen) {
        const imagenEl = document.createElement("img");
        imagenEl.alt = imagen.nombre;
        imagenEl.decoding = "async";
        elemento.append(imagenEl);
        return { elemento, punto, imagenEl, url: new URL(imagen.archivo, origenContenido).href };
      }
      elemento.classList.add("slide-plano");
      const aviso = document.createElement("p");
      aviso.setAttribute("role", "status");
      elemento.append(aviso);
      return { elemento, punto, aviso };
    });
    revisionMostrada = catalogo.revision;
  }

  function mostrar(indice) {
    if (actual !== indice) {
      const anterior = tarjetas[actual];
      if (anterior) {
        anterior.elemento.classList.remove("active");
        anterior.punto.classList.remove("on");
        if (anterior.aviso) cerrarPlano();
      }
      const siguiente = tarjetas[indice];
      if (siguiente.imagenEl && !siguiente.imagenEl.hasAttribute("src")) siguiente.imagenEl.src = siguiente.url;
      siguiente.elemento.classList.add("active");
      siguiente.punto.classList.add("on");
      numeracion.textContent = `${indice + 1} / ${tarjetas.length}`;
      if (siguiente.aviso) void abrirPlano(siguiente);
      actual = indice;
    }
    const duracion = (tarjetas[indice].aviso ? CONFIG.duracionPlano : CONFIG.duracionSlide) * 1000;
    progreso.style.transition = "none";
    progreso.style.width = "0%";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      progreso.style.transition = `width ${duracion}ms linear`;
      progreso.style.width = "100%";
    }));
    setTimeout(() => {
      if (indice + 1 === tarjetas.length) void iniciarVuelta();
      else mostrar(indice + 1);
    }, duracion);
  }

  async function iniciarVuelta() {
    await consultarCatalogo();
    if (revisionMostrada !== catalogo.revision) crearTarjetas();
    mostrar(0);
  }

  void iniciarVuelta();
})();
