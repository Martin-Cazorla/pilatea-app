import { db } from './config/firebase.js';
import {
    collection, onSnapshot, query, where, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { requireAdmin } from './utils/guards.js';
import { fechaArgentina, inicioClaseMs, cancelarReservaComoAdmin } from './utils/turnos.js';
import { confirmar, avisar } from './modals.js';

// SEGURIDAD: nada de lo que sigue corre hasta confirmar que el usuario es admin.
await requireAdmin();

// =====================================================================
// PESTAÑAS: Gestión Diaria / Configuración de Sistema, en la misma página
// =====================================================================
const tabs = Array.from(document.querySelectorAll('.admin-nav-tabs [role="tab"]'));
let configCargada = null;

function cargarConfiguracion() {
    // El módulo de configuración se carga recién la primera vez que se abre la pestaña.
    if (!configCargada) {
        configCargada = import('./admin-config.js').catch((e) => {
            console.error(e);
            configCargada = null;
            avisar("No se pudo cargar la configuración.", 'error');
        });
    }
    return configCargada;
}

function mostrarTab(nombre, { foco = false, actualizarUrl = true } = {}) {
    const tab = tabs.find(t => t.dataset.tab === nombre) || tabs[0];
    tabs.forEach(t => {
        const activa = t === tab;
        t.classList.toggle('active', activa);
        t.setAttribute('aria-selected', String(activa));
        t.tabIndex = activa ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !activa;
    });
    if (foco) tab.focus();
    if (actualizarUrl) {
        const hash = tab.dataset.tab === 'config' ? '#config' : '';
        history.replaceState(null, '', location.pathname + location.search + hash);
    }
    if (tab.dataset.tab === 'config') cargarConfiguracion();
}

tabs.forEach((t, i) => {
    t.addEventListener('click', () => mostrarTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
        const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        mostrarTab(tabs[(i + dir + tabs.length) % tabs.length].dataset.tab, { foco: true });
    });
});
window.addEventListener('hashchange', () => mostrarTab(location.hash === '#config' ? 'config' : 'diaria', { actualizarUrl: false }));
mostrarTab(location.hash === '#config' ? 'config' : 'diaria', { actualizarUrl: false });

// =====================================================================
// GESTIÓN DIARIA
// =====================================================================
const DISCIPLINAS = [
    { id: 'reformer', nombre: 'Pilates Reformer' },
    { id: 'hiit', nombre: 'HIIT Barre' },
    { id: 'yoga', nombre: 'Yoga' }
];
const nombreDisciplina = (id) => DISCIPLINAS.find(d => d.id === id)?.nombre || id || 'Clase';
const DURACION_CLASE_MS = 60 * 60 * 1000; // los turnos son de una hora

const dateFilter = document.getElementById('filter-date');
const classFilter = document.getElementById('filter-class');
const statusChips = Array.from(document.querySelectorAll('#filter-status .chip'));
const dashClases = document.getElementById('dash-clases-hoy');
const dashAlumnos = document.getElementById('dash-alumnos-totales');
const dashCupos = document.getElementById('dash-cupos-hoy');
const scheduleContainer = document.getElementById('daily-schedule-container');

const estado = {
    fecha: fechaArgentina(),
    disciplina: 'all',
    filtro: 'todas',
    config: null,       // configuracion/clases
    calendario: null,   // configuracion/calendario
    reservas: [],
    cargando: true
};
dateFilter.value = estado.fecha;

const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const horaLabel = (h) => `${String(h).padStart(2, '0')}:00`;

/** Estado de una clase según la hora actual en Argentina. */
function estadoClase(fecha, hora, ahora = Date.now()) {
    const inicio = inicioClaseMs(fecha, hora);
    if (ahora >= inicio + DURACION_CLASE_MS) return 'terminada';
    if (ahora >= inicio) return 'en-curso';
    return 'proxima';
}

