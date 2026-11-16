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
  // ---------- PIN DOSEN (Bank Soal) ----------
  // Catatan: ini penghalang untuk mahasiswa, bukan pengamanan penuh — situs statis tetap bisa dibongkar oleh yang paham teknis.
  const PIN = window.ARENA_PIN && window.ARENA_PIN.hash ? window.ARENA_PIN : null;
  const PIN_LOCKED = new Set(["bank", "pantau"]);
  let pinSession = false, lastPin = null;
  const pinOk = () => !PIN || pinSession || store.get("pin-ok", "") === PIN.hash;
  const lockPin = () => { pinSession = false; store.set("pin-ok", ""); };
  async function pinHash(pin) {
    const enc = new TextEncoder(); const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(PIN.salt), iterations: PIN.iter || 150000, hash: "SHA-256" }, key, 256);
    return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function askPin(onOk) {
    const inp = h("input", { type: "password", id: "pin", inputmode: "numeric", autocomplete: "off", maxlength: 12, class: "pin-in", "aria-label": "PIN dosen", placeholder: "• • • • • •" });
    const rem = h("input", { type: "checkbox", id: "pin-rem", checked: store.get("pin-rem", true) });
    const msg = h("p", { class: "pin-msg", role: "alert" });
    const box = h("form", { class: "pin-card", onsubmit: async (e) => {
      e.preventDefault(); const until = store.get("pin-wait", 0);
      if (Date.now() < until) { msg.textContent = "Terlalu banyak percobaan. Coba lagi dalam " + Math.ceil((until - Date.now()) / 1000) + " detik."; return; }
      const v = inp.value.trim(); if (!v) return inp.focus();
      btn.disabled = true; msg.textContent = "Memeriksa…"; let ok = false;
      try { ok = (await pinHash(v)) === PIN.hash; } catch (err) { msg.textContent = "Peramban ini tidak mendukung pemeriksaan PIN."; btn.disabled = false; return; }
      btn.disabled = false;
      if (ok) { store.set("pin-fail", 0); pinSession = true; lastPin = v; store.set("pin-rem", rem.checked); store.set("pin-ok", rem.checked ? PIN.hash : ""); close(); onOk && onOk(v); return; }
      const n = store.get("pin-fail", 0) + 1; store.set("pin-fail", n); if (n >= 5) { store.set("pin-wait", Date.now() + 30000); store.set("pin-fail", 0); }
      msg.textContent = n >= 5 ? "PIN salah 5 kali. Tunggu 30 detik." : "PIN salah."; box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake"); inp.select(); SFX.wrong();
    } },
      h("span", { class: "pin-ic", html: '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>' }),
      h("h2", null, "Khusus dosen"), h("p", { class: "sub" }, "Masukkan PIN untuk membuka Bank Soal dan kunci jawaban."),
      inp, h("label", { class: "row sub", style: { justifyContent: "center" } }, rem, "Ingat di perangkat ini"), msg,
      h("div", { class: "row", style: { justifyContent: "center" } }, h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Batal")));
    const btn = h("button", { class: "btn primary", type: "submit" }, "Buka"); box.lastChild.append(btn);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const stage = h("div", { class: "stage pin-stage", role: "dialog", "aria-modal": "true", "aria-label": "PIN dosen" }, box);
    function close() { stage.remove(); document.removeEventListener("keydown", onKey); }
    document.addEventListener("keydown", onKey); document.body.append(stage); setTimeout(() => inp.focus(), 50);
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
  // ---------- EFEK SUARA (dibangkitkan Web Audio, tanpa berkas audio) ----------
  const SFX = (() => {
    let ctx = null, master = null, on = store.get("sound", true);
    const ac = () => {
      if (!on) return null;
      try { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination); } if (ctx.state === "suspended") ctx.resume(); } catch (e) { return null; }
      return ctx;
    };
    document.addEventListener("pointerdown", () => { if (on && ctx && ctx.state === "suspended") ctx.resume(); }, true);
    function tone(f, d, { type = "sine", g = 0.3, at = 0, to = null, a = 0.008 } = {}) {
      const c = ac(); if (!c) return; const t = c.currentTime + at; const o = c.createOscillator(), v = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
      v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + a); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(v); v.connect(master); o.start(t); o.stop(t + d + 0.05);
    }
    function noise(d, { g = 0.2, at = 0, f0 = 800, f1 = 3000, q = 1 } = {}) {
      const c = ac(); if (!c) return; const t = c.currentTime + at; const n = Math.floor(c.sampleRate * d); const buf = c.createBuffer(1, n, c.sampleRate); const ch = buf.getChannelData(0);
      for (let k = 0; k < n; k++) ch[k] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf; const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = q; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + d);
      const v = c.createGain(); v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + d * 0.3); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(bp); bp.connect(v); v.connect(master); src.start(t); src.stop(t + d + 0.05);
    }
    const notes = (seq, opt) => seq.forEach(([f, at, d]) => tone(f, d || 0.18, { ...opt, at }));
    return {
      get on() { return on; },
      set(v) { on = !!v; store.set("sound", on); if (!on && ctx) { try { ctx.suspend(); } catch (e) { /* */ } } else ac(); },
      tick(urgent) { tone(urgent ? 1560 : 1180, 0.05, { type: "square", g: urgent ? 0.12 : 0.07 }); },
      timeup() { tone(330, 0.5, { type: "sawtooth", g: 0.12, to: 165 }); tone(247, 0.5, { type: "square", g: 0.06, to: 123 }); },
      start() { notes([[523, 0], [659, 0.09], [784, 0.18], [1047, 0.27, 0.32]], { type: "triangle", g: 0.2 }); },
      right() { notes([[659, 0, 0.14], [988, 0.11, 0.38]], { type: "sine", g: 0.32 }); tone(1976, 0.3, { g: 0.05, at: 0.11 }); },
      wrong() { tone(196, 0.32, { type: "sawtooth", g: 0.12, to: 130 }); tone(185, 0.32, { type: "square", g: 0.05, to: 123, at: 0.02 }); },
      reveal() { tone(392, 1.1, { g: 0.22, a: 0.01 }); tone(784, 0.8, { g: 0.08 }); tone(1176, 0.5, { g: 0.04 }); noise(0.25, { g: 0.05, f0: 3000, f1: 6000 }); },
      whoosh() { noise(0.45, { g: 0.22, f0: 300, f1: 2600, q: 0.8 }); },
      pop() { tone(880, 0.09, { type: "sine", g: 0.16, to: 1320 }); },
      flip() { noise(0.07, { g: 0.12, f0: 1800, f1: 2600, q: 2 }); },
      match() { notes([[784, 0, 0.12], [1175, 0.08, 0.3]], { type: "triangle", g: 0.2 }); },
      spin() { tone(1400, 0.025, { type: "square", g: 0.05 }); },
      award() { notes([[523, 0, 0.1], [784, 0.07, 0.1], [1047, 0.14, 0.36]], { type: "triangle", g: 0.22 }); },
      fanfare() {
        notes([[523, 0, 0.16], [523, 0.17, 0.12], [523, 0.3, 0.12], [659, 0.43, 0.3], [523, 0.75, 0.16], [659, 0.92, 0.16], [784, 1.09, 0.9]], { type: "triangle", g: 0.24 });
        [392, 494, 587].forEach((f) => tone(f, 1.2, { g: 0.07, at: 1.09, a: 0.05 })); [262, 330].forEach((f) => tone(f / 2, 1.4, { type: "sine", g: 0.1, at: 1.09, a: 0.05 }));
      },
    };
  })();
  const SPK_ON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const SPK_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function soundBtn() {
    const b = h("button", { class: "btn small ghost snd", type: "button" });
    const paint = () => { b.innerHTML = (SFX.on ? SPK_ON : SPK_OFF) + "<span>" + (SFX.on ? "Suara" : "Senyap") + "</span>"; b.setAttribute("aria-pressed", String(SFX.on)); b.title = SFX.on ? "Matikan efek suara" : "Nyalakan efek suara"; b.classList.toggle("off", !SFX.on); };
    b.addEventListener("click", () => { SFX.set(!SFX.on); document.querySelectorAll(".snd").forEach((x) => x.dispatchEvent(new Event("repaint"))); if (SFX.on) SFX.pop(); });
    b.addEventListener("repaint", paint); paint(); return b;
  }

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
    home: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/></svg>',
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
  window.ArenaCore = { h, shuffle, sample, rnd, arNum, store, toast, copyText, downloadText, SHAPES, CATS, catOf, prepare, D, S, TEAM_NAMES, TEAM_COLORS, saveTeams, nashTitle, getScope, inScope, scopeName, scopePicker, SFX, soundBtn, renderQ: null, timerEl: null, go: null, SEAL, I };

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
  function timerEl(seconds, onEnd, { sound = false } = {}) {
    const R = 28, C = 2 * Math.PI * R;
    const el = h("div", { class: "timer", "aria-label": "Waktu" , html: `<svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="${R}" stroke-width="6" fill="none"/><circle class="fg" cx="32" cy="32" r="${R}" stroke-width="6" fill="none" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg><b>${seconds}</b>` });
    let left = seconds, end = 0, iv = null, total = seconds;
    const fg = el.querySelector(".fg"), lab = el.querySelector("b");
    const draw = () => { lab.textContent = Math.ceil(left); fg.style.strokeDashoffset = String(C * (1 - left / total)); el.classList.toggle("low", left <= 5); };
    let lastSec = null;
    const tick = () => { left = Math.max(0, (end - Date.now()) / 1000); draw();
      if (sound) { const sc = Math.ceil(left); if (sc !== lastSec) { if (lastSec != null && sc <= 5 && sc > 0) SFX.tick(sc <= 3); lastSec = sc; } }
      if (left <= 0) { stop(); if (sound) SFX.timeup(); onEnd && onEnd(); } };
    function start(from) { lastSec = null; if (from != null) { left = from; } end = Date.now() + left * 1000; clearInterval(iv); iv = setInterval(tick, 200); tick(); }
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
      h("div", { class: "spacer" }), soundBtn(),
      h("span", { class: "chip" }, h("span", { class: "ar", style: { fontSize: "17px" } }, D().label), " · ", h("span", { class: "ar", style: { fontSize: "17px" } }, D().title)));
  }
  let cleanup = [];
  function go(screen, arg) {
    if (PIN_LOCKED.has(screen) && !pinOk()) return askPin(() => go(screen, arg));
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
      tag ? h("span", { class: "tag" }, PIN_LOCKED.has(key) && PIN ? h("span", { class: "lk", html: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>' }) : null, tag) : null,
      h("span", { class: "ic", html: icon }), h("span", { class: "ar", dir: "rtl" }, ar), h("span", { class: "t" }, t), h("span", { class: "d" }, d2));
    root.append(h("div", { class: "wrap" },
      h("header", { class: "topbar" },
        h("a", { class: "brand link", href: "#", title: "Beranda", onclick: (e) => { e.preventDefault(); go("home"); }, html: SEAL + '<div><h1 class="ui-ar">Arena Muraja\'ah</h1><small>Qiraah · Al-\'Arabiyyah Bayna Yadaik 2</small></div>' }),
        h("div", { class: "spacer" }), soundBtn(), h("div", { class: "row materi" }, h("span", { class: "sub" }, "Materi"), sel)),
      h("section", { class: "hero" },
        h("h2", { class: "ar-title", dir: "rtl" }, "سَاحَةُ ", h("em", null, "الْمُرَاجَعَةِ"), " — ", h("span", { class: "wt" }, d.title)),
        h("div", { class: "intro" }, h("span", { class: "kick" }, "Muraja'ah Wahdah " + S.wahdah),
          h("p", null, "Pilih model kuis. Mode proyektor cukup dengan satu layar; mode kuis langsung membuat setiap mahasiswa menjawab dari HP masing-masing.")),
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
        mode("bank", "#9DBDBA", I.list, "بَنْكُ الْأَسْئِلَةِ", "Bank Soal", "Semua soal beserta kunci jawaban, untuk diperiksa dosen sebelum kelas." + (PIN ? " Dibuka dengan PIN." : ""), "Dosen"),
        h("button", { class: "mode live self", type: "button", style: { "--mc": "var(--teal)" }, onclick: () => go("latihanShare") },
          h("span", { class: "ic", html: I.home }),
          h("span", { class: "txt" }, h("span", { class: "ar", dir: "rtl" }, "التَّدْرِيبُ الذَّاتِيُّ"), h("span", { class: "t" }, "Latihan mandiri di HP"), h("span", { class: "d" }, "Mahasiswa mengulang soal sendiri di rumah tanpa ruang kuis: pilih bagian, langsung tahu benar-salah, lalu ulangi soal yang salah.")),
          h("span", { class: "btn" }, "Bagikan ke mahasiswa →"))),
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
      const timer = timerEl(30, () => {}, { sound: true });
      const opts = optButtons(q, (i, b) => { if (revealed) return; picked = i; opts.querySelectorAll(".opt").forEach((x) => x.classList.toggle("picked", x === b)); });
      const extra = h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } });
      const close = (who) => { timer.stop(); cell.done = who; if (who >= 0) { S.teams[who].score += pts; saveTeams(); SFX.award(); } else SFX.wrong(); save(); stage.remove(); document.removeEventListener("keydown", onKey); drawBoard(); if (board.cells.every((col) => col.every((x) => x.done != null))) { confetti(); SFX.fanfare(); toast("Papan selesai!"); } };
      const revealBtn = h("button", { class: "btn primary", type: "button", onclick: reveal }, "Tampilkan jawaban (spasi)");
      function reveal() {
        if (revealed) return; revealed = true; timer.stop(); revealOpts(opts, q.a, picked); revealBtn.remove(); if (picked == null) SFX.reveal(); else if (picked === q.a) SFX.right(); else SFX.wrong();
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
      document.body.append(stage); SFX.start(); timer.start();
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
      const opts = optButtons(q, (i) => { if (revealed) return; revealed = true; revealOpts(opts, q.a, i); i === q.a ? SFX.right() : SFX.wrong(); drawText(q.ev); after.append(...noteFor(q).filter((x) => !x.classList.contains("sub"))); });
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
      const check = () => { const ok = ans.length === words.length && ans.map((p) => p.w).join(" ") === words.join(" "); ansEl.classList.add(ok ? "ok" : "no"); verdict.className = "verdict " + (ok ? "ok" : "no"); verdict.textContent = ok ? "صَحِيحٌ! Benar" : ans.length < words.length ? "Belum lengkap" : "Belum tepat, coba lagi"; if (ok) { confetti(); SFX.right(); } else SFX.wrong(); };
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
      const opts = optButtons(q, (i) => { if (done) return; done = true; revealOpts(opts, q.a, i); i === q.a ? SFX.right() : SFX.wrong(); verdict.className = "verdict " + (i === q.a ? "ok" : "no"); verdict.textContent = i === q.a ? "صَحِيحٌ! Benar" : "Kurang tepat"; });
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
      let lastSeg = null; const segW = (2 * Math.PI) / L.length;
      (function frame(now) {
        const k = reduce ? 1 : Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - k, 3); rot = start + extra * e; drawWheel();
        const sg = Math.floor(((-rot) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) / segW); if (sg !== lastSeg) { if (lastSeg != null && k < 1) SFX.spin(); lastSeg = sg; }
        if (k < 1) return requestAnimationFrame(frame);
        spinning = false; const seg = (2 * Math.PI) / L.length; const a = ((-rot) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); const who = L[Math.floor(a / seg) % L.length];
        SFX.award(); pickedEl.textContent = who; pickedName = who; scores.fill(0); drawRubric(); newPassage(); if (removePicked) used.push(who);
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
      el.classList.add("flip"); SFX.flip(); open.push({ el, c });
      if (open.length === 2) {
        moves++; lock = true; const [a, b] = open;
        if (a.c.id === b.c.id) {
          setTimeout(() => { SFX.match(); const col = useTeams ? S.teams[turn].color : null; [a, b].forEach((x) => { x.el.classList.add("done"); if (col) x.el.style.setProperty("--tc", col); }); if (useTeams) { S.teams[turn].score += 100; saveTeams(); } found++; open = []; lock = false; drawInfo(); drawTeams(); if (found === total) { confetti(); SFX.fanfare(); toast("Semua pasangan ditemukan!"); } }, 450);
        } else {
          SFX.wrong(); setTimeout(() => { a.el.classList.remove("flip"); b.el.classList.remove("flip"); open = []; lock = false; if (useTeams) turn = (turn + 1) % S.teams.length; drawInfo(); drawTeams(); }, 1100);
        }
      }
    }
    function drawKinds() { kindTabs.innerHTML = ""; [["mr", "الْمُرَادِفُ", "Sinonim"], ["md", "الْمُضَادُّ", "Antonim"]].forEach(([k, ar, id]) => kindTabs.append(h("button", { class: "tab" + (kind === k ? " on" : ""), type: "button", onclick: () => { kind = k; drawKinds(); deal(); } }, h("span", { class: "ar" }, ar), " · " + id))); }
    root.append(h("div", { class: "wrap" }, topbar("بِطَاقَاتُ الْمُفْرَدَاتِ", "Kartu Pasangan"),
      h("div", { class: "row" }, kindTabs, h("span", { class: "grow" }), scopePicker(() => deal(), "end")), info,
      h("div", { class: "board-layout" }, h("div", { class: "panel" }, grid), h("div", null, tp.el))));
    drawKinds(); deal(); drawTeams();
  };

  // ---------- LATIHAN MANDIRI ----------
  const latihanUrl = () => location.origin + location.pathname + "?latihan=" + S.wahdah;
  SCREENS.latihanShare = (root) => {
    const url = latihanUrl(); const qr = h("div", { id: "qr-lat" });
    root.append(h("div", { class: "wrap" }, topbar("التَّدْرِيبُ الذَّاتِيُّ", "Latihan mandiri"),
      h("div", { class: "lobby" },
        h("div", { class: "qrbox" }, h("b", null, "Pindai untuk latihan"), qr, h("div", { class: "url" }, url),
          h("button", { class: "btn small", type: "button", style: { color: "#0A1B44", background: "#EEF3FF" }, onclick: () => copyText(url) }, "Salin tautan")),
        h("div", { class: "panel", style: { display: "flex", flexDirection: "column", gap: "12px" } },
          h("b", null, "Cara pakai"),
          h("ol", { class: "steps" },
            h("li", null, "Tampilkan QR ini di kelas, atau salin tautannya ke grup WhatsApp kelas."),
            h("li", null, "Mahasiswa membuka tautan di HP, memilih bagian dan jenis soal, lalu berlatih."),
            h("li", null, "Setiap jawaban langsung diberi tahu benar atau salah beserta catatannya. Di akhir, mereka bisa mengulang soal yang salah saja.")),
          h("p", { class: "sub", style: { lineHeight: 1.6 } }, "Mahasiswa menulis nama (dan NIM bila mau) sebelum berlatih. Setiap selesai latihan, hasilnya terkirim ke server dan bisa Ustadz pantau lewat tombol di bawah (dengan PIN). Mahasiswa tidak bisa melihat hasil teman-temannya. Tautan ini membuka Wahdah " + S.wahdah + "; mahasiswa tetap bisa memilih wahdah lain yang sudah tersedia."),
          h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: () => go("pantau") }, "Pantau hasil latihan →"), h("button", { class: "btn", type: "button", onclick: () => go("latihan") }, "Coba latihan di layar ini"))))));
    if (window.QRCode) { try { new window.QRCode(qr, { text: url, width: 560, height: 560, colorDark: "#0A1B44", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) { /* */ } }
    else qr.append(h("p", { class: "sub" }, "(QR tidak tersedia, gunakan tautan)"));
  };

  SCREENS.latihan = (root, student) => {
    const box = h("div", { class: "player latihan" });
    if (student) box.append(h("header", { class: "brand", html: SEAL + '<div><h1 class="ui-ar">Arena Muraja\'ah</h1><small>Latihan mandiri</small></div>' }, h("span", { class: "spacer", style: { flex: 1 } }), soundBtn()));
    else root.append(h("div", { class: "wrap" }, topbar("التَّدْرِيبُ الذَّاتِيُّ", "Latihan mandiri")));
    const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } }); box.append(body); root.append(box);
    const say = (...k) => { body.innerHTML = ""; body.append(...k); window.scrollTo(0, 0); };
    const cfg = store.get("lat-cfg", { cats: CATS.map((c) => c.id), count: 10 });
    const bestKey = () => "lat-best-" + S.wahdah + "-" + getScope();
    const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
    const online = !!(window.ARENA_FIREBASE && window.ARENA_FIREBASE.apiKey && window.ArenaLive);
    const me = { name: store.get("lat-name", ""), nim: store.get("lat-nim", "") };
    async function sendResult(rec) {
      if (!online || !me.name) return "off";
      try {
        const net = await window.ArenaLive.initNet("firebase"); if (!net) return "off";
        const base = "latihan/w" + S.wahdah + "/" + net.uid;
        const job = Promise.all([net.update(base + "/profile", { name: me.name, nim: me.nim || "", updated: net.TS }), net.set(base + "/sesi/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), { ...rec, at: net.TS })]);
        const r = await Promise.race([job.then(() => "ok"), new Promise((res) => setTimeout(() => res("wait"), 9000))]);
        return r;
      } catch (e) { return "fail"; }
    }

    function setup() {
      const wsel = WAHDAH_LIST().length > 1 ? dropdown(WAHDAH_LIST().map((w) => ({ value: w, label: () => h("span", { class: "dd-w" }, h("b", null, "Wahdah " + w), h("span", { class: "ar" }, window.ARENA_DATA[w].title)) })), S.wahdah, (v) => { S.wahdah = v; store.set("wahdah", v); setup(); }, "Pilih wahdah") : null;
      const catBox = h("div", { class: "chips-sel" });
      const drawCats = () => { catBox.innerHTML = ""; CATS.forEach((c) => { const on = cfg.cats.includes(c.id); catBox.append(h("button", { class: "csel" + (on ? " on" : ""), type: "button", "aria-pressed": String(on), onclick: () => { cfg.cats = on ? cfg.cats.filter((x) => x !== c.id) : cfg.cats.concat(c.id); store.set("lat-cfg", cfg); drawCats(); upd(); } }, h("span", { class: "ar" }, c.ar), h("small", null, c.id_))); }); };
      const avail = () => cfg.cats.reduce((a, c) => a + D().bank[c].filter(inScope(getScope())).length, 0);
      const info = h("p", { class: "sub", style: { textAlign: "center", margin: 0 } });
      const best = store.get(bestKey(), null);
      const upd = () => { const n = avail(); const needName = online && me.name.length < 2; info.textContent = needName ? "Tulis namamu dulu agar latihan tercatat." : n + " soal tersedia" + (cfg.count && n < cfg.count ? " (semua akan dipakai)" : ""); startBtn.disabled = !n || needName; };
      const cnt = dropdown([10, 20, 30, 0].map((v) => ({ value: v, label: v ? v + " soal" : "Semua soal" })), cfg.count, (v) => { cfg.count = v; store.set("lat-cfg", cfg); upd(); }, "Jumlah soal");
      const startBtn = h("button", { class: "btn primary", type: "button", style: { fontSize: "18px", padding: "14px" }, onclick: () => run(buildSet()) }, "Mulai latihan →");
      const nmI = h("input", { type: "text", id: "lat-name", maxlength: 40, placeholder: "Nama lengkap", value: me.name, autocomplete: "name", "aria-label": "Nama lengkap", oninput: (e) => { me.name = e.target.value.trim().replace(/\s+/g, " ").slice(0, 40); store.set("lat-name", me.name); upd(); } });
      const nimI = h("input", { type: "text", id: "lat-nim", maxlength: 20, placeholder: "NIM (opsional)", value: me.nim, inputmode: "numeric", "aria-label": "NIM", oninput: (e) => { me.nim = e.target.value.trim().slice(0, 20); store.set("lat-nim", me.nim); } });
      say(h("div", { class: "card-p" },
          h("p", { class: "qtext", dir: "rtl", style: { margin: 0 } }, D().title),
          online ? h("div", { class: "lat-id" }, nmI, nimI, h("small", { class: "sub" }, "Hasil latihanmu tercatat untuk dosen dengan nama ini.")) : null,
          wsel ? h("label", { class: "row" }, h("span", { class: "sub", style: { minWidth: "88px" } }, "Wahdah"), wsel) : h("p", { class: "status", style: { margin: 0 } }, "Wahdah " + S.wahdah),
          scopePicker(() => setup()),
          h("div", { class: "row" }, h("span", { class: "sub", style: { minWidth: "88px" } }, "Jumlah"), cnt),
          h("div", null, h("div", { class: "sub", style: { marginBottom: "8px" } }, "Jenis soal"), catBox),
          info, startBtn,
          best ? h("p", { class: "status", style: { margin: 0 } }, "Skor terbaikmu di " + scopeName(getScope()).toLowerCase() + ": ", h("b", null, best.r + "/" + best.n + " (" + pct(best.r, best.n) + "%)")) : null));
      drawCats(); upd();
    }
    function buildSet() {
      const sc = getScope(); const all = shuffle(cfg.cats.flatMap((c) => D().bank[c].filter(inScope(sc)).map((q) => ({ q, c }))));
      return (cfg.count ? all.slice(0, cfg.count) : all).map(({ q, c }) => prepare({ ...q, _k: c + ":" + D().bank[c].indexOf(q) }, c));
    }
    function run(set, retry) {
      let k = 0, right = 0, streak = 0, ans = 0; const wrong = []; const t0 = Date.now();
      const next = () => {
        if (k >= set.length) return summary(set, right, wrong, retry, t0);
        const q = set[k]; let done = false;
        const verdict = h("div", { class: "verdict" }); const after = h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } });
        const opts = optButtons(q, (i) => {
          if (done) return; done = true; ans++; revealOpts(opts, q.a, i); const ok = i === q.a;
          if (ok) { right++; streak++; SFX.right(); } else { streak = 0; wrong.push({ q, picked: i }); SFX.wrong(); }
          try { navigator.vibrate && navigator.vibrate(ok ? 50 : [80, 50, 80]); } catch (e) { /* */ }
          verdict.className = "verdict " + (ok ? "ok" : "no"); verdict.textContent = ok ? "صَحِيحٌ! Benar" + (streak >= 3 ? "  🔥" + streak : "") : "Kurang tepat";
          score.textContent = "✓ " + right;
          after.append(...noteFor(q), h("button", { class: "btn primary", type: "button", id: "lat-next", style: { fontSize: "18px", padding: "14px" }, onclick: () => { k++; next(); } }, k + 1 < set.length ? "Berikutnya →" : "Lihat hasil →"));
          const nb = after.querySelector("#lat-next"); nb && nb.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        const score = h("span", { class: "pill gold" }, "✓ " + right);
        say(h("div", { class: "row" }, h("span", { class: "pill" }, "Soal " + (k + 1) + " / " + set.length), retry ? h("span", { class: "pill" }, "Ulang yang salah") : null, h("span", { class: "grow" }), score),
          h("div", { class: "meter lat-meter" }, h("i", { style: { width: (100 * k) / set.length + "%" } })),
          h("div", { class: "row" }, h("span", { class: "pill ar", style: { fontSize: "17px" } }, catOf(q.cat).ar), q.n ? h("span", { class: "pill" }, "Bagian " + q.n) : null),
          h("div", { class: "card-p" }, ...renderQ(q), opts, verdict, after),
          h("button", { class: "btn small ghost", type: "button", style: { alignSelf: "center" }, onclick: () => summary(set.slice(0, ans), right, wrong, retry, t0) }, "Akhiri latihan"));
      };
      next();
    }
    function summary(set, right, wrong, retry, t0) {
      const n = set.length, p = pct(right, n);
      const sent = h("p", { class: "sub lat-sent", style: { margin: 0 } });
      if (n && online && me.name) {
        sent.textContent = "Mengirim hasil ke dosen…";
        sendResult({ n, right, scope: getScope(), retry: !!retry, dur: Math.round((Date.now() - (t0 || Date.now())) / 1000), w: wrong.map((x) => x.q._k).filter(Boolean).slice(0, 60) })
          .then((st) => { sent.textContent = st === "ok" ? "✓ Hasil tercatat untuk dosen" : st === "wait" ? "Hasil akan terkirim saat koneksi tersambung (biarkan halaman ini terbuka)" : st === "off" ? "" : "Hasil belum terkirim. Periksa koneksi internet."; sent.classList.toggle("ok", st === "ok"); });
      }
      if (!retry && n) { const b = store.get(bestKey(), null); if (!b || p > pct(b.r, b.n) || (p === pct(b.r, b.n) && n > b.n)) store.set(bestKey(), { r: right, n, at: Date.now() }); }
      const [ar, idn] = p >= 90 ? ["مُمْتَازٌ", "Luar biasa!"] : p >= 75 ? ["جَيِّدٌ جِدًّا", "Bagus sekali!"] : p >= 60 ? ["جَيِّدٌ", "Bagus, tingkatkan lagi."] : ["حَاوِلْ مَرَّةً أُخْرَى", "Ayo ulangi, pasti bisa."];
      if (p >= 75 && n) { confetti(); SFX.fanfare(); }
      say(h("div", { class: "card-p", style: { alignItems: "center", textAlign: "center" } },
          h("p", { class: "qtext", dir: "rtl", style: { margin: 0 } }, ar), h("div", { class: "lat-pct" }, p + "%"),
          h("p", { class: "status", style: { margin: 0 } }, right + " dari " + n + " soal benar · " + idn), sent,
          h("div", { class: "row", style: { justifyContent: "center" } },
            wrong.length ? h("button", { class: "btn primary", type: "button", onclick: () => run(shuffle(wrong.map((w) => prepare(w.q, w.q.cat))), true) }, "Ulangi yang salah (" + wrong.length + ")") : null,
            h("button", { class: wrong.length ? "btn" : "btn primary", type: "button", onclick: () => run(buildSet()) }, "Latihan baru"),
            h("button", { class: "btn ghost", type: "button", onclick: setup }, "Ubah pengaturan"))),
        wrong.length ? h("h3", { style: { margin: "6px 0 0" } }, "Soal yang perlu diulang") : null,
        ...wrong.map((w) => h("div", { class: "card-p lat-wrong" }, ...renderQ(w.q, { compact: true }),
          h("div", { class: "rc-ans" }, h("span", null, "Jawabanmu: ", h("b", { class: "ar wr" }, w.q.o[w.picked])), h("span", null, "Kunci: ", h("b", { class: "ar" }, w.q.o[w.q.a]))), ...noteFor(w.q))));
    }
    setup();
  };

  // ---------- PANTAU LATIHAN (dosen) ----------
  SCREENS.pantau = (root) => {
    const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "16px" } });
    root.append(h("div", { class: "wrap" }, topbar("مُتَابَعَةُ التَّدْرِيبِ", "Pantau latihan mandiri"), body));
    const msg = (t, extra) => { body.innerHTML = ""; body.append(h("div", { class: "panel", style: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-start" } }, h("p", { class: "sub", style: { margin: 0, lineHeight: 1.6 } }, t), extra || null)); };
    if (!(window.ARENA_FIREBASE && window.ARENA_FIREBASE.apiKey) || !window.ArenaLive) return msg("Server kuis belum diatur di sini, jadi hasil latihan tidak bisa dipantau. Buka halaman ini dari situs live.");
    msg("Menghubungkan ke server…");
    let net = null, off = null, data = {}, open = new Set(), confirmDel = false;
    let period = store.get("pantau-period", 0), sortBy = store.get("pantau-sort", "last");
    cleanup.push(() => off && off());
    const fmt = (t) => (t ? new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
    const ago = (t) => { if (!t) return "—"; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "baru saja" : m < 60 ? m + " mnt lalu" : m < 1440 ? Math.round(m / 60) + " jam lalu" : Math.round(m / 1440) + " hari lalu"; };
    const pc = (a, b) => (b ? Math.round((100 * a) / b) : 0);
    const since = () => { if (period === 1) { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); } return period ? Date.now() - period * 86400000 : 0; };
    function rows() {
      const t0 = since(); const by = {};
      Object.entries(data).forEach(([uid, v]) => {
        const pf = v.profile || {}; const name = (pf.name || "?").trim(); const nim = (pf.nim || "").trim(); const key = name.toLowerCase() + "|" + nim;
        const st = by[key] || (by[key] = { key, name, nim, uids: [], sesi: [] }); st.uids.push(uid);
        Object.values(v.sesi || {}).forEach((x) => { if ((x.at || 0) >= t0) st.sesi.push(x); });
      });
      return Object.values(by).filter((x) => x.sesi.length).map((x) => {
        x.sesi.sort((a, b) => (b.at || 0) - (a.at || 0));
        x.n = x.sesi.reduce((a, y) => a + (y.n || 0), 0); x.right = x.sesi.reduce((a, y) => a + (y.right || 0), 0); x.avg = pc(x.right, x.n);
        x.best = Math.max(...x.sesi.filter((y) => !y.retry).map((y) => pc(y.right, y.n)), 0); x.last = x.sesi[0].at || 0;
        x.parts = [...new Set(x.sesi.map((y) => y.scope || 0))].sort(); x.dur = x.sesi.reduce((a, y) => a + (y.dur || 0), 0);
        return x;
      });
    }
    function draw() {
      const list = rows();
      const sorters = { last: (a, b) => b.last - a.last, name: (a, b) => a.name.localeCompare(b.name, "id"), low: (a, b) => a.avg - b.avg, many: (a, b) => b.n - a.n };
      list.sort(sorters[sortBy] || sorters.last);
      const tn = list.reduce((a, x) => a + x.n, 0), tr = list.reduce((a, x) => a + x.right, 0), ts = list.reduce((a, x) => a + x.sesi.length, 0);
      const perSel = dropdown([[0, "Semua waktu"], [7, "7 hari terakhir"], [1, "Hari ini"]].map(([v, l]) => ({ value: v, label: l })), period, (v) => { period = v; store.set("pantau-period", v); draw(); }, "Periode");
      const sortSel = dropdown([["last", "Terakhir berlatih"], ["name", "Nama (A–Z)"], ["low", "Ketepatan terendah"], ["many", "Soal terbanyak"]].map(([v, l]) => ({ value: v, label: l })), sortBy, (v) => { sortBy = v; store.set("pantau-sort", v); draw(); }, "Urutkan", "end");
      const table = h("div", { class: "ptable" }, h("div", { class: "pr ph" }, h("span", null, "Mahasiswa"), h("span", null, "Sesi"), h("span", null, "Soal"), h("span", null, "Ketepatan"), h("span", null, "Terbaik"), h("span", null, "Bagian"), h("span", null, "Terakhir")));
      list.forEach((x) => {
        const isOpen = open.has(x.key); const lv = x.avg < 50 ? "hard" : x.avg < 80 ? "mid" : "easy";
        table.append(h("button", { class: "pr " + lv + (isOpen ? " open" : ""), type: "button", onclick: () => { isOpen ? open.delete(x.key) : open.add(x.key); draw(); } },
          h("span", { class: "pn" }, h("b", null, x.name), x.nim ? h("small", null, x.nim) : null),
          h("span", null, x.sesi.length), h("span", null, x.n),
          h("span", { class: "pa" }, h("i", { class: "pm" }, h("i", { style: { width: Math.max(3, x.avg) + "%" } })), x.avg + "%"),
          h("span", null, x.best + "%"),
          h("span", { class: "pb" }, x.parts.map((b) => h("i", null, b ? "B" + b : "Semua"))),
          h("span", { class: "sub" }, ago(x.last))));
        if (isOpen) table.append(h("div", { class: "pdetail" }, x.sesi.slice(0, 30).map((y) => h("div", { class: "ps" },
          h("span", null, fmt(y.at)), h("span", null, y.scope ? "Bagian " + y.scope : "Semua bagian"), h("span", null, y.right + "/" + y.n + " benar"), h("b", null, pc(y.right, y.n) + "%"),
          h("span", { class: "sub" }, (y.dur ? Math.max(1, Math.round(y.dur / 60)) + " mnt" : "") + (y.retry ? " · ulang yang salah" : ""))))));
      });
      // soal paling sering salah
      const cnt = {}; list.forEach((x) => x.sesi.forEach((y) => (y.w || []).forEach((k) => (cnt[k] = (cnt[k] || 0) + 1))));
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, c]) => { const [cat, i] = k.split(":"); const q = (D().bank[cat] || [])[Number(i)]; return q ? { q, cat, c } : null; }).filter(Boolean);
      const csv = () => { const q3 = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
        return ["Nama,NIM,Sesi,Soal Dijawab,Benar,Ketepatan %,Terbaik %,Bagian Dilatih,Total Menit,Terakhir Berlatih", ...list.map((x) => [q3(x.name), q3(x.nim), x.sesi.length, x.n, x.right, x.avg, x.best, q3(x.parts.map((b) => (b ? "B" + b : "Semua")).join(" ")), Math.round(x.dur / 60), q3(fmt(x.last))].join(","))].join("\n"); };
      body.innerHTML = "";
      body.append(
        h("div", { class: "row" }, h("span", { class: "sub" }, "Periode"), perSel, h("span", { class: "grow" }), h("span", { class: "sub" }, "Urutkan"), sortSel),
        h("div", { class: "rsum" },
          h("div", { class: "stat" }, h("b", null, String(list.length)), h("span", null, "mahasiswa berlatih")),
          h("div", { class: "stat" }, h("b", null, String(ts)), h("span", null, "sesi latihan")),
          h("div", { class: "stat" }, h("b", null, String(tn)), h("span", null, "soal dijawab")),
          h("div", { class: "stat" }, h("b", null, pc(tr, tn) + "%"), h("span", null, "rata-rata ketepatan"))),
        list.length ? h("div", { class: "panel", style: { padding: "10px" } }, table) : h("div", { class: "panel" }, h("p", { class: "empty" }, "Belum ada mahasiswa yang berlatih" + (period ? " pada periode ini." : " di Wahdah " + S.wahdah + ". Bagikan tautan latihan dari halaman sebelumnya."))),
        top.length ? h("h3", { style: { margin: "6px 0 0" } }, "5 soal yang paling sering salah saat latihan") : null,
        top.length ? h("div", { class: "rlist" }, top.map((t, k) => h("div", { class: "rcard hard", style: { cursor: "default" } },
          h("div", { class: "rc-top" }, h("span", { class: "rk" }, "#" + (k + 1)), h("span", { class: "pill ar" }, catOf(t.cat).ar), t.q.n ? h("span", { class: "pill" }, "Bagian " + t.q.n) : null, h("span", { class: "grow" }), h("span", { class: "pct" }, t.c + "×"), h("small", { class: "sub" }, "salah")),
          h("p", { class: "rc-q", dir: "rtl" }, (t.q.q || "") + (t.q.s ? "  " + t.q.s[0] + " … " + t.q.s[1] : "")),
          h("div", { class: "rc-ans" }, h("span", null, "Kunci: ", h("b", { class: "ar" }, t.q.o[t.q.a])))))) : null,
        h("div", { class: "row", style: { justifyContent: "center" } },
          h("button", { class: "btn primary", type: "button", disabled: !list.length, onclick: () => downloadText("latihan-wahdah-" + S.wahdah + ".csv", csv()) }, "Unduh rekap (CSV)"),
          h("button", { class: "btn ghost", type: "button", onclick: () => go("latihanShare") }, "Tautan & QR latihan"),
          h("button", { class: "btn ghost" + (confirmDel ? " danger" : ""), type: "button", id: "del-lat", onclick: async () => {
            if (!confirmDel) { confirmDel = true; draw(); setTimeout(() => { confirmDel = false; }, 6000); return; }
            try { await net.remove("latihan/w" + S.wahdah); toast("Data latihan Wahdah " + S.wahdah + " dihapus"); } catch (e) { toast("Gagal menghapus"); } confirmDel = false; } }, confirmDel ? "Klik lagi untuk menghapus permanen" : "Hapus data latihan wahdah ini")),
        h("p", { class: "sub", style: { textAlign: "center", lineHeight: 1.6 } }, "Data diperbarui otomatis. Nama ditulis sendiri oleh mahasiswa; mahasiswa yang belum pernah berlatih tidak muncul di daftar."));
    }
    (async () => {
      try { net = await window.ArenaLive.initNet("firebase"); } catch (e) { return msg("Tidak bisa terhubung ke server. Periksa koneksi internet."); }
      if (!net) return msg("Server kuis belum diatur.");
      const reg = async (pin) => { try { await net.set("admins/" + net.uid, pin); return true; } catch (e) { return false; } };
      let admin = await net.get("admins/" + net.uid).catch(() => null);
      if (!admin && lastPin) admin = await reg(lastPin);
      if (!admin) return msg("Laptop ini perlu didaftarkan sekali sebagai perangkat dosen. Masukkan PIN untuk mendaftarkannya.",
        h("button", { class: "btn primary", type: "button", onclick: () => askPin(async (v) => { if (await reg(v)) go("pantau"); else toast("PIN tidak diterima server"); }) }, "Masukkan PIN"));
      off = net.on("latihan/w" + S.wahdah, (v) => { data = v || {}; draw(); });
    })();
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
    root.append(h("div", { class: "wrap" }, topbar("بَنْكُ الْأَسْئِلَةِ", "Bank Soal & Kunci"), h("div", { class: "row" }, tabs, h("span", { class: "grow" }), nSel,
      PIN ? h("button", { class: "btn small ghost", type: "button", id: "relock", title: "Kunci Bank Soal lagi di perangkat ini", onclick: () => { lockPin(); toast("Bank Soal dikunci lagi"); go("home"); } }, "Kunci lagi") : null),
      h("p", { class: "sub" }, "Soal makna, sinonim/antonim, isian, dan harakat dibangkitkan dari data mufradat dan nash; soal pemahaman dan tarakib ditulis manual. Saat kuis, urutan pilihan selalu diacak."), list));
    draw();
  };

  // ---------- boot ----------
  function boot() {
    if (!WAHDAH_LIST().length) { app().append(h("p", { class: "empty" }, "Data wahdah belum dimuat.")); return; }
    const params = new URLSearchParams(location.search);
    const room = params.get("room") || (location.hash.startsWith("#join") ? location.hash.slice(5).replace(/^-/, "") : null);
    if (params.has("room") || location.hash.startsWith("#join")) { (window.ArenaLive && ArenaLive.player) ? ArenaLive.player(app(), room) : app().append(h("p", { class: "empty" }, "Modul kuis langsung tidak dimuat.")); return; }
    if (params.has("latihan")) { const w = Number(params.get("latihan")); if (WAHDAH_LIST().includes(w)) { S.wahdah = w; store.set("wahdah", w); } SCREENS.latihan(app(), true); return; }
    go("home");
  }
  SCREENS.liveHost = (root) => (window.ArenaLive ? ArenaLive.host(root) : root.append(h("p", { class: "empty" }, "Modul kuis langsung tidak dimuat.")));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
