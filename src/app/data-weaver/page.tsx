'use client';

import dynamic from 'next/dynamic';
import { RefreshCw } from 'lucide-react';

const DataWeaver = dynamic(
    () => import('@/components/data-weaver').then(mod => mod.DataWeaver),
    { 
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-[80vh]">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }
);

export default function DataWeaverPage() {
    return (
        <main>
            <DataWeaver />
        </main>
    );
}
