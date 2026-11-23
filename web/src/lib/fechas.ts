// Fechas y horas del estudio, siempre en hora de Argentina.
// Argentina no usa horario de verano desde 2009: siempre UTC-3.
// firestore.rules usa el mismo desfasaje para saber cuándo empieza una clase.

export const ZONA_ESTUDIO = "America/Buenos_Aires";
const OFFSET_ARGENTINA_HORAS = 3;

const fmtFecha = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_ESTUDIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha YYYY-MM-DD de un instante, en hora de Argentina. */
export const fechaArgentina = (date: Date = new Date()) => fmtFecha.format(date);

/** YYYY-MM-DD de una fecha de calendario (año, mes 0-11, día), sin pasar por UTC. */
export const fechaStr = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Milisegundos epoch del inicio de la clase (fecha YYYY-MM-DD, hora HH:MM, hora de Argentina). */
export function inicioClaseMs(fecha: string, hora: string) {
  const [y, m, d] = fecha.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  return Date.UTC(y, m - 1, d, h + OFFSET_ARGENTINA_HORAS, min || 0);
}

export const claseYaEmpezo = (fecha: string, hora: string, ahora = Date.now()) =>
  ahora >= inicioClaseMs(fecha, hora);

export const turnoIdDe = (disciplinaId: string, fecha: string, hora: string) =>
  `${disciplinaId}_${fecha}_${hora.replace(":", "")}`;

export const reservaIdDe = (turnoId: string, uid: string) => `${turnoId}_${uid}`;
