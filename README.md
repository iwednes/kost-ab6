# Kost AB6 — Frontend

Situs publik + panel pengelola Kost AB6. Frontend statis (HTML/CSS/JS vanilla + Tailwind yang sudah dikompilasi) yang di-host di **GitHub Pages**, dengan **Google Apps Script** sebagai REST API (JSON) dan Google Sheets/Drive sebagai database.

```
index.html        ← kerangka halaman (publik, login, admin) + data usaha untuk Google
vercel.json       ← alamat /kamar, /kamar/tipe-a, /testimoni, /tentang-kami dibuka oleh index.html
robots.txt        ← izin baca untuk mesin pencari + letak sitemap
sitemap.xml       ← daftar halaman untuk Google
css/style.css     ← CSS tambahan di atas Tailwind
css/tailwind.css  ← Tailwind v3.4.16 hasil kompilasi (JANGAN diedit manual)
css/situs.css     ← tampilan seluruh halaman publik (mengikuti website Mixmax Souvenir)
css/admin.css     ← tampilan login dan panel admin
js/config.js      ← GAS_URL (URL /exec Apps Script) — satu-satunya yang perlu diubah
js/api.js         ← panggil(): fetch ke GAS (GET untuk data publik, POST text/plain untuk lainnya)
js/app.js         ← seluruh logika SPA
js/gerak-situs.js ← animasi situs: header, menu samping, gulir halus, kemunculan isi
js/video-banner.js ← video banner 5 detik: unggah di admin dan pemutaran di Beranda
js/latar3d.js     ← objek 3D di belakang semua halaman
js/bentuk3d.js    ← bentuk dan shader partikel objek 3D
js/kunang.js      ← kunang-kunang di semua halaman, termasuk menu admin
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

GitHub Pages memperbarui situs dalam 1–2 menit. Jika masih tampil versi lama, tekan Ctrl+Shift+R. Versi yang aktif tercetak di konsol browser: `[Kost AB6] Frontend v3.5.1 siap`.

## Tailwind

`css/tailwind.css` berisi semua kelas Tailwind yang tertulis di `index.html` dan `js/app.js`, dikompilasi dengan konfigurasi token desain proyek. Ini menggantikan Tailwind Play CDN, yang mengunduh compiler ±450 KB dan merakit CSS di browser setiap kali halaman berganti. Bila menambah kelas Tailwind baru, bangkitkan ulang berkas ini dengan `migrasi-api/alat-dev/buat-tailwind.html` (di luar repository ini).

Panduan lengkap: [PANDUAN-INSTALASI.md](PANDUAN-INSTALASI.md).

## Video banner

Video banner butuh `Kode.gs` v3.1.0 atau lebih baru (tempel ke Apps Script, lalu Deploy → Manage deployments → New version). Di panel admin: Konten → Banner → ubah banner → Video Banner. Video maksimal 5 detik, otomatis dikecilkan ke 1080p tanpa suara, dan cuplikannya menjadi gambar sampul. ID video tersimpan di Script Properties (`VIDEO_BANNER`), jadi sheet Banner tidak berubah. Untuk memeriksa pemutaran dari HP, buka situs dengan `/?cekvideo`.
