'use strict';
/**
 * ============================================================
 * KOST AB6 — Jembatan server (js/api.js)
 * Semua panggilan ke GAS REST API lewat panggil(nama, ...args).
 * Kontraknya sama dengan versi google.script.run lama, sehingga app.js
 * tidak perlu diubah: resolve(data) bila { ok:true }, reject(Error) berisi
 * kode/pesan/detail bila gagal. Sesi habis ditangani terpusat di sini.
 *
 *  - Aksi baca-saja publik → GET ?action=…&args=[…] (tanpa token)
 *  - Aksi lain → POST, Content-Type text/plain berisi JSON
 *    (text/plain = "simple request" → tanpa CORS preflight yang ditolak GAS;
 *    token admin ikut di body, tidak pernah di URL)
 * ============================================================
 */

/** Harus sama dengan AKSI_GET di Kode.gs */
const AKSI_GET = ['ambilAwal', 'ambilPrefetch', 'ambilKegiatan', 'ambilTestimoni', 'ambilDetailKamar'];

function buatGalat(kode, pesan, detail) {
  const e = new Error(pesan || 'Terjadi kesalahan.');
  e.kode = kode;
  e.detail = detail || null;
  return e;
}

/** GAS_URL (js/config.js) sudah diisi URL /exec yang benar? */
function urlApiSiap() {
  return typeof GAS_URL === 'string' && GAS_URL.indexOf('GANTI_') < 0 &&
    /^https:\/{2}script\.google\.com\/.+\/exec$/.test(GAS_URL.trim());
}

/** Semua panggilan server lewat sini. */
async function panggil(nama, ...args) {
  if (!urlApiSiap()) {
    console.error('[Kost AB6] GAS_URL di js/config.js belum diisi URL /exec Apps Script.');
    throw buatGalat('KONFIG', 'Situs belum tersambung ke server. Pengelola perlu mengisi alamat API di js/config.js.');
  }
  const url = GAS_URL.trim();
  let teks;
  try {
    const r = AKSI_GET.indexOf(nama) >= 0
      ? await fetch(url + '?action=' + encodeURIComponent(nama) + '&args=' + encodeURIComponent(JSON.stringify(args)))
      : await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: nama, args: args }),
        // Statistik banner dikirim saat tab disembunyikan → tetap terkirim walau halaman ditutup
        keepalive: nama === 'catatStatistikBanner'
      });
    teks = await r.text();
  } catch (err) {
    // Biasanya internet putus, atau Web App tidak di-deploy dengan akses "Siapa saja"
    // (Google mengalihkan ke halaman login tanpa header CORS → fetch gagal).
    console.warn('[Kost AB6] ' + nama + ' gagal terhubung:', err);
    throw buatGalat('JARINGAN', 'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.', { teknis: String((err && err.message) || err) });
  }
  let res;
  try {
    res = JSON.parse(teks);
  } catch (e) {
    // GAS membalas HTML (mis. "Script function not found: doPost") → kode/deployment belum diperbarui
    console.warn('[Kost AB6] ' + nama + ' respons bukan JSON:', teks.slice(0, 300));
    throw buatGalat('GALAT', 'Respons server tidak valid. Muat ulang halaman.', { teknis: teks.slice(0, 300) });
  }
  if (res && res.ok) return res.data;
  if (res && res.kode) {
    if (res.kode === 'SESI_HABIS' && typeof sesiHabis === 'function') sesiHabis();
    throw buatGalat(res.kode, res.pesan, res.detail);
  }
  throw buatGalat('GALAT', 'Respons server tidak valid. Muat ulang halaman.');
}

/**
 * Data halaman pertama (ambilAwal) diminta sedini mungkin, sebelum app.js
 * (±400 KB) selesai diunduh & dijalankan. muatPublik() memakainya sekali;
 * "Coba Lagi" setelahnya selalu membuat permintaan baru.
 */
let awalDini = urlApiSiap() ? panggil('ambilAwal') : null;
if (awalDini) awalDini.catch(() => { /* galat ditangani di muatPublik() */ });

function ambilAwalDini() {
  const p = awalDini || panggil('ambilAwal');
  awalDini = null;
  return p;
}
