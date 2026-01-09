// -----------------------------------------------------
// SISTEMA DE AUTENTICACIÓN - API PÚBLICA
// Implementación completa con Firebase Authentication
// onAuthStateChanged es la única fuente de verdad para el estado de autenticación
// -----------------------------------------------------

// Importar Firebase Auth (ES Module)
// Estos imports deben estar al inicio del archivo
import { auth } from "./firebase.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    deleteUser
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Importar funciones de Firestore
import { saveUserData, getUserData, updateUserData, deleteUserData } from "./firestore.js";

// ============================================
// ESTADO INTERNO (PRIVADO)
// ============================================

// Estado del usuario - Se sincroniza con Firebase Auth mediante onAuthStateChanged
// Esta variable es PRIVADA y NO debe usarse fuera de este archivo
// Se actualiza automáticamente cuando cambia el estado de Firebase Auth
let usuarioActual = null;

// Modo invitado: permite usar la app sin registro pero sin guardar datos
// Se activa cuando el usuario hace click en "Seguir sin guardar"
// Se pierde automáticamente al refrescar la página (solo en memoria)
// Esta variable es PRIVADA y NO debe usarse fuera de este archivo
let modoInvitado = false;

// Modo actual del modal (login o signup)
let modoAuth = 'login'; // 'login' o 'signup'

// Variable para callback que se ejecuta cuando el usuario se autentica
let callbackAuthExitosa = null;

// Variables para verificación de email (OTP)
let codigoVerificacionActual = null;
let emailVerificacionPendiente = null;
let datosRegistroPendientes = null; // {username, email, password}
let tiempoExpiracionCodigo = null; // Timestamp de expiración (10 minutos)

// ============================================
// FUNCIONES DE VERIFICACIÓN POR EMAIL (OTP)
// ============================================

/**
 * Genera un código aleatorio de 6 dígitos
 * @returns {string} Código de 6 dígitos
 */
function generarCodigoVerificacion() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Envía el código de verificación por email usando EmailJS
 * @param {string} email - Email del destinatario
 * @param {string} codigo - Código de verificación
 * @returns {Promise<void>}
 */
async function enviarCodigoPorEmail(email, codigo) {
    try {
        // EmailJS está disponible globalmente cuando se incluye el script
        if (typeof emailjs === 'undefined') {
            // Si EmailJS no está configurado, mostrar código en consola para desarrollo
            console.warn('EmailJS no está configurado. Código de verificación (solo para desarrollo):', codigo);
            console.warn('Para producción, configura EmailJS en: https://www.emailjs.com/');
            // Permitir continuar para desarrollo (código visible en consola)
            return;
        }

        // Configuración de EmailJS (deberás configurar esto en tu cuenta de EmailJS)
        // Service ID y Template ID se deben obtener de emailjs.com después de configurar
        const serviceID = 'YOUR_SERVICE_ID'; // TODO: Reemplazar con tu Service ID de EmailJS
        const templateID = 'YOUR_TEMPLATE_ID'; // TODO: Reemplazar con tu Template ID de EmailJS
        const publicKey = 'YOUR_PUBLIC_KEY'; // TODO: Reemplazar con tu Public Key de EmailJS

        // Si no está configurado, mostrar en consola para desarrollo
        if (serviceID === 'YOUR_SERVICE_ID' || templateID === 'YOUR_TEMPLATE_ID' || publicKey === 'YOUR_PUBLIC_KEY') {
            console.warn('EmailJS no está configurado. Código de verificación (solo para desarrollo):', codigo);
            console.warn('Para producción, configura EmailJS con tus credenciales en enviarCodigoPorEmail()');
            // Permitir continuar para desarrollo
            return;
        }

        // Inicializar EmailJS con la clave pública (solo necesario una vez)
        emailjs.init(publicKey);

        // Enviar email
        await emailjs.send(serviceID, templateID, {
            to_email: email,
            verification_code: codigo,
            from_name: 'Finanzas App'
        });

        console.log('Código de verificación enviado a:', email);
    } catch (error) {
        console.error('Error al enviar código por email:', error);
        // En desarrollo, mostrar código en consola si falla el envío
        console.warn('Código de verificación (fallback para desarrollo):', codigo);
        throw new Error('Error al enviar el código de verificación. Revisa la consola para el código de desarrollo.');
    }
}

/**
 * Inicia el proceso de verificación de email
 * Genera código, lo envía por email y muestra el modal de verificación
 * @param {string} email - Email a verificar
 * @param {object} datosRegistro - Datos del registro pendiente {username, email, password}
 */
async function iniciarVerificacionEmail(email, datosRegistro) {
    try {
        // Generar código de 6 dígitos
        const codigo = generarCodigoVerificacion();
        
        // Guardar código y datos temporalmente
        codigoVerificacionActual = codigo;
        emailVerificacionPendiente = email;
        datosRegistroPendientes = datosRegistro;
        tiempoExpiracionCodigo = Date.now() + (10 * 60 * 1000); // 10 minutos
        
        // Enviar código por email
        await enviarCodigoPorEmail(email, codigo);
        
        // Cerrar modal de registro
        closeAuthModal();
        
        // Mostrar modal de verificación
        mostrarModalVerificacionEmail();
    } catch (error) {
        console.error('Error al iniciar verificación:', error);
        throw error;
    }
}

/**
 * Valida el código de verificación ingresado
 * @param {string} codigoIngresado - Código ingresado por el usuario
 * @returns {boolean} true si el código es válido
 */
function validarCodigoVerificacion(codigoIngresado) {
    // Verificar que el código no haya expirado
    if (tiempoExpiracionCodigo && Date.now() > tiempoExpiracionCodigo) {
        return false;
    }
    
    // Verificar que el código coincida
    return codigoIngresado === codigoVerificacionActual;
}

/**
 * Muestra el modal de verificación de email
 */
function mostrarModalVerificacionEmail() {
    const modal = document.getElementById('modalVerificarEmail');
    const emailDisplay = document.getElementById('emailVerificacionMostrar');
    
    if (modal) {
        if (emailDisplay && emailVerificacionPendiente) {
            emailDisplay.textContent = emailVerificacionPendiente;
        }
        modal.classList.remove('hidden');
    }
}

/**
 * Oculta el modal de verificación de email
 */
function ocultarModalVerificacionEmail() {
    const modal = document.getElementById('modalVerificarEmail');
    if (modal) {
        modal.classList.add('hidden');
        // Limpiar input
        const inputCodigo = document.getElementById('inputCodigoVerificacion');
        if (inputCodigo) {
            inputCodigo.value = '';
        }
    }
}

/**
 * Procesa la verificación del código y completa el registro
 */
async function procesarVerificacionCodigo() {
    const inputCodigo = document.getElementById('inputCodigoVerificacion');
    const errorCodigo = document.getElementById('mensajeErrorCodigoVerificacion');
    
    if (!inputCodigo) return;
    
    const codigoIngresado = inputCodigo.value.trim();
    
    // Limpiar error
    if (errorCodigo) {
        errorCodigo.style.display = 'none';
    }
    
    // Validar que se ingresó un código
    if (!codigoIngresado) {
        if (errorCodigo) {
            errorCodigo.textContent = 'Ingresa el código de verificación';
            errorCodigo.style.display = 'block';
        }
        return;
    }
    
    // Validar formato (6 dígitos)
    if (!/^\d{6}$/.test(codigoIngresado)) {
        if (errorCodigo) {
            errorCodigo.textContent = 'El código debe tener 6 dígitos';
            errorCodigo.style.display = 'block';
        }
        return;
    }
    
    // Validar código
    if (!validarCodigoVerificacion(codigoIngresado)) {
        if (errorCodigo) {
            if (tiempoExpiracionCodigo && Date.now() > tiempoExpiracionCodigo) {
                errorCodigo.textContent = 'El código ha expirado. Solicita uno nuevo.';
            } else {
                errorCodigo.textContent = 'Código incorrecto. Intenta nuevamente.';
            }
            errorCodigo.style.display = 'block';
        }
        return;
    }
    
    // Código válido - proceder con el registro
    try {
        if (!datosRegistroPendientes) {
            throw new Error('Datos de registro no encontrados');
        }
        
        const { username, email, password } = datosRegistroPendientes;
        
        // Registrar usuario
        const user = await authSignup(email, password, username);
        
        // Cerrar modal de verificación
        ocultarModalVerificacionEmail();
        
        // Limpiar datos temporales
        codigoVerificacionActual = null;
        emailVerificacionPendiente = null;
        datosRegistroPendientes = null;
        tiempoExpiracionCodigo = null;
        
        // Mostrar mensaje de éxito
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion(`¡Cuenta creada exitosamente! Bienvenido, ${user.username || email}!`, 'success', 3000);
        }
    } catch (error) {
        console.error('Error al completar registro después de verificación:', error);
        if (errorCodigo) {
            errorCodigo.textContent = error.message || 'Error al completar el registro';
            errorCodigo.style.display = 'block';
        }
    }
}

/**
 * Reenvía el código de verificación
 */
async function reenviarCodigoVerificacion() {
    try {
        if (!emailVerificacionPendiente || !datosRegistroPendientes) {
            throw new Error('No hay verificación pendiente');
        }
        
        // Generar nuevo código
        const nuevoCodigo = generarCodigoVerificacion();
        codigoVerificacionActual = nuevoCodigo;
        tiempoExpiracionCodigo = Date.now() + (10 * 60 * 1000); // 10 minutos
        
        // Enviar nuevo código
        await enviarCodigoPorEmail(emailVerificacionPendiente, nuevoCodigo);
        
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('Código reenviado exitosamente', 'success', 3000);
        }
    } catch (error) {
        console.error('Error al reenviar código:', error);
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('Error al reenviar código. Intenta nuevamente.', 'error', 3000);
        }
    }
}

