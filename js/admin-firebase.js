import { db, auth } from './config/firebase.js';
import { 
    collection, onSnapshot, doc, deleteDoc, updateDoc, increment, setDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// SEGURIDAD
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
});

// Referencias DOM
const studentForm = document.getElementById('form-add-student');
const studentTableBody = document.getElementById('student-list');
const creditsForm = document.getElementById('form-add-credits');
const studentSelect = document.getElementById('select-student-credits');
const searchInput = document.getElementById('search-student');
const searchInModal = document.getElementById('search-student-modal');
const disciplinasContainer = document.getElementById('disciplinas-container');

// --- GESTIÓN DE ALUMNOS (Incluye Buscadores, Créditos y Borrado) ---
onSnapshot(collection(db, "alumnos"), (snapshot) => {
    if (studentTableBody) studentTableBody.innerHTML = '';
    if (studentSelect) studentSelect.innerHTML = '<option value="">Seleccione un alumno...</option>';
    snapshot.forEach((docSnap) => {
        const alumno = docSnap.data();
        const id = docSnap.id;
        if (studentTableBody) {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${alumno.nombre}</td><td>${alumno.email}</td><td><span class="credits-badge">${alumno.creditos || 0}</span></td>
                <td><button class="btn-delete" data-id="${id}"><i class="fa-solid fa-trash"></i></button></td>`;
            studentTableBody.appendChild(row);
        }
        if (studentSelect) {
            const option = document.createElement('option');
            option.value = id; option.textContent = alumno.nombre;
            studentSelect.appendChild(option);
        }
    });
});

// Registro Nuevo Alumno
if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('new-student-name').value;
        const email = document.getElementById('new-student-email').value;
        try {
            const userCred = await createUserWithEmailAndPassword(auth, email, "Pilatea2026");
            await setDoc(doc(db, "alumnos", userCred.user.uid), {
                nombre, email, creditos: 0, role: 'alumno', uid: userCred.user.uid, fechaAlta: new Date()
            });
            alert("Alumno creado. Se cerrará sesión por seguridad.");
            await signOut(auth);
            window.location.href = "login.html";
        } catch (err) { alert(err.message); }
    });
}

// Créditos
if (creditsForm) {
    creditsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = studentSelect.value;
        const cant = parseInt(document.getElementById('input-credits-amount').value);
        try {
            await updateDoc(doc(db, "alumnos", id), { creditos: increment(cant) });
            alert("Créditos cargados.");
            creditsForm.reset();
            closeModal('modal-credits');
        } catch (e) { alert("Error"); }
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
            const c = data[dis.id] || { vacantes: 5, inicio: "08:00", fin: "20:00", bloqueados: "" };
            const card = document.createElement('div');
            card.className = 'class-config-card';
            card.innerHTML = `<h4>${dis.nombre}</h4>
                <div class="input-group"><label>Vacantes:</label><input type="number" id="vacantes-${dis.id}" value="${c.vacantes}"></div>
                <div class="input-group"><label>Horarios:</label><div style="display:flex;gap:5px"><input type="time" id="inicio-${dis.id}" value="${c.inicio}"><input type="time" id="fin-${dis.id}" value="${c.fin}"></div></div>
                <div class="input-group"><label>Bloqueados:</label><input type="text" id="bloqueados-${dis.id}" value="${c.bloqueados}" placeholder="12:00, 13:00"></div>`;
            disciplinasContainer.appendChild(card);
        });

        // Cargar Calendario
        const calSnap = await getDoc(doc(db, "configuracion", "calendario"));
        if (calSnap.exists()) {
            const calData = calSnap.data();
            document.getElementById('dias-cerrado').value = calData.deshabilitados || "";
            const checks = document.querySelectorAll('.check-dia');
            checks.forEach(chk => chk.checked = calData.diasLaborales.includes(parseInt(chk.value)));
        }
    } catch (e) { console.error(e); }
}

cargarConfiguracionGeneral();

// Guardar Todo
document.getElementById('btn-save-config').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-config');
    btn.disabled = true;
    btn.innerText = "Guardando...";

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
        alert("Configuración guardada.");
    } catch (e) { alert("Error"); }
    finally { btn.disabled = false; btn.innerText = "Guardar Toda la Configuración"; }
});