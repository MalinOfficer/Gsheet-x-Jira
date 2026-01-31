'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const ReportHarian = dynamic(
    () => import('@/components/report-harian'),
    { 
        ssr: false,
        loading: () => (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Skeleton className="h-48 w-full" />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        <Skeleton className="h-96 w-full" />
                        <Skeleton className="h-96 w-full" />
                    </div>
                </div>
            </div>
        )
    }
);

export default function ReportHarianPage() {
    // Data now comes from client-side context or is fetched on client-side within the component
    return (
        <main>
            <ReportHarian initialDashboardData={null} />
        </main>
    );
}