// Control para el modal informativo: si el usuario lo cerró manualmente, no volver a mostrarlo hasta recargar
let modalInformativoCerrado = false;

// ============================================
// API PÚBLICA - Estas funciones son las ÚNICAS que el resto de la app debe usar
// ============================================

/**
 * Inicia sesión con email y contraseña usando Firebase Auth
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña del usuario
 * @returns {Promise<object>} - Usuario autenticado
 */
async function authLogin(email, password) {
    // Validar email
    if (!email || !validarEmail(email)) {
        throw new Error('Email inválido');
    }
    
    // Validar contraseña
    if (!password) {
        throw new Error('Contraseña requerida');
    }
    
    try {
        // Iniciar sesión con Firebase Auth
        // onAuthStateChanged se ejecutará automáticamente y actualizará el estado
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Desactivar modo invitado al iniciar sesión (ahora tiene cuenta)
        modoInvitado = false;
        
        // Guardar cuenta en la lista de cuentas guardadas ANTES de retornar
        if (user.email) {
            guardarCuenta(user.email);
        }
        
        // Retornar datos del usuario (onAuthStateChanged actualizará usuarioActual)
        return {
            id: user.uid,
            email: user.email
        };
    } catch (error) {
        // Manejar errores específicos de Firebase
        let errorMessage = 'Error al iniciar sesión';
        
        if (error.code === 'auth/invalid-credential') {
            // Firebase ahora usa este código para credenciales incorrectas
            errorMessage = 'Email o contraseña incorrectos';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'Usuario no encontrado';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Contraseña incorrecta';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Email inválido';
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = 'Usuario deshabilitado';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Demasiados intentos. Intenta más tarde';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Error de conexión. Verifica tu internet';
        } else if (error.message && !error.message.includes('Firebase:')) {
            // Solo usar el mensaje si no contiene el prefijo técnico de Firebase
            errorMessage = error.message;
        }
        
        throw new Error(errorMessage);
    }
}

/**
 * Registra un nuevo usuario con email, contraseña y username
 * Implementación con Firebase Auth y Firestore
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña del usuario
 * @param {string} username - Nombre de usuario (requerido)
 * @returns {Promise<object>} - Usuario registrado
 */
