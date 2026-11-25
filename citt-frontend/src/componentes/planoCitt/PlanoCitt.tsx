import { useEffect, useId, useMemo, useRef } from "react";
import { mobiliarioComun, murosCitt, objetosDelPlano, pasoCuadricula, pisoCitt, referenciasCitt, rectangulo, transformarEnPlano } from "./geometriaCitt";
import type { PosicionesPlano } from "./geometriaCitt";
import { Mueble3D, Prisma } from "./escenaCitt";
import { crearCamara, puntos } from "./camaraCitt";
import { estadosPlano } from "./estadosPlano";
import type { EstadoPlano } from "./estadosPlano";

type Props = {
  estados: Record<string, EstadoPlano>;
  nombres?: Record<string, string>;
  seleccion: string | null;
  selecciones?: readonly string[];
  onSeleccion: (clave: string, sumar?: boolean) => void;
  angulo: number;
  inclinacion: number;
  onGirar: (horizontal: number, vertical: number) => void;
  zoom?: number;
  onZoom?: (factor: number) => void;
  ajustarAltura?: boolean;
  posiciones: PosicionesPlano;
  editar: boolean;
  cuadricula?: boolean;
  tamanoCuadricula?: number;
  medioPaso?: boolean;
  onIniciarMovimiento?: (clave: string) => void;
  onFinalizarMovimiento?: (cancelar?: boolean) => void;
  onMover: (clave: string, dx: number, dy: number) => void;
};

