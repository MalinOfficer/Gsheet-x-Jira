import { Redis } from '@upstash/redis'

// Menggunakan variabel lingkungan standar untuk Upstash, bukan Vercel KV.
// Hal ini memungkinkan koneksi langsung ke database Upstash Anda.
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Upstash Redis environment variables are not set.');
  }
  // Peringatan ini akan muncul saat development jika variabel tidak diatur.
  console.warn('Upstash Redis environment variables (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) are not set. Caching will be disabled.');
}

// Gunakan fromEnv() untuk menginisialisasi dari environment variables secara otomatis
export const redis = Redis.fromEnv();

    