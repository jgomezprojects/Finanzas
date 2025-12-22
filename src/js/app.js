// -----------------------------------------------------
// IMPORTS - Firestore y Firebase Auth
// -----------------------------------------------------
import { saveUserFinancialData, getUserFinancialData, subscribeToUserFinancialData } from "./firestore.js";
import { auth } from "./firebase.js";

// -----------------------------------------------------
// FORMATO COP
// -----------------------------------------------------
function formatoCOP(valor) {
    return "$" + Number(valor).toLocaleString("es-CO");
}

// -----------------------------------------------------
// SISTEMA DE NOTIFICACIONES
// -----------------------------------------------------
function mostrarNotificacion(mensaje, tipo = "info", duracion = 3000) {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;
    
    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`;
    
    let icono = "ℹ️";
    if (tipo === "success") icono = "✅";
    else if (tipo === "error") icono = "❌";
    else if (tipo === "warning") icono = "⚠️";
    
    toast.innerHTML = `
        <span class="toast-icon">${icono}</span>
        <span class="toast-message">${mensaje}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-remover después de la duración
    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duracion);
}

// -----------------------------------------------------
// VARIABLES
// -----------------------------------------------------
let sobres = [];
let totalGeneral = 0;
let porcentajeDisponible = 100;
let sobreActual = null;

// SEGUIMIENTO DE INGRESOS Y GASTOS
let totalIngresos = 0;
let totalGastos = 0;

// FUENTES DE DINERO
let fuentes = {
    "Efectivo": 0,
    "Nequi": 0,
    "Nu": 0
};

// GASTOS
let gastos = [];
let modoEliminacionGastos = false;

// PRÉSTAMOS
let prestamos = [];

// MOVIMIENTOS
let movimientos = [];

// Suscripción a cambios en tiempo real de Firestore
let unsubscribeFinancialData = null;

// -----------------------------------------------------
// ELEMENTOS
// -----------------------------------------------------
const listaSobres = document.getElementById("listaSobres");
const totalGeneralHTML = document.getElementById("totalGeneral");
const listaFuentesHTML = document.getElementById("listaFuentes");
const gastarContent = document.querySelector(".gastar-content");
const dineroPrestadoContent = document.querySelector(".dinero-prestado-content");
const estadisticasTableBody = document.getElementById("estadisticasTableBody");

const btnCrearSobre = document.getElementById("btnCrearSobre");
const btnAgregar = document.getElementById("btnAgregar");

// MODAL CREAR SOBRE
const modalCrearSobre = document.getElementById("modalCrearSobre");
const inputNombreSobre = document.getElementById("inputNombreSobre");
const inputPorcentajeSobre = document.getElementById("inputPorcentajeSobre");
const porcentajeDisponibleInfo = document.getElementById("porcentajeDisponibleInfo");
const btnConfirmarCrearSobre = document.getElementById("btnConfirmarCrearSobre");
const btnCerrarCrearSobre = document.getElementById("btnCerrarCrearSobre");
const mensajeErrorCrearSobre = document.getElementById("mensajeErrorCrearSobre");

const modal = document.getElementById("modalEditar");
const btnCerrarModal = document.getElementById("btnCerrarModal");
const btnCambiarNombre = document.getElementById("btnCambiarNombre");
const btnCambiarPorcentaje = document.getElementById("btnCambiarPorcentaje");
const btnEliminarSobre = document.getElementById("btnEliminarSobre");
const editarNombreActual = document.getElementById("editarNombreActual");

// MODAL CAMBIAR NOMBRE
const modalCambiarNombre = document.getElementById("modalCambiarNombre");
const inputNuevoNombre = document.getElementById("inputNuevoNombre");
const btnConfirmarCambiarNombre = document.getElementById("btnConfirmarCambiarNombre");
const btnCerrarCambiarNombre = document.getElementById("btnCerrarCambiarNombre");
const mensajeErrorCambiarNombre = document.getElementById("mensajeErrorCambiarNombre");

// MODAL CAMBIAR PORCENTAJE
const modalCambiarPorcentaje = document.getElementById("modalCambiarPorcentaje");
const inputNuevoPorcentaje = document.getElementById("inputNuevoPorcentaje");
const porcentajeDisponibleEditar = document.getElementById("porcentajeDisponibleEditar");
const btnConfirmarCambiarPorcentaje = document.getElementById("btnConfirmarCambiarPorcentaje");
const btnCerrarCambiarPorcentaje = document.getElementById("btnCerrarCambiarPorcentaje");
const mensajeErrorCambiarPorcentaje = document.getElementById("mensajeErrorCambiarPorcentaje");

// MODAL CONFIRMAR ELIMINAR SOBRE
const modalConfirmarEliminarSobre = document.getElementById("modalConfirmarEliminarSobre");
const btnConfirmarEliminarSobre = document.getElementById("btnConfirmarEliminarSobre");
const btnCancelarEliminarSobre = document.getElementById("btnCancelarEliminarSobre");

// MENÚ FLOTANTE SOBRE
const menuFlotanteSobre = document.getElementById("menuFlotanteSobre");
const nombreSobreFlotante = document.getElementById("nombreSobreFlotante");
const btnAgregarDirectoFlotante = document.getElementById("btnAgregarDirectoFlotante");
const btnGastarSobreFlotante = document.getElementById("btnGastarSobreFlotante");
const btnCerrarFlotante = document.getElementById("btnCerrarFlotante");
const menuFlotanteBackdrop = document.querySelector(".menu-flotante-backdrop");

// MODAL AGREGAR DINERO
const modalAgregar = document.getElementById("modalAgregar");
const listaFuentesModal = document.getElementById("listaFuentesModal");
const inputCantidadAgregar = document.getElementById("inputCantidadAgregar");
const btnConfirmarAgregar = document.getElementById("btnConfirmarAgregar");
const btnCerrarAgregar = document.getElementById("btnCerrarAgregar");
const mensajeErrorAgregar = document.getElementById("mensajeErrorAgregar");

// MODAL AGREGAR DIRECTO
const modalAgregarDirecto = document.getElementById("modalAgregarDirecto");
const listaFuentesDirecto = document.getElementById("listaFuentesDirecto");
const inputCantidadDirecto = document.getElementById("inputCantidadDirecto");
const btnConfirmarDirecto = document.getElementById("btnConfirmarDirecto");
const btnCerrarDirecto = document.getElementById("btnCerrarDirecto");
const nombreSobreDirecto = document.getElementById("nombreSobreDirecto");
const saldoSobreDirecto = document.getElementById("saldoSobreDirecto");

// MODAL GASTAR
const modalGastarSobre = document.getElementById("modalGastarSobre");
const listaFuentesGastar = document.getElementById("listaFuentesGastar");
const inputCantidadGastar = document.getElementById("inputCantidadGastar");
const btnConfirmarGastar = document.getElementById("btnConfirmarGastar");
const btnCerrarGastar = document.getElementById("btnCerrarGastar");
const nombreSobreGastar = document.getElementById("nombreSobreGastar");
const saldoSobreGastar = document.getElementById("saldoSobreGastar");
const mensajeErrorGastar = document.getElementById("mensajeErrorGastar");

let fuenteSeleccionada = null;
let fuenteSeleccionadaDirecto = null;
let fuenteSeleccionadaGastar = null;

// MODAL TRANSFERIR
const btnTransferir = document.getElementById("btnTransferir");
const modalTransferir = document.getElementById("modalTransferir");
const listaFuentesDesde = document.getElementById("listaFuentesDesde");
const listaFuentesHacia = document.getElementById("listaFuentesHacia");
const inputCantidadTransferir = document.getElementById("inputCantidadTransferir");
const btnConfirmarTransferir = document.getElementById("btnConfirmarTransferir");
const btnCerrarTransferir = document.getElementById("btnCerrarTransferir");
const mensajeErrorTransferir = document.getElementById("mensajeErrorTransferir");

let fuenteSeleccionadaDesde = null;
let fuenteSeleccionadaHacia = null;

// -----------------------------------------------------
// ALMACENAMIENTO DE DATOS (Firestore / localStorage)
// -----------------------------------------------------

/**
 * Función auxiliar para cargar datos desde localStorage
 */
function cargarDesdeLocalStorage() {
    sobres = JSON.parse(localStorage.getItem("sobres")) || [];
    totalGeneral = Number(localStorage.getItem("totalGeneral")) || 0;
    porcentajeDisponible = Number(localStorage.getItem("porcentajeDisponible")) || 100;
    fuentes = JSON.parse(localStorage.getItem("fuentes")) || { "Efectivo": 0, "Nequi": 0, "Nu": 0 };
    totalIngresos = Number(localStorage.getItem("totalIngresos")) || 0;
    totalGastos = Number(localStorage.getItem("totalGastos")) || 0;
    gastos = JSON.parse(localStorage.getItem("gastos")) || [];
    prestamos = JSON.parse(localStorage.getItem("prestamos")) || [];
    movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
}

function guardarDatos() {
    // Nota: Esta función ahora es llamada DESPUÉS de requireAuth,
    // por lo que asumimos que el usuario ya está autenticado.
    // Si necesitamos protección adicional aquí, se puede agregar,
    // pero normalmente no será necesario ya que las acciones están protegidas.
    guardarDatosDirectamente();
}

/**
 * Guarda los datos en Firestore (si hay usuario autenticado) o localStorage (fallback)
 * Esta función es llamada internamente cuando hay usuario logueado
 * o después de que el usuario se autentica a través del modal.
 * 
 * IMPORTANTE: Si el usuario está en modo invitado, NO guarda los datos
 * (los datos solo viven en memoria durante la sesión actual)
 */
async function guardarDatosDirectamente() {
    // Verificar si el usuario está en modo invitado (usando API pública)
    // Si está en modo invitado, NO guardar datos (solo funcionan en memoria)
    if (typeof authIsGuestMode === 'function' && authIsGuestMode()) {
        // Modo invitado activo: NO guardar datos
        // Los datos solo existen en memoria durante esta sesión
        return;
    }
    
    // Verificar si hay usuario autenticado
    const currentUser = auth.currentUser;
    if (!currentUser) {
        // No hay usuario autenticado: usar localStorage como fallback
        localStorage.setItem("sobres", JSON.stringify(sobres));
        localStorage.setItem("totalGeneral", totalGeneral);
        localStorage.setItem("porcentajeDisponible", porcentajeDisponible);
        localStorage.setItem("fuentes", JSON.stringify(fuentes));
        localStorage.setItem("totalIngresos", totalIngresos);
        localStorage.setItem("totalGastos", totalGastos);
        localStorage.setItem("gastos", JSON.stringify(gastos));
        localStorage.setItem("prestamos", JSON.stringify(prestamos));
        localStorage.setItem("movimientos", JSON.stringify(movimientos));
        return;
    }
    
    // Usuario autenticado: guardar en Firestore
    try {
        const datosFinancieros = {
            sobres: sobres,
            totalGeneral: totalGeneral,
            porcentajeDisponible: porcentajeDisponible,
            fuentes: fuentes,
            totalIngresos: totalIngresos,
            totalGastos: totalGastos,
            gastos: gastos,
            prestamos: prestamos,
            movimientos: movimientos
        };
        
        await saveUserFinancialData(currentUser.uid, datosFinancieros);
    } catch (error) {
        console.error('Error al guardar en Firestore:', error);
        // Fallback a localStorage si hay error
        localStorage.setItem("sobres", JSON.stringify(sobres));
        localStorage.setItem("totalGeneral", totalGeneral);
        localStorage.setItem("porcentajeDisponible", porcentajeDisponible);
        localStorage.setItem("fuentes", JSON.stringify(fuentes));
        localStorage.setItem("totalIngresos", totalIngresos);
        localStorage.setItem("totalGastos", totalGastos);
        localStorage.setItem("gastos", JSON.stringify(gastos));
        localStorage.setItem("prestamos", JSON.stringify(prestamos));
        localStorage.setItem("movimientos", JSON.stringify(movimientos));
        
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('Error al guardar en la nube. Los datos se guardaron localmente.', 'warning', 4000);
        }
    }
}

/**
 * Carga los datos desde Firestore (si hay usuario autenticado) o localStorage (fallback)
 */
async function cargarDatos() {
    // Verificar si hay usuario autenticado
    const currentUser = auth.currentUser;
    
    if (currentUser) {
        // Usuario autenticado: cargar desde Firestore
        try {
            const datos = await getUserFinancialData(currentUser.uid);
            
            if (datos) {
                // Cargar datos desde Firestore
                sobres = datos.sobres || [];
                totalGeneral = Number(datos.totalGeneral) || 0;
                porcentajeDisponible = Number(datos.porcentajeDisponible) || 100;
                fuentes = datos.fuentes || { "Efectivo": 0, "Nequi": 0, "Nu": 0 };
                totalIngresos = Number(datos.totalIngresos) || 0;
                totalGastos = Number(datos.totalGastos) || 0;
                gastos = datos.gastos || [];
                prestamos = datos.prestamos || [];
                movimientos = datos.movimientos || [];
            } else {
                // No hay datos en Firestore, cargar desde localStorage (migración)
                cargarDesdeLocalStorage();
                
                // Si hay datos en localStorage, migrarlos a Firestore
                if (sobres.length > 0 || totalGeneral > 0 || Object.values(fuentes).some(v => v > 0)) {
                    await guardarDatosDirectamente();
                    if (typeof mostrarNotificacion === 'function') {
                        mostrarNotificacion('Datos migrados a la nube exitosamente', 'success', 3000);
                    }
                }
            }
            
            // Suscribirse a cambios en tiempo real para sincronización multi-dispositivo
            // Desuscribirse de la suscripción anterior si existe
            if (unsubscribeFinancialData) {
                unsubscribeFinancialData();
                unsubscribeFinancialData = null;
            }
            
            // Suscribirse a cambios en tiempo real
            unsubscribeFinancialData = subscribeToUserFinancialData(currentUser.uid, (datos) => {
                if (datos) {
                    // Actualizar datos cuando hay cambios en otro dispositivo
                    sobres = datos.sobres || [];
                    totalGeneral = Number(datos.totalGeneral) || 0;
                    porcentajeDisponible = Number(datos.porcentajeDisponible) || 100;
                    fuentes = datos.fuentes || { "Efectivo": 0, "Nequi": 0, "Nu": 0 };
                    totalIngresos = Number(datos.totalIngresos) || 0;
                    totalGastos = Number(datos.totalGastos) || 0;
                    gastos = datos.gastos || [];
                    prestamos = datos.prestamos || [];
                    movimientos = datos.movimientos || [];
                    
                    // Actualizar UI
                    actualizarTotalGeneral();
                    renderFuentes();
                    renderSobres();
                    renderGastos();
                    renderPrestamos();
                    
                    if (typeof renderEstadisticas === 'function') {
                        renderEstadisticas();
                    }
                }
            });
        } catch (error) {
            console.error('Error al cargar desde Firestore:', error);
            // Fallback a localStorage si hay error
            cargarDesdeLocalStorage();
            
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion('Error al cargar desde la nube. Usando datos locales.', 'warning', 4000);
            }
        }
    } else {
        // No hay usuario: cargar desde localStorage (modo invitado o sin login)
        // Desuscribirse de sincronización en tiempo real si existe
        if (unsubscribeFinancialData) {
            unsubscribeFinancialData();
            unsubscribeFinancialData = null;
        }
        
        cargarDesdeLocalStorage();
    }
    
    // Actualizar UI
    actualizarTotalGeneral();
    renderFuentes();
    renderSobres();
    renderGastos();
    renderPrestamos();
    
    // Renderizar estadísticas después de un pequeño delay para asegurar que el DOM esté listo
    if (typeof renderEstadisticas === 'function') {
        setTimeout(() => {
            renderEstadisticas();
            if (typeof inicializarFiltrosEstadisticas === 'function') {
                inicializarFiltrosEstadisticas();
            }
        }, 100);
    }
}

// Hacer cargarDatos disponible globalmente para que auth.js pueda llamarla
window.cargarDatos = cargarDatos;
// Hacer cambiarPantalla disponible globalmente
window.cambiarPantalla = cambiarPantalla;

/**
 * Función auxiliar para exportar desde localStorage
 */
function exportarDesdeLocalStorage() {
    return {
        fuente: 'localStorage',
        fechaExportacion: new Date().toISOString(),
        datos: {
            sobres: JSON.parse(localStorage.getItem("sobres") || "[]"),
            totalGeneral: Number(localStorage.getItem("totalGeneral") || 0),
            porcentajeDisponible: Number(localStorage.getItem("porcentajeDisponible") || 100),
            fuentes: JSON.parse(localStorage.getItem("fuentes") || '{"Efectivo": 0, "Nequi": 0, "Nu": 0}'),
            totalIngresos: Number(localStorage.getItem("totalIngresos") || 0),
            totalGastos: Number(localStorage.getItem("totalGastos") || 0),
            gastos: JSON.parse(localStorage.getItem("gastos") || "[]"),
            prestamos: JSON.parse(localStorage.getItem("prestamos") || "[]"),
            movimientos: JSON.parse(localStorage.getItem("movimientos") || "[]")
        }
    };
}

