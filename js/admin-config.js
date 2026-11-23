// Pestaña "Configuración de Sistema" del panel de staff.
// La importa admin.js recién después de requireAdmin(), así que acá no se vuelve
// a chequear el rol (la protección real de los datos está en firestore.rules).
import { db } from './config/firebase.js';
import {
    collection, onSnapshot, doc, updateDoc, increment, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { crearAlumno, enviarAcceso, mensajeErrorAlta } from './utils/alumnos.js';
import { recalcularTurnos } from './utils/turnos.js';
import { cerrarModal, confirmar, avisar } from './modals.js';

// Referencias DOM
const studentForm = document.getElementById('form-add-student');
const studentTableBody = document.getElementById('student-list');
const creditsForm = document.getElementById('form-add-credits');
const studentSelect = document.getElementById('select-student-credits');
const searchInput = document.getElementById('search-student');
const searchInModal = document.getElementById('search-student-modal');
const creditsCurrent = document.getElementById('credits-current');
const creditsAmount = document.getElementById('input-credits-amount');
const disciplinasContainer = document.getElementById('disciplinas-container');

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// --- GESTIÓN DE ALUMNOS ---
let alumnos = [];

function renderTabla() {
    if (!studentTableBody) return;
    const q = normalizar(searchInput?.value);
    const lista = alumnos.filter(a => !q || normalizar(a.nombre).includes(q) || normalizar(a.email).includes(q));
    studentTableBody.innerHTML = '';
    if (!lista.length) {
        studentTableBody.innerHTML = `<tr><td colspan="4" class="table-empty">${alumnos.length ? 'Ningún alumno coincide con la búsqueda.' : 'Todavía no hay alumnos cargados.'}</td></tr>`;
        return;
    }
    lista.forEach((alumno) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td data-label="Nombre"></td><td data-label="Email"></td>
            <td data-label="Créditos"><span class="credits-badge"></span></td>
            <td data-label="Acciones" class="cell-actions">
                <button type="button" class="btn-icon btn-reset-pass" title="Reenviar mail de acceso" aria-label="Reenviar mail de acceso"><i class="fa-solid fa-key"></i></button>
                <button type="button" class="btn-icon btn-add-credits" title="Cargar créditos" aria-label="Cargar créditos"><i class="fa-solid fa-coins"></i></button>
            </td>`;
        // textContent: nombre y email los carga el admin, no se interpretan como HTML.
        row.cells[0].textContent = alumno.nombre || '';
        row.cells[1].textContent = alumno.email || '';
        row.querySelector('.credits-badge').textContent = alumno.creditos || 0;
        row.querySelector('.btn-reset-pass').dataset.email = alumno.email || '';
        row.querySelector('.btn-add-credits').dataset.id = alumno.id;
        studentTableBody.appendChild(row);
    });
}

function renderSelect() {
    if (!studentSelect) return;
    const q = normalizar(searchInModal?.value);
    const elegido = studentSelect.value;
    const lista = alumnos
        .filter(a => !q || normalizar(a.nombre).includes(q) || normalizar(a.email).includes(q))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    studentSelect.innerHTML = `<option value="">${lista.length ? 'Elegí un alumno...' : 'Sin resultados'}</option>`;
    lista.forEach(a => {
        const option = document.createElement('option');
        option.value = a.id;
        option.textContent = a.email ? `${a.nombre} (${a.email})` : a.nombre;
        studentSelect.appendChild(option);
    });
    // Si hay un solo resultado, queda elegido.
    if (lista.some(a => a.id === elegido)) studentSelect.value = elegido;
    else if (lista.length === 1) studentSelect.value = lista[0].id;
    mostrarCreditosActuales();
}

function mostrarCreditosActuales() {
    if (!creditsCurrent) return;
    const a = alumnos.find(x => x.id === studentSelect.value);
    creditsCurrent.textContent = a ? `Tiene ${a.creditos || 0} crédito${(a.creditos || 0) === 1 ? '' : 's'} disponibles.` : '';
}

onSnapshot(collection(db, "alumnos"), (snapshot) => {
    alumnos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    renderTabla();
    renderSelect();
});

searchInput?.addEventListener('input', renderTabla);
searchInModal?.addEventListener('input', renderSelect);
studentSelect?.addEventListener('change', mostrarCreditosActuales);

// Cantidades rápidas del modal de créditos
document.querySelectorAll('.quick-amounts [data-amount]').forEach(b => b.addEventListener('click', () => {
    creditsAmount.value = b.dataset.amount;
    marcarCantidad();
}));
function marcarCantidad() {
    document.querySelectorAll('.quick-amounts [data-amount]').forEach(b =>
        b.classList.toggle('active', b.dataset.amount === creditsAmount.value));
}
creditsAmount?.addEventListener('input', marcarCantidad);
marcarCantidad();

// Al abrir el modal de créditos desde la tabla, viene con el alumno ya elegido.
document.getElementById('modal-credits')?.addEventListener('modal:cerrado', () => {
    creditsForm.reset();
    searchInModal.value = '';
    renderSelect();
    marcarCantidad();
});

// Registro Nuevo Alumno
// El alta corre en una app de Firebase aparte (ver utils/alumnos.js), así que
// el admin sigue logueado. El alumno recibe un mail para elegir su contraseña.
if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('new-student-name').value;
        const email = document.getElementById('new-student-email').value;
        const btn = studentForm.querySelector('button[type="submit"]');
        const textoOriginal = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Registrando...";
        try {
            const { mailEnviado } = await crearAlumno(db, { nombre, email });
            studentForm.reset();
            cerrarModal('modal-student');
            if (mailEnviado) avisar(`Alumno creado. Le enviamos a ${email.trim()} un mail para que elija su contraseña.`);
            else avisar("Alumno creado, pero no se pudo enviar el mail de acceso. Reenvialo con el botón de la llave en la tabla.", 'info', 8000);
        } catch (err) {
            console.error(err);
            avisar(mensajeErrorAlta(err), 'error', 7000);
        } finally {
            btn.disabled = false;
            btn.innerText = textoOriginal;
        }
    });
}

// Acciones de la tabla: reenviar acceso y cargar créditos a un alumno puntual
if (studentTableBody) {
    studentTableBody.addEventListener('click', async (e) => {
        const btnCred = e.target.closest('.btn-add-credits');
        if (btnCred) {
            document.querySelector('[data-open-modal="modal-credits"]')?.click();
            studentSelect.value = btnCred.dataset.id;
            if (studentSelect.value !== btnCred.dataset.id) { searchInModal.value = ''; renderSelect(); studentSelect.value = btnCred.dataset.id; }
            mostrarCreditosActuales();
            setTimeout(() => creditsAmount.focus(), 80);
            return;
        }

        const btn = e.target.closest('.btn-reset-pass');
        if (!btn) return;
        const email = btn.dataset.email;
        if (!email) return avisar("Este alumno no tiene email cargado.", 'info');
        const ok = await confirmar({
            titulo: 'Reenviar acceso',
            mensaje: `Le vamos a mandar a ${email} un mail para que elija una contraseña nueva.`,
            aceptar: 'Enviar mail',
            icono: 'fa-envelope'
        });
        if (!ok) return;
        btn.disabled = true;
        try {
            await enviarAcceso(email);
            avisar("Mail enviado.");
        } catch (err) {
            console.error(err);
            avisar(mensajeErrorAlta(err), 'error', 7000);
        } finally {
            btn.disabled = false;
        }
    });
}

// Créditos
if (creditsForm) {
    creditsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = studentSelect.value;
        const cant = parseInt(creditsAmount.value);
        if (!id) return avisar("Elegí un alumno.", 'info');
        if (!(cant > 0)) return avisar("La cantidad tiene que ser mayor a cero.", 'info');
        const btn = creditsForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            await updateDoc(doc(db, "alumnos", id), { creditos: increment(cant) });
            const nombre = alumnos.find(a => a.id === id)?.nombre || 'el alumno';
            cerrarModal('modal-credits');
            avisar(`Se cargaron ${cant} crédito${cant === 1 ? '' : 's'} a ${nombre}.`);
        } catch (err) {
            console.error(err);
            avisar("No se pudieron cargar los créditos.", 'error');
        } finally {
            btn.disabled = false;
        }
    });
}

// --- CONFIGURACIÓN DE CLASES Y CALENDARIO ---
const disciplinas = [
    { id: 'reformer', nombre: 'Pilates Reformer' },
    { id: 'hiit', nombre: 'HIIT Barre' },
    { id: 'yoga', nombre: 'Yoga' }
];

async function cargarConfiguracionGeneral() {
    if (!disciplinasContainer) return;
    try {
        const snap = await getDoc(doc(db, "configuracion", "clases"));
        const data = snap.exists() ? snap.data() : {};
        disciplinasContainer.innerHTML = '';
        disciplinas.forEach(dis => {
            const c = { vacantes: 5, inicio: "08:00", fin: "20:00", bloqueados: "", ...data[dis.id] };
            const card = document.createElement('div');
            card.className = 'class-config-card';
            card.innerHTML = `<h4>${dis.nombre}</h4>
                <div class="form-field"><label for="vacantes-${dis.id}">Vacantes por clase</label><input type="number" min="0" id="vacantes-${dis.id}"></div>
                <div class="form-field"><label for="inicio-${dis.id}">Horarios (primera y última clase)</label>
                    <div class="time-range"><input type="time" id="inicio-${dis.id}" aria-label="Primera clase"><span>a</span><input type="time" id="fin-${dis.id}" aria-label="Última clase"></div></div>
                <div class="form-field"><label for="bloqueados-${dis.id}">Horarios bloqueados</label><input type="text" id="bloqueados-${dis.id}" placeholder="12:00, 13:00"></div>`;
            card.querySelector(`#vacantes-${dis.id}`).value = c.vacantes;
            card.querySelector(`#inicio-${dis.id}`).value = c.inicio;
            card.querySelector(`#fin-${dis.id}`).value = c.fin;
            card.querySelector(`#bloqueados-${dis.id}`).value = c.bloqueados || '';
            disciplinasContainer.appendChild(card);
        });

        // Cargar Calendario
        const calSnap = await getDoc(doc(db, "configuracion", "calendario"));
        if (calSnap.exists()) {
            const calData = calSnap.data();
            document.getElementById('dias-cerrado').value = calData.deshabilitados || "";
            const checks = document.querySelectorAll('.check-dia');
            checks.forEach(chk => chk.checked = (calData.diasLaborales || []).includes(parseInt(chk.value)));
        }
    } catch (e) {
        console.error(e);
        avisar("No se pudo leer la configuración.", 'error');
    }
}

