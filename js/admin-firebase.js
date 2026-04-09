import { db, auth } from './config/firebase.js';
import { checkAuth } from './utils/guards.js'; // Recuerda crear el guard que vimos antes
import { 
    collection, onSnapshot, doc, deleteDoc, updateDoc, increment, setDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// SEGURIDAD: Si no está logueado, lo expulsa al login
// (Si estás en /pages/, la ruta es login.html. Si no, ajusta el path)
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
});

// Referencias del DOM
const studentForm = document.getElementById('form-add-student');
const studentTableBody = document.getElementById('student-list');
const creditsForm = document.getElementById('form-add-credits');
const studentSelect = document.getElementById('select-student-credits');
const searchInput = document.getElementById('search-student');
const searchInModal = document.getElementById('search-student-modal');

// --- GESTIÓN DE ALUMNOS (Real-time) ---
onSnapshot(collection(db, "alumnos"), (snapshot) => {
    if (studentTableBody) studentTableBody.innerHTML = '';
    if (studentSelect) studentSelect.innerHTML = '<option value="">Seleccione un alumno...</option>';
    
    snapshot.forEach((docSnap) => {
        const alumno = docSnap.data();
        const id = docSnap.id;
        
        if (studentTableBody) {
            const row = document.createElement('tr');
            row.setAttribute('data-id', id); // Atributo clave para efectos visuales
            row.innerHTML = `
                <td>${alumno.nombre}</td>
                <td>${alumno.email}</td>
                <td><span class="credits-badge">${alumno.creditos || 0}</span></td>
                <td>
                    <button class="btn-delete" data-id="${id}">
                        <i class="fa-solid fa-trash"></i> Eliminar
                    </button>
                </td>
            `;
            studentTableBody.appendChild(row);
        }

        if (studentSelect) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = alumno.nombre;
            studentSelect.appendChild(option);
        }
    });
});

// --- ELIMINAR ALUMNO (Event Delegation + Efecto Visual) ---
if (studentTableBody) {
    studentTableBody.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-delete');
        if (!btn) return;

        const id = btn.getAttribute('data-id');
        const targetRow = document.querySelector(`tr[data-id="${id}"]`);

        if (targetRow) targetRow.classList.add('row-confirm-delete');

        setTimeout(async () => {
            if (confirm("¿Seguro que desea eliminar este alumno?")) {
                try {
                    await deleteDoc(doc(db, "alumnos", id));
                } catch (error) {
                    console.error(error);
                    targetRow.classList.remove('row-confirm-delete');
                }
            } else {
                targetRow.classList.remove('row-confirm-delete');
            }
        }, 100);
    });
}

// --- BUSCADOR PRINCIPAL ---
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#student-list tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? "" : "none";
        });
    });
}

// --- GUARDAR ALUMNO NUEVO ---
if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = studentForm.querySelector('input[type="text"]').value;
        const email = studentForm.querySelector('input[type="email"]').value;
        const passwordGenerica = "Pilatea2026"; 

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, passwordGenerica);
            const user = userCredential.user;

            await setDoc(doc(db, "alumnos", user.uid), {
                nombre: nombre,
                email: email,
                creditos: 0,
                uid: user.uid,
                fechaAlta: new Date()
            });
            
            alert(`Alumno creado.\nEmail: ${email}\nClave provisoria: ${passwordGenerica}`);
            studentForm.reset();
            if (typeof closeModal === 'function') closeModal('modal-student');
        } catch (error) {
            alert("Error: " + error.message);
        }
    });
}

// --- CARGA DE CRÉDITOS ---
if (creditsForm) {
    creditsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentId = studentSelect.value;
        const amount = parseInt(document.getElementById('input-credits-amount').value);

        if (!studentId || isNaN(amount)) return alert("Datos inválidos");

        try {
            await updateDoc(doc(db, "alumnos", studentId), {
                creditos: increment(amount)
            });
            alert("Créditos cargados.");
            creditsForm.reset();
            if (typeof closeModal === 'function') closeModal('modal-credits');
        } catch (error) {
            alert("Error al cargar");
        }
    });
}

