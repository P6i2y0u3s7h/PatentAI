import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Default to user's real project configuration from patientai-7ba53 so deployment never fails
// even if environment variables are not yet configured in Vercel project settings.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB1z-20f4Ston4fr8gVLRZwlhi5zjO-Ay8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'patientai-7ba53.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'patientai-7ba53',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'patientai-7ba53.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '239598118567',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:239598118567:web:89a4b7e0955e73d4355d82',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-REQLXNYGXP',
};

let app: FirebaseApp;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  if (typeof window !== 'undefined') {
    console.info(`[PatentAI] Firebase Client initialized (Project: ${firebaseConfig.projectId})`);
  }
} catch (error) {
  console.error('[PatentAI] Firebase Client initialization error:', error);
  app = getApps()[0] || initializeApp(firebaseConfig);
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
