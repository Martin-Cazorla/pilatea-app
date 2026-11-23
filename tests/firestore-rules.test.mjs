// Tests de firestore.rules contra el emulador.
// Uso: npm i -D firebase-tools @firebase/rules-unit-testing firebase
//      npx firebase emulators:exec --only firestore --project demo-pilatea "node tests/firestore-rules.test.mjs firestore.rules"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch, increment, runTransaction } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-pilatea',
  firestore: { rules: readFileSync(process.argv[2], 'utf8'), host: '127.0.0.1', port: 8080 },
});

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('ok  ', name); }
  catch (e) { fail++; console.log('FAIL', name, e.message); }
}

// Fechas relativas a hoy, en hora de Argentina (UTC-3), para que los tests no venzan.
const fechaAR = (ms) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
const DIA = 24 * 3600e3;
const FUTURA = fechaAR(Date.now() + 10 * DIA);
const OTRA_FUTURA = fechaAR(Date.now() + 11 * DIA);
const PASADA = fechaAR(Date.now() - 2 * DIA);
// Una clase de hoy que empezó hace 1-2 horas (en hora argentina).
const haceUnaHora = new Date(Date.now() - 3 * 3600e3 - 3600e3);
const HOY = haceUnaHora.toISOString().slice(0, 10);
const HORA_EMPEZADA = `${String(haceUnaHora.getUTCHours()).padStart(2, '0')}:00`;
// Una clase que empieza dentro de 1-2 horas (si el desfasaje UTC-3 estuviera mal, fallaría).
const enDosHoras = new Date(Date.now() - 3 * 3600e3 + 2 * 3600e3);
const PRONTO = enDosHoras.toISOString().slice(0, 10);
const HORA_PRONTO = `${String(enDosHoras.getUTCHours()).padStart(2, '0')}:00`;

const turnoId = (d, f, h) => `${d}_${f}_${h.replace(':', '')}`;
const reservaId = (d, f, h, uid) => `${turnoId(d, f, h)}_${uid}`;

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'alumnos/admin1'), { nombre: 'Admin', role: 'admin', creditos: 0 });
    await setDoc(doc(db, 'alumnos/ana'), { nombre: 'Ana', role: 'alumno', creditos: 3 });
    await setDoc(doc(db, 'alumnos/beto'), { nombre: 'Beto', role: 'alumno', creditos: 1 });
    await setDoc(doc(db, 'alumnos/caro'), { nombre: 'Caro', role: 'alumno', creditos: 2 });
    await setDoc(doc(db, 'configuracion/clases'), { yoga: { vacantes: 5 }, hiit: { vacantes: 1 } });
    // Reservas existentes, con su turno.
    const existentes = [
      ['beto', 'yoga', FUTURA, '09:00'],
      ['ana', 'yoga', FUTURA, '10:00'],
      ['ana', 'yoga', PASADA, '10:00'],
      ['ana', 'yoga', HOY, HORA_EMPEZADA],
    ];
    for (const [uid, d, f, h] of existentes) {
      await setDoc(doc(db, 'reservas', reservaId(d, f, h, uid)), { alumnoId: uid, fecha: f, hora: h, disciplinaId: d });
      await setDoc(doc(db, 'turnos', turnoId(d, f, h)), { disciplinaId: d, fecha: f, hora: h, ocupados: 1 });
    }
  });
}

const reserva = (uid, o = {}) => ({
  alumnoId: uid, alumnoNombre: 'X', fecha: o.fecha || FUTURA, hora: o.hora || '11:00',
  disciplina: 'Yoga', disciplinaId: o.disc || 'yoga', fechaCreacion: new Date(),
});

