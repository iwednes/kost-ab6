# Kost AB6 — Frontend

Situs publik + panel pengelola Kost AB6. Frontend statis (HTML/CSS/JS vanilla + Tailwind yang sudah dikompilasi) yang di-host di **GitHub Pages**, dengan **Google Apps Script** sebagai REST API (JSON) dan Google Sheets/Drive sebagai database.

```
index.html        ← kerangka halaman (publik, login, admin)
css/style.css     ← CSS tambahan di atas Tailwind
css/tailwind.css  ← Tailwind v3.4.16 hasil kompilasi (JANGAN diedit manual)
js/config.js      ← GAS_URL (URL /exec Apps Script) — satu-satunya yang perlu diubah
js/api.js         ← panggil(): fetch ke GAS (GET untuk data publik, POST text/plain untuk lainnya)
js/app.js         ← seluruh logika SPA
.nojekyll         ← matikan pemrosesan Jekyll di GitHub Pages
```

## Konfigurasi

Isi `GAS_URL` di `js/config.js` dengan URL Web App Apps Script (berakhiran `/exec`). URL ini publik, bukan rahasia. Semua rahasia (hash sandi, kunci sesi, ID spreadsheet/folder) tersimpan di Script Properties Apps Script, tidak di repository ini.

## Memperbarui situs

```bash
git add .
git commit -m "Deskripsi perubahan"
git push
```

GitHub Pages memperbarui situs dalam 1–2 menit. Jika masih tampil versi lama, tekan Ctrl+Shift+R. Versi yang aktif tercetak di konsol browser: `[Kost AB6] Frontend v3.2.1 siap`.

## Tailwind

`css/tailwind.css` berisi semua kelas Tailwind yang tertulis di `index.html` dan `js/app.js`, dikompilasi dengan konfigurasi token desain proyek. Ini menggantikan Tailwind Play CDN, yang mengunduh compiler ±450 KB dan merakit CSS di browser setiap kali halaman berganti. Bila menambah kelas Tailwind baru, bangkitkan ulang berkas ini dengan `migrasi-api/alat-dev/buat-tailwind.html` (di luar repository ini).

Panduan lengkap: [PANDUAN-INSTALASI.md](PANDUAN-INSTALASI.md).
