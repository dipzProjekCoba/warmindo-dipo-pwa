// Konfigurasi Firebase Anda
const firebaseConfig = {
    apiKey: "AIzaSyAUPGXsU8-St1jwuio1T793Q-iN4BKhrFU",
    authDomain: "datawarmindodipo.firebaseapp.com",
    databaseURL: "https://datawarmindodipo-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "datawarmindodipo",
    storageBucket: "datawarmindodipo.firebasestorage.app",
    messagingSenderId: "753638056061",
    appId: "1:753638056061:web:e81832613cd48ae4a05114",
    measurementId: "G-8ZVPWKHXLF"
};

// Initialize
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
export const db = firebase.database();