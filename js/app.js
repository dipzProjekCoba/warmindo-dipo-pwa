import { menuData } from './data.js';
import { db } from './db.js';
import { initAuth } from './auth.js';

// --- STATE VARIABLES ---
let cart = [];
let selectedTempItem = null; // Untuk item yang butuh pilih Es/Panas

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    renderMenu('all');
    setupEventListeners();
    
    // Set Date Picker ke Hari Ini
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('date-picker').value = today;
    
    // Load Rekap Pertama kali
    loadRekapData(today);
});

// --- RENDER MENU ---
function renderMenu(category) {
    const grid = document.getElementById('menu-grid');
    grid.innerHTML = '';

    const items = category === 'all' 
        ? menuData 
        : menuData.filter(item => item.cat === category);

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = `menu-card bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 cursor-pointer active:bg-orange-50 transition`;
        div.onclick = () => addToCartLogic(item);
        
        div.innerHTML = `
            <div>
                <span class="text-[10px] font-bold text-orange-500 uppercase tracking-wide bg-orange-100 px-2 py-0.5 rounded-md">${item.cat}</span>
                <h3 class="font-bold text-gray-800 leading-tight mt-2 line-clamp-2">${item.name}</h3>
            </div>
            <p class="font-bold text-gray-600">Rp ${item.price.toLocaleString()}</p>
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
        // Langsung masuk keranjang (Default Panas untuk Kopi, lainnya Normal)
        let variant = '-';
        if (item.cat === 'kopi') variant = 'Panas';
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
    showToast(`${item.name} ditambahkan`);
}

function updateCartUI() {
    const count = cart.reduce((acc, item) => acc + item.qty, 0);
    const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    
    // Update Badge
    const badge = document.getElementById('cart-count');
    badge.innerText = count;
    badge.classList.toggle('hidden', count === 0);

    // Update Modal List
    const list = document.getElementById('cart-items');
    list.innerHTML = cart.map((item, index) => `
        <div class="flex justify-between items-center mb-3 border-b pb-2">
            <div>
                <p class="font-bold text-gray-800">${item.name} ${item.variant !== '-' ? `(${item.variant})` : ''}</p>
                <p class="text-xs text-gray-500">Rp ${item.price.toLocaleString()} x ${item.qty}</p>
            </div>
            <div class="flex items-center gap-3">
                <button onclick="window.updateQty(${index}, -1)" class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold">-</button>
                <span class="font-bold w-4 text-center">${item.qty}</span>
                <button onclick="window.updateQty(${index}, 1)" class="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold">+</button>
            </div>
        </div>
    `).join('');

    document.getElementById('cart-total').innerText = `Rp ${total.toLocaleString()}`;
    
    // Expose updateQty to window scope because module logic
    window.updateQty = (index, change) => {
        cart[index].qty += change;
        if (cart[index].qty <= 0) cart.splice(index, 1);
        updateCartUI();
    };
}

// --- DATABASE FUNCTIONS ---

// 1. Simpan Transaksi (Indomie, Kopi, dll)
async function checkout() {
    if (cart.length === 0) return alert("Keranjang kosong bro!");
    
    const btn = document.getElementById('btn-checkout');
    btn.disabled = true;
    btn.innerText = "Menyimpan...";

    const dateInput = document.getElementById('date-picker').value; // Ambil tanggal dari input
    const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const detailString = cart.map(i => `${i.name} ${i.variant!='-'?`(${i.variant})`:''} x${i.qty}`).join(', ');

    const transaction = {
        tanggal: dateInput,
        waktu: new Date().toLocaleTimeString('id-ID'),
        tipe: 'PENJUALAN',
        detail: detailString,
        total: total,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    try {
        await db.ref('transaksi').push(transaction);
        cart = [];
        updateCartUI();
        document.getElementById('modal-cart').classList.add('hidden');
        showToast("Data Tersimpan Aman!");
        loadRekapData(dateInput); // Refresh rekap realtime
    } catch (error) {
        alert("Gagal simpan: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle mr-2"></i> SIMPAN DATA';
    }
}

// 2. Simpan Pengeluaran (Uang Makan)
window.handleUangMakan = async function() {
    if(!confirm("Potong 10rb untuk makan hari ini?")) return;

    const dateInput = document.getElementById('date-picker').value;

    const expense = {
        tanggal: dateInput,
        waktu: new Date().toLocaleTimeString('id-ID'),
        tipe: 'MAKAN_OWNER',
        detail: 'Makan Diva',
        total: 10000,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    try {
        await db.ref('pengeluaran').push(expense);
        showToast("Sip, uang makan tercatat -10rb");
        loadRekapData(dateInput);
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// 3. Load Rekap (Dashboard)
function loadRekapData(date) {
    // Listener Transaksi
    db.ref('transaksi').orderByChild('tanggal').equalTo(date).on('value', (snapshot) => {
        let omset = 0;
        let html = '';
        
        snapshot.forEach(child => {
            const val = child.val();
            omset += val.total;
            html += `
                <div class="flex justify-between p-3">
                    <div>
                        <div class="font-bold text-gray-800">${val.waktu}</div>
                        <div class="text-xs text-gray-500 truncate w-40">${val.detail}</div>
                    </div>
                    <div class="font-bold text-green-600">+${val.total.toLocaleString()}</div>
                </div>
            `;
        });

        document.getElementById('stat-omset').innerText = `Rp ${omset.toLocaleString()}`;
        document.getElementById('history-list').innerHTML = html || '<p class="p-4 text-center text-gray-400">Belum ada transaksi</p>';
        updateNetTotal(omset, null);
    });

    // Listener Pengeluaran
    db.ref('pengeluaran').orderByChild('tanggal').equalTo(date).on('value', (snapshot) => {
        let expense = 0;
        snapshot.forEach(child => {
            expense += child.val().total;
        });
        document.getElementById('stat-expense').innerText = `Rp ${expense.toLocaleString()}`;
        updateNetTotal(null, expense);
    });
}

let tempOmset = 0;
let tempExpense = 0;
function updateNetTotal(omset, expense) {
    if(omset !== null) tempOmset = omset;
    if(expense !== null) tempExpense = expense;
    
    const net = tempOmset - tempExpense;
    document.getElementById('stat-net').innerText = `Rp ${net.toLocaleString()}`;
}


// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Tab Filters
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderMenu(e.target.dataset.cat);
        });
    });

    // Bottom Nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            
            // Toggle active style
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'text-orange-600'));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.add('text-gray-400'));
            e.currentTarget.classList.add('active', 'text-orange-600');
            e.currentTarget.classList.remove('text-gray-400');

            // Toggle View
            if(target === 'kasir') {
                document.getElementById('main-content').classList.remove('hidden');
                document.getElementById('rekap-view').classList.add('hidden');
            } else {
                document.getElementById('main-content').classList.add('hidden');
                document.getElementById('rekap-view').classList.remove('hidden');
                // Refresh data saat pindah tab
                loadRekapData(document.getElementById('date-picker').value); 
            }
        });
    });

    // Modal Variant Buttons
    document.querySelectorAll('.btn-variant').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const variant = e.currentTarget.dataset.var; // Es atau Panas
            addItemToCart(selectedTempItem, variant);
            document.getElementById('modal-variant').classList.add('hidden');
        });
    });

    // Cart Modal & Checkout
    document.getElementById('fab-cart').addEventListener('click', () => {
        document.getElementById('modal-cart').classList.remove('hidden');
    });
    
    document.getElementById('btn-checkout').addEventListener('click', checkout);

    // Date Picker Change
    document.getElementById('date-picker').addEventListener('change', (e) => {
        loadRekapData(e.target.value);
    });
}

// Helper: Toast
function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    t.classList.remove('opacity-0');
    setTimeout(() => t.classList.add('opacity-0'), 2000);
}