/**
 * Exporta todos los datos financieros a un archivo JSON
 * Funciona tanto para usuarios autenticados (Firestore) como no autenticados (localStorage)
 * @returns {Promise<object>} - Datos exportados
 */
async function exportarDatos() {
    try {
        let datosExportar = {};
        
        // Si hay usuario autenticado, obtener desde Firestore
        const currentUser = auth.currentUser;
        if (currentUser) {
            try {
                const datos = await getUserFinancialData(currentUser.uid);
                if (datos) {
                    datosExportar = {
                        fuente: 'Firestore',
                        fechaExportacion: new Date().toISOString(),
                        usuario: currentUser.email,
                        datos: datos
                    };
                } else {
                    // Si no hay datos en Firestore, usar localStorage
                    datosExportar = exportarDesdeLocalStorage();
                }
            } catch (error) {
                console.error('Error al obtener desde Firestore, usando localStorage:', error);
                datosExportar = exportarDesdeLocalStorage();
            }
        } else {
            // No hay usuario, exportar desde localStorage
            datosExportar = exportarDesdeLocalStorage();
        }
        
        // Crear archivo JSON
        const jsonString = JSON.stringify(datosExportar, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Crear enlace de descarga
        const link = document.createElement('a');
        const fecha = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        link.href = url;
        link.download = `backup-finanzas-${fecha}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Mostrar notificación
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('Datos exportados exitosamente', 'success', 3000);
        }
        
        return datosExportar;
    } catch (error) {
        console.error('Error al exportar datos:', error);
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('Error al exportar datos: ' + error.message, 'error', 4000);
        }
        throw error;
    }
}

/**
 * Restaura datos desde un archivo JSON de backup
 * @param {File} archivo - Archivo JSON de backup
 */
async function restaurarDesdeBackup(archivo) {
    try {
        const texto = await archivo.text();
        const datosBackup = JSON.parse(texto);
        
        if (!datosBackup.datos) {
            throw new Error('El archivo de backup no tiene formato válido');
        }
        
        const datos = datosBackup.datos;
        
        // Restaurar datos en las variables globales
        sobres = datos.sobres || [];
        totalGeneral = Number(datos.totalGeneral) || 0;
        porcentajeDisponible = Number(datos.porcentajeDisponible) || 100;
        fuentes = datos.fuentes || { "Efectivo": 0, "Nequi": 0, "Nu": 0 };
        totalIngresos = Number(datos.totalIngresos) || 0;
        totalGastos = Number(datos.totalGastos) || 0;
        gastos = datos.gastos || [];
        prestamos = datos.prestamos || [];
        movimientos = datos.movimientos || [];
        
        // Guardar en Firestore si hay usuario autenticado, o localStorage si no
        await guardarDatosDirectamente();
        
        // Actualizar UI
        actualizarTotalGeneral();
        renderFuentes();
        renderSobres();
        renderGastos();
        renderPrestamos();
        if (typeof renderEstadisticas === 'function') {
            renderEstadisticas();
        }
        
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('Datos restaurados exitosamente', 'success', 3000);
        }
    } catch (error) {
        console.error('Error al restaurar backup:', error);
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('Error al restaurar backup: ' + error.message, 'error', 4000);
        }
        throw error;
    }
}

// Hacer las funciones disponibles globalmente
window.exportarDatos = exportarDatos;
window.restaurarDesdeBackup = restaurarDesdeBackup;

// Cargar datos al iniciar (async)
(async () => {
    await cargarDatos();
})();

// -----------------------------------------------------
// UI
// -----------------------------------------------------
function actualizarTotalGeneral() {
    totalGeneralHTML.textContent = formatoCOP(totalGeneral);
}

function renderFuentes() {
    Object.keys(fuentes).forEach(nombre => {
        let fila = document.querySelector(`.fuente-item[data-f="${nombre}"] strong`);
        if (fila) fila.textContent = formatoCOP(fuentes[nombre]);
    });
}

function renderSobres() {
    listaSobres.innerHTML = "";

    sobres.forEach(sobre => {
        const div = document.createElement("div");
        div.classList.add("sobre");

        div.innerHTML = `
            <span class="edit-btn" data-id="${sobre.id}">✏️</span>
            <h3>${sobre.nombre}</h3>
            <p class="valor">${formatoCOP(sobre.valor)}</p>
            <p class="porcentaje">${sobre.porcentaje}%</p>
        `;

        listaSobres.appendChild(div);
    });

    // Click en el lápiz para editar
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation(); // Evitar que se active el click del sobre
            let id = btn.getAttribute("data-id");
            sobreActual = sobres.find(s => s.id == id);

            editarNombreActual.textContent = `Sobre: ${sobreActual.nombre}`;
            // Ocultar lápices cuando se abre el modal
            document.querySelectorAll(".edit-btn").forEach(btn => {
                btn.style.display = "none";
            });
            modal.classList.remove("hidden");
            ocultarBtnAgregarGasto();
        });
    });

    // Click en el sobre para mostrar menú flotante
    document.querySelectorAll(".sobre").forEach(sobreDiv => {
        sobreDiv.addEventListener("click", (e) => {
            // No activar si se hace click en el lápiz
            if (e.target.classList.contains("edit-btn") || e.target.closest(".edit-btn")) {
                return;
            }
            
            let id = sobreDiv.querySelector(".edit-btn").getAttribute("data-id");
            sobreActual = sobres.find(s => s.id == id);
            
            nombreSobreFlotante.textContent = sobreActual.nombre;
            menuFlotanteSobre.classList.remove("hidden");
        });
    });
}

// -----------------------------------------------------
// CREAR SOBRE
// -----------------------------------------------------
btnCrearSobre.addEventListener("click", () => {
    inputNombreSobre.value = "";
    inputPorcentajeSobre.value = "";
    porcentajeDisponibleInfo.textContent = `Porcentaje disponible: ${porcentajeDisponible}%`;
    mensajeErrorCrearSobre.style.display = "none";
    modalCrearSobre.classList.remove("hidden");
    // Ocultar lápices cuando se abre el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "none";
    });
    ocultarBtnAgregarGasto();
    // Enfocar el input de nombre
    setTimeout(() => inputNombreSobre.focus(), 100);
});

// Cerrar modal crear sobre al hacer click fuera
modalCrearSobre.addEventListener("click", (e) => {
    if (e.target === modalCrearSobre) {
        modalCrearSobre.classList.add("hidden");
        inputNombreSobre.value = "";
        inputPorcentajeSobre.value = "";
        mensajeErrorCrearSobre.style.display = "none";
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
        mostrarBtnAgregarGasto();
    }
});

btnCerrarCrearSobre.addEventListener("click", () => {
    modalCrearSobre.classList.add("hidden");
    inputNombreSobre.value = "";
    inputPorcentajeSobre.value = "";
    mensajeErrorCrearSobre.style.display = "none";
    // Mostrar lápices cuando se cierra el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "";
    });
    mostrarBtnAgregarGasto();
});

// Función para confirmar crear sobre
function confirmarCrearSobre() {
    let nombre = inputNombreSobre.value.trim();
    let porcentajeStr = inputPorcentajeSobre.value.trim();

    // Validar nombre
    if (!nombre) {
        mensajeErrorCrearSobre.textContent = "Ingresa un nombre para el sobre";
        mensajeErrorCrearSobre.style.display = "block";
        return;
    }

    // Validar porcentaje
    if (!porcentajeStr) {
        mensajeErrorCrearSobre.textContent = "Ingresa un porcentaje";
        mensajeErrorCrearSobre.style.display = "block";
        return;
    }

    let porcentaje = Number(porcentajeStr);

    if (isNaN(porcentaje) || porcentaje <= 0) {
        mensajeErrorCrearSobre.textContent = "El porcentaje debe ser un número mayor a 0";
        mensajeErrorCrearSobre.style.display = "block";
        return;
    }

    if (porcentaje > porcentajeDisponible) {
        mensajeErrorCrearSobre.textContent = `Porcentaje incorrecto. Disponible: ${porcentajeDisponible}%`;
        mensajeErrorCrearSobre.style.display = "block";
        return;
    }

    // Ocultar mensaje de error si todo está bien
    mensajeErrorCrearSobre.style.display = "none";

    let valorInicial = totalGeneral > 0 ? (totalGeneral * porcentaje) / 100 : 0;

    sobres.push({
        id: Date.now(),
        nombre,
        valor: valorInicial,
        porcentaje
    });

    porcentajeDisponible -= porcentaje;

    renderSobres();
    guardarDatos();

    // Limpiar y cerrar modal
    inputNombreSobre.value = "";
    inputPorcentajeSobre.value = "";
    modalCrearSobre.classList.add("hidden");
    // Mostrar lápices cuando se cierra el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "";
    });
    mostrarBtnAgregarGasto();
}

btnConfirmarCrearSobre.addEventListener("click", () => {
    requireAuth(confirmarCrearSobre);
});

// Agregar con Enter en los inputs
inputNombreSobre.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        inputPorcentajeSobre.focus();
    }
});

inputPorcentajeSobre.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        requireAuth(confirmarCrearSobre);
    }
});

// -----------------------------------------------------
// TRANSFERIR DINERO
// -----------------------------------------------------
if (btnTransferir) {
    btnTransferir.addEventListener("click", () => {
        listaFuentesDesde.innerHTML = "";
        listaFuentesHacia.innerHTML = "";
        fuenteSeleccionadaDesde = null;
        fuenteSeleccionadaHacia = null;
        
        // Crear botones para ambas columnas
        Object.keys(fuentes).forEach(nombre => {
            // Botón para "Desde"
            let btnDesde = document.createElement("button");
            btnDesde.textContent = nombre;
            btnDesde.classList.add("fuente-transferir-btn");
            btnDesde.setAttribute("data-fuente", nombre);
            btnDesde.setAttribute("data-lado", "desde");
            
            btnDesde.addEventListener("click", () => {
                // Si ya está seleccionada la misma fuente en "hacia", deseleccionarla
                if (fuenteSeleccionadaHacia === nombre) {
                    fuenteSeleccionadaHacia = null;
                    document.querySelectorAll("#listaFuentesHacia .fuente-transferir-btn")
                        .forEach(b => {
                            b.classList.remove("selected");
                            b.classList.remove("disabled");
                        });
                }
                
                // Si ya está seleccionada en "desde", deseleccionarla
                if (fuenteSeleccionadaDesde === nombre) {
                    fuenteSeleccionadaDesde = null;
                    btnDesde.classList.remove("selected");
                    
                    // Habilitar esta fuente en "hacia" si no hay otra seleccionada en "desde"
                    const btnHaciaMismo = document.querySelector(`#listaFuentesHacia .fuente-transferir-btn[data-fuente="${nombre}"]`);
                    if (btnHaciaMismo) {
                        btnHaciaMismo.classList.remove("disabled");
                    }
                    
                    if (mensajeErrorTransferir) {
                        mensajeErrorTransferir.style.display = "none";
                    }
                    return;
                }
                
                // Guardar la fuente anterior seleccionada en "desde"
                const fuenteAnteriorDesde = fuenteSeleccionadaDesde;
                
                fuenteSeleccionadaDesde = nombre;
                
                // Remover selección de todos los botones "desde"
                document.querySelectorAll("#listaFuentesDesde .fuente-transferir-btn")
                    .forEach(b => b.classList.remove("selected"));
                btnDesde.classList.add("selected");
                
                // Si había una fuente anterior seleccionada en "desde" y es diferente a la nueva
                if (fuenteAnteriorDesde && fuenteAnteriorDesde !== nombre) {
                    // Habilitar la fuente anterior en "hacia" (si no es la que está seleccionada)
                    const btnHaciaAnterior = document.querySelector(`#listaFuentesHacia .fuente-transferir-btn[data-fuente="${fuenteAnteriorDesde}"]`);
                    if (btnHaciaAnterior && fuenteSeleccionadaHacia !== fuenteAnteriorDesde) {
                        btnHaciaAnterior.classList.remove("disabled");
                    }
                }
                
                // Desactivar el mismo botón en "hacia" (la nueva selección)
                const btnHaciaMismo = document.querySelector(`#listaFuentesHacia .fuente-transferir-btn[data-fuente="${nombre}"]`);
                if (btnHaciaMismo) {
                    btnHaciaMismo.classList.add("disabled");
                }
                
                if (mensajeErrorTransferir) {
                    mensajeErrorTransferir.style.display = "none";
                }
            });
            
            listaFuentesDesde.appendChild(btnDesde);
            
            // Botón para "Hacia"
            let btnHacia = document.createElement("button");
            btnHacia.textContent = nombre;
            btnHacia.classList.add("fuente-transferir-btn");
            btnHacia.setAttribute("data-fuente", nombre);
            btnHacia.setAttribute("data-lado", "hacia");
            
            btnHacia.addEventListener("click", () => {
                // Si el botón está deshabilitado, no hacer nada
                if (btnHacia.classList.contains("disabled")) {
                    return;
                }
                
                // Si ya está seleccionada la misma fuente en "desde", deseleccionarla
                if (fuenteSeleccionadaDesde === nombre) {
                    fuenteSeleccionadaDesde = null;
                    document.querySelectorAll("#listaFuentesDesde .fuente-transferir-btn")
                        .forEach(b => {
                            b.classList.remove("selected");
                            b.classList.remove("disabled");
                        });
                }
                
                // Si ya está seleccionada en "hacia", deseleccionarla
                if (fuenteSeleccionadaHacia === nombre) {
                    fuenteSeleccionadaHacia = null;
                    btnHacia.classList.remove("selected");
                    
                    // Habilitar esta fuente en "desde" si no hay otra seleccionada en "hacia"
                    const btnDesdeMismo = document.querySelector(`#listaFuentesDesde .fuente-transferir-btn[data-fuente="${nombre}"]`);
                    if (btnDesdeMismo) {
                        btnDesdeMismo.classList.remove("disabled");
                    }
                    
                    if (mensajeErrorTransferir) {
                        mensajeErrorTransferir.style.display = "none";
                    }
                    return;
                }
                
                // Guardar la fuente anterior seleccionada en "hacia"
                const fuenteAnteriorHacia = fuenteSeleccionadaHacia;
                
                fuenteSeleccionadaHacia = nombre;
                
                // Remover selección de todos los botones "hacia"
                document.querySelectorAll("#listaFuentesHacia .fuente-transferir-btn")
                    .forEach(b => b.classList.remove("selected"));
                
                // Agregar selected al botón clickeado
                btnHacia.classList.add("selected");
                
                // Si había una fuente anterior seleccionada en "hacia" y es diferente a la nueva
                if (fuenteAnteriorHacia && fuenteAnteriorHacia !== nombre) {
                    // Habilitar la fuente anterior en "desde" (si no es la que está seleccionada)
                    const btnDesdeAnterior = document.querySelector(`#listaFuentesDesde .fuente-transferir-btn[data-fuente="${fuenteAnteriorHacia}"]`);
                    if (btnDesdeAnterior && fuenteSeleccionadaDesde !== fuenteAnteriorHacia) {
                        btnDesdeAnterior.classList.remove("disabled");
                    }
                }
                
                // Desactivar el mismo botón en "desde" (la nueva selección)
                const btnDesdeMismo = document.querySelector(`#listaFuentesDesde .fuente-transferir-btn[data-fuente="${nombre}"]`);
                if (btnDesdeMismo) {
                    btnDesdeMismo.classList.add("disabled");
                }
                
                if (mensajeErrorTransferir) {
                    mensajeErrorTransferir.style.display = "none";
                }
            });
            
            listaFuentesHacia.appendChild(btnHacia);
        });
        
        if (inputCantidadTransferir) {
            inputCantidadTransferir.value = "";
        }
        if (mensajeErrorTransferir) {
            mensajeErrorTransferir.style.display = "none";
        }
        
        // Ocultar lápices cuando se abre el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "none";
        });
        if (modalTransferir) {
            modalTransferir.classList.remove("hidden");
        }
        ocultarBtnAgregarGasto();
    });
}

// Cerrar modal transferir al hacer click fuera
if (modalTransferir) {
    modalTransferir.addEventListener("click", (e) => {
        if (e.target === modalTransferir) {
            modalTransferir.classList.add("hidden");
            fuenteSeleccionadaDesde = null;
            fuenteSeleccionadaHacia = null;
            if (inputCantidadTransferir) {
                inputCantidadTransferir.value = "";
            }
            if (mensajeErrorTransferir) {
                mensajeErrorTransferir.style.display = "none";
            }
            // Mostrar lápices cuando se cierra el modal
            document.querySelectorAll(".edit-btn").forEach(btn => {
                btn.style.display = "";
            });
            mostrarBtnAgregarGasto();
        }
    });
}

