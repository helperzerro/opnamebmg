# Stock Opname

Data disimpan sebagai satu file `stok.json` di Vercel Blob, jadi sama di semua perangkat.

## Deploy ke Vercel
1. Push folder ini ke GitHub, lalu import di Vercel (preset Vite terdeteksi otomatis).
2. Settings > Environment Variables, tambahkan:
   - APP_PASSWORD : password untuk masuk
   - AUTH_SECRET  : teks acak panjang
3. Storage > Create Storage > Blob > Continue > pilih akses **Private**,
   lalu sambungkan ke proyek ini (BLOB_READ_WRITE_TOKEN terisi otomatis).
4. Redeploy.

Sesi login berlaku 1 jam, setelah itu password diminta lagi.

## Cadangan
Tombol "Simpan ke file" mengunduh data sebagai .json,
"Buka dari file" menggabungkan file itu ke data yang ada (lalu ikut tersimpan ke server).

## Jalankan lokal
    npm install
    npx vercel dev
(isi .env dari .env.example; jalankan `vercel env pull` untuk mengambil BLOB_READ_WRITE_TOKEN)
