'use strict';
/**
 * ============================================================
 * KOST AB6 — Frontend (js/app.js)
 * SPA statis (GitHub Pages): semua halaman dirender di browser, URL tidak
 * pernah berubah, data lewat fetch() ke GAS REST API (lihat js/api.js).
 * Prinsip UX instan:
 *  1. Navigasi tampil/sembunyi section (0 ms)
 *  2. Data publik disimpan di localStorage → tampil seketika, diperbarui diam-diam
 *  3. Server memakai CacheService
 *  4. Satu panggilan untuk banyak data (ambilAwal, ambilPrefetch, adminMuat)
 *
 * Urutan muat di index.html: config.js → api.js → app.js.
 * Catatan: penulisan URL/regex tanpa garis miring ganda di berkas ini adalah
 * warisan versi HtmlService (bug pemangkas komentar GAS); tidak lagi wajib,
 * tetapi dibiarkan apa adanya karena tetap valid.
 * ============================================================
 */

// ════════════════════════════════════════════════════════════
// BAGIAN 1: KONSTANTA & STATE
// ════════════════════════════════════════════════════════════

const KONST = {
  LANTAI: {
    1: 'Lantai 1 - Akses Ramah & Dekat Lobi',
    2: 'Lantai 2 - Tenang & Pencahayaan Alami',
    3: 'Lantai 3 - View Atap & Balkon Terbuka'
  },
  KASUR: {
    'single-120': { label: 'Single Bed (120 x 200 cm)', ringkas: 'Kasur Single (120x200)', spek: 'Single Bed (120x200)', tabel: 'Kasur Single (120x200 cm)', ukuran: '120x200', jenis: 'single' },
    'queen-160': { label: 'Queen Bed (160 x 200 cm)', ringkas: 'Kasur Queen (160x200)', spek: 'Queen Bed (160x200)', tabel: 'Kasur Queen (160x200 cm)', ukuran: '160x200', jenis: 'queen' },
    'single-90': { label: 'Single Compact (90 x 200 cm)', ringkas: 'Kasur Single (90x200)', spek: 'Single Compact (90x200)', tabel: 'Kasur Single (90x200 cm)', ukuran: '90x200', jenis: 'single' }
  },
  SIRKULASI: {
    taman: { label: 'Jendela Hadap Taman Tropis', ringkas: 'Jendela Hadap Taman' },
    koridor: { label: 'Jendela Hadap Koridor Dalam', ringkas: 'Jendela Hadap Koridor' },
    balkon: { label: 'Pintu Kaca Menuju Balkon Pribadi', ringkas: 'Balkon Pribadi' }
  },
  IKON: ['verified', 'wifi', 'shield', 'lock', 'cleaning_services', 'restaurant', 'weekend', 'local_cafe', 'soup_kitchen',
    'kitchen', 'local_parking', 'videocam', 'local_laundry_service', 'water_drop', 'receipt_long', 'home_work',
    'photo_camera', 'school', 'storefront', 'local_hospital', 'local_convenience_store'],
  BULAN: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'],
  BULAN_PANJANG: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  HARI: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
  KUNCI_PUBLIK: 'kab6_publik_v1',
  KUNCI_TOKEN: 'kab6_token',
  KUNCI_PERANGKAT: 'kab6_perangkat',
  JUDUL: {
    beranda: 'Beranda', kamar: 'Katalog Kamar', detail: 'Detail Kamar', testimoni: 'Testimoni', tentang: 'Tentang Kami',
    '404': 'Halaman Tidak Ditemukan', login: 'Login Pengelola', 'admin-dashboard': 'Dashboard', 'admin-konten': 'Kelola Konten',
    'admin-kamar': 'Kelola Kamar', 'admin-kamar-form': 'Form Kamar', 'admin-testimoni': 'Kelola Testimoni',
    'admin-laporan': 'Laporan & Ekspor', 'admin-pengaturan': 'Pengaturan Situs'
  }
};

/** State aplikasi — di memori JavaScript, BUKAN di URL */
const S = {
  umum: null, beranda: null, kamar: null, testimoni: null, tentang: null,
  json: {},
  kegiatan: { items: [], adaLagi: false, halaman: 1, memuat: false },
  testiDaftar: { items: [], adaLagi: false, halaman: 1, jumlah: 0, memuat: false },
  rute: { nama: '', param: {} },
  katalog: { filter: 'semua', halaman: 1 },
  stat: { tayang: {}, klik: {} },
  sesi: null,
  kotor: false,
  adm: { data: null, waktuMuat: 0, memuat: null }
};

const AKSI = {};      // klik [data-aksi]
const MASUKAN = {};   // input [data-masukan]
const UBAH = {};      // change [data-ubah]
const KIRIM = {};     // submit form[data-kirim]
const RENDER = {};    // nama rute → fungsi render

// ════════════════════════════════════════════════════════════
// BAGIAN 2: UTILITAS
// ════════════════════════════════════════════════════════════

const $ = (sel, akar) => (akar || document).querySelector(sel);
const $$ = (sel, akar) => Array.from((akar || document).querySelectorAll(sel));

/**
 * Escape HTML — WAJIB untuk semua teks dari pengguna/server (anti-XSS).
 * Kutip ditulis \u0022 / \u0027: pemangkas komentar GAS di file .html salah
 * membaca kutip mentah di dalam regex (lihat catatan di kepala berkas).
 */
const ENTITAS_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\u0022': '&quot;', '\u0027': '&#39;' };
function esc(v) {
  return String(v === null || v === undefined ? '' : v).replace(/[&<>\u0022\u0027]/g, c => ENTITAS_HTML[c]);
}

function ikon(nama, kelas, isi) {
  return `<span class="material-symbols-outlined ${kelas || ''}${isi ? ' ikon-isi' : ''}" aria-hidden="true">${esc(nama)}</span>`;
}

const FORMAT_ANGKA = new Intl.NumberFormat('id-ID');
function rupiah(n) { return 'Rp ' + FORMAT_ANGKA.format(Math.round(Number(n) || 0)); }
function angka(n) { return FORMAT_ANGKA.format(Math.round(Number(n) || 0)); }
function desimal(n, d) { return (Number(n) || 0).toFixed(d === undefined ? 1 : d).replace('.', ','); }
function persen(bagian, total, d) {
  if (!total) return 0;
  const f = Math.pow(10, d === undefined ? 1 : d);
  return Math.round(bagian / total * 100 * f) / f;
}
function teksPersen(nilai) { return String(nilai).replace(/\.0$/, '') + '%'; }

/** Teks ISO / 'yyyy-MM-dd' → Date */
function keTanggal(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T12:00:00+07:00');
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

/** Bagian tanggal menurut zona Asia/Jakarta (WIB), di mana pun pengunjung berada */
const FORMAT_JKT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
});
const HARI_EN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function bagianJkt(v) {
  const d = keTanggal(v);
  if (!d) return null;
  const p = {};
  FORMAT_JKT.formatToParts(d).forEach(x => { p[x.type] = x.value; });
  return {
    y: Number(p.year), m: Number(p.month), d: Number(p.day),
    hh: p.hour === '24' ? '00' : p.hour, mi: p.minute, dow: HARI_EN[p.weekday] || 0
  };
}

/** mode: pendek (29 Okt 2026) | panjang (12 Oktober 2026) | hari | jam | pendekJam | bulanTahun */
function fTgl(v, mode) {
  const b = bagianJkt(v);
  if (!b) return '-';
  switch (mode) {
    case 'panjang': return `${b.d} ${KONST.BULAN_PANJANG[b.m - 1]} ${b.y}`;
    case 'hari': return `${KONST.HARI[b.dow]}, ${b.d} ${KONST.BULAN_PANJANG[b.m - 1]} ${b.y}`;
    case 'jam': return `${b.hh}:${b.mi} WIB`;
    case 'pendekJam': return `${b.d} ${KONST.BULAN[b.m - 1]} ${b.y}, ${b.hh}:${b.mi} WIB`;
    case 'bulanTahun': return `${KONST.BULAN_PANJANG[b.m - 1]} ${b.y}`;
    case 'iso': return `${b.y}-${String(b.m).padStart(2, '0')}-${String(b.d).padStart(2, '0')}`;
    default: return `${b.d} ${KONST.BULAN[b.m - 1]} ${b.y}`;
  }
}

function kunciBulan(v) {
  const b = bagianJkt(v);
  return b ? `${b.y}-${String(b.m).padStart(2, '0')}` : '';
}

function fRelatif(v) {
  const d = keTanggal(v);
  if (!d) return '-';
  const detik = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return Math.floor(detik / 60) + ' menit lalu';
  if (detik < 86400) return Math.floor(detik / 3600) + ' jam lalu';
  if (detik < 7 * 86400) return Math.floor(detik / 86400) + ' hari lalu';
  if (detik < 35 * 86400) return Math.floor(detik / (7 * 86400)) + ' minggu lalu';
  return fTgl(d);
}

function fHariIni(v) {
  const b = bagianJkt(v);
  const h = bagianJkt(new Date());
  if (!b) return '-';
  const sama = b.y === h.y && b.m === h.m && b.d === h.d;
  return (sama ? 'Hari ini' : fTgl(v)) + ', ' + fTgl(v, 'jam');
}

/** Nilai foto: ID Drive atau URL https */
function urlGambar(v, lebar) {
  if (!v) return '';
  const s = String(v);
  if (/^https?:\/{2}/.test(s)) return s;
  return 'https:\/\/drive.google.com/thumbnail?id=' + encodeURIComponent(s) + '&sz=w' + (lebar || 800);
}

/** <img> berlazy-load, atau placeholder bila foto kosong */
function gambar(v, lebar, kelas, alt, prioritas) {
  if (!v) {
    return `<div class="${kelas} bg-surface-container flex items-center justify-center text-outline-variant" role="img" aria-label="${esc(alt || 'Foto belum tersedia')}">${ikon('image', 'text-[32px]')}</div>`;
  }
  return `<img src="${esc(urlGambar(v, lebar))}" alt="${esc(alt || '')}" class="${kelas}" ${prioritas ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer">`;
}

function debounce(fn, ms) {
  let t = null;
  return function () {
    const args = arguments;
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), ms);
  };
}

function inisial(nama) {
  const b = String(nama || '?').trim().split(/\s+/);
  return ((b[0] || '?').charAt(0) + (b.length > 1 ? b[b.length - 1].charAt(0) : '')).toUpperCase();
}

/** Penyimpanan aman (localStorage bisa diblokir di iframe/mode privat) */
const Simpan = {
  mem: {},
  wadah(sesi) {
    try { return sesi ? window.sessionStorage : window.localStorage; } catch (e) { return null; }
  },
  get(k, sesi) {
    try {
      const w = this.wadah(sesi);
      const v = w ? w.getItem(k) : this.mem[k];
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  },
  set(k, v, sesi) {
    const s = JSON.stringify(v);
    try {
      const w = this.wadah(sesi);
      if (w) w.setItem(k, s); else this.mem[k] = s;
    } catch (e) { this.mem[k] = s; }
  },
  hapus(k) {
    delete this.mem[k];
    try { window.localStorage.removeItem(k); } catch (e) { /* abaikan */ }
    try { window.sessionStorage.removeItem(k); } catch (e) { /* abaikan */ }
  }
};

function idPerangkat() {
  let id = Simpan.get(KONST.KUNCI_PERANGKAT);
  if (!id) {
    const acak = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(acak);
    id = 'p' + Array.from(acak).map(b => b.toString(16).padStart(2, '0')).join('');
    Simpan.set(KONST.KUNCI_PERANGKAT, id);
  }
  return id;
}

// ════════════════════════════════════════════════════════════
// BAGIAN 3: JEMBATAN SERVER → dipindah ke js/api.js (panggil, buatGalat)
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// BAGIAN 4: UI GLOBAL — TOAST, MODAL, KONFIRMASI, LIGHTBOX
// ════════════════════════════════════════════════════════════

/** Toast gaya desain (kotak navy kanan-bawah) */
function toast(judul, pesan, jenis) {
  const akar = $('#akar-toast');
  const galat = jenis === 'galat';
  const el = document.createElement('div');
  el.className = 'pointer-events-auto bg-[#0A2540] text-on-primary px-4 py-3 rounded-xl shadow-xl flex items-start gap-3 max-w-sm w-full sm:w-auto toast-masuk';
  el.setAttribute('role', galat ? 'alert' : 'status');
  el.innerHTML = `
    <div class="w-7 h-7 rounded-full ${galat ? 'bg-error' : (jenis === 'info' ? 'bg-primary-container' : 'bg-status-available')} text-on-primary flex items-center justify-center shrink-0">
      ${ikon(galat ? 'priority_high' : (jenis === 'info' ? 'info' : 'check'), 'text-[18px]')}
    </div>
    <div class="flex flex-col min-w-0">
      <span class="font-label-md text-label-md text-on-primary">${esc(judul)}</span>
      ${pesan ? `<span class="font-body-sm text-body-sm text-outline-variant">${esc(pesan)}</span>` : ''}
    </div>
    <button type="button" class="ml-1 text-outline-variant hover:text-on-primary shrink-0" aria-label="Tutup notifikasi">${ikon('close', 'text-[18px]')}</button>`;
  const hapus = () => {
    el.classList.add('toast-keluar');
    setTimeout(() => el.remove(), 200);
  };
  el.querySelector('button').addEventListener('click', hapus);
  akar.appendChild(el);
  setTimeout(hapus, galat ? 6000 : 3500);
}

function toastGalat(e, judul) {
  toast(judul || 'Gagal', (e && e.message) || 'Terjadi kesalahan.', 'galat');
}

/** Sistem modal bertumpuk dengan Esc, klik latar, dan pengembalian fokus */
const Modal = {
  tumpukan: [],
  buka(opsi) {
    const akar = $('#akar-modal');
    const latar = document.createElement('div');
    latar.className = 'fixed inset-0 z-[1100] bg-[#0A2540]/60 backdrop-blur-sm flex items-center justify-center p-4 latar-masuk';
    latar.setAttribute('role', 'dialog');
    latar.setAttribute('aria-modal', 'true');
    latar.setAttribute('aria-label', opsi.label || 'Dialog');
    const panel = document.createElement('div');
    panel.className = `bg-surface-page rounded-2xl w-full ${opsi.lebar || 'max-w-lg'} max-h-[90vh] overflow-y-auto shadow-2xl panel-masuk ${opsi.kelasPanel || 'p-6'}`;
    panel.innerHTML = opsi.isi;
    latar.appendChild(panel);
    const item = { latar, panel, saatTutup: opsi.saatTutup, fokusSebelum: document.activeElement };
    latar.addEventListener('mousedown', e => {
      if (e.target === latar && opsi.tutupLatar !== false) Modal.tutup(item);
    });
    akar.appendChild(latar);
    this.tumpukan.push(item);
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const f = panel.querySelector('[autofocus], input:not([type=hidden]):not([disabled]), select, textarea, button');
      if (f) f.focus({ preventScroll: true });
    }, 30);
    return item;
  },
  tutup(item) {
    item = item || this.tumpukan[this.tumpukan.length - 1];
    if (!item) return;
    this.tumpukan = this.tumpukan.filter(x => x !== item);
    item.latar.remove();
    if (!this.tumpukan.length) document.body.style.overflow = '';
    if (item.fokusSebelum && item.fokusSebelum.focus) item.fokusSebelum.focus({ preventScroll: true });
    if (item.saatTutup) item.saatTutup();
  },
  tutupSemua() {
    while (this.tumpukan.length) this.tutup();
  },
  atas() {
    return this.tumpukan[this.tumpukan.length - 1] || null;
  }
};

/** Dialog konfirmasi → Promise<boolean> */
function konfirmasi(opsi) {
  return new Promise(resolve => {
    let selesai = false;
    const item = Modal.buka({
      lebar: 'max-w-md',
      label: opsi.judul,
      isi: `
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full ${opsi.bahaya ? 'bg-error-container text-error' : 'bg-primary-fixed text-primary-container'} flex items-center justify-center shrink-0">
            ${ikon(opsi.ikon || (opsi.bahaya ? 'warning' : 'help'), 'text-[22px]')}
          </div>
          <div class="flex flex-col gap-1">
            <h3 class="font-headline-sm text-headline-sm text-on-surface">${esc(opsi.judul)}</h3>
            <p class="font-body-md text-body-md text-on-surface-variant">${esc(opsi.pesan)}</p>
          </div>
        </div>
        <div class="flex items-center justify-end gap-3 pt-6">
          <button type="button" data-k="batal" class="px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors">${esc(opsi.batal || 'Batal')}</button>
          <button type="button" data-k="ok" class="px-5 py-2.5 rounded-lg ${opsi.bahaya ? 'bg-error hover:bg-[#93000a]' : 'bg-primary-container hover:bg-primary'} text-on-primary font-label-md text-label-md shadow-sm transition-colors">${esc(opsi.ok || 'Ya')}</button>
        </div>`,
      saatTutup: () => { if (!selesai) resolve(false); }
    });
    item.panel.querySelector('[data-k=batal]').addEventListener('click', () => { selesai = true; Modal.tutup(item); resolve(false); });
    item.panel.querySelector('[data-k=ok]').addEventListener('click', () => { selesai = true; Modal.tutup(item); resolve(true); });
    setTimeout(() => item.panel.querySelector('[data-k=ok]').focus(), 40);
  });
}

/** Lightbox foto (Perbesar Layar) — panah, keyboard, Esc */
function bukaLightbox(foto, mulai) {
  const daftar = (foto || []).filter(f => f && (f.id || f.url));
  if (!daftar.length) return;
  let i = Math.max(0, Math.min(mulai || 0, daftar.length - 1));
  const item = Modal.buka({
    lebar: 'max-w-5xl',
    kelasPanel: 'p-0 bg-transparent shadow-none overflow-visible',
    label: 'Galeri foto',
    isi: `
      <div class="relative">
        <button type="button" data-lb="tutup" aria-label="Tutup galeri" class="absolute -top-12 right-0 w-10 h-10 rounded-full bg-surface-page/90 text-on-surface flex items-center justify-center shadow">${ikon('close')}</button>
        <div class="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-inverse-surface">
          <img data-lb="img" class="w-full h-full object-contain" alt="">
          <button type="button" data-lb="prev" aria-label="Foto sebelumnya" class="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-surface-page/90 text-on-surface flex items-center justify-center shadow">${ikon('chevron_left')}</button>
          <button type="button" data-lb="next" aria-label="Foto berikutnya" class="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-surface-page/90 text-on-surface flex items-center justify-center shadow">${ikon('chevron_right')}</button>
        </div>
        <div class="flex items-center justify-between pt-3 text-on-primary font-body-md text-body-md">
          <span data-lb="ket"></span><span data-lb="no" class="font-label-md text-label-md"></span>
        </div>
      </div>`
  });
  const p = item.panel;
  const tampil = () => {
    const f = daftar[i];
    p.querySelector('[data-lb=img]').src = urlGambar(f.id || f.url, 1600);
    p.querySelector('[data-lb=img]').alt = f.keterangan || 'Foto ' + (i + 1);
    p.querySelector('[data-lb=ket]').textContent = f.keterangan || '';
    p.querySelector('[data-lb=no]').textContent = (i + 1) + ' / ' + daftar.length;
    p.querySelector('[data-lb=prev]').hidden = daftar.length < 2;
    p.querySelector('[data-lb=next]').hidden = daftar.length < 2;
  };
  p.querySelector('[data-lb=prev]').addEventListener('click', () => { i = (i - 1 + daftar.length) % daftar.length; tampil(); });
  p.querySelector('[data-lb=next]').addEventListener('click', () => { i = (i + 1) % daftar.length; tampil(); });
  p.querySelector('[data-lb=tutup]').addEventListener('click', () => Modal.tutup(item));
  item.tombolKiri = () => { i = (i - 1 + daftar.length) % daftar.length; tampil(); };
  item.tombolKanan = () => { i = (i + 1) % daftar.length; tampil(); };
  tampil();
}

/** Tombol muat (spinner) untuk tombol yang sedang memproses */
function tombolSibuk(btn, sibuk, teks) {
  if (!btn) return;
  if (sibuk) {
    btn.dataset.asli = btn.innerHTML;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = `<span class="putar"></span><span>${esc(teks || 'Memproses...')}</span>`;
  } else {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    if (btn.dataset.asli) btn.innerHTML = btn.dataset.asli;
  }
}

/** Unduh berkas base64 dari server (Excel/PDF) */
function unduhBase64(b64, mime, nama) {
  const biner = atob(b64);
  const arr = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) arr[i] = biner.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

// ════════════════════════════════════════════════════════════
// BAGIAN 5: WHATSAPP (selalu tab baru — aman di iframe)
// ════════════════════════════════════════════════════════════

const PesanWA = {
  umum: () => (S.umum && S.umum.waPesan) || 'Halo Admin Kost AB6, saya ingin menanyakan ketersediaan kamar dan jadwal survei...',
  tersedia: k => `Halo Admin Kost AB6, saya tertarik dengan ${k.nama} (Kode ${k.kode}) seharga ${rupiah(k.harga)}/bulan. Apakah kamar ini masih tersedia?`,
  terisi: k => `Halo Admin Kost AB6, saya ingin menanyakan info ${k.nama} (Kode ${k.kode}) yang sedang terisi. Kapan kira-kira tersedia kembali? Mohon masukkan saya ke daftar tunggu.`,
  survei: k => `Halo Admin Kost AB6, saya ingin menjadwalkan survei lokasi${k ? ' untuk ' + k.nama : ''}. Kapan jadwal yang tersedia?`
};

function waUrl(pesan) {
  const nomor = (S.umum && S.umum.wa) || '6281234567890';
  return 'https:\/\/wa.me/' + nomor + '?text=' + encodeURIComponent(pesan || PesanWA.umum());
}

/** Atribut <a> untuk tautan WA */
function waAttr(pesan) {
  return `href="${esc(waUrl(pesan))}" target="_blank" rel="noopener noreferrer"`;
}

function perbaruiWaMelayang() {
  const el = $('#wa-melayang');
  if (!el) return;
  let pesan = PesanWA.umum();
  if (S.rute.nama === 'detail') {
    const k = cariKamar(S.rute.param.kode);
    if (k) pesan = k.status === 'Terisi' ? PesanWA.terisi(k) : PesanWA.tersedia(k);
  }
  el.href = waUrl(pesan);
}

// ════════════════════════════════════════════════════════════
// BAGIAN 6: ROUTER SPA (tanpa URL, tanpa reload)
// ════════════════════════════════════════════════════════════

const KELAS_MENU = {
  aktif: 'relative flex items-center h-full transition-colors text-primary-container font-headline-sm font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-gradient-to-r after:from-gradient-start after:via-gradient-mid after:to-gradient-end after:rounded-full',
  pasif: 'relative flex items-center h-full text-on-surface-variant hover:text-on-surface font-headline-sm text-body-md transition-colors',
  hpAktif: 'flex items-center gap-3 px-3 py-3 rounded-lg font-headline-sm text-body-lg bg-primary-fixed/40 text-primary-container',
  hpPasif: 'flex items-center gap-3 px-3 py-3 rounded-lg font-headline-sm text-body-lg text-on-surface hover:bg-surface-container',
  admAktif: 'flex items-center gap-space-xs px-space-md py-3 transition-colors bg-[#14324f] text-on-primary border-l-[3px] border-gradient-mid font-semibold pl-[13px] font-label-md text-label-md',
  admPasif: 'flex items-center gap-space-xs px-space-md py-3 font-label-md text-label-md text-outline-variant hover:bg-[#14324f] hover:text-on-primary transition-colors border-l-[3px] border-transparent'
};

function lapisanUntuk(nama) {
  if (nama === 'login') return 'login';
  if (nama.indexOf('admin-') === 0) return 'admin';
  return 'publik';
}

function sesiValid() {
  return !!(S.sesi && S.sesi.token && S.sesi.exp > Date.now());
}

/**
 * Satu-satunya cara berpindah halaman. Tidak pernah memakai window.location.
 * @param {string} nama  nama rute
 * @param {object} param parameter (mis. {kode:'A1'})
 */
async function navigasi(nama, param, opsi) {
  param = param || {};
  opsi = opsi || {};
  if (S.kotor && !opsi.paksa) {
    const lanjut = await konfirmasi({
      judul: 'Perubahan belum disimpan',
      pesan: 'Tinggalkan halaman ini? Perubahan yang belum disimpan akan hilang.',
      ok: 'Tinggalkan', bahaya: true
    });
    if (!lanjut) return;
    batalPerubahan();
  }
  if (nama.indexOf('admin-') === 0 && !sesiValid()) {
    param = { lanjut: nama };
    nama = 'login';
  } else if (nama === 'login' && sesiValid()) {
    nama = 'admin-dashboard';
  }
  if (!RENDER[nama]) nama = '404';

  const sebelum = S.rute.nama;
  if (sebelum === 'beranda' && nama !== 'beranda') {
    Slider.berhenti();
    kirimStatBanner();
  }
  S.rute = { nama, param };
  tutupMenuHp();
  tutupSidebar();
  tutupPanelTopbar();

  const lapisan = lapisanUntuk(nama);
  ['publik', 'login', 'admin'].forEach(l => { $('#lapisan-' + l).hidden = l !== lapisan; });
  $$('.halaman').forEach(h => { h.hidden = h.dataset.halaman !== nama; });

  const el = $('#hal-' + nama);
  try {
    RENDER[nama](el, param);
  } catch (e) {
    console.error(e);
    toast('Gagal menampilkan halaman', e.message, 'galat');
  }
  if (el) {
    el.classList.remove('halaman-masuk');
    void el.offsetWidth;
    el.classList.add('halaman-masuk');
  }
  perbaruiMenuAktif(nama);
  perbaruiWaMelayang();
  document.title = (KONST.JUDUL[nama] || 'Kost AB6') + ' — Kost AB6';
  if (!opsi.tanpaGulir) window.scrollTo(0, 0);
  if (lapisan === 'admin') {
    perbaruiKerangkaAdmin();
    pastikanDataAdmin();
  }
}

function perbaruiMenuAktif(nama) {
  const peta = { detail: 'kamar' };
  const aktif = peta[nama] || nama;
  $$('[data-menu-publik]').forEach(a => {
    const on = a.dataset.menuPublik === aktif;
    a.className = on ? KELAS_MENU.aktif : KELAS_MENU.pasif;
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $$('[data-menu-hp]').forEach(a => { a.className = a.dataset.menuHp === aktif ? KELAS_MENU.hpAktif : KELAS_MENU.hpPasif; });
  const admAktif = nama === 'admin-kamar-form' ? 'admin-kamar' : nama;
  $$('[data-menu-admin]').forEach(a => {
    const on = a.dataset.menuAdmin === admAktif;
    const lencana = a.dataset.menuAdmin === 'admin-testimoni';
    a.className = (on ? KELAS_MENU.admAktif : KELAS_MENU.admPasif) + (lencana ? ' justify-between' : '');
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function bukaMenuHp() {
  $('#laci-hp').hidden = false;
  $('[data-aksi=buka-menu-hp]').setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}
function tutupMenuHp() {
  const l = $('#laci-hp');
  if (l && !l.hidden) {
    l.hidden = true;
    $('[data-aksi=buka-menu-hp]').setAttribute('aria-expanded', 'false');
    if (!Modal.tumpukan.length) document.body.style.overflow = '';
  }
}
function bukaSidebar() {
  $('#sidebar-admin').classList.remove('-translate-x-full');
  $('#latar-sidebar').hidden = false;
}
function tutupSidebar() {
  const s = $('#sidebar-admin');
  if (s) s.classList.add('-translate-x-full');
  const l = $('#latar-sidebar');
  if (l) l.hidden = true;
}
function tutupPanelTopbar() {
  ['#panel-notifikasi', '#panel-akun'].forEach(id => { const p = $(id); if (p) p.hidden = true; });
}

/** Tujuan tautan banner/CTA: rute internal, 'wa', atau URL */
function bukaTautan(link) {
  link = String(link || '');
  if (link === '/' || link === '') return navigasi('beranda');
  if (link === '/kamar') return navigasi('kamar');
  if (link === '/testimoni') return navigasi('testimoni');
  if (link === '/tentang-kami') return navigasi('tentang');
  const m = /^\/kamar\/([A-Za-z0-9-]+)$/.exec(link);
  if (m) return navigasi('detail', { kode: m[1] });
  return null;
}

function linkEksternal(link) {
  if (link === 'wa') return waUrl(PesanWA.umum());
  return /^https:\/{2}/.test(link || '') ? link : '';
}

// ════════════════════════════════════════════════════════════
// BAGIAN 7: DATA PUBLIK (instan dari cache lokal + prefetch)
// ════════════════════════════════════════════════════════════

function cariKamar(kode) {
  const items = (S.kamar && S.kamar.items) || [];
  return items.filter(k => String(k.kode).toLowerCase() === String(kode || '').toLowerCase())[0] || null;
}

/** Menerapkan data baru; me-render ulang hanya jika isinya berubah */
function terapkanData(d) {
  const berubah = [];
  ['umum', 'beranda', 'kamar', 'testimoni', 'tentang'].forEach(k => {
    if (d[k] === undefined || d[k] === null) return;
    const j = JSON.stringify(d[k]);
    if (j === S.json[k]) return;
    S.json[k] = j;
    S[k] = d[k];
    berubah.push(k);
  });
  if (!berubah.length) return;
  if (berubah.indexOf('beranda') >= 0 && S.beranda) {
    S.kegiatan = { items: S.beranda.kegiatan.items.slice(), adaLagi: S.beranda.kegiatan.adaLagi, halaman: 1, memuat: false };
  }
  if (berubah.indexOf('testimoni') >= 0 && S.testimoni) {
    S.testiDaftar = { items: S.testimoni.items.slice(), adaLagi: S.testimoni.adaLagi, halaman: 1, jumlah: S.testimoni.jumlah, memuat: false };
  }
  if (berubah.indexOf('umum') >= 0) perbaruiKerangkaPublik();
  const nama = S.rute.nama;
  const butuh = {
    beranda: ['beranda', 'umum'], kamar: ['kamar', 'umum'], detail: ['kamar', 'umum'],
    testimoni: ['testimoni', 'umum'], tentang: ['tentang', 'umum']
  }[nama];
  if (butuh && butuh.some(k => berubah.indexOf(k) >= 0)) {
    if (nama === 'testimoni') renderTestimoniBagian();
    else RENDER[nama]($('#hal-' + nama), S.rute.param);
    perbaruiWaMelayang();
  }
}

function simpanCachePublik() {
  Simpan.set(KONST.KUNCI_PUBLIK, {
    t: Date.now(), umum: S.umum, beranda: S.beranda, kamar: S.kamar, testimoni: S.testimoni, tentang: S.tentang
  });
}

/** Logo bawaan bila logo belum diunggah atau gagal dimuat */
function logoCadangan() {
  return `<span class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-container to-secondary flex items-center justify-center text-on-primary shadow-sm">${ikon('apartment', 'text-[20px]')}</span>`;
}

/** Isi header/footer dari data umum */
function perbaruiKerangkaPublik() {
  const u = S.umum || {};
  $('#logo-publik').innerHTML = u.logo
    ? `<img src="${esc(urlGambar(u.logo, 200))}" alt="Logo Kost AB6" class="h-8 w-auto max-w-[160px] object-contain" referrerpolicy="no-referrer">`
    : logoCadangan();
  if (u.alamatSingkat) $('#ftr-alamat').textContent = u.alamatSingkat;
  if (u.waTampil) {
    $('#ftr-wa').textContent = u.waTampil;
    $('#ftr-wa').href = waUrl(PesanWA.umum());
  }
  if (u.email) {
    $('#ftr-email').textContent = u.email;
    $('#ftr-email').href = 'mailto:' + u.email;
  }
}

async function muatPublik() {
  const lokal = Simpan.get(KONST.KUNCI_PUBLIK);
  if (lokal && lokal.t && Date.now() - lokal.t < 7 * 864e5) terapkanData(lokal);
  try {
    terapkanData(await ambilAwalDini());
  } catch (e) {
    if (!S.beranda) renderGalatMuat();
    else toast('Mode luring', 'Menampilkan data tersimpan. ' + e.message, 'info');
    return;
  }
  try {
    terapkanData(await panggil('ambilPrefetch'));
  } catch (e) {
    console.warn('Prefetch gagal:', e);
  }
  simpanCachePublik();
}

function renderGalatMuat() {
  const el = $('#hal-' + S.rute.nama);
  if (!el || lapisanUntuk(S.rute.nama) !== 'publik') return;
  el.innerHTML = `
    <div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin py-space-xl text-center flex flex-col items-center gap-space-md">
      <div class="w-16 h-16 rounded-full bg-error-container text-error flex items-center justify-center">${ikon('wifi_off', 'text-[32px]')}</div>
      <h1 class="font-headline-md text-headline-md text-on-surface">Gagal memuat data</h1>
      <p class="font-body-md text-body-md text-on-surface-variant max-w-md">Koneksi ke server bermasalah. Periksa internet Anda lalu coba lagi.</p>
      <button type="button" data-aksi="muat-ulang-publik" class="px-space-lg py-3 rounded-full bg-primary-container text-on-primary font-headline-sm text-body-md shadow-sm">Coba Lagi</button>
    </div>`;
}

// ════════════════════════════════════════════════════════════
// BAGIAN 8: SLIDER HERO + STATISTIK BANNER
// ════════════════════════════════════════════════════════════

const Slider = {
  el: null, idx: 0, jalan: true, timer: null, jumlah: 0, xAwal: null,
  pasang(el) {
    this.berhenti();
    this.el = el;
    this.jumlah = el ? $$('.slide-item', el).length : 0;
    this.idx = 0;
    if (!el || !this.jumlah) return;
    this.tampil(0);
    this.mulai();
    el.addEventListener('touchstart', e => { this.xAwal = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', e => {
      if (this.xAwal === null) return;
      const dx = e.changedTouches[0].clientX - this.xAwal;
      this.xAwal = null;
      if (Math.abs(dx) > 40) this.geser(dx < 0 ? 1 : -1);
    }, { passive: true });
  },
  tampil(i) {
    if (!this.el || !this.jumlah) return;
    this.idx = (i + this.jumlah) % this.jumlah;
    $$('.slide-item', this.el).forEach((s, n) => {
      const on = n === this.idx;
      s.classList.toggle('opacity-100', on);
      s.classList.toggle('z-10', on);
      s.classList.toggle('opacity-0', !on);
      s.classList.toggle('pointer-events-none', !on);
      s.classList.toggle('z-0', !on);
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    $$('[data-garis]', this.el).forEach((b, n) => {
      b.className = n === this.idx
        ? 'h-1.5 w-10 rounded-full bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end transition-all'
        : 'h-1.5 w-10 rounded-full bg-surface-container-lowest/50 hover:bg-surface-container-lowest/80 transition-all';
      b.setAttribute('aria-current', n === this.idx ? 'true' : 'false');
    });
    const aktif = $$('.slide-item', this.el)[this.idx];
    if (aktif && aktif.dataset.id && !document.hidden && S.rute.nama === 'beranda') {
      S.stat.tayang[aktif.dataset.id] = (S.stat.tayang[aktif.dataset.id] || 0) + 1;
    }
  },
  mulai() {
    clearInterval(this.timer);
    if (this.jumlah > 1 && this.jalan) {
      this.timer = setInterval(() => { if (!document.hidden) this.tampil(this.idx + 1); }, 5000);
    }
  },
  berhenti() { clearInterval(this.timer); },
  geser(arah) {
    this.tampil(this.idx + arah);
    this.mulai();
  },
  ke(i) {
    this.tampil(i);
    this.mulai();
  },
  jedaPutar(btn) {
    this.jalan = !this.jalan;
    if (this.jalan) this.mulai(); else this.berhenti();
    if (btn) {
      btn.innerHTML = ikon(this.jalan ? 'pause' : 'play_arrow', 'text-[18px]');
      btn.setAttribute('aria-label', this.jalan ? 'Jeda putar otomatis' : 'Mulai putar otomatis');
    }
  }
};

function kirimStatBanner() {
  const t = S.stat.tayang;
  const k = S.stat.klik;
  if (!Object.keys(t).length && !Object.keys(k).length) return;
  S.stat = { tayang: {}, klik: {} };
  panggil('catatStatistikBanner', { tayang: t, klik: k }).catch(() => { /* statistik tidak kritis */ });
}

// ════════════════════════════════════════════════════════════
// BAGIAN 9: KOMPONEN PUBLIK BERSAMA
// ════════════════════════════════════════════════════════════

const WADAH = 'max-w-[1280px] w-full mx-auto px-margin-mobile md:px-margin';
const GARIS_JUDUL = 'w-12 h-[3px] mt-2 rounded-full bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end';

function kerangkaBlok(kelas) { return `<div class="kerangka rounded-xl ${kelas}"></div>`; }

function kerangkaHalaman() {
  return `<div class="${WADAH} py-space-xl flex flex-col gap-space-lg" aria-busy="true" aria-label="Memuat">
    ${kerangkaBlok('h-10 w-64')}${kerangkaBlok('h-4 w-96 max-w-full')}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">${kerangkaBlok('h-80')}${kerangkaBlok('h-80')}${kerangkaBlok('h-80')}</div>
  </div>`;
}

function remah(teks) {
  return `<nav aria-label="Breadcrumb" class="flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm mb-space-md">
    <a href="#" data-nav="beranda" class="hover:text-primary transition-colors flex items-center gap-1">${ikon('home', 'text-[16px]')}<span>Beranda</span></a>
    ${ikon('chevron_right', 'text-[14px] text-outline-variant')}
    <span class="text-on-surface font-label-md text-label-md">${esc(teks)}</span>
  </nav>`;
}

function labelPenulis(t, panjang) {
  if (t.tipe === 'Official') return 'Kurasi Tim';
  if (t.tipe === 'Alumni') return 'Alumni Penghuni';
  return t.lantai ? (panjang ? 'Penghuni Lantai ' : 'Penghuni Lt. ') + t.lantai : 'Penghuni';
}

/** Avatar bercincin gradasi; tanpa foto → inisial / ikon gedung (Official) */
function avatarTesti(t, ukuran) {
  let dalam;
  if (t.fotoProfil) dalam = gambar(t.fotoProfil, 200, 'w-full h-full object-cover rounded-full bg-surface-container', 'Foto profil ' + t.nama);
  else if (t.tipe === 'Official') dalam = `<div class="w-full h-full rounded-full bg-primary-container text-on-primary flex items-center justify-center">${ikon('apartment', 'text-[22px]')}</div>`;
  else dalam = `<div class="w-full h-full rounded-full bg-primary-fixed text-primary flex items-center justify-center font-headline-sm font-bold text-body-md">${esc(inisial(t.nama))}</div>`;
  return `<div class="relative ${ukuran} rounded-full p-[2px] bg-gradient-to-tr from-gradient-start via-gradient-mid to-gradient-end flex-shrink-0">${dalam}</div>`;
}

function namaKamarPendek(nama) {
  return String(nama || '').replace(/^Kamar\s+/i, '');
}

function chipKamar(k, n) {
  return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container font-body-sm text-body-sm text-on-surface">${ikon(k.ikon || 'check_circle', 'text-[14px] text-primary')} ${esc(k.teks)}</span>`;
}

function daftarChipKamar(k) {
  const fas = (k.fasilitas || []).map(f => ({ teks: f.ringkas, ikon: f.ikon }))
    .concat((k.kustom || []).map(t => ({ teks: t, ikon: 'check_circle' })));
  const tampil = fas.slice(0, 4).map(chipKamar).join('');
  const sisa = fas.length - 4;
  return tampil + (sisa > 0 ? `<span class="inline-flex items-center px-2 py-1 rounded-full bg-surface-container-high font-body-sm text-body-sm text-on-surface-variant">+${sisa} lainnya</span>` : '');
}

function spekRingkas(k) {
  const kasur = KONST.KASUR[k.kasur];
  return `${desimal(k.panjang)} x ${desimal(k.lebar)} m · ${kasur ? kasur.ringkas : 'Kasur'}`;
}

function lencanaStatusFoto(status) {
  return status === 'Terisi'
    ? `<div class="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DBEAFE] text-[#1D4ED8] font-headline-sm text-body-sm font-semibold shadow-sm"><span class="w-2 h-2 rounded-full bg-[#1D4ED8]"></span>Terisi</div>`
    : `<div class="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCFCE7] text-[#166534] font-headline-sm text-body-sm font-semibold shadow-sm"><span class="w-2 h-2 rounded-full bg-[#166534] animate-pulse"></span>Tersedia</div>`;
}

/** Parse tautan YouTube / Google Drive → URL embed */
function urlEmbedVideo(link) {
  const s = String(link || '').trim();
  let m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(s);
  if (m) return 'https:\/\/www.youtube-nocookie.com/embed/' + m[1] + '?autoplay=1&rel=0';
  m = /drive\.google\.com\/(?:file\/d\/|open\?(?:.*&)?id=)([A-Za-z0-9_-]{10,})/.exec(s);
  if (m) return 'https:\/\/drive.google.com/file/d/' + m[1] + '/preview';
  return '';
}

function iframeVideo(link, judul) {
  const url = urlEmbedVideo(link);
  if (!url) return '';
  return `<div class="bingkai-media absolute inset-0 bg-inverse-surface"><iframe src="${esc(url)}" title="${esc(judul || 'Video tur kamar')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}

// ════════════════════════════════════════════════════════════
// BAGIAN 10: HALAMAN BERANDA
// ════════════════════════════════════════════════════════════

RENDER.beranda = function (el) {
  const b = S.beranda;
  if (!b) {
    el.innerHTML = `<div class="${WADAH} pt-space-md pb-space-xl flex flex-col gap-space-lg" aria-busy="true">
      ${kerangkaBlok('h-[440px] md:h-[460px]')}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-space-md">${kerangkaBlok('h-20')}${kerangkaBlok('h-20')}${kerangkaBlok('h-20')}${kerangkaBlok('h-20')}</div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">${kerangkaBlok('h-72')}${kerangkaBlok('h-72')}</div></div>`;
    return;
  }
  const banner = b.banner.length ? b.banner : [{
    id: '', label: '', judul: 'Kost AB6', keterangan: 'Hunian modern, tenang, dan strategis untuk mahasiswa dan profesional muda.',
    teksTombol: 'Lihat Katalog Kamar', linkTombol: '/kamar', foto: (S.umum && S.umum.fotoCadangan) || ''
  }];
  el.innerHTML = `<div class="flex flex-col w-full"><div class="relative ${WADAH} pt-space-md pb-space-xl">
    ${htmlHero(banner)}
    ${htmlSorotan(b.sorotan || [])}
    ${htmlVisiMisi(b.visiMisi || {})}
    ${htmlKataMereka(b.testimoni || [])}
    ${htmlGaleriKegiatan()}
    ${htmlCtaBeranda()}
  </div></div>`;
  Slider.pasang($('#hero-slider', el));
};

function htmlHero(banner) {
  const n = banner.length;
  const slides = banner.map((s, i) => {
    let cta = '';
    if (s.teksTombol) {
      const luar = linkEksternal(s.linkTombol);
      const kelas = 'inline-flex items-center gap-space-sm px-space-lg py-3 rounded-full bg-status-available text-on-primary font-headline-sm text-body-md shadow-md hover:bg-secondary transition-all hover:gap-space-md';
      cta = `<div><a ${luar ? `href="${esc(luar)}" target="_blank" rel="noopener noreferrer"` : 'href="#"'} data-aksi="cta-banner" data-id="${esc(s.id)}" data-link="${esc(s.linkTombol)}" class="${kelas}"><span>${esc(s.teksTombol)}</span>${ikon('arrow_forward', 'text-[20px]')}</a></div>`;
    }
    const foto = s.foto
      ? `<img src="${esc(urlGambar(s.foto, 1920))}" alt="" class="absolute inset-0 w-full h-full object-cover" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer">`
      : `<div class="absolute inset-0 bg-gradient-to-br from-[#0A2540] via-primary to-gradient-start"></div>`;
    return `<div class="slide-item absolute inset-0 transition-opacity duration-700 ease-in-out ${i === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}" data-id="${esc(s.id)}" role="group" aria-roledescription="slide" aria-label="${i + 1} dari ${n}">
      ${foto}
      <div class="absolute inset-0 bg-gradient-to-r from-on-surface/90 via-on-surface/65 to-transparent w-full md:w-[70%]"></div>
      <div class="relative z-20 h-full flex flex-col justify-center max-w-[620px] px-space-lg md:px-space-xl text-on-primary">
        ${s.label ? `<span class="inline-flex items-center gap-space-xs font-label-md text-label-md uppercase tracking-wider text-secondary-fixed mb-space-sm"><span class="w-2 h-2 rounded-full bg-status-available ${i === 0 ? 'animate-pulse' : ''}"></span>${esc(s.label)}</span>` : ''}
        <${i === 0 ? 'h1' : 'h2'} class="font-display-hero text-headline-lg md:text-display-hero font-bold tracking-tight text-on-primary leading-tight drop-shadow-sm mb-space-sm">${esc(s.judul)}</${i === 0 ? 'h1' : 'h2'}>
        <p class="font-body-lg text-body-md md:text-body-lg text-surface-container-high max-w-[500px] mb-space-lg leading-relaxed">${esc(s.keterangan)}</p>
        ${cta}
      </div>
    </div>`;
  }).join('');
  const kontrol = n > 1 ? `
    <button type="button" data-aksi="slider-prev" aria-label="Slide sebelumnya" class="absolute left-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-surface-container-lowest text-on-surface hidden md:flex items-center justify-center shadow-md hover:bg-surface-bright active:scale-95 transition-all">${ikon('chevron_left', 'text-[24px]')}</button>
    <button type="button" data-aksi="slider-next" aria-label="Slide berikutnya" class="absolute right-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-surface-container-lowest text-on-surface hidden md:flex items-center justify-center shadow-md hover:bg-surface-bright active:scale-95 transition-all">${ikon('chevron_right', 'text-[24px]')}</button>
    <div class="absolute bottom-5 right-4 md:right-8 z-30 flex items-center gap-space-md bg-on-surface/50 backdrop-blur-md px-space-md py-space-xs rounded-full">
      <div class="flex items-center gap-1.5">${banner.map((s, i) => `<button type="button" data-aksi="slider-ke" data-i="${i}" data-garis aria-label="Pindah ke slide ${i + 1}" class="h-1.5 w-10 rounded-full ${i === 0 ? 'bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end' : 'bg-surface-container-lowest/50'} transition-all"></button>`).join('')}</div>
      <button type="button" data-aksi="slider-jeda" aria-label="${Slider.jalan ? 'Jeda putar otomatis' : 'Mulai putar otomatis'}" class="text-on-primary hover:text-secondary-fixed transition-colors flex items-center">${ikon(Slider.jalan ? 'pause' : 'play_arrow', 'text-[18px]')}</button>
      <span class="hidden sm:inline-block font-body-sm text-body-sm text-surface-container-high tracking-tight">Otomatis berganti tiap 5 detik</span>
    </div>` : '';
  return `<section class="relative w-full rounded-xl overflow-hidden shadow-sm h-[440px] md:h-[460px] select-none group" id="hero-slider" aria-roledescription="carousel" aria-label="Banner Kost AB6">
    <div class="relative w-full h-full overflow-hidden bg-on-surface">${slides}</div>${kontrol}
  </section>`;
}

function htmlSorotan(daftar) {
  if (!daftar.length) return '';
  return `<div class="grid grid-cols-2 md:grid-cols-4 gap-space-sm sm:gap-space-md mt-space-lg">${daftar.slice(0, 4).map(s => `
    <div class="bg-surface-container-lowest rounded-xl p-space-sm sm:p-space-md shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-space-sm sm:gap-space-md">
      <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container shrink-0">${ikon(s.ikon || 'verified', 'text-[22px] sm:text-[24px]')}</div>
      <div class="min-w-0"><p class="font-label-numeric text-body-lg sm:text-label-numeric font-bold text-on-surface whitespace-nowrap">${esc(s.nilai)}</p><p class="font-body-sm text-body-sm text-on-surface-variant sm:truncate">${esc(s.label)}</p></div>
    </div>`).join('')}</div>`;
}

function htmlVisiMisi(v) {
  const misi = (v.misi || []).map((m, i) => `
    <li class="flex items-start gap-space-md">
      <span class="flex-shrink-0 w-7 h-7 rounded-full bg-status-available text-on-primary font-headline-sm text-body-sm flex items-center justify-center font-bold">${i + 1}</span>
      <p class="font-body-md text-body-md text-on-surface pt-0.5 leading-snug">${esc(m)}</p>
    </li>`).join('');
  return `<section class="mt-space-xl pt-space-lg">
    <div class="mb-space-lg"><h2 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface tracking-tight">Visi &amp; Misi Kost AB6</h2><div class="${GARIS_JUDUL}"></div></div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-space-lg items-stretch">
      <div class="bg-primary-fixed/35 rounded-xl p-space-lg md:p-space-xl flex flex-col justify-between shadow-sm relative overflow-hidden">
        <div class="relative z-10">
          <div class="flex items-center gap-space-md mb-space-lg">
            <div class="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-sm">${ikon('explore', 'text-[24px]')}</div>
            <div><span class="font-body-sm text-body-sm uppercase tracking-wider text-primary font-semibold">Tujuan Kami</span><h3 class="font-headline-md text-headline-md font-bold text-on-surface">Visi Kami</h3></div>
          </div>
          <blockquote class="font-body-lg text-body-lg italic text-on-surface leading-relaxed text-balance pt-space-sm pl-space-md border-l-2 border-primary-container">“${esc(v.visi)}”</blockquote>
        </div>
        ${v.visiLabel ? `<div class="mt-space-xl pt-space-md flex items-center gap-space-sm font-label-md text-label-md text-primary relative z-10">${ikon('verified', 'text-[18px]')}<span>${esc(v.visiLabel)}</span></div>` : ''}
        <svg class="absolute -right-8 -bottom-8 w-44 h-44 text-primary/5 pointer-events-none" fill="currentColor" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" fill="none" opacity="0.4" r="48" stroke="currentColor" stroke-width="4"></circle><polygon points="50,15 58,42 85,50 58,58 50,85 42,58 15,50 42,42"></polygon></svg>
      </div>
      <div class="bg-surface-container-lowest rounded-xl p-space-lg md:p-space-xl shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-space-md mb-space-lg">
            <div class="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">${ikon('task_alt', 'text-[24px]')}</div>
            <div><span class="font-body-sm text-body-sm uppercase tracking-wider text-secondary font-semibold">Komitmen Operasional</span><h3 class="font-headline-md text-headline-md font-bold text-on-surface">Misi Kami</h3></div>
          </div>
          <ul class="space-y-space-md">${misi}</ul>
        </div>
        <div class="mt-space-lg pt-space-sm flex items-center justify-between gap-2 text-on-surface-variant font-body-sm text-body-sm">
          <span>${v.tahun ? 'Dikelola secara profesional sejak ' + esc(v.tahun) : ''}</span>
          ${v.misiLabel ? `<span class="inline-flex items-center gap-1 text-status-available font-semibold">${ikon('check_circle', 'text-[16px]')} ${esc(v.misiLabel)}</span>` : ''}
        </div>
      </div>
    </div>
  </section>`;
}

function chipSorotanTesti(t, i) {
  if (t.tag) {
    const kelas = i % 2 ? 'text-secondary bg-secondary-container/50' : 'text-primary bg-primary-fixed/50';
    return `<span class="inline-flex items-center gap-1 font-body-sm text-body-sm ${kelas} px-2 py-1 rounded-full">${ikon(t.ikonTag || 'verified', 'text-[14px]')} ${esc(t.tag)}</span>`;
  }
  if (t.fotoBukti) return `<span class="inline-flex items-center gap-1 font-body-sm text-body-sm text-primary bg-primary-fixed/50 px-2 py-1 rounded-full">${ikon('photo_camera', 'text-[14px]')} Foto Terverifikasi</span>`;
  return '<span></span>';
}

function htmlKataMereka(daftar) {
  if (!daftar.length) return '';
  return `<section class="mt-space-xl pt-space-lg">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between mb-space-lg gap-space-sm">
      <div><h2 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface tracking-tight">Kata Mereka</h2><div class="${GARIS_JUDUL}"></div></div>
      <a href="#" data-nav="testimoni" class="inline-flex items-center gap-1 font-headline-sm text-body-md text-primary-container hover:text-primary transition-colors font-semibold"><span>Lihat Semua Testimoni</span>${ikon('arrow_forward', 'text-[18px]')}</a>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-space-lg">${daftar.map((t, i) => `
      <div class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-space-md mb-space-md">
            ${avatarTesti(t, 'w-12 h-12')}
            <div class="min-w-0"><h3 class="font-headline-sm text-headline-sm text-on-surface font-bold leading-snug truncate">${esc(t.nama)}</h3><p class="font-body-sm text-body-sm text-on-surface-variant">${fTgl(t.tanggal, 'panjang')} • ${esc(labelPenulis(t))}</p></div>
          </div>
          <p class="font-body-md text-body-md text-on-surface leading-relaxed line-clamp-4">${esc(t.isi)}</p>
        </div>
        <div class="mt-space-md pt-space-sm flex items-center justify-between gap-2">
          ${chipSorotanTesti(t, i)}
          ${t.kamar ? `<span class="font-body-sm text-body-sm text-on-surface-variant text-right whitespace-nowrap shrink-0">${esc(namaKamarPendek(t.kamar))}</span>` : ''}
        </div>
      </div>`).join('')}</div>
  </section>`;
}

function kartuKegiatan(g) {
  const foto = (g.foto || [])[0];
  return `<article class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex flex-col group cursor-pointer" data-aksi="buka-kegiatan" data-id="${esc(g.id)}" tabindex="0" role="button" aria-label="Lihat detail dokumentasi ${esc(g.judul)}">
    <div class="relative w-full aspect-[16/10] overflow-hidden bg-surface-container">
      ${gambar(foto && foto.id, 800, 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-500', g.judul)}
      <div class="absolute top-3 left-3 bg-status-available text-on-primary font-label-md text-body-sm px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">${ikon('calendar_today', 'text-[14px]')}<span>${fTgl(g.tanggal)}</span></div>
    </div>
    <div class="p-space-md flex-1 flex flex-col justify-between">
      <div>
        <h3 class="font-headline-sm text-headline-sm font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2 mb-1">${esc(g.judul)}</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed">${esc(g.ringkas)}</p>
      </div>
      <div class="mt-space-md pt-space-xs flex items-center text-primary font-label-md text-body-sm gap-1"><span>Lihat Detail Dokumentasi</span>${ikon('arrow_forward', 'text-[16px] group-hover:translate-x-1 transition-transform')}</div>
    </div>
  </article>`;
}

function htmlGaleriKegiatan() {
  const g = S.kegiatan;
  const isi = g.items.length
    ? `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg" id="grid-kegiatan">${g.items.map(kartuKegiatan).join('')}</div>`
    : `<p class="text-center font-body-md text-body-md text-on-surface-variant py-space-lg">Belum ada dokumentasi kegiatan.</p>`;
  return `<section class="mt-space-xl pt-space-lg" id="bagian-kegiatan">
    <div class="mb-space-lg text-center max-w-2xl mx-auto">
      <h2 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface tracking-tight">Galeri Kegiatan</h2>
      <div class="w-12 h-[3px] mx-auto mt-2 mb-3 rounded-full bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end"></div>
      <p class="font-body-md text-body-md text-on-surface-variant">Momen kebersamaan dan perawatan fasilitas Kost AB6</p>
    </div>
    ${isi}
    ${g.adaLagi ? `<div class="mt-space-xl text-center"><button type="button" data-aksi="muat-kegiatan" class="inline-flex items-center justify-center gap-space-sm px-space-xl py-3 rounded-full bg-surface-container-lowest text-primary-container font-headline-sm text-body-md shadow-sm hover:bg-primary hover:text-on-primary transition-all">${ikon('cached', 'text-[18px]')}<span>Muat Lebih Banyak</span></button></div>` : ''}
  </section>`;
}

function htmlCtaBeranda() {
  return `<section class="mt-space-xl mb-space-md bg-gradient-to-r from-[#0A2540] to-primary rounded-xl p-space-lg md:p-space-xl text-on-primary flex flex-col md:flex-row items-start md:items-center justify-between gap-space-lg shadow-sm">
    <div class="max-w-xl">
      <span class="font-label-md text-label-md uppercase tracking-wider text-secondary-fixed">Siap Pindah Hunian?</span>
      <h3 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-primary mt-1">Jadwalkan Kunjungan Survei Lokasi Sekarang</h3>
      <p class="font-body-md text-body-md text-surface-container-high mt-space-xs">Konsultasikan ketersediaan kamar, tipe ruangan, dan nikmati diskon khusus masa sewa tahunan bersama manajer operasional kami.</p>
    </div>
    <div class="flex flex-wrap items-center gap-space-md flex-shrink-0">
      <a href="#" data-nav="kamar" class="px-space-lg py-3 rounded-full bg-surface-container-lowest text-primary font-headline-sm text-body-md shadow hover:bg-surface-bright transition-all">Cek Katalog Kamar</a>
      <a ${waAttr(PesanWA.umum())} aria-label="Tanya langsung di WhatsApp" class="px-space-lg py-3 rounded-full bg-status-available text-on-primary font-headline-sm text-body-md shadow hover:bg-secondary transition-all flex items-center gap-1.5">${ikon('chat', 'text-[18px]')}<span>Hubungi Pengelola</span></a>
    </div>
  </section>`;
}

function bukaKegiatan(id) {
  const g = S.kegiatan.items.filter(x => x.id === id)[0];
  if (!g) return;
  const foto = (g.foto || []).filter(f => f && f.id);
  let i = 0;
  const item = Modal.buka({
    lebar: 'max-w-3xl', kelasPanel: 'p-0', label: g.judul,
    isi: `
      <div class="relative w-full aspect-[16/10] bg-surface-container overflow-hidden rounded-t-2xl">
        <div data-kg="foto" class="w-full h-full">${gambar(foto[0] && foto[0].id, 1600, 'w-full h-full object-cover', g.judul)}</div>
        ${foto.length > 1 ? `
          <button type="button" data-kg="prev" aria-label="Foto sebelumnya" class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-surface-page/90 flex items-center justify-center shadow">${ikon('chevron_left')}</button>
          <button type="button" data-kg="next" aria-label="Foto berikutnya" class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-surface-page/90 flex items-center justify-center shadow">${ikon('chevron_right')}</button>` : ''}
        <div class="absolute top-3 left-3 bg-status-available text-on-primary font-label-md text-body-sm px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">${ikon('calendar_today', 'text-[14px]')}<span>${fTgl(g.tanggal, 'panjang')}</span></div>
        <button type="button" data-kg="tutup" aria-label="Tutup" class="absolute top-3 right-3 w-10 h-10 rounded-full bg-surface-page/90 flex items-center justify-center shadow">${ikon('close')}</button>
        <p data-kg="ket" class="absolute bottom-3 left-3 right-3 text-on-primary font-body-sm text-body-sm drop-shadow"></p>
      </div>
      <div class="p-space-lg flex flex-col gap-space-sm">
        <h3 class="font-headline-md text-headline-md text-on-surface">${esc(g.judul)}</h3>
        <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed whitespace-pre-line">${esc(g.deskripsi || g.ringkas)}</p>
      </div>`
  });
  const p = item.panel;
  const tampil = () => {
    p.querySelector('[data-kg=foto]').innerHTML = gambar(foto[i] && foto[i].id, 1600, 'w-full h-full object-cover', g.judul);
    p.querySelector('[data-kg=ket]').textContent = (foto[i] && foto[i].keterangan) || '';
  };
  tampil();
  p.querySelector('[data-kg=tutup]').addEventListener('click', () => Modal.tutup(item));
  if (foto.length > 1) {
    item.tombolKiri = () => { i = (i - 1 + foto.length) % foto.length; tampil(); };
    item.tombolKanan = () => { i = (i + 1) % foto.length; tampil(); };
    p.querySelector('[data-kg=prev]').addEventListener('click', item.tombolKiri);
    p.querySelector('[data-kg=next]').addEventListener('click', item.tombolKanan);
  }
}

// ════════════════════════════════════════════════════════════
// BAGIAN 11: HALAMAN KATALOG KAMAR
// ════════════════════════════════════════════════════════════

RENDER.kamar = function (el, param) {
  if (param && param.filter === 'tersedia') {
    S.katalog.filter = 'tersedia';
    S.katalog.halaman = 1;
    param.filter = '';
  }
  if (!S.kamar) { el.innerHTML = kerangkaHalaman(); return; }
  const semua = S.kamar.items;
  const tersedia = semua.filter(k => k.status === 'Tersedia');
  const daftar = S.katalog.filter === 'tersedia' ? tersedia : semua;
  const per = 6;
  const totalHal = Math.max(1, Math.ceil(daftar.length / per));
  S.katalog.halaman = Math.min(S.katalog.halaman, totalHal);
  const mulai = (S.katalog.halaman - 1) * per;
  const tampil = daftar.slice(mulai, mulai + per);
  const tabKelas = on => 'filter-tab px-space-md py-2 rounded-full font-headline-sm text-body-sm font-semibold transition-all duration-200 ' +
    (on ? 'bg-primary-container text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface');
  const kosong = S.katalog.filter === 'tersedia'
    ? `<div class="col-span-full text-center py-space-xl flex flex-col items-center gap-space-md">
        <div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline">${ikon('bed', 'text-[32px]')}</div>
        <p class="font-body-md text-body-md text-on-surface-variant">Semua kamar sedang terisi. Hubungi admin untuk daftar tunggu.</p>
        <a ${waAttr(PesanWA.umum())} class="inline-flex items-center gap-2 px-space-lg py-3 rounded-full bg-whatsapp-green text-on-primary font-headline-sm text-body-md shadow-sm">${ikon('chat', 'text-[20px]')}Chat WhatsApp Admin</a></div>`
    : `<p class="col-span-full text-center py-space-xl font-body-md text-body-md text-on-surface-variant">Belum ada data kamar.</p>`;

  el.innerHTML = `<div class="flex flex-col w-full">
    <section class="${WADAH} pt-space-xl pb-space-lg">
      ${remah('Katalog Kamar').replace('mb-space-md', 'mb-space-sm')}
      <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg pt-space-xs">
        <div class="space-y-space-xs max-w-2xl">
          <div class="inline-block relative">
            <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">Katalog Kamar Kost AB6</h1>
            <div class="h-[4px] w-12 rounded-full bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end mt-2"></div>
          </div>
          <p class="font-body-md text-body-md text-on-surface-variant pt-1 leading-relaxed">Pilihan kamar nyaman dengan fasilitas lengkap, bersih, dan siap huni. Dirancang dengan ventilasi alami dan tata ruang ergonomis untuk ketenangan istirahat dan produktivitas Anda.</p>
        </div>
        <div class="flex items-center self-start lg:self-end bg-surface-container p-1 rounded-full shadow-inner" role="tablist" aria-label="Filter kamar">
          <button type="button" role="tab" aria-selected="${S.katalog.filter === 'semua'}" data-aksi="katalog-filter" data-filter="semua" class="${tabKelas(S.katalog.filter === 'semua')}">Semua Kamar (${semua.length})</button>
          <button type="button" role="tab" aria-selected="${S.katalog.filter === 'tersedia'}" data-aksi="katalog-filter" data-filter="tersedia" class="${tabKelas(S.katalog.filter === 'tersedia')}">Kamar Tersedia (${tersedia.length})</button>
        </div>
      </div>
    </section>
    <section class="${WADAH} py-space-md">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">${tampil.length ? tampil.map(kartuKamar).join('') : kosong}</div>
    </section>
    <section class="${WADAH} py-space-md">
      <div class="p-space-lg rounded-[16px] shadow-sm relative overflow-hidden bg-gradient-to-r from-[#E6F4EA] via-[#EBF5FB] to-[#E0F7FA] flex flex-col md:flex-row items-start md:items-center justify-between gap-space-lg">
        <div class="flex items-center gap-space-md max-w-2xl">
          <div class="w-14 h-14 shrink-0 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-sm text-primary">${ikon('support_agent', 'text-[28px]')}</div>
          <div class="space-y-1">
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Bingung Memilih Tipe Kamar yang Tepat?</h3>
            <p class="font-body-md text-body-md text-on-surface-variant">Konsultasikan kebutuhan hunian Anda langsung dengan pengelola kami untuk ketersediaan tanggal check-in, durasi sewa, dan kunjungan survei.</p>
          </div>
        </div>
        <a ${waAttr(PesanWA.umum())} class="inline-flex items-center gap-space-xs px-space-lg py-3 rounded-full bg-whatsapp-green text-on-primary font-headline-sm text-body-md font-semibold shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap">${ikon('chat', 'text-[20px]')}Chat WhatsApp Admin</a>
      </div>
    </section>
    ${daftar.length ? `<section class="${WADAH} pt-space-sm pb-space-xl">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-space-md pt-space-md">
        <p class="font-body-sm text-body-sm text-on-surface-variant">Menampilkan <span class="font-semibold text-on-surface">${mulai + 1}-${mulai + tampil.length}</span> dari <span class="font-semibold text-on-surface">${daftar.length}</span> tipe kamar</p>
        ${paginasiKatalog(S.katalog.halaman, totalHal)}
      </div>
    </section>` : '<div class="pb-space-xl"></div>'}
  </div>`;
};

function kartuKamar(k) {
  const terisi = k.status === 'Terisi';
  const foto = (k.foto || [])[0];
  const tombolKanan = terisi
    ? `<a ${waAttr(PesanWA.terisi(k))} class="flex-1 h-10 px-3 rounded-lg font-headline-sm text-body-sm font-semibold text-tertiary bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1 text-center">Tanya Info Kamar</a>`
    : `<a ${waAttr(PesanWA.tersedia(k))} class="flex-1 h-10 px-3 rounded-lg font-headline-sm text-body-sm font-semibold text-on-primary bg-whatsapp-green hover:opacity-95 transition-all shadow-sm flex items-center justify-center gap-1.5">${ikon('chat', 'text-[18px]')}Tanya via WA</a>`;
  return `<article class="room-card group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${terisi ? 'opacity-90' : ''}">
    <a href="#" data-nav="detail" data-kode="${esc(k.kode)}" class="relative block w-full aspect-[4/3] overflow-hidden bg-surface-container-low" aria-label="Lihat detail ${esc(k.nama)}">
      ${gambar(foto && foto.id, 800, `w-full h-full object-cover ${terisi ? 'grayscale-[25%] contrast-90' : ''} group-hover:scale-105 transition-transform duration-500`, k.nama)}
      ${terisi ? '<div class="absolute inset-0 bg-on-surface/10"></div>' : ''}
      ${lencanaStatusFoto(k.status)}
      ${(k.foto || []).length ? `<div class="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-inverse-surface/80 backdrop-blur-sm text-inverse-on-surface font-body-sm text-body-sm flex items-center gap-1">${ikon('photo_camera', 'text-[16px] text-secondary-fixed')}${k.foto.length} Foto</div>` : ''}
    </a>
    <div class="flex flex-col flex-1 p-space-md justify-between">
      <div class="space-y-space-xs">
        <div class="flex items-start justify-between gap-2">
          <h2 class="font-headline-md text-headline-md text-on-surface tracking-tight group-hover:text-primary transition-colors"><a href="#" data-nav="detail" data-kode="${esc(k.kode)}">${esc(k.nama)}</a></h2>
          <span class="font-body-sm text-body-sm text-on-surface-variant font-mono bg-surface-container-low px-2 py-0.5 rounded whitespace-nowrap">Lt. ${esc(k.lantai)}</span>
        </div>
        <div class="flex items-baseline gap-1"><span class="font-label-numeric text-label-numeric font-bold text-primary-container">${rupiah(k.harga)}</span><span class="font-body-sm text-body-sm text-on-surface-variant">/bulan</span></div>
        <p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 pt-0.5">${ikon('square_foot', 'text-[16px] text-tertiary')}${esc(spekRingkas(k))}</p>
        <div class="flex flex-wrap gap-1.5 pt-2">${daftarChipKamar(k)}</div>
      </div>
      <div class="pt-space-md mt-space-sm flex items-center gap-2">
        <button type="button" data-nav="detail" data-kode="${esc(k.kode)}" class="flex-1 h-10 px-3 rounded-lg font-headline-sm text-body-sm font-semibold ${terisi ? 'text-on-primary bg-primary-container hover:opacity-95' : 'text-primary-container bg-primary-fixed/30 hover:bg-primary-fixed/60'} transition-colors flex items-center justify-center">Lihat Detail</button>
        ${tombolKanan}
      </div>
    </div>
  </article>`;
}

function paginasiKatalog(hal, total) {
  const btn = (isi, h, aktif, mati) => mati
    ? `<button type="button" disabled class="px-3.5 py-1.5 rounded-full bg-surface-container-low text-outline-variant font-headline-sm text-body-sm flex items-center gap-1 cursor-not-allowed">${isi}</button>`
    : `<button type="button" data-aksi="katalog-hal" data-hal="${h}" ${aktif ? 'aria-current="page"' : ''} class="${typeof isi === 'number' ? 'w-8 h-8' : 'px-3.5 py-1.5'} rounded-full ${aktif ? 'bg-primary-container text-on-primary shadow-sm' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'} transition-colors font-headline-sm text-body-sm font-semibold flex items-center justify-center gap-1">${isi}</button>`;
  let angkaHal = '';
  for (let i = 1; i <= total; i++) angkaHal += btn(i, i, i === hal, false);
  return `<nav aria-label="Pagination" class="flex items-center gap-2">
    ${btn(ikon('chevron_left', 'text-[16px]') + 'Prev', hal - 1, false, hal <= 1)}
    ${angkaHal}
    ${btn('Next' + ikon('chevron_right', 'text-[16px]'), hal + 1, false, hal >= total)}
  </nav>`;
}

// ════════════════════════════════════════════════════════════
// BAGIAN 12: HALAMAN DETAIL KAMAR
// ════════════════════════════════════════════════════════════

RENDER.detail = function (el, param) {
  const kode = param && param.kode;
  const k = cariKamar(kode);
  if (k) { renderDetailIsi(el, k); return; }
  if (S.kamar) {
    el.innerHTML = `<div class="${WADAH} py-space-xl text-center flex flex-col items-center gap-space-md">
      <div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline">${ikon('search_off', 'text-[32px]')}</div>
      <h1 class="font-headline-md text-headline-md text-on-surface">Kamar tidak ditemukan</h1>
      <p class="font-body-md text-body-md text-on-surface-variant">Kamar mungkin sudah tidak tersedia di katalog.</p>
      <a href="#" data-nav="kamar" class="px-space-lg py-3 rounded-full bg-primary-container text-on-primary font-headline-sm text-body-md">Kembali ke Katalog Kamar</a></div>`;
    return;
  }
  el.innerHTML = kerangkaHalaman();
  panggil('ambilDetailKamar', kode).then(kamar => {
    if (S.rute.nama === 'detail' && S.rute.param.kode === kode && !S.kamar) renderDetailIsi(el, kamar);
  }).catch(() => { /* prefetch akan merender ulang */ });
};

function benefitKamar(k) {
  const daftar = [];
  if (k.listrik && k.air) daftar.push('Listrik & Air All-in');
  else if (k.listrik) daftar.push('Listrik Termasuk');
  else if (k.air) daftar.push('Air Bersih Termasuk');
  if (daftar.length && k.sampah) daftar[0] += ' (Bebas Iuran Tambahan)';
  else if (k.sampah) daftar.push('Bebas Iuran Sampah');
  return daftar.concat(((S.umum && S.umum.kamarInfo && S.umum.kamarInfo.benefitUmum) || []));
}

function renderDetailIsi(el, k) {
  const u = S.umum || {};
  const info = u.kamarInfo || {};
  const foto = (k.foto || []).filter(f => f && f.id);
  const kasur = KONST.KASUR[k.kasur] || {};
  const sirk = KONST.SIRKULASI[k.sirkulasi] || {};
  const luas = Math.round(k.panjang * k.lebar * 10) / 10;
  const terisi = k.status === 'Terisi';
  const jam = u.jamKerja || { buka: '08:00', tutup: '20:00' };
  const lainnya = ((S.kamar && S.kamar.items) || []).filter(x => x.kode !== k.kode)
    .sort((a, b) => (a.status === b.status ? a.urutan - b.urutan : (a.status === 'Tersedia' ? -1 : 1))).slice(0, 3);
  S.detailIdx = 0;
  const fasilitas = (k.fasilitas || []).map(f => ({
    ikon: f.ikon, judul: String(f.judul || '').replace('{ukuran}', kasur.ukuran || ''), ket: f.keterangan
  })).concat((k.kustom || []).map(t => ({ ikon: 'check_circle', judul: t, ket: '' })));
  const spek = (ik, label, nilai, biru) => `<div class="flex items-center justify-between gap-3 text-body-md font-body-md">
      <span class="text-on-surface-variant flex items-center gap-2 whitespace-nowrap shrink-0">${ikon(ik, 'text-[18px] text-tertiary')}${label}</span>
      <span class="font-semibold text-right ${biru ? 'text-primary-container' : 'text-on-surface'}">${nilai}</span></div>`;
  const video = urlEmbedVideo(k.video);

  el.innerHTML = `<div class="flex flex-col w-full"><div class="${WADAH} py-space-lg">
    <div class="flex items-center justify-between mb-space-lg gap-3">
      <a href="#" data-nav="kamar" class="inline-flex items-center gap-space-xs font-label-md text-label-md text-primary-container hover:opacity-80 transition-opacity group">${ikon('arrow_back', 'text-[18px] group-hover:-translate-x-0.5 transition-transform')}<span>Kembali ke Katalog Kamar</span></a>
      <div class="hidden sm:flex items-center gap-space-sm text-on-surface-variant font-body-sm text-body-sm">
        <a href="#" data-nav="kamar" class="hover:text-primary">Katalog</a><span>/</span><span>Lantai ${esc(k.lantai)}</span><span>/</span><span class="text-on-surface font-semibold">${esc(namaKamarPendek(k.nama))}</span>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
      <div class="lg:col-span-8 flex flex-col gap-space-xl">
        <div class="flex flex-col gap-space-sm">
          <div class="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-surface-container shadow-md group">
            <div id="galeri-utama" class="w-full h-full">${gambar(foto[0] && foto[0].id, 1600, 'w-full h-full object-cover transition-all duration-500 ease-out', k.nama, true)}</div>
            <div class="absolute inset-0 bg-gradient-to-t from-inverse-surface/30 via-transparent to-transparent pointer-events-none"></div>
            <div class="absolute top-space-md left-space-md flex items-center gap-space-xs">
              <span class="px-3 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md font-label-md text-body-sm text-primary-container shadow-sm flex items-center gap-1">${ikon('verified', 'text-[16px] text-primary')}Foto Asli Terverifikasi</span>
            </div>
            ${foto.length ? `<button type="button" data-aksi="galeri-perbesar" aria-label="Perbesar foto" class="absolute bottom-space-md right-space-md inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-inverse-surface/85 backdrop-blur-md text-on-primary font-label-md text-body-sm hover:bg-inverse-surface transition-all shadow-md">${ikon('fullscreen', 'text-[18px]')}<span class="hidden sm:inline">Perbesar Layar</span></button>` : ''}
          </div>
          ${foto.length > 1 ? `<div class="flex gap-space-xs sm:gap-space-sm overflow-x-auto" id="strip-thumb">${foto.map((f, i) => `
            <button type="button" data-aksi="galeri-pilih" data-i="${i}" aria-label="Tampilkan foto ${i + 1}" class="thumb-btn relative shrink-0 w-[calc((100%-1rem)/5)] sm:w-[calc((100%-2rem)/5)] aspect-[16/10] rounded-lg overflow-hidden bg-surface-container-high transition-all ${i === 0 ? 'ring-2 ring-primary-container' : 'opacity-80 hover:opacity-100'}">
              ${gambar(f.id, 320, 'w-full h-full object-cover', f.keterangan || 'Foto ' + (i + 1))}
            </button>`).join('')}</div>` : ''}
        </div>

        <div class="flex flex-col gap-space-md">
          <div class="relative pb-2"><h2 class="font-headline-md text-headline-md text-on-surface">Fasilitas Kamar</h2><div class="h-[2px] w-24 bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end rounded-full mt-1.5"></div></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-space-md">${fasilitas.map(f => `
            <div class="flex items-start gap-space-sm p-space-md bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div class="w-10 h-10 rounded-lg bg-tertiary-fixed/40 text-primary-container flex items-center justify-center shrink-0">${ikon(f.ikon, 'text-[22px]')}</div>
              <div class="flex flex-col min-w-0"><span class="font-headline-sm text-body-lg font-semibold text-on-surface leading-snug">${esc(f.judul)}</span>${f.ket ? `<span class="font-body-sm text-body-sm text-on-surface-variant">${esc(f.ket)}</span>` : ''}</div>
            </div>`).join('')}</div>
        </div>

        <div class="flex flex-col gap-space-sm p-space-lg bg-surface-container-lowest rounded-xl shadow-sm">
          <div class="flex items-center gap-space-xs text-primary-container">${ikon('notes', 'text-[22px]')}<h3 class="font-headline-sm text-headline-sm text-on-surface">Deskripsi Kamar</h3></div>
          <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed text-justify whitespace-pre-line">${esc(k.deskripsi)}</p>
          <div class="mt-space-sm grid grid-cols-2 sm:grid-cols-4 gap-space-sm pt-space-sm">
            ${[['Pencahayaan', info.pencahayaan], ['Sirkulasi', sirk.ringkas], ['Kapasitas', info.kapasitas], ['Kebijakan Tamu', info.kebijakanTamu]].map(x => `
              <div class="bg-surface-subtle p-3 rounded-lg flex flex-col"><span class="font-body-sm text-body-sm text-outline">${x[0]}</span><span class="font-label-md text-body-md text-on-surface font-semibold">${esc(x[1] || '-')}</span></div>`).join('')}
          </div>
        </div>

        ${video ? `<div class="flex flex-col gap-space-sm" id="tur-video">
          <div class="flex items-center justify-between"><h3 class="font-headline-sm text-headline-sm text-on-surface">Tur Video Kamar</h3><span class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-status-available animate-pulse"></span>Resolusi HD 1080p</span></div>
          <div class="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-inverse-surface shadow-md group cursor-pointer" id="kartu-video" data-aksi="putar-video" role="button" tabindex="0" aria-label="Putar video tur ${esc(k.nama)}">
            ${gambar(foto[0] && foto[0].id, 1280, 'w-full h-full object-cover opacity-80 group-hover:scale-105 group-hover:opacity-90 transition-all duration-700', '')}
            <div class="absolute inset-0 bg-gradient-to-t from-inverse-surface/80 via-inverse-surface/30 to-transparent"></div>
            <div class="absolute top-space-md left-space-md"><span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-inverse-surface/80 backdrop-blur-md text-on-primary font-label-md text-body-sm">${ikon('videocam', 'text-[16px] text-gradient-mid')}Video Tur Kamar</span></div>
            <div class="absolute inset-0 flex items-center justify-center"><div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-xl group-hover:scale-110 group-active:scale-95 transition-transform duration-300">${ikon('play_arrow', 'text-[36px] sm:text-[44px] ml-1')}</div></div>
            <div class="absolute bottom-space-md left-space-md right-space-md flex items-center justify-between text-on-primary">
              <div class="flex flex-col"><span class="font-headline-sm text-body-lg font-semibold text-on-primary">Walkthrough Lengkap ${esc(k.nama)}</span><span class="font-body-sm text-body-sm text-surface-container-high">Eksplorasi setiap sudut kamar sebelum survei langsung</span></div>
              <div class="hidden sm:flex items-center gap-1 text-on-primary font-label-md text-body-sm">${ikon('volume_up', 'text-[18px]')}<span>Audio Tersedia</span></div>
            </div>
          </div>
        </div>` : ''}

        ${lainnya.length ? `<div class="flex flex-col gap-space-md mt-space-sm">
          <div class="flex items-center justify-between">
            <div><h3 class="font-headline-sm text-headline-md text-on-surface">Tipe Kamar Lainnya</h3><p class="font-body-sm text-body-sm text-on-surface-variant">Pilihan alternatif dengan ketersediaan aktif di Kost AB6</p></div>
            <a href="#" data-nav="kamar" class="hidden sm:inline-flex items-center gap-1 font-label-md text-body-sm text-primary-container hover:underline">Lihat Semua Kamar${ikon('arrow_forward', 'text-[16px]')}</a>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md">${lainnya.map(x => `
            <div class="flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
              <a href="#" data-nav="detail" data-kode="${esc(x.kode)}" class="relative block w-full aspect-[16/10] overflow-hidden bg-surface-container">
                ${gambar((x.foto[0] || {}).id, 600, 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-500', x.nama)}
                <span class="absolute top-2 left-2 px-2 py-0.5 rounded-full ${x.status === 'Terisi' ? 'bg-primary-container' : 'bg-status-available'} text-on-primary font-label-md text-body-sm">${esc(x.status)}</span>
                <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-inverse-surface/75 text-on-primary font-body-sm text-body-sm backdrop-blur-sm">Lantai ${esc(x.lantai)}</span>
              </a>
              <div class="p-space-md flex flex-col flex-1 justify-between gap-space-sm">
                <div><h4 class="font-headline-sm text-body-lg font-bold text-on-surface group-hover:text-primary transition-colors">${esc(x.nama)}</h4><p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">${esc(spekRingkas(x))}</p></div>
                <div class="pt-space-xs flex flex-wrap items-center justify-between gap-2"><div class="whitespace-nowrap"><span class="font-headline-sm text-headline-sm text-primary-container font-bold">${rupiah(x.harga)}</span><span class="font-body-sm text-body-sm text-outline"> / bln</span></div>
                  <a href="#" data-nav="detail" data-kode="${esc(x.kode)}" class="shrink-0 px-3 py-1.5 rounded-lg bg-surface-subtle hover:bg-primary hover:text-on-primary text-primary-container font-label-md text-body-sm transition-colors">Detail</a></div>
              </div>
            </div>`).join('')}</div>
        </div>` : ''}
      </div>

      <div class="lg:col-span-4 lg:sticky lg:top-[88px] flex flex-col gap-space-md">
        <div class="bg-surface-container-lowest rounded-xl shadow-md p-space-lg flex flex-col gap-space-md">
          <div class="flex items-center justify-between gap-2">
            ${terisi
              ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DBEAFE] text-[#1D4ED8] font-label-md text-body-sm font-semibold"><span class="w-2 h-2 rounded-full bg-[#1D4ED8]"></span>Terisi</span>`
              : `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCFCE7] text-[#166534] font-label-md text-body-sm font-semibold"><span class="w-2 h-2 rounded-full bg-status-available animate-pulse"></span>Tersedia Siap Huni</span>`}
            <span class="font-label-md text-body-sm text-outline-variant font-mono">KODE: ${esc(k.kode)}</span>
          </div>
          <div><h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface tracking-tight">${esc(k.nama)}</h1><p class="font-body-md text-body-md text-on-surface-variant mt-0.5">Kost AB6 Unit Lantai ${esc(k.lantai)}${k.label ? ' · ' + esc(k.label) : ''}</p></div>
          <div class="p-space-md bg-surface-subtle rounded-xl flex items-baseline justify-between gap-2 flex-wrap">
            <div><span class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary-container font-bold tracking-tight">${rupiah(k.harga)}</span><span class="font-body-md text-body-md text-on-surface-variant"> / bulan</span></div>
            <span class="text-secondary font-label-md text-body-sm font-semibold bg-secondary-container/40 px-2 py-0.5 rounded">Fixed Rate</span>
          </div>
          <div class="flex flex-col gap-2.5 py-1">
            ${spek('straighten', 'Dimensi Kamar', `${desimal(k.panjang)} x ${desimal(k.lebar)} m (${String(luas).replace('.', ',')} m²)`)}
            ${spek('single_bed', 'Tipe Kasur', esc(kasur.spek || '-'))}
            ${spek('water_damage', 'Kamar Mandi', k.kamarMandi === 'Dalam' ? 'Dalam (Water Heater)' : 'Luar (Bersih Terawat)', k.kamarMandi === 'Dalam')}
            ${spek('layers', 'Lokasi Lantai', 'Lantai ' + esc(k.lantai) + (k.posisi ? ' (' + esc(k.posisi.replace(/^Lantai \d+\s*-\s*/i, '')) + ')' : ''))}
          </div>
          <div class="h-[1px] w-full bg-surface-container"></div>
          <div class="flex flex-col gap-2">
            <span class="font-label-md text-body-sm font-semibold text-on-surface uppercase tracking-wider">Benefit Termasuk Sewa:</span>
            ${benefitKamar(k).map(b => `<div class="flex items-center gap-2 text-body-sm font-body-sm text-on-surface-variant">${ikon('check_circle', 'text-[18px] text-status-available shrink-0')}<span>${esc(b)}</span></div>`).join('')}
          </div>
          <div class="flex flex-col gap-2.5 pt-space-xs">
            <a ${waAttr(terisi ? PesanWA.terisi(k) : PesanWA.tersedia(k))} class="w-full h-12 rounded-lg bg-whatsapp-green hover:opacity-95 text-on-primary font-headline-sm text-body-md font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]">${ikon('chat', 'text-[22px]')}<span>${terisi ? 'Tanya Info Kamar' : 'Tanya via WhatsApp'}</span></a>
            ${video ? `<button type="button" data-aksi="tonton-video" class="w-full h-11 rounded-lg bg-surface-page text-primary-container font-headline-sm text-body-md font-semibold flex items-center justify-center gap-2 shadow-sm hover:bg-surface-subtle transition-all">${ikon('smart_display', 'text-[20px]')}<span>Tonton Video Kamar</span></button>` : ''}
          </div>
          <div class="p-3 bg-surface-container-low rounded-lg flex items-start gap-2.5">${ikon('schedule', 'text-[18px] text-primary mt-0.5 shrink-0')}<p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">Respon cepat oleh pengelola kost dalam waktu &lt; ${esc(u.responMenit || 15)} menit pada jam kerja (${esc(jam.buka)} - ${esc(jam.tutup)} WIB).</p></div>
          <div class="text-center pt-1"><a ${waAttr(PesanWA.survei(k))} class="inline-flex items-center gap-1 font-label-md text-body-md text-primary-container hover:underline group"><span>Jadwalkan Survei Langsung ke Lokasi</span>${ikon('arrow_forward', 'text-[16px] group-hover:translate-x-1 transition-transform')}</a></div>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center gap-space-md">
          <div class="w-12 h-12 rounded-full bg-secondary-fixed/50 flex items-center justify-center text-secondary shrink-0">${ikon('verified_user', 'text-[24px]')}</div>
          <div class="flex flex-col"><span class="font-headline-sm text-body-md font-bold text-on-surface">Jaminan Transparansi 100%</span><span class="font-body-sm text-body-sm text-on-surface-variant">Foto asli tanpa editan distorsi lensa. Biaya sewa jujur tanpa biaya tersembunyi.</span></div>
        </div>
      </div>
    </div>
  </div></div>`;
  el.dataset.kode = k.kode;
}

function pilihFotoDetail(i) {
  const k = cariKamar(S.rute.param.kode);
  if (!k) return;
  const foto = (k.foto || []).filter(f => f && f.id);
  if (!foto[i]) return;
  S.detailIdx = i;
  $('#galeri-utama').innerHTML = gambar(foto[i].id, 1600, 'w-full h-full object-cover transition-all duration-500 ease-out', foto[i].keterangan || k.nama);
  $$('#strip-thumb .thumb-btn').forEach((b, n) => {
    b.classList.toggle('ring-2', n === i);
    b.classList.toggle('ring-primary-container', n === i);
    b.classList.toggle('opacity-80', n !== i);
  });
}

function putarVideoDetail() {
  const k = cariKamar(S.rute.param.kode);
  const kartu = $('#kartu-video');
  if (!k || !kartu || kartu.dataset.putar) return;
  kartu.dataset.putar = '1';
  kartu.removeAttribute('data-aksi');
  kartu.classList.remove('cursor-pointer');
  kartu.innerHTML = iframeVideo(k.video, 'Video tur ' + k.nama);
}

// ════════════════════════════════════════════════════════════
// BAGIAN 13: HALAMAN TESTIMONI + FORMULIR
// ════════════════════════════════════════════════════════════

RENDER.testimoni = function (el) {
  renderTestimoniBagian();
  if (!$('#testi-form').dataset.siap) renderFormTesti();
};

function kartuTestiPenuh(t) {
  const sub = labelPenulis(t, true) + (t.profesi ? ' · ' + t.profesi : '');
  return `<article class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
    <div class="space-y-space-md">
      <div class="flex items-start gap-space-md">
        ${avatarTesti(t, 'w-[56px] h-[56px]')}
        <div class="min-w-0 flex-1">
          <h3 class="font-headline-sm text-headline-sm text-on-surface leading-snug group-hover:text-primary transition-colors">${esc(t.nama)}</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${esc(sub)}</p>
          <time class="font-body-sm text-body-sm text-outline block mt-0.5" datetime="${esc(fTgl(t.tanggal, 'iso'))}">${fTgl(t.tanggal, 'panjang')}</time>
        </div>
      </div>
      <div class="relative">
        ${ikon('format_quote', 'absolute -top-1 -left-2 text-[28px] text-surface-container-highest opacity-70 select-none')}
        <p class="relative z-10 font-body-md text-body-md text-on-surface leading-relaxed pt-1">“${esc(t.isi)}”</p>
      </div>
      ${t.fotoBukti ? `<div class="pt-space-xs"><button type="button" data-aksi="lihat-bukti" data-id="${esc(t.id)}" class="block w-full overflow-hidden rounded-lg aspect-[16/9] bg-surface-container-high relative group/thumb" aria-label="Perbesar foto bukti">
        ${gambar(t.fotoBukti, 800, 'w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-105', t.ketBukti || 'Foto bukti dari ' + t.nama)}
        <div class="absolute inset-0 bg-gradient-to-t from-inverse-surface/60 via-transparent to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-end p-space-sm"><span class="text-on-primary font-body-sm text-body-sm flex items-center gap-1">${ikon('photo_camera', 'text-[14px]')}${esc(t.ketBukti || 'Perbesar foto')}</span></div>
      </button></div>` : ''}
    </div>
    ${t.tag ? `<div class="mt-space-md pt-space-sm flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm">${ikon(t.ikonTag || 'verified', 'text-[16px] text-secondary')}<span>${esc(t.tag)}</span></div>` : ''}
  </article>`;
}

function semuaTestiPublik() {
  return S.testiDaftar.items;
}

function renderTestimoniBagian() {
  const atas = $('#testi-atas');
  const daftar = $('#testi-daftar');
  const stat = (S.umum && S.umum.testimoniStat) || [];
  const jumlah = S.testiDaftar.jumlah || 0;
  atas.innerHTML = `<div class="relative w-full overflow-hidden">
    <div class="absolute -top-32 right-1/4 w-96 h-96 bg-secondary-fixed/20 rounded-full blur-3xl pointer-events-none -z-10"></div>
    <div class="absolute top-20 left-10 w-80 h-80 bg-primary-fixed/30 rounded-full blur-3xl pointer-events-none -z-10"></div>
    <section class="${WADAH} pt-space-xl pb-space-lg">
      ${remah('Testimoni')}
      <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
        <div class="max-w-3xl space-y-space-sm">
          ${S.testimoni ? `<div class="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-secondary-container/50 text-on-secondary-container shadow-sm">${ikon('verified', 'text-[16px] text-secondary')}<span class="font-label-md text-label-md">${angka(jumlah)} Ulasan Terverifikasi</span></div>` : kerangkaBlok('h-7 w-48')}
          <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight leading-snug">Pengalaman Nyata Tinggal di Kost AB6</h1>
          <div class="w-12 h-1 rounded-full bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end mt-space-xs mb-space-sm"></div>
          <p class="font-body-lg text-body-md md:text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">Simak cerita autentik dan pengalaman sehari-hari dari mahasiswa dan profesional yang memilih Kost AB6 sebagai rumah kedua mereka.</p>
        </div>
        ${stat.length ? `<div class="flex items-center gap-space-lg bg-surface-container-lowest p-space-md rounded-xl shadow-sm self-start lg:self-auto">${stat.slice(0, 2).map((s, i) => `
          ${i ? '<div class="w-[1px] h-8 bg-surface-container-highest"></div>' : ''}
          <div class="flex items-center gap-space-sm">
            <div class="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center ${i ? 'text-secondary' : 'text-primary-container'}">${ikon(s.ikon || 'verified', 'text-[20px]')}</div>
            <div><p class="font-label-numeric text-label-numeric text-on-surface">${esc(s.nilai)}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${esc(s.label)}</p></div>
          </div>`).join('')}</div>` : ''}
      </div>
    </section></div>`;
  if (!S.testimoni) {
    daftar.innerHTML = `<section class="${WADAH} py-space-md"><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">${kerangkaBlok('h-64')}${kerangkaBlok('h-64')}${kerangkaBlok('h-64')}</div></section>`;
    return;
  }
  const items = semuaTestiPublik();
  daftar.innerHTML = `<section class="${WADAH} py-space-md">
    ${items.length ? `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">${items.map(kartuTestiPenuh).join('')}</div>`
      : `<div class="text-center py-space-xl flex flex-col items-center gap-space-md"><div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline">${ikon('rate_review', 'text-[32px]')}</div><p class="font-body-md text-body-md text-on-surface-variant">Belum ada testimoni. Jadilah yang pertama berbagi pengalaman.</p><button type="button" data-aksi="ke-form-testi" class="px-space-lg py-3 rounded-full bg-primary-container text-on-primary font-headline-sm text-body-md">Tulis Testimoni</button></div>`}
    ${S.testiDaftar.adaLagi ? `<div class="mt-space-xl flex justify-center"><button type="button" data-aksi="muat-testimoni" class="group inline-flex items-center gap-space-sm px-space-xl py-space-sm min-h-[44px] rounded-full bg-surface-container-lowest text-primary-container shadow-sm hover:bg-surface-container hover:shadow-md transition-all duration-200"><span class="font-headline-sm text-body-md font-semibold">Muat Lebih Banyak Testimoni</span>${ikon('expand_more', 'text-[20px] group-hover:translate-y-0.5 transition-transform')}</button></div>` : ''}
  </section>`;
}

const KELAS_INPUT_PUBLIK = 'w-full px-space-md h-11 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline-variant font-body-md text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary-container transition-all';

function galatKolom(nama) {
  return `<p data-galat="${nama}" class="font-body-sm text-body-sm text-error flex items-center gap-1" hidden></p>`;
}

function renderFormTesti() {
  const wadah = $('#testi-form');
  wadah.dataset.siap = '1';
  S.formTesti = { dibukaPada: Date.now(), profil: null, bukti: null };
  wadah.innerHTML = `<section class="${WADAH} py-space-xl" id="bagian-form-testi">
    <div class="max-w-[720px] mx-auto bg-surface-container-lowest rounded-2xl shadow-md overflow-hidden relative">
      <div class="h-1 w-full bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end"></div>
      <div class="p-space-lg sm:p-space-xl space-y-space-lg">
        <div class="text-center space-y-space-xs">
          <h2 class="font-headline-lg text-headline-md sm:text-headline-lg text-on-surface">Bagikan Pengalaman Anda</h2>
          <p class="font-body-md text-body-md text-on-surface-variant max-w-lg mx-auto">Cerita jujur Anda sangat berharga bagi kami untuk terus menyempurnakan kenyamanan hunian Kost AB6.</p>
        </div>
        <div class="bg-primary-fixed/20 p-space-md rounded-xl flex items-start gap-space-sm text-on-surface">
          ${ikon('info', 'text-[20px] text-primary-container shrink-0 mt-0.5')}
          <p class="font-body-sm text-body-sm leading-relaxed text-on-surface-variant"><strong class="font-semibold text-on-surface">Kebijakan Privasi:</strong> Nomor WhatsApp hanya digunakan oleh tim pengelola untuk verifikasi keaslian ulasan dan tidak akan pernah ditampilkan secara publik di situs web.</p>
        </div>
        <form class="space-y-space-md" data-kirim="testimoni" novalidate>
          <div class="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
            <label for="testi-website">Website</label><input id="testi-website" name="website" type="text" tabindex="-1" autocomplete="off">
          </div>
          <div class="space-y-space-xs">
            <label class="block font-label-md text-label-md text-on-surface" for="testi-nama">Nama Lengkap <span class="text-error">*</span></label>
            <input id="testi-nama" name="nama" type="text" maxlength="60" autocomplete="name" required placeholder="Contoh: Dimas Aditya Pratama" class="${KELAS_INPUT_PUBLIK}">
            ${galatKolom('nama')}
          </div>
          <div class="space-y-space-xs">
            <div class="flex items-center justify-between">
              <label class="block font-label-md text-label-md text-on-surface" for="testi-wa">Nomor WhatsApp <span class="font-body-sm text-body-sm text-outline font-normal">(Opsional)</span></label>
              <span class="font-body-sm text-body-sm text-outline">Privat &amp; Terproteksi</span>
            </div>
            <input id="testi-wa" name="wa" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="0812-xxxx-xxxx (Privat)" class="${KELAS_INPUT_PUBLIK}">
            ${galatKolom('wa')}
          </div>
          <div class="space-y-space-xs">
            <div class="flex items-center justify-between">
              <label class="block font-label-md text-label-md text-on-surface" for="testi-isi">Isi Testimoni <span class="text-error">*</span></label>
              <span class="font-body-sm text-body-sm text-outline" id="testi-hitung">0 / 500 karakter</span>
            </div>
            <textarea id="testi-isi" name="isi" maxlength="500" rows="4" required data-masukan="hitung-testi" placeholder="Ceritakan pengalaman Anda selama tinggal di Kost AB6..." class="w-full p-space-md rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline-variant font-body-md text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary-container transition-all resize-none leading-relaxed"></textarea>
            ${galatKolom('isi')}
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md pt-space-xs">
            <div class="space-y-space-xs">
              <span class="block font-label-md text-label-md text-on-surface">Foto Profil <span class="text-error">*</span></span>
              <label class="p-space-md bg-surface-container-low rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface-container transition-all relative focus-within:ring-2 focus-within:ring-primary-container">
                <input type="file" accept="image/png, image/jpeg, image/webp" data-ubah="testi-foto" data-jenis="profil" class="absolute inset-0 opacity-0 cursor-pointer" aria-label="Unggah foto profil">
                <div id="pratinjau-profil" class="w-16 h-16 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center text-outline group-hover:text-primary-container transition-colors mb-2 overflow-hidden">${ikon('account_circle', 'text-[28px]')}</div>
                <p class="font-label-md text-label-md text-primary-container">Unggah Foto Profil</p>
                <p class="font-body-sm text-body-sm text-outline mt-1 leading-snug">JPG, PNG, atau WebP. Maks 2MB, otomatis dikompres</p>
              </label>
              ${galatKolom('fotoProfil')}
            </div>
            <div class="space-y-space-xs">
              <span class="block font-label-md text-label-md text-on-surface">Foto Bukti Suasana / Fasilitas <span class="font-body-sm text-body-sm text-outline font-normal">(Opsional)</span></span>
              <label class="p-space-md bg-surface-container-low rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface-container transition-all relative focus-within:ring-2 focus-within:ring-primary-container">
                <input type="file" accept="image/png, image/jpeg, image/webp" data-ubah="testi-foto" data-jenis="bukti" class="absolute inset-0 opacity-0 cursor-pointer" aria-label="Unggah foto bukti">
                <div id="pratinjau-bukti" class="w-24 h-16 rounded-lg bg-surface-container-lowest shadow-sm flex items-center justify-center text-outline group-hover:text-primary-container transition-colors mb-2 overflow-hidden">${ikon('add_a_photo', 'text-[28px]')}</div>
                <p class="font-label-md text-label-md text-primary-container">Unggah Foto Suasana (Opsional)</p>
                <p class="font-body-sm text-body-sm text-outline mt-1 leading-snug">Tunjukkan kamar atau sudut favorit Anda</p>
              </label>
              ${galatKolom('fotoBukti')}
            </div>
          </div>
          <div class="pt-space-md">
            <button type="submit" id="testi-kirim" class="w-full h-[48px] rounded-xl bg-primary-container hover:bg-[#0D47A1] text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-md hover:shadow-lg active:scale-[0.99] transition-all"><span>Kirim Testimoni Sekarang</span>${ikon('send', 'text-[20px]')}</button>
          </div>
          <p class="text-center font-body-sm text-body-sm text-outline mt-space-xs">Ulasan Anda akan langsung tampil di halaman ini. Tim Kost AB6 dapat menyembunyikan ulasan yang tidak sesuai ketentuan.</p>
        </form>
      </div>
    </div>
  </section>`;
}

/** Tampilkan/bersihkan pesan galat per kolom */
function aturGalatKolom(akar, galat) {
  $$('[data-galat]', akar).forEach(p => {
    const pesan = galat && galat[p.dataset.galat];
    p.hidden = !pesan;
    p.innerHTML = pesan ? ikon('error', 'text-[14px]') + esc(pesan) : '';
  });
  const pertama = $$('[data-galat]', akar).filter(p => !p.hidden)[0];
  if (pertama) pertama.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Galat untuk kolom yang tidak punya tempat pesan → tetap diberitahukan
  const ada = $$('[data-galat]', akar).map(p => p.dataset.galat);
  const sisa = galat ? Object.keys(galat).filter(k => ada.indexOf(k) < 0) : [];
  if (sisa.length) toast('Periksa kembali isian', galat[sisa[0]], 'galat');
}

/**
 * Kompres gambar di browser (canvas → JPEG) sebelum dikirim.
 * opsi: maks (px sisi terpanjang), target (byte), persegi (potong tengah)
 */
function kompresGambar(file, opsi) {
  opsi = opsi || {};
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('Pilih file foto.')); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { reject(new Error('Format foto harus JPG, PNG, atau WebP.')); return; }
    if (file.size > 2 * 1024 * 1024) { reject(new Error('Ukuran foto maksimal 2MB.')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let sw = img.naturalWidth;
        let sh = img.naturalHeight;
        let sx = 0;
        let sy = 0;
        if (opsi.persegi) {
          const s = Math.min(sw, sh);
          sx = (sw - s) / 2; sy = (sh - s) / 2; sw = s; sh = s;
        }
        const skala = Math.min(1, (opsi.maks || 1600) / Math.max(sw, sh));
        const w = Math.max(1, Math.round(sw * skala));
        const h = Math.max(1, Math.round(sh * skala));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        const target = opsi.target || 500 * 1024;
        let q = 0.82;
        let data = c.toDataURL('image/jpeg', q);
        while (ukuranDataUrl(data) > target && q > 0.5) {
          q -= 0.08;
          data = c.toDataURL('image/jpeg', q);
        }
        resolve({ dataUrl: data, lebar: w, tinggi: h, kb: Math.round(ukuranDataUrl(data) / 1024), nama: file.name });
      } catch (e) {
        reject(new Error('Foto tidak dapat diproses.'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('File bukan gambar yang valid.')); };
    img.src = url;
  });
}

function ukuranDataUrl(d) {
  return Math.floor((d.length - d.indexOf(',') - 1) * 3 / 4);
}

UBAH['testi-foto'] = async function (input) {
  const jenis = input.dataset.jenis;
  const file = input.files && input.files[0];
  const kunciGalat = jenis === 'profil' ? 'fotoProfil' : 'fotoBukti';
  const akar = $('#bagian-form-testi');
  if (!file) return;
  try {
    const hasil = await kompresGambar(file, jenis === 'profil'
      ? { maks: 400, target: 150 * 1024, persegi: true }
      : { maks: 1280, target: 400 * 1024 });
    S.formTesti[jenis] = hasil.dataUrl;
    const kotak = $(jenis === 'profil' ? '#pratinjau-profil' : '#pratinjau-bukti');
    kotak.innerHTML = `<img src="${hasil.dataUrl}" alt="Pratinjau foto" class="w-full h-full object-cover">`;
    const p = $(`[data-galat=${kunciGalat}]`, akar);
    p.hidden = true;
  } catch (e) {
    input.value = '';
    S.formTesti[jenis] = null;
    const p = $(`[data-galat=${kunciGalat}]`, akar);
    p.hidden = false;
    p.innerHTML = ikon('error', 'text-[14px]') + esc(e.message);
  }
};

MASUKAN['hitung-testi'] = function (el) {
  $('#testi-hitung').textContent = el.value.length + ' / 500 karakter';
};

KIRIM.testimoni = async function (form) {
  const nilai = n => (form.elements[n] ? form.elements[n].value : '').trim();
  const galat = {};
  const nama = nilai('nama');
  const wa = nilai('wa');
  const isi = nilai('isi');
  if (nama.length < 3) galat.nama = 'Nama wajib diisi (3–60 karakter).';
  const waAngka = wa.replace(/\D/g, '').replace(/^0/, '62').replace(/^8/, '628');
  if (wa && !/^628\d{7,12}$/.test(waAngka)) galat.wa = 'Format nomor WhatsApp tidak valid.';
  if (isi.length < 20) galat.isi = 'Testimoni minimal 20 karakter.';
  if (!S.formTesti.profil) galat.fotoProfil = 'Foto profil wajib diunggah (JPG, PNG, atau WebP, maks 2MB).';
  if (Object.keys(galat).length) { aturGalatKolom(form, galat); return; }
  aturGalatKolom(form, null);
  const tombol = $('#testi-kirim');
  tombolSibuk(tombol, true, 'Mengirim...');
  try {
    const res = await panggil('kirimTestimoni', {
      nama: nama, wa: wa, isi: isi, fotoProfil: S.formTesti.profil, fotoBukti: S.formTesti.bukti,
      website: nilai('website'), dibukaPada: S.formTesti.dibukaPada, idPerangkat: idPerangkat()
    });
    toast('Terima kasih!', 'Testimoni Anda sudah tampil.');
    if (res && res.testimoni) {
      S.testiDaftar.items.unshift(res.testimoni);
      S.testiDaftar.jumlah = (S.testiDaftar.jumlah || 0) + 1;
      S.json.testimoni = '';
      S.json.beranda = '';
    }
    $('#testi-form').dataset.siap = '';
    renderFormTesti();
    renderTestimoniBagian();
    window.scrollTo({ top: ($('#testi-daftar').offsetTop || 0) - 90, behavior: 'smooth' });
  } catch (e) {
    tombolSibuk(tombol, false);
    if (e.kode === 'VALIDASI' && e.detail) aturGalatKolom(form, e.detail);
    else toastGalat(e, 'Testimoni gagal dikirim');
  }
};

async function muatLagiTestimoni(btn) {
  if (S.testiDaftar.memuat) return;
  S.testiDaftar.memuat = true;
  tombolSibuk(btn, true, 'Memuat...');
  try {
    const d = await panggil('ambilTestimoni', S.testiDaftar.halaman + 1);
    const ada = {};
    S.testiDaftar.items.forEach(t => { ada[t.id] = true; });
    S.testiDaftar.items = S.testiDaftar.items.concat(d.items.filter(t => !ada[t.id]));
    S.testiDaftar.halaman = d.halaman;
    S.testiDaftar.adaLagi = d.adaLagi;
    renderTestimoniBagian();
  } catch (e) {
    tombolSibuk(btn, false);
    toastGalat(e, 'Gagal memuat testimoni');
  } finally {
    S.testiDaftar.memuat = false;
  }
}

async function muatLagiKegiatan(btn) {
  if (S.kegiatan.memuat) return;
  S.kegiatan.memuat = true;
  tombolSibuk(btn, true, 'Memuat...');
  try {
    const d = await panggil('ambilKegiatan', S.kegiatan.halaman + 1);
    const ada = {};
    S.kegiatan.items.forEach(g => { ada[g.id] = true; });
    S.kegiatan.items = S.kegiatan.items.concat(d.items.filter(g => !ada[g.id]));
    S.kegiatan.halaman = d.halaman;
    S.kegiatan.adaLagi = d.adaLagi;
    const bagian = $('#bagian-kegiatan');
    if (bagian) bagian.outerHTML = htmlGaleriKegiatan();
  } catch (e) {
    tombolSibuk(btn, false);
    toastGalat(e, 'Gagal memuat kegiatan');
  } finally {
    S.kegiatan.memuat = false;
  }
}

// ════════════════════════════════════════════════════════════
// BAGIAN 14: HALAMAN TENTANG KAMI & 404
// ════════════════════════════════════════════════════════════

/** URL peta: kode embed dari admin, atau cadangan peta Google dari titik koordinat (tanpa API key) */
function urlPeta(t) {
  if (t.peta) return t.peta;
  const k = t.koordinat || {};
  const lat = Number(k.lat);
  const lng = Number(k.lng);
  if (!isFinite(lat) || !isFinite(lng) || (!lat && !lng)) return '';
  return 'https:\/\/maps.google.com/maps?q=' + lat + ',' + lng + '&z=16&hl=id&output=embed';
}

RENDER.tentang = function (el) {
  const t = S.tentang;
  if (!t) { el.innerHTML = kerangkaHalaman(); return; }
  const kl = t.kartuLayanan || {};
  const warnaChip = ['text-secondary', 'text-primary', 'text-tertiary'];
  const kartuArea = a => `<article class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group">
      <div class="relative h-52 overflow-hidden">
        ${gambar(a.foto, 800, 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300', a.nama)}
        <div class="absolute top-3 left-3 bg-surface-container-lowest/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">${ikon(a.ikon || 'verified', 'text-[16px] text-secondary')}<span class="font-label-md text-body-sm text-on-surface">${esc(a.label)}</span></div>
      </div>
      <div class="p-space-lg flex-1 flex flex-col justify-between">
        <div><h3 class="font-headline-md text-headline-sm text-on-surface mb-2">${esc(a.nama)}</h3><p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">${esc(a.deskripsi)}</p></div>
        ${a.catatan ? `<div class="mt-space-md pt-space-sm flex items-center gap-2 ${a.penting ? 'text-error' : 'text-secondary'} font-label-md text-body-sm">${ikon('check_circle', 'text-[18px]')}<span>${esc(a.catatan)}</span></div>` : ''}
      </div>
    </article>`;
  const kartuBerbayar = a => `<article class="col-span-1 md:col-span-2 lg:col-span-3 bg-surface-container-lowest rounded-xl overflow-hidden shadow-md group">
      <div class="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div class="lg:col-span-5 h-64 lg:h-auto lg:min-h-[300px] relative overflow-hidden">
          ${gambar(a.foto, 1000, 'absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500', a.nama)}
          <div class="absolute top-4 left-4 bg-amber-500 text-white font-label-md text-body-sm px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">${ikon('price_change', 'text-[16px]')}<span>${esc(a.label)}</span></div>
        </div>
        <div class="lg:col-span-7 p-space-lg lg:p-space-xl flex flex-col justify-between">
          <div>
            ${a.eyebrow ? `<div class="flex items-center gap-2 mb-2"><span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-secondary-fixed text-on-secondary-fixed">${ikon(a.ikon || 'local_laundry_service', 'text-[18px]')}</span><span class="text-body-sm font-label-md text-secondary uppercase tracking-wider">${esc(a.eyebrow)}</span></div>` : ''}
            <h3 class="font-headline-lg text-headline-md text-on-surface mb-space-sm">${esc(a.nama)}</h3>
            <p class="font-body-lg text-body-md text-on-surface-variant leading-relaxed mb-space-md">${esc(a.deskripsi)}</p>
          </div>
          ${(a.harga || []).length ? `<div class="grid grid-cols-1 sm:grid-cols-3 gap-space-sm pt-space-sm">${a.harga.map((h, i) => `
            <div class="p-space-sm rounded-lg bg-surface-subtle"><span class="font-headline-sm text-label-md ${i === a.harga.length - 1 && a.harga.length === 3 ? 'text-secondary' : 'text-primary'} block">${esc(h.nama)}</span><span class="font-body-sm text-body-sm text-on-surface-variant">${esc(h.harga)}${h.keterangan ? ' (' + esc(h.keterangan) + ')' : ''}</span></div>`).join('')}</div>` : ''}
        </div>
      </div>
    </article>`;
  const k = t.kontak || {};
  const koor = t.koordinat || {};
  const linkPeta = koor.lat !== null && koor.lat !== undefined ? 'https:\/\/www.google.com/maps?q=' + koor.lat + ',' + koor.lng : 'https:\/\/www.google.com/maps/search/' + encodeURIComponent(k.alamat || 'Kost AB6');

  el.innerHTML = `<div class="flex flex-col w-full">
    <section class="w-full bg-surface-bright py-space-xl"><div class="${WADAH}">
      <nav aria-label="Breadcrumb" class="flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm mb-space-md"><a href="#" data-nav="beranda" class="hover:text-primary transition-colors">Beranda</a>${ikon('chevron_right', 'text-[14px] text-outline')}<span class="text-primary font-medium">Tentang Kami</span></nav>
      <div class="grid grid-cols-12 gap-gutter items-end">
        <div class="col-span-12 lg:col-span-7">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-body-sm font-label-md mb-space-sm"><span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>Profil Resmi &amp; Fasilitas Kost AB6</div>
          <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight mb-space-xs">Tentang Kost AB6</h1>
          <div class="h-1 w-32 rounded-full bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end mb-space-md"></div>
          <p class="font-body-lg text-body-md md:text-body-lg text-on-surface-variant leading-relaxed">${esc(t.intro)}</p>
        </div>
        <div class="col-span-12 lg:col-span-5 flex flex-col gap-space-sm"><div class="flex flex-wrap gap-space-sm">${(t.chip || []).map((c, i) => `
          <div class="flex items-center gap-space-xs px-4 py-3 rounded-xl bg-surface-container-lowest shadow-sm">${ikon(c.ikon || 'verified', 'text-[22px] ' + warnaChip[i % 3])}<div><p class="font-headline-sm text-label-md text-on-surface">${esc(c.judul)}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${esc(c.sub)}</p></div></div>`).join('')}</div></div>
      </div>
    </div></section>

    <section class="w-full bg-surface py-space-md overflow-hidden"><div class="${WADAH}"><div class="grid grid-cols-12 gap-gutter items-center">
      <div class="col-span-12 lg:col-span-8 rounded-xl overflow-hidden shadow-sm relative group h-80">
        ${gambar(t.foto, 1600, 'w-full h-80 object-cover transform group-hover:scale-105 transition-transform duration-500', 'Gedung Kost AB6')}
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-space-md">
          <div><span class="px-2.5 py-1 rounded bg-surface-container-lowest/90 backdrop-blur-sm text-on-surface font-label-md text-body-sm">${esc(t.fotoLabel)}</span><p class="text-on-primary font-headline-sm text-headline-sm mt-1">${esc(t.fotoJudul)}</p></div>
        </div>
      </div>
      <div class="col-span-12 lg:col-span-4 flex flex-col gap-gutter">
        <div class="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between lg:h-80 gap-space-md">
          <div>${ikon('verified', 'text-primary text-[32px] mb-space-xs')}<h3 class="font-headline-md text-headline-md text-on-surface mb-2">${esc(kl.judul || 'Standar Layanan Nyaman')}</h3><p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">${esc(kl.teks || '')}</p></div>
          <div class="pt-space-md flex items-center justify-between"><span class="font-headline-sm text-label-numeric text-primary">${esc(kl.sorotan || '')}</span><span class="text-body-sm font-label-md text-secondary">${esc(kl.status || '')}</span></div>
        </div>
      </div>
    </div></div></section>

    <section class="w-full bg-surface-subtle py-space-xl"><div class="${WADAH}">
      <div class="flex flex-col md:flex-row md:items-end justify-between mb-space-xl">
        <div><span class="text-body-sm font-label-md tracking-wider uppercase text-primary mb-1 block">Infrastruktur Lengkap</span><h2 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">Fasilitas &amp; Area Umum</h2><div class="h-1 w-20 rounded-full bg-gradient-to-r from-gradient-start to-gradient-mid mt-2"></div></div>
        <p class="font-body-md text-body-md text-on-surface-variant max-w-md mt-4 md:mt-0">${esc(t.fasilitasIntro)}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        ${(t.area || []).map(kartuArea).join('')}
        ${(t.berbayar || []).map(kartuBerbayar).join('')}
      </div>
      ${!(t.area || []).length && !(t.berbayar || []).length ? `<p class="text-center font-body-md text-body-md text-on-surface-variant">Informasi fasilitas segera hadir.</p>` : ''}
    </div></section>

    <section class="w-full bg-surface-bright py-space-xl"><div class="${WADAH}">
      <div class="mb-space-xl"><span class="text-body-sm font-label-md tracking-wider uppercase text-primary mb-1 block">Akses &amp; Lokasi</span><h2 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">Hubungi &amp; Kunjungi Kami</h2><div class="h-1 w-20 rounded-full bg-gradient-to-r from-gradient-start to-gradient-mid mt-2"></div></div>
      <div class="grid grid-cols-12 gap-gutter items-stretch">
        <div class="col-span-12 lg:col-span-5 flex flex-col justify-between p-space-lg md:p-space-xl rounded-xl bg-surface-container-lowest shadow-sm">
          <div>
            <h3 class="font-headline-md text-headline-md text-on-surface mb-1">Alamat &amp; Kontak Pengelola</h3>
            <p class="font-body-md text-body-md text-on-surface-variant mb-space-lg">Silakan jadwalkan kunjungan survei fisik atau ajukan pertanyaan ketersediaan kamar kepada staf kami.</p>
            <div class="space-y-space-md">
              <div class="flex items-start gap-space-sm"><div class="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center shrink-0">${ikon('location_on', 'text-primary text-[20px]')}</div><div><h4 class="font-headline-sm text-label-md text-on-surface">Alamat Lengkap</h4><p class="font-body-md text-body-md text-on-surface-variant">${esc(k.alamat)}</p>${k.patokan ? `<p class="font-body-sm text-body-sm text-outline mt-0.5">${esc(k.patokan)}</p>` : ''}</div></div>
              <div class="flex items-start gap-space-sm"><div class="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center shrink-0">${ikon('chat', 'text-secondary text-[20px]')}</div><div><h4 class="font-headline-sm text-label-md text-on-surface">WhatsApp Admin &amp; CS</h4><a ${waAttr(PesanWA.umum())} class="font-body-md text-body-md text-on-surface font-semibold hover:text-primary">${esc(k.waTampil)}</a><p class="font-body-sm text-body-sm text-secondary mt-0.5">Respon cepat dalam jam kerja</p></div></div>
              <div class="flex items-start gap-space-sm"><div class="w-10 h-10 rounded-full bg-tertiary-fixed flex items-center justify-center shrink-0">${ikon('mail', 'text-tertiary text-[20px]')}</div><div><h4 class="font-headline-sm text-label-md text-on-surface">Surel Resmi</h4><a href="mailto:${esc(k.email)}" target="_blank" rel="noopener noreferrer" class="font-body-md text-body-md text-on-surface-variant hover:text-primary">${esc(k.email)}</a></div></div>
              <div class="p-space-md rounded-xl bg-surface-subtle mt-space-md">
                <div class="flex items-center gap-2 mb-2 text-on-surface font-headline-sm text-label-md">${ikon('schedule', 'text-primary text-[18px]')}<span>Jam Operasional Resepsionis &amp; Survei</span></div>
                <div class="grid grid-cols-2 gap-2 text-body-sm">${(t.jadwal || []).map(j => `<div><span class="font-medium text-on-surface block">${esc(j.label)}:</span><span class="text-on-surface-variant">${esc(j.teks)}</span></div>`).join('')}</div>
              </div>
            </div>
          </div>
          <div class="pt-space-lg mt-space-lg"><a ${waAttr(PesanWA.umum())} class="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-whatsapp-green text-on-primary font-headline-sm text-body-md shadow-sm hover:opacity-95 transition-all group">${ikon('chat', 'text-[20px] group-hover:scale-110 transition-transform')}<span>Hubungi Pengelola via WhatsApp</span></a></div>
        </div>
        <div class="col-span-12 lg:col-span-7 flex flex-col justify-between p-space-lg md:p-space-xl rounded-xl bg-surface-container-lowest shadow-sm">
          <div>
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-space-md">
              <h3 class="font-headline-md text-headline-md text-on-surface">Peta Lokasi Interaktif</h3>
              <a href="${esc(linkPeta)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-fixed text-primary font-label-md text-body-sm hover:bg-primary-fixed-dim transition-colors">${ikon('open_in_new', 'text-[16px]')}<span>Buka di Google Maps</span></a>
            </div>
            ${(t.poi || []).length ? `<div class="grid grid-cols-1 sm:grid-cols-3 gap-space-xs mb-space-md">${t.poi.map((p, i) => `<div class="flex items-center gap-2 p-2.5 rounded-lg bg-surface-subtle">${ikon(p.ikon || 'place', 'text-[20px] ' + ['text-secondary', 'text-primary', 'text-error'][i % 3])}<span class="font-label-md text-body-sm text-on-surface">${esc(p.teks)}</span></div>`).join('')}</div>` : ''}
            <div class="relative w-full h-[360px] rounded-xl overflow-hidden shadow-inner group bg-surface-container">
              ${urlPeta(t) ? `<div class="bingkai-media absolute inset-0"><iframe src="${esc(urlPeta(t))}" title="Peta lokasi Kost AB6" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`
                : `<div class="absolute inset-0 flex items-center justify-center text-outline-variant">${ikon('map', 'text-[64px]')}</div>`}
              ${koor.teks ? `<div class="absolute bottom-3 left-3 bg-surface-container-lowest/90 px-2.5 py-1 rounded text-body-sm text-on-surface-variant font-label-md shadow-sm">Koordinat Presisi: ${esc(koor.teks)}</div>` : ''}
            </div>
          </div>
          ${(t.catatan || []).length ? `<div class="mt-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-body-sm text-on-surface-variant"><span class="flex items-center gap-1.5">${ikon('local_parking', 'text-[16px] text-secondary')}${esc(t.catatan[0])}</span>${t.catatan[1] ? `<span class="text-outline">${esc(t.catatan[1])}</span>` : ''}</div>` : ''}
        </div>
      </div>
    </div></section>

    <section class="w-full bg-surface-subtle py-space-xl"><div class="${WADAH}">
      <div class="relative overflow-hidden rounded-xl p-space-lg md:p-space-xl bg-gradient-to-r from-[#0B6B5C]/10 via-[#00E676]/10 to-[#7FDBFF]/15 shadow-sm">
        <div class="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-secondary-fixed/30 blur-2xl pointer-events-none"></div>
        <div class="absolute right-40 -top-10 w-48 h-48 rounded-full bg-primary-fixed/40 blur-xl pointer-events-none"></div>
        <div class="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-space-lg">
          <div class="max-w-2xl text-center lg:text-left">
            <span class="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-body-sm mb-space-xs inline-block">Layanan Konsultasi Langsung</span>
            <h3 class="font-headline-lg text-headline-md md:text-headline-lg text-on-surface tracking-tight mb-space-xs">Punya pertanyaan seputar tipe kamar &amp; fasilitas?</h3>
            <p class="font-body-lg text-body-md md:text-body-lg text-on-surface-variant leading-relaxed">Konsultasikan langsung jadwal survei lokasi Anda bersama tim admin kami. Kami siap menemani Anda berkeliling melihat kamar secara langsung maupun video call.</p>
          </div>
          <div class="flex flex-col sm:flex-row items-center gap-space-sm w-full lg:w-auto shrink-0">
            <a ${waAttr(PesanWA.survei(null))} class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-space-lg py-3 rounded-full bg-whatsapp-green text-on-primary font-headline-sm text-body-md shadow-md hover:scale-105 transition-all">${ikon('chat', 'text-[20px]')}<span>Jadwalkan Survei via WhatsApp</span></a>
            <a href="#" data-nav="kamar" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-space-lg py-3 rounded-full bg-surface-container-lowest text-primary font-headline-sm text-body-md shadow-sm hover:bg-surface-container transition-all">${ikon('meeting_room', 'text-[20px]')}<span>Lihat Katalog Kamar</span></a>
          </div>
        </div>
      </div>
    </div></section>
  </div>`;
};

RENDER['404'] = function (el) {
  el.innerHTML = `<div class="${WADAH} py-space-xl text-center flex flex-col items-center gap-space-md min-h-[50vh] justify-center">
    <span class="font-display-hero text-display-hero text-primary-container">404</span>
    <h1 class="font-headline-md text-headline-md text-on-surface">Halaman tidak ditemukan</h1>
    <a href="#" data-nav="beranda" class="px-space-lg py-3 rounded-full bg-primary-container text-on-primary font-headline-sm text-body-md">Kembali ke Beranda</a></div>`;
};

// ── Aksi publik ──
AKSI['cek-ketersediaan'] = (el, e) => { e.preventDefault(); navigasi('kamar', { filter: 'tersedia' }); };
AKSI['ke-admin'] = (el, e) => { e.preventDefault(); navigasi(sesiValid() ? 'admin-dashboard' : 'login'); };
AKSI['buka-menu-hp'] = () => bukaMenuHp();
AKSI['tutup-menu-hp'] = () => tutupMenuHp();
AKSI['slider-prev'] = () => Slider.geser(-1);
AKSI['slider-next'] = () => Slider.geser(1);
AKSI['slider-ke'] = el => Slider.ke(Number(el.dataset.i) || 0);
AKSI['slider-jeda'] = el => Slider.jedaPutar(el);
AKSI['cta-banner'] = (el, e) => {
  const id = el.dataset.id;
  if (id) {
    S.stat.klik[id] = (S.stat.klik[id] || 0) + 1;
    kirimStatBanner();
  }
  if (!linkEksternal(el.dataset.link)) {
    e.preventDefault();
    bukaTautan(el.dataset.link);
  }
};
AKSI['buka-kegiatan'] = el => bukaKegiatan(el.dataset.id);
AKSI['muat-kegiatan'] = el => muatLagiKegiatan(el);
AKSI['katalog-filter'] = el => { S.katalog.filter = el.dataset.filter; S.katalog.halaman = 1; RENDER.kamar($('#hal-kamar'), {}); };
AKSI['katalog-hal'] = el => {
  S.katalog.halaman = Number(el.dataset.hal) || 1;
  RENDER.kamar($('#hal-kamar'), {});
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
AKSI['galeri-pilih'] = el => pilihFotoDetail(Number(el.dataset.i) || 0);
AKSI['galeri-perbesar'] = () => {
  const k = cariKamar(S.rute.param.kode);
  if (k) bukaLightbox((k.foto || []).filter(f => f && f.id), S.detailIdx || 0);
};
AKSI['putar-video'] = () => putarVideoDetail();
AKSI['tonton-video'] = () => {
  const v = $('#tur-video');
  if (v) v.scrollIntoView({ behavior: 'smooth', block: 'center' });
  putarVideoDetail();
};
AKSI['muat-testimoni'] = el => muatLagiTestimoni(el);
AKSI['lihat-bukti'] = el => {
  const t = semuaTestiPublik().filter(x => x.id === el.dataset.id)[0];
  if (t && t.fotoBukti) bukaLightbox([{ id: t.fotoBukti, keterangan: t.ketBukti || ('Foto dari ' + t.nama) }], 0);
};
AKSI['ke-form-testi'] = () => { const f = $('#bagian-form-testi'); if (f) f.scrollIntoView({ behavior: 'smooth' }); };
AKSI['muat-ulang-publik'] = () => { RENDER[S.rute.nama]($('#hal-' + S.rute.nama), S.rute.param); muatPublik(); };

// ════════════════════════════════════════════════════════════
// BAGIAN 15: LOGIN, SESI & LUPA SANDI
// ════════════════════════════════════════════════════════════

RENDER.login = function () {
  $('#login-galat').hidden = true;
  setTimeout(() => { const i = $('#login-pengguna'); if (i) i.focus(); }, 50);
};

function muatSesiTersimpan() {
  const s = Simpan.get(KONST.KUNCI_TOKEN) || Simpan.get(KONST.KUNCI_TOKEN, true);
  if (s && s.token && s.exp > Date.now()) S.sesi = s;
  else Simpan.hapus(KONST.KUNCI_TOKEN);
}

function simpanSesi(d, ingat) {
  S.sesi = { token: d.token, exp: d.kedaluwarsa, nama: d.nama || 'Administrator', peran: d.peran || 'Super Admin', ingat: !!ingat };
  Simpan.hapus(KONST.KUNCI_TOKEN);
  Simpan.set(KONST.KUNCI_TOKEN, S.sesi, !ingat);
}

function sesiHabis() {
  if (!S.sesi) return;
  S.sesi = null;
  S.adm.data = null;
  S.kotor = false;
  Simpan.hapus(KONST.KUNCI_TOKEN);
  if (lapisanUntuk(S.rute.nama) === 'admin') {
    Modal.tutupSemua();
    toast('Sesi berakhir', 'Silakan masuk kembali.', 'info');
    navigasi('login', {}, { paksa: true });
  }
}

function tampilGalatLogin(pesan) {
  $('#login-galat-teks').textContent = pesan;
  $('#login-galat').hidden = !pesan;
}

KIRIM.login = async function (form) {
  const pengguna = $('#login-pengguna').value.trim();
  const sandi = $('#login-sandi').value;
  const ingat = $('#login-ingat').checked;
  if (!pengguna || !sandi) { tampilGalatLogin('Nama pengguna dan kata sandi wajib diisi.'); return; }
  tampilGalatLogin('');
  const tombol = $('#login-tombol');
  tombolSibuk(tombol, true, 'Memeriksa...');
  try {
    const d = await panggil('masuk', { pengguna, sandi, ingat });
    simpanSesi(d, ingat);
    $('#login-sandi').value = '';
    tombolSibuk(tombol, false);
    const lanjut = S.rute.param && S.rute.param.lanjut;
    if (d.wajibGantiSandi) {
      await navigasi('admin-pengaturan', { fokus: 'keamanan' }, { paksa: true });
      toast('Ganti kata sandi', 'Silakan ganti kata sandi sementara Anda.', 'info');
    } else {
      await navigasi(lanjut && RENDER[lanjut] ? lanjut : 'admin-dashboard', {}, { paksa: true });
      toast('Selamat datang', 'Halo, ' + S.sesi.nama + '!');
    }
  } catch (e) {
    tombolSibuk(tombol, false);
    tampilGalatLogin(e.message);
  }
};

AKSI['tutup-galat-login'] = () => tampilGalatLogin('');

AKSI['toggle-sandi'] = el => {
  const input = document.getElementById(el.dataset.target);
  if (!input) return;
  const tampil = input.type === 'password';
  input.type = tampil ? 'text' : 'password';
  el.innerHTML = ikon(tampil ? 'visibility_off' : 'visibility', 'text-[20px]');
  el.setAttribute('aria-label', tampil ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
};

const KELAS_INPUT_LOGIN = 'w-full px-4 py-2.5 bg-surface-container-low rounded-xl font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-page focus:shadow-md transition-all';

AKSI['lupa-sandi'] = (el, e) => {
  e.preventDefault();
  const item = Modal.buka({
    lebar: 'max-w-md', label: 'Lupa kata sandi',
    isi: `
      <div class="flex items-center justify-between pb-2">
        <h3 class="font-headline-sm text-headline-sm text-on-surface">Lupa Kata Sandi</h3>
        <button type="button" data-ls="tutup" aria-label="Tutup" class="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center">${ikon('close', 'text-[20px]')}</button>
      </div>
      <div data-ls="langkah1" class="flex flex-col gap-4 pt-2">
        <p class="font-body-md text-body-md text-on-surface-variant">Masukkan nama pengguna atau email pengelola. Kode 6 digit akan dikirim ke email pengelola.</p>
        <input data-ls="pengguna" type="text" autocomplete="username" placeholder="admin@kostab6.id" class="${KELAS_INPUT_LOGIN}" value="${esc($('#login-pengguna').value)}">
        <button type="button" data-ls="kirim" class="h-11 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-2">Kirim Kode</button>
      </div>
      <div data-ls="langkah2" class="flex flex-col gap-3 pt-2" hidden>
        <p data-ls="info" class="font-body-sm text-body-sm text-secondary"></p>
        <label class="font-label-md text-label-md text-on-surface">Kode 6 digit<input data-ls="kode" inputmode="numeric" maxlength="6" class="${KELAS_INPUT_LOGIN} mt-1.5 tracking-[0.4em] font-label-numeric"></label>
        <label class="font-label-md text-label-md text-on-surface">Kata sandi baru<input data-ls="baru" type="password" autocomplete="new-password" class="${KELAS_INPUT_LOGIN} mt-1.5"></label>
        <label class="font-label-md text-label-md text-on-surface">Konfirmasi kata sandi baru<input data-ls="ulang" type="password" autocomplete="new-password" class="${KELAS_INPUT_LOGIN} mt-1.5"></label>
        <p data-ls="galat" class="font-body-sm text-body-sm text-error" hidden></p>
        <button type="button" data-ls="simpan" class="h-11 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-2">Simpan Kata Sandi</button>
      </div>`
  });
  const p = item.panel;
  const q = s => p.querySelector(`[data-ls=${s}]`);
  q('tutup').addEventListener('click', () => Modal.tutup(item));
  q('kirim').addEventListener('click', async () => {
    const pengguna = q('pengguna').value.trim();
    if (!pengguna) { q('pengguna').focus(); return; }
    tombolSibuk(q('kirim'), true, 'Mengirim...');
    try {
      const r = await panggil('mintaKodeReset', pengguna);
      q('langkah1').hidden = true;
      q('langkah2').hidden = false;
      q('info').textContent = r.pesan;
      q('kode').focus();
    } catch (err) {
      tombolSibuk(q('kirim'), false);
      toastGalat(err);
    }
  });
  q('simpan').addEventListener('click', async () => {
    const baru = q('baru').value;
    const galat = q('galat');
    galat.hidden = true;
    if (baru !== q('ulang').value) { galat.textContent = 'Konfirmasi kata sandi tidak sama.'; galat.hidden = false; return; }
    if (baru.length < 10 || !/[A-Za-z]/.test(baru) || !/\d/.test(baru)) { galat.textContent = 'Kata sandi minimal 10 karakter berisi huruf dan angka.'; galat.hidden = false; return; }
    tombolSibuk(q('simpan'), true, 'Menyimpan...');
    try {
      const r = await panggil('resetSandi', { pengguna: q('pengguna').value.trim(), kode: q('kode').value.trim(), sandiBaru: baru });
      Modal.tutup(item);
      toast('Berhasil', r.pesan);
    } catch (err) {
      tombolSibuk(q('simpan'), false);
      galat.textContent = err.message;
      galat.hidden = false;
    }
  });
};

AKSI['keluar'] = async (el, e) => {
  e.preventDefault();
  tutupPanelTopbar();
  const ok = await konfirmasi({ judul: 'Keluar dari panel?', pesan: 'Anda perlu masuk kembali untuk mengelola situs.', ok: 'Keluar', bahaya: true, ikon: 'logout' });
  if (!ok) return;
  const token = S.sesi && S.sesi.token;
  if (token) panggil('keluar', token).catch(() => { /* abaikan */ });
  S.sesi = null;
  S.adm.data = null;
  S.kotor = false;
  Simpan.hapus(KONST.KUNCI_TOKEN);
  navigasi('beranda', {}, { paksa: true });
  toast('Anda telah keluar', '');
};

// ════════════════════════════════════════════════════════════
// BAGIAN 16: KERANGKA PANEL ADMIN
// ════════════════════════════════════════════════════════════

S.adm.unggahSementara = [];
S.adm.pratinjau = {};

function tokenAdmin() { return S.sesi && S.sesi.token; }

/** Ambil data admin bila belum ada atau sudah > 60 detik (stale-while-revalidate) */
function pastikanDataAdmin() {
  if (!sesiValid()) return;
  if (!S.adm.data || Date.now() - S.adm.waktuMuat > 60000) muatAdmin();
}

function muatAdmin() {
  if (S.adm.memuat) return S.adm.memuat;
  S.adm.memuat = panggil('adminMuat', tokenAdmin()).then(d => {
    const pertama = !S.adm.data;
    S.adm.data = d;
    S.adm.waktuMuat = Date.now();
    perbaruiKerangkaAdmin();
    if (pertama || bolehRenderUlangAdmin()) renderAdminAktif();
    return d;
  }).catch(e => {
    if (e.kode !== 'SESI_HABIS') toastGalat(e, 'Gagal memuat data admin');
    return null;
  }).finally(() => { S.adm.memuat = null; });
  return S.adm.memuat;
}

function bolehRenderUlangAdmin() {
  if (S.kotor || Modal.tumpukan.length) return false;
  const n = S.rute.nama;
  if (['admin-dashboard', 'admin-kamar', 'admin-testimoni', 'admin-laporan'].indexOf(n) >= 0) return true;
  if (n === 'admin-konten') return !S.adm.konten || !S.adm.konten.form;
  return false;
}

function renderAdminAktif() {
  const n = S.rute.nama;
  if (lapisanUntuk(n) === 'admin' && RENDER[n]) RENDER[n]($('#hal-' + n), S.rute.param);
}

function jumlahTestiBaru() {
  const d = S.adm.data;
  if (!d) return [];
  const batas = keTanggal(d.info.terakhirLihat);
  const t = batas ? batas.getTime() : 0;
  return d.testimoni.filter(x => { const w = keTanggal(x.tanggal); return w && w.getTime() > t; });
}

function perbaruiKerangkaAdmin() {
  const d = S.adm.data;
  if (S.sesi) {
    $('#admin-nama').textContent = (d && d.info.adminNama) || S.sesi.nama;
    $('#admin-peran').textContent = (d && d.info.adminPeran) || S.sesi.peran;
  }
  const n = jumlahTestiBaru().length;
  const lencana = $('#lencana-testimoni');
  lencana.textContent = n > 99 ? '99+' : String(n);
  lencana.hidden = !n;
  $('#titik-notifikasi').hidden = !n;
  const remah = {
    'admin-dashboard': 'Portal Pengelola', 'admin-konten': 'Kelola Konten', 'admin-kamar': 'Kelola Kamar',
    'admin-testimoni': 'Portal Pengelola', 'admin-laporan': 'Portal Pengelola', 'admin-pengaturan': 'Portal Pengelola'
  };
  if (S.rute.nama === 'admin-kamar-form') {
    // Desain revisi: Kost AB6 › Portal Pengelola › Kelola Kamar › Tambah/Edit Kamar
    const pemisah = ikon('chevron_right', 'text-[16px] align-middle mx-0.5');
    $('#remah-admin').innerHTML = `Portal Pengelola${pemisah}<a href="#" data-nav="admin-kamar" class="hover:text-on-surface transition-colors">Kelola Kamar</a>${pemisah}<span class="font-label-md text-label-md text-on-surface">${S.rute.param && S.rute.param.id ? 'Edit Kamar' : 'Tambah Kamar Baru'}</span>`;
  } else {
    $('#remah-admin').textContent = remah[S.rute.nama] || 'Portal Pengelola';
  }
}

AKSI['buka-sidebar'] = () => bukaSidebar();
AKSI['tutup-sidebar'] = () => tutupSidebar();
AKSI['buka-menu-akun'] = () => { const p = $('#panel-akun'); const buka = p.hidden; tutupPanelTopbar(); p.hidden = !buka; };
AKSI['ke-keamanan'] = (el, e) => { e.preventDefault(); tutupPanelTopbar(); navigasi('admin-pengaturan', { fokus: 'keamanan' }); };
AKSI['buka-notifikasi'] = () => {
  const p = $('#panel-notifikasi');
  const buka = p.hidden;
  tutupPanelTopbar();
  if (!buka) return;
  const baru = jumlahTestiBaru();
  p.innerHTML = `
    <div class="px-4 py-3 flex items-center justify-between border-b border-border-subtle">
      <span class="font-label-md text-label-md text-on-surface">Testimoni Baru</span>
      <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${baru.length ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface-variant'}">${baru.length} Baru</span>
    </div>
    <div class="max-h-80 overflow-y-auto">${baru.slice(0, 5).map(t => `
      <a href="#" data-aksi="buka-testi-admin" data-id="${esc(t.id)}" class="flex items-start gap-3 px-4 py-3 hover:bg-surface-container-low">
        <div class="w-8 h-8 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-[12px] shrink-0">${esc(inisial(t.nama))}</div>
        <div class="min-w-0"><p class="font-label-md text-label-md text-on-surface truncate">${esc(t.nama)}</p><p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">${esc(t.isi)}</p><p class="font-body-sm text-[11px] text-outline mt-0.5">${fRelatif(t.tanggal)}</p></div>
      </a>`).join('') || `<p class="px-4 py-6 text-center font-body-sm text-body-sm text-on-surface-variant">Tidak ada testimoni baru.</p>`}</div>
    <a href="#" data-nav="admin-testimoni" class="block px-4 py-3 text-center font-label-md text-label-md text-primary hover:bg-surface-container-low border-t border-border-subtle">Lihat semua testimoni</a>`;
  p.hidden = false;
};
AKSI['buka-testi-admin'] = (el, e) => {
  e.preventDefault();
  tutupPanelTopbar();
  const t = S.adm.data && S.adm.data.testimoni.filter(x => x.id === el.dataset.id)[0];
  if (t) bukaModalTestimoni(t);
};

/** Batalkan perubahan formulir admin: buang foto yang terlanjur diunggah */
function batalPerubahan() {
  S.kotor = false;
  if (S.adm.konten) S.adm.konten.form = null;
  const ids = S.adm.unggahSementara.splice(0);
  if (ids.length && tokenAdmin()) panggil('adminBuangFoto', tokenAdmin(), ids).catch(() => { /* abaikan */ });
}

function tandaiKotor() { S.kotor = true; }
function bersihkanKotor() { S.kotor = false; S.adm.unggahSementara = []; }

/** Kerangka muat panel admin */
function kerangkaAdmin() {
  return `<div class="flex flex-col gap-space-lg" aria-busy="true">${kerangkaBlok('h-24')}
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">${kerangkaBlok('h-32')}${kerangkaBlok('h-32')}${kerangkaBlok('h-32')}${kerangkaBlok('h-32')}</div>${kerangkaBlok('h-80')}</div>`;
}

/** Gambar admin: pakai pratinjau lokal hasil unggah (instan) bila ada */
function gambarAdmin(id, lebar, kelas, alt) {
  if (id && S.adm.pratinjau[id]) return `<img src="${S.adm.pratinjau[id]}" alt="${esc(alt || '')}" class="${kelas}">`;
  return gambar(id, lebar, kelas, alt);
}

/**
 * Kompres → unggah ke Drive → kembalikan {id, lebar, tinggi, kb, nama}.
 * lacak=false untuk foto draf kamar (draf tersimpan lokal, jangan ikut dibuang).
 */
async function unggahFotoAdmin(file, modul, opsi, lacak) {
  const h = await kompresGambar(file, opsi || { maks: 1600, target: 500 * 1024 });
  const r = await panggil('adminUnggahFoto', tokenAdmin(), { modul: modul, dataUrl: h.dataUrl, nama: h.nama });
  if (lacak !== false) S.adm.unggahSementara.push(r.id);
  S.adm.pratinjau[r.id] = h.dataUrl;
  return { id: r.id, lebar: h.lebar, tinggi: h.tinggi, kb: h.kb, nama: h.nama };
}

function gantiItem(daftar, item) {
  const i = daftar.findIndex(x => x.id === item.id);
  if (i >= 0) daftar[i] = Object.assign({}, daftar[i], item); else daftar.push(item);
}

const KELAS = {
  inputAdm: 'w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md placeholder:text-outline-variant focus:bg-surface-page focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-inner',
  inputKamar: 'w-full h-11 px-3.5 rounded-lg border border-border-subtle bg-surface-subtle/60 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-page focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all',
  inputSet: 'w-full px-3.5 py-2.5 rounded-lg bg-surface-subtle text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest shadow-sm transition-all',
  label: 'font-label-md text-label-md text-on-surface',
  tombolUtama: 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md shadow-sm transition-all disabled:opacity-60',
  tombolKedua: 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-all',
  select: 'appearance-none cursor-pointer pl-3.5 pr-9 py-2.5 rounded-lg bg-surface-subtle font-label-md text-label-md text-on-surface focus:outline-none hover:bg-surface-container transition-colors'
};

function sakelar(atribut, nyala, kecil) {
  const ukuran = kecil
    ? 'w-9 h-5 after:h-4 after:w-4'
    : 'w-11 h-6 after:h-5 after:w-5';
  return `<label class="relative inline-flex items-center cursor-pointer shrink-0">
    <input type="checkbox" class="sr-only peer" ${atribut} ${nyala ? 'checked' : ''}>
    <div class="${ukuran} relative bg-surface-container-highest rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-page after:rounded-full after:transition-all peer-checked:bg-status-available"></div>
  </label>`;
}

function pilihan(atribut, opsi, nilai, kelas) {
  return `<div class="relative">
    <select ${atribut} class="${kelas || KELAS.select} w-full">${opsi.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(nilai) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>
    ${ikon('expand_more', 'absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline pointer-events-none')}
  </div>`;
}

/** Paginasi gaya Kelola Testimoni (dengan elipsis) */
function paginasiAdmin(hal, total, aksi) {
  if (total <= 1) return '';
  const tombol = (isi, h, aktif, mati, label) => `<button type="button" ${mati ? 'disabled' : `data-aksi="${aksi}" data-hal="${h}"`} ${label ? `aria-label="${label}"` : ''} ${aktif ? 'aria-current="page"' : ''}
    class="w-9 h-9 rounded-lg flex items-center justify-center font-label-md text-label-md transition-colors ${aktif ? 'bg-primary-container text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'} disabled:opacity-40">${isi}</button>`;
  const nomor = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - hal) <= 1) nomor.push(i);
    else if (nomor[nomor.length - 1] !== '…') nomor.push('…');
  }
  return `<div class="flex items-center gap-1">
    ${tombol(ikon('chevron_left', 'text-[18px]'), hal - 1, false, hal <= 1, 'Halaman sebelumnya')}
    ${nomor.map(n => n === '…' ? '<span class="px-1 text-outline">…</span>' : tombol(n, n, n === hal, false)).join('')}
    ${tombol(ikon('chevron_right', 'text-[18px]'), hal + 1, false, hal >= total, 'Halaman berikutnya')}
  </div>`;
}

function garisAtasAdmin() {
  return '<div class="h-1 w-full bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end rounded-full mb-space-lg"></div>';
}

/** SVG donat sesuai desain (r=38, keliling 238,76) */
function svgDonat(segmen, tebal) {
  const K = 238.76;
  const total = segmen.reduce((s, x) => s + (x.nilai || 0), 0);
  let offset = 0;
  const lingkar = segmen.filter(x => x.nilai > 0).map(x => {
    const p = total ? x.nilai / total * K : 0;
    const c = `<circle cx="50" cy="50" r="38" fill="transparent" stroke="${x.warna}" stroke-width="${tebal || 12}" stroke-dasharray="${p.toFixed(2)} ${K}" stroke-dashoffset="${(-offset).toFixed(2)}" stroke-linecap="${segmen.filter(s => s.nilai > 0).length > 1 ? 'round' : 'butt'}"></circle>`;
    offset += p;
    return c;
  }).join('');
  return `<svg viewBox="0 0 100 100" class="w-full h-full -rotate-90" aria-hidden="true"><circle cx="50" cy="50" r="38" fill="transparent" stroke="#f0eded" stroke-width="${tebal || 12}"></circle>${lingkar}</svg>`;
}

function statistikKamar(kamar) {
  const total = kamar.length;
  const terisi = kamar.filter(k => k.status === 'Terisi').length;
  const tersedia = total - terisi;
  return { total, terisi, tersedia, okupansi: persen(terisi, total), siap: persen(tersedia, total) };
}

function labelKamarAdmin(t) {
  const k = S.adm.data && S.adm.data.kamar.filter(x => x.id === t.idKamar)[0];
  if (t.tipe === 'Official') return 'Kurasi Tim';
  if (t.tipe === 'Alumni') return 'Alumni Penghuni';
  return k ? 'Penghuni Lt. ' + k.lantai : 'Penghuni';
}

function kamarDariId(id) {
  return (S.adm.data && S.adm.data.kamar.filter(x => x.id === id)[0]) || null;
}

function avatarAdmin(t, ukuran) {
  if (t.fotoProfil) return `<div class="${ukuran} rounded-full overflow-hidden shrink-0 bg-surface-container-high shadow-sm">${gambarAdmin(t.fotoProfil, 200, 'w-full h-full object-cover', 'Foto ' + t.nama)}</div>`;
  if (t.tipe === 'Official') return `<div class="${ukuran} rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0">${ikon('apartment', 'text-[22px]')}</div>`;
  const warna = ['bg-primary-fixed text-primary', 'bg-secondary-fixed text-on-secondary-container', 'bg-surface-container-high text-on-surface-variant', 'bg-error-container text-on-error-container'];
  const i = Math.abs(String(t.nama).split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % warna.length;
  return `<div class="${ukuran} rounded-full ${warna[i]} flex items-center justify-center font-bold text-[12px] shrink-0">${esc(inisial(t.nama).charAt(0))}</div>`;
}

function chipSumber(t) {
  return t.sumber === 'Admin'
    ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-label-md bg-secondary-fixed text-on-secondary-container">${ikon('verified_user', 'text-[12px]')}<span>Admin</span></span>`
    : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-label-md bg-tertiary-fixed text-primary-container">${ikon('person', 'text-[12px]')}<span>Customer</span></span>`;
}

function chipStatusTesti(status) {
  return status === 'Tampil'
    ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-[11px]"><span class="w-1.5 h-1.5 rounded-full bg-status-available animate-pulse"></span><span>Tampil</span></span>`
    : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-md text-[11px]">${ikon('visibility_off', 'text-[12px]')}<span>Disembunyikan</span></span>`;
}

// ════════════════════════════════════════════════════════════
// BAGIAN 17: DASHBOARD
// ════════════════════════════════════════════════════════════

function trenTestimoni(testimoni) {
  const kini = bagianJkt(new Date());
  const bulan = [];
  for (let i = 5; i >= 0; i--) {
    let m = kini.m - i;
    let y = kini.y;
    while (m < 1) { m += 12; y--; }
    bulan.push({ kunci: `${y}-${String(m).padStart(2, '0')}`, label: KONST.BULAN[m - 1], jumlah: 0 });
  }
  const peta = {};
  bulan.forEach(b => { peta[b.kunci] = b; });
  testimoni.forEach(t => { const b = peta[kunciBulan(t.tanggal)]; if (b) b.jumlah++; });
  return bulan;
}

RENDER['admin-dashboard'] = function (el) {
  const d = S.adm.data;
  if (!d) { el.innerHTML = kerangkaAdmin(); return; }
  const k = statistikKamar(d.kamar);
  const target = d.info.targetOkupansi || 75;
  const testi = d.testimoni;
  const bulanIni = kunciBulan(new Date());
  const baruBulanIni = testi.filter(t => kunciBulan(t.tanggal) === bulanIni).length;
  const tren = trenTestimoni(testi);
  const maks = Math.max.apply(null, tren.map(b => b.jumlah).concat([1]));
  const lalu = tren[4].jumlah;
  const ini = tren[5].jumlah;
  const naik = lalu ? Math.round((ini - lalu) / lalu * 100) : null;
  const rata = tren.reduce((s, b) => s + b.jumlah, 0) / 6;
  const pembaruanKamar = d.kamar.reduce((m, x) => { const w = keTanggal(x.diperbarui); return w && w > m ? w : m; }, null);
  const baru = jumlahTestiBaru().length;
  const waktu = t => { const w = keTanggal(t.tanggal); return w ? w.getTime() : 0; };
  const baris = testi.slice().sort((a, b) => waktu(b) - waktu(a)).slice(0, 3);
  const kpi = (judul, ikonNama, kelasIkon, nilai, kelasNilai, sub, ekstra) => `
    <div class="bg-surface-page p-4 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
      ${ekstra || ''}
      <div class="flex items-center justify-between gap-2"><span class="font-label-md text-label-md ${ekstra ? 'text-on-surface font-bold' : 'text-on-surface-variant'}">${judul}</span><div class="w-9 h-9 rounded-lg ${kelasIkon} flex items-center justify-center shrink-0">${ikon(ikonNama, 'text-[20px]')}</div></div>
      <div class="mt-3"><div class="font-label-numeric text-label-numeric ${kelasNilai}">${nilai}</div>${sub}</div>
    </div>`;
  const pSub = t => `<p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">${t}</p>`;

  el.innerHTML = `<div class="flex flex-col w-full gap-space-lg pb-12">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-page p-space-md rounded-xl shadow-sm">
      <div class="flex flex-col">
        <div class="flex items-center gap-space-xs"><span class="w-2.5 h-2.5 rounded-full bg-status-available animate-pulse"></span><h1 class="font-headline-md text-headline-md text-on-surface tracking-tight">Dashboard Ringkasan Operasional</h1></div>
        <div class="flex flex-wrap items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm mt-0.5">${ikon('calendar_today', 'text-[16px]')}<span>${fTgl(new Date(), 'hari')}</span><span class="text-outline-variant">•</span><span class="text-secondary font-label-md">Sistem Berjalan Normal</span></div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-space-md">
      ${kpi('Total Kamar', 'home', 'bg-primary-fixed text-primary-container', k.total + ' Kamar', 'text-on-surface', pSub('Kapasitas penuh ' + k.total + ' unit'))}
      ${kpi('Kamar Tersedia', 'check_circle', 'bg-secondary-fixed text-on-secondary-container', k.tersedia + ' Kamar', 'text-status-available', pSub('Siap huni bulan ini'))}
      ${kpi('Kamar Terisi', 'person_pin_circle', 'bg-tertiary-fixed text-primary-container', k.terisi + ' Kamar', 'text-primary-container', pSub('Kontrak aktif'))}
      ${kpi('Tingkat Okupansi', 'trending_up', 'bg-surface-container text-secondary', teksPersen(k.okupansi), 'text-on-surface',
        `<div class="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant mt-0.5"><span>Target bulanan:</span><span class="font-label-md text-label-md text-primary">${target}%</span></div>`,
        '<div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end"></div>')}
      ${kpi('Total Testimoni', 'chat_bubble', 'bg-surface-container text-tertiary', testi.length + ' Ulasan', 'text-on-surface', pSub('Dari seluruh penghuni'))}
      ${kpi('Ulasan Baru', 'hotel_class', 'bg-secondary-fixed-dim text-on-secondary-fixed', '+' + baruBulanIni + ' Baru', 'text-secondary', pSub(fTgl(new Date(), 'bulanTahun')))}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
      <div class="lg:col-span-5 bg-surface-page p-space-md rounded-xl shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-start justify-between gap-2 pb-3">
            <div class="flex flex-col"><h2 class="font-headline-sm text-headline-sm text-on-surface">Ketersediaan Kamar</h2><p class="font-body-sm text-body-sm text-on-surface-variant">Komparasi unit tersedia vs terisi saat ini</p></div>
            <span class="px-2 py-0.5 rounded text-[11px] font-label-md bg-surface-container text-on-surface-variant whitespace-nowrap">Real-time</span>
          </div>
          <div class="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-center gap-space-lg py-4">
            <div class="relative w-44 h-44 flex items-center justify-center shrink-0">
              ${svgDonat([{ nilai: k.tersedia, warna: '#00A86B' }, { nilai: k.terisi, warna: '#1565C0' }])}
              <div class="absolute inset-0 flex flex-col items-center justify-center text-center"><span class="font-display-hero text-[28px] leading-tight text-on-surface font-bold">${k.total}</span><span class="font-body-sm text-[11px] text-on-surface-variant uppercase font-semibold tracking-wider">Total Unit</span></div>
            </div>
            <div class="flex flex-col gap-2.5 w-full sm:w-auto lg:w-full xl:w-auto whitespace-nowrap">
              ${[['Tersedia', k.tersedia, 'bg-status-available', k.siap], ['Terisi', k.terisi, 'bg-primary-container', k.okupansi]].map(x => `
                <div class="p-2.5 rounded-lg bg-surface-subtle flex items-center justify-between gap-4">
                  <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full ${x[2]}"></span><span class="font-label-md text-label-md text-on-surface">${x[0]}</span></div>
                  <div class="text-right"><span class="font-label-numeric text-[15px] text-on-surface">${x[1]} Unit</span><span class="font-body-sm text-[11px] text-on-surface-variant block">${teksPersen(x[3])}</span></div>
                </div>`).join('')}
            </div>
          </div>
        </div>
        <div class="pt-3 flex items-center justify-between gap-2">
          <span class="font-body-sm text-body-sm text-on-surface-variant">Update per: ${pembaruanKamar ? fTgl(pembaruanKamar, 'pendekJam') : '-'}</span>
          <button type="button" data-nav="admin-kamar" class="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:text-primary-container transition-colors"><span>Detail Kamar</span>${ikon('arrow_forward', 'text-[16px]')}</button>
        </div>
      </div>

      <div class="lg:col-span-7 bg-surface-page p-space-md rounded-xl shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
            <div><h2 class="font-headline-sm text-headline-sm text-on-surface">Tren Testimoni (${bagianJkt(new Date()).y})</h2><p class="font-body-sm text-body-sm text-on-surface-variant">Volume ulasan masuk selama 6 bulan terakhir</p></div>
            ${naik !== null ? `<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${naik >= 0 ? 'bg-secondary-fixed text-on-secondary-container' : 'bg-error-container text-on-error-container'} font-label-md text-[12px] self-start sm:self-auto">${ikon(naik >= 0 ? 'trending_up' : 'trending_down', 'text-[14px]')}<span>${naik >= 0 ? '+' : ''}${naik}% vs bulan lalu</span></div>` : ''}
          </div>
          <div class="pt-6 pb-2"><div class="h-44 flex items-end justify-between gap-3 sm:gap-6 px-2" role="img" aria-label="Grafik jumlah testimoni 6 bulan terakhir">
            ${tren.map((b, i) => {
              const aktif = i === 5;
              const tinggi = b.jumlah ? Math.max(8, Math.round(b.jumlah / maks * 104)) : 4;
              return `<div class="flex-1 flex flex-col items-center gap-2 group">
                <span class="font-label-md ${aktif ? 'text-[12px] font-bold text-primary-container' : 'text-[11px] text-on-surface-variant group-hover:text-primary'} transition-colors">${b.jumlah}</span>
                <div class="w-full max-w-[42px] ${aktif ? 'bg-primary-container shadow-sm group-hover:bg-primary' : 'bg-gradient-end/60 group-hover:bg-gradient-end'} rounded-t-lg transition-all duration-300" style="height:${tinggi}px"></div>
                <span class="${aktif ? 'font-label-md text-[12px] font-bold text-primary-container' : 'font-body-sm text-[12px] text-on-surface-variant'}">${b.label}</span>
              </div>`;
            }).join('')}
          </div></div>
        </div>
        <div class="pt-3 flex flex-col sm:flex-row sm:items-center justify-between text-on-surface-variant text-body-sm gap-2">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1.5 font-body-sm text-[12px]"><span class="w-2.5 h-2.5 rounded bg-gradient-end"></span><span>Bulan Sebelumnya</span></div>
            <div class="flex items-center gap-1.5 font-body-sm text-[12px]"><span class="w-2.5 h-2.5 rounded bg-primary-container"></span><span>Bulan Berjalan (Aktif)</span></div>
          </div>
          <span class="font-body-sm text-[12px]">Rata-rata ${String(Math.round(rata * 10) / 10).replace('.', ',')} ulasan/bulan</span>
        </div>
      </div>
    </div>

    <div class="bg-surface-page rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div class="p-space-md border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-2"><h2 class="font-headline-sm text-headline-sm text-on-surface">Testimoni Terbaru</h2><span class="px-2.5 py-0.5 rounded-full text-[12px] font-bold ${baru ? 'bg-secondary-fixed text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'}">${baru} Baru</span></div>
          <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Pantau ulasan terbaru dari penghuni yang sudah tampil di situs publik</p>
        </div>
        <a href="#" data-nav="admin-testimoni" class="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:text-primary-container transition-colors self-start sm:self-auto whitespace-nowrap"><span>Lihat Semua Testimoni</span>${ikon('arrow_forward', 'text-[16px]')}</a>
      </div>
      <div class="overflow-x-auto w-full gulir-tampak">
        <table class="w-full min-w-[720px] text-left border-collapse">
          <thead class="bg-surface-subtle border-b border-border-subtle text-on-surface-variant font-label-md text-[12px]"><tr>
            <th class="py-3 px-4 font-semibold">Penghuni</th><th class="py-3 px-4 font-semibold">Kamar</th><th class="py-3 px-4 font-semibold">Ulasan</th><th class="py-3 px-4 font-semibold">Tanggal</th><th class="py-3 px-4 font-semibold text-right">Status</th>
          </tr></thead>
          <tbody class="divide-y divide-border-subtle font-body-sm text-[13px] text-on-surface">${baris.map(t => {
            const km = kamarDariId(t.idKamar);
            const kamar = km ? `Kamar ${km.kode} (Lt ${km.lantai})` : (t.tipe === 'Official' ? 'Kurasi Tim' : '-');
            return `<tr data-aksi="buka-testi-admin" data-id="${esc(t.id)}" class="hover:bg-surface-subtle/60 transition-colors cursor-pointer" title="Lihat detail testimoni">
              <td class="py-3 px-4 font-semibold text-on-surface whitespace-nowrap">${esc(t.nama)}</td>
              <td class="py-3 px-4 text-on-surface-variant whitespace-nowrap">${esc(kamar)}</td>
              <td class="py-3 px-4 text-on-surface-variant max-w-xs truncate">${esc(t.isi)}</td>
              <td class="py-3 px-4 text-on-surface-variant whitespace-nowrap">${fTgl(t.tanggal)}</td>
              <td class="py-3 px-4 text-right">${t.status === 'Tampil'
                ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary-fixed text-on-secondary-container">Publik</span>'
                : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-container-high text-on-surface-variant">Disembunyikan</span>'}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="5" class="py-8 text-center text-on-surface-variant">Belum ada testimoni.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="p-3 px-4 border-t border-border-subtle bg-surface-subtle flex items-center justify-between gap-2 text-[12px] text-on-surface-variant">
        <span>Menampilkan ${baris.length} ulasan terbaru</span>
        <a href="#" data-nav="admin-testimoni" class="font-label-md text-primary hover:underline">Kelola Semua Ulasan »</a>
      </div>
    </div>
  </div>`;
};

// ════════════════════════════════════════════════════════════
// BAGIAN 18: SERET-ATUR URUTAN (desktop) — ponsel memakai tombol naik/turun
// ════════════════════════════════════════════════════════════

function pasangSeret(wadah, sumbu, saatSelesai) {
  if (!wadah) return;
  let seret = null;
  let awal = '';
  const urutan = () => $$('[data-seret]', wadah).map(x => x.dataset.seret);
  $$('[data-seret]', wadah).forEach(item => {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', e => {
      if (e.target.closest('input, textarea, select')) { e.preventDefault(); return; }
      seret = item;
      awal = urutan().join('|');
      item.classList.add('sedang-diseret');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', item.dataset.seret); } catch (x) { /* abaikan */ }
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('sedang-diseret');
      if (!seret) return;
      seret = null;
      const baru = urutan();
      if (baru.join('|') !== awal) saatSelesai(baru);
    });
    item.addEventListener('dragover', e => {
      if (!seret || seret === item) return;
      e.preventDefault();
      const r = item.getBoundingClientRect();
      const setelah = sumbu === 'x' ? (e.clientX - r.left) > r.width / 2 : (e.clientY - r.top) > r.height / 2;
      wadah.insertBefore(seret, setelah ? item.nextSibling : item);
    });
    item.addEventListener('drop', e => e.preventDefault());
  });
}

function geserDalamDaftar(ids, id, arah) {
  const i = ids.indexOf(id);
  const j = i + arah;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const salin = ids.slice();
  salin.splice(i, 1);
  salin.splice(j, 0, id);
  return salin;
}

// ════════════════════════════════════════════════════════════
// BAGIAN 19: KELOLA KONTEN (Banner, Galeri Kegiatan, Area Umum, Visi & Misi)
// ════════════════════════════════════════════════════════════

S.adm.konten = { tab: 'banner', form: null, cari: '', status: 'semua', hal: 1, slide: 0 };

function hariIniIso() { return fTgl(new Date(), 'iso'); }

function formBaru(jenis, item) {
  const salin = item ? JSON.parse(JSON.stringify(item)) : null;
  if (jenis === 'banner') return { jenis, data: salin || { id: '', label: '', judul: '', keterangan: '', teksTombol: 'Pelajari Lebih Lanjut', linkTombol: '/kamar', foto: '', status: 'Aktif' } };
  if (jenis === 'kegiatan') return { jenis, data: salin || { id: '', tanggal: hariIniIso(), judul: '', ringkas: '', deskripsi: '', foto: [], status: 'Tampil' } };
  if (jenis === 'area') return { jenis, data: salin || { id: '', jenis: 'Fasilitas', nama: '', label: '', ikon: 'verified', deskripsi: '', catatan: '', penting: false, foto: '', eyebrow: '', harga: [], status: 'Tampil' } };
  const p = S.adm.data.pengaturan;
  return { jenis: 'visi', data: { VISI: p.VISI, MISI: String(p.MISI || ''), VISI_LABEL: p.VISI_LABEL, TAHUN_BERDIRI: p.TAHUN_BERDIRI, MISI_LABEL: p.MISI_LABEL } };
}

function bannerUrut() { return S.adm.data.banner.slice().sort((a, b) => a.urutan - b.urutan); }
function areaUrut() { return S.adm.data.area.slice().sort((a, b) => a.urutan - b.urutan); }

RENDER['admin-konten'] = function (el, param) {
  const d = S.adm.data;
  if (!d) { el.innerHTML = kerangkaAdmin(); return; }
  const K = S.adm.konten;
  if (param && param.tab) {
    K.tab = param.tab;
    K.form = param.baru ? formBaru(param.tab === 'area' ? 'area' : param.tab) : null;
    param.tab = '';
    param.baru = '';
  }
  if (!K.form) {
    if (K.tab === 'banner') K.form = formBaru('banner', bannerUrut()[0] || null);
    else if (K.tab === 'visi') K.form = formBaru('visi');
    else K.form = formBaru(K.tab);
  }
  const aktif = d.banner.filter(b => b.status === 'Aktif').length;
  const tab = (id, ikonNama, label) => `<button type="button" role="tab" aria-selected="${K.tab === id}" data-aksi="konten-tab" data-tab="${id}" class="relative py-4 font-label-md text-label-md flex items-center gap-2 whitespace-nowrap ${K.tab === id ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface transition-colors'}">
      ${ikon(ikonNama, 'text-[18px]')}<span>${label}</span>${K.tab === id ? '<span class="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end rounded-t-full"></span>' : ''}</button>`;
  el.innerHTML = `<section class="flex flex-col gap-6 w-full">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-surface-page p-6 rounded-xl shadow-sm">
      <div class="flex flex-col gap-1 max-w-2xl">
        <div class="flex items-center gap-2 text-primary font-label-md text-label-md uppercase tracking-wider"><span class="w-2 h-2 rounded-full bg-gradient-mid"></span><span>CMS Portal • Beranda</span></div>
        <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">Manajemen Konten Publik</h1>
        <p class="font-body-md text-body-md text-on-surface-variant">Kelola banner slider utama beranda, agenda kegiatan penghuni, dan informasi area umum kost dengan pratinjau live.</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" data-aksi="riwayat-revisi" class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-all shadow-sm">${ikon('history', 'text-[20px]')}<span>Riwayat Revisi</span></button>
        <button type="button" data-aksi="tambah-konten" class="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md transition-all shadow-sm">${ikon('add_circle', 'text-[20px]')}<span>+ Tambah Konten Baru</span></button>
      </div>
    </div>
    <div class="bg-surface-page rounded-xl shadow-sm px-6 pt-2"><div class="flex items-center gap-8 overflow-x-auto" role="tablist" aria-label="Modul konten">
      ${tab('banner', 'view_carousel', `Banner Beranda (${aktif}/3 Aktif)`)}
      ${tab('kegiatan', 'photo_library', `Galeri Kegiatan (${d.kegiatan.length} Entri)`)}
      ${tab('area', 'domain', `Area Fasilitas Umum (${d.area.length} Fasilitas)`)}
      ${tab('visi', 'flag', 'Visi &amp; Misi Hunian')}
    </div></div>
    <div id="isi-tab-konten">${K.tab === 'banner' ? htmlTabBanner() : K.tab === 'kegiatan' ? htmlTabKegiatan() : K.tab === 'area' ? htmlTabArea() : htmlTabVisi()}</div>
  </section>`;
  pasangSeretKonten();
};

function renderKonten() { RENDER['admin-konten']($('#hal-admin-konten'), {}); }

function pasangSeretKonten() {
  const K = S.adm.konten;
  if (K.tab === 'banner') pasangSeret($('#daftar-banner'), 'y', ids => simpanUrutan('banner', ids));
  if (K.tab === 'area') pasangSeret($('#daftar-area'), 'y', ids => simpanUrutan('area', ids));
  if (K.form && K.form.jenis === 'kegiatan') pasangSeret($('#foto-konten'), 'x', ids => urutkanFotoForm(ids));
}

async function simpanUrutan(jenis, ids) {
  const daftar = jenis === 'banner' ? S.adm.data.banner : S.adm.data.area;
  const lama = daftar.map(x => ({ id: x.id, urutan: x.urutan }));
  ids.forEach((id, i) => { const x = daftar.filter(y => y.id === id)[0]; if (x) x.urutan = i + 1; });
  renderKonten();
  try {
    await panggil(jenis === 'banner' ? 'adminUrutkanBanner' : 'adminUrutkanArea', tokenAdmin(), ids);
    toast('Urutan disimpan', '');
  } catch (e) {
    lama.forEach(l => { const x = daftar.filter(y => y.id === l.id)[0]; if (x) x.urutan = l.urutan; });
    renderKonten();
    toastGalat(e, 'Urutan gagal disimpan');
  }
}

// ── Tab Banner ──
function htmlTabBanner() {
  const d = S.adm.data;
  const K = S.adm.konten;
  const daftar = bannerUrut();
  const bulan = kunciBulan(new Date());
  const statIni = d.statBanner.filter(s => s.bulan === bulan);
  const tayang = statIni.reduce((s, x) => s + (x.tayang || 0), 0);
  const klik = statIni.reduce((s, x) => s + (x.klik || 0), 0);
  const kartu = (b, i) => {
    const wa = b.linkTombol === 'wa';
    return `<article data-seret="${esc(b.id)}" class="bg-surface-page rounded-xl shadow-sm p-4 hover:shadow-md transition-all flex flex-col gap-4 ${K.form.data.id === b.id ? 'ring-2 ring-primary-container' : ''}">
      <div class="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        <div class="flex items-center gap-3 shrink-0">
          ${ikon('drag_indicator', 'text-outline cursor-grab hover:text-on-surface transition-colors select-none text-[22px] hidden lg:inline-block')}
          <div class="relative w-36 h-20 rounded-lg overflow-hidden shrink-0 shadow-inner bg-surface-container">
            ${gambarAdmin(b.foto, 400, 'w-full h-full object-cover', b.judul)}
            <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary text-on-primary font-label-md">#${i + 1}</span>
          </div>
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${b.status === 'Aktif' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'}">${esc(b.status)}</span>
            <span class="font-body-sm text-body-sm text-on-surface-variant">Diperbarui ${fRelatif(b.diperbarui)}</span>
          </div>
          <h3 class="font-headline-sm text-headline-sm text-on-surface truncate">${esc(b.judul)}</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">${esc(b.keterangan)}</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-between bg-surface-container-low px-3 py-2 rounded-lg gap-2">
        <div class="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm min-w-0">
          ${ikon(wa ? 'chat' : 'link', 'text-[16px] ' + (wa ? 'text-secondary' : 'text-primary'))}
          <span class="truncate">${b.teksTombol ? `CTA: <strong>${esc(b.teksTombol)}</strong> (<code class="${wa ? 'text-secondary' : 'text-primary'} font-table-data text-table-data">${esc(wa ? 'wa.me/' + ((S.umum && S.umum.wa) || '') : b.linkTombol)}</code>)` : 'Tanpa tombol CTA'}</span>
        </div>
        <div class="flex items-center gap-1">
          <label class="flex items-center gap-1.5 cursor-pointer mr-2">${sakelar(`data-ubah="banner-status" data-id="${esc(b.id)}" aria-label="Status aktif ${esc(b.judul)}"`, b.status === 'Aktif', true)}<span class="font-label-md text-[11px] ${b.status === 'Aktif' ? 'text-status-available' : 'text-on-surface-variant'}">${b.status === 'Aktif' ? 'Aktif' : 'Nonaktif'}</span></label>
          <button type="button" data-aksi="banner-geser" data-id="${esc(b.id)}" data-arah="-1" class="lg:hidden p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant" aria-label="Naikkan urutan">${ikon('arrow_upward', 'text-[18px]')}</button>
          <button type="button" data-aksi="banner-geser" data-id="${esc(b.id)}" data-arah="1" class="lg:hidden p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant" aria-label="Turunkan urutan">${ikon('arrow_downward', 'text-[18px]')}</button>
          <button type="button" data-aksi="banner-edit" data-id="${esc(b.id)}" data-pratinjau="1" class="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Pratinjau" aria-label="Pratinjau ${esc(b.judul)}">${ikon('visibility', 'text-[18px]')}</button>
          <button type="button" data-aksi="banner-edit" data-id="${esc(b.id)}" class="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Edit Konten" aria-label="Edit ${esc(b.judul)}">${ikon('edit', 'text-[18px]')}</button>
          <button type="button" data-aksi="banner-hapus" data-id="${esc(b.id)}" class="p-1.5 rounded-md hover:bg-error-container text-on-surface-variant hover:text-error transition-colors" title="Hapus Banner" aria-label="Hapus ${esc(b.judul)}">${ikon('delete', 'text-[18px]')}</button>
        </div>
      </div>
    </article>`;
  };
  return `<div class="flex flex-col gap-6">
    <div class="flex items-start gap-4 p-4 rounded-xl bg-tertiary-fixed/30 text-on-surface shadow-sm">
      <div class="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center shrink-0">${ikon('info', 'text-[20px]')}</div>
      <div class="flex flex-col gap-0.5"><h4 class="font-headline-sm text-headline-sm text-on-surface leading-tight">Konfigurasi Rotasi Otomatis Slider</h4>
        <p class="font-body-md text-body-md text-on-surface-variant">Sistem menampilkan maksimal <strong>3 banner aktif</strong> di halaman beranda publik. Banner berganti otomatis tiap <strong>5 detik</strong> dengan rasio gambar <strong>16:9 disarankan (1920×1080 px)</strong> untuk ketajaman optimal pada perangkat retina.</p></div>
    </div>
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div class="xl:col-span-7 flex flex-col gap-4">
        <div class="flex items-center justify-between px-1 gap-2">
          <div class="flex items-center gap-2"><span class="font-headline-sm text-headline-sm text-on-surface">Daftar Banner Slider</span><span class="px-2 py-0.5 rounded-full font-label-md text-body-sm bg-surface-container-highest text-on-surface-variant">${daftar.length} Slide</span></div>
          <span class="font-body-sm text-body-sm text-on-surface-variant hidden sm:flex items-center gap-1">${ikon('drag_indicator', 'text-[16px]')} Geser kartu untuk atur urutan</span>
        </div>
        <div id="daftar-banner" class="flex flex-col gap-4">${daftar.map(kartu).join('') || `<p class="bg-surface-page rounded-xl p-6 text-center text-on-surface-variant">Belum ada banner. Klik "+ Tambah Konten Baru".</p>`}</div>
        <div class="p-4 bg-surface-page rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <div class="flex items-center gap-3">
            <div class="p-2.5 rounded-lg bg-surface-container-high text-primary">${ikon('insights', 'text-[24px]')}</div>
            <div><div class="font-label-md text-label-md text-on-surface">Statistik Tayangan Slide Bulan Ini</div><div class="font-body-sm text-body-sm text-on-surface-variant">Total ${angka(tayang)} kali diputar • Rata-rata konversi klik tombol ${String(persen(klik, tayang)).replace('.', ',')}%</div></div>
          </div>
          <button type="button" data-nav="admin-laporan" data-tab="banner" class="text-primary font-label-md text-label-md hover:underline flex items-center gap-1 self-start sm:self-auto"><span>Detail Laporan</span>${ikon('arrow_forward', 'text-[16px]')}</button>
        </div>
      </div>
      <div class="xl:col-span-5 flex flex-col gap-6">
        <div class="bg-surface-page rounded-xl shadow-sm p-5 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2"><span class="relative flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-available opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-available"></span></span><h2 class="font-headline-sm text-headline-sm text-on-surface">Pratinjau Slider Beranda Live</h2></div>
            <span class="text-[11px] font-label-md uppercase tracking-wider text-outline px-2 py-0.5 rounded bg-surface-container">Rasio 16:9</span>
          </div>
          <div id="pratinjau-konten">${htmlPratinjauBanner()}</div>
          <div class="flex items-center justify-between text-body-sm text-on-surface-variant px-1 font-body-sm gap-2">
            <span class="flex items-center gap-1.5">${ikon('check_circle', 'text-[16px] text-secondary')}Pratinjau responsif sesuai tampilan mobile &amp; desktop</span>
            <span class="font-table-data text-table-data whitespace-nowrap">Autoplay: <strong>5.0s</strong></span>
          </div>
        </div>
        ${htmlFormBanner()}
      </div>
    </div>
  </div>`;
}

function slidePratinjau() {
  const K = S.adm.konten;
  const f = K.form.data;
  const daftar = bannerUrut().filter(b => b.status === 'Aktif').map(b => (b.id === f.id ? f : b));
  if (!f.id || daftar.indexOf(f) < 0) daftar.unshift(f);
  return daftar.slice(0, 3);
}

function htmlPratinjauBanner() {
  const K = S.adm.konten;
  const daftar = slidePratinjau();
  const iAktif = Math.max(0, daftar.indexOf(K.form.data));
  K.slide = iAktif;
  const warnaLencana = ['bg-gradient-mid/90 text-on-secondary-fixed', 'bg-primary-container text-on-primary', 'bg-whatsapp-green text-on-primary'];
  return `<div class="relative w-full aspect-[16/9] rounded-xl overflow-hidden shadow-md group select-none bg-inverse-surface">
    ${daftar.map((b, i) => `<div class="pv-slide absolute inset-0 transition-opacity duration-700 ${i === iAktif ? 'opacity-100' : 'opacity-0 pointer-events-none'}">
      ${gambarAdmin(b.foto, 800, 'w-full h-full object-cover', '')}
      <div class="absolute inset-0 bg-gradient-to-t from-[#0A2540]/90 via-[#0A2540]/40 to-transparent flex flex-col justify-end p-5 text-on-primary">
        <span class="px-2 py-0.5 rounded ${warnaLencana[i % 3]} text-[10px] font-bold w-fit mb-1.5 uppercase tracking-wide">Slide ${i + 1} dari ${daftar.length}</span>
        <h4 ${i === iAktif ? 'id="pv-judul"' : ''} class="font-headline-sm text-headline-sm font-bold text-on-primary leading-snug drop-shadow-sm">${esc(b.judul || 'Judul Banner Kosong')}</h4>
        <p ${i === iAktif ? 'id="pv-ket"' : ''} class="font-body-sm text-body-sm text-surface-container-low line-clamp-2 mt-1">${esc(b.keterangan || 'Deskripsi banner...')}</p>
        <div class="mt-3" ${i === iAktif ? 'id="pv-cta-wadah"' : ''} ${b.teksTombol ? '' : 'hidden'}><span ${i === iAktif ? 'id="pv-cta"' : ''} class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${b.linkTombol === 'wa' ? 'bg-whatsapp-green' : 'bg-primary-container'} text-on-primary text-[12px] font-label-md font-semibold shadow">${esc(b.teksTombol || 'Aksi')}</span></div>
      </div>
    </div>`).join('')}
    ${daftar.length > 1 ? `
      <button type="button" data-aksi="pv-geser" data-arah="-1" aria-label="Slide sebelumnya" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-surface-page/80 hover:bg-surface-page text-on-surface flex items-center justify-center transition-all shadow-sm">${ikon('chevron_left', 'text-[18px]')}</button>
      <button type="button" data-aksi="pv-geser" data-arah="1" aria-label="Slide berikutnya" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-surface-page/80 hover:bg-surface-page text-on-surface flex items-center justify-center transition-all shadow-sm">${ikon('chevron_right', 'text-[18px]')}</button>
      <div class="absolute bottom-2.5 right-4 flex items-center gap-1.5 z-10">${daftar.map((b, i) => `<span class="pv-titik ${i === iAktif ? 'w-6 bg-gradient-mid' : 'w-2.5 bg-surface-page/50'} h-1 rounded-full transition-all"></span>`).join('')}</div>` : ''}
  </div>`;
}

AKSI['pv-geser'] = el => {
  const K = S.adm.konten;
  const slide = $$('.pv-slide');
  const titik = $$('.pv-titik');
  if (!slide.length) return;
  K.slide = (K.slide + Number(el.dataset.arah) + slide.length) % slide.length;
  slide.forEach((s, i) => { s.classList.toggle('opacity-100', i === K.slide); s.classList.toggle('opacity-0', i !== K.slide); s.classList.toggle('pointer-events-none', i !== K.slide); });
  titik.forEach((t, i) => { t.classList.toggle('w-6', i === K.slide); t.classList.toggle('bg-gradient-mid', i === K.slide); t.classList.toggle('w-2.5', i !== K.slide); t.classList.toggle('bg-surface-page/50', i !== K.slide); });
};

const LINK_CEPAT = [['', 'Pilih tujuan cepat…'], ['/', 'Beranda'], ['/kamar', 'Katalog Kamar'], ['/testimoni', 'Testimoni'], ['/tentang-kami', 'Tentang Kami'], ['wa', 'WhatsApp Admin']];

function htmlFormBanner() {
  const K = S.adm.konten;
  const f = K.form.data;
  const urut = bannerUrut().findIndex(b => b.id === f.id);
  const info = K.form.fotoInfo;
  return `<div class="bg-surface-page rounded-xl shadow-sm p-6 flex flex-col gap-5" id="editor-panel">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">${ikon('edit_note', 'text-[20px]')}</div>
        <h3 class="font-headline-sm text-headline-sm text-on-surface">${f.id ? `Form Sunting Banner (#${urut + 1})` : 'Buat Banner Baru'}</h3></div>
      <span class="px-2 py-0.5 rounded text-[11px] font-label-md ${f.id ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-secondary-fixed text-on-secondary-fixed'}">${f.id ? 'Mode Sunting' : 'Mode Baru'}</span>
    </div>
    <form class="flex flex-col gap-4" data-kirim="banner" novalidate>
      <div class="flex flex-col gap-1.5">
        <label class="${KELAS.label} flex items-center justify-between" for="bn-label"><span>Label Kategori <span class="text-outline font-normal text-[11px]">(Opsional)</span></span><span class="text-[11px] text-on-surface-variant font-body-sm font-normal" data-hitung="label" data-maks="30">${f.label.length}/30</span></label>
        <input id="bn-label" maxlength="30" data-masukan="konten-isian" data-kunci="label" value="${esc(f.label)}" placeholder="Contoh: Akses Kampus & Perkantoran" class="${KELAS.inputAdm}">
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="${KELAS.label} flex items-center justify-between" for="bn-judul"><span>Judul Banner <span class="text-error">*</span></span><span class="text-[11px] text-on-surface-variant font-body-sm font-normal">Max. 45 Karakter</span></label>
        <input id="bn-judul" maxlength="45" data-masukan="konten-isian" data-kunci="judul" value="${esc(f.judul)}" placeholder="Tuliskan headline banner..." class="${KELAS.inputAdm}">
        ${galatKolom('judul')}
      </div>
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between"><label class="${KELAS.label}" for="bn-ket">Sub-deskripsi Ringkas <span class="text-error">*</span></label><span class="text-[11px] text-on-surface-variant font-table-data text-table-data" data-hitung="keterangan" data-maks="150">${f.keterangan.length}/150</span></div>
        <textarea id="bn-ket" rows="3" maxlength="150" data-masukan="konten-isian" data-kunci="keterangan" class="${KELAS.inputAdm} resize-none">${esc(f.keterangan)}</textarea>
        ${galatKolom('keterangan')}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="bn-cta">Teks Tombol CTA</label><input id="bn-cta" maxlength="25" data-masukan="konten-isian" data-kunci="teksTombol" value="${esc(f.teksTombol)}" class="${KELAS.inputAdm}">${galatKolom('teksTombol')}</div>
        <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="bn-link">Link Tujuan (URL)</label><input id="bn-link" data-masukan="konten-isian" data-kunci="linkTombol" value="${esc(f.linkTombol)}" placeholder="/kamar atau https:\/\/" class="${KELAS.inputAdm}">
          ${pilihan('data-ubah="banner-link-cepat" aria-label="Pilih tujuan cepat"', LINK_CEPAT, '', 'appearance-none cursor-pointer w-full pl-3 pr-8 py-1.5 rounded-lg bg-surface-subtle font-body-sm text-body-sm text-on-surface-variant focus:outline-none')}
          ${galatKolom('linkTombol')}</div>
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="${KELAS.label}">Foto Banner (16:9 Landscape)</span>
        <label class="relative group rounded-xl p-4 bg-surface-container-low hover:bg-surface-container transition-all flex flex-col items-center justify-center text-center cursor-pointer shadow-inner focus-within:ring-2 focus-within:ring-primary">
          <input type="file" accept="image/jpeg,image/png,image/webp" data-ubah="konten-foto-tunggal" data-modul="banner" class="absolute inset-0 opacity-0 cursor-pointer" aria-label="Unggah foto banner">
          <div class="flex items-center gap-4 w-full">
            <div class="w-20 h-14 rounded-lg overflow-hidden shrink-0 shadow bg-surface-container-highest">${gambarAdmin(f.foto, 300, 'w-full h-full object-cover', 'Foto banner')}</div>
            <div class="flex flex-col text-left flex-1 min-w-0" id="info-foto-tunggal">
              <span class="font-label-md text-label-md text-on-surface truncate">${f.foto ? esc(info ? info.nama : 'Foto banner tersimpan') : 'Belum ada foto'}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">${info ? `${info.lebar} × ${info.tinggi} px • ${info.kb} KB (JPEG)` : 'JPG / PNG / WebP • maks 2MB'}</span>
              <span class="font-label-md text-[11px] text-primary mt-0.5 group-hover:underline">${f.foto ? 'Ganti Berkas Gambar...' : 'Pilih Berkas Gambar...'}</span>
            </div>
            <div class="p-2 rounded-full bg-surface-page text-on-surface-variant group-hover:text-primary transition-colors shadow-sm">${ikon('cloud_upload', 'text-[20px]')}</div>
          </div>
        </label>
        ${galatKolom('foto')}
      </div>
      <div class="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-container-low">
        <div class="flex flex-col"><span class="${KELAS.label}">Status Publikasi Slide</span><span class="font-body-sm text-body-sm text-on-surface-variant">Tayangkan langsung di slider publik</span></div>
        ${sakelar(`data-ubah="konten-isian" data-kunci="status" data-nyala="Aktif" data-mati="Nonaktif" aria-label="Status publikasi"`, f.status === 'Aktif')}
      </div>
      ${galatKolom('status')}
      <div class="flex items-center justify-end gap-3 pt-3">
        <button type="button" data-aksi="konten-batal" class="${KELAS.tombolKedua}">Batal</button>
        <button type="submit" class="${KELAS.tombolUtama}">${ikon('save', 'text-[18px]')}<span>Simpan Perubahan</span></button>
      </div>
    </form>
  </div>`;
}

/** Ubah nilai formulir konten tanpa merender ulang form (fokus tetap) */
function isianKonten(el) {
  const K = S.adm.konten;
  if (!K.form) return;
  const k = el.dataset.kunci;
  let v;
  if (el.type === 'checkbox') v = el.dataset.nyala ? (el.checked ? el.dataset.nyala : el.dataset.mati) : el.checked;
  else v = el.value;
  if (K.form.data[k] === v) return;
  K.form.data[k] = v;
  tandaiKotor();
  const h = $(`[data-hitung="${k}"]`);
  if (h) h.textContent = String(v).length + '/' + h.dataset.maks;
  if (K.form.jenis === 'area' && k === 'jenis') { renderKonten(); return; }
  segarkanPratinjauKonten(k);
}
MASUKAN['konten-isian'] = isianKonten;
UBAH['konten-isian'] = isianKonten;

function segarkanPratinjauKonten(kunci) {
  const K = S.adm.konten;
  const f = K.form.data;
  if (K.form.jenis === 'banner') {
    if (kunci === 'status' || kunci === 'foto') { $('#pratinjau-konten').innerHTML = htmlPratinjauBanner(); return; }
    const j = $('#pv-judul'); if (j) j.textContent = f.judul || 'Judul Banner Kosong';
    const k = $('#pv-ket'); if (k) k.textContent = f.keterangan || 'Deskripsi banner...';
    const c = $('#pv-cta'); if (c) { c.textContent = f.teksTombol || 'Aksi'; c.className = c.className.replace(/bg-(whatsapp-green|primary-container)/, f.linkTombol === 'wa' ? 'bg-whatsapp-green' : 'bg-primary-container'); }
    const w = $('#pv-cta-wadah'); if (w) w.hidden = !f.teksTombol;
  } else if (K.form.jenis === 'kegiatan') {
    $('#pratinjau-konten').innerHTML = kartuKegiatan(Object.assign({}, f, { id: 'pratinjau' })).replace('data-aksi="buka-kegiatan"', '');
  } else if (K.form.jenis === 'area') {
    $('#pratinjau-konten').innerHTML = htmlPratinjauArea();
  } else if (K.form.jenis === 'visi') {
    $('#pratinjau-konten').innerHTML = htmlPratinjauVisi();
  }
}

UBAH['banner-link-cepat'] = el => {
  if (!el.value) return;
  const input = $('#bn-link');
  input.value = el.value;
  el.value = '';
  isianKonten(input);
};

/** Unggah satu foto (banner / area) */
UBAH['konten-foto-tunggal'] = async el => {
  const file = el.files && el.files[0];
  el.value = '';
  if (!file) return;
  const K = S.adm.konten;
  const modul = el.dataset.modul;
  const info = $('#info-foto-tunggal');
  if (info) info.innerHTML = `<span class="flex items-center gap-2 font-label-md text-label-md text-on-surface"><span class="putar putar-gelap"></span>Mengunggah foto...</span>`;
  try {
    const h = await unggahFotoAdmin(file, modul, modul === 'banner' ? { maks: 1920, target: 500 * 1024 } : { maks: 1600, target: 500 * 1024 });
    const lama = K.form.data.foto;
    if (lama && S.adm.unggahSementara.indexOf(lama) >= 0) {
      S.adm.unggahSementara = S.adm.unggahSementara.filter(x => x !== lama);
      panggil('adminBuangFoto', tokenAdmin(), [lama]).catch(() => { /* abaikan */ });
    }
    K.form.data.foto = h.id;
    K.form.fotoInfo = h;
    tandaiKotor();
    renderKonten();
  } catch (e) {
    toastGalat(e, 'Foto gagal diunggah');
    renderKonten();
  }
};

UBAH['banner-status'] = async el => {
  const d = S.adm.data;
  const b = d.banner.filter(x => x.id === el.dataset.id)[0];
  if (!b) return;
  const baru = el.checked ? 'Aktif' : 'Nonaktif';
  if (baru === 'Aktif' && d.banner.filter(x => x.status === 'Aktif' && x.id !== b.id).length >= 3) {
    el.checked = false;
    toast('Maksimal 3 banner aktif', 'Nonaktifkan salah satu terlebih dahulu.', 'galat');
    return;
  }
  const lama = b.status;
  b.status = baru;
  if (S.adm.konten.form && S.adm.konten.form.data.id === b.id) S.adm.konten.form.data.status = baru;
  renderKonten();
  try {
    await panggil('adminUbahStatusBanner', tokenAdmin(), b.id, baru);
    b.diperbarui = new Date().toISOString();
  } catch (e) {
    b.status = lama;
    renderKonten();
    toastGalat(e, 'Status gagal diubah');
  }
};

AKSI['banner-geser'] = el => {
  const ids = bannerUrut().map(b => b.id);
  const baru = geserDalamDaftar(ids, el.dataset.id, Number(el.dataset.arah));
  if (baru) simpanUrutan('banner', baru);
};

async function bolehGantiForm() {
  if (!S.kotor) return true;
  const ok = await konfirmasi({ judul: 'Perubahan belum disimpan', pesan: 'Buang perubahan pada formulir saat ini?', ok: 'Buang', bahaya: true });
  if (ok) batalPerubahan();
  return ok;
}

AKSI['banner-edit'] = async el => {
  const b = S.adm.data.banner.filter(x => x.id === el.dataset.id)[0];
  if (!b || (S.adm.konten.form && S.adm.konten.form.data.id === b.id)) {
    if (el.dataset.pratinjau) $('#pratinjau-konten') && $('#pratinjau-konten').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (!(await bolehGantiForm())) return;
  S.adm.konten.form = formBaru('banner', b);
  renderKonten();
  const t = el.dataset.pratinjau ? $('#pratinjau-konten') : $('#editor-panel');
  if (t) t.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

AKSI['banner-hapus'] = async el => {
  const b = S.adm.data.banner.filter(x => x.id === el.dataset.id)[0];
  if (!b) return;
  if (!(await konfirmasi({ judul: 'Hapus banner?', pesan: `Banner "${b.judul}" dan fotonya akan dihapus dari slider.`, ok: 'Hapus', bahaya: true }))) return;
  try {
    await panggil('adminHapusBanner', tokenAdmin(), b.id);
    S.adm.data.banner = S.adm.data.banner.filter(x => x.id !== b.id);
    if (S.adm.konten.form && S.adm.konten.form.data.id === b.id) { bersihkanKotor(); S.adm.konten.form = null; }
    renderKonten();
    toast('Banner dihapus', b.judul);
  } catch (e) {
    toastGalat(e, 'Banner gagal dihapus');
  }
};

KIRIM.banner = async form => {
  const f = S.adm.konten.form.data;
  const galat = {};
  if (!f.judul.trim()) galat.judul = 'Judul wajib diisi.';
  if (!f.keterangan.trim()) galat.keterangan = 'Sub-deskripsi wajib diisi.';
  if (f.teksTombol.trim() && !/^(wa|\/|\/kamar|\/testimoni|\/tentang-kami|\/kamar\/[A-Za-z0-9-]{1,10}|https:\/\/\S+)$/.test(f.linkTombol.trim())) galat.linkTombol = 'Link harus rute situs (/kamar), wa, atau alamat https:\/\/.';
  if (!f.foto) galat.foto = 'Foto banner wajib diunggah.';
  if (f.status === 'Aktif' && S.adm.data.banner.filter(x => x.status === 'Aktif' && x.id !== f.id).length >= 3) galat.status = 'Maksimal 3 banner aktif. Nonaktifkan salah satu terlebih dahulu.';
  if (Object.keys(galat).length) { aturGalatKolom(form, galat); return; }
  aturGalatKolom(form, null);
  const tombol = form.querySelector('[type=submit]');
  tombolSibuk(tombol, true, 'Menyimpan...');
  try {
    const hasil = await panggil('adminSimpanBanner', tokenAdmin(), f);
    gantiItem(S.adm.data.banner, hasil);
    bersihkanKotor();
    S.adm.konten.form = formBaru('banner', hasil);
    renderKonten();
    toast('Perubahan Disimpan', 'Data banner berhasil dimutakhirkan di sistem.');
  } catch (e) {
    tombolSibuk(tombol, false);
    if (e.kode === 'VALIDASI' && e.detail) aturGalatKolom(form, e.detail);
    else toastGalat(e, 'Banner gagal disimpan');
  }
};

AKSI['konten-batal'] = async () => {
  const K = S.adm.konten;
  if (S.kotor && !(await konfirmasi({ judul: 'Batalkan perubahan?', pesan: 'Isian formulir dikembalikan ke data tersimpan.', ok: 'Batalkan', bahaya: true }))) return;
  batalPerubahan();
  const id = K.form && K.form.data.id;
  const sumber = { banner: S.adm.data.banner, kegiatan: S.adm.data.kegiatan, area: S.adm.data.area }[K.form.jenis];
  const asli = id && sumber ? sumber.filter(x => x.id === id)[0] : null;
  K.form = K.form.jenis === 'visi' ? formBaru('visi') : (asli ? formBaru(K.form.jenis, asli) : null);
  renderKonten();
};

AKSI['konten-tab'] = async el => {
  const K = S.adm.konten;
  if (K.tab === el.dataset.tab) return;
  if (!(await bolehGantiForm())) return;
  K.tab = el.dataset.tab;
  K.form = null;
  K.cari = '';
  K.status = 'semua';
  K.hal = 1;
  renderKonten();
};

AKSI['tambah-konten'] = () => {
  const item = Modal.buka({
    lebar: 'max-w-lg', label: 'Tambah konten publik baru',
    isi: `<div class="flex flex-col gap-5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5"><div class="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">${ikon('post_add', 'text-[20px]')}</div>
          <div><h3 class="font-headline-sm text-headline-sm text-on-surface">Tambah Konten Publik Baru</h3><p class="font-body-sm text-body-sm text-on-surface-variant">Pilih jenis modul konten yang ingin dibuat</p></div></div>
        <button type="button" data-tk="tutup" aria-label="Tutup" class="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant">${ikon('close')}</button>
      </div>
      <div class="grid grid-cols-1 gap-3">${[
        ['banner', 'view_carousel', 'Slide Banner Beranda Utama', 'Gambar hero promosi 16:9 dengan tombol aksi'],
        ['kegiatan', 'celebration', 'Agenda &amp; Galeri Kegiatan Hunian', 'Foto aktivitas komunal seperti buka bersama / yoga'],
        ['area', 'local_laundry_service', 'Fasilitas Area Bersama', 'Dapur umum, laundry corner, rooftop, area santai']
      ].map(x => `<button type="button" data-tk="${x[0]}" class="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container-low hover:bg-tertiary-fixed/30 text-left transition-all group">
          <div class="p-2.5 rounded-lg bg-surface-page text-primary shadow-sm group-hover:bg-primary-container group-hover:text-on-primary transition-colors">${ikon(x[1], 'text-[22px]')}</div>
          <div class="flex flex-col flex-1"><span class="font-label-md text-label-md text-on-surface">${x[2]}</span><span class="font-body-sm text-body-sm text-on-surface-variant">${x[3]}</span></div>
          ${ikon('chevron_right', 'text-outline group-hover:text-primary')}</button>`).join('')}</div>
      <div class="flex justify-end pt-2"><button type="button" data-tk="tutup" class="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high font-label-md text-label-md text-on-surface">Tutup</button></div>
    </div>`
  });
  $$('[data-tk]', item.panel).forEach(b => b.addEventListener('click', async () => {
    const j = b.dataset.tk;
    Modal.tutup(item);
    if (j === 'tutup') return;
    if (!(await bolehGantiForm())) return;
    const K = S.adm.konten;
    K.tab = j;
    K.form = formBaru(j);
    renderKonten();
    const ed = $('#editor-panel');
    if (ed) ed.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
};

AKSI['riwayat-revisi'] = async () => {
  const item = Modal.buka({
    lebar: 'max-w-xl', label: 'Riwayat revisi konten',
    isi: `<div class="flex items-center justify-between pb-3"><h3 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">${ikon('history', 'text-primary')}Riwayat Revisi Konten</h3>
      <button type="button" data-rr="tutup" aria-label="Tutup" class="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center">${ikon('close', 'text-[20px]')}</button></div>
      <div data-rr="isi" class="flex flex-col gap-2">${kerangkaBlok('h-14')}${kerangkaBlok('h-14')}${kerangkaBlok('h-14')}</div>`
  });
  item.panel.querySelector('[data-rr=tutup]').addEventListener('click', () => Modal.tutup(item));
  const muat = async hal => {
    const wadah = item.panel.querySelector('[data-rr=isi]');
    try {
      const r = await panggil('adminRiwayat', tokenAdmin(), { halaman: hal });
      const total = Math.max(1, Math.ceil(r.total / 20));
      wadah.innerHTML = (r.items.map(x => `<div class="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-fixed text-on-primary-fixed shrink-0 mt-0.5">${esc(x.aksi)}</span>
          <div class="min-w-0 flex-1"><p class="font-body-md text-body-md text-on-surface">${esc(x.ringkasan)}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${esc(x.modul)} • ${esc(x.pengguna)} • ${fTgl(x.waktu, 'pendekJam')}</p></div>
        </div>`).join('') || '<p class="text-center py-6 text-on-surface-variant">Belum ada riwayat perubahan.</p>') +
        (total > 1 ? `<div class="flex items-center justify-between pt-2 font-body-sm text-body-sm text-on-surface-variant"><span>Halaman ${hal} dari ${total}</span><div class="flex gap-2">
          <button type="button" data-rr-hal="${hal - 1}" ${hal <= 1 ? 'disabled' : ''} class="${KELAS.tombolKedua} py-1.5 disabled:opacity-40">Sebelumnya</button>
          <button type="button" data-rr-hal="${hal + 1}" ${hal >= total ? 'disabled' : ''} class="${KELAS.tombolKedua} py-1.5 disabled:opacity-40">Berikutnya</button></div></div>` : '');
      $$('[data-rr-hal]', wadah).forEach(b => b.addEventListener('click', () => muat(Number(b.dataset.rrHal))));
    } catch (e) {
      wadah.innerHTML = `<p class="text-center py-6 text-error">${esc(e.message)}</p>`;
    }
  };
  muat(1);
};

// ── Tab Galeri Kegiatan ──
function htmlTabKegiatan() {
  const K = S.adm.konten;
  const q = K.cari.toLowerCase();
  const daftar = S.adm.data.kegiatan.slice().sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1))
    .filter(g => (K.status === 'semua' || g.status === K.status) && (!q || (g.judul + ' ' + g.ringkas).toLowerCase().indexOf(q) >= 0));
  const per = 10;
  const totalHal = Math.max(1, Math.ceil(daftar.length / per));
  K.hal = Math.min(K.hal, totalHal);
  const tampil = daftar.slice((K.hal - 1) * per, K.hal * per);
  return `<div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
    <div class="xl:col-span-7 flex flex-col gap-4">
      <div class="bg-surface-page rounded-xl shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div class="relative flex-1">${ikon('search', 'absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-outline')}
          <input type="search" data-masukan="konten-cari" value="${esc(K.cari)}" placeholder="Cari judul atau keterangan kegiatan..." class="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface-subtle text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-page shadow-inner" aria-label="Cari kegiatan"></div>
        <div class="sm:w-48">${pilihan('data-ubah="konten-status" aria-label="Filter status"', [['semua', 'Semua Status'], ['Tampil', 'Tampil'], ['Disembunyikan', 'Disembunyikan']], K.status)}</div>
      </div>
      <div class="flex flex-col gap-3">${tampil.map(g => `
        <article class="bg-surface-page rounded-xl shadow-sm p-4 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center ${K.form.data.id === g.id ? 'ring-2 ring-primary-container' : ''}">
          <div class="relative w-36 h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container">${gambarAdmin((g.foto[0] || {}).id, 400, 'w-full h-full object-cover', g.judul)}
            <span class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-status-available text-on-primary">${fTgl(g.tanggal)}</span></div>
          <div class="flex-1 min-w-0 flex flex-col gap-1">
            <div class="flex items-center gap-2"><span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${g.status === 'Tampil' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'}">${esc(g.status)}</span><span class="font-body-sm text-body-sm text-on-surface-variant">${g.foto.length} foto</span></div>
            <h3 class="font-headline-sm text-body-lg font-semibold text-on-surface truncate">${esc(g.judul)}</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">${esc(g.ringkas)}</p>
          </div>
          <div class="flex items-center gap-1 self-end sm:self-center">
            ${sakelar(`data-ubah="kegiatan-status" data-id="${esc(g.id)}" aria-label="Tampilkan ${esc(g.judul)}"`, g.status === 'Tampil', true)}
            <button type="button" data-aksi="konten-edit" data-jenis="kegiatan" data-id="${esc(g.id)}" class="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-primary" aria-label="Edit ${esc(g.judul)}">${ikon('edit', 'text-[18px]')}</button>
            <button type="button" data-aksi="konten-hapus" data-jenis="kegiatan" data-id="${esc(g.id)}" class="p-1.5 rounded-md hover:bg-error-container text-on-surface-variant hover:text-error" aria-label="Hapus ${esc(g.judul)}">${ikon('delete', 'text-[18px]')}</button>
          </div>
        </article>`).join('') || `<p class="bg-surface-page rounded-xl p-6 text-center text-on-surface-variant">Tidak ada kegiatan yang cocok.</p>`}</div>
      <div class="flex items-center justify-between gap-2 font-body-sm text-body-sm text-on-surface-variant"><span>Menampilkan ${tampil.length} dari ${daftar.length} kegiatan</span>${paginasiAdmin(K.hal, totalHal, 'konten-hal')}</div>
    </div>
    <div class="xl:col-span-5 flex flex-col gap-6">
      <div class="bg-surface-page rounded-xl shadow-sm p-5 flex flex-col gap-4">
        <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-status-available"></span><h2 class="font-headline-sm text-headline-sm text-on-surface">Pratinjau Kartu Kegiatan</h2></div>
        <div id="pratinjau-konten" class="max-w-sm">${kartuKegiatan(Object.assign({}, K.form.data, { id: 'pratinjau' })).replace('data-aksi="buka-kegiatan"', '')}</div>
      </div>
      ${htmlFormKegiatan()}
    </div>
  </div>`;
}

function htmlFotoForm(foto, maks, modul) {
  return `<div id="foto-konten" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
    ${foto.map((f, i) => `<div data-seret="${esc(f.id)}" class="relative rounded-xl overflow-hidden bg-surface-container shadow-sm group">
      <div class="aspect-[4/3]">${gambarAdmin(f.id, 400, 'w-full h-full object-cover', f.keterangan || 'Foto ' + (i + 1))}</div>
      ${i === 0 ? '<span class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-primary-container text-on-primary uppercase">Sampul</span>' : ''}
      <div class="absolute top-1.5 right-1.5 flex gap-1">
        <button type="button" data-aksi="foto-form-geser" data-id="${esc(f.id)}" data-arah="-1" class="w-7 h-7 rounded-full bg-surface-page/90 text-on-surface flex items-center justify-center shadow ${i === 0 ? 'hidden' : ''}" aria-label="Geser ke kiri">${ikon('chevron_left', 'text-[16px]')}</button>
        <button type="button" data-aksi="foto-form-hapus" data-id="${esc(f.id)}" class="w-7 h-7 rounded-full bg-surface-page/90 text-error flex items-center justify-center shadow" aria-label="Hapus foto">${ikon('close', 'text-[16px]')}</button>
      </div>
      <input data-masukan="foto-form-ket" data-id="${esc(f.id)}" value="${esc(f.keterangan || '')}" maxlength="40" placeholder="Keterangan foto" aria-label="Keterangan foto ${i + 1}" class="w-full px-2 py-1.5 bg-surface-page/95 font-body-sm text-body-sm text-on-surface focus:outline-none border-t border-border-subtle">
    </div>`).join('')}
    ${foto.length < maks ? `<label class="relative aspect-[4/3] rounded-xl bg-surface-container-low hover:bg-surface-container flex flex-col items-center justify-center text-center cursor-pointer border-2 border-dashed border-outline-variant focus-within:ring-2 focus-within:ring-primary">
      <input type="file" multiple accept="image/jpeg,image/png,image/webp" data-ubah="konten-foto-banyak" data-modul="${modul}" class="absolute inset-0 opacity-0 cursor-pointer" aria-label="Unggah foto">
      ${ikon('add_photo_alternate', 'text-[28px] text-primary')}<span class="font-label-md text-label-md text-primary mt-1">Unggah Foto</span><span class="font-body-sm text-[11px] text-outline">${foto.length} dari ${maks}</span>
    </label>` : ''}
  </div>`;
}

function htmlFormKegiatan() {
  const f = S.adm.konten.form.data;
  return `<div class="bg-surface-page rounded-xl shadow-sm p-6 flex flex-col gap-5" id="editor-panel">
    <div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">${ikon('edit_note', 'text-[20px]')}</div>
      <h3 class="font-headline-sm text-headline-sm text-on-surface">${f.id ? 'Form Sunting Kegiatan' : 'Tambah Kegiatan Baru'}</h3></div>
      <span class="px-2 py-0.5 rounded text-[11px] font-label-md ${f.id ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-secondary-fixed text-on-secondary-fixed'}">${f.id ? 'Mode Sunting' : 'Mode Baru'}</span></div>
    <form class="flex flex-col gap-4" data-kirim="kegiatan" novalidate>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="kg-tgl">Tanggal <span class="text-error">*</span></label><input id="kg-tgl" type="date" data-ubah="konten-isian" data-masukan="konten-isian" data-kunci="tanggal" value="${esc(f.tanggal)}" class="${KELAS.inputAdm}">${galatKolom('tanggal')}</div>
        <div class="flex flex-col gap-1.5 sm:col-span-2"><label class="${KELAS.label} flex justify-between" for="kg-judul"><span>Judul <span class="text-error">*</span></span><span class="text-[11px] font-normal text-on-surface-variant" data-hitung="judul" data-maks="60">${f.judul.length}/60</span></label><input id="kg-judul" maxlength="60" data-masukan="konten-isian" data-kunci="judul" value="${esc(f.judul)}" class="${KELAS.inputAdm}">${galatKolom('judul')}</div>
      </div>
      <div class="flex flex-col gap-1.5"><label class="${KELAS.label} flex justify-between" for="kg-ringkas"><span>Keterangan Singkat <span class="text-error">*</span></span><span class="text-[11px] font-normal text-on-surface-variant" data-hitung="ringkas" data-maks="160">${f.ringkas.length}/160</span></label><textarea id="kg-ringkas" rows="2" maxlength="160" data-masukan="konten-isian" data-kunci="ringkas" class="${KELAS.inputAdm} resize-none">${esc(f.ringkas)}</textarea>${galatKolom('ringkas')}</div>
      <div class="flex flex-col gap-1.5"><label class="${KELAS.label} flex justify-between" for="kg-desk"><span>Deskripsi Lengkap <span class="text-outline font-normal text-[11px]">(Opsional)</span></span><span class="text-[11px] font-normal text-on-surface-variant" data-hitung="deskripsi" data-maks="1500">${f.deskripsi.length}/1500</span></label><textarea id="kg-desk" rows="4" maxlength="1500" data-masukan="konten-isian" data-kunci="deskripsi" class="${KELAS.inputAdm} resize-y">${esc(f.deskripsi)}</textarea></div>
      <div class="flex flex-col gap-1.5"><span class="${KELAS.label}">Foto Kegiatan <span class="text-error">*</span> <span class="text-outline font-normal text-[11px]">(1–6 foto, foto pertama = sampul)</span></span>${htmlFotoForm(f.foto, 6, 'kegiatan')}${galatKolom('foto')}</div>
      <div class="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-container-low">
        <div class="flex flex-col"><span class="${KELAS.label}">Tampilkan di Galeri Publik</span><span class="font-body-sm text-body-sm text-on-surface-variant">Muncul di Beranda bagian Galeri Kegiatan</span></div>
        ${sakelar('data-ubah="konten-isian" data-kunci="status" data-nyala="Tampil" data-mati="Disembunyikan" aria-label="Status tampil"', f.status === 'Tampil')}
      </div>
      <div class="flex items-center justify-end gap-3 pt-3">
        <button type="button" data-aksi="konten-batal" class="${KELAS.tombolKedua}">Batal</button>
        <button type="submit" class="${KELAS.tombolUtama}">${ikon('save', 'text-[18px]')}<span>Simpan</span></button>
      </div>
    </form>
  </div>`;
}

MASUKAN['konten-cari'] = debounce(el => { S.adm.konten.cari = el.value; S.adm.konten.hal = 1; renderKontenTetapFokus('[data-masukan=konten-cari]'); }, 250);
UBAH['konten-status'] = el => { S.adm.konten.status = el.value; S.adm.konten.hal = 1; renderKonten(); };
AKSI['konten-hal'] = el => { S.adm.konten.hal = Number(el.dataset.hal) || 1; renderKonten(); };

function renderKontenTetapFokus(sel) {
  const el = $(sel);
  const pos = el ? el.selectionStart : null;
  renderKonten();
  const baru = $(sel);
  if (baru) { baru.focus(); if (pos !== null) try { baru.setSelectionRange(pos, pos); } catch (e) { /* abaikan */ } }
}

UBAH['konten-foto-banyak'] = async el => {
  const files = Array.from(el.files || []);
  el.value = '';
  const f = S.adm.konten.form.data;
  const maks = 6;
  const sisa = maks - f.foto.length;
  if (!files.length) return;
  if (files.length > sisa) toast('Batas foto', `Maksimal ${maks} foto. ${files.length - sisa} foto tidak diunggah.`, 'info');
  for (const file of files.slice(0, sisa)) {
    try {
      toast('Mengunggah foto...', file.name, 'info');
      const h = await unggahFotoAdmin(file, el.dataset.modul, { maks: 1600, target: 500 * 1024 });
      f.foto.push({ id: h.id, keterangan: '' });
      tandaiKotor();
      renderKonten();
    } catch (e) {
      toastGalat(e, 'Foto gagal diunggah');
    }
  }
};

function urutkanFotoForm(ids) {
  const f = S.adm.konten.form.data;
  f.foto = ids.map(id => f.foto.filter(x => x.id === id)[0]).filter(Boolean);
  tandaiKotor();
  renderKonten();
}

AKSI['foto-form-geser'] = el => {
  const f = S.adm.konten.form.data;
  const baru = geserDalamDaftar(f.foto.map(x => x.id), el.dataset.id, Number(el.dataset.arah));
  if (baru) urutkanFotoForm(baru);
};
AKSI['foto-form-hapus'] = el => {
  const f = S.adm.konten.form.data;
  f.foto = f.foto.filter(x => x.id !== el.dataset.id);
  if (S.adm.unggahSementara.indexOf(el.dataset.id) >= 0) {
    S.adm.unggahSementara = S.adm.unggahSementara.filter(x => x !== el.dataset.id);
    panggil('adminBuangFoto', tokenAdmin(), [el.dataset.id]).catch(() => { /* abaikan */ });
  }
  tandaiKotor();
  renderKonten();
};
MASUKAN['foto-form-ket'] = el => {
  const x = S.adm.konten.form.data.foto.filter(y => y.id === el.dataset.id)[0];
  if (x) { x.keterangan = el.value; tandaiKotor(); }
};

UBAH['kegiatan-status'] = async el => {
  const g = S.adm.data.kegiatan.filter(x => x.id === el.dataset.id)[0];
  if (!g) return;
  const lama = g.status;
  g.status = el.checked ? 'Tampil' : 'Disembunyikan';
  renderKonten();
  try {
    await panggil('adminUbahStatusKegiatan', tokenAdmin(), g.id, g.status);
  } catch (e) {
    g.status = lama;
    renderKonten();
    toastGalat(e, 'Status gagal diubah');
  }
};

AKSI['konten-edit'] = async el => {
  const jenis = el.dataset.jenis;
  const sumber = jenis === 'kegiatan' ? S.adm.data.kegiatan : S.adm.data.area;
  const item = sumber.filter(x => x.id === el.dataset.id)[0];
  if (!item || !(await bolehGantiForm())) return;
  S.adm.konten.form = formBaru(jenis, item);
  renderKonten();
  const ed = $('#editor-panel');
  if (ed) ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

AKSI['konten-hapus'] = async el => {
  const jenis = el.dataset.jenis;
  const kunci = jenis === 'kegiatan' ? 'kegiatan' : 'area';
  const item = S.adm.data[kunci].filter(x => x.id === el.dataset.id)[0];
  if (!item) return;
  const nama = item.judul || item.nama;
  if (!(await konfirmasi({ judul: 'Hapus data?', pesan: `"${nama}" beserta fotonya akan dihapus.`, ok: 'Hapus', bahaya: true }))) return;
  try {
    await panggil(jenis === 'kegiatan' ? 'adminHapusKegiatan' : 'adminHapusArea', tokenAdmin(), item.id);
    S.adm.data[kunci] = S.adm.data[kunci].filter(x => x.id !== item.id);
    if (S.adm.konten.form && S.adm.konten.form.data.id === item.id) { bersihkanKotor(); S.adm.konten.form = null; }
    renderKonten();
    toast('Data dihapus', nama);
  } catch (e) {
    toastGalat(e, 'Gagal menghapus');
  }
};

KIRIM.kegiatan = async form => {
  const f = S.adm.konten.form.data;
  const galat = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.tanggal)) galat.tanggal = 'Pilih tanggal kegiatan.';
  if (!f.judul.trim()) galat.judul = 'Judul wajib diisi.';
  if (!f.ringkas.trim()) galat.ringkas = 'Keterangan singkat wajib diisi.';
  if (!f.foto.length) galat.foto = 'Unggah minimal 1 foto kegiatan.';
  if (Object.keys(galat).length) { aturGalatKolom(form, galat); return; }
  aturGalatKolom(form, null);
  const tombol = form.querySelector('[type=submit]');
  tombolSibuk(tombol, true, 'Menyimpan...');
  try {
    const hasil = await panggil('adminSimpanKegiatan', tokenAdmin(), f);
    gantiItem(S.adm.data.kegiatan, hasil);
    bersihkanKotor();
    S.adm.konten.form = formBaru('kegiatan', hasil);
    renderKonten();
    toast('Kegiatan disimpan', hasil.judul);
  } catch (e) {
    tombolSibuk(tombol, false);
    if (e.kode === 'VALIDASI' && e.detail) aturGalatKolom(form, e.detail);
    else toastGalat(e, 'Kegiatan gagal disimpan');
  }
};

// ── Tab Area Fasilitas Umum ──
function htmlTabArea() {
  const daftar = areaUrut();
  const K = S.adm.konten;
  return `<div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
    <div class="xl:col-span-7 flex flex-col gap-4">
      <div class="flex items-center justify-between px-1 gap-2">
        <div class="flex items-center gap-2"><span class="font-headline-sm text-headline-sm text-on-surface">Daftar Area &amp; Layanan</span><span class="px-2 py-0.5 rounded-full font-label-md text-body-sm bg-surface-container-highest text-on-surface-variant">${daftar.length} Item</span></div>
        <span class="font-body-sm text-body-sm text-on-surface-variant hidden sm:flex items-center gap-1">${ikon('drag_indicator', 'text-[16px]')} Geser kartu untuk atur urutan</span>
      </div>
      <div id="daftar-area" class="flex flex-col gap-3">${daftar.map(a => `
        <article data-seret="${esc(a.id)}" class="bg-surface-page rounded-xl shadow-sm p-4 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center ${K.form.data.id === a.id ? 'ring-2 ring-primary-container' : ''}">
          <div class="flex items-center gap-3 shrink-0">${ikon('drag_indicator', 'text-outline cursor-grab text-[22px] hidden lg:inline-block')}
            <div class="relative w-32 h-20 rounded-lg overflow-hidden bg-surface-container">${gambarAdmin(a.foto, 400, 'w-full h-full object-cover', a.nama)}</div></div>
          <div class="flex-1 min-w-0 flex flex-col gap-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-container text-on-surface">${ikon(a.ikon, 'text-[13px] text-secondary')}${esc(a.label)}</span>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${a.jenis === 'Layanan Berbayar' ? 'bg-amber-100 text-amber-800' : 'bg-tertiary-fixed text-on-tertiary-fixed'}">${esc(a.jenis)}</span>
              ${a.status !== 'Tampil' ? '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-container-high text-on-surface-variant">Disembunyikan</span>' : ''}
            </div>
            <h3 class="font-headline-sm text-body-lg font-semibold text-on-surface truncate">${esc(a.nama)}</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">${esc(a.deskripsi)}</p>
          </div>
          <div class="flex items-center gap-1 self-end sm:self-center">
            ${sakelar(`data-ubah="area-status" data-id="${esc(a.id)}" aria-label="Tampilkan ${esc(a.nama)}"`, a.status === 'Tampil', true)}
            <button type="button" data-aksi="area-geser" data-id="${esc(a.id)}" data-arah="-1" class="lg:hidden p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant" aria-label="Naikkan">${ikon('arrow_upward', 'text-[18px]')}</button>
            <button type="button" data-aksi="area-geser" data-id="${esc(a.id)}" data-arah="1" class="lg:hidden p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant" aria-label="Turunkan">${ikon('arrow_downward', 'text-[18px]')}</button>
            <button type="button" data-aksi="konten-edit" data-jenis="area" data-id="${esc(a.id)}" class="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-primary" aria-label="Edit ${esc(a.nama)}">${ikon('edit', 'text-[18px]')}</button>
            <button type="button" data-aksi="konten-hapus" data-jenis="area" data-id="${esc(a.id)}" class="p-1.5 rounded-md hover:bg-error-container text-on-surface-variant hover:text-error" aria-label="Hapus ${esc(a.nama)}">${ikon('delete', 'text-[18px]')}</button>
          </div>
        </article>`).join('') || `<p class="bg-surface-page rounded-xl p-6 text-center text-on-surface-variant">Belum ada area umum.</p>`}</div>
    </div>
    <div class="xl:col-span-5 flex flex-col gap-6">
      <div class="bg-surface-page rounded-xl shadow-sm p-5 flex flex-col gap-4">
        <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-status-available"></span><h2 class="font-headline-sm text-headline-sm text-on-surface">Pratinjau Kartu Tentang Kami</h2></div>
        <div id="pratinjau-konten">${htmlPratinjauArea()}</div>
      </div>
      ${htmlFormArea()}
    </div>
  </div>`;
}

function htmlPratinjauArea() {
  const a = S.adm.konten.form.data;
  if (a.jenis === 'Layanan Berbayar') {
    return `<div class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-md">
      <div class="h-40 relative overflow-hidden">${gambarAdmin(a.foto, 600, 'w-full h-full object-cover', a.nama)}
        <div class="absolute top-3 left-3 bg-amber-500 text-white font-label-md text-body-sm px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">${ikon('price_change', 'text-[16px]')}<span>${esc(a.label || 'Label Badge')}</span></div></div>
      <div class="p-space-md">${a.eyebrow ? `<span class="text-body-sm font-label-md text-secondary uppercase tracking-wider">${esc(a.eyebrow)}</span>` : ''}
        <h3 class="font-headline-sm text-headline-sm text-on-surface mt-1">${esc(a.nama || 'Nama Layanan')}</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-3">${esc(a.deskripsi || 'Deskripsi layanan...')}</p>
        <div class="grid grid-cols-3 gap-2 mt-3">${(a.harga || []).map(h => `<div class="p-2 rounded-lg bg-surface-subtle"><span class="font-label-md text-[11px] text-primary block">${esc(h.nama)}</span><span class="font-body-sm text-[11px] text-on-surface-variant">${esc(h.harga)}</span></div>`).join('')}</div>
      </div></div>`;
  }
  return `<article class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm flex flex-col max-w-sm">
    <div class="relative h-44 overflow-hidden">${gambarAdmin(a.foto, 600, 'w-full h-full object-cover', a.nama)}
      <div class="absolute top-3 left-3 bg-surface-container-lowest/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">${ikon(a.ikon || 'verified', 'text-[16px] text-secondary')}<span class="font-label-md text-body-sm text-on-surface">${esc(a.label || 'Label Badge')}</span></div></div>
    <div class="p-space-md"><h3 class="font-headline-md text-headline-sm text-on-surface mb-2">${esc(a.nama || 'Nama Area')}</h3><p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">${esc(a.deskripsi || 'Deskripsi area...')}</p>
      ${a.catatan ? `<div class="mt-space-sm flex items-center gap-2 ${a.penting ? 'text-error' : 'text-secondary'} font-label-md text-body-sm">${ikon('check_circle', 'text-[18px]')}<span>${esc(a.catatan)}</span></div>` : ''}</div>
  </article>`;
}

function htmlFormArea() {
  const f = S.adm.konten.form.data;
  const berbayar = f.jenis === 'Layanan Berbayar';
  const harga = (f.harga || []).concat([{}, {}, {}]).slice(0, 3);
  return `<div class="bg-surface-page rounded-xl shadow-sm p-6 flex flex-col gap-5" id="editor-panel">
    <div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">${ikon('edit_note', 'text-[20px]')}</div>
      <h3 class="font-headline-sm text-headline-sm text-on-surface">${f.id ? 'Form Sunting Area' : 'Tambah Area / Layanan Baru'}</h3></div>
      <span class="px-2 py-0.5 rounded text-[11px] font-label-md ${f.id ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-secondary-fixed text-on-secondary-fixed'}">${f.id ? 'Mode Sunting' : 'Mode Baru'}</span></div>
    <form class="flex flex-col gap-4" data-kirim="area" novalidate>
      <div class="flex flex-col gap-1.5"><span class="${KELAS.label}">Jenis <span class="text-error">*</span></span>
        <div class="grid grid-cols-2 gap-2">${['Fasilitas', 'Layanan Berbayar'].map(j => `<label class="flex items-center gap-2 p-3 rounded-lg bg-surface-container-low cursor-pointer hover:bg-surface-container"><input type="radio" name="area-jenis" value="${j}" data-ubah="konten-isian" data-kunci="jenis" ${f.jenis === j ? 'checked' : ''} class="accent-[#1565c0]"><span class="font-label-md text-label-md text-on-surface">${j}</span></label>`).join('')}</div></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="ar-nama">Nama Area <span class="text-error">*</span></label><input id="ar-nama" maxlength="40" data-masukan="konten-isian" data-kunci="nama" value="${esc(f.nama)}" class="${KELAS.inputAdm}">${galatKolom('nama')}</div>
        <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="ar-label">Label Badge <span class="text-error">*</span></label><input id="ar-label" maxlength="24" data-masukan="konten-isian" data-kunci="label" value="${esc(f.label)}" placeholder="Area Bersama" class="${KELAS.inputAdm}">${galatKolom('label')}</div>
      </div>
      <div class="flex flex-col gap-1.5"><span class="${KELAS.label}">Ikon Badge <span class="text-error">*</span></span>
        <div class="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Pilih ikon">${KONST.IKON.map(n => `<label class="relative cursor-pointer" title="${n}"><input type="radio" name="area-ikon" value="${n}" data-ubah="konten-isian" data-kunci="ikon" ${f.ikon === n ? 'checked' : ''} class="sr-only peer" aria-label="${n}"><span class="w-full aspect-square rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface-variant peer-checked:bg-primary-container peer-checked:text-on-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary">${ikon(n, 'text-[20px]')}</span></label>`).join('')}</div>${galatKolom('ikon')}</div>
      <div class="flex flex-col gap-1.5"><label class="${KELAS.label} flex justify-between" for="ar-desk"><span>Deskripsi <span class="text-error">*</span></span><span class="text-[11px] font-normal text-on-surface-variant" data-hitung="deskripsi" data-maks="240">${f.deskripsi.length}/240</span></label><textarea id="ar-desk" rows="3" maxlength="240" data-masukan="konten-isian" data-kunci="deskripsi" class="${KELAS.inputAdm} resize-none">${esc(f.deskripsi)}</textarea>${galatKolom('deskripsi')}</div>
      ${berbayar ? '' : `<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div class="flex flex-col gap-1.5 sm:col-span-2"><label class="${KELAS.label}" for="ar-cat">Catatan <span class="text-outline font-normal text-[11px]">(Opsional)</span></label><input id="ar-cat" maxlength="50" data-masukan="konten-isian" data-kunci="catatan" value="${esc(f.catatan)}" placeholder="Terbuka hingga 21:00 WIB" class="${KELAS.inputAdm}"></div>
        <label class="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-surface-container-low"><span class="font-label-md text-[12px] text-on-surface">Catatan penting (merah)</span>${sakelar('data-ubah="konten-isian" data-kunci="penting"', f.penting, true)}</label>
      </div>`}
      ${berbayar ? `<div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="ar-eyebrow">Eyebrow</label><input id="ar-eyebrow" maxlength="30" data-masukan="konten-isian" data-kunci="eyebrow" value="${esc(f.eyebrow)}" placeholder="Praktis & Hemat Waktu" class="${KELAS.inputAdm}"></div>
        <div class="flex flex-col gap-2"><span class="${KELAS.label}">Daftar Harga <span class="text-error">*</span> <span class="text-outline font-normal text-[11px]">(maks 3)</span></span>
          ${harga.map((h, i) => `<div class="grid grid-cols-3 gap-2"><input data-masukan="area-harga" data-i="${i}" data-f="nama" value="${esc(h.nama || '')}" maxlength="30" placeholder="Reguler 2 Hari" class="${KELAS.inputAdm}" aria-label="Nama paket ${i + 1}"><input data-masukan="area-harga" data-i="${i}" data-f="harga" value="${esc(h.harga || '')}" maxlength="30" placeholder="Rp 6.000 / kg" class="${KELAS.inputAdm}" aria-label="Harga paket ${i + 1}"><input data-masukan="area-harga" data-i="${i}" data-f="keterangan" value="${esc(h.keterangan || '')}" maxlength="40" placeholder="Cuci + Setrika" class="${KELAS.inputAdm}" aria-label="Keterangan paket ${i + 1}"></div>`).join('')}
          ${galatKolom('harga')}</div>` : ''}
      <div class="flex flex-col gap-1.5"><span class="${KELAS.label}">Foto <span class="text-error">*</span></span>
        <label class="relative group rounded-xl p-4 bg-surface-container-low hover:bg-surface-container transition-all cursor-pointer shadow-inner focus-within:ring-2 focus-within:ring-primary">
          <input type="file" accept="image/jpeg,image/png,image/webp" data-ubah="konten-foto-tunggal" data-modul="area" class="absolute inset-0 opacity-0 cursor-pointer" aria-label="Unggah foto area">
          <div class="flex items-center gap-4 w-full"><div class="w-20 h-14 rounded-lg overflow-hidden shrink-0 shadow bg-surface-container-highest">${gambarAdmin(f.foto, 300, 'w-full h-full object-cover', 'Foto area')}</div>
            <div class="flex flex-col text-left flex-1 min-w-0" id="info-foto-tunggal"><span class="font-label-md text-label-md text-on-surface truncate">${f.foto ? 'Foto tersimpan' : 'Belum ada foto'}</span><span class="font-label-md text-[11px] text-primary mt-0.5 group-hover:underline">${f.foto ? 'Ganti Berkas Gambar...' : 'Pilih Berkas Gambar...'}</span></div>
            <div class="p-2 rounded-full bg-surface-page text-on-surface-variant group-hover:text-primary shadow-sm">${ikon('cloud_upload', 'text-[20px]')}</div></div>
        </label>${galatKolom('foto')}</div>
      <div class="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-container-low">
        <div class="flex flex-col"><span class="${KELAS.label}">Tampilkan di Tentang Kami</span><span class="font-body-sm text-body-sm text-on-surface-variant">Muncul di bagian Fasilitas &amp; Area Umum</span></div>
        ${sakelar('data-ubah="konten-isian" data-kunci="status" data-nyala="Tampil" data-mati="Disembunyikan" aria-label="Status tampil"', f.status === 'Tampil')}
      </div>
      <div class="flex items-center justify-end gap-3 pt-3"><button type="button" data-aksi="konten-batal" class="${KELAS.tombolKedua}">Batal</button><button type="submit" class="${KELAS.tombolUtama}">${ikon('save', 'text-[18px]')}<span>Simpan</span></button></div>
    </form>
  </div>`;
}

MASUKAN['area-harga'] = el => {
  const f = S.adm.konten.form.data;
  const i = Number(el.dataset.i);
  const baris = (f.harga || []).concat([{}, {}, {}]).slice(0, 3).map(h => Object.assign({ nama: '', harga: '', keterangan: '' }, h));
  baris[i][el.dataset.f] = el.value;
  f.harga = baris.filter(h => h.nama || h.harga || h.keterangan);
  tandaiKotor();
  segarkanPratinjauKonten();
};

UBAH['area-status'] = async el => {
  const a = S.adm.data.area.filter(x => x.id === el.dataset.id)[0];
  if (!a) return;
  const lama = a.status;
  a.status = el.checked ? 'Tampil' : 'Disembunyikan';
  renderKonten();
  try {
    await panggil('adminUbahStatusArea', tokenAdmin(), a.id, a.status);
  } catch (e) {
    a.status = lama;
    renderKonten();
    toastGalat(e, 'Status gagal diubah');
  }
};

AKSI['area-geser'] = el => {
  const baru = geserDalamDaftar(areaUrut().map(a => a.id), el.dataset.id, Number(el.dataset.arah));
  if (baru) simpanUrutan('area', baru);
};

KIRIM.area = async form => {
  const f = S.adm.konten.form.data;
  const galat = {};
  if (!f.nama.trim()) galat.nama = 'Nama area wajib diisi.';
  if (!f.label.trim()) galat.label = 'Label badge wajib diisi.';
  if (!f.ikon) galat.ikon = 'Pilih ikon badge.';
  if (!f.deskripsi.trim()) galat.deskripsi = 'Deskripsi wajib diisi.';
  if (!f.foto) galat.foto = 'Foto area wajib diunggah.';
  if (f.jenis === 'Layanan Berbayar' && !(f.harga || []).length) galat.harga = 'Isi minimal 1 baris harga layanan.';
  if (Object.keys(galat).length) { aturGalatKolom(form, galat); return; }
  aturGalatKolom(form, null);
  const tombol = form.querySelector('[type=submit]');
  tombolSibuk(tombol, true, 'Menyimpan...');
  try {
    const hasil = await panggil('adminSimpanArea', tokenAdmin(), f);
    gantiItem(S.adm.data.area, hasil);
    bersihkanKotor();
    S.adm.konten.form = formBaru('area', hasil);
    renderKonten();
    toast('Area disimpan', hasil.nama);
  } catch (e) {
    tombolSibuk(tombol, false);
    if (e.kode === 'VALIDASI' && e.detail) aturGalatKolom(form, e.detail);
    else toastGalat(e, 'Area gagal disimpan');
  }
};

// ── Tab Visi & Misi Hunian ──
function htmlPratinjauVisi() {
  const f = S.adm.konten.form.data;
  const misi = String(f.MISI || '').split('\n').map(s => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
  return htmlVisiMisi({ visi: f.VISI, misi: misi, visiLabel: f.VISI_LABEL, tahun: f.TAHUN_BERDIRI, misiLabel: f.MISI_LABEL })
    .replace('mt-space-xl pt-space-lg', '').replace('lg:grid-cols-2', 'lg:grid-cols-1 2xl:grid-cols-2');
}

function htmlTabVisi() {
  const f = S.adm.konten.form.data;
  return `<div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
    <div class="xl:col-span-5 bg-surface-page rounded-xl shadow-sm p-6 flex flex-col gap-5" id="editor-panel">
      <div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">${ikon('flag', 'text-[20px]')}</div><h3 class="font-headline-sm text-headline-sm text-on-surface">Visi &amp; Misi Hunian</h3></div>
        <span class="px-2.5 py-1 rounded bg-surface-subtle text-primary font-label-md text-body-sm">Publik</span></div>
      <p class="font-body-sm text-body-sm text-on-surface-variant -mt-2">Data ini sama dengan kartu Visi &amp; Misi di menu Pengaturan.</p>
      <form class="flex flex-col gap-4" data-kirim="visi" novalidate>
        <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="vm-visi">Pernyataan Visi <span class="text-error">*</span></label><textarea id="vm-visi" rows="3" maxlength="300" data-masukan="konten-isian" data-kunci="VISI" class="${KELAS.inputAdm} resize-none">${esc(f.VISI)}</textarea>${galatKolom('VISI')}</div>
        <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between"><label class="${KELAS.label}" for="vm-misi">Butir-butir Misi <span class="text-error">*</span></label><span class="font-body-sm text-body-sm text-outline">Satu baris = satu poin misi</span></div><textarea id="vm-misi" rows="6" data-masukan="konten-isian" data-kunci="MISI" class="${KELAS.inputAdm} leading-relaxed">${esc(f.MISI)}</textarea>${galatKolom('MISI')}</div>
        <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="vm-vlabel">Label Kartu Visi</label><input id="vm-vlabel" maxlength="80" data-masukan="konten-isian" data-kunci="VISI_LABEL" value="${esc(f.VISI_LABEL)}" class="${KELAS.inputAdm}"></div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="vm-tahun">Tahun Berdiri</label><input id="vm-tahun" inputmode="numeric" maxlength="4" data-masukan="konten-isian" data-kunci="TAHUN_BERDIRI" value="${esc(f.TAHUN_BERDIRI)}" class="${KELAS.inputAdm}">${galatKolom('TAHUN_BERDIRI')}</div>
          <div class="flex flex-col gap-1.5 sm:col-span-2"><label class="${KELAS.label}" for="vm-mlabel">Label Komitmen</label><input id="vm-mlabel" maxlength="80" data-masukan="konten-isian" data-kunci="MISI_LABEL" value="${esc(f.MISI_LABEL)}" class="${KELAS.inputAdm}"></div>
        </div>
        <div class="flex items-center justify-end gap-3 pt-3"><button type="button" data-aksi="konten-batal" class="${KELAS.tombolKedua}">Batal</button><button type="submit" class="${KELAS.tombolUtama}">${ikon('save', 'text-[18px]')}<span>Simpan Perubahan</span></button></div>
      </form>
    </div>
    <div class="xl:col-span-7 bg-surface-page rounded-xl shadow-sm p-5 flex flex-col gap-4">
      <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-status-available"></span><h2 class="font-headline-sm text-headline-sm text-on-surface">Pratinjau Beranda</h2></div>
      <div id="pratinjau-konten">${htmlPratinjauVisi()}</div>
    </div>
  </div>`;
}

KIRIM.visi = async form => {
  const f = S.adm.konten.form.data;
  const galat = {};
  if (!String(f.VISI).trim()) galat.VISI = 'Visi wajib diisi.';
  const misi = String(f.MISI).split('\n').filter(s => s.trim());
  if (!misi.length || misi.length > 6) galat.MISI = 'Isi 1–6 poin misi (satu baris satu poin).';
  if (f.TAHUN_BERDIRI && !/^\d{4}$/.test(f.TAHUN_BERDIRI)) galat.TAHUN_BERDIRI = 'Tahun 4 digit.';
  if (Object.keys(galat).length) { aturGalatKolom(form, galat); return; }
  aturGalatKolom(form, null);
  const tombol = form.querySelector('[type=submit]');
  tombolSibuk(tombol, true, 'Menyimpan...');
  try {
    const r = await panggil('adminSimpanPengaturan', tokenAdmin(), f);
    S.adm.data.pengaturan = r.pengaturan;
    bersihkanKotor();
    S.adm.konten.form = formBaru('visi');
    renderKonten();
    toast('Visi & Misi disimpan', 'Beranda publik ikut diperbarui.');
  } catch (e) {
    tombolSibuk(tombol, false);
    if (e.kode === 'VALIDASI' && e.detail) aturGalatKolom(form, e.detail);
    else toastGalat(e, 'Gagal menyimpan');
  }
};

// ════════════════════════════════════════════════════════════
// BAGIAN 20: KELOLA KAMAR (TABEL)
// ════════════════════════════════════════════════════════════

S.adm.kamar = { cari: '', status: 'semua', lantai: 'semua', urut: 'default', hal: 1, pilih: [] };

function hargaKeterangan(k) {
  const t = [];
  if (k.listrik) t.push('listrik');
  if (k.air) t.push('air');
  return 'per bulan' + (t.length ? ' (termasuk ' + t.join(' & ') + ')' : '');
}

function kamarTersaring() {
  const F = S.adm.kamar;
  const q = F.cari.toLowerCase();
  const master = {};
  S.adm.data.fasilitas.forEach(f => { master[f.kode] = f; });
  let daftar = S.adm.data.kamar.filter(k => {
    if (F.status !== 'semua' && k.status !== F.status) return false;
    if (F.lantai !== 'semua' && String(k.lantai) !== F.lantai) return false;
    if (!q) return true;
    const fas = (k.fasilitas || []).map(c => (master[c] ? master[c].ringkas + ' ' + master[c].label : c)).join(' ') + ' ' + (k.kustom || []).join(' ');
    return [k.nama, k.kode, 'lantai ' + k.lantai, k.posisi, k.label, fas].join(' ').toLowerCase().indexOf(q) >= 0;
  });
  if (F.urut === 'harga-naik') daftar.sort((a, b) => a.harga - b.harga);
  else if (F.urut === 'harga-turun') daftar.sort((a, b) => b.harga - a.harga);
  else daftar.sort((a, b) => a.urutan - b.urutan);
  return daftar;
}

RENDER['admin-kamar'] = function (el) {
  const d = S.adm.data;
  if (!d) { el.innerHTML = kerangkaAdmin(); return; }
  const F = S.adm.kamar;
  const st = statistikKamar(d.kamar);
  const target = d.info.targetOkupansi || 75;
  const potensi = Math.max(0, Math.ceil(target / 100 * st.total) - st.terisi);
  const delta = d.okupansiBulanLalu === null || d.okupansiBulanLalu === undefined ? null : Math.round((st.okupansi - d.okupansiBulanLalu) * 10) / 10;
  const lantaiAda = Array.from(new Set(d.kamar.map(k => k.lantai))).sort((a, b) => a - b);
  const master = {};
  d.fasilitas.forEach(f => { master[f.kode] = f; });
  const daftar = kamarTersaring();
  const per = 10;
  const totalHal = Math.max(1, Math.ceil(daftar.length / per));
  F.hal = Math.min(F.hal, totalHal);
  const tampil = daftar.slice((F.hal - 1) * per, F.hal * per);
  F.pilih = F.pilih.filter(id => d.kamar.some(k => k.id === id));
  const terakhir = d.kamar.reduce((m, x) => { const w = keTanggal(x.diperbarui); return w && (!m || w > m) ? w : m; }, null);
  const semuaDipilih = tampil.length && tampil.every(k => F.pilih.indexOf(k.id) >= 0);

  el.innerHTML = `${garisAtasAdmin()}
  <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-md mb-space-lg">
    <div class="flex flex-col">
      <div class="flex items-center gap-space-xs mb-1"><span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary-container/10 text-primary-container">${ikon('bed', 'text-[18px]')}</span><span class="font-label-md text-label-md text-primary tracking-wide uppercase">Inventaris Properti</span></div>
      <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">Kelola Kamar &amp; Inventaris</h1>
      <p class="font-body-md text-body-md text-on-surface-variant mt-0.5 max-w-2xl">Atur ketersediaan unit, rincian harga sewa, fasilitas, dan kelengkapan data kamar Kost AB6 secara transparan dan terstruktur.</p>
    </div>
    <div class="flex items-center gap-space-sm flex-wrap self-start lg:self-auto">
      <button type="button" data-aksi="ekspor-cepat" data-jenis="kamar" class="group inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-page text-on-surface font-label-md text-label-md shadow-sm hover:shadow-md hover:bg-surface-container-low transition-all">${ikon('download', 'text-[19px] text-tertiary group-hover:-translate-y-0.5 transition-transform')}<span>Unduh Rekap Kamar</span></button>
      <button type="button" data-nav="admin-kamar-form" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md shadow-md hover:bg-primary transition-all">${ikon('add_circle', 'text-[19px]')}<span>Tambah Kamar Baru</span></button>
    </div>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-lg">
    <div class="p-space-md rounded-xl bg-surface-page shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
      <div class="absolute -right-4 -bottom-4 w-24 h-24 bg-surface-container-low rounded-full pointer-events-none group-hover:scale-110 transition-transform"></div>
      <div class="flex items-center justify-between mb-3 relative"><span class="font-body-sm text-body-sm text-on-surface-variant font-medium">Total Unit Kost</span><span class="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant">${ikon('apartment', 'text-[20px]')}</span></div>
      <div class="relative"><div class="flex items-baseline gap-2"><span class="font-display-hero text-[36px] leading-[40px] font-bold text-on-surface tracking-tight">${st.total}</span><span class="font-label-md text-label-md text-on-surface-variant">Kamar</span></div>
        <div class="flex items-center gap-1.5 mt-2"><span class="inline-block w-2 h-2 rounded-full bg-tertiary"></span><span class="font-body-sm text-body-sm text-on-surface-variant">Kapasitas penuh ${st.total} unit (${lantaiAda.length} Lantai)</span></div></div>
    </div>
    <div class="p-space-md rounded-xl bg-surface-page shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
      <div class="absolute -right-4 -bottom-4 w-24 h-24 bg-secondary-fixed/30 rounded-full pointer-events-none group-hover:scale-110 transition-transform"></div>
      <div class="flex items-center justify-between mb-3 relative"><span class="font-body-sm text-body-sm text-on-surface-variant font-medium">Kamar Tersedia</span><span class="w-9 h-9 rounded-lg bg-secondary-container/30 flex items-center justify-center text-on-secondary-container">${ikon('check_circle', 'text-[20px]')}</span></div>
      <div class="relative"><div class="flex items-baseline gap-2"><span class="font-display-hero text-[36px] leading-[40px] font-bold text-status-available tracking-tight">${st.tersedia}</span><span class="font-label-md text-label-md text-on-surface-variant">Unit</span></div>
        <div class="flex items-center gap-1.5 mt-2 min-w-0"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-secondary-container text-on-secondary-container whitespace-nowrap">${teksPersen(st.siap)} Siap Huni</span><span class="font-body-sm text-body-sm text-on-surface-variant truncate">Siap disewakan langsung</span></div></div>
    </div>
    <div class="p-space-md rounded-xl bg-surface-page shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
      <div class="absolute -right-4 -bottom-4 w-24 h-24 bg-tertiary-fixed/30 rounded-full pointer-events-none group-hover:scale-110 transition-transform"></div>
      <div class="flex items-center justify-between mb-3 relative"><span class="font-body-sm text-body-sm text-on-surface-variant font-medium">Kamar Terisi</span><span class="w-9 h-9 rounded-lg bg-tertiary-fixed flex items-center justify-center text-primary-container">${ikon('group', 'text-[20px]')}</span></div>
      <div class="relative"><div class="flex items-baseline gap-2"><span class="font-display-hero text-[36px] leading-[40px] font-bold text-primary-container tracking-tight">${st.terisi}</span><span class="font-label-md text-label-md text-on-surface-variant">Unit</span></div>
        <div class="flex items-center gap-1.5 mt-2"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-tertiary-fixed text-on-tertiary-fixed">Aktif</span><span class="font-body-sm text-body-sm text-on-surface-variant truncate">Kontrak berjalan</span></div></div>
    </div>
    <div class="p-space-md rounded-xl bg-surface-page shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
      <div class="flex items-center justify-between mb-3"><span class="font-body-sm text-body-sm text-on-surface-variant font-medium">Estimasi Okupansi</span><span class="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant">${ikon('pie_chart', 'text-[20px]')}</span></div>
      <div class="space-y-2">
        <div class="flex items-baseline justify-between gap-2"><span class="font-display-hero text-[36px] leading-[40px] font-bold text-on-surface tracking-tight">${teksPersen(st.okupansi)}</span><span class="font-body-sm text-body-sm text-on-surface-variant">Target: ${target}%</span></div>
        <div class="w-full h-2 rounded-full bg-surface-container overflow-hidden" role="progressbar" aria-valuenow="${st.okupansi}" aria-valuemin="0" aria-valuemax="100"><div class="h-full bg-primary-container rounded-full" style="width:${Math.min(100, st.okupansi)}%"></div></div>
        <div class="flex justify-between items-center gap-2 text-[11px] font-body-sm text-on-surface-variant pt-0.5"><span>Potensi: ${potensi} unit tersisa target</span>${delta !== null ? `<span class="font-semibold ${delta >= 0 ? 'text-secondary' : 'text-error'} whitespace-nowrap">${delta >= 0 ? '+' : ''}${delta}% bln ini</span>` : ''}</div>
      </div>
    </div>
  </div>

  <div class="p-4 rounded-xl bg-surface-page shadow-sm mb-space-md flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-space-sm">
    <div class="relative flex-1 xl:min-w-[280px]">${ikon('search', 'absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-outline')}
      <input id="kamar-cari" type="search" data-masukan="kamar-cari" value="${esc(F.cari)}" placeholder="Cari nama kamar, lantai, atau fasilitas..." aria-label="Cari kamar" class="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface-subtle text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:bg-surface-page shadow-inner transition-colors"></div>
    <div class="grid grid-cols-2 sm:flex items-center gap-space-sm">
      ${pilihan('data-ubah="kamar-filter" data-kunci="status" aria-label="Filter status"', [['semua', `Semua Status (${st.total})`], ['Tersedia', `Tersedia (${st.tersedia})`], ['Terisi', `Terisi (${st.terisi})`]], F.status)}
      ${pilihan('data-ubah="kamar-filter" data-kunci="lantai" aria-label="Filter lantai"', [['semua', 'Semua Lantai']].concat(lantaiAda.map(l => [String(l), 'Lantai ' + l])), F.lantai)}
      ${pilihan('data-ubah="kamar-filter" data-kunci="urut" aria-label="Urutkan"', [['default', 'Urutan Default'], ['harga-naik', 'Harga Terendah'], ['harga-turun', 'Harga Tertinggi']], F.urut)}
      <button type="button" data-aksi="kamar-reset" title="Reset Filter" aria-label="Reset filter & muat ulang" class="p-2.5 rounded-lg bg-surface-subtle hover:bg-surface-container text-on-surface-variant transition-colors flex items-center justify-center">${ikon('refresh', 'text-[20px]')}</button>
    </div>
  </div>

  ${F.pilih.length ? `<div class="sticky top-[72px] z-30 mb-space-md p-3.5 rounded-xl bg-on-surface text-on-primary shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
    <div class="flex items-center gap-2.5"><span class="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-on-secondary">${ikon('check', 'text-[16px]')}</span><span class="font-label-md text-label-md text-on-primary">${F.pilih.length} kamar dipilih:</span><span class="font-body-sm text-body-sm text-outline-variant hidden md:inline">Terapkan perubahan massal sekaligus pada unit terpilih</span></div>
    <div class="flex items-center gap-2 flex-wrap justify-center">
      <button type="button" data-aksi="kamar-massal" data-nilai="Tersedia" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-on-secondary hover:bg-on-secondary-container font-label-md text-label-md transition-colors">${ikon('done_all', 'text-[16px]')}<span>Tandai Tersedia</span></button>
      <button type="button" data-aksi="kamar-massal" data-nilai="Terisi" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-container text-on-primary hover:bg-primary font-label-md text-label-md transition-colors">${ikon('person_check', 'text-[16px]')}<span>Tandai Terisi</span></button>
      <button type="button" data-aksi="kamar-massal" data-nilai="hapus" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error text-on-error hover:bg-error-container hover:text-on-error-container font-label-md text-label-md transition-colors">${ikon('delete', 'text-[16px]')}<span>Hapus Terpilih</span></button>
      <button type="button" data-aksi="kamar-batal-pilih" title="Batalkan Pilihan" aria-label="Batalkan pilihan" class="p-1.5 rounded hover:bg-white/10 text-outline-variant hover:text-on-primary transition-colors ml-1">${ikon('close', 'text-[18px]')}</button>
    </div>
  </div>` : ''}

  <div class="bg-surface-page rounded-xl shadow-sm overflow-hidden mb-space-lg">
    <div class="overflow-x-auto gulir-tampak">
      <table class="w-full min-w-[1100px] text-left border-collapse">
        <thead><tr class="bg-surface-container-low text-on-surface-variant font-label-md text-label-md">
          <th class="py-3.5 pl-4 pr-2 w-10 text-center"><input type="checkbox" data-ubah="kamar-pilih-semua" ${semuaDipilih ? 'checked' : ''} aria-label="Pilih semua kamar di halaman ini" class="rounded w-4 h-4 cursor-pointer accent-primary"></th>
          <th class="py-3.5 px-4 min-w-[240px]">Foto &amp; Nama Kamar</th><th class="py-3.5 px-3 w-28">Lantai</th><th class="py-3.5 px-4 min-w-[170px]">Harga Sewa / Bln</th>
          <th class="py-3.5 px-4 min-w-[230px]">Spesifikasi</th><th class="py-3.5 px-4 min-w-[240px]">Fasilitas Utama</th><th class="py-3.5 px-4 min-w-[150px]">Status Ketersediaan</th><th class="py-3.5 pl-3 pr-5 text-right w-28">Aksi Cepat</th>
        </tr></thead>
        <tbody class="font-table-data text-table-data divide-y divide-border-subtle">${tampil.map((k, i) => {
          const kasur = KONST.KASUR[k.kasur] || {};
          const fas = (k.fasilitas || []).map(c => master[c] && master[c].ringkas).filter(Boolean).concat(k.kustom || []);
          const dipilih = F.pilih.indexOf(k.id) >= 0;
          return `<tr class="${i % 2 ? 'bg-surface-subtle/60 ' : ''}hover:bg-surface-subtle transition-colors group">
            <td class="py-3 pl-4 pr-2 text-center"><input type="checkbox" data-ubah="kamar-pilih" data-id="${esc(k.id)}" ${dipilih ? 'checked' : ''} aria-label="Pilih ${esc(k.nama)}" class="rounded w-4 h-4 cursor-pointer accent-primary"></td>
            <td class="py-3 px-4"><div class="flex items-center gap-3">
              <div class="relative w-14 h-12 rounded-lg overflow-hidden shrink-0 shadow-sm bg-surface-container">${gambarAdmin((k.foto[0] || {}).id, 200, 'w-full h-full object-cover group-hover:scale-105 transition-transform', k.nama)}<span class="absolute bottom-0.5 right-0.5 px-1 bg-black/60 text-white text-[9px] rounded font-label-numeric">${esc(k.kode)}</span></div>
              <div class="flex flex-col min-w-0"><div class="flex items-center gap-1.5"><span class="font-headline-sm text-[15px] leading-5 text-on-surface font-semibold truncate">${esc(k.nama)}</span>${k.label ? `<span class="inline-flex items-center px-1.5 text-[10px] font-bold rounded ${/balkon/i.test(k.label) ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-tertiary-fixed text-on-tertiary-fixed'} whitespace-nowrap">${esc(k.label)}</span>` : ''}</div>
                <span class="font-body-sm text-[11px] text-on-surface-variant truncate">${esc(k.posisi || 'Lantai ' + k.lantai)}</span></div></div></td>
            <td class="py-3 px-3"><button type="button" data-aksi="kamar-lantai" data-id="${esc(k.id)}" aria-label="Ubah lantai ${esc(k.nama)}" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-container hover:bg-surface-container-high font-label-md text-label-md text-on-surface whitespace-nowrap">${ikon('edit_square', 'text-[14px] text-tertiary')}Lantai ${esc(k.lantai)}</button></td>
            <td class="py-3 px-4"><div class="flex flex-col"><span class="font-label-numeric text-[16px] leading-5 text-primary-container">${rupiah(k.harga)}</span><span class="font-body-sm text-[11px] text-on-surface-variant">${hargaKeterangan(k)}</span></div></td>
            <td class="py-3 px-4"><div class="flex flex-col gap-0.5 text-on-surface"><span class="font-medium text-[12px]">${desimal(k.panjang)} x ${desimal(k.lebar)} meter (${String(Math.round(k.panjang * k.lebar * 10) / 10).replace('.', ',')} m²)</span><span class="text-on-surface-variant text-[12px]">${esc(kasur.tabel || '-')}${k.sirkulasi === 'balkon' ? ' · Balkon' : ''}</span></div></td>
            <td class="py-3 px-4"><div class="flex flex-wrap gap-1">${fas.slice(0, 5).map(f => `<span class="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-[11px] font-medium">${esc(f)}</span>`).join('')}${fas.length > 5 ? `<span class="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[11px]">+${fas.length - 5}</span>` : ''}</div></td>
            <td class="py-3 px-4"><button type="button" data-aksi="kamar-status" data-id="${esc(k.id)}" title="Klik untuk ubah status" class="group/btn inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${k.status === 'Tersedia' ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary-fixed text-primary'} font-label-md text-[12px] shadow-sm hover:shadow transition-all"><span class="w-2 h-2 rounded-full ${k.status === 'Tersedia' ? 'bg-status-available' : 'bg-primary-container'}"></span><span>${esc(k.status)}</span>${ikon('sync', 'text-[14px] opacity-60 group-hover/btn:opacity-100 transition-opacity')}</button></td>
            <td class="py-3 pl-3 pr-5 text-right"><div class="inline-flex items-center justify-end gap-1">
              <button type="button" data-nav="detail" data-kode="${esc(k.kode)}" class="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors" title="Lihat Detail" aria-label="Lihat halaman publik ${esc(k.nama)}">${ikon('visibility', 'text-[18px]')}</button>
              <button type="button" data-nav="admin-kamar-form" data-id="${esc(k.id)}" class="p-1.5 rounded-lg text-outline hover:text-primary-container hover:bg-surface-container transition-colors" title="Edit Kamar" aria-label="Edit ${esc(k.nama)}">${ikon('edit', 'text-[18px]')}</button>
              <button type="button" data-aksi="kamar-hapus" data-id="${esc(k.id)}" class="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container transition-colors" title="Hapus Unit" aria-label="Hapus ${esc(k.nama)}">${ikon('delete', 'text-[18px]')}</button>
            </div></td>
          </tr>`;
        }).join('') || `<tr><td colspan="8" class="py-10 text-center text-on-surface-variant">${d.kamar.length ? 'Tidak ada kamar yang cocok dengan filter.' : 'Belum ada kamar. Klik "Tambah Kamar Baru".'}</td></tr>`}</tbody>
      </table>
    </div>
    <div class="px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 font-body-sm text-body-sm text-on-surface-variant border-t border-border-subtle">
      <span>Menampilkan <strong class="text-on-surface">${tampil.length}</strong> dari <strong class="text-on-surface">${d.kamar.length}</strong> unit kamar Kost AB6 <span class="text-outline-variant">•</span> <span class="text-[12px]">Terakhir diperbarui: ${terakhir ? fHariIni(terakhir) : '-'}</span></span>
      ${paginasiAdmin(F.hal, totalHal, 'kamar-hal')}
    </div>
  </div>

  <div class="p-space-md rounded-xl bg-surface-container-low shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
    <div class="flex items-center gap-3"><div class="w-11 h-11 rounded-full bg-secondary-fixed/60 flex items-center justify-center text-secondary shrink-0">${ikon('contact_support', 'text-[24px]')}</div>
      <div><h3 class="font-headline-sm text-headline-sm text-on-surface">Sinkronisasi Katalog Publik</h3><p class="font-body-sm text-body-sm text-on-surface-variant">Status kamar langsung terhubung dengan tombol pemesanan WhatsApp di halaman katalog tamu.</p></div></div>
    <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-page text-on-surface font-label-md text-label-md shadow-sm"><span class="w-2 h-2 rounded-full bg-status-available"></span>Sistem Live Aktif</span>
  </div>`;
};

function renderKamarList() { RENDER['admin-kamar']($('#hal-admin-kamar')); }

MASUKAN['kamar-cari'] = debounce(el => {
  S.adm.kamar.cari = el.value;
  S.adm.kamar.hal = 1;
  const pos = el.selectionStart;
  renderKamarList();
  const baru = $('#kamar-cari');
  if (baru) { baru.focus(); try { baru.setSelectionRange(pos, pos); } catch (e) { /* abaikan */ } }
}, 250);
UBAH['kamar-filter'] = el => { S.adm.kamar[el.dataset.kunci] = el.value; S.adm.kamar.hal = 1; renderKamarList(); };
AKSI['kamar-reset'] = () => {
  Object.assign(S.adm.kamar, { cari: '', status: 'semua', lantai: 'semua', urut: 'default', hal: 1, pilih: [] });
  renderKamarList();
  muatAdmin();
};
AKSI['kamar-hal'] = el => { S.adm.kamar.hal = Number(el.dataset.hal) || 1; renderKamarList(); };
UBAH['kamar-pilih'] = el => {
  const F = S.adm.kamar;
  F.pilih = F.pilih.filter(id => id !== el.dataset.id);
  if (el.checked) F.pilih.push(el.dataset.id);
  renderKamarList();
};
UBAH['kamar-pilih-semua'] = el => {
  const F = S.adm.kamar;
  const halIni = kamarTersaring().slice((F.hal - 1) * 10, F.hal * 10).map(k => k.id);
  F.pilih = F.pilih.filter(id => halIni.indexOf(id) < 0);
  if (el.checked) F.pilih = F.pilih.concat(halIni);
  renderKamarList();
};
AKSI['kamar-batal-pilih'] = () => { S.adm.kamar.pilih = []; renderKamarList(); };

/** Ubah status (optimistic): tampilan langsung berubah, dikembalikan bila server gagal */
async function ubahStatusKamar(ids, status) {
  const kamar = S.adm.data.kamar.filter(k => ids.indexOf(k.id) >= 0);
  const lama = kamar.map(k => k.status);
  kamar.forEach(k => { k.status = status; });
  renderAdminAktif();
  try {
    await panggil('adminUbahStatusKamar', tokenAdmin(), ids, status);
    S.json.kamar = '';
    toast('Status diperbarui', ids.length + ' kamar → ' + status);
  } catch (e) {
    kamar.forEach((k, i) => { k.status = lama[i]; });
    renderAdminAktif();
    toastGalat(e, 'Status gagal diubah');
  }
}

AKSI['kamar-status'] = el => {
  const k = S.adm.data.kamar.filter(x => x.id === el.dataset.id)[0];
  if (k) ubahStatusKamar([k.id], k.status === 'Tersedia' ? 'Terisi' : 'Tersedia');
};

async function hapusKamar(ids) {
  const nama = S.adm.data.kamar.filter(k => ids.indexOf(k.id) >= 0).map(k => k.nama);
  const ok = await konfirmasi({ judul: `Hapus ${ids.length} kamar?`, pesan: `${nama.slice(0, 3).join(', ')}${nama.length > 3 ? ', …' : ''} beserta fotonya akan dihapus permanen dari katalog.`, ok: 'Hapus', bahaya: true });
  if (!ok) return;
  try {
    const r = await panggil('adminHapusKamar', tokenAdmin(), ids);
    S.adm.data.kamar = S.adm.data.kamar.filter(k => r.ids.indexOf(k.id) < 0);
    S.adm.kamar.pilih = [];
    S.json.kamar = '';
    renderAdminAktif();
    toast('Kamar dihapus', r.ids.length + ' unit dihapus.');
  } catch (e) {
    toastGalat(e, 'Kamar gagal dihapus');
  }
}

AKSI['kamar-hapus'] = el => hapusKamar([el.dataset.id]);
AKSI['kamar-massal'] = el => {
  const ids = S.adm.kamar.pilih.slice();
  if (!ids.length) return;
  if (el.dataset.nilai === 'hapus') hapusKamar(ids);
  else ubahStatusKamar(ids, el.dataset.nilai).then(() => { S.adm.kamar.pilih = []; renderKamarList(); });
};

AKSI['kamar-lantai'] = el => {
  const k = S.adm.data.kamar.filter(x => x.id === el.dataset.id)[0];
  if (!k) return;
  const item = Modal.buka({
    lebar: 'max-w-sm', label: 'Ubah lantai',
    isi: `<h3 class="font-headline-sm text-headline-sm text-on-surface mb-1">Ubah Lantai</h3><p class="font-body-sm text-body-sm text-on-surface-variant mb-4">${esc(k.nama)}</p>
      <div class="flex flex-col gap-2">${Object.keys(KONST.LANTAI).map(l => `<button type="button" data-lt="${l}" class="flex items-center justify-between gap-2 p-3 rounded-lg ${String(k.lantai) === l ? 'bg-primary-fixed text-primary' : 'bg-surface-container-low hover:bg-surface-container text-on-surface'} font-label-md text-label-md text-left">${esc(KONST.LANTAI[l])}${String(k.lantai) === l ? ikon('check', 'text-[18px]') : ''}</button>`).join('')}</div>
      <div class="flex justify-end pt-4"><button type="button" data-lt="batal" class="${KELAS.tombolKedua}">Batal</button></div>`
  });
  $$('[data-lt]', item.panel).forEach(b => b.addEventListener('click', async () => {
    Modal.tutup(item);
    const lt = b.dataset.lt;
    if (lt === 'batal' || String(k.lantai) === lt) return;
    const lama = k.lantai;
    k.lantai = Number(lt);
    renderKamarList();
    try {
      await panggil('adminUbahLantaiKamar', tokenAdmin(), k.id, k.lantai);
      S.json.kamar = '';
      toast('Lantai diperbarui', k.nama + ' → Lantai ' + lt);
    } catch (e) {
      k.lantai = lama;
      renderKamarList();
      toastGalat(e, 'Lantai gagal diubah');
    }
  }));
};

// ════════════════════════════════════════════════════════════
// BAGIAN 21: TAMBAH / EDIT KAMAR (5 bagian + draf otomatis)
// ════════════════════════════════════════════════════════════

S.adm.fk = null;

function kamarKosong() {
  return {
    id: '', kode: '', nama: '', label: '', lantai: 1, posisi: '', harga: '', listrik: false, air: true, sampah: true,
    status: 'Tersedia', panjang: '', lebar: '', kasur: 'single-120', sirkulasi: 'taman', kamarMandi: 'Dalam', daya: '',
    fasilitas: ['ac', 'wifi', 'kasur', 'meja', 'kursi', 'lemari', 'rak', 'km_dalam', 'cleaning'], kustom: [], deskripsi: '', foto: [], video: ''
  };
}

function kunciDrafKamar(id) { return 'kab6_draf_kamar_' + (id || 'baru'); }

RENDER['admin-kamar-form'] = function (el, param) {
  const d = S.adm.data;
  if (!d) { el.innerHTML = kerangkaAdmin(); return; }
  const id = (param && param.id) || '';
  if (!S.adm.fk || S.adm.fk.id !== id) {
    const asli = id ? d.kamar.filter(k => k.id === id)[0] : null;
    if (id && !asli) { el.innerHTML = `<div class="p-8 text-center text-on-surface-variant">Kamar tidak ditemukan. <a href="#" data-nav="admin-kamar" class="text-primary">Kembali</a></div>`; return; }
    const dasar = asli ? JSON.parse(JSON.stringify(asli)) : kamarKosong();
    S.adm.fk = { id: id, data: dasar, disimpanPada: null, asliJson: JSON.stringify(dasar), pratinjauVideo: '' };
    const draf = Simpan.get(kunciDrafKamar(id));
    if (draf && draf.data && JSON.stringify(draf.data) !== S.adm.fk.asliJson) {
      setTimeout(async () => {
        const lanjut = await konfirmasi({ judul: 'Lanjutkan draf?', pesan: `Ada draf tersimpan ${fRelatif(draf.t)}. Lanjutkan mengisi dari draf tersebut?`, ok: 'Lanjutkan Draf', batal: 'Mulai Baru', ikon: 'edit_note' });
        if (lanjut) {
          S.adm.fk.data = draf.data;
          S.adm.fk.disimpanPada = draf.t;
        } else {
          Simpan.hapus(kunciDrafKamar(id));
        }
        if (S.rute.nama === 'admin-kamar-form') RENDER['admin-kamar-form']($('#hal-admin-kamar-form'), S.rute.param);
      }, 50);
    }
  }
  el.innerHTML = htmlFormKamar();
  pasangSeret($('#fk-foto'), 'x', ids => {
    const f = S.adm.fk.data;
    f.foto = ids.map(x => f.foto.filter(y => y.id === x)[0]).filter(Boolean);
    simpanDrafKamar(true);
  });
};

/** Kartu pratinjau video tur (desain revisi): sampul + tombol putar → iframe saat diklik */
function htmlPratinjauVideoKamar(f) {
  const embed = urlEmbedVideo(f.video);
  if (!embed) return '';
  const yt = /youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]+)/.exec(embed);
  return `<div class="relative rounded-2xl overflow-hidden border border-border-subtle aspect-[16/7] bg-inverse-surface shadow-sm max-w-xl">
    ${yt ? `<img src="https:\/\/i.ytimg.com/vi/${esc(yt[1])}/hqdefault.jpg" alt="" class="absolute inset-0 w-full h-full object-cover opacity-65" referrerpolicy="no-referrer">` : ''}
    <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
      <button type="button" data-aksi="fk-video-putar" aria-label="Putar video tur" class="w-14 h-14 rounded-full bg-primary-container hover:bg-primary text-on-primary flex items-center justify-center shadow-xl hover:scale-105 transition">${ikon('play_arrow', 'text-[32px]')}</button>
      <p class="mt-3 text-on-primary font-label-md text-[12px] sm:text-[14px] font-bold drop-shadow">Pratinjau Video Tur: ${esc(f.nama || 'Kamar')}</p>
      <p class="mt-0.5 text-surface-container-high font-body-sm text-[11px] drop-shadow">Tersinkronisasi otomatis ke etalase katalog penyewa</p>
    </div>
  </div>`;
}

function htmlFormKamar() {
  const fk = S.adm.fk;
  const f = fk.data;
  const master = S.adm.data.fasilitas.filter(x => x.aktif);
  const luas = (Number(String(f.panjang).replace(',', '.')) || 0) * (Number(String(f.lebar).replace(',', '.')) || 0);
  const label = 'block font-label-md text-[12px] font-bold text-on-surface mb-1.5';
  const kelasPilih = KELAS.inputKamar + ' appearance-none cursor-pointer pr-10';
  const tombolBiru = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-fixed/40 hover:bg-primary-fixed text-primary-container font-label-md text-[12px] font-bold whitespace-nowrap transition-colors';
  const kartuBagian = (no, ikonNama, judul, sub, isi, ekstra) => `<section class="bg-surface-page border border-border-subtle rounded-xl p-space-md md:p-6 shadow-sm flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-surface-container-low pb-4">
      <div class="flex items-center gap-3 min-w-0"><div class="p-2 rounded-lg bg-primary-fixed/40 text-primary-container shrink-0">${ikon(ikonNama, 'text-[20px]')}</div><div class="min-w-0"><h2 class="font-headline-sm text-[16px] font-bold text-on-surface">${judul}</h2><p class="font-body-sm text-body-sm text-on-surface-variant">${sub}</p></div></div>
      <div class="flex items-center gap-3">${ekstra || ''}<span class="px-2.5 py-1 rounded bg-surface-container font-label-md text-[12px] font-semibold uppercase tracking-wider text-outline whitespace-nowrap">Bagian ${no}/5</span></div>
    </div>${isi}</section>`;
  // Pilihan bertanda (sr-only checkbox): garis biru saat dicentang
  const kelasPilihKartu = 'border border-border-subtle has-[:checked]:border-primary-container has-[:checked]:bg-primary-fixed/30 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary transition-colors';
  const chipBiaya = (kunci, ikonNama, teks) => `<label class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${kelasPilihKartu} text-on-surface-variant has-[:checked]:text-primary-container font-label-md text-[12px] font-semibold cursor-pointer select-none hover:bg-surface-subtle"><input type="checkbox" class="sr-only" data-ubah="fk" data-kunci="${kunci}" ${f[kunci] ? 'checked' : ''}>${ikon(ikonNama, 'text-[16px]')}<span>${teks}</span></label>`;
  const judulHal = fk.id ? 'Edit Unit Kamar' : 'Tambah Unit Kamar Baru';

  return `<div class="max-w-6xl mx-auto w-full flex flex-col gap-6">
  <div class="flex flex-col gap-3">
    <a href="#" data-nav="admin-kamar" class="inline-flex items-center gap-1.5 self-start font-label-md text-[12px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors group">${ikon('arrow_back', 'text-[16px] transition-transform group-hover:-translate-x-0.5')}<span>Kembali ke Kelola Kamar</span></a>
    <div>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="font-headline-lg text-[24px] leading-8 font-bold text-on-surface tracking-tight">${judulHal}</h1>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed/30 text-secondary border border-secondary-fixed-dim font-body-sm text-[12px] font-medium"><span class="w-1.5 h-1.5 rounded-full bg-status-available"></span>Tersimpan otomatis sebagai Draf</span>
      </div>
      <p class="font-body-sm text-[12px] sm:text-body-md text-on-surface-variant mt-1">Isi spesifikasi lengkap, tarif sewa, fasilitas, foto galeri, dan video tur kamar untuk etalase publik.</p>
    </div>
  </div>

  <form class="flex flex-col gap-6 pb-28" data-kirim="kamar" novalidate id="form-kamar">
    ${kartuBagian(1, 'domain', 'Informasi Dasar Unit', 'Identitas utama, penetapan tarif, dan status okupansi', `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div><label class="${label}" for="fk-nama">Nama / Tipe Kamar <span class="text-error">*</span></label><input id="fk-nama" maxlength="40" data-masukan="fk" data-kunci="nama" value="${esc(f.nama)}" placeholder="Contoh: Kamar Deluxe A2" class="${KELAS.inputKamar}">${galatKolom('nama')}</div>
        <div><label class="${label}" for="fk-kode">Nomor Pintu / Kode Unit <span class="text-error">*</span></label><input id="fk-kode" maxlength="10" data-masukan="fk" data-kunci="kode" value="${esc(f.kode)}" placeholder="Misal: A-02" class="${KELAS.inputKamar} uppercase">${galatKolom('kode')}</div>
        <div><label class="${label}" for="fk-lantai">Lokasi Lantai <span class="text-error">*</span></label>${pilihan('id="fk-lantai" data-ubah="fk" data-kunci="lantai"', Object.keys(KONST.LANTAI).map(l => [l, KONST.LANTAI[l]]), f.lantai, kelasPilih)}${galatKolom('lantai')}</div>
        <div><label class="${label}" for="fk-harga">Tarif Sewa per Bulan <span class="text-error">*</span></label>
          <div class="relative flex items-center"><span class="absolute left-3.5 font-label-md text-[14px] font-semibold text-primary-container">Rp</span><input id="fk-harga" inputmode="numeric" data-masukan="fk-harga" value="${f.harga ? angka(f.harga) : ''}" placeholder="1.850.000" class="${KELAS.inputKamar} pl-11 pr-16 font-semibold"><span class="absolute right-3.5 font-body-sm text-body-sm text-outline">/ bulan</span></div>${galatKolom('harga')}</div>
        <div><span class="${label}">Biaya Tambahan Termasuk (Gratis)</span><div class="flex flex-wrap gap-3 pt-1">${chipBiaya('listrik', 'bolt', 'Termasuk Listrik')}</div></div>
      </div>`)}

    ${kartuBagian(2, 'square_foot', 'Spesifikasi Kamar', 'Ukuran fisik, konfigurasi furnitur esensial, &amp; ventilasi udara', `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div><span class="${label}">Dimensi / Luas Kamar <span class="text-error">*</span></span>
          <div class="flex items-center h-11 px-3 gap-1.5 rounded-lg border border-border-subtle bg-surface-subtle/60 focus-within:bg-surface-page focus-within:border-primary-container focus-within:ring-1 focus-within:ring-primary-container transition-all">
            <input inputmode="decimal" data-masukan="fk" data-kunci="panjang" value="${esc(String(f.panjang).replace('.', ','))}" placeholder="4,0" aria-label="Panjang (meter)" class="w-10 bg-transparent font-body-md text-body-md text-on-surface text-center focus:outline-none">
            <span class="text-outline">×</span>
            <input inputmode="decimal" data-masukan="fk" data-kunci="lebar" value="${esc(String(f.lebar).replace('.', ','))}" placeholder="3,5" aria-label="Lebar (meter)" class="w-10 bg-transparent font-body-md text-body-md text-on-surface text-center focus:outline-none">
            <span class="font-body-md text-body-md text-on-surface-variant whitespace-nowrap">meter (<span id="fk-luas">${luas ? String(Math.round(luas * 10) / 10).replace('.', ',') : '0'}</span> m²)</span>
          </div>${galatKolom('dimensi')}</div>
        <div><label class="${label}" for="fk-kasur">Tipe Tempat Tidur</label>${pilihan('id="fk-kasur" data-ubah="fk" data-kunci="kasur"', Object.keys(KONST.KASUR).map(k => [k, KONST.KASUR[k].label]), f.kasur, kelasPilih)}</div>
        <div><label class="${label}" for="fk-sirk">Sirkulasi Udara</label>${pilihan('id="fk-sirk" data-ubah="fk" data-kunci="sirkulasi"', Object.keys(KONST.SIRKULASI).map(k => [k, KONST.SIRKULASI[k].label]), f.sirkulasi, kelasPilih)}</div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div><span class="${label}">Tipe Kamar Mandi</span>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="flex items-start gap-2.5 p-3 rounded-lg ${kelasPilihKartu} cursor-pointer hover:bg-surface-subtle">
              <input type="checkbox" data-ubah="fk-km" ${f.kamarMandi === 'Dalam' ? 'checked' : ''} class="mt-0.5 w-4 h-4 shrink-0 cursor-pointer accent-[#1565c0]">
              <span class="flex flex-col"><span class="font-label-md text-[12px] font-bold text-on-surface">Kamar Mandi Dalam</span><span class="font-body-sm text-[11px] text-on-surface-variant">${f.kamarMandi === 'Dalam' ? 'Shower &amp; Water Heater' : 'Tidak dicentang = kamar mandi luar'}</span></span>
            </label>
          </div></div>
        <div><label class="${label}" for="fk-daya">Kapasitas Daya Listrik Kamar</label>
          <div class="grid grid-cols-2 gap-3"><input id="fk-daya" maxlength="20" data-masukan="fk" data-kunci="daya" value="${esc(f.daya)}" placeholder="Misal: 1300 VA" class="${KELAS.inputKamar} text-center font-label-md text-[12px] font-bold"></div>${galatKolom('daya')}</div>
      </div>`)}

    ${kartuBagian(3, 'tune', 'Fasilitas Kamar (Pilih yang Tersedia)', 'Pilihan fasilitas terstandarisasi untuk menarik calon penghuni Kost AB6', `
      <div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">${master.map(m => {
          const km = m.kode === 'km_dalam';
          const cek = km ? f.kamarMandi === 'Dalam' : f.fasilitas.indexOf(m.kode) >= 0;
          return `<label class="group flex items-center gap-3 p-3.5 rounded-xl ${kelasPilihKartu} select-none ${km ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-subtle'}" ${km ? 'title="Mengikuti pilihan Tipe Kamar Mandi"' : ''}>
            <input type="checkbox" class="sr-only" data-ubah="fk-fasilitas" data-kode="${esc(m.kode)}" ${cek ? 'checked' : ''} ${km ? 'disabled' : ''}>
            ${ikon(m.ikon, 'text-[20px] text-outline group-has-[:checked]:text-primary-container')}<span class="font-body-sm text-[12px] font-medium text-on-surface">${esc(m.label)}</span></label>`;
        }).join('')}</div>
        ${galatKolom('fasilitas')}
      </div>
      <div>
        <div class="flex flex-col sm:flex-row gap-3">
          <input id="fk-kustom" maxlength="30" placeholder="Ketik fasilitas kustom lainnya (cth: Balkon Jemuran Pribadi)" class="${KELAS.inputKamar} flex-1" aria-label="Fasilitas kustom">
          <button type="button" data-aksi="fk-kustom-tambah" class="${tombolBiru} h-11 px-4">${ikon('add', 'text-[16px]')}Tambah Fasilitas Kustom</button>
        </div>
        ${f.kustom.length ? `<div class="flex flex-wrap gap-2 mt-3">${f.kustom.map((t, i) => `<span class="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-body-sm text-body-sm">${esc(t)}<button type="button" data-aksi="fk-kustom-hapus" data-i="${i}" aria-label="Hapus ${esc(t)}" class="w-6 h-6 rounded-full hover:bg-primary-fixed-dim flex items-center justify-center">${ikon('close', 'text-[14px]')}</button></span>`).join('')}</div>` : ''}
      </div>`)}

    ${kartuBagian(4, 'description', 'Deskripsi &amp; Catatan Kamar', 'Narasi detail untuk halaman publik pencari hunian', `
      <div>
        <textarea id="fk-deskripsi" rows="4" maxlength="600" data-masukan="fk" data-kunci="deskripsi" class="w-full p-3.5 rounded-xl border border-border-subtle bg-surface-subtle/40 font-body-md text-body-md leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-page focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all resize-y" placeholder="Ceritakan keunggulan kamar ini...">${esc(f.deskripsi)}</textarea>
        <div class="flex items-center justify-between gap-2 mt-2 font-body-sm text-body-sm"><span class="text-secondary font-medium">Telah dioptimasi untuk SEO lokal dan etalase WhatsApp</span><span class="text-outline font-medium whitespace-nowrap" id="fk-hitung-desk">${f.deskripsi.length} / 600 karakter</span></div>
        ${galatKolom('deskripsi')}
      </div>`,
      `<button type="button" data-aksi="fk-template" class="${tombolBiru} px-3 py-1.5">${ikon('edit_note', 'text-[16px]')}Gunakan Template Standar</button>`)}

    ${kartuBagian(5, 'photo_library', 'Foto &amp; Video Tur Kamar', 'Galeri multi-sudut beresolusi tinggi dan integrasi video interaktif', `
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2"><span class="font-label-md text-[12px] font-bold text-on-surface">Galeri Foto Kamar (Geser untuk Mengatur Urutan)</span><span class="font-body-sm text-body-sm font-medium text-outline whitespace-nowrap">${f.foto.length} dari 8 foto terunggah</span></div>
        <div id="fk-foto" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          ${f.foto.map((p, i) => `<div data-seret="${esc(p.id)}" class="group relative rounded-xl overflow-hidden border border-border-subtle aspect-[4/3] bg-surface-container shadow-sm flex flex-col justify-end">
            ${gambarAdmin(p.id, 400, 'absolute inset-0 w-full h-full object-cover', p.keterangan || 'Foto kamar ' + (i + 1))}
            ${i === 0 ? '<span class="absolute top-2 left-2 px-2 py-0.5 rounded bg-primary-container text-on-primary text-[10px] font-bold uppercase shadow-sm">Foto Utama</span>' : ''}
            <div class="absolute top-1.5 right-1.5 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
              ${i > 0 ? `<button type="button" data-aksi="fk-foto-geser" data-id="${esc(p.id)}" data-arah="-1" aria-label="Geser ke kiri" class="w-7 h-7 rounded-full bg-surface-page/90 flex items-center justify-center shadow">${ikon('chevron_left', 'text-[16px]')}</button>` : ''}
              <button type="button" data-aksi="fk-foto-hapus" data-id="${esc(p.id)}" aria-label="Hapus foto" class="w-7 h-7 rounded-full bg-surface-page/90 text-error flex items-center justify-center shadow">${ikon('close', 'text-[16px]')}</button>
            </div>
            <div class="relative z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
              <input data-masukan="fk-foto-ket" data-id="${esc(p.id)}" value="${esc(p.keterangan || '')}" maxlength="30" placeholder="Tambah keterangan…" aria-label="Keterangan foto ${i + 1}" class="w-full bg-transparent text-on-primary placeholder:text-on-primary/70 font-body-sm text-[11px] font-medium truncate focus:outline-none">
            </div>
          </div>`).join('')}
          ${f.foto.length < 8 ? `<label class="group relative aspect-[4/3] rounded-xl border-2 border-dashed border-outline-variant hover:border-primary-container bg-surface-subtle/50 hover:bg-primary-fixed/20 flex flex-col items-center justify-center text-center p-3 cursor-pointer transition focus-within:ring-2 focus-within:ring-primary">
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" data-ubah="fk-foto-unggah" class="absolute inset-0 opacity-0 cursor-pointer" aria-label="Unggah foto kamar">
            <span class="p-2 rounded-full bg-surface-container text-on-surface-variant group-hover:bg-primary-fixed group-hover:text-primary-container transition mb-1">${ikon('add_photo_alternate', 'text-[20px]')}</span>
            <span class="font-label-md text-[12px] font-bold text-on-surface group-hover:text-primary-container transition">Unggah Foto Baru</span><span class="font-body-sm text-[10px] text-outline mt-0.5">JPG / PNG / WebP (Maks 2MB)</span>
          </label>` : ''}
        </div>
        ${galatKolom('foto')}
      </div>
      <div class="flex flex-col gap-4">
        <label class="font-label-md text-[12px] font-bold text-on-surface" for="fk-video">Tautan Video Tur Kamar (YouTube / Google Drive)</label>
        <div class="flex flex-col sm:flex-row gap-2">
          <div class="relative flex-1 flex items-center">${ikon('smart_display', 'absolute left-3 text-[18px] text-outline pointer-events-none')}<input id="fk-video" type="url" data-masukan="fk" data-kunci="video" value="${esc(f.video)}" placeholder="https:\/\/www.youtube.com/watch?v=..." class="${KELAS.inputKamar} pl-10"></div>
          <button type="button" data-aksi="fk-video-uji" class="${tombolBiru} h-11 px-4">${ikon('play_circle', 'text-[16px]')}Uji Tautan &amp; Pratinjau</button>
        </div>
        ${galatKolom('video')}
        <div id="fk-video-pratinjau">${htmlPratinjauVideoKamar(f)}</div>
      </div>`)}
  </form>

  <div class="fixed bottom-0 left-0 lg:left-[240px] right-0 z-30 bg-surface-page/95 border-t border-border-subtle shadow-lg px-space-md lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
    <div class="font-body-sm text-[12px] text-on-surface-variant text-center sm:text-left"><span class="font-bold text-on-surface">Semua perubahan tersimpan secara lokal</span><span class="text-outline mx-1">·</span><span id="fk-status-draf">${fk.disimpanPada ? 'Terakhir disimpan ' + fTgl(fk.disimpanPada, 'jam') : 'Draf otomatis aktif'}</span></div>
    <div class="flex items-center gap-3 w-full sm:w-auto">
      <button type="button" data-aksi="fk-batal" class="flex-1 sm:flex-none px-5 py-2.5 rounded-lg font-label-md text-[12px] font-bold text-on-surface hover:bg-surface-container transition-colors">Batal</button>
      <button type="submit" form="form-kamar" class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md text-[12px] font-bold shadow-sm transition-colors disabled:opacity-60">${ikon('save', 'text-[16px]')}<span>Simpan &amp; Publikasikan Kamar</span></button>
    </div>
  </div>
</div>`;
}

const simpanDrafTertunda = debounce(() => simpanDrafKamar(false), 800);

function simpanDrafKamar(renderUlang) {
  const fk = S.adm.fk;
  if (!fk) return;
  fk.disimpanPada = new Date().toISOString();
  Simpan.set(kunciDrafKamar(fk.id), { t: fk.disimpanPada, data: fk.data });
  const st = $('#fk-status-draf');
  if (st) st.textContent = 'Terakhir disimpan hari ini pada ' + fTgl(fk.disimpanPada, 'jam');
  if (renderUlang) RENDER['admin-kamar-form']($('#hal-admin-kamar-form'), { id: fk.id });
}

function nilaiFk(el) {
  if (el.type === 'checkbox') return el.checked;
  const k = el.dataset.kunci;
  if (k === 'lantai') return Number(el.value);
  if (k === 'kode') return el.value.toUpperCase();
  return el.value;
}

function isianFk(el) {
  const fk = S.adm.fk;
  if (!fk) return;
  const k = el.dataset.kunci;
  const v = nilaiFk(el);
  if (fk.data[k] === v) return;
  fk.data[k] = v;
  if (k === 'panjang' || k === 'lebar') {
    const luas = (Number(String(fk.data.panjang).replace(',', '.')) || 0) * (Number(String(fk.data.lebar).replace(',', '.')) || 0);
    const l = $('#fk-luas');
    if (l) l.textContent = String(Math.round(luas * 10) / 10).replace('.', ',');
  }
  if (k === 'deskripsi') { const h = $('#fk-hitung-desk'); if (h) h.textContent = v.length + ' / 600 karakter'; }
  simpanDrafTertunda();
}
MASUKAN.fk = isianFk;
UBAH.fk = isianFk;

MASUKAN['fk-harga'] = el => {
  const angkaSaja = el.value.replace(/\D/g, '').slice(0, 9);
  S.adm.fk.data.harga = angkaSaja ? Number(angkaSaja) : '';
  const posAkhir = el.value.length - el.selectionStart;
  el.value = angkaSaja ? angka(angkaSaja) : '';
  const pos = Math.max(0, el.value.length - posAkhir);
  try { el.setSelectionRange(pos, pos); } catch (e) { /* abaikan */ }
  simpanDrafTertunda();
};

UBAH['fk-fasilitas'] = el => {
  const f = S.adm.fk.data;
  f.fasilitas = f.fasilitas.filter(c => c !== el.dataset.kode);
  if (el.checked) f.fasilitas.push(el.dataset.kode);
  simpanDrafTertunda();
};

/** Satu kartu "Kamar Mandi Dalam": dicentang = Dalam, tidak dicentang = Luar */
UBAH['fk-km'] = el => {
  const f = S.adm.fk.data;
  f.kamarMandi = el.checked ? 'Dalam' : 'Luar';
  f.fasilitas = f.fasilitas.filter(c => c !== 'km_dalam');
  if (el.checked) f.fasilitas.push('km_dalam');
  simpanDrafKamar(true);
};
AKSI['fk-kustom-tambah'] = () => {
  const input = $('#fk-kustom');
  const v = input.value.trim().slice(0, 30);
  const f = S.adm.fk.data;
  if (!v) { input.focus(); return; }
  if (f.kustom.length >= 5) { toast('Batas fasilitas kustom', 'Maksimal 5 fasilitas kustom.', 'info'); return; }
  if (f.kustom.indexOf(v) < 0) f.kustom.push(v);
  simpanDrafKamar(true);
  const baru = $('#fk-kustom');
  if (baru) baru.focus();
};
AKSI['fk-kustom-hapus'] = el => { S.adm.fk.data.kustom.splice(Number(el.dataset.i), 1); simpanDrafKamar(true); };

/** "Gunakan Template Standar" (PRD §10.4) */
AKSI['fk-template'] = async () => {
  const f = S.adm.fk.data;
  if (f.deskripsi.trim() && !(await konfirmasi({ judul: 'Timpa deskripsi?', pesan: 'Deskripsi saat ini akan diganti dengan template standar.', ok: 'Timpa', ikon: 'auto_awesome' }))) return;
  const master = {};
  S.adm.data.fasilitas.forEach(m => { master[m.kode] = m; });
  const kasur = KONST.KASUR[f.kasur] || KONST.KASUR['single-120'];
  const daftar = S.adm.data.fasilitas.filter(m => m.aktif && m.kode !== 'cleaning' && f.fasilitas.indexOf(m.kode) >= 0).map(m => m.template);
  const teksDaftar = daftar.length > 1 ? daftar.slice(0, -1).join(', ') + ', dan ' + daftar[daftar.length - 1] : daftar.join('');
  const cleaning = f.fasilitas.indexOf('cleaning') >= 0;
  const p = String(f.panjang || '').replace('.', ',') || '...';
  const l = String(f.lebar || '').replace('.', ',') || '...';
  f.deskripsi = `Kamar nyaman berukuran ${p} x ${l} m di Lantai ${f.lantai} dengan kasur ${kasur.jenis} ${kasur.ukuran} cm.` +
    (teksDaftar ? ` Dilengkapi ${teksDaftar}${cleaning ? ', serta layanan cleaning service' : ''}.` : (cleaning ? ' Dilengkapi layanan cleaning service.' : ''));
  f.deskripsi = f.deskripsi.slice(0, 600);
  simpanDrafKamar(true);
};

UBAH['fk-foto-unggah'] = async el => {
  const files = Array.from(el.files || []);
  el.value = '';
  const f = S.adm.fk.data;
  const sisa = 8 - f.foto.length;
  if (!files.length) return;
  if (files.length > sisa) toast('Batas foto', `Maksimal 8 foto. ${files.length - sisa} foto tidak diunggah.`, 'info');
  let n = 0;
  for (const file of files.slice(0, sisa)) {
    n++;
    toast('Mengunggah foto ' + n + '/' + Math.min(files.length, sisa), file.name, 'info');
    try {
      const h = await unggahFotoAdmin(file, 'kamar', { maks: 1600, target: 500 * 1024 }, false);
      f.foto.push({ id: h.id, keterangan: '' });
      simpanDrafKamar(true);
    } catch (e) {
      toastGalat(e, 'Foto gagal diunggah');
    }
  }
};

AKSI['fk-foto-geser'] = el => {
  const f = S.adm.fk.data;
  const baru = geserDalamDaftar(f.foto.map(x => x.id), el.dataset.id, Number(el.dataset.arah));
  if (!baru) return;
  f.foto = baru.map(id => f.foto.filter(x => x.id === id)[0]);
  simpanDrafKamar(true);
};
AKSI['fk-foto-hapus'] = el => {
  const f = S.adm.fk.data;
  f.foto = f.foto.filter(x => x.id !== el.dataset.id);
  simpanDrafKamar(true);
};
MASUKAN['fk-foto-ket'] = el => {
  const x = S.adm.fk.data.foto.filter(y => y.id === el.dataset.id)[0];
  if (x) { x.keterangan = el.value; simpanDrafTertunda(); }
};

AKSI['fk-video-uji'] = () => {
  const link = S.adm.fk.data.video.trim();
  const wadah = $('#fk-video-pratinjau');
  if (!link) { wadah.innerHTML = '<p class="font-body-sm text-body-sm text-on-surface-variant">Isi tautan video terlebih dahulu.</p>'; return; }
  wadah.innerHTML = htmlPratinjauVideoKamar(S.adm.fk.data)
    || `<p class="font-body-sm text-body-sm text-error flex items-center gap-1">${ikon('error', 'text-[16px]')}Tautan tidak dikenali. Gunakan link YouTube atau Google Drive.</p>`;
};

/** Tombol putar di kartu pratinjau → ganti sampul dengan pemutar video */
AKSI['fk-video-putar'] = () => {
  const wadah = $('#fk-video-pratinjau');
  const html = iframeVideo(S.adm.fk.data.video, 'Pratinjau video tur');
  if (wadah && html) wadah.innerHTML = `<div class="relative w-full max-w-xl aspect-video rounded-2xl overflow-hidden shadow-sm bg-inverse-surface">${html}</div>`;
};

AKSI['fk-batal'] = async () => {
  const fk = S.adm.fk;
  if (!(await konfirmasi({ judul: 'Batalkan formulir?', pesan: 'Draf akan dihapus dan foto yang baru diunggah (belum tersimpan) ikut dibuang.', ok: 'Buang Draf', bahaya: true }))) return;
  const asli = fk.id ? (S.adm.data.kamar.filter(k => k.id === fk.id)[0] || { foto: [] }) : { foto: [] };
  const simpan = {};
  asli.foto.forEach(p => { simpan[p.id] = true; });
  const buang = fk.data.foto.map(p => p.id).filter(id => !simpan[id]);
  if (buang.length) panggil('adminBuangFoto', tokenAdmin(), buang).catch(() => { /* abaikan */ });
  Simpan.hapus(kunciDrafKamar(fk.id));
  S.adm.fk = null;
  navigasi('admin-kamar');
};

KIRIM.kamar = async form => {
  const fk = S.adm.fk;
  const f = fk.data;
  const angkaDes = v => Number(String(v).replace(',', '.')) || 0;
  const galat = {};
  if (!f.nama.trim()) galat.nama = 'Nama kamar wajib diisi.';
  if (!/^[A-Z0-9-]{1,10}$/.test(String(f.kode).trim().toUpperCase())) galat.kode = 'Kode unit 1–10 karakter (huruf, angka, tanda hubung).';
  else if (S.adm.data.kamar.some(k => k.id !== fk.id && String(k.kode).toUpperCase() === String(f.kode).trim().toUpperCase())) galat.kode = 'Kode unit sudah dipakai kamar lain.';
  if (!(Number(f.harga) >= 100000)) galat.harga = 'Tarif sewa tidak valid (minimal Rp 100.000).';
  if (angkaDes(f.panjang) < 1 || angkaDes(f.lebar) < 1 || angkaDes(f.panjang) > 20 || angkaDes(f.lebar) > 20) galat.dimensi = 'Isi panjang & lebar kamar (1–20 meter).';
  if (!f.fasilitas.filter(c => c !== 'km_dalam').length && f.kamarMandi !== 'Dalam') galat.fasilitas = 'Pilih minimal satu fasilitas.';
  if (f.deskripsi.trim().length < 20) galat.deskripsi = 'Deskripsi minimal 20 karakter.';
  if (!f.foto.length) galat.foto = 'Unggah minimal 1 foto kamar.';
  if (f.video.trim() && !urlEmbedVideo(f.video)) galat.video = 'Tautan tidak dikenali. Gunakan link YouTube atau Google Drive.';
  if (Object.keys(galat).length) { aturGalatKolom(form, galat); return; }
  aturGalatKolom(form, null);
  const tombol = $('[form=form-kamar][type=submit]');
  tombolSibuk(tombol, true, 'Menyimpan...');
  try {
    const kirim = Object.assign({}, f, { panjang: angkaDes(f.panjang), lebar: angkaDes(f.lebar), kode: String(f.kode).trim().toUpperCase() });
    const hasil = await panggil('adminSimpanKamar', tokenAdmin(), kirim);
    gantiItem(S.adm.data.kamar, hasil);
    Simpan.hapus(kunciDrafKamar(fk.id));
    S.adm.fk = null;
    S.json.kamar = '';
    toast('Kamar dipublikasikan', hasil.nama + ' tersimpan di katalog.');
    navigasi('admin-kamar');
  } catch (e) {
    tombolSibuk(tombol, false);
    if (e.kode === 'VALIDASI' && e.detail) aturGalatKolom(form, e.detail);
    else toastGalat(e, 'Kamar gagal disimpan');
  }
};

// ════════════════════════════════════════════════════════════
// BAGIAN 22: KELOLA TESTIMONI + MODAL TAMBAH/EDIT
// ════════════════════════════════════════════════════════════

S.adm.testi = { cari: '', status: 'semua', sumber: 'semua', periode: 'semua', hal: 1, pilih: [], batasBaru: null };

function dalamPeriode(v, periode) {
  if (periode === 'semua') return true;
  const b = bagianJkt(v);
  const k = bagianJkt(new Date());
  if (!b) return false;
  if (periode === 'bulan') return b.y === k.y && b.m === k.m;
  if (periode === 'kuartal') return b.y === k.y && Math.ceil(b.m / 3) === Math.ceil(k.m / 3);
  return b.y === k.y;
}

function testiTersaring() {
  const F = S.adm.testi;
  const q = F.cari.toLowerCase().replace(/[\s-]/g, '');
  return S.adm.data.testimoni.filter(t => {
    if (F.status !== 'semua' && t.status !== F.status) return false;
    if (F.sumber !== 'semua' && t.sumber !== F.sumber) return false;
    if (!dalamPeriode(t.tanggal, F.periode)) return false;
    if (!q) return true;
    return [t.nama, t.isi, t.wa, t.id, t.profesi, t.tag].join(' ').toLowerCase().replace(/[\s-]/g, '').indexOf(q) >= 0;
  });
}

function formatWA(d) {
  const s = String(d || '').replace(/^62/, '');
  return s ? '+62 ' + s.replace(/^(\d{3})(\d{4})(\d+)$/, '$1-$2-$3') : '';
}

RENDER['admin-testimoni'] = function (el) {
  const d = S.adm.data;
  if (!d) { el.innerHTML = kerangkaAdmin(); return; }
  const F = S.adm.testi;
  // Sekali per kunjungan halaman: catat batas "Baru", lalu tandai sudah dilihat
  if (F.rute !== S.rute) {
    F.rute = S.rute;
    F.batasBaru = keTanggal(d.info.terakhirLihat) || new Date(0);
    const sekarang = new Date().toISOString();
    d.info.terakhirLihat = sekarang;
    perbaruiKerangkaAdmin();
    panggil('adminTandaiTestimoniDilihat', tokenAdmin()).catch(() => { /* tidak kritis */ });
  }
  const semua = d.testimoni;
  const tampil = semua.filter(t => t.status === 'Tampil').length;
  const sembunyi = semua.length - tampil;
  const customer = semua.filter(t => t.sumber === 'Customer').length;
  const admin = semua.length - customer;
  const daftar = testiTersaring();
  const per = 10;
  const totalHal = Math.max(1, Math.ceil(daftar.length / per));
  F.hal = Math.min(F.hal, totalHal);
  const mulai = (F.hal - 1) * per;
  const baris = daftar.slice(mulai, mulai + per);
  F.pilih = F.pilih.filter(id => semua.some(t => t.id === id));
  const semuaDipilih = baris.length && baris.every(t => F.pilih.indexOf(t.id) >= 0);
  const k = bagianJkt(new Date());

  el.innerHTML = `${garisAtasAdmin()}
  <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-space-md mb-space-lg">
    <div class="flex flex-col gap-space-xs">
      <div class="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant"><span>Kost AB6</span>${ikon('chevron_right', 'text-[14px]')}<span class="font-label-md text-label-md text-primary-container">Kelola Testimoni</span></div>
      <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">Kelola Testimoni &amp; Ulasan</h1>
      <p class="font-body-md text-body-md text-on-surface-variant max-w-3xl">Moderasi ulasan dari penghuni maupun kurasi manual pengelola. Nomor WhatsApp terlindungi dengan enkripsi administratif internal dan tidak pernah terekspos di situs publik.</p>
    </div>
    <div class="flex flex-wrap items-center gap-space-sm shrink-0">
      <button type="button" data-aksi="ekspor-cepat" data-jenis="testimoni" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-label-md text-label-md transition-all shadow-sm">${ikon('table_view', 'text-[18px] text-secondary')}<span>Unduh Rekap (.xlsx)</span></button>
      <button type="button" data-aksi="testi-tambah" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md shadow-md transition-all">${ikon('add_circle', 'text-[20px]')}<span>+ Tambah Testimoni Baru</span></button>
    </div>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-lg">
    <div class="bg-surface-page rounded-xl p-space-md shadow-sm flex items-center justify-between gap-2"><div class="flex flex-col"><span class="font-body-sm text-body-sm text-on-surface-variant">Total Ulasan Masuk</span><span class="font-headline-lg text-headline-lg text-on-surface mt-0.5">${semua.length}</span><span class="font-body-sm text-[11px] text-on-surface-variant mt-1">Terdaftar di sistem</span></div><div class="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary-container shrink-0">${ikon('rate_review', 'text-[24px]')}</div></div>
    <div class="bg-surface-page rounded-xl p-space-md shadow-sm flex items-center justify-between gap-2"><div class="flex flex-col"><span class="font-body-sm text-body-sm text-on-surface-variant">Status Tampil Publik</span><div class="flex items-baseline gap-2 mt-0.5"><span class="font-headline-lg text-headline-lg text-status-available">${tampil}</span><span class="font-label-md text-[11px] px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">${teksPersen(persen(tampil, semua.length))}</span></div><span class="font-body-sm text-[11px] text-on-surface-variant mt-1">Aktif di etalase web</span></div><div class="w-11 h-11 rounded-xl bg-secondary-container/40 flex items-center justify-center text-secondary shrink-0">${ikon('visibility', 'text-[24px]', true)}</div></div>
    <div class="bg-surface-page rounded-xl p-space-md shadow-sm flex items-center justify-between gap-2"><div class="flex flex-col"><span class="font-body-sm text-body-sm text-on-surface-variant">Status Disembunyikan</span><div class="flex items-baseline gap-2 mt-0.5"><span class="font-headline-lg text-headline-lg text-outline">${sembunyi}</span><span class="font-label-md text-[11px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">Moderasi</span></div><span class="font-body-sm text-[11px] text-on-surface-variant mt-1">Disembunyikan dari publik</span></div><div class="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-outline shrink-0">${ikon('visibility_off', 'text-[24px]')}</div></div>
    <div class="bg-surface-page rounded-xl p-space-md shadow-sm flex items-center justify-between"><div class="flex flex-col w-full"><span class="font-body-sm text-body-sm text-on-surface-variant">Komposisi Kanal</span>
      <div class="flex flex-wrap items-center gap-2 mt-2"><div class="flex items-center gap-1.5 px-2 py-1 rounded bg-primary-fixed text-on-primary-fixed font-label-md text-label-md">${ikon('person', 'text-[14px]')}<span>${customer} Penghuni</span></div><div class="flex items-center gap-1.5 px-2 py-1 rounded bg-tertiary-fixed text-on-tertiary-fixed font-label-md text-label-md">${ikon('shield_person', 'text-[14px]')}<span>${admin} Admin</span></div></div>
      <div class="w-full bg-surface-container h-1.5 rounded-full mt-2.5 overflow-hidden flex"><div class="bg-primary-container h-full" style="width:${persen(customer, semua.length)}%"></div><div class="bg-tertiary h-full" style="width:${persen(admin, semua.length)}%"></div></div></div></div>
  </div>

  <div class="bg-surface-page rounded-xl p-space-md shadow-sm mb-space-md">
    <div class="flex flex-col xl:flex-row gap-space-sm items-stretch xl:items-center justify-between">
      <div class="relative flex-1 xl:min-w-[260px]">${ikon('search', 'absolute left-3.5 top-1/2 -translate-y-1/2 text-outline-variant text-[20px]')}<input id="testi-cari" type="search" data-masukan="testi-cari" value="${esc(F.cari)}" placeholder="Cari nama penghuni, nomor WA, atau kata kunci ulasan..." aria-label="Cari testimoni" class="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline-variant font-body-md text-body-md focus:outline-none focus:bg-surface-page shadow-inner transition-colors"></div>
      <div class="grid grid-cols-2 sm:flex flex-wrap items-center gap-space-xs">
        ${pilihan('data-ubah="testi-filter" data-kunci="status" aria-label="Filter status"', [['semua', 'Semua Status'], ['Tampil', `Tampil (${tampil})`], ['Disembunyikan', `Disembunyikan (${sembunyi})`]], F.status, 'w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none cursor-pointer')}
        ${pilihan('data-ubah="testi-filter" data-kunci="sumber" aria-label="Filter sumber"', [['semua', 'Semua Sumber'], ['Customer', `Customer / Penghuni (${customer})`], ['Admin', `Input Admin (${admin})`]], F.sumber, 'w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none cursor-pointer')}
        ${pilihan('data-ubah="testi-filter" data-kunci="periode" aria-label="Filter periode"', [['semua', 'Semua Periode'], ['bulan', `Bulan Ini (${KONST.BULAN[k.m - 1]} ${k.y})`], ['kuartal', 'Kuartal Ini'], ['tahun', 'Tahun ' + k.y]], F.periode, 'w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none cursor-pointer')}
        <button type="button" data-aksi="testi-segarkan" title="Muat ulang" aria-label="Reset filter & muat ulang" class="w-11 h-11 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors">${ikon('refresh', 'text-[20px]')}</button>
      </div>
    </div>
  </div>

  ${F.pilih.length ? `<div class="sticky top-20 z-30 mb-space-md bg-[#0A2540] text-on-primary rounded-xl px-space-md py-3 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
    <div class="flex items-center gap-space-sm"><div class="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-label-md text-[11px] font-bold">${F.pilih.length}</div><span class="font-label-md text-label-md text-on-primary">${F.pilih.length} ulasan dipilih</span><span class="h-4 w-px bg-outline/40 hidden sm:inline-block"></span><span class="font-body-sm text-[12px] text-outline-variant hidden sm:inline">Aksi serentak pada ulasan tercentang</span></div>
    <div class="flex items-center gap-space-xs flex-wrap justify-center">
      <button type="button" data-aksi="testi-massal" data-nilai="Disembunyikan" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-highest/20 hover:bg-surface-container-highest/30 text-on-primary font-label-md text-body-sm transition-colors">${ikon('visibility_off', 'text-[16px]')}<span>Sembunyikan</span></button>
      <button type="button" data-aksi="testi-massal" data-nilai="Tampil" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary hover:bg-on-secondary-container text-on-primary font-label-md text-body-sm transition-colors">${ikon('visibility', 'text-[16px]', true)}<span>Tampilkan</span></button>
      <button type="button" data-aksi="testi-massal" data-nilai="hapus" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-error/90 hover:bg-error text-on-error font-label-md text-body-sm transition-colors">${ikon('delete', 'text-[16px]')}<span>Hapus</span></button>
      <button type="button" data-aksi="testi-batal-pilih" title="Batalkan Pilihan" aria-label="Batalkan pilihan" class="p-1 rounded text-outline-variant hover:text-on-primary ml-1">${ikon('close', 'text-[18px]')}</button>
    </div>
  </div>` : ''}

  <div class="bg-surface-page rounded-xl shadow-sm overflow-hidden mb-space-md">
    <div class="overflow-x-auto gulir-tampak">
      <table class="w-full min-w-[1080px] text-left font-table-data text-table-data">
        <thead class="bg-surface-subtle text-on-surface-variant font-label-md text-label-md uppercase tracking-wider text-[11px]"><tr>
          <th class="p-4 w-12 text-center"><input type="checkbox" data-ubah="testi-pilih-semua" ${semuaDipilih ? 'checked' : ''} aria-label="Pilih semua di halaman ini" class="w-4 h-4 rounded cursor-pointer accent-primary-container"></th>
          <th class="py-4 px-3 min-w-[220px]">Penghuni &amp; Sumber</th><th class="py-4 px-3 min-w-[190px]">Nomor WhatsApp</th><th class="py-4 px-3 min-w-[340px]">Isi Testimoni &amp; Lampiran</th>
          <th class="py-4 px-3 min-w-[120px]">Tanggal</th><th class="py-4 px-3 min-w-[130px]">Status</th><th class="py-4 px-4 text-right min-w-[120px]">Aksi</th>
        </tr></thead>
        <tbody class="text-on-surface">${baris.map((t, i) => {
          const baru = (keTanggal(t.tanggal) || new Date(0)) > F.batasBaru;
          return `<tr class="${i % 2 ? 'bg-surface-subtle/60 ' : ''}hover:bg-surface-subtle transition-colors group">
            <td class="p-4 text-center"><input type="checkbox" data-ubah="testi-pilih" data-id="${esc(t.id)}" ${F.pilih.indexOf(t.id) >= 0 ? 'checked' : ''} aria-label="Pilih ${esc(t.nama)}" class="w-4 h-4 rounded cursor-pointer accent-primary-container"></td>
            <td class="py-4 px-3"><div class="flex items-center gap-3">${avatarAdmin(t, 'w-10 h-10')}<div class="flex flex-col min-w-0">
              <span class="font-headline-sm text-body-md font-semibold text-on-surface truncate flex items-center gap-1.5">${esc(t.nama)}${baru ? '<span class="w-2 h-2 rounded-full bg-error shrink-0" title="Baru"></span><span class="sr-only">(baru)</span>' : ''}</span>
              <div class="flex items-center gap-1.5 mt-0.5"><span class="font-body-sm text-[11px] text-on-surface-variant">${esc(labelKamarAdmin(t))}</span><span class="px-1.5 rounded text-[10px] font-semibold ${t.sumber === 'Admin' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary-fixed text-on-primary-fixed-variant'}">${esc(t.sumber)}</span></div></div></div></td>
            <td class="py-4 px-3">${t.wa
              ? `<div class="flex flex-col"><span class="text-on-surface font-label-md text-[13px] whitespace-nowrap">${esc(formatWA(t.wa))}</span><span class="flex items-center gap-1 mt-1 text-[11px] font-medium text-secondary">${ikon('lock', 'text-[13px]')}Privat - Hanya Admin</span></div>`
              : (t.sumber === 'Admin' ? `<div class="flex flex-col"><span class="italic text-on-surface-variant text-[13px]">Input Internal Pengelola</span><span class="flex items-center gap-1 mt-1 text-[11px] font-medium text-primary-container">${ikon('verified_user', 'text-[13px]')}Verifikasi Manual</span></div>` : '<span class="text-outline text-[12px]">Tidak diisi</span>')}</td>
            <td class="py-4 px-3"><div class="flex flex-col gap-1.5"><p class="font-body-md text-body-md text-on-surface leading-snug line-clamp-2">"${esc(t.isi)}"</p>
              ${t.fotoBukti ? `<button type="button" data-aksi="testi-bukti" data-id="${esc(t.id)}" class="flex items-center gap-2 text-left"><span class="w-16 h-10 rounded-md overflow-hidden bg-surface-container shrink-0 shadow-sm border border-border-subtle">${gambarAdmin(t.fotoBukti, 200, 'w-full h-full object-cover', 'Foto bukti')}</span><span class="font-body-sm text-[12px] text-on-surface-variant">Foto: ${esc(t.ketBukti || 'Lampiran penghuni')}</span></button>` : ''}
              ${t.tag ? `<span class="inline-flex items-center gap-1 text-[11px] text-secondary">${ikon(t.ikonTag || 'verified', 'text-[14px]')}${esc(t.tag)}</span>` : ''}</div></td>
            <td class="py-4 px-3"><span class="font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">${fTgl(t.tanggal)}</span></td>
            <td class="py-4 px-3">${chipStatusTesti(t.status)}</td>
            <td class="py-4 px-4 text-right"><div class="flex items-center justify-end gap-1">
              <button type="button" data-aksi="testi-toggle" data-id="${esc(t.id)}" class="p-1.5 rounded-lg text-on-surface-variant hover:text-primary-container hover:bg-surface-container transition-colors" title="${t.status === 'Tampil' ? 'Sembunyikan dari Publik' : 'Tampilkan ke Publik'}" aria-label="${t.status === 'Tampil' ? 'Sembunyikan' : 'Tampilkan'} ${esc(t.nama)}">${ikon(t.status === 'Tampil' ? 'visibility' : 'visibility_off', 'text-[18px]')}</button>
              <button type="button" data-aksi="testi-edit" data-id="${esc(t.id)}" class="p-1.5 rounded-lg text-on-surface-variant hover:text-primary-container hover:bg-surface-container transition-colors" title="Edit Ulasan" aria-label="Edit ${esc(t.nama)}">${ikon('edit', 'text-[18px]')}</button>
              <button type="button" data-aksi="testi-hapus" data-id="${esc(t.id)}" class="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container transition-colors" title="Hapus Ulasan" aria-label="Hapus ${esc(t.nama)}">${ikon('delete', 'text-[18px]')}</button>
            </div></td>
          </tr>`;
        }).join('') || `<tr><td colspan="7" class="py-10 text-center text-on-surface-variant">${semua.length ? 'Tidak ada testimoni yang cocok dengan filter.' : 'Belum ada testimoni.'}</td></tr>`}</tbody>
      </table>
    </div>
    <div class="p-space-md bg-surface-page flex flex-col sm:flex-row items-center justify-between gap-space-sm border-t border-border-subtle">
      <span class="font-body-sm text-body-sm text-on-surface-variant">Menampilkan <strong class="text-on-surface font-semibold">${baris.length ? (mulai + 1) + ' – ' + (mulai + baris.length) : 0}</strong> dari <strong class="text-on-surface font-semibold">${daftar.length}</strong> testimoni terdaftar</span>
      ${paginasiAdmin(F.hal, totalHal, 'testi-hal')}
    </div>
  </div>

  <div class="bg-surface-page rounded-xl p-space-md shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
    <div class="flex items-center gap-space-md"><div class="w-11 h-11 rounded-xl bg-secondary-container/40 text-secondary flex items-center justify-center shrink-0">${ikon('verified', 'text-[22px]')}</div>
      <div class="flex flex-col"><span class="font-headline-sm text-body-md font-semibold text-on-surface">Prosedur Perlindungan Privasi Penghuni Kost AB6</span><span class="font-body-sm text-body-sm text-on-surface-variant">Sesuai kebijakan keamanan data, nomor WhatsApp penghuni tidak pernah disajikan di laman beranda publik maupun feed ulasan pengunjung.</span></div></div>
    <span class="px-2.5 py-1 rounded bg-surface-container text-on-surface-variant font-label-md text-[11px] shrink-0">Enkripsi Admin Aktif</span>
  </div>`;
};

function renderTestiAdmin() { RENDER['admin-testimoni']($('#hal-admin-testimoni')); }

MASUKAN['testi-cari'] = debounce(el => {
  S.adm.testi.cari = el.value;
  S.adm.testi.hal = 1;
  const pos = el.selectionStart;
  renderTestiAdmin();
  const baru = $('#testi-cari');
  if (baru) { baru.focus(); try { baru.setSelectionRange(pos, pos); } catch (e) { /* abaikan */ } }
}, 250);
UBAH['testi-filter'] = el => { S.adm.testi[el.dataset.kunci] = el.value; S.adm.testi.hal = 1; renderTestiAdmin(); };
AKSI['testi-hal'] = el => { S.adm.testi.hal = Number(el.dataset.hal) || 1; renderTestiAdmin(); };
AKSI['testi-segarkan'] = () => {
  Object.assign(S.adm.testi, { cari: '', status: 'semua', sumber: 'semua', periode: 'semua', hal: 1, pilih: [] });
  renderTestiAdmin();
  muatAdmin();
};
UBAH['testi-pilih'] = el => {
  const F = S.adm.testi;
  F.pilih = F.pilih.filter(id => id !== el.dataset.id);
  if (el.checked) F.pilih.push(el.dataset.id);
  renderTestiAdmin();
};
UBAH['testi-pilih-semua'] = el => {
  const F = S.adm.testi;
  const halIni = testiTersaring().slice((F.hal - 1) * 10, F.hal * 10).map(t => t.id);
  F.pilih = F.pilih.filter(id => halIni.indexOf(id) < 0);
  if (el.checked) F.pilih = F.pilih.concat(halIni);
  renderTestiAdmin();
};
AKSI['testi-batal-pilih'] = () => { S.adm.testi.pilih = []; renderTestiAdmin(); };
AKSI['testi-bukti'] = el => {
  const t = S.adm.data.testimoni.filter(x => x.id === el.dataset.id)[0];
  if (t && t.fotoBukti) bukaLightbox([{ id: S.adm.pratinjau[t.fotoBukti] || t.fotoBukti, keterangan: t.ketBukti }], 0);
};

async function ubahStatusTesti(ids, status) {
  const target = S.adm.data.testimoni.filter(t => ids.indexOf(t.id) >= 0);
  const lama = target.map(t => t.status);
  target.forEach(t => { t.status = status; });
  renderAdminAktif();
  try {
    await panggil('adminUbahStatusTestimoni', tokenAdmin(), ids, status);
    S.json.testimoni = '';
    S.json.beranda = '';
    toast(status === 'Tampil' ? 'Ditampilkan' : 'Disembunyikan', ids.length + ' testimoni diperbarui.');
  } catch (e) {
    target.forEach((t, i) => { t.status = lama[i]; });
    renderAdminAktif();
    toastGalat(e, 'Status gagal diubah');
  }
}

async function hapusTesti(ids) {
  const ok = await konfirmasi({ judul: `Hapus ${ids.length} testimoni?`, pesan: 'Testimoni dan fotonya akan dihapus permanen dari sistem.', ok: 'Hapus', bahaya: true });
  if (!ok) return;
  try {
    const r = await panggil('adminHapusTestimoni', tokenAdmin(), ids);
    S.adm.data.testimoni = S.adm.data.testimoni.filter(t => r.ids.indexOf(t.id) < 0);
    S.adm.testi.pilih = [];
    S.json.testimoni = '';
    S.json.beranda = '';
    perbaruiKerangkaAdmin();
    renderAdminAktif();
    toast('Testimoni dihapus', r.ids.length + ' ulasan dihapus.');
  } catch (e) {
    toastGalat(e, 'Testimoni gagal dihapus');
  }
}

AKSI['testi-toggle'] = el => {
  const t = S.adm.data.testimoni.filter(x => x.id === el.dataset.id)[0];
  if (t) ubahStatusTesti([t.id], t.status === 'Tampil' ? 'Disembunyikan' : 'Tampil');
};
AKSI['testi-hapus'] = el => hapusTesti([el.dataset.id]);
AKSI['testi-massal'] = el => {
  const ids = S.adm.testi.pilih.slice();
  if (!ids.length) return;
  if (el.dataset.nilai === 'hapus') hapusTesti(ids);
  else ubahStatusTesti(ids, el.dataset.nilai).then(() => { S.adm.testi.pilih = []; renderTestiAdmin(); });
};
AKSI['testi-edit'] = el => {
  const t = S.adm.data.testimoni.filter(x => x.id === el.dataset.id)[0];
  if (t) bukaModalTestimoni(t);
};
AKSI['testi-tambah'] = () => bukaModalTestimoni(null);

/** Modal Tambah / Edit Testimoni (dasar code.html; slot bintang → Kamar Penghuni) */
function bukaModalTestimoni(asli) {
  const kunciForm = !!(asli && asli.sumber === 'Customer');
  const d = asli ? JSON.parse(JSON.stringify(asli)) : {
    id: '', nama: '', tipe: 'Penghuni', wa: '', idKamar: '', isi: '', fotoProfil: '', fotoBukti: '', ketBukti: '', profesi: '', tag: '', ikonTag: 'verified', status: 'Tampil'
  };
  d.waTampil = formatWA(d.wa).replace(/^\+62\s?/, '');
  let tersimpan = false;
  const unggahan = [];
  const opsiKamar = [['', 'Tidak dikaitkan ke kamar']].concat(S.adm.data.kamar.slice().sort((a, b) => a.urutan - b.urutan).map(k => [k.id, `${k.kode} – ${k.nama} (Lt. ${k.lantai})`]));
  const kelasIsian = 'px-3.5 py-2.5 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline-variant font-body-md text-body-md focus:outline-none focus:bg-surface-container transition-colors disabled:opacity-70 disabled:cursor-not-allowed w-full';
  const kotakFoto = (jenis, judul, petunjuk, ikonNama) => `<div class="flex flex-col gap-1.5"><span class="font-label-md text-label-md text-on-surface">${judul}</span>
    <label class="p-3 rounded-lg bg-surface-container-low flex items-center justify-between gap-2 ${jenis === 'profil' && kunciForm ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-container'} relative">
      <div class="flex items-center gap-2 min-w-0"><span data-mt-foto="${jenis}" class="w-10 h-10 rounded-${jenis === 'profil' ? 'full' : 'md'} overflow-hidden bg-surface-page flex items-center justify-center shrink-0">${d[jenis === 'profil' ? 'fotoProfil' : 'fotoBukti'] ? gambarAdmin(d[jenis === 'profil' ? 'fotoProfil' : 'fotoBukti'], 200, 'w-full h-full object-cover', judul) : ikon(ikonNama, 'text-outline-variant text-[20px]')}</span><span class="font-body-sm text-[12px] text-on-surface-variant">${petunjuk}</span></div>
      <span class="px-2.5 py-1 rounded bg-surface-page shadow-sm text-primary-container font-label-md text-[11px] shrink-0">Telusuri</span>
      ${jenis === 'profil' && kunciForm ? '' : `<input type="file" accept="image/jpeg,image/png,image/webp" data-mt-file="${jenis}" class="absolute inset-0 opacity-0 cursor-pointer" aria-label="${judul}">`}
    </label></div>`;
  const item = Modal.buka({
    lebar: 'max-w-2xl', label: asli ? 'Edit testimoni' : 'Tambah testimoni baru', kelasPanel: 'p-space-lg',
    saatTutup: () => {
      if (!tersimpan && unggahan.length) panggil('adminBuangFoto', tokenAdmin(), unggahan).catch(() => { /* abaikan */ });
    },
    isi: `<div class="flex flex-col gap-space-md">
      <div class="flex items-center justify-between pb-space-sm gap-2">
        <div class="flex flex-col"><h2 class="font-headline-md text-headline-md text-on-surface">${asli ? 'Edit Testimoni' : 'Tambah Testimoni Baru'}</h2>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${kunciForm ? 'Ulasan dari formulir publik — nama, isi, nomor WA, dan foto profil tidak dapat diubah demi keaslian.' : 'Masukkan ulasan manual dari wawancara penghuni atau form kurasi admin.'}</p></div>
        <button type="button" data-mt="tutup" aria-label="Tutup" class="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">${ikon('close', 'text-[20px]')}</button>
      </div>
      <form class="flex flex-col gap-space-md" novalidate data-mt="form">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          <div class="flex flex-col gap-1.5"><label class="font-label-md text-label-md text-on-surface" for="mt-nama">Nama Lengkap / Akun <span class="text-error">*</span></label><input id="mt-nama" data-mt-isi="nama" maxlength="60" value="${esc(d.nama)}" ${kunciForm ? 'disabled' : ''} placeholder="Contoh: Farhan Nurhakim" class="${kelasIsian}">${galatKolom('nama')}</div>
          <div class="flex flex-col gap-1.5"><label class="font-label-md text-label-md text-on-surface" for="mt-tipe">Tipe / Sumber Data</label>${pilihan('id="mt-tipe" data-mt-isi="tipe"', [['Penghuni', 'Penghuni / Customer'], ['Official', 'Input Manual Pengelola (Kost AB6 Official)'], ['Alumni', 'Alumni Penghuni']], d.tipe, 'w-full appearance-none px-3.5 py-2.5 pr-9 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none cursor-pointer')}</div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between"><label class="font-label-md text-label-md text-on-surface" for="mt-wa">Nomor WhatsApp (Opsional)</label><span class="text-[11px] text-secondary font-medium">Terkunci privat</span></div>
            <div class="relative"><span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline font-label-md text-body-md">+62</span><input id="mt-wa" type="tel" data-mt-isi="waTampil" value="${esc(d.waTampil)}" ${kunciForm ? 'disabled' : ''} placeholder="812-3456-7890" class="${kelasIsian} pl-12"></div>${galatKolom('wa')}</div>
          <div class="flex flex-col gap-1.5"><label class="font-label-md text-label-md text-on-surface" for="mt-kamar">Kamar Penghuni (Opsional)</label>${pilihan('id="mt-kamar" data-mt-isi="idKamar"', opsiKamar, d.idKamar, 'w-full appearance-none px-3.5 py-2.5 pr-9 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none cursor-pointer')}</div>
        </div>
        <div class="flex flex-col gap-1.5"><label class="font-label-md text-label-md text-on-surface" for="mt-isi">Isi Ulasan Testimoni <span class="text-error">*</span></label><textarea id="mt-isi" data-mt-isi="isi" rows="4" maxlength="500" ${kunciForm ? 'disabled' : ''} placeholder="Tuliskan ulasan pengalaman tinggal di Kost AB6 secara jujur, detail kenyamanan, kamar, atau fasilitas..." class="${kelasIsian} resize-none">${esc(d.isi)}</textarea>${galatKolom('isi')}</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          ${kotakFoto('profil', 'Foto Profil Penghuni', 'Pilih foto persegi (.jpg, .png)', 'account_circle')}
          ${kotakFoto('bukti', 'Foto Bukti / Fasilitas (Opsional)', 'Format 16:9 disarankan', 'add_photo_alternate')}
        </div>
        <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-3">
          <span class="font-label-md text-label-md text-on-surface flex items-center gap-1.5">${ikon('tune', 'text-[18px] text-primary')}Detail Kurasi <span class="text-outline font-normal text-[11px]">(Opsional — tampil di kartu publik)</span></span>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input data-mt-isi="profesi" maxlength="40" value="${esc(d.profesi)}" placeholder="Profesi (cth: Mahasiswa Teknik)" aria-label="Profesi" class="${kelasIsian} bg-surface-page">
            <input data-mt-isi="ketBukti" maxlength="40" value="${esc(d.ketBukti)}" placeholder="Keterangan foto bukti (cth: Dapur Bersama)" aria-label="Keterangan foto bukti" class="${kelasIsian} bg-surface-page">
            <input data-mt-isi="tag" maxlength="40" value="${esc(d.tag)}" placeholder="Tag sorotan (cth: WFH Friendly)" aria-label="Tag sorotan" class="${kelasIsian} bg-surface-page sm:col-span-2">
          </div>
          <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ikon tag">${KONST.IKON.map(n => `<label class="cursor-pointer" title="${n}"><input type="radio" name="mt-ikon" value="${n}" data-mt-isi="ikonTag" ${d.ikonTag === n ? 'checked' : ''} class="sr-only peer" aria-label="${n}"><span class="w-9 h-9 rounded-lg bg-surface-page flex items-center justify-center text-on-surface-variant peer-checked:bg-primary-container peer-checked:text-on-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary">${ikon(n, 'text-[18px]')}</span></label>`).join('')}</div>
        </div>
        <div class="p-space-md rounded-xl bg-surface-container-low flex items-center justify-between gap-3">
          <div class="flex flex-col"><span class="font-label-md text-label-md text-on-surface">Langsung Tampilkan di Website Publik</span><span class="font-body-sm text-[12px] text-on-surface-variant">Jika dimatikan, status ulasan akan disimpan sebagai 'Disembunyikan'.</span></div>
          ${sakelar('data-mt-isi="status" aria-label="Tampilkan di website publik"', d.status === 'Tampil')}
        </div>
        <div class="flex items-center justify-end gap-space-sm pt-space-sm">
          <button type="button" data-mt="tutup" class="px-4 py-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors">Batal</button>
          <button type="submit" data-mt="simpan" class="px-5 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md shadow-md transition-all flex items-center gap-2">${asli ? 'Simpan Perubahan' : 'Simpan &amp; Terbitkan Testimoni'}</button>
        </div>
      </form>
    </div>`
  });
  const p = item.panel;
  const form = p.querySelector('[data-mt=form]');
  $$('[data-mt=tutup]', p).forEach(b => b.addEventListener('click', () => Modal.tutup(item)));
  const ambil = el => {
    const k = el.dataset.mtIsi;
    if (el.type === 'checkbox') d[k] = el.checked ? 'Tampil' : 'Disembunyikan';
    else if (el.type === 'radio') { if (el.checked) d[k] = el.value; }
    else d[k] = el.value;
    if (k === 'tipe' && el.value === 'Official' && !d.nama.trim() && !kunciForm) {
      d.nama = 'Kost AB6 Official';
      p.querySelector('#mt-nama').value = d.nama;
    }
  };
  form.addEventListener('input', e => { if (e.target.dataset.mtIsi) ambil(e.target); });
  form.addEventListener('change', async e => {
    const el = e.target;
    if (el.dataset.mtIsi) { ambil(el); return; }
    const jenis = el.dataset.mtFile;
    if (!jenis || !el.files || !el.files[0]) return;
    const file = el.files[0];
    el.value = '';
    const kotak = p.querySelector(`[data-mt-foto=${jenis}]`);
    kotak.innerHTML = '<span class="putar putar-gelap"></span>';
    try {
      const h = await unggahFotoAdmin(file, jenis === 'profil' ? 'profil' : 'bukti',
        jenis === 'profil' ? { maks: 400, target: 150 * 1024, persegi: true } : { maks: 1280, target: 400 * 1024 }, false);
      unggahan.push(h.id);
      d[jenis === 'profil' ? 'fotoProfil' : 'fotoBukti'] = h.id;
      kotak.innerHTML = gambarAdmin(h.id, 200, 'w-full h-full object-cover', 'Foto');
    } catch (err) {
      kotak.innerHTML = ikon('error', 'text-error text-[20px]');
      toastGalat(err, 'Foto gagal diunggah');
    }
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const galat = {};
    const waAngka = String(d.waTampil || '').replace(/\D/g, '').replace(/^0/, '').replace(/^62/, '');
    if (!kunciForm) {
      if (d.nama.trim().length < 3) galat.nama = 'Nama wajib diisi (3–60 karakter).';
      if (waAngka && !/^8\d{7,12}$/.test(waAngka)) galat.wa = 'Format nomor WhatsApp tidak valid.';
      if (d.isi.trim().length < 20) galat.isi = 'Isi ulasan minimal 20 karakter.';
    }
    if (Object.keys(galat).length) { aturGalatKolom(form, galat); return; }
    aturGalatKolom(form, null);
    const tombol = p.querySelector('[data-mt=simpan]');
    tombolSibuk(tombol, true, 'Menyimpan...');
    try {
      const kirim = Object.assign({}, d, { wa: waAngka ? '62' + waAngka : '' });
      delete kirim.waTampil;
      const hasil = await panggil('adminSimpanTestimoni', tokenAdmin(), kirim);
      tersimpan = true;
      if (asli) gantiItem(S.adm.data.testimoni, hasil); else S.adm.data.testimoni.unshift(hasil);
      S.json.testimoni = '';
      S.json.beranda = '';
      Modal.tutup(item);
      renderAdminAktif();
      toast('Testimoni berhasil disimpan ke database!', hasil.nama);
    } catch (err) {
      tombolSibuk(tombol, false);
      if (err.kode === 'VALIDASI' && err.detail) aturGalatKolom(form, err.detail);
      else toastGalat(err, 'Testimoni gagal disimpan');
    }
  });
}

// ════════════════════════════════════════════════════════════
// BAGIAN 23: LAPORAN & EKSPOR
// ════════════════════════════════════════════════════════════

function rentangBulanIni() {
  const b = bagianJkt(new Date());
  const p = n => String(n).padStart(2, '0');
  return { dari: `${b.y}-${p(b.m)}-01`, sampai: `${b.y}-${p(b.m)}-${p(new Date(b.y, b.m, 0).getDate())}`, bulan: `${b.y}-${p(b.m)}` };
}

S.adm.lap = Object.assign({ tab: 'testimoni', status: 'semua', kanal: 'semua', lantai: 'semua', cari: '', urut: 'tanggal', arah: 'turun', hal: 1 }, rentangBulanIni());

function teksPeriode(dari, sampai) {
  const a = keTanggal(dari);
  const z = keTanggal(sampai);
  if (!a || !z) return 'Semua periode';
  const ba = bagianJkt(a);
  const bz = bagianJkt(z);
  if (ba.d === 1 && ba.y === bz.y && ba.m === bz.m && bz.d === new Date(bz.y, bz.m, 0).getDate()) return KONST.BULAN_PANJANG[ba.m - 1] + ' ' + ba.y;
  return fTgl(a) + ' - ' + fTgl(z);
}

function dalamRentang(v, dari, sampai) {
  const k = fTgl(v, 'iso');
  if (k === '-') return false;
  return (!dari || k >= dari) && (!sampai || k <= sampai);
}

/** Definisi tiap tab laporan → {judul, kpi[], kolom[], baris[{sel[], ekspor[]}], periode, filter} */
function dataLaporan(tab, semuaBaris) {
  const d = S.adm.data;
  const L = S.adm.lap;
  const q = L.cari.toLowerCase();
  const cocok = teks => !q || teks.toLowerCase().indexOf(q) >= 0;
  const kpi = (label, nilai, sub, ikonNama, kelasIkon, ekstra, kelasNilai) => ({ label, nilai, sub, ikonNama, kelasIkon, ekstra, kelasNilai });

  if (tab === 'testimoni') {
    let daftar = semuaBaris ? d.testimoni.slice() : d.testimoni.filter(t =>
      dalamRentang(t.tanggal, L.dari, L.sampai) && (L.status === 'semua' || t.status === L.status) &&
      (L.kanal === 'semua' || t.sumber === L.kanal) && cocok([t.nama, t.wa, t.id, t.isi].join(' ')));
    daftar.sort((a, b) => {
      const x = L.urut === 'id' ? String(a.id).localeCompare(String(b.id)) : (keTanggal(a.tanggal) - keTanggal(b.tanggal));
      return L.arah === 'naik' ? x : -x;
    });
    const tampil = daftar.filter(t => t.status === 'Tampil').length;
    return {
      judul: 'Testimoni Penghuni', judulTabel: 'Data Rekapitulasi Testimoni',
      periode: teksPeriode(L.dari, L.sampai),
      filter: [L.status === 'semua' ? 'Semua status' : L.status, L.kanal === 'semua' ? 'Semua sumber' : L.kanal, L.cari ? '"' + L.cari + '"' : ''].filter(Boolean).join(', '),
      kpi: [
        kpi('Total Data Rekap', daftar.length, 'Baris siap cetak/ekspor', 'dataset', 'bg-primary-fixed text-primary'),
        kpi('Status: Publikasi', tampil, 'Aktif di etalase beranda', 'check_circle', 'bg-secondary-fixed text-on-secondary-fixed', teksPersen(persen(tampil, daftar.length)), 'text-secondary'),
        kpi('Status: Diarsipkan', daftar.length - tampil, 'Tersimpan dalam arsip audit', 'visibility_off', 'bg-surface-container-highest text-on-surface-variant', teksPersen(persen(daftar.length - tampil, daftar.length))),
        kpi('Periode Audit Aktif', teksPeriode(L.dari, L.sampai), 'Integritas Log Valid', 'calendar_today', 'bg-tertiary-fixed text-tertiary', null, 'text-primary')
      ],
      kolom: [['No'], ['Tanggal & Waktu', 'tanggal'], ['ID Referensi', 'id'], ['Nama Pengirim'], ['Kontak WhatsApp'], ['Kanal Entri'], ['Cuplikan Testimoni'], ['Lampiran'], ['Status Beranda'], ['Operator / Otoritas']],
      baris: daftar.map((t, i) => {
        const km = kamarDariId(t.idKamar);
        const sub = t.tipe === 'Official' ? 'Manajemen Terverifikasi' : (km ? 'Penghuni Kamar ' + km.kode : labelKamarAdmin(t));
        const kanal = t.sumber === 'Admin' ? 'Input Petugas' : 'Web Form';
        const wa = t.wa ? formatWA(t.wa) : (t.sumber === 'Admin' ? '- (Internal Admin)' : '-');
        const operator = t.sumber === 'Admin' ? (t.dibuatOleh || 'Admin') : 'Auto-System';
        return {
          ekspor: [i + 1, fTgl(t.tanggal, 'pendekJam'), t.id, t.nama + ' — ' + sub, wa, kanal, t.isi, t.fotoBukti ? 'Ada Bukti Foto' : '-', t.status === 'Tampil' ? 'Tampil di Beranda' : 'Disembunyikan', operator],
          sel: [
            `<span class="text-outline font-medium">${i + 1}</span>`,
            `<div class="flex flex-col"><span class="font-medium text-on-surface">${fTgl(t.tanggal)}</span><span class="font-body-sm text-[11px] text-on-surface-variant">${fTgl(t.tanggal, 'jam')}</span></div>`,
            `<span class="font-mono text-[12px] font-semibold text-primary px-2 py-0.5 rounded bg-primary-fixed whitespace-nowrap">#${esc(t.id)}</span>`,
            `<div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full ${t.tipe === 'Official' ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-on-surface-variant'} flex items-center justify-center font-bold text-[11px] shrink-0">${esc(inisial(t.nama))}</div><div class="flex flex-col"><span class="font-semibold text-on-surface">${esc(t.nama)}</span><span class="text-[11px] ${t.tipe === 'Official' ? 'text-primary-container' : 'text-on-surface-variant'}">${esc(sub)}</span></div></div>`,
            `<span class="font-mono text-[12px] text-on-surface-variant whitespace-nowrap">${esc(wa)}</span>`,
            t.sumber === 'Admin' ? `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-container">${ikon('badge', 'text-[14px]')}Input Petugas</span>` : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-tertiary-fixed text-tertiary">${ikon('globe', 'text-[13px]')}Web Form</span>`,
            `<p class="line-clamp-2 text-on-surface-variant italic leading-relaxed min-w-[240px]">“${esc(t.isi)}”</p>`,
            t.fotoBukti ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-secondary-fixed text-on-secondary-fixed whitespace-nowrap">${ikon('photo_camera', 'text-[14px]')}Ada Bukti Foto</span>` : '<span class="text-outline">-</span>',
            t.status === 'Tampil' ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-secondary text-on-secondary shadow-sm whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-white"></span>Tampil di Beranda</span>` : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-container-high text-on-surface-variant whitespace-nowrap">${ikon('visibility_off', 'text-[13px]')}Disembunyikan</span>`,
            `<span class="inline-flex items-center gap-1 text-[11px] text-on-surface-variant whitespace-nowrap">${ikon(t.sumber === 'Admin' ? 'shield_person' : 'smart_toy', 'text-[14px] text-outline')}${esc(operator)}</span>`
          ]
        };
      })
    };
  }

  if (tab === 'kamar') {
    const master = {};
    d.fasilitas.forEach(f => { master[f.kode] = f; });
    const daftar = d.kamar.filter(k => semuaBaris || ((L.status === 'semua' || k.status === L.status) && (L.lantai === 'semua' || String(k.lantai) === L.lantai) && cocok([k.kode, k.nama, k.posisi].join(' ')))).sort((a, b) => a.urutan - b.urutan);
    const st = statistikKamar(daftar);
    return {
      judul: 'Inventaris & Okupansi Kamar', judulTabel: 'Data Inventaris Kamar', periode: 'Per ' + fTgl(new Date(), 'panjang'),
      filter: [L.status === 'semua' ? 'Semua status' : L.status, L.lantai === 'semua' ? 'Semua lantai' : 'Lantai ' + L.lantai, L.cari ? '"' + L.cari + '"' : ''].filter(Boolean).join(', '),
      kpi: [
        kpi('Total Kamar', st.total, 'Unit dalam rekap', 'apartment', 'bg-primary-fixed text-primary'),
        kpi('Tersedia', st.tersedia, 'Siap disewakan', 'check_circle', 'bg-secondary-fixed text-on-secondary-fixed', teksPersen(st.siap), 'text-secondary'),
        kpi('Terisi', st.terisi, 'Kontrak berjalan', 'group', 'bg-tertiary-fixed text-primary-container', teksPersen(st.okupansi), 'text-primary-container'),
        kpi('Okupansi', teksPersen(st.okupansi), 'Target ' + (d.info.targetOkupansi || 75) + '%', 'pie_chart', 'bg-surface-container text-on-surface-variant', null, 'text-primary')
      ],
      kolom: [['No'], ['Kode Unit'], ['Nama Kamar'], ['Lantai'], ['Harga/Bulan'], ['Dimensi & Luas'], ['Tipe Kasur'], ['Kamar Mandi'], ['Daya Listrik'], ['Fasilitas'], ['Status'], ['Diperbarui']],
      baris: daftar.map((k, i) => {
        const fas = (k.fasilitas || []).map(c => master[c] && master[c].ringkas).filter(Boolean).concat(k.kustom || []).join(', ');
        const dim = `${desimal(k.panjang)} x ${desimal(k.lebar)} m (${String(Math.round(k.panjang * k.lebar * 10) / 10).replace('.', ',')} m²)`;
        const kasur = (KONST.KASUR[k.kasur] || {}).spek || '-';
        // Daya isian bebas: angka saja (data lama "900"/"1300") diberi satuan VA
        const daya = /^\d+$/.test(String(k.daya || '')) ? k.daya + ' VA' : (k.daya || '-');
        return {
          ekspor: [i + 1, k.kode, k.nama, Number(k.lantai), Number(k.harga), dim, kasur, k.kamarMandi, daya, fas, k.status, fTgl(k.diperbarui, 'pendekJam')],
          sel: [`<span class="text-outline font-medium">${i + 1}</span>`, `<span class="font-mono text-[12px] font-semibold text-primary">${esc(k.kode)}</span>`, `<span class="font-semibold text-on-surface">${esc(k.nama)}</span>`, 'Lantai ' + esc(k.lantai),
            `<span class="font-label-numeric text-primary-container whitespace-nowrap">${rupiah(k.harga)}</span>`, esc(dim), esc(kasur), esc(k.kamarMandi), esc(daya),
            `<span class="text-[12px] text-on-surface-variant">${esc(fas)}</span>`,
            `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${k.status === 'Tersedia' ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary-fixed text-primary'}">${esc(k.status)}</span>`,
            `<span class="text-[12px] text-on-surface-variant whitespace-nowrap">${fTgl(k.diperbarui)}</span>`]
        };
      })
    };
  }

  if (tab === 'kegiatan') {
    const daftar = d.kegiatan.filter(g => semuaBaris || (dalamRentang(g.tanggal, L.dari, L.sampai) && (L.status === 'semua' || g.status === L.status) && cocok([g.id, g.judul, g.ringkas].join(' ')))).sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
    const tampil = daftar.filter(g => g.status === 'Tampil').length;
    return {
      judul: 'Riwayat Galeri Kegiatan', judulTabel: 'Data Riwayat Kegiatan', periode: teksPeriode(L.dari, L.sampai),
      filter: [L.status === 'semua' ? 'Semua status' : L.status, L.cari ? '"' + L.cari + '"' : ''].filter(Boolean).join(', '),
      kpi: [
        kpi('Total Kegiatan', daftar.length, 'Baris siap cetak/ekspor', 'photo_library', 'bg-primary-fixed text-primary'),
        kpi('Tampil', tampil, 'Aktif di galeri beranda', 'check_circle', 'bg-secondary-fixed text-on-secondary-fixed', teksPersen(persen(tampil, daftar.length)), 'text-secondary'),
        kpi('Disembunyikan', daftar.length - tampil, 'Tersimpan dalam arsip', 'visibility_off', 'bg-surface-container-highest text-on-surface-variant'),
        kpi('Periode', teksPeriode(L.dari, L.sampai), 'Berdasarkan tanggal kegiatan', 'calendar_today', 'bg-tertiary-fixed text-tertiary', null, 'text-primary')
      ],
      kolom: [['No'], ['Tanggal'], ['ID'], ['Judul'], ['Keterangan Singkat'], ['Jumlah Foto'], ['Status'], ['Diperbarui']],
      baris: daftar.map((g, i) => ({
        ekspor: [i + 1, fTgl(g.tanggal), g.id, g.judul, g.ringkas, (g.foto || []).length, g.status, fTgl(g.diperbarui, 'pendekJam')],
        sel: [`<span class="text-outline font-medium">${i + 1}</span>`, `<span class="whitespace-nowrap">${fTgl(g.tanggal)}</span>`, `<span class="font-mono text-[12px] font-semibold text-primary">${esc(g.id)}</span>`, `<span class="font-semibold text-on-surface">${esc(g.judul)}</span>`,
          `<p class="line-clamp-2 text-on-surface-variant min-w-[220px]">${esc(g.ringkas)}</p>`, String((g.foto || []).length), chipStatusTesti(g.status), `<span class="text-[12px] text-on-surface-variant whitespace-nowrap">${fTgl(g.diperbarui)}</span>`]
      }))
    };
  }

  // Kinerja Banner
  const bulan = L.bulan || rentangBulanIni().bulan;
  const stat = {};
  d.statBanner.filter(s => s.bulan === bulan).forEach(s => { stat[s.idBanner] = s; });
  const daftar = d.banner.filter(b => semuaBaris || L.status === 'semua' || b.status === L.status).sort((a, b) => a.urutan - b.urutan);
  const tayang = daftar.reduce((s, b) => s + ((stat[b.id] || {}).tayang || 0), 0);
  const klik = daftar.reduce((s, b) => s + ((stat[b.id] || {}).klik || 0), 0);
  const [by, bm] = bulan.split('-').map(Number);
  const namaBulan = KONST.BULAN_PANJANG[(bm || 1) - 1] + ' ' + by;
  return {
    judul: 'Kinerja Banner Beranda', judulTabel: 'Data Kinerja Banner', periode: namaBulan,
    filter: L.status === 'semua' ? 'Semua status' : L.status,
    kpi: [
      kpi('Total Tayang', angka(tayang), 'Slide tampil di layar pengunjung', 'visibility', 'bg-primary-fixed text-primary'),
      kpi('Total Klik', angka(klik), 'Klik tombol CTA', 'ads_click', 'bg-secondary-fixed text-on-secondary-fixed', null, 'text-secondary'),
      kpi('Rata-rata Konversi', String(persen(klik, tayang)).replace('.', ',') + '%', 'Klik ÷ tayang', 'insights', 'bg-surface-container text-on-surface-variant'),
      kpi('Banner Aktif', d.banner.filter(b => b.status === 'Aktif').length + '/3', 'Maksimal 3 aktif', 'view_carousel', 'bg-tertiary-fixed text-tertiary', null, 'text-primary')
    ],
    kolom: [['Urutan'], ['ID'], ['Judul'], ['CTA'], ['Status'], ['Tayang'], ['Klik'], ['Konversi %'], ['Diperbarui']],
    baris: daftar.map(b => {
      const s = stat[b.id] || { tayang: 0, klik: 0 };
      const kv = persen(s.klik, s.tayang);
      return {
        ekspor: [b.urutan, b.id, b.judul, b.teksTombol ? b.teksTombol + ' (' + b.linkTombol + ')' : '-', b.status, s.tayang, s.klik, kv, fTgl(b.diperbarui, 'pendekJam')],
        sel: [`<span class="text-outline font-medium">#${b.urutan}</span>`, `<span class="font-mono text-[12px] font-semibold text-primary">${esc(b.id)}</span>`, `<span class="font-semibold text-on-surface">${esc(b.judul)}</span>`,
          `<span class="text-[12px] text-on-surface-variant">${b.teksTombol ? esc(b.teksTombol) + ' <code class="text-primary">' + esc(b.linkTombol) + '</code>' : '-'}</span>`,
          `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${b.status === 'Aktif' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'}">${esc(b.status)}</span>`,
          angka(s.tayang), angka(s.klik), String(kv).replace('.', ',') + '%', `<span class="text-[12px] text-on-surface-variant whitespace-nowrap">${fTgl(b.diperbarui)}</span>`]
      };
    })
  };
}

RENDER['admin-laporan'] = function (el, param) {
  const d = S.adm.data;
  if (!d) { el.innerHTML = kerangkaAdmin(); return; }
  const L = S.adm.lap;
  if (param && param.tab) { L.tab = param.tab; L.hal = 1; param.tab = ''; }
  const lap = dataLaporan(L.tab);
  const per = 10;
  const totalHal = Math.max(1, Math.ceil(lap.baris.length / per));
  L.hal = Math.min(L.hal, totalHal);
  const mulai = (L.hal - 1) * per;
  const tampil = lap.baris.slice(mulai, mulai + per);
  const tab = (id, ikonNama, label, jumlah) => `<button type="button" role="tab" aria-selected="${L.tab === id}" data-aksi="lap-tab" data-tab="${id}" class="relative pb-3 pt-2 font-label-md text-label-md flex items-center gap-2 whitespace-nowrap ${L.tab === id ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface transition-colors'}">
      ${ikon(ikonNama, 'text-[18px]')}<span>${label}</span>${jumlah !== null ? `<span class="px-2 py-0.5 rounded-full text-[11px] ${L.tab === id ? 'font-bold bg-primary-fixed text-on-primary-fixed' : 'font-medium bg-surface-container text-on-surface-variant'}">${jumlah}</span>` : ''}
      ${L.tab === id ? '<span class="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end rounded-t-full"></span>' : ''}</button>`;
  const kotak = (label, isi) => `<div class="flex flex-col gap-1.5"><label class="font-label-md text-label-md text-on-surface-variant">${label}</label>${isi}</div>`;
  const kotakIkon = (ikonNama, isi) => `<div class="relative flex items-center bg-surface-container-low rounded-lg px-3 py-2 text-on-surface focus-within:bg-surface-container-lowest shadow-sm min-h-[40px]">${ikon(ikonNama, 'text-outline text-[18px] mr-2 shrink-0')}${isi}</div>`;
  const pilihSederhana = (kunci, opsi, nilai) => `<select data-ubah="lap-filter" data-kunci="${kunci}" class="w-full bg-transparent font-body-sm text-body-sm text-on-surface focus:outline-none cursor-pointer pr-5 appearance-none">${opsi.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(nilai) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>${ikon('expand_more', 'text-[16px] text-outline absolute right-3 pointer-events-none')}`;
  const rentang = kotak('Rentang Tanggal' + (L.tab === 'testimoni' ? ' Pengajuan' : ''), kotakIkon('date_range', `<input type="date" data-ubah="lap-filter" data-kunci="dari" value="${esc(L.dari)}" aria-label="Dari tanggal" class="bg-transparent font-body-sm text-body-sm text-on-surface focus:outline-none w-full min-w-0"><span class="px-1 text-outline">–</span><input type="date" data-ubah="lap-filter" data-kunci="sampai" value="${esc(L.sampai)}" aria-label="Sampai tanggal" class="bg-transparent font-body-sm text-body-sm text-on-surface focus:outline-none w-full min-w-0">`));
  let filterHtml = '';
  if (L.tab === 'testimoni') {
    filterHtml = rentang +
      kotak('Status Publikasi', kotakIkon('visibility', pilihSederhana('status', [['semua', 'Semua Status (Tampil & Sembunyi)'], ['Tampil', 'Hanya Tampil di Beranda'], ['Disembunyikan', 'Disembunyikan (Arsip Internal)']], L.status))) +
      kotak('Kanal / Sumber Entri', kotakIkon('input', pilihSederhana('kanal', [['semua', 'Semua Sumber (Customer & Admin)'], ['Customer', 'Formulir Publik (Customer)'], ['Admin', 'Input Petugas (Super Admin)']], L.kanal)));
  } else if (L.tab === 'kamar') {
    filterHtml = kotak('Status Ketersediaan', kotakIkon('bed', pilihSederhana('status', [['semua', 'Semua Status'], ['Tersedia', 'Tersedia'], ['Terisi', 'Terisi']], L.status))) +
      kotak('Lantai', kotakIkon('layers', pilihSederhana('lantai', [['semua', 'Semua Lantai']].concat(Array.from(new Set(d.kamar.map(k => k.lantai))).sort().map(l => [String(l), 'Lantai ' + l])), L.lantai))) +
      '<div class="hidden xl:block"></div>';
  } else if (L.tab === 'kegiatan') {
    filterHtml = rentang + kotak('Status', kotakIkon('visibility', pilihSederhana('status', [['semua', 'Semua Status'], ['Tampil', 'Tampil'], ['Disembunyikan', 'Disembunyikan']], L.status))) + '<div class="hidden xl:block"></div>';
  } else {
    filterHtml = kotak('Bulan', kotakIkon('calendar_month', `<input type="month" data-ubah="lap-filter" data-kunci="bulan" value="${esc(L.bulan)}" aria-label="Bulan" class="bg-transparent font-body-sm text-body-sm text-on-surface focus:outline-none w-full">`)) +
      kotak('Status Banner', kotakIkon('view_carousel', pilihSederhana('status', [['semua', 'Semua Status'], ['Aktif', 'Aktif'], ['Nonaktif', 'Nonaktif']], L.status))) + '<div class="hidden xl:block"></div>';
  }
  const kepalaKolom = lap.kolom.map(c => {
    if (!c[1]) return `<th class="py-3 px-4 whitespace-nowrap">${esc(c[0])}</th>`;
    const aktif = L.urut === c[1];
    return `<th class="py-3 px-4 whitespace-nowrap"><button type="button" data-aksi="lap-urut" data-kolom="${c[1]}" class="flex items-center gap-1 uppercase tracking-wider hover:text-on-surface transition-colors" aria-label="Urutkan ${esc(c[0])}">${esc(c[0])}${ikon(aktif ? (L.arah === 'naik' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more', 'text-[14px]')}</button></th>`;
  }).join('');
  const info = d.info;
  el.innerHTML = `<div class="h-1 w-full bg-gradient-to-r from-gradient-start via-gradient-mid to-gradient-end rounded-full mb-space-lg shadow-sm"></div>
  <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-space-md mb-space-lg">
    <div class="flex flex-col">
      <div class="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant mb-1"><span>Kost AB6</span>${ikon('chevron_right', 'text-[14px]')}<span>Portal Pengelola</span>${ikon('chevron_right', 'text-[14px]')}<span class="font-label-md text-label-md text-primary font-semibold">Laporan &amp; Ekspor</span></div>
      <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">Laporan &amp; Ekspor Data Operasional</h1>
      <p class="font-body-md text-body-md text-on-surface-variant mt-1 max-w-3xl">Pusat dokumentasi dan rekap data operasional Kost AB6. Filter data berdasarkan modul dan unduh dalam format Excel (.xlsx) atau dokumen cetak PDF resmi berstempel digital.</p>
    </div>
    <div class="flex flex-wrap items-center gap-space-sm self-start xl:self-center">
      <button type="button" data-aksi="lap-ekspor" data-format="xlsx" class="group inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-lowest text-secondary font-label-md text-label-md shadow-sm hover:shadow-md hover:bg-secondary hover:text-on-secondary transition-all">${ikon('table_view', 'text-[20px]')}<span>Unduh Excel (.xlsx)</span></button>
      <button type="button" data-aksi="lap-ekspor" data-format="pdf" class="group inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md shadow-sm hover:shadow-md hover:bg-primary transition-all">${ikon('print', 'text-[20px]')}<span>Unduh PDF Resmi</span></button>
    </div>
  </div>
  <div class="relative bg-surface-container-lowest rounded-xl shadow-sm mb-space-lg px-space-md pt-2"><div class="flex items-center gap-space-md overflow-x-auto" role="tablist" aria-label="Modul laporan">
    ${tab('testimoni', 'rate_review', 'Testimoni Penghuni', d.testimoni.length)}${tab('kamar', 'bed', 'Inventaris &amp; Okupansi Kamar', d.kamar.length)}${tab('kegiatan', 'photo_library', 'Riwayat Galeri Kegiatan', d.kegiatan.length)}${tab('banner', 'view_carousel', 'Kinerja Banner Beranda', d.banner.length)}
  </div></div>
  <div class="bg-surface-container-lowest rounded-xl shadow-sm p-space-md mb-space-lg">
    <div class="flex items-center justify-between gap-2 mb-space-md">
      <div class="flex items-center gap-2">${ikon('tune', 'text-primary text-[20px]')}<span class="font-headline-sm text-headline-sm text-on-surface">Parameter &amp; Kriteria Rekap</span></div>
      <span class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-status-available"></span>Database Sinkron Otomatis</span>
    </div>
    <form class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md items-end" data-kirim="lap-filter" novalidate>
      ${filterHtml}
      ${L.tab === 'banner' ? '<div></div>' : kotak('Pencarian Nama / Kata Kunci', `<div class="flex items-center gap-2"><div class="relative flex-1 flex items-center bg-surface-container-low rounded-lg px-3 py-2 text-on-surface focus-within:bg-surface-container-lowest shadow-sm min-h-[40px]">${ikon('search', 'text-outline text-[18px] mr-2')}<input id="lap-cari" type="search" data-masukan="lap-cari" value="${esc(L.cari)}" placeholder="Cari nama, WhatsApp, ID..." aria-label="Cari" class="w-full bg-transparent font-body-sm text-body-sm text-on-surface focus:outline-none"></div>
        <button type="submit" title="Terapkan Filter" aria-label="Terapkan filter" class="px-3.5 py-2 min-h-[40px] rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors shadow-sm flex items-center justify-center">${ikon('filter_alt', 'text-[18px]')}</button>
        <button type="button" data-aksi="lap-reset" title="Reset Filter" aria-label="Reset filter" class="px-3.5 py-2 min-h-[40px] rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors shadow-sm flex items-center justify-center">${ikon('restart_alt', 'text-[18px]')}</button></div>`)}
    </form>
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-lg">${lap.kpi.map(k => `
    <div class="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-start justify-between gap-2">
      <div class="flex flex-col min-w-0"><span class="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">${esc(k.label)}</span>
        <div class="flex items-baseline gap-2 mt-1"><span class="${typeof k.nilai === 'number' || /^[\d.,%/]+$/.test(String(k.nilai)) ? 'font-display-hero-mobile text-display-hero-mobile' : 'font-label-numeric text-label-numeric'} ${k.kelasNilai || 'text-on-surface'} font-bold truncate">${esc(k.nilai)}</span>${k.ekstra ? `<span class="font-label-md text-label-md ${k.kelasNilai || 'text-on-surface-variant'}">${esc(k.ekstra)}</span>` : ''}</div>
        <span class="font-body-sm text-body-sm text-on-surface-variant mt-1 ${k.label.indexOf('Periode') === 0 ? 'text-secondary flex items-center gap-1' : ''}">${k.label.indexOf('Periode') === 0 ? ikon('verified', 'text-[14px]') : ''}${esc(k.sub)}</span></div>
      <div class="w-10 h-10 rounded-lg ${k.kelasIkon} flex items-center justify-center shrink-0">${ikon(k.ikonNama, 'text-[22px]')}</div>
    </div>`).join('')}</div>
  <div class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden mb-space-lg">
    <div class="p-space-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
      <div class="flex items-center gap-space-xs"><span class="font-headline-sm text-headline-sm text-on-surface">${esc(lap.judulTabel)}</span><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-container text-on-surface-variant">Format Tabular</span></div>
      <span class="font-body-sm text-body-sm text-on-surface-variant">Menampilkan <strong class="text-on-surface">${tampil.length}</strong> dari <strong class="text-on-surface">${lap.baris.length}</strong> entri terpilih</span>
    </div>
    <div class="overflow-x-auto gulir-tampak"><table class="w-full min-w-[960px] text-left font-table-data text-table-data">
      <thead class="bg-surface-subtle font-label-md text-[11px] text-on-surface-variant uppercase tracking-wider"><tr>${kepalaKolom}</tr></thead>
      <tbody class="divide-y divide-surface-container-high text-on-surface">${tampil.map((b, i) => `<tr class="${i % 2 ? 'bg-surface-subtle/60 ' : ''}hover:bg-surface-subtle transition-colors">${b.sel.map(s => `<td class="py-3.5 px-4 align-middle">${s}</td>`).join('')}</tr>`).join('') ||
        `<tr><td colspan="${lap.kolom.length}" class="py-10 text-center text-on-surface-variant">Tidak ada data untuk filter ini.</td></tr>`}</tbody>
    </table></div>
    <div class="p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm border-t border-border-subtle">
      <span class="font-body-sm text-body-sm text-on-surface-variant">Menampilkan <strong class="text-on-surface">${tampil.length ? (mulai + 1) + ' - ' + (mulai + tampil.length) : 0}</strong> dari <strong class="text-on-surface">${lap.baris.length}</strong> data laporan terpilih</span>
      ${paginasiAdmin(L.hal, totalHal, 'lap-hal')}
    </div>
  </div>
  <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md">
    <div class="flex items-start gap-space-md max-w-3xl">
      <div class="w-12 h-12 rounded-xl bg-[#E6F4EA] flex items-center justify-center shrink-0 text-[#137333] shadow-sm">${ikon('cloud_sync', 'text-[28px]')}</div>
      <div class="flex flex-col"><div class="flex flex-wrap items-center gap-2"><span class="font-headline-sm text-headline-sm text-on-surface">Sinkronisasi Cloud Google Spreadsheet Terhubung</span><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-secondary-fixed text-on-secondary-fixed">Live Sync</span></div>
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">Tabel data ini terintegrasi langsung dengan database Google Sheets Kost AB6. Ekspor Excel menghasilkan berkas siap cetak berformat <strong>.xlsx</strong> dengan tata letak kolom yang telah dirapikan (Auto-Fit column width &amp; freeze header).</p></div>
    </div>
    <div class="flex flex-col items-start lg:items-end shrink-0 lg:pl-0">
      <div class="flex items-center gap-1 text-[12px] font-medium text-on-surface-variant">${ikon('update', 'text-[16px] text-secondary')}<span>Terakhir disinkronkan: <strong>${info.terakhirSinkron ? fHariIni(info.terakhirSinkron) : fHariIni(S.adm.waktuMuat ? new Date(S.adm.waktuMuat) : new Date())}</strong></span></div>
      <span class="text-[11px] text-outline mt-0.5">Operator aktif: ${esc(info.adminPeran)} (${esc(info.adminNama)})</span>
      <button type="button" data-aksi="sinkronkan" class="mt-2 text-[12px] font-label-md text-primary hover:underline flex items-center gap-1">${ikon('refresh', 'text-[14px]')}<span>Sinkronkan Sekarang</span></button>
    </div>
  </div>`;
};

function renderLaporan() { RENDER['admin-laporan']($('#hal-admin-laporan'), {}); }

AKSI['lap-tab'] = el => { S.adm.lap.tab = el.dataset.tab; S.adm.lap.hal = 1; S.adm.lap.status = 'semua'; S.adm.lap.cari = ''; renderLaporan(); };
AKSI['lap-hal'] = el => { S.adm.lap.hal = Number(el.dataset.hal) || 1; renderLaporan(); };
AKSI['lap-urut'] = el => {
  const L = S.adm.lap;
  if (L.urut === el.dataset.kolom) L.arah = L.arah === 'naik' ? 'turun' : 'naik';
  else { L.urut = el.dataset.kolom; L.arah = 'turun'; }
  renderLaporan();
};
AKSI['lap-reset'] = () => {
  Object.assign(S.adm.lap, { status: 'semua', kanal: 'semua', lantai: 'semua', cari: '', hal: 1 }, rentangBulanIni());
  renderLaporan();
};
UBAH['lap-filter'] = el => { S.adm.lap[el.dataset.kunci] = el.value; S.adm.lap.hal = 1; renderLaporan(); };
MASUKAN['lap-cari'] = debounce(el => {
  S.adm.lap.cari = el.value;
  S.adm.lap.hal = 1;
  const pos = el.selectionStart;
  renderLaporan();
  const baru = $('#lap-cari');
  if (baru) { baru.focus(); try { baru.setSelectionRange(pos, pos); } catch (e) { /* abaikan */ } }
}, 300);
KIRIM['lap-filter'] = () => { S.adm.lap.hal = 1; renderLaporan(); };

/** Kirim baris laporan (sudah difilter) ke server → unduh .xlsx / .pdf */
async function ekspor(tab, format, tombol, semuaBaris) {
  const lap = dataLaporan(tab, semuaBaris);
  if (!lap.baris.length) { toast('Tidak ada data', 'Tidak ada baris untuk diekspor.', 'info'); return; }
  if (lap.baris.length > 5000) { toast('Data terlalu banyak', 'Persempit filter (maks 5.000 baris).', 'galat'); return; }
  tombolSibuk(tombol, true, 'Menyiapkan...');
  try {
    const r = await panggil('adminEkspor', tokenAdmin(), {
      jenis: tab, judul: lap.judul, format: format, kolom: lap.kolom.map(c => c[0]),
      baris: lap.baris.map(b => b.ekspor), ringkasan: lap.kpi.map(k => [k.label, String(k.nilai) + (k.ekstra ? ' (' + k.ekstra + ')' : '')]),
      periodeTeks: lap.periode, filterTeks: semuaBaris ? 'Semua data' : lap.filter
    });
    unduhBase64(r.base64, r.mimeType, r.namaFile);
    toast('Berkas diunduh', r.namaFile);
  } catch (e) {
    toastGalat(e, 'Ekspor gagal');
  } finally {
    tombolSibuk(tombol, false);
  }
}

AKSI['lap-ekspor'] = el => ekspor(S.adm.lap.tab, el.dataset.format, el, false);
AKSI['ekspor-cepat'] = el => ekspor(el.dataset.jenis, 'xlsx', el, el.dataset.jenis === 'kamar');

AKSI['sinkronkan'] = async el => {
  tombolSibuk(el, true, 'Menyinkronkan...');
  try {
    const r = await panggil('adminSinkronkan', tokenAdmin());
    if (S.adm.data) S.adm.data.info.terakhirSinkron = r.terakhirSinkron;
    S.json = {};
    await muatAdmin();
    renderAdminAktif();
    toast('Sinkronisasi selesai', 'Cache dibersihkan, data terbaru dimuat.');
  } catch (e) {
    toastGalat(e, 'Sinkronisasi gagal');
  } finally {
    tombolSibuk(el, false);
  }
};

// ════════════════════════════════════════════════════════════
// BAGIAN 24: PENGATURAN SITUS
// ════════════════════════════════════════════════════════════

S.adm.set = null;

function jadwalDari(json, cadangan) {
  let j;
  try { j = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { j = null; }
  j = j || {};
  return { aktif: j.aktif !== false, buka: j.buka || cadangan[0], tutup: j.tutup || cadangan[1] };
}

function dataPengaturanAwal() {
  const p = S.adm.data.pengaturan;
  const k = String(p.KOORDINAT || '').split(',');
  return {
    VISI: p.VISI || '',
    MISI: String(p.MISI || '').split('\n').filter(s => s.trim()).map((s, i) => (i + 1) + '. ' + s.replace(/^\s*\d+[.)]\s*/, '')).join('\n'),
    WA: String(p.WA_ADMIN || '').replace(/^62/, '').replace(/^(\d{3})(\d{4})(\d+)$/, '$1-$2-$3'),
    WA_PESAN_DEFAULT: p.WA_PESAN_DEFAULT || '',
    EMAIL_PUBLIK: p.EMAIL_PUBLIK || '',
    KOORDINAT: k.length === 2 ? `Lat: ${k[0].trim()}, Long: ${k[1].trim()}` : '',
    ALAMAT: p.ALAMAT || '',
    MAPS_EMBED_URL: p.MAPS_EMBED_URL || '',
    sj: jadwalDari(p.JADWAL_SENIN_JUMAT, ['08:00', '20:00']),
    sa: jadwalDari(p.JADWAL_SABTU, ['08:00', '20:00']),
    mg: jadwalDari(p.JADWAL_MINGGU, ['09:00', '17:00'])
  };
}

function srcPeta(teks) {
  const s = String(teks || '').trim();
  const m = /src\s*=\s*["']([^"']+)["']/i.exec(s);
  const url = (m ? m[1] : s).replace(/&amp;/g, '&');
  return url.indexOf('https:\/\/www.google.com/maps/embed?') === 0 ? url : '';
}

function kekuatanSandi(s) {
  if (!s) return { skor: 0, label: '', warna: 'bg-surface-container' };
  let skor = 0;
  if (s.length >= 10) skor++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) skor++;
  if (/\d/.test(s)) skor++;
  if (/[^A-Za-z0-9]/.test(s) || s.length >= 14) skor++;
  const daftar = [['Lemah', 'bg-error', 'text-error'], ['Lemah', 'bg-error', 'text-error'], ['Sedang', 'bg-amber-500', 'text-amber-700'], ['Kuat', 'bg-status-available', 'text-status-available'], ['Sangat Kuat', 'bg-status-available', 'text-status-available']];
  return { skor, label: daftar[skor][0], warna: daftar[skor][1], teks: daftar[skor][2] };
}

RENDER['admin-pengaturan'] = function (el, param) {
  const d = S.adm.data;
  if (!d) { el.innerHTML = kerangkaAdmin(); return; }
  if (!S.adm.set || !S.kotor) {
    const awal = dataPengaturanAwal();
    S.adm.set = { data: awal, simpan: JSON.stringify(awal), terakhir: (S.adm.set && S.adm.set.terakhir) || null };
  }
  const f = S.adm.set.data;
  const info = d.info;
  const kartu = (ikonNama, kelasIkon, judul, sub, isi, kanan, id) => `<div ${id ? `id="${id}"` : ''} class="bg-surface-container-lowest rounded-xl p-6 shadow-sm scroll-mt-24">
    <div class="flex items-start justify-between gap-4 mb-5"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg ${kelasIkon} flex items-center justify-center shrink-0">${ikon(ikonNama, 'text-[24px]')}</div><div><h2 class="font-headline-sm text-headline-sm text-on-surface">${judul}</h2><p class="font-body-sm text-body-sm text-on-surface-variant">${sub}</p></div></div>${kanan || ''}</div>${isi}</div>`;
  const jadwal = (kunci, label) => {
    const j = f[kunci];
    return `<div class="p-4 rounded-xl bg-surface-subtle flex flex-col gap-3">
      <div class="flex items-center justify-between"><span class="font-label-md text-label-md text-on-surface">${label}</span>${sakelar(`data-ubah="set-jadwal" data-hari="${kunci}" data-f="aktif" aria-label="Aktifkan ${label}"`, j.aktif)}</div>
      <div class="flex flex-col sm:flex-row sm:items-center gap-2 ${j.aktif ? '' : 'opacity-50'}">
        <label class="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-container-lowest shadow-sm"><span class="font-body-sm text-body-sm text-on-surface-variant">Buka</span><input type="time" step="1800" data-ubah="set-jadwal" data-hari="${kunci}" data-f="buka" value="${esc(j.buka)}" ${j.aktif ? '' : 'disabled'} class="bg-transparent font-label-md text-label-md text-on-surface focus:outline-none text-right" aria-label="Jam buka ${label}"><span class="font-label-md text-[12px] text-on-surface">WIB</span></label>
        <span class="text-outline hidden sm:inline">-</span>
        <label class="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-container-lowest shadow-sm"><span class="font-body-sm text-body-sm text-on-surface-variant">Tutup</span><input type="time" step="1800" data-ubah="set-jadwal" data-hari="${kunci}" data-f="tutup" value="${esc(j.tutup)}" ${j.aktif ? '' : 'disabled'} class="bg-transparent font-label-md text-label-md text-on-surface focus:outline-none text-right" aria-label="Jam tutup ${label}"><span class="font-label-md text-[12px] text-on-surface">WIB</span></label>
      </div></div>`;
  };
  const peta = srcPeta(f.MAPS_EMBED_URL);
  const driveGb = b => (b === null || b === undefined) ? '-' : (Math.round(b / 1073741824 * 10) / 10).toString().replace('.', ',') + ' GB';
  const drivePersen = info.driveBatas ? Math.round(info.driveTerpakai / info.driveBatas * 100) : 0;
  const isianSet = (id, kunci, nilai, tipe, extra) => `<input id="${id}" type="${tipe || 'text'}" data-masukan="set" data-kunci="${kunci}" value="${esc(nilai)}" ${extra || ''} class="w-full bg-transparent text-on-surface font-body-md text-body-md focus:outline-none">`;

  el.innerHTML = `<div class="flex flex-col gap-1 mb-8">
    <div class="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant"><span>Kost AB6</span>${ikon('chevron_right', 'text-[14px]')}<span>Portal Pengelola</span>${ikon('chevron_right', 'text-[14px]')}<span class="font-label-md text-label-md text-primary">Pengaturan Situs</span></div>
    <div class="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mt-2">
      <div><h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">Pengaturan &amp; Konfigurasi Situs</h1><p class="font-body-md text-body-md text-on-surface-variant max-w-3xl mt-1">Kelola identitas publik Kost AB6, informasi kontak, jam operasional survei, integrasi Google Maps, dan keamanan akun pengelola.</p></div>
      <div class="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface-container-lowest shadow-sm self-start lg:self-auto">
        <span class="relative flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full ${info.tersambung ? 'bg-status-available' : 'bg-error'} opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 ${info.tersambung ? 'bg-status-available' : 'bg-error'}"></span></span>
        <span class="font-label-md text-label-md text-on-surface flex flex-wrap items-center gap-1.5">${info.tersambung ? 'Sistem Terhubung dengan Google Workspace' : 'Gangguan koneksi'} <span class="font-body-sm text-body-sm text-on-surface-variant font-normal">(Sheet &amp; Drive Active Sync)</span></span>
      </div>
    </div>
  </div>
  <form data-kirim="pengaturan" novalidate id="form-pengaturan" class="pb-28">
  <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
    <div class="xl:col-span-7 flex flex-col gap-6">
      ${kartu('flag', 'bg-surface-container text-primary', 'Visi &amp; Misi Kost AB6', 'Teks ini akan tampil secara otomatis di Beranda publik Kost AB6.', `
        <div class="flex flex-col gap-5">
          <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="set-visi">Pernyataan Visi</label><textarea id="set-visi" rows="3" maxlength="300" data-masukan="set" data-kunci="VISI" class="${KELAS.inputSet} resize-none">${esc(f.VISI)}</textarea>${galatKolom('VISI')}</div>
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between"><label class="${KELAS.label}" for="set-misi">Butir-butir Misi</label><span class="font-body-sm text-body-sm text-outline">Satu baris = satu poin misi</span></div><textarea id="set-misi" rows="6" data-masukan="set" data-kunci="MISI" class="${KELAS.inputSet} leading-relaxed">${esc(f.MISI)}</textarea>${galatKolom('MISI')}</div>
        </div>`, '<span class="px-2.5 py-1 rounded bg-surface-subtle text-primary font-label-md text-body-sm">Publik</span>')}

      ${kartu('chat', 'bg-secondary/10 text-secondary', 'Informasi Kontak &amp; Saluran WhatsApp', 'Kanal resmi interaksi calon penghuni dan operasional harian.', `
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5"><div class="flex flex-wrap items-center justify-between gap-2"><label class="${KELAS.label}" for="set-wa">Nomor WhatsApp Admin Resmi</label><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-whatsapp-green/10 text-secondary font-label-md text-[11px]">${ikon('check_circle', 'text-[13px]', true)}Terhubung ke Tombol WA Melayang</span></div>
            <div class="flex rounded-lg shadow-sm overflow-hidden bg-surface-subtle"><span class="inline-flex items-center px-3.5 bg-surface-container text-on-surface-variant font-label-md text-label-md">+62</span><input id="set-wa" type="tel" data-masukan="set" data-kunci="WA" value="${esc(f.WA)}" placeholder="812-3456-7890" class="w-full px-3.5 py-2.5 bg-transparent text-on-surface font-body-md text-body-md focus:outline-none"></div>${galatKolom('WA_ADMIN')}</div>
          <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="set-pesan">Pesan Otomatis WhatsApp Default</label><textarea id="set-pesan" rows="2" maxlength="300" data-masukan="set" data-kunci="WA_PESAN_DEFAULT" class="${KELAS.inputSet} resize-none">${esc(f.WA_PESAN_DEFAULT)}</textarea>${galatKolom('WA_PESAN_DEFAULT')}</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="set-email">Alamat Surel / Email</label><div class="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-subtle shadow-sm">${ikon('mail', 'text-outline text-[18px]')}${isianSet('set-email', 'EMAIL_PUBLIK', f.EMAIL_PUBLIK, 'email')}</div>${galatKolom('EMAIL_PUBLIK')}</div>
            <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="set-koor">Titik Koordinat GPS</label><div class="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-subtle shadow-sm">${ikon('my_location', 'text-outline text-[18px]')}${isianSet('set-koor', 'KOORDINAT', f.KOORDINAT, 'text', 'placeholder="Lat: -7.7601, Long: 110.3953"')}</div>${galatKolom('KOORDINAT')}</div>
          </div>
          <div class="flex flex-col gap-1.5"><label class="${KELAS.label}" for="set-alamat">Alamat Lengkap Fisik</label><textarea id="set-alamat" rows="2" maxlength="300" data-masukan="set" data-kunci="ALAMAT" class="${KELAS.inputSet} resize-none" placeholder="Baris 2 (opsional) = catatan patokan">${esc(f.ALAMAT)}</textarea><span class="font-body-sm text-[11px] text-outline">Baris kedua tampil sebagai catatan patokan di halaman Tentang Kami.</span>${galatKolom('ALAMAT')}</div>
        </div>`)}

      ${kartu('map', 'bg-surface-container text-primary', 'Integrasi Peta Interaktif Google Maps', 'Sematkan tautan iframe resmi untuk navigasi publik calon penyewa.', `
        <div class="flex flex-col gap-3">
          <label class="${KELAS.label}" for="set-maps">Kode Embed / URL Google Maps</label>
          <textarea id="set-maps" rows="3" data-masukan="set" data-kunci="MAPS_EMBED_URL" placeholder='&lt;iframe src="https:\/\/www.google.com/maps/embed?pb=..."&gt;&lt;/iframe&gt;' class="${KELAS.inputSet} font-mono text-[12px] resize-none">${esc(f.MAPS_EMBED_URL)}</textarea>${galatKolom('MAPS_EMBED_URL')}
          <div id="set-pratinjau-peta" class="relative w-full h-72 rounded-xl overflow-hidden shadow-inner bg-surface-container">${htmlPratinjauPeta(peta, f.KOORDINAT)}</div>
        </div>`)}
    </div>

    <div class="xl:col-span-5 flex flex-col gap-6">
      ${kartu('schedule', 'bg-surface-container text-primary', 'Jadwal Operasional Resepsionis &amp; Survei', 'Ditampilkan pada halaman Tentang Kami dan jam respons WhatsApp.', `
        <div class="flex flex-col gap-3">${jadwal('sj', 'Senin - Jumat')}${jadwal('sa', 'Sabtu')}${jadwal('mg', 'Minggu / Hari Libur')}${galatKolom('JADWAL')}
          <div class="p-3.5 rounded-xl bg-surface-container flex items-start gap-3">${ikon('key', 'text-primary text-[20px] shrink-0')}<p class="font-body-sm text-body-sm text-on-surface"><strong>Akses Gerbang:</strong> ${esc(info.infoGerbang || '')}</p></div>
        </div>`)}

      ${kartu('lock', 'bg-surface-container text-primary', 'Keamanan Akun Pengelola', 'Google Apps Script Auth', `
        <div class="flex flex-col gap-4">
          ${info.wajibGanti ? `<div class="p-3 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-start gap-2">${ikon('warning', 'text-[18px] shrink-0')}Anda masih memakai kata sandi sementara. Segera ganti kata sandi.</div>` : ''}
          <div class="p-3.5 rounded-xl bg-surface-subtle"><span class="font-body-sm text-[12px] text-on-surface-variant">Email Pengelola Aktif</span><div class="flex flex-wrap items-center gap-2 mt-0.5"><span class="font-label-md text-label-md text-on-surface">${esc(info.adminEmail)}</span><span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-primary-container text-on-primary">Super Admin</span></div></div>
          ${['lama', 'baru', 'ulang'].map((x, i) => `<div class="flex flex-col gap-1.5"><label class="font-body-sm text-body-sm text-on-surface" for="set-sandi-${x}">${['Kata Sandi Lama', 'Kata Sandi Baru', 'Konfirmasi Kata Sandi Baru'][i]}</label>
            <div class="relative"><input id="set-sandi-${x}" type="password" autocomplete="${i ? 'new-password' : 'current-password'}" ${i === 1 ? 'data-masukan="set-kekuatan"' : ''} class="w-full pl-3.5 pr-11 py-2.5 rounded-lg bg-surface-subtle text-on-surface font-body-md text-body-md tracking-wider focus:outline-none focus:bg-surface-container-lowest shadow-sm">
              ${i < 2 ? `<button type="button" data-aksi="toggle-sandi" data-target="set-sandi-${x}" aria-label="Tampilkan kata sandi" class="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-outline hover:text-on-surface">${ikon('visibility', 'text-[20px]')}</button>` : ''}</div>
            ${i === 1 ? `<div class="h-1.5 w-full rounded-full bg-surface-container overflow-hidden mt-1"><div id="set-kekuatan-bar" class="h-full w-0 transition-all"></div></div><span id="set-kekuatan-label" class="font-body-sm text-[11px]"></span>` : ''}
            <p data-galat-sandi="${x}" class="font-body-sm text-body-sm text-error" hidden></p></div>`).join('')}
          <button type="button" data-aksi="ganti-sandi" class="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors">${ikon('key', 'text-[18px]')}Perbarui Kredensial Masuk</button>
        </div>`, '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary-fixed text-on-secondary-fixed font-label-md text-[11px]">' + ikon('verified_user', 'text-[14px]') + 'SHA-256</span>', 'kartu-keamanan')}

      ${kartu('sync', 'bg-surface-container text-primary', 'Sinkronisasi Database', 'Google Sheets Core Engine', `
        <div class="flex flex-col gap-4">
          <div class="p-3.5 rounded-xl bg-surface-subtle"><span class="font-body-sm text-[12px] text-on-surface-variant">ID Database Spreadsheet Aktif</span><div class="flex items-center justify-between gap-2 mt-0.5"><span class="font-mono text-[13px] text-on-surface">${esc(info.idSamar)}</span><span class="inline-flex items-center gap-1 font-label-md text-[11px] ${info.tersambung ? 'text-status-available' : 'text-error'}"><span class="w-1.5 h-1.5 rounded-full ${info.tersambung ? 'bg-status-available' : 'bg-error'}"></span>${info.tersambung ? 'Tersambung' : 'Terputus'}</span></div></div>
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between"><span class="font-label-md text-label-md text-on-surface">Kapasitas Google Drive</span><span class="font-body-sm text-body-sm text-on-surface-variant">${info.driveBatas ? `${driveGb(info.driveTerpakai)} / ${driveGb(info.driveBatas)} (${drivePersen}%)` : (info.driveTerpakai !== null && info.driveTerpakai !== undefined ? driveGb(info.driveTerpakai) + ' / Tidak terbatas' : '-')}</span></div>
            <div class="h-2 w-full rounded-full bg-surface-container overflow-hidden"><div class="h-full ${drivePersen > 85 ? 'bg-error' : 'bg-primary-container'} rounded-full" style="width:${Math.max(2, drivePersen)}%"></div></div></div>
          <button type="button" data-aksi="sinkronkan" class="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-surface-subtle hover:bg-surface-container text-primary font-label-md text-label-md transition-colors">${ikon('autorenew', 'text-[18px]')}Bersihkan Cache &amp; Sinkronkan Data</button>
        </div>`, `<span class="w-2.5 h-2.5 rounded-full ${info.tersambung ? 'bg-status-available' : 'bg-error'} mt-2"></span>`)}
    </div>
  </div>
  </form>
  <div class="fixed bottom-0 left-0 lg:left-[240px] right-0 z-30 bg-surface-page/95 shadow-[0_-4px_16px_rgba(10,37,64,0.08)] px-space-md lg:px-space-lg py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
    <span class="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">${ikon('check_circle', 'text-[18px] text-status-available')}<span id="set-status">${S.kotor ? 'Ada perubahan yang belum disimpan' : 'Terakhir disimpan: <strong class="text-on-surface">' + (S.adm.set.terakhir ? fHariIni(S.adm.set.terakhir) : '—') + '</strong>'}</span></span>
    <div class="flex items-center gap-3 w-full sm:w-auto">
      <button type="button" data-aksi="set-reset" class="${KELAS.tombolKedua} flex-1 sm:flex-none">Reset ke Default</button>
      <button type="submit" form="form-pengaturan" class="${KELAS.tombolUtama} flex-1 sm:flex-none">${ikon('save', 'text-[18px]')}<span>Simpan Semua Pengaturan</span></button>
    </div>
  </div>`;
  if (param && param.fokus === 'keamanan') {
    param.fokus = '';
    setTimeout(() => {
      const k = $('#kartu-keamanan');
      if (k) { k.scrollIntoView({ behavior: 'smooth', block: 'start' }); k.classList.add('ring-2', 'ring-primary-container'); }
      const i = $('#set-sandi-lama');
      if (i) i.focus({ preventScroll: true });
    }, 80);
  }
};

function htmlPratinjauPeta(peta, koordinat) {
  const m = /(-?\d+(?:\.\d+)?)\D+?(-?\d+(?:\.\d+)?)/.exec(String(koordinat || ''));
  const link = m ? 'https:\/\/www.google.com/maps?q=' + m[1] + ',' + m[2] : 'https:\/\/www.google.com/maps';
  if (!peta && m) peta = urlPeta({ koordinat: { lat: m[1], lng: m[2] } });
  return (peta
    ? `<div class="bingkai-media absolute inset-0"><iframe src="${esc(peta)}" title="Pratinjau peta" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`
    : `<div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-outline">${ikon('map', 'text-[48px]')}<span class="font-body-sm text-body-sm">Tempel kode embed Google Maps untuk melihat pratinjau</span></div>`) +
    `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer" class="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-page text-primary font-label-md text-body-sm shadow-md">Buka Peta Besar${ikon('open_in_new', 'text-[16px]')}</a>`;
}

function tandaiSetKotor() {
  S.kotor = JSON.stringify(S.adm.set.data) !== S.adm.set.simpan;
  const st = $('#set-status');
  if (st) st.innerHTML = S.kotor ? 'Ada perubahan yang belum disimpan' : 'Terakhir disimpan: <strong class="text-on-surface">' + (S.adm.set.terakhir ? fHariIni(S.adm.set.terakhir) : '—') + '</strong>';
}

MASUKAN.set = el => {
  S.adm.set.data[el.dataset.kunci] = el.value;
  tandaiSetKotor();
  if (el.dataset.kunci === 'MAPS_EMBED_URL' || el.dataset.kunci === 'KOORDINAT') {
    const wadah = $('#set-pratinjau-peta');
    const peta = srcPeta(S.adm.set.data.MAPS_EMBED_URL);
    if (wadah && wadah.dataset.peta !== peta + '|' + S.adm.set.data.KOORDINAT) {
      wadah.dataset.peta = peta + '|' + S.adm.set.data.KOORDINAT;
      wadah.innerHTML = htmlPratinjauPeta(peta, S.adm.set.data.KOORDINAT);
    }
  }
};

UBAH['set-jadwal'] = el => {
  const j = S.adm.set.data[el.dataset.hari];
  if (el.dataset.f === 'aktif') j.aktif = el.checked; else j[el.dataset.f] = el.value;
  tandaiSetKotor();
  if (el.dataset.f === 'aktif') RENDER['admin-pengaturan']($('#hal-admin-pengaturan'), {});
};

MASUKAN['set-kekuatan'] = el => {
  const k = kekuatanSandi(el.value);
  const bar = $('#set-kekuatan-bar');
  const lab = $('#set-kekuatan-label');
  bar.className = 'h-full transition-all ' + k.warna;
  bar.style.width = (k.skor / 4 * 100) + '%';
  lab.className = 'font-body-sm text-[11px] ' + (k.teks || '');
  lab.textContent = k.label ? 'Kekuatan Kata Sandi: ' + k.label : '';
};

AKSI['set-reset'] = async () => {
  if (S.kotor && !(await konfirmasi({ judul: 'Kembalikan isian?', pesan: 'Isian formulir dikembalikan ke nilai terakhir yang tersimpan. Data tidak dihapus.', ok: 'Kembalikan' }))) return;
  S.kotor = false;
  S.adm.set = null;
  RENDER['admin-pengaturan']($('#hal-admin-pengaturan'), {});
  toast('Isian dikembalikan', 'Formulir memakai nilai tersimpan terakhir.', 'info');
};

KIRIM.pengaturan = async form => {
  const f = S.adm.set.data;
  const galat = {};
  const wa = String(f.WA).replace(/\D/g, '').replace(/^0/, '').replace(/^62/, '');
  if (!/^8\d{7,12}$/.test(wa)) galat.WA_ADMIN = 'Nomor WhatsApp admin wajib valid.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.EMAIL_PUBLIK)) galat.EMAIL_PUBLIK = 'Format email tidak valid.';
  const m = /(-?\d+(?:\.\d+)?)\D+?(-?\d+(?:\.\d+)?)/.exec(f.KOORDINAT);
  if (!m || Math.abs(Number(m[1])) > 90 || Math.abs(Number(m[2])) > 180) galat.KOORDINAT = 'Koordinat tidak valid (contoh: Lat: -7.7601, Long: 110.3953).';
  if (f.MAPS_EMBED_URL.trim() && !srcPeta(f.MAPS_EMBED_URL)) galat.MAPS_EMBED_URL = 'Kode embed harus dari Google Maps (https:\/\/www.google.com/maps/embed?…).';
  ['sj', 'sa', 'mg'].forEach(h => { if (!/^\d{2}:\d{2}$/.test(f[h].buka) || !/^\d{2}:\d{2}$/.test(f[h].tutup) || !(f[h].tutup > f[h].buka)) galat.JADWAL = 'Jam tutup harus setelah jam buka.'; });
  if (!f.VISI.trim()) galat.VISI = 'Visi wajib diisi.';
  if (!f.MISI.trim()) galat.MISI = 'Isi minimal 1 poin misi.';
  if (!f.ALAMAT.trim()) galat.ALAMAT = 'Alamat wajib diisi.';
  if (Object.keys(galat).length) { aturGalatKolom(form, galat); return; }
  aturGalatKolom(form, null);
  const tombol = $('[form=form-pengaturan][type=submit]');
  tombolSibuk(tombol, true, 'Menyimpan...');
  try {
    const r = await panggil('adminSimpanPengaturan', tokenAdmin(), {
      VISI: f.VISI, MISI: f.MISI, WA_ADMIN: '62' + wa, WA_PESAN_DEFAULT: f.WA_PESAN_DEFAULT, EMAIL_PUBLIK: f.EMAIL_PUBLIK,
      ALAMAT: f.ALAMAT, KOORDINAT: m[1] + ',' + m[2], MAPS_EMBED_URL: f.MAPS_EMBED_URL,
      JADWAL_SENIN_JUMAT: f.sj, JADWAL_SABTU: f.sa, JADWAL_MINGGU: f.mg
    });
    S.adm.data.pengaturan = r.pengaturan;
    S.kotor = false;
    S.adm.set = { terakhir: r.terakhirDisimpan };
    S.json = {};
    RENDER['admin-pengaturan']($('#hal-admin-pengaturan'), {});
    toast('Pengaturan disimpan', 'Situs publik ikut diperbarui.');
  } catch (e) {
    tombolSibuk(tombol, false);
    if (e.kode === 'VALIDASI' && e.detail) aturGalatKolom(form, e.detail);
    else toastGalat(e, 'Pengaturan gagal disimpan');
  }
};

AKSI['ganti-sandi'] = async el => {
  const lama = $('#set-sandi-lama').value;
  const baru = $('#set-sandi-baru').value;
  const ulang = $('#set-sandi-ulang').value;
  const tampil = (k, pesan) => { const p = $(`[data-galat-sandi=${k}]`); p.textContent = pesan || ''; p.hidden = !pesan; };
  ['lama', 'baru', 'ulang'].forEach(k => tampil(k, ''));
  if (!lama) { tampil('lama', 'Isi kata sandi lama.'); return; }
  if (baru.length < 10 || !/[A-Za-z]/.test(baru) || !/\d/.test(baru)) { tampil('baru', 'Kata sandi minimal 10 karakter berisi huruf dan angka.'); return; }
  if (baru === lama) { tampil('baru', 'Kata sandi baru harus berbeda dari kata sandi lama.'); return; }
  if (baru !== ulang) { tampil('ulang', 'Konfirmasi kata sandi tidak sama.'); return; }
  tombolSibuk(el, true, 'Memperbarui...');
  try {
    const r = await panggil('adminGantiSandi', tokenAdmin(), { sandiLama: lama, sandiBaru: baru });
    simpanSesi({ token: r.token, kedaluwarsa: r.kedaluwarsa, nama: S.sesi.nama, peran: S.sesi.peran }, S.sesi.ingat);
    S.adm.data.info.wajibGanti = false;
    ['lama', 'baru', 'ulang'].forEach(k => { $('#set-sandi-' + k).value = ''; });
    tombolSibuk(el, false);
    RENDER['admin-pengaturan']($('#hal-admin-pengaturan'), {});
    toast('Kata sandi diperbarui', 'Perangkat lain otomatis dikeluarkan.');
  } catch (e) {
    tombolSibuk(el, false);
    if (e.detail && e.detail.sandiLama) tampil('lama', e.detail.sandiLama);
    else if (e.detail && e.detail.sandiBaru) tampil('baru', e.detail.sandiBaru);
    else toastGalat(e, 'Gagal memperbarui kata sandi');
  }
};

// ════════════════════════════════════════════════════════════
// BAGIAN 25: PEMASANGAN EVENT (delegasi tunggal) & INISIALISASI
// ════════════════════════════════════════════════════════════

document.addEventListener('click', e => {
  if (!e.target.closest('#panel-notifikasi, #panel-akun, [data-aksi=buka-notifikasi], [data-aksi=buka-menu-akun]')) tutupPanelTopbar();
  const nav = e.target.closest('[data-nav]');
  if (nav) {
    e.preventDefault();
    const param = Object.assign({}, nav.dataset);
    delete param.nav;
    navigasi(nav.dataset.nav, param);
    return;
  }
  const el = e.target.closest('[data-aksi]');
  if (el && AKSI[el.dataset.aksi]) {
    if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
    AKSI[el.dataset.aksi](el, e);
  }
});

document.addEventListener('input', e => {
  const el = e.target.closest('[data-masukan]');
  if (el && MASUKAN[el.dataset.masukan]) MASUKAN[el.dataset.masukan](el, e);
});

document.addEventListener('change', e => {
  const el = e.target.closest('[data-ubah]');
  if (el && UBAH[el.dataset.ubah]) UBAH[el.dataset.ubah](el, e);
});

document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-kirim]');
  if (!f) return;
  e.preventDefault();
  if (KIRIM[f.dataset.kirim]) KIRIM[f.dataset.kirim](f, e);
});

document.addEventListener('keydown', e => {
  const atas = Modal.atas();
  if (e.key === 'Escape') {
    if (atas) { Modal.tutup(atas); return; }
    tutupMenuHp();
    tutupSidebar();
    tutupPanelTopbar();
    return;
  }
  if (atas && e.key === 'ArrowLeft' && atas.tombolKiri) atas.tombolKiri();
  if (atas && e.key === 'ArrowRight' && atas.tombolKanan) atas.tombolKanan();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role=button][data-aksi]')) {
    e.preventDefault();
    e.target.click();
  }
});

// Gambar gagal dimuat → sembunyikan (latar placeholder tetap terlihat)
document.addEventListener('error', e => {
  if (!e.target || e.target.tagName !== 'IMG') return;
  const logo = e.target.closest('#logo-publik');
  if (logo) { logo.innerHTML = logoCadangan(); return; }
  e.target.classList.add('gambar-gagal');
}, true);

// Statistik banner: kirim saat tab disembunyikan & berkala selama di Beranda
document.addEventListener('visibilitychange', () => { if (document.hidden) kirimStatBanner(); });
setInterval(() => { if (S.rute.nama === 'beranda') kirimStatBanner(); }, 120000);

/** Penanda versi frontend — muncul di konsol agar mudah memastikan versi terbaru sudah terpasang */
const VERSI_FRONTEND = '2.2.0';

function mulaiAplikasi() {
  console.info('[Kost AB6] Frontend v' + VERSI_FRONTEND + ' siap');
  $$('.tahun-berjalan').forEach(x => { x.textContent = String(new Date().getFullYear()); });
  muatSesiTersimpan();
  perbaruiKerangkaPublik();
  navigasi('beranda', {}, { paksa: true });
  muatPublik();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulaiAplikasi);
else mulaiAplikasi();
