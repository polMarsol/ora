// Importa les funcions necessàries del SDK de Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // <--- Aquesta línia és NOVA i necessària!
// import { getAnalytics } from "firebase/analytics"; // <--- Comentada o eliminada si no uses Analytics

// La teva configuració de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCHicdw6YTVM3zvAYdhDfhFufjMVq82ki0",
  authDomain: "ora2-4f0b1.firebaseapp.com",
  projectId: "ora2-4f0b1",
  storageBucket: "ora2-4f0b1.firebasestorage.app",
  messagingSenderId: "54123842201",
  appId: "1:54123842201:web:cd4ac8cef9437b6d290608",
  measurementId: "G-S843JJLB7Q"
};

// Inicialitza Firebase
const app = initializeApp(firebaseConfig);

// Inicialitza Firebase Auth i exporta-la
const auth = getAuth(app); // <--- Aquesta línia és NOVA!

// Si no necessites Analytics, pots deixar aquesta línia comentada o eliminar-la.
// const analytics = getAnalytics(app);

export { auth }; // <--- Aquesta línia és CLAU per exportar l'objecte d'autenticació