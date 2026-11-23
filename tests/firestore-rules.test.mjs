// Tests de firestore.rules contra el emulador.
// Uso: npm i -D firebase-tools @firebase/rules-unit-testing firebase
//      npx firebase emulators:exec --only firestore --project demo-pilatea "node tests/firestore-rules.test.mjs firestore.rules"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch, increment } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-pilatea',
  firestore: { rules: readFileSync(process.argv[2], 'utf8'), host: '127.0.0.1', port: 8080 },
});

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('ok  ', name); }
  catch (e) { fail++; console.log('FAIL', name, e.message); }
}

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'alumnos/admin1'), { nombre: 'Admin', role: 'admin', creditos: 0 });
    await setDoc(doc(db, 'alumnos/ana'), { nombre: 'Ana', role: 'alumno', creditos: 3 });
    await setDoc(doc(db, 'alumnos/beto'), { nombre: 'Beto', role: 'alumno', creditos: 1 });
    await setDoc(doc(db, 'reservas/resBeto'), { alumnoId: 'beto', fecha: '2026-12-01', hora: '09:00', disciplinaId: 'yoga' });
    await setDoc(doc(db, 'reservas/resAna'), { alumnoId: 'ana', fecha: '2026-12-01', hora: '10:00', disciplinaId: 'yoga' });
    await setDoc(doc(db, 'configuracion/clases'), { yoga: { vacantes: 5 } });
  });
}
const reserva = (uid) => ({ alumnoId: uid, alumnoNombre: 'X', fecha: '2026-12-02', hora: '09:00', disciplina: 'Yoga', disciplinaId: 'yoga', fechaCreacion: new Date() });
function book(db, uid, opts = {}) {
  const ref = doc(collection(db, 'reservas'));
  const b = writeBatch(db);
  b.set(ref, reserva(opts.alumnoId || uid));
  b.update(doc(db, 'alumnos', opts.target || uid), { creditos: increment(opts.delta ?? -1), ultimaReserva: ref.id });
  return b.commit();
}
function cancel(db, uid, id, delta = 1) {
  const b = writeBatch(db);
  b.delete(doc(db, 'reservas', id));
  b.update(doc(db, 'alumnos', uid), { creditos: increment(delta), ultimaCancelacion: id });
  return b.commit();
}

const ana = () => env.authenticatedContext('ana').firestore();
const admin = () => env.authenticatedContext('admin1').firestore();
const anon = () => env.unauthenticatedContext().firestore();

await seed();
// Alumno
await t('alumno lee su doc', () => assertSucceeds(getDoc(doc(ana(), 'alumnos/ana'))));
await t('alumno NO lee doc ajeno', () => assertFails(getDoc(doc(ana(), 'alumnos/beto'))));
await t('alumno NO lista alumnos', () => assertFails(getDocs(collection(ana(), 'alumnos'))));
await t('alumno NO se carga créditos', () => assertFails(updateDoc(doc(ana(), 'alumnos/ana'), { creditos: 100 })));
await t('alumno NO +1 sin cancelar', () => assertFails(updateDoc(doc(ana(), 'alumnos/ana'), { creditos: increment(1) })));
await t('alumno NO se hace admin', () => assertFails(updateDoc(doc(ana(), 'alumnos/ana'), { role: 'admin' })));
await t('alumno NO toca créditos ajenos', () => assertFails(updateDoc(doc(ana(), 'alumnos/beto'), { creditos: 50 })));
await t('alumno NO escribe config', () => assertFails(setDoc(doc(ana(), 'configuracion/clases'), { yoga: { vacantes: 99 } })));
await t('alumno lee config', () => assertSucceeds(getDoc(doc(ana(), 'configuracion/clases'))));
await t('alumno lee reservas del día', () => assertSucceeds(getDocs(query(collection(ana(), 'reservas'), where('fecha', '==', '2026-12-01')))));
await t('alumno reserva (batch -1)', () => assertSucceeds(book(ana(), 'ana')));
await t('alumno NO reserva sin descontar', () => assertFails(setDoc(doc(ana(), 'reservas/x1'), reserva('ana'))));
await t('alumno NO reserva a nombre de otro', () => assertFails(book(ana(), 'ana', { alumnoId: 'beto' })));
await t('alumno NO reserva descontando 2', () => assertFails(book(ana(), 'ana', { delta: -2 })));
await t('alumno NO borra reserva ajena', () => assertFails(deleteDoc(doc(ana(), 'reservas/resBeto'))));
await t('alumno NO cancela ajena con reembolso', () => assertFails(cancel(ana(), 'ana', 'resBeto')));
await t('alumno NO edita reserva', () => assertFails(updateDoc(doc(ana(), 'reservas/resAna'), { hora: '11:00' })));
await t('alumno NO reembolso +2', () => assertFails(cancel(ana(), 'ana', 'resAna', 2)));
await t('alumno cancela propia (batch +1)', () => assertSucceeds(cancel(ana(), 'ana', 'resAna')));
await t('alumno NO repite reembolso', () => assertFails(updateDoc(doc(ana(), 'alumnos/ana'), { creditos: increment(1), ultimaCancelacion: 'resAna' })));
await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), 'alumnos/ana'), { creditos: 0 }));
await t('alumno sin créditos NO reserva', () => assertFails(book(ana(), 'ana')));
await t('alta: NO crea su propio doc (solo admin)', () => assertFails(setDoc(doc(env.authenticatedContext('nuevo').firestore(), 'alumnos/nuevo'), { nombre: 'N', email: 'n@x', creditos: 0, role: 'alumno', uid: 'nuevo', fechaAlta: new Date() })));
await t('alta: NO se crea como admin', () => assertFails(setDoc(doc(env.authenticatedContext('n2').firestore(), 'alumnos/n2'), { creditos: 0, role: 'admin' })));
await t('alta: NO se crea con créditos', () => assertFails(setDoc(doc(env.authenticatedContext('n3').firestore(), 'alumnos/n3'), { creditos: 10, role: 'alumno' })));
// Anónimo
await t('anónimo NO lee reservas', () => assertFails(getDocs(collection(anon(), 'reservas'))));
await t('anónimo NO lee config', () => assertFails(getDoc(doc(anon(), 'configuracion/clases'))));
// Admin
await seed();
await t('admin lista alumnos', () => assertSucceeds(getDocs(collection(admin(), 'alumnos'))));
await t('admin carga créditos', () => assertSucceeds(updateDoc(doc(admin(), 'alumnos/beto'), { creditos: increment(5) })));
await t('admin da de alta un alumno', () => assertSucceeds(setDoc(doc(admin(), 'alumnos/nuevo'), { nombre: 'N', email: 'n@x', creditos: 0, role: 'alumno', uid: 'nuevo', fechaAlta: new Date() })));
await t('admin guarda config', () => assertSucceeds(setDoc(doc(admin(), 'configuracion/calendario'), { diasLaborales: [1, 2], deshabilitados: '' })));
await t('admin cancela reserva ajena', () => assertSucceeds(deleteDoc(doc(admin(), 'reservas/resBeto'))));
await t('admin devuelve crédito', () => assertSucceeds(updateDoc(doc(admin(), 'alumnos/beto'), { creditos: increment(1) })));

await env.cleanup();
console.log(`\n${pass} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
