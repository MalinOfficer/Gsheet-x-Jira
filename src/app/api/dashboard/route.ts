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

type RankingItem = {
    name: string;
    value?: number;
    [year: string]: any;
};

type UnresolvedCase = {
    client_name: string;
    title: string;
    status: string;
    module?: string;
    detail_module?: string;
    created_at?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const UNRESOLVED_STATUSES = ['l1', 'l2', 'l3', 'pending', 'on hold'];

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
// buildYearRankings
// ─────────────────────────────────────────────────────────────────────────────
function buildYearRankings(data: any[], nameKey: string): RankingItem[] {
    const yearSet = new Set<string>();
    data.forEach(r => {
        if (!r.date) return;
        const d = new Date(r.date + 'T00:00:00');
        if (!isNaN(d.getTime())) yearSet.add(String(d.getFullYear()));
    });
    const years = Array.from(yearSet).sort();

    if (years.length > 1) {
        const countMap: Record<string, Record<string, number>> = {};
        data.forEach(r => {
            const name = r[nameKey];
            if (!name || !r.date) return;
            const d = new Date(r.date + 'T00:00:00');
            if (isNaN(d.getTime())) return;
            const year = String(d.getFullYear());
            if (!countMap[name]) countMap[name] = {};
            countMap[name][year] = (countMap[name][year] || 0) + 1;
        });
        return Object.entries(countMap)
            .map(([name, yearData]) => {
                const total = Object.values(yearData).reduce((a, b) => a + b, 0);
                const obj: RankingItem = { name, value: total };
                years.forEach(y => { obj[y] = yearData[y] ?? 0; });
                return { ...obj, _total: total };
            })
            .sort((a: any, b: any) => b._total - a._total)
            .map(({ _total, ...rest }: any) => rest as RankingItem);
    } else {
        const countMap: Record<string, number> = {};
        data.forEach(r => {
            const name = r[nameKey];
            if (name) countMap[name] = (countMap[name] || 0) + 1;
        });
        return Object.entries(countMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// buildUnresolvedCases — derive dari raw rows (MODE 2)
// ─────────────────────────────────────────────────────────────────────────────
function buildUnresolvedCases(data: any[]): UnresolvedCase[] {
    return data
        .filter(r => UNRESOLVED_STATUSES.includes(String(r.status_case ?? '').toLowerCase().trim()))
        .map(r => ({
            client_name:   String(r.client_name   ?? '').trim(),
            title:         String(r.title ?? r.detail_module ?? r.module_case ?? '').trim(),
            status:        String(r.status_case   ?? '').trim(),
            module:        String(r.module_case   ?? '').trim(),
            detail_module: String(r.detail_module ?? '').trim(),
            created_at:    r.date ?? '',
        }))
        .filter(c => c.client_name !== '' && c.title !== '' && c.status !== '');
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchUnresolvedCases — query terpisah untuk MODE 1 (RPC)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchUnresolvedCases(filters: {
    p_start_date: string | null;
    p_end_date: string | null;
    categories: string[];
    clients: string[];
    modules: string[];
    detailModules: string[];
}): Promise<UnresolvedCase[]> {
    try {
        let q = supabaseAdmin
            .from('all_cases')
            .select('client_name, title, status_case, module_case, detail_module, date')
            .is('deleted_at', null)
            .in('status_case', UNRESOLVED_STATUSES);

        if (filters.p_start_date) q = q.gte('date', filters.p_start_date);
        if (filters.p_end_date)   q = q.lte('date', filters.p_end_date);
        if (filters.categories[0])    q = q.eq('category_case', filters.categories[0]);
        if (filters.clients[0])       q = q.eq('client_name',   filters.clients[0]);
        if (filters.modules[0])       q = q.eq('module_case',   filters.modules[0]);
        if (filters.detailModules[0]) q = q.eq('detail_module', filters.detailModules[0]);

        const { data, error } = await q;

        if (error) {
            console.warn('⚠️  [Unresolved] query error:', error.message);
            return [];
        }

        const result = (data ?? [])
            .map(r => ({
                client_name:   String(r.client_name   ?? '').trim(),
                title:         String((r as any).title ?? r.detail_module ?? r.module_case ?? '').trim(),
                status:        String(r.status_case   ?? '').trim(),
                module:        String(r.module_case   ?? '').trim(),
                detail_module: String(r.detail_module ?? '').trim(),
                created_at:    (r as any).date ?? '',
            }))
            .filter(c => c.client_name !== '' && c.title !== '' && c.status !== '');

        console.log(`🔴 [Unresolved] ${result.length} unresolved case(s) found`);
        return result;

    } catch (err: any) {
        console.error('❌ [Unresolved] fetch failed:', err.message);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// isSubstantiallyComplete
// ─────────────────────────────────────────────────────────────────────────────
export function isSubstantiallyComplete(period: TrendPeriod): boolean {
    const now   = new Date();
    const day   = now.getDate();
    const month = now.getMonth();

    switch (period) {
        case 'daily':
            return now.getHours() >= 18;
        case 'weekly':
            return now.getDay() >= 4;
        case 'monthly':
            return day >= 20;
        case 'quarterly': {
            const isLastMonthOfQ = [2, 5, 8, 11].includes(month);
            return isLastMonthOfQ && day >= 15;
        }
    }
}

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
// ─────────────────────────────────────────────────────────────────────────────
function computeModuleTrends(data: any[], period: TrendPeriod = 'monthly'): ModuleTrend[] {
    const incompletePeriod  = getCurrentIncompletePeriodKey(period);
    const skipCurrentPeriod = !isSubstantiallyComplete(period);

    const periodCounts: Record<string, Record<string, number>> = {};

    data.forEach(r => {
        if (!r.date || !r.module_case) return;
        const d = new Date(r.date + 'T00:00:00');
        if (isNaN(d.getTime())) return;

        const key = getPeriodKey(d, period);
        if (skipCurrentPeriod && key === incompletePeriod) return;

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
        const current    = currentMap[name]  ?? 0;
        const previous   = previousMap[name] ?? 0;
        const change     = current - previous;
        const change_pct: number | null =
            previous === 0 ? null : Math.round((change / previous) * 100);
        const direction: 'up' | 'down' | 'stable' =
            change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

        return { name, current, previous, change, change_pct, direction };
    });

    console.log(
        `📊 [Trend] period=${period} | skip_incomplete=${skipCurrentPeriod} | ` +
        `"${previousPeriodKey}" vs "${currentPeriodKey}" | ${trends.length} modules`
    );

    return trends
        .filter(t => !(t.current === 0 && t.previous === 0))
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchAllRows
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
// fetchCategoryRows
// ─────────────────────────────────────────────────────────────────────────────
async function fetchCategoryRows(filters: {
    dateRange?: DateRange;
    years: string[];
    categories: string[];
    clients: string[];
    modules: string[];
    detailModules: string[];
}): Promise<RankingItem[]> {
    const BATCH = 1000;
    const rows: any[] = [];
    let from = 0;

    while (true) {
        let q = supabaseAdmin
            .from('all_cases')
            .select('date, category_case')
            .is('deleted_at', null)
            .not('category_case', 'is', null)
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
            console.warn('⚠️  [Category] query error:', error.message);
            break;
        }
        if (!batch || batch.length === 0) break;

        batch.forEach((r: any) => { if (r.category_case) rows.push(r); });

        if (batch.length < BATCH) break;
        from += BATCH;
    }

    const result = buildYearRankings(rows, 'category_case');
    console.log(`🏷️  [Category] ${result.length} unique entries`);
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeStats — MODE 2 (Direct Query / multi-filter)
// ─────────────────────────────────────────────────────────────────────────────
function computeStats(data: any[], trendPeriod: TrendPeriod = 'monthly') {
    const totalCases  = data.length;
    const totalSolved = data.filter(r => r.status_case_solved === 'SOLVED').length;
    const solvedPct   = totalCases > 0 ? (totalSolved / totalCases) * 100 : 0;

    const uniqueClients = new Set(data.map(r => r.client_name).filter(Boolean));

    const clientRankings       = buildYearRankings(data, 'client_name');
    const categoryRankings     = buildYearRankings(data, 'category_case');
    const detailModuleRankings = buildYearRankings(data, 'detail_module');

    const moduleCounts: Record<string, number> = {};
    data.forEach(r => { if (r.module_case) moduleCounts[r.module_case] = (moduleCounts[r.module_case] || 0) + 1; });
    const moduleRankings = Object.entries(moduleCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const trendingCategory = categoryRankings[0]?.name ?? 'N/A';
    const trendingModule   = moduleRankings[0]?.name   ?? 'N/A';

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

    const moduleTrends    = computeModuleTrends(data, trendPeriod);
    const unresolvedCases = buildUnresolvedCases(data);

    console.log(`🔴 [MODE2 Unresolved] ${unresolvedCases.length} case(s)`);

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
        category_rankings:      categoryRankings,
        unresolved_cases:       unresolvedCases,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildRpcDateParams
// ─────────────────────────────────────────────────────────────────────────────
function buildRpcDateParams(
    dateRange: DateRange | undefined,
    yearValue: number | null
): { p_start_date: string | null; p_end_date: string | null } {
    if (dateRange?.from) {
        return {
            p_start_date: formatDate(dateRange.from),
            p_end_date:   dateRange.to ? formatDate(dateRange.to) : formatDate(dateRange.from),
        };
    }

    if (yearValue !== null) {
        return {
            p_start_date: `${yearValue}-01-01`,
            p_end_date:   `${yearValue}-12-31`,
        };
    }

    return { p_start_date: null, p_end_date: null };
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

        // ── MODE 1: RPC (single-year / single-filter) ─────────────────────────
        if (!isMultiFilter) {
            const singleYear = selectedYears[0];
            let yearValue: number | null = null;
            if (singleYear) {
                const parsed = parseInt(singleYear, 10);
                if (!isNaN(parsed)) yearValue = parsed;
            }

            const { p_start_date, p_end_date } = buildRpcDateParams(dateRange, yearValue);

            const params: Record<string, any> = {
                p_start_date,
                p_end_date,
                p_category:      categories[0]    ?? null,
                p_client:        clients[0]        ?? null,
                p_module:        modules[0]        ?? null,
                p_year:          yearValue,
                p_detail_module: detailModules[0] ?? null,
            };

            console.log('🚀 [API] Calling RPC fn_dashboard_filtered:', params);

            // ── Jalankan RPC, trend rows, category rows, DAN unresolved cases secara parallel
            const [rpcResult, rawForTrends, categoryRankings, unresolvedCases] = await Promise.all([
                supabaseAdmin.rpc('fn_dashboard_filtered', params),
                fetchTrendRows({ ...sharedFilters, trendPeriod }),
                fetchCategoryRows(sharedFilters),
                fetchUnresolvedCases({ p_start_date, p_end_date, categories, clients, modules, detailModules }),
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

            const clientRankingsRpc = parseJSONB(result.out_client_rankings)
                .map((i: any) => ({ name: i.client, value: i.cases }));

            const detailModuleRankingsRpc = parseJSONB(result.out_detail_module_rankings)
                .map((i: any) => ({ name: i.detail_module, value: i.cases }));

            const moduleTrends = computeModuleTrends(rawForTrends, trendPeriod);

            console.log(`🔴 [MODE1 Unresolved] ${unresolvedCases.length} case(s)`);

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
                client_rankings:        clientRankingsRpc,
                module_rankings:        moduleRankingsRpc,
                detail_module_rankings: detailModuleRankingsRpc,
                module_trends:          moduleTrends,
                category_rankings:      categoryRankings,
                unresolved_cases:       unresolvedCases,  // ← FIX: tidak lagi hardcoded []
            }});
        }

        // ── MODE 2: Direct query (multi-filter / multi-year) ──────────────────
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
// fetchTrendRows
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
            lookbackStart = new Date(now);
            lookbackStart.setDate(now.getDate() - 3);
            break;
        case 'weekly':
            lookbackStart = new Date(now);
            lookbackStart.setDate(now.getDate() - 21);
            break;
        case 'monthly':
            lookbackStart = new Date(now);
            lookbackStart.setMonth(now.getMonth() - 3);
            lookbackStart.setDate(1);
            break;
        case 'quarterly':
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
        category_rankings:      [],
        unresolved_cases:       [],
    };
}