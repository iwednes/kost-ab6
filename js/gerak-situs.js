/* ============================================================
   KOST AB6 — Gerak seluruh situs (mengikuti website Mixmax Souvenir)
   - header muncul bertahap, tersembunyi saat digulir turun, kembali saat digulir naik
   - menu samping layar penuh: panel geser dari kanan, garis tergambar, label naik
   - tombol: isi menyapu miring, ikon menembus keluar-masuk, tertarik ke kursor
   - Beranda: hero layar penuh (zoom 1.24 → 1.1), kolom bergaris, testimoni satu per satu
   - halaman lain: kepala dengan aksen besar dan judul per baris, foto terbuka dari bawah
   - footer: isi muncul berurutan, nama usaha besar muncul huruf demi huruf
   - gulir halus Lenis di halaman publik
   app.js memanggil GerakAB6.halaman(nama) setiap halaman tampil atau digambar ulang.
   Bila GSAP gagal dimuat atau pengunjung memilih "kurangi gerakan", tampilan tetap
   utuh tanpa animasi.
   ============================================================ */
(function () {
  'use strict';
  var publik = document.getElementById('lapisan-publik');
  var hdr = document.querySelector('#lapisan-publik .hdr');
  if (!publik || !hdr) return;

  var g = window.gsap, ST = window.ScrollTrigger, Split = window.SplitText, LenisKelas = window.Lenis;
  var reduksi = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var halus = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
  var gerak = !!(g && ST && Split) && !reduksi;
  if (gerak) g.registerPlugin(ST, Split);

  var BERSIH = 'opacity,visibility,transform';
  var rute = null, token = 0, lenis = null, rafLenis = null, menuBuka = false;
  var grup = [];

  /* ---------- Alat bantu ---------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function arr(x) { return Array.prototype.slice.call(x || []); }
  function ada(x) { return !!x; }
  function buat(tag, kelas, html) { var e = document.createElement(tag); if (kelas) e.className = kelas; if (html !== undefined) e.innerHTML = html; return e; }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function simpan(x) { grup.push(x); return x; }
  function bunuhSemua() { grup.forEach(function (t) { if (t && t.kill) t.kill(); }); grup = []; }
  function jeda(fn, ms) { var t = null; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function siapFont(fn) {
    var sudah = false;
    function sekali() { if (!sudah) { sudah = true; fn(); } }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sekali, sekali); else sekali();
    setTimeout(sekali, 1500);
  }
  function garisAtas(el) {
    var r = el.querySelector(':scope > .gs-garis');
    if (!r) { r = buat('span', 'gs-garis'); r.setAttribute('aria-hidden', 'true'); el.insertBefore(r, el.firstChild); }
    return r;
  }
  function isiItem(el) {
    return arr(el.children).filter(function (x) { return !x.classList.contains('gs-garis') && getComputedStyle(x).display !== 'none'; });
  }

  /* Judul terbuka baris demi baris dari balik topeng. */
  function lepasSplit(el) {
    if (!el || !el._gsSplit) return;
    g.killTweensOf(el._gsSplit.lines);
    el._gsSplit.revert();
    el._gsSplit = null;
  }
  function baris(tl, el, pos) {
    if (!el) return;
    lepasSplit(el);
    var s = Split.create(el, { type: 'lines', mask: 'lines', linesClass: 'gs-baris' });
    el._gsSplit = s;
    var masks = (s.masks && s.masks.length) ? s.masks : s.lines.map(function (l) { return l.parentNode; });
    masks.forEach(function (m) { m.style.paddingBottom = '0.12em'; m.style.marginBottom = '-0.12em'; });
    g.set(s.lines, { yPercent: 115, willChange: 'transform' });
    tl.set(el, { autoAlpha: 1, y: 0 }, pos);
    tl.to(s.lines, {
      yPercent: 0, duration: 1.1, stagger: 0.08, ease: 'power3.out',
      onComplete: function () { if (el._gsSplit === s) { lepasSplit(el); g.set(el, { clearProps: BERSIH }); } }
    }, pos);
  }
  function tlGulir(trigger, start) {
    return simpan(g.timeline({ scrollTrigger: { trigger: trigger, start: start || 'top bottom-=15%' }, defaults: { ease: 'power3.out' } }));
  }
  function naikSembunyi(els, y) { els = els.filter(ada); if (els.length) g.set(els, { autoAlpha: 0, y: y || 16 }); }

  /* ---------- Gulir halus (Lenis) di halaman publik ---------- */
  function adaModal() { var m = document.getElementById('akar-modal'); return !!(m && m.children.length); }
  function aturLenis() {
    if (!gerak || !LenisKelas) return;
    var boleh = !publik.hidden && !menuBuka && !adaModal();
    if (boleh && !lenis) {
      try { lenis = new LenisKelas({ autoRaf: false, anchors: false }); } catch (e) { lenis = null; return; }
      lenis.on('scroll', ST.update);
      rafLenis = function (t) { if (lenis) lenis.raf(t * 1000); };
      g.ticker.add(rafLenis);
      g.ticker.lagSmoothing(0);
    } else if (!boleh && lenis) {
      g.ticker.remove(rafLenis);
      lenis.destroy();
      lenis = null;
    }
  }

  /* ---------- Header ---------- */
  function ukurHeader() { document.body.style.setProperty('--gs-hdr-h', hdr.offsetHeight + 'px'); }
  function tampilkanHeader(langsung) {
    if (!g) return;
    if (langsung || !gerak) g.set(hdr, { y: 0, overwrite: true });
    else g.to(hdr, { y: 0, duration: 0.65, ease: 'expo.out', overwrite: true });
  }
  function heroAktif() {
    var h = document.getElementById('hero-slider');
    return rute === 'beranda' && !publik.hidden && h && h.offsetParent !== null ? h : null;
  }
  function keadaanHeader() {
    var h = heroAktif();
    document.body.classList.toggle('gs-ada-hero', !!h);
    document.body.classList.toggle('gs-hdr-gelap', !!h && !menuBuka && window.scrollY < h.offsetHeight - hdr.offsetHeight);
  }
  function siapHeader() {
    var item = [$('.brand', hdr)].concat($$('.nav > a', hdr), $$('.hdr-aksi > *', hdr)).filter(ada);
    item.forEach(function (el, i) { el.setAttribute('data-gs-i', ''); el.style.setProperty('--gs-i', i); });
    if (!reduksi) {
      document.body.classList.add('gs-intro');
      setTimeout(function () { document.body.classList.remove('gs-intro'); }, 2600);
    }
    ukurHeader();
    window.addEventListener('resize', jeda(function () { ukurHeader(); keadaanHeader(); }, 120));
    var lalu = window.scrollY, akum = 0, tampil = true;
    window.addEventListener('scroll', function () {
      var y = window.scrollY, d = y - lalu;
      lalu = y;
      keadaanHeader();
      if (!gerak || !d || menuBuka || publik.hidden) return;
      akum = (d > 0) === (akum > 0) ? akum + d : d;
      if (d > 0) {
        var h = hdr.offsetHeight;
        var kini = Math.min(-(g.getProperty(hdr, 'y') || 0) + d, h);
        g.set(hdr, { y: -kini, overwrite: true });
        tampil = kini === 0;
      } else if (!tampil && akum < -12) {
        tampil = true;
        tampilkanHeader(false);
      }
    }, { passive: true });
    hdr.addEventListener('focusin', function () { tampil = true; tampilkanHeader(false); });
  }

  /* ---------- Menu samping layar penuh ---------- */
  var menu = null;
  var DAFTAR_MENU = [['beranda', 'Beranda'], ['kamar', 'Kamar'], ['testimoni', 'Testimoni'], ['tentang', 'Tentang Kami']];
  function siapMenu() {
    var burger = $('[data-aksi=buka-menu-hp]');
    if (!g || !burger) return;
    var latar = buat('div', 'gs-menu-latar');
    latar.setAttribute('aria-hidden', 'true');
    var el = buat('div', 'gs-menu');
    el.id = 'gsMenu';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Menu utama');
    function baris1(atr, label) {
      return '<li class="gs-menu-baris"><span class="gs-menu-garis" aria-hidden="true"></span><a href="#" class="gs-menu-link"' + atr + '><span class="gs-menu-topeng"><span class="gs-menu-label">' + esc(label) + '</span></span>' +
        '<span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a></li>';
    }
    el.innerHTML = '<div class="gs-menu-dalam"><div class="gs-menu-atas"><span class="gs-menu-logo">Kost AB6</span>' +
      '<button type="button" class="gs-menu-tutup" aria-label="Tutup menu"><span class="material-symbols-outlined" aria-hidden="true">close</span></button></div>' +
      '<ul class="gs-menu-daftar">' + DAFTAR_MENU.map(function (m) { return baris1(' data-nav="' + m[0] + '" data-gs-nav="' + m[0] + '"', m[1]); }).join('') +
      baris1(' data-aksi="ke-admin"', 'Masuk Admin') + '<li class="gs-menu-garis-akhir" aria-hidden="true"><span class="gs-menu-garis"></span></li></ul>' +
      '<div class="gs-menu-kaki"></div></div>';
    document.body.appendChild(latar);
    document.body.appendChild(el);
    burger.setAttribute('aria-controls', 'gsMenu');

    var dalam = $('.gs-menu-dalam', el), logo = $('.gs-menu-logo', el), tutup = $('.gs-menu-tutup', el), kaki = $('.gs-menu-kaki', el);
    var garis = $$('.gs-menu-garis', el), label = $$('.gs-menu-label', el), panah = $$('.gs-menu-link > .material-symbols-outlined', el);
    g.set(el, { xPercent: 100 });
    var tl;
    if (!gerak) {
      tl = g.timeline({ paused: true }).to(el, { autoAlpha: 1, xPercent: 0, duration: 0.01 }, 0).to(latar, { autoAlpha: 1, duration: 0.01 }, 0);
    } else {
      g.set(dalam, { xPercent: 14 });
      g.set([logo, kaki], { autoAlpha: 0, y: -12 });
      g.set(tutup, { autoAlpha: 0, rotate: -90 });
      g.set(panah, { autoAlpha: 0 });
      g.set(garis, { scaleX: 0 });
      g.set(label, { yPercent: 110 });
      tl = g.timeline({ paused: true, defaults: { ease: 'expo.out' } })
        .to(el, { autoAlpha: 1, xPercent: 0, duration: 0.9 }, 0)
        .to(latar, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, 0)
        .to(dalam, { xPercent: 0, duration: 1 }, 0.06)
        .to(logo, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.18)
        .to(tutup, { autoAlpha: 1, rotate: 0, duration: 0.7 }, 0.24)
        .to(garis, { scaleX: 1, duration: 0.8, stagger: 0.05 }, 0.22)
        .to(label, { yPercent: 0, duration: 0.9, stagger: 0.06 }, 0.28)
        .to(panah, { autoAlpha: 1, duration: 0.6, stagger: 0.06 }, 0.34)
        .to(kaki, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.55);
    }
    menu = { el: el, tl: tl, burger: burger, kaki: kaki };
    // Tombol burger membuka menu ini; laci bawaan tetap menjadi cadangan bila GSAP gagal dimuat
    burger.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); bukaMenu(!menuBuka, true); }, true);
    tutup.addEventListener('click', function () { bukaMenu(false, true); });
    latar.addEventListener('click', function () { bukaMenu(false, true); });
    el.addEventListener('click', function (e) { if (e.target.closest('.gs-menu-link')) bukaMenu(false, false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuBuka) bukaMenu(false, true); });
  }
  function isiKakiMenu() {
    menu.kaki.innerHTML = $$('.ftr-kontak > li:not([hidden])').map(function (x) {
      var ik = x.querySelector('svg, .material-symbols-outlined');
      return '<p>' + (ik ? ik.outerHTML : '') + '<span>' + esc(x.textContent.replace(/^(location_on|mail|schedule)/, '').trim()) + '</span></p>';
    }).join('');
  }
  function bukaMenu(buka, kembalikanFokus) {
    if (!menu || buka === menuBuka) return;
    menuBuka = buka;
    document.body.classList.toggle('gs-menu-buka', buka);
    document.documentElement.style.overflow = buka ? 'hidden' : '';
    menu.burger.setAttribute('aria-expanded', String(buka));
    if (buka) {
      isiKakiMenu();
      $$('.gs-menu-link', menu.el).forEach(function (b) {
        var aktif = b.getAttribute('data-gs-nav') === (rute === 'detail' ? 'kamar' : rute);
        b.classList.toggle('aktif', aktif);
        if (aktif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      tampilkanHeader(true);
    }
    menu.tl.timeScale(buka ? 1 : 1.7);
    if (buka) menu.tl.play(); else menu.tl.reverse();
    aturLenis();
    keadaanHeader();
    if (buka) setTimeout(function () { $('.gs-menu-tutup', menu.el).focus(); }, 60);
    else if (kembalikanFokus) menu.burger.focus({ preventScroll: true });
  }

  /* ---------- Tombol tertarik ke kursor ---------- */
  function siapMagnet() {
    if (!gerak || !halus) return;
    var kini = null, pusat = null;
    var PILIH = '#lapisan-publik .btn:not(.btn-ghost):not(.btn-block)';
    function lepas(el) { if (el) g.to(el, { '--gs-mx': '0px', '--gs-my': '0px', duration: 0.9, ease: 'elastic.out(1, 0.45)' }); }
    document.addEventListener('pointermove', function (e) {
      var t = e.target instanceof Element ? e.target.closest(PILIH) : null;
      if (t !== kini) {
        lepas(kini);
        kini = t;
        if (t) {
          if (!t.style.getPropertyValue('--gs-mx')) g.set(t, { '--gs-mx': '0px', '--gs-my': '0px' });
          var r = t.getBoundingClientRect(), cs = getComputedStyle(t);
          pusat = { x: r.left + r.width / 2 - (parseFloat(cs.getPropertyValue('--gs-mx')) || 0), y: r.top + r.height / 2 - (parseFloat(cs.getPropertyValue('--gs-my')) || 0) };
        }
      }
      if (!kini) return;
      var x = g.utils.clamp(-14, 14, (e.clientX - pusat.x) * 0.28);
      var y = g.utils.clamp(-14, 14, (e.clientY - pusat.y) * 0.28);
      g.to(kini, { '--gs-mx': x + 'px', '--gs-my': y + 'px', duration: 0.5, ease: 'power3.out' });
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { lepas(kini); kini = null; });
  }

  /* ---------- Bagian halaman: disembunyikan dulu, lalu muncul saat tergulir ---------- */
  function kepala(el) {
    var k = $('.gs-kepala', el);
    if (!k) return null;
    var kanan = $('.gs-kanan', k);
    return { el: k, aksen: $('.gs-aksen', k), crumb: $('.crumb', k), label: $('.page-head .lbl', k), judul: $('.h1', k), kanan: kanan, head: $('.page-head', k) };
  }
  function sembunyiKepala(k) {
    lepasSplit(k.judul);
    g.set(k.aksen, { clipPath: 'inset(0% 100% 0% 0%)', xPercent: -2, yPercent: 0 });
    naikSembunyi([k.crumb, k.label], 12);
    if (k.judul) g.set(k.judul, { autoAlpha: 0 });
    if (k.kanan) naikSembunyi(arr(k.kanan.children), 16);
  }
  function introKepala(k) {
    var tl = simpan(g.timeline({ defaults: { ease: 'power3.out' } }));
    tl.to(k.aksen, { clipPath: 'inset(0% 0% 0% 0%)', xPercent: 0, duration: 1.8, ease: 'power2.out' }, 0);
    tl.to([k.crumb, k.label].filter(ada), { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, clearProps: BERSIH }, 0.1);
    baris(tl, k.judul, 0.37);
    if (k.kanan) tl.to(arr(k.kanan.children), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.12, clearProps: BERSIH }, 0.6);
    simpan(g.fromTo(k.aksen, { yPercent: 0 }, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: k.head, start: 'top top', end: 'bottom top', scrub: true } }));
  }
  function sembunyiSecHead(sh) {
    var h = sh.querySelector('.h2, .h3');
    lepasSplit(h);
    if (h) g.set(h, { autoAlpha: 0 });
    naikSembunyi(arr(sh.children).filter(function (x) { return x !== h; }), 16);
  }
  function pemicuSecHead(sh) {
    var h = sh.querySelector('.h2, .h3');
    var lain = arr(sh.children).filter(function (x) { return x !== h; });
    var tl = tlGulir(sh);
    if (lain[0]) tl.to(lain[0], { autoAlpha: 1, y: 0, duration: 0.9, clearProps: BERSIH }, 0);
    baris(tl, h, 0.1);
    if (lain.length > 1) tl.to(lain.slice(1), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.1, clearProps: BERSIH }, 0.4);
  }
  function itemKolom(c) { return arr(c.children); }
  function sembunyiKolom(c) {
    itemKolom(c).forEach(function (it) {
      g.set(garisAtas(it), { scaleX: 0 });
      isiItem(it).forEach(function (x) { lepasSplit(x); g.set(x, { autoAlpha: 0, y: 16 }); });
    });
  }
  function pemicuKolom(c) {
    var items = itemKolom(c);
    if (!items.length) return;
    var tl = tlGulir(c);
    items.forEach(function (it, i) {
      var a = 0.1 + i * 0.15;
      tl.to(garisAtas(it), { scaleX: 1, duration: 1.2, ease: 'power2.inOut', clearProps: 'transform' }, a);
      var isi = isiItem(it);
      var judul = isi.filter(function (x) { return x.matches('h3, .visi-teks'); });
      judul.forEach(function (j) { baris(tl, j, a + 0.18); });
      var sisa = isi.filter(function (x) { return judul.indexOf(x) < 0; });
      if (sisa.length) tl.to(sisa, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, clearProps: BERSIH }, a + 0.28);
    });
  }
  /* Panel terbuka dari atas (ajakan, formulir) */
  function sembunyiPanel(p) {
    g.set(p, { clipPath: 'inset(0% 0% 100% 0%)' });
    naikSembunyi(arr(p.children), 16);
  }
  function pemicuPanel(p) {
    tlGulir(p, 'top bottom-=8%')
      .to(p, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power4.out', clearProps: 'clipPath' }, 0)
      .to(arr(p.children), { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, clearProps: BERSIH }, 0.3);
  }
  /* Kartu kamar: foto terbuka dari bawah lalu isinya naik */
  function sembunyiKartu(k) {
    var f = $('.gp-frame', k), img = f && $('img', f), b = $('.pbody', k);
    k.removeAttribute('data-gp-tampil');
    if (f) g.set(f, { clipPath: 'inset(100% 0% 0% 0%)' });
    if (img) g.set(img, { scale: 1.2 });
    if (b) naikSembunyi(arr(b.children), 14);
  }
  function munculKartu(k, jd) {
    var f = $('.gp-frame', k), img = f && $('img', f), b = $('.pbody', k);
    k.setAttribute('data-gp-tampil', '1');
    k.classList.add('gp-masuk');
    var tl = g.timeline({ delay: jd || 0, defaults: { ease: 'power3.out' }, onComplete: function () { k.classList.remove('gp-masuk'); } });
    if (f) tl.to(f, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power3.inOut', clearProps: 'clipPath' }, 0);
    if (img) tl.to(img, { scale: 1, duration: 1.8, ease: 'power2.out', clearProps: 'transform' }, 0);
    if (b) tl.to(arr(b.children), { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07, clearProps: BERSIH }, 0.5);
  }
  function pemicuKartu(kartu) {
    if (!kartu.length) return;
    var b = ST.batch(kartu, { start: 'top bottom', once: true, onEnter: function (els) { els.forEach(function (k, i) { munculKartu(k, i * 0.12); }); } });
    b.forEach(simpan);
  }
  /* Kartu testimoni bergaris */
  function pemicuGarisKartu(kartu) {
    if (!kartu.length) return;
    kartu.forEach(function (c) { g.set(garisAtas(c), { scaleX: 0 }); g.set(isiItem(c), { autoAlpha: 0, y: 14 }); });
    var b = ST.batch(kartu, {
      start: 'top bottom', once: true,
      onEnter: function (els) {
        els.forEach(function (c, i) {
          g.timeline({ delay: i * 0.12, defaults: { ease: 'power3.out' } })
            .to(garisAtas(c), { scaleX: 1, duration: 1, ease: 'power3.inOut', clearProps: 'transform' }, 0)
            .to(isiItem(c), { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.06, clearProps: BERSIH }, 0.2);
        });
      }
    });
    b.forEach(simpan);
  }
  /* Blok umum: naik pelan saat tergulir */
  function pemicuNaik(blok) {
    if (!blok.length) return;
    g.set(blok, { autoAlpha: 0, y: 18 });
    var b = ST.batch(blok, { start: 'top bottom-=6%', once: true, onEnter: function (els) { g.to(els, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', clearProps: BERSIH }); } });
    b.forEach(simpan);
  }

  /* ---------- Beranda: hero ---------- */
  function animasiSlide(s, ganti) {
    $$('.slide-bg, .slide-video', s).forEach(function (bg) { bg.classList.remove('gs-zoom'); void bg.offsetWidth; bg.classList.add('gs-zoom'); });
    if (!gerak) return;
    var kartu = $('.slide-card', s);
    if (!kartu) return;
    var judul = $('.slide-judul', kartu);
    var lain = arr(kartu.children).filter(function (c) { return c !== judul; });
    g.killTweensOf(lain);
    g.set(lain, { autoAlpha: 0, y: 16 });
    if (judul) { lepasSplit(judul); g.set(judul, { autoAlpha: 0 }); }
    siapFont(function () {
      var tl = g.timeline({ defaults: { ease: 'power3.out' }, delay: ganti ? 0.12 : 0.3 });
      if (lain[0] && lain[0].classList.contains('lbl')) tl.to(lain[0], { autoAlpha: 1, y: 0, duration: 0.8, clearProps: BERSIH }, 0);
      baris(tl, judul, 0.1);
      tl.to(lain.filter(function (x) { return !x.classList.contains('lbl'); }), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.14, clearProps: BERSIH }, 0.45);
    });
  }

  /* ---------- Beranda: testimoni satu per satu ---------- */
  var testi = { akar: null, data: [], i: 0, putar: null, diam: false };
  function isiTesti(i) {
    var d = testi.data[i], kutip = $('.gs-testi-kutip', testi.akar), orang = $('.gs-testi-orang', testi.akar);
    if (gerak) lepasSplit(kutip);
    kutip.textContent = '“' + d.isi + '”';
    kutip.classList.toggle('panjang', d.isi.length > 180);
    orang.innerHTML = d.avatar + '<span class="gs-testi-nama"><strong>' + esc(d.nama) + '</strong><span>' + esc(d.sub) + '</span><span class="ttgl">' + esc(d.tgl) + '</span></span>';
  }
  function tampilTesti(i, arah, animasi) {
    if (!testi.data[i]) return;
    testi.i = i;
    if (!animasi || !gerak) { isiTesti(i); return; }
    var fig = $('.gs-testi-slide', testi.akar), kutip = $('.gs-testi-kutip', fig), orang = $('.gs-testi-orang', fig);
    g.killTweensOf([fig, kutip, orang]);
    g.to([kutip, orang], {
      autoAlpha: 0, y: arah > 0 ? -12 : 12, duration: 0.35, ease: 'power2.in',
      onComplete: function () {
        isiTesti(i);
        g.set(orang, { autoAlpha: 0, y: 12 });
        var tl = g.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo(fig, { clipPath: arah > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, clearProps: 'clipPath' }, 0);
        baris(tl, kutip, 0.1);
        tl.to(orang, { autoAlpha: 1, y: 0, duration: 0.8, clearProps: BERSIH }, 0.45);
      }
    });
  }
  function hentiPutarTesti() { clearInterval(testi.putar); testi.putar = null; }
  function mulaiPutarTesti() {
    hentiPutarTesti();
    if (testi.diam || reduksi || rute !== 'beranda' || testi.data.length < 2 || !testi.akar || !testi.akar.isConnected) return;
    testi.putar = setInterval(function () { if (!document.hidden) tampilTesti((testi.i + 1) % testi.data.length, 1, true); }, 8000);
  }
  function pasangTesti(akar, data) {
    testi.akar = akar;
    testi.data = data;
    if (testi.i >= data.length) testi.i = 0;
    akar.addEventListener('mouseenter', function () { testi.diam = true; hentiPutarTesti(); });
    akar.addEventListener('mouseleave', function () { testi.diam = false; mulaiPutarTesti(); });
    if (data.length) isiTesti(testi.i);
    mulaiPutarTesti();
  }

  /* ---------- Footer ---------- */
  function siapFooter() {
    var f = $('#lapisan-publik .ftr');
    if (!f) return;
    var dalam = buat('div', 'ftr-dalam');
    while (f.firstChild) dalam.appendChild(f.firstChild);
    f.appendChild(dalam);
    var merek = buat('div', 'wrap gs-ftr-merek');
    merek.setAttribute('aria-hidden', 'true');
    merek.innerHTML = '<span class="gs-ftr-merek-teks">' + 'Kost AB6'.split('').map(function (c) { return '<span>' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>'; }).join('') + '</span>';
    var bawah = $('.ftr-bawah', dalam);
    dalam.insertBefore(merek, bawah);
    var teksMerek = $('.gs-ftr-merek-teks', merek);
    function pas() {
      teksMerek.style.fontSize = '100px';
      var ruang = merek.clientWidth - parseFloat(getComputedStyle(merek).paddingLeft) - parseFloat(getComputedStyle(merek).paddingRight);
      var lebar = teksMerek.scrollWidth;
      if (ruang > 0 && lebar > 0) teksMerek.style.fontSize = Math.min(240, 100 * ruang / lebar) + 'px';
    }
    pas();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(pas);
    window.addEventListener('resize', jeda(pas, 150));
    new MutationObserver(function () { if (!publik.hidden) pas(); }).observe(publik, { attributes: true, attributeFilter: ['hidden'] });
    if (!gerak) return;
    var item = $$('.ftr-grid > div > :not(ul), .ftr-grid li', dalam);
    var huruf = $$('.gs-ftr-merek-teks > span', merek);
    var legal = bawah ? arr(bawah.children) : [];
    g.set(item.concat(legal), { autoAlpha: 0, y: 12 });
    g.set(huruf, { autoAlpha: 0, filter: 'blur(12px)' });
    g.timeline({ scrollTrigger: { trigger: f, start: 'top bottom-=5%', once: true }, defaults: { ease: 'power3.out' } })
      .to(item, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.04, clearProps: BERSIH }, 0)
      .to(huruf, { autoAlpha: 1, filter: 'blur(0px)', duration: 0.9, stagger: 0.04, ease: 'power2.out', clearProps: 'opacity,visibility,filter' }, 0.25)
      .to(legal, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1, clearProps: BERSIH }, 0.65);
    g.fromTo(dalam, { yPercent: -18 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  /* ---------- Satu halaman tampil atau digambar ulang ---------- */
  function halaman(nama, opsi) {
    opsi = opsi || {};
    var el = document.getElementById('hal-' + nama);
    var baru = nama !== rute;
    rute = nama;
    bunuhSemua();
    hentiPutarTesti();
    if (baru) {
      if (menuBuka) bukaMenu(false, false);
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      tampilkanHeader(true);
    }
    aturLenis();
    keadaanHeader();
    var tok = ++token;
    if (!el || publik.hidden || !gerak) return;
    if (opsi.tanpaAnimasi) { ST.refresh(); return; }
    var k = kepala(el);
    var heads = $$('.sec-head', el).concat($$('.list-head', el));
    var kolom = $$('[data-gs-kolom]', el);
    var panel = $$('[data-gs-panel]', el);
    var kartu = $$('.pcard, .acard', el);
    var garis = $$('.tgrid > .tcard', el);
    var naik = $$('[data-gs-naik]', el);
    if (k) sembunyiKepala(k);
    heads.forEach(sembunyiSecHead);
    kolom.forEach(sembunyiKolom);
    panel.forEach(sembunyiPanel);
    kartu.forEach(sembunyiKartu);
    el.classList.remove('gs-tunggu');
    siapFont(function () {
      if (tok !== token) return;
      if (k) introKepala(k);
      heads.forEach(pemicuSecHead);
      kolom.forEach(pemicuKolom);
      panel.forEach(pemicuPanel);
      pemicuKartu(kartu);
      pemicuGarisKartu(garis);
      pemicuNaik(naik);
      var hero = $('#hero-slider .banner-track', el);
      if (hero) simpan(g.fromTo(hero, { yPercent: 0 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '#hero-slider', start: 'top top', end: 'bottom top', scrub: true } }));
      var ctaImg = $('.gs-cta-media img', el);
      if (ctaImg) simpan(g.fromTo(ctaImg, { yPercent: -3 }, { yPercent: 3, ease: 'none', scrollTrigger: { trigger: ctaImg.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } }));
      mulaiPutarTesti();
      ST.refresh();
    });
  }

  /* ---------- Mulai ---------- */
  document.body.classList.add('gs');
  siapHeader();
  if (g) siapMenu();
  siapMagnet();
  siapFooter();
  var akarModal = document.getElementById('akar-modal');
  if (akarModal) new MutationObserver(function () {
    document.body.classList.toggle('modal-terbuka', adaModal());
    aturLenis();
  }).observe(akarModal, { childList: true });
  new MutationObserver(function () {
    aturLenis();
    if (publik.hidden && menuBuka) bukaMenu(false, false);
    keadaanHeader();
    if (!publik.hidden && gerak) ST.refresh();
  }).observe(publik, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', function () { if (document.hidden) hentiPutarTesti(); else mulaiPutarTesti(); });

  window.GerakAB6 = { halaman: halaman, slide: animasiSlide, pasangTesti: pasangTesti, segarkan: function () { if (gerak) ST.refresh(); } };
})();
