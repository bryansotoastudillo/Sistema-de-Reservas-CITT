export type Punto = readonly [number, number];

export type PosicionPlano = { x: number; y: number; giro?: number | null };
export type PosicionesPlano = Record<string, PosicionPlano>;

export function transformarObjeto(base: Punto[], { x, y, giro }: PosicionPlano) {
  const cx = base.reduce((suma, punto) => suma + punto[0], 0) / base.length;
  const cy = base.reduce((suma, punto) => suma + punto[1], 0) / base.length;
  const radianes = (giro ?? 0) * Math.PI / 180;
  const coseno = Math.cos(radianes);
  const seno = Math.sin(radianes);
  return ([px, py]: Punto): Punto => [
    cx + x + (px - cx) * coseno - (py - cy) * seno,
    cy + y + (px - cx) * seno + (py - cy) * coseno,
  ];
}

export function rectangulo(x: number, y: number, ancho: number, fondo: number): Punto[] {
  return [[x, y], [x + ancho, y], [x + ancho, y + fondo], [x, y + fondo]];
}

export type Acabado = readonly [superficie: string, frente: string, lateral: string, borde: string];

export type Mueble = {
  base: Punto[];
  altura: number;
  tipo?: "mesa" | "asiento";
  monitor?: boolean;
  nivel?: number;
  acabado?: Acabado;
  opacidad?: number;
  patas?: string;
};

type Zona = {
  clave: string;
  nombre: string;
  alias?: string;
  otrosNombres?: readonly string[];
  base: Punto[];
  marcador: Punto;
  alturaMarcador?: number;
  muebles: Mueble[];
};

const madera: Acabado = ["#deb588", "#9f7047", "#b5875c", "#997651"];
const tapiz: Acabado = ["#c4c0b9", "#96938f", "#aaa6a0", "#8b8882"];
const panel: Acabado = ["#d4d0c8", "#a9a69f", "#b5b1aa", "#93908a"];
const marco: Acabado = ["#43505a", "#172129", "#293841", "#1c2a33"];
const vidrio: Acabado = ["#c4e8e8", "#a1d2d4", "#afd9dc", "#8db8c0"];
const blanco: Acabado = ["#f7f5ee", "#bfc2bd", "#d2d3c9", "#aeb4ae"];
const naranja: Acabado = ["#ef9347", "#be571d", "#dc6d28", "#a9532c"];
const azul: Acabado = ["#4d81b4", "#325877", "#39678e", "#31536e"];

function pieza(base: Punto[], altura: number, acabado: Acabado, nivel = 2, opacidad?: number): Mueble {
  return { base, altura, nivel, acabado, opacidad };
}

const mesa = (x: number, y: number, ancho: number, fondo: number, monitor = false): Mueble => ({
  base: rectangulo(x, y, ancho, fondo), altura: 26, tipo: "mesa", monitor,
  acabado: blanco, patas: "#dce0dc",
});

const asiento = (x: number, y: number, ancho = 17, fondo = 17, acabado: Acabado = azul): Mueble => ({
  base: rectangulo(x, y, ancho, fondo), altura: 14, tipo: "asiento",
  acabado, patas: "#d2d4cf",
});

function cubiculo(numero: number, x: number, y: number, haciaElNorte = false): Zona {
  const baseLocal = (u: number, v: number, ancho: number, fondo: number) => (
    rectangulo(u, v, ancho, fondo).map(([px, py]): Punto =>
      haciaElNorte ? [x + 52 - px, y + 58 - py] : [x + px, y + py])
  );
  return {
    clave: String(numero),
    nombre: `Cubículo ${numero}`,
    base: rectangulo(x - 3, y - 2, 58, 69),
    marcador: [x + 27, y + 30],
    alturaMarcador: 72,
    muebles: [
      ...[3, 47].flatMap((u) => [5, 48].map((v) => pieza(baseLocal(u, v, 3, 3), 11, marco))),
      pieza(baseLocal(0, 0, 52, 5), 57, panel, 10),
      pieza(baseLocal(0, 5, 5, 51), 57, panel, 10),
      pieza(baseLocal(47, 5, 5, 51), 57, panel, 10),
      pieza(baseLocal(22, 8, 25, 12), 37, tapiz, 15),
      pieza(baseLocal(22, 19, 25, 34), 23, tapiz, 12),
      pieza(baseLocal(5, 8, 17, 44), 14, madera, 11),
      pieza(baseLocal(5, 8, 2, 44), 26, madera, 14),
      pieza(baseLocal(20, 8, 2, 44), 26, madera, 14),
      pieza(baseLocal(5, 8, 17, 44), 29, madera, 26),
      pieza(baseLocal(12, 24, 3, 3), 35, marco, 29),
      pieza(baseLocal(7, 16, 16, 22), 37, madera, 35),
      pieza(baseLocal(11, 9, 2, 2), 48, marco, 28),
      pieza(baseLocal(8, 7, 8, 6), 50, marco, 47),
    ],
  };
}

