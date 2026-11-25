import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { objetosDelPlano } from "./geometriaCitt";
import type { PosicionesPlano, PosicionPlano } from "./geometriaCitt";

function DimensionMueble({ valor, maximo, cambiar, comenzarGesto, cerrarGesto }: {
  valor: number; maximo: number; cambiar: (valor: number) => void;
  comenzarGesto: () => void; cerrarGesto: () => void;
}) {
  const [edicion, setEdicion] = useState<string | null>(null);
  return <input type="number" min={10} max={maximo} step="0.1" value={edicion ?? Number(valor.toFixed(1))}
    className="w-24 rounded border border-slate-300 p-2"
    onFocus={event => { comenzarGesto(); setEdicion(event.target.value); }}
    onChange={event => setEdicion(event.target.value)}
    onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }}
    onBlur={event => {
      if (event.target.value && event.target.validity.valid) cambiar(Number(event.target.value));
      setEdicion(null);
      cerrarGesto();
    }} />;
}

export function EditorMuebles({ posiciones, selecciones, seleccionar, cambiar, agregar, eliminar, bloqueado, comenzarGesto, cerrarGesto }: {
  posiciones: PosicionesPlano; selecciones: string[]; seleccionar: (clave: string, sumar?: boolean) => void;
  cambiar: (claves: string[], propiedades: Partial<PosicionPlano>) => void;
  agregar: (clave: string, propiedades: Partial<PosicionPlano>) => void;
  eliminar: (claves: string[]) => void; bloqueado: boolean; comenzarGesto: () => void; cerrarGesto: () => void;
}) {
  const todos = objetosDelPlano(posiciones);
  const objetos = todos.filter(o => !o.marcador);
  const elegidos = todos.filter(o => selecciones.includes(o.clave));
  const elegido = objetos.find(o => o.clave === selecciones.at(-1));
  const mueble = elegidos[0]?.muebles[0];
  const mismoTipo = !!mueble?.tipo && elegidos.every(o => !o.marcador && o.muebles[0]?.tipo === mueble.tipo);
  const claves = elegidos.map(o => o.clave);
  const p = elegidos[0] ? posiciones[elegidos[0].clave] : undefined;
  const ocultos = elegidos.every(o => posiciones[o.clave]?.oculto);
  const escala = 767 / 1247;
  function nuevo(tipo: NonNullable<PosicionPlano["tipo"]>) {
    const clave = `extra-${crypto.randomUUID()}`;
    const silla = tipo === "silla" || tipo === "sillaCowork";
    agregar(clave, { x: 0, y: 0, giro: 0, tipo, color: silla ? "#4d81b4" : "#f7f5ee",
      ancho: tipo === "mesa" ? 100 : tipo === "redonda" ? 80 : 50,
      fondo: tipo === "mesa" ? 50 : tipo === "redonda" ? 80 : 50, altura: tipo === "sillaCowork" ? 100 : tipo === "silla" ? 45 : 76 });
    seleccionar(clave);
  }
  return <div className="mt-3 space-y-3">
    <details className="rounded-lg border border-slate-200 p-2">
      <summary className="cursor-pointer text-sm font-semibold">Agregar mobiliario</summary>
      <div className="mt-2 flex flex-wrap gap-2">
        {([['silla', 'Silla'], ['sillaCowork', 'Silla cowork'], ['mesa', 'Mesa'], ['redonda', 'Mesa redonda']] as const).map(([tipo, nombre]) =>
          <button key={tipo} type="button" disabled={bloqueado} onClick={() => nuevo(tipo)}
            className="rounded border border-slate-300 px-2 py-2 text-sm">Añadir {nombre.toLowerCase()}</button>)}
      </div>
    </details>
    <label className="block text-sm font-semibold">Mobiliario y pizarras
      <select aria-label="Seleccionar mesa o silla" value={elegido?.clave ?? ""} disabled={bloqueado}
        onChange={e => seleccionar(e.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2 text-sm font-normal">
        <option value="">Seleccionar objeto</option>
        {objetos.map(o => <option key={o.clave} value={o.clave}>{o.nombre}{posiciones[o.clave]?.oculto ? ' (oculto)' : ''}</option>)}
      </select>
    </label>
    <details className="rounded-lg border border-slate-200 p-2">
      <summary className="cursor-pointer text-sm">Seleccionar varios objetos</summary>
      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {objetos.map(o => <label key={o.clave} className="flex min-h-9 items-center gap-2 text-xs">
          <input type="checkbox" disabled={bloqueado} checked={selecciones.includes(o.clave)} onChange={() => seleccionar(o.clave, true)} />{o.nombre}
        </label>)}
      </div>
    </details>
    {elegidos.length > 0 && <fieldset disabled={bloqueado} className="space-y-3 rounded-lg border border-slate-200 p-3 text-sm">
      <legend className="px-1 font-semibold">{elegidos.length > 1 ? 'Propiedades de la selección' : 'Propiedades del objeto'}</legend>
      <button type="button" onClick={() => cambiar(claves, { oculto: !ocultos })} className="flex items-center gap-2 rounded border border-slate-300 px-2 py-2">
        {ocultos ? <EyeOff size={16} /> : <Eye size={16} />}{ocultos ? 'Mostrar selección' : 'Ocultar selección'}
      </button>
      {!mismoTipo && elegidos.length > 1 && <p role="status" className="text-xs text-amber-800">Selección de tipos distintos: color y tamaño desactivados. Puedes mover, girar u ocultar la selección.</p>}
      {(mismoTipo || elegidos.length > 1) && <fieldset disabled={!mismoTipo} className="space-y-3 disabled:opacity-50" aria-label="Color y tamaño de la selección">
        <label className="flex items-center justify-between gap-2">Color
          <input aria-label="Color del mueble" type="color" value={p?.color ?? mueble?.acabado?.[0] ?? '#adb1b3'}
            onFocus={comenzarGesto} onBlur={cerrarGesto} onChange={e => cambiar(claves, { color: e.target.value })} className="h-10 w-14" />
        </label>
        {(['ancho', 'fondo', 'altura'] as const).map((campo, i) => {
          const o = elegidos[0];
          const valor = p?.[campo] ?? (campo === 'altura' ? mueble?.altura ?? 0 : campo === 'ancho'
            ? Math.max(...o.base.map(p => p[0])) - Math.min(...o.base.map(p => p[0]))
            : Math.max(...o.base.map(p => p[1])) - Math.min(...o.base.map(p => p[1]))) / escala;
          return <label key={campo} className="flex items-center justify-between gap-2">{['Ancho (cm)', 'Fondo (cm)', 'Alto (cm)'][i]}
            <DimensionMueble valor={valor} maximo={campo === 'altura' ? 250 : 400}
              comenzarGesto={comenzarGesto} cerrarGesto={cerrarGesto}
              cambiar={valor => { if (mismoTipo) cambiar(claves, { [campo]: valor }); }} />
          </label>;
        })}
        {elegidos.length > 1 && <p className="text-xs text-slate-600">Se muestra el valor del primer objeto. Cambiar un campo aplica ese valor a toda la selección.</p>}
      </fieldset>}
      <button type="button" onClick={() => eliminar(claves)} className="flex items-center gap-2 rounded bg-red-700 px-3 py-2 font-semibold text-white">
        <Trash2 size={16} />{elegidos.length > 1 ? 'Eliminar selección' : 'Eliminar mueble'}
      </button>
    </fieldset>}
  </div>;
}