async function authSignup(email, password, username) {
    // Validar username
    if (!username || username.trim().length === 0) {
        throw new Error('El nombre de usuario es requerido');
    }
    
    // Validar que solo contenga letras y números (sin caracteres especiales)
    if (!validarUsername(username)) {
        throw new Error('El nombre de usuario solo puede contener letras y números (sin caracteres especiales)');
    }
    
    if (username.trim().length < 3) {
        throw new Error('El nombre de usuario debe tener al menos 3 caracteres');
    }
    
    // Validar email
    if (!email || !validarEmail(email)) {
        throw new Error('Email inválido');
    }
    
    // Validar contraseña
    if (!password) {
        throw new Error('Contraseña requerida');
    }
    
    if (password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    
    try {
        // 1. Crear usuario en Firebase Authentication
        // Esto automáticamente inicia sesión con el nuevo usuario
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 2. Guardar username y email en Firestore bajo users/{uid}
        // Usar la función centralizada de firestore.js
        await saveUserData(user.uid, {
            username: username.trim(),
            email: email.trim()
        });
        
        // 3. Guardar cuenta en la lista de cuentas guardadas
        if (user.email) {
            guardarCuenta(user.email);
        }
        
        // 4. Retornar datos del usuario (onAuthStateChanged actualizará usuarioActual automáticamente)
        // NO cerrar sesión - dejar que el usuario quede logueado después del registro
        return {
            id: user.uid,
            email: user.email,
            username: username.trim()
        };
    } catch (error) {
        // Manejar errores específicos de Firebase
        let errorMessage = 'Error al registrar usuario';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Este email ya está registrado';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Email inválido';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'La contraseña es demasiado débil';
        } else if (error.code === 'auth/operation-not-allowed') {
            errorMessage = 'Operación no permitida';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        throw new Error(errorMessage);
    }
}

/**
 * Elimina la cuenta del usuario actual
 * Elimina todos los datos de Firestore y la cuenta de Firebase Authentication
 * @returns {Promise<void>}
 */
async function authDeleteAccount() {
    const user = auth.currentUser;
    
    if (!user) {
        throw new Error('No hay usuario autenticado');
    }

    try {
        const uid = user.uid;
        const email = user.email;

        // 1. Eliminar datos de Firestore (usuario y datos financieros)
        await deleteUserData(uid);

        // 2. Remover la cuenta de la lista de cuentas guardadas
        let cuentas = obtenerCuentasGuardadas();
        if (Array.isArray(cuentas) && email) {
            const emailNormalizado = email.toLowerCase().trim();
            cuentas = cuentas.filter(c => c.toLowerCase().trim() !== emailNormalizado);
            try {
                localStorage.setItem('cuentas_guardadas', JSON.stringify(cuentas));
            } catch (error) {
                console.warn('Error al actualizar lista de cuentas:', error);
            }
        }

        // 3. Eliminar la cuenta de Firebase Authentication
        await deleteUser(user);

        // 4. Cerrar sesión (por si acaso)
        await signOut(auth);

        return;
    } catch (error) {
        console.error('Error al eliminar cuenta:', error);
        if (error.code === 'auth/requires-recent-login') {
            throw new Error('Para eliminar tu cuenta, debes iniciar sesión nuevamente por seguridad.');
        } else if (error.code === 'auth/network-request-failed') {
            throw new Error('Error de conexión. Verifica tu internet e intenta nuevamente.');
        } else {
            throw new Error(error.message || 'Error al eliminar la cuenta');
        }
    }
}

/**
 * Cierra la sesión del usuario actual usando Firebase Auth
 * onAuthStateChanged se ejecutará automáticamente y actualizará el estado
 */
async function authLogout() {
    try {
        // Cerrar sesión en Firebase Auth
        // onAuthStateChanged se ejecutará automáticamente con user === null
        await signOut(auth);
        
        // Desactivar modo invitado al cerrar sesión
        modoInvitado = false;
        
        // El estado se actualizará automáticamente mediante onAuthStateChanged
    } catch (error) {
        // Manejar errores de logout
        console.error('Error al cerrar sesión:', error);
        throw new Error('Error al cerrar sesión');
    }
}

/**
 * Obtiene el usuario actual autenticado desde Firebase Auth
 * @returns {object|null} - Usuario actual o null si no hay sesión
 */
function authGetUser() {
    // Obtener el usuario actual de Firebase Auth
    // Este estado se sincroniza con onAuthStateChanged
    const currentUser = auth.currentUser;
    
    if (currentUser) {
        return {
            id: currentUser.uid,
            email: currentUser.email
        };
    }
    
    return null;
}

/**
 * Verifica si hay un usuario autenticado usando Firebase Auth
 * @returns {boolean} - true si hay usuario autenticado, false en caso contrario
 */
function authIsAuthenticated() {
    // Verificar si hay un usuario autenticado en Firebase Auth
    return auth.currentUser !== null;
}

/**
 * Habilita el modo invitado (permite usar la app sin registro)
 * Esta función será reemplazada por Firebase Auth en el futuro (si es necesario)
 */
function authEnableGuestMode() {
    // TODO: Evaluar si Firebase Auth necesita esta función o se maneja diferente
    
    modoInvitado = true;
}

/**
 * Verifica si el usuario está en modo invitado
 * Esta función será reemplazada por Firebase Auth en el futuro (si es necesario)
 * @returns {boolean} - true si está en modo invitado, false en caso contrario
 */
function authIsGuestMode() {
    // TODO: Evaluar si Firebase Auth necesita esta función o se maneja diferente
    
    return modoInvitado === true;
}

// ============================================
// FUNCIONES INTERNAS (UI Y LÓGICA)
// ============================================

/**
 * Abre el modal de login
 * Función interna para manejar la UI
 */
function openLogin() {
    modoAuth = 'login';
    const modal = document.getElementById('modalAuth');
    const title = document.getElementById('authModalTitle');
    const usernameContainer = document.getElementById('authUsernameContainer');
    
    if (modal && title) {
        title.textContent = 'Iniciar sesión';
        
        // Limpiar campos primero
        limpiarCamposAuth();
        
        // OCULTAR campo de username en modo login
        if (usernameContainer) {
            usernameContainer.classList.add('hidden');
            usernameContainer.style.display = 'none'; // Asegurar que esté oculto
        }
        
        // Abrir modal
        modal.classList.remove('hidden');
        if (typeof window.ocultarBtnAgregarGasto === 'function') {
            window.ocultarBtnAgregarGasto();
        }
        
        // Focus en email después de un pequeño delay
        setTimeout(() => {
            const emailInput = document.getElementById('inputAuthEmail');
            if (emailInput) emailInput.focus();
        }, 150);
    }
}

/**
 * Abre el modal de registro
 * Función interna para manejar la UI
 */
function openSignup() {
    modoAuth = 'signup';
    const modal = document.getElementById('modalAuth');
    const title = document.getElementById('authModalTitle');
    const usernameContainer = document.getElementById('authUsernameContainer');
    
    if (modal && title) {
        title.textContent = 'Registrarse';
        
        // Limpiar campos primero
        limpiarCamposAuth();
        
        // MOSTRAR campo de username solo en modo registro
        // Remover clase hidden y asegurar que sea visible
        if (usernameContainer) {
            usernameContainer.classList.remove('hidden');
            usernameContainer.style.display = 'block'; // Asegurar que esté visible
        }
        
        // Abrir modal
        modal.classList.remove('hidden');
        if (typeof window.ocultarBtnAgregarGasto === 'function') {
            window.ocultarBtnAgregarGasto();
        }
        
        // Focus en username después de un pequeño delay
        setTimeout(() => {
            const usernameInput = document.getElementById('inputAuthUsername');
            if (usernameInput) {
                usernameInput.focus();
            }
        }, 150);
    }
}

/**
 * Cierra el modal de autenticación
 * Función interna para manejar la UI
 */
function closeAuthModal() {
    const modal = document.getElementById('modalAuth');
    const usernameContainer = document.getElementById('authUsernameContainer');
    
    if (modal) {
        modal.classList.add('hidden');
        limpiarCamposAuth();
        if (typeof window.mostrarBtnAgregarGasto === 'function') {
            window.mostrarBtnAgregarGasto();
        }
        
        // Asegurar que el campo de username esté oculto al cerrar el modal
        // (para que no quede visible si se abre en modo login la próxima vez)
        if (usernameContainer) {
            usernameContainer.classList.add('hidden');
        }
    }
}

/**
 * Limpia los campos del formulario de autenticación
 * Función interna para manejar la UI
 */
function limpiarCamposAuth() {
    const usernameInput = document.getElementById('inputAuthUsername');
    const emailInput = document.getElementById('inputAuthEmail');
    const passwordInput = document.getElementById('inputAuthPassword');
    const errorUsername = document.getElementById('mensajeErrorAuthUsername');
    const errorEmail = document.getElementById('mensajeErrorAuthEmail');
    const errorPassword = document.getElementById('mensajeErrorAuthPassword');
    const errorGeneral = document.getElementById('mensajeErrorAuth');
    
    if (usernameInput) usernameInput.value = '';
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (errorUsername) errorUsername.style.display = 'none';
    if (errorEmail) errorEmail.style.display = 'none';
    if (errorPassword) errorPassword.style.display = 'none';
    if (errorGeneral) errorGeneral.style.display = 'none';
}

/**
 * Actualiza la UI según el estado de autenticación
 * Función interna para manejar la UI
 */
async function updateAuthUI() {
    const authBar = document.getElementById('authBar');
    const btnAbrirMenuUsuario = document.getElementById('btnAbrirMenuUsuario');
    
    if (usuarioActual) {
        // Hay usuario logueado: ocultar barra de auth, mostrar ícono de usuario
        if (authBar) authBar.classList.add('hidden');
        if (btnAbrirMenuUsuario) btnAbrirMenuUsuario.classList.remove('hidden');
        
        // Cargar datos del usuario desde Firestore para mostrar en el menú
        try {
            const userData = await getUserData(usuarioActual.id);
            if (userData) {
                actualizarMenuUsuario(userData.username || 'Usuario', usuarioActual.email);
            } else {
                actualizarMenuUsuario('Usuario', usuarioActual.email);
            }
        } catch (error) {
            console.error('Error al cargar datos del usuario:', error);
            actualizarMenuUsuario('Usuario', usuarioActual.email);
        }
    } else {
        // No hay usuario: mostrar barra de auth, ocultar ícono de usuario
        if (authBar) authBar.classList.remove('hidden');
        if (btnAbrirMenuUsuario) btnAbrirMenuUsuario.classList.add('hidden');
    }
}

/**
 * Actualiza la información del usuario en el modal del menú
 * @param {string} username - Nombre de usuario (puede ser null/undefined)
 * @param {string} email - Email del usuario
 */
function actualizarMenuUsuario(username, email) {
    const usuarioNombreMenu = document.getElementById('usuarioNombreMenu');
    const usuarioEmailMenu = document.getElementById('usuarioEmailMenu');
    
    if (usuarioNombreMenu) {
        // Si no hay username, mostrar "Usuario" como predeterminado
        usuarioNombreMenu.textContent = username || 'Usuario';
    }
    
    if (usuarioEmailMenu) {
        usuarioEmailMenu.textContent = email;
    }
    
    // Actualizar lista de cuentas en el menú
    actualizarListaCuentas();
}

// ============================================
// GESTIÓN DE MÚLTIPLES CUENTAS
// ============================================

/**
 * Guarda una cuenta en la lista de cuentas guardadas
 * @param {string} email - Email de la cuenta
 */
function guardarCuenta(email) {
    if (!email || typeof email !== 'string') {
        console.warn('guardarCuenta: email inválido', email);
        return;
    }
    
    // Normalizar el email (minúsculas y trim)
    const emailNormalizado = email.toLowerCase().trim();
    
    // Obtener cuentas existentes
    let cuentas = obtenerCuentasGuardadas();
    
    // Si no es un array, inicializarlo
    if (!Array.isArray(cuentas)) {
        cuentas = [];
    }
    
    // Verificar si la cuenta ya existe (comparación case-insensitive)
    const existe = cuentas.some(c => c.toLowerCase().trim() === emailNormalizado);
    
    if (!existe) {
        cuentas.push(emailNormalizado);
        try {
            localStorage.setItem('cuentas_guardadas', JSON.stringify(cuentas));
            console.log('✅ Cuenta guardada:', emailNormalizado, '| Total cuentas:', cuentas.length, '| Todas:', cuentas);
        } catch (error) {
            console.error('Error al guardar cuenta en localStorage:', error);
        }
    } else {
        console.log('ℹ️ Cuenta ya existe, no se agrega:', emailNormalizado);
    }
}

/**
 * Obtiene todas las cuentas guardadas
 * @returns {string[]} Array de emails de cuentas guardadas
 */
function obtenerCuentasGuardadas() {
    try {
        const cuentasStr = localStorage.getItem('cuentas_guardadas');
        if (cuentasStr) {
            return JSON.parse(cuentasStr);
        }
    } catch (error) {
        console.error('Error al obtener cuentas guardadas:', error);
    }
    return [];
}

/**
 * Actualiza la lista de cuentas en el menú desplegable
 */
function actualizarListaCuentas() {
    const listaCuentas = document.getElementById('listaCuentas');
    if (!listaCuentas) return;
    
    const cuentas = obtenerCuentasGuardadas();
    const emailActual = usuarioActual ? usuarioActual.email : null;
    
    console.log('Actualizando lista de cuentas. Total guardadas:', cuentas.length, 'Cuenta actual:', emailActual);
    
    // Limpiar lista
    listaCuentas.innerHTML = '';
    
    // Si no hay cuentas guardadas, no mostrar nada
    if (cuentas.length === 0) {
        console.log('No hay cuentas guardadas');
        return;
    }
    
    // Agregar todas las cuentas guardadas
    cuentas.forEach((email, index) => {
        console.log(`Procesando cuenta ${index + 1}:`, email, 'Es actual?', email === emailActual);
        const itemCuenta = document.createElement('div');
        itemCuenta.className = 'opcion-cuenta';
        
        if (email === emailActual) {
            // Si es la cuenta actual, marcarla pero no hacer clickeable
            itemCuenta.classList.add('opcion-cuenta-actual');
            itemCuenta.innerHTML = `<span>${email}</span><span class="cuenta-actual-badge">Actual</span>`;
        } else {
            // Si no es la cuenta actual, hacerla clickeable para cambiar
            itemCuenta.innerHTML = `<span>${email}</span>`;
            itemCuenta.addEventListener('click', () => {
                cambiarCuenta(email);
                ocultarMenuCuentas();
            });
        }
        
        listaCuentas.appendChild(itemCuenta);
    });
    
    // Si la cuenta actual no está en la lista guardada, agregarla al principio
    if (emailActual && !cuentas.includes(emailActual)) {
        console.log('Agregando cuenta actual que no está en la lista guardada:', emailActual);
        const itemCuenta = document.createElement('div');
        itemCuenta.className = 'opcion-cuenta opcion-cuenta-actual';
        itemCuenta.innerHTML = `<span>${emailActual}</span><span class="cuenta-actual-badge">Actual</span>`;
        listaCuentas.insertBefore(itemCuenta, listaCuentas.firstChild);
    }
}

/**
 * Muestra/oculta el menú de cuentas
 */
function toggleMenuCuentas() {
    const menuCuentas = document.getElementById('menuCuentas');
    const btnFlecha = document.getElementById('btnDesplegarCuentas');
    if (!menuCuentas || !btnFlecha) return;
    
    const isHidden = menuCuentas.classList.contains('hidden');
    
    if (isHidden) {
        menuCuentas.classList.remove('hidden');
        // Rotar flecha
        const svg = btnFlecha.querySelector('svg');
        if (svg) svg.style.transform = 'rotate(180deg)';
    } else {
        menuCuentas.classList.add('hidden');
        // Rotar flecha de vuelta
        const svg = btnFlecha.querySelector('svg');
        if (svg) svg.style.transform = 'rotate(0deg)';
    }
}

/**
 * Oculta el menú de cuentas
 */
function ocultarMenuCuentas() {
    const menuCuentas = document.getElementById('menuCuentas');
    const btnFlecha = document.getElementById('btnDesplegarCuentas');
    if (menuCuentas) {
        menuCuentas.classList.add('hidden');
    }
    if (btnFlecha) {
        const svg = btnFlecha.querySelector('svg');
        if (svg) svg.style.transform = 'rotate(0deg)';
    }
}

/**
 * Cambia a otra cuenta (hace logout y login de la nueva cuenta)
 * @param {string} email - Email de la cuenta a cambiar
 */
async function cambiarCuenta(email) {
    if (!email) return;
    
    try {
        // Cerrar sesión actual
        await signOut(auth);
        
        // Mostrar modal de login para la nueva cuenta
        // Prellenar el email
        const modalAuth = document.getElementById('modalAuth');
        const inputAuthEmail = document.getElementById('inputAuthEmail');
        const inputAuthPassword = document.getElementById('inputAuthPassword');
        
        if (modalAuth && inputAuthEmail) {
            // Establecer modo login
            modoAuth = 'login';
            const title = document.getElementById('authModalTitle');
            const usernameContainer = document.getElementById('authUsernameContainer');
            
            if (title) title.textContent = 'Iniciar sesión';
            if (usernameContainer) {
                usernameContainer.classList.add('hidden');
                usernameContainer.style.display = 'none';
            }
            
            // Prellenar email
            inputAuthEmail.value = email;
            
            // Limpiar contraseña
            if (inputAuthPassword) inputAuthPassword.value = '';
            
            // Cerrar modal de usuario
            ocultarModalMenuUsuario();
            
            // Abrir modal de auth
            modalAuth.classList.remove('hidden');
            if (typeof window.ocultarBtnAgregarGasto === 'function') {
                window.ocultarBtnAgregarGasto();
            }
            
            // Focus en password después de un pequeño delay
            setTimeout(() => {
                if (inputAuthPassword) inputAuthPassword.focus();
            }, 150);
        }
    } catch (error) {
        console.error('Error al cambiar de cuenta:', error);
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('Error al cambiar de cuenta', 'error', 3000);
        }
    }
}