/** Arma la lista de clases del día (disciplina + horario) con sus alumnos. */
function armarClases() {
    const { config, fecha, disciplina, reservas } = estado;
    const ids = disciplina === 'all' ? DISCIPLINAS.map(d => d.id) : [disciplina];
    const clases = new Map();

    ids.forEach(id => {
        const c = config?.[id];
        if (!c) return;
        const hIn = parseInt(c.inicio?.split(':')[0]);
        const hFi = parseInt(c.fin?.split(':')[0]);
        if (Number.isNaN(hIn) || Number.isNaN(hFi)) return;
        const bloqueados = (c.bloqueados || '').split(',').map(h => h.trim());
        for (let h = hIn; h <= hFi; h++) {
            const hora = horaLabel(h);
            if (bloqueados.includes(hora)) continue;
            clases.set(`${id}_${hora}`, { disciplinaId: id, hora, vacantes: Number(c.vacantes) || 0, alumnos: [] });
        }
    });

    // Reservas de un horario que después se bloqueó o quedó fuera de rango: se muestran igual.
    reservas.forEach(r => {
        if (!ids.includes(r.disciplinaId) || !r.hora) return;
        const key = `${r.disciplinaId}_${r.hora}`;
        if (!clases.has(key)) {
            clases.set(key, { disciplinaId: r.disciplinaId, hora: r.hora, vacantes: Number(config?.[r.disciplinaId]?.vacantes) || 0, alumnos: [], fueraDeHorario: true });
        }
        clases.get(key).alumnos.push(r);
    });

    const ahora = Date.now();
    return Array.from(clases.values())
        .map(c => ({ ...c, estado: estadoClase(fecha, c.hora, ahora) }))
        .sort((a, b) => a.hora.localeCompare(b.hora) || ids.indexOf(a.disciplinaId) - ids.indexOf(b.disciplinaId));
}

const FILTROS = {
    'todas': () => true,
    'con-alumnos': c => c.alumnos.length > 0,
    'proximas': c => c.estado !== 'terminada',
    'terminadas': c => c.estado === 'terminada'
};

const MENSAJES_VACIO = {
    'todas': 'No hay clases configuradas para esta selección.',
    'con-alumnos': 'Ninguna clase tiene alumnos anotados este día.',
    'proximas': 'No quedan clases por dar este día.',
    'terminadas': 'Todavía no terminó ninguna clase este día.'
};

function diaCerrado() {
    const cal = estado.calendario;
    if (!cal) return false;
    const [y, m, d] = estado.fecha.split('-').map(Number);
    const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const feriados = (cal.deshabilitados || '').split(',').map(s => s.trim());
    return feriados.includes(estado.fecha) || (Array.isArray(cal.diasLaborales) && !cal.diasLaborales.includes(diaSemana));
}

function render() {
    if (!scheduleContainer) return;
    if (estado.cargando || estado.config === null) return;

    const clases = armarClases();

    // KPIs: reservas y cupos libres del día para la clase elegida
    const totalReservas = clases.reduce((n, c) => n + c.alumnos.length, 0);
    const cuposLibres = clases.reduce((n, c) => n + Math.max(0, c.vacantes - c.alumnos.length), 0);
    dashClases.textContent = totalReservas;
    dashCupos.textContent = cuposLibres;

    // Contadores en los filtros
    statusChips.forEach(chip => {
        const n = clases.filter(FILTROS[chip.dataset.estado]).length;
        chip.querySelector('.chip-count').textContent = n;
    });

    const visibles = clases.filter(FILTROS[estado.filtro]);
    const mostrarDisciplina = estado.disciplina === 'all';
    const avisoCerrado = diaCerrado()
        ? `<p class="schedule-notice"><i class="fa-solid fa-store-slash"></i> El estudio figura cerrado este día según la configuración.</p>`
        : '';

    if (!visibles.length) {
        scheduleContainer.innerHTML = `${avisoCerrado}<div class="empty-state"><i class="fa-regular fa-calendar"></i><p>${MENSAJES_VACIO[estado.filtro]}</p></div>`;
        return;
    }

    const etiquetas = { 'terminada': 'Terminada', 'en-curso': 'En curso', 'proxima': 'Próxima' };

    scheduleContainer.innerHTML = avisoCerrado + visibles.map(c => {
        const ocupacion = c.alumnos.length;
        const lleno = c.vacantes > 0 && ocupacion >= c.vacantes;
        const pct = c.vacantes > 0 ? Math.min(100, Math.round(ocupacion / c.vacantes * 100)) : 0;
        return `
        <article class="time-block-card is-${c.estado} ${lleno ? 'full' : ''}">
            <div class="time-header">
                <div class="time-title">
                    <span class="time-badge">${escapar(c.hora)} hs</span>
                    ${mostrarDisciplina ? `<span class="discipline-tag tag-${escapar(c.disciplinaId)}">${escapar(nombreDisciplina(c.disciplinaId))}</span>` : ''}
                </div>
                <span class="status-pill status-${c.estado}">${etiquetas[c.estado]}</span>
            </div>
            <div class="occupancy">
                <span class="occupancy-info"><i class="fa-solid fa-users"></i> ${ocupacion} / ${c.vacantes}${lleno ? ' · Completa' : ''}</span>
                <div class="occupancy-bar"><span style="width:${pct}%"></span></div>
            </div>
            ${c.fueraDeHorario ? '<p class="slot-warning"><i class="fa-solid fa-circle-info"></i> Horario fuera de la configuración actual</p>' : ''}
            <ul class="student-mini-list">
                ${c.alumnos.map(res => `
                    <li>
                        <span class="student-name"><i class="fa-regular fa-user"></i> ${escapar(res.alumnoNombre || 'Alumno')}</span>
                        <button type="button" class="btn-cancel-mini" title="Cancelar reserva y devolver crédito"
                            aria-label="Cancelar reserva de ${escapar(res.alumnoNombre || 'alumno')}"
                            data-reserva="${escapar(res.id)}" data-alumno="${escapar(res.alumnoId)}">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </li>`).join('')}
                ${ocupacion === 0 ? '<li class="empty-slot">Sin alumnos</li>' : ''}
            </ul>
        </article>`;
    }).join('');
}

