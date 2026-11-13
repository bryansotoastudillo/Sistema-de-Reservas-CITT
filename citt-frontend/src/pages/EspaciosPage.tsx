import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useSeguridad } from "../hooks/useSeguridad"; 
import { Plus, Trash2, Edit, AlertTriangle } from "lucide-react";
import api from "../api/axiosConfig";
import TablaDatos from "../componentes/TablaDatos";
import { ModalCrearEspacio } from "../componentes/ModalCrearEspacio";
import { ModalEditarEspacio } from "../componentes/ModalEditarEspacio";
import { ModalConfirmarEliminar } from "../componentes/ModalConfirmarEliminar";
import { ModalActualizarEstado } from "../componentes/ModalActualizarEstado"; 

import { VistaOcupacionCitt } from "../componentes/planoCitt/VistaOcupacionCitt";
import { useOcupacionEspacios } from "../hooks/useOcupacionEspacios";
import type { Espacio } from "../hooks/useOcupacionEspacios";

const EspaciosPage = () => {
  const { isVerificando } = useSeguridad();
  const rolActivo = localStorage.getItem("activeRole") || "";
  const isAdminArea = ["ADMIN", "DIRECTOR", "COORDINADOR"].includes(rolActivo.toUpperCase());
  const { consulta, actualizar: fetchEspacios } = useOcupacionEspacios(!isVerificando && isAdminArea);
  const espacios = typeof consulta === "object" ? consulta.espacios : [];

  // Admin Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [espacioAEditar, setEspacioAEditar] = useState<Espacio | null>(null);
  const [espacioABorrar, setEspacioABorrar] = useState<Espacio | null>(null);
  const [espacioEstado, setEspacioEstado] = useState<Espacio | null>(null);

  const ejecutarEliminar = async () => {
    if (!espacioABorrar) return;
    try { 
      await api.delete(`/espacios/${espacioABorrar.id}`); 
      fetchEspacios(); 
      setEspacioABorrar(null);
    } catch {
      throw new Error("No se puede eliminar por integridad de datos");
    }
  };

  const renderEstadoLocal = (estado: string, enUsoAhora: boolean) => {
    const est = estado ? estado.toUpperCase() : "DESCONOCIDO";
    if (est === "DISPONIBLE") {
      if (enUsoAhora) {
        return <span className="rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-bold text-red-800">Ocupado</span>;
      }
      return <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">🟢 Disponible</span>;
    }
    if (est === "MANTENCION") {
      return <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">🟡 En Mantención</span>;
    }
    if (est === "DAÑADO") {
      return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold border border-red-200">🔴 Dañado</span>;
    }
    return <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold border border-gray-200">⚪ {estado}</span>;
  };

  if (isVerificando) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#003b73]"></div>
      </div>
    );
  }

  if (!isAdminArea) {
    return <Navigate to="/solicitar-reserva" replace />;
  }

  // --- ADMIN VIEW ONLY ---
  return (
    <>

      <div className="flex flex-col gap-6">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-800">Plano 3D del CITT</h2>
            <a href="#espacios-registrados" className="text-sm font-semibold text-[#003b73] underline">Ir a la tabla de espacios</a>
          </div>
          <VistaOcupacionCitt consulta={consulta} actualizar={fetchEspacios} />
        </div>

        <div id="espacios-registrados" className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-800">Espacios registrados</h2>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm cursor-pointer">
            <Plus className="w-4 h-4" /> Agregar Espacio
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <TablaDatos columnas={["CÓDIGO", "NOMBRE", "CAPACIDAD", "ESTADO", "ACCIONES"]}>
            {espacios.map((e) => (
              <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-5 font-medium text-gray-600">ESP-{e.id.toString().padStart(3, '0')}</td>
                <td className="p-5 font-bold text-gray-800">{e.nombre}</td>
                <td className="p-5 text-gray-600">{e.capacidad} pers.</td>
                <td className="p-5">{renderEstadoLocal(e.estado, e.enUsoAhora)}</td>
                <td className="p-5 flex gap-3">
                  <button onClick={() => setEspacioEstado(e)} className="text-amber-500 hover:text-amber-700" title="Gestionar Estado">
                    <AlertTriangle size={18} />
                  </button>
                  <button onClick={() => setEspacioAEditar(e)} className="text-blue-600 hover:text-blue-800" title="Editar Información">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => setEspacioABorrar(e)} className="text-red-400 hover:text-red-600" title="Eliminar Espacio">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </TablaDatos>
        </div>

        <ModalCrearEspacio isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchEspacios} />
        <ModalEditarEspacio isOpen={!!espacioAEditar} onClose={() => setEspacioAEditar(null)} onSuccess={() => { fetchEspacios(); setEspacioAEditar(null); }} espacio={espacioAEditar} />
        <ModalConfirmarEliminar isOpen={!!espacioABorrar} onClose={() => setEspacioABorrar(null)} onConfirm={ejecutarEliminar} nombreEspacio={espacioABorrar?.nombre || ""} />
        <ModalActualizarEstado isOpen={!!espacioEstado} onClose={() => setEspacioEstado(null)} onSuccess={() => { fetchEspacios(); setEspacioEstado(null); }} espacio={espacioEstado} />
      </div>
    </>
  );
};

export default EspaciosPage;
