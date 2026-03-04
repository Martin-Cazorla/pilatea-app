import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import firebaseConfig from "../services/firebase-config.js";

// Inicializamos Firebase con tus credenciales nuevas
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const AuthService = {
    /**
     * Crea un usuario y le asigna un rol en Firestore
     * @param {string} email 
     * @param {string} password 
     * @param {string} role - 'admin' (profesor) o 'student' (alumno)
     */
    registerUser: async (email, password, role = 'student') => {
        try {
            // 1. Creamos el usuario en Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Guardamos el ROL en Firestore (base de datos persistente)
            // Usamos el UID del usuario como ID del documento
            await setDoc(doc(db, "users", user.uid), {
                email: email,
                role: role,
                createdAt: new Date()
            });

            console.log(`Usuario ${role} creado con éxito`);
            return user;
        } catch (error) {
            console.error("Error en registro:", error.code, error.message);
            throw error;
        }
    },

    /**
     * Obtiene los datos del usuario logueado, incluido su rol
     */
    getUserData: async (uid) => {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            console.log("No se encontraron datos del usuario en Firestore");
            return null;
        }
    },

    // Escucha cambios en el estado de autenticación
    subscribeToAuthChanges: (callback) => {
        onAuthStateChanged(auth, callback);
    }
};