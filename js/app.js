// js/app.js
import { dbController } from './db.js'; 
import { initAuth } from './auth.js';
import { sbController } from './sb.js';

// --- STATE VARIABLES ---
let cart = [];
let menuList = []; // Menu sekarang diambil dari Supabase
let selectedTempItem = null;
let modeGudang = false; // False = Kasir, True = Update Stok

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    initAuth();
    setupEventListeners();
    injectGudangButton(); // Pasang tombol rahasia

    // Load data awal
    await refreshMenuData();

    // Set tanggal hari ini
    const today = new Date().toISOString().slice(0, 10);
    const datePicker = document.getElementById('date-picker');
    if(datePicker) {
        datePicker.value = today;
        loadRekapData(today);
    }
});

// --- FUNGSI DATA ---
async function refreshMenuData() {
    // Tampilkan loading kalau perlu, atau biarkan background process
    const data = await sbController.fetchMenu();
    if (data && data.length > 0) {
        menuList = data;
        renderMenu('all'); // Render ulang tampilan
    }
}

// --- RENDER UI ---
function renderMenu(category) {
    const grid = document.getElementById('menu-grid');
    if(!grid) return;
    grid.innerHTML = '';

    // Filter kategori
    const items = category === 'all' 
        ? menuList 
        : menuList.filter(item => item.kategori === category);

    items.forEach(item => {
        // Logic Tampilan Stok
        const isHabis = item.lacak_stok && item.stok <= 0;
        const stokText = item.lacak_stok ? `Sisa: ${item.stok}` : '';
        const stokColor = item.stok < 5 && item.lacak_stok ? 'text-red-500' : 'text-gray-400';
        
        // Warna kartu (Abu-abu kalau habis di mode kasir)
        // Di mode Gudang, tetap nyala biar bisa diisi stoknya
        const cardBg = (isHabis && !modeGudang) ? 'bg-gray-100 opacity-60 grayscale' : 'bg-white';
        const cursor = (isHabis && !modeGudang) ? 'cursor-not-allowed' : 'cursor-pointer active:bg-orange-50';

        const div = document.createElement('div');
        div.className = `menu-card ${cardBg} p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-36 transition relative overflow-hidden ${cursor}`;
        
        // Logic Klik: Beda aksi tergantung Mode
        div.onclick = () => handleItemClick(item);

        // Icon tombol (Plus atau Edit)
        const actionIcon = modeGudang ? '<i class="fas fa-edit"></i>' : '<i class="fas fa-plus"></i>';
        const actionColor = modeGudang ? 'text-blue-600 bg-blue-50' : (isHabis ? 'text-gray-300 bg-gray-200' : 'text-orange-500 bg-gray-50');

        div.innerHTML = `
            <div>
                <div class="flex justify-between items-start">
                    <span class="text-[10px] font-bold text-orange-500 uppercase tracking-wide bg-orange-100 px-2 py-0.5 rounded-md">${item.kategori}</span>
                    <span class="text-[10px] font-bold ${stokColor}">${stokText}</span>
                </div>
                <h3 class="font-bold text-gray-800 leading-tight mt-2 line-clamp-2">${item.nama}</h3>
            </div>
            <div class="flex justify-between items-end">
                <p class="font-bold text-gray-600">Rp ${item.harga.toLocaleString()}</p>
                <div class="${actionColor} rounded-full w-8 h-8 flex items-center justify-center text-xs shadow-sm">
                    ${actionIcon}
                </div>
            </div>
        `;
        grid.appendChild(div);
    });
}

// --- LOGIC INTERAKSI ---
function handleItemClick(item) {
    // 1. MODE GUDANG (UPDATE STOK)
    if (modeGudang) {
        handleUpdateStok(item);
        return;
    }

    // 2. MODE KASIR (JUALAN)
    if (item.lacak_stok && item.stok <= 0) {
        showToast("❌ Stok Habis Bos!");
        return;
    }
    
    // Cek apakah varian minuman
    if (item.kategori === 'nonkopi') {
        selectedTempItem = item;
        document.getElementById('variant-item-name').innerText = item.nama;
        document.getElementById('modal-variant').classList.remove('hidden');
    } else {
        let variant = '-';
        if (item.kategori === 'kopi') variant = 'Panas';
        addItemToCart(item, variant);
    }
}

