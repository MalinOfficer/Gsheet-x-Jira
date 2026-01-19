'use client';

import dynamic from 'next/dynamic';
import { RefreshCw } from 'lucide-react';

const DbViewer = dynamic(
    () => import('@/components/db-viewer').then(mod => mod.DbViewer),
    { 
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-[80vh]">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }
);

export default function DbPage() {
    return (
        <main>
            <DbViewer />
        </main>
    );
}
