import { rolesGestionCitt } from "../utils/roles";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import api from "../api/axiosConfig";
import Modal from "../componentes/Modal";
import { useSeguridad } from "../hooks/useSeguridad";

type Imagen = { id: string; nombre: string; archivo: string };
type Catalogo = { revision: number; imagenes: Imagen[] };
const ruta = "/contenido-pantalla";
const limite = 900 * 1024;
const tipos = "image/png,image/jpeg,image/webp";
const control = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-[#003b73] hover:bg-slate-50 disabled:opacity-40";

async function prepararImagen(archivo: File): Promise<Blob> {
  if (!tipos.split(",").includes(archivo.type) || archivo.size > 20 * 1024 * 1024) {
    throw new Error("Selecciona una imagen PNG, JPEG o WebP de hasta 20 MB.");
  }
  const imagen = await createImageBitmap(archivo).catch(() => { throw new Error("No se pudo abrir la imagen."); });
  try {
    if (archivo.type !== "image/webp" && archivo.size <= limite && imagen.width * imagen.height <= 12_000_000) {
      return archivo;
    }
    const lienzo = document.createElement("canvas");
    const escala = Math.min(1, 1920 / Math.max(imagen.width, imagen.height));
    lienzo.width = Math.max(1, Math.round(imagen.width * escala));
    lienzo.height = Math.max(1, Math.round(imagen.height * escala));
    const contexto = lienzo.getContext("2d", { alpha: false });
    if (!contexto) throw new Error("El navegador no pudo preparar la imagen.");
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, lienzo.width, lienzo.height);
    contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    for (const calidad of [0.95, 0.85, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>(resolver => lienzo.toBlob(resolver, "image/jpeg", calidad));
      if (blob && blob.size <= limite) return blob;
    }
    throw new Error("La imagen supera el tamaño de publicación. Reduce su tamaño e inténtalo de nuevo.");
  } finally {
    imagen.close();
  }
}

export function ContenidoPantallaPage() {
  const { isVerificando } = useSeguridad();
  const tienePermiso = rolesGestionCitt.includes(localStorage.getItem("activeRole") ?? "");
  const [catalogo, setCatalogo] = useState<Catalogo>();
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [eliminar, setEliminar] = useState<Imagen>();

  useEffect(() => {
    if (isVerificando || !tienePermiso) return;
    const consulta = new AbortController();
    api.get<Catalogo>(ruta, { signal: consulta.signal })
      .then(({ data }) => { if (!consulta.signal.aborted) setCatalogo(data); })
      .catch(() => { if (!consulta.signal.aborted) setError("No se pudo cargar el catálogo."); });
    return () => consulta.abort();
  }, [isVerificando, tienePermiso]);

  async function aplicar(accion: () => Promise<{ data: Catalogo }>, exito: string) {
    if (procesando) return;
    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      const { data } = await accion();
      setCatalogo(data);
      setEliminar(undefined);
      setMensaje(exito);
    } catch (problema) {
      const texto = isAxiosError<{ mensaje?: string }>(problema)
        ? problema.response?.data?.mensaje : problema instanceof Error ? problema.message : undefined;
      setError(texto || "No se pudo completar la operación.");
    } finally {
      setProcesando(false);
    }
  }

  function elegirImagen(evento: ChangeEvent<HTMLInputElement>, id?: string) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    void aplicar(async () => {
      const datos = new FormData();
      datos.append("archivo", await prepararImagen(archivo), archivo.name);
      const configuracion = { headers: { "Content-Type": "multipart/form-data" } };
      return id ? api.put<Catalogo>(`${ruta}/${id}`, datos, configuracion)
        : api.post<Catalogo>(ruta, datos, configuracion);
    }, id ? "Imagen reemplazada." : "Imagen publicada.");
  }

  function confirmarEliminacion(evento: FormEvent) {
    evento.preventDefault();
    if (eliminar) void aplicar(() => api.delete<Catalogo>(`${ruta}/${eliminar.id}`), "Imagen retirada del carrusel.");
  }

  if (isVerificando) return <p role="status" className="p-6 text-slate-600">Verificando sesión…</p>;
  if (!tienePermiso) return <Navigate to="/dashboard" replace />;
  const imagenes = catalogo?.imagenes ?? [];

  return (
    <section aria-label="Afiches publicados" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Afiches del carrusel</h2>
          <p className="text-sm text-slate-600">Los afiches se muestran en este orden, seguidos por el plano 3D.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="https://cittvalparaiso.cl/pantalla/" target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 ${control}`}>
            Abrir Pantalla <ExternalLink size={16} aria-hidden="true" />
          </a>
          <button type="button" disabled={procesando} onClick={() => void aplicar(() => api.get<Catalogo>(ruta), "Catálogo actualizado.")}
            className={`inline-flex items-center gap-2 ${control}`}>
            <RefreshCw size={16} aria-hidden="true" /> Actualizar lista
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#003b73] px-3 py-2 text-sm font-semibold text-white focus-within:ring-2 focus-within:ring-blue-500 has-disabled:cursor-default has-disabled:opacity-40">
            <ImagePlus size={16} aria-hidden="true" /> Subir imagen
            <input className="sr-only" type="file" accept={tipos} aria-label="Subir imagen"
              disabled={procesando || !catalogo || imagenes.length >= 30} onChange={elegirImagen} />
          </label>
        </div>
      </div>
      {error && !eliminar && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {mensaje && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{mensaje}</p>}
      {procesando && <p role="status" className="text-sm text-slate-600">Procesando el cambio…</p>}
      {!catalogo && !error && <p role="status" className="text-sm text-slate-600">Cargando afiches…</p>}
      {catalogo && imagenes.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Cuando subas la primera imagen, aparecerá antes del plano 3D.
      </p>}
      <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {imagenes.map((imagen, indice) => (
          <li key={imagen.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <img src={`${api.defaults.baseURL}${ruta}/archivos/${imagen.archivo}`} alt={imagen.nombre}
              loading="lazy" className="aspect-video w-full bg-slate-100 object-contain" />
            <div className="space-y-3 p-4">
              <p className="break-words text-sm font-semibold text-slate-800">{imagen.nombre}</p>
              <div className="flex flex-wrap gap-2">
                {[{ texto: "Adelantar", salto: -1, Icono: ArrowUp, limite: 0 },
                  { texto: "Atrasar", salto: 1, Icono: ArrowDown, limite: imagenes.length - 1 }].map(({ texto, salto, Icono, limite }) => (
                  <button type="button" key={texto} title={texto} aria-label={`${texto} ${imagen.nombre}`}
                    disabled={procesando || indice === limite} className={control}
                    onClick={() => void aplicar(() => api.patch<Catalogo>(`${ruta}/${imagen.id}/orden`, { desplazamiento: salto }), "Orden actualizado.")}>
                    <Icono size={16} aria-hidden="true" />
                  </button>
                ))}
                <label className={`cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 has-disabled:cursor-default has-disabled:opacity-40 ${control}`}>
                  Reemplazar
                  <input className="sr-only" type="file" accept={tipos} disabled={procesando}
                    aria-label={`Reemplazar ${imagen.nombre}`} onChange={evento => elegirImagen(evento, imagen.id)} />
                </label>
                <button type="button" title="Eliminar" aria-label={`Eliminar ${imagen.nombre}`} disabled={procesando}
                  onClick={() => { setError(""); setEliminar(imagen); }} className={`${control} text-red-700`}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <Modal isOpen={!!eliminar} titulo="Retirar imagen" onClose={() => { if (!procesando) setEliminar(undefined); }}>
        <form onSubmit={confirmarEliminacion} className="space-y-4">
          <p>¿Quieres retirar <strong>{eliminar?.nombre}</strong> del carrusel?</p>
          {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={control} disabled={procesando} onClick={() => setEliminar(undefined)}>Cancelar</button>
            <button type="submit" disabled={procesando} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Retirar imagen</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
