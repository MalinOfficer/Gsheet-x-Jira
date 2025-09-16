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

## Panduan Deployment ke Vercel

Vercel adalah platform yang direkomendasikan untuk men-deploy aplikasi Next.js ini.

### Prasyarat

1.  **Akun Vercel**: Daftar atau login di [vercel.com](https://vercel.com).
2.  **Akun GitHub**: Daftar atau login di [github.com](https://github.com).
3.  **Git Terinstal**: Pastikan Git terinstal di komputer Anda.
4.  **Node.js Terinstal**: Pastikan Node.js terinstal di komputer Anda.

### Langkah 1: Siapkan Kode di GitHub

1.  **Buat Repositori Baru di GitHub**:
    *   Buka [halaman pembuatan repositori baru di GitHub](https://github.com/new).
    *   Beri nama repositori Anda (misalnya, `gsheet-dashboard-vercel`).
    *   Pastikan repositori diatur ke **Public** atau **Private**.
    *   Klik tombol **"Create repository"**.

2.  **Unggah Kode Anda ke GitHub**:
    *   Buka terminal di folder proyek Anda.
    *   Ikuti perintah-perintah berikut untuk mengunggah kode Anda. Ganti URL di baris ketiga dengan URL repositori yang baru saja Anda buat.
      ```bash
      git init -b main
      git add .
      git commit -m "Initial commit"
      git remote add origin https://github.com/NAMA_ANDA/NAMA_REPOSITORI_ANDA.git
      git push -u origin main
      ```

### Langkah 2: Konfigurasi Variabel Lingkungan (Environment Variables)

Aplikasi ini memerlukan kredensial Google Cloud untuk mengakses Google Sheets API. Anda harus menyediakannya sebagai *Environment Variable* di Vercel.

1.  **Dapatkan Kredensial JSON Anda**:
    *   Ikuti panduan di file `src/lib/gcp-credentials.json` untuk membuat *service account* dan mengunduh file kunci JSON-nya.
    *   Buka file JSON tersebut dengan editor teks.

2.  **Format Kredensial untuk Vercel**:
    *   Salin **seluruh isi** file JSON tersebut.
    *   Isi file JSON tersebut adalah satu baris panjang atau beberapa baris. Kita perlu memastikan formatnya benar. Tidak perlu diubah, cukup salin apa adanya.

3.  **Tambahkan ke Vercel**:
    *   Buka proyek Anda di dasbor Vercel.
    *   Navigasi ke **Settings** -> **Environment Variables**.
    *   Buat variabel baru dengan nama `GCP_CREDENTIALS`.
    *   Tempelkan **seluruh konten file JSON** yang telah Anda salin ke dalam kolom *Value*.
    *   Pastikan semua *environment* (Production, Preview, Development) tercentang.
    *   Klik **Save**.

4.  **Bagikan Google Sheet Anda**:
    *   Di dalam konten JSON yang baru saja Anda tempel, temukan nilai dari `client_email`. Alamat email ini terlihat seperti `xxxx@xxxx.iam.gserviceaccount.com`.
    *   Buka Google Sheet yang ingin Anda gunakan.
    *   Klik tombol **"Share"** dan berikan akses **"Editor"** ke alamat email tersebut.

### Langkah 3: Deploy di Vercel

1.  **Impor Proyek ke Vercel**:
    *   Di dasbor Vercel Anda, klik **"Add New..."** -> **"Project"**.
    *   Di bawah **"Import Git Repository"**, temukan repositori GitHub yang baru saja Anda buat dan klik **"Import"**.

2.  **Konfigurasi dan Deploy**:
    *   Vercel akan secara otomatis mendeteksi bahwa ini adalah proyek Next.js. Anda tidak perlu mengubah pengaturan build apa pun.
    *   Klik tombol **"Deploy"**.

Vercel akan memulai proses build dan deployment. Setelah selesai, Anda akan mendapatkan URL publik tempat aplikasi Anda dapat diakses. Selesai!