// Reserva como lo hace la app, pero con los valores "a mano" para poder romperlos.
// o.ocupados: valor que se escribe en el turno (por defecto, el que hay + 1).
function book(db, uid, o = {}) {
  const r = reserva(o.alumnoId || uid, o);
  const tid = turnoId(r.disciplinaId, r.fecha, r.hora);
  const rid = o.id || `${tid}_${uid}`;
  const b = writeBatch(db);
  b.set(doc(db, 'reservas', rid), r);
  if (!o.skipTurno) {
    if (o.ocupados === undefined) {
      b.set(doc(db, 'turnos', tid), { disciplinaId: r.disciplinaId, fecha: r.fecha, hora: r.hora, ocupados: increment(1) }, { merge: true });
    } else {
      b.set(doc(db, 'turnos', tid), { disciplinaId: r.disciplinaId, fecha: r.fecha, hora: r.hora, ocupados: o.ocupados });
    }
  }
  b.update(doc(db, 'alumnos', o.target || uid), { creditos: increment(o.delta ?? -1), ultimaReserva: rid });
  return b.commit();
}
function cancel(db, uid, d, f, h, o = {}) {
  const rid = o.id || reservaId(d, f, h, uid);
  const b = writeBatch(db);
  b.delete(doc(db, 'reservas', rid));
  if (!o.skipTurno) b.update(doc(db, 'turnos', turnoId(d, f, h)), { ocupados: increment(o.turnoDelta ?? -1) });
  b.update(doc(db, 'alumnos', uid), { creditos: increment(o.delta ?? 1), ultimaCancelacion: rid });
  return b.commit();
}
// La misma transacción que usa js/utils/turnos.js.
function bookTx(db, uid, d, f, h) {
  const tid = turnoId(d, f, h), rid = `${tid}_${uid}`;
  return runTransaction(db, async (tx) => {
    const a = await tx.get(doc(db, 'alumnos', uid));
    const tr = await tx.get(doc(db, 'turnos', tid));
    const cfg = await tx.get(doc(db, 'configuracion', 'clases'));
    const ocupados = tr.exists() ? tr.data().ocupados : 0;
    if (ocupados >= cfg.data()[d].vacantes) throw new Error('llena');
    tx.set(doc(db, 'reservas', rid), reserva(uid, { disc: d, fecha: f, hora: h }));
    if (tr.exists()) tx.update(doc(db, 'turnos', tid), { ocupados: ocupados + 1 });
    else tx.set(doc(db, 'turnos', tid), { disciplinaId: d, fecha: f, hora: h, ocupados: 1 });
    tx.update(doc(db, 'alumnos', uid), { creditos: a.data().creditos - 1, ultimaReserva: rid });
  });
}
async function readAs(path) {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => { data = (await getDoc(doc(ctx.firestore(), path))).data(); });
  return data;
}
const rejects = async (p) => { try { await p; } catch { return; } throw new Error('se esperaba un rechazo'); };
const expectEq = (a, b, msg) => { if (a !== b) throw new Error(`${msg}: esperaba ${b}, hay ${a}`); };

const as = (uid) => env.authenticatedContext(uid).firestore();
const ana = () => as('ana');
const admin = () => as('admin1');
const anon = () => env.unauthenticatedContext().firestore();

await seed();
// ---------- Alumno: perfil y config ----------
await t('alumno lee su doc', () => assertSucceeds(getDoc(doc(ana(), 'alumnos/ana'))));
await t('alumno NO lee doc ajeno', () => assertFails(getDoc(doc(ana(), 'alumnos/beto'))));
await t('alumno NO lista alumnos', () => assertFails(getDocs(collection(ana(), 'alumnos'))));
await t('alumno NO se carga créditos', () => assertFails(updateDoc(doc(ana(), 'alumnos/ana'), { creditos: 100 })));
await t('alumno NO +1 sin cancelar', () => assertFails(updateDoc(doc(ana(), 'alumnos/ana'), { creditos: increment(1) })));
await t('alumno NO se hace admin', () => assertFails(updateDoc(doc(ana(), 'alumnos/ana'), { role: 'admin' })));
await t('alumno NO toca créditos ajenos', () => assertFails(updateDoc(doc(ana(), 'alumnos/beto'), { creditos: 50 })));
await t('alumno NO escribe config', () => assertFails(setDoc(doc(ana(), 'configuracion/clases'), { yoga: { vacantes: 99 } })));
await t('alumno lee config', () => assertSucceeds(getDoc(doc(ana(), 'configuracion/clases'))));

