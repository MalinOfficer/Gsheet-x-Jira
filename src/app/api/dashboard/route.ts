import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { type DateRange } from 'react-day-picker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const pivotAndOrderMonthlyStats = (unpivotedData: any[] | null | undefined): any[] => {
    if (!unpivotedData || !Array.isArray(unpivotedData) || unpivotedData.length === 0) return [];

    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const statsByMonth: { [key: string]: any } = {};
    monthOrder.forEach(month => { statsByMonth[month] = { month }; });

    const allYears = new Set<string>();
    unpivotedData.forEach(item => {
        if (item.month && monthOrder.includes(item.month)) {
            const monthData = statsByMonth[item.month];
            if (item.year && typeof item.cases !== 'undefined') {
                const yearStr = String(item.year);
                monthData[yearStr] = (monthData[yearStr] || 0) + item.cases;
                allYears.add(yearStr);
            } else {
                Object.keys(item).forEach(key => {
                    if (/^\d{4}$/.test(key)) {
                        monthData[key] = (monthData[key] || 0) + item[key];
                        allYears.add(key);
                    }
                });
            }
            statsByMonth[item.month] = monthData;
        }
    });

    const sortedYears = Array.from(allYears).sort();
    return monthOrder.map(month => {
        const monthData = statsByMonth[month];
        sortedYears.forEach(year => { if (!monthData.hasOwnProperty(year)) monthData[year] = 0; });
        return monthData;
    });
};

