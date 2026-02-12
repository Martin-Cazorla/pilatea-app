import { initializeApp } from "firebase/app";
import { 
    getFirestore, collection, onSnapshot, 
    doc, deleteDoc, updateDoc, increment, setDoc, getDoc 
} from "firebase/firestore";

import { 
    getAuth, 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCedurhdaLQfrSFHWn7J9ptN6mIq3HfJOY",
    authDomain: "pilatea-sistema.firebaseapp.com",
    projectId: "pilatea-sistema",
    storageBucket: "pilatea-sistema.firebasestorage.app",
    messagingSenderId: "478294720150",
    appId: "1:478294720150:web:9efe132aa23cad2db7ccb7"
};

// Inicialización
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Referencias del DOM
const studentForm = document.getElementById('form-add-student');
const studentTableBody = document.getElementById('student-list');
const creditsForm = document.getElementById('form-add-credits');
const studentSelect = document.getElementById('select-student-credits');
const searchInput = document.getElementById('search-student'); // Referencia del buscador

// --- GESTIÓN DE ALUMNOS (Lectura Real-time) ---
onSnapshot(collection(db, "alumnos"), (snapshot) => {
    if (studentTableBody) studentTableBody.innerHTML = '';
    if (studentSelect) studentSelect.innerHTML = '<option value="">Seleccione un alumno...</option>';
    
    snapshot.forEach((docSnap) => {
        const alumno = docSnap.data();
        const id = docSnap.id;
        
        if (studentTableBody) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${alumno.nombre}</td>
                <td>${alumno.email}</td>
                <td><span class="credits-badge">${alumno.creditos || 0}</span></td>
                <td>
                    <button class="btn-delete" onclick="eliminarAlumno('${id}')">
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

// --- LÓGICA DEL BUSCADOR ---
// Lo ponemos aquí porque depende de que la tabla ya exista/se esté llenando
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#student-list tr');

        rows.forEach(row => {
            const nombre = row.cells[0].textContent.toLowerCase();
            const email = row.cells[1].textContent.toLowerCase();
            
            if (nombre.includes(term) || email.includes(term)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
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

// --- ELIMINAR ALUMNO ---
window.eliminarAlumno = async (id) => {
    if(confirm("¿Seguro que desea eliminar este alumno?")) {
        try {
            await deleteDoc(doc(db, "alumnos", id));
        } catch (error) { console.error(error); }
    }
};

// --- CONFIGURACIÓN DE DISCIPLINAS (DINÁMICO) ---
const disciplinas = [
    { id: 'reformer', nombre: 'Pilates Reformer' },
    { id: 'hiit', nombre: 'HIIT Barre' },
    { id: 'yoga', nombre: 'Yoga' }
];

const container = document.getElementById('disciplinas-container');

async function cargarConfiguracion() {
    if (!container) return;
    
    try {
        const docRef = doc(db, "configuracion", "clases");
        const docSnap = await getDoc(docRef);
        const data = docSnap.exists() ? docSnap.data() : {};

        container.innerHTML = ''; 

        disciplinas.forEach(dis => {
            const config = data[dis.id] || { vacantes: 5, inicio: "08:00", fin: "20:00", bloqueados: "" };
            
            const card = document.createElement('div');
            card.className = 'class-config-card';
            card.innerHTML = `
                <h4>${dis.nombre}</h4>
                <div class="input-group">
                    <label>Vacantes por hora:</label>
                    <input type="number" id="vacantes-${dis.id}" value="${config.vacantes}" class="select-filter">
                </div>
                <div class="input-group">
                    <label>Horario Inicio:</label>
                    <input type="time" id="inicio-${dis.id}" value="${config.inicio}" class="input-calendar">
                </div>
                <div class="input-group">
                    <label>Horario Fin:</label>
                    <input type="time" id="fin-${dis.id}" value="${config.fin}" class="input-calendar">
                </div>
                <div class="input-group">
                    <label>Horarios deshabilitados:</label>
                    <input type="text" id="bloqueados-${dis.id}" value="${config.bloqueados || ''}" 
                           placeholder="Ej: 12:00, 13:00" class="select-filter">
                    <small style="font-size: 0.7rem; color: #666;">Separar por coma las horas deshabilitadas.</small>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Error al cargar config:", error);
    }
}

cargarConfiguracion();

const btnSaveConfig = document.getElementById('btn-save-config');
if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', async () => {
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
            alert("¡Configuración guardada!");
        } catch (error) {
            alert("Error al guardar");
        }
    });
}

// ... (Tus imports y config inicial se mantienen igual)

// --- LÓGICA DE CARGA DE CRÉDITOS (EL ERROR) ---
if (creditsForm) {
    creditsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const studentId = document.getElementById('select-student-credits').value;
        const amount = parseInt(document.getElementById('input-credits-amount').value);

        if (!studentId || isNaN(amount)) {
            alert("Por favor seleccione un alumno y una cantidad válida.");
            return;
        }

        try {
            const studentRef = doc(db, "alumnos", studentId);
            await updateDoc(studentRef, {
                creditos: increment(amount)
            });

            alert(`¡Éxito! Se cargaron ${amount} créditos.`);
            creditsForm.reset();
            closeModal('modal-credits');
        } catch (error) {
            console.error("Error al cargar créditos:", error);
            alert("Hubo un error al procesar la carga.");
        }
    });
}

// --- MINI-BUSCADOR PARA EL MODAL DE CRÉDITOS ---
// Esto filtra las opciones del SELECT mientras escribes en un input
const searchInModal = document.getElementById('search-student-modal');
if (searchInModal) {
    searchInModal.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const options = studentSelect.options;

        for (let i = 1; i < options.length; i++) { // Empezamos en 1 para omitir el placeholder
            const text = options[i].text.toLowerCase();
            options[i].style.display = text.includes(term) ? "" : "none";
        }
    });
}

// --- ELIMINAR ALUMNO CON EFECTO VISUAL ---
window.eliminarAlumno = async (id) => {
    // Buscamos la fila en la tabla para aplicar el efecto
    const rows = document.querySelectorAll('#student-list tr');
    let targetRow = null;
    
    // Identificamos la fila correcta (podrías agregar data-id="${id}" al TR para que sea más fácil)
    rows.forEach(row => {
        if (row.innerHTML.includes(id)) targetRow = row; 
    });

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
            if (targetRow) targetRow.classList.remove('row-confirm-delete');
        }
    }, 100);
};