// ---------- Alumno: lectura de reservas y turnos ----------
await t('alumno lee sus reservas', () => assertSucceeds(getDocs(query(collection(ana(), 'reservas'), where('alumnoId', '==', 'ana')))));
await t('alumno NO lee reservas ajenas', () => assertFails(getDoc(doc(ana(), 'reservas', reservaId('yoga', FUTURA, '09:00', 'beto')))));
await t('alumno NO lista todas las reservas del día', () => assertFails(getDocs(query(collection(ana(), 'reservas'), where('fecha', '==', FUTURA)))));
await t('alumno lee turnos del día', () => assertSucceeds(getDocs(query(collection(ana(), 'turnos'), where('fecha', '==', FUTURA), where('disciplinaId', '==', 'yoga')))));

// ---------- Alumno: reservar ----------
await t('alumno reserva (reserva + turno +1 + crédito -1)', () => assertSucceeds(book(ana(), 'ana')));
await t('...el turno queda en 1 y el crédito en 2', async () => {
  expectEq((await readAs(`turnos/${turnoId('yoga', FUTURA, '11:00')}`)).ocupados, 1, 'ocupados');
  expectEq((await readAs('alumnos/ana')).creditos, 2, 'creditos');
});
await t('alumno NO reserva dos veces la misma clase', () => assertFails(book(ana(), 'ana')));
await t('alumno reserva clase con turno existente', () => assertSucceeds(book(ana(), 'ana', { hora: '09:00' })));
await t('alumno NO reserva sin descontar', () => assertFails(setDoc(doc(ana(), 'reservas', reservaId('yoga', FUTURA, '12:00', 'ana')), reserva('ana', { hora: '12:00' }))));
await t('alumno NO reserva sin sumar al turno', () => assertFails(book(ana(), 'ana', { hora: '12:00', skipTurno: true })));
await t('alumno NO reserva con ID libre', () => assertFails(book(ana(), 'ana', { hora: '12:00', id: 'cualquiera' })));
await t('alumno NO reserva a nombre de otro', () => assertFails(book(ana(), 'ana', { hora: '12:00', alumnoId: 'beto' })));
await t('alumno NO reserva descontando 2', () => assertFails(book(ana(), 'ana', { hora: '12:00', delta: -2 })));
await t('alumno NO reserva clase pasada', () => assertFails(book(ana(), 'ana', { fecha: PASADA, hora: '12:00' })));
await t('alumno NO reserva clase de hoy que ya empezó', () => assertFails(book(ana(), 'ana', { fecha: HOY, hora: HORA_EMPEZADA, disc: 'hiit' })));
await t('alumno reserva clase que empieza en 1-2 horas', () => assertSucceeds(book(ana(), 'ana', { fecha: PRONTO, hora: HORA_PRONTO, disc: 'reformer' })));
await t('alumno NO baja el contador de un turno sin cancelar', () => assertFails(updateDoc(doc(ana(), 'turnos', turnoId('yoga', FUTURA, '09:00')), { ocupados: 0 })));
await t('alumno NO crea turnos sueltos', () => assertFails(setDoc(doc(ana(), 'turnos', turnoId('yoga', FUTURA, '15:00')), { disciplinaId: 'yoga', fecha: FUTURA, hora: '15:00', ocupados: 0 })));

