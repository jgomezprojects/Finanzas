// -----------------------------------------------------
// FIREBASE CONFIGURATION - ES Modules desde CDN
// Este archivo inicializa Firebase y exporta la instancia de Auth
// -----------------------------------------------------

// Importar módulos necesarios desde el CDN de Firebase
// Versión 10.7.1 - ES Modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Configuración de Firebase
// Estas credenciales identifican tu proyecto de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDmsnAD45_N6SoPdDUAHZFf1W8gEQ5SU_I",
    authDomain: "finanzas-app-d3feb.firebaseapp.com",
    projectId: "finanzas-app-d3feb",
    appId: "1:694454786480:web:077c3d26c18545b4e0de75"
};

// Inicializar Firebase App
// Esta función crea y retorna una instancia de Firebase App
const app = initializeApp(firebaseConfig);

// Inicializar y obtener la instancia de Firebase Authentication
// Esta instancia se usará en auth.js para todas las operaciones de autenticación
const auth = getAuth(app);

// Inicializar y obtener la instancia de Firestore
// Se usará para guardar datos del usuario (username, email, etc.)
const db = getFirestore(app);

// Exportar las instancias de auth y db
// Estas serán importadas en auth.js para reemplazar el sistema fake
export { auth, db };

