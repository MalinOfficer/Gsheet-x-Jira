# Firebase Studio - GSheet Dashboard & Tools

Ini adalah aplikasi Next.js yang dibuat di Firebase Studio. Aplikasi ini menyediakan serangkaian alat untuk mengelola, mengonversi, dan menganalisis data yang berasal dari Google Sheets dan file Excel/JSON.

## Fitur Utama

- **Import Flow**: Mengonversi data JSON menjadi format tabel, kemudian mengekspornya ke Google Sheets atau memperbarui status kasus yang ada.
- **Daily Report**: Menampilkan ringkasan statistik dari data yang dikonversi.
- **Migrasi Murid**: Alat mirip spreadsheet untuk memasukkan dan memformat data migrasi siswa.
- **Cek Duplikasi**: Mengunggah beberapa file Excel untuk menemukan NIS duplikat atau data yang tidak valid.
- **Data Weaver**: Menggabungkan dua file Excel berdasarkan kolom yang sama dan memvalidasi kecocokan data.
- **Code Viewer**: Menampilkan seluruh kode sumber aplikasi ini dengan opsi untuk mengunduh setiap file.

---

## Panduan Deployment Lengkap

Berikut adalah panduan langkah demi langkah untuk men-deploy aplikasi ini dari awal hingga akhir.

### Langkah 1: Siapkan Struktur File dan Kode

Semua file yang diperlukan untuk menjalankan aplikasi ini tersedia di menu **"Code Viewer"**.

1.  **Buat Folder Proyek**: Di komputer Anda, buat folder baru untuk proyek ini (misalnya, `gsheet-dashboard`).
2.  **Unduh Semua File**: Buka menu **"Code Viewer"** di aplikasi ini. Unduh setiap file satu per satu dan letakkan di dalam folder proyek Anda sesuai dengan path (struktur folder) yang tertulis.
    *   Misalnya, file dengan path `src/app/page.tsx` harus disimpan di dalam folder `src/app/` di dalam folder proyek Anda.
    *   Pastikan Anda membuat semua sub-folder yang diperlukan (`src`, `app`, `components`, `lib`, `hooks`, dll.).

Setelah selesai, struktur folder proyek Anda akan terlihat persis seperti yang dijelaskan di "Code Viewer".

### Langkah 2: Instalasi Dependensi

Setelah semua file berada di tempat yang benar, buka terminal atau command prompt di dalam folder proyek Anda dan jalankan perintah berikut. Perintah ini akan menginstal semua library dan paket yang dibutuhkan oleh aplikasi.

```bash
npm install
```

### Langkah 3: Konfigurasi Google Sheets API & Kredensial

Aplikasi ini memerlukan akses ke Google Sheets API untuk membaca dan menulis data. Ikuti langkah-langkah ini dengan cermat.

1.  **Buat Proyek Google Cloud**:
    *   Buka [Google Cloud Console](https://console.cloud.google.com/).
    *   Buat proyek baru jika Anda belum memilikinya.

2.  **Aktifkan Google Sheets API**:
    *   Di dasbor proyek Anda, navigasikan ke "APIs & Services".
    *   Klik **"+ ENABLE APIS AND SERVICES"**.
    *   Cari "Google Sheets API" dan aktifkan.

3.  **Buat Service Account**:
    *   Di menu "APIs & Services", buka **"Credentials"**.
    *   Klik **"+ CREATE CREDENTIALS"** dan pilih **"Service account"**.
    *   Beri nama service account Anda (misalnya, `gsheet-updater-bot`) dan klik **"CREATE AND CONTINUE"**.
    *   Berikan peran (Role) **"Editor"** agar service account dapat membaca dan menulis data. Klik **"CONTINUE"**, lalu **"DONE"**.

4.  **Buat Kunci (Key) JSON**:
    *   Di daftar kredensial, temukan service account yang baru saja Anda buat dan klik.
    *   Buka tab **"KEYS"**.
    *   Klik **"ADD KEY"** -> **"Create new key"**.
    *   Pilih format **JSON** dan klik **"CREATE"**. Sebuah file JSON akan otomatis terunduh.

5.  **Salin Kredensial ke Aplikasi**:
    *   Buka file JSON yang baru saja Anda unduh dengan teks editor.
    *   Salin **seluruh konten** file JSON tersebut.
    *   Tempel konten tersebut ke dalam file `src/lib/gcp-credentials.json` di proyek Anda, ganti konten yang ada.

6.  **Bagikan Google Sheet Anda**:
    *   Di dalam file `src/lib/gcp-credentials.json`, temukan nilai dari `client_email`. Alamat email ini terlihat seperti `xxxx@xxxx.iam.gserviceaccount.com`.
    *   Buka Google Sheet yang ingin Anda gunakan dengan aplikasi ini.
    *   Klik tombol **"Share"** di pojok kanan atas.
    *   Tempelkan `client_email` dari service account Anda, berikan akses **"Editor"**, dan klik **"Share"**.

### Langkah 4: Build Aplikasi

Setelah konfigurasi selesai, saatnya untuk mem-build aplikasi agar siap untuk di-deploy. Jalankan perintah berikut di terminal Anda:

```bash
npm run build
```

Perintah ini akan membuat versi produksi yang dioptimalkan dari aplikasi Anda di dalam folder `.next`.

### Langkah 5: Deploy ke Firebase

Aplikasi ini dikonfigurasi untuk deployment yang mudah menggunakan **Firebase App Hosting**.

1.  **Install Firebase CLI**: Jika Anda belum menginstalnya, jalankan perintah berikut:
    ```bash
    npm install -g firebase-tools
    ```

2.  **Login ke Firebase**:
    ```bash
    firebase login
    ```

3.  **Inisialisasi Firebase**: Di dalam folder proyek Anda, jalankan:
    ```bash
    firebase init
    ```
    *   Pilih **"App Hosting"** dari daftar.
    *   Pilih **"Use an existing project"** dan pilih proyek Firebase yang ingin Anda gunakan.

4.  **Deploy Aplikasi**: Terakhir, jalankan perintah deploy:
    ```bash
    firebase deploy
    ```

Firebase CLI akan meng-upload file build Anda. Setelah selesai, ia akan memberikan URL publik tempat aplikasi Anda sekarang dapat diakses. Selesai!
