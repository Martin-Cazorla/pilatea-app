import { db, auth } from './config/firebase.js'; 
import { 
    doc, getDoc, collection, query, where, getDocs, 
    updateDoc, increment, addDoc, onSnapshot, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Referencias DOM
const grid = document.getElementById('time-slots-grid');
const userWelcome = document.getElementById('user-welcome');
const dateDisplay = document.getElementById('selected-date-display');
const daysContainer = document.getElementById('calendar-days');
const monthYearText = document.getElementById('calendar-month-year');
const reservationList = document.getElementById('reservation-list');
const classSelect = document.getElementById('class-select');

// Estado
let currentUser = null;
let userCredits = 0;
let currentDate = new Date(); 
let selectedDate = new Date(); 

// --- FUNCIONES DE INTERFAZ ---

function updateDateDisplay() {
    if (!dateDisplay) return;
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const formattedDate = selectedDate.toLocaleDateString('es-ES', options);
    dateDisplay.innerText = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
}

function renderCalendar() {
    if (!daysContainer || !monthYearText) return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    monthYearText.innerText = `${new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(currentDate)} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    daysContainer.innerHTML = '';

    for (let x = 0; x < firstDayIndex; x++) {
        const div = document.createElement('div');
        div.classList.add('day', 'empty');
        daysContainer.appendChild(div);
    }

    for (let i = 1; i <= lastDay; i++) {
        const dayBtn = document.createElement('button');
        dayBtn.classList.add('day');
        dayBtn.innerText = i;
        const dateToCheck = new Date(year, month, i);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const today = new Date(); today.setHours(0,0,0,0);

        if (dateToCheck < today) {
            dayBtn.classList.add('past-day');
            dayBtn.disabled = true;
        } else {
            dayBtn.onclick = () => {
                selectedDate = new Date(year, month, i);
                updateDateDisplay();
                renderCalendar();
                generateSlots(dateStr);
            };
        }
        if (dateStr === today.toISOString().split('T')[0]) dayBtn.classList.add('today');
        if (dateStr === selectedDate.toISOString().split('T')[0]) dayBtn.classList.add('active');
        daysContainer.appendChild(dayBtn);
    }
}

// --- LÓGICA DE FIREBASE ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        onSnapshot(doc(db, "alumnos", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                userCredits = data.creditos || 0;
                userWelcome.innerHTML = `Hola, <strong>${data.nombre}</strong> (Créditos: ${userCredits})`;
            }
        });

        const urlParams = new URLSearchParams(window.location.search);
        const claseURL = urlParams.get('clase');
        if (claseURL && classSelect) {
            classSelect.value = claseURL;
        }

        fetchUserReservations();
        renderCalendar();
        updateDateDisplay();
        
        const todayStr = selectedDate.toISOString().split('T')[0];
        generateSlots(todayStr);

    } else {
        window.location.href = "login.html";
    }
});

if(classSelect) {
    classSelect.addEventListener('change', () => {
        generateSlots(selectedDate.toISOString().split('T')[0]);
    });
}

async function fetchUserReservations() {
    const q = query(collection(db, "reservas"), where("alumnoId", "==", currentUser.uid));
    onSnapshot(q, (snapshot) => {
        reservationList.innerHTML = '';
        snapshot.forEach((doc) => {
            const res = doc.data();
            const li = document.createElement('li');
            li.className = 'reservation-item';
            li.innerHTML = `
                <div class="res-info">
                    <span class="res-date">${res.fecha}</span>
                    <span class="res-time">${res.hora}hs - <strong>${res.disciplina || 'Clase'}</strong></span>
                </div>
                <button class="btn-cancel" data-id="${doc.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            li.querySelector('.btn-cancel').onclick = () => handleCancel(doc.id);
            reservationList.appendChild(li);
        });
    });
}

async function handleReservation(time, dateStr) {
    if (userCredits <= 0) return alert("No tenés créditos disponibles.");
    const selectedClassName = classSelect.options[classSelect.selectedIndex].text;
    const selectedClassId = classSelect.value;

    try {
        const qDuplicado = query(collection(db, "reservas"), 
            where("fecha", "==", dateStr), 
            where("hora", "==", time), 
            where("alumnoId", "==", currentUser.uid),
            where("disciplinaId", "==", selectedClassId));
            
        const snap = await getDocs(qDuplicado);
        if (!snap.empty) return alert(`Ya tenés una reserva para esta clase.`);

        if (!confirm(`¿Confirmar reserva para ${selectedClassName}?`)) return;

        await updateDoc(doc(db, "alumnos", currentUser.uid), { creditos: increment(-1) });
        await addDoc(collection(db, "reservas"), {
            alumnoId: currentUser.uid,
            alumnoNombre: userWelcome.querySelector('strong').innerText,
            fecha: dateStr,
            hora: time,
            disciplina: selectedClassName,
            disciplinaId: selectedClassId,
            fechaCreacion: new Date()
        });
        alert("¡Reserva confirmada!");
        generateSlots(dateStr);
    } catch (e) { console.error(e); }
}

