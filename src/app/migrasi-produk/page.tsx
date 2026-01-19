'use client';

import dynamic from 'next/dynamic';
import { RefreshCw } from 'lucide-react';

const MigrasiProduk = dynamic(
    () => import('@/components/migrasi-produk').then(mod => mod.MigrasiProduk),
    { 
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-[80vh]">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }
);

export default function MigrasiProdukPage() {
    return (
        <main className="h-full">
            <MigrasiProduk />
        </main>
    );
}
