// Lógica compartida de turnos, reservas y créditos.
//
// Modelo:
// - turnos/{disciplinaId}_{fecha}_{HHMM}: { disciplinaId, fecha, hora, ocupados }
//   Es el contador de cupo de cada clase. Lo validan las reglas de Firestore.
// - reservas/{turnoId}_{uid}: el ID es fijo por alumno y clase, así que un alumno
//   no puede reservar dos veces la misma clase.
//
// Reservar y cancelar se hacen en una transacción que toca reserva, turno y
// créditos juntos. Si dos alumnos van por el último cupo a la vez, Firestore
// reintenta la transacción del segundo, que ve la clase llena y se rechaza.
// Las reglas (firestore.rules) exigen lo mismo, así que no se puede saltear
// desde la consola del navegador.
import {
    doc, collection, getDocs, runTransaction, writeBatch, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const ZONA_ESTUDIO = 'America/Buenos_Aires';
// Argentina no usa horario de verano desde 2009: siempre UTC-3.
// firestore.rules usa el mismo desfasaje para saber cuándo empieza una clase.
const OFFSET_ARGENTINA_HORAS = 3;
export const VACANTES_POR_DEFECTO = 5;

const fmtFecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_ESTUDIO, year: 'numeric', month: '2-digit', day: '2-digit'
});

/** Fecha YYYY-MM-DD de un instante, en hora de Argentina. */
export const fechaArgentina = (date = new Date()) => fmtFecha.format(date);

/** YYYY-MM-DD de una fecha "de calendario" (año, mes 0-11, día), sin pasar por UTC. */
export const fechaStr = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Milisegundos epoch del inicio de la clase (fecha YYYY-MM-DD, hora HH:MM, hora de Argentina). */
export function inicioClaseMs(fecha, hora) {
    const [y, m, d] = fecha.split('-').map(Number);
    const [h, min] = hora.split(':').map(Number);
    return Date.UTC(y, m - 1, d, h + OFFSET_ARGENTINA_HORAS, min || 0);
}

export const claseYaEmpezo = (fecha, hora, ahora = Date.now()) => ahora >= inicioClaseMs(fecha, hora);

export const turnoIdDe = (disciplinaId, fecha, hora) => `${disciplinaId}_${fecha}_${hora.replace(':', '')}`;
export const reservaIdDe = (turnoId, uid) => `${turnoId}_${uid}`;

/** Error con mensaje para mostrar al alumno. */
export class ReservaError extends Error {}

// Si otro alumno escribió el mismo turno justo antes, las reglas rechazan la
// escritura (el contador ya no es "anterior + 1"). Se reintenta con datos
// frescos: o entra, o ve la clase llena y avisa.
async function conReintento(fn, intentos = 3) {
    for (let i = 1; ; i++) {
        try {
            return await fn();
        } catch (e) {
            if (e instanceof ReservaError || e?.code !== 'permission-denied' || i >= intentos) throw e;
        }
    }
}

/**
 * Reserva una clase: crea la reserva, suma 1 al turno y descuenta 1 crédito,
 * todo o nada.
 */
export async function reservarClase(db, { uid, nombre, disciplinaId, disciplina, fecha, hora }) {
    if (claseYaEmpezo(fecha, hora)) throw new ReservaError('Esa clase ya empezó.');

    const turnoId = turnoIdDe(disciplinaId, fecha, hora);
    const reservaId = reservaIdDe(turnoId, uid);
    const alumnoRef = doc(db, 'alumnos', uid);
    const turnoRef = doc(db, 'turnos', turnoId);
    const reservaRef = doc(db, 'reservas', reservaId);
    const configRef = doc(db, 'configuracion', 'clases');

    await conReintento(() => runTransaction(db, async (tx) => {
        const [alumnoSnap, turnoSnap, configSnap] = await Promise.all([
            tx.get(alumnoRef), tx.get(turnoRef), tx.get(configRef)
        ]);
        const creditos = alumnoSnap.exists() ? (alumnoSnap.data().creditos || 0) : 0;
        if (creditos <= 0) throw new ReservaError('No tenés créditos disponibles.');

        const config = configSnap.exists() ? (configSnap.data()[disciplinaId] || {}) : {};
        const vacantes = Number(config.vacantes ?? VACANTES_POR_DEFECTO);
        const ocupados = turnoSnap.exists() ? (turnoSnap.data().ocupados || 0) : 0;
        if (ocupados >= vacantes) throw new ReservaError('La clase se llenó. Probá con otro horario.');

        // No leemos la reserva (las reglas no dejan leer docs que no existen);
        // si ya existe, la regla de alta la rechaza y avisamos como duplicada.
        tx.set(reservaRef, {
            alumnoId: uid,
            alumnoNombre: nombre || '',
            fecha, hora, disciplina: disciplina || disciplinaId, disciplinaId,
            fechaCreacion: new Date()
        });
        if (turnoSnap.exists()) {
            tx.update(turnoRef, { ocupados: ocupados + 1 });
        } else {
            tx.set(turnoRef, { disciplinaId, fecha, hora, ocupados: 1 });
        }
        tx.update(alumnoRef, { creditos: creditos - 1, ultimaReserva: reservaId });
    }));
    return reservaId;
}