/**
 * Abre el modal para agregar una cuenta existente
 */
function abrirAgregarCuenta() {
    // Cerrar menú de cuentas
    ocultarMenuCuentas();
    
    // Cerrar modal de usuario
    ocultarModalMenuUsuario();
    
    // Abrir modal de login (no registro, porque es cuenta existente)
    openLogin();
}

/**
 * Muestra el modal informativo de registro
 * Este modal es solo informativo y no bloquea la app
 * Solo se muestra si el usuario no lo ha cerrado manualmente en esta sesión
 * Función interna para manejar la UI
 */
function mostrarModalInformativo() {
    // No mostrar si el usuario lo cerró manualmente
    if (modalInformativoCerrado) {
        return;
    }
    
    const modal = document.getElementById('modalInformativoRegistro');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Oculta el modal informativo de registro
 * Función interna para manejar la UI
 * @param {boolean} cerrarDefinitivamente - Si es true, marca el modal como cerrado y no lo vuelve a mostrar
 */
function ocultarModalInformativo(cerrarDefinitivamente = false) {
    const modal = document.getElementById('modalInformativoRegistro');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    // Si el usuario cierra el modal manualmente, marcarlo para no volver a mostrarlo en esta sesión
    if (cerrarDefinitivamente) {
        modalInformativoCerrado = true;
    }
}

/**
 * Muestra el modal de "guardar sin usuario"
 * Función interna para manejar la UI
 * @param {function} callback - Función a ejecutar cuando el usuario se autentique
 */
function mostrarModalGuardarSinUsuario(callback) {
    callbackAuthExitosa = callback || null;
    
    // Resetear el flag cuando se llama desde requireAuth (usuario intenta hacer acción)
    // Esto permite que el modal se muestre siempre cuando el usuario intenta usar una función
    modalInformativoCerrado = false;
    
    // Usar el modal informativo
    // Este modal aparece cuando se intenta usar una función sin estar autenticado
    const modal = document.getElementById('modalInformativoRegistro');
    if (modal) {
        modal.classList.remove('hidden');
        if (typeof window.ocultarBtnAgregarGasto === 'function') {
            window.ocultarBtnAgregarGasto();
        }
    }
}

/**
 * Muestra el modal del menú de usuario
 * Función interna para manejar la UI
 */
function mostrarModalMenuUsuario() {
    const modal = document.getElementById('modalMenuUsuario');
    if (modal) {
        modal.classList.remove('hidden');
        // Agregar clase al body para prevenir scroll
        document.body.classList.add('modal-abierto');
        document.documentElement.classList.add('modal-abierto');
    }
}

/**
 * Oculta el modal del menú de usuario
 * Función interna para manejar la UI
 */
function ocultarModalMenuUsuario() {
    const modal = document.getElementById('modalMenuUsuario');
    if (modal) {
        modal.classList.add('hidden');
        // Remover clase del body
        document.body.classList.remove('modal-abierto');
        document.documentElement.classList.remove('modal-abierto');
    }
}

/**
 * Muestra el modal de confirmación para cerrar sesión
 * Función interna para manejar la UI
 */
function mostrarModalConfirmarCerrarSesion() {
    const modal = document.getElementById('modalConfirmarCerrarSesion');
    if (modal) {
        modal.classList.remove('hidden');
        // Agregar clase al body para prevenir scroll
        document.body.classList.add('modal-abierto');
        document.documentElement.classList.add('modal-abierto');
    }
}

/**
 * Oculta el modal de confirmación para cerrar sesión
 * Función interna para manejar la UI
 */
function ocultarModalConfirmarCerrarSesion() {
    const modal = document.getElementById('modalConfirmarCerrarSesion');
    if (modal) {
        modal.classList.add('hidden');
        // Remover clase del body
        document.body.classList.remove('modal-abierto');
        document.documentElement.classList.remove('modal-abierto');
    }
}

/**
 * Muestra el modal para cambiar contraseña
 * Función interna para manejar la UI
 */
function mostrarModalCambiarContrasena() {
    const modal = document.getElementById('modalCambiarContrasena');
    if (modal) {
        modal.classList.remove('hidden');
        // Agregar clase al body para prevenir scroll
        document.body.classList.add('modal-abierto');
        document.documentElement.classList.add('modal-abierto');
        
        // Limpiar campos
        const inputContrasenaActual = document.getElementById('inputContrasenaActual');
        const inputNuevaContrasena = document.getElementById('inputNuevaContrasena');
        const inputConfirmarNuevaContrasena = document.getElementById('inputConfirmarNuevaContrasena');
        
        if (inputContrasenaActual) inputContrasenaActual.value = '';
        if (inputNuevaContrasena) inputNuevaContrasena.value = '';
        if (inputConfirmarNuevaContrasena) inputConfirmarNuevaContrasena.value = '';
        
        // Ocultar mensajes de error
        const errorActual = document.getElementById('mensajeErrorContrasenaActual');
        const errorNueva = document.getElementById('mensajeErrorNuevaContrasena');
        const errorConfirmar = document.getElementById('mensajeErrorConfirmarContrasena');
        const errorGeneral = document.getElementById('mensajeErrorCambiarContrasena');
        
        if (errorActual) errorActual.style.display = 'none';
        if (errorNueva) errorNueva.style.display = 'none';
        if (errorConfirmar) errorConfirmar.style.display = 'none';
        if (errorGeneral) errorGeneral.style.display = 'none';
        
        // Focus en el primer input
        setTimeout(() => {
            if (inputContrasenaActual) inputContrasenaActual.focus();
        }, 150);
    }
}

/**
 * Oculta el modal para cambiar contraseña
 * Función interna para manejar la UI
 */
function ocultarModalCambiarContrasena() {
    const modal = document.getElementById('modalCambiarContrasena');
    if (modal) {
        modal.classList.add('hidden');
        // Remover clase del body
        document.body.classList.remove('modal-abierto');
        document.documentElement.classList.remove('modal-abierto');
    }
}

/**
 * Muestra el modal para cambiar nombre de usuario
 * Función interna para manejar la UI
 */
function mostrarModalCambiarUsername() {
    const modal = document.getElementById('modalCambiarUsername');
    if (modal) {
        modal.classList.remove('hidden');
        // Agregar clase al body para prevenir scroll
        document.body.classList.add('modal-abierto');
        document.documentElement.classList.add('modal-abierto');
        
        // Limpiar campo
        const inputNuevoUsername = document.getElementById('inputNuevoUsername');
        if (inputNuevoUsername) inputNuevoUsername.value = '';
        
        // Ocultar mensajes de error
        const errorUsername = document.getElementById('mensajeErrorNuevoUsername');
        const errorGeneral = document.getElementById('mensajeErrorCambiarUsername');
        
        if (errorUsername) errorUsername.style.display = 'none';
        if (errorGeneral) errorGeneral.style.display = 'none';
        
        // Focus en el input
        setTimeout(() => {
            if (inputNuevoUsername) inputNuevoUsername.focus();
        }, 150);
    }
}

/**
 * Oculta el modal para cambiar nombre de usuario
 * Función interna para manejar la UI
 */
function ocultarModalCambiarUsername() {
    const modal = document.getElementById('modalCambiarUsername');
    if (modal) {
        modal.classList.add('hidden');
        // Remover clase del body
        document.body.classList.remove('modal-abierto');
        document.documentElement.classList.remove('modal-abierto');
    }
}

/**
 * Oculta el modal de "guardar sin usuario"
 * Función interna para manejar la UI
 */
function ocultarModalGuardarSinUsuario() {
    // Ocultar tanto el modal informativo como el modal de "guardar sin usuario"
    const modalInformativo = document.getElementById('modalInformativoRegistro');
    const modalGuardarSinUsuario = document.getElementById('modalGuardarSinUsuario');
    
    if (modalInformativo) {
        modalInformativo.classList.add('hidden');
    }
    
    if (modalGuardarSinUsuario) {
        modalGuardarSinUsuario.classList.add('hidden');
    }
    
    if (typeof window.mostrarBtnAgregarGasto === 'function') {
        window.mostrarBtnAgregarGasto();
    }
}

// -----------------------------------------------------
// VALIDACIÓN Y PROCESAMIENTO
// -----------------------------------------------------

/**
 * Valida el email
 * Función interna de validación
 * @param {string} email 
 * @returns {boolean}
 */
function validarEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Valida que el nombre de usuario solo contenga letras y números (sin caracteres especiales)
 * Función interna de validación
 * @param {string} username - Nombre de usuario a validar
 * @returns {boolean} - true si solo contiene letras, números y espacios
 */
function validarUsername(username) {
    // Permite letras (a-z, A-Z), números (0-9) y espacios
    // No permite caracteres especiales
    const usernameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s]+$/;
    return usernameRegex.test(username);
}

