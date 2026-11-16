export const rolesGestionCitt = ["COORDINADOR", "DIRECTOR", "ADMINISTRATIVO"];
export const rolesPersonalCitt = ["AYUDANTE", "DOCENTE", ...rolesGestionCitt];

const nombres: Record<string, string> = {
  ALUMNO: "Alumno",
  DOCENTE: "Docente",
  AYUDANTE: "Ayudante",
  COORDINADOR: "Coordinador",
  DIRECTOR: "Director",
  ADMINISTRATIVO: "Administrativo",
};

export const nombreRol = (rol: string) => nombres[rol] ?? rol;
