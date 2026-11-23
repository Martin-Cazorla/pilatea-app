// Firebase Admin: solo en el servidor (acciones de servidor y route handlers).
// Se usa para lo que el alumno nunca debe poder hacer, como dar de alta alumnos.
// Credenciales: en Firebase App Hosting se toman solas; en local o en Vercel,
// FIREBASE_SERVICE_ACCOUNT con el JSON de una cuenta de servicio.
import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function crearApp(): App {
  if (getApps().length) return getApp();
  const cuenta = process.env.FIREBASE_SERVICE_ACCOUNT;
  return cuenta ? initializeApp({ credential: cert(JSON.parse(cuenta)) }) : initializeApp();
}

export const adminAuth = () => getAuth(crearApp());
export const adminDb = () => getFirestore(crearApp());
