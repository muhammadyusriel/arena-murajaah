/* Arena Muraja'ah — mode proyektor + kerangka aplikasi */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const app = () => $("#app");

  // ---------- util ----------
  /* Teks Arab diberi lang="ar": halaman ber-lang="id" membuat font Amiri memakai bentuk koma (،) lokal
     yang tampak seperti huruf kecil. */
  const AR_RE = /[\u0600-\u06FF]/;
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith("--")) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) {
      if (!kid.nodeType && !el.lang && AR_RE.test(String(kid))) el.lang = "ar";
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  /* Menu pilihan bulat berbayang (pengganti <select> bawaan yang kaku). opts: [{value, label}] — label boleh fungsi pembuat node. */
  function dropdown(opts, value, onChange, aria, extra) {
    let cur = value; const box = h("div", { class: "dd" + (extra ? " " + extra : "") });
    const lab = h("span", { class: "dd-lab" });
    const btn = h("button", { class: "dd-btn", type: "button", "aria-haspopup": "listbox", "aria-expanded": "false", "aria-label": aria },
      lab, h("span", { class: "dd-car", html: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' }));
    const menu = h("div", { class: "dd-menu", role: "listbox" });
    const mk = (o) => (typeof o.label === "function" ? o.label() : o.label);
    const setLab = () => { const o = opts.find((x) => x.value === cur) || opts[0]; lab.innerHTML = ""; lab.append(mk(o)); };
    const outside = (e) => { if (!box.contains(e.target)) close(); };
    function close() { box.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); document.removeEventListener("pointerdown", outside, true); }
    function open() {
      menu.innerHTML = "";
      opts.forEach((o) => menu.append(h("button", { class: "dd-item" + (o.value === cur ? " on" : ""), type: "button", role: "option", "aria-selected": String(o.value === cur),
        onclick: () => { close(); btn.focus(); if (o.value !== cur) { cur = o.value; setLab(); if (onChange) onChange(cur); } } }, mk(o))));
      box.classList.add("open"); btn.setAttribute("aria-expanded", "true"); document.addEventListener("pointerdown", outside, true);
      const on = menu.querySelector(".on") || menu.firstChild; if (on) on.focus({ preventScroll: true });
    }
    btn.addEventListener("click", () => (box.classList.contains("open") ? close() : open()));
    box.addEventListener("keydown", (e) => {
      if (!box.classList.contains("open")) return;
      if (e.key === "Escape") { e.stopPropagation(); close(); btn.focus(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const it = [...menu.children]; const i = it.indexOf(document.activeElement); const n = it[(i + (e.key === "ArrowDown" ? 1 : -1) + it.length) % it.length]; if (n) n.focus(); }
    });
    Object.defineProperty(box, "value", { get: () => cur });
    setLab(); box.append(btn, menu); return box;
  }
  // ---------- CAKUPAN (semua bagian / per bagian) ----------
  const scopeKey = () => "scope-" + S.wahdah;
  const getScope = () => { const v = store.get(scopeKey(), 0); return D().nusus.some((u) => u.n === v) ? v : 0; };
  const inScope = (sc) => (x) => !sc || x.n === sc;
  const scopeName = (sc) => (sc ? "Bagian " + sc : "Semua bagian");
  function scopePicker(onChange, extra) {
    const opts = [{ value: 0, label: "Semua bagian (1–" + D().nusus.length + ")" }].concat(D().nusus.map((u) => ({ value: u.n, label: () => h("span", null, "Bagian " + u.n + " · ", h("span", { class: "ar dd-ar" }, u.title)) })));
    const dd = dropdown(opts, getScope(), (v) => { store.set(scopeKey(), v); onChange && onChange(v); }, "Cakupan materi", extra);
    return h("div", { class: "row scope" }, h("span", { class: "sub" }, "Cakupan"), dd);
  }
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = rnd(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const sample = (a, n) => shuffle(a).slice(0, n);
  const AR_DIG = "٠١٢٣٤٥٦٧٨٩";
  const arNum = (n) => String(n).replace(/\d/g, (d) => AR_DIG[d]);
  const store = {
    get(k, d) { try { const v = localStorage.getItem("arena:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("arena:" + k, JSON.stringify(v)); } catch (e) { /* abaikan */ } },
  };
  function toast(msg) { const t = h("div", { class: "toast", role: "status" }, msg); document.body.append(t); setTimeout(() => t.remove(), 2200); }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast("Tersalin ke clipboard"); }
    catch (e) { const ta = h("textarea", { style: { position: "fixed", opacity: 0 } }); ta.value = text; document.body.append(ta); ta.select(); try { document.execCommand("copy"); toast("Tersalin"); } catch (_) { toast("Gagal menyalin; silakan salin manual"); } ta.remove(); }
  }
  function downloadText(name, text, type = "text/csv") {
    const a = h("a", { href: URL.createObjectURL(new Blob(["﻿" + text], { type })), download: name }); document.body.append(a); a.click(); setTimeout(() => a.remove(), 500);
  }

  // ---------- icons ----------
  const I = {
    board: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5z"/><path d="M12 6v14"/></svg>',
    pen: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/></svg>',
    wheel: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></svg>',
    cards: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="11" height="14" rx="2"/><path d="M8 4h11a2 2 0 0 1 2 2v12"/></svg>',
    list: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
    phone: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/><path d="M2 9a6 6 0 0 1 0 6M22 9a6 6 0 0 0 0 6" stroke-linecap="round"/></svg>',
  };
  const SHAPES = [
    '<svg viewBox="0 0 20 20"><path d="M10 1l9 9-9 9-9-9z"/></svg>',
    '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5"/></svg>',
    '<svg viewBox="0 0 20 20"><path d="M10 2l9 16H1z"/></svg>',
    '<svg viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="2"/></svg>',
  ];
  const SEAL = '<svg class="seal" viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="#E2B862" stroke-width="2"><rect x="11" y="11" width="26" height="26" rx="2"/><rect x="11" y="11" width="26" height="26" rx="2" transform="rotate(45 24 24)"/></g><circle cx="24" cy="24" r="7" fill="#3B7CF0"/><path d="M20.5 24.5l2.4 2.4 4.8-5" stroke="#FFFFFF" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- state ----------
  const WAHDAH_LIST = () => Object.keys(window.ARENA_DATA || {}).map(Number).sort((a, b) => a - b);
  const TEAM_COLORS = ["#20B39F", "#E5683F", "#F0B649", "#8D6CD9", "#4EA3E8", "#E2558F"];
  const TEAM_NAMES = ["مَكَّةُ", "الْمَدِينَةُ", "الْقُدْسُ", "الْقَاهِرَةُ", "دِمَشْقُ", "بَغْدَادُ"];
  const S = {
    wahdah: store.get("wahdah", null),
    teams: store.get("teams", null) || TEAM_NAMES.slice(0, 4).map((name, i) => ({ name, color: TEAM_COLORS[i], score: 0 })),
  };
  if (!WAHDAH_LIST().includes(S.wahdah)) S.wahdah = WAHDAH_LIST().slice(-1)[0];
  const D = () => window.ARENA_DATA[S.wahdah];
  const saveTeams = () => store.set("teams", S.teams);

  const CATS = [
    { id: "makna", ar: "مَعَانِي الْمُفْرَدَاتِ", id_: "Makna kata" },
    { id: "muradif", ar: "الْمُرَادِفُ وَالْمُضَادُّ", id_: "Sinonim & antonim" },
    { id: "akmil", ar: "أَكْمِلِ الْفَرَاغَ", id_: "Isian dari nash" },
    { id: "fahm", ar: "فَهْمُ الْمَقْرُوءِ", id_: "Pemahaman teks" },
    { id: "tarakib", ar: "التَّرَاكِيبُ وَالصَّرْفُ", id_: "Tarakib & sharf" },
    { id: "tasykil", ar: "التَّشْكِيلُ", id_: "Harakat akhir" },
  ];
  const catOf = (id) => CATS.find((c) => c.id === id);
  const nashTitle = (n) => { const x = D().nusus.find((u) => u.n === n); return x ? x.title : ""; };

  // Normalisasi soal → {q, s, hl, o, a, tf, x, fix, n, cat}; opsi diacak (kecuali benar/salah)
  function prepare(q, cat) {
    const base = { ...q, cat };
    if (q.tf) return { ...base, o: q.o.slice(), a: q.a };
    const order = shuffle(q.o.map((_, i) => i));
    return { ...base, o: order.map((i) => q.o[i]), a: order.indexOf(q.a) };
  }
  window.ArenaCore = { h, shuffle, sample, rnd, arNum, store, toast, copyText, downloadText, SHAPES, CATS, catOf, prepare, D, S, nashTitle, getScope, inScope, scopeName, scopePicker, renderQ: null, timerEl: null, go: null, SEAL, I };

  // ---------- render pertanyaan ----------
  function renderQ(q, { compact = false } = {}) {
    const parts = [];
    parts.push(h("p", { class: "qtext", dir: "rtl" }, q.q));
    if (q.s) {
      let pre = q.s[0], conj = ""; const m = pre.match(/([وف]َ)$/); if (m) { conj = m[1]; pre = pre.slice(0, -m[1].length); }
      const mid = q.cat === "tasykil" ? h("span", { class: "hl" }, conj + (q.bare || "؟")) : h("span", { class: "blank" }, conj + "…");
      parts.push(h("div", { class: "qsent", dir: "rtl" }, pre, mid, q.s[1]));
    }
    if (q.tf && !compact) parts.push(h("div", { class: "sub", style: { textAlign: "center" } }, "Benar atau salah menurut nash?"));
    return parts;
  }
  function optButtons(q, onPick) {
    const wrap = h("div", { class: "opts" + (q.tf ? " tf" : "") });
    q.o.forEach((o, i) => {
      const b = h("button", { class: "opt", type: "button", "data-i": i, onclick: () => onPick && onPick(i, b) },
        h("span", { class: "shape", html: SHAPES[i] }), h("span", { class: "tx", dir: "rtl" }, o));
      wrap.append(b);
    });
    return wrap;
  }
  function revealOpts(wrap, a, picked) {
    wrap.querySelectorAll(".opt").forEach((b, i) => { b.classList.toggle("right", i === a); b.classList.toggle("dim", i !== a); if (picked === i) b.classList.add("picked"); });
  }
  function noteFor(q) {
    const items = [];
    if (q.fix) items.push(h("div", { class: "note" }, h("b", null, "Pembetulan:"), h("span", { class: "ar", dir: "rtl" }, q.fix)));
    if (q.x) items.push(h("div", { class: "note" }, h("b", null, "Catatan:"), h("span", null, q.x)));
    if (q.n && (q.cat === "fahm" || q.cat === "akmil" || q.cat === "tasykil")) items.push(h("div", { class: "sub", style: { textAlign: "center" } }, "Sumber: ", h("span", { class: "ar", style: { fontSize: "19px" } }, nashTitle(q.n))));
    return items;
  }
  ArenaCore.renderQ = renderQ; ArenaCore.optButtons = optButtons; ArenaCore.revealOpts = revealOpts; ArenaCore.noteFor = noteFor;

  // ---------- timer ----------
  function timerEl(seconds, onEnd) {
    const R = 28, C = 2 * Math.PI * R;
    const el = h("div", { class: "timer", "aria-label": "Waktu" , html: `<svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="${R}" stroke-width="6" fill="none"/><circle class="fg" cx="32" cy="32" r="${R}" stroke-width="6" fill="none" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg><b>${seconds}</b>` });
    let left = seconds, end = 0, iv = null, total = seconds;
    const fg = el.querySelector(".fg"), lab = el.querySelector("b");
    const draw = () => { lab.textContent = Math.ceil(left); fg.style.strokeDashoffset = String(C * (1 - left / total)); el.classList.toggle("low", left <= 5); };
    const tick = () => { left = Math.max(0, (end - Date.now()) / 1000); draw(); if (left <= 0) { stop(); onEnd && onEnd(); } };
    function start(from) { if (from != null) { left = from; } end = Date.now() + left * 1000; clearInterval(iv); iv = setInterval(tick, 200); tick(); }
    function stop() { clearInterval(iv); iv = null; }
    function running() { return !!iv; }
    function syncTo(endAt, tot) { total = tot; end = endAt; clearInterval(iv); iv = setInterval(tick, 200); tick(); }
    draw();
    return { el, start, stop, running, syncTo };
  }
  ArenaCore.timerEl = timerEl;

  // ---------- confetti ----------
  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = h("canvas", { class: "confetti" }); document.body.append(c);
    const ctx = c.getContext("2d"); c.width = innerWidth; c.height = innerHeight;
    const cols = ["#E2B862", "#3B7CF0", "#2BB5A0", "#E8704A", "#8F74E0", "#FBF7EC"];
    const ps = Array.from({ length: 160 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * .4, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 5, c: cols[rnd(cols.length)], a: Math.random() * 6 }));
    let f = 0; (function loop() { ctx.clearRect(0, 0, c.width, c.height); ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.a += .1; ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }); if (++f < 220) requestAnimationFrame(loop); else c.remove(); })();
  }
  ArenaCore.confetti = confetti;

  // ---------- kerangka layar ----------
  function topbar(title, sub) {
    return h("header", { class: "topbar" },
      h("button", { class: "btn ghost back", type: "button", onclick: () => go("home") }, "← Beranda"),
      h("a", { class: "brand link", href: "#", title: "Kembali ke beranda", onclick: (e) => { e.preventDefault(); go("home"); } }, h("span", { class: "seal-sm", html: SEAL }), h("div", null, h("h1", { class: "ui-ar", dir: "rtl" }, title), h("small", null, "Arena Muraja'ah" + (sub ? " · " + sub : "")))),
      h("div", { class: "spacer" }),
      h("span", { class: "chip" }, h("span", { class: "ar", style: { fontSize: "17px" } }, D().label), " · ", h("span", { class: "ar", style: { fontSize: "17px" } }, D().title)));
  }
  let cleanup = [];
  function go(screen, arg) {
    cleanup.forEach((f) => { try { f(); } catch (e) { /* */ } }); cleanup = [];
    document.querySelectorAll(".stage").forEach((s) => s.remove());
    const root = app(); root.innerHTML = ""; root.scrollTop = 0; window.scrollTo(0, 0);
    (SCREENS[screen] || SCREENS.home)(root, arg);
  }
  ArenaCore.go = go; ArenaCore.dropdown = dropdown; ArenaCore.onLeave = (f) => cleanup.push(f); ArenaCore.topbar = topbar;

  // =====================================================================
  const SCREENS = {};

  // ---------- BERANDA ----------
  SCREENS.home = (root) => {
    const d = D(); const b = d.bank;
    const nSoal = Object.values(b).reduce((s, a) => s + a.length, 0);
    const sel = dropdown(WAHDAH_LIST().map((w) => ({ value: w, label: () => h("span", { class: "dd-w" }, h("b", null, "Wahdah " + w), h("span", { class: "ar" }, window.ARENA_DATA[w].title)) })),
      S.wahdah, (v) => { S.wahdah = v; store.set("wahdah", S.wahdah); go("home"); }, "Pilih wahdah", "end");
    const mode = (key, color, icon, ar, t, d2, tag) => h("button", { class: "mode", type: "button", style: { "--mc": color }, onclick: () => go(key) },
      tag ? h("span", { class: "tag" }, tag) : null,
      h("span", { class: "ic", html: icon }), h("span", { class: "ar", dir: "rtl" }, ar), h("span", { class: "t" }, t), h("span", { class: "d" }, d2));
    root.append(h("div", { class: "wrap" },
      h("header", { class: "topbar" },
        h("a", { class: "brand link", href: "#", title: "Beranda", onclick: (e) => { e.preventDefault(); go("home"); }, html: SEAL + '<div><h1 class="ui-ar">Arena Muraja\'ah</h1><small>Qiraah · Al-\'Arabiyyah Bayna Yadaik 2</small></div>' }),
        h("div", { class: "spacer" }), h("div", { class: "row materi" }, h("span", { class: "sub" }, "Materi"), sel)),
      h("section", { class: "hero" },
        h("h2", { class: "ar-title", dir: "rtl" }, "سَاحَةُ ", h("em", null, "الْمُرَاجَعَةِ"), " — ", h("span", { class: "wt" }, d.title)),
        h("p", null, "Pilih model kuis. Mode proyektor cukup dengan satu layar; mode kuis langsung membuat setiap mahasiswa menjawab dari HP masing-masing."),
        h("div", { class: "meta" },
          h("div", { class: "stat" }, h("b", null, nSoal), h("span", null, "soal di bank")),
          h("div", { class: "stat" }, h("b", null, d.nusus.length), h("span", null, "nash")),
          h("div", { class: "stat" }, h("b", null, d.vocab.length), h("span", null, "mufradat")))),
      h("section", { class: "modes" },
        h("button", { class: "mode live", type: "button", style: { "--mc": "var(--saffron)" }, onclick: () => go("liveHost") },
          h("span", { class: "ic", html: I.phone }),
          h("span", { class: "txt" }, h("span", { class: "ar", dir: "rtl" }, "الْمُسَابَقَةُ الْمُبَاشِرَةُ"), h("span", { class: "t" }, "Kuis langsung via HP"), h("span", { class: "d" }, "Mahasiswa memindai QR, menjawab dari HP, papan skor bergerak langsung. Hasil bisa diunduh untuk nilai.")),
          h("span", { class: "btn primary" }, "Buka ruang kuis →")),
        mode("board", "var(--teal)", I.board, "لَوْحَةُ التَّحَدِّي", "Papan Tantangan Tim", "5 kategori × 5 tingkat poin. Kelompok bergiliran memilih kotak.", "Kelompok"),
        mode("fahm", "var(--coral)", I.book, "فَهْمُ النَّصِّ", "Pemahaman Nash", "Teks nash di samping soal; bukti jawaban disorot di teks.", "Klasikal"),
        mode("tasykil", "var(--violet)", I.pen, "رَتِّبْ وَشَكِّلْ", "Susun Kalimat & Tasykil", "Menyusun kata acak menjadi kalimat nash dan memilih harakat akhir yang benar.", "Maju ke depan"),
        mode("roda", "#4EA3E8", I.wheel, "عَجَلَةُ الْقِرَاءَةِ", "Roda Qiraah Jahriyyah", "Roda memilih mahasiswa untuk membaca nash, dinilai dengan rubrik singkat.", "Individu"),
        mode("kartu", "#E2558F", I.cards, "بِطَاقَاتُ الْمُفْرَدَاتِ", "Kartu Pasangan", "Mencocokkan kata dengan muradif atau mudhad-nya. Cocok untuk pemanasan.", "Pemanasan"),
        mode("bank", "#9DBDBA", I.list, "بَنْكُ الْأَسْئِلَةِ", "Bank Soal", "Semua soal beserta kunci jawaban, untuk diperiksa dosen sebelum kelas.", "Dosen")),
      h("p", { class: "footnote" }, "Tips: tekan F11 agar layar proyektor penuh. Skor kelompok tersimpan di perangkat ini.")));
  };

  // ---------- TIM ----------
  function teamPanel({ editable = true, turn = -1, onChange } = {}) {
    const box = h("div", { class: "panel" });
    const draw = () => {
      box.innerHTML = "";
      box.append(h("div", { class: "row", style: { marginBottom: "10px" } }, h("b", { class: "grow" }, "Kelompok"),
        editable ? h("button", { class: "btn small", type: "button", disabled: S.teams.length <= 2, onclick: () => { S.teams.pop(); saveTeams(); draw(); onChange && onChange(); } }, "−") : null,
        editable ? h("button", { class: "btn small", type: "button", disabled: S.teams.length >= 6, onclick: () => { const i = S.teams.length; S.teams.push({ name: TEAM_NAMES[i], color: TEAM_COLORS[i], score: 0 }); saveTeams(); draw(); onChange && onChange(); } }, "+") : null));
      const list = h("div", { class: "teams" });
      S.teams.forEach((t, i) => {
        const nm = editable ? h("input", { type: "text", id: "team-" + i, value: t.name, dir: "rtl", "aria-label": "Nama kelompok " + (i + 1), oninput: (e) => { t.name = e.target.value; saveTeams(); } }) : h("span", { class: "nm", dir: "rtl" }, t.name);
        list.append(h("div", { class: "team" + (i === turn ? " turn" : ""), style: { "--tc": t.color } }, h("span", { class: "sw" }), nm, h("span", { class: "sc" }, t.score)));
      });
      box.append(list, h("div", { class: "row", style: { marginTop: "10px" } },
        h("button", { class: "btn small ghost", type: "button", onclick: () => { S.teams.forEach((t) => (t.score = 0)); saveTeams(); draw(); onChange && onChange(); } }, "Nol-kan skor")));
    };
    draw();
    return { el: box, draw };
  }

  // ---------- PAPAN TANTANGAN ----------
  SCREENS.board = (root) => {
    const POINTS = [100, 200, 300, 400, 500], NC = 5;
    let board = store.get("board-" + S.wahdah, null);
    // Pilih 5 kategori yang soalnya cukup di cakupan ini; kolom yang kurang diisi soal kategori lain dari cakupan yang sama.
    const fresh = (sc) => {
      const pool = (id) => D().bank[id].filter(inScope(sc));
      const enough = CATS.filter((c) => pool(c.id).length >= POINTS.length);
      let chosen = CATS.slice(0, NC).filter((c) => enough.includes(c));
      enough.forEach((c) => { if (chosen.length < NC && !chosen.includes(c)) chosen.push(c); });
      CATS.filter((c) => !chosen.includes(c)).sort((a, b) => pool(b.id).length - pool(a.id).length).forEach((c) => { if (chosen.length < NC) chosen.push(c); });
      chosen = CATS.filter((c) => chosen.includes(c));
      const used = new Set();
      const cells = chosen.map((c) => sample(pool(c.id), POINTS.length).map((q) => { used.add(q); return { q, c: c.id, done: null }; }));
      const spare = shuffle(CATS.flatMap((c) => pool(c.id).filter((q) => !used.has(q)).map((q) => ({ q, c: c.id }))));
      cells.forEach((col) => { while (col.length < POINTS.length && spare.length) col.push({ ...spare.pop(), done: null }); });
      return { scope: sc, cats: chosen.map((c) => c.id), cells };
    };
    if (!board || !board.cells || board.scope !== getScope() || !board.cells.every((col) => col.length === POINTS.length && col.every((x) => x.c))) board = fresh(getScope());
    let cats = board.cats.map(catOf);
    const save = () => store.set("board-" + S.wahdah, board);
    const tp = teamPanel({ onChange: () => drawBoard() });
    const grid = h("div", { class: "board" });
    function drawBoard() {
      grid.innerHTML = "";
      cats.forEach((c) => grid.append(h("div", { class: "cat", dir: "rtl" }, c.ar)));
      POINTS.forEach((p, r) => cats.forEach((c, ci) => {
        const cell = board.cells[ci][r]; const t = cell.done != null && cell.done >= 0 ? S.teams[cell.done] : null;
        const btn = h("button", { class: "tile", type: "button", disabled: cell.done != null, "data-who": cell.done == null ? "" : t ? t.name : "—", style: t ? { "--tc": t.color } : null,
          "aria-label": c.id_ + " " + p, onclick: () => openQ(ci, r) }, p);
        grid.append(btn);
      }));
      tp.draw();
    }
    function openQ(ci, r) {
      const pts = POINTS[r]; const cell = board.cells[ci][r];
      const cc = catOf(cell.c) || cats[ci]; const q = prepare(cell.q, cc.id);
      let picked = null, revealed = false;
      const timer = timerEl(30, () => {});
      const opts = optButtons(q, (i, b) => { if (revealed) return; picked = i; opts.querySelectorAll(".opt").forEach((x) => x.classList.toggle("picked", x === b)); });
      const extra = h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } });
      const close = (who) => { timer.stop(); cell.done = who; if (who >= 0) { S.teams[who].score += pts; saveTeams(); } save(); stage.remove(); document.removeEventListener("keydown", onKey); drawBoard(); if (board.cells.every((col) => col.every((x) => x.done != null))) { confetti(); toast("Papan selesai!"); } };
      const revealBtn = h("button", { class: "btn primary", type: "button", onclick: reveal }, "Tampilkan jawaban (spasi)");
      function reveal() {
        if (revealed) return; revealed = true; timer.stop(); revealOpts(opts, q.a, picked); revealBtn.remove();
        extra.append(...noteFor(q), h("div", { class: "award" },
          S.teams.map((t, i) => h("button", { class: "btn", type: "button", style: { "--tc": t.color }, onclick: () => close(i) }, "+" + pts + " ", h("span", { class: "ar" }, t.name))),
          h("button", { class: "btn ghost", type: "button", onclick: () => close(-1) }, "Tidak ada yang benar")));
      }
      const onKey = (e) => { if (e.key === " " && !revealed) { e.preventDefault(); reveal(); } if (e.key === "Escape") { timer.stop(); stage.remove(); document.removeEventListener("keydown", onKey); } };
      document.addEventListener("keydown", onKey);
      const stage = h("div", { class: "stage", role: "dialog", "aria-modal": "true" },
        h("div", { class: "stage-inner" },
          h("div", { class: "qhead" }, h("span", { class: "pill gold" }, pts + " poin"), h("span", { class: "pill ar", style: { fontSize: "18px" } }, cc.ar), q.n ? h("span", { class: "pill" }, "Bagian " + q.n) : null, q.n && q.cat === "fahm" ? h("span", { class: "pill ar", style: { fontSize: "18px" } }, nashTitle(q.n)) : null,
            h("div", { class: "grow" }), timer.el,
            h("button", { class: "btn small", type: "button", onclick: () => (timer.running() ? timer.stop() : timer.start()) }, "Jeda/lanjut"),
            h("button", { class: "btn small ghost", type: "button", onclick: () => { timer.stop(); stage.remove(); document.removeEventListener("keydown", onKey); } }, "Tutup (Esc)")),
          ...renderQ(q), opts, h("div", { class: "row", style: { justifyContent: "center" } }, revealBtn), extra));
      document.body.append(stage); timer.start();
    }
    const regen = (sc) => { board = fresh(sc); cats = board.cats.map(catOf); save(); drawBoard(); };
    root.append(h("div", { class: "wrap" }, topbar("لَوْحَةُ التَّحَدِّي", "Papan Tantangan Tim"),
      h("div", { class: "row" }, scopePicker((v) => { regen(v); toast("Papan baru · " + scopeName(v)); })),
      h("div", { class: "board-layout" },
        h("div", { class: "panel" }, grid),
        h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } }, tp.el,
          h("div", { class: "panel" }, h("b", null, "Cara main"), h("p", { class: "sub", style: { lineHeight: 1.6 } }, "Kelompok bergiliran memilih kategori dan poin. Wakil kelompok menjawab dalam 30 detik. Dosen menekan spasi untuk menampilkan jawaban lalu memberi poin."),
            h("button", { class: "btn small", type: "button", onclick: () => { regen(getScope()); toast("Papan baru dengan soal acak"); } }, "Acak ulang papan"))))));
    drawBoard();
  };

  // ---------- PEMAHAMAN NASH ----------
  SCREENS.fahm = (root) => {
    let n = D().nusus[0].n, idx = 0, hide = false;
    const tabs = h("div", { class: "tabs" }); const kitab = h("div", { class: "kitab" }); const card = h("div", { class: "panel qcard" });
    let qs = [];
    function textWithMark(t, ev) {
      if (!ev) return [t]; const i = t.indexOf(ev); if (i < 0) return [t];
      return [t.slice(0, i), h("mark", null, ev), t.slice(i + ev.length)];
    }
    function drawText(ev) {
      const nu = D().nusus.find((u) => u.n === n); kitab.innerHTML = ""; kitab.classList.toggle("hidden-text", hide);
      kitab.append(h("h3", null, nu.title));
      if (nu.kind === "hiwar") nu.lines.forEach((l) => kitab.append(h("div", { class: "ln" }, h("span", { class: "sp", style: { color: l.c || "inherit" } }, l.s ? l.s + ":" : ""), h("span", null, ...textWithMark(l.t, ev)))));
      else nu.paras.forEach((p) => kitab.append(h("p", null, ...textWithMark(p, ev))));
      const m = kitab.querySelector("mark"); if (m) m.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    function drawTabs() { tabs.innerHTML = ""; D().nusus.forEach((u) => tabs.append(h("button", { class: "tab" + (u.n === n ? " on" : ""), type: "button", onclick: () => { n = u.n; load(); } }, "Nash " + u.n + " · ", h("span", { class: "ar" }, u.title)))); }
    function load() { qs = D().bank.fahm.filter((q) => q.n === n).map((q) => prepare(q, "fahm")); idx = 0; drawTabs(); drawQ(); }
    function drawQ() {
      drawText(null); card.innerHTML = ""; const q = qs[idx]; if (!q) { card.append(h("p", { class: "empty" }, "Belum ada soal untuk nash ini.")); return; }
      let revealed = false;
      const opts = optButtons(q, (i) => { if (revealed) return; revealed = true; revealOpts(opts, q.a, i); drawText(q.ev); after.append(...noteFor(q).filter((x) => !x.classList.contains("sub"))); });
      const after = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } });
      card.append(h("div", { class: "row" }, h("span", { class: "pill" }, (q.tf ? "صَوَابٌ أَمْ خَطَأٌ" : "اخْتَرِ الْجَوَابَ") ), h("span", { class: "grow" }), h("span", { class: "sub" }, "Soal " + (idx + 1) + " / " + qs.length)),
        h("p", { class: "qtext", dir: "rtl" }, q.q), opts, after,
        h("div", { class: "row" }, h("button", { class: "btn", type: "button", disabled: idx === 0, onclick: () => { idx--; drawQ(); } }, "← Sebelumnya"),
          h("button", { class: "btn ghost", type: "button", onclick: () => { if (!revealed) { revealed = true; revealOpts(opts, q.a, null); drawText(q.ev); after.append(...noteFor(q).filter((x) => !x.classList.contains("sub"))); } } }, "Tampilkan jawaban"),
          h("span", { class: "grow" }), h("button", { class: "btn primary", type: "button", disabled: idx >= qs.length - 1, onclick: () => { idx++; drawQ(); } }, "Berikutnya →")));
    }
    root.append(h("div", { class: "wrap" }, topbar("فَهْمُ النَّصِّ", "Pemahaman Nash"),
      h("div", { class: "row" }, tabs, h("span", { class: "grow" }), h("button", { class: "btn small", type: "button", onclick: (e) => { hide = !hide; kitab.classList.toggle("hidden-text", hide); e.target.textContent = hide ? "Tampilkan teks" : "Sembunyikan teks"; } }, "Sembunyikan teks")),
      h("div", { class: "fahm-layout" }, kitab, card)));
    load();
  };

  // ---------- SUSUN KALIMAT & TASYKIL ----------
  SCREENS.tasykil = (root) => {
    let sub = "rattib", nf = 0; // 0 = semua nash
    const body = h("div", { class: "panel", style: { display: "flex", flexDirection: "column", gap: "16px" } });
    const subTabs = h("div", { class: "tabs" }); const nashSel = dropdown([{ value: 0, label: "Semua nash" }].concat(D().nusus.map((u) => ({ value: u.n, label: "Nash " + u.n }))), 0, (v) => { nf = v; next(); }, "Filter nash", "end");
    function drawSub() { subTabs.innerHTML = ""; [["rattib", "رَتِّبِ الْكَلِمَاتِ", "Susun kalimat"], ["shakl", "اخْتَرِ الشَّكْلَ", "Harakat akhir"]].forEach(([k, ar, id]) => subTabs.append(h("button", { class: "tab" + (sub === k ? " on" : ""), type: "button", onclick: () => { sub = k; drawSub(); next(); } }, h("span", { class: "ar" }, ar), " · " + id))); }
    const used = { rattib: [], shakl: [] };
    function pickFrom(list, key) { const pool = list.filter((x) => !nf || x.n === nf); if (!pool.length) return null; let fresh = pool.filter((x) => !used[key].includes(x)); if (!fresh.length) { used[key] = []; fresh = pool; } const it = fresh[rnd(fresh.length)]; used[key].push(it); return it; }
    function next() { body.innerHTML = ""; if (sub === "rattib") rattib(); else shakl(); }
    function rattib() {
      const it = pickFrom(D().rattib, "rattib"); if (!it) return body.append(h("p", { class: "empty" }, "Tidak ada kalimat."));
      const words = it.s.replace(/[.،؛!؟:«»]/g, " ").split(/\s+/).filter(Boolean);
      let pool = shuffle(words.map((w, i) => ({ w, i }))); if (pool.every((p, k) => p.i === k)) pool = pool.reverse();
      let ans = []; const ansEl = h("div", { class: "chips answer", dir: "rtl" }); const poolEl = h("div", { class: "chips pool", dir: "rtl" }); const verdict = h("div", { class: "verdict" });
      const draw = () => {
        ansEl.className = "chips answer"; verdict.textContent = ""; verdict.className = "verdict";
        ansEl.innerHTML = ""; poolEl.innerHTML = "";
        ans.forEach((p, k) => ansEl.append(h("button", { class: "wchip", type: "button", onclick: () => { ans.splice(k, 1); pool.push(p); draw(); } }, p.w)));
        if (!ans.length) ansEl.append(h("span", { class: "sub" }, "Ketuk kata di bawah sesuai urutan"));
        pool.forEach((p, k) => poolEl.append(h("button", { class: "wchip", type: "button", onclick: () => { pool.splice(k, 1); ans.push(p); draw(); } }, p.w)));
      };
      const check = () => { const ok = ans.length === words.length && ans.map((p) => p.w).join(" ") === words.join(" "); ansEl.classList.add(ok ? "ok" : "no"); verdict.className = "verdict " + (ok ? "ok" : "no"); verdict.textContent = ok ? "صَحِيحٌ! Benar" : ans.length < words.length ? "Belum lengkap" : "Belum tepat, coba lagi"; if (ok) confetti(); };
      body.append(h("div", { class: "row" }, h("span", { class: "pill ar", style: { fontSize: "18px" } }, nashTitle(it.n)), h("span", { class: "grow" }), h("span", { class: "sub" }, words.length + " kata")),
        h("p", { class: "qtext", dir: "rtl", style: { fontSize: "30px" } }, "رَتِّبِ الْكَلِمَاتِ الْآتِيَةَ لِتَكُونَ جُمْلَةً مُفِيدَةً كَمَا فِي النَّصِّ:"),
        ansEl, poolEl, verdict,
        h("div", { class: "row", style: { justifyContent: "center" } }, h("button", { class: "btn", type: "button", onclick: () => { pool = pool.concat(ans); ans = []; draw(); } }, "Ulangi"),
          h("button", { class: "btn primary", type: "button", onclick: check }, "Periksa"),
          h("button", { class: "btn ghost", type: "button", onclick: () => { ans = words.map((w, i) => ({ w, i })); pool = []; draw(); check(); } }, "Lihat jawaban"),
          h("button", { class: "btn", type: "button", onclick: next }, "Kalimat lain →")));
      draw();
    }
    function shakl() {
      const raw = pickFrom(D().bank.tasykil, "shakl"); if (!raw) return body.append(h("p", { class: "empty" }, "Tidak ada soal."));
      const q = prepare(raw, "tasykil"); let done = false;
      const opts = optButtons(q, (i) => { if (done) return; done = true; revealOpts(opts, q.a, i); verdict.className = "verdict " + (i === q.a ? "ok" : "no"); verdict.textContent = i === q.a ? "صَحِيحٌ! Benar" : "Kurang tepat"; });
      const verdict = h("div", { class: "verdict" });
      body.append(h("div", { class: "row" }, h("span", { class: "pill ar", style: { fontSize: "18px" } }, nashTitle(q.n))), ...renderQ(q), opts, verdict,
        h("div", { class: "row", style: { justifyContent: "center" } }, h("button", { class: "btn ghost", type: "button", onclick: () => { if (!done) { done = true; revealOpts(opts, q.a, null); } } }, "Tampilkan jawaban"), h("button", { class: "btn primary", type: "button", onclick: next }, "Soal lain →")),
        h("p", { class: "sub", style: { textAlign: "center" } }, "Ajak mahasiswa menyebutkan alasan i'rab-nya: mengapa marfu', manshub, atau majrur?"));
    }
    root.append(h("div", { class: "wrap" }, topbar("رَتِّبْ وَشَكِّلْ", "Susun Kalimat & Tasykil"), h("div", { class: "row" }, subTabs, h("span", { class: "grow" }), nashSel), body));
    drawSub(); next();
  };

  // ---------- RODA QIRAAH ----------
  SCREENS.roda = (root) => {
    let names = store.get("names", []); let log = store.get("roda-log-" + S.wahdah, []); let removePicked = store.get("roda-remove", true);
    let absen = store.get("absen", 40); let used = [];
    const COLORS = ["#20B39F", "#E5683F", "#F0B649", "#8D6CD9", "#4EA3E8", "#E2558F"];
    const list = () => { const base = names.length ? names : Array.from({ length: absen }, (_, i) => "No. " + (i + 1)); return removePicked ? base.filter((x) => !used.includes(x)) : base; };
    const canvas = h("canvas", { width: 1040, height: 1040, "aria-label": "Roda nama" }); const ctx = canvas.getContext("2d");
    let rot = 0, spinning = false;
    function drawWheel() {
      const L = list(); const W = canvas.width, R = W / 2 - 8; ctx.clearRect(0, 0, W, W); ctx.save(); ctx.translate(W / 2, W / 2); ctx.rotate(rot);
      const seg = (2 * Math.PI) / Math.max(L.length, 1);
      L.forEach((name, i) => {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, i * seg, (i + 1) * seg); ctx.closePath(); ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill(); ctx.strokeStyle = "rgba(10,42,51,.5)"; ctx.lineWidth = 2; ctx.stroke();
        ctx.save(); ctx.rotate(i * seg + seg / 2); ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
        const fs = Math.max(14, Math.min(34, 900 / Math.max(L.length, 1))); ctx.font = `600 ${fs}px "Plus Jakarta Sans", sans-serif`;
        const label = name.length > 18 ? name.slice(0, 17) + "…" : name; ctx.fillText(label, R - 20, 0); ctx.restore();
      });
      ctx.restore(); ctx.beginPath(); ctx.arc(W / 2, W / 2, 46, 0, 2 * Math.PI); ctx.fillStyle = "#0A1B44"; ctx.fill(); ctx.strokeStyle = "#E2B862"; ctx.lineWidth = 6; ctx.stroke();
    }
    const pickedEl = h("div", { class: "picked-name", "aria-live": "polite" }, "—"); let pickedName = null;
    const passage = h("div", { class: "kitab", style: { maxHeight: "none" } }, h("p", { class: "sub", style: { fontFamily: "var(--font-ui)", textIndent: 0 } }, "Potongan bacaan akan muncul di sini."));
    let current = null; const scores = [0, 0, 0];
    const CRIT = [["مَخَارِجُ الْحُرُوفِ", "Makhraj"], ["صِحَّةُ الشَّكْلِ", "Harakat"], ["الطَّلَاقَةُ", "Kelancaran"]];
    const rubric = h("div", { class: "rubric" });
    function drawRubric() { rubric.innerHTML = ""; CRIT.forEach(([ar, id], c) => { rubric.append(h("div", null, h("div", { class: "ar" }, ar), h("div", { class: "sub", style: { textAlign: "right" } }, id)), h("div", { class: "stars" }, [1, 2, 3].map((v) => h("button", { class: scores[c] >= v ? "on" : "", type: "button", "aria-label": id + " " + v, onclick: () => { scores[c] = v; drawRubric(); } }, "★")))); }); }
    const logBody = h("tbody");
    function drawLog() { logBody.innerHTML = ""; log.slice().reverse().forEach((r) => logBody.append(h("tr", null, h("td", null, r.name), h("td", { class: "n" }, r.s.join(" / ")), h("td", { class: "n" }, r.total + "/9"), h("td", null, "Nash " + r.n)))); }
    function newPassage() {
      const nf = Number(nSel.value); const pool = D().bacaan.filter((b) => !nf || b.n === nf); const b = pool[rnd(pool.length)]; current = b; passage.innerHTML = "";
      passage.append(h("h3", null, nashTitle(b.n)));
      if (b.lines) b.lines.forEach((l) => passage.append(h("div", { class: "ln" }, h("span", { class: "sp", style: { color: l.c || "inherit" } }, l.s ? l.s + ":" : ""), h("span", null, l.t))));
      else passage.append(h("p", null, b.text));
    }
    function spin() {
      const L = list(); if (spinning || !L.length) { if (!L.length) toast("Semua nama sudah terpilih. Klik 'Kembalikan semua'."); return; }
      spinning = true; const start = rot, extra = 8 * Math.PI + Math.random() * 2 * Math.PI, dur = 4200, t0 = performance.now();
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      (function frame(now) {
        const k = reduce ? 1 : Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - k, 3); rot = start + extra * e; drawWheel();
        if (k < 1) return requestAnimationFrame(frame);
        spinning = false; const seg = (2 * Math.PI) / L.length; const a = ((-rot) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); const who = L[Math.floor(a / seg) % L.length];
        pickedEl.textContent = who; pickedName = who; scores.fill(0); drawRubric(); newPassage(); if (removePicked) used.push(who);
      })(t0);
    }
    const nSel = dropdown([{ value: 0, label: "Bacaan dari semua nash" }].concat(D().nusus.map((u) => ({ value: u.n, label: "Nash " + u.n }))), 0, () => newPassage(), "Nash bacaan");
    const ta = h("textarea", { id: "names", placeholder: "Tempel daftar nama mahasiswa, satu nama per baris" }); ta.value = names.join("\n");
    const settings = h("details", { class: "panel" }, h("summary", null, h("b", null, "Daftar nama"), " — ", names.length ? names.length + " nama" : "kosong (memakai nomor absen)"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" } }, ta,
        h("div", { class: "row" }, h("label", { class: "row sub" }, "Jika kosong, pakai nomor absen 1 sampai", h("input", { type: "number", id: "absen", min: 2, max: 120, value: absen, style: { width: "80px" }, onchange: (e) => { absen = Math.max(2, Math.min(120, Number(e.target.value) || 40)); store.set("absen", absen); drawWheel(); } }))),
        h("div", { class: "row" }, h("button", { class: "btn small primary", type: "button", onclick: () => { names = ta.value.split(/\n/).map((s) => s.trim()).filter(Boolean); store.set("names", names); used = []; drawWheel(); toast("Daftar nama disimpan di perangkat ini"); } }, "Simpan daftar"),
          h("label", { class: "row sub" }, h("input", { type: "checkbox", id: "rm", checked: removePicked, onchange: (e) => { removePicked = e.target.checked; store.set("roda-remove", removePicked); drawWheel(); } }), "Nama yang sudah terpilih tidak diputar lagi"),
          h("button", { class: "btn small ghost", type: "button", onclick: () => { used = []; drawWheel(); } }, "Kembalikan semua"))));
    root.append(h("div", { class: "wrap" }, topbar("عَجَلَةُ الْقِرَاءَةِ", "Roda Qiraah Jahriyyah"),
      h("div", { class: "roda-layout" },
        h("div", { class: "panel", style: { display: "flex", flexDirection: "column", gap: "14px", alignItems: "center" } },
          h("div", { class: "wheel-box" }, canvas, h("span", { class: "pointer" })), pickedEl,
          h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: spin }, "Putar roda"), nSel)),
        h("div", { style: { display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 } }, passage,
          h("div", { class: "panel", style: { display: "flex", flexDirection: "column", gap: "12px" } }, h("b", null, "Penilaian bacaan"), rubric,
            h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: () => {
              if (!current || !pickedName) return toast("Putar roda dulu");
              log.push({ name: pickedName, s: scores.slice(), total: scores.reduce((a, b) => a + b, 0), n: current.n, at: new Date().toISOString() }); store.set("roda-log-" + S.wahdah, log); drawLog(); toast("Nilai tersimpan");
            } }, "Simpan nilai"), h("button", { class: "btn small", type: "button", onclick: newPassage }, "Ganti bacaan"))),
          h("div", { class: "panel" }, h("div", { class: "row" }, h("b", { class: "grow" }, "Catatan nilai"),
            h("button", { class: "btn small", type: "button", onclick: () => copyText(["Nama\tMakhraj\tHarakat\tKelancaran\tTotal\tNash", ...log.map((r) => [r.name, ...r.s, r.total, r.n].join("\t"))].join("\n")) }, "Salin (untuk Excel)"),
            h("button", { class: "btn small ghost", type: "button", onclick: () => { if (!log.length) return; log = []; store.set("roda-log-" + S.wahdah, log); drawLog(); } }, "Kosongkan")),
            h("div", { class: "scroll-x" }, h("table", { class: "log" }, h("thead", null, h("tr", null, h("th", null, "Nama"), h("th", null, "Makhraj / Harakat / Lancar"), h("th", null, "Total"), h("th", null, "Bacaan"))), logBody))))),
      settings));
    drawWheel(); drawRubric(); drawLog();
  };

  // ---------- KARTU PASANGAN ----------
  SCREENS.kartu = (root) => {
    let kind = "mr", turn = 0, useTeams = store.get("kartu-teams", true);
    const grid = h("div", { class: "memory" }); const info = h("div", { class: "row" }); const tp = teamPanel({ editable: false, turn: 0 });
    const kindTabs = h("div", { class: "tabs" });
    let open = [], lock = false, moves = 0, found = 0, total = 0;
    function deal() {
      const pool = D().vocab.filter(inScope(getScope())).filter((v) => v.t !== "h" && (kind === "mr" ? v.mr : v.md));
      const pick = sample(pool, 8); total = pick.length; found = 0; moves = 0; open = []; lock = false;
      const cards = shuffle(pick.flatMap((v, i) => [{ id: i, txt: v.w, lab: "kata" }, { id: i, txt: (kind === "mr" ? v.mr : v.md).split("/")[0].trim(), lab: kind === "mr" ? "مُرَادِف" : "مُضَادّ" }]));
      grid.innerHTML = "";
      cards.forEach((c) => {
        const el = h("button", { class: "card", type: "button", "aria-label": "Kartu", onclick: () => flip(el, c) },
          h("span", { class: "in" }, h("span", { class: "face back", html: '<svg viewBox="0 0 48 48"><g fill="none" stroke="#E2B862" stroke-width="2"><rect x="11" y="11" width="26" height="26"/><rect x="11" y="11" width="26" height="26" transform="rotate(45 24 24)"/></g></svg>' }),
            h("span", { class: "face front" }, h("span", null, h("small", null, c.lab), c.txt))));
        grid.append(el);
      });
      drawInfo();
    }
    function drawInfo() { info.innerHTML = ""; info.append(h("span", { class: "pill" }, "Pasangan: " + found + " / " + total), h("span", { class: "pill" }, "Langkah: " + moves), h("span", { class: "grow" }),
      h("label", { class: "row sub" }, h("input", { type: "checkbox", id: "kt", checked: useTeams, onchange: (e) => { useTeams = e.target.checked; store.set("kartu-teams", useTeams); drawTeams(); } }), "Main per kelompok"),
      h("button", { class: "btn small", type: "button", onclick: deal }, "Kocok ulang")); }
    function drawTeams() { tp.el.style.display = useTeams ? "" : "none"; const n = tp.el; const fresh = teamPanel({ editable: false, turn }); n.replaceWith(fresh.el); tp.el = fresh.el; tp.el.style.display = useTeams ? "" : "none"; }
    function flip(el, c) {
      if (lock || el.classList.contains("flip") || el.classList.contains("done")) return;
      el.classList.add("flip"); open.push({ el, c });
      if (open.length === 2) {
        moves++; lock = true; const [a, b] = open;
        if (a.c.id === b.c.id) {
          setTimeout(() => { const col = useTeams ? S.teams[turn].color : null; [a, b].forEach((x) => { x.el.classList.add("done"); if (col) x.el.style.setProperty("--tc", col); }); if (useTeams) { S.teams[turn].score += 100; saveTeams(); } found++; open = []; lock = false; drawInfo(); drawTeams(); if (found === total) { confetti(); toast("Semua pasangan ditemukan!"); } }, 450);
        } else {
          setTimeout(() => { a.el.classList.remove("flip"); b.el.classList.remove("flip"); open = []; lock = false; if (useTeams) turn = (turn + 1) % S.teams.length; drawInfo(); drawTeams(); }, 1100);
        }
      }
    }
    function drawKinds() { kindTabs.innerHTML = ""; [["mr", "الْمُرَادِفُ", "Sinonim"], ["md", "الْمُضَادُّ", "Antonim"]].forEach(([k, ar, id]) => kindTabs.append(h("button", { class: "tab" + (kind === k ? " on" : ""), type: "button", onclick: () => { kind = k; drawKinds(); deal(); } }, h("span", { class: "ar" }, ar), " · " + id))); }
    root.append(h("div", { class: "wrap" }, topbar("بِطَاقَاتُ الْمُفْرَدَاتِ", "Kartu Pasangan"),
      h("div", { class: "row" }, kindTabs, h("span", { class: "grow" }), scopePicker(() => deal(), "end")), info,
      h("div", { class: "board-layout" }, h("div", { class: "panel" }, grid), h("div", null, tp.el))));
    drawKinds(); deal(); drawTeams();
  };

  // ---------- BANK SOAL ----------
  SCREENS.bank = (root) => {
    let cat = "fahm", nf = 0;
    const tabs = h("div", { class: "tabs" }); const list = h("div", { class: "panel" });
    const nSel = dropdown([{ value: 0, label: "Semua nash" }].concat(D().nusus.map((u) => ({ value: u.n, label: "Nash " + u.n }))), 0, (v) => { nf = v; draw(); }, "Filter nash", "end");
    function draw() {
      tabs.innerHTML = ""; CATS.forEach((c) => tabs.append(h("button", { class: "tab" + (cat === c.id ? " on" : ""), type: "button", onclick: () => { cat = c.id; draw(); } }, c.id_ + " (" + D().bank[c.id].length + ")")));
      list.innerHTML = ""; const qs = D().bank[cat].filter((q) => !nf || !q.n || q.n === nf);
      if (!qs.length) list.append(h("p", { class: "empty" }, "Tidak ada soal."));
      qs.forEach((q, i) => list.append(h("div", { class: "bank-q" },
        h("div", { class: "sub" }, "#" + (i + 1) + (q.n ? " · Nash " + q.n : "")),
        h("div", { class: "qq" }, q.q, q.s ? h("div", null, q.s[0], h("span", { class: cat === "tasykil" ? "hl" : "blank" }, cat === "tasykil" ? q.bare : "…"), q.s[1]) : null),
        h("div", { class: "oo" }, q.o.map((o, k) => h("span", { class: k === q.a ? "ok" : "" }, (k === q.a ? "✓ " : "") + o))),
        q.fix ? h("div", { class: "x" }, "Pembetulan: ", h("span", { class: "ar", style: { fontSize: "18px" } }, q.fix)) : null,
        q.x ? h("div", { class: "x" }, q.x) : null)));
    }
    root.append(h("div", { class: "wrap" }, topbar("بَنْكُ الْأَسْئِلَةِ", "Bank Soal & Kunci"), h("div", { class: "row" }, tabs, h("span", { class: "grow" }), nSel),
      h("p", { class: "sub" }, "Soal makna, sinonim/antonim, isian, dan harakat dibangkitkan dari data mufradat dan nash; soal pemahaman dan tarakib ditulis manual. Saat kuis, urutan pilihan selalu diacak."), list));
    draw();
  };

  // ---------- boot ----------
  function boot() {
    if (!WAHDAH_LIST().length) { app().append(h("p", { class: "empty" }, "Data wahdah belum dimuat.")); return; }
    const params = new URLSearchParams(location.search);
    const room = params.get("room") || (location.hash.startsWith("#join") ? location.hash.slice(5).replace(/^-/, "") : null);
    if (params.has("room") || location.hash.startsWith("#join")) { (window.ArenaLive && ArenaLive.player) ? ArenaLive.player(app(), room) : app().append(h("p", { class: "empty" }, "Modul kuis langsung tidak dimuat.")); return; }
    go("home");
  }
  SCREENS.liveHost = (root) => (window.ArenaLive ? ArenaLive.host(root) : root.append(h("p", { class: "empty" }, "Modul kuis langsung tidak dimuat.")));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
