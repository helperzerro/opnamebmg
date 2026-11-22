# Stock Opname

## Deploy ke Vercel
1. Push folder ini ke GitHub, lalu import di Vercel (preset Vite terdeteksi otomatis).
2. Di Vercel: Settings > Environment Variables, tambahkan:
   - APP_PASSWORD : password untuk masuk
   - AUTH_SECRET  : teks acak panjang (untuk menandatangani sesi)
3. Deploy (atau Redeploy setelah menambah variabel).

Sesi login berlaku 1 jam, setelah itu password diminta lagi.

## Jalankan lokal
Login memakai folder /api, jadi gunakan Vercel CLI:
    npm install
    npx vercel dev
(Buat file .env dari .env.example untuk lokal.) `npm run dev` biasa tidak menjalankan /api.
