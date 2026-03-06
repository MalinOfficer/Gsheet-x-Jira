// src/app/dashboard/page.tsx

import { getDashboardFilterOptions } from '@/app/actions';
import dynamicNext from 'next/dynamic';

// ✅ Force dynamic rendering and no caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// No `loading:` here — dashboard.tsx has its own skeleton for the initial fetch.
// Having both causes the double-skeleton flash on reload.
const Dashboard = dynamicNext(
    () => import('@/components/dashboard').then(mod => mod.Dashboard),
    { ssr: false }
);

export default async function DashboardPage() {
    
    // Only fetch filter options on the server. Stats will be fetched on the client.
    const optionsResult = await getDashboardFilterOptions();

    return (
        <main>
            <Dashboard
                initialStats={null} // Pass null, client will fetch.
                initialOptions={optionsResult.error || !optionsResult.data ? null : optionsResult.data}
                error={optionsResult.error}
            />
        </main>
    );
}