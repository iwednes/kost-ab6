/* ============================================================
   KOST AB6 — Latar 3D seluruh halaman
   Partikel bergerak dan berubah bentuk sendiri di belakang isi halaman,
   tanpa suara. Kursor membuat butir menghindar; klik membuat riak.
   Objek berputar terus dengan mulus dan ikut berputar saat digulir.
   Bentuknya mengikuti halaman (LatarAB6.bentuk dipanggil dari app.js),
   mulai setelah halaman siap, dan resolusinya turun sendiri bila perangkat kewalahan.
   Bila gagal dimuat, website tetap berjalan seperti biasa.
   ============================================================ */
(function () {
  var kanvas = document.getElementById('latar3d');
  if (!kanvas) return;
  // Mode hemat data atau perangkat sangat terbatas: website tampil tanpa latar 3D.
  if ((navigator.connection && navigator.connection.saveData) || (navigator.deviceMemory && navigator.deviceMemory <= 2)) return;

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js';   // versi yang sama dengan cover, jadi sudah tersimpan di browser
  var TAHAN = 6, MORF = 2.2;   // detik diam pada satu bentuk; detik perpindahan bentuk
  var JEDA_MULAI = 1200;       // ms setelah halaman siap, supaya tampilan awal tidak terganggu
  var LAJU_PUTAR = 0.6;        // radian per detik: satu putaran penuh sekitar 10 detik
  var PUTAR_GULIR = 0.0006;    // tambahan putaran per piksel digulir

  // Bentuk pembuka tiap halaman: 0 gedung, 1 kunci, 2 kasur, 3 meja, 4 wifi, 5 pintu, 6 tulisan.
  var BENTUK_HALAMAN = { beranda: 0, kamar: 2, detail: 3, testimoni: 5, tentang: 6, login: 1 };
  var rute = 'beranda', gantiBentuk = null;

  function muatSkrip(src, lalu) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = lalu;
    document.head.appendChild(s);
  }
  function mulai() { muatSkrip(THREE_URL, function () { muatSkrip('js/bentuk3d.js', bangun); }); }
  function saatLuang() {
    setTimeout(function () {
      if (window.requestIdleCallback) requestIdleCallback(mulai, { timeout: 2000 });
      else mulai();
    }, JEDA_MULAI);
  }

  window.LatarAB6 = {
    bentuk: function (nama) {
      rute = nama;
      if (gantiBentuk) gantiBentuk(nama);
    }
  };
  if (document.readyState === 'complete') saatLuang();
  else window.addEventListener('load', saatLuang);

  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function bangun() {
    var diam = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var A;
    try {
      A = AB63D.buatAdegan(kanvas, {
        pelangi: false, diam: diam, kuat: false, lembut: 0.42, lembutCincin: 0.6, dorong: 0.3, jangkau: 0.85, riak: true, cahaya: 0, tintMaks: 0.62
      });
    } catch (e) { return; }

    var bentuk = [], dari = 0, ke = 0, mulaiMorf = -1, gantiPada = TAHAN, antre = null, waktu = 0;
    var TULISAN = AB63D.JUMLAH - 1, putaran = AB63D.buatPutaran(LAJU_PUTAR);

    function pindahKe(k) {                     // mulai perpindahan bentuk; bentuk yang belum siap dilewati dulu
      if (k === ke || !bentuk[k]) return;
      if (mulaiMorf >= 0) { antre = k; return; }
      dari = ke; ke = k;
      A.pasang(bentuk[dari], bentuk[ke]);
      mulaiMorf = waktu;
      gantiPada = waktu + MORF + TAHAN;
    }
    function tampilkanLangsung(k) {            // gerak minimal: tanpa perpindahan, satu gambar saja
      dari = ke = k;
      A.pasang(bentuk[k], bentuk[k]);
      A.group.rotation.set(0.16, 0, 0);
      A.perbarui(0, 0, 1, 0);
      A.gambar();
      kanvas.classList.add('siap');
    }

    /* ---------- Tata letak: objek di sisi kanan layar lebar, di tengah pada ponsel ---------- */
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5), lebarLalu = 0, tinggiLalu = 0;
    function tata(paksa) {
      var W = window.innerWidth, H = window.innerHeight;
      // bilah alamat ponsel mengubah tinggi saat menggulir: abaikan supaya tidak mengukur ulang terus
      if (!paksa && W === lebarLalu && Math.abs(H - tinggiLalu) < 120) return;
      lebarLalu = W; tinggiLalu = H;
      var aspek = W / H, R = 2.15, lebar = W >= 960, jarak, x, y;
      if (lebar) {
        jarak = R * 1.5 / A.tanH;
        var hh = jarak * A.tanH;
        x = hh * aspek * 0.42; y = -0.02 * hh;
      } else {
        jarak = Math.max(R * 1.12 / (A.tanH * aspek), R * 1.6 / A.tanH);
        x = 0; y = 0.1 * jarak * A.tanH;
      }
      A.ukur(W, H, dpr, jarak);
      A.tempatkan(x, y, lebar ? 0 : 0.2);
    }
    tata(true);
    window.addEventListener('resize', function () {
      tata(false);
      if (diam && bentuk[ke]) tampilkanLangsung(ke);
    });
    var jagaMulus = AB63D.penjagaMulus(function () { return dpr; }, function (v) { dpr = v; tata(true); }, 24);

    /* ---------- Putaran utama ---------- */
    var lalu = performance.now();
    function bingkai(now) {
      requestAnimationFrame(bingkai);
      if (document.body.classList.contains('modal-terbuka') && kanvas.classList.contains('siap')) { lalu = now; return; }   // tertutup jendela modal
      var ms = now - lalu;
      lalu = now;
      jagaMulus(ms);
      var dt = Math.min(0.1, ms / 1000);
      waktu += dt;

      var prog = 1;
      if (mulaiMorf >= 0) {
        if ((waktu - mulaiMorf) / MORF >= 1) {
          mulaiMorf = -1;
          if (antre !== null) { var k = antre; antre = null; pindahKe(k); }
        }
        prog = mulaiMorf >= 0 ? easeInOut(Math.min(1, Math.max(0, (waktu - mulaiMorf) / MORF))) : 1;
      } else if (waktu >= gantiPada) {
        var berikut = (ke + 1) % AB63D.JUMLAH;
        if (bentuk[berikut]) pindahKe(berikut); else gantiPada = waktu + 1;
        prog = mulaiMorf >= 0 ? 0 : 1;
      }

      A.perbarui(dt, waktu, prog, 0);
      A.group.rotation.y = putaran.hitung(dt, ke === TULISAN && mulaiMorf >= 0, ke === TULISAN && mulaiMorf < 0, prog);
      A.group.rotation.x = 0.16 + Math.sin(waktu * 0.23) * 0.04;
      A.gambar();
      kanvas.classList.add('siap');
    }
    function bentukHalaman(nama) {
      var k = BENTUK_HALAMAN[nama];
      if (k === undefined || !bentuk[k]) return;
      if (diam) tampilkanLangsung(k); else pindahKe(k);
    }

    var gulirLalu = window.scrollY;
    window.addEventListener('scroll', function () {
      if (ke !== TULISAN) putaran.tambah((window.scrollY - gulirLalu) * PUTAR_GULIR);
      gulirLalu = window.scrollY;
    }, { passive: true });
    AB63D.muatBentuk(function (k, s) {
      bentuk[k] = s;
      if (k === 0) {
        A.pasang(s, s);
        gantiBentuk = bentukHalaman;
        if (diam) tampilkanLangsung(0); else requestAnimationFrame(bingkai);
      }
      if (k === BENTUK_HALAMAN[rute]) bentukHalaman(rute);
    }, { gedung: true });
  }
})();
