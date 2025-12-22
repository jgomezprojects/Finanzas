// -----------------------------------------------------
// SISTEMA DE GUARDS - Protección de acciones
// Este archivo controla el acceso a acciones importantes
// -----------------------------------------------------

/**
 * Requiere que el usuario esté autenticado O en modo invitado para ejecutar una acción
 * 
 * Flujo de decisión:
 * 1. Si el usuario está logueado → ejecutar acción normalmente
 * 2. Si NO está logueado PERO está en modo invitado → ejecutar acción (sin guardar)
 * 3. Si NO está logueado Y NO está en modo invitado → mostrar modal y bloquear acción
 * 
 * Esta función usa SOLO la API pública de auth.js (authIsAuthenticated, authIsGuestMode)
 * NO accede a variables internas de auth.js
 * 
 * @param {Function} actionCallback - La función/acción a ejecutar si el usuario tiene permisos
 * @throws {Error} Si el callback no es una función válida
 */
function requireAuth(actionCallback) {
    // Validar que el callback sea una función
    if (typeof actionCallback !== 'function') {
        console.error('guards.js: requireAuth requiere una función como callback. Tipo recibido:', typeof actionCallback);
        return;
    }
    
    // Verificar si hay funciones de auth disponibles (usando API pública desde window)
    if (typeof window.authIsAuthenticated !== 'function') {
        console.warn('guards.js: authIsAuthenticated no está disponible. Ejecutando acción sin protección.');
        // Si no hay sistema de auth, ejecutar la acción directamente (fallback)
        actionCallback();
        return;
    }
    
    // Verificar si el usuario está logueado (usando API pública desde window)
    if (window.authIsAuthenticated()) {
        // Usuario autenticado: ejecutar la acción normalmente
        actionCallback();
    } else if (typeof window.authIsGuestMode === 'function' && window.authIsGuestMode()) {
        // Usuario NO autenticado PERO está en modo invitado: ejecutar acción sin guardar
        actionCallback();
    } else {
        // Usuario NO autenticado Y NO está en modo invitado: mostrar modal y NO ejecutar la acción
        if (typeof window.mostrarModalGuardarSinUsuario === 'function') {
            // Mostrar modal con callback para ejecutar la acción después de autenticarse o activar modo invitado
            window.mostrarModalGuardarSinUsuario(() => {
                // Una vez autenticado o en modo invitado, ejecutar la acción original
                actionCallback();
            });
        } else {
            console.warn('guards.js: mostrarModalGuardarSinUsuario no está disponible. La acción no se ejecutará.');
        }
    }
}

