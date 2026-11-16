/* Konfigurasi server kuis langsung (Firebase).
   Ganti null di bawah dengan objek firebaseConfig dari Firebase Console
   (Project settings → Your apps → Web app → SDK setup and configuration → Config).
   Pastikan ada baris databaseURL. Contoh:

   window.ARENA_FIREBASE = {
     apiKey: "AIza...",
     authDomain: "arena-muraja-ah.firebaseapp.com",
     databaseURL: "https://arena-muraja-ah-default-rtdb.asia-southeast1.firebasedatabase.app",
     projectId: "arena-muraja-ah",
     appId: "1:1234567890:web:abcdef"
   };
*/
window.ARENA_FIREBASE = {
  apiKey: "AIzaSyAB7z8c3NoZ7BINZNORt6Y7mtlmyyRZDoM",
  authDomain: "arena-murajaah.firebaseapp.com",
  databaseURL: "https://arena-murajaah-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "arena-murajaah",
  storageBucket: "arena-murajaah.firebasestorage.app",
  messagingSenderId: "623772960146",
  appId: "1:623772960146:web:d429edbfe03d3dcaea2d4b"
};

/* PIN dosen untuk membuka Bank Soal (yang disimpan hanya sandi-acak PBKDF2, bukan PIN-nya).
   Untuk mengganti PIN, minta Asisten 3 membuat nilai baru. Hapus baris ini bila tidak ingin memakai PIN. */
window.ARENA_PIN = {"salt":"2dddf2117249df8687359751","hash":"ae0e98c0e076f01de17f3150155c46e9c65f25179934c48559953167f3985232","iter":150000};
