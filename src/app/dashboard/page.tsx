import { getDashboardFilterOptions, getDashboardStats } from '@/app/actions';
import { Dashboard } from '@/components/dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getDefault3RecentYears(years: string[]): string[] {
    return [...years].sort((a, b) => parseInt(b) - parseInt(a)).slice(0, 3);
}

export default async function DashboardPage() {
    // ✅ Step 1: Ambil filter options dulu untuk dapat years
    const optionsResult = await getDashboardFilterOptions();
    const filterOptions = optionsResult.success && optionsResult.data ? optionsResult.data : null;
    const defaultYears = filterOptions?.years?.length
        ? getDefault3RecentYears(filterOptions.years)
        : [];

    // ✅ Step 2: Fetch stats via server action langsung (no HTTP, no waterfall dari RPC)
    let initialStats = null;
    if (defaultYears.length > 0) {
        const statsResult = await getDashboardStats({
            selectedYears: defaultYears,
            categoryFilter: [],
            clientFilter: [],
            moduleFilter: [],
            detailModuleFilter: [],
            dateRange: undefined,
        }).catch(() => ({ success: false, data: null }));

        initialStats = statsResult.success && statsResult.data ? statsResult.data : null;
    }

    return (
        <main>
            <Dashboard
                initialStats={initialStats}
                initialOptions={filterOptions}
                error={optionsResult.error ?? null}
            />
        </main>
    );
}