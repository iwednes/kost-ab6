/* ============================================================
   KOST AB6 — Bentuk, shader, dan adegan partikel 3D
   Mesin partikel sama dengan website Mixmax Souvenir, warna dan bentuknya milik AB6.
   File yang sama juga berjalan sebagai Web Worker, supaya menghitung
   30.000 titik per bentuk tidak pernah membuat halaman macet.
   Bentuk: 0 gedung, 1 kunci, 2 kasur, 3 meja belajar, 4 wifi, 5 pintu, 6 tulisan.
   ============================================================ */
(function (root) {
  var N = 30000, JUMLAH = 7, TEKS = JUMLAH - 1;
  var rnd = Math.random, TAU = Math.PI * 2;

  /* ---------- Bentuk: N titik, satu titik = [x, y, z, glow]; glow 1 = menyala sendiri ---------- */
  function pack(pts){
    for (var i = 0; i < pts.length; i++) pts[i][4] = pts[i][1] + (rnd() - 0.5) * 0.25;
    pts.sort(function(a, b){ return a[4] - b[4]; });   // sorted by height so morphs stay coherent
    var pos = new Float32Array(N * 3), glow = new Float32Array(N);
    for (var j = 0; j < N; j++){
      pos[j*3] = pts[j][0]; pos[j*3+1] = pts[j][1]; pos[j*3+2] = pts[j][2];
      glow[j] = pts[j][3] || 0;
    }
    return {pos: pos, glow: glow};
  }
  // turn a shape so its best side faces the camera when it comes to rest
  function yaw(pts, a){
    var c = Math.cos(a), s = Math.sin(a);
    for (var i = 0; i < pts.length; i++){
      var x = pts[i][0], z = pts[i][2];
      pts[i][0] = x*c + z*s; pts[i][2] = -x*s + z*c;
    }
    return pts;
  }
  function ring(r, y){ var a = rnd()*TAU; return [Math.cos(a)*r, y, Math.sin(a)*r]; }

  /* ---------- Alat bantu: permukaan benda sederhana ---------- */
  function kotak(x0, x1, y0, y1, z0, z1){        // satu titik di permukaan kotak; sisi lebih luas mendapat lebih banyak titik
    var a = (x1-x0)*(y1-y0), b = (y1-y0)*(z1-z0), c = (x1-x0)*(z1-z0), r = rnd()*(a + b + c);
    var x = x0 + rnd()*(x1-x0), y = y0 + rnd()*(y1-y0), z = z0 + rnd()*(z1-z0);
    if (r < a) z = rnd() < 0.5 ? z0 : z1;
    else if (r < a + b) x = rnd() < 0.5 ? x0 : x1;
    else y = rnd() < 0.5 ? y0 : y1;
    return [x, y, z];
  }
  function tabung(cx, cz, r, y0, y1){            // dinding tabung tegak dengan tutup atas
    var a = rnd()*TAU;
    if (rnd() < 0.8) return [cx + Math.cos(a)*r, y0 + rnd()*(y1-y0), cz + Math.sin(a)*r];
    var q = Math.sqrt(rnd())*r;
    return [cx + Math.cos(a)*q, y1, cz + Math.sin(a)*q];
  }
  function bola(cx, cy, cz, rx, ry, rz){
    var u = rnd()*2 - 1, a = rnd()*TAU, s = Math.sqrt(1 - u*u);
    return [cx + Math.cos(a)*s*rx, cy + u*ry, cz + Math.sin(a)*s*rz];
  }
  function batang(a, b, r){                      // batang tipis dari titik a ke titik b
    var t = rnd(), v = rnd()*TAU;
    return [a[0] + (b[0]-a[0])*t + Math.cos(v)*r, a[1] + (b[1]-a[1])*t + Math.sin(v)*r, a[2] + (b[2]-a[2])*t + Math.cos(v + 1)*r];
  }
  /* Bentuk tersusun dari beberapa bagian: [bobot, fungsi titik, glow]. Fungsi boleh membalas null untuk menolak titik. */
  function susun(bagian){
    var total = 0, pts = [], i;
    for (i = 0; i < bagian.length; i++) total += bagian[i][0];
    while (pts.length < N){
      var r = rnd()*total;
      for (i = 0; i < bagian.length - 1; i++){ r -= bagian[i][0]; if (r <= 0) break; }
      var p = bagian[i][1]();
      if (p){ p[3] = bagian[i][2] || 0; pts.push(p); }
    }
    return pts;
  }

  /* Gedung kost tiga lantai: jendela menyala, balkon, kanopi berpilar, tandon air di atap */
  function makeGedung(){
    var X = 1.15, Z = 0.7, DASAR = -1.55, T = 0.92, ATAP = DASAR + T*3;
    var KOLOM = [-0.72, 0, 0.72], LJ = 0.2, TJ = 0.24;   // separuh lebar & tinggi jendela
    function tengahLantai(f){ return DASAR + T*f + T*0.5 + 0.02; }
    function diJendela(x, y){
      for (var f = 0; f < 3; f++){
        if (Math.abs(y - tengahLantai(f)) > TJ) continue;
        for (var k = 0; k < 3; k++) if (Math.abs(x - KOLOM[k]) < LJ) return true;
      }
      return false;
    }
    function pintuBawah(x, y){ return Math.abs(x) < 0.26 && y < DASAR + 0.72; }
    function dindingDepan(){
      var x = (rnd()*2 - 1)*X, y = DASAR + rnd()*(ATAP - DASAR);
      return diJendela(x, y) || pintuBawah(x, y) ? null : [x, y, Z];
    }
    function jendela(){
      var f = Math.floor(rnd()*3), k = Math.floor(rnd()*3);
      if (f === 0 && k === 1) return null;
      var dx = (rnd()*2 - 1)*LJ, dy = (rnd()*2 - 1)*TJ;
      if (Math.abs(dx) < 0.012 || Math.abs(dy) < 0.012) return null;     // kusen jendela
      return [KOLOM[k] + dx, tengahLantai(f) + dy, Z + 0.004];
    }
    function pelat(){                                                     // balkon lantai 2 dan 3, plus sekat antar-lantai
      var f = rnd() < 0.5 ? 1 : 2, y = DASAR + T*f;
      return rnd() < 0.72 ? kotak(-X - 0.06, X + 0.06, y - 0.03, y + 0.03, Z, Z + 0.34) : kotak(-X - 0.03, X + 0.03, y - 0.02, y + 0.02, -Z - 0.03, Z);
    }
    function pagar(){
      var f = rnd() < 0.5 ? 1 : 2, y = DASAR + T*f, tinggi = y + 0.34;
      if (rnd() < 0.35) return batang([-X - 0.05, tinggi, Z + 0.33], [X + 0.05, tinggi, Z + 0.33], 0.014);
      var x = Math.round(((rnd()*2 - 1)*X) / 0.115)*0.115;
      return batang([x, y, Z + 0.33], [x, tinggi, Z + 0.33], 0.01);
    }
    function dindingLain(){
      var pilih = rnd(), y = DASAR + rnd()*(ATAP - DASAR);
      if (pilih < 0.34) return [(rnd()*2 - 1)*X, y, -Z];
      var z = (rnd()*2 - 1)*Z, sisi = pilih < 0.67 ? -X : X;
      for (var f = 0; f < 3; f++) if (Math.abs(y - tengahLantai(f)) < TJ && Math.abs(z) < 0.2) return null;
      return [sisi, y, z];
    }
    function jendelaSamping(){
      var f = Math.floor(rnd()*3), z = (rnd()*2 - 1)*0.2, y = tengahLantai(f) + (rnd()*2 - 1)*TJ;
      return [rnd() < 0.5 ? -X - 0.004 : X + 0.004, y, z];
    }
    return susun([
      [18, dindingDepan], [15, dindingLain], [13, jendela, 1], [3, jendelaSamping, 1], [10, pelat], [7, pagar],
      [7, function(){ return kotak(-X - 0.08, X + 0.08, ATAP, ATAP + 0.1, -Z - 0.08, Z + 0.42); }],   // atap
      [5, function(){ return tabung(0.55, -0.15, 0.27, ATAP + 0.2, ATAP + 0.68); }],                  // tandon air
      [1, function(){ return batang([0.36, ATAP + 0.1, -0.15], [0.36, ATAP + 0.2, -0.15], 0.02); }],
      [1, function(){ return batang([0.74, ATAP + 0.1, -0.15], [0.74, ATAP + 0.2, -0.15], 0.02); }],
      [4, function(){ return kotak(-1.55, 1.55, DASAR - 0.06, DASAR, -1.0, 1.35); }],                  // halaman
      [4, function(){ var x = (rnd()*2 - 1)*0.26; return Math.abs(x) < 0.012 ? null : [x, DASAR + rnd()*0.72, Z + 0.004]; }, 0.75],   // pintu utama
      [4, function(){ return kotak(-0.58, 0.58, DASAR + 0.8, DASAR + 0.84, Z, Z + 0.62); }],           // kanopi
      [2, function(){ return tabung(-0.5, Z + 0.54, 0.05, DASAR, DASAR + 0.8); }],
      [2, function(){ return tabung(0.5, Z + 0.54, 0.05, DASAR, DASAR + 0.8); }]
    ]);
  }

  /* Kunci kamar berjuluk bundar */
  function makeKunci(){
    var R = 0.6, r = 0.15, cy = 0.95;
    function gelang(){
      var a = rnd()*TAU, v = rnd()*TAU, q = R + r*Math.cos(v);
      return [Math.cos(a)*q, cy + Math.sin(a)*q, r*Math.sin(v)*0.62];
    }
    function bilah(x1, y0, y1){ return function(){ return kotak(0.1, x1, y0, y1, -0.08, 0.08); }; }
    return susun([
      [40, gelang],
      [24, function(){ return tabung(0, 0, 0.125, -1.65, cy - R); }],
      [8, function(){ var a = rnd()*TAU; return [Math.cos(a)*0.2, cy - R - 0.02 + (rnd() - 0.5)*0.12, Math.sin(a)*0.2]; }],
      [5, function(){ return bola(0, -1.65, 0, 0.125, 0.1, 0.125); }],
      [9, bilah(0.62, -1.56, -1.36)], [6, bilah(0.46, -1.26, -1.1)], [8, bilah(0.56, -1.0, -0.8)]
    ]);
  }

  /* Tempat tidur: sandaran, kasur, dua bantal, dan selimut yang terlipat */
  function makeKasur(){
    var P = 1.5, L = 0.98, ATAS = 0.06;
    function ombak(x, z){ return 0.022*Math.sin(x*4.2 + z*1.7) + 0.014*Math.sin(x*9 - z*3); }
    function selimut(){
      var k = rnd(), x = -0.28 + rnd()*(P + 0.32), z = (rnd()*2 - 1)*(L + 0.02);
      if (k < 0.62) return [x, ATAS + 0.05 + ombak(x, z), z];
      if (k < 0.92){ var y = ATAS - rnd()*0.42; return [x, y, (rnd() < 0.5 ? -1 : 1)*(L + 0.03 + 0.01*Math.sin(x*8))]; }
      return [P + 0.04, ATAS - rnd()*0.42, z];
    }
    function lipatan(){ var a = rnd()*Math.PI, z = (rnd()*2 - 1)*(L + 0.02); return [-0.28 + Math.cos(a)*0.09, ATAS + 0.05 + Math.sin(a)*0.09, z]; }
    function bantal(z){ return function(){ return bola(-1.03, ATAS + 0.13, z, 0.36, 0.14, 0.38); }; }
    function kaki(x, z){ return function(){ return tabung(x, z, 0.05, -1.05, -0.72); }; }
    return susun([
      [15, function(){ return kotak(-1.55, P + 0.05, -0.72, -0.42, -L - 0.03, L + 0.03); }],     // rangka
      [12, function(){ return kotak(-1.5, P, -0.42, ATAS, -L, L); }],                             // kasur
      [32, selimut], [5, lipatan], [9, bantal(-0.46)], [9, bantal(0.46)],
      [14, function(){ return kotak(-1.68, -1.56, -1.05, 1.02, -L - 0.08, L + 0.08); }],          // sandaran
      [1, kaki(-1.46, -0.9)], [1, kaki(-1.46, 0.9)], [1, kaki(1.46, -0.9)], [1, kaki(1.46, 0.9)]
    ]);
  }

  /* Meja belajar: laci, laptop, tumpukan buku, dan lampu baca yang menyala */
  function makeMeja(){
    var ATAS = 0.2, HX = -0.72, HY = 1.32, HZ = -0.05;
    function kaki(x, z){ return function(){ return kotak(x - 0.05, x + 0.05, -1.4, ATAS - 0.08, z - 0.05, z + 0.05); }; }
    function layar(){
      var u = rnd(), s = -0.55 + rnd()*0.9;
      return [s, ATAS + 0.05 + u*0.6, -0.34 - u*0.2];
    }
    function cahaya(){                                   // kerucut cahaya dari kap lampu ke meja
      var t = rnd(), a = rnd()*TAU, q = (0.1 + t*0.46)*Math.sqrt(rnd());
      return t < 0.04 ? null : [HX + 0.18 + t*0.05 + Math.cos(a)*q, HY - 0.16 - t*(HY - ATAS - 0.2), HZ + Math.sin(a)*q*0.7];
    }
    function kap(){
      var t = rnd(), a = rnd()*TAU, q = 0.08 + t*0.2;
      return [HX + 0.18 + Math.cos(a)*q, HY + 0.1 - t*0.26, HZ + Math.sin(a)*q];
    }
    function buku(i){
      var y = ATAS + 0.02 + i*0.1, g = i*0.03;
      return function(){ return kotak(0.62 + g, 1.24 - g, y, y + 0.09, -0.42, 0.34 - g); };
    }
    return susun([
      [22, function(){ return kotak(-1.45, 1.45, ATAS - 0.08, ATAS, -0.76, 0.76); }],           // daun meja
      [3, kaki(-1.34, -0.65)], [3, kaki(-1.34, 0.65)],
      [17, function(){ return kotak(0.48, 1.36, -1.4, ATAS - 0.08, -0.7, 0.7); }],              // lemari laci
      [4, function(){ var y = rnd() < 0.5 ? -0.32 : -0.76; return [0.48 + rnd()*0.88, y, 0.71]; }],
      [3, function(){ var y = [-0.12, -0.54, -0.98][Math.floor(rnd()*3)]; return batang([0.8, y, 0.75], [1.04, y, 0.75], 0.016); }],
      [8, function(){ return kotak(-0.55, 0.35, ATAS, ATAS + 0.04, -0.34, 0.26); }],             // alas laptop
      [10, layar, 0.55],
      [3, buku(0)], [3, buku(1)], [3, buku(2)],
      [3, function(){ var a = rnd()*TAU, q = Math.sqrt(rnd())*0.24; return [-1.12 + Math.cos(a)*q, ATAS + 0.02, -0.28 + Math.sin(a)*q]; }],   // kaki lampu
      [3, function(){ return batang([-1.12, ATAS, -0.28], [-1.2, 1.02, -0.26], 0.022); }],
      [3, function(){ return batang([-1.2, 1.02, -0.26], [HX + 0.16, HY + 0.1, HZ], 0.022); }],
      [7, kap],
      [2, function(){ return bola(HX + 0.18, HY - 0.15, HZ, 0.1, 0.1, 0.1); }, 1],
      [6, cahaya, 0.55]
    ]);
  }

  /* Sinyal Wi-Fi: tiga busur dan satu titik menyala */
  function makeWifi(){
    var CY = -1.12, LB = 0.125, TB = 0.12, A0 = Math.PI*0.25, A1 = Math.PI*0.75;
    function busur(R){
      return function(){
        var a = A0 + rnd()*(A1 - A0), k = rnd(), q, z;
        if (k < 0.7){ q = R + (rnd()*2 - 1)*LB; z = rnd() < 0.5 ? -TB : TB; }
        else { q = R + (rnd() < 0.5 ? -LB : LB); z = (rnd()*2 - 1)*TB; }
        return [Math.cos(a)*q, CY + Math.sin(a)*q, z];
      };
    }
    return susun([
      [21, busur(0.95)], [33, busur(1.68)], [44, busur(2.42)],
      [9, function(){ return bola(0, CY, 0, 0.28, 0.28, 0.28); }, 1]
    ]);
  }

  /* Pintu kamar yang terbuka sedikit, cahaya kamar keluar dari celahnya */
  function makePintu(){
    var X = 0.9, Y0 = -1.6, Y1 = 1.58, BUKA = 0.62, c = Math.cos(BUKA), s = Math.sin(BUKA), LEBAR = X*2;
    function daun(u, y, tebal){ return [-X + u*c - tebal*s, y, u*s + tebal*c]; }
    function panel(){                                     // dua panel timbul pada daun pintu
      var atas = rnd() < 0.5, u0 = 0.32, u1 = LEBAR - 0.32, y0 = atas ? 0.2 : Y0 + 0.34, y1 = atas ? Y1 - 0.34 : -0.1;
      var k = rnd(), u, y;
      if (k < 0.5){ u = u0 + rnd()*(u1 - u0); y = rnd() < 0.5 ? y0 : y1; }
      else { u = rnd() < 0.5 ? u0 : u1; y = y0 + rnd()*(y1 - y0); }
      return daun(u, y, 0.05);
    }
    return susun([
      [13, function(){ return kotak(-X - 0.15, -X, Y0, Y1 + 0.14, -0.13, 0.13); }],
      [13, function(){ return kotak(X, X + 0.15, Y0, Y1 + 0.14, -0.13, 0.13); }],
      [8, function(){ return kotak(-X - 0.15, X + 0.15, Y1, Y1 + 0.14, -0.13, 0.13); }],
      [32, function(){ return daun(rnd()*LEBAR, Y0 + 0.04 + rnd()*(Y1 - Y0 - 0.08), rnd() < 0.5 ? 0.04 : -0.04); }],
      [7, panel],
      [3, function(){ return bola(-X + (LEBAR - 0.16)*c - 0.07*s, -0.05, (LEBAR - 0.16)*s + 0.07*c, 0.07, 0.07, 0.07); }],
      [15, function(){ return [(rnd()*2 - 1)*X, Y0 + rnd()*(Y1 - Y0), -0.08]; }, 1],              // cahaya kamar
      [6, function(){ var t = Math.pow(rnd(), 1.5), lebar = X*(1 - t*0.25); return rnd() < 0.35 + 0.6*(1 - t) ? [(rnd()*2 - 1)*lebar + t*0.5, Y0 + 0.012, t*1.6] : null; }, 0.8],
      [5, function(){ return kotak(-1.35, 1.35, Y0 - 0.06, Y0, -0.45, 1.3); }]                    // lantai
    ]);
  }

  var TEXT_FONT = '"Hanken Grotesk",system-ui,Arial,sans-serif';
  function textCandidates(){       // pixels of the brand name drawn in the brand font; needs the page, so it stays on the main thread
    var W = 1400, H = 640, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d', {willReadFrequently: true});
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#000';
    // kedua baris sama lebar, seperti dua baris tulisan pada Mixmax
    function fit(txt){
      g.font = '700 200px ' + TEXT_FONT;
      var s = 200 * (W*0.64) / g.measureText(txt).width;
      g.font = '700 ' + s + 'px ' + TEXT_FONT;
      var m = g.measureText(txt);
      return {size: s, cap: m.actualBoundingBoxAscent || s*0.72};
    }
    var l1 = fit('KOST'), l2 = fit('AB6'), gap = l1.size*0.14;
    var top = (H - (l1.cap + gap + l2.cap)) / 2;
    g.font = '700 ' + l1.size + 'px ' + TEXT_FONT;
    g.fillText('KOST', W/2, top + l1.cap);
    g.font = '700 ' + l2.size + 'px ' + TEXT_FONT;
    g.fillText('AB6', W/2, top + l1.cap + gap + l2.cap);
    var d = g.getImageData(0, 0, W, H).data, cand = [];
    for (var y = 0; y < H; y += 2) for (var x = 0; x < W; x += 2) if (d[(y*W + x)*4 + 3] > 140) cand.push(x, y);
    return new Int16Array(cand);
  }

  function textPoints(cand){
    var W = 1400, H = 640, sc = 4.3 / W, pts = [];
    while (pts.length < N){
      var j = Math.floor(rnd()*cand.length/2)*2;
      pts.push([(cand[j] - W/2 + rnd()*2)*sc, -(cand[j+1] - H/2 + rnd()*2)*sc, (rnd()-0.5)*0.12]);
    }
    return pts;
  }

  var RESEP = [
    function () { return yaw(makeKunci(), 0.5); },
    function () { return yaw(makeKasur(), 0.62); },
    function () { return yaw(makeMeja(), -0.42); },
    function () { return makeWifi(); },
    function () { return yaw(makePintu(), -0.3); }
  ];

  /* ---------- Berjalan sebagai Web Worker: hitung bentuk lalu kirim ke halaman ---------- */
  if (typeof document === 'undefined') {
    var kirim = function (k, s) { root.postMessage({ k: k, pos: s.pos, glow: s.glow }, [s.pos.buffer, s.glow.buffer]); };
    root.onmessage = function (e) {
      if (e.data.gedung === undefined) { kirim(TEKS, pack(textPoints(e.data))); return; }
      if (e.data.gedung) kirim(0, pack(makeGedung()));
      RESEP.forEach(function (f, i) { kirim(i + 1, pack(f())); });
    };
    return;
  }

  function buatGedung() { return pack(makeGedung()); }

  /**
   * Bentuk datang satu per satu lewat onBentuk(k, bentuk), dari worker atau, bila tidak ada, dari halaman ini.
   * opsi.gedung: gedung ikut dihitung di worker.
   */
  function muatBentuk(onBentuk, opsi) {
    var ada = {}, worker = null, cand = null, gedung = !!(opsi && opsi.gedung);
    function terima(k, s) { ada[k] = true; onBentuk(k, s); }
    function diSini() {
      if (worker) { worker.terminate(); worker = null; }
      if (gedung && !ada[0]) terima(0, buatGedung());
      RESEP.forEach(function (f, i) { if (!ada[i + 1]) terima(i + 1, pack(f())); });
      if (cand) terima(TEKS, pack(textPoints(cand)));
    }
    try {
      worker = new Worker('js/bentuk3d.js');
      worker.onmessage = function (e) {
        terima(e.data.k, e.data);
        if (e.data.k === TEKS) { worker.terminate(); worker = null; }
      };
      worker.onerror = diSini;
      worker.postMessage({ gedung: gedung });
    } catch (e) { worker = null; diSini(); }
    function teks() {
      var c = textCandidates();
      if (!c.length) return;
      cand = c;
      if (worker) worker.postMessage(c);
      else terima(TEKS, pack(textPoints(c)));
    }
    if (document.fonts && document.fonts.load) {
      var selesai = false, sekali = function () { if (!selesai) { selesai = true; teks(); } };
      document.fonts.load('700 120px "Hanken Grotesk"').then(sekali, sekali);
      setTimeout(sekali, 3000);
    } else teks();
  }

  /**
   * Bila gambar tersendat, resolusi diturunkan selangkah demi selangkah. Mengembalikan fungsi yang dipanggil tiap frame.
   * batasMs: jeda rata-rata antar-frame yang dianggap tersendat.
   */
  function penjagaMulus(ambil, pasang, batasMs) {
    var lewati = 30, n = 0, jumlah = 0, coba = null, aktif = true;
    return function (ms) {
      if (!aktif || ms > 200) return;            // di atas 200 ms berarti pindah tab, bukan frame lambat
      if (lewati > 0) { lewati--; return; }
      jumlah += ms;
      if (++n < 45) return;
      var rata = jumlah / n;
      n = 0; jumlah = 0;
      if (coba && rata > coba.ms * 0.9) {        // tidak membaik (misalnya mode hemat baterai 30 fps): batalkan dan berhenti
        pasang(coba.dpr);
        aktif = false;
        return;
      }
      coba = null;
      if (rata > batasMs && ambil() > 1) {
        coba = { dpr: ambil(), ms: rata };
        lewati = 20;
        pasang(Math.max(1, ambil() - 0.35));
      }
    };
  }

  /**
   * Putaran sumbu Y yang terus berjalan. Saat berpindah ke tulisan, putaran dibawa mulus sampai menghadap
   * depan supaya terbaca; selama bentuk tulisan diam, lalu berputar lagi begitu berganti bentuk.
   */
  function buatPutaran(kecepatan) {
    var sudut = 0, awal = null, akhir = 0;
    return {
      tambah: function (rad) { sudut += rad; },
      hitung: function (dt, menujuTulisan, diTulisan, prog) {
        if (menujuTulisan) {
          if (awal === null) { awal = sudut; akhir = Math.ceil(sudut / TAU + 0.15) * TAU; }
          sudut = awal + (akhir - awal) * prog;
        } else {
          awal = null;
          if (!diTulisan) sudut += dt * kecepatan;
        }
        return sudut;
      }
    };
  }

  /* ---------- Shader titik ---------- */
  var VERTEX = [
    'attribute vec3 aTo; attribute float aRand; attribute float aGlow0; attribute float aGlow1; attribute float aTint;',
    'uniform float uProg, uTime, uScale, uSize, uMotion, uMouseOn, uBurst, uPush, uReach;',
    'uniform vec2 uMouse; uniform vec3 uRip;',
    'varying float vDepth; varying float vTone; varying float vGlow; varying float vTint; varying float vHue; varying float vSize; varying float vNear;',
    'void main(){',
    '  float d = aRand * 0.35;',
    '  float p = smoothstep(d, d + 0.65, uProg);',
    '  vec3 pos = mix(position, aTo, p);',
    '  float glow = mix(aGlow0, aGlow1, p);',
    '  float burst = sin(p * 3.14159265) * uBurst;',
    '  pos += normalize(pos + vec3(0.0001)) * burst * (0.25 + aRand * 0.8);',
    '  pos.y += burst * (aRand - 0.5) * 0.6;',
    '  float t = uTime * uMotion;',
    '  pos += vec3(sin(t*0.7 + aRand*43.0), cos(t*0.6 + aRand*29.0), sin(t*0.5 + aRand*17.0)) * 0.022;',
    '  vec4 world = modelMatrix * vec4(pos, 1.0);',
    '  vec2 dm = world.xy - uMouse;',
    '  float near = smoothstep(uReach, 0.0, length(dm)) * uMouseOn;',
    '  world.xy += normalize(dm + vec2(0.0001)) * near * uPush;',
    '  if (uRip.z > 0.0) {',                       // riak yang melebar dari titik klik
    '    vec2 dr = world.xy - uRip.xy;',
    '    float gap = (length(dr) - uRip.z * 4.0) * 2.5;',
    '    float wave = exp(-gap * gap) * (1.0 - clamp(uRip.z / 1.4, 0.0, 1.0));',
    '    world.xy += normalize(dr + vec2(0.0001)) * wave * 0.5;',
    '    near = max(near, wave);',
    '  }',
    '  vec4 mv = viewMatrix * world;',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = max(2.0, uSize * uScale * (0.65 + aRand * 0.7) * (1.0 + 0.25 * glow + 0.6 * near) / -mv.z);',
    '  vDepth = -mv.z; vTone = aRand; vGlow = glow; vSize = gl_PointSize; vNear = near;',
    '  vTint = aTint + (aRand - 0.5) * 0.18 + 0.05 * sin(t*0.5 + world.y*1.2);',   // kilau pelan yang melintasi gradasi
    '  vHue = aTint + aRand * 0.05 + t * 0.035;',
    '}'
  ].join('\n');
  var FRAGMENT = [
    'uniform vec3 uFog, uWarm, uInk, uBronze, uGold; uniform float uFogNear, uFogFar, uPulse, uSoft, uRainbow;',
    'varying float vDepth; varying float vTone; varying float vGlow; varying float vTint; varying float vHue; varying float vSize; varying float vNear;',
    'vec3 pelangi(float h){',
    '  vec3 p = abs(fract(vec3(h) + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);',
    '  return mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), 0.85) * 0.9;',
    '}',
    'void main(){',
    '  vec2 c = gl_PointCoord * 2.0 - 1.0;',
    '  float r2 = dot(c, c); if (r2 > 1.0) discard;',
    '  float g = clamp(vTint, 0.0, 1.0);',           // gradasi AB6: hutan di bawah, hijau di tengah, krem muda di atas
    '  vec3 col = g < 0.5 ? mix(uInk, uBronze, g * 2.0) : mix(uBronze, uGold, (g - 0.5) * 2.0);',
    '  col = mix(col, pelangi(fract(vHue)), max(uRainbow, vNear));',
    '  col *= 0.94 + vTone * 0.12;',
    '  col = mix(col, uWarm * uPulse, vGlow);',
    '  float fog = smoothstep(uFogNear, uFogFar, vDepth) * (1.0 - 0.75 * vGlow);',
    '  float edge = clamp((1.0 - sqrt(r2)) * vSize * 0.5, 0.0, 1.0);',   // tepi lembut satu piksel, dihaluskan alphaToCoverage
    '  gl_FragColor = vec4(mix(col, uFog, max(fog * 0.82, uSoft * (1.0 - vNear))), edge);',
    '}'
  ].join('\n');

  function angkaAcak(n, lo, hi, THREE) {
    var a = new Float32Array(n);
    for (var i = 0; i < n; i++) a[i] = lo + rnd() * (hi - lo);
    return new THREE.BufferAttribute(a, 1);
  }

  /**
   * Adegan partikel lengkap: objek, cahaya lampu, dua cincin, debu, dan reaksi kursor.
   * opsi: pelangi, diam (gerak minimal), kuat (pakai GPU terkuat), lembut, lembutCincin,
   *       dorong, jangkau (reaksi kursor), riak (gelombang saat klik), cahaya (terang lampu),
   *       tintMaks (batas atas gradasi warna; default 1 = sampai krem muda).
   */
  function buatAdegan(kanvas, opsi) {
    var THREE = root.THREE, diam = !!opsi.diam, tanH = Math.tan(19 * Math.PI / 180);
    var renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true, alpha: false, powerPreference: opsi.kuat ? 'high-performance' : 'default' });
    renderer.setClearColor(0xA9B5A2, 1);
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80), group = new THREE.Group();
    scene.add(group);

    var bersama = {
      uTime: { value: 0 }, uScale: { value: 1 }, uMotion: { value: diam ? 0 : 1 }, uPulse: { value: 1 },
      uMouse: { value: new THREE.Vector2(99, 99) }, uMouseOn: { value: 0 }, uRip: { value: new THREE.Vector3(0, 0, 0) },
      uPush: { value: opsi.dorong }, uReach: { value: opsi.jangkau }, uRainbow: { value: opsi.pelangi ? 1 : 0 },
      uFogNear: { value: 6 }, uFogFar: { value: 12 }, uFog: { value: new THREE.Color('#A9B5A2') }, uWarm: { value: new THREE.Color('#FFE7A8') },
      uInk: { value: new THREE.Color('#14291E') }, uBronze: { value: new THREE.Color('#2A4F3B') }, uGold: { value: new THREE.Color('#EEF4E8') }
    };
    function bahan(ukuran, ledak, lembut) {
      return new THREE.ShaderMaterial({
        vertexShader: VERTEX, fragmentShader: FRAGMENT, alphaToCoverage: true,
        uniforms: Object.assign({ uProg: { value: 0 }, uSize: { value: ukuran }, uBurst: { value: ledak }, uSoft: { value: lembut } }, bersama)
      });
    }

    var geo = new THREE.BufferGeometry();
    ['aGlow0', 'aGlow1'].forEach(function (a) { geo.setAttribute(a, new THREE.BufferAttribute(new Float32Array(N), 1)); });
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aTo', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aRand', angkaAcak(N, 0, 1, THREE));
    // warna menurut peringkat tinggi: bentuk terurut dari bawah ke atas, jadi indeks i selalu titik terendah ke-i
    var tint = new Float32Array(N);
    for (var ti = 0; ti < N; ti++) tint[ti] = ti / N * (opsi.tintMaks || 1);
    geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
    var mat = bahan(0.028, 0.7, opsi.lembut);
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    group.add(points);

    // cahaya lembut di sekitar objek
    var hc = document.createElement('canvas');
    hc.width = hc.height = 128;
    var hg = hc.getContext('2d'), grad = hg.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,196,90,0.9)');
    grad.addColorStop(0.35, 'rgba(255,184,70,0.35)');
    grad.addColorStop(1, 'rgba(255,184,70,0)');
    hg.fillStyle = grad;
    hg.fillRect(0, 0, 128, 128);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, depthTest: false, depthWrite: false, opacity: 0 }));
    halo.position.set(0, 0.08, 0);
    halo.scale.set(3.4, 3.4, 1);
    group.add(halo);

    // dua cincin halus di bawah objek
    var cincinPos = [], cincinTint = [];
    [1.75, 2.2].forEach(function (r) {
      var cnt = Math.round(N * 0.016 * r);
      for (var i = 0; i < cnt; i++) {
        var a = rnd() * TAU, rr = r + (rnd() - 0.5) * 0.03;
        cincinPos.push(Math.cos(a) * rr, (rnd() - 0.5) * 0.01, Math.sin(a) * rr);
        cincinTint.push(opsi.pelangi ? a / TAU : 0.5);
      }
    });
    var cincinArr = new Float32Array(cincinPos), cincinN = cincinArr.length / 3;
    var cincinGeo = new THREE.BufferGeometry();
    cincinGeo.setAttribute('position', new THREE.BufferAttribute(cincinArr, 3));
    cincinGeo.setAttribute('aTo', new THREE.BufferAttribute(cincinArr, 3));
    cincinGeo.setAttribute('aRand', angkaAcak(cincinN, 0, 0.6, THREE));
    cincinGeo.setAttribute('aGlow0', new THREE.BufferAttribute(new Float32Array(cincinN), 1));
    cincinGeo.setAttribute('aGlow1', new THREE.BufferAttribute(new Float32Array(cincinN), 1));
    cincinGeo.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(cincinTint), 1));
    var rings = new THREE.Points(cincinGeo, bahan(0.018, 0, opsi.lembutCincin));
    rings.frustumCulled = false;
    scene.add(rings);

    // bintik terang yang melayang
    var DEBU = Math.min(innerWidth, innerHeight) < 700 ? 70 : 140, debuArr = new Float32Array(DEBU * 3);
    for (var i = 0; i < DEBU; i++) { debuArr[i * 3] = (rnd() * 2 - 1) * 9; debuArr[i * 3 + 1] = (rnd() * 2 - 1) * 6; debuArr[i * 3 + 2] = -6 + rnd() * 10; }
    var debuGeo = new THREE.BufferGeometry();
    debuGeo.setAttribute('position', new THREE.BufferAttribute(debuArr, 3));
    debuGeo.setAttribute('aRand', angkaAcak(DEBU, 0, 1, THREE));
    var debu = new THREE.Points(debuGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: bersama.uTime, uScale: bersama.uScale, uMotion: bersama.uMotion },
      vertexShader: [
        'attribute float aRand; uniform float uTime, uScale, uMotion; varying float vA;',
        'void main(){',
        '  vec3 p = position; float t = uTime * uMotion;',
        '  p.y = mod(p.y - t*(0.12 + aRand*0.25) + 6.0, 12.0) - 6.0;',
        '  p.x += sin(t*0.4 + aRand*20.0) * 0.3;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  gl_PointSize = (0.012 + aRand*0.018) * uScale / -mv.z;',
        '  vA = 0.12 + aRand*0.2;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying float vA;',
        'void main(){ vec2 c = gl_PointCoord*2.0-1.0; float r = dot(c,c); if (r > 1.0) discard;',
        '  gl_FragColor = vec4(0.93, 0.96, 0.9, vA * (1.0 - r) * 2.0); }'
      ].join('\n')
    }));
    debu.frustumCulled = false;
    scene.add(debu);

    /* ---------- Kursor: butir terdekat menghindar dan berubah warna; klik membuat riak ---------- */
    var W = 1, H = 1, ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    var hit = new THREE.Vector3(), ndc = new THREE.Vector2(), kursorT = new THREE.Vector2(99, 99), kursorOn = 0, umurRiak = -1;
    function keDunia(e) {
      ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plane, hit);
    }
    window.addEventListener('pointermove', function (e) {
      if (!keDunia(e)) return;
      if (kursorOn === 0) bersama.uMouse.value.set(hit.x, hit.y);
      kursorT.set(hit.x, hit.y);
      kursorOn = 1;
    }, { passive: true });
    if (opsi.riak) window.addEventListener('pointerdown', function (e) {
      if (!keDunia(e)) return;
      bersama.uRip.value.set(hit.x, hit.y, 0.001);
      umurRiak = 0.001;
    }, { passive: true });
    var lepas = function () { kursorOn = 0; };
    document.addEventListener('pointerleave', lepas);
    window.addEventListener('pointercancel', lepas);
    window.addEventListener('blur', lepas);
    window.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') lepas(); });

    return {
      group: group, rings: rings, tanH: tanH,
      pasang: function (a, b) {            // pasangan bentuk: a saat prog 0, b saat prog 1
        var at = geo.attributes;
        at.position.array.set(a.pos); at.aTo.array.set(b.pos);
        at.aGlow0.array.set(a.glow); at.aGlow1.array.set(b.glow);
        at.position.needsUpdate = at.aTo.needsUpdate = at.aGlow0.needsUpdate = at.aGlow1.needsUpdate = true;
      },
      ukur: function (w, h, dpr, jarak) {
        W = w; H = h;
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.position.set(0, jarak * 0.07, jarak);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        bersama.uScale.value = (h * dpr) / (2 * tanH);
        bersama.uFogNear.value = jarak - 1.6;
        bersama.uFogFar.value = jarak + 3.6;
      },
      tempatkan: function (x, y, miringCincin) {
        group.position.set(x, y, 0);
        rings.position.set(x, y - 2.15, 0);
        rings.rotation.x = miringCincin;
      },
      perbarui: function (dt, waktu, prog, lampu) {
        mat.uniforms.uProg.value = prog;
        bersama.uTime.value = waktu;
        var denyut = diam ? 1 : 0.95 + 0.07 * Math.sin(waktu * 2.1);
        bersama.uPulse.value = denyut;
        halo.material.opacity = lampu * opsi.cahaya * denyut;
        bersama.uMouseOn.value += (kursorOn - bersama.uMouseOn.value) * (1 - Math.exp(-dt * 5));
        bersama.uMouse.value.lerp(kursorT, 1 - Math.exp(-dt * 10));
        if (umurRiak > 0) {
          umurRiak += dt;
          bersama.uRip.value.z = umurRiak;
          if (umurRiak > 1.4) { umurRiak = -1; bersama.uRip.value.z = 0; }
        }
        rings.rotation.y = diam ? 0 : waktu * 0.05;
      },
      gambar: function () { renderer.render(scene, camera); }
    };
  }

  root.AB63D = { JUMLAH: JUMLAH, buatGedung: buatGedung, muatBentuk: muatBentuk, penjagaMulus: penjagaMulus, buatPutaran: buatPutaran, buatAdegan: buatAdegan };
})(self);
