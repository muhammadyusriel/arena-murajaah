# Arena Muraja'ah

Aplikasi kuis muraja'ah interaktif untuk mata kuliah Qiraah (*Al-'Arabiyyah Bayna Yadaik* Jilid 2).

Dikembangkan oleh **Muhammad Yusriel Amien, S.Ag.**

- **Mode proyektor:** Papan Tantangan Tim, Pemahaman Nash, Susun Kalimat & Tasykil, Roda Qiraah, Kartu Pasangan, Bank Soal.
- **Kuis langsung via HP:** mahasiswa memindai QR, menjawab dari HP, skor berdasarkan ketepatan dan kecepatan, papan skor langsung, rekap CSV.

Struktur:

- `index.html` — halaman aplikasi
- `config.js` — konfigurasi Firebase untuk kuis HP
- `assets/` — tampilan dan logika aplikasi
- `data/wNN.js` — bank soal per wahdah (tambah satu berkas + satu baris `<script>` di `index.html` untuk wahdah baru)
- `firebase/database.rules.json` — aturan keamanan Realtime Database
