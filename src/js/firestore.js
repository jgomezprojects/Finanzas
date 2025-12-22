// -----------------------------------------------------
// FIRESTORE - API para operaciones con Firestore
// Este archivo centraliza todas las operaciones de Firestore
// -----------------------------------------------------

// Importar Firestore desde Firebase
import { db } from "./firebase.js";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ============================================
// FUNCIONES PÚBLICAS - Operaciones con Firestore
// ============================================

/**
 * Guarda o actualiza los datos de un usuario en Firestore
 * Crea un documento en la colección 'users' con el uid como ID
 * @param {string} uid - ID único del usuario (Firebase Auth UID)
 * @param {object} userData - Datos del usuario a guardar
 * @param {string} userData.username - Nombre de usuario
 * @param {string} userData.email - Email del usuario
 * @returns {Promise<void>} - Promesa que se resuelve cuando se guarda exitosamente
 * @throws {Error} - Si ocurre un error al guardar
 */
export async function saveUserData(uid, userData) {
    try {
        // Validar parámetros
        if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
            throw new Error('El UID del usuario es requerido');
        }

        if (!userData || typeof userData !== 'object') {
            throw new Error('Los datos del usuario son requeridos');
        }

        if (!userData.username || typeof userData.username !== 'string' || userData.username.trim().length === 0) {
            throw new Error('El nombre de usuario es requerido');
        }

        if (!userData.email || typeof userData.email !== 'string' || userData.email.trim().length === 0) {
            throw new Error('El email es requerido');
        }

        // Referencia al documento del usuario
        // Ruta: users/{uid}
        const userDocRef = doc(db, 'users', uid);

        // Verificar si el documento ya existe
        const userDoc = await getDoc(userDocRef);
        const documentExists = userDoc.exists();

        // Preparar datos para Firestore
        const dataToSave = {
            username: userData.username.trim(),
            email: userData.email.trim()
        };

        if (!documentExists) {
            // Si el documento no existe, crear con createdAt
            dataToSave.createdAt = serverTimestamp();
            dataToSave.updatedAt = serverTimestamp();
            // Usar setDoc sin merge para crear explícitamente
            await setDoc(userDocRef, dataToSave);
        } else {
            // Si el documento existe, actualizar solo updatedAt
            dataToSave.updatedAt = serverTimestamp();
            // Usar setDoc con merge para actualizar solo campos proporcionados
            await setDoc(userDocRef, dataToSave, { merge: true });
        }

        // Retornar éxito
        return;
    } catch (error) {
        // Manejar errores específicos de Firestore
        if (error.code === 'permission-denied') {
            throw new Error('No tienes permiso para guardar datos. Verifica las reglas de Firestore.');
        } else if (error.code === 'unavailable') {
            throw new Error('Firestore no está disponible. Verifica tu conexión a internet.');
        } else {
            // Re-lanzar errores de validación o errores desconocidos
            throw error;
        }
    }
}

/**
 * Obtiene los datos de un usuario desde Firestore
 * @param {string} uid - ID único del usuario (Firebase Auth UID)
 * @returns {Promise<object|null>} - Datos del usuario o null si no existe
 * @throws {Error} - Si ocurre un error al obtener los datos
 */
export async function getUserData(uid) {
    try {
        // Validar parámetro
        if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
            throw new Error('El UID del usuario es requerido');
        }

        // Referencia al documento del usuario
        const userDocRef = doc(db, 'users', uid);

        // Obtener el documento
        const userDoc = await getDoc(userDocRef);

        // Si el documento existe, retornar los datos
        if (userDoc.exists()) {
            return {
                id: userDoc.id,
                ...userDoc.data()
            };
        }

        // Si no existe, retornar null
        return null;
    } catch (error) {
        // Manejar errores específicos de Firestore
        if (error.code === 'permission-denied') {
            throw new Error('No tienes permiso para leer datos. Verifica las reglas de Firestore.');
        } else if (error.code === 'unavailable') {
            throw new Error('Firestore no está disponible. Verifica tu conexión a internet.');
        } else {
            // Re-lanzar errores de validación o errores desconocidos
            throw error;
        }
    }
}

/**
 * Actualiza los datos de un usuario existente en Firestore
 * Solo actualiza los campos proporcionados
 * @param {string} uid - ID único del usuario (Firebase Auth UID)
 * @param {object} updates - Campos a actualizar
 * @returns {Promise<void>} - Promesa que se resuelve cuando se actualiza exitosamente
 * @throws {Error} - Si ocurre un error al actualizar
 */
