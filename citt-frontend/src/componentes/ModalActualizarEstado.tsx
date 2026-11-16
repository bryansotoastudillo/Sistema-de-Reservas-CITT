import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import api from "../api/axiosConfig";
import type { Espacio } from "../hooks/useOcupacionEspacios";
import Modal from "./Modal";

type EstadoManual = "LIBRE" | "OCUPADO" | "FUERA_DE_SERVICIO" | "DANADO";

export function ModalActualizarEstado({ onClose, onSuccess, espacio }: {
  onClose: () => void;
  onSuccess: () => void;
  espacio: Espacio;
}) {
  const [estado, setEstado] = useState<EstadoManual>(
    espacio.estado === "DAÑADO" ? "DANADO" : espacio.estado !== "DISPONIBLE" ? "FUERA_DE_SERVICIO"
      : espacio.enUsoAhora ? "OCUPADO" : "LIBRE",
  );
  const [minutos, setMinutos] = useState("60");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError("");
    try {
      await api.patch(`/espacios/${espacio.id}/estado`, {
        estado,
        minutos: estado === "OCUPADO" ? Number(minutos) : undefined,
      });
      onSuccess();
    } catch (respuesta) {
      const mensaje = isAxiosError<{ mensaje?: string }>(respuesta) ? respuesta.response?.data?.mensaje : undefined;
      setError(mensaje || "No se pudo actualizar el estado del espacio.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal isOpen onClose={() => { if (!guardando) onClose(); }} titulo="Cambiar estado del espacio">
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <p className="font-semibold text-slate-800">{espacio.nombre}</p>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Nuevo estado
          <select value={estado} disabled={guardando} onChange={event => setEstado(event.target.value as EstadoManual)}
            className="rounded-lg border border-slate-300 bg-white p-2.5">
            <option value="LIBRE">Libre</option>
            <option value="OCUPADO">Ocupado</option>
            <option value="FUERA_DE_SERVICIO">Fuera de servicio</option>
            <option value="DANADO">Fuera de servicio por daño</option>
          </select>
        </label>
        {estado === "OCUPADO" && (
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Duración en minutos
            <input type="number" min={5} max={720} required value={minutos} disabled={guardando}
              onChange={event => setMinutos(event.target.value)} className="rounded-lg border border-slate-300 p-2.5" />
          </label>
        )}
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          {estado === "LIBRE"
            ? "Si hay una reserva activa, se cierra su uso del espacio y queda en el historial. Si la reserva es exclusiva, el cierre abarca todo el CITT. Los préstamos de equipos mantienen su proceso de devolución."
            : estado === "OCUPADO"
              ? "El espacio se ocupa desde ahora y vuelve automáticamente al estado que corresponda cuando termine el plazo."
              : "El espacio se inhabilita para nuevas reservas. Las solicitudes existentes se mantienen para que puedas revisarlas en el calendario."}
        </p>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={guardando}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancelar</button>
          <button type="submit" disabled={guardando}
            className="rounded-lg bg-[#003b73] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {guardando ? "Guardando…" : "Confirmar estado"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
