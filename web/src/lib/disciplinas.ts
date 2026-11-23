export const DISCIPLINAS = [
  {
    id: "reformer",
    nombre: "Pilates Reformer",
    descripcion: "Trabajo integral con máquinas para mejorar postura y fuerza.",
  },
  {
    id: "hiit",
    nombre: "Hiit Barre",
    descripcion: "Clases intensas enfocadas en el control del core y respiración.",
  },
  {
    id: "yoga",
    nombre: "Yoga",
    descripcion: "Fusión de flexibilidad y equilibrio para el bienestar total.",
  },
] as const;

export type DisciplinaId = (typeof DISCIPLINAS)[number]["id"];

export const esDisciplinaId = (valor: unknown): valor is DisciplinaId =>
  DISCIPLINAS.some((d) => d.id === valor);