/**
 * Cambia la contraseña del usuario
 * @param {string} contrasenaActual - Contraseña actual del usuario
 * @param {string} nuevaContrasena - Nueva contraseña
 * @returns {Promise<void>}
 */
async function cambiarContrasena(contrasenaActual, nuevaContrasena) {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
        throw new Error('No hay usuario autenticado');
    }
    
    if (!contrasenaActual) {
        throw new Error('La contraseña actual es requerida');
    }
    
    if (!nuevaContrasena) {
        throw new Error('La nueva contraseña es requerida');
    }
    
    if (nuevaContrasena.length < 6) {
        throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
    }
    
    try {
        // Reautenticar al usuario con su contraseña actual
        const credential = EmailAuthProvider.credential(currentUser.email, contrasenaActual);
        await reauthenticateWithCredential(currentUser, credential);
        
        // Actualizar la contraseña
        await updatePassword(currentUser, nuevaContrasena);
    } catch (error) {
        let errorMessage = 'Error al cambiar la contraseña';
        
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'La contraseña actual es incorrecta';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'La nueva contraseña es demasiado débil';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'Por seguridad, necesitas iniciar sesión nuevamente antes de cambiar tu contraseña';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        throw new Error(errorMessage);
    }
}

/**
 * Cambia el nombre de usuario del usuario
 * @param {string} nuevoUsername - Nuevo nombre de usuario
 * @returns {Promise<void>}
 */
async function cambiarUsername(nuevoUsername) {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
        throw new Error('No hay usuario autenticado');
    }
    
    if (!nuevoUsername || nuevoUsername.trim().length === 0) {
        throw new Error('El nombre de usuario es requerido');
    }
    
    if (!validarUsername(nuevoUsername)) {
        throw new Error('El nombre de usuario solo puede contener letras y números (sin caracteres especiales)');
    }
    
    if (nuevoUsername.trim().length < 3) {
        throw new Error('El nombre de usuario debe tener al menos 3 caracteres');
    }
    
    try {
        // Obtener email actual del usuario
        const userData = await getUserData(currentUser.uid);
        const email = userData ? userData.email : currentUser.email;
        
        // Actualizar solo el username en Firestore
        await updateUserData(currentUser.uid, {
            username: nuevoUsername.trim(),
            email: email // Mantener el email actual
        });
        
        // Actualizar el estado interno
        if (usuarioActual) {
            usuarioActual.username = nuevoUsername.trim();
        }
    } catch (error) {
        if (error.code === 'permission-denied') {
            throw new Error('No tienes permiso para actualizar tu nombre de usuario. Verifica las reglas de Firestore.');
        } else if (error.message) {
            throw error;
        } else {
            throw new Error('Error al cambiar el nombre de usuario');
        }
    }
}

/**
 * Procesa el formulario de cambiar contraseña
 * Función interna que maneja el formulario
 */
async function procesarCambiarContrasena() {
    const inputContrasenaActual = document.getElementById('inputContrasenaActual');
    const inputNuevaContrasena = document.getElementById('inputNuevaContrasena');
    const inputConfirmarNuevaContrasena = document.getElementById('inputConfirmarNuevaContrasena');
    
    const errorActual = document.getElementById('mensajeErrorContrasenaActual');
    const errorNueva = document.getElementById('mensajeErrorNuevaContrasena');
    const errorConfirmar = document.getElementById('mensajeErrorConfirmarContrasena');
    const errorGeneral = document.getElementById('mensajeErrorCambiarContrasena');
    
    if (!inputContrasenaActual || !inputNuevaContrasena || !inputConfirmarNuevaContrasena) return;
    
    const contrasenaActual = inputContrasenaActual.value.trim();
    const nuevaContrasena = inputNuevaContrasena.value.trim();
    const confirmarContrasena = inputConfirmarNuevaContrasena.value.trim();
    
    // Limpiar mensajes de error
    if (errorActual) errorActual.style.display = 'none';
    if (errorNueva) errorNueva.style.display = 'none';
    if (errorConfirmar) errorConfirmar.style.display = 'none';
    if (errorGeneral) errorGeneral.style.display = 'none';
    
    // Validar contraseña actual
    if (!contrasenaActual) {
        if (errorActual) {
            errorActual.textContent = 'Ingresa tu contraseña actual';
            errorActual.style.display = 'block';
        }
        return;
    }
    
    // Validar nueva contraseña
    if (!nuevaContrasena) {
        if (errorNueva) {
            errorNueva.textContent = 'Ingresa tu nueva contraseña';
            errorNueva.style.display = 'block';
        }
        return;
    }
    
    if (nuevaContrasena.length < 6) {
        if (errorNueva) {
            errorNueva.textContent = 'La contraseña debe tener al menos 6 caracteres';
            errorNueva.style.display = 'block';
        }
        return;
    }
    
    // Validar confirmación
    if (!confirmarContrasena) {
        if (errorConfirmar) {
            errorConfirmar.textContent = 'Confirma tu nueva contraseña';
            errorConfirmar.style.display = 'block';
        }
        return;
    }
    
    if (nuevaContrasena !== confirmarContrasena) {
        if (errorConfirmar) {
            errorConfirmar.textContent = 'Las contraseñas no coinciden';
            errorConfirmar.style.display = 'block';
        }
        return;
    }
    
    // Cambiar contraseña
    try {
        await cambiarContrasena(contrasenaActual, nuevaContrasena);
        
        // Cerrar modal
        ocultarModalCambiarContrasena();
        ocultarModalMenuUsuario();
        
        // Mostrar notificación de éxito
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('Contraseña cambiada exitosamente', 'success', 3000);
        }
    } catch (error) {
        // Mostrar error
        if (error.message.includes('contraseña actual')) {
            if (errorActual) {
                errorActual.textContent = error.message;
                errorActual.style.display = 'block';
            }
        } else if (error.message.includes('nueva contraseña') || error.message.includes('débil')) {
            if (errorNueva) {
                errorNueva.textContent = error.message;
                errorNueva.style.display = 'block';
            }
        } else {
            if (errorGeneral) {
                errorGeneral.textContent = error.message;
                errorGeneral.style.display = 'block';
            }
        }
    }
}

/**
 * Procesa el formulario de cambiar nombre de usuario
 * Función interna que maneja el formulario
 */
async function procesarCambiarUsername() {
    const inputNuevoUsername = document.getElementById('inputNuevoUsername');
    const errorUsername = document.getElementById('mensajeErrorNuevoUsername');
    const errorGeneral = document.getElementById('mensajeErrorCambiarUsername');
    
    if (!inputNuevoUsername) return;
    
    const nuevoUsername = inputNuevoUsername.value.trim();
    
    // Limpiar mensajes de error
    if (errorUsername) errorUsername.style.display = 'none';
    if (errorGeneral) errorGeneral.style.display = 'none';
    
    // Validar username
    if (!nuevoUsername) {
        if (errorUsername) {
            errorUsername.textContent = 'Ingresa un nombre de usuario';
            errorUsername.style.display = 'block';
        }
        return;
    }
    
    if (!validarUsername(nuevoUsername)) {
        if (errorUsername) {
            errorUsername.textContent = 'El nombre de usuario solo puede contener letras y números (sin caracteres especiales)';
            errorUsername.style.display = 'block';
        }
        return;
    }
    
    if (nuevoUsername.length < 3) {
        if (errorUsername) {
            errorUsername.textContent = 'El nombre de usuario debe tener al menos 3 caracteres';
            errorUsername.style.display = 'block';
        }
        return;
    }
    
    // Cambiar username
    try {
        await cambiarUsername(nuevoUsername);
        
        // Actualizar UI del menú
        const currentUser = auth.currentUser;
        if (currentUser) {
            await updateAuthUI();
        }
        
        // Cerrar modal
        ocultarModalCambiarUsername();
        ocultarModalMenuUsuario();
        
        // Mostrar notificación de éxito
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('Nombre de usuario cambiado exitosamente', 'success', 3000);
        }
    } catch (error) {
        // Mostrar error
        if (errorUsername && (error.message.includes('nombre de usuario') || error.message.includes('caracteres'))) {
            errorUsername.textContent = error.message;
            errorUsername.style.display = 'block';
        } else {
            if (errorGeneral) {
                errorGeneral.textContent = error.message;
                errorGeneral.style.display = 'block';
            }
        }
    }
}

/**
 * Procesa el formulario de autenticación
 * Función interna que maneja el formulario y llama a la API pública
 */