// Cerrar modal transferir
if (btnCerrarTransferir) {
    btnCerrarTransferir.addEventListener("click", () => {
        if (modalTransferir) {
            modalTransferir.classList.add("hidden");
        }
        fuenteSeleccionadaDesde = null;
        fuenteSeleccionadaHacia = null;
        if (inputCantidadTransferir) {
            inputCantidadTransferir.value = "";
        }
        if (mensajeErrorTransferir) {
            mensajeErrorTransferir.style.display = "none";
        }
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
        mostrarBtnAgregarGasto();
    });
}

// Confirmar transferencia
if (btnConfirmarTransferir) {
    btnConfirmarTransferir.addEventListener("click", () => {
        requireAuth(() => {
        let cantidadStr = inputCantidadTransferir ? inputCantidadTransferir.value.trim() : "";
        
        // Validar fuente desde
        if (!fuenteSeleccionadaDesde) {
            if (mensajeErrorTransferir) {
                mensajeErrorTransferir.textContent = "Selecciona la fuente de origen";
                mensajeErrorTransferir.style.display = "block";
            }
            return;
        }
        
        // Validar fuente hacia
        if (!fuenteSeleccionadaHacia) {
            if (mensajeErrorTransferir) {
                mensajeErrorTransferir.textContent = "Selecciona la fuente de destino";
                mensajeErrorTransferir.style.display = "block";
            }
            return;
        }
        
        // Validar que sean diferentes
        if (fuenteSeleccionadaDesde === fuenteSeleccionadaHacia) {
            if (mensajeErrorTransferir) {
                mensajeErrorTransferir.textContent = "No puedes transferir a la misma fuente";
                mensajeErrorTransferir.style.display = "block";
            }
            return;
        }
        
        // Validar cantidad
        if (!cantidadStr) {
            if (mensajeErrorTransferir) {
                mensajeErrorTransferir.textContent = "Ingresa una cantidad";
                mensajeErrorTransferir.style.display = "block";
            }
            return;
        }
        
        let cantidad = Number(cantidadStr.replace(/[^\d.]/g, ""));
        
        if (isNaN(cantidad) || cantidad <= 0) {
            if (mensajeErrorTransferir) {
                mensajeErrorTransferir.textContent = "Cantidad inválida. Debe ser un número mayor a 0";
                mensajeErrorTransferir.style.display = "block";
            }
            return;
        }
        
        // Verificar que haya suficiente en la fuente de origen
        if (cantidad > fuentes[fuenteSeleccionadaDesde]) {
            if (mensajeErrorTransferir) {
                mensajeErrorTransferir.textContent = `No hay suficiente dinero en ${fuenteSeleccionadaDesde}. Disponible: ${formatoCOP(fuentes[fuenteSeleccionadaDesde])}`;
                mensajeErrorTransferir.style.display = "block";
            }
            return;
        }
        
        // Realizar la transferencia
        fuentes[fuenteSeleccionadaDesde] -= cantidad;
        fuentes[fuenteSeleccionadaHacia] += cantidad;
        
        // Registrar movimiento
        registrarMovimiento('transferencia', `Transferencia de ${fuenteSeleccionadaDesde} a ${fuenteSeleccionadaHacia}`, cantidad, fuenteSeleccionadaDesde);
        
        // Ocultar mensaje de error si todo está bien
        if (mensajeErrorTransferir) {
            mensajeErrorTransferir.style.display = "none";
        }
        
        // Actualizar y guardar
        renderFuentes();
        guardarDatos();
        
        // Guardar nombres antes de limpiar variables
        const nombreDesde = fuenteSeleccionadaDesde;
        const nombreHacia = fuenteSeleccionadaHacia;
        
        // Limpiar y cerrar modal
        if (inputCantidadTransferir) {
            inputCantidadTransferir.value = "";
        }
        fuenteSeleccionadaDesde = null;
        fuenteSeleccionadaHacia = null;
        if (modalTransferir) {
            modalTransferir.classList.add("hidden");
        }
        
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
        mostrarBtnAgregarGasto();
        
        // Mostrar notificación
        mostrarNotificacion(`Transferencia de ${formatoCOP(cantidad)} realizada de ${nombreDesde} a ${nombreHacia}`, "success", 3000);
        });
    });
}

// Permitir transferir con Enter
if (inputCantidadTransferir) {
    inputCantidadTransferir.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (btnConfirmarTransferir) {
                btnConfirmarTransferir.click();
            }
        }
    });
}

// -----------------------------------------------------
// AGREGAR DINERO — MODAL
// -----------------------------------------------------
btnAgregar.addEventListener("click", () => {

    listaFuentesModal.innerHTML = "";

    Object.keys(fuentes).forEach(nombre => {
        let btn = document.createElement("button");
        btn.textContent = nombre;
        btn.classList.add("fuente-btn");

        // ⭐ Selección visual correcta
        btn.addEventListener("click", () => {
            fuenteSeleccionada = nombre;

            document.querySelectorAll("#listaFuentesModal .fuente-btn")
                .forEach(b => b.classList.remove("selected"));

            btn.classList.add("selected");
            // Ocultar mensaje de error cuando se selecciona una fuente
            if (mensajeErrorAgregar) {
                mensajeErrorAgregar.style.display = "none";
            }
        });

        listaFuentesModal.appendChild(btn);

    });

    inputCantidadAgregar.value = "";
    fuenteSeleccionada = null;
    if (mensajeErrorAgregar) {
        mensajeErrorAgregar.style.display = "none";
    }

    modalAgregar.classList.remove("hidden");
    // Ocultar lápices cuando se abre el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "none";
    });
    ocultarBtnAgregarGasto();
});

// Cerrar modal agregar al hacer click fuera
modalAgregar.addEventListener("click", (e) => {
    // Si se clickea el backdrop (el modal mismo, no el contenido)
    if (e.target === modalAgregar) {
        modalAgregar.classList.add("hidden");
        fuenteSeleccionada = null;
        inputCantidadAgregar.value = "";
        mensajeErrorAgregar.style.display = "none";
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
        mostrarBtnAgregarGasto();
    }
});

// cerrar modal agregar
btnCerrarAgregar.addEventListener("click", () => {
    modalAgregar.classList.add("hidden");
    fuenteSeleccionada = null;
    inputCantidadAgregar.value = "";
    mensajeErrorAgregar.style.display = "none";
    // Mostrar lápices cuando se cierra el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "";
    });
    mostrarBtnAgregarGasto();
});

// Función para registrar un movimiento
function registrarMovimiento(tipo, descripcion, monto, fuente = null, sobre = null, gasto = null) {
    const movimiento = {
        id: Date.now(),
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0].substring(0, 5),
        tipo: tipo, // 'ingreso', 'gasto', 'reset', 'transferencia', etc.
        descripcion: descripcion,
        monto: monto,
        fuente: fuente,
        sobre: sobre,
        gasto: gasto
    };
    
    movimientos.unshift(movimiento); // Agregar al inicio
    guardarDatos();
}

// Función para confirmar agregar (reutilizable)
function confirmarAgregar() {
    let cantidadStr = inputCantidadAgregar.value.trim();
    
    // Validar fuente seleccionada
    if (!fuenteSeleccionada) {
        mensajeErrorAgregar.textContent = "Selecciona una fuente";
        mensajeErrorAgregar.style.display = "block";
        return;
    }
    
    // Validar cantidad
    if (!cantidadStr) {
        mensajeErrorAgregar.textContent = "Ingresa una cantidad";
        mensajeErrorAgregar.style.display = "block";
        return;
    }
    
    let cantidad = Number(cantidadStr.replace(/[^\d.]/g, ""));

    if (isNaN(cantidad) || cantidad <= 0) {
        mensajeErrorAgregar.textContent = "Cantidad inválida. Debe ser un número mayor a 0";
        mensajeErrorAgregar.style.display = "block";
        return;
    }

    // Ocultar mensaje de error si todo está bien
    mensajeErrorAgregar.style.display = "none";

    // Agrega a la fuente
    fuentes[fuenteSeleccionada] += cantidad;

    // Agrega al total
    totalGeneral += cantidad;
    totalIngresos += cantidad;

    // Distribuye por porcentajes
    sobres.forEach(s => {
        s.valor += (cantidad * s.porcentaje) / 100;
    });

    // Registrar movimiento
    registrarMovimiento('ingreso', `Agregado a ${fuenteSeleccionada}`, cantidad, fuenteSeleccionada);

    actualizarTotalGeneral();
    renderSobres();
    renderFuentes();
    if (typeof renderEstadisticas === 'function') {
        renderEstadisticas();
    }
    guardarDatos();
    // Limpiar y cerrar modal
    inputCantidadAgregar.value = "";
    fuenteSeleccionada = null;
    // Limpiar selección visual
    document.querySelectorAll("#listaFuentesModal .fuente-btn")
        .forEach(b => b.classList.remove("selected"));
    modalAgregar.classList.add("hidden");
    // Mostrar lápices cuando se cierra el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "";
    });
    mostrarBtnAgregarGasto();
}

// confirmar agregar
btnConfirmarAgregar.addEventListener("click", () => {
    requireAuth(confirmarAgregar);
});

// Agregar con Enter
inputCantidadAgregar.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        requireAuth(confirmarAgregar);
    }
});

// -----------------------------------------------------
// GASTAR DINERO (eliminado del panel, ahora está en modal de sobre)
// -----------------------------------------------------

// -----------------------------------------------------
// MODAL OPCIONES
// -----------------------------------------------------
// Cerrar modal editar al hacer click fuera
modal.addEventListener("click", (e) => {
    // Si se clickea el backdrop (el modal mismo, no el contenido)
    if (e.target === modal) {
        modal.classList.add("hidden");
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
    }
});

btnCerrarModal.addEventListener("click", () => {
    modal.classList.add("hidden");
    // Mostrar lápices cuando se cierra el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "";
    });
});

btnCambiarNombre.addEventListener("click", () => {
    modal.classList.add("hidden");
    inputNuevoNombre.value = sobreActual.nombre;
    mensajeErrorCambiarNombre.style.display = "none";
    modalCambiarNombre.classList.remove("hidden");
    ocultarBtnAgregarGasto();
    setTimeout(() => inputNuevoNombre.focus(), 100);
});

// Cerrar modal cambiar nombre al hacer click fuera
if (modalCambiarNombre) {
    modalCambiarNombre.addEventListener("click", (e) => {
        if (e.target === modalCambiarNombre) {
            modalCambiarNombre.classList.add("hidden");
            inputNuevoNombre.value = "";
            mensajeErrorCambiarNombre.style.display = "none";
            mostrarBtnAgregarGasto();
        }
    });
}

if (btnCerrarCambiarNombre) {
    btnCerrarCambiarNombre.addEventListener("click", () => {
        modalCambiarNombre.classList.add("hidden");
        inputNuevoNombre.value = "";
        mensajeErrorCambiarNombre.style.display = "none";
        mostrarBtnAgregarGasto();
    });
}

if (btnConfirmarCambiarNombre) {
    btnConfirmarCambiarNombre.addEventListener("click", () => {
        requireAuth(() => {
            let nuevo = inputNuevoNombre.value.trim();
            if (!nuevo) {
                mensajeErrorCambiarNombre.textContent = "El nombre no puede estar vacío";
                mensajeErrorCambiarNombre.style.display = "block";
                return;
            }

            sobreActual.nombre = nuevo;
            guardarDatos();
            renderSobres();
            modalCambiarNombre.classList.add("hidden");
            inputNuevoNombre.value = "";
            mensajeErrorCambiarNombre.style.display = "none";
            mostrarNotificacion("Nombre actualizado correctamente", "success", 3000);
            mostrarBtnAgregarGasto();
        });
    });
}

// Permitir cambiar nombre con Enter
if (inputNuevoNombre) {
    inputNuevoNombre.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (btnConfirmarCambiarNombre) {
                btnConfirmarCambiarNombre.click();
            }
        }
    });
}

btnCambiarPorcentaje.addEventListener("click", () => {
    modal.classList.add("hidden");
    inputNuevoPorcentaje.value = sobreActual.porcentaje;
    porcentajeDisponibleEditar.textContent = `Porcentaje disponible: ${porcentajeDisponible + sobreActual.porcentaje}%`;
    mensajeErrorCambiarPorcentaje.style.display = "none";
    modalCambiarPorcentaje.classList.remove("hidden");
    ocultarBtnAgregarGasto();
    setTimeout(() => inputNuevoPorcentaje.focus(), 100);
});

// Cerrar modal cambiar porcentaje al hacer click fuera
if (modalCambiarPorcentaje) {
    modalCambiarPorcentaje.addEventListener("click", (e) => {
        if (e.target === modalCambiarPorcentaje) {
            modalCambiarPorcentaje.classList.add("hidden");
            inputNuevoPorcentaje.value = "";
            mensajeErrorCambiarPorcentaje.style.display = "none";
            mostrarBtnAgregarGasto();
        }
    });
}

if (btnCerrarCambiarPorcentaje) {
    btnCerrarCambiarPorcentaje.addEventListener("click", () => {
        modalCambiarPorcentaje.classList.add("hidden");
        inputNuevoPorcentaje.value = "";
        mensajeErrorCambiarPorcentaje.style.display = "none";
        mostrarBtnAgregarGasto();
    });
}

// ✅ CORRECCIÓN DEL BUG DE PORCENTAJES
if (btnConfirmarCambiarPorcentaje) {
    btnConfirmarCambiarPorcentaje.addEventListener("click", () => {
        requireAuth(() => {
            let nuevoStr = inputNuevoPorcentaje.value.trim();
            if (!nuevoStr) {
                mensajeErrorCambiarPorcentaje.textContent = "Ingresa un porcentaje";
                mensajeErrorCambiarPorcentaje.style.display = "block";
                return;
            }

            let nuevo = Number(nuevoStr);
            if (isNaN(nuevo) || nuevo <= 0) {
                mensajeErrorCambiarPorcentaje.textContent = "Porcentaje inválido. Debe ser un número mayor a 0";
                mensajeErrorCambiarPorcentaje.style.display = "block";
                return;
            }

            // Calcular el porcentaje disponible incluyendo el del sobre actual
            const porcentajeDisponibleParaEseSobre = porcentajeDisponible + sobreActual.porcentaje;

            if (nuevo > porcentajeDisponibleParaEseSobre) {
                mensajeErrorCambiarPorcentaje.textContent = `No tienes suficiente porcentaje disponible. Disponible: ${porcentajeDisponibleParaEseSobre}%`;
                mensajeErrorCambiarPorcentaje.style.display = "block";
                return;
            }

            // Solo si todo es válido, modificar porcentajeDisponible
            porcentajeDisponible += sobreActual.porcentaje;
            porcentajeDisponible -= nuevo;
            sobreActual.porcentaje = nuevo;

            guardarDatos();
            renderSobres();
            modalCambiarPorcentaje.classList.add("hidden");
            inputNuevoPorcentaje.value = "";
            mensajeErrorCambiarPorcentaje.style.display = "none";
            mostrarNotificacion("Porcentaje actualizado correctamente", "success", 3000);
            mostrarBtnAgregarGasto();
        });
    });
}

// Permitir cambiar porcentaje con Enter
if (inputNuevoPorcentaje) {
    inputNuevoPorcentaje.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (btnConfirmarCambiarPorcentaje) {
                btnConfirmarCambiarPorcentaje.click();
            }
        }
    });
}

btnEliminarSobre.addEventListener("click", () => {
    modal.classList.add("hidden");
    modalConfirmarEliminarSobre.classList.remove("hidden");
    ocultarBtnAgregarGasto();
});

// Cerrar modal confirmar eliminar sobre al hacer click fuera
if (modalConfirmarEliminarSobre) {
    modalConfirmarEliminarSobre.addEventListener("click", (e) => {
        if (e.target === modalConfirmarEliminarSobre) {
            modalConfirmarEliminarSobre.classList.add("hidden");
            mostrarBtnAgregarGasto();
        }
    });
}

if (btnCancelarEliminarSobre) {
    btnCancelarEliminarSobre.addEventListener("click", () => {
        modalConfirmarEliminarSobre.classList.add("hidden");
        mostrarBtnAgregarGasto();
    });
}

if (btnConfirmarEliminarSobre) {
    btnConfirmarEliminarSobre.addEventListener("click", () => {
        requireAuth(() => {
            porcentajeDisponible += sobreActual.porcentaje;
            const nombreEliminado = sobreActual.nombre;
            sobres = sobres.filter(s => s.id !== sobreActual.id);

            guardarDatos();
            renderSobres();
            modalConfirmarEliminarSobre.classList.add("hidden");
            mostrarNotificacion(`Sobre "${nombreEliminado}" eliminado correctamente`, "success", 3000);
            mostrarBtnAgregarGasto();
        });
    });
}

