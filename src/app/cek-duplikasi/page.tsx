
'use client';

import dynamic from 'next/dynamic';
import { RefreshCw } from 'lucide-react';

const CekDuplikasi = dynamic(
    () => import('@/components/cek-duplikasi').then(mod => mod.CekDuplikasi),
    { 
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-[80vh]">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }
);

export default function CekDuplikasiPage() {
    return (
        <main>
            <CekDuplikasi />
        </main>
    );
}