async function procesarAuth() {
    const usernameInput = document.getElementById('inputAuthUsername');
    const emailInput = document.getElementById('inputAuthEmail');
    const passwordInput = document.getElementById('inputAuthPassword');
    const errorUsername = document.getElementById('mensajeErrorAuthUsername');
    const errorEmail = document.getElementById('mensajeErrorAuthEmail');
    const errorPassword = document.getElementById('mensajeErrorAuthPassword');
    const errorGeneral = document.getElementById('mensajeErrorAuth');
    
    if (!emailInput || !passwordInput) return;
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput ? usernameInput.value.trim() : '';
    
    // Limpiar mensajes de error
    if (errorUsername) errorUsername.style.display = 'none';
    if (errorEmail) errorEmail.style.display = 'none';
    if (errorPassword) errorPassword.style.display = 'none';
    if (errorGeneral) errorGeneral.style.display = 'none';
    
    // Validar username solo en modo registro
    if (modoAuth === 'signup') {
        if (!username) {
            if (errorUsername) {
                errorUsername.textContent = 'Ingresa un nombre de usuario';
                errorUsername.style.display = 'block';
            }
            return;
        }
        
        // Validar que solo contenga letras y números (sin caracteres especiales)
        if (!validarUsername(username)) {
            if (errorUsername) {
                errorUsername.textContent = 'El nombre de usuario solo puede contener letras y números (sin caracteres especiales)';
                errorUsername.style.display = 'block';
            }
            return;
        }
        
        if (username.trim().length < 3) {
            if (errorUsername) {
                errorUsername.textContent = 'El nombre de usuario debe tener al menos 3 caracteres';
                errorUsername.style.display = 'block';
            }
            return;
        }
    }
    
    // Validar email
    if (!email) {
        if (errorEmail) {
            errorEmail.textContent = 'Ingresa un email';
            errorEmail.style.display = 'block';
        }
        return;
    }
    
    if (!validarEmail(email)) {
        if (errorEmail) {
            errorEmail.textContent = 'Email inválido';
            errorEmail.style.display = 'block';
        }
        return;
    }
    
    // Validar contraseña
    if (!password) {
        if (errorPassword) {
            errorPassword.textContent = 'Ingresa una contraseña';
            errorPassword.style.display = 'block';
        }
        return;
    }
    
    if (modoAuth === 'signup' && password.length < 6) {
        if (errorPassword) {
            errorPassword.textContent = 'La contraseña debe tener al menos 6 caracteres';
            errorPassword.style.display = 'block';
        }
        return;
    }
    
    try {
        // Llamar a la API pública según el modo
        if (modoAuth === 'login') {
            await authLogin(email, password);
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion(`Sesión iniciada, ${email}!`, 'success', 3000);
            }
        } else {
            // Registro directo (sistema OTP deshabilitado temporalmente)
            await authSignup(email, password, username);
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion(`¡Cuenta creada exitosamente! Bienvenido, ${username}!`, 'success', 3000);
            }
        }
        
        // Cerrar modal (solo para login)
        closeAuthModal();
        
        // Si había un modal de "guardar sin usuario" abierto, cerrarlo
        ocultarModalGuardarSinUsuario();
    } catch (error) {
        // Mostrar error específico según el campo que falló
        const errorMessage = error.message || 'Error al autenticarse';
        
        // Intentar mostrar el error en el campo correspondiente
        if (errorMessage.includes('nombre de usuario') || errorMessage.includes('username')) {
            if (errorUsername) {
                errorUsername.textContent = errorMessage;
                errorUsername.style.display = 'block';
            }
        } else if (errorMessage.includes('Email o contraseña incorrectos') || errorMessage.includes('contraseña incorrecta') || errorMessage.includes('Contraseña incorrecta') || errorMessage.includes('password') || errorMessage.includes('wrong-password')) {
            // Mostrar errores de contraseña en el campo de contraseña
            if (errorPassword) {
                errorPassword.textContent = errorMessage;
                errorPassword.style.display = 'block';
            }
        } else if (errorMessage.includes('email') || errorMessage.includes('Email')) {
            if (errorEmail) {
                errorEmail.textContent = errorMessage;
                errorEmail.style.display = 'block';
            }
        } else if (errorMessage.includes('contraseña') || errorMessage.includes('Contraseña')) {
            if (errorPassword) {
                errorPassword.textContent = errorMessage;
                errorPassword.style.display = 'block';
            }
        } else {
            // Mostrar error general si no es específico de un campo
            if (errorGeneral) {
                errorGeneral.textContent = errorMessage;
                errorGeneral.style.display = 'block';
            }
        }
    }
}

// -----------------------------------------------------
// FUNCIONES DE COMPATIBILIDAD (DEPRECADAS)
// Estas funciones se mantienen temporalmente para compatibilidad
// pero internamente llaman a la nueva API pública
// -----------------------------------------------------

/**
 * @deprecated Usar authLogin() en su lugar
 * Esta función se mantiene para compatibilidad temporal
 */
function loginFake(email) {
    authLogin(email, 'dummy-password').catch(() => {});
}

/**
 * @deprecated Usar authSignup() en su lugar
 * Esta función se mantiene para compatibilidad temporal
 */
function signupFake(email) {
    authSignup(email, 'dummy-password').catch(() => {});
}

/**
 * @deprecated Usar authLogout() en su lugar
 * Esta función se mantiene para compatibilidad temporal
 */
async function logout() {
    try {
        await authLogout();
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('Sesión cerrada', 'info', 2000);
        }
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('Error al cerrar sesión', 'error', 3000);
        }
    }
}

/**
 * @deprecated Usar authGetUser() en su lugar
 * Esta función se mantiene para compatibilidad temporal
 */
function getCurrentUser() {
    return authGetUser();
}

/**
 * @deprecated Usar authIsAuthenticated() en su lugar
 * Esta función se mantiene para compatibilidad temporal
 */
function isUserLogged() {
    return authIsAuthenticated();
}

/**
 * @deprecated Usar authIsGuestMode() en su lugar
 * Esta función se mantiene para compatibilidad temporal
 */
function isModoInvitado() {
    return authIsGuestMode();
}

// -----------------------------------------------------
// INICIALIZACIÓN DE EVENT LISTENERS
// -----------------------------------------------------

/**
 * Inicializa todos los event listeners relacionados con autenticación
 */
