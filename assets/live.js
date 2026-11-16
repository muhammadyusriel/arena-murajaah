/* Arena Muraja'ah — kuis langsung via HP (Firebase Realtime Database) */
(function () {
  "use strict";
  const C = window.ArenaCore; const { h, shuffle, rnd, store, toast, copyText, downloadText, SHAPES, CATS, prepare, D, S, timerEl, confetti, SEAL } = C;
  const SDK = (window.ARENA_SDK_BASE || "https://www.gstatic.com/firebasejs/10.12.2/");

  // ---------------- transport ----------------
  const loadScript = (src) => new Promise((res, rej) => { if ([...document.scripts].some((s) => s.src === src)) return res(); const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Gagal memuat " + src)); document.head.append(s); });
  let NET = null;
  async function initNet(mode) {
    if (NET) return NET;
    const cfg = window.ARENA_FIREBASE;
    if (mode !== "demo" && cfg && cfg.apiKey) {
      for (const f of ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-database-compat.js"]) await loadScript(SDK + f);
      const fb = window.firebase; if (!fb.apps.length) fb.initializeApp(cfg);
      if (cfg.emulator) { fb.auth().useEmulator(cfg.emulator.auth); fb.database().useEmulator(cfg.emulator.host, cfg.emulator.port); }
      const cred = await fb.auth().signInAnonymously();
      const db = fb.database(); let offset = 0;
      db.ref(".info/serverTimeOffset").on("value", (s) => (offset = s.val() || 0));
      NET = {
        kind: "firebase", uid: cred.user.uid, TS: fb.database.ServerValue.TIMESTAMP, now: () => Date.now() + offset,
        set: (p, v) => db.ref(p).set(v), update: (p, v) => db.ref(p).update(v), get: (p) => db.ref(p).get().then((s) => s.val()), remove: (p) => db.ref(p).remove(),
        on: (p, cb) => { const r = db.ref(p); const f = (s) => cb(s.val()); r.on("value", f); return () => r.off("value", f); },
        onConnected: (cb) => { const r = db.ref(".info/connected"); const f = (s) => cb(!!s.val()); r.on("value", f); return () => r.off("value", f); },
      };
      return NET;
    }
    if (mode === "demo" || (window.ARENA_DEMO && !cfg)) { NET = localNet(); return NET; }
    return null;
  }
  // Mode demo: beberapa tab di satu peramban saling terhubung (untuk mencoba tanpa server)
  function localNet() {
    const KEY = "arena:localdb"; const bc = "BroadcastChannel" in window ? new BroadcastChannel("arena-localdb") : null;
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    let tree = read(); const ls = new Set();
    const parts = (p) => p.split("/").filter(Boolean);
    const getAt = (t, p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), t);
    const fill = (v) => (v && typeof v === "object" ? (v[".sv"] === "timestamp" ? Date.now() : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)]))) : v);
    const setAt = (t, p, v) => { const ks = parts(p); let o = t; ks.slice(0, -1).forEach((k) => { if (typeof o[k] !== "object" || o[k] == null) o[k] = {}; o = o[k]; }); if (v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = fill(v); };
    const notify = () => ls.forEach((l) => { const v = getAt(tree, l.p); const s = JSON.stringify(v === undefined ? null : v); if (s !== l.last) { l.last = s; l.cb(JSON.parse(s)); } });
    const commit = () => { try { localStorage.setItem(KEY, JSON.stringify(tree)); } catch (e) { /* */ } bc && bc.postMessage(1); setTimeout(notify, 0); };
    if (bc) bc.onmessage = () => { tree = read(); notify(); };
    window.addEventListener("storage", (e) => { if (e.key === KEY) { tree = read(); notify(); } });
    let uid = null; try { uid = sessionStorage.getItem("arena:uid"); } catch (e) { /* */ } if (!uid) { uid = "u" + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem("arena:uid", uid); } catch (e) { /* */ } }
    return {
      kind: "demo", uid, TS: { ".sv": "timestamp" }, now: () => Date.now(),
      set: async (p, v) => { tree = read(); setAt(tree, p, v); commit(); },
      update: async (p, v) => { tree = read(); Object.entries(v).forEach(([k, x]) => setAt(tree, p + "/" + k, x)); commit(); },
      get: async (p) => { tree = read(); const v = getAt(tree, p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); },
      remove: async (p) => { tree = read(); setAt(tree, p, null); commit(); },
      on: (p, cb) => { const l = { p, cb, last: undefined }; ls.add(l); setTimeout(notify, 0); return () => ls.delete(l); },
      onConnected: (cb) => { cb(true); return () => {}; },
    };
  }

  const joinUrl = (code) => location.origin + location.pathname + "?room=" + code + (NET && NET.kind === "demo" ? "&demo=1" : "");
  const COLORS_NAME = ["teal", "oranye", "kuning", "ungu"];

  // ---------------- HOST (layar dosen / proyektor) ----------------
  function host(root) {
    const wrap = h("div", { class: "wrap" }); root.append(wrap);
    const offs = []; C.onLeave(() => offs.forEach((f) => f()));
    const cfgOK = !!(window.ARENA_FIREBASE && window.ARENA_FIREBASE.apiKey);
    const settings = store.get("live-settings", { count: 15, limit: 20, cats: ["makna", "muradif", "akmil", "fahm", "tarakib", "tasykil"] });
    const saved = store.get("live-session", null);

    function setup() {
      wrap.innerHTML = ""; wrap.append(C.topbar("الْمُسَابَقَةُ الْمُبَاشِرَةُ", "Kuis langsung via HP"));
      if (!cfgOK) wrap.append(h("div", { class: "panel", style: { borderColor: "var(--coral)" } },
        h("b", null, "Server kuis belum diatur."), h("p", { class: "sub", style: { lineHeight: 1.6 } }, "Isi berkas config.js dengan konfigurasi Firebase (lihat Panduan Setup), lalu unggah ulang aplikasi. Sambil menunggu, Ustadz bisa mencoba mode demo: buka tautan peserta di tab lain pada peramban yang sama."),
        h("button", { class: "btn", type: "button", onclick: () => start("demo") }, "Coba mode demo")));
      const catBoxes = CATS.map((c) => h("label", { class: "row", style: { gap: "8px" } }, h("input", { type: "checkbox", id: "cat-" + c.id, checked: settings.cats.includes(c.id), onchange: (e) => { settings.cats = settings.cats.filter((x) => x !== c.id); if (e.target.checked) settings.cats.push(c.id); store.set("live-settings", settings); } }), h("span", { class: "ar", style: { fontSize: "20px" } }, c.ar), h("span", { class: "sub" }, c.id_)));
      const sel = (id, label, vals, key, fmt) => h("label", { class: "row" }, h("span", { style: { minWidth: "120px" } }, label), (() => { const dd = C.dropdown(vals.map((v) => ({ value: v, label: fmt(v) })), settings[key], (v) => { settings[key] = v; store.set("live-settings", settings); }, label); dd.id = id; return dd; })());
      wrap.append(h("div", { class: "lobby" },
        h("div", { class: "panel", style: { display: "flex", flexDirection: "column", gap: "12px" } }, h("b", null, "Pengaturan"),
          sel("cnt", "Jumlah soal", [10, 15, 20, 25], "count", (v) => v + " soal"), sel("lim", "Waktu per soal", [15, 20, 30, 45], "limit", (v) => v + " detik"),
          h("button", { class: "btn primary", type: "button", disabled: !cfgOK, onclick: () => start("firebase") }, "Buat ruang kuis"),
          saved && Date.now() - saved.at < 4 * 3600e3 ? h("button", { class: "btn", type: "button", onclick: () => resume() }, "Lanjutkan ruang " + saved.code) : null),
        h("div", { class: "panel", style: { display: "flex", flexDirection: "column", gap: "10px" } }, h("b", null, "Jenis soal yang diikutkan"), ...catBoxes,
          h("p", { class: "sub" }, "Soal diambil acak dan merata dari jenis yang dipilih. Skor: jawaban benar 500–1000 poin, makin cepat makin tinggi."))));
    }

    function buildQuestions() {
      const cats = shuffle(settings.cats.length ? settings.cats : ["makna", "fahm"]);
      const pools = Object.fromEntries(cats.map((c) => [c, shuffle(D().bank[c])]));
      const out = []; let k = 0, guard = 0;
      while (out.length < settings.count && guard++ < 500) { const c = cats[k++ % cats.length]; const q = pools[c].pop(); if (q) out.push(prepare(q, c)); }
      return out.map((q) => ({ q: q.q, s: q.s || null, bare: q.bare || null, o: q.o, a: q.a, tf: !!q.tf, cat: q.cat, n: q.n || 0, x: q.x || null, fix: q.fix || null }));
    }

    let net, code, QS, i = -1, players = {}, unsubAns = null;
    async function start(mode) {
      try { net = await initNet(mode); } catch (e) { toast("Tidak bisa terhubung ke server: " + e.message); return; }
      if (!net) return toast("Server belum diatur");
      QS = buildQuestions(); if (!QS.length) return toast("Pilih minimal satu jenis soal");
      for (let t = 0; t < 8; t++) { code = String(1000 + rnd(9000)); const ex = await net.get("rooms/" + code + "/host"); if (!ex) break; }
      await net.set("rooms/" + code, { host: net.uid, created: net.TS, wahdah: S.wahdah, title: D().title, state: { phase: "lobby" } });
      i = -1; persist(); lobby();
    }
    async function resume() {
      try { net = await initNet(saved.mode); } catch (e) { return toast("Tidak bisa terhubung"); }
      code = saved.code; QS = saved.QS; i = saved.i; const h0 = await net.get("rooms/" + code + "/host");
      if (h0 !== net.uid) { store.set("live-session", null); toast("Ruang lama tidak bisa dilanjutkan"); return setup(); }
      if (i < 0) lobby(); else showBoard();
    }
    const persist = () => store.set("live-session", { code, QS, i, at: Date.now(), mode: net.kind });
    const R = (p) => "rooms/" + code + (p ? "/" + p : "");
    function watchPlayers(cb) { offs.push(net.on(R("players"), (v) => { players = v || {}; cb && cb(); })); }

    function lobby() {
      wrap.innerHTML = ""; wrap.append(C.topbar("الْمُسَابَقَةُ الْمُبَاشِرَةُ", "Ruang " + code));
      const qr = h("div", { id: "qr" }); const list = h("div", { class: "players" }); const count = h("span", { class: "bigcount" }, "0");
      const url = joinUrl(code);
      wrap.append(h("div", { class: "lobby" },
        h("div", { class: "qrbox" }, h("b", null, "Pindai untuk bergabung"), qr, h("div", null, "Kode ruang"), h("div", { class: "code" }, code), h("div", { class: "url" }, url),
          h("button", { class: "btn small", type: "button", style: { color: "#0A1B44", background: "#EEF3FF" }, onclick: () => copyText(url) }, "Salin tautan")),
        h("div", { class: "panel", style: { display: "flex", flexDirection: "column", gap: "14px" } },
          h("div", { class: "row" }, count, h("span", { class: "sub grow" }, "mahasiswa sudah masuk"), h("span", { class: "pill" }, QS.length + " soal · " + settings.limit + " dtk")),
          list,
          h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: () => ask(0) }, "Mulai kuis →"), h("span", { class: "sub" }, "Mahasiswa yang datang terlambat tetap bisa masuk di tengah kuis.")))));
      if (window.QRCode) { try { new window.QRCode(qr, { text: url, width: 560, height: 560, colorDark: "#0A1B44", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) { /* */ } }
      else qr.append(h("p", { class: "sub" }, "(QR tidak tersedia, gunakan kode)"));
      watchPlayers(() => { const arr = Object.values(players); count.textContent = arr.length; list.innerHTML = ""; arr.sort((a, b) => (a.joined || 0) - (b.joined || 0)).forEach((p) => list.append(h("span", { class: "pchip" }, p.name))); });
    }

    let timer = null, revealed = false, curAns = {};
    async function ask(idx) {
      i = idx; persist(); revealed = false; curAns = {};
      offs.forEach((f) => f()); offs.length = 0;
      const q = QS[i]; const limit = settings.limit;
      await net.set(R("state"), { phase: "question", i, key: "q" + i, total: QS.length, q: { q: q.q, s: q.s, bare: q.bare, o: q.o, tf: q.tf, cat: q.cat }, limit, startedAt: net.TS });
      const st = await net.get(R("state")); const startedAt = st.startedAt;
      wrap.innerHTML = "";
      timer = timerEl(limit, () => reveal());
      const cnt = h("span", { class: "pill" }, "0 menjawab");
      const opts = C.optButtons(q, null); opts.querySelectorAll(".opt").forEach((b) => (b.style.cursor = "default"));
      const extra = h("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } });
      wrap.append(h("div", { class: "stage-inner", style: { margin: "0 auto" } },
        h("div", { class: "qhead" }, h("span", { class: "pill gold" }, "Soal " + (i + 1) + " / " + QS.length), h("span", { class: "pill ar", style: { fontSize: "18px" } }, C.catOf(q.cat).ar), h("span", { class: "grow" }), cnt, timer.el,
          h("button", { class: "btn small", type: "button", id: "skip", onclick: () => reveal() }, "Tutup jawaban")),
        ...C.renderQ({ ...q }), opts, extra));
      const rem = Math.max(0, (startedAt + limit * 1000 - net.now()) / 1000);
      timer.start(rem);
      function updCount() { const n = Object.keys(curAns).length; const tot = Object.keys(players).length; cnt.textContent = n + " / " + tot + " menjawab"; if (tot > 0 && n >= tot && !revealed) setTimeout(reveal, 600); }
      watchPlayers(() => updCount());
      offs.push(net.on(R("answers/q" + i), (v) => { curAns = v || {}; updCount(); }));
      async function reveal() {
        if (revealed) return; revealed = true; timer.stop(); const sk = wrap.querySelector("#skip"); if (sk) sk.remove();
        const answers = (await net.get(R("answers/q" + i))) || {}; const scores = (await net.get(R("scores"))) || {};
        const dist = q.o.map(() => 0); const upd = {}; const lim = limit * 1000;
        Object.keys(players).forEach((uid) => {
          const a = answers[uid]; const prev = scores[uid] || { score: 0, right: 0, streak: 0 };
          let ok = false, pts = 0;
          if (a && typeof a.c === "number" && a.c >= 0 && a.c < q.o.length) {
            dist[a.c]++; const el = Math.max(0, (a.t || startedAt) - startedAt);
            if (a.c === q.a && el <= lim + 2500) { ok = true; pts = Math.round(1000 - 500 * Math.min(1, el / lim)); }
          }
          upd[uid] = { score: (prev.score || 0) + pts, right: (prev.right || 0) + (ok ? 1 : 0), streak: ok ? (prev.streak || 0) + 1 : 0, last: { ok, pts, answered: !!a } };
        });
        const ranked = Object.entries(upd).sort((x, y) => y[1].score - x[1].score); ranked.forEach(([uid, s], k) => (s.rank = k + 1));
        if (Object.keys(upd).length) await net.set(R("scores"), upd);
        await net.update(R("state"), { phase: "reveal", a: q.a, dist });
        C.revealOpts(opts, q.a, null);
        const qh = wrap.querySelector(".qhead"); if (qh) qh.append(h("button", { class: "btn primary", type: "button", onclick: showBoard }, "Papan skor →"));
        const max = Math.max(1, ...dist);
        extra.append(h("div", { class: "dist" + (q.tf ? " tf" : "") }, dist.map((d, k) => h("div", { class: "bar" + (k === q.a ? "" : " wrong"), style: { height: (12 + (d / max) * 88) + "%" } }, d))),
          ...C.noteFor(q),
          h("div", { class: "row", style: { justifyContent: "center" } }, h("button", { class: "btn primary", type: "button", id: "next", onclick: showBoard }, "Papan skor →")));
        const nx = wrap.querySelector("#next"); nx && nx.focus();
      }
    }

    async function showBoard() {
      const scores = (await net.get(R("scores"))) || {}; const ps = (await net.get(R("players"))) || {}; players = ps;
      const last = i >= QS.length - 1;
      await net.update(R("state"), { phase: last ? "end" : "board" });
      persist();
      const ranked = Object.entries(scores).map(([uid, s]) => ({ uid, name: (ps[uid] || {}).name || "?", ...s })).sort((a, b) => b.score - a.score);
      wrap.innerHTML = "";
      if (last) return finish(ranked);
      wrap.append(h("div", { class: "stage-inner", style: { margin: "0 auto" } },
        h("div", { class: "qhead" }, h("span", { class: "pill gold" }, "Setelah soal " + (i + 1) + " / " + QS.length), h("span", { class: "grow" })),
        h("h2", { class: "h-ar", style: { textAlign: "center" } }, "لَوْحَةُ الصَّدَارَةِ"),
        h("div", { class: "lb" }, ranked.slice(0, 8).map((r, k) => h("div", { class: "r" }, h("span", { class: "rk" }, k + 1), h("span", { class: "nm" }, r.name, r.streak >= 3 ? "  🔥" + r.streak : ""), h("b", null, r.score)))),
        ranked.length ? null : h("p", { class: "empty" }, "Belum ada peserta."),
        h("div", { class: "row", style: { justifyContent: "center" } }, h("button", { class: "btn primary", type: "button", id: "next", onclick: () => ask(i + 1) }, "Soal berikutnya →"))));
      const nx = wrap.querySelector("#next"); nx && nx.focus();
    }

    function finish(ranked) {
      confetti(); const top = ranked.slice(0, 3); const order = [top[1], top[0], top[2]];
      const csv = ["Peringkat,Nama,Skor,Benar,Jumlah Soal", ...ranked.map((r, k) => [k + 1, '"' + String(r.name).replace(/"/g, '""') + '"', r.score, r.right || 0, QS.length].join(","))].join("\n");
      wrap.append(h("div", { class: "stage-inner", style: { margin: "0 auto" } },
        h("h2", { class: "h-ar", style: { textAlign: "center", fontSize: "40px" } }, "مَبْرُوكٌ لِلْفَائِزِينَ"),
        h("div", { class: "podium" }, order.map((r, k) => h("div", { class: "p" }, r ? h("span", { class: "nm" }, r.name) : h("span", { class: "nm" }, "—"), h("span", { class: "sub" }, r ? r.score + " poin" : ""), h("div", { class: "blk" }, [2, 1, 3][k])))),
        h("div", { class: "lb" }, ranked.map((r, k) => h("div", { class: "r" }, h("span", { class: "rk" }, k + 1), h("span", { class: "nm" }, r.name), h("b", null, r.score + " · " + (r.right || 0) + "/" + QS.length + " benar")))),
        h("div", { class: "row", style: { justifyContent: "center" } },
          h("button", { class: "btn primary", type: "button", onclick: () => downloadText("hasil-kuis-wahdah-" + S.wahdah + "-" + code + ".csv", csv) }, "Unduh hasil (CSV)"),
          h("button", { class: "btn", type: "button", onclick: () => copyText(csv.replace(/,/g, "\t")) }, "Salin untuk Excel"),
          h("button", { class: "btn ghost", type: "button", onclick: async () => { await net.remove(R()); store.set("live-session", null); toast("Ruang dihapus"); C.go("home"); } }, "Tutup & hapus ruang"))));
    }

    setup();
  }

  // ---------------- PLAYER (HP mahasiswa) ----------------
  async function player(root, codeIn) {
    const params = new URLSearchParams(location.search);
    const box = h("div", { class: "player" }); root.append(box);
    const head = h("header", { class: "brand", html: SEAL + '<div><h1 class="ui-ar">Arena Muraja\'ah</h1><small>Peserta</small></div>' });
    const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } });
    box.append(head, body);
    const say = (...k) => { body.innerHTML = ""; body.append(...k); };
    say(h("p", { class: "status" }, "Menghubungkan…"));
    let net;
    try { net = await initNet(params.has("demo") ? "demo" : "firebase"); } catch (e) { return say(h("div", { class: "card-p" }, h("b", null, "Tidak bisa terhubung ke server."), h("p", { class: "sub" }, "Periksa koneksi internet, lalu muat ulang halaman."))); }
    if (!net) return say(h("div", { class: "card-p" }, h("b", null, "Server kuis belum diatur oleh dosen.")));
    let code = (codeIn || "").replace(/\D/g, "").slice(0, 4);
    const myName = store.get("pname", "");

    function joinForm(msg) {
      const ci = h("input", { type: "text", id: "code", class: "code-in", inputmode: "numeric", maxlength: 4, placeholder: "Kode", value: code, "aria-label": "Kode ruang" });
      const ni = h("input", { type: "text", id: "pname", maxlength: 30, placeholder: "Nama kamu", value: myName, "aria-label": "Nama", autocomplete: "name" });
      const f = h("form", { class: "card-p", onsubmit: async (e) => {
        e.preventDefault(); const c = ci.value.replace(/\D/g, ""); const n = ni.value.trim().replace(/\s+/g, " ").slice(0, 30);
        if (c.length !== 4) return toast("Kode ruang 4 angka"); if (n.length < 2) return toast("Tulis namamu");
        const hostId = await net.get("rooms/" + c + "/host"); if (!hostId) return toast("Ruang " + c + " tidak ditemukan");
        code = c; store.set("pname", n); await net.set("rooms/" + c + "/players/" + net.uid, { name: n, joined: net.TS }); listen();
      } }, msg ? h("p", { class: "sub" }, msg) : null, h("label", null, h("span", { class: "sub" }, "Kode ruang"), ci), h("label", null, h("span", { class: "sub" }, "Nama"), ni), h("button", { class: "btn primary", type: "submit", style: { fontSize: "18px", padding: "14px" } }, "Masuk"));
      say(f); (code ? ni : ci).focus();
    }

    let state = null, me = null, myScore = null, answeredKey = null, tmr = null;
    function listen() {
      const R = (p) => "rooms/" + code + "/" + p;
      net.on(R("players/" + net.uid), (v) => { me = v; if (!v) joinForm("Silakan masuk lagi."); });
      net.on(R("scores/" + net.uid), (v) => { myScore = v; render(); });
      net.on(R("state"), (v) => { state = v; render(); });
      net.on("rooms/" + code + "/host", (v) => { if (!v) say(h("div", { class: "card-p" }, h("b", null, "Kuis sudah ditutup oleh dosen."), h("p", { class: "sub" }, "Terima kasih sudah ikut!"))); });
    }
    let lastRender = "", tok = 0;
    async function render() {
      if (!state || !me) return; const my = ++tok;
      const sig = [state.phase, state.i, answeredKey, myScore && myScore.score, myScore && myScore.rank].join("|"); if (sig === lastRender) return; lastRender = sig;
      if (tmr) { tmr.stop(); tmr = null; }
      const scoreLine = h("div", { class: "row" }, h("span", { class: "pill" }, me.name), h("span", { class: "grow" }), h("span", { class: "pill gold" }, (myScore ? myScore.score : 0) + " poin"));
      if (state.phase === "lobby") return say(scoreLine, h("div", { class: "card-p" }, h("p", { class: "qtext", dir: "rtl" }, "أَهْلًا وَسَهْلًا"), h("p", { class: "status" }, "Kamu sudah masuk. Lihat namamu di layar, lalu tunggu dosen memulai.")));
      const q = state.q || {};
      if (state.phase === "question") {
        const key = state.key; const mine = await net.get("rooms/" + code + "/answers/" + key + "/" + net.uid);
        if (my !== tok) return;
        if (mine || answeredKey === key) { answeredKey = key; return say(scoreLine, h("div", { class: "card-p" }, h("p", { class: "status" }, "Jawaban terkirim ✓"), h("p", { class: "sub", style: { textAlign: "center" } }, "Tunggu jawaban dibuka di layar."))); }
        const endAt = state.startedAt + state.limit * 1000; tmr = timerEl(state.limit, () => { if (answeredKey !== key) say(scoreLine, h("div", { class: "card-p" }, h("p", { class: "status" }, "Waktu habis"))); });
        const opts = C.optButtons({ o: q.o, tf: q.tf }, async (c, b) => {
          if (answeredKey === key) return; answeredKey = key; b.classList.add("picked"); opts.querySelectorAll(".opt").forEach((x) => (x.disabled = true));
          try { await net.set("rooms/" + code + "/answers/" + key + "/" + net.uid, { c, t: net.TS }); } catch (e) { toast("Waktu habis atau jawaban ditolak"); }
          lastRender = ""; render();
        });
        say(scoreLine, h("div", { class: "row" }, h("span", { class: "pill" }, "Soal " + (state.i + 1) + " / " + state.total), h("span", { class: "grow" }), tmr.el), ...C.renderQ({ ...q }, { compact: true }), opts);
        tmr.syncTo(endAt - net.now() + Date.now(), state.limit);
        return;
      }
      if (state.phase === "reveal") {
        const last = myScore && myScore.last; const ok = last && last.ok;
        return say(scoreLine, h("div", { class: "result " + (ok ? "ok" : "no") }, ok ? "Benar! +" + last.pts : last && last.answered ? "Belum tepat" : "Tidak menjawab",
          h("small", null, "Jawaban: ", h("span", { class: "ar", style: { fontSize: "22px" } }, q.o ? q.o[state.a] : ""))), myScore && myScore.rank ? h("p", { class: "status" }, "Peringkatmu sekarang: #" + myScore.rank) : null);
      }
      if (state.phase === "board") return say(scoreLine, h("div", { class: "card-p" }, h("p", { class: "status" }, "Lihat papan skor di layar."), myScore && myScore.rank ? h("div", { class: "bigcount", style: { textAlign: "center" } }, "#" + myScore.rank) : null, h("p", { class: "sub", style: { textAlign: "center" } }, "Bersiap untuk soal berikutnya…")));
      if (state.phase === "end") { if (myScore && myScore.rank <= 3) confetti(); return say(scoreLine, h("div", { class: "card-p" }, h("p", { class: "qtext", dir: "rtl" }, "انْتَهَتِ الْمُسَابَقَةُ"), h("div", { class: "bigcount", style: { textAlign: "center" } }, myScore ? "#" + myScore.rank : "—"), h("p", { class: "status" }, (myScore ? myScore.score : 0) + " poin · " + (myScore ? myScore.right || 0 : 0) + "/" + state.total + " benar"))); }
    }

    // sudah pernah bergabung di ruang ini? langsung lanjut
    if (code && myName) { const p = await net.get("rooms/" + code + "/players/" + net.uid); if (p) return listen(); }
    joinForm();
  }

  window.ArenaLive = { host, player, initNet };
})();
