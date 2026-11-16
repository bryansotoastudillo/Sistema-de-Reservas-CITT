import React, { useState, useEffect } from "react";
import { AlertCircle, Package, Info, Lock } from "lucide-react";
import Modal from "./Modal";
import InputForm from "./InputForm";
import Boton from "./Boton";
import api from "../api/axiosConfig";

interface CategoriaDTO {
  idCategoria: number;
  nombreCategoria: string;
}

interface EstadoArticuloDTO {
  idEstadoArticulo: number;
  nombreEstado: string;
}

const camposFicha = [
  { clave: "cantidad", etiqueta: "Cantidad", tipo: "number" },
  { clave: "numeroSerie", etiqueta: "Número de serie del Excel", tipo: "text" },
  { clave: "adquisicion", etiqueta: "Fecha de adquisición", tipo: "date" },
  { clave: "montoActivo", etiqueta: "Monto del activo", tipo: "number" },
  { clave: "ubicacionRegistrada", etiqueta: "Ubicación registrada", tipo: "text" },
  { clave: "confirmarUbicacion", etiqueta: "Ubicación confirmada", tipo: "text" },
  { clave: "poseeEtiquetaDuoc", etiqueta: "Posee etiqueta Duoc", tipo: "text" },
] as const;
type Ficha = Partial<Record<typeof camposFicha[number]["clave"] | "observacion", string>>;

interface ModalEditarArticuloProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categorias: CategoriaDTO[];
  articulo: any;
}

