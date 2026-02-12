import { initializeApp } from "firebase/app";
import { 
    getFirestore, collection, onSnapshot, 
    doc, deleteDoc, updateDoc, increment, setDoc 
} from "firebase/firestore";
// Agregamos createUserWithEmailAndPassword a la lista de importados
import { 
    getAuth, 
    signInWithEmailAndPassword, 
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

// Inicialización de servicios
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Referencias del DOM
const studentForm = document.getElementById('form-add-student');
const studentTableBody = document.getElementById('student-list');
const creditsForm = document.getElementById('form-add-credits');
const studentSelect = document.getElementById('select-student-credits');

// --- GESTIÓN DE ALUMNOS (Lectura en tiempo real) ---
onSnapshot(collection(db, "alumnos"), (snapshot) => {
    studentTableBody.innerHTML = '';
    studentSelect.innerHTML = '<option value="">Seleccione un alumno...</option>';
    
    snapshot.forEach((docSnap) => {
        const alumno = docSnap.data();
        const id = docSnap.id;
        
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

        const option = document.createElement('option');
        option.value = id;
        option.textContent = alumno.nombre;
        studentSelect.appendChild(option);
    });
});

// --- GUARDAR ALUMNO NUEVO ---
if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = studentForm.querySelector('input[type="text"]').value;
        const email = studentForm.querySelector('input[type="email"]').value;
        const passwordGenerica = "Pilatea2026"; 

        try {
            // 1. Crear usuario en la pestaña Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, passwordGenerica);
            const user = userCredential.user;

            // 2. Guardar datos adicionales en Firestore
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
            console.error("Error completo:", error);
            alert("Error: " + error.message);
        }
    });
}

// --- ELIMINAR ALUMNO ---
window.eliminarAlumno = async (id) => {
    if(confirm("¿Seguro que desea eliminar este alumno? Se borrará de la base de datos.")) {
        try {
            await deleteDoc(doc(db, "alumnos", id));
        } catch (error) { console.error("Error al eliminar:", error); }
    }
};

// --- CARGAR CRÉDITOS ---
if (creditsForm) {
    creditsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentId = studentSelect.value;
        const amount = parseInt(document.getElementById('input-credits-amount').value);
        
        if (!studentId) return alert("Seleccione un alumno");

        try {
            await updateDoc(doc(db, "alumnos", studentId), {
                creditos: increment(amount)
            });
            alert("Créditos actualizados con éxito");
            creditsForm.reset();
            if (typeof closeModal === 'function') closeModal('modal-credits');
        } catch (error) { console.error("Error créditos:", error); }
    });
}
// --- CONFIGURACIÓN DE DISCIPLINAS ---
const disciplinas = [
    { id: 'reformer', nombre: 'Pilates Reformer' },
    { id: 'hiit', nombre: 'HIIT Barre' },
    { id: 'yoga', nombre: 'Yoga' }
];

const container = document.getElementById('disciplinas-container');

// Función para cargar y mostrar la configuración actual
async function cargarConfiguracion() {
    if (!container) return;
    
    // Obtenemos la config actual de la base de datos
    const docRef = doc(db, "configuracion", "clases");
    const docSnap = await getDoc(docRef);
    const data = docSnap.exists() ? docSnap.data() : {};

    container.innerHTML = ''; // Limpiamos

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
                <label>Horarios deshabilitados (ej: 12:00, 13:00):</label>
                <input type="text" id="bloqueados-${dis.id}" value="${config.bloqueados || ''}" 
                       placeholder="12:00, 13:00" class="select-filter">
                <small>Separar por coma las horas que no se darán clase</small>
            </div>
        `;
        container.appendChild(card);
    });
}

// Ejecutar carga al iniciar
cargarConfiguracion();

// --- GUARDAR TODA LA CONFIGURACIÓN ---
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
            alert("¡Configuración actualizada para todas las disciplinas!");
        } catch (error) {
            console.error("Error al guardar:", error);
            alert("Error al guardar la configuración");
        }
    });
}