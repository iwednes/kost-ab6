# Panduan Migrasi Kost AB6 — Backend ke Apps Script (API) & Frontend ke GitHub Pages

Sebelumnya seluruh situs (tampilan + data) disajikan oleh Apps Script lewat HtmlService. Setelah migrasi:

```
┌──────────────────────────────────────────────┐
│ FRONTEND — GitHub Pages                      │
│ https://USERNAME.github.io/kost-ab6/         │
│ index.html · css/style.css · js/*.js         │
│        │ fetch() — JSON                      │
└────────┼─────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────┐
│ BACKEND — Google Apps Script (REST API)      │
│ https://script.google.com/macros/s/…/exec    │
│ doGet  → data publik (Beranda, Kamar, dll.)  │
│ doPost → login, form testimoni, panel admin  │
│ Google Sheets (database) · Drive (foto)      │
└──────────────────────────────────────────────┘
```

Yang **tidak** berubah: spreadsheet, folder foto Drive, akun & kata sandi admin, Script Properties, dan seluruh tampilan/fitur situs.

## Isi paket

Semua berkas ada di `C:\Users\pc\OneDrive\Desktop\Desain Mixmax\Webset Kost AB6\migrasi-api\`:

| Berkas / folder | Untuk apa |
|---|---|
| `backend-gas\Kode.gs` | Disalin-tempel ke editor Apps Script (menggantikan Kode lama) |
| `backend-gas\appsscript.json` | Manifest Apps Script (isinya sama dengan versi lama) |
| `kost-ab6\` | **Folder repository GitHub** — folder inilah yang di-`git init` dan di-push |
| `kost-ab6.zip` | Salinan cadangan folder `kost-ab6\` (tidak perlu diekstrak jika folder di atas sudah ada) |
| `PANDUAN-INSTALASI.md` | Panduan ini |

> ⚠️ **Jangan pernah** menjalankan `git init` di folder `Webset Kost AB6` atau `migrasi-api`. Folder-folder itu berisi `note KOST.txt` (kata sandi sementara admin), PRD, dan berkas desain. Repository GitHub Pages bersifat **publik** — yang boleh di-push hanya isi folder `kost-ab6\`.

---

## Bagian A — Backend: perbarui proyek Apps Script

Gunakan **proyek Apps Script Kost AB6 yang sudah ada**, jangan membuat proyek baru, agar data, kata sandi admin, dan Script Properties tetap terpakai.

1. Buka **https://script.google.com** → proyek **Kost AB6**.
2. Buka file **Kode** → pilih semua (Ctrl+A) → hapus → tempel seluruh isi `backend-gas\Kode.gs` → **Ctrl+S**.
3. Hapus file **Index**, **Stylesheet**, dan **JavaScript** dari panel File (ikon ⋮ di samping nama file → **Hapus**). File itu sudah pindah ke GitHub Pages.
4. `appsscript.json` tidak perlu diubah.
5. Buat **deployment baru** khusus API:
   - **Terapkan** → **Deployment baru** → jenis **Aplikasi web**
   - Deskripsi: `Kost AB6 API v2.0.0`
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
   - **Terapkan** → salin **URL aplikasi web** (berakhiran `/exec`).

   > Kenapa deployment baru, bukan "Kelola deployment"? Deployment lama tetap memakai versi lama (situs HTML) sehingga situs lama masih hidup selama Anda menyiapkan GitHub Pages. Setelah situs baru berjalan, arsipkan deployment lama (Bagian D).

6. **Uji API** — tempel URL `/exec` di tab browser baru. Harus tampil teks JSON seperti:

   ```
   {"ok":true,"data":{"aplikasi":"Kost AB6","versi":"2.0.0","status":"API aktif"}}
   ```

   Lalu uji data publik dengan menambahkan `?action=ambilAwal` di akhir URL → harus tampil JSON panjang berisi data situs.

   Jika yang muncul halaman login Google atau halaman HTML, ulangi langkah 5 dan pastikan aksesnya **Siapa saja**.

---

## Bagian B — Frontend: deploy ke GitHub Pages

Istilah singkat: **repository (repo)** = folder proyek di GitHub · **commit** = menyimpan perubahan beserta catatannya · **push** = mengirim commit ke GitHub.

### B1. Isi alamat API (WAJIB sebelum push)

Buka `kost-ab6\js\config.js` dengan Notepad, ganti baris:

```js
const GAS_URL = 'https://script.google.com/macros/s/GANTI_DENGAN_ID_DEPLOYMENT/exec';
```

dengan URL `/exec` dari Bagian A langkah 5. Simpan.

### B2. Pasang Git (sekali saja)

Unduh dari **https://git-scm.com/download/win**, pasang dengan pengaturan bawaan. Buka **PowerShell**, lalu cek:

```bash
git --version
```

Hasil normal: `git version 2.x.x`.

### B3. Akun GitHub & identitas Git (sekali saja)

1. Daftar di **https://github.com** bila belum punya. Username akan menjadi bagian alamat situs (`USERNAME.github.io`).
2. Di PowerShell:

```bash
git config --global user.name "Nama Anda"
```

```bash
git config --global user.email "email-akun-github@contoh.com"
```

### B4. Buat repository di GitHub

github.com → tombol **+** → **New repository**:
- Repository name: `kost-ab6`
- **Public** (wajib untuk GitHub Pages gratis — aman, tidak ada rahasia di folder frontend)
- **Jangan** centang README, .gitignore, atau license
- **Create repository**. Biarkan halamannya terbuka.

### B5. Masuk ke folder yang BENAR & periksa isinya

```bash
cd "C:\Users\pc\OneDrive\Desktop\Desain Mixmax\Webset Kost AB6\migrasi-api\kost-ab6"
```

```bash
dir
```

Harus terlihat persis: `css`, `js`, `.nojekyll`, `index.html`, `PANDUAN-INSTALASI.md`, `README.md`. Jika yang terlihat malah `backend-gas` atau `kost-ab6`, Anda berada di folder yang salah — jangan lanjut.

### B6. Push pertama (jalankan satu per satu)

```bash
git init
```

```bash
git add .
```

(Ada **titik** di akhir. Tidak ada output = berhasil.)

```bash
git commit -m "Upload pertama"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/USERNAME/kost-ab6.git
```

(Ganti `USERNAME` dengan username GitHub Anda.)

```bash
git push -u origin main
```

Saat diminta login: jendela browser GitHub biasanya muncul → **Sign in with your browser** → izinkan. Jika diminta **Password** di terminal, yang diisi adalah **Personal Access Token**, bukan kata sandi akun GitHub:

1. Buka **https://github.com/settings/tokens** → **Generate new token (classic)**
2. Note: `git-push`, Expiration: `90 days`, centang **repo** → **Generate token**
3. Salin token (`ghp_…`, hanya tampil sekali) → tempel sebagai password (klik kanan di PowerShell). **Layar tetap kosong saat menempel — itu normal**, tekan Enter.

Tanda berhasil: `Writing objects: 100%` dan `* [new branch] main -> main`.

### B7. Aktifkan GitHub Pages

Di repo GitHub: **Settings** → **Pages**:

| Kolom | Nilai |
|---|---|
| Source | **Deploy from a branch** |
| Branch | **main** · **/ (root)** → **Save** |
| Enforce HTTPS | ✅ dicentang |

Tunggu 1–2 menit, muat ulang halaman Settings → muncul **"Your site is live at https://USERNAME.github.io/kost-ab6/"**.

---

## Bagian C — Uji situs baru

1. Buka `https://USERNAME.github.io/kost-ab6/` → Beranda, Kamar, Testimoni, Tentang Kami tampil berisi data.
2. Tekan **F12** → tab **Console** → harus ada `[Kost AB6] Frontend v2.1.0 siap` (atau versi lebih baru) dan **tidak ada** pesan merah.
3. Klik ikon 👤 → login dengan akun admin **yang sama seperti sebelumnya**. Login dari situs lama tidak ikut terbawa (beda domain), jadi wajib login ulang sekali.
4. Uji satu perubahan kecil di panel admin (misalnya ubah status satu kamar) → pastikan tersimpan di Spreadsheet.
5. Uji formulir testimoni publik (opsional) → cek email notifikasi.