export async function deleteUserData(uid) {
    try {
        if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
            throw new Error('El UID del usuario es requerido');
        }

        // Referencias a los documentos a eliminar
        const userDocRef = doc(db, 'users', uid);
        const datosFinancierosDocRef = doc(db, 'users', uid, 'datos', 'financieros');

        // Eliminar datos financieros primero (subcolección)
        try {
            await deleteDoc(datosFinancierosDocRef);
        } catch (error) {
            // Si no existe, no es un error crítico
            if (error.code !== 'not-found') {
                console.warn('Error al eliminar datos financieros:', error);
            }
        }

        // Eliminar documento de usuario
        await deleteDoc(userDocRef);

        return;
    } catch (error) {
        console.error('Error al eliminar datos del usuario:', error);
        if (error.code === 'permission-denied') {
            throw new Error('No tienes permiso para eliminar datos. Verifica las reglas de Firestore.');
        } else if (error.code === 'unavailable') {
            throw new Error('Firestore no está disponible. Verifica tu conexión a internet.');
        } else {
            throw error;
        }
    }
}

export async function updateUserData(uid, updates) {
    try {
        // Validar parámetros
        if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
            throw new Error('El UID del usuario es requerido');
        }

        if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
            throw new Error('Los datos a actualizar son requeridos');
        }

        // Preparar datos para actualización
        // Agregar timestamp de actualización
        const dataToUpdate = {
            ...updates,
            updatedAt: serverTimestamp()
        };

        // Referencia al documento del usuario
        const userDocRef = doc(db, 'users', uid);

        // Actualizar el documento
        await updateDoc(userDocRef, dataToUpdate);

        // Retornar éxito
        return;
    } catch (error) {
        // Manejar errores específicos de Firestore
        if (error.code === 'permission-denied') {
            throw new Error('No tienes permiso para actualizar datos. Verifica las reglas de Firestore.');
        } else if (error.code === 'unavailable') {
            throw new Error('Firestore no está disponible. Verifica tu conexión a internet.');
        } else if (error.code === 'not-found') {
            throw new Error('El usuario no existe en Firestore.');
        } else {
            // Re-lanzar errores de validación o errores desconocidos
            throw error;
        }
    }
}

/**
 * Valida la estructura y tipos de los datos financieros
 * @param {object} datosFinancieros - Datos a validar
 * @returns {boolean} - true si son válidos
 * @throws {Error} - Si los datos son inválidos
 */
function validarDatosFinancieros(datosFinancieros) {
    // Validar que es un objeto
    if (!datosFinancieros || typeof datosFinancieros !== 'object' || Array.isArray(datosFinancieros)) {
        throw new Error('Los datos financieros deben ser un objeto');
    }
    
    // Campos requeridos
    const camposRequeridos = [
        'sobres', 
        'totalGeneral', 
        'porcentajeDisponible',
        'fuentes',
        'totalIngresos',
        'totalGastos',
        'gastos',
        'prestamos',
        'movimientos'
    ];
    
    // Verificar que todos los campos requeridos existen
    for (const campo of camposRequeridos) {
        if (!(campo in datosFinancieros)) {
            throw new Error(`Campo requerido faltante: ${campo}`);
        }
    }
    
    // Validar tipos y valores
    if (!Array.isArray(datosFinancieros.sobres)) {
        throw new Error('El campo "sobres" debe ser un array');
    }
    
    if (typeof datosFinancieros.totalGeneral !== 'number' || isNaN(datosFinancieros.totalGeneral)) {
        throw new Error('El campo "totalGeneral" debe ser un número válido');
    }
    
    if (typeof datosFinancieros.porcentajeDisponible !== 'number' 
        || isNaN(datosFinancieros.porcentajeDisponible)
        || datosFinancieros.porcentajeDisponible < 0 
        || datosFinancieros.porcentajeDisponible > 100) {
        throw new Error('El campo "porcentajeDisponible" debe ser un número entre 0 y 100');
    }
    
    if (!datosFinancieros.fuentes || typeof datosFinancieros.fuentes !== 'object' || Array.isArray(datosFinancieros.fuentes)) {
        throw new Error('El campo "fuentes" debe ser un objeto');
    }
    
    if (typeof datosFinancieros.totalIngresos !== 'number' || isNaN(datosFinancieros.totalIngresos)) {
        throw new Error('El campo "totalIngresos" debe ser un número válido');
    }
    
    if (typeof datosFinancieros.totalGastos !== 'number' || isNaN(datosFinancieros.totalGastos)) {
        throw new Error('El campo "totalGastos" debe ser un número válido');
    }
    
    if (!Array.isArray(datosFinancieros.gastos)) {
        throw new Error('El campo "gastos" debe ser un array');
    }
    
    if (!Array.isArray(datosFinancieros.prestamos)) {
        throw new Error('El campo "prestamos" debe ser un array');
    }
    
    if (!Array.isArray(datosFinancieros.movimientos)) {
        throw new Error('El campo "movimientos" debe ser un array');
    }
    
    // Validar que los valores numéricos no sean infinitos
    const camposNumericos = ['totalGeneral', 'porcentajeDisponible', 'totalIngresos', 'totalGastos'];
    for (const campo of camposNumericos) {
        if (!isFinite(datosFinancieros[campo])) {
            throw new Error(`El campo "${campo}" debe ser un número finito`);
        }
    }
    
    return true;
}

