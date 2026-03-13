/**
 * app/dashboard/page.tsx  (Server Component)
 *
 * Perbaikan dari versi lama:
 * - getDashboardFilterOptions() dan getDashboardStats() sekarang di-fetch
 *   PARALLEL dengan Promise.all() → tidak ada waterfall lagi.
 * - initialStats dikirim ke Dashboard component sehingga client tidak perlu
 *   refetch saat mount pertama kali.
 */

import { getDashboardFilterOptions, getDashboardStats } from '@/app/actions';
import { Dashboard } from '@/components/dashboard';

export const dynamic   = 'force-dynamic';
export const revalidate = 0;

function getDefault3RecentYears(years: string[]): string[] {
    return [...years]
        .sort((a, b) => parseInt(b) - parseInt(a))
        .slice(0, 3);
}

export default async function DashboardPage() {
    // ── Fetch filter options dan stats PARALLEL ────────────────────────────────
    // Dulu: sequential (options → stats) = 1.5–6s+
    // Sekarang: parallel                 = max(options_time, stats_time)
    const [optionsResult, statsResultForDefault] = await Promise.all([
        getDashboardFilterOptions(),
        // Fetch stats untuk tahun berjalan dulu sebagai default;
        // nanti client akan fetch ulang kalau user ganti filter/tahun.
        getDashboardStats({
            selectedYears:     [],          // kosong = ambil default (current year)
            categoryFilter:    [],
            clientFilter:      [],
            moduleFilter:      [],
            detailModuleFilter:[],
            dateRange:         undefined,
        }).catch(() => ({ success: false, data: null })),
    ]);

    const filterOptions = optionsResult.success && optionsResult.data
        ? optionsResult.data
        : null;

    // Setelah dapat filter options, tentukan default years
    const defaultYears = filterOptions?.years?.length
        ? getDefault3RecentYears(filterOptions.years)
        : [];

    // Kalau stats default kosong dan ada defaultYears → fetch ulang dengan years yang benar
    let initialStats = statsResultForDefault.success && statsResultForDefault.data
        ? statsResultForDefault.data
        : null;

    if (!initialStats && defaultYears.length > 0) {
        const retry = await getDashboardStats({
            selectedYears:     defaultYears,
            categoryFilter:    [],
            clientFilter:      [],
            moduleFilter:      [],
            detailModuleFilter:[],
            dateRange:         undefined,
        }).catch(() => ({ success: false, data: null }));

        initialStats = retry.success && retry.data ? retry.data : null;
    }

    return (
        <main>
            <Dashboard
                initialStats={initialStats}
                initialOptions={filterOptions}
                defaultYears={defaultYears}
                error={optionsResult.error ?? null}
            />
        </main>
    );
}