cargarConfiguracionGeneral();

// Guardar Todo
const btnSave = document.getElementById('btn-save-config');
btnSave.addEventListener('click', async () => {
    const textoOriginal = btnSave.innerHTML;
    btnSave.disabled = true;
    btnSave.textContent = "Guardando...";

    const nuevaConfig = {};
    disciplinas.forEach(dis => {
        nuevaConfig[dis.id] = {
            vacantes: parseInt(document.getElementById(`vacantes-${dis.id}`).value),
            inicio: document.getElementById(`inicio-${dis.id}`).value,
            fin: document.getElementById(`fin-${dis.id}`).value,
            bloqueados: document.getElementById(`bloqueados-${dis.id}`).value
        };
    });

    const diasLaborales = Array.from(document.querySelectorAll('.check-dia:checked')).map(c => parseInt(c.value));
    const feriados = document.getElementById('dias-cerrado').value;

    try {
        await setDoc(doc(db, "configuracion", "clases"), nuevaConfig);
        await setDoc(doc(db, "configuracion", "calendario"), {
            deshabilitados: feriados,
            diasLaborales: diasLaborales
        });
        avisar("Configuración guardada.");
    } catch (e) {
        console.error(e);
        avisar("No se pudo guardar la configuración.", 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = textoOriginal;
    }
});

// Mantenimiento: migra reservas viejas y recalcula los contadores de cupo.
const btnRecalcular = document.getElementById('btn-recalcular-cupos');
if (btnRecalcular) {
    btnRecalcular.addEventListener('click', async () => {
        const ok = await confirmar({
            titulo: 'Recalcular cupos',
            mensaje: 'Se recalculan los cupos de todas las clases a partir de las reservas. Puede tardar unos segundos.',
            aceptar: 'Recalcular',
            icono: 'fa-rotate'
        });
        if (!ok) return;
        btnRecalcular.disabled = true;
        try {
            const r = await recalcularTurnos(db);
            avisar(`Listo: ${r.reservas} reservas en ${r.turnos} clases. ` +
                `Migradas: ${r.migradas}. Duplicadas eliminadas (crédito devuelto): ${r.duplicadas}. ` +
                `Ignoradas por datos incompletos: ${r.invalidas}.`, 'exito', 10000);
        } catch (e) {
            console.error(e);
            avisar("No se pudo recalcular los cupos.", 'error');
        } finally {
            btnRecalcular.disabled = false;
        }
    });
}
