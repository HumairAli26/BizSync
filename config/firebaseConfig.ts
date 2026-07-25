// config/firebaseConfig.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseOptions, initializeApp } from "firebase/app";
import {
  Auth,
  browserLocalPersistence,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAEeHvvO0UP7q_Oq_I6PdD1vZORNMikz-A",
  authDomain: "bizsync-634bf.firebaseapp.com",
  projectId: "bizsync-634bf",
  storageBucket: "bizsync-634bf.firebasestorage.app",
  messagingSenderId: "904434688259",
  appId: "1:904434688259:web:92d1c95d9457255379c936",
};

const app = initializeApp(firebaseConfig);

// Prevent "Auth instance already initialized" during Fast Refresh
let auth: Auth;

try {
  auth = initializeAuth(app, {
    persistence:
      Platform.OS === "web"
        ? browserLocalPersistence
        : getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { auth };

export const db: Firestore = getFirestore(app);