// -----------------------------------------------------
// CERRAR MENÚ FLOTANTE
// -----------------------------------------------------
btnCerrarFlotante.addEventListener("click", () => {
    menuFlotanteSobre.classList.add("hidden");
});

menuFlotanteBackdrop.addEventListener("click", () => {
    menuFlotanteSobre.classList.add("hidden");
});

// -----------------------------------------------------
// AGREGAR DIRECTO A SOBRE
// -----------------------------------------------------
btnAgregarDirectoFlotante.addEventListener("click", () => {
    nombreSobreDirecto.textContent = sobreActual.nombre;
    saldoSobreDirecto.textContent = `Saldo actual: ${formatoCOP(sobreActual.valor)}`;
    
    listaFuentesDirecto.innerHTML = "";
    fuenteSeleccionadaDirecto = null;

    Object.keys(fuentes).forEach(nombre => {
        let btn = document.createElement("button");
        btn.textContent = nombre;
        btn.classList.add("fuente-btn");

        btn.addEventListener("click", () => {
            fuenteSeleccionadaDirecto = nombre;
            document.querySelectorAll("#listaFuentesDirecto .fuente-btn")
                .forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
        });

        listaFuentesDirecto.appendChild(btn);
    });

    inputCantidadDirecto.value = "";
    menuFlotanteSobre.classList.add("hidden");
    // Ocultar lápices cuando se abre el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "none";
    });
    modalAgregarDirecto.classList.remove("hidden");
    ocultarBtnAgregarGasto();
});

// Cerrar modal agregar directo al hacer click fuera
modalAgregarDirecto.addEventListener("click", (e) => {
    if (e.target === modalAgregarDirecto) {
        modalAgregarDirecto.classList.add("hidden");
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
        mostrarBtnAgregarGasto();
    }
});

btnCerrarDirecto.addEventListener("click", () => {
    modalAgregarDirecto.classList.add("hidden");
    // Mostrar lápices cuando se cierra el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "";
    });
});

btnConfirmarDirecto.addEventListener("click", () => {
    requireAuth(() => {
        let cantidadStr = inputCantidadDirecto.value.trim();
        if (!cantidadStr) return;
        
        let cantidad = Number(cantidadStr.replace(/[^\d.]/g, ""));

        if (!fuenteSeleccionadaDirecto) return;
        if (isNaN(cantidad) || cantidad <= 0) return;

        // Agregar a la fuente
        fuentes[fuenteSeleccionadaDirecto] += cantidad;

        // Agregar al sobre actual (directo, sin recalcular porcentajes)
        sobreActual.valor += cantidad;
        totalGeneral += cantidad;
        totalIngresos += cantidad;

        // Registrar movimiento
        registrarMovimiento('ingreso', `Agregado directo a ${sobreActual.nombre}`, cantidad, fuenteSeleccionadaDirecto, sobreActual.nombre);

        actualizarTotalGeneral();
        renderSobres();
        renderFuentes();
        if (typeof renderEstadisticas === 'function') {
            renderEstadisticas();
        }
        guardarDatos();
        
        modalAgregarDirecto.classList.add("hidden");
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
    });
});

// Permitir agregar directo con Enter
if (inputCantidadDirecto && btnConfirmarDirecto) {
    inputCantidadDirecto.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            btnConfirmarDirecto.click();
        }
    });
}

// -----------------------------------------------------
// GASTAR DE SOBRE
// -----------------------------------------------------
btnGastarSobreFlotante.addEventListener("click", () => {
    nombreSobreGastar.textContent = sobreActual.nombre;
    saldoSobreGastar.textContent = `Saldo actual: ${formatoCOP(sobreActual.valor)}`;
    
    listaFuentesGastar.innerHTML = "";
    fuenteSeleccionadaGastar = null;

    Object.keys(fuentes).forEach(nombre => {
        // Obtener el valor actualizado de la fuente (misma fuente de datos que la sección)
        const valorFuente = fuentes[nombre];
        
        let btn = document.createElement("button");
        btn.classList.add("fuente-btn");
        btn.innerHTML = `
            ${nombre}
            <span style="display: block; font-size: 14px; font-weight: 600; margin-top: 5px; opacity: 0.8;">${formatoCOP(valorFuente)}</span>
        `;

        btn.addEventListener("click", () => {
            fuenteSeleccionadaGastar = nombre;
            document.querySelectorAll("#listaFuentesGastar .fuente-btn")
                .forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
        });

        listaFuentesGastar.appendChild(btn);
    });

    inputCantidadGastar.value = "";
    mensajeErrorGastar.style.display = "none";
    menuFlotanteSobre.classList.add("hidden");
    // Ocultar lápices cuando se abre el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "none";
    });
    modalGastarSobre.classList.remove("hidden");
    ocultarBtnAgregarGasto();
});

// Cerrar modal gastar al hacer click fuera
modalGastarSobre.addEventListener("click", (e) => {
    if (e.target === modalGastarSobre) {
        modalGastarSobre.classList.add("hidden");
        mensajeErrorGastar.style.display = "none";
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
        mostrarBtnAgregarGasto();
    }
});

btnCerrarGastar.addEventListener("click", () => {
    modalGastarSobre.classList.add("hidden");
    mensajeErrorGastar.style.display = "none";
    // Mostrar lápices cuando se cierra el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "";
    });
    mostrarBtnAgregarGasto();
});

btnConfirmarGastar.addEventListener("click", () => {
    let cantidadStr = inputCantidadGastar.value.trim();
    if (!cantidadStr) return;
    
    let cantidad = Number(cantidadStr.replace(/[^\d.]/g, ""));

    if (!fuenteSeleccionadaGastar) {
        mensajeErrorGastar.textContent = "Selecciona una fuente";
        mensajeErrorGastar.style.display = "block";
        return;
    }
    if (isNaN(cantidad) || cantidad <= 0) {
        mensajeErrorGastar.textContent = "Cantidad inválida";
        mensajeErrorGastar.style.display = "block";
        return;
    }

    // Verificar que haya suficiente en la fuente
    if (cantidad > fuentes[fuenteSeleccionadaGastar]) {
        mensajeErrorGastar.textContent = `No hay suficiente dinero en ${fuenteSeleccionadaGastar}. Disponible: ${formatoCOP(fuentes[fuenteSeleccionadaGastar])}`;
        mensajeErrorGastar.style.display = "block";
        return;
    }

    // Verificar que haya suficiente en el sobre
    if (cantidad > sobreActual.valor) {
        mensajeErrorGastar.textContent = `No hay suficiente dinero en el sobre. Disponible: ${formatoCOP(sobreActual.valor)}`;
        mensajeErrorGastar.style.display = "block";
        return;
    }

    // Descontar de la fuente
    fuentes[fuenteSeleccionadaGastar] -= cantidad;

    // Descontar del sobre actual
    sobreActual.valor -= cantidad;
    totalGeneral -= cantidad;
    totalGastos += cantidad;

    // Registrar movimiento
    registrarMovimiento('gasto', `Gastado de ${sobreActual.nombre}`, cantidad, fuenteSeleccionadaGastar, sobreActual.nombre);

    actualizarTotalGeneral();
    renderSobres();
    renderFuentes();
    if (typeof renderEstadisticas === 'function') {
        renderEstadisticas();
    }
    guardarDatos();
    mensajeErrorGastar.style.display = "none";
    modalGastarSobre.classList.add("hidden");
    // Mostrar lápices cuando se cierra el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "";
    });
    mostrarBtnAgregarGasto();
});

// Permitir gastar con Enter
if (inputCantidadGastar && btnConfirmarGastar) {
    inputCantidadGastar.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            btnConfirmarGastar.click();
        }
    });
}


// -----------------------------------------------------
// RESET
// -----------------------------------------------------
const btnReset = document.getElementById("btnReset");
const modalConfirmarReset = document.getElementById("modalConfirmarReset");
const btnConfirmarReset = document.getElementById("btnConfirmarReset");
const btnCancelarReset = document.getElementById("btnCancelarReset");

btnReset.addEventListener("click", () => {
    modalConfirmarReset.classList.remove("hidden");
    // Ocultar lápices cuando se abre el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "none";
    });
    ocultarBtnAgregarGasto();
});

// Cerrar modal reset al hacer click fuera
modalConfirmarReset.addEventListener("click", (e) => {
    if (e.target === modalConfirmarReset) {
        modalConfirmarReset.classList.add("hidden");
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
        mostrarBtnAgregarGasto();
    }
});

btnCancelarReset.addEventListener("click", () => {
    modalConfirmarReset.classList.add("hidden");
    // Mostrar lápices cuando se cierra el modal
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.style.display = "";
    });
});

btnConfirmarReset.addEventListener("click", () => {
    requireAuth(() => {
        totalGeneral = 0;
        totalIngresos = 0;
        totalGastos = 0;

        sobres.forEach(s => s.valor = 0);
        Object.keys(fuentes).forEach(f => fuentes[f] = 0);
        prestamos = [];

        // Registrar movimiento de reset
        registrarMovimiento('reset', 'Reinicio de todos los valores', 0);

        actualizarTotalGeneral();
        renderSobres();
        renderFuentes();
        renderGastos();
        renderPrestamos();
        renderMovimientos();
        guardarDatos();

        modalConfirmarReset.classList.add("hidden");
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
        mostrarBtnAgregarGasto();
        
        // Mostrar notificación
        mostrarNotificacion("Todos los valores han sido reiniciados", "success", 3000);
    });
});

// -----------------------------------------------------
// SISTEMA DE GASTOS
// -----------------------------------------------------

// Elementos del modal de agregar gasto
const btnAgregarGasto = document.getElementById("btnAgregarGasto");
const modalAgregarGasto = document.getElementById("modalAgregarGasto");
const inputNombreGasto = document.getElementById("inputNombreGasto");
const btnConfirmarAgregarGasto = document.getElementById("btnConfirmarAgregarGasto");
const btnCerrarAgregarGasto = document.getElementById("btnCerrarAgregarGasto");
const mensajeErrorAgregarGasto = document.getElementById("mensajeErrorAgregarGasto");
const gastarIconoEliminarModo = document.querySelector(".gastar-icono-eliminar-modo");

// Elementos del modal de configurar gasto fijo
const modalConfigurarGasto = document.getElementById("modalConfigurarGasto");
const nombreGastoConfigurar = document.getElementById("nombreGastoConfigurar");
const inputMontoGasto = document.getElementById("inputMontoGasto");
const listaSobresConfigurar = document.getElementById("listaSobresConfigurar");
const btnConfirmarConfigurarGasto = document.getElementById("btnConfirmarConfigurarGasto");
const btnCerrarConfigurarGasto = document.getElementById("btnCerrarConfigurarGasto");
const mensajeErrorConfigurarGasto = document.getElementById("mensajeErrorConfigurarGasto");

// Elementos del modal de gastar gasto fijo
const modalGastarGastoFijo = document.getElementById("modalGastarGastoFijo");
const nombreGastoGastar = document.getElementById("nombreGastoGastar");
const montoGastoGastar = document.getElementById("montoGastoGastar");
const listaFuentesGastarGasto = document.getElementById("listaFuentesGastarGasto");
const btnCerrarGastarGastoFijo = document.getElementById("btnCerrarGastarGastoFijo");

let gastoActualConfigurar = null;
let sobreSeleccionadoConfigurar = null;
let gastoActualGastar = null;

// Elementos del modal de crear préstamo
const btnCrearPrestamo = document.getElementById("btnCrearPrestamo");
const modalCrearPrestamo = document.getElementById("modalCrearPrestamo");
const inputNombrePrestamo = document.getElementById("inputNombrePrestamo");
const inputMontoPrestamo = document.getElementById("inputMontoPrestamo");
const listaSobresPrestamo = document.getElementById("listaSobresPrestamo");
const listaFuentesPrestamo = document.getElementById("listaFuentesPrestamo");
const btnConfirmarCrearPrestamo = document.getElementById("btnConfirmarCrearPrestamo");
const btnCerrarCrearPrestamo = document.getElementById("btnCerrarCrearPrestamo");
const mensajeErrorCrearPrestamo = document.getElementById("mensajeErrorCrearPrestamo");
const mensajeErrorNombrePrestamo = document.getElementById("mensajeErrorNombrePrestamo");
const mensajeErrorMontoPrestamo = document.getElementById("mensajeErrorMontoPrestamo");
const mensajeErrorSobrePrestamo = document.getElementById("mensajeErrorSobrePrestamo");
const mensajeErrorFuentePrestamo = document.getElementById("mensajeErrorFuentePrestamo");

// Elementos del modal de devolver préstamo
const modalDevolverPrestamo = document.getElementById("modalDevolverPrestamo");
const nombrePrestamoDevolver = document.getElementById("nombrePrestamoDevolver");
const montoPrestamoDevolver = document.getElementById("montoPrestamoDevolver");
const montoRestanteDevolver = document.getElementById("montoRestanteDevolver");
const inputMontoDevolver = document.getElementById("inputMontoDevolver");
const listaFuentesDevolver = document.getElementById("listaFuentesDevolver");
const btnConfirmarDevolverPrestamo = document.getElementById("btnConfirmarDevolverPrestamo");
const btnCerrarDevolverPrestamo = document.getElementById("btnCerrarDevolverPrestamo");
const mensajeErrorDevolverPrestamo = document.getElementById("mensajeErrorDevolverPrestamo");
const mensajeErrorMontoDevolver = document.getElementById("mensajeErrorMontoDevolver");
const mensajeErrorFuenteDevolver = document.getElementById("mensajeErrorFuenteDevolver");

let sobreSeleccionadoPrestamo = null;
let fuenteSeleccionadaPrestamo = null;
let fuenteSeleccionadaDevolver = null;
let prestamoActualDevolver = null;

// Elementos del modal de eliminar préstamo
const modalConfirmarEliminarPrestamo = document.getElementById("modalConfirmarEliminarPrestamo");
const nombrePrestamoEliminar = document.getElementById("nombrePrestamoEliminar");
const montoPrestamoEliminar = document.getElementById("montoPrestamoEliminar");
const btnConfirmarEliminarPrestamo = document.getElementById("btnConfirmarEliminarPrestamo");
const btnCancelarEliminarPrestamo = document.getElementById("btnCancelarEliminarPrestamo");

let prestamoActualEliminar = null;

// Funciones para ocultar/mostrar botón agregar gasto
function ocultarBtnAgregarGasto() {
    if (btnAgregarGasto) {
        btnAgregarGasto.style.display = "none";
    }
}

function mostrarBtnAgregarGasto() {
    if (btnAgregarGasto) {
        btnAgregarGasto.style.display = "";
    }
}

// Función para renderizar los gastos
function renderGastos() {
    if (!gastarContent) return;
    
    // Obtener el header con el icono de eliminar modo
    const headerEliminar = gastarContent.querySelector(".gastar-content-header");
    
    // Limpiar solo los items, no el header
    const itemsExistentes = gastarContent.querySelectorAll(".gasto-item");
    itemsExistentes.forEach(item => item.remove());
    
    gastos.forEach(gasto => {
        const gastoItem = document.createElement("div");
        gastoItem.className = "gasto-item";
        if (modoEliminacionGastos) {
            gastoItem.classList.add("modo-eliminacion-activo");
        }
        gastoItem.setAttribute("data-id", gasto.id);
        
        let contenido = `<div class="gasto-info">`;
        contenido += `<span class="gasto-nombre">${gasto.nombre}</span>`;
        
        // Mostrar información de configuración si existe
        if (gasto.monto && gasto.sobreId) {
            const sobreConfigurado = sobres.find(s => s.id === gasto.sobreId);
            const nombreSobre = sobreConfigurado ? sobreConfigurado.nombre : "Sobre no encontrado";
            contenido += `<span class="gasto-config-info">${formatoCOP(gasto.monto)} - ${nombreSobre}</span>`;
        } else {
            contenido += `<span class="gasto-config-info sin-config">Sin configurar</span>`;
        }
        
        contenido += `</div>`;
        
        // Contenedor para iconos y botones
        contenido += `<div class="gasto-acciones">`;
        
        // Icono de tuerca (configuración)
        contenido += `
            <svg class="gasto-icono-tuerca" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        
        // Botón de gastar
        contenido += `<button class="gasto-btn-gastar" data-gasto-id="${gasto.id}">Gastar</button>`;
        
        // Solo mostrar icono de eliminar si está en modo eliminación
        if (modoEliminacionGastos) {
            contenido += `
                <svg class="gasto-icono-eliminar" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
        }
        
        contenido += `</div>`;
        
        gastoItem.innerHTML = contenido;
        gastarContent.appendChild(gastoItem);
    });
}