// --- Datos en vivo ---
onSnapshot(doc(db, "configuracion", "clases"), (snap) => {
    estado.config = snap.exists() ? snap.data() : {};
    render();
}, (e) => console.error(e));

onSnapshot(doc(db, "configuracion", "calendario"), (snap) => {
    estado.calendario = snap.exists() ? snap.data() : null;
    render();
}, (e) => console.error(e));

let cortarReservas = null;
function escucharReservas() {
    if (cortarReservas) cortarReservas();
    estado.cargando = true;
    scheduleContainer.innerHTML = '<p class="loading-text">Cargando cronograma del día...</p>';
    const fecha = estado.fecha;
    const q = query(collection(db, "reservas"), where("fecha", "==", fecha));
    cortarReservas = onSnapshot(q, (snapshot) => {
        if (fecha !== estado.fecha) return;
        estado.reservas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        estado.cargando = false;
        render();
    }, (e) => {
        console.error(e);
        scheduleContainer.innerHTML = '<div class="empty-state"><p>No se pudieron cargar las reservas.</p></div>';
    });
}

onSnapshot(collection(db, "alumnos"), (snapshot) => {
    if (dashAlumnos) dashAlumnos.textContent = snapshot.size;
});

// --- Filtros ---
dateFilter.addEventListener('change', () => {
    if (!dateFilter.value) return;
    estado.fecha = dateFilter.value;
    escucharReservas();
});
classFilter.addEventListener('change', () => {
    estado.disciplina = classFilter.value;
    render();
});
statusChips.forEach(chip => chip.addEventListener('click', () => {
    estado.filtro = chip.dataset.estado;
    statusChips.forEach(c => {
        const activo = c === chip;
        c.classList.toggle('active', activo);
        c.setAttribute('aria-checked', String(activo));
    });
    render();
}));

// Las clases pasan de "próxima" a "terminada" con el reloj: se recalcula cada minuto.
setInterval(render, 60 * 1000);

// --- Cancelar reserva desde la grilla ---
scheduleContainer.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-cancel-mini');
    if (!btn) return;
    const { reserva, alumno } = btn.dataset;
    const nombre = btn.closest('li')?.querySelector('.student-name')?.textContent.trim() || 'el alumno';
    const ok = await confirmar({
        titulo: 'Cancelar reserva',
        mensaje: `Se libera el lugar y se le devuelve el crédito a ${nombre}.`,
        aceptar: 'Sí, cancelar',
        cancelar: 'Volver',
        peligro: true
    });
    if (!ok) return;
    btn.disabled = true;
    try {
        const snap = await getDoc(doc(db, "reservas", reserva));
        if (!snap.exists()) return avisar("Esa reserva ya no existe.", 'info');
        // Borra la reserva, libera el cupo del turno y devuelve el crédito, todo junto.
        await cancelarReservaComoAdmin(db, { id: reserva, alumnoId: alumno, ...snap.data() });
        avisar("Reserva cancelada y crédito devuelto.");
    } catch (err) {
        console.error(err);
        avisar("No se pudo cancelar la reserva.", 'error');
        btn.disabled = false;
    }
});

escucharReservas();