// --- LOGIC GUDANG (BARU) ---
async function handleUpdateStok(item) {
    if (!item.lacak_stok) {
        alert("Menu ini unlimited, tidak perlu atur stok.");
        return;
    }

    const input = prompt(`UPDATE STOK: ${item.nama}\n\nStok Sekarang: ${item.stok}\n\nMasukkan JUMLAH TAMBAHAN (Misal habis belanja 10 bungkus, ketik 10):`);
    
    if (input && !isNaN(input)) {
        try {
            const tambah = parseInt(input);
            const stokBaru = await sbController.addStock(item.id, tambah);
            alert(`✅ Berhasil! Stok ${item.nama} sekarang: ${stokBaru}`);
            // Refresh data lokal
            await refreshMenuData();
        } catch (e) {
            alert("Gagal update: " + e.message);
        }
    }
}

// --- LOGIC KERANJANG & CHECKOUT ---
function addItemToCart(item, variant) {
    // Cek stok lokal di keranjang (biar gak minus pas diklik berkali-kali)
    const existingQty = cart
        .filter(c => c.id === item.id)
        .reduce((sum, c) => sum + c.qty, 0);

    if (item.lacak_stok && (existingQty + 1) > item.stok) {
        showToast("✋ Stok tidak cukup!");
        return;
    }

    const existing = cart.find(c => c.id === item.id && c.variant === variant);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ ...item, qty: 1, variant: variant });
    }
    updateCartUI();
    showToast(`${item.nama} masuk keranjang`);
}

