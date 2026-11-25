import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import api from "../../api/axiosConfig";
import { PlanoCitt } from "./PlanoCitt";
import type { PosicionesPlano } from "./geometriaCitt";

type Tarjeta = { id: string; nombre: string; miniatura: string | null };
type Diseno = { id: string; nombre: string; posiciones: PosicionesPlano };

async function capturarDiseno(posiciones: PosicionesPlano) {
  const contenedor = document.createElement("div");
  contenedor.style.cssText="position:fixed;left:-20000px;top:0;width:1070px;height:652px;pointer-events:none";
  document.body.append(contenedor);
  const root=createRoot(contenedor);
  let url="";
  try {
    flushSync(()=>root.render(<PlanoCitt estados={{}} seleccion={null} onSeleccion={()=>{}} angulo={25} inclinacion={44}
      onGirar={()=>{}} posiciones={posiciones} editar={false} onMover={()=>{}}/>));
    const svg=contenedor.querySelector("svg")!;
    svg.setAttribute("xmlns","http://www.w3.org/2000/svg");svg.setAttribute("width","1070");svg.setAttribute("height","652");
    url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:"image/svg+xml;charset=utf-8"}));
    const img=new Image();img.src=url;await img.decode();
    const canvas=document.createElement("canvas");canvas.width=400;canvas.height=244;
    canvas.getContext("2d")!.drawImage(img,0,0,400,244);
    return canvas.toDataURL("image/png");
  } finally { if(url)URL.revokeObjectURL(url);root.unmount();contenedor.remove(); }
}

