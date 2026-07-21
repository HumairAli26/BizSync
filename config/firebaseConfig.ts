// Import the functions you need from the SDKs you need
//import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseOptions } from "firebase/app";
import { Auth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAEeHvvO0UP7q_Oq_I6PdD1vZORNMikz-A",
  authDomain: "bizsync-634bf.firebaseapp.com",
  projectId: "bizsync-634bf",
  storageBucket: "bizsync-634bf.firebasestorage.app",
  messagingSenderId: "904434688259",
  appId: "1:904434688259:web:92d1c95d9457255379c936",
};

const app = initializeApp(firebaseConfig);

export const auth: Auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db: Firestore = getFirestore(app);
//const analytics = getAnalytics(app);
