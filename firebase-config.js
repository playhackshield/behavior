// Vervang deze config met je eigen Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC7oYc94e1ptrc3gKOedYmNMpPDJf5OBw4",
  authDomain: "schoolquizapp-28abf.firebaseapp.com",
  projectId: "schoolquizapp-28abf",
  storageBucket: "schoolquizapp-28abf.firebasestorage.app",
  messagingSenderId: "921022621334",
  appId: "1:921022621334:web:ef582f1e067a77a41284b7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