function updateCartUI() {
    const count = cart.reduce((acc, item) => acc + item.qty, 0);
    const total = cart.reduce((acc, item) => acc + (item.harga * item.qty), 0);
    
    const badge = document.getElementById('cart-count');
    if(badge) {
        badge.innerText = count;
        badge.classList.toggle('hidden', count === 0);
    }

    const list = document.getElementById('cart-items');
    if(list) {
        list.innerHTML = cart.map((item, index) => `
            <div class="flex justify-between items-center mb-3 border-b border-gray-100 pb-2 last:border-0">
                <div>
                    <p class="font-bold text-gray-800 text-sm">${item.nama} <span class="text-orange-600 text-xs">${item.variant !== '-' ? `(${item.variant})` : ''}</span></p>
                    <p class="text-xs text-gray-500">Rp ${item.harga.toLocaleString()} x ${item.qty}</p>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="window.updateQty(${index}, -1)" class="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold">-</button>
                    <span class="font-bold w-4 text-center text-sm">${item.qty}</span>
                    <button onclick="window.updateQty(${index}, 1)" class="w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-bold">+</button>
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

window.updateQty = (index, change) => {
    // Validasi stok saat nambah qty di cart modal
    if (change > 0) {
        const item = cart[index];
        const totalInCart = cart.filter(c => c.id === item.id).reduce((sum, c) => sum + c.qty, 0);
        const stockData = menuList.find(m => m.id === item.id);
        
        if (stockData && stockData.lacak_stok && (totalInCart + 1) > stockData.stok) {
            showToast("✋ Stok mentok bos!");
            return;
        }
    }

    cart[index].qty += change;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    updateCartUI();
};

async function checkout() {
    if (cart.length === 0) return alert("Keranjang kosong!");
    
    const btn = document.getElementById('btn-checkout');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerText = "Memproses...";

    try {
        // 1. KURANGI STOK DI SUPABASE
        await sbController.reduceStock(cart);

        // 2. SIMPAN TRANSAKSI DI FIREBASE (Laporan)
        const dateInput = document.getElementById('date-picker').value;
        const total = cart.reduce((acc, item) => acc + (item.harga * item.qty), 0);
        const detailString = cart.map(i => `${i.nama} ${i.variant!='-'?`(${i.variant})`:''} (${i.qty})`).join(', ');

        const transaction = {
            tanggal: dateInput,
            waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            tipe: 'PENJUALAN',
            detail: detailString,
            total: total,
            created_at: firebase.database.ServerValue.TIMESTAMP 
        };

        await dbController.addTransaction(transaction);
        
        // 3. SUKSES & RESET
        cart = [];
        updateCartUI();
        document.getElementById('modal-cart').classList.add('hidden');
        showToast("✅ Transaksi Sukses!");
        
        // Refresh Stok di tampilan agar update
        await refreshMenuData();
        
    } catch (error) {
        console.error(error);
        alert("Gagal transaksi: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- FITUR TAMBAHAN ---
// Inject Tombol Mode Gudang di Header
function injectGudangButton() {
    const headerDiv = document.querySelector('header > div:first-child');
    if (!headerDiv) return;

    // Buat tombol kecil di samping nama "Warmindo Dipo"
    const btnMode = document.createElement('button');
    btnMode.innerHTML = '<i class="fas fa-boxes"></i>';
    btnMode.className = "ml-2 w-8 h-8 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition";
    btnMode.title = "Mode Gudang (Cek Stok)";
    
    btnMode.onclick = () => {
        modeGudang = !modeGudang;
        if (modeGudang) {
            btnMode.className = "ml-2 w-8 h-8 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shadow-lg ring-2 ring-blue-200";
            showToast("🔧 MODE GUDANG AKTIF: Klik menu untuk tambah stok");
            document.body.style.borderTop = "4px solid #2563eb"; // Indikator Visual Biru
        } else {
            btnMode.className = "ml-2 w-8 h-8 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center hover:bg-blue-100 transition";
            showToast("🛒 KEMBALI KE MODE KASIR");
            document.body.style.borderTop = "none";
        }
        renderMenu(document.querySelector('.tab-btn.active').dataset.cat);
    };

    // Sisipkan setelah teks tanggal/status
    headerDiv.appendChild(btnMode);
}

// Global functions
window.handleUangMakan = async function() {
    if(!confirm("Yakin input jatah makan (-10rb)?")) return;
    const dateInput = document.getElementById('date-picker').value;
    try {
        await dbController.addExpense({
            tanggal: dateInput,
            waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            tipe: 'MAKAN_OWNER',
            detail: 'Jatah Makan Harian',
            total: 10000,
            created_at: firebase.database.ServerValue.TIMESTAMP
        });
        showToast("🍽️ Makan tercatat!");
    } catch (e) { alert("Error: " + e.message); }
}

// Setup Event Listeners
function setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderMenu(e.target.dataset.cat);
        });
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            document.querySelectorAll('.nav-btn').forEach(b => {
                b.classList.remove('active', 'text-orange-600');
                b.classList.add('text-gray-400');
            });
            e.currentTarget.classList.add('active', 'text-orange-600');
            e.currentTarget.classList.remove('text-gray-400');

            if(target === 'kasir') {
                document.getElementById('main-content').classList.remove('hidden');
                document.getElementById('rekap-view').classList.add('hidden');
            } else {
                document.getElementById('main-content').classList.add('hidden');
                document.getElementById('rekap-view').classList.remove('hidden');
                loadRekapData(document.getElementById('date-picker').value); 
            }
        });
    });

    document.querySelectorAll('.btn-variant').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const variant = e.currentTarget.dataset.var;
            if(selectedTempItem) {
                addItemToCart(selectedTempItem, variant);
                selectedTempItem = null;
            }
            document.getElementById('modal-variant').classList.add('hidden');
        });
    });

    const fabCart = document.getElementById('fab-cart');
    if(fabCart) fabCart.addEventListener('click', () => document.getElementById('modal-cart').classList.remove('hidden'));
    
    const btnCheckout = document.getElementById('btn-checkout');
    if(btnCheckout) btnCheckout.addEventListener('click', checkout);

    const datePicker = document.getElementById('date-picker');
    if(datePicker) {
        datePicker.addEventListener('change', (e) => {
            loadRekapData(e.target.value);
            showToast(`📅 Data tanggal ${e.target.value} dimuat`);
        });
    }
}

// Helper: Toast
function showToast(msg) {
    const t = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    if(t && msgEl) {
        msgEl.innerText = msg;
        t.classList.remove('opacity-0');
        clearTimeout(window.toastTimer);
        window.toastTimer = setTimeout(() => t.classList.add('opacity-0'), 2000);
    }
}

// Helper: Rekap (Firebase Logic - disalin dari kode lama, disederhanakan panggilannya)
function loadRekapData(date) {
    document.getElementById('stat-omset').innerText = 'Loading...';
    document.getElementById('stat-expense').innerText = 'Loading...';
    document.getElementById('history-list').innerHTML = '<p class="p-4 text-center text-xs text-gray-400">Memuat data...</p>';

    dbController.listenTransactions(date, (snapshot) => {
        let omset = 0;
        let html = '';
        const data = [];
        snapshot.forEach(child => data.unshift(child.val()));
        
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

    dbController.listenExpenses(date, (snapshot) => {
        let expense = 0;
        snapshot.forEach(child => expense += child.val().total);
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
    const el = document.getElementById('stat-net');
    el.innerText = `Rp ${net.toLocaleString()}`;
    if(net < 0) {
        el.classList.remove('text-blue-800');
        el.classList.add('text-red-600');
    } else {
        el.classList.add('text-blue-800');
        el.classList.remove('text-red-600');
    }
}