// --- BUSCADOR MODAL ---
if (searchInModal) {
    searchInModal.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        Array.from(studentSelect.options).forEach((opt, index) => {
            if (index === 0) return;
            opt.style.display = opt.text.toLowerCase().includes(term) ? "" : "none";
        });
    });
}

// --- CONFIGURACIÓN DE DISCIPLINAS (Lógica de Generación Dinámica) ---

const disciplinas = [
    { id: 'reformer', nombre: 'Pilates Reformer' },
    { id: 'hiit', nombre: 'HIIT Barre' },
    { id: 'yoga', nombre: 'Yoga' }
];

const disciplinasContainer = document.getElementById('disciplinas-container');

async function cargarConfiguracionClases() {
    if (!disciplinasContainer) return;
    
    try {
        // Obtenemos la configuración actual de Firebase
        const docRef = doc(db, "configuracion", "clases");
        const docSnap = await getDoc(docRef);
        const data = docSnap.exists() ? docSnap.data() : {};

        disciplinasContainer.innerHTML = ''; 

        disciplinas.forEach(dis => {
            // Si no hay datos en Firebase, usamos valores por defecto
            const config = data[dis.id] || { vacantes: 5, inicio: "08:00", fin: "20:00", bloqueados: "" };
            
            const card = document.createElement('div');
            card.className = 'class-config-card';
            card.innerHTML = `
                <h4>${dis.nombre}</h4>
                <div class="input-group">
                    <label for="vacantes-${dis.id}">Vacantes por hora:</label>
                    <input type="number" id="vacantes-${dis.id}" value="${config.vacantes}" class="select-filter">
                </div>
                <div class="input-group">
                    <label for="inicio-${dis.id}">Horario Inicio:</label>
                    <input type="time" id="inicio-${dis.id}" value="${config.inicio}" class="input-calendar">
                </div>
                <div class="input-group">
                    <label for="fin-${dis.id}">Horario Fin:</label>
                    <input type="time" id="fin-${dis.id}" value="${config.fin}" class="input-calendar">
                </div>
                <div class="input-group">
                    <label for="bloqueados-${dis.id}">Horarios deshabilitados:</label>
                    <input type="text" id="bloqueados-${dis.id}" value="${config.bloqueados || ''}" 
                           placeholder="Ej: 12:00, 13:00" class="select-filter">
                    <small style="font-size: 0.7rem; color: #666;">Separar por coma las horas deshabilitadas.</small>
                </div>
            `;
            disciplinasContainer.appendChild(card);
        });
    } catch (error) {
        console.error("Error al cargar configuración de clases:", error);
    }
}

// Ejecutamos la carga al iniciar
cargarConfiguracionClases();

// --- GUARDAR CONFIGURACIÓN ---
const btnSaveConfig = document.getElementById('btn-save-config');
if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', async () => {
        const originalText = btnSaveConfig.innerText;
        btnSaveConfig.innerText = "Guardando...";
        btnSaveConfig.disabled = true;

        const nuevaConfig = {};
        
        disciplinas.forEach(dis => {
            nuevaConfig[dis.id] = {
                vacantes: parseInt(document.getElementById(`vacantes-${dis.id}`).value),
                inicio: document.getElementById(`inicio-${dis.id}`).value,
                fin: document.getElementById(`fin-${dis.id}`).value,
                bloqueados: document.getElementById(`bloqueados-${dis.id}`).value
            };
        });

        try {
            await setDoc(doc(db, "configuracion", "clases"), nuevaConfig);
            alert("¡Configuración de clases guardada con éxito!");
        } catch (error) {
            console.error("Error al guardar:", error);
            alert("Error al guardar la configuración. Revisa los permisos.");
        } finally {
            btnSaveConfig.innerText = originalText;
            btnSaveConfig.disabled = false;
        }
    });
}