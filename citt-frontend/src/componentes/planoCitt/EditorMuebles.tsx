import { Eye, EyeOff, Trash2 } from "lucide-react";
import { objetosDelPlano } from "./geometriaCitt";
import type { PosicionesPlano, PosicionPlano } from "./geometriaCitt";

export function EditorMuebles({ posiciones, seleccion, seleccionar, cambiar, eliminar, bloqueado }: {
  posiciones: PosicionesPlano; seleccion: string | null; seleccionar: (clave: string) => void;
  cambiar: (clave: string, propiedades: Partial<PosicionPlano>) => void;
  eliminar: (clave: string) => void; bloqueado: boolean;
}) {
  const objetos = objetosDelPlano(posiciones).filter(o => !o.marcador);
  const elegido = objetos.find(o => o.clave === seleccion);
  const mueble = elegido?.muebles[0];
  const p = seleccion ? posiciones[seleccion] : undefined;
  const esMesa = mueble?.tipo === "mesa" || mueble?.tipo === "mesaRedonda";
  const escala = 767 / 1247;
  function agregar(tipo: "mesa" | "silla" | "redonda") {
    const clave = `extra-${crypto.randomUUID()}`;
    cambiar(clave, { x: 0, y: 0, giro: 0, tipo, color: tipo === "silla" ? "#4d81b4" : "#f7f5ee",
      ancho: tipo === "mesa" ? 100 : tipo === "redonda" ? 80 : 45,
      fondo: tipo === "mesa" ? 50 : tipo === "redonda" ? 80 : 45, altura: tipo === "silla" ? 45 : 76 });
    seleccionar(clave);
  }
  return <div className="mt-3 space-y-3">
    <details className="rounded-lg border border-slate-200 p-2">
      <summary className="cursor-pointer text-sm font-semibold">Agregar mobiliario</summary>
      <div className="mt-2 flex flex-wrap gap-2">
        {([['silla', 'Silla'], ['mesa', 'Mesa'], ['redonda', 'Mesa redonda']] as const).map(([tipo, nombre]) =>
          <button key={tipo} type="button" disabled={bloqueado} onClick={() => agregar(tipo)}
            className="rounded border border-slate-300 px-2 py-2 text-sm">Añadir {nombre.toLowerCase()}</button>)}
      </div>
    </details>
    <label className="block text-sm font-semibold">Mobiliario y pizarras
      <select aria-label="Seleccionar mesa o silla" value={elegido?.clave ?? ""}
        onChange={e => seleccionar(e.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2 text-sm font-normal">
        <option value="">Seleccionar objeto</option>
        {objetos.map(o => <option key={o.clave} value={o.clave}>{o.nombre}{posiciones[o.clave]?.oculto ? ' (oculto)' : ''}</option>)}
      </select>
    </label>
    {elegido && <fieldset disabled={bloqueado} className="space-y-3 rounded-lg border border-slate-200 p-3 text-sm">
      <legend className="px-1 font-semibold">Propiedades del objeto</legend>
      <button type="button" onClick={() => cambiar(elegido.clave, { oculto: !p?.oculto })}
        className="flex items-center gap-2 rounded border border-slate-300 px-2 py-2">
        {p?.oculto ? <EyeOff size={16} /> : <Eye size={16} />}{p?.oculto ? 'Mostrar objeto' : 'Ocultar objeto'}
      </button>
      {mueble?.tipo && <label className="flex items-center justify-between gap-2">Color
        <input aria-label="Color del mueble" type="color" value={p?.color ?? mueble.acabado?.[0] ?? '#adb1b3'}
          onChange={e => cambiar(elegido.clave, { color: e.target.value })} className="h-10 w-14" />
      </label>}
      {esMesa && (['ancho', 'fondo', 'altura'] as const).map((campo, i) => {
        const valor = p?.[campo] ?? (campo === 'altura' ? mueble.altura :
          elegido.base[campo === 'ancho' ? 1 : 2][campo === 'ancho' ? 0 : 1] - elegido.base[0][campo === 'ancho' ? 0 : 1]) / escala;
        return <label key={campo} className="flex items-center justify-between gap-2">{['Ancho (cm)', 'Fondo (cm)', 'Alto (cm)'][i]}
          <input type="number" min={10} max={campo === 'altura' ? 250 : 400} step="0.1"
            value={Number(valor.toFixed(1))} className="w-24 rounded border border-slate-300 p-2"
            onChange={e => { if (e.target.validity.valid && e.target.value) cambiar(elegido.clave, { [campo]: Number(e.target.value) }); }} />
        </label>;
      })}
      <button type="button" onClick={() => eliminar(elegido.clave)}
        className="flex items-center gap-2 rounded bg-red-700 px-3 py-2 font-semibold text-white"><Trash2 size={16} />Eliminar mueble</button>
    </fieldset>}
  </div>;
}
