// src/app/dashboard/page.tsx

import { getDashboardFilterOptions } from '@/app/actions';
import { Dashboard } from '@/components/dashboard';

// ✅ Force dynamic rendering and no caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
    
    // Hanya ambil opsi filter di server. Statistik akan diambil di sisi klien.
    const optionsResult = await getDashboardFilterOptions();

    return (
        <main>
            <Dashboard
                initialStats={null} // Lewati null, klien yang akan melakukan fetch.
                initialOptions={optionsResult.success && optionsResult.data ? optionsResult.data : null}
                error={optionsResult.error}
            />
        </main>
    );
}
