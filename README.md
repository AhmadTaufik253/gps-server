# GPS TCP Server

Ini adalah server TCP berbasis Node.js yang berfungsi untuk menerima, mem-parsing, dan meneruskan data dari perangkat pelacak GPS (seperti GT06, VT100, dan lainnya) ke API backend (misalnya Laravel). Server ini mendengarkan koneksi dari perangkat GPS, memproses data mentah (raw data) yang dikirim dalam bentuk hex/string, lalu memilah berdasarkan protokol yang sesuai, dan meneruskannya.

## Struktur Proyek

- `server.js` - Titik masuk utama aplikasi (Main entry point). Menjalankan TCP server.
- `services/` - Logika bisnis, seperti deteksi protokol (`deviceService.js`) dan pengiriman data ke API/backend (`locationService.js`).
- `handlers/` - Parser khusus untuk masing-masing protokol (misalnya `gt06Handler.js`, `vt100Handler.js`, `genericHandler.js`).
- `utils/` - Utilitas pendukung, contohnya `logger.js`.
- `dummy-sender.js` - Skrip untuk mengirim data simulasi/palsu (dummy data) ke TCP server untuk keperluan pengujian.
- `sim-client.js` - Skrip tambahan untuk simulasi klien (berdasarkan protokol tertentu).
- `.env` - File konfigurasi environment (Port, URL API, dll).

## Prasyarat

- Node.js terinstal
- NPM terinstal

## Instalasi

1. Clone repositori ini atau pindah ke folder `gps-server`.
2. Jalankan perintah instalasi dependency:
   ```bash
   npm install
   ```
3. Salin file konfigurasi environment (jika belum ada `.env`, buat berdasarkan `.env.example` jika tersedia):
   ```bash
   cp .env.example .env
   ```
4. Sesuaikan variabel dalam `.env` (misalnya port TCP yang akan digunakan dan URL endpoint tujuan).

## Cara Menjalankan

Untuk menjalankan server TCP secara lokal:
```bash
npm start
```
Atau jika menggunakan `node` langsung:
```bash
node server.js
```
Server akan berjalan di port `7000` secara bawaan atau sesuai dengan yang ada pada `process.env.TCP_PORT`.

## Pengujian (Testing)

Anda dapat menguji apakah server berjalan dan memproses data dengan benar menggunakan skrip pengujian yang disediakan.

1. Buka terminal baru dan pastikan server sudah berjalan (`npm start`).
2. Jalankan skrip `dummy-sender`:
   ```bash
   node dummy-sender.js
   ```
3. Skrip tersebut akan otomatis terhubung ke port `7000` (atau port di `.env`) dan mulai mengirimkan data GPS koordinat dummy setiap 5 detik. Anda akan melihat log di jendela terminal `server.js` yang menunjukkan bahwa data diterima dan diproses.

## Protokol yang Didukung
- GT06
- VT100
- *Generic* (Protokol fallback standar)

Protokol lebih lanjut dapat ditambahkan dengan membuat handler baru di dalam folder `/handlers` dan mendaftarkannya di `server.js`.