// ---------- Cupo máximo ----------
// hiit tiene 1 vacante.
await t('reserva el único lugar de hiit', () => assertSucceeds(book(as('caro'), 'caro', { disc: 'hiit', fecha: OTRA_FUTURA, hora: '18:00' })));
await t('NO reserva hiit lleno (ocupados 2 > vacantes 1)', () => assertFails(book(ana(), 'ana', { disc: 'hiit', fecha: OTRA_FUTURA, hora: '18:00' })));
await t('NO reserva hiit lleno pisando el contador con un valor viejo', () => assertFails(book(ana(), 'ana', { disc: 'hiit', fecha: OTRA_FUTURA, hora: '18:00', ocupados: 1 })));
await t('transacción de la app rechaza clase llena', () => rejects(bookTx(ana(), 'ana', 'hiit', OTRA_FUTURA, '18:00')));
await t('dos alumnos a la vez por el último lugar: entra uno solo', async () => {
  const f = fechaAR(Date.now() + 12 * DIA);
  // Los dos leyeron "0 ocupados" y escriben ocupados = 1.
  const res = await Promise.allSettled([
    book(ana(), 'ana', { disc: 'hiit', fecha: f, hora: '19:00', ocupados: 1 }),
    book(as('beto'), 'beto', { disc: 'hiit', fecha: f, hora: '19:00', ocupados: 1 }),
  ]);
  expectEq(res.filter((r) => r.status === 'fulfilled').length, 1, 'reservas aceptadas');
  expectEq((await readAs(`turnos/${turnoId('hiit', f, '19:00')}`)).ocupados, 1, 'ocupados');
});
await t('transacciones simultáneas no pasan el cupo', async () => {
  const f = fechaAR(Date.now() + 13 * DIA);
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'alumnos/ana'), { creditos: 3 });
    await updateDoc(doc(ctx.firestore(), 'alumnos/beto'), { creditos: 3 });
    await updateDoc(doc(ctx.firestore(), 'alumnos/caro'), { creditos: 3 });
  });
  const res = await Promise.allSettled(['ana', 'beto', 'caro'].map((u) => bookTx(as(u), u, 'hiit', f, '20:00')));
  expectEq(res.filter((r) => r.status === 'fulfilled').length, 1, 'reservas aceptadas');
  expectEq((await readAs(`turnos/${turnoId('hiit', f, '20:00')}`)).ocupados, 1, 'ocupados');
});

// ---------- Cancelar ----------
await seed();
await t('alumno NO borra reserva ajena', () => assertFails(deleteDoc(doc(ana(), 'reservas', reservaId('yoga', FUTURA, '09:00', 'beto')))));
await t('alumno NO cancela ajena con reembolso', () => assertFails(cancel(ana(), 'ana', 'yoga', FUTURA, '09:00', { id: reservaId('yoga', FUTURA, '09:00', 'beto') })));
await t('alumno NO edita reserva', () => assertFails(updateDoc(doc(ana(), 'reservas', reservaId('yoga', FUTURA, '10:00', 'ana')), { hora: '11:00' })));
await t('alumno NO reembolso +2', () => assertFails(cancel(ana(), 'ana', 'yoga', FUTURA, '10:00', { delta: 2 })));
await t('alumno NO cancela sin liberar el cupo', () => assertFails(cancel(ana(), 'ana', 'yoga', FUTURA, '10:00', { skipTurno: true })));
await t('alumno NO libera 2 cupos', () => assertFails(cancel(ana(), 'ana', 'yoga', FUTURA, '10:00', { turnoDelta: -2 })));
await t('alumno NO cancela clase pasada (ni recupera crédito)', () => assertFails(cancel(ana(), 'ana', 'yoga', PASADA, '10:00')));
await t('alumno NO cancela clase de hoy que ya empezó', () => assertFails(cancel(ana(), 'ana', 'yoga', HOY, HORA_EMPEZADA)));
await t('alumno cancela propia futura (borra + turno -1 + crédito +1)', () => assertSucceeds(cancel(ana(), 'ana', 'yoga', FUTURA, '10:00')));
await t('...el turno queda en 0 y el crédito en 4', async () => {
  expectEq((await readAs(`turnos/${turnoId('yoga', FUTURA, '10:00')}`)).ocupados, 0, 'ocupados');
  expectEq((await readAs('alumnos/ana')).creditos, 4, 'creditos');
});
await t('alumno NO repite reembolso', () => assertFails(updateDoc(doc(ana(), 'alumnos/ana'), { creditos: increment(1), ultimaCancelacion: reservaId('yoga', FUTURA, '10:00', 'ana') })));
await t('alumno vuelve a reservar la clase que canceló', () => assertSucceeds(book(ana(), 'ana', { hora: '10:00' })));
await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), 'alumnos/ana'), { creditos: 0 }));
await t('alumno sin créditos NO reserva', () => assertFails(book(ana(), 'ana', { hora: '13:00' })));

