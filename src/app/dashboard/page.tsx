
'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = dynamic(
    () => import('@/components/dashboard').then(mod => mod.Dashboard),
    {
        ssr: false,
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
        )
    }
);


export default function DashboardPage() {
    return (
        <main>
            <Dashboard />
        </main>
    );
}