/**
 * El alumno cancela su reserva: se borra, se libera el cupo y vuelve el crédito.
 * Solo antes de que empiece la clase (las reglas lo exigen igual).
 */
export async function cancelarReserva(db, { uid, reserva }) {
    const { id, fecha, hora, disciplinaId } = reserva;
    if (claseYaEmpezo(fecha, hora)) {
        throw new ReservaError('La clase ya empezó: no se puede cancelar.');
    }
    const turnoRef = doc(db, 'turnos', turnoIdDe(disciplinaId, fecha, hora));
    const alumnoRef = doc(db, 'alumnos', uid);
    const reservaRef = doc(db, 'reservas', id);

    await conReintento(() => runTransaction(db, async (tx) => {
        const [alumnoSnap, turnoSnap] = await Promise.all([tx.get(alumnoRef), tx.get(turnoRef)]);
        const ocupados = turnoSnap.exists() ? (turnoSnap.data().ocupados || 0) : 0;
        tx.delete(reservaRef);
        tx.update(turnoRef, { ocupados: Math.max(0, ocupados - 1) });
        tx.update(alumnoRef, {
            creditos: (alumnoSnap.data().creditos || 0) + 1,
            ultimaCancelacion: id
        });
    }));
}

/**
 * Cancelación desde el panel de admin: borra la reserva, libera el cupo y
 * (opcionalmente) devuelve el crédito.
 */
export async function cancelarReservaComoAdmin(db, reserva, { reembolsar = true } = {}) {
    const { id, alumnoId, fecha, hora, disciplinaId } = reserva;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'reservas', id));
    if (disciplinaId && fecha && hora && id === reservaIdDe(turnoIdDe(disciplinaId, fecha, hora), alumnoId)) {
        batch.set(doc(db, 'turnos', turnoIdDe(disciplinaId, fecha, hora)),
            { ocupados: increment(-1) }, { merge: true });
    }
    if (reembolsar && alumnoId) {
        batch.update(doc(db, 'alumnos', alumnoId), { creditos: increment(1) });
    }
    await batch.commit();
}

/**
 * Solo admin. Pasa las reservas viejas (IDs al azar) al formato nuevo y
 * recalcula el contador de cada turno a partir de las reservas reales.
 * Se puede correr varias veces; también sirve para reparar contadores.
 * Si un alumno tenía dos reservas de la misma clase, se deja una y se le
 * devuelve el crédito de la otra.
 */
export async function recalcularTurnos(db) {
    const [reservasSnap, turnosSnap] = await Promise.all([
        getDocs(collection(db, 'reservas')),
        getDocs(collection(db, 'turnos'))
    ]);

    const ops = [];          // [tipo, ref, data?]
    const conteo = new Map();  // turnoId -> { disciplinaId, fecha, hora, ocupados }
    const vistas = new Set();
    const reembolsos = new Map(); // alumnoId -> créditos a devolver
    let migradas = 0, duplicadas = 0, invalidas = 0;

    reservasSnap.forEach((snap) => {
        const r = snap.data();
        if (!r.alumnoId || !r.disciplinaId || !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha || '') || !/^\d{2}:\d{2}$/.test(r.hora || '')) {
            invalidas++;
            return;
        }
        const turnoId = turnoIdDe(r.disciplinaId, r.fecha, r.hora);
        const idNuevo = reservaIdDe(turnoId, r.alumnoId);

        if (vistas.has(idNuevo)) {
            duplicadas++;
            ops.push(['delete', snap.ref]);
            reembolsos.set(r.alumnoId, (reembolsos.get(r.alumnoId) || 0) + 1);
            return;
        }
        vistas.add(idNuevo);
        if (snap.id !== idNuevo) {
            migradas++;
            ops.push(['set', doc(db, 'reservas', idNuevo), r]);
            ops.push(['delete', snap.ref]);
        }
        const t = conteo.get(turnoId) || { disciplinaId: r.disciplinaId, fecha: r.fecha, hora: r.hora, ocupados: 0 };
        t.ocupados++;
        conteo.set(turnoId, t);
    });

    // Una reserva vieja puede tener justo el ID nuevo de otra; si la borramos
    // después de escribirla perderíamos datos. Ordenamos: primero borrados, luego altas.
    ops.sort((a, b) => (a[0] === b[0] ? 0 : a[0] === 'delete' ? -1 : 1));

    turnosSnap.forEach((snap) => {
        if (!conteo.has(snap.id)) ops.push(['set', snap.ref, { ...snap.data(), ocupados: 0 }]);
    });
    conteo.forEach((t, turnoId) => ops.push(['set', doc(db, 'turnos', turnoId), t]));
    reembolsos.forEach((n, alumnoId) => ops.push(['update', doc(db, 'alumnos', alumnoId), { creditos: increment(n) }]));

    // Un batch admite hasta 500 escrituras.
    for (let i = 0; i < ops.length; i += 450) {
        const batch = writeBatch(db);
        ops.slice(i, i + 450).forEach(([tipo, ref, data]) => {
            if (tipo === 'delete') batch.delete(ref);
            else if (tipo === 'update') batch.update(ref, data);
            else batch.set(ref, data);
        });
        await batch.commit();
    }
    return { reservas: vistas.size, turnos: conteo.size, migradas, duplicadas, invalidas };
}
