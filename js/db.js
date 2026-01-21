import { db } from './config.js';

export const dbController = {
    // 1. TAMBAH TRANSAKSI (Jualan)
    addTransaction: (data) => {
        // Return promise biar bisa di-await di app.js
        return db.ref('transaksi').push(data);
    },

    // 2. TAMBAH PENGELUARAN (Makan Owner/Beli Gas)
    addExpense: (data) => {
        return db.ref('pengeluaran').push(data);
    },

    // 3. DENGAR DATA TRANSAKSI (Real-time Listener)
    listenTransactions: (date, callback) => {
        // Callback akan dipanggil setiap ada data berubah
        return db.ref('transaksi')
            .orderByChild('tanggal')
            .equalTo(date)
            .on('value', callback);
    },

    // 4. DENGAR DATA PENGELUARAN (Real-time Listener)
    listenExpenses: (date, callback) => {
        return db.ref('pengeluaran')
            .orderByChild('tanggal')
            .equalTo(date)
            .on('value', callback);
    }
};