async function handleCancel(reservationId) {
    if (!confirm("¿Querés cancelar esta clase?")) return;
    try {
        await deleteDoc(doc(db, "reservas", reservationId));
        await updateDoc(doc(db, "alumnos", currentUser.uid), { creditos: increment(1) });
        generateSlots(selectedDate.toISOString().split('T')[0]);
    } catch (e) { alert("Error al cancelar."); }
}

async function generateSlots(dateStr) {
    if (!grid) return;
    grid.innerHTML = "<p>Cargando horarios...</p>";

    try {
        // 1. CONSULTA DE CONTROL TOTAL (Calendario y Días Laborales)
        const calSnap = await getDoc(doc(db, "configuracion", "calendario"));
        if (calSnap.exists()) {
            const data = calSnap.data();
            const fechaSeleccionada = new Date(dateStr + "T00:00:00");
            const diaSemana = fechaSeleccionada.getDay(); // 0-6
            const feriados = (data.deshabilitados || "").split(',').map(d => d.trim());

            // Verificamos si el día de la semana está habilitado (Control Total)
            if (data.diasLaborales && !data.diasLaborales.includes(diaSemana)) {
                grid.innerHTML = `
                    <div class="closed-msg" style="text-align:center; padding:20px;">
                        <i class="fa-solid fa-calendar-minus" style="font-size:2rem; color:#888;"></i>
                        <p>El estudio no abre este día de la semana.</p>
                    </div>`;
                return;
            }

            // Verificamos si es un feriado específico
            if (feriados.includes(dateStr)) {
                grid.innerHTML = `
                    <div class="closed-msg" style="text-align:center; padding:20px;">
                        <i class="fa-solid fa-mug-hot" style="font-size:2rem; color:#5d4037;"></i>
                        <p>Cerrado por feriado o mantenimiento.</p>
                    </div>`;
                return;
            }
        }

        // 2. OBTENER CONFIGURACIÓN DE DISCIPLINAS
        const selectedClassId = classSelect ? classSelect.value : 'reformer';
        const configSnap = await getDoc(doc(db, "configuracion", "clases"));
        const configAll = configSnap.exists() ? configSnap.data() : {};
        const config = configAll[selectedClassId] || { inicio: "08:00", fin: "20:00", vacantes: 5 };

        // 3. CONSULTA DE OCUPACIÓN
        const q = query(collection(db, "reservas"), 
                        where("fecha", "==", dateStr),
                        where("disciplinaId", "==", selectedClassId));
        const snap = await getDocs(q);
        const ocupacion = {};
        snap.forEach(d => {
            ocupacion[d.data().hora] = (ocupacion[d.data().hora] || 0) + 1;
        });

        // 4. RENDERIZADO DE SLOTS
        grid.innerHTML = '';
        const hInicio = parseInt(config.inicio.split(':')[0]) || 8;
        const hFin = parseInt(config.fin.split(':')[0]) || 20;
        const bloqueados = (config.bloqueados || "").split(',').map(h => h.trim());

        for (let h = hInicio; h <= hFin; h++) {
            const label = `${h.toString().padStart(2, '0')}:00`;
            if (bloqueados.includes(label)) continue;

            const cupos = Number(config.vacantes) - (ocupacion[label] || 0);
            const btn = document.createElement('button');
            btn.className = 'btn-slot';

            if (cupos <= 0) {
                btn.classList.add('btn-full'); btn.disabled = true;
                btn.innerHTML = `<span>${label}hs</span><small>LLENO</small>`;
            } else {
                btn.innerHTML = `<span>${label}hs</span><small>Cupos: ${cupos}</small>`;
                btn.onclick = () => handleReservation(label, dateStr);
            }
            grid.appendChild(btn);
        }
    } catch (error) {
        console.error("Error:", error);
        grid.innerHTML = "<p>Error al cargar horarios.</p>";
    }
}

// Navegación Calendario
document.getElementById('prev-month').onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
document.getElementById('next-month').onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };