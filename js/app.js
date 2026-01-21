import { menuData } from './data.js';
import { dbController } from './db.js'; 
import { initAuth } from './auth.js';

// --- STATE VARIABLES ---
let cart = [];
let selectedTempItem = null; // Untuk menyimpan item sementara saat pilih Es/Panas

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cek Login
    initAuth();

    // 2. Render Menu Awal
    renderMenu('all');

    // 3. Setup Tombol & Listener
    setupEventListeners();
    
    // 4. Set Tanggal Default ke Hari Ini
    const today = new Date().toISOString().slice(0, 10);
    const datePicker = document.getElementById('date-picker');
    if(datePicker) {
        datePicker.value = today;
        // Load data rekap hari ini
        loadRekapData(today);
    }
});

// --- RENDER MENU UI ---
function renderMenu(category) {
    const grid = document.getElementById('menu-grid');
    if(!grid) return;
    
    grid.innerHTML = '';

    const items = category === 'all' 
        ? menuData 
        : menuData.filter(item => item.cat === category);

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = `menu-card bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 cursor-pointer active:bg-orange-50 transition relative overflow-hidden`;
        div.onclick = () => addToCartLogic(item);
        
        div.innerHTML = `
            <div>
                <span class="text-[10px] font-bold text-orange-500 uppercase tracking-wide bg-orange-100 px-2 py-0.5 rounded-md">${item.cat}</span>
                <h3 class="font-bold text-gray-800 leading-tight mt-2 line-clamp-2">${item.name}</h3>
            </div>
            <div class="flex justify-between items-end">
                <p class="font-bold text-gray-600">Rp ${item.price.toLocaleString()}</p>
                <div class="bg-gray-50 rounded-full w-6 h-6 flex items-center justify-center text-orange-500 text-xs">
                    <i class="fas fa-plus"></i>
                </div>
            </div>
        `;
        grid.appendChild(div);
    });
}

// --- LOGIC KERANJANG ---
function addToCartLogic(item) {
    // Logic Khusus: Minuman Non Kopi Wajib Pilih Suhu
    if (item.cat === 'nonkopi') {
        selectedTempItem = item;
        document.getElementById('variant-item-name').innerText = item.name;
        document.getElementById('modal-variant').classList.remove('hidden');
    } else {
        // Default variant logic
        let variant = '-';
        if (item.cat === 'kopi') variant = 'Panas'; // Kopi default panas
        addItemToCart(item, variant);
    }
}

function addItemToCart(item, variant) {
    const existing = cart.find(c => c.id === item.id && c.variant === variant);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ ...item, qty: 1, variant: variant });
    }
    updateCartUI();
    showToast(`${item.name} masuk keranjang`);
}

function updateCartUI() {
    const count = cart.reduce((acc, item) => acc + item.qty, 0);
    const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    
    // Update Badge Notifikasi
    const badge = document.getElementById('cart-count');
    if(badge) {
        badge.innerText = count;
        badge.classList.toggle('hidden', count === 0);
    }

    // Update List di Modal Cart
    const list = document.getElementById('cart-items');
    if(list) {
        list.innerHTML = cart.map((item, index) => `
            <div class="flex justify-between items-center mb-3 border-b border-gray-100 pb-2 last:border-0">
                <div>
                    <p class="font-bold text-gray-800 text-sm">${item.name} <span class="text-orange-600 text-xs">${item.variant !== '-' ? `(${item.variant})` : ''}</span></p>
                    <p class="text-xs text-gray-500">Rp ${item.price.toLocaleString()} x ${item.qty}</p>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="window.updateQty(${index}, -1)" class="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold hover:bg-gray-200">-</button>
                    <span class="font-bold w-4 text-center text-sm">${item.qty}</span>
                    <button onclick="window.updateQty(${index}, 1)" class="w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-bold hover:bg-orange-200">+</button>
                </div>
            </div>
        `).join('');
        
        if(cart.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-400 py-10 flex flex-col items-center"><i class="fas fa-shopping-basket text-4xl mb-2 opacity-20"></i><p>Keranjang kosong</p></div>';
        }
    }

    const totalEl = document.getElementById('cart-total');
    if(totalEl) totalEl.innerText = `Rp ${total.toLocaleString()}`;
}

