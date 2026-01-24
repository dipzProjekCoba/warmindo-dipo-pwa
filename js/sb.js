// js/sb.js
import { sbClient } from './config.js';

export const sbController = {
    // 1. AMBIL SEMUA MENU
    fetchMenu: async () => {
        const { data, error } = await sbClient
            .from('menu')
            .select('*')
            .order('nama', { ascending: true });
        
        if (error) {
            console.error("Error ambil menu:", error);
            alert("Gagal mengambil data menu. Cek koneksi internet!");
            return [];
        }
        return data;
    },

    // 2. KURANGI STOK (Saat Checkout)
    reduceStock: async (cartItems) => {
        // Kita update satu per satu (karena Supabase basic tidak bisa batch update kompleks tanpa RPC)
        // Untuk skala Warmindo ini sudah sangat cepat dan aman.
        for (const item of cartItems) {
            if (!item.lacak_stok) continue; // Skip item unlimited (Sayur/Snack)

            // Ambil stok terbaru dulu biar akurat
            const { data: currentItem } = await sbClient
                .from('menu')
                .select('stok')
                .eq('id', item.id)
                .single();

            if (currentItem) {
                const sisaBaru = currentItem.stok - item.qty;
                // Update ke database
                await sbClient
                    .from('menu')
                    .update({ stok: sisaBaru })
                    .eq('id', item.id);
            }
        }
    },

    // 3. TAMBAH STOK (Fitur Mode Gudang)
    addStock: async (id, stokTambahan) => {
        // Ambil stok lama
        const { data: currentItem, error: fetchError } = await sbClient
            .from('menu')
            .select('stok, nama')
            .eq('id', id)
            .single();

        if (fetchError || !currentItem) throw new Error("Item tidak ditemukan");

        const stokBaru = currentItem.stok + parseInt(stokTambahan);

        // Update
        const { error: updateError } = await sbClient
            .from('menu')
            .update({ stok: stokBaru })
            .eq('id', id);

        if (updateError) throw new Error(updateError.message);
        return stokBaru; // Balikin nilai stok baru
    }
};