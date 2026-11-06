/* ============================================================
   KOST AB6 — Kunang-kunang Beranda
   Bola cahaya melayang ke kanan-kiri, berkelip, punya kedalaman 3D, dan menghindar
   dari kursor. Di banner gelap menyala hijau kekuningan seperti kunang-kunang asli;
   di latar hijau sage berpendar krem muda.
   Hanya berjalan selama Beranda terbuka (KunangAB6.aktif dipanggil dari app.js).
   Bidang yang tidak tampak dilewati, dan jumlah bola turun sendiri bila perangkat
   kewalahan. Canvas 2D supaya ringan.
   ============================================================ */
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (navigator.connection && navigator.connection.saveData) return;
  var latar3d = document.getElementById('latar3d');
  if (!latar3d) return;

  var kecil = window.innerWidth < 760;
  var JANGKAU = 150;                 // px: jarak kursor mulai mendorong bola
  var LONCAT_GULIR = 240;            // px per bingkai: lompatan sebesar ini tidak dihitung sebagai digulir

  /* Satu gambar pendar dipakai ulang oleh semua bola: jauh lebih ringan daripada membuat gradasi tiap frame. */
  function pendar(warnaTengah, warnaTepi, kuat) {
    var c = document.createElement('canvas'), g = c.getContext('2d'), r = 64;
    c.width = c.height = r * 2;
    var gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, 'rgba(' + warnaTengah + ',1)');
    gr.addColorStop(0.09, 'rgba(' + warnaTengah + ',0.95)');
    gr.addColorStop(0.2, 'rgba(' + warnaTepi + ',' + 0.6 * kuat + ')');
    gr.addColorStop(0.5, 'rgba(' + warnaTepi + ',' + 0.17 * kuat + ')');
    gr.addColorStop(1, 'rgba(' + warnaTepi + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, r * 2, r * 2);
    return c;
  }
  var SINAR_GELAP = [pendar('247,255,214', '196,236,120', 1), pendar('240,255,230', '132,226,168', 1), pendar('255,250,222', '239,201,138', 1)];
  var SINAR_SAGE = [pendar('255,255,236', '240,250,206', 1), pendar('255,255,244', '226,246,214', 0.95)];

  function acak(a, b) { return a + Math.random() * (b - a); }

  function buatBola(L, sinar) {
    var z = Math.random();           // kedalaman: 0 jauh, 1 dekat; yang dekat lebih besar dan lebih cepat
    return {
      x: acak(0, L.w), y: acak(0, L.h), z: z, ukur: L.ukur[0] + z * z * L.ukur[1],
      laju: (Math.random() < 0.5 ? -1 : 1) * (8 + z * 26),
      a1: acak(18, 60), f1: acak(0.25, 0.7), p1: acak(0, 6.3),
      a2: acak(12, 42), f2: acak(0.3, 0.8), p2: acak(0, 6.3),
      kedip: acak(0.5, 1.5), p3: acak(0, 6.3), dx: 0, dy: 0,
      gbr: sinar[Math.floor(Math.random() * sinar.length)]
    };
  }

  function buatLapisan(kanvas, opsi) {
    var L = { kanvas: kanvas, ctx: kanvas.getContext('2d'), w: 1, h: 1, x: 0, y: 0, dpr: 1, tampak: true, perluUkur: true,
      tambah: opsi.tambah, ukur: opsi.ukur, gulir: opsi.gulir, bola: [], debu: [] };
    L.ukurUlang = function () {
      var r = kanvas.getBoundingClientRect();
      L.x = r.left; L.y = r.top;
      if (!r.width || !r.height || (r.width === L.w && r.height === L.h)) return;
      var sx = r.width / L.w, sy = r.height / L.h;   // bola ikut menyebar saat ukuran kanvas berubah
      L.bola.concat(L.debu).forEach(function (b) { b.x *= sx; b.y *= sy; });
      L.w = r.width; L.h = r.height;
      L.dpr = Math.min(window.devicePixelRatio || 1, opsi.dpr);
      kanvas.width = Math.round(L.w * L.dpr);
      kanvas.height = Math.round(L.h * L.dpr);
    };
    for (var i = 0; i < opsi.bola; i++) L.bola.push(buatBola(L, opsi.sinar));
    for (var j = 0; j < opsi.debu; j++) L.debu.push({ x: acak(0, L.w), y: acak(0, L.h), r: acak(0.5, 1.6), laju: acak(-7, 7), a: acak(0.15, 0.6), p: acak(0, 6.3) });
    return L;
  }

  function buatKanvas(kelas) {
    var c = document.createElement('canvas');
    c.className = kelas;
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  /* Bidang gelap hanya digambar selama benar-benar tampak di layar. */
  function pantau(L, bidang) {
    var io = null, ro = null;
    if (window.IntersectionObserver) {
      L.tampak = false;
      io = new IntersectionObserver(function (e) { L.tampak = e[e.length - 1].isIntersecting; });
      io.observe(bidang);
    }
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { L.perluUkur = true; });
      ro.observe(L.kanvas);
    }
    L.lepas = function () { if (io) io.disconnect(); if (ro) ro.disconnect(); };
    return L;
  }

  var kanvasLatar = buatKanvas('kunang-latar');
  latar3d.parentNode.insertBefore(kanvasLatar, latar3d.nextSibling);   // tepat di atas latar 3D, di bawah isi halaman
  var lapisan = [buatLapisan(kanvasLatar, { tambah: false, ukur: [9, 26], gulir: true, dpr: 1, bola: kecil ? 36 : 70, debu: 0, sinar: SINAR_SAGE })];

  /* Banner digambar ulang setiap datanya berubah, jadi kanvasnya dipasang dari app.js sesudah digambar. */
  var hero = null;
  function pasangBanner(banner) {
    if (hero) { hero.lepas(); lapisan.splice(lapisan.indexOf(hero), 1); hero = null; }
    if (!banner) return;
    var kanvasHero = buatKanvas('kunang-hero');
    banner.appendChild(kanvasHero);
    hero = pantau(buatLapisan(kanvasHero, { tambah: true, ukur: [10, 40], gulir: false, dpr: 1.5, bola: kecil ? 60 : 120, debu: kecil ? 110 : 260, sinar: SINAR_GELAP }), banner);
    lapisan.push(hero);
  }

  /* ---------- Kursor: bola menghindar, seluruh lapisan sedikit bergeser mengikuti (terasa 3D) ---------- */
  var kx = -9999, ky = -9999, geserX = 0, geserY = 0, geserTX = 0, geserTY = 0;
  window.addEventListener('pointermove', function (e) {
    kx = e.clientX; ky = e.clientY;
    geserTX = kx / window.innerWidth - 0.5;
    geserTY = ky / window.innerHeight - 0.5;
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {       // klik: bola di sekitarnya terhambur
    lapisan.forEach(function (L) {
      if (!L.tampak) return;
      L.bola.forEach(function (b) {
        if (b.px === undefined) return;                       // belum pernah digambar
        var ax = b.px - (e.clientX - L.x), ay = b.py - (e.clientY - L.y), d = Math.sqrt(ax * ax + ay * ay) || 1;
        if (d < JANGKAU * 2) { var k = (1 - d / (JANGKAU * 2)) * 340; b.dx += ax / d * k; b.dy += ay / d * k; }
      });
    });
  }, { passive: true });
  window.addEventListener('resize', function () { lapisan.forEach(function (L) { L.perluUkur = true; }); });
  window.addEventListener('scroll', function () { if (hero) hero.perluUkur = true; }, { passive: true });

  /* Jumlah yang digulir dihitung sendiri, supaya lompatan besar tidak membuat bola meloncat. */
  var gulirLalu = window.scrollY, gulirTotal = 0;
  function hitungGulir() {
    var sy = window.scrollY, beda = sy - gulirLalu;
    gulirLalu = sy;
    if (Math.abs(beda) < LONCAT_GULIR) gulirTotal += beda;
  }

  /* Perangkat kewalahan: gambar lebih sedikit bola supaya tetap mulus, lalu naik lagi saat sudah lega. */
  var porsi = 1, rataMs = 16;
  function jagaMulus(ms, waktu) {
    if (ms > 250) return;                 // tab baru kembali dari latar belakang
    rataMs += (ms - rataMs) * 0.05;
    if (waktu < 3) return;                // abaikan detik-detik awal saat halaman masih memuat
    if (rataMs > 26 && porsi > 0.4) { porsi = Math.max(0.4, porsi - 0.15); rataMs = 18; }
    else if (rataMs < 18 && porsi < 1) porsi = Math.min(1, porsi + 0.001);
  }

  /* ---------- Gambar ---------- */
  function gambarLapisan(L, t, dt) {
    var g = L.ctx, w = L.w, h = L.h, gulir = L.gulir ? gulirTotal : 0;
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = L.tambah ? 'lighter' : 'source-over';
    var i, b, nDebu = Math.ceil(L.debu.length * porsi), nBola = Math.ceil(L.bola.length * porsi);
    g.fillStyle = 'rgba(232,250,214,1)';
    for (i = 0; i < nDebu; i++) {
      b = L.debu[i];
      b.x += b.laju * dt;
      if (b.x < 0) b.x += w; else if (b.x > w) b.x -= w;
      g.globalAlpha = b.a * (0.55 + 0.45 * Math.sin(t * 0.9 + b.p));
      g.fillRect(b.x, b.y, b.r, b.r);
    }
    var redam = Math.exp(-dt * 2.2), batas = 90;
    for (i = 0; i < nBola; i++) {
      b = L.bola[i];
      b.x += b.laju * dt;                                     // bergerak ke kanan atau kiri, lalu muncul lagi di sisi lain
      if (b.x < -batas) b.x += w + batas * 2; else if (b.x > w + batas) b.x -= w + batas * 2;
      var x = b.x + Math.sin(t * b.f1 + b.p1) * b.a1 + geserX * b.z * 46 + b.dx;
      var y = b.y + Math.sin(t * b.f2 + b.p2) * b.a2 + geserY * b.z * 30 + b.dy - gulir * (0.06 + b.z * 0.22);
      y = ((y % (h + batas * 2)) + h + batas * 2) % (h + batas * 2) - batas;
      b.px = x; b.py = y;
      var ax = x - (kx - L.x), ay = y - (ky - L.y), d = Math.sqrt(ax * ax + ay * ay) || 1;
      if (d < JANGKAU) { var k = (1 - d / JANGKAU) * 900 * dt; b.dx += ax / d * k; b.dy += ay / d * k; }
      b.dx *= redam; b.dy *= redam;
      var nyala = 0.32 + 0.68 * Math.pow(0.5 + 0.5 * Math.sin(t * b.kedip + b.p3), 2);
      var s = b.ukur * (1.7 + 0.5 * nyala) * 2;
      g.globalAlpha = nyala * (0.55 + 0.45 * b.z);
      g.drawImage(b.gbr, x - s / 2, y - s / 2, s, s);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  var lalu = performance.now(), waktu = 0, nyala = false, berjalan = false;
  function langkah(now) {
    if (!nyala) { berjalan = false; return; }
    requestAnimationFrame(langkah);
    var ms = now - lalu, dt = Math.min(0.05, ms / 1000);
    lalu = now;
    waktu += dt;
    jagaMulus(ms, waktu);
    hitungGulir();
    geserX += (geserTX - geserX) * (1 - Math.exp(-dt * 3));
    geserY += (geserTY - geserY) * (1 - Math.exp(-dt * 3));
    for (var i = 0; i < lapisan.length; i++) {
      var L = lapisan[i];
      if (!L.tampak) continue;
      if (L.perluUkur) { L.perluUkur = false; L.ukurUlang(); }
      if (L.w > 1) gambarLapisan(L, waktu, dt);
    }
  }

  window.KunangAB6 = {
    pasangBanner: pasangBanner,
    aktif: function (on) {
      nyala = on;
      if (!on || berjalan) return;
      berjalan = true;
      lapisan.forEach(function (L) { L.perluUkur = true; });
      lalu = performance.now();
      gulirLalu = window.scrollY;
      requestAnimationFrame(langkah);
    }
  };
})();
