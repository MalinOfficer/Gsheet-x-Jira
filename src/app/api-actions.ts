'use server';

import { z } from 'zod';

// Definisikan skema untuk memvalidasi data yang diterima dari API
const TodoSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
});

// Ekspor tipe untuk digunakan di komponen client
export type Todo = z.infer<typeof TodoSchema>;

interface FetchResult {
    data?: Todo;
    error?: string;
}

/**
 * Mengambil data contoh dari API JSONPlaceholder.
 * Fungsi ini berjalan di server dan menggunakan API Token dari environment variables.
 * @returns {Promise<FetchResult>} Hasil yang berisi data atau pesan error.
 */
export async function fetchExampleData(): Promise<FetchResult> {
  try {
    const apiToken = process.env.EXAMPLE_API_TOKEN;

    if (!apiToken) {
        throw new Error("API Token is not configured. Please check your .env.local file.");
    }

    const response = await fetch('https://jsonplaceholder.typicode.com/todos/1', {
        headers: {
            // Ini adalah contoh bagaimana Anda akan menggunakan token tersebut.
            // API yang sebenarnya mungkin memerlukan skema yang berbeda, seperti 'Bearer <token>'.
            'Authorization': `Token ${apiToken}`
        }
    });

    if (!response.ok) {
      // Tangani respons HTTP yang tidak berhasil (misalnya, 401 Unauthorized, 404, 500)
      throw new Error(`Failed to fetch data. Status: ${response.status}`);
    }

    const rawData = await response.json();

    // Validasi data yang diterima dengan skema Zod
    const validationResult = TodoSchema.safeParse(rawData);

    if (!validationResult.success) {
        // Tangani jika data tidak sesuai dengan format yang diharapkan
        console.error('API response validation error:', validationResult.error);
        throw new Error('Invalid data format received from the API.');
    }
    
    // Kembalikan data yang sudah divalidasi
    return { data: validationResult.data };

  } catch (error) {
    console.error('Error fetching API data:', error);
    // Kembalikan pesan error yang aman untuk ditampilkan di client
    return { error: error instanceof Error ? error.message : 'An unknown error occurred.' };
  }
}
