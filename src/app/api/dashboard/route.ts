import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { type DateRange } from 'react-day-picker';
import { getISOWeek, getYear, getQuarter } from 'date-fns';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type TrendPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

type ModuleTrend = {
    name: string;
    current: number;
    previous: number;
    change: number;
    change_pct: number | null;
    direction: 'up' | 'down' | 'stable';
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const pivotAndOrderMonthlyStats = (unpivotedData: any[] | null | undefined): any[] => {
    if (!unpivotedData || !Array.isArray(unpivotedData) || unpivotedData.length === 0) return [];

    const monthOrder = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
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
// Period key generator
// ─────────────────────────────────────────────────────────────────────────────
function getPeriodKey(d: Date, period: TrendPeriod): string {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');

    switch (period) {
        case 'daily':
            return `${yyyy}-${mm}-${dd}`;
        case 'weekly': {
            const week    = String(getISOWeek(d)).padStart(2, '0');
            const isoYear = getYear(d);
            return `${isoYear}-W${week}`;
        }
        case 'monthly':
            return `${yyyy}-${mm}`;
        case 'quarterly': {
            const q = getQuarter(d);
            return `${yyyy}-Q${q}`;
        }
    }
}

function getCurrentIncompletePeriodKey(period: TrendPeriod): string {
    return getPeriodKey(new Date(), period);
}

// ─────────────────────────────────────────────────────────────────────────────
// computeModuleTrends
//
// FIX 1: Hapus .filter(t => t.direction !== 'stable') yang terlalu agresif.
//         Kalau semua module stabil (count Jan == Feb), semua terfilter → kosong.
//         Sekarang hanya drop entri yang benar-benar nol di KEDUA periode.
// ─────────────────────────────────────────────────────────────────────────────
function computeModuleTrends(data: any[], period: TrendPeriod = 'monthly'): ModuleTrend[] {
    const incompletePeriod = getCurrentIncompletePeriodKey(period);

    const periodCounts: Record<string, Record<string, number>> = {};

    data.forEach(r => {
        if (!r.date || !r.module_case) return;
        const d = new Date(r.date + 'T00:00:00');
        if (isNaN(d.getTime())) return;

        const key = getPeriodKey(d, period);
        if (key === incompletePeriod) return; // skip periode belum selesai

        if (!periodCounts[key]) periodCounts[key] = {};
        periodCounts[key][r.module_case] = (periodCounts[key][r.module_case] || 0) + 1;
    });

    const periods = Object.keys(periodCounts).sort();

    if (periods.length < 2) {
        console.log(`⚠️  [Trend] Hanya ${periods.length} periode lengkap — butuh ≥ 2`);
        return [];
    }

    const currentPeriodKey  = periods[periods.length - 1];
    const previousPeriodKey = periods[periods.length - 2];

    const currentMap  = periodCounts[currentPeriodKey]  ?? {};
    const previousMap = periodCounts[previousPeriodKey] ?? {};

    const allModules = new Set([...Object.keys(currentMap), ...Object.keys(previousMap)]);

    const trends: ModuleTrend[] = Array.from(allModules).map(name => {
        const current   = currentMap[name]  ?? 0;
        const previous  = previousMap[name] ?? 0;
        const change    = current - previous;
        const change_pct: number | null =
            previous === 0 ? null : Math.round((change / previous) * 100);
        const direction: 'up' | 'down' | 'stable' =
            change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

        return { name, current, previous, change, change_pct, direction };
    });

    console.log(`📊 [Trend] period=${period} | "${previousPeriodKey}" vs "${currentPeriodKey}" | ${trends.length} modules`);

    // FIX 1: hanya drop entri yang benar-benar tidak ada data di kedua periode
    return trends
        .filter(t => !(t.current === 0 && t.previous === 0))
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchAllRows — untuk MODE 2 (Direct Query / multi-filter)
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

        if (filters.categories.length    > 0) q = q.in('category_case', filters.categories);
        if (filters.clients.length       > 0) q = q.in('client_name',   filters.clients);
        if (filters.modules.length       > 0) q = q.in('module_case',   filters.modules);
        if (filters.detailModules.length > 0) q = q.in('detail_module', filters.detailModules);

        const { data: batch, error } = await q;

        if (error) throw new Error(error.message);
        if (!batch || batch.length === 0) break;

        allData = allData.concat(batch);
        console.log(`📦 [API] Fetched rows ${from}–${from + batch.length - 1} (total: ${allData.length})`);

        if (batch.length < BATCH) break;
        from += BATCH;
    }

    return allData;
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchDetailModuleRows — direct query khusus untuk card "Detail Module"
//
// FIX 2 — ROOT CAUSE utama "Detail Module: 0 cases":
//
// Di MODE 1 (RPC), kode lama mengandalkan result.out_detail_module_rankings
// dari stored procedure fn_dashboard_filtered. Masalahnya:
//   - Banyak RPC Supabase tidak include out_detail_module_rankings
//   - Field itu sering null → parseJSONB(null) → [] → "0 cases"
//
// Fix: selalu fetch detail module dengan direct query terpisah, dijalankan
// PARALLEL dengan RPC agar tidak menambah latency.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchDetailModuleRows(filters: {
    dateRange?: DateRange;
    years: string[];
    categories: string[];
    clients: string[];
    modules: string[];
    detailModules: string[];
}): Promise<{ name: string; value: number }[]> {
    const BATCH = 1000;
    const countMap: Record<string, number> = {};
    let from = 0;

    while (true) {
        let q = supabaseAdmin
            .from('all_cases')
            .select('detail_module')
            .is('deleted_at', null)
            .not('detail_module', 'is', null)
            .range(from, from + BATCH - 1);

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

        if (filters.categories.length    > 0) q = q.in('category_case', filters.categories);
        if (filters.clients.length       > 0) q = q.in('client_name',   filters.clients);
        if (filters.modules.length       > 0) q = q.in('module_case',   filters.modules);
        if (filters.detailModules.length > 0) q = q.in('detail_module', filters.detailModules);

        const { data: batch, error } = await q;

        if (error) {
            console.warn('⚠️  [Detail Module] query error:', error.message);
            break;
        }
        if (!batch || batch.length === 0) break;

        batch.forEach((r: any) => {
            if (r.detail_module) {
                countMap[r.detail_module] = (countMap[r.detail_module] || 0) + 1;
            }
        });

        if (batch.length < BATCH) break;
        from += BATCH;
    }

    const result = Object.entries(countMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    console.log(`🔍 [Detail Module] ${result.length} unique, ${result.reduce((s, r) => s + r.value, 0)} total cases`);
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeStats — untuk MODE 2 (Direct Query)
// ─────────────────────────────────────────────────────────────────────────────
function computeStats(data: any[], trendPeriod: TrendPeriod = 'monthly') {
    const totalCases  = data.length;
    const totalSolved = data.filter(r => r.status_case_solved === 'SOLVED').length;
    const solvedPct   = totalCases > 0 ? (totalSolved / totalCases) * 100 : 0;

    const uniqueClients = new Set(data.map(r => r.client_name).filter(Boolean));

    const categoryCounts: Record<string, number> = {};
    data.forEach(r => {
        if (r.category_case) categoryCounts[r.category_case] = (categoryCounts[r.category_case] || 0) + 1;
    });
    const trendingCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

    const clientCounts: Record<string, number> = {};
    data.forEach(r => { if (r.client_name) clientCounts[r.client_name] = (clientCounts[r.client_name] || 0) + 1; });
    const clientRankings = Object.entries(clientCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const moduleCounts: Record<string, number> = {};
    data.forEach(r => { if (r.module_case) moduleCounts[r.module_case] = (moduleCounts[r.module_case] || 0) + 1; });
    const moduleRankings = Object.entries(moduleCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    const trendingModule = moduleRankings[0]?.name ?? 'N/A';

    const detailModuleCounts: Record<string, number> = {};
    data.forEach(r => {
        if (r.detail_module) detailModuleCounts[r.detail_module] = (detailModuleCounts[r.detail_module] || 0) + 1;
    });
    const detailModuleRankings = Object.entries(detailModuleCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

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

    const moduleTrends = computeModuleTrends(data, trendPeriod);

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

        const rawPeriod = searchParams.get('trendPeriod') ?? 'monthly';
        const trendPeriod: TrendPeriod =
            ['daily', 'weekly', 'monthly', 'quarterly'].includes(rawPeriod)
                ? (rawPeriod as TrendPeriod)
                : 'monthly';

        console.log(`📅 [API] trendPeriod: ${trendPeriod}`);

        const dateRangeString = searchParams.get('dateRange');
        let dateRange: DateRange | undefined;
        if (dateRangeString) {
            try { dateRange = JSON.parse(dateRangeString); } catch {}
        }

        const yearsParam =
            searchParams.get('selectedYears') ??
            searchParams.get('selectedYear')  ?? '';

        const selectedYears: string[] =
            yearsParam && yearsParam !== 'all'
                ? yearsParam.split(',').map(s => s.trim()).filter(Boolean)
                : [];

        const categoryFilter     = searchParams.get('categoryFilter')     || '';
        const clientFilter       = searchParams.get('clientFilter')       || '';
        const moduleFilter       = searchParams.get('moduleFilter')       || '';
        const detailModuleFilter = searchParams.get('detailModuleFilter') || '';

        const categories    = categoryFilter     ? categoryFilter.split(',').map(s => s.trim()).filter(Boolean)     : [];
        const clients       = clientFilter       ? clientFilter.split(',').map(s => s.trim()).filter(Boolean)       : [];
        const modules       = moduleFilter       ? moduleFilter.split(',').map(s => s.trim()).filter(Boolean)       : [];
        const detailModules = detailModuleFilter ? detailModuleFilter.split(',').map(s => s.trim()).filter(Boolean) : [];

        // Shared filter object — dipakai di semua sub-query
        const sharedFilters = { dateRange, years: selectedYears, categories, clients, modules, detailModules };

        const isMultiFilter =
            categories.length    > 1 ||
            clients.length       > 1 ||
            modules.length       > 1 ||
            detailModules.length > 1 ||
            selectedYears.length > 1;

        console.log(`📥 [API] Mode: ${isMultiFilter ? 'DIRECT QUERY' : 'RPC'}`, {
            selectedYears, categories, clients, modules, detailModules, trendPeriod
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

            // FIX 2: 3 query dijalankan PARALLEL:
            //   - RPC   → summary, monthly_stats, client_rankings, module_rankings
            //   - trend → module_trends (direct query, narrow date window)
            //   - detail module → detail_module_rankings (direct query, selalu)
            const [rpcResult, rawForTrends, detailModuleRankings] = await Promise.all([
                supabaseAdmin.rpc('fn_dashboard_filtered', params),
                fetchTrendRows({ ...sharedFilters, trendPeriod }),
                fetchDetailModuleRows(sharedFilters),   // ← FIX 2: tidak bergantung pada RPC
            ]);

            const { data, error } = rpcResult;

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

            const moduleRankingsRpc = parseJSONB(result.out_module_rankings)
                .map((i: any) => ({ name: i.module, value: i.cases }));

            const moduleTrends = computeModuleTrends(rawForTrends, trendPeriod);

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
                client_rankings:        parseJSONB(result.out_client_rankings)
                                            .map((i: any) => ({ name: i.client, value: i.cases })),
                module_rankings:        moduleRankingsRpc,
                // FIX 2: pakai hasil fetchDetailModuleRows, BUKAN out_detail_module_rankings dari RPC
                detail_module_rankings: detailModuleRankings,
                module_trends:          moduleTrends,
            }});
        }

        // ── MODE 2: Direct query + pagination ─────────────────────────────────
        const allData = await fetchAllRows(sharedFilters);

        console.log(`✅ [API] Total rows fetched: ${allData.length}`);

        if (allData.length === 0) {
            return NextResponse.json({ success: true, data: emptyStats() });
        }

        return NextResponse.json({ success: true, data: computeStats(allData, trendPeriod) });

    } catch (error: any) {
        console.error('❌ [API] Dashboard API Route Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Unknown error occurred' },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchTrendRows — narrow date window untuk trend computation
//
// FIX 3: Lookback diperlebar dari 2 → 3 periode.
// Kenapa: setelah current period di-exclude, butuh tepat 2 periode sisanya.
// Dengan lookback 2 periode lama: sering hanya dapat 1 periode lengkap → [] trends.
// Dengan lookback 3 periode: selalu dapat ≥ 2 periode lengkap.
//
// Contoh monthly (hari ini = 13 Mar 2026):
//   Lama: setMonth(-2) → mulai 13 Jan 2026 → periode: Jan (partial), Feb
//         → setelah exclude Mar: hanya Feb → 1 periode → gagal
//   Baru: setMonth(-3) → mulai 13 Des 2025 → periode: Des, Jan, Feb
//         → setelah exclude Mar: Des, Jan, Feb → 3 periode → ambil 2 terakhir (Jan vs Feb) ✓
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTrendRows(filters: {
    dateRange?: DateRange;
    years: string[];
    categories: string[];
    clients: string[];
    modules: string[];
    detailModules: string[];
    trendPeriod: TrendPeriod;
}) {
    const now = new Date();
    let lookbackStart: Date;

    switch (filters.trendPeriod) {
        case 'daily':
            // 3 hari → exclude hari ini → sisa 2 hari lengkap
            lookbackStart = new Date(now);
            lookbackStart.setDate(now.getDate() - 3);
            break;
        case 'weekly':
            // 3 minggu → exclude minggu ini → sisa 2 minggu lengkap
            lookbackStart = new Date(now);
            lookbackStart.setDate(now.getDate() - 21);
            break;
        case 'monthly':
            // FIX 3: 3 bulan → exclude bulan ini → sisa 2 bulan lengkap
            lookbackStart = new Date(now);
            lookbackStart.setMonth(now.getMonth() - 3);
            lookbackStart.setDate(1);
            break;
        case 'quarterly':
            // FIX 3: 3 quarter → exclude quarter ini → sisa 2 quarter lengkap
            lookbackStart = new Date(now);
            lookbackStart.setMonth(now.getMonth() - 9);
            lookbackStart.setDate(1);
            break;
    }

    const fromDate = formatDate(lookbackStart);
    const toDate   = formatDate(now);

    const BATCH  = 1000;
    let allData: any[] = [];
    let from = 0;

    while (true) {
        let q = supabaseAdmin
            .from('all_cases')
            .select('date, module_case')
            .is('deleted_at', null)
            .gte('date', fromDate!)
            .lte('date', toDate!)
            .range(from, from + BATCH - 1);

        if (filters.categories.length    > 0) q = q.in('category_case', filters.categories);
        if (filters.clients.length       > 0) q = q.in('client_name',   filters.clients);
        if (filters.modules.length       > 0) q = q.in('module_case',   filters.modules);
        if (filters.detailModules.length > 0) q = q.in('detail_module', filters.detailModules);

        const { data: batch, error } = await q;
        if (error) throw new Error(error.message);
        if (!batch || batch.length === 0) break;

        allData = allData.concat(batch);
        if (batch.length < BATCH) break;
        from += BATCH;
    }

    console.log(`📊 [Trend] ${allData.length} rows fetched (${fromDate} → ${toDate}, period=${filters.trendPeriod})`);
    return allData;
}

// ─────────────────────────────────────────────────────────────────────────────
// emptyStats
// ─────────────────────────────────────────────────────────────────────────────
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