const formatDate = (date: any): string | null => {
    if (!date) return null;
    try {
        const d = date instanceof Date ? date : new Date(date);
        return d.toISOString().split('T')[0];
    } catch { return null; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch ALL rows dengan pagination (menghindari limit 1000 Supabase)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAllRows(filters: {
    dateRange?: DateRange;
    years: string[];
    categories: string[];
    clients: string[];
    modules: string[];
    detailModules: string[];
}) {
    const BATCH = 1000;
    let allData: any[] = [];
    let from = 0;

    while (true) {
        let q = supabaseAdmin
            .from('all_cases')
            .select('id, date, month, client_name, status_case, status_case_solved, category_case, module_case, detail_module')
            .is('deleted_at', null)
            .range(from, from + BATCH - 1);

        // ── Date / year filter ────────────────────────────────────────────────
        if (filters.dateRange?.from) {
            const fromDate = formatDate(filters.dateRange.from);
            const toDate   = filters.dateRange.to ? formatDate(filters.dateRange.to) : fromDate;
            q = q.gte('date', fromDate!).lte('date', toDate!);
        } else if (filters.years.length === 1) {
            const y = parseInt(filters.years[0], 10);
            if (!isNaN(y)) q = q.gte('date', `${y}-01-01`).lte('date', `${y}-12-31`);
        } else if (filters.years.length > 1) {
            const orParts = filters.years
                .map(y => {
                    const n = parseInt(y, 10);
                    return isNaN(n) ? null : `and(date.gte.${n}-01-01,date.lte.${n}-12-31)`;
                })
                .filter(Boolean)
                .join(',');
            if (orParts) q = q.or(orParts);
        }

        // ── Multi-value filters ───────────────────────────────────────────────
        if (filters.categories.length    > 0) q = q.in('category_case', filters.categories);
        if (filters.clients.length       > 0) q = q.in('client_name',   filters.clients);
        if (filters.modules.length       > 0) q = q.in('module_case',   filters.modules);
        if (filters.detailModules.length > 0) q = q.in('detail_module', filters.detailModules);

        const { data: batch, error } = await q;

        if (error) throw new Error(error.message);
        if (!batch || batch.length === 0) break;

        allData = allData.concat(batch);
        console.log(`📦 [API] Fetched batch: rows ${from}–${from + batch.length - 1} (total so far: ${allData.length})`);

        if (batch.length < BATCH) break;
        from += BATCH;
    }

    return allData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hitung naik/turun case per module: bandingkan 2 bulan terakhir yang lengkap
// ─────────────────────────────────────────────────────────────────────────────
function computeModuleTrends(data: any[]): { name: string; current: number; previous: number; change: number; direction: 'up' | 'down' | 'stable' }[] {
    const now = new Date();
    // Current month key — we exclude this because the month is not yet complete
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const periodCounts: Record<string, Record<string, number>> = {};

    data.forEach(r => {
        if (!r.date || !r.module_case) return;
        const d = new Date(r.date + 'T00:00:00');
        if (isNaN(d.getTime())) return;
        const periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        // Skip current (incomplete) month
        if (periodKey === currentMonthKey) return;
        if (!periodCounts[periodKey]) periodCounts[periodKey] = {};
        periodCounts[periodKey][r.module_case] = (periodCounts[periodKey][r.module_case] || 0) + 1;
    });

    // Sort periods ascending; take last 2 complete months
    const periods = Object.keys(periodCounts).sort();
    if (periods.length < 2) return [];

    const currentPeriod  = periods[periods.length - 1];
    const previousPeriod = periods[periods.length - 2];

    const currentMap  = periodCounts[currentPeriod]  ?? {};
    const previousMap = periodCounts[previousPeriod] ?? {};

    const allModules = new Set([...Object.keys(currentMap), ...Object.keys(previousMap)]);

    const trends = Array.from(allModules).map(name => {
        const current  = currentMap[name]  ?? 0;
        const previous = previousMap[name] ?? 0;
        const change   = current - previous;
        const direction: 'up' | 'down' | 'stable' = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
        return { name, current, previous, change, direction };
    });

    // Sort by absolute change desc, exclude stable, top 8
    return trends
        .filter(t => t.direction !== 'stable')
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hitung semua statistik dari raw rows
// ─────────────────────────────────────────────────────────────────────────────
function computeStats(data: any[]) {
    const totalCases  = data.length;
    const totalSolved = data.filter(r => r.status_case_solved === 'SOLVED').length;
    const solvedPct   = totalCases > 0 ? (totalSolved / totalCases) * 100 : 0;

    const uniqueClients = new Set(data.map(r => r.client_name).filter(Boolean));

    // ── Trending category ─────────────────────────────────────────────────────
    const categoryCounts: Record<string, number> = {};
    data.forEach(r => {
        if (r.category_case) categoryCounts[r.category_case] = (categoryCounts[r.category_case] || 0) + 1;
    });
    const trendingCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

    // ── Client rankings ───────────────────────────────────────────────────────
    const clientCounts: Record<string, number> = {};
    data.forEach(r => { if (r.client_name) clientCounts[r.client_name] = (clientCounts[r.client_name] || 0) + 1; });
    const clientRankings = Object.entries(clientCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // ── Module rankings + trending module ─────────────────────────────────────
    const moduleCounts: Record<string, number> = {};
    data.forEach(r => { if (r.module_case) moduleCounts[r.module_case] = (moduleCounts[r.module_case] || 0) + 1; });
    const moduleRankings = Object.entries(moduleCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    const trendingModule = moduleRankings[0]?.name ?? 'N/A';

    // ── Detail module rankings ────────────────────────────────────────────────
    const detailModuleCounts: Record<string, number> = {};
    data.forEach(r => {
        if (r.detail_module) detailModuleCounts[r.detail_module] = (detailModuleCounts[r.detail_module] || 0) + 1;
    });
    const detailModuleRankings = Object.entries(detailModuleCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // ── Monthly stats ─────────────────────────────────────────────────────────
    const monthAbbr = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthYearCounts: Record<string, number> = {};
    data.forEach(r => {
        if (!r.date) return;
        const d = new Date(r.date + 'T00:00:00');
        if (isNaN(d.getTime())) return;
        const key = `${monthAbbr[d.getMonth()]}|||${d.getFullYear()}`;
        monthYearCounts[key] = (monthYearCounts[key] || 0) + 1;
    });
    const unpivoted = Object.entries(monthYearCounts).map(([key, count]) => {
        const [month, yearStr] = key.split('|||');
        return { month, year: parseInt(yearStr), cases: count };
    });

    const moduleTrends = computeModuleTrends(data);

    return {
        summary: {
            total_cases:       totalCases,
            total_solved:      totalSolved,
            total_clients:     uniqueClients.size,
            solved_percentage: solvedPct,
            trending_category: trendingCategory,
            trending_module:   trendingModule,
            top_client:        clientRankings[0]?.name ?? 'N/A',
            top_module:        moduleRankings[0]?.name ?? 'N/A',
        },
        monthly_stats:          pivotAndOrderMonthlyStats(unpivoted),
        client_rankings:        clientRankings,
        module_rankings:        moduleRankings,
        detail_module_rankings: detailModuleRankings,
        module_trends:          moduleTrends,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET Handler
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        // ── Parse dateRange ───────────────────────────────────────────────────
        const dateRangeString = searchParams.get('dateRange');
        let dateRange: DateRange | undefined;
        if (dateRangeString) {
            try { dateRange = JSON.parse(dateRangeString); } catch {}
        }

        // ── Parse selectedYears ───────────────────────────────────────────────
        const yearsParam =
            searchParams.get('selectedYears') ??
            searchParams.get('selectedYear')  ?? '';

        const selectedYears: string[] =
            yearsParam && yearsParam !== 'all'
                ? yearsParam.split(',').map(s => s.trim()).filter(Boolean)
                : [];

        // ── Parse other filters ───────────────────────────────────────────────
        const categoryFilter     = searchParams.get('categoryFilter')     || '';
        const clientFilter       = searchParams.get('clientFilter')       || '';
        const moduleFilter       = searchParams.get('moduleFilter')       || '';
        const detailModuleFilter = searchParams.get('detailModuleFilter') || '';

        const categories    = categoryFilter     ? categoryFilter.split(',').map(s => s.trim()).filter(Boolean)     : [];
        const clients       = clientFilter       ? clientFilter.split(',').map(s => s.trim()).filter(Boolean)       : [];
        const modules       = moduleFilter       ? moduleFilter.split(',').map(s => s.trim()).filter(Boolean)       : [];
        const detailModules = detailModuleFilter ? detailModuleFilter.split(',').map(s => s.trim()).filter(Boolean) : [];

        // ── Routing: RPC vs Direct Query ──────────────────────────────────────
        const isMultiFilter =
            categories.length    > 1 ||
            clients.length       > 1 ||
            modules.length       > 1 ||
            detailModules.length > 1 ||
            selectedYears.length > 1;

        console.log(`📥 [API] Mode: ${isMultiFilter ? 'DIRECT QUERY' : 'RPC'}`, {
            selectedYears, categories, clients, modules, detailModules
        });

        // ── MODE 1: RPC ───────────────────────────────────────────────────────
        if (!isMultiFilter) {
            const singleYear = selectedYears[0];
            let yearValue: number | null = null;
            if (singleYear) {
                const parsed = parseInt(singleYear, 10);
                if (!isNaN(parsed)) yearValue = parsed;
            }

            const params: Record<string, any> = {
                p_start_date:    formatDate(dateRange?.from),
                p_end_date:      formatDate(dateRange?.to),
                p_category:      categories[0]    ?? null,
                p_client:        clients[0]        ?? null,
                p_module:        modules[0]        ?? null,
                p_year:          yearValue,
                p_detail_module: detailModules[0] ?? null,
            };

            console.log('🚀 [API] Calling RPC fn_dashboard_filtered:', params);

            const { data, error } = await supabaseAdmin.rpc('fn_dashboard_filtered', params);

            if (error) {
                console.error('❌ [API] RPC Error:', error);
                throw error;
            }

            if (!data || data.length === 0 || data[0].out_total_cases === null) {
                return NextResponse.json({ success: true, data: emptyStats() });
            }

            const result = data[0];
            const parseJSONB = (field: any) => {
                if (!field) return [];
                if (Array.isArray(field)) return field;
                if (typeof field === 'string') { try { return JSON.parse(field); } catch { return []; } }
                return [];
            };

            const moduleRankingsRpc = parseJSONB(result.out_module_rankings).map((i: any) => ({ name: i.module, value: i.cases }));
            const detailModuleRankingsRpc = parseJSONB(result.out_detail_module_rankings ?? null).map((i: any) => ({ name: i.detail_module ?? i.module, value: i.cases }));

            return NextResponse.json({ success: true, data: {
                summary: {
                    total_cases:       result.out_total_cases       ?? 0,
                    total_solved:      result.out_total_solved       ?? 0,
                    total_clients:     result.out_total_clients      ?? 0,
                    solved_percentage: result.out_solved_percentage  ?? 0,
                    trending_category: result.out_trending_category  ?? 'N/A',
                    trending_module:   result.out_trending_module    ?? moduleRankingsRpc[0]?.name ?? 'N/A',
                    top_client:        result.out_top_client         ?? 'N/A',
                    top_module:        result.out_top_module         ?? 'N/A',
                },
                monthly_stats:          pivotAndOrderMonthlyStats(parseJSONB(result.out_monthly_stats)),
                client_rankings:        parseJSONB(result.out_client_rankings).map((i: any) => ({ name: i.client, value: i.cases })),
                module_rankings:        moduleRankingsRpc,
                detail_module_rankings: detailModuleRankingsRpc,
                module_trends:          [], // RPC path: trends computed client-side or extend RPC later
            }});
        }

        // ── MODE 2: Direct query + pagination ─────────────────────────────────
        const allData = await fetchAllRows({
            dateRange,
            years: selectedYears,
            categories,
            clients,
            modules,
            detailModules,
        });

        console.log(`✅ [API] Total rows fetched: ${allData.length}`);

        if (allData.length === 0) {
            return NextResponse.json({ success: true, data: emptyStats() });
        }

        return NextResponse.json({ success: true, data: computeStats(allData) });

    } catch (error: any) {
        console.error('❌ [API] Dashboard API Route Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Unknown error occurred' },
            { status: 500 }
        );
    }
}

// ── Helper ────────────────────────────────────────────────────────────────────
function emptyStats() {
    return {
        summary: {
            total_cases:       0,
            total_solved:      0,
            total_clients:     0,
            solved_percentage: 0,
            trending_category: 'N/A',
            trending_module:   'N/A',
            top_client:        'N/A',
            top_module:        'N/A',
        },
        monthly_stats:          [],
        client_rankings:        [],
        module_rankings:        [],
        detail_module_rankings: [],
        module_trends:          [],
    };
}