export function DisenosPlano({ posiciones, cargar, cerrar }: {
  posiciones: PosicionesPlano; cargar: (p: PosicionesPlano) => void; cerrar: () => void;
}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [tarjetas,setTarjetas]=useState<Tarjeta[]>([]);
  const [nombre,setNombre]=useState("");
  const [ocupado,setOcupado]=useState(false);
  const [error,setError]=useState("");
  const [confirmar,setConfirmar]=useState<Diseno|null>(null);
  const [borrar,setBorrar]=useState<Tarjeta|null>(null);
  const [limpiar,setLimpiar]=useState(false);
  const ocultos=Object.entries(posiciones).filter(([k,p])=>k.startsWith("extra-")&&p.oculto).length;
  const listar=useCallback(async()=>{const {data}=await api.get<Tarjeta[]>("/plano-citt/disenos");setTarjetas(data);return data;},[]);
  useEffect(()=>{
    dialog.current?.showModal();
    let activo=true;
    (async()=>{
      try {
        const {data}=await api.get<Tarjeta[]>("/plano-citt/disenos");if(!activo)return;setTarjetas(data);
        const pred=data.find(t=>t.id==="predeterminado"&&!t.miniatura);
        if(pred){const {data:d}=await api.get<Diseno>("/plano-citt/disenos/predeterminado");
          const miniatura=await capturarDiseno(d.posiciones);if(!activo)return;
          await api.patch("/plano-citt/disenos/predeterminado/portada",{miniatura});if(activo)await listar();}
      }catch{if(activo)setError("No se pudieron cargar los diseños. Cierra y vuelve a intentar.");}
    })();
    return ()=>{activo=false;};
  },[listar]);
  async function guardar(event: React.FormEvent) {
    event.preventDefault();setOcupado(true);setError("");
    try {const miniatura=await capturarDiseno(posiciones);await api.post("/plano-citt/disenos",{nombre:nombre.trim(),posiciones,miniatura});setNombre("");await listar();}
    catch(e){setError(mensaje(e,"No se pudo guardar el diseño."));}finally{setOcupado(false);}
  }
  async function elegir(id:string) {
    setOcupado(true);setError("");try{const {data}=await api.get<Diseno>(`/plano-citt/disenos/${id}`);setConfirmar(data);}
    catch{setError("No se pudo cargar el diseño.");}finally{setOcupado(false);}
  }
  async function eliminar() {
    if(!borrar)return;setOcupado(true);setError("");
    try{await api.delete(`/plano-citt/disenos/${borrar.id}`);setBorrar(null);await listar();}
    catch{setError("No se pudo eliminar el diseño.");}finally{setOcupado(false);}
  }
  return <dialog ref={dialog} aria-label="Diseños del plano" onCancel={event=>{event.preventDefault();if(!ocupado)cerrar();}}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[min(94vw,56rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl backdrop:bg-black/50">
    <header className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Diseños del plano</h2>
      <button type="button" disabled={ocupado} onClick={cerrar} className="rounded border px-3 py-2">Cerrar diseños</button></header>
    <p className="mb-4 text-sm text-slate-600">Carga un diseño para revisarlo en edición. Se publicará al pulsar Guardar plano. Puedes deshacer la carga.</p>
    {error&&<p role="alert" className="mb-3 rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {confirmar&&<div role="group" aria-label="Confirmar carga" className="mb-4 rounded border border-amber-300 p-3">
      <p>¿Cargar «{confirmar.nombre}»? Reemplazará todos los muebles y propiedades del borrador, incluidos los ocultos que no pertenezcan a este diseño.</p>
      <button type="button" onClick={()=>{cargar(confirmar.posiciones);cerrar();}} className="mr-2 mt-2 rounded bg-blue-900 px-3 py-2 text-white">Cargar diseño</button>
      <button type="button" onClick={()=>setConfirmar(null)} className="rounded border px-3 py-2">Volver</button>
    </div>}
    {borrar&&<div className="mb-4 rounded border border-red-300 p-3"><p>¿Eliminar el diseño «{borrar.nombre}» de la biblioteca?</p>
      <button type="button" disabled={ocupado} onClick={eliminar} className="mr-2 mt-2 rounded bg-red-700 px-3 py-2 text-white">Confirmar eliminación</button>
      <button type="button" disabled={ocupado} onClick={()=>setBorrar(null)} className="rounded border px-3 py-2">Conservar diseño</button></div>}
    <div className="mb-4 rounded border border-slate-200 p-3 text-sm">
      <button type="button" disabled={ocupado||ocultos===0} onClick={()=>setLimpiar(true)} className="rounded border px-3 py-2 disabled:opacity-40">Limpiar muebles adicionales ocultos ({ocultos})</button>
      {limpiar&&<div className="mt-2"><p>¿Quitar del borrador los {ocultos} muebles adicionales ocultos? Puedes deshacerlo. La visibilidad de los muebles originales se conservará.</p>
        <button type="button" onClick={()=>{cargar(Object.fromEntries(Object.entries(posiciones).filter(([k,p])=>!k.startsWith("extra-")||!p.oculto)));cerrar();}}
          className="mt-2 rounded bg-red-700 px-3 py-2 text-white">Confirmar limpieza</button></div>}
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tarjetas.map(t=><article key={t.id} className="overflow-hidden rounded-lg border border-slate-200">
        <button type="button" disabled={ocupado} onClick={()=>elegir(t.id)} aria-label={`Cargar ${t.nombre}`} className="w-full text-left">
          {t.miniatura?<img loading="lazy" width={400} height={244} alt={`Vista de ${t.nombre}`} src={`${api.defaults.baseURL?.replace(/\/$/,"")??"/api"}${t.miniatura}`} className="aspect-[400/244] w-full object-cover"/>
            :<div className="grid aspect-[400/244] place-items-center bg-slate-100 text-sm">Preparando portada…</div>}
          <p className="break-words p-3 font-semibold">{t.nombre}</p></button>
        {t.id!=="predeterminado"&&<button type="button" disabled={ocupado} onClick={()=>setBorrar(t)} className="m-3 mt-0 rounded border border-red-300 px-3 py-2 text-sm text-red-700">Eliminar diseño</button>}
      </article>)}
      <form onSubmit={guardar} className="space-y-3 rounded-lg border-2 border-dashed border-slate-300 p-4">
        <h3 className="font-semibold">Guardar diseño actual</h3>
        <p className="text-sm text-slate-600">Conserva el borrador completo con posiciones, colores, tamaños y visibilidad.</p>
        <label className="block text-sm">Nombre del diseño<input required maxLength={80} value={nombre} onChange={e=>setNombre(e.target.value)} disabled={ocupado} className="mt-1 w-full rounded border p-2"/></label>
        <button disabled={ocupado||!nombre.trim()} className="rounded bg-blue-900 px-3 py-2 text-white disabled:opacity-50">{ocupado?"Procesando…":"Guardar en biblioteca"}</button>
      </form>
    </div>
  </dialog>;
}

function mensaje(error:unknown,defecto:string) {
  if(error&&typeof error==="object"&&"response" in error){const r=error as {response?:{data?:{mensaje?:string}}};return r.response?.data?.mensaje??defecto;}
  return defecto;
}
