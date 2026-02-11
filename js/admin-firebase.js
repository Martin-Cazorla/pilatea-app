import { initializeApp } from "firebase/app";
import { 
    getFirestore, collection, onSnapshot, 
    doc, deleteDoc, updateDoc, increment, setDoc 
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
// --- GUARDAR CONFIGURACIÓN DE CLASES ---
const btnSaveConfig = document.getElementById('btn-save-config');
if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', async () => {
        const vacantes = document.getElementById('config-vacantes').value;
        const horaInicio = document.getElementById('config-inicio').value;
        const horaFin = document.getElementById('config-fin').value;

        try {
            await setDoc(doc(db, "configuracion", "clases"), {
                vacantes: parseInt(vacantes),
                horaInicio: horaInicio,
                horaFin: horaFin
            });
            alert("Configuración guardada correctamente");
        } catch (error) {
            console.error("Error al guardar config:", error);
            alert("Error al guardar la configuración");
        }
    });
}