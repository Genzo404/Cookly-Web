import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCvCaNzHTh3UqIpD_41bHLU1s5n6ikFh8",
  authDomain: "cookly-e712f.firebaseapp.com",
  projectId: "cookly-e712f",
  storageBucket: "cookly-e712f.firebasestorage.app",
  messagingSenderId: "997020620472",
  appId: "1:997020620472:web:0079ce8ac214cb5af3864d",
  measurementId: "G-PW4N8P0RQZ"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);