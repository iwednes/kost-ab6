# Kost AB6 — Frontend

Situs publik + panel pengelola Kost AB6. Frontend statis (HTML/CSS/JS vanilla + Tailwind CDN) yang di-host di **GitHub Pages**, dengan **Google Apps Script** sebagai REST API (JSON) dan Google Sheets/Drive sebagai database.

```
index.html        ← kerangka halaman (publik, login, admin)
css/style.css     ← CSS tambahan di atas Tailwind
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

GitHub Pages memperbarui situs dalam 1–2 menit. Jika masih tampil versi lama, tekan Ctrl+Shift+R. Versi yang aktif tercetak di konsol browser: `[Kost AB6] Frontend v2.0.0 siap`.

Panduan lengkap: [PANDUAN-INSTALASI.md](PANDUAN-INSTALASI.md).
