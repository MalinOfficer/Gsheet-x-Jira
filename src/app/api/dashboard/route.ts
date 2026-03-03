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
    year: string;
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

        // Date / year filter
        if (filters.dateRange?.from) {
            const fromDate = formatDate(filters.dateRange.from);
            const toDate   = filters.dateRange.to ? formatDate(filters.dateRange.to) : fromDate;
            q = q.gte('date', fromDate!).lte('date', toDate!);
        } else if (filters.year && filters.year !== 'all') {
            const y = parseInt(filters.year, 10);
            if (!isNaN(y)) q = q.gte('date', `${y}-01-01`).lte('date', `${y}-12-31`);
        }

        // Multi-value filters menggunakan .in()
        if (filters.categories.length    > 0) q = q.in('category_case', filters.categories);
        if (filters.clients.length       > 0) q = q.in('client_name',   filters.clients);
        if (filters.modules.length       > 0) q = q.in('module_case',   filters.modules);
        if (filters.detailModules.length > 0) q = q.in('detail_module', filters.detailModules);

        const { data: batch, error } = await q;

        if (error) throw new Error(error.message);
        if (!batch || batch.length === 0) break;

        allData = allData.concat(batch);
        console.log(`📦 [API] Fetched batch: rows ${from}–${from + batch.length - 1} (total so far: ${allData.length})`);

        if (batch.length < BATCH) break; // batch terakhir
        from += BATCH;
    }

    return allData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hitung semua statistik dari raw rows
// ─────────────────────────────────────────────────────────────────────────────
function computeStats(data: any[]) {
    const totalCases  = data.length;
    // status_case_solved berisi literal 'SOLVED' atau 'UNSOLVED'
    const totalSolved = data.filter(r => r.status_case_solved === 'SOLVED').length;
    const solvedPct   = totalCases > 0 ? (totalSolved / totalCases) * 100 : 0;

    const uniqueClients = new Set(data.map(r => r.client_name).filter(Boolean));

    // Trending category
    const categoryCounts: Record<string, number> = {};
    data.forEach(r => {
        if (r.category_case) categoryCounts[r.category_case] = (categoryCounts[r.category_case] || 0) + 1;
    });
    const trendingCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

    // Client rankings
    const clientCounts: Record<string, number> = {};
    data.forEach(r => { if (r.client_name) clientCounts[r.client_name] = (clientCounts[r.client_name] || 0) + 1; });
    const clientRankings = Object.entries(clientCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // Module rankings
    const moduleCounts: Record<string, number> = {};
    data.forEach(r => { if (r.module_case) moduleCounts[r.module_case] = (moduleCounts[r.module_case] || 0) + 1; });
    const moduleRankings = Object.entries(moduleCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // Monthly stats
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

    return {
        summary: {
            total_cases:       totalCases,
            total_solved:      totalSolved,
            total_clients:     uniqueClients.size,
            solved_percentage: solvedPct,
            trending_category: trendingCategory,
            top_client:        clientRankings[0]?.name ?? 'N/A',
            top_module:        moduleRankings[0]?.name ?? 'N/A',
        },
        monthly_stats:   pivotAndOrderMonthlyStats(unpivoted),
        client_rankings: clientRankings,
        module_rankings: moduleRankings,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET Handler
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const dateRangeString = searchParams.get('dateRange');
        let dateRange: DateRange | undefined;
        if (dateRangeString) {
            try { dateRange = JSON.parse(dateRangeString); } catch {}
        }

        const year               = searchParams.get('selectedYear')       || 'all';
        const categoryFilter     = searchParams.get('categoryFilter')     || '';
        const clientFilter       = searchParams.get('clientFilter')       || '';
        const moduleFilter       = searchParams.get('moduleFilter')       || '';
        const detailModuleFilter = searchParams.get('detailModuleFilter') || '';

        const categories    = categoryFilter     ? categoryFilter.split(',').map(s => s.trim()).filter(Boolean)     : [];
        const clients       = clientFilter       ? clientFilter.split(',').map(s => s.trim()).filter(Boolean)       : [];
        const modules       = moduleFilter       ? moduleFilter.split(',').map(s => s.trim()).filter(Boolean)       : [];
        const detailModules = detailModuleFilter ? detailModuleFilter.split(',').map(s => s.trim()).filter(Boolean) : [];

        // ── Apakah semua filter single-value atau kosong? ────────────────────
        // Jika ya → gunakan RPC (lebih cepat, semua komputasi di PostgreSQL)
        // Jika ada multi-value → gunakan direct query + pagination
        const isMultiFilter =
            categories.length    > 1 ||
            clients.length       > 1 ||
            modules.length       > 1 ||
            detailModules.length > 1;

        console.log(`📥 [API] Mode: ${isMultiFilter ? 'DIRECT QUERY (multi-filter)' : 'RPC (single/no filter)'}`, {
            year, categories, clients, modules, detailModules
        });

        // ── MODE 1: RPC (original, tidak kena limit 1000) ────────────────────
        if (!isMultiFilter) {
            let yearValue: number | null = null;
            if (year && year !== 'all') {
                const parsed = parseInt(year, 10);
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
                return NextResponse.json({ success: true, data: {
                    summary: { total_cases: 0, total_solved: 0, total_clients: 0, solved_percentage: 0, trending_category: 'N/A', top_client: 'N/A', top_module: 'N/A' },
                    monthly_stats: [], client_rankings: [], module_rankings: []
                }});
            }

            const result = data[0];
            const parseJSONB = (field: any) => {
                if (!field) return [];
                if (Array.isArray(field)) return field;
                if (typeof field === 'string') { try { return JSON.parse(field); } catch { return []; } }
                return [];
            };

            const rawMonthlyStats = parseJSONB(result.out_monthly_stats);
            const clientRankings  = parseJSONB(result.out_client_rankings);
            const moduleRankings  = parseJSONB(result.out_module_rankings);

            return NextResponse.json({ success: true, data: {
                summary: {
                    total_cases:       result.out_total_cases       ?? 0,
                    total_solved:      result.out_total_solved      ?? 0,
                    total_clients:     result.out_total_clients     ?? 0,
                    solved_percentage: result.out_solved_percentage ?? 0,
                    trending_category: result.out_trending_category ?? 'N/A',
                    top_client:        result.out_top_client        ?? 'N/A',
                    top_module:        result.out_top_module        ?? 'N/A',
                },
                monthly_stats:   pivotAndOrderMonthlyStats(rawMonthlyStats),
                client_rankings: clientRankings.map((i: any) => ({ name: i.client, value: i.cases })),
                module_rankings: moduleRankings.map((i: any) => ({ name: i.module, value: i.cases })),
            }});
        }

        // ── MODE 2: Direct query + pagination (untuk multi-value filter) ─────
        const allData = await fetchAllRows({ dateRange, year, categories, clients, modules, detailModules });

        console.log(`✅ [API] Total rows fetched: ${allData.length}`);

        if (allData.length === 0) {
            return NextResponse.json({ success: true, data: {
                summary: { total_cases: 0, total_solved: 0, total_clients: 0, solved_percentage: 0, trending_category: 'N/A', top_client: 'N/A', top_module: 'N/A' },
                monthly_stats: [], client_rankings: [], module_rankings: []
            }});
        }

        const mappedData = computeStats(allData);
        return NextResponse.json({ success: true, data: mappedData });

    } catch (error: any) {
        console.error('❌ [API] Dashboard API Route Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Unknown error occurred' },
            { status: 500 }
        );
    }
}