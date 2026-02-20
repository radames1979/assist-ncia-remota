import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || "AIzaSyCZlzePpQyJrZzvPjzkXwz45EWbquMRwu0",
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || "assistencia-remota-c02c7.firebaseapp.com",
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || "assistencia-remota-c02c7",
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || "assistencia-remota-c02c7.firebasestorage.app",
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || "858868227263",
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || "1:858868227263:web:f496201587b0a9acfdfa0a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
