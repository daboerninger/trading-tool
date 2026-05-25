import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDzp9dMsbd8Nxs-RJSogmjJuMFxEDzGntY",
  authDomain: "trading-tool-181ce.firebaseapp.com",
  projectId: "trading-tool-181ce",
  storageBucket: "trading-tool-181ce.firebasestorage.app",
  messagingSenderId: "752635401681",
  appId: "1:752635401681:web:963f16c17398fba2013cf0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
