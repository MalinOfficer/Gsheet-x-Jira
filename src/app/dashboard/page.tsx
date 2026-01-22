// src/app/dashboard/page.tsx

import { Dashboard } from '@/components/dashboard';
import { getDashboardStats, getDashboardFilterOptions } from '@/app/actions';

// ✅ Force dynamic rendering and no caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
    
    // Fetch initial data in parallel on the server
    const [statsResult, optionsResult] = await Promise.all([
        getDashboardStats({ 
            selectedYear: 'all', 
            categoryFilter: [], 
            clientFilter: [], 
            moduleFilter: [], 
            dateRange: undefined 
        }),
        getDashboardFilterOptions()
    ]);
    
    const error = statsResult.error || optionsResult.error;

    return (
        <main>
            <Dashboard
                initialStats={statsResult.error ? null : statsResult}
                initialOptions={optionsResult.error || !optionsResult.data ? null : optionsResult.data}
                error={error}
            />
        </main>
    );
}
