export const estadosPlano = {
  libre: { texto: "Libre", color: "#087451", fondo: "#bee6d2", canto: "#83bca4" },
  ocupado: { texto: "Ocupado", color: "#a7283d", fondo: "#f4c9cd", canto: "#d68d9b" },
  fuera: { texto: "Fuera de servicio", color: "#865100", fondo: "#f6dfa9", canto: "#c6a565" },
  sinDatos: { texto: "Sin datos", color: "#4f647b", fondo: "#dce4e7", canto: "#a7b9c1" },
};

export type EstadoPlano = keyof typeof estadosPlano;
