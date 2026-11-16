import React, { useState } from "react";
import { Download, Plus, Tags } from "lucide-react";
import api from "../api/axiosConfig";
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
        <button type="button" onClick={exportarInventario} disabled={exportando}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <Download className="w-4 h-4" aria-hidden="true" />
          {exportando ? "Exportando…" : "Exportar Inventario"}
        </button>
        {errorExportacion && <span role="alert" className="max-w-48 text-xs text-red-700">{errorExportacion}</span>}
      </div>

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
