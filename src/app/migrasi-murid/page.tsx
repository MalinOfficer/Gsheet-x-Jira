'use client';

import dynamic from 'next/dynamic';
import { RefreshCw } from 'lucide-react';

const MigrasiMurid = dynamic(
    () => import('@/components/migrasi-murid').then(mod => mod.MigrasiMurid),
    { 
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-screen w-screen">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }
);

export default function MigrasiMuridPage() {
    return (
        <main className="h-screen w-screen overflow-hidden">
            <MigrasiMurid />
        </main>
    );
}