// Abrir modal agregar gasto
if (btnAgregarGasto && modalAgregarGasto) {
    btnAgregarGasto.addEventListener("click", () => {
        if (inputNombreGasto) inputNombreGasto.value = "";
        if (mensajeErrorAgregarGasto) mensajeErrorAgregarGasto.style.display = "none";
        modalAgregarGasto.classList.remove("hidden");
        // Ocultar lápices cuando se abre el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "none";
        });
        ocultarBtnAgregarGasto();
        // Enfocar el input de nombre
        if (inputNombreGasto) {
            setTimeout(() => inputNombreGasto.focus(), 100);
        }
    });
}

// Cerrar modal agregar gasto al hacer click fuera
if (modalAgregarGasto) {
    modalAgregarGasto.addEventListener("click", (e) => {
        if (e.target === modalAgregarGasto) {
            modalAgregarGasto.classList.add("hidden");
            if (inputNombreGasto) inputNombreGasto.value = "";
            if (mensajeErrorAgregarGasto) mensajeErrorAgregarGasto.style.display = "none";
            // Mostrar lápices cuando se cierra el modal
            document.querySelectorAll(".edit-btn").forEach(btn => {
                btn.style.display = "";
            });
            mostrarBtnAgregarGasto();
        }
    });
}

// Cerrar modal agregar gasto
if (btnCerrarAgregarGasto && modalAgregarGasto) {
    btnCerrarAgregarGasto.addEventListener("click", () => {
        modalAgregarGasto.classList.add("hidden");
        if (inputNombreGasto) inputNombreGasto.value = "";
        if (mensajeErrorAgregarGasto) mensajeErrorAgregarGasto.style.display = "none";
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
        mostrarBtnAgregarGasto();
    });
}

// Confirmar agregar gasto
if (btnConfirmarAgregarGasto && modalAgregarGasto && inputNombreGasto && mensajeErrorAgregarGasto) {
    btnConfirmarAgregarGasto.addEventListener("click", () => {
        requireAuth(() => {
            let nombre = inputNombreGasto.value.trim();
            
            // Validar nombre
            if (!nombre) {
                mensajeErrorAgregarGasto.textContent = "Ingresa un nombre para el gasto";
                mensajeErrorAgregarGasto.style.display = "block";
                return;
            }

            // Ocultar mensaje de error si todo está bien
            mensajeErrorAgregarGasto.style.display = "none";
            
            // Agregar el gasto
            gastos.push({
                id: Date.now(),
                nombre: nombre
            });
            
            renderGastos();
            guardarDatos();
            
            // Limpiar y cerrar modal
            inputNombreGasto.value = "";
            modalAgregarGasto.classList.add("hidden");
            // Mostrar lápices cuando se cierra el modal
            document.querySelectorAll(".edit-btn").forEach(btn => {
                btn.style.display = "";
            });
            mostrarBtnAgregarGasto();
        });
    });
}

// Permitir agregar gasto con Enter
if (inputNombreGasto && btnConfirmarAgregarGasto) {
    inputNombreGasto.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            if (btnConfirmarAgregarGasto) {
                btnConfirmarAgregarGasto.click();
            }
        }
    });
}

// Activar/desactivar modo eliminación con el icono del contenedor
if (gastarIconoEliminarModo) {
    gastarIconoEliminarModo.addEventListener("click", () => {
        modoEliminacionGastos = !modoEliminacionGastos;
        
        if (modoEliminacionGastos) {
            gastarIconoEliminarModo.style.color = "#d32f2f";
        } else {
            gastarIconoEliminarModo.style.color = "var(--morado)";
        }
        
        renderGastos();
    });
}

// Eliminar gasto al hacer click en el icono de eliminar de cada item
if (gastarContent) {
    gastarContent.addEventListener("click", (e) => {
        // Manejar click en icono de tuerca (configuración)
        const iconoTuerca = e.target.closest(".gasto-icono-tuerca");
        if (iconoTuerca) {
            const gastoItem = iconoTuerca.closest(".gasto-item");
            if (!gastoItem) return;
            
            const gastoId = Number(gastoItem.getAttribute("data-id"));
            gastoActualConfigurar = gastos.find(g => g.id === gastoId);
            
            if (gastoActualConfigurar) {
                // Configurar el modal
                nombreGastoConfigurar.textContent = gastoActualConfigurar.nombre;
                inputMontoGasto.value = gastoActualConfigurar.monto || "";
                sobreSeleccionadoConfigurar = gastoActualConfigurar.sobreId || null;
                
                // Renderizar lista de sobres con la misma lógica que transferir
                listaSobresConfigurar.innerHTML = "";
                sobres.forEach(sobre => {
                    let btn = document.createElement("button");
                    btn.textContent = `${sobre.nombre} (${formatoCOP(sobre.valor)})`;
                    btn.classList.add("fuente-transferir-btn");
                    btn.setAttribute("data-sobre-id", sobre.id);
                    
                    // Marcar como seleccionado si es el sobre configurado
                    if (sobre.id === sobreSeleccionadoConfigurar) {
                        btn.classList.add("selected");
                    }
                    
                    btn.addEventListener("click", () => {
                        // Si ya está seleccionado, deseleccionarlo
                        if (sobreSeleccionadoConfigurar === sobre.id) {
                            sobreSeleccionadoConfigurar = null;
                            btn.classList.remove("selected");
                        } else {
                            // Deseleccionar todos y seleccionar este
                            document.querySelectorAll("#listaSobresConfigurar .fuente-transferir-btn")
                                .forEach(b => b.classList.remove("selected"));
                            sobreSeleccionadoConfigurar = sobre.id;
                            btn.classList.add("selected");
                        }
                        if (mensajeErrorConfigurarGasto) mensajeErrorConfigurarGasto.style.display = "none";
                    });
                    
                    listaSobresConfigurar.appendChild(btn);
                });
                
                mensajeErrorConfigurarGasto.style.display = "none";
                
                // Ocultar lápices cuando se abre el modal
                document.querySelectorAll(".edit-btn").forEach(btn => {
                    btn.style.display = "none";
                });
                modalConfigurarGasto.classList.remove("hidden");
                ocultarBtnAgregarGasto();
            }
            return;
        }
        
        // Manejar click en botón de gastar
        const btnGastar = e.target.closest(".gasto-btn-gastar");
        if (btnGastar) {
            const gastoId = Number(btnGastar.getAttribute("data-gasto-id"));
            const gasto = gastos.find(g => g.id === gastoId);
            
            if (!gasto) return;
            
            // Verificar que el gasto tenga configuración
            if (!gasto.monto || !gasto.sobreId) {
                mostrarNotificacion("Este gasto no está configurado. Configúralo primero con el icono de tuerca.", "warning", 4000);
                return;
            }
            
            // Guardar el gasto actual y abrir modal para seleccionar fuente
            gastoActualGastar = gasto;
            
            if (nombreGastoGastar) nombreGastoGastar.textContent = gasto.nombre;
            if (montoGastoGastar) montoGastoGastar.textContent = formatoCOP(gasto.monto);
            
            // Renderizar solo botones de fuentes (lógica de sobres es oculta)
            if (listaFuentesGastarGasto) {
                listaFuentesGastarGasto.innerHTML = "";
                
                // Solo agregar las fuentes
                Object.keys(fuentes).forEach(nombreFuente => {
                    // Usar el mismo objeto fuentes que usa la sección de fuentes (misma fuente de datos)
                    const valorFuente = fuentes[nombreFuente];
                    
                    const btn = document.createElement("button");
                    btn.classList.add("fuente-flotante-btn");
                    btn.innerHTML = `
                        ${nombreFuente}
                        <span class="fuente-saldo">${formatoCOP(valorFuente)}</span>
                    `;
                    
                    // Deshabilitar si no hay suficiente dinero en la fuente
                    if (gasto.monto > valorFuente) {
                        btn.style.opacity = "0.5";
                        btn.style.cursor = "not-allowed";
                        btn.disabled = true;
                    }
                    
                    btn.addEventListener("click", () => {
                        if (btn.disabled) return;
                        
                        // Obtener el valor actualizado del objeto fuentes (misma fuente que la sección)
                        const valorActual = fuentes[nombreFuente];
                        
                        // Verificar que haya suficiente dinero en la fuente
                        if (gasto.monto > valorActual) {
                            mostrarNotificacion(`No hay suficiente dinero en ${nombreFuente}. Disponible: ${formatoCOP(valorActual)}`, "error", 4000);
                            return;
                        }
                        
                        // VALIDACIÓN OCULTA: Verificar si el gasto tiene un sobre configurado y si tiene suficiente
                        let sobreConfigurado = null;
                        if (gasto.sobreId) {
                            sobreConfigurado = sobres.find(s => s.id === gasto.sobreId);
                            if (sobreConfigurado) {
                                // Verificar que el sobre tenga suficiente dinero (misma lógica que gastar de sobre)
                                if (gasto.monto > sobreConfigurado.valor) {
                                    mostrarNotificacion(`No hay suficiente dinero en el sobre "${sobreConfigurado.nombre}". Disponible: ${formatoCOP(sobreConfigurado.valor)}`, "error", 4000);
                                    return;
                                }
                            }
                        }
                        
                        // Realizar el gasto desde la fuente
                        fuentes[nombreFuente] -= gasto.monto;
                        totalGeneral -= gasto.monto;
                        totalGastos += gasto.monto;
                        
                        // También descontar del sobre configurado si existe
                        if (sobreConfigurado) {
                            sobreConfigurado.valor -= gasto.monto;
                        }
                        
                        // Registrar movimiento
                        registrarMovimiento('gasto', `Gasto fijo: ${gasto.nombre}`, gasto.monto, nombreFuente, sobreConfigurado ? sobreConfigurado.nombre : null, gasto.nombre);
                        
                        // Actualizar y guardar
                        actualizarTotalGeneral();
                        renderFuentes();
                        renderSobres();
                        guardarDatos();
                        
                        // Cerrar modal
                        if (modalGastarGastoFijo) modalGastarGastoFijo.classList.add("hidden");
                        gastoActualGastar = null;
                        
                        // Mostrar lápices cuando se cierra el modal
                        document.querySelectorAll(".edit-btn").forEach(btn => {
                            btn.style.display = "";
                        });
                        mostrarBtnAgregarGasto();
                        
                        // Mostrar confirmación
                        mostrarNotificacion(`Gasto de ${formatoCOP(gasto.monto)} realizado desde ${nombreFuente}`, "success", 3000);
                    });
                    
                    listaFuentesGastarGasto.appendChild(btn);
                });
            }
            
            // Abrir modal
            if (modalGastarGastoFijo) {
                modalGastarGastoFijo.classList.remove("hidden");
                // Ocultar lápices cuando se abre el modal
                document.querySelectorAll(".edit-btn").forEach(btn => {
                    btn.style.display = "none";
                });
                ocultarBtnAgregarGasto();
            }
            
            return;
        }
        
        // Manejar click en icono de eliminar (solo en modo eliminación)
        if (!modoEliminacionGastos) return;
        
        const iconoEliminar = e.target.closest(".gasto-icono-eliminar");
        if (!iconoEliminar) return;
        
        const gastoItem = iconoEliminar.closest(".gasto-item");
        if (!gastoItem) return;
        
        const gastoId = Number(gastoItem.getAttribute("data-id"));
        
        // Eliminar el gasto
        gastos = gastos.filter(gasto => gasto.id !== gastoId);
        
        renderGastos();
        guardarDatos();
    });
}

// -----------------------------------------------------
// SISTEMA DE NAVEGACIÓN ENTRE PANTALLAS
// -----------------------------------------------------

const pantallaInicio = document.getElementById("pantallaInicio");
const pantallaMovimientos = document.getElementById("pantallaMovimientos");
const pantallaConfiguracion = document.getElementById("pantallaConfiguracion");
const btnInicio = document.getElementById("btnInicio");
const btnMovimientos = document.getElementById("btnMovimientos");
const btnConfiguracion = document.getElementById("btnConfiguracion");
const navegacionInferior = document.querySelector(".navegacion-inferior");

// Funciones para ocultar/mostrar navegación inferior
function ocultarNavegacionInferior() {
    if (navegacionInferior) {
        navegacionInferior.style.display = "none";
    }
}

function mostrarNavegacionInferior() {
    if (navegacionInferior) {
        navegacionInferior.style.display = "flex";
    }
}

function cambiarPantalla(pantallaDestino) {
    // Remover clase activa de todas las pantallas
    pantallaInicio.classList.remove("activa");
    pantallaMovimientos.classList.remove("activa");
    if (pantallaConfiguracion) pantallaConfiguracion.classList.remove("activa");
    
    // Remover clase activa de todos los botones
    btnInicio.classList.remove("activo");
    btnMovimientos.classList.remove("activo");
    if (btnConfiguracion) btnConfiguracion.classList.remove("activo");
    
    // Agregar clase activa a la pantalla y botón seleccionados
    if (pantallaDestino === "inicio") {
        pantallaInicio.classList.add("activa");
        btnInicio.classList.add("activo");
    } else if (pantallaDestino === "movimientos") {
        pantallaMovimientos.classList.add("activa");
        btnMovimientos.classList.add("activo");
    } else if (pantallaDestino === "configuracion") {
        if (pantallaConfiguracion) pantallaConfiguracion.classList.add("activa");
        // No hay botón en la navegación inferior para configuración
    }
}

if (btnInicio && btnMovimientos) {
    btnInicio.addEventListener("click", () => {
        cambiarPantalla("inicio");
    });

    btnMovimientos.addEventListener("click", () => {
        cambiarPantalla("movimientos");
        actualizarFiltroItemsSobres();
        renderMovimientos();
    });
}

// Configuración solo se accede desde el menú de usuario, no desde la navegación inferior

// Función para actualizar el select de sobres e items de gastos
function actualizarFiltroItemsSobres() {
    const filtroItemSobre = document.getElementById("filtroItemSobre");
    if (!filtroItemSobre) return;
    
    // Guardar la opción seleccionada actual
    const valorActual = filtroItemSobre.value;
    
    // Limpiar el select (mantener solo "Todos")
    filtroItemSobre.innerHTML = '<option value="">Todos</option>';
    
    // Agregar sobres
    sobres.forEach(sobre => {
        const option = document.createElement("option");
        option.value = `sobre-${sobre.id}`;
        option.textContent = `Sobre: ${sobre.nombre}`;
        filtroItemSobre.appendChild(option);
    });
    
    // Agregar items de gastos
    gastos.forEach(gasto => {
        const option = document.createElement("option");
        option.value = `gasto-${gasto.id}`;
        option.textContent = `Gasto: ${gasto.nombre}`;
        filtroItemSobre.appendChild(option);
    });
    
    // Restaurar la selección anterior si existe
    if (valorActual) {
        filtroItemSobre.value = valorActual;
    }
}

