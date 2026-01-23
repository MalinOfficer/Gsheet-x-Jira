// src/app/dashboard/page.tsx

import { Dashboard } from '@/components/dashboard';
import { getDashboardFilterOptions } from '@/app/actions';

// ✅ Force dynamic rendering and no caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
    
    // Only fetch filter options on the server. Stats will be fetched on the client.
    const optionsResult = await getDashboardFilterOptions();
    
    const error = optionsResult.error;

    return (
        <main>
            <Dashboard
                initialStats={null} // Pass null, client will fetch.
                initialOptions={optionsResult.error || !optionsResult.data ? null : optionsResult.data}
                error={error}
            />
        </main>
    );
}
