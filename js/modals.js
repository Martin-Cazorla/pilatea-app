// Modales y diálogos del panel de staff, con el mismo estilo que el resto del sitio.
// - abrirModal / cerrarModal: para los modales que ya están en el HTML (.modal-overlay).
//   Botones con data-open-modal="id" o data-close-modal los abren y cierran solos.
// - confirmar(): reemplaza al confirm() del navegador. Devuelve una Promise<boolean>.
// - avisar(): reemplaza al alert(). Muestra un aviso abajo que se va solo.

let ultimoFoco = null;

const modalAbierto = () => document.querySelector('.modal-overlay.is-open');

export function abrirModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    ultimoFoco = document.activeElement;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const primero = overlay.querySelector('input:not([type=hidden]), select, textarea, button:not(.close-modal)');
    if (primero) setTimeout(() => primero.focus(), 50);
    overlay.dispatchEvent(new CustomEvent('modal:abierto'));
}

export function cerrarModal(id) {
    const overlay = typeof id === 'string' ? document.getElementById(id) : id;
    if (!overlay || !overlay.classList.contains('is-open')) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    if (!modalAbierto()) document.body.classList.remove('modal-open');
    overlay.dispatchEvent(new CustomEvent('modal:cerrado'));
    if (ultimoFoco && document.contains(ultimoFoco)) ultimoFoco.focus();
}

document.addEventListener('click', (e) => {
    const abrir = e.target.closest('[data-open-modal]');
    if (abrir) return abrirModal(abrir.dataset.openModal);

    const cerrar = e.target.closest('[data-close-modal]');
    if (cerrar) return cerrarModal(cerrar.closest('.modal-overlay'));

    // Clic en el fondo oscuro (fuera de la tarjeta)
    if (e.target.classList?.contains('modal-overlay')) cerrarModal(e.target);
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const abierto = modalAbierto();
    if (abierto) cerrarModal(abierto);
});

// ---------- Confirmación ----------

/**
 * Diálogo de confirmación con el estilo del sitio.
 * @returns {Promise<boolean>}
 */
export function confirmar({
    titulo = '¿Confirmás?',
    mensaje = '',
    aceptar = 'Confirmar',
    cancelar = 'Cancelar',
    peligro = false,
    icono = peligro ? 'fa-triangle-exclamation' : 'fa-circle-question'
} = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay modal-confirm';
        overlay.id = `confirm-${Date.now()}`;
        overlay.innerHTML = `
            <div class="modal-content modal-sm" role="alertdialog" aria-modal="true">
                <div class="modal-body modal-body-center">
                    <span class="modal-icon modal-icon-lg ${peligro ? 'is-danger' : ''}"><i class="fa-solid ${icono}"></i></span>
                    <h3 class="confirm-title"></h3>
                    <p class="confirm-text"></p>
                    <div class="modal-actions">
                        <button type="button" class="btn-ghost" data-r="0"></button>
                        <button type="button" class="${peligro ? 'btn-danger' : 'btn-primary'}" data-r="1"></button>
                    </div>
                </div>
            </div>`;
        overlay.querySelector('.confirm-title').textContent = titulo;
        overlay.querySelector('.confirm-text').textContent = mensaje;
        overlay.querySelector('[data-r="0"]').textContent = cancelar;
        overlay.querySelector('[data-r="1"]').textContent = aceptar;
        document.body.appendChild(overlay);

        let respuesta = false;
        overlay.addEventListener('click', (e) => {
            const b = e.target.closest('[data-r]');
            if (!b) return;
            respuesta = b.dataset.r === '1';
            cerrarModal(overlay);
        });
        overlay.addEventListener('modal:cerrado', () => {
            setTimeout(() => overlay.remove(), 250);
            resolve(respuesta);
        }, { once: true });

        abrirModal(overlay.id);
        setTimeout(() => overlay.querySelector('[data-r="1"]').focus(), 60);
    });
}

// ---------- Avisos (toasts) ----------

let toastHost = null;

/**
 * Aviso breve abajo de la pantalla.
 * @param {string} mensaje
 * @param {'exito'|'error'|'info'} tipo
 */
export function avisar(mensaje, tipo = 'exito', duracionMs = 4500) {
    if (!toastHost) {
        toastHost = document.createElement('div');
        toastHost.className = 'toast-host';
        toastHost.setAttribute('role', 'status');
        toastHost.setAttribute('aria-live', 'polite');
        document.body.appendChild(toastHost);
    }
    const iconos = { exito: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.innerHTML = `<i class="fa-solid ${iconos[tipo] || iconos.info}"></i><span></span>
        <button type="button" class="toast-close" aria-label="Cerrar aviso">&times;</button>`;
    t.querySelector('span').textContent = mensaje;
    toastHost.appendChild(t);
    requestAnimationFrame(() => t.classList.add('is-visible'));

    const quitar = () => {
        t.classList.remove('is-visible');
        setTimeout(() => t.remove(), 300);
    };
    t.querySelector('.toast-close').addEventListener('click', quitar);
    setTimeout(quitar, duracionMs);
}