// Función para renderizar movimientos
function renderMovimientos() {
    const movimientosContent = document.querySelector(".movimientos-content");
    if (!movimientosContent) return;
    
    // Aplicar filtros
    let movimientosFiltrados = [...movimientos];
    
    // Filtro por fecha
    const filtroFecha = document.getElementById("filtroFecha")?.value;
    if (filtroFecha) {
        movimientosFiltrados = movimientosFiltrados.filter(m => m.fecha === filtroFecha);
    }
    
    // Filtro por hora
    const filtroHoraDesde = document.getElementById("filtroHoraDesde")?.value;
    const filtroHoraHasta = document.getElementById("filtroHoraHasta")?.value;
    if (filtroHoraDesde || filtroHoraHasta) {
        movimientosFiltrados = movimientosFiltrados.filter(m => {
            const horaMov = m.hora;
            if (filtroHoraDesde && horaMov < filtroHoraDesde) return false;
            if (filtroHoraHasta && horaMov > filtroHoraHasta) return false;
            return true;
        });
    }
    
    // Filtro por categoría
    const filtroCategoria = document.getElementById("filtroCategoria")?.value;
    if (filtroCategoria) {
        movimientosFiltrados = movimientosFiltrados.filter(m => m.tipo === filtroCategoria);
    }
    
    // Filtro por sobre/gasto
    const filtroItemSobre = document.getElementById("filtroItemSobre")?.value;
    if (filtroItemSobre) {
        if (filtroItemSobre.startsWith('sobre-')) {
            const sobreId = Number(filtroItemSobre.replace('sobre-', ''));
            const sobre = sobres.find(s => s.id === sobreId);
            if (sobre) {
                movimientosFiltrados = movimientosFiltrados.filter(m => m.sobre === sobre.nombre);
            }
        } else if (filtroItemSobre.startsWith('gasto-')) {
            const gastoId = Number(filtroItemSobre.replace('gasto-', ''));
            const gasto = gastos.find(g => g.id === gastoId);
            if (gasto) {
                movimientosFiltrados = movimientosFiltrados.filter(m => m.gasto === gasto.nombre);
            }
        }
    }
    
    // Guardar el header con el icono de eliminar
    const headerEliminar = movimientosContent.querySelector(".movimientos-content-header");
    
    // Limpiar solo los items de movimientos y mensajes, no el header
    const itemsExistentes = movimientosContent.querySelectorAll(".movimiento-item, .mensaje-vacio-movimientos");
    itemsExistentes.forEach(item => item.remove());
    
    if (movimientosFiltrados.length === 0) {
        const mensajeVacio = document.createElement("p");
        mensajeVacio.className = "mensaje-vacio-movimientos";
        mensajeVacio.style.cssText = "text-align: center; color: #666; padding: 40px;";
        mensajeVacio.textContent = "No hay movimientos registrados";
        movimientosContent.appendChild(mensajeVacio);
        return;
    }
    
    // Renderizar movimientos
    movimientosFiltrados.forEach(movimiento => {
        const movimientoItem = document.createElement("div");
        movimientoItem.className = "movimiento-item";
        
        const esIngreso = movimiento.tipo === 'ingreso';
        const esGasto = movimiento.tipo === 'gasto';
        const esReset = movimiento.tipo === 'reset';
        const esTransferencia = movimiento.tipo === 'transferencia';
        
        let icono = "💰";
        let colorClase = "";
        if (esIngreso) {
            icono = "💰";
            colorClase = "movimiento-ingreso";
        } else if (esGasto) {
            icono = "💸";
            colorClase = "movimiento-gasto";
        } else if (esReset) {
            icono = "🔄";
            colorClase = "movimiento-reset";
        } else if (esTransferencia) {
            icono = "🔄";
            colorClase = "movimiento-transferencia";
        }
        
        movimientoItem.innerHTML = `
            <div class="movimiento-icono">${icono}</div>
            <div class="movimiento-info">
                <div class="movimiento-descripcion">${movimiento.descripcion}</div>
                <div class="movimiento-detalles">
                    <span class="movimiento-fecha">${movimiento.fecha} ${movimiento.hora}</span>
                    ${movimiento.fuente ? `<span class="movimiento-fuente">${movimiento.fuente}</span>` : ''}
                    ${movimiento.sobre ? `<span class="movimiento-sobre">${movimiento.sobre}</span>` : ''}
                    ${movimiento.gasto ? `<span class="movimiento-gasto-nombre">${movimiento.gasto}</span>` : ''}
                </div>
            </div>
            <div class="movimiento-monto ${colorClase}">
                ${formatoCOP(movimiento.monto)}
            </div>
            ${!esReset ? `
                <button class="btn-devolver-movimiento" data-movimiento-id="${movimiento.id}" title="Devolver movimiento">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 7v6h6"/>
                        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                    </svg>
                </button>
            ` : ''}
        `;
        
        movimientosContent.appendChild(movimientoItem);
        
        // Agregar event listener al botón de devolver (solo si no es reset)
        if (!esReset) {
            const btnDevolver = movimientoItem.querySelector(".btn-devolver-movimiento");
            if (btnDevolver) {
                btnDevolver.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    // Usar el movimiento directamente del closure
                    devolverMovimiento(movimiento);
                });
            }
        }
    });
}

// Función para devolver un movimiento
function devolverMovimiento(movimiento) {
    if (!movimiento) {
        console.error("Movimiento no válido:", movimiento);
        return;
    }
    
    const monto = Number(movimiento.monto) || 0;
    const tipo = movimiento.tipo;
    
    console.log("Devolviendo movimiento:", { tipo, monto, movimiento });
    
    // Revertir según el tipo de movimiento
    if (tipo === 'gasto') {
        // Devolver al total
        totalGeneral = Number(totalGeneral) + monto;
        totalGastos = Number(totalGastos) - monto;
        
        // Devolver a la fuente si existe
        if (movimiento.fuente && fuentes.hasOwnProperty(movimiento.fuente)) {
            fuentes[movimiento.fuente] = Number(fuentes[movimiento.fuente]) + monto;
        }
        
        // Devolver al sobre (categoría) si existe
        if (movimiento.sobre) {
            const sobre = sobres.find(s => s.nombre === movimiento.sobre);
            if (sobre) {
                sobre.valor = Number(sobre.valor) + monto;
            }
        }
        
    } else if (tipo === 'ingreso') {
        // Restar del total
        totalGeneral = Number(totalGeneral) - monto;
        totalIngresos = Number(totalIngresos) - monto;
        
        // Restar de la fuente si existe
        if (movimiento.fuente && fuentes.hasOwnProperty(movimiento.fuente)) {
            fuentes[movimiento.fuente] = Number(fuentes[movimiento.fuente]) - monto;
        }
        
        // Si fue un ingreso directo a un sobre, solo restar de ese sobre
        if (movimiento.sobre) {
            const sobre = sobres.find(s => s.nombre === movimiento.sobre);
            if (sobre) {
                sobre.valor = Number(sobre.valor) - monto;
            }
        } else if (movimiento.fuente) {
            // Si fue un ingreso general (sin sobre, distribuido por porcentajes), revertir la distribución
            // Revertir la distribución proporcional a los sobres
            sobres.forEach(s => {
                s.valor = Number(s.valor) - (monto * s.porcentaje) / 100;
            });
        }
        
    } else if (tipo === 'transferencia') {
        // Revertir la transferencia: devolver de "hacia" a "desde"
        const descripcion = movimiento.descripcion || "";
        const match = descripcion.match(/Transferencia de (.+?) a (.+)/);
        
        if (match && match.length === 3) {
            const fuenteDesde = match[1].trim();
            const fuenteHacia = match[2].trim();
            
            // Revertir: devolver de "hacia" a "desde"
            if (fuentes.hasOwnProperty(fuenteDesde) && fuentes.hasOwnProperty(fuenteHacia)) {
                fuentes[fuenteHacia] = Number(fuentes[fuenteHacia]) - monto;
                fuentes[fuenteDesde] = Number(fuentes[fuenteDesde]) + monto;
            }
        }
    }
    
    console.log("Valores después de revertir:", { totalGeneral, totalIngresos, totalGastos, fuentes });
    
    // Eliminar el movimiento del array
    movimientos = movimientos.filter(m => m.id !== movimiento.id);
    
    // Actualizar y guardar
    actualizarTotalGeneral();
    renderFuentes();
    renderSobres();
    renderMovimientos();
    guardarDatos();
    
    // Mostrar notificación de éxito
    mostrarNotificacion("Movimiento devuelto correctamente", "success", 3000);
}

// Función para centrar modales al abrirlos (ya están centrados con CSS)
function centrarModal(modal) {
    // Los modales ya están centrados con position: fixed y flexbox
    // No necesitamos hacer scroll
}

// Variable para guardar la posición del scroll
let scrollPosition = 0;

// Observar cambios en los modales para ocultar/mostrar navegación
function verificarModalesAbiertos() {
    const modales = document.querySelectorAll(".modal");
    const menuFlotante = document.getElementById("menuFlotanteSobre");
    let hayModalAbierto = false;
    
    // Verificar modales
    modales.forEach(modal => {
        if (!modal.classList.contains("hidden")) {
            hayModalAbierto = true;
        }
    });
    
    // Verificar menú flotante
    if (menuFlotante && !menuFlotante.classList.contains("hidden")) {
        hayModalAbierto = true;
    }
    
    // Agregar/remover clase al body y html para prevenir scroll
    if (hayModalAbierto) {
        // Guardar posición del scroll antes de bloquear
        scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        document.body.style.top = `-${scrollPosition}px`;
        document.body.classList.add("modal-abierto");
        document.documentElement.classList.add("modal-abierto");
        ocultarNavegacionInferior();
    } else {
        // Restaurar posición del scroll
        document.body.classList.remove("modal-abierto");
        document.documentElement.classList.remove("modal-abierto");
        document.body.style.top = '';
        window.scrollTo(0, scrollPosition);
        mostrarNavegacionInferior();
    }
}

// Observar todos los modales
const observerModales = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target;
            // Si el modal se abrió (se quitó "hidden")
            if (!target.classList.contains("hidden")) {
                centrarModal(target);
            }
        }
    });
    verificarModalesAbiertos();
});

// Observar cambios en la clase "hidden" de todos los modales
document.querySelectorAll(".modal").forEach(modal => {
    observerModales.observe(modal, {
        attributes: true,
        attributeFilter: ["class"]
    });
});

// Observar también el menú flotante
const menuFlotanteObs = document.getElementById("menuFlotanteSobre");
if (menuFlotanteObs) {
    observerModales.observe(menuFlotanteObs, {
        attributes: true,
        attributeFilter: ["class"]
    });
}

// Event listeners para filtros de movimientos
const filtroFechaEl = document.getElementById("filtroFecha");
const filtroHoraDesdeEl = document.getElementById("filtroHoraDesde");
const filtroHoraHastaEl = document.getElementById("filtroHoraHasta");
const filtroCategoriaEl = document.getElementById("filtroCategoria");
const filtroItemSobreEl = document.getElementById("filtroItemSobre");

if (filtroFechaEl) {
    filtroFechaEl.addEventListener("change", renderMovimientos);
}
if (filtroHoraDesdeEl) {
    filtroHoraDesdeEl.addEventListener("change", renderMovimientos);
}
if (filtroHoraHastaEl) {
    filtroHoraHastaEl.addEventListener("change", renderMovimientos);
}
if (filtroCategoriaEl) {
    filtroCategoriaEl.addEventListener("change", renderMovimientos);
}
if (filtroItemSobreEl) {
    filtroItemSobreEl.addEventListener("change", renderMovimientos);
}

// -----------------------------------------------------
// ELIMINAR TODOS LOS MOVIMIENTOS
// -----------------------------------------------------

const btnEliminarMovimientos = document.getElementById("btnEliminarMovimientos");
const modalConfirmarEliminarMovimientos = document.getElementById("modalConfirmarEliminarMovimientos");
const btnConfirmarEliminarMovimientos = document.getElementById("btnConfirmarEliminarMovimientos");
const btnCancelarEliminarMovimientos = document.getElementById("btnCancelarEliminarMovimientos");

if (btnEliminarMovimientos) {
    btnEliminarMovimientos.addEventListener("click", () => {
        modalConfirmarEliminarMovimientos.classList.remove("hidden");
        ocultarNavegacionInferior();
    });
}

// Cerrar modal eliminar movimientos al hacer click fuera
if (modalConfirmarEliminarMovimientos) {
    modalConfirmarEliminarMovimientos.addEventListener("click", (e) => {
        if (e.target === modalConfirmarEliminarMovimientos) {
            modalConfirmarEliminarMovimientos.classList.add("hidden");
            mostrarNavegacionInferior();
        }
    });
}

if (btnCancelarEliminarMovimientos) {
    btnCancelarEliminarMovimientos.addEventListener("click", () => {
        modalConfirmarEliminarMovimientos.classList.add("hidden");
        mostrarNavegacionInferior();
    });
}

if (btnConfirmarEliminarMovimientos) {
    btnConfirmarEliminarMovimientos.addEventListener("click", () => {
        if (movimientos.length === 0) {
            modalConfirmarEliminarMovimientos.classList.add("hidden");
            mostrarNavegacionInferior();
            mostrarNotificacion("No hay movimientos para borrar", "warning", 3000);
            return;
        }
        
        movimientos = [];
        guardarDatos();
        renderMovimientos();
        modalConfirmarEliminarMovimientos.classList.add("hidden");
        mostrarNavegacionInferior();
        mostrarNotificacion("Todos los movimientos han sido eliminados", "success", 3000);
    });
}

// -----------------------------------------------------
// SISTEMA DE PRÉSTAMOS
// -----------------------------------------------------

// Función para renderizar los préstamos
function renderPrestamos() {
    if (!dineroPrestadoContent) return;
    
    // Limpiar contenido
    dineroPrestadoContent.innerHTML = "";
    
    if (prestamos.length === 0) {
        return;
    }
    
    // Subtítulo "Debe:"
    const subtitulo = document.createElement("h3");
    subtitulo.style.cssText = "color: var(--morado); font-size: 18px; font-weight: 600; margin-bottom: 15px; margin-top: 0;";
    subtitulo.textContent = "Debe:";
    dineroPrestadoContent.appendChild(subtitulo);
    
    prestamos.forEach(prestamo => {
        // Solo mostrar si aún tiene monto pendiente (mayor a 0)
        if (prestamo.montoRestante <= 0) return;
        
        const prestamoItem = document.createElement("div");
        prestamoItem.className = "prestamo-item";
        prestamoItem.setAttribute("data-id", prestamo.id);
        
        prestamoItem.innerHTML = `
            <div class="prestamo-info">
                <span class="prestamo-nombre">${prestamo.nombre}</span>
                <span class="prestamo-monto">${formatoCOP(prestamo.montoRestante)}</span>
            </div>
            <div class="prestamo-acciones">
                <button class="prestamo-btn-devolver" data-prestamo-id="${prestamo.id}">Devolver</button>
                <button class="prestamo-btn-eliminar" data-prestamo-id="${prestamo.id}" title="Eliminar préstamo">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        `;
        
        dineroPrestadoContent.appendChild(prestamoItem);
    });
    
    // Agregar event listeners a los botones de devolver
    document.querySelectorAll(".prestamo-btn-devolver").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const prestamoId = Number(btn.getAttribute("data-prestamo-id"));
            const prestamo = prestamos.find(p => p.id === prestamoId);
            
            if (!prestamo) return;
            
            prestamoActualDevolver = prestamo;
            
            // Configurar modal
            nombrePrestamoDevolver.textContent = prestamo.nombre;
            montoPrestamoDevolver.textContent = `Monto total: ${formatoCOP(prestamo.monto)}`;
            montoRestanteDevolver.textContent = `Pendiente: ${formatoCOP(prestamo.montoRestante)}`;
            
            // Renderizar fuentes
            listaFuentesDevolver.innerHTML = "";
            fuenteSeleccionadaDevolver = null;
            
            Object.keys(fuentes).forEach(nombreFuente => {
                const btnFuente = document.createElement("button");
                btnFuente.textContent = nombreFuente;
                btnFuente.classList.add("fuente-btn");
                btnFuente.setAttribute("data-fuente", nombreFuente);
                
                btnFuente.addEventListener("click", () => {
                    fuenteSeleccionadaDevolver = nombreFuente;
                    document.querySelectorAll("#listaFuentesDevolver .fuente-btn")
                        .forEach(b => b.classList.remove("selected"));
                    btnFuente.classList.add("selected");
                });
                
                listaFuentesDevolver.appendChild(btnFuente);
            });
            
            inputMontoDevolver.value = "";
            if (mensajeErrorDevolverPrestamo) mensajeErrorDevolverPrestamo.style.display = "none";
            
            modalDevolverPrestamo.classList.remove("hidden");
            ocultarBtnAgregarGasto();
        });
    });
    
    // Agregar event listeners a los botones de eliminar
    document.querySelectorAll(".prestamo-btn-eliminar").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const prestamoId = Number(btn.getAttribute("data-prestamo-id"));
            const prestamo = prestamos.find(p => p.id === prestamoId);
            
            if (!prestamo) return;
            
            prestamoActualEliminar = prestamo;
            
            // Configurar modal
            if (nombrePrestamoEliminar) nombrePrestamoEliminar.textContent = prestamo.nombre;
            if (montoPrestamoEliminar) montoPrestamoEliminar.textContent = `Pendiente: ${formatoCOP(prestamo.montoRestante)}`;
            
            if (modalConfirmarEliminarPrestamo) modalConfirmarEliminarPrestamo.classList.remove("hidden");
            ocultarBtnAgregarGasto();
        });
    });
}