function inicializarAuthListeners() {
    // Botones para abrir modales
    const btnAbrirLogin = document.getElementById('btnAbrirLogin');
    const btnAbrirSignup = document.getElementById('btnAbrirSignup');
    const btnAbrirMenuUsuario = document.getElementById('btnAbrirMenuUsuario');
    
    // Botones del modal de auth
    const btnConfirmarAuth = document.getElementById('btnConfirmarAuth');
    const btnCerrarAuth = document.getElementById('btnCerrarAuth');
    const modalAuth = document.getElementById('modalAuth');
    
    // Botones del modal informativo de registro
    const btnInformativoRegistro = document.getElementById('btnInformativoRegistro');
    const btnInformativoLogin = document.getElementById('btnInformativoLogin');
    const btnCerrarInformativo = document.getElementById('btnCerrarInformativo');
    const modalInformativo = document.getElementById('modalInformativoRegistro');
    
    // Botones del modal de guardar sin usuario
    const btnIrRegistro = document.getElementById('btnIrRegistro');
    const btnIrLogin = document.getElementById('btnIrLogin');
    const btnContinuarSinGuardar = document.getElementById('btnContinuarSinGuardar');
    const modalGuardarSinUsuario = document.getElementById('modalGuardarSinUsuario');
    
    // Inputs del modal de auth
    const inputAuthUsername = document.getElementById('inputAuthUsername');
    const inputAuthEmail = document.getElementById('inputAuthEmail');
    const inputAuthPassword = document.getElementById('inputAuthPassword');
    
    // Restringir input de username a solo letras y números (sin caracteres especiales)
    if (inputAuthUsername) {
        inputAuthUsername.addEventListener('input', (e) => {
            // Obtener el valor actual
            let value = e.target.value;
            
            // Remover cualquier carácter especial, pero permitir letras, números y espacios
            // Permitir letras (a-z, A-Z), caracteres acentuados (áéíóú, etc.), números (0-9) y espacios
            value = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s]/g, '');
            
            // Actualizar el valor del input
            e.target.value = value;
        });
        
        // También prevenir pegado de texto no válido
        inputAuthUsername.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            // Filtrar solo letras y números del texto pegado (sin caracteres especiales)
            const filteredText = pastedText.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s]/g, '');
            // Insertar en la posición del cursor
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            const currentValue = e.target.value;
            e.target.value = currentValue.substring(0, start) + filteredText + currentValue.substring(end);
            e.target.setSelectionRange(start + filteredText.length, start + filteredText.length);
        });
    }
    
    // Abrir modal de login
    if (btnAbrirLogin) {
        btnAbrirLogin.addEventListener('click', openLogin);
    }
    
    // Abrir modal de registro
    if (btnAbrirSignup) {
        btnAbrirSignup.addEventListener('click', openSignup);
    }
    
    // Abrir menú de usuario
    if (btnAbrirMenuUsuario) {
        btnAbrirMenuUsuario.addEventListener('click', mostrarModalMenuUsuario);
    }
    
    // Botón para desplegar menú de cuentas
    const btnDesplegarCuentas = document.getElementById('btnDesplegarCuentas');
    const usuarioEmailWrapper = document.getElementById('usuarioEmailWrapper');
    const menuCuentas = document.getElementById('menuCuentas');
    const btnAgregarCuenta = document.getElementById('btnAgregarCuenta');
    
    // Permitir click tanto en el wrapper como en el botón
    if (usuarioEmailWrapper) {
        usuarioEmailWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenuCuentas();
        });
    }
    
    if (btnDesplegarCuentas) {
        btnDesplegarCuentas.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenuCuentas();
        });
    }
    
    // Cerrar menú de cuentas al hacer click fuera
    document.addEventListener('click', (e) => {
        if (menuCuentas && !menuCuentas.contains(e.target) && 
            usuarioEmailWrapper && !usuarioEmailWrapper.contains(e.target)) {
            ocultarMenuCuentas();
        }
    });
    
    if (btnAgregarCuenta) {
        btnAgregarCuenta.addEventListener('click', () => {
            abrirAgregarCuenta();
        });
    }
    
    // Botones del modal de menú de usuario
    const btnCerrarMenuUsuario = document.getElementById('btnCerrarMenuUsuario');
    const btnMenuCerrarSesion = document.getElementById('btnMenuCerrarSesion');
    const modalMenuUsuario = document.getElementById('modalMenuUsuario');
    
    // Botones del modal de confirmar cerrar sesión
    const btnConfirmarCerrarSesion = document.getElementById('btnConfirmarCerrarSesion');
    const btnCancelarCerrarSesion = document.getElementById('btnCancelarCerrarSesion');
    const modalConfirmarCerrarSesion = document.getElementById('modalConfirmarCerrarSesion');
    
    // Cerrar modal de menú de usuario
    if (btnCerrarMenuUsuario) {
        btnCerrarMenuUsuario.addEventListener('click', ocultarModalMenuUsuario);
    }
    
    // Cerrar modal de menú al hacer click fuera
    if (modalMenuUsuario) {
        modalMenuUsuario.addEventListener('click', (e) => {
            if (e.target === modalMenuUsuario) {
                ocultarModalMenuUsuario();
            }
        });
    }
    
    // Abrir modal de confirmar cerrar sesión
    if (btnMenuCerrarSesion) {
        btnMenuCerrarSesion.addEventListener('click', () => {
            ocultarModalMenuUsuario();
            mostrarModalConfirmarCerrarSesion();
        });
    }
    
    // Confirmar cerrar sesión
    if (btnConfirmarCerrarSesion) {
        btnConfirmarCerrarSesion.addEventListener('click', async () => {
            ocultarModalConfirmarCerrarSesion();
            try {
                await authLogout();
                if (typeof mostrarNotificacion === 'function') {
                    mostrarNotificacion('Sesión cerrada exitosamente', 'info', 2000);
                }
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
                if (typeof mostrarNotificacion === 'function') {
                    mostrarNotificacion('Error al cerrar sesión', 'error', 3000);
                }
            }
        });
    }
    
    // Cancelar cerrar sesión
    if (btnCancelarCerrarSesion) {
        btnCancelarCerrarSesion.addEventListener('click', () => {
            ocultarModalConfirmarCerrarSesion();
            mostrarModalMenuUsuario();
        });
    }
    
    // Abrir configuración desde menú de usuario
    const btnMenuConfiguracion = document.getElementById('btnMenuConfiguracion');
    if (btnMenuConfiguracion) {
        btnMenuConfiguracion.addEventListener('click', () => {
            ocultarModalMenuUsuario();
            // Cambiar a pantalla de configuración
            if (typeof window.cambiarPantalla === 'function') {
                window.cambiarPantalla('configuracion');
            } else if (typeof cambiarPantalla === 'function') {
                cambiarPantalla('configuracion');
            }
        });
    }
    
    // Eliminar cuenta
    const btnEliminarCuenta = document.getElementById('btnEliminarCuenta');
    const modalConfirmarEliminarCuenta = document.getElementById('modalConfirmarEliminarCuenta');
    const btnConfirmarEliminarCuenta = document.getElementById('btnConfirmarEliminarCuenta');
    const btnCancelarEliminarCuenta = document.getElementById('btnCancelarEliminarCuenta');
    
    function mostrarModalConfirmarEliminarCuenta() {
        if (modalConfirmarEliminarCuenta) {
            modalConfirmarEliminarCuenta.classList.remove('hidden');
        }
    }
    
    function ocultarModalConfirmarEliminarCuenta() {
        if (modalConfirmarEliminarCuenta) {
            modalConfirmarEliminarCuenta.classList.add('hidden');
        }
    }
    
    if (btnEliminarCuenta) {
        btnEliminarCuenta.addEventListener('click', () => {
            mostrarModalConfirmarEliminarCuenta();
        });
    }
    
    if (btnConfirmarEliminarCuenta) {
        btnConfirmarEliminarCuenta.addEventListener('click', async () => {
            try {
                btnConfirmarEliminarCuenta.disabled = true;
                btnConfirmarEliminarCuenta.textContent = 'Eliminando...';
                
                await authDeleteAccount();
                
                ocultarModalConfirmarEliminarCuenta();
                
                // Cambiar a la pantalla de inicio después de eliminar la cuenta
                if (typeof window.cambiarPantalla === 'function') {
                    window.cambiarPantalla('inicio');
                } else if (typeof cambiarPantalla === 'function') {
                    cambiarPantalla('inicio');
                }
                
                if (typeof mostrarNotificacion === 'function') {
                    mostrarNotificacion('Cuenta eliminada exitosamente', 'success', 3000);
                }
            } catch (error) {
                console.error('Error al eliminar cuenta:', error);
                btnConfirmarEliminarCuenta.disabled = false;
                btnConfirmarEliminarCuenta.textContent = 'Sí, eliminar cuenta';
                
                if (typeof mostrarNotificacion === 'function') {
                    mostrarNotificacion(error.message || 'Error al eliminar la cuenta', 'error', 4000);
                }
            }
        });
    }
    
    if (btnCancelarEliminarCuenta) {
        btnCancelarEliminarCuenta.addEventListener('click', () => {
            ocultarModalConfirmarEliminarCuenta();
        });
    }
    
    // Cerrar modal de confirmar eliminar cuenta al hacer click fuera
    if (modalConfirmarEliminarCuenta) {
        modalConfirmarEliminarCuenta.addEventListener('click', (e) => {
            if (e.target === modalConfirmarEliminarCuenta) {
                ocultarModalConfirmarEliminarCuenta();
            }
        });
    }
    
    // Cerrar modal de confirmar cerrar sesión al hacer click fuera
    if (modalConfirmarCerrarSesion) {
        modalConfirmarCerrarSesion.addEventListener('click', (e) => {
            if (e.target === modalConfirmarCerrarSesion) {
                ocultarModalConfirmarCerrarSesion();
                mostrarModalMenuUsuario();
            }
        });
    }
    
    // Botones del modal de cambiar contraseña
    const btnMenuCambiarContrasena = document.getElementById('btnMenuCambiarContrasena');
    const btnConfirmarCambiarContrasena = document.getElementById('btnConfirmarCambiarContrasena');
    const btnCerrarCambiarContrasena = document.getElementById('btnCerrarCambiarContrasena');
    const modalCambiarContrasena = document.getElementById('modalCambiarContrasena');
    const inputConfirmarNuevaContrasenaCambiar = document.getElementById('inputConfirmarNuevaContrasena');
    
    // Abrir modal de cambiar contraseña
    if (btnMenuCambiarContrasena) {
        btnMenuCambiarContrasena.addEventListener('click', () => {
            ocultarModalMenuUsuario();
            mostrarModalCambiarContrasena();
        });
    }
    
    // Confirmar cambiar contraseña
    if (btnConfirmarCambiarContrasena) {
        btnConfirmarCambiarContrasena.addEventListener('click', procesarCambiarContrasena);
    }
    
    // Cerrar modal de cambiar contraseña
    if (btnCerrarCambiarContrasena) {
        btnCerrarCambiarContrasena.addEventListener('click', () => {
            ocultarModalCambiarContrasena();
            mostrarModalMenuUsuario();
        });
    }
    
    // Cerrar modal de cambiar contraseña al hacer click fuera
    if (modalCambiarContrasena) {
        modalCambiarContrasena.addEventListener('click', (e) => {
            if (e.target === modalCambiarContrasena) {
                ocultarModalCambiarContrasena();
                mostrarModalMenuUsuario();
            }
        });
    }
    
    // Enter para confirmar cambiar contraseña
    if (inputConfirmarNuevaContrasenaCambiar) {
        inputConfirmarNuevaContrasenaCambiar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                procesarCambiarContrasena();
            }
        });
    }
    
    // Botones del modal de cambiar nombre de usuario
    const btnMenuCambiarUsername = document.getElementById('btnMenuCambiarUsername');
    const btnConfirmarCambiarUsername = document.getElementById('btnConfirmarCambiarUsername');
    const btnCerrarCambiarUsername = document.getElementById('btnCerrarCambiarUsername');
    const modalCambiarUsername = document.getElementById('modalCambiarUsername');
    const inputNuevoUsernameCambiar = document.getElementById('inputNuevoUsername');
    
    // Abrir modal de cambiar nombre de usuario
    if (btnMenuCambiarUsername) {
        btnMenuCambiarUsername.addEventListener('click', () => {
            ocultarModalMenuUsuario();
            mostrarModalCambiarUsername();
        });
    }
    
    // Confirmar cambiar nombre de usuario
    if (btnConfirmarCambiarUsername) {
        btnConfirmarCambiarUsername.addEventListener('click', procesarCambiarUsername);
    }
    
    // Cerrar modal de cambiar nombre de usuario
    if (btnCerrarCambiarUsername) {
        btnCerrarCambiarUsername.addEventListener('click', () => {
            ocultarModalCambiarUsername();
            mostrarModalMenuUsuario();
        });
    }
    
    // Cerrar modal de cambiar nombre de usuario al hacer click fuera
    if (modalCambiarUsername) {
        modalCambiarUsername.addEventListener('click', (e) => {
            if (e.target === modalCambiarUsername) {
                ocultarModalCambiarUsername();
                mostrarModalMenuUsuario();
            }
        });
    }
    
    // Enter para confirmar cambiar nombre de usuario
    if (inputNuevoUsernameCambiar) {
        inputNuevoUsernameCambiar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                procesarCambiarUsername();
            }
        });
    }
    
    // Restringir input de nuevo username a solo letras y números
    if (inputNuevoUsernameCambiar) {
        inputNuevoUsernameCambiar.addEventListener('input', (e) => {
            let value = e.target.value;
            // Permitir letras, números, espacios y caracteres acentuados
            value = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s]/g, '');
            e.target.value = value;
        });
    }
    
    // ============================================
    // EVENT LISTENERS PARA VERIFICACIÓN DE EMAIL (OTP)
    // ============================================
    const modalVerificarEmail = document.getElementById('modalVerificarEmail');
    const btnConfirmarCodigoVerificacion = document.getElementById('btnConfirmarCodigoVerificacion');
    const btnCancelarVerificacion = document.getElementById('btnCancelarVerificacion');
    const btnReenviarCodigo = document.getElementById('btnReenviarCodigo');
    const inputCodigoVerificacion = document.getElementById('inputCodigoVerificacion');
    
    // Solo permitir números en el input de código
    if (inputCodigoVerificacion) {
        inputCodigoVerificacion.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
        
        // Enter para confirmar
        inputCodigoVerificacion.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (btnConfirmarCodigoVerificacion) {
                    btnConfirmarCodigoVerificacion.click();
                }
            }
        });
    }
    
    if (btnConfirmarCodigoVerificacion) {
        btnConfirmarCodigoVerificacion.addEventListener('click', async () => {
            await procesarVerificacionCodigo();
        });
    }
    
    if (btnCancelarVerificacion) {
        btnCancelarVerificacion.addEventListener('click', () => {
            ocultarModalVerificacionEmail();
            // Limpiar datos temporales
            codigoVerificacionActual = null;
            emailVerificacionPendiente = null;
            datosRegistroPendientes = null;
            tiempoExpiracionCodigo = null;
            // Volver al modal de registro
            openSignup();
        });
    }
    
    if (btnReenviarCodigo) {
        btnReenviarCodigo.addEventListener('click', async () => {
            await reenviarCodigoVerificacion();
        });
    }
    
    // Cerrar modal de verificación al hacer click fuera
    if (modalVerificarEmail) {
        modalVerificarEmail.addEventListener('click', (e) => {
            if (e.target === modalVerificarEmail) {
                ocultarModalVerificacionEmail();
            }
        });
    }
    
    // Confirmar autenticación
    if (btnConfirmarAuth) {
        btnConfirmarAuth.addEventListener('click', procesarAuth);
    }
    
    // Cerrar modal de auth
    if (btnCerrarAuth) {
        btnCerrarAuth.addEventListener('click', closeAuthModal);
    }
    
    // Cerrar modal de auth al hacer click fuera
    if (modalAuth) {
        modalAuth.addEventListener('click', (e) => {
            if (e.target === modalAuth) {
                closeAuthModal();
            }
        });
    }
    
    // Enter para confirmar auth
    if (inputAuthPassword) {
        inputAuthPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                procesarAuth();
            }
        });
    }
    
    // Ir a registro desde modal "guardar sin usuario"
    if (btnIrRegistro) {
        btnIrRegistro.addEventListener('click', () => {
            ocultarModalGuardarSinUsuario();
            openSignup();
        });
    }
    
    // Ir a login desde modal "guardar sin usuario"
    if (btnIrLogin) {
        btnIrLogin.addEventListener('click', () => {
            ocultarModalGuardarSinUsuario();
            openLogin();
        });
    }
    
    // Botones del modal informativo de registro
    if (btnInformativoRegistro) {
        btnInformativoRegistro.addEventListener('click', () => {
            ocultarModalInformativo(true); // Cerrar definitivamente al ir a registro
            openSignup();
        });
    }
    
    if (btnInformativoLogin) {
        btnInformativoLogin.addEventListener('click', () => {
            ocultarModalInformativo(true); // Cerrar definitivamente al ir a login
            openLogin();
        });
    }
    
    if (btnCerrarInformativo) {
        btnCerrarInformativo.addEventListener('click', () => {
            // Activar modo invitado cuando el usuario hace click en "Seguir usando sin iniciar"
            authEnableGuestMode();
            
            // Cerrar el modal
            ocultarModalInformativo(true); // Cerrar definitivamente (no volver a mostrar en esta sesión)
            
            // Ejecutar callback si existe (para continuar con la acción que estaba bloqueada)
            if (callbackAuthExitosa && typeof callbackAuthExitosa === 'function') {
                callbackAuthExitosa();
                callbackAuthExitosa = null;
            }
            
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion('Modo invitado activado. Los datos no se guardarán permanentemente.', 'info', 3000);
            }
        });
    }
    
    // Cerrar modal informativo al hacer click fuera (también activa modo invitado)
    if (modalInformativo) {
        modalInformativo.addEventListener('click', (e) => {
            if (e.target === modalInformativo) {
                // Activar modo invitado
                authEnableGuestMode();
                
                // Cerrar definitivamente (no volver a mostrar en esta sesión)
                ocultarModalInformativo(true);
                
                // Ejecutar callback si existe
                if (callbackAuthExitosa && typeof callbackAuthExitosa === 'function') {
                    callbackAuthExitosa();
                    callbackAuthExitosa = null;
                }
            }
        });
    }
    
    // Continuar sin guardar (modo invitado) - usar API pública
    if (btnContinuarSinGuardar) {
        btnContinuarSinGuardar.addEventListener('click', () => {
            // Activar modo invitado usando la API pública
            authEnableGuestMode();
            
            // Ocultar el modal
            ocultarModalGuardarSinUsuario();
            
            // Si había un callback pendiente, ejecutarlo (permitir la acción que estaba bloqueada)
            if (callbackAuthExitosa && typeof callbackAuthExitosa === 'function') {
                callbackAuthExitosa();
                callbackAuthExitosa = null; // Limpiar el callback
            }
            
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion('Modo invitado activado. Los datos no se guardarán permanentemente.', 'info', 3000);
            }
        });
    }
    
    // Cerrar modal "guardar sin usuario" al hacer click fuera (NO activa modo invitado)
    if (modalGuardarSinUsuario) {
        modalGuardarSinUsuario.addEventListener('click', (e) => {
            if (e.target === modalGuardarSinUsuario) {
                ocultarModalGuardarSinUsuario();
                callbackAuthExitosa = null; // Limpiar callback (NO ejecutar acción)
                // NO activar modoInvitado aquí, solo al hacer click explícito en "Seguir sin guardar"
            }
        });
    }
}