/**
 * Guarda todos los datos financieros del usuario en Firestore
 * @param {string} uid - ID único del usuario
 * @param {object} datosFinancieros - Datos financieros a guardar
 * @returns {Promise<void>}
 */
export async function saveUserFinancialData(uid, datosFinancieros) {
    try {
        if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
            throw new Error('El UID del usuario es requerido');
        }

        if (!datosFinancieros || typeof datosFinancieros !== 'object') {
            throw new Error('Los datos financieros son requeridos');
        }

        // Validar estructura y tipos antes de guardar
        validarDatosFinancieros(datosFinancieros);

        // Referencia al documento de datos del usuario
        // Ruta: users/{uid}/datos/financieros
        const datosDocRef = doc(db, 'users', uid, 'datos', 'financieros');

        // Preparar datos con timestamp
        // IMPORTANTE: Construir objeto explícitamente para evitar campos extra
        const dataToSave = {
            sobres: datosFinancieros.sobres,
            totalGeneral: datosFinancieros.totalGeneral,
            porcentajeDisponible: datosFinancieros.porcentajeDisponible,
            fuentes: datosFinancieros.fuentes,
            totalIngresos: datosFinancieros.totalIngresos,
            totalGastos: datosFinancieros.totalGastos,
            gastos: datosFinancieros.gastos,
            prestamos: datosFinancieros.prestamos,
            movimientos: datosFinancieros.movimientos,
            updatedAt: serverTimestamp()
        };

        // Guardar datos (merge: true para actualizar solo campos proporcionados)
        await setDoc(datosDocRef, dataToSave, { merge: true });

        return;
    } catch (error) {
        console.error('Error al guardar datos financieros:', error);
        if (error.code === 'permission-denied') {
            throw new Error('No tienes permiso para guardar datos. Verifica las reglas de Firestore.');
        } else if (error.code === 'unavailable') {
            throw new Error('Firestore no está disponible. Verifica tu conexión a internet.');
        } else {
            // Re-lanzar errores de validación
            throw error;
        }
    }
}

/**
 * Carga todos los datos financieros del usuario desde Firestore
 * @param {string} uid - ID único del usuario
 * @returns {Promise<object|null>} - Datos financieros o null si no existen
 */
export async function getUserFinancialData(uid) {
    try {
        if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
            throw new Error('El UID del usuario es requerido');
        }

        // Referencia al documento de datos del usuario
        // Ruta: users/{uid}/datos/financieros
        const datosDocRef = doc(db, 'users', uid, 'datos', 'financieros');

        // Obtener el documento
        const datosDoc = await getDoc(datosDocRef);

        // Si el documento existe, retornar los datos
        if (datosDoc.exists()) {
            return datosDoc.data();
        }

        // Si no existe, retornar null
        return null;
    } catch (error) {
        console.error('Error al cargar datos financieros:', error);
        if (error.code === 'permission-denied') {
            throw new Error('No tienes permiso para leer datos. Verifica las reglas de Firestore.');
        } else if (error.code === 'unavailable') {
            throw new Error('Firestore no está disponible. Verifica tu conexión a internet.');
        } else {
            throw error;
        }
    }
}

/**
 * Escucha cambios en tiempo real en los datos financieros del usuario
 * Esto permite sincronización automática entre múltiples dispositivos
 * @param {string} uid - ID único del usuario
 * @param {function} callback - Función que se ejecuta cuando hay cambios (recibe los datos o null)
 * @returns {function} - Función para desuscribirse del listener
 */
export function subscribeToUserFinancialData(uid, callback) {
    if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
        throw new Error('El UID del usuario es requerido');
    }

    if (typeof callback !== 'function') {
        throw new Error('El callback es requerido');
    }

    // Referencia al documento de datos del usuario
    // Ruta: users/{uid}/datos/financieros
    const datosDocRef = doc(db, 'users', uid, 'datos', 'financieros');

    // Escuchar cambios en tiempo real
    // onSnapshot se ejecuta cada vez que el documento cambia
    const unsubscribe = onSnapshot(datosDocRef, (snapshot) => {
        if (snapshot.exists()) {
            // Documento existe: pasar los datos al callback
            callback(snapshot.data());
        } else {
            // Documento no existe: pasar null
            callback(null);
        }
    }, (error) => {
        // Manejar errores
        console.error('Error en sincronización en tiempo real:', error);
        if (error.code === 'permission-denied') {
            console.error('No tienes permiso para leer datos en tiempo real. Verifica las reglas de Firestore.');
        } else if (error.code === 'unavailable') {
            console.error('Firestore no está disponible para sincronización en tiempo real.');
        }
        callback(null);
    });

    // Retornar función para desuscribirse
    return unsubscribe;
}