// Abrir modal crear préstamo
if (btnCrearPrestamo && modalCrearPrestamo) {
    btnCrearPrestamo.addEventListener("click", () => {
        inputNombrePrestamo.value = "";
        inputMontoPrestamo.value = "";
        sobreSeleccionadoPrestamo = null;
        fuenteSeleccionadaPrestamo = null;
        
        // Limpiar mensajes de error
        if (mensajeErrorCrearPrestamo) mensajeErrorCrearPrestamo.style.display = "none";
        if (mensajeErrorNombrePrestamo) mensajeErrorNombrePrestamo.style.display = "none";
        if (mensajeErrorMontoPrestamo) mensajeErrorMontoPrestamo.style.display = "none";
        if (mensajeErrorSobrePrestamo) mensajeErrorSobrePrestamo.style.display = "none";
        if (mensajeErrorFuentePrestamo) mensajeErrorFuentePrestamo.style.display = "none";
        
        // Renderizar sobres
        listaSobresPrestamo.innerHTML = "";
        sobres.forEach(sobre => {
            const btn = document.createElement("button");
            btn.textContent = `${sobre.nombre} (${formatoCOP(sobre.valor)})`;
            btn.classList.add("fuente-transferir-btn");
            btn.setAttribute("data-sobre-id", sobre.id);
            
            btn.addEventListener("click", () => {
                if (sobreSeleccionadoPrestamo === sobre.id) {
                    sobreSeleccionadoPrestamo = null;
                    btn.classList.remove("selected");
                } else {
                    document.querySelectorAll("#listaSobresPrestamo .fuente-transferir-btn")
                        .forEach(b => b.classList.remove("selected"));
                    sobreSeleccionadoPrestamo = sobre.id;
                    btn.classList.add("selected");
                }
                if (mensajeErrorSobrePrestamo) mensajeErrorSobrePrestamo.style.display = "none";
            });
            
            listaSobresPrestamo.appendChild(btn);
        });
        
        // Renderizar fuentes
        listaFuentesPrestamo.innerHTML = "";
        Object.keys(fuentes).forEach(nombreFuente => {
            const btnFuente = document.createElement("button");
            btnFuente.textContent = nombreFuente;
            btnFuente.classList.add("fuente-btn");
            
            btnFuente.addEventListener("click", () => {
                fuenteSeleccionadaPrestamo = nombreFuente;
                document.querySelectorAll("#listaFuentesPrestamo .fuente-btn")
                    .forEach(b => b.classList.remove("selected"));
                btnFuente.classList.add("selected");
                if (mensajeErrorFuentePrestamo) mensajeErrorFuentePrestamo.style.display = "none";
            });
            
            listaFuentesPrestamo.appendChild(btnFuente);
        });
        
        modalCrearPrestamo.classList.remove("hidden");
        ocultarBtnAgregarGasto();
        setTimeout(() => inputNombrePrestamo.focus(), 100);
    });
}

// Cerrar modal crear préstamo al hacer click fuera
if (modalCrearPrestamo) {
    modalCrearPrestamo.addEventListener("click", (e) => {
        if (e.target === modalCrearPrestamo) {
            modalCrearPrestamo.classList.add("hidden");
            inputNombrePrestamo.value = "";
            inputMontoPrestamo.value = "";
            sobreSeleccionadoPrestamo = null;
            fuenteSeleccionadaPrestamo = null;
            if (mensajeErrorCrearPrestamo) mensajeErrorCrearPrestamo.style.display = "none";
            mostrarBtnAgregarGasto();
        }
    });
}

// Cerrar modal crear préstamo
if (btnCerrarCrearPrestamo && modalCrearPrestamo) {
    btnCerrarCrearPrestamo.addEventListener("click", () => {
        modalCrearPrestamo.classList.add("hidden");
        inputNombrePrestamo.value = "";
        inputMontoPrestamo.value = "";
        sobreSeleccionadoPrestamo = null;
        fuenteSeleccionadaPrestamo = null;
        if (mensajeErrorCrearPrestamo) mensajeErrorCrearPrestamo.style.display = "none";
        mostrarBtnAgregarGasto();
    });
}

// Confirmar crear préstamo
if (btnConfirmarCrearPrestamo && modalCrearPrestamo) {
    btnConfirmarCrearPrestamo.addEventListener("click", () => {
        requireAuth(() => {
            const nombre = inputNombrePrestamo.value.trim();
            const montoStr = inputMontoPrestamo.value.trim();
            
            // Validar nombre
            if (!nombre) {
                if (mensajeErrorNombrePrestamo) {
                    mensajeErrorNombrePrestamo.textContent = "Ingresa el nombre";
                    mensajeErrorNombrePrestamo.style.display = "block";
                }
                return;
            }
            
            // Validar monto
            if (!montoStr) {
                if (mensajeErrorMontoPrestamo) {
                    mensajeErrorMontoPrestamo.textContent = "Ingresa el monto";
                    mensajeErrorMontoPrestamo.style.display = "block";
                }
                return;
            }
            
            const monto = Number(montoStr.replace(/[^\d.]/g, ""));
            if (isNaN(monto) || monto <= 0) {
                if (mensajeErrorMontoPrestamo) {
                    mensajeErrorMontoPrestamo.textContent = "El monto debe ser un número mayor a 0";
                    mensajeErrorMontoPrestamo.style.display = "block";
                }
                return;
            }
            
            // Validar sobre
            if (!sobreSeleccionadoPrestamo) {
                if (mensajeErrorSobrePrestamo) {
                    mensajeErrorSobrePrestamo.textContent = "Selecciona un sobre";
                    mensajeErrorSobrePrestamo.style.display = "block";
                }
                return;
            }
            
            const sobre = sobres.find(s => s.id === sobreSeleccionadoPrestamo);
            if (!sobre) {
                if (mensajeErrorSobrePrestamo) {
                    mensajeErrorSobrePrestamo.textContent = "El sobre seleccionado no existe";
                    mensajeErrorSobrePrestamo.style.display = "block";
                }
                return;
            }
            
            // Validar fuente
            if (!fuenteSeleccionadaPrestamo) {
                if (mensajeErrorFuentePrestamo) {
                    mensajeErrorFuentePrestamo.textContent = "Selecciona una fuente";
                    mensajeErrorFuentePrestamo.style.display = "block";
                }
                return;
            }
            
            // Validar que haya suficiente en el sobre
            if (monto > sobre.valor) {
                if (mensajeErrorCrearPrestamo) {
                    mensajeErrorCrearPrestamo.textContent = `No hay suficiente dinero en el sobre. Disponible: ${formatoCOP(sobre.valor)}`;
                    mensajeErrorCrearPrestamo.style.display = "block";
                }
                return;
            }
            
            // Validar que haya suficiente en la fuente
            if (monto > fuentes[fuenteSeleccionadaPrestamo]) {
                if (mensajeErrorCrearPrestamo) {
                    mensajeErrorCrearPrestamo.textContent = `No hay suficiente dinero en ${fuenteSeleccionadaPrestamo}. Disponible: ${formatoCOP(fuentes[fuenteSeleccionadaPrestamo])}`;
                    mensajeErrorCrearPrestamo.style.display = "block";
                }
                return;
            }
            
            // Crear préstamo
            const nuevoPrestamo = {
                id: Date.now(),
                nombre: nombre,
                monto: monto,
                montoRestante: monto,
                sobreId: sobreSeleccionadoPrestamo,
                sobreNombre: sobre.nombre,
                fuente: fuenteSeleccionadaPrestamo
            };
            
            prestamos.push(nuevoPrestamo);
            
            // Descontar del sobre y fuente
            sobre.valor -= monto;
            fuentes[fuenteSeleccionadaPrestamo] -= monto;
            totalGeneral -= monto;
            totalGastos += monto;
            
            // Registrar movimiento
            registrarMovimiento('gasto', `Préstamo a ${nombre}`, monto, fuenteSeleccionadaPrestamo, sobre.nombre);
            
            // Actualizar UI
            actualizarTotalGeneral();
            renderFuentes();
            renderSobres();
            renderPrestamos();
            guardarDatos();
            
            // Limpiar y cerrar modal
            inputNombrePrestamo.value = "";
            inputMontoPrestamo.value = "";
            sobreSeleccionadoPrestamo = null;
            fuenteSeleccionadaPrestamo = null;
            if (mensajeErrorCrearPrestamo) mensajeErrorCrearPrestamo.style.display = "none";
            modalCrearPrestamo.classList.add("hidden");
            mostrarBtnAgregarGasto();
            
            mostrarNotificacion(`Préstamo de ${formatoCOP(monto)} creado para ${nombre}`, "success", 3000);
        });
    });
}

// Cerrar modal devolver préstamo al hacer click fuera
if (modalDevolverPrestamo) {
    modalDevolverPrestamo.addEventListener("click", (e) => {
        if (e.target === modalDevolverPrestamo) {
            modalDevolverPrestamo.classList.add("hidden");
            inputMontoDevolver.value = "";
            fuenteSeleccionadaDevolver = null;
            prestamoActualDevolver = null;
            if (mensajeErrorDevolverPrestamo) mensajeErrorDevolverPrestamo.style.display = "none";
            mostrarBtnAgregarGasto();
        }
    });
}

// Cerrar modal devolver préstamo
if (btnCerrarDevolverPrestamo && modalDevolverPrestamo) {
    btnCerrarDevolverPrestamo.addEventListener("click", () => {
        modalDevolverPrestamo.classList.add("hidden");
        inputMontoDevolver.value = "";
        fuenteSeleccionadaDevolver = null;
        prestamoActualDevolver = null;
        if (mensajeErrorDevolverPrestamo) mensajeErrorDevolverPrestamo.style.display = "none";
        mostrarBtnAgregarGasto();
    });
}

// Confirmar devolver préstamo
if (btnConfirmarDevolverPrestamo && modalDevolverPrestamo) {
    btnConfirmarDevolverPrestamo.addEventListener("click", () => {
        requireAuth(() => {
            if (!prestamoActualDevolver) return;
            
            const montoStr = inputMontoDevolver.value.trim();
            
            // Validar monto
            if (!montoStr) {
                if (mensajeErrorMontoDevolver) {
                    mensajeErrorMontoDevolver.textContent = "Ingresa el monto a devolver";
                    mensajeErrorMontoDevolver.style.display = "block";
                }
                return;
            }
            
            const monto = Number(montoStr.replace(/[^\d.]/g, ""));
            if (isNaN(monto) || monto <= 0) {
                if (mensajeErrorMontoDevolver) {
                    mensajeErrorMontoDevolver.textContent = "El monto debe ser un número mayor a 0";
                    mensajeErrorMontoDevolver.style.display = "block";
                }
                return;
            }
            
            // Validar que el monto no exceda lo pendiente
            if (monto > prestamoActualDevolver.montoRestante) {
                if (mensajeErrorDevolverPrestamo) {
                    mensajeErrorDevolverPrestamo.textContent = `El monto no puede ser mayor al pendiente: ${formatoCOP(prestamoActualDevolver.montoRestante)}`;
                    mensajeErrorDevolverPrestamo.style.display = "block";
                }
                return;
            }
            
            // Validar fuente
            if (!fuenteSeleccionadaDevolver) {
                if (mensajeErrorFuenteDevolver) {
                    mensajeErrorFuenteDevolver.textContent = "Selecciona una fuente";
                    mensajeErrorFuenteDevolver.style.display = "block";
                }
                return;
            }
            
            // Buscar el sobre original del préstamo
            const sobreOriginal = sobres.find(s => s.id === prestamoActualDevolver.sobreId);
            if (!sobreOriginal) {
                if (mensajeErrorDevolverPrestamo) {
                    mensajeErrorDevolverPrestamo.textContent = "Error: El sobre original no existe";
                    mensajeErrorDevolverPrestamo.style.display = "block";
                }
                return;
            }
            
            // Devolver dinero a la fuente
            fuentes[fuenteSeleccionadaDevolver] += monto;
            
            // Devolver dinero al sobre original
            sobreOriginal.valor += monto;
            
            totalGeneral += monto;
            totalGastos -= monto;
            
            // Restar del monto restante del préstamo
            prestamoActualDevolver.montoRestante -= monto;
            
            // Registrar movimiento
            registrarMovimiento('ingreso', `Devolución de préstamo: ${prestamoActualDevolver.nombre}`, monto, fuenteSeleccionadaDevolver, sobreOriginal.nombre);
            
            // Actualizar UI
            actualizarTotalGeneral();
            renderFuentes();
            renderSobres();
            renderPrestamos();
            guardarDatos();
            
            // Cerrar modal
            modalDevolverPrestamo.classList.add("hidden");
            inputMontoDevolver.value = "";
            fuenteSeleccionadaDevolver = null;
            
            const nombrePrestamo = prestamoActualDevolver.nombre;
            const montoDevuelto = monto;
            const estaCompleto = prestamoActualDevolver.montoRestante <= 0;
            
            prestamoActualDevolver = null;
            
            mostrarBtnAgregarGasto();
            
            if (estaCompleto) {
                mostrarNotificacion(`Préstamo de ${nombrePrestamo} completamente pagado`, "success", 3000);
            } else {
                mostrarNotificacion(`Devolución de ${formatoCOP(montoDevuelto)} recibida de ${nombrePrestamo}`, "success", 3000);
            }
        });
    });
}

// Cerrar modal eliminar préstamo
if (btnCancelarEliminarPrestamo && modalConfirmarEliminarPrestamo) {
    btnCancelarEliminarPrestamo.addEventListener("click", () => {
        modalConfirmarEliminarPrestamo.classList.add("hidden");
        prestamoActualEliminar = null;
        mostrarBtnAgregarGasto();
    });
}

// Confirmar eliminar préstamo
if (btnConfirmarEliminarPrestamo && modalConfirmarEliminarPrestamo) {
    btnConfirmarEliminarPrestamo.addEventListener("click", () => {
        requireAuth(() => {
            if (!prestamoActualEliminar) return;
            
            prestamos = prestamos.filter(p => p.id !== prestamoActualEliminar.id);
            
            renderPrestamos();
            guardarDatos();
            
            modalConfirmarEliminarPrestamo.classList.add("hidden");
            prestamoActualEliminar = null;
            mostrarBtnAgregarGasto();
            
            mostrarNotificacion("Préstamo eliminado", "success", 3000);
        });
    });
}

// Cerrar modal eliminar préstamo al hacer click fuera
if (modalConfirmarEliminarPrestamo) {
    modalConfirmarEliminarPrestamo.addEventListener("click", (e) => {
        if (e.target === modalConfirmarEliminarPrestamo) {
            modalConfirmarEliminarPrestamo.classList.add("hidden");
            prestamoActualEliminar = null;
            mostrarBtnAgregarGasto();
        }
    });
}

// -----------------------------------------------------
// SISTEMA DE ESTADÍSTICAS
// -----------------------------------------------------

let filtroEstadisticasActivo = "24h";

// Función para obtener la fecha límite según el filtro
function obtenerFechaLimite(filtro) {
    const ahora = new Date();
    const fechaLimite = new Date();
    
    switch(filtro) {
        case "24h":
            fechaLimite.setTime(ahora.getTime() - (24 * 60 * 60 * 1000));
            break;
        case "semana":
            fechaLimite.setTime(ahora.getTime() - (7 * 24 * 60 * 60 * 1000));
            break;
        case "mes":
            fechaLimite.setTime(ahora.getTime() - (30 * 24 * 60 * 60 * 1000));
            break;
        default:
            fechaLimite.setTime(ahora.getTime() - (24 * 60 * 60 * 1000));
    }
    
    return fechaLimite;
}

// Función para filtrar movimientos por fecha y sobre
function filtrarMovimientosPorFechaYSobre(filtro) {
    const fechaLimite = obtenerFechaLimite(filtro);
    const fechaLimiteISO = fechaLimite.toISOString().split('T')[0];
    const horaActual = new Date();
    const horaActualStr = horaActual.toTimeString().split(' ')[0].substring(0, 5);
    
    return movimientos.filter(mov => {
        // Incluir movimientos con sobre O ingresos generales (tipo 'ingreso' sin sobre)
        // Excluir movimientos sin sobre que no sean ingresos generales
        if (!mov.sobre && mov.tipo !== 'ingreso') return false;
        
        // Excluir movimientos relacionados con préstamos
        if (mov.descripcion && (
            mov.descripcion.includes('Préstamo a') || 
            mov.descripcion.includes('Devolución de préstamo')
        )) {
            return false; // Saltar este movimiento
        }
        
        // Convertir fecha del movimiento a Date para comparación precisa
        let fechaMovimiento = null;
        if (mov.fecha && mov.hora) {
            fechaMovimiento = new Date(mov.fecha + "T" + mov.hora + ":00");
        } else if (mov.fecha) {
            fechaMovimiento = new Date(mov.fecha);
        } else {
            // Si no tiene fecha, usar el ID (timestamp) como fallback
            fechaMovimiento = new Date(mov.id);
        }
        
        // Filtrar por fecha (incluyendo hora si es filtro de 24h)
        if (filtro === "24h") {
            return fechaMovimiento >= fechaLimite;
        } else {
            // Para semana y mes, comparar solo fechas
            const fechaMovStr = fechaMovimiento.toISOString().split('T')[0];
            return fechaMovStr >= fechaLimiteISO;
        }
    });
}

