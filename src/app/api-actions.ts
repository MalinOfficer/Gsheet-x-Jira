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
 * Fungsi ini berjalan di server.
 * @returns {Promise<FetchResult>} Hasil yang berisi data atau pesan error.
 */
export async function fetchExampleData(): Promise<FetchResult> {
  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');

    if (!response.ok) {
      // Tangani respons HTTP yang tidak berhasil (misalnya, 404, 500)
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