const pisoCabina: Punto[] = [[10, 443], [46, 395], [96, 431], [59, 479]];

function baseCabina(x: number, y: number, ancho: number, fondo: number) {
  return rectangulo(x, y, ancho, fondo).map(([u, v]): Punto => [46 + 50 * u - 36 * v, 395 + 36 * u + 48 * v]);
}

const bordesCabina = [
  baseCabina(0, 0, 1, .07), baseCabina(0, .93, 1, .07),
  baseCabina(0, .07, .07, .86), baseCabina(.93, .07, .07, .86),
];

// Coordenadas trazadas sobre la planta arquitectónica CITT, noviembre de 2023.
export const zonasCitt: Zona[] = [
  cubiculo(1, 39, 4),
  cubiculo(2, 128, 4),
  cubiculo(3, 216, 4),
  cubiculo(4, 128, 417, true),
  cubiculo(5, 217, 417, true),
  {
    clave: "CI", nombre: "Cabina Individual", alias: "Cabina",
    base: pisoCabina,
    marcador: [53, 437],
    alturaMarcador: 100,
    muebles: [
      pieza(pisoCabina, 8, marco, 2),
      pieza(baseCabina(.07, .07, .86, .86), 9, ["#7c8a89", "#647779", "#596b70", "#6e7d7e"], 8),
      pieza(baseCabina(0, .07, .05, .86), 83, vidrio, 8, .57),
      pieza(baseCabina(.05, 0, .9, .05), 83, vidrio, 8, .7),
      pieza(baseCabina(.09, .24, .24, .42), 42, blanco, 39),
      ...[.55, .78].flatMap((u) => [.54, .76].map((v) => pieza(baseCabina(u, v, .045, .045), 35, madera, 9))),
      pieza(baseCabina(.52, .52, .34, .32), 38, panel, 35),
      pieza(baseCabina(.79, .52, .07, .32), 53, panel, 38),
      ...[0, .93].flatMap((u) => [0, .93].map((v) => pieza(baseCabina(u, v, .07, .07), 89, marco, 8))),
      ...bordesCabina.map((base) => pieza(base, 89, marco, 83)),
      pieza(baseCabina(.95, .07, .03, .86), 82, vidrio, 8, .37),
      pieza(baseCabina(.07, .95, .86, .03), 82, vidrio, 8, .27),
      pieza(baseCabina(.81, .96, .045, .045), 55, marco, 36),
    ],
  },
  {
    clave: "ST", nombre: "Sala Streaming",
    base: [[520, 0], [734, 0], [734, 34], [632, 111], [620, 118], [610, 115]],
    marcador: [633, 59],
    alturaMarcador: 82,
    muebles: [
      mesa(572, 24, 22, 35, true), asiento(628, 34, 28, 25, tapiz),
      pieza([[521, 1], [527, 1], [624, 113], [618, 117]], 73, madera),
      ...Array.from({ length: 17 }, (_, i) => {
        const x = 525 + i * 5.5;
        const y = i * 6.45;
        return pieza([[x, y], [x + 1.5, y], [x + 5.5, y + 5.2], [x + 4, y + 5.2]], 73,
          ["#906044", "#7c5037", "#805237", "#906044"]);
      }),
      pieza([[571, 52], [578, 60], [581, 57], [574, 49]], 67, ["#d73438", "#aa1726", "#991627", "#8b2330"], 59),
      pieza([[621, 113], [732, 29], [735, 34], [623, 118]], 32,
        ["#89a570", "#496b49", "#5d814f", "#4b6c49"]),
    ],
  },
  {
    clave: "MR", nombre: "Mesa de Reunión", alias: "Sala Reuniones",
    otrosNombres: ["Sala Reunión", "Sala de Reunión", "Sala de Reuniones", "Mesa Reunión", "Mesa Reuniones"],
    base: rectangulo(22, 179, 100, 137),
    marcador: [73, 245],
    muebles: [
      ...[192, 232, 272].flatMap((y) => [asiento(30, y, 19, 30, tapiz), asiento(96, y, 18, 30, tapiz)]),
      { ...mesa(49, 188, 49, 122), acabado: madera, patas: "#d5a322" },
    ],
  },
  {
    clave: "CW", nombre: "Área Cowork", alias: "Espacio Cowork",
    base: [[205, 85], [495, 85], [495, 159], [482, 159], [482, 296], [205, 296]],
    marcador: [356, 163],
    muebles: [
      ...[315, 345, 375, 405, 435, 465].flatMap((x, i) =>
        [asiento(x, 90, 17, 17, i % 2 === 0 ? naranja : azul), asiento(x, 142, 17, 17, i % 2 === 0 ? azul : naranja)]),
      mesa(307, 110, 184, 31),
      mesa(214, 182, 91, 31), mesa(244, 209, 32, 65), mesa(275, 244, 61, 31),
      asiento(231, 164), asiento(309, 212), asiento(287, 272),
      mesa(368, 205, 92, 31), mesa(399, 236, 32, 60),
      asiento(388, 187), asiento(461, 227), asiento(379, 253),
    ],
  },
];

