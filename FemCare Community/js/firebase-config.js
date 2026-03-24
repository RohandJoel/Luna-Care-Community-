import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCKfKMpkJZXtyWPKhhc5pnO9akVLekxdyc",
  authDomain: "femcare-community.firebaseapp.com",
  projectId: "femcare-community",
  storageBucket: "femcare-community.firebasestorage.app",
  messagingSenderId: "235546591574",
  appId: "1:235546591574:web:6c55647a694ef91947d6f7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);