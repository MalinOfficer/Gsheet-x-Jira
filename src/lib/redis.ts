import { Redis } from '@upstash/redis'

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Upstash Redis environment variables are not set.');
  }
  console.warn('Upstash Redis environment variables are not set. Caching will be disabled in development.');
}

export const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});
