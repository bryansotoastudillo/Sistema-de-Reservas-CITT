import React, { useState } from "react";
import { Download, Plus, Tags, Upload } from "lucide-react";
import { isAxiosError } from "axios";
import api from "../api/axiosConfig";
import Modal from "./Modal";
import { ModalCrearArticulo } from "../componentes/ModalCrearArticulo";
import { ModalGestorCategorias } from "../componentes/ModalGestorCategorias";
import { ModalCrearCategoria } from "../componentes/ModalCrearCategoria";

interface AccionesArticulosProps {
  onActualizar: () => void;
  categorias: any[];
}

export const AccionesArticulos: React.FC<AccionesArticulosProps> = ({
  onActualizar,
  categorias,
}) => {
  const [isArticuloModalOpen, setIsArticuloModalOpen] = useState(false);
  const [isGestorCategoriasOpen, setIsGestorCategoriasOpen] = useState(false);
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [errorExportacion, setErrorExportacion] = useState("");
  const [mostrarImportacion, setMostrarImportacion] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [mensajeImportacion, setMensajeImportacion] = useState("");
  const [errorImportacion, setErrorImportacion] = useState("");

  async function importarDatos(evento: React.FormEvent) {
    evento.preventDefault();
    if (!archivo || importando) return;
    setImportando(true);
    setErrorImportacion("");
    setMensajeImportacion("");
    const datos = new FormData();
    datos.append("archivo", archivo);
    try {
      const { data } = await api.post<{ creados: number; actualizados: number; sinCambios: number }>(
        "/articulos/importar", datos, { headers: { "Content-Type": "multipart/form-data" } },
      );
      setMensajeImportacion(`Importación completa. Nuevos: ${data.creados}. Actualizados: ${data.actualizados}. Sin cambios: ${data.sinCambios}.`);
      setMostrarImportacion(false);
      onActualizar();
    } catch (error) {
      setErrorImportacion(isAxiosError(error) && error.response?.data?.mensaje
        ? error.response.data.mensaje : "No se pudo importar el archivo. Revisa el formato e intenta de nuevo.");
    } finally {
      setImportando(false);
    }
  }

  async function exportarInventario() {
    setExportando(true);
    setErrorExportacion("");
    try {
      const { data } = await api.get<Blob>("/articulos/exportar", { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "Inventario CITT.csv";
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setErrorExportacion("No se pudo exportar el inventario. Intenta nuevamente.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      {/* Botón Secundario: Gestionar Categorías */}
      <button
        onClick={() => setIsGestorCategoriasOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors font-medium text-sm shadow-sm cursor-pointer"
      >
        <Tags className="w-4 h-4" />
        Gestionar Categorías
      </button>

      {/* Botón Principal: Añadir Artículo */}
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setIsArticuloModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm cursor-pointer">
          <Plus className="w-4 h-4" />
          Agregar Artículo
        </button>
        <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportarInventario} disabled={exportando}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <Download className="w-4 h-4" aria-hidden="true" />
          {exportando ? "Exportando…" : "Exportar Inventario"}
        </button>
        <button type="button" onClick={() => {
          setArchivo(null);
          setErrorImportacion("");
          setMostrarImportacion(true);
        }} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Upload size={16} aria-hidden="true" /> Importar Datos
        </button>
        </div>
        {errorExportacion && <span role="alert" className="max-w-48 text-xs text-red-700">{errorExportacion}</span>}
        {mensajeImportacion && <p role="status" className="max-w-72 text-xs text-emerald-800">{mensajeImportacion}</p>}
      </div>
      {mostrarImportacion && <Modal isOpen onClose={() => !importando && setMostrarImportacion(false)} titulo="Importar Datos">
        <form onSubmit={importarDatos} className="space-y-4">
          <p className="text-sm text-slate-600">Selecciona un CSV o XLSX de hasta 1 MB. Para actualizar fichas existentes, conserva el ID y el Código Duoc de la exportación.</p>
          <label className="block text-sm font-semibold text-slate-800">Archivo de inventario
            <input type="file" accept=".csv,.xlsx" required disabled={importando}
              className="mt-2 block w-full rounded-lg border border-slate-300 p-2"
              onChange={e => {
                const seleccionado = e.target.files?.[0] ?? null;
                const valido = seleccionado && /\.(csv|xlsx)$/i.test(seleccionado.name) && seleccionado.size <= 1_048_576;
                setArchivo(valido ? seleccionado : null);
                setErrorImportacion(seleccionado && !valido ? "Selecciona un CSV o XLSX de hasta 1 MB." : "");
              }} />
          </label>
          {errorImportacion && <p role="alert" className="text-sm text-red-700">{errorImportacion}</p>}
          <button disabled={!archivo || importando} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {importando ? "Importando…" : "Aplicar cambios del archivo"}
          </button>
        </form>
      </Modal>}

      {/* Crear Artículo */}
      {isArticuloModalOpen && (
        <ModalCrearArticulo
          isOpen={isArticuloModalOpen}
          onClose={() => setIsArticuloModalOpen(false)}
          categorias={categorias}
          onSuccess={onActualizar}
        />
      )}

      {/* Gestor de Categorías */}
      {isGestorCategoriasOpen && (
        <ModalGestorCategorias
          isOpen={isGestorCategoriasOpen}
          onClose={() => {
            setIsGestorCategoriasOpen(false);
            onActualizar();
          }}
          onOpenCrear={() => {
            setIsGestorCategoriasOpen(false);
            setIsCategoriaModalOpen(true);
          }}
        />
      )}

      {/* Crear Nueva Categoría */}
      {isCategoriaModalOpen && (
        <ModalCrearCategoria
          isOpen={isCategoriaModalOpen}
          onClose={() => {
            setIsCategoriaModalOpen(false);
            setIsGestorCategoriasOpen(true);
          }}
          onSuccess={() => {
            onActualizar();
            setIsCategoriaModalOpen(false);
            setIsGestorCategoriasOpen(true);
          }}
        />
      )}
    </div>
  );
};