### Tautan di email notifikasi testimoni

Email "Testimoni baru" berisi tautan ke panel admin. Atur sekali di Apps Script: **⚙️ Setelan Proyek** → **Properti skrip** → **Tambahkan properti skrip**:

| Properti | Nilai |
|---|---|
| `FRONTEND_URL` | `https://USERNAME.github.io/kost-ab6/` |

Simpan. Tidak perlu deploy ulang (properti dibaca langsung saat email dikirim).

---

## Bagian D — Setelah situs baru berjalan

1. **Arsipkan deployment lama**: Apps Script → **Terapkan** → **Kelola deployment** → pilih deployment lama (situs HTML) → **Arsipkan**. Deployment API v2.0.0 tetap aktif.
2. **Blogger** (bila dulu situs disematkan lewat iframe): ganti iframe dengan tautan ke `https://USERNAME.github.io/kost-ab6/`, atau hapus halamannya. Iframe lama akan kosong setelah deployment lama diarsipkan.

---

## Memperbarui di kemudian hari

**Frontend** (berkas di `kost-ab6\`) — dari folder `kost-ab6`:

```bash
git add .
```

```bash
git commit -m "Deskripsi perubahan"
```

```bash
git push
```

Situs diperbarui dalam 1–2 menit. Masih tampil versi lama → **Ctrl+Shift+R**.

> **Tampilan (Tailwind) sudah dikompilasi** ke `css/tailwind.css`, tidak lagi dirakit di browser (lebih cepat). Jika kelak menambah kelas Tailwind baru di `index.html` atau `js/app.js`, bangkitkan ulang berkas itu dengan alat di `migrasi-api\alat-dev\` (lihat `BACA-SAYA.md` di sana) sebelum `git push`.

**Backend** (`Kode.gs`) — setelah mengubah kode: **Terapkan** → **Kelola deployment** → pilih deployment **API v2.0.0** → ✏️ → **Versi: Versi baru** → **Terapkan**. URL `/exec` tetap sama, `js/config.js` tidak perlu diubah.

> Jangan membuat "Deployment baru" untuk pembaruan rutin — itu menghasilkan URL `/exec` baru yang harus disalin lagi ke `js/config.js`.

---

## Instal dari nol (proyek Apps Script baru)

Jika belum pernah memasang Kost AB6 sama sekali:

1. https://script.google.com → **Proyek baru** → beri nama **Kost AB6**.
2. ⚙️ **Setelan Proyek** → centang **Tampilkan file manifes "appsscript.json"** → tempel isi `backend-gas\appsscript.json`.
3. Ganti nama `Code.gs` menjadi **Kode** → tempel isi `backend-gas\Kode.gs` → Ctrl+S.
4. Pilih fungsi **setupAwal** → ▶ **Jalankan** → izinkan akses. Catat **kata sandi sementara** dari Log eksekusi (hanya muncul sekali).
5. (Opsional) Jalankan **isiDataContoh** untuk data contoh tanpa foto.
6. Lanjutkan ke Bagian A langkah 5, lalu Bagian B.

`setupAwal`, `resetSandiAdmin`, dan `isiDataContoh` hanya bisa dijalankan dari editor — tidak bisa dipanggil lewat API.

---

## Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| Situs tampil "Gagal memuat data", Console: `GAS_URL di js/config.js belum diisi` | `js/config.js` belum diisi. Isi URL `/exec`, lalu `git add .` → `git commit -m "isi GAS_URL"` → `git push`. |
| Console: `Failed to fetch` / pesan merah berisi `CORS` | Deployment tidak diatur akses **Siapa saja**, atau URL yang dipakai berakhiran `/dev` (bukan `/exec`). Perbaiki di Bagian A langkah 5. |
| Console: `respons bukan JSON` berisi `Script function not found: doPost` | Deployment masih memakai versi lama. Pastikan `Kode.gs` baru sudah disimpan dan deployment API dibuat/diperbarui ke **Versi baru**. |
| Halaman 404 di GitHub Pages | `index.html` tidak berada di root repo. Buka repo di github.com: yang terlihat di paling atas harus `css`, `js`, `index.html` — bukan folder `kost-ab6` atau `backend-gas`. Ulangi push dari folder yang benar (B5). |
| Halaman tampil tanpa warna/tata letak | Folder `css/` atau `js/` tidak ikut. Pastikan push lewat terminal (bukan "Upload files" di web GitHub). |
| `Password authentication is not supported` | GitHub menolak kata sandi akun. Pakai Personal Access Token (B6). |
| `remote origin already exists` | Langkah `git remote add` sudah pernah dijalankan. Lewati, lanjut `git push -u origin main`. |
| `error: src refspec main does not match any` | Belum ada commit. Jalankan `git add .` lalu `git commit -m "Upload pertama"`. |
| `LF will be replaced by CRLF` | Hanya peringatan, abaikan. |
| Admin otomatis keluar ("Sesi berakhir") | Sesi kedaluwarsa (8 jam, atau 7 hari bila "Ingat saya") atau sandi baru diganti. Login ulang. |
| Data di situs belum berubah setelah edit langsung di Spreadsheet | Cache server hingga 6 jam. Panel admin → **Pengaturan → Bersihkan Cache & Sinkronkan Data**. |
| Foto tidak tampil | Akun Google Workspace (domain kantor/sekolah) bisa melarang berbagi "siapa saja yang memiliki link". Gunakan Gmail pribadi atau minta admin domain mengizinkan. |

## Keamanan

- Repository GitHub bersifat publik dan hanya berisi tampilan + URL `/exec` (memang publik). Tidak ada kata sandi, token, atau ID spreadsheet di dalamnya.
- Hash kata sandi admin, kunci sesi, dan ID folder/spreadsheet tetap di **Script Properties** Apps Script.
- API hanya menjalankan aksi yang terdaftar di `aksiApi_()` dalam `Kode.gs`. Token admin selalu dikirim di body permintaan, tidak pernah di URL.
