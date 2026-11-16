import { rolesGestionCitt } from "../utils/roles";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import api from "../api/axiosConfig";
import { useSeguridad } from "../hooks/useSeguridad";

const rolesRegularizacion = ["AYUDANTE", ...rolesGestionCitt];
const fechaCitt = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" });
const campo = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900";
type Espacio = { id: number; nombre: string; capacidad: number };
type Reserva = { idSolicitud: number; estado: string; nombreEspacio: string };

export const puedeRegularizarReserva = (rol: string) => rolesRegularizacion.includes(rol.toUpperCase());

export function RegularizarReservaPage() {
  const { isVerificando } = useSeguridad();
  const [parametros] = useSearchParams();
  const autorizado = puedeRegularizarReserva(localStorage.getItem("activeRole") ?? "");
  const hoy = fechaCitt.format(new Date());
  const [espacios, setEspacios] = useState<Espacio[] | null>(null);
  const [idEspacio, setIdEspacio] = useState(parametros.get("espacio") ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [reserva, setReserva] = useState<Reserva>();

  useEffect(() => {
    if (isVerificando || !autorizado) return;
    const controlador = new AbortController();
    api.get<Espacio[]>("/espacios", { signal: controlador.signal })
      .then(({ data }) => {
        if (!controlador.signal.aborted) setEspacios(data);
      })
      .catch(() => {
        if (!controlador.signal.aborted) setError("No se pudieron cargar los espacios. Recarga la página para reintentar.");
      });
    return () => controlador.abort();
  }, [isVerificando, autorizado]);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;
    const datos = new FormData(evento.currentTarget);
    setGuardando(true);
    setError("");
    try {
      const { data } = await api.post<Reserva>("/solicitudes/regularizacion", {
        idEspacio: Number(datos.get("espacio")),
        fecha: datos.get("fecha"),
        horaInicio: datos.get("inicio"),
        horaFin: datos.get("fin"),
        cantidadIntegrantes: Number(datos.get("integrantes")),
        proposito: datos.get("proposito"),
      });
      setReserva(data);
    } catch (problema) {
      const mensaje = isAxiosError<{ mensaje?: string }>(problema) ? problema.response?.data?.mensaje : undefined;
      setError(mensaje || "No se pudo registrar la reserva. Revisa los datos e inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  if (isVerificando) return <p role="status">Verificando sesión…</p>;
  if (!autorizado) return <Navigate to="/solicitar-reserva" replace />;

  const espacio = espacios?.find(item => String(item.id) === idEspacio);
  return (
    <section className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">Regularizar uso de un espacio</h2>
      {reserva ? (
        <>
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            Reserva #{reserva.idSolicitud} registrada para {reserva.nombreEspacio}. Estado {reserva.estado.toLowerCase()}.
          </p>
          <Link to="/calendario" className="font-semibold text-[#003b73] underline">Ver calendario</Link>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Ingresa el horario real de una actividad que ya comenzó. La reserva se registra a tu nombre y queda confirmada de inmediato.
          </p>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {!espacios && !error && <p role="status">Cargando espacios…</p>}
          {espacios && (
            <form onSubmit={guardar}>
              <fieldset disabled={guardando} className="space-y-4">
                <label className="block text-sm font-semibold">Espacio
                  <select name="espacio" required className={campo} value={espacio ? idEspacio : ""}
                    onChange={evento => setIdEspacio(evento.target.value)}>
                    <option value="" disabled>Selecciona un espacio</option>
                    {espacios.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-sm font-semibold">Fecha
                    <input name="fecha" type="date" required defaultValue={hoy} max={hoy} className={campo} />
                  </label>
                  <label className="block text-sm font-semibold">Hora de inicio
                    <input name="inicio" type="time" required min="08:00" max="22:00" className={campo} />
                  </label>
                  <label className="block text-sm font-semibold">Hora de término
                    <input name="fin" type="time" required min="08:00" max="22:00" className={campo} />
                  </label>
                </div>
                <label className="block text-sm font-semibold">Participantes
                  <input name="integrantes" type="number" required min={1} max={espacio?.capacidad} defaultValue={1} className={campo} />
                </label>
                <label className="block text-sm font-semibold">Motivo del uso
                  <textarea name="proposito" rows={3} required maxLength={500} className={campo} />
                </label>
                <button type="submit" className="rounded-lg bg-[#003b73] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {guardando ? "Registrando…" : "Confirmar regularización"}
                </button>
              </fieldset>
            </form>
          )}
        </>
      )}
      <Link to="/solicitar-reserva" className="block text-sm font-semibold text-[#003b73] underline">Volver a Reserva de Espacios</Link>
    </section>
  );
}