export const ModalEditarArticulo: React.FC<ModalEditarArticuloProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categorias,
  articulo,
}) => {
  const [estados, setEstados] = useState<EstadoArticuloDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [ficha, setFicha] = useState<Ficha>({});
  const [fichaModificada, setFichaModificada] = useState(false);
  const [cargandoFicha, setCargandoFicha] = useState(true);
  const [errorFicha, setErrorFicha] = useState(false);

  const [formData, setFormData] = useState({
    nombreArticulo: "",
    idCategoria: "",
    idEstadoArticulo: "",
    marca: "",
    numeroSerie: "",
    valor: "",
    fechaCompra: "",
    etiqueta: "",
    sfai: "",
    colliers: "",
    comentarios: "",
  });

  useEffect(() => {
    if (isOpen && articulo) {
      const consulta = new AbortController();
      setFicha({});
      setFichaModificada(false);
      setCargandoFicha(true);
      setErrorFicha(false);
      api.get(`/articulos/${articulo.idArticulo}/ficha-activo`, { signal: consulta.signal })
        .then(({ data }) => {
          if (!consulta.signal.aborted) setFicha(Object.fromEntries(
            Object.entries(data).map(([clave, valor]) => [clave, valor == null ? "" : String(valor)]),
          ));
        })
        .catch(() => {
          if (!consulta.signal.aborted) setErrorFicha(true);
        })
        .finally(() => {
          if (!consulta.signal.aborted) setCargandoFicha(false);
        });
      // 1. Cargar Estados disponibles
      const fetchEstados = async () => {
        try {
          const res = await api.get("/estados");
          setEstados(res.data);
        } catch (err) {
          console.error("Error cargando estados:", err);
        }
      };
      fetchEstados();

      // 2. Pre-llenar el formulario
      setFormData({
        nombreArticulo: articulo.nombreArticulo || "",
        idCategoria: articulo.idCategoria?.toString() || "",
        idEstadoArticulo: articulo.idEstadoArticulo?.toString() || "",
        marca: articulo.marca || "",
        numeroSerie: articulo.numeroSerie || "",
        valor: articulo.valor?.toString() || "",
        fechaCompra: articulo.fechaCompra
          ? articulo.fechaCompra.toString()
          : "",
        etiqueta: articulo.etiqueta || "",
        sfai: articulo.sfai || "",
        colliers: articulo.colliers || "",
        comentarios: articulo.comentarios || "",
      });
      setErrorMsg("");
      return () => consulta.abort();
    }
  }, [isOpen, articulo]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargandoFicha) return;

    if (
      !formData.nombreArticulo.trim() ||
      !formData.idCategoria ||
      !formData.idEstadoArticulo
    ) {
      setErrorMsg(
        "El nombre, la categoría y el estado son campos obligatorios.",
      );
      return;
    }
    const estadoSeleccionado = estados.find(
      (e) => e.idEstadoArticulo.toString() === formData.idEstadoArticulo,
    );
    const nombreEstadoNuevo = estadoSeleccionado
      ? estadoSeleccionado.nombreEstado.toUpperCase()
      : "";

    if (["DAÑADO", "MANTENCION"].includes(nombreEstadoNuevo)) {
      if (!formData.comentarios || !formData.comentarios.trim()) {
        setErrorMsg(
          `Para marcar el artículo como ${nombreEstadoNuevo}, debe ingresar obligatoriamente un comentario interno justificando el estado.`,
        );
        return;
      }
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      // Construcción asimétrica del payload: 
      // Solo enviamos lo que el backend necesita, evitando campos vacíos o innecesarios
      const payload = {
        nombreArticulo: formData.nombreArticulo.trim(),
        idCategoria: Number(formData.idCategoria),
        idEstadoArticulo: Number(formData.idEstadoArticulo),
        marca: formData.marca.trim() || undefined,
        numeroSerie: formData.numeroSerie.trim() || undefined,
        valor: formData.valor ? Number(formData.valor) : undefined,
        fechaCompra: formData.fechaCompra || undefined,
        etiqueta: formData.etiqueta.trim() || undefined,
        sfai: formData.sfai.trim() || undefined,
        colliers: formData.colliers.trim() || undefined,
        comentarios: formData.comentarios.trim() || undefined,
        fichaActivo: errorFicha || !fichaModificada ? undefined : {
          ...Object.fromEntries(camposFicha.map(({ clave, tipo }) => {
            const valor = ficha[clave]?.trim();
            return [clave, valor ? (tipo === "number" ? Number(valor) : valor) : null];
          })),
          observacion: ficha.observacion?.trim() || null,
        },
      };

      await api.put(`/articulos/${articulo.idArticulo}`, payload);
      onSuccess();
      onClose();
    } catch (error: any) {
      setErrorMsg(
        error.response?.data?.mensaje ||
          "Error al actualizar el artículo. Verifica los datos.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!articulo) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} titulo="Editar Artículo">
      <form onSubmit={handleSubmit} className="space-y-6">
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">Ficha de activos fijos</summary>
          {cargandoFicha ? <p className="mt-3 text-sm text-slate-600">Cargando ficha…</p>
            : errorFicha ? <p role="alert" className="mt-3 text-sm text-red-700">No se pudo cargar la ficha. Reabre el formulario para editarla.</p>
            : <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {camposFicha.map(({ clave, etiqueta, tipo }) => <label key={clave} className="text-sm text-slate-700">
                {etiqueta}
                <input type={tipo} value={ficha[clave] ?? ""} min={tipo === "number" ? 0 : undefined}
                  step={tipo === "number" ? 1 : undefined} maxLength={tipo === "text" ? 255 : undefined}
                  onChange={e => {
                    setFichaModificada(true);
                    setFicha(anterior => ({ ...anterior, [clave]: e.target.value }));
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>)}
              <label className="text-sm text-slate-700 sm:col-span-2">Observación de la ficha
                <textarea maxLength={5000} value={ficha.observacion ?? ""}
                  onChange={e => {
                    setFichaModificada(true);
                    setFicha(anterior => ({ ...anterior, observacion: e.target.value }));
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
            </div>}
        </details>
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-6 custom-scrollbar">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
              <Package size={14} /> Identificación Básica
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <InputForm
                  type="text"
                  label="Nombre del Artículo *"
                  name="nombreArticulo"
                  value={formData.nombreArticulo}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Categoría *
                </label>
                <select
                  name="idCategoria"
                  value={formData.idCategoria}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    Seleccione una categoría
                  </option>
                  {categorias.map((cat) => (
                    <option key={cat.idCategoria} value={cat.idCategoria}>
                      {cat.nombreCategoria}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Estado Físico *
                </label>
                <select
                  name="idEstadoArticulo"
                  value={formData.idEstadoArticulo}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    Seleccione un estado
                  </option>
                  {estados.map((est) => (
                    <option
                      key={est.idEstadoArticulo}
                      value={est.idEstadoArticulo}
                    >
                      {est.nombreEstado}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase">
                    Código Duoc
                  </label>
                  <Lock size={12} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  value={articulo.codigoDuoc || "N/A"}
                  disabled
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                  title="El código Duoc no puede ser modificado por seguridad."
                />
              </div>

              <div>
                <InputForm
                  type="text"
                  label="Marca"
                  name="marca"
                  value={formData.marca}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 px-1">
            <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 border-b border-slate-200 pb-2">
              <Info size={14} /> Trazabilidad y Detalles
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputForm
                type="text"
                label="Número de Serie"
                name="numeroSerie"
                value={formData.numeroSerie}
                onChange={handleChange}
              />
              <InputForm
                type="date"
                label="Fecha de Compra"
                name="fechaCompra"
                value={formData.fechaCompra}
                onChange={handleChange}
              />
              <InputForm
                type="number"
                label="Valor Estimado ($)"
                name="valor"
                value={formData.valor}
                onChange={handleChange}
              />
              <InputForm
                type="text"
                label="SFAI"
                name="sfai"
                value={formData.sfai}
                onChange={handleChange}
              />
              <InputForm
                type="text"
                label="Colliers"
                name="colliers"
                value={formData.colliers}
                onChange={handleChange}
              />
              <InputForm
                type="text"
                label="Etiqueta"
                name="etiqueta"
                value={formData.etiqueta}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Comentarios Internos
              </label>
              <textarea
                name="comentarios"
                value={formData.comentarios}
                onChange={handleChange}
                placeholder="Obligatorio si el estado es DAÑADO o MANTENCIÓN..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <Boton
            type="button"
            variante="secundario"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </Boton>
          <Boton
            type="submit"
            variante="primario"
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
          >
            {isLoading ? "Guardando..." : "Guardar Cambios"}
          </Boton>
        </div>
      </form>
    </Modal>
  );
};
