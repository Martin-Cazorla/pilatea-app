import { db, auth } from './config/firebase.js';
import {
    doc, getDoc, collection, query, where, getDocs, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    fechaArgentina, fechaStr, claseYaEmpezo, turnoIdDe, reservaIdDe,
    reservarClase, cancelarReserva, ReservaError, VACANTES_POR_DEFECTO
} from './utils/turnos.js';

// Referencias DOM
const grid = document.getElementById('time-slots-grid');
const userWelcome = document.getElementById('user-welcome');
const dateDisplay = document.getElementById('selected-date-display');
const daysContainer = document.getElementById('calendar-days');
const monthYearText = document.getElementById('calendar-month-year');
const reservationList = document.getElementById('reservation-list');
const classSelect = document.getElementById('class-select');

// Estado. Las fechas se manejan como 'YYYY-MM-DD' en hora de Argentina,
// sin importar la zona horaria del dispositivo del alumno.
let currentUser = null;
let userCredits = 0;
let userName = '';
let selectedDateStr = fechaArgentina();
const [hoyY, hoyM] = selectedDateStr.split('-').map(Number);
let calYear = hoyY;
let calMonth = hoyM - 1; // 0-11
let misReservas = new Map(); // id -> datos

// Para mostrar una fecha 'YYYY-MM-DD' sin que la zona horaria la corra de día.
const fechaComoDate = (str) => new Date(`${str}T12:00:00Z`);

// --- FUNCIONES DE INTERFAZ ---

function updateDateDisplay() {
    if (!dateDisplay) return;
    const options = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' };
    const formattedDate = fechaComoDate(selectedDateStr).toLocaleDateString('es-AR', options);
    dateDisplay.innerText = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
}

function renderCalendar() {
    if (!daysContainer || !monthYearText) return;
    const year = calYear;
    const month = calMonth;
    const nombreMes = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' })
        .format(new Date(Date.UTC(year, month, 15)));
    monthYearText.innerText = `${nombreMes} ${year}`;

    const firstDayIndex = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const todayStr = fechaArgentina();
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
        const dateStr = fechaStr(year, month, i);

        // Las fechas 'YYYY-MM-DD' se pueden comparar como texto.
        if (dateStr < todayStr) {
            dayBtn.classList.add('past-day');
            dayBtn.disabled = true;
        } else {
            dayBtn.onclick = () => {
                selectedDateStr = dateStr;
                updateDateDisplay();
                renderCalendar();
                generateSlots(dateStr);
            };
        }
        if (dateStr === todayStr) dayBtn.classList.add('today');
        if (dateStr === selectedDateStr) dayBtn.classList.add('active');
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
                userName = data.nombre || '';
                userWelcome.innerHTML = `Hola, <strong></strong> (Créditos: ${userCredits})`;
                userWelcome.querySelector('strong').textContent = userName;
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
        generateSlots(selectedDateStr);

    } else {
        window.location.href = "login.html";
    }
});

if(classSelect) {
    classSelect.addEventListener('change', () => {
        generateSlots(selectedDateStr);
    });
}

function fetchUserReservations() {
    const q = query(collection(db, "reservas"), where("alumnoId", "==", currentUser.uid));
    onSnapshot(q, (snapshot) => {
        misReservas = new Map();
        snapshot.forEach((d) => misReservas.set(d.id, { id: d.id, ...d.data() }));

        const ordenadas = [...misReservas.values()]
            .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));

        reservationList.innerHTML = '';
        ordenadas.forEach((res) => {
            const pasada = claseYaEmpezo(res.fecha, res.hora);
            const li = document.createElement('li');
            li.className = 'reservation-item';
            li.innerHTML = `
                <div class="res-info">
                    <span class="res-date"></span>
                    <span class="res-time"></span>
                </div>
                ${pasada
                    ? '<small class="res-done">Finalizada</small>'
                    : '<button class="btn-cancel" title="Cancelar"><i class="fa-solid fa-trash"></i></button>'}
            `;
            li.querySelector('.res-date').textContent = res.fecha;
            li.querySelector('.res-time').innerHTML = `${res.hora}hs - <strong></strong>`;
            li.querySelector('.res-time strong').textContent = res.disciplina || 'Clase';
            const btn = li.querySelector('.btn-cancel');
            if (btn) btn.onclick = () => handleCancel(res);
            reservationList.appendChild(li);
        });
    });
}

async function handleReservation(time, dateStr) {
    if (userCredits <= 0) return alert("No tenés créditos disponibles.");
    const selectedClassName = classSelect.options[classSelect.selectedIndex].text;
    const selectedClassId = classSelect.value;

    const reservaId = reservaIdDe(turnoIdDe(selectedClassId, dateStr, time), currentUser.uid);
    if (misReservas.has(reservaId)) return alert("Ya tenés una reserva para esta clase.");

    if (!confirm(`¿Confirmar reserva para ${selectedClassName}?`)) return;

    try {
        await reservarClase(db, {
            uid: currentUser.uid,
            nombre: userName,
            disciplinaId: selectedClassId,
            disciplina: selectedClassName,
            fecha: dateStr,
            hora: time
        });
        alert("¡Reserva confirmada!");
    } catch (e) {
        console.error(e);
        alert(e instanceof ReservaError ? e.message : "No se pudo reservar. Probá de nuevo.");
    } finally {
        generateSlots(dateStr);
    }
}

async function handleCancel(reserva) {
    if (!confirm("¿Querés cancelar esta clase?")) return;
    try {
        await cancelarReserva(db, { uid: currentUser.uid, reserva });
    } catch (e) {
        console.error(e);
        alert(e instanceof ReservaError ? e.message : "Error al cancelar.");
    } finally {
        generateSlots(selectedDateStr);
    }
}

async function generateSlots(dateStr) {
    if (!grid) return;
    grid.innerHTML = "<p>Cargando horarios...</p>";
    grid.scrollTop = 0;

    try {
        // 1. CONSULTA DE CONTROL TOTAL (Calendario y Días Laborales)
        const calSnap = await getDoc(doc(db, "configuracion", "calendario"));
        if (calSnap.exists()) {
            const data = calSnap.data();
            const diaSemana = fechaComoDate(dateStr).getUTCDay(); // 0-6, domingo = 0
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
        const config = { inicio: "08:00", fin: "20:00", vacantes: VACANTES_POR_DEFECTO, ...configAll[selectedClassId] };

        // 3. CONSULTA DE OCUPACIÓN (contadores de /turnos)
        const q = query(collection(db, "turnos"),
                        where("fecha", "==", dateStr),
                        where("disciplinaId", "==", selectedClassId));
        const snap = await getDocs(q);
        const ocupacion = {};
        snap.forEach(d => {
            ocupacion[d.data().hora] = d.data().ocupados || 0;
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
            const yaReservada = misReservas.has(
                reservaIdDe(turnoIdDe(selectedClassId, dateStr, label), currentUser.uid));
            const btn = document.createElement('button');
            btn.className = 'btn-slot';

            if (claseYaEmpezo(dateStr, label)) {
                btn.classList.add('btn-full'); btn.disabled = true;
                btn.innerHTML = `<span>${label}hs</span><small>FINALIZADA</small>`;
            } else if (yaReservada) {
                btn.classList.add('btn-full'); btn.disabled = true;
                btn.innerHTML = `<span>${label}hs</span><small>RESERVADA</small>`;
            } else if (cupos <= 0) {
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
document.getElementById('prev-month').onclick = () => {
    if (--calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
};
document.getElementById('next-month').onclick = () => {
    if (++calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
};
