// js/config.js

// 1. KONFIGURASI FIREBASE (Laporan & Transaksi)
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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
export const db = firebase.database();


// 2. KONFIGURASI SUPABASE (Stok & Menu)
const SUPABASE_URL = 'https://zxyxfymlrcogpvbakbtb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eXhmeW1scmNvZ3B2YmFrYnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDUwMDEsImV4cCI6MjA4NDgyMTAwMX0.lifJkCBvLBTRkEWxdy3pQpTeNVpFysgZh7dsz1d7gd4';

// Cek apakah script Supabase sudah dipasang di HTML
if (typeof supabase === 'undefined') {
    alert("CRITICAL ERROR: Script Supabase belum dipasang di index.html!");
}

export const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);