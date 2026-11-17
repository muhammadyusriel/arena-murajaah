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
    if (settings.teams == null) settings.teams = 0; if (!settings.assign) settings.assign = "auto";
    if (!settings.v19) { settings.cats = settings.cats.concat(C.NEW_CATS_19.filter((c) => !settings.cats.includes(c))); settings.v19 = 1; store.set("live-settings", settings); }
    const ensureTeams = (n) => { while (S.teams.length < n) { const k = S.teams.length; S.teams.push({ name: C.TEAM_NAMES[k], color: C.TEAM_COLORS[k], score: 0 }); } C.saveTeams(); };
    let TM = null; // { list:[{name,color}], assign:"auto"|"self" } atau null (individu)

    function setup() {
      wrap.innerHTML = ""; wrap.append(C.topbar("الْمُسَابَقَةُ الْمُبَاشِرَةُ", "Kuis langsung via HP"));
      if (!cfgOK) wrap.append(h("div", { class: "panel", style: { borderColor: "var(--coral)" } },
        h("b", null, "Server kuis belum diatur."), h("p", { class: "sub", style: { lineHeight: 1.6 } }, "Isi berkas config.js dengan konfigurasi Firebase (lihat Panduan Setup), lalu unggah ulang aplikasi. Sambil menunggu, Ustadz bisa mencoba mode demo: buka tautan peserta di tab lain pada peramban yang sama."),
        h("button", { class: "btn", type: "button", onclick: () => start("demo") }, "Coba mode demo")));
      const catBoxes = CATS.map((c) => h("label", { class: "row", style: { gap: "8px" } }, h("input", { type: "checkbox", id: "cat-" + c.id, checked: settings.cats.includes(c.id), onchange: (e) => { settings.cats = settings.cats.filter((x) => x !== c.id); if (e.target.checked) settings.cats.push(c.id); store.set("live-settings", settings); } }), h("span", { class: "ar", style: { fontSize: "20px" } }, c.ar), h("span", { class: "sub" }, c.id_)));
      const sel = (id, label, vals, key, fmt, after) => h("label", { class: "row" }, h("span", { style: { minWidth: "120px" } }, label), (() => { const dd = C.dropdown(vals.map((v) => ({ value: v, label: fmt(v) })), settings[key], (v) => { settings[key] = v; store.set("live-settings", settings); after && after(v); }, label); dd.id = id; return dd; })());
      const teamBox = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } });
      const drawTeamBox = () => {
        teamBox.innerHTML = ""; const n = settings.teams; if (!n) return;
        ensureTeams(n);
        teamBox.append(sel("asg", "Pembagian", ["auto", "self"], "assign", (v) => (v === "auto" ? "Otomatis" : "Pilih sendiri")),
          h("div", { class: "tnames" }, S.teams.slice(0, n).map((t, k) => h("label", { class: "tname", style: { "--tc": t.color } }, h("span", { class: "sw" }),
            h("input", { type: "text", id: "tn-" + k, value: t.name, dir: "rtl", maxlength: 24, "aria-label": "Nama kelompok " + (k + 1), oninput: (e) => { S.teams[k].name = e.target.value; C.saveTeams(); } })))),
          h("p", { class: "sub", style: { lineHeight: 1.6 } }, "Skor kelompok = rata-rata skor anggotanya, jadi kelompok yang anggotanya lebih sedikit tetap adil. Semua anggota perlu menjawab agar rata-ratanya tinggi."));
      };
      wrap.append(h("div", { class: "lobby" },
        h("div", { class: "panel", style: { display: "flex", flexDirection: "column", gap: "12px" } }, h("b", null, "Pengaturan"),
          C.scopePicker(), C.levelPicker(),
          sel("tm", "Mode main", [0, 2, 3, 4, 5, 6], "teams", (v) => (v ? v + " kelompok" : "Individu"), () => drawTeamBox()), teamBox,
          sel("cnt", "Jumlah soal", [10, 15, 20, 25, 50, 75], "count", (v) => v + " soal"), sel("lim", "Waktu per soal", [15, 20, 30, 45, 60], "limit", (v) => (v === 60 ? "1 menit" : v + " detik")),
          h("button", { class: "btn primary", type: "button", disabled: !cfgOK, onclick: () => start("firebase") }, "Buat ruang kuis"),
          saved && Date.now() - saved.at < 4 * 3600e3 ? h("button", { class: "btn", type: "button", onclick: () => resume() }, "Lanjutkan ruang " + saved.code) : null),
        h("div", { class: "panel", style: { display: "flex", flexDirection: "column", gap: "10px" } }, h("b", null, "Jenis soal yang diikutkan"), ...catBoxes,
          h("p", { class: "sub" }, "Soal diambil acak dan merata dari jenis yang dipilih. Skor: jawaban benar 500–1000 poin, makin cepat makin tinggi."))));
      drawTeamBox();
    }

    function buildQuestions() {
      const cats = shuffle(settings.cats.length ? settings.cats : ["makna", "fahm"]);
      const sc = C.getScope(), lv = C.getLevel();
      const pools = Object.fromEntries(cats.map((c) => [c, shuffle(C.bankOf(c).filter(C.inScope(sc)).filter(C.inLevel(lv)))]));
      let out = []; let k = 0, guard = 0;
      while (out.length < settings.count && guard++ < 1000) { const c = cats[k++ % cats.length]; const q = pools[c].pop(); if (q) out.push(prepare(q, c)); }
      if (!lv) out = C.byLevel(out); // Campuran: soal bergerak dari mudah ke sulit
      return out.map((q) => ({ q: q.q, p: q.p || null, s: q.s || null, bare: q.bare || null, o: q.o, a: q.a, tf: !!q.tf, cat: q.cat, n: q.n || 0, d: C.qLevel(q), x: q.x || null, fix: q.fix || null }));
    }

    let net, code, QS, i = -1, players = {}, unsubAns = null, ST = [];
    async function start(mode) {
      try { net = await initNet(mode); } catch (e) { toast("Tidak bisa terhubung ke server: " + e.message); return; }
      if (!net) return toast("Server belum diatur");
      QS = buildQuestions(); ST = []; if (!QS.length) return toast("Pilih minimal satu jenis soal"); if (QS.length < settings.count) toast("Soal yang tersedia di cakupan ini hanya " + QS.length + ", jadi kuis memakai " + QS.length + " soal.");
      for (let t = 0; t < 8; t++) { code = String(1000 + rnd(9000)); const ex = await net.get("rooms/" + code + "/host"); if (!ex) break; }
      TM = settings.teams ? { list: S.teams.slice(0, settings.teams).map((t, k) => ({ name: (t.name || "").trim() || C.TEAM_NAMES[k], color: t.color })), assign: settings.assign } : null;
      await net.set("rooms/" + code, { host: net.uid, created: net.TS, wahdah: S.wahdah, title: D().title, state: { phase: "lobby" }, teams: TM });
      i = -1; persist(); lobby();
    }
    async function resume() {
      try { net = await initNet(saved.mode); } catch (e) { return toast("Tidak bisa terhubung"); }
      code = saved.code; QS = saved.QS; i = saved.i; ST = saved.ST || []; const h0 = await net.get("rooms/" + code + "/host"); TM = await net.get("rooms/" + code + "/teams");
      if (h0 !== net.uid) { store.set("live-session", null); toast("Ruang lama tidak bisa dilanjutkan"); return setup(); }
      const st = await net.get("rooms/" + code + "/state");
      if (i < 0 || !st || st.phase === "lobby") lobby();
      else if (st.phase === "question" && st.i === i) ask(i, st); // soal yang sedang berjalan dilanjutkan, sisa waktunya tetap
      else showBoard();
    }
    // Tombol pindah layar: langsung beri tanda "Memuat…", dan klik kedua diabaikan (v1.8.8).
    // Sebelumnya klik ganda menjalankan dua soal sekaligus sehingga jawaban dianggap "Tidak menjawab".
    let busy = false;
    const navBtn = (label, fn, attrs) => h("button", { class: "btn primary", type: "button", ...(attrs || {}), onclick: async (e) => {
      if (busy) return; busy = true; const b = e.currentTarget; const t = b.textContent;
      document.querySelectorAll(".nav-go").forEach((x) => { x.disabled = true; }); b.classList.add("loading"); b.textContent = "Memuat…";
      const slow = setTimeout(() => toast("Koneksi lambat, mohon tunggu sebentar…"), 6000);
      try { await fn(); } catch (err) { toast("Koneksi lambat, coba klik lagi"); b.textContent = t; b.classList.remove("loading"); document.querySelectorAll(".nav-go").forEach((x) => { x.disabled = false; }); }
      finally { busy = false; clearTimeout(slow); } } }, label);
    const persist = () => store.set("live-session", { code, QS, i, ST, at: Date.now(), mode: net.kind });
    const R = (p) => "rooms/" + code + (p ? "/" + p : "");
    const pending = {};
    function autoAssign() {
      if (!TM || TM.assign !== "auto") return;
      const cnt = TM.list.map(() => 0);
      Object.entries(players).forEach(([u, p]) => { const t = p.team != null ? p.team : pending[u]; if (t != null && cnt[t] != null) cnt[t]++; });
      Object.entries(players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0)).forEach(([u, p]) => {
        if (p.team != null || pending[u] != null) return;
        const min = Math.min(...cnt); const opts = cnt.map((c, k) => (c === min ? k : -1)).filter((k) => k >= 0); const k = opts[rnd(opts.length)];
        cnt[k]++; pending[u] = k; net.set(R("players/" + u + "/team"), k).catch(() => {}).then(() => delete pending[u]);
      });
    }
    function watchPlayers(cb) { offs.push(net.on(R("players"), (v) => { players = v || {}; autoAssign(); cb && cb(); })); }
    const teamOf = (uid) => { const p = players[uid]; return TM && p && p.team != null && TM.list[p.team] ? p.team : -1; };
    function teamStats(scores) {
      return TM.list.map((t, k) => {
        const mem = Object.keys(players).filter((u) => teamOf(u) === k);
        const total = mem.reduce((a, u) => a + ((scores[u] || {}).score || 0), 0);
        return { k, name: t.name, color: t.color, n: mem.length, total, avg: mem.length ? Math.round(total / mem.length) : 0 };
      }).sort((a, b) => b.avg - a.avg || b.total - a.total).map((s, r) => ({ ...s, rank: r + 1 }));
    }
    const teamRows = (ts, max, prev, dl = 600) => ts.map((t) => { const pv = prev && prev[t.k]; t.w = max ? Math.max(4, (t.avg / max) * 100) : 4;
      const bar = h("i", { style: { width: (pv ? pv.w : 0) + "%" } }); setTimeout(() => (bar.style.width = t.w + "%"), dl - 100);
      return h("div", { class: "r tteam", style: { "--tc": t.color }, "data-from": pv ? pv.rank - 1 : -1 }, h("span", { class: "rk" }, t.rank),
        h("span", { class: "nm" }, h("span", { class: "ar tnm" }, t.name), h("small", { class: "sub" }, "  " + t.n + " anggota"), h("span", { class: "tbar" }, bar)),
        C.tween(h("b"), pv ? pv.avg : 0, t.avg, { ms: 1300, delay: dl })); });

    function lobby() {
      wrap.innerHTML = ""; wrap.append(C.topbar("الْمُسَابَقَةُ الْمُبَاشِرَةُ", "Ruang " + code));
      const qr = h("div", { id: "qr" }); const list = h("div", { class: "players" }); const count = h("span", { class: "bigcount" }, "0");
      const url = joinUrl(code);
      wrap.append(h("div", { class: "lobby" },
        h("div", { class: "qrbox" }, h("b", null, "Pindai untuk bergabung"), qr, h("div", null, "Kode ruang"), h("div", { class: "code" }, code), h("div", { class: "url" }, url),
          h("button", { class: "btn small", type: "button", style: { color: "var(--ink)", background: "var(--fg)" }, onclick: () => copyText(url) }, "Salin tautan")),
        h("div", { class: "panel", style: { display: "flex", flexDirection: "column", gap: "14px" } },
          h("div", { class: "row" }, count, h("span", { class: "sub grow" }, "mahasiswa sudah masuk"), h("span", { class: "pill" }, C.scopeName(C.getScope()) + " · " + C.levelName(C.getLevel()) + " · " + QS.length + " soal · " + settings.limit + " dtk")),
          list,
          h("div", { class: "row" }, navBtn("Mulai kuis →", () => ask(0), { class: "btn primary nav-go" }), h("span", { class: "sub" }, TM ? "Klik nama untuk memindah ke kelompok lain. Yang datang terlambat tetap bisa masuk." : "Mahasiswa yang datang terlambat tetap bisa masuk di tengah kuis.")))));
      if (window.QRCode) { try { new window.QRCode(qr, { text: url, width: 560, height: 560, colorDark: (getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#0A1B44"), colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) { /* */ } }
      else qr.append(h("p", { class: "sub" }, "(QR tidak tersedia, gunakan kode)"));
      let seen = -1;
      watchPlayers(() => {
        const nP = Object.keys(players).length; if (seen >= 0 && nP > seen) C.SFX.pop(); seen = nP;
        const arr = Object.entries(players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0)); count.textContent = arr.length; list.innerHTML = "";
        if (!TM) { arr.forEach(([, p]) => list.append(h("span", { class: "pchip" }, p.name))); return; }
        list.className = "teamcols";
        const cols = TM.list.map((t, k) => h("div", { class: "tcol", style: { "--tc": t.color } }, h("div", { class: "th" }, h("span", { class: "ar" }, t.name), h("span", { class: "pill" }, String(arr.filter(([u]) => teamOf(u) === k).length)))));
        const none = arr.filter(([u]) => teamOf(u) < 0);
        arr.forEach(([u, p]) => { const k = teamOf(u); if (k < 0) return;
          cols[k].append(h("button", { class: "pchip tchip", type: "button", title: "Klik untuk memindah ke kelompok lain", onclick: () => net.set(R("players/" + u + "/team"), (k + 1) % TM.list.length) }, p.name)); });
        list.append(...cols);
        if (none.length) list.append(h("div", { class: "tcol none" }, h("div", { class: "th" }, h("span", null, TM.assign === "self" ? "Belum memilih" : "Sedang dibagi…"), h("span", { class: "pill" }, String(none.length))), ...none.map(([, p]) => h("span", { class: "pchip" }, p.name))));
      });
    }

    let gen = 0, curAns = {}, prevBoard = {}, prevTeam = {};
    async function ask(idx, resumeSt) {
      const g = ++gen; let revealed = false;
      i = idx; persist(); curAns = {};
      offs.forEach((f) => f()); offs.length = 0;
      // soal gagasan utama butuh waktu membaca: minimal 45 detik (v1.10.0)
      const q = QS[i]; const limit = resumeSt ? resumeSt.limit || settings.limit : q.cat === "fikrah" ? Math.max(45, settings.limit) : settings.limit;
      if (!resumeSt) await net.set(R("state"), { phase: "question", i, key: "q" + i, total: QS.length, q: { q: q.q, p: q.p || null, s: q.s, bare: q.bare, o: q.o, tf: q.tf, cat: q.cat }, limit, startedAt: net.TS });
      const st = resumeSt || (await net.get(R("state"))); const startedAt = st.startedAt;
      if (g !== gen) return;
      wrap.innerHTML = "";
      const timer = timerEl(limit, () => reveal(), { sound: true }); C.SFX.start();
      const cnt = h("span", { class: "pill" }, "0 menjawab");
      const opts = C.optButtons(q, null); opts.querySelectorAll(".opt").forEach((b) => (b.style.cursor = "default"));
      const extra = h("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } });
      wrap.append(h("div", { class: "stage-inner", style: { margin: "0 auto" } },
        h("div", { class: "qhead" }, h("span", { class: "pill gold" }, "Soal " + (i + 1) + " / " + QS.length), h("span", { class: "pill ar", style: { fontSize: "18px" } }, C.catOf(q.cat).ar), q.d ? C.levelTag(q) : null, h("span", { class: "grow" }), cnt, timer.el,
          h("button", { class: "btn small", type: "button", id: "skip", onclick: () => reveal() }, "Tutup jawaban")),
        ...C.renderQ({ ...q }), opts, extra));
      let rem = (startedAt + limit * 1000 - net.now()) / 1000;
      // Soal baru: bila jam laptop meleset jauh dari server, pakai waktu penuh (skor tetap dihitung dengan jam server).
      if (!resumeSt && (rem > limit + 1 || rem < limit - 5)) rem = limit;
      timer.start(Math.max(0, Math.min(limit, rem)));
      function updCount() { if (g !== gen) return; const n = Object.keys(curAns).length; const tot = Object.keys(players).length; cnt.textContent = n + " / " + tot + " menjawab"; if (tot > 0 && n >= tot && !revealed) setTimeout(reveal, 600); }
      watchPlayers(() => updCount());
      offs.push(net.on(R("answers/q" + i), (v) => { curAns = v || {}; updCount(); }));
      async function reveal() {
        if (revealed || g !== gen) return; revealed = true; timer.stop(); C.SFX.reveal(); const sk = wrap.querySelector("#skip"); if (sk) sk.remove();
        const [answers, scores] = (await Promise.all([net.get(R("answers/q" + i)), net.get(R("scores"))])).map((v) => v || {});
        if (g !== gen) return;
        const dist = q.o.map(() => 0); const upd = {}; const lim = limit * 1000;
        Object.keys(players).forEach((uid) => {
          const a = answers[uid]; const prev = scores[uid] || { score: 0, right: 0, streak: 0 };
          let ok = false, pts = 0, late = false;
          if (a && typeof a.c === "number" && a.c >= 0 && a.c < q.o.length) {
            dist[a.c]++; const el = Math.max(0, (a.t || startedAt) - startedAt);
            if (a.c === q.a && el <= lim + 2500) { ok = true; pts = Math.round(1000 - 500 * Math.min(1, el / lim)); }
            else if (a.c === q.a) late = true;
          }
          upd[uid] = { score: (prev.score || 0) + pts, right: (prev.right || 0) + (ok ? 1 : 0), streak: ok ? (prev.streak || 0) + 1 : 0, prank: prev.rank || 0, last: { ok, pts, answered: !!a, late, i } };
        });
        const ranked = Object.entries(upd).sort((x, y) => y[1].score - x[1].score); ranked.forEach(([uid, s], k) => (s.rank = k + 1));
        if (Object.keys(upd).length) await net.set(R("scores"), upd);
        if (TM) { const ts = teamStats(upd); const byK = {}; ts.forEach((t) => (byK[t.k] = { avg: t.avg, n: t.n, rank: t.rank })); await net.set(R("teamScores"), byK); }
        await net.update(R("state"), { phase: "reveal", a: q.a, dist });
        ST[i] = { dist, right: dist[q.a] || 0, answered: dist.reduce((x, y) => x + y, 0), players: Object.keys(players).length }; persist();
        C.revealOpts(opts, q.a, null);
        if (g !== gen) return;
        const qh = wrap.querySelector(".qhead"); if (qh) qh.append(navBtn("Papan skor →", showBoard, { class: "btn primary nav-go" }));
        const max = Math.max(1, ...dist);
        extra.append(h("div", { class: "dist" + (q.tf ? " tf" : "") }, dist.map((d, k) => h("div", { class: "bar" + (k === q.a ? "" : " wrong"), style: { height: (12 + (d / max) * 88) + "%" } }, d))),
          ...C.noteFor(q),
          h("div", { class: "row", style: { justifyContent: "center" } }, navBtn("Papan skor →", showBoard, { class: "btn primary nav-go", id: "next" })));
        const nx = wrap.querySelector("#next"); nx && nx.focus();
      }
    }

    async function showBoard() {
      gen++; // hentikan sisa proses soal sebelumnya
      const last = i >= QS.length - 1;
      const [sc0, ps0] = await Promise.all([net.get(R("scores")), net.get(R("players")), net.update(R("state"), { phase: last ? "end" : "board" })]);
      const scores = sc0 || {}; const ps = ps0 || {}; players = ps;
      persist();
      const ranked = Object.entries(scores).map(([uid, s]) => ({ uid, name: (ps[uid] || {}).name || "?", ...s })).sort((a, b) => b.score - a.score);
      wrap.innerHTML = ""; if (!last) C.SFX.whoosh();
      if (last) return finish(ranked);
      wrap.append(h("div", { class: "stage-inner", style: { margin: "0 auto" } },
        h("div", { class: "qhead" }, h("span", { class: "pill gold" }, "Setelah soal " + (i + 1) + " / " + QS.length), h("span", { class: "grow" })),
        h("h2", { class: "h-ar", style: { textAlign: "center" } }, "لَوْحَةُ الصَّدَارَةِ"),
        TM ? (() => { const ts = teamStats(scores); const lb = h("div", { class: "lb anim" }, teamRows(ts, ts.length ? ts[0].avg : 0, prevTeam)); prevTeam = Object.fromEntries(ts.map((t) => [t.k, t])); return lb; })() : null,
        TM ? h("p", { class: "sub", style: { textAlign: "center" } }, "Skor kelompok = rata-rata anggota · 5 besar perorangan:") : null,
        boardRows(ranked.slice(0, TM ? 5 : 8), TM ? " small" : ""),
        ranked.length ? null : h("p", { class: "empty" }, "Belum ada peserta."),
        h("div", { class: "row", style: { justifyContent: "center" } }, navBtn("Soal berikutnya →", () => ask(i + 1), { class: "btn primary nav-go", id: "next" }))));
      wrap.querySelectorAll(".lb.anim").forEach(flipIn);
      prevBoard = Object.fromEntries(ranked.map((r, k) => [r.uid, { score: r.score, pos: k }]));
      const nx = wrap.querySelector("#next"); nx && nx.focus();
    }
    // Baris papan skor: mulai dari posisi & skor lama, lalu bergeser ke posisi baru sambil angkanya naik
    function boardRows(list, extra) {
      return h("div", { class: "lb anim" + (extra || "") }, list.map((r, k) => {
        const pv = prevBoard[r.uid]; const from = pv ? pv.pos : -1; const gain = r.last && r.last.pts ? r.last.pts : 0;
        const mv = from >= 0 ? from - k : 0;
        const row = h("div", { class: "r" + (k < 3 ? " top" + (k + 1) : ""), "data-from": from },
          h("span", { class: "rk" }, k + 1),
          h("span", { class: "nm" }, r.name, r.streak >= 3 ? h("span", { class: "streak" }, "🔥" + r.streak) : null, mv > 0 ? h("small", { class: "mv up" }, "▲" + mv) : mv < 0 ? h("small", { class: "mv dn" }, "▼" + -mv) : null,
            TM && teamOf(r.uid) >= 0 ? h("small", { class: "ar ttag", style: { "--tc": TM.list[teamOf(r.uid)].color } }, TM.list[teamOf(r.uid)].name) : null),
          h("span", { class: "scw" }, gain ? h("small", { class: "gain" }, "+" + gain) : null, C.tween(h("b"), pv ? pv.score : Math.max(0, r.score - gain), r.score, { ms: 1300, delay: 700 })));
        return row;
      }));
    }
    function flipIn(lb) {
      const rows = [...lb.children]; if (!rows.length) return;
      if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const step = rows.length > 1 ? rows[1].offsetTop - rows[0].offsetTop : rows[0].offsetHeight + 8;
      rows.forEach((el, k) => {
        const f = Number(el.dataset.from); el.style.transition = "none";
        if (f >= 0 && f !== k) { el.style.transform = "translateY(" + (Math.min(f, rows.length) - k) * step + "px)"; if (f > k) el.classList.add("climb"); }
        else if (f < 0) { el.style.opacity = "0"; el.style.transform = "translateY(18px) scale(.97)"; }
      });
      void lb.offsetHeight;
      setTimeout(() => rows.forEach((el, k) => { el.style.transition = "transform .9s cubic-bezier(.2,.85,.25,1) " + k * 0.05 + "s, opacity .5s " + k * 0.05 + "s"; el.style.transform = ""; el.style.opacity = ""; }), 350);
    }

    function finish(ranked) {
      const calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (calm) { confetti(); C.SFX.fanfare(); } else { C.SFX.whoosh(); setTimeout(() => { confetti(); C.SFX.fanfare(); }, 2300); setTimeout(() => confetti(), 4200); }
      const q3 = (s) => '"' + String(s).replace(/"/g, '""') + '"';
      const ts = TM ? teamStats(Object.fromEntries(ranked.map((r) => [r.uid, r]))) : null;
      const tName = (uid) => (TM && teamOf(uid) >= 0 ? TM.list[teamOf(uid)].name : "");
      const top = TM ? ts.slice(0, 3).map((t) => ({ name: t.name, score: t.avg, ar: true, color: t.color })) : ranked.slice(0, 3); const order = [top[1], top[0], top[2]];
      const csvRows = [(TM ? "Peringkat,Nama,Kelompok,Skor,Benar,Jumlah Soal" : "Peringkat,Nama,Skor,Benar,Jumlah Soal"), ...ranked.map((r, k) => [k + 1, q3(r.name), ...(TM ? [q3(tName(r.uid))] : []), r.score, r.right || 0, QS.length].join(","))];
      if (TM) csvRows.push("", "Peringkat Kelompok,Kelompok,Anggota,Skor Rata-rata,Total Skor", ...ts.map((t) => [t.rank, q3(t.name), t.n, t.avg, t.total].join(",")));
      const csv = csvRows.join("\n");
      const rec = recapRows(); const recCsv = recapCsv(rec);
      const pane1 = h("div", { style: { display: "flex", flexDirection: "column", gap: "18px" } }); const pane2 = recapPane(rec);
      const tabs = h("div", { class: "tabs", style: { justifyContent: "center" } });
      const showTab = (k) => { pane1.style.display = k ? "none" : ""; pane2.style.display = k ? "" : "none"; tabs.innerHTML = ""; [["Peringkat", 0], ["Rekap soal tersulit", 1]].forEach(([t, v]) => tabs.append(h("button", { class: "tab" + (k === v ? " on" : ""), type: "button", id: "tab-" + v, onclick: () => showTab(v) }, t))); };
      wrap.append(h("div", { class: "stage-inner", style: { margin: "0 auto" } },
        h("h2", { class: "h-ar win-title", style: { textAlign: "center", fontSize: "40px" } }, "مُبَارَكٌ لِلْفَائِزِينَ"), tabs, pane1, pane2,
        h("div", { class: "row", style: { justifyContent: "center" } },
          h("button", { class: "btn primary", type: "button", onclick: () => downloadText("hasil-kuis-wahdah-" + S.wahdah + "-" + code + ".csv", csv) }, "Unduh hasil (CSV)"),
          h("button", { class: "btn", type: "button", onclick: () => downloadText("rekap-soal-wahdah-" + S.wahdah + "-" + code + ".csv", recCsv) }, "Unduh rekap soal (CSV)"),
          h("button", { class: "btn", type: "button", onclick: () => copyText(csv.replace(/,/g, "\t")) }, "Salin untuk Excel"),
          h("button", { class: "btn ghost", type: "button", onclick: async () => { await net.remove(R()); store.set("live-session", null); toast("Ruang dihapus"); C.go("home"); } }, "Tutup & hapus ruang"))));
      const add = (el, ...k) => el.append(...k.filter((x) => x != null)); // tanpa teks "null"
      add(pane1,
        // Podium naik bergantian: juara 3, lalu 2, lalu 1 (dengan mahkota), skor menghitung naik
        h("div", { class: "podium anim" }, order.map((r, k) => { const d = [1.0, 1.8, 0.3][k];
          return h("div", { class: "p", style: { "--d": d + "s" } }, k === 1 && r ? h("span", { class: "crown", "aria-hidden": "true" }, "👑") : null,
            r ? h("span", { class: "nm" + (r.ar ? " ar" : "") }, r.name) : h("span", { class: "nm" }, "—"),
            h("span", { class: "sub" }, r ? C.tween(h("b", { class: "psc" }), 0, r.score, { ms: 1200, delay: (d + 0.5) * 1000 }) : "", r ? (TM ? " rata-rata" : " poin") : ""),
            h("div", { class: "blk", style: r && r.color ? { boxShadow: "inset 0 6px 0 " + r.color } : null }, [2, 1, 3][k])); })),
        TM ? h("div", { class: "lb late" }, teamRows(ts, ts.length ? ts[0].avg : 0, null, 2700)) : null,
        TM ? h("h3", { class: "late-h", style: { textAlign: "center", margin: "6px 0 0" } }, "Peringkat perorangan") : null,
        h("div", { class: "lb late" + (TM ? " small" : "") }, ranked.map((r, k) => h("div", { class: "r" + (k < 3 ? " top" + (k + 1) : "") }, h("span", { class: "rk" }, k + 1), h("span", { class: "nm" }, r.name, TM && tName(r.uid) ? h("small", { class: "ar ttag", style: { "--tc": TM.list[teamOf(r.uid)].color } }, tName(r.uid)) : null), h("b", null, C.tween(h("span"), 0, r.score, { ms: 1400, delay: 2600 + Math.min(k, 12) * 60 }), " · " + (r.right || 0) + "/" + QS.length + " benar")))));
      showTab(0);
    }

    // ---------- REKAP SOAL TERSULIT ----------
    const qPlain = (q) => (q.q || "") + (q.s ? "  " + q.s[0] + " … " + q.s[1] : "");
    function recapRows() {
      return QS.map((q, k) => ({ q, k, st: ST[k] })).filter((x) => x.st).map((x) => {
        const st = x.st; const pct = st.players ? Math.round((100 * st.right) / st.players) : 0;
        const w = st.dist.map((d, j) => [d, j]).filter(([, j]) => j !== x.q.a).sort((a, b) => b[0] - a[0])[0];
        return { ...x, pct, wrong: w && w[0] > 0 ? x.q.o[w[1]] : null, wrongN: w ? w[0] : 0, none: Math.max(0, st.players - st.answered) };
      }).sort((a, b) => a.pct - b.pct || a.k - b.k).map((x, r) => ({ ...x, rank: r + 1 }));
    }
    function recapCsv(rows) {
      const q3 = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
      return ["Urutan Tersulit,No Soal,Bagian,Jenis,Soal,Kunci,Benar,Menjawab,Peserta,% Benar,Jawaban Salah Terbanyak,Dipilih",
        ...rows.map((x) => [x.rank, x.k + 1, x.q.n || "", q3(C.catOf(x.q.cat).id_), q3(qPlain(x.q)), q3(x.q.o[x.q.a]), x.st.right, x.st.answered, x.st.players, x.pct, q3(x.wrong || ""), x.wrongN].join(","))].join("\n");
    }
    const lvl = (p) => (p < 50 ? "hard" : p < 80 ? "mid" : "easy");
    function recapCard(x) {
      return h("button", { class: "rcard " + lvl(x.pct), type: "button", onclick: () => review(x), "aria-label": "Ulas soal " + (x.k + 1) },
        h("div", { class: "rc-top" }, h("span", { class: "rk" }, "#" + x.rank), h("span", { class: "pill" }, "Soal " + (x.k + 1)), h("span", { class: "pill ar" }, C.catOf(x.q.cat).ar), x.q.n ? h("span", { class: "pill" }, "Bagian " + x.q.n) : null, h("span", { class: "grow" }),
          h("span", { class: "pct" }, x.pct + "%"), h("small", { class: "sub" }, x.st.right + "/" + x.st.players + " benar")),
        h("div", { class: "meter" }, h("i", { style: { width: Math.max(2, x.pct) + "%" } })),
        h("p", { class: "rc-q", dir: "rtl" }, qPlain(x.q)),
        h("div", { class: "rc-ans" }, h("span", null, "Kunci: ", h("b", { class: "ar" }, x.q.o[x.q.a])),
          x.wrong ? h("span", null, "Salah terbanyak: ", h("b", { class: "ar wr" }, x.wrong), " (" + x.wrongN + " org)") : null,
          x.none ? h("span", { class: "sub" }, x.none + " tidak menjawab") : null));
    }
    function recapPane(rows) {
      const box = h("div", { class: "recap", style: { display: "none" } });
      if (!rows.length) { box.append(h("p", { class: "empty" }, "Belum ada soal yang dibuka jawabannya.")); return box; }
      const avg = Math.round(rows.reduce((a, x) => a + x.pct, 0) / rows.length); const hard = rows.filter((x) => x.pct < 50).length;
      const list = h("div", { class: "rlist" }); let all = false;
      const more = h("button", { class: "btn small", type: "button", onclick: () => { all = !all; draw(); } });
      const draw = () => { list.innerHTML = ""; (all ? rows : rows.slice(0, 5)).forEach((x) => list.append(recapCard(x))); more.textContent = all ? "Tampilkan 5 tersulit saja" : "Tampilkan semua (" + rows.length + " soal)"; more.style.display = rows.length > 5 ? "" : "none"; };
      box.append(h("div", { class: "rsum" },
          h("div", { class: "stat" }, h("b", null, avg + "%"), h("span", null, "rata-rata ketepatan kelas")),
          h("div", { class: "stat" }, h("b", null, String(hard)), h("span", null, "soal di bawah 50%")),
          h("div", { class: "stat" }, h("b", null, String(rows.length)), h("span", null, "soal dibahas"))),
        h("p", { class: "sub", style: { textAlign: "center" } }, "Diurutkan dari yang paling banyak salah. Klik kartu untuk membahasnya di layar."),
        list, h("div", { class: "row", style: { justifyContent: "center" } }, more));
      draw(); return box;
    }
    function review(x) {
      const q = x.q; const opts = C.optButtons(q, null); C.revealOpts(opts, q.a, null); opts.querySelectorAll(".opt").forEach((b) => (b.style.cursor = "default"));
      const max = Math.max(1, ...x.st.dist);
      const close = () => { stage.remove(); document.removeEventListener("keydown", onKey); };
      const onKey = (e) => { if (e.key === "Escape") close(); };
      const stage = h("div", { class: "stage", role: "dialog", "aria-modal": "true" }, h("div", { class: "stage-inner" },
        h("div", { class: "qhead" }, h("span", { class: "pill gold" }, "Tersulit #" + x.rank + " · Soal " + (x.k + 1)), h("span", { class: "pill ar", style: { fontSize: "18px" } }, C.catOf(q.cat).ar), q.n ? h("span", { class: "pill" }, "Bagian " + q.n) : null,
          h("span", { class: "pill" }, x.pct + "% benar · " + x.st.right + "/" + x.st.players), h("span", { class: "grow" }),
          h("button", { class: "btn small ghost", type: "button", onclick: close }, "Tutup (Esc)")),
        ...C.renderQ({ ...q }), opts,
        h("div", { class: "dist" + (q.tf ? " tf" : "") }, x.st.dist.map((d, k) => h("div", { class: "bar" + (k === q.a ? "" : " wrong"), style: { height: (12 + (d / max) * 88) + "%" } }, d))),
        ...C.noteFor(q)));
      document.addEventListener("keydown", onKey); document.body.append(stage);
    }

    setup();
  }

  // ---------------- PLAYER (HP mahasiswa) ----------------
  async function player(root, codeIn) {
    const params = new URLSearchParams(location.search);
    const box = h("div", { class: "player" }); root.append(box);
    const head = h("header", { class: "brand", html: SEAL + '<div><h1 class="ui-ar">Arena Muraja\'ah' + (C.JILID || '') + '</h1><small>' + (C.JILID_S || '') + 'Peserta</small></div>' });
    const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } });
    box.append(head, body);
    const say = (...k) => { body.innerHTML = ""; body.append(...k.filter((x) => x != null && x !== false)); }; // v1.8.8: tidak lagi menampilkan "null"
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

    let state = null, me = null, myScore = null, answeredKey = null, tmr = null, TMp = null, tScores = null;
    const myTeam = () => (TMp && me && me.team != null && TMp.list[me.team] ? TMp.list[me.team] : null);
    function pickTeam() {
      say(h("div", { class: "card-p" }, h("p", { class: "status" }, "Pilih kelompokmu"),
        h("div", { class: "tpick" }, TMp.list.map((t, k) => h("button", { class: "btn", type: "button", style: { "--tc": t.color }, onclick: async () => {
          try { await net.set("rooms/" + code + "/players/" + net.uid + "/team", k); } catch (e) { toast("Gagal, coba lagi"); } } }, h("span", { class: "ar" }, t.name))))));
    }
    function listen() {
      const R = (p) => "rooms/" + code + "/" + p;
      net.on(R("teams"), (v) => { TMp = v; lastRender = ""; render(); });
      net.on(R("teamScores"), (v) => { tScores = v; lastRender = ""; render(); });
      net.on(R("players/" + net.uid), (v) => { me = v; if (!v) joinForm("Silakan masuk lagi."); else render(); });
      net.on(R("scores/" + net.uid), (v) => { myScore = v; render(); });
      net.on(R("state"), (v) => { state = v; if (v && v.phase === "question" && v.key && !gotAt[v.key]) gotAt[v.key] = Date.now(); render(); });
      net.on("rooms/" + code + "/host", (v) => { if (!v) say(h("div", { class: "card-p" }, h("b", null, "Kuis sudah ditutup oleh dosen."), h("p", { class: "sub" }, "Terima kasih sudah ikut!"))); });
    }
    let lastRender = "", tok = 0, vibKey = null, shownScore = null, gotAt = {}, sending = null;
    async function render() {
      if (!state || !me) return; const my = ++tok;
      const tm = myTeam(); const tr = tm && tScores && tScores[me.team] ? tScores[me.team] : null;
      // Saat soal berjalan, tampilan soal tidak dibangun ulang hanya karena skor/kelompok berubah (agar ketukan tidak hilang)
      const sig = state.phase === "question" ? ["question", state.i, state.key, answeredKey, sending, me.team, !!TMp].join("|") : [state.phase, state.i, answeredKey, myScore && myScore.score, myScore && myScore.rank, me.team, tr && tr.rank, tr && tr.avg, !!TMp].join("|");
      if (sig === lastRender) return; lastRender = sig;
      if (tmr) { tmr.stop(); tmr = null; }
      if (TMp && !tm && TMp.assign === "self" && state.phase !== "end") return pickTeam();
      const teamPill = tm ? h("span", { class: "pill ar tpill", style: { "--tc": tm.color } }, tm.name) : null;
      const sNow = myScore ? myScore.score || 0 : 0; const sFrom = shownScore == null ? sNow : shownScore; shownScore = sNow;
      const scoreLine = h("div", { class: "row" }, h("span", { class: "pill" }, me.name), teamPill, h("span", { class: "grow" }), C.tween(h("span", { class: "pill gold" + (sNow > sFrom ? " bump" : "") }), sFrom, sNow, { ms: 1000, delay: 350, fmt: (v) => v + " poin" }));
      const teamLine = tm && tr ? h("div", { class: "tline" }, h("span", { class: "pill ar tpill", style: { "--tc": tm.color } }, tm.name), h("span", null, "Kelompok peringkat ", h("b", null, "#" + tr.rank), " · rata-rata " + tr.avg)) : null;
      if (state.phase === "lobby") return say(scoreLine, h("div", { class: "card-p" }, h("p", { class: "qtext", dir: "rtl" }, "أَهْلًا وَسَهْلًا"),
        TMp && !tm ? h("p", { class: "status" }, "Kamu sudah masuk. Tunggu sebentar, dosen sedang membagi kelompok.") : tm ? h("div", { class: "tline col" }, h("span", { class: "sub" }, "Kamu masuk kelompok"), h("span", { class: "pill ar tpill big", style: { "--tc": tm.color } }, tm.name), h("span", { class: "status" }, "Tunggu dosen memulai.")) : h("p", { class: "status" }, "Kamu sudah masuk. Lihat namamu di layar, lalu tunggu dosen memulai."),
        tm && TMp.assign === "self" ? h("button", { class: "btn small ghost", type: "button", style: { alignSelf: "center" }, onclick: () => net.remove("rooms/" + code + "/players/" + net.uid + "/team") }, "Ganti kelompok") : null));
      const q = state.q || {};
      if (state.phase === "question") {
        const key = state.key; const mine = await net.get("rooms/" + code + "/answers/" + key + "/" + net.uid);
        if (my !== tok) return;
        if (mine || answeredKey === key) { answeredKey = key; return say(scoreLine, h("div", { class: "card-p" }, h("p", { class: "status" }, "Jawaban terkirim ✓"), h("p", { class: "sub", style: { textAlign: "center" } }, "Tunggu jawaban dibuka di layar."))); }
        if (sending === key) return say(scoreLine, h("div", { class: "card-p" }, h("p", { class: "status" }, "Mengirim jawaban…"), h("p", { class: "sub", style: { textAlign: "center" } }, "Sinyal sedang lambat. Biarkan halaman ini terbuka.")));
        // Hitung mundur: pakai jam server; bila jam HP meleset jauh, pakai waktu sejak soal diterima.
        // Habis di HP tidak lagi mengunci pilihan; yang menutup soal hanya layar dosen.
        let left = (state.startedAt + state.limit * 1000 - net.now()) / 1000;
        if (!(left >= -1 && left <= state.limit + 1)) left = state.limit - (Date.now() - (gotAt[key] || Date.now())) / 1000;
        tmr = timerEl(state.limit, () => { const n = body.querySelector(".t-note"); if (n) n.textContent = "Waktu hampir habis, segera pilih!"; });
        const opts = C.optButtons({ o: q.o, tf: q.tf }, async (c, b) => {
          if (answeredKey === key || sending === key) return; sending = key; b.classList.add("picked"); opts.querySelectorAll(".opt").forEach((x) => (x.disabled = true));
          let ok = false;
          try { await net.set("rooms/" + code + "/answers/" + key + "/" + net.uid, { c, t: net.TS }); ok = true; } catch (e) { toast("Jawaban tidak diterima: soal sudah ditutup"); }
          if (sending === key) sending = null; if (ok) answeredKey = key;
          lastRender = ""; render();
        });
        say(scoreLine, h("div", { class: "row" }, h("span", { class: "pill" }, "Soal " + (state.i + 1) + " / " + state.total), h("span", { class: "t-note sub" }), h("span", { class: "grow" }), tmr.el), ...C.renderQ({ ...q }, { compact: true }), opts);
        tmr.syncTo(Date.now() + Math.max(0, Math.min(state.limit, left)) * 1000, state.limit);
        return;
      }
      if (state.phase === "reveal") {
        const last = myScore && myScore.last; const ok = last && last.ok;
        if (vibKey !== state.i) { vibKey = state.i; try { if (navigator.vibrate && last) navigator.vibrate(ok ? 70 : [90, 60, 90]); } catch (e) { /* */ } }
        const fresh = !last || last.i == null || last.i === state.i; // hasil soal ini sudah dihitung?
        if (!fresh && last) return say(scoreLine, h("div", { class: "card-p" }, h("p", { class: "status" }, "Menghitung skor…")));
        const mv = myScore && myScore.prank && myScore.rank ? myScore.prank - myScore.rank : 0;
        return say(scoreLine, h("div", { class: "result pop " + (ok ? "ok" : "no") }, ok ? h("span", null, "Benar! +", C.tween(h("span"), 0, last.pts, { ms: 800, delay: 200 })) : last && last.late ? "Benar, tapi terlambat" : last && last.answered ? "Belum tepat" : "Tidak menjawab",
          h("small", null, "Jawaban: ", h("span", { class: "ar", style: { fontSize: "22px" } }, q.o ? q.o[state.a] : ""))),
          myScore && myScore.rank ? h("p", { class: "status rankline" }, "Peringkatmu sekarang: #" + myScore.rank, mv > 0 ? h("span", { class: "mv up" }, " ▲" + mv) : mv < 0 ? h("span", { class: "mv dn" }, " ▼" + -mv) : null) : null, teamLine);
      }
      if (state.phase === "board") return say(scoreLine, h("div", { class: "card-p" }, h("p", { class: "status" }, "Lihat papan skor di layar."), myScore && myScore.rank ? h("div", { class: "bigcount", style: { textAlign: "center" } }, "#" + myScore.rank) : null, teamLine, h("p", { class: "sub", style: { textAlign: "center" } }, "Bersiap untuk soal berikutnya…")));
      if (state.phase === "end") { if (myScore && myScore.rank <= 3) confetti(); return say(scoreLine, h("div", { class: "card-p" }, h("p", { class: "qtext", dir: "rtl" }, "انْتَهَتِ الْمُسَابَقَةُ"), h("div", { class: "bigcount pop", style: { textAlign: "center" } }, myScore ? "#" + myScore.rank : "—"), h("p", { class: "status" }, C.tween(h("span"), 0, myScore ? myScore.score : 0, { ms: 1400, delay: 300 }), " poin · " + (myScore ? myScore.right || 0 : 0) + "/" + state.total + " benar"), teamLine)); }
    }

    // sudah pernah bergabung di ruang ini? langsung lanjut
    if (code && myName) { const p = await net.get("rooms/" + code + "/players/" + net.uid); if (p) return listen(); }
    joinForm();
  }

  window.ArenaLive = { host, player, initNet };
})();