// Función para calcular estadísticas por sobre
function calcularEstadisticasPorSobre(movimientosFiltrados) {
    const estadisticas = {};
    
    // Inicializar estadísticas para todos los sobres existentes
    sobres.forEach(sobre => {
        estadisticas[sobre.nombre] = {
            nombre: sobre.nombre,
            ingreso: 0,
            egreso: 0
        };
    });
    
    movimientosFiltrados.forEach(mov => {
        // Ingresos: tipo 'ingreso'
        if (mov.tipo === 'ingreso' && mov.monto > 0) {
            if (mov.sobre) {
                // Si tiene sobre específico, agregar directamente
                if (!estadisticas[mov.sobre]) {
                    estadisticas[mov.sobre] = {
                        nombre: mov.sobre,
                        ingreso: 0,
                        egreso: 0
                    };
                }
                estadisticas[mov.sobre].ingreso += mov.monto;
            } else {
                // Si NO tiene sobre específico (ingreso general), distribuir según porcentajes
                // Buscar los porcentajes de los sobres al momento del movimiento
                // Como no tenemos histórico de porcentajes, usamos los actuales
                sobres.forEach(sobre => {
                    if (!estadisticas[sobre.nombre]) {
                        estadisticas[sobre.nombre] = {
                            nombre: sobre.nombre,
                            ingreso: 0,
                            egreso: 0
                        };
                    }
                    // Distribuir según el porcentaje del sobre
                    const montoDistribuido = (mov.monto * sobre.porcentaje) / 100;
                    estadisticas[sobre.nombre].ingreso += montoDistribuido;
                });
            }
        }
        
        // Egresos: tipo 'gasto' con sobre
        if (mov.tipo === 'gasto' && mov.monto > 0 && mov.sobre) {
            if (!estadisticas[mov.sobre]) {
                estadisticas[mov.sobre] = {
                    nombre: mov.sobre,
                    ingreso: 0,
                    egreso: 0
                };
            }
            estadisticas[mov.sobre].egreso += mov.monto;
        }
    });
    
    return Object.values(estadisticas);
}

// Función para renderizar estadísticas
function renderEstadisticas() {
    const tablaBody = estadisticasTableBody;
    if (!tablaBody) return;
    
    // Limpiar contenido
    tablaBody.innerHTML = "";
    
    // Filtrar movimientos
    const movimientosFiltrados = filtrarMovimientosPorFechaYSobre(filtroEstadisticasActivo);
    
    // Calcular estadísticas
    const estadisticas = calcularEstadisticasPorSobre(movimientosFiltrados);
    
    // Solo mostrar sobres que existen actualmente
    const sobresExistentes = sobres ? sobres.map(s => s.nombre) : [];
    const estadisticasFiltradas = estadisticas.filter(est => sobresExistentes.includes(est.nombre));
    
    if (estadisticasFiltradas.length === 0) {
        const mensaje = document.createElement("div");
        mensaje.style.cssText = "text-align: center; padding: 20px; color: #666; font-size: 14px;";
        mensaje.textContent = "No hay movimientos en este período";
        tablaBody.appendChild(mensaje);
        return;
    }
    
    // Calcular totales
    const totalIngresos = estadisticasFiltradas.reduce((sum, est) => sum + est.ingreso, 0);
    const totalEgresos = estadisticasFiltradas.reduce((sum, est) => sum + est.egreso, 0);
    
    // Renderizar cada estadística primero
    estadisticasFiltradas.forEach(est => {
        const item = document.createElement("div");
        item.className = "estadistica-item";
        
        item.innerHTML = `
            <span class="estadistica-nombre">${est.nombre}</span>
            <span class="estadistica-egreso">${formatoCOP(est.egreso)}</span>
            <span class="estadistica-ingreso">${formatoCOP(est.ingreso)}</span>
        `;
        
        tablaBody.appendChild(item);
    });
    
    // Renderizar fila de totales al final
    const itemTotal = document.createElement("div");
    itemTotal.className = "estadistica-item estadistica-total";
    
    itemTotal.innerHTML = `
        <span class="estadistica-nombre">Total</span>
        <span class="estadistica-egreso">${formatoCOP(totalEgresos)}</span>
        <span class="estadistica-ingreso">${formatoCOP(totalIngresos)}</span>
    `;
    
    tablaBody.appendChild(itemTotal);
}

// Event listeners para los filtros de estadísticas
function inicializarFiltrosEstadisticas() {
    const filtros = document.querySelectorAll(".filtro-tiempo");
    if (filtros.length === 0) return;
    
    filtros.forEach(btn => {
        btn.addEventListener("click", () => {
            // Remover clase activo de todos
            document.querySelectorAll(".filtro-tiempo").forEach(b => b.classList.remove("activo"));
            
            // Agregar clase activo al botón clickeado
            btn.classList.add("activo");
            
            // Actualizar filtro activo
            filtroEstadisticasActivo = btn.getAttribute("data-filtro");
            
            // Renderizar estadísticas
            renderEstadisticas();
        });
    });
}

// Botón reset estadísticas
const btnResetEstadisticas = document.getElementById("btnResetEstadisticas");
if (btnResetEstadisticas) {
    btnResetEstadisticas.addEventListener("click", () => {
        requireAuth(() => {
            // Obtener movimientos filtrados del período actual
            const movimientosFiltrados = filtrarMovimientosPorFechaYSobre(filtroEstadisticasActivo);
            
            // Obtener movimientos a eliminar (solo los que afectan estadísticas, excluyendo préstamos y resets)
            const movimientosAEliminar = movimientosFiltrados.filter(mov => {
                // Excluir movimientos de préstamos y resets
                if (mov.descripcion && (
                    mov.descripcion.includes('Préstamo a') || 
                    mov.descripcion.includes('Devolución de préstamo') ||
                    mov.descripcion.includes('Reinicio de todos los valores')
                )) {
                    return false;
                }
                // Incluir ingresos y gastos
                return (mov.tipo === 'ingreso' || mov.tipo === 'gasto');
            });
            
            if (movimientosAEliminar.length > 0) {
                // Revertir los efectos de cada movimiento en los valores financieros
                movimientosAEliminar.forEach(mov => {
                    const tipo = mov.tipo;
                    const monto = Number(mov.monto) || 0;
                    
                    if (tipo === 'gasto' && mov.sobre) {
                        // Revertir gasto: sumar de vuelta
                        totalGeneral += monto;
                        totalGastos -= monto;
                        
                        // Sumar de vuelta al sobre
                        const sobre = sobres.find(s => s.nombre === mov.sobre);
                        if (sobre) {
                            sobre.valor += monto;
                        }
                        
                        // Sumar de vuelta a la fuente
                        if (mov.fuente && fuentes.hasOwnProperty(mov.fuente)) {
                            fuentes[mov.fuente] += monto;
                        }
                    } else if (tipo === 'ingreso') {
                        // Revertir ingreso: restar
                        totalGeneral -= monto;
                        totalIngresos -= monto;
                        
                        // Restar de la fuente
                        if (mov.fuente && fuentes.hasOwnProperty(mov.fuente)) {
                            fuentes[mov.fuente] -= monto;
                        }
                        
                        // Si fue un ingreso directo a un sobre, restar de ese sobre
                        if (mov.sobre) {
                            const sobre = sobres.find(s => s.nombre === mov.sobre);
                            if (sobre) {
                                sobre.valor -= monto;
                            }
                        } else {
                            // Si fue un ingreso general (sin sobre, distribuido por porcentajes), revertir la distribución
                            sobres.forEach(s => {
                                s.valor -= (monto * s.porcentaje) / 100;
                            });
                        }
                    }
                });
                
                // Obtener IDs de los movimientos eliminados
                const idsAEliminar = movimientosAEliminar.map(mov => mov.id);
                
                // Eliminar movimientos del array
                movimientos = movimientos.filter(mov => !idsAEliminar.includes(mov.id));
                
                // Asegurar que los valores no sean negativos
                if (totalGeneral < 0) totalGeneral = 0;
                if (totalIngresos < 0) totalIngresos = 0;
                if (totalGastos < 0) totalGastos = 0;
                
                // Asegurar que las fuentes no sean negativas
                Object.keys(fuentes).forEach(f => {
                    if (fuentes[f] < 0) fuentes[f] = 0;
                });
                
                // Asegurar que los sobres no tengan valores negativos
                sobres.forEach(s => {
                    if (s.valor < 0) s.valor = 0;
                });
                
                // Actualizar UI
                actualizarTotalGeneral();
                renderSobres();
                renderFuentes();
                renderEstadisticas();
                
                // Guardar datos
                guardarDatos();
                
                mostrarNotificacion(`${movimientosAEliminar.length} movimientos eliminados. Estadísticas reiniciadas desde ahora.`, "success", 3000);
            } else {
                mostrarNotificacion("No hay movimientos para eliminar en este período", "info", 2000);
            }
        });
    });
}

// Inicializar filtros cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarFiltrosEstadisticas);
} else {
    // DOM ya está listo
    inicializarFiltrosEstadisticas();
}

// Verificar estado inicial
verificarModalesAbiertos();

// -----------------------------------------------------
// MODAL GASTAR GASTO FIJO
// -----------------------------------------------------

// Cerrar modal gastar gasto fijo al hacer click fuera
if (modalGastarGastoFijo) {
    modalGastarGastoFijo.addEventListener("click", (e) => {
        if (e.target === modalGastarGastoFijo) {
            modalGastarGastoFijo.classList.add("hidden");
            gastoActualGastar = null;
            // Mostrar lápices cuando se cierra el modal
            document.querySelectorAll(".edit-btn").forEach(btn => {
                btn.style.display = "";
            });
            mostrarBtnAgregarGasto();
        }
    });
}

// Cerrar modal gastar gasto fijo
if (btnCerrarGastarGastoFijo && modalGastarGastoFijo) {
    btnCerrarGastarGastoFijo.addEventListener("click", () => {
        modalGastarGastoFijo.classList.add("hidden");
        gastoActualGastar = null;
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
        mostrarBtnAgregarGasto();
    });
}

// -----------------------------------------------------
// MODAL CONFIGURAR GASTO FIJO
// -----------------------------------------------------

// Cerrar modal configurar gasto al hacer click fuera
if (modalConfigurarGasto) {
    modalConfigurarGasto.addEventListener("click", (e) => {
        if (e.target === modalConfigurarGasto) {
            modalConfigurarGasto.classList.add("hidden");
            if (inputMontoGasto) inputMontoGasto.value = "";
            sobreSeleccionadoConfigurar = null;
            gastoActualConfigurar = null;
            if (mensajeErrorConfigurarGasto) mensajeErrorConfigurarGasto.style.display = "none";
            // Mostrar lápices cuando se cierra el modal
            document.querySelectorAll(".edit-btn").forEach(btn => {
                btn.style.display = "";
            });
            mostrarBtnAgregarGasto();
        }
    });
}

// Cerrar modal configurar gasto
if (btnCerrarConfigurarGasto && modalConfigurarGasto) {
    btnCerrarConfigurarGasto.addEventListener("click", () => {
        modalConfigurarGasto.classList.add("hidden");
        if (inputMontoGasto) inputMontoGasto.value = "";
        sobreSeleccionadoConfigurar = null;
        gastoActualConfigurar = null;
        if (mensajeErrorConfigurarGasto) mensajeErrorConfigurarGasto.style.display = "none";
        // Mostrar lápices cuando se cierra el modal
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.style.display = "";
        });
        mostrarBtnAgregarGasto();
    });
}

// Confirmar configuración de gasto fijo
if (btnConfirmarConfigurarGasto && modalConfigurarGasto && inputMontoGasto && mensajeErrorConfigurarGasto && listaSobresConfigurar) {
    btnConfirmarConfigurarGasto.addEventListener("click", () => {
        requireAuth(() => {
            if (!gastoActualConfigurar) return;
            
            let montoStr = inputMontoGasto.value.trim();
            
            // Validar monto
            if (!montoStr) {
                mensajeErrorConfigurarGasto.textContent = "Ingresa un monto";
                mensajeErrorConfigurarGasto.style.display = "block";
                return;
            }
            
            let monto = Number(montoStr.replace(/[^\d.]/g, ""));
            
            if (isNaN(monto) || monto <= 0) {
                mensajeErrorConfigurarGasto.textContent = "El monto debe ser un número mayor a 0";
                mensajeErrorConfigurarGasto.style.display = "block";
                return;
            }
            
            // Validar sobre seleccionado
            if (!sobreSeleccionadoConfigurar) {
                mensajeErrorConfigurarGasto.textContent = "Selecciona un sobre";
                mensajeErrorConfigurarGasto.style.display = "block";
                return;
            }
            
            // Verificar que el sobre existe
            const sobreExiste = sobres.find(s => s.id === sobreSeleccionadoConfigurar);
            if (!sobreExiste) {
                mensajeErrorConfigurarGasto.textContent = "El sobre seleccionado no existe";
                mensajeErrorConfigurarGasto.style.display = "block";
                return;
            }
            
            // Guardar configuración (solo almacenar, no gastar)
            gastoActualConfigurar.monto = monto;
            gastoActualConfigurar.sobreId = sobreSeleccionadoConfigurar;
            
            // Ocultar mensaje de error si todo está bien
            mensajeErrorConfigurarGasto.style.display = "none";
            
            // Guardar y actualizar
            guardarDatos();
            renderGastos();
            
            // Cerrar modal
            modalConfigurarGasto.classList.add("hidden");
            inputMontoGasto.value = "";
            sobreSeleccionadoConfigurar = null;
            gastoActualConfigurar = null;
            
            // Mostrar lápices cuando se cierra el modal
            document.querySelectorAll(".edit-btn").forEach(btn => {
                btn.style.display = "";
            });
            mostrarBtnAgregarGasto();
        });
    });
}

// Permitir configurar gasto con Enter
if (inputMontoGasto && btnConfirmarConfigurarGasto) {
    inputMontoGasto.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (btnConfirmarConfigurarGasto) {
                btnConfirmarConfigurarGasto.click();
            }
        }
    });
}

// -----------------------------------------------------
// SISTEMA DE CONFIGURACIÓN
// -----------------------------------------------------

// Configuración por defecto
const configuracionDefault = {
    tema: 'claro',
    idioma: 'es',
    moneda: 'COP',
    formatoFecha: 'DD/MM/YYYY'
};

/**
 * Carga la configuración desde localStorage
 * @returns {object} Configuración del usuario
 */
function cargarConfiguracion() {
    try {
        const configGuardada = localStorage.getItem('configuracion');
        if (configGuardada) {
            const config = JSON.parse(configGuardada);
            // Combinar con valores por defecto para asegurar que todos los campos existan
            return { ...configuracionDefault, ...config };
        }
    } catch (error) {
        console.error('Error al cargar configuración:', error);
    }
    return configuracionDefault;
}

/**
 * Guarda la configuración en localStorage
 * @param {object} config - Configuración a guardar
 */
function guardarConfiguracion(config) {
    try {
        localStorage.setItem('configuracion', JSON.stringify(config));
    } catch (error) {
        console.error('Error al guardar configuración:', error);
    }
}

/**
 * Aplica el tema al documento
 * @param {string} tema - 'claro' o 'oscuro'
 */
function aplicarTema(tema) {
    document.body.setAttribute('data-tema', tema);
    const toggleTema = document.getElementById('toggleTema');
    if (toggleTema) {
        toggleTema.setAttribute('data-tema', tema);
    }
}

/**
 * Inicializa los controles de configuración
 */
function inicializarConfiguracion() {
    // Cargar configuración
    const config = cargarConfiguracion();
    
    // Aplicar tema
    aplicarTema(config.tema);
    
    // Inicializar controles
    const toggleTema = document.getElementById('toggleTema');
    const selectIdioma = document.getElementById('selectIdioma');
    const selectMoneda = document.getElementById('selectMoneda');
    const selectFormatoFecha = document.getElementById('selectFormatoFecha');
    
    if (toggleTema) {
        toggleTema.setAttribute('data-tema', config.tema);
        toggleTema.addEventListener('click', () => {
            const nuevoTema = config.tema === 'claro' ? 'oscuro' : 'claro';
            config.tema = nuevoTema;
            aplicarTema(nuevoTema);
            guardarConfiguracion(config);
        });
    }
    
    if (selectIdioma) {
        selectIdioma.value = config.idioma;
        selectIdioma.addEventListener('change', (e) => {
            config.idioma = e.target.value;
            guardarConfiguracion(config);
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion('Idioma actualizado', 'success', 2000);
            }
        });
    }
    
    if (selectMoneda) {
        selectMoneda.value = config.moneda;
        selectMoneda.addEventListener('change', (e) => {
            config.moneda = e.target.value;
            guardarConfiguracion(config);
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion('Moneda actualizada', 'success', 2000);
            }
        });
    }
    
    if (selectFormatoFecha) {
        selectFormatoFecha.value = config.formatoFecha;
        selectFormatoFecha.addEventListener('change', (e) => {
            config.formatoFecha = e.target.value;
            guardarConfiguracion(config);
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion('Formato de fecha actualizado', 'success', 2000);
            }
        });
    }
}

// Inicializar configuración cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarConfiguracion);
} else {
    inicializarConfiguracion();
}