// ---------- Alta de alumno ----------
await t('alta: NO crea su propio doc (solo admin)', () => assertFails(setDoc(doc(as('nuevo'), 'alumnos/nuevo'), { nombre: 'N', email: 'n@x', creditos: 0, role: 'alumno', uid: 'nuevo', fechaAlta: new Date() })));
await t('alta: NO se crea como admin', () => assertFails(setDoc(doc(as('n2'), 'alumnos/n2'), { creditos: 0, role: 'admin' })));
await t('alta: NO se crea con créditos', () => assertFails(setDoc(doc(as('n3'), 'alumnos/n3'), { creditos: 10, role: 'alumno' })));

// ---------- Anónimo ----------
await t('anónimo NO lee reservas', () => assertFails(getDocs(collection(anon(), 'reservas'))));
await t('anónimo NO lee turnos', () => assertFails(getDocs(collection(anon(), 'turnos'))));
await t('anónimo NO lee config', () => assertFails(getDoc(doc(anon(), 'configuracion/clases'))));

// ---------- Admin ----------
await seed();
await t('admin lista alumnos', () => assertSucceeds(getDocs(collection(admin(), 'alumnos'))));
await t('admin da de alta un alumno', () => assertSucceeds(setDoc(doc(admin(), 'alumnos/nuevo'), { nombre: 'N', email: 'n@x', creditos: 0, role: 'alumno', uid: 'nuevo', fechaAlta: new Date() })));
await t('admin lista reservas del día', () => assertSucceeds(getDocs(query(collection(admin(), 'reservas'), where('fecha', '==', FUTURA)))));
await t('admin carga créditos', () => assertSucceeds(updateDoc(doc(admin(), 'alumnos/beto'), { creditos: increment(5) })));
await t('admin guarda config', () => assertSucceeds(setDoc(doc(admin(), 'configuracion/calendario'), { diasLaborales: [1, 2], deshabilitados: '' })));
await t('admin cancela reserva ajena, libera cupo y devuelve crédito', () => {
  const db = admin();
  const b = writeBatch(db);
  b.delete(doc(db, 'reservas', reservaId('yoga', FUTURA, '09:00', 'beto')));
  b.set(doc(db, 'turnos', turnoId('yoga', FUTURA, '09:00')), { ocupados: increment(-1) }, { merge: true });
  b.update(doc(db, 'alumnos/beto'), { creditos: increment(1) });
  return assertSucceeds(b.commit());
});
await t('admin cancela clase pasada', () => assertSucceeds(deleteDoc(doc(admin(), 'reservas', reservaId('yoga', PASADA, '10:00', 'ana')))));
await t('admin recalcula turnos', () => assertSucceeds(setDoc(doc(admin(), 'turnos', turnoId('yoga', FUTURA, '10:00')), { disciplinaId: 'yoga', fecha: FUTURA, hora: '10:00', ocupados: 1 })));

await env.cleanup();
console.log(`\n${pass} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
