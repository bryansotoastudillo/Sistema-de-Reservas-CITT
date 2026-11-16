const origen = new URL(import.meta.url).origin;

export async function consultarPlanoCitt({ signal } = {}) {
  const respuesta = await fetch(new URL("/api/plano-citt/visor", origen), {
    signal, cache: "no-store", credentials: "omit",
  });
  if (!respuesta.ok) throw new Error("No se pudo consultar el plano del CITT.");
  return respuesta.json();
}

export function montarPlanoCitt(contenedor) {
  const iframe = document.createElement("iframe");
  iframe.title = "Plano de ocupación del CITT Valparaíso";
  iframe.style.width = "100%";
  iframe.style.aspectRatio = "4 / 3";
  iframe.style.border = "0";
  let cargas = 0;

  function actualizar() {
    const url = new URL("/visor-espacios.html", origen);
    url.searchParams.set("consulta", `${Date.now()}-${++cargas}`);
    iframe.src = url.href;
  }

  actualizar();
  contenedor.append(iframe);
  return { actualizar, desmontar: () => iframe.remove() };
}
