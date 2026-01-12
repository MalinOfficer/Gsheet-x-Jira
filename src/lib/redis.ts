import { Redis } from '@upstash/redis'

// Logika ini memeriksa variabel lingkungan untuk Vercel KV dan Upstash standar.
// Ini memastikan koneksi berhasil di berbagai lingkungan hosting.
const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Redis environment variables are not set.');
  }
  // Peringatan ini akan muncul saat development jika variabel tidak diatur.
  console.warn('Redis environment variables are not set. Caching will be disabled.');
}

// Inisialisasi Redis dengan variabel yang ditemukan atau biarkan kosong jika tidak ada,
// yang akan menyebabkan error jika 'caching' benar-benar dicoba tanpa konfigurasi.
export const redis = new Redis({
  url: redisUrl || '',
  token: redisToken || '',
});