// Global scope function agar bisa dipanggil dari onclick HTML string
window.updateQty = (index, change) => {
    cart[index].qty += change;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    updateCartUI();
};


// --- DATABASE TRANSAKSI (MENGGUNAKAN DB CONTROLLER) ---

// 1. Simpan Transaksi (Tombol Bayar)
async function checkout() {
    if (cart.length === 0) return alert("Keranjang kosong bro!");
    
    const btn = document.getElementById('btn-checkout');
    const originalText = btn.innerHTML;
    
    // UI Loading State
    btn.disabled = true;
    btn.innerText = "Menyimpan...";
    btn.classList.add('opacity-70', 'cursor-not-allowed');

    const dateInput = document.getElementById('date-picker').value;
    const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    
    // Format detail barang jadi string biar mudah dibaca di Excel
    const detailString = cart.map(i => `${i.name} ${i.variant!='-'?`(${i.variant})`:''} (${i.qty})`).join(', ');

    const transaction = {
        tanggal: dateInput,
        waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        tipe: 'PENJUALAN',
        detail: detailString,
        total: total,
        // Timestamp server (penting untuk sorting akurat)
        created_at: firebase.database.ServerValue.TIMESTAMP 
    };

    try {
        // PANGGIL FUNGSI DARI DB.JS
        await dbController.addTransaction(transaction);
        
        // Reset state jika sukses
        cart = [];
        updateCartUI();
        document.getElementById('modal-cart').classList.add('hidden');
        showToast("✅ Transaksi Berhasil!");
        
    } catch (error) {
        console.error(error);
        alert("Gagal simpan: " + error.message);
    } finally {
        // Reset tombol
        btn.disabled = false;
        btn.innerHTML = originalText;
        btn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
}

// 2. Simpan Pengeluaran (Makan Owner)
window.handleUangMakan = async function() {
    if(!confirm("Yakin input jatah makan (-10rb)?")) return;

    const dateInput = document.getElementById('date-picker').value;
    const btn = document.querySelector('button[onclick="handleUangMakan()"]');
    btn.disabled = true;

    const expense = {
        tanggal: dateInput,
        waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        tipe: 'MAKAN_OWNER',
        detail: 'Jatah Makan Harian',
        total: 10000,
        created_at: firebase.database.ServerValue.TIMESTAMP
    };

    try {
        // PANGGIL FUNGSI DARI DB.JS
        await dbController.addExpense(expense);
        showToast("🍽️ Makan tercatat!");
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
    }
}


// --- REALTIME REKAP (MENGGUNAKAN LISTENER DB.JS) ---
function loadRekapData(date) {
    // Reset angka dulu biar gak bingung pas ganti tanggal
    document.getElementById('stat-omset').innerText = 'Loading...';
    document.getElementById('stat-expense').innerText = 'Loading...';
    document.getElementById('history-list').innerHTML = '<p class="p-4 text-center text-xs text-gray-400">Memuat data...</p>';

    // 1. Dengar data Penjualan
    dbController.listenTransactions(date, (snapshot) => {
        let omset = 0;
        let html = '';
        const data = [];

        // Convert object ke array biar bisa dibalik (terbaru diatas)
        snapshot.forEach(child => {
            data.unshift(child.val()); // Unshift biar urutan terbalik
        });
        
        data.forEach(val => {
            omset += val.total;
            html += `
                <div class="flex justify-between items-center p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                    <div class="overflow-hidden">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-gray-800 text-sm">${val.waktu}</span>
                            <span class="text-[10px] bg-green-100 text-green-600 px-1.5 rounded">Jual</span>
                        </div>
                        <div class="text-xs text-gray-500 truncate w-full mt-0.5">${val.detail}</div>
                    </div>
                    <div class="font-bold text-green-600 text-sm whitespace-nowrap">+${val.total.toLocaleString()}</div>
                </div>
            `;
        });

        document.getElementById('stat-omset').innerText = `Rp ${omset.toLocaleString()}`;
        document.getElementById('history-list').innerHTML = html || '<div class="p-8 text-center text-gray-300 flex flex-col items-center"><i class="fas fa-receipt text-3xl mb-2"></i><span class="text-xs">Belum ada penjualan</span></div>';
        
        updateNetTotal(omset, null);
    });

    // 2. Dengar data Pengeluaran
    dbController.listenExpenses(date, (snapshot) => {
        let expense = 0;
        snapshot.forEach(child => {
            expense += child.val().total;
        });
        document.getElementById('stat-expense').innerText = `Rp ${expense.toLocaleString()}`;
        updateNetTotal(null, expense);
    });
}

// Helper hitung bersih
let tempOmset = 0;
let tempExpense = 0;
function updateNetTotal(omset, expense) {
    if(omset !== null) tempOmset = omset;
    if(expense !== null) tempExpense = expense;
    
    const net = tempOmset - tempExpense;
    const el = document.getElementById('stat-net');
    
    el.innerText = `Rp ${net.toLocaleString()}`;
    
    // Warna berubah kalau minus (rugi/boncos)
    if(net < 0) {
        el.classList.remove('text-blue-800');
        el.classList.add('text-red-600');
    } else {
        el.classList.add('text-blue-800');
        el.classList.remove('text-red-600');
    }
}


// --- EVENT LISTENERS ---
function setupEventListeners() {
    // 1. Tab Kategori Menu
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderMenu(e.target.dataset.cat);
        });
    });

    // 2. Navigasi Bawah (Kasir vs Rekap)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            
            // Style Active
            document.querySelectorAll('.nav-btn').forEach(b => {
                b.classList.remove('active', 'text-orange-600');
                b.classList.add('text-gray-400');
            });
            e.currentTarget.classList.add('active', 'text-orange-600');
            e.currentTarget.classList.remove('text-gray-400');

            // Switch View
            if(target === 'kasir') {
                document.getElementById('main-content').classList.remove('hidden');
                document.getElementById('rekap-view').classList.add('hidden');
                document.getElementById('header-title').innerText = "Warmindo Dipo"; // Reset title
            } else {
                document.getElementById('main-content').classList.add('hidden');
                document.getElementById('rekap-view').classList.remove('hidden');
                // Refresh data saat masuk tab rekap
                loadRekapData(document.getElementById('date-picker').value); 
            }
        });
    });

    // 3. Modal Variants
    document.querySelectorAll('.btn-variant').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const variant = e.currentTarget.dataset.var; // Es / Panas
            if(selectedTempItem) {
                addItemToCart(selectedTempItem, variant);
                selectedTempItem = null; // Reset
            }
            document.getElementById('modal-variant').classList.add('hidden');
        });
    });

    // 4. Cart Modal
    const fabCart = document.getElementById('fab-cart');
    if(fabCart) {
        fabCart.addEventListener('click', () => {
            document.getElementById('modal-cart').classList.remove('hidden');
        });
    }
    
    // 5. Checkout Button
    const btnCheckout = document.getElementById('btn-checkout');
    if(btnCheckout) {
        btnCheckout.addEventListener('click', checkout);
    }

    // 6. Ganti Tanggal (Date Picker)
    const datePicker = document.getElementById('date-picker');
    if(datePicker) {
        datePicker.addEventListener('change', (e) => {
            loadRekapData(e.target.value);
            showToast(`📅 Data tanggal ${e.target.value} dimuat`);
        });
    }
}

// Helper: Toast Notification
function showToast(msg) {
    const t = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    if(t && msgEl) {
        msgEl.innerText = msg;
        t.classList.remove('opacity-0');
        // Reset timer kalau ada toast baru biar gak kedip
        clearTimeout(window.toastTimer);
        window.toastTimer = setTimeout(() => t.classList.add('opacity-0'), 2000);
    }
}