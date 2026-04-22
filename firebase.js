// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD2_cHZU_3YVkCUgY19oigDP7bhOGod8j8",
  authDomain: "animes-65dda.firebaseapp.com",
  projectId: "animes-65dda",
  storageBucket: "animes-65dda.firebasestorage.app",
  messagingSenderId: "648370475489",
  appId: "1:648370475489:web:18d5e8299d8055867dc2a0",
  measurementId: "G-GQNM9Q3W2M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);