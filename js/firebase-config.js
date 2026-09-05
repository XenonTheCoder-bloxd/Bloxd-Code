
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  getDocs,
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCDl2nf8u7vq7JwhcZcIUSK6fa_SjSACP0",
  authDomain: "bloxdcode.firebaseapp.com",
  projectId: "bloxdcode",
  storageBucket: "bloxdcode.firebasestorage.app",
  messagingSenderId: "888731101557",
  appId: "1:888731101557:web:a76440941389ed1885cb3c",
  measurementId: "G-QJ6691YJRQ"
};

let app, analytics, auth, db, storage;
let isFirebaseConnected = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  isSupported().then(supported => {
    if (supported) analytics = getAnalytics(app);
  });
  isFirebaseConnected = true;
  console.log("Firebase initialized successfully");
} catch (e) {
  console.warn("Firebase initialization warning (running in fallback/local mode):", e);
}

export { 
  app, 
  analytics, 
  auth, 
  db, 
  storage, 
  isFirebaseConnected,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  getDocs,
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  where,
  ref, 
  uploadBytes, 
  getDownloadURL
};