// -----------------------------------------------------
// INICIALIZACIÓN AL CARGAR
// -----------------------------------------------------

/**
 * Inicializa el observer de Firebase Auth
 * Este observer detecta cambios en el estado de autenticación y muestra/oculta el modal informativo
 * Se ejecuta automáticamente cuando cambia el estado de autenticación
 */
/**
 * Inicializa el observer de Firebase Auth
 * Esta es la ÚNICA fuente de verdad para el estado de autenticación
 * Se ejecuta automáticamente cuando cambia el estado de autenticación (login, logout, refresh)
 */
function inicializarAuthObserver() {
    // Escuchar cambios en el estado de autenticación de Firebase
    // Este observer es la única fuente de verdad para el estado de autenticación
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuario autenticado: sincronizar estado interno
            usuarioActual = {
                id: user.uid,
                email: user.email
            };
            
            // Desactivar modo invitado cuando hay usuario autenticado
            modoInvitado = false;
            
            // Resetear el flag de modal cerrado (al autenticarse, permitir que se muestre de nuevo si se desautentica)
            modalInformativoCerrado = false;
            
            // Ocultar modal informativo si está visible
            ocultarModalInformativo();
            
            // Cargar datos financieros desde Firestore cuando el usuario se autentica
            if (typeof window.cargarDatos === 'function') {
                window.cargarDatos().catch(error => {
                    console.error('Error al cargar datos después de autenticarse:', error);
                });
            }
            
            // Ejecutar callback si existe (para continuar acciones bloqueadas)
            if (callbackAuthExitosa && typeof callbackAuthExitosa === 'function') {
                callbackAuthExitosa();
                callbackAuthExitosa = null;
            }
            
            // Cargar datos del usuario desde Firestore (incluyendo username)
            try {
                const userData = await getUserData(user.uid);
                if (userData && userData.username) {
                    usuarioActual.username = userData.username;
                }
            } catch (error) {
                console.error('Error al cargar datos del usuario:', error);
            }
            
            // Guardar cuenta en la lista de cuentas guardadas
            if (user.email) {
                guardarCuenta(user.email);
            }
            
            // Actualizar UI
            await updateAuthUI();
        } else {
            // Usuario NO autenticado: limpiar estado
            usuarioActual = null;
            
            // NO mostrar modal informativo automáticamente
            // El modal solo se mostrará cuando el usuario intente usar una función (a través de requireAuth)
            // Esto permite que el usuario navegue libremente sin ser molestado
            
            // Cargar datos desde localStorage cuando el usuario se desautentica
            // Esto también cancela la suscripción en tiempo real si existe
            if (typeof window.cargarDatos === 'function') {
                window.cargarDatos().catch(error => {
                    console.error('Error al cargar datos después de desautenticarse:', error);
                });
            }
            
            // Actualizar UI
            await updateAuthUI();
        }
    });
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        inicializarAuthListeners();
        inicializarAuthObserver(); // Inicializar observer de Firebase Auth
        await updateAuthUI();
        
        // Exponer funciones necesarias globalmente para guards.js
        window.authIsAuthenticated = authIsAuthenticated;
        window.authIsGuestMode = authIsGuestMode;
        window.mostrarModalGuardarSinUsuario = mostrarModalGuardarSinUsuario;
    });
} else {
    // DOM ya está listo
    inicializarAuthListeners();
    inicializarAuthObserver(); // Inicializar observer de Firebase Auth
    (async () => {
        await updateAuthUI();
    })();
    
    // Exponer funciones necesarias globalmente para guards.js
    window.authIsAuthenticated = authIsAuthenticated;
    window.authIsGuestMode = authIsGuestMode;
    window.mostrarModalGuardarSinUsuario = mostrarModalGuardarSinUsuario;
}