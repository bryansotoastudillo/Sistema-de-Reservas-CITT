import { useId, useMemo, useRef } from "react";
import { mobiliarioComun, murosCitt, pisoCitt, pizarrasCitt, referenciasCitt, rectangulo, transformarObjeto, zonasCitt } from "./geometriaCitt";
import type { PosicionesPlano } from "./geometriaCitt";
import { Mueble3D, Prisma } from "./escenaCitt";
import { crearCamara, puntos } from "./camaraCitt";
import { estadosPlano } from "./estadosPlano";
import type { EstadoPlano } from "./estadosPlano";

type Props = {
  estados: Record<string, EstadoPlano>;
  seleccion: string | null;
  onSeleccion: (clave: string) => void;
  angulo: number;
  inclinacion: number;
  onGirar: (horizontal: number, vertical: number) => void;
  posiciones: PosicionesPlano;
  editar: boolean;
  onMover: (clave: string, dx: number, dy: number) => void;
};

export function PlanoCitt({ estados, seleccion, onSeleccion, angulo, inclinacion, onGirar, posiciones, editar, onMover }: Props) {
  const id = useId();
  const clipPiso = `${id}-piso`;
  const sombra = `${id}-sombra`;
  const luz = `${id}-luz`;
  const pisoMadera = `${id}-madera`;
  const camara = useMemo(() => crearCamara(angulo, inclinacion), [angulo, inclinacion]);
  const gesto = useRef<{ id: number; x: number; y: number; activo: boolean; clave?: string } | null>(null);
  const objetos = [...zonasCitt, ...pizarrasCitt].map((objeto) => {
    const mover = transformarObjeto(objeto.base, posiciones[objeto.clave] ?? { x: 0, y: 0 });
    return {
      ...objeto,
      camara: {
        ...camara,
        proyectar: (punto: Parameters<typeof mover>[0], altura?: number) => camara.proyectar(mover(punto), altura),
        profundidad: (base: typeof objeto.base) => camara.profundidad(base.map(mover)),
        caraVisible: (a: Parameters<typeof mover>[0], b: Parameters<typeof mover>[0]) => camara.caraVisible(mover(a), mover(b)),
      },
    };
  }).sort((a, b) => a.camara.profundidad(a.base) - b.camara.profundidad(b.base));
  return (
    <svg viewBox="0 0 1070 652" className={`block h-auto w-full select-none ${editar ? "touch-none cursor-move" : "cursor-grab active:cursor-grabbing"}`}
      role="group" aria-label="Plano tridimensional del CITT Valparaíso"
      onPointerDown={(event) => {
        if ((!editar && event.pointerType !== "mouse") || event.button !== 0) return;
        const clave = editar && event.target instanceof Element
          ? event.target.closest("[data-objeto-plano]")?.getAttribute("data-objeto-plano") ?? undefined : undefined;
        if (editar && !clave) return;
        gesto.current = { id: event.pointerId, x: event.clientX, y: event.clientY, activo: false, clave };
      }}
      onPointerMove={(event) => {
        const inicio = gesto.current;
        if (!inicio || inicio.id !== event.pointerId) return;
        const dx = event.clientX - inicio.x;
        const dy = event.clientY - inicio.y;
        if (!inicio.activo && Math.hypot(dx, dy) < 5) return;
        if (!inicio.activo) {
          event.currentTarget.setPointerCapture(event.pointerId);
          if (inicio.clave) onSeleccion(inicio.clave);
        }
        gesto.current = { ...inicio, x: event.clientX, y: event.clientY, activo: true };
        if (inicio.clave) {
          const factor = 1070 / event.currentTarget.getBoundingClientRect().width;
          const [x, y] = camara.desplazarEnPiso(dx * factor, dy * factor);
          onMover(inicio.clave, x, y);
        } else onGirar(dx * 0.45, -dy * 0.3);
      }}
      onPointerUp={() => { gesto.current = null; }}
      onPointerCancel={() => { gesto.current = null; }}
      onPointerLeave={() => { if (!gesto.current?.activo) gesto.current = null; }}
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
      {objetos.map((zona) => {
        const camara = zona.camara;
        if (!zona.marcador) return (
          <g key={zona.clave} data-objeto-plano={zona.clave}
            role={editar ? "button" : undefined} tabIndex={editar ? 0 : undefined}
            aria-label={zona.nombre} aria-pressed={editar ? zona.clave === seleccion : undefined}
            onClick={editar ? () => onSeleccion(zona.clave) : undefined}
            onKeyDown={editar ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSeleccion(zona.clave);
              }
            } : undefined}>
            <title>{zona.nombre}</title>
            {zona.muebles.map((mueble, indice) => <Mueble3D key={indice} camara={camara} mueble={mueble} />)}
            {editar && <polygon points={puntos(camara, zona.base, 57)}
              fill="none" stroke={zona.clave === seleccion ? "#003b73" : "#64748b"} strokeWidth="3" />}
          </g>
        );
        const estado = estadosPlano[estados[zona.clave] ?? "sinDatos"];
        const activo = zona.clave === seleccion;
        const alturaMarcador = zona.alturaMarcador ?? 50;
        const [x, y] = camara.proyectar(zona.marcador, alturaMarcador);
        const [pieX, pieY] = camara.proyectar(zona.marcador, alturaMarcador - 28);
        return (
          <g
            key={zona.clave}
            data-objeto-plano={zona.clave}
            role="button"
            tabIndex={0}
            aria-label={`${zona.nombre}, ${estado.texto}`}
            aria-pressed={activo}
            className={`${editar ? "cursor-move" : "cursor-pointer"} outline-none focus-visible:[&>circle:last-of-type]:stroke-[#003b73] focus-visible:[&>circle:last-of-type]:stroke-[4]`}
            onClick={() => onSeleccion(zona.clave)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSeleccion(zona.clave);
              }
            }}
          >
            <title>{zona.nombre} · {estado.texto}</title>
            <Prisma camara={camara} base={zona.base} altura={2} fondo={estado.fondo} canto={estado.canto} borde={activo ? "#003b73" : estado.canto} />
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
    </svg>
  );
}