export const pisoCitt: Punto[] = [
  [0, 0], [767, 0], [767, 39], [786, 39], [786, 139], [767, 139], [767, 484], [0, 484],
];

export const pizarrasCitt: (Omit<Zona, "marcador"> & { marcador?: never })[] = [185, 227, 269].map((y, i) => ({
  clave: `P${i + 1}`,
  nombre: `Pizarra ${i + 1}`,
  base: rectangulo(159, y, 6, 38),
  muebles: [
    pieza(rectangulo(150, y + 3, 24, 4), 6, marco),
    pieza(rectangulo(150, y + 31, 24, 4), 6, marco),
    pieza(rectangulo(159, y, 6, 38), 57, blanco, 5),
  ],
}));

export const murosCitt: Punto[][] = [
  rectangulo(-17, -8, 787, 8),
  rectangulo(-17, -8, 17, 500),
  rectangulo(734, 0, 33, 37),
  rectangulo(765, 139, 8, 351),
  rectangulo(-5, 484, 778, 8),
  [[734, 139], [743, 139], [632, 231], [632, 484], [624, 484], [624, 225]],
];

export const referenciasCitt = [
  { nombre: "Pañol", base: rectangulo(266, 0, 98, 39), centro: [315, 20] as Punto, altura: 18 },
  { nombre: "Coffee", base: rectangulo(407, 0, 60, 39), centro: [437, 20] as Punto, altura: 18 },
  { nombre: "Ring de ideas", base: rectangulo(286, 370, 196, 106), centro: [384, 423] as Punto, altura: 12 },
  { nombre: "Área de estar", base: [[489, 365], [529, 324], [572, 284], [625, 333], [625, 484], [489, 484]] as Punto[], centro: [548, 460] as Punto, altura: 2 },
  { nombre: "Espacio Maker", base: [[632, 231], [744, 140], [765, 140], [765, 483], [632, 483]] as Punto[], centro: [708, 365] as Punto, altura: 2 },
  { nombre: "Entrada", base: [[734, 42], [785, 42], [785, 138], [735, 138], [678, 111]] as Punto[], centro: [757, 100] as Punto, altura: 2 },
];

const moduloSofa = (x: number, y: number, ancho: number, fondo: number) =>
  rectangulo(x, y, ancho, fondo).map(([u, v]): Punto =>
    [621 - v, 344 + u]);

const largoSofa = 137;
const anchoCojinSofa = 22.5;

export const mobiliarioComun: Mueble[] = [
  // Respaldo junto al límite con el Maker, con los cojines mirando al Ring de ideas.
  pieza(moduloSofa(0, 0, largoSofa, 27), 12, naranja, 4),
  pieza(moduloSofa(0, 0, largoSofa, 6), 32, naranja, 12),
  ...Array.from({ length: 6 }, (_, i) =>
    pieza(moduloSofa(1 + i * anchoCojinSofa, 6, anchoCojinSofa - 1, 20), 17, naranja, 12)),
  pieza(rectangulo(563, 402, 24, 17), 14, blanco),
  pieza(rectangulo(636, 253, 19, 130), 26, blanco),
  pieza(rectangulo(638, 272, 15, 20), 42, marco, 26),
  pieza(rectangulo(638, 329, 15, 25), 47, marco, 26),
  // Marco amarillo del pañol y módulos con bandejas.
  pieza(rectangulo(265, 34, 4, 5), 57, ["#f7d545", "#bc9217", "#ddaa1c", "#b28e22"]),
  pieza(rectangulo(360, 34, 4, 5), 57, ["#f7d545", "#bc9217", "#ddaa1c", "#b28e22"]),
  pieza(rectangulo(265, 34, 99, 5), 57, ["#f7d545", "#bc9217", "#ddaa1c", "#b28e22"], 53),
  ...[276, 300, 324, 348].map((x) =>
    pieza(rectangulo(x, 24, 12, 11), 27, ["#eaca41", "#b28f15", "#c6a01e", "#ad8b23"], 18)),
];