export function PlanoCitt({ estados, nombres, seleccion, selecciones, onSeleccion, angulo, inclinacion, onGirar,
  zoom = 1, onZoom, ajustarAltura = false, posiciones, editar, cuadricula = false,
  tamanoCuadricula = pasoCuadricula, medioPaso = false, onIniciarMovimiento, onFinalizarMovimiento, onMover }: Props) {
  const seleccionados = new Set(selecciones ?? (seleccion ? [seleccion] : []));
  const id = useId();
  const clipPiso = `${id}-piso`;
  const sombra = `${id}-sombra`;
  const luz = `${id}-luz`;
  const pisoMadera = `${id}-madera`;
  const camara = useMemo(() => crearCamara(angulo, inclinacion), [angulo, inclinacion]);
  const lienzo = useRef<SVGSVGElement>(null);
  const escena = useRef<SVGGElement>(null);
  const gesto = useRef<{ id: number; x: number; y: number; inicioX: number; inicioY: number; activo: boolean; clave?: string } | null>(null);
  const omitirClick = useRef(false);

  useEffect(() => {
    const svg = lienzo.current;
    if (!svg || !onZoom) return;
    function usarRueda(event: WheelEvent) {
      if (event.ctrlKey || !event.deltaY) return;
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      onZoom?.(Math.exp(-Math.max(-240, Math.min(240, pixels)) * 0.002));
    }
    svg.addEventListener("wheel", usarRueda, { passive: false });
    return () => svg.removeEventListener("wheel", usarRueda);
  }, [onZoom]);

  const objetos = objetosDelPlano(posiciones).filter(objeto => !posiciones[objeto.clave]?.oculto &&
    (!objeto.zonaPadre || !posiciones[objeto.zonaPadre]?.oculto)).map((objeto) => {
    const mover = transformarEnPlano(objeto, posiciones);
    return {
      ...objeto,
      camara: {
        ...camara,
        proyectar: (punto: Parameters<typeof mover>[0], altura?: number) => camara.proyectar(mover(punto), altura),
        profundidad: (base: typeof objeto.base) => camara.profundidad(base.map(mover)),
        profundidadPunto: (punto: Parameters<typeof mover>[0], altura: number) => camara.profundidadPunto(mover(punto), altura),
        caraVisible: (a: Parameters<typeof mover>[0], b: Parameters<typeof mover>[0]) => camara.caraVisible(mover(a), mover(b)),
      },
    };
  }).sort((a, b) => a.camara.profundidad(a.base) - b.camara.profundidad(b.base));
  return (
    <svg ref={lienzo} viewBox="0 0 1070 652" className={`block w-full select-none ${ajustarAltura ? "h-full" : "h-auto"} ${editar ? "touch-none cursor-move" : "cursor-grab active:cursor-grabbing"}`}
      role="group" aria-label="Plano tridimensional del CITT Valparaíso"
      onContextMenu={editar ? (event) => event.preventDefault() : undefined}
      onPointerDown={(event) => {
        omitirClick.current = false;
        const giroDerecho = editar && event.pointerType === "mouse" && event.button === 2;
        if (!giroDerecho && (event.button !== 0 || (!editar && event.pointerType !== "mouse"))) return;
        const clave = editar && !giroDerecho && event.target instanceof Element
          ? event.target.closest("[data-objeto-plano]")?.getAttribute("data-objeto-plano") ?? undefined : undefined;
        if (editar && !giroDerecho && !clave) return;
        if (clave && event.shiftKey) {
          onSeleccion(clave, true);
          omitirClick.current = true;
          return;
        }
        if (clave) onIniciarMovimiento?.(clave);
        gesto.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
          inicioX: event.clientX, inicioY: event.clientY, activo: false, clave };
      }}
      onPointerMove={(event) => {
        const inicio = gesto.current;
        if (!inicio || inicio.id !== event.pointerId) return;
        const dx = event.clientX - (inicio.clave ? inicio.inicioX : inicio.x);
        const dy = event.clientY - (inicio.clave ? inicio.inicioY : inicio.y);
        if (!inicio.activo && Math.hypot(dx, dy) < 5) return;
        omitirClick.current = true;
        if (!inicio.activo) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        gesto.current = { ...inicio, x: event.clientX, y: event.clientY, activo: true };
        if (inicio.clave) {
          const matriz = escena.current?.getScreenCTM();
          const escala = matriz && Math.hypot(matriz.a, matriz.b);
          if (!escala) return;
          const [x, y] = camara.desplazarEnPiso(dx / escala, dy / escala);
          onMover(inicio.clave, x, y);
        } else onGirar(dx * 0.45, -dy * 0.3);
      }}
      onPointerUp={(event) => {
        if (editar && event.button === 2 && !gesto.current?.activo && event.target instanceof Element) {
          const clave = event.target.closest("[data-objeto-plano]")?.getAttribute("data-objeto-plano");
          if (clave && !seleccionados.has(clave)) onSeleccion(clave);
        }
        if (gesto.current?.clave) onFinalizarMovimiento?.();
        gesto.current = null;
      }}
      onPointerCancel={() => { if (gesto.current?.clave) onFinalizarMovimiento?.(true); gesto.current = null; }}
      onLostPointerCapture={() => { if (gesto.current?.clave) onFinalizarMovimiento?.(); gesto.current = null; }}
      onClickCapture={(event) => {
        if (!omitirClick.current) return;
        omitirClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerLeave={() => { if (!gesto.current?.activo) { if (gesto.current?.clave) onFinalizarMovimiento?.(); gesto.current = null; } }}
    >
      <defs>
        <clipPath id={clipPiso}><polygon points={puntos(camara, pisoCitt)} /></clipPath>
        <filter id={sombra} x="-30%" y="-30%" width="170%" height="180%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <radialGradient id={luz} cx="43%" cy="38%" r="69%">
          <stop stopColor="#fdfcf8" />
          <stop offset="1" stopColor="#dce7eb" />
        </radialGradient>
        <linearGradient id={pisoMadera} x2="0.8" y2="1">
          <stop stopColor="#d4bc9e" />
          <stop offset="1" stopColor="#aa8e74" />
        </linearGradient>
      </defs>
      <rect width="1070" height="652" fill={`url(#${luz})`} />
      <g ref={escena} transform={`translate(535 326) scale(${zoom}) translate(-535 -326)`}>
      <polygon points={puntos(camara, pisoCitt, -18)} transform="translate(13 18)" fill="#294254" opacity=".32" filter={`url(#${sombra})`} />
      <Prisma camara={camara} base={pisoCitt} altura={-5} nivel={-21} fondo="#4f6872" canto="#344c58" cantoLateral="#435d69" borde="#46626c" />
      <Prisma camara={camara} base={pisoCitt} altura={0} nivel={-5} fondo={`url(#${pisoMadera})`} canto="#a48164" cantoLateral="#866e59" borde="#927661" />
      <g clipPath={`url(#${clipPiso})`} aria-hidden="true">
        {Array.from({ length: 31 }, (_, fila) =>
          Array.from({ length: 8 }, (_, columna) => (
            <polygon key={`${fila}-${columna}`}
              points={puntos(camara, rectangulo(columna * 135 - (fila * 53) % 135, fila * 16, 135, 16))}
              stroke="#7e634e" strokeWidth=".65" fill={["#d7c2a5", "#a7866a", "#b69a7c", "none"][(columna + fila * 7) % 4]}
              opacity=".44" />
          ))
        )}
      </g>
      <g aria-hidden="true">
        {murosCitt.map((base, index) => (
          <Prisma key={index} camara={camara} base={base} altura={index < 2 ? 43 : 13} fondo="#dbe3e0"
            canto="#83989a" cantoLateral="#617b82" borde="#83989a" />
        ))}
        {referenciasCitt.map(({ nombre, base, altura }) => {
          const entrada = nombre === "Entrada";
          const maker = nombre === "Espacio Maker";
          return (
            <Prisma key={nombre} camara={camara} base={base} altura={altura}
              fondo={entrada ? "#d3dddb" : maker ? "#425e76" : nombre === "Pañol" || nombre === "Coffee" ? "#d6af83" : "#cbbca9"}
              canto="#a69885" cantoLateral="#a09887" borde={maker ? "#46596a" : "#ab9981"} />
          );
        })}
        <Prisma camara={camara} base={rectangulo(368, 0, 35, 37)} altura={43} fondo="#acbbba" canto="#667e83" borde="#6c8285" />
        {[...mobiliarioComun].sort((a, b) => camara.profundidad(a.base) - camara.profundidad(b.base)).map((mueble, indice) => (
          <Mueble3D key={indice} camara={camara} mueble={mueble} />
        ))}
        <Prisma camara={camara} base={rectangulo(290, 465, 187, 8)} altura={34} fondo="#bacdd0" canto="#3d616c" cantoLateral="#4f727b" borde="#6c8589" />
        {referenciasCitt.map(({ nombre, centro, altura }) => {
          const [x, y] = camara.proyectar(centro, nombre === "Pañol" ? 62 : altura + 4);
          const maker = nombre === "Espacio Maker";
          return <text key={nombre} x={x} y={y} textAnchor="middle" dominantBaseline="central"
            fill={maker ? "#f5f8fb" : "#304950"} stroke={maker ? "#425e76" : "#e6ddd0"}
            strokeWidth="2" paintOrder="stroke" fontSize="14" fontWeight="650">{nombre}</text>;
        })}
      </g>
      {objetos.filter(objeto => objeto.marcador).map(zona => {
        const estado = estadosPlano[estados[zona.clave] ?? "sinDatos"];
        return <g key={zona.clave} data-objeto-plano={zona.clave} onClick={() => onSeleccion(zona.clave)}>
          <Prisma camara={zona.camara} base={zona.base} altura={2} fondo={estado.fondo} canto={estado.canto}
            borde={seleccionados.has(zona.clave) ? "#003b73" : estado.canto} />
        </g>;
      })}
      {editar && cuadricula && <g clipPath={`url(#${clipPiso})`} data-cuadricula-plano="true"
        aria-hidden="true" pointerEvents="none" fill="none" stroke="#205e78" strokeWidth="0.8" opacity="0.6">
        {Array.from({ length: Math.floor(786 / tamanoCuadricula) + 1 }, (_, i) =>
          <polyline key={`x-${i}`} points={puntos(camara, [[i * tamanoCuadricula, 0], [i * tamanoCuadricula, 484]], 3)} />)}
        {Array.from({ length: Math.floor(484 / tamanoCuadricula) + 1 }, (_, i) =>
          <polyline key={`y-${i}`} points={puntos(camara, [[0, i * tamanoCuadricula], [786, i * tamanoCuadricula]], 3)} />)}
        {medioPaso && <g data-medio-paso="true" strokeDasharray="2 4" opacity="0.45">
          {Array.from({ length: Math.ceil(786 / tamanoCuadricula) }, (_, i) =>
            <polyline key={`medio-x-${i}`} points={puntos(camara,
              [[(i + 0.5) * tamanoCuadricula, 0], [(i + 0.5) * tamanoCuadricula, 484]], 3)} />)}
          {Array.from({ length: Math.ceil(484 / tamanoCuadricula) }, (_, i) =>
            <polyline key={`medio-y-${i}`} points={puntos(camara,
              [[0, (i + 0.5) * tamanoCuadricula], [786, (i + 0.5) * tamanoCuadricula]], 3)} />)}
        </g>}
      </g>}
      {[...objetos.filter(objeto => objeto.muebles.length > 0), ...objetos.filter(objeto => objeto.muebles.length === 0)].map((zona) => {
        const camara = zona.camara;
        if (!zona.marcador) return (
          <g key={zona.clave} data-objeto-plano={zona.clave}
            role={editar ? "button" : undefined} tabIndex={editar ? 0 : undefined}
            aria-label={zona.nombre} aria-pressed={editar ? seleccionados.has(zona.clave) : undefined}
            onClick={event => {
              if (editar) onSeleccion(zona.clave, event.shiftKey);
              else if (zona.zonaPadre) onSeleccion(zona.zonaPadre);
            }}
            onKeyDown={editar ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSeleccion(zona.clave, event.shiftKey);
              }
            } : undefined}>
            <title>{zona.nombre}</title>
            {zona.muebles.map((mueble, indice) => <Mueble3D key={indice} camara={camara} mueble={mueble} />)}
            {editar && (!zona.zonaPadre || seleccionados.has(zona.clave)) &&
              <polygon data-contorno-objeto={zona.clave} points={puntos(camara, zona.base,
                Math.max(...zona.muebles.map(m => m.altura + (m.tipo === "asiento" ? 9 : 0))) + 1)}
                pointerEvents="none" fill="none" stroke={seleccionados.has(zona.clave) ? "#003b73" : "#64748b"} strokeWidth="3" />}
          </g>
        );
        const estado = estadosPlano[estados[zona.clave] ?? "sinDatos"];
        const nombre = nombres?.[zona.clave] ?? zona.nombre;
        const activo = seleccionados.has(zona.clave);
        const alturaMarcador = zona.alturaMarcador ?? 50;
        const [x, y] = camara.proyectar(zona.marcador, alturaMarcador);
        const [pieX, pieY] = camara.proyectar(zona.marcador, alturaMarcador - 28);
        return (
          <g
            key={zona.clave}
            data-objeto-plano={zona.clave}
            role="button"
            tabIndex={0}
            aria-label={`${nombre}, ${estado.texto}`}
            aria-pressed={activo}
            className={`${editar ? "cursor-move" : "cursor-pointer"} outline-none focus-visible:[&>circle:last-of-type]:stroke-[#003b73] focus-visible:[&>circle:last-of-type]:stroke-[4]`}
            onClick={event => onSeleccion(zona.clave, event.shiftKey)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSeleccion(zona.clave, event.shiftKey);
              }
            }}
          >
            <title>{nombre} · {estado.texto}</title>
            {[...zona.muebles].sort((a, b) => camara.profundidad(a.base) - camara.profundidad(b.base)).map((mueble, indice) => (
              <Mueble3D key={indice} camara={camara} mueble={mueble} />
            ))}
            <line x1={x} y1={y} x2={pieX} y2={pieY} stroke={estado.color} strokeWidth="2.5" />
            {activo && <circle cx={x} cy={y} r="24" fill="none" stroke="#003b73" strokeWidth="2" />}
            <circle cx={x} cy={y} r={activo ? 20 : 17} fill={estado.color} stroke="#fff" strokeWidth="2.5" />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="white"
              fontSize="14" fontWeight="750" pointerEvents="none">{zona.clave}</text>
          </g>
        );
      })}
      </g>
    </svg>
  );
}
