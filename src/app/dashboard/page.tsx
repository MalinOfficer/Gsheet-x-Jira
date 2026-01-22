// src/app/dashboard/page.tsx

import { Dashboard } from '@/components/dashboard';
import { getDashboardStats, getDashboardFilterOptions } from '@/app/supabase-actions';

// ✅ FIXED: Force dynamic rendering and no caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
    // ✅ FIXED: Removed cookie logic and dbSheetUrl - not needed with Supabase
    
    // Fetch initial data in parallel on the server
    const [statsResult, optionsResult] = await Promise.all([
        // ✅ FIXED: Removed sheetUrl parameter
        getDashboardStats({ 
            selectedYear: 'all', 
            categoryFilter: [], 
            clientFilter: [], 
            moduleFilter: [], 
            dateRange: undefined 
        }),
        // ✅ FIXED: Removed sheetUrl parameter
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