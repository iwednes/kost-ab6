/* ============================================================
   KOST AB6 — Video banner 5 detik (mengikuti website Mixmax Souvenir)
   Admin: video MP4/WEBM/MOV dicek durasinya, dikecilkan ke 1080p tanpa suara,
   cuplikan awalnya dijadikan gambar sampul, lalu diunggah ke Drive.
   Beranda: video diambil lewat API, disimpan di browser, dan diputar di hero.
   Selama video belum siap atau gagal, gambar sampul yang tampil.
   ============================================================ */
(function () {
  'use strict';
  function errPengguna(p) { var e = new Error(p); e.kode = 'VALIDASI'; return e; }
  function kabar(pesan) { if (typeof toast === 'function') toast('Video banner', pesan, 'info'); }
  // Video banner: MP4/WEBM/MOV tanpa suara, maks. 5 detik & 15 MB.
  // Cuplikan awal video dijadikan gambar sampul (tampil saat video dimuat / bila video gagal).
  const VIDEO_MAKS_DETIK = 5;
  const VIDEO_MAKS_MB = 15;        // batas file yang dikirim ke server
  const VIDEO_MAKS_MB_ASLI = 200;  // batas file asli bila browser bisa mengecilkannya
  const VIDEO_SISI_MAKS = 1920;    // 1080p: tajam di layar besar, ringan dan lancar di HP
  function jenisVideo(file) {
    if (!file) return '';
    if (/^video\/(mp4|webm|quicktime)$/.test(file.type)) return file.type;
    const n = String(file.name || '').toLowerCase();
    if (/\.mp4$/.test(n)) return 'video/mp4';
    if (/\.webm$/.test(n)) return 'video/webm';
    if (/\.mov$/.test(n)) return 'video/quicktime';
    return /^video\//.test(file.type) ? file.type : '';
  }
  function bacaBase64(blob) {
    return new Promise(function (resolve, reject) {
      const fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1]); };
      fr.onerror = function () { reject(errPengguna('File gagal dibaca. Pilih ulang filenya.')); };
      fr.readAsDataURL(blob);
    });
  }
  /** Format rekaman MP4 (H.264) yang didukung browser admin; kosong bila tidak bisa mengecilkan video. */
  function mimeRekamMp4() {
    try {
      if (!window.MediaRecorder || !MediaRecorder.isTypeSupported || !HTMLCanvasElement.prototype.captureStream) return '';
      const daftar = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.4d0028', 'video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4'];
      for (let i = 0; i < daftar.length; i++) if (MediaRecorder.isTypeSupported(daftar[i])) return daftar[i];
    } catch (e) { /* tidak didukung */ }
    return '';
  }
  /**
   * Putar ulang video sekali di kanvas berukuran w×h lalu rekam menjadi MP4 H.264 tanpa suara.
   * Hasilnya jauh lebih kecil dari video HP (4K) dan bisa diputar lancar di semua HP.
   */
  function kecilkanVideo(src, w, h, mimeRek) {
    return new Promise(function (resolve, reject) {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d');
      const potongan = [];
      let rec = null, stream = null, selesai = false, batas = null, bingkai = 0;
      // Video lain yang sedang diputar dijeda dulu agar dekoder video tidak berebut.
      const dijeda = Array.prototype.filter.call(document.querySelectorAll('video'), function (x) { return !x.paused; });
      dijeda.forEach(function (x) { x.pause(); });
      const akhiri = function (err, blob) {
        if (selesai) return;
        selesai = true;
        clearTimeout(batas);
        v.onerror = null;
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* abaikan */ }
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        dijeda.forEach(function (x) { if (x.isConnected) { const p = x.play(); if (p && p.catch) p.catch(function () {}); } });
        if (err) reject(err); else resolve(blob);
      };
      const gambarFrame = function () { try { ctx.drawImage(v, 0, 0, w, h); bingkai++; } catch (e) { /* abaikan */ } };
      const lanjut = function (fn) { if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(fn); else requestAnimationFrame(fn); };
      const ulang = function () { if (selesai || v.ended) return; gambarFrame(); lanjut(ulang); };
      v.onerror = function () { akhiri(new Error('Video tidak terbaca')); };
      v.onloadeddata = function () {
        gambarFrame();
        try {
          stream = cv.captureStream(30);
          const bitrate = Math.round(Math.max(1500000, 5000000 * (w * h) / (1920 * 1080)));
          rec = new MediaRecorder(stream, { mimeType: mimeRek, videoBitsPerSecond: bitrate });
        } catch (e) { akhiri(e); return; }
        rec.ondataavailable = function (e) { if (e.data && e.data.size) potongan.push(e.data); };
        rec.onstop = function () {
          const b = new Blob(potongan, { type: 'video/mp4' });
          // Komputer terlalu lambat (gambar patah-patah): jangan dipakai.
          if (bingkai < (v.duration || VIDEO_MAKS_DETIK) * 15) { akhiri(new Error('Hanya ' + bingkai + ' bingkai terekam')); return; }
          if (b.size) akhiri(null, b); else akhiri(new Error('Hasil rekaman kosong'));
        };
        rec.onerror = function () { akhiri(new Error('Perekaman gagal')); };
        v.onended = function () { gambarFrame(); setTimeout(function () { if (rec.state !== 'inactive') rec.stop(); }, 80); };
        batas = setTimeout(function () {
          if (rec && rec.state !== 'inactive') { rec.onstop = null; try { rec.stop(); } catch (e) { /* abaikan */ } }
          akhiri(new Error('Waktu habis'));
        }, (v.duration || VIDEO_MAKS_DETIK) * 3000 + 8000);
        rec.start(250);
        const p = v.play();
        lanjut(ulang);
        if (p && p.catch) p.catch(function () { akhiri(new Error('Video tidak bisa diputar')); });
      };
      v.src = src;
    });
  }
  /**
   * Pembungkus MP4 mini (satu trek video H.264, tanpa B-frame). Menyusun ftyp + moov + mdat
   * dari potongan hasil VideoEncoder, supaya hasilnya MP4 biasa yang bisa diputar di semua HP.
   */
  function susunMp4(sampel, avcc, w, h) {
    const TS = 90000;
    const enc = new TextEncoder();
    function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
    function u16(n) { return [(n >>> 8) & 255, n & 255]; }
    function gabung(arr) {
      let n = 0;
      arr.forEach(function (a) { n += a.length; });
      const o = new Uint8Array(n);
      let i = 0;
      arr.forEach(function (a) { o.set(a, i); i += a.length; });
      return o;
    }
    function kotak(tipe) {
      const isi = gabung(Array.prototype.slice.call(arguments, 1).map(function (x) { return x instanceof Uint8Array ? x : new Uint8Array(x); }));
      return gabung([new Uint8Array(u32(isi.length + 8)), enc.encode(tipe), isi]);
    }
    function penuh(tipe, versi, flag) {
      const isi = Array.prototype.slice.call(arguments, 3);
      return kotak.apply(null, [tipe, [versi, (flag >>> 16) & 255, (flag >>> 8) & 255, flag & 255]].concat(isi));
    }
    const MATRIKS = [].concat(u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000));
    const t0 = sampel[0].ts;
    const waktu = sampel.map(function (x) { return Math.round((x.ts - t0) * TS / 1e6); });
    const durasi = sampel.map(function (x, i) { return i < sampel.length - 1 ? Math.max(1, waktu[i + 1] - waktu[i]) : Math.max(1, Math.round((x.dur || 33333) * TS / 1e6)); });
    let total = 0;
    durasi.forEach(function (d) { total += d; });
    const stts = [];
    durasi.forEach(function (d) { const t = stts[stts.length - 1]; if (t && t[1] === d) t[0]++; else stts.push([1, d]); });
    const kunci = [];
    sampel.forEach(function (x, i) { if (x.key) kunci.push(i + 1); });
    const ms = Math.round(total * 1000 / TS);
    function buatMoov(offset) {
      return kotak('moov',
        penuh('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(ms), u32(0x00010000), u16(0x0100), new Array(10).fill(0), MATRIKS, new Array(24).fill(0), u32(2)),
        kotak('trak',
          penuh('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(ms), new Array(8).fill(0), u16(0), u16(0), u16(0), u16(0), MATRIKS, u32(w << 16), u32(h << 16)),
          kotak('mdia',
            penuh('mdhd', 0, 0, u32(0), u32(0), u32(TS), u32(total), u16(0x55c4), u16(0)),
            penuh('hdlr', 0, 0, u32(0), enc.encode('vide'), new Array(12).fill(0), enc.encode('VideoHandler\0')),
            kotak('minf',
              penuh('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)),
              kotak('dinf', penuh('dref', 0, 0, u32(1), penuh('url ', 0, 1))),
              kotak('stbl',
                penuh('stsd', 0, 0, u32(1),
                  kotak('avc1', new Array(6).fill(0), u16(1), new Array(16).fill(0), u16(w), u16(h), u32(0x00480000), u32(0x00480000), u32(0), u16(1), new Array(32).fill(0), u16(0x18), u16(0xffff),
                    kotak('avcC', avcc))),
                penuh('stts', 0, 0, u32(stts.length), [].concat.apply([], stts.map(function (t) { return u32(t[0]).concat(u32(t[1])); }))),
                penuh('stss', 0, 0, u32(kunci.length), [].concat.apply([], kunci.map(u32))),
                penuh('stsc', 0, 0, u32(1), u32(1), u32(sampel.length), u32(1)),
                penuh('stsz', 0, 0, u32(0), u32(sampel.length), [].concat.apply([], sampel.map(function (x) { return u32(x.data.length); }))),
                penuh('stco', 0, 0, u32(1), u32(offset)))))));
    }
    const ftyp = kotak('ftyp', enc.encode('isom'), u32(512), enc.encode('isomiso2avc1mp41'));
    const ukuranMoov = buatMoov(0).length;
    const moov = buatMoov(ftyp.length + ukuranMoov + 8);
    let n = 0;
    sampel.forEach(function (x) { n += x.data.length; });
    const mdatHead = new Uint8Array(u32(n + 8).concat([109, 100, 97, 116]));
    return new Blob([ftyp, moov, mdatHead].concat(sampel.map(function (x) { return x.data; })), { type: 'video/mp4' });
  }
  /**
   * Kecilkan video lewat WebCodecs: video diputar setengah kecepatan, setiap bingkai digambar ke
   * kanvas w×h lalu disandikan H.264. Waktu tiap bingkai diambil dari video asli, jadi hasilnya
   * tetap berkecepatan normal dan tidak ada bingkai yang hilang walau komputernya lambat.
   */
  function kecilkanVideoWC(src, w, h) {
    if (!window.VideoEncoder || !window.VideoFrame || !('requestVideoFrameCallback' in HTMLVideoElement.prototype)) return Promise.reject(new Error('WebCodecs tidak tersedia'));
    const bitrate = Math.round(Math.max(1500000, 5000000 * (w * h) / (1920 * 1080)));
    const calon = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028'].map(function (c) {
      return { codec: c, width: w, height: h, bitrate: bitrate, framerate: 30, avc: { format: 'avc' } };
    });
    function pilihKonfig(i) {
      if (i >= calon.length) return Promise.reject(new Error('H.264 tidak didukung'));
      return VideoEncoder.isConfigSupported(calon[i]).then(function (r) { return r && r.supported ? calon[i] : pilihKonfig(i + 1); }, function () { return pilihKonfig(i + 1); });
    }
    return pilihKonfig(0).then(function (cfg) {
      return new Promise(function (resolve, reject) {
        const sampel = [];
        let avcc = null, selesai = false, batas = null, terakhir = -1, n = 0, salah = null;
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext('2d');
        const dijeda = Array.prototype.filter.call(document.querySelectorAll('video'), function (x) { return !x.paused; });
        dijeda.forEach(function (x) { x.pause(); });
        const encoder = new VideoEncoder({
          output: function (chunk, meta) {
            if (meta && meta.decoderConfig && meta.decoderConfig.description && !avcc) {
              const d = meta.decoderConfig.description;
              avcc = new Uint8Array(d.buffer ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d.slice(0));
            }
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            sampel.push({ data: data, ts: chunk.timestamp, dur: chunk.duration, key: chunk.type === 'key' });
          },
          error: function (e) { salah = e; }
        });
        const akhiri = function (err, blob) {
          if (selesai) return;
          selesai = true;
          clearTimeout(batas);
          v.onerror = null;
          try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* abaikan */ }
          try { if (encoder.state !== 'closed') encoder.close(); } catch (e) { /* abaikan */ }
          dijeda.forEach(function (x) { if (x.isConnected) { const p = x.play(); if (p && p.catch) p.catch(function () {}); } });
          if (err) reject(err); else resolve(blob);
        };
        try { encoder.configure(cfg); } catch (e) { akhiri(e); return; }
        const bingkai = function (now, m) {
          if (selesai) return;
          const ts = Math.round(m.mediaTime * 1e6);
          if (ts > terakhir) {
            terakhir = ts;
            try {
              ctx.drawImage(v, 0, 0, w, h);
              const f = new VideoFrame(cv, { timestamp: ts, duration: 33333 });
              encoder.encode(f, { keyFrame: n % 60 === 0 });
              f.close();
              n++;
            } catch (e) { akhiri(e); return; }
          }
          if (!v.ended) v.requestVideoFrameCallback(bingkai);
        };
        v.onerror = function () { akhiri(new Error('Video tidak terbaca')); };
        v.onended = function () {
          encoder.flush().then(function () {
            if (salah) throw salah;
            if (!avcc || !sampel.length) throw new Error('Hasil sandi kosong');
            if (n < (v.duration || VIDEO_MAKS_DETIK) * 20) throw new Error('Hanya ' + n + ' bingkai');
            for (let i = 1; i < sampel.length; i++) if (sampel[i].ts <= sampel[i - 1].ts) throw new Error('Urutan bingkai tidak lazim');
            akhiri(null, susunMp4(sampel, avcc, w, h));
          }).catch(function (e) { akhiri(e); });
        };
        v.onloadeddata = function () {
          batas = setTimeout(function () { akhiri(new Error('Waktu habis')); }, (v.duration || VIDEO_MAKS_DETIK) * 6000 + 10000);
          v.requestVideoFrameCallback(bingkai);
          v.playbackRate = 0.5;
          const p = v.play();
          if (p && p.catch) p.catch(function () { akhiri(new Error('Video tidak bisa diputar')); });
        };
        v.src = src;
      });
    });
  }
  function siapkanVideo(file, maks) {
    const bisaWC = !!(window.VideoEncoder && window.VideoFrame && ('requestVideoFrameCallback' in HTMLVideoElement.prototype));
    const mimeRek = (bisaWC || mimeRekamMp4()) ? (mimeRekamMp4() || 'wc') : '';
    return new Promise(function (resolve, reject) {
      const mime = jenisVideo(file);
      if (!/^video\/(mp4|webm|quicktime)$/.test(mime)) { reject(errPengguna('Format video harus MP4, WEBM, atau MOV.')); return; }
      const batasMb = mimeRek ? VIDEO_MAKS_MB_ASLI : VIDEO_MAKS_MB;
      if (file.size > batasMb * 1024 * 1024) {
        reject(errPengguna('Video terlalu besar (' + (file.size / 1048576).toFixed(1) + ' MB). Maksimal ' + batasMb + ' MB. Rekam ulang dengan resolusi 1080p atau 720p.'));
        return;
      }
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      let selesai = false;
      const gagal = function (pesan) {
        if (selesai) return;
        selesai = true;
        clearTimeout(batas);
        URL.revokeObjectURL(url);
        reject(errPengguna(pesan));
      };
      const batas = setTimeout(function () { gagal('Video tidak bisa dibaca. Gunakan video MP4 (H.264).'); }, 20000);
      v.onerror = function () { gagal('Video tidak bisa diputar di browser ini. Gunakan video MP4 (H.264).'); };
      v.onloadedmetadata = function () {
        if (!isFinite(v.duration) || v.duration <= 0) { gagal('Durasi video tidak terbaca. Gunakan video MP4 (H.264).'); return; }
        if (v.duration > VIDEO_MAKS_DETIK + 0.5) {
          gagal('Video berdurasi ' + v.duration.toFixed(1).replace('.', ',') + ' detik. Maksimal ' + VIDEO_MAKS_DETIK + ' detik, potong dulu videonya.');
          return;
        }
        v.currentTime = Math.min(0.1, v.duration / 2);
      };
      v.onseeked = function () {
        if (selesai) return;
        if (!v.videoWidth || !v.videoHeight) { gagal('Video tidak bisa diputar di browser ini. Gunakan video MP4 (H.264).'); return; }
        const skala = Math.min(1, maks / Math.max(v.videoWidth, v.videoHeight));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(v.videoWidth * skala));
        cv.height = Math.max(1, Math.round(v.videoHeight * skala));
        cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
        const durasi = v.duration;
        const sk = Math.min(1, VIDEO_SISI_MAKS / Math.max(v.videoWidth, v.videoHeight));
        const w = Math.max(2, Math.round(v.videoWidth * sk / 2) * 2);
        const h = Math.max(2, Math.round(v.videoHeight * sk / 2) * 2);
        // Lepas dekoder video asli (4K sangat berat) sebelum direkam ulang.
        v.onerror = null;
        try { v.removeAttribute('src'); v.load(); } catch (e) { /* abaikan */ }
        cv.toBlob(function (blob) {
          if (!blob) { gagal('Sampul video gagal dibuat. Pilih video lain.'); return; }
          selesai = true;
          clearTimeout(batas);
          let proses;
          if (mimeRek) {
            kabar('Mengecilkan video ke ' + w + '×' + h + ' agar ringan di HP… tunggu ±' + Math.ceil(durasi * 2 + 2) + ' detik, jangan pindah tab.', 'info');
            // Utama: WebCodecs (tiap bingkai utuh). Cadangan: MediaRecorder. Terakhir: file asli.
            const lewatWC = bisaWC ? kecilkanVideoWC(url, w, h) : Promise.reject(new Error('WebCodecs tidak tersedia'));
            proses = lewatWC.catch(function (e) {
              console.warn('[Kost AB6] WebCodecs gagal, mencoba MediaRecorder.', e && e.message);
              if (mimeRek === 'wc') throw e;
              return kecilkanVideo(url, w, h, mimeRek);
            }).then(function (hasil) {
              URL.revokeObjectURL(url);
              return { blob: hasil, mime: 'video/mp4', url: URL.createObjectURL(hasil) };
            }, function (e) {
              console.warn('[Kost AB6] Video gagal dikecilkan, memakai file asli.', e && e.message);
              if (file.size > VIDEO_MAKS_MB * 1024 * 1024) throw errPengguna('Video gagal dikecilkan dan file aslinya lebih dari ' + VIDEO_MAKS_MB + ' MB. Rekam ulang dengan resolusi 1080p.');
              return { blob: file, mime: mime, url: url };
            });
          } else {
            proses = Promise.resolve({ blob: file, mime: mime, url: url });
          }
          proses.then(function (vid) {
            if (vid.blob.size > VIDEO_MAKS_MB * 1024 * 1024) throw errPengguna('Video masih terlalu besar (' + (vid.blob.size / 1048576).toFixed(1) + ' MB). Maksimal ' + VIDEO_MAKS_MB + ' MB.');
            return Promise.all([bacaBase64(blob), bacaBase64(vid.blob)]).then(function (hh) {
              resolve({ base64: hh[0], mime: 'image/jpeg', url: URL.createObjectURL(blob), video: { base64: hh[1], mime: vid.mime, url: vid.url, durasi: durasi, ukuran: vid.blob.size } });
            });
          }).catch(reject);
        }, 'image/jpeg', 0.82);
      };
      v.src = url;
    });
  }

  /* ---------- Pemutaran di banner Beranda ---------- */
  // Drive menolak <video> dari situs lain, jadi isi video diambil lewat API (base64),
  // disimpan di Cache Storage browser, lalu diputar dari blob.
  var VIDEO_CACHE = 'ab6-video-banner-v1';
  var VIDEO_URL = {};
  var aktif = false, mulaiVideo = 0, menungguSentuhan = false;
  var GERAK_MINIM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function idValid(id) { return /^[A-Za-z0-9_-]{10,200}$/.test(String(id || '')); }
  function daftarVideo() { return Array.prototype.slice.call(document.querySelectorAll('#hero-slider .slide-video')); }
  function daftarSlide() { return Array.prototype.slice.call(document.querySelectorAll('#hero-slider .slide')); }
  function hematData() {
    try { return !!(navigator.connection && navigator.connection.saveData); } catch (e) { return false; }
  }
  function kunciCache(id) { return location.origin + '/__video-banner/' + encodeURIComponent(id); }
  function base64KeBlob(b64, mime) {
    var biner = atob(b64), n = biner.length, buf = new Uint8Array(n);
    for (var i = 0; i < n; i++) buf[i] = biner.charCodeAt(i);
    return new Blob([buf], { type: mime || 'video/mp4' });
  }
  function bukaCache() {
    try { return ('caches' in window) ? caches.open(VIDEO_CACHE).catch(function () { return null; }) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); }
  }
  function muatVideo(id) {
    if (!idValid(id)) return Promise.reject(new Error('ID video tidak valid'));
    if (VIDEO_URL[id]) return VIDEO_URL[id];
    VIDEO_URL[id] = bukaCache().then(function (c) {
      return (c ? c.match(kunciCache(id)).catch(function () { return null; }) : Promise.resolve(null)).then(function (r) {
        if (r) return r.blob();
        return panggil('ambilVideoBanner', id).then(function (d) {
          if (!d || !d.base64) throw new Error('Video kosong');
          var blob = base64KeBlob(d.base64, d.mime);
          if (c) c.put(kunciCache(id), new Response(blob, { headers: { 'Content-Type': blob.type } })).catch(function () {});
          return blob;
        });
      });
    }).then(function (blob) {
      if (!blob || !blob.size) throw new Error('Video kosong');
      return URL.createObjectURL(blob);
    });
    VIDEO_URL[id].catch(function (e) {
      delete VIDEO_URL[id];
      console.warn('[Kost AB6] Video banner belum bisa dimuat.', e && e.message);
    });
    return VIDEO_URL[id];
  }
  /** Video lama yang tidak dipakai banner dihapus dari simpanan browser. */
  function rapikanCache(idDipakai) {
    bukaCache().then(function (c) {
      if (!c) return;
      return c.keys().then(function (ks) {
        ks.forEach(function (k) {
          var id = decodeURIComponent(String(k.url).split('/__video-banner/')[1] || '');
          if (id && idDipakai.indexOf(id) < 0) c.delete(k).catch(function () {});
        });
      });
    }).catch(function () {});
  }
  function pasangSumber(v, lalu) {
    if (v.getAttribute('src') || !v.dataset.vid || v.dataset.muat) { if (lalu) lalu(); return; }
    v.dataset.muat = '1';
    muatVideo(v.dataset.vid).then(function (u) {
      if (!v.isConnected) return;
      v.classList.remove('gagal');
      v.src = u;
      if (lalu) lalu();
    }, function () {
      delete v.dataset.muat;
      v.classList.add('gagal');   // gambar sampul tetap tampil dan slide tidak menunggu video ini
    });
  }
  function atur() {
    var vids = daftarVideo();
    if (!vids.length) return;
    if (aktif && !GERAK_MINIM && !hematData()) {
      // Muat video slide aktif dulu, lalu slide berikutnya agar siap saat bergeser.
      var slides = daftarSlide();
      var idx = Math.max(0, slides.findIndex(function (s) { return s.classList.contains('aktif'); }));
      [idx, idx + 1].forEach(function (k) {
        var s = slides[k % slides.length], v = s && s.querySelector('.slide-video');
        if (v && !v.getAttribute('src') && !v.dataset.muat) pasangSumber(v, atur);
      });
    }
    vids.forEach(function (v) {
      var putar = aktif && !GERAK_MINIM && !document.hidden && v.parentNode.classList.contains('aktif') && !!v.getAttribute('src');
      if (putar) {
        v.muted = true;
        if (v.preload !== 'auto') v.preload = 'auto';
        if (v.paused && !v.dataset.tolak) {
          var p = v.play();
          if (p && p.catch) p.catch(function (e) {
            // Mode hemat baterai (mis. iPhone) menolak putar otomatis: coba lagi saat layar disentuh.
            if (e && e.name === 'NotAllowedError') { v.dataset.tolak = '1'; tungguSentuhan(); }
          });
        }
      } else if (!v.paused) {
        v.pause();
        try { v.currentTime = 0; } catch (e) { /* abaikan */ }
      }
    });
  }
  function tungguSentuhan() {
    if (menungguSentuhan) return;
    menungguSentuhan = true;
    var coba = function () {
      menungguSentuhan = false;
      ['touchend', 'click', 'keydown'].forEach(function (n) { window.removeEventListener(n, coba, true); });
      daftarVideo().forEach(function (v) { delete v.dataset.tolak; });
      atur();
    };
    ['touchend', 'click', 'keydown'].forEach(function (n) { window.addEventListener(n, coba, { capture: true, passive: true }); });
  }
  /**
   * Lama tayang slide: gambar 5 detik. Slide video menunggu videonya termuat (maks. 20 detik)
   * lalu tayang minimal satu putaran penuh, supaya video tidak terlewat di HP yang lambat.
   */
  function bolehGanti(lama) {
    if (lama < 5000) return false;
    var s = daftarSlide().filter(function (x) { return x.classList.contains('aktif'); })[0];
    var v = s && s.querySelector('.slide-video');
    if (!v || v.classList.contains('gagal') || v.dataset.tolak || GERAK_MINIM || hematData()) return true;
    if (mulaiVideo) return Date.now() - mulaiVideo >= Math.max(4800, ((isFinite(v.duration) && v.duration) || VIDEO_MAKS_DETIK) * 1000 - 150);
    return lama >= 20000;
  }
  document.addEventListener('playing', function (e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('slide-video')) return;
    t.classList.add('siap');
    if (t.parentNode && t.parentNode.classList.contains('aktif') && !mulaiVideo) mulaiVideo = Date.now();
  }, true);
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'VIDEO' && t.classList.contains('slide-video')) t.classList.add('gagal');
  }, true);
  document.addEventListener('visibilitychange', atur);

  /** Panel pemeriksaan: buka situs dengan ?cekvideo (mis. dari HP). */
  function panelCek() {
    var el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:rgba(11,20,15,.93);color:#F7F9F5;font:12px/1.55 monospace;padding:10px 12px;border-radius:10px;white-space:pre-line;pointer-events:none';
    document.body.appendChild(el);
    var t0 = Date.now();
    setInterval(function () {
      var v = daftarVideo()[0], st = 'tidak ada video di banner';
      if (v) {
        if (v.classList.contains('gagal') || v.error) st = 'GAGAL diputar (kode ' + (v.error ? v.error.code : '?') + ')';
        else if (v.dataset.tolak) st = 'DITOLAK putar otomatis (mode hemat baterai?), sentuh layar';
        else if (!v.getAttribute('src')) st = v.dataset.muat ? 'sedang mengunduh…' : 'belum diunduh';
        else if (!v.paused) st = 'JALAN';
        else st = 'siap, menunggu slidenya tampil';
      }
      el.textContent = 'CEK VIDEO BANNER\nKurangi animasi di HP: ' + (GERAK_MINIM ? 'YA (video dimatikan)' : 'tidak') + '\nHemat data: ' + (hematData() ? 'YA (video dimatikan)' : 'tidak') +
        '\nStatus: ' + st + '\n' + (v && v.videoWidth ? 'Resolusi video: ' + v.videoWidth + '×' + v.videoHeight + '\n' : '') + Math.round((Date.now() - t0) / 1000) + ' detik';
    }, 500);
  }
  if (/[?&]cekvideo\b/.test(location.search)) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panelCek); else panelCek();
  }

  window.VideoBanner = {
    aktif: function (on) { aktif = on; atur(); },
    slideBaru: function () { mulaiVideo = 0; atur(); },
    bolehGanti: bolehGanti,
    rapikan: rapikanCache,
    pilih: siapkanVideo,
    adalahVideo: jenisVideo,
    pratinjau: function (v) { pasangSumber(v, function () { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }); },
    MAKS_DETIK: VIDEO_MAKS_DETIK
  };
})();
