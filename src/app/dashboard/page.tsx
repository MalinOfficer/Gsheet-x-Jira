// src/app/dashboard/page.tsx

import { getDashboardFilterOptions } from '@/app/actions';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

// ✅ Force dynamic rendering and no caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Dashboard = dynamic(
    () => import('@/components/dashboard').then(mod => mod.Dashboard),
    {
        ssr: false, // The dashboard fetches its own data on the client, so no need for SSR.
        loading: () => (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                        <Skeleton className="h-[88px]" />
                        <Skeleton className="h-[88px]" />
                        <Skeleton className="h-[88px]" />
                        <Skeleton className="h-[88px]" />
                    </div>
                    <Skeleton className="h-[300px] w-full" />
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                        <Skeleton className="h-[250px]" />
                        <Skeleton className="h-[250px]" />
                    </div>
                </div>
            </div>
        ),
    }
);

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
