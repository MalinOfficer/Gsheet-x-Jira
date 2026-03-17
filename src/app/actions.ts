"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from 'next/cache';
import {
  mapDBArrayToFrontend,
  getSelectColumns,
  type YourDBRow,
  normalizeClientName,
} from "@/lib/db-mapper";
import { getISOWeek, getYear, getQuarter } from 'date-fns';

// ============================================
// HELPERS
// ============================================

const formatDate = (date: any) => {
    if (!date) return null;
    try {
        const d = new Date(date);
        if (d.getUTCHours() >= 12) {
          d.setUTCDate(d.getUTCDate() + 1);
        }
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error('Invalid date:', date);
        return null;
    }
};

const _formatDateDashboard = (date: any): string | null => {
    if (!date) return null;
    try {
        const d = date instanceof Date ? date : new Date(date);
        return d.toISOString().split('T')[0];
    } catch { return null; }
};

// ============================================
// FETCH ALL CASES DATA
// ============================================

export async function getAllCaseData(filters?: {
  year?: string;
  category?: string[];
  client?: string[];
  module?: string[];
  status?: string[];
  detailModule?: string[];
  month?: string[];
  dateRange?: { from?: Date; to?: Date };
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  try {
    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.min(filters?.pageSize || 100, 500);
    const offset = (page - 1) * pageSize;

    let query = supabaseAdmin
      .from("all_cases")
      .select(getSelectColumns(), { count: "exact" })
      .is('deleted_at', null);

    const sortBy = filters?.sortBy || 'date';
    const sortOrder = filters?.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    if (filters?.dateRange?.from) {
      const fromDate = formatDate(filters.dateRange.from);
      const toDate = filters?.dateRange?.to
        ? formatDate(filters.dateRange.to)
        : formatDate(filters.dateRange.from);
      query = query.gte('date', fromDate).lte('date', toDate);
    } else if (filters?.year && filters.year !== 'all') {
      const yearNum = parseInt(filters.year, 10);
      query = query.gte('date', `${yearNum}-01-01`).lte('date', `${yearNum}-12-31`);
    }

    if (filters?.category?.length)     query = query.in('category_case', filters.category);
    if (filters?.client?.length)       query = query.in('client_name',   filters.client);
    if (filters?.module?.length)       query = query.in('module_case',   filters.module);
    if (filters?.status?.length)       query = query.in('status_case',   filters.status);
    if (filters?.detailModule?.length) query = query.in('detail_module', filters.detailModule);
    if (filters?.month?.length)        query = query.in('month',         filters.month);

    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      query = query.or(
        `ticket_number.ilike.${searchTerm},` +
        `client_name.ilike.${searchTerm},` +
        `status_case.ilike.${searchTerm},` +
        `category_case.ilike.${searchTerm},` +
        `module_case.ilike.${searchTerm},` +
        `detail_module.ilike.${searchTerm},` +
        `detail_case.ilike.${searchTerm}`
      );
    }

    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("❌ Error fetching cases:", error);
      return { error: error.message };
    }

    const mappedData = mapDBArrayToFrontend(data as YourDBRow[]);

    return {
      data: mappedData,
      source: "supabase" as const,
      pagination: {
        total: count || 0,
        page,
        pageSize,
        totalPages: count ? Math.ceil(count / pageSize) : 0,
        hasNextPage: count ? offset + pageSize < count : false,
        hasPrevPage: page > 1,
      }
    };
  } catch (error: any) {
    console.error("❌ Unexpected error fetching cases:", error);
    return { error: error.message || "Failed to fetch cases data" };
  }
}

// ============================================
// UPDATE SINGLE CASE
// ============================================

export async function updateCase(caseId: number, data: Record<string, any>) {
  try {
    const dbData = {
      date: data.date,
      month: data.month,
      client_name: normalizeClientName(data.client_name),
      pic_client: data.customer_name,
      status_case: data.status,
      category_case: data.ticket_category,
      module_case: data.module,
      detail_module: data.detail_module,
      check_in: data.created_at,
      detail_case: data.title,
      check_out: data.resolved_at,
      status_case_solved: data.status_case_2,
      source_link_op: data.ticket_op,
      note: data.note,
    };

    const { error } = await supabaseAdmin
      .from('all_cases')
      .update(dbData)
      .eq('id', caseId);

    if (error) throw error;

    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true, id: caseId };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// DELETE SINGLE CASE
// ============================================

export async function deleteCase(caseId: number) {
  try {
    const { error } = await supabaseAdmin
      .from('all_cases')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', caseId);

    if (error) throw error;

    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true, id: caseId };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// DELETE MULTIPLE CASES
// ============================================

export async function deleteCases(caseIds: number[]) {
  try {
    if (caseIds.length === 0) return { success: true, count: 0 };

    const { error } = await supabaseAdmin
      .from('all_cases')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', caseIds);

    if (error) throw error;

    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true, count: caseIds.length };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// REFRESH DASHBOARD
// ============================================

export async function refreshDashboardViews() {
  try {
    await supabaseAdmin.rpc('refresh_dashboard_views');
    revalidatePath('/dashboard');
    return { success: true, message: "Views refreshed and cache revalidated." };
  } catch (error: any) {
    console.error("Error refreshing dashboard views:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// GET DASHBOARD FILTER OPTIONS
// ============================================

const _getDashboardFilterOptions = async () => {
  // ✅ Prevent Next.js server-side caching — filter options harus selalu fresh
  noStore();

  try {
    const [categoriesResult, clientsResult, modulesResult, detailModulesResult, yearsResult] = await Promise.all([
      supabaseAdmin.from("ticket_categories").select("name").is('deleted_at', null).order('name', { ascending: true }),
      supabaseAdmin.from("clients").select("name").order('name', { ascending: true }),
      supabaseAdmin.from("master_module").select("nama_module").is('deleted_at', null).order('nama_module', { ascending: true }),
      supabaseAdmin.from("master_detail_module").select("detail_module").is('deleted_at', null).order('detail_module', { ascending: true }),
      supabaseAdmin.rpc('get_distinct_years'),
    ]);

    if (categoriesResult.error)    throw categoriesResult.error;
    if (clientsResult.error)       throw clientsResult.error;
    if (modulesResult.error)       throw modulesResult.error;
    if (detailModulesResult.error) throw detailModulesResult.error;
    if (yearsResult.error) console.error('⚠️ Error fetching years:', yearsResult.error);

    const sortedYears = (yearsResult.data || [])
      .map((item: any) => String(item.year))
      .filter((year: string) => year && !['null', 'undefined', 'NaN'].includes(year));

    return {
      success: true,
      data: {
        categories:    (categoriesResult.data || []).map((c: any) => ({ label: c.name,        value: c.name })),
        clients:       (clientsResult.data    || []).map((c: any) => ({ label: c.name,        value: c.name })),
        modules:       (modulesResult.data    || []).map((m: any) => ({ label: m.nama_module, value: m.nama_module })),
        detailModules: (detailModulesResult.data || []).map((d: any) => ({ label: d.detail_module, value: d.detail_module })),
        years:         sortedYears,
      },
    };
  } catch (error: any) {
    console.error("❌ Error fetching filter options:", error);
    return { success: false, error: error.message || "Failed to fetch filter options" };
  }
};

export async function getDashboardFilterOptions() {
  return await _getDashboardFilterOptions();
}

// ============================================
// GET DASHBOARD STATS
// ============================================

type TrendPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

type DashboardFilters = {
  selectedYears: string[];
  categoryFilter: string[];
  clientFilter: string[];
  moduleFilter: string[];
  detailModuleFilter: string[];
  dateRange?: { from?: Date | string; to?: Date | string } | undefined;
};

const _pivotAndOrderMonthlyStats = (unpivotedData: any[] | null | undefined): any[] => {
  if (!unpivotedData || !Array.isArray(unpivotedData) || unpivotedData.length === 0) return [];
  const monthOrder = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const statsByMonth: Record<string, any> = {};
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

const _parseJSONB = (field: any): any[] => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') { try { return JSON.parse(field); } catch { return []; } }
  return [];
};

function _emptyStats() {
  return {
    summary: {
      total_cases: 0, total_solved: 0, total_clients: 0,
      solved_percentage: 0, trending_category: 'N/A',
      trending_module: 'N/A', top_client: 'N/A', top_module: 'N/A',
    },
    monthly_stats:          [],
    client_rankings:        [],
    module_rankings:        [],
    detail_module_rankings: [],
    module_trends:          [],
  };
}

function _getPeriodKey(d: Date, period: TrendPeriod): string {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  switch (period) {
    case 'daily':     return `${yyyy}-${mm}-${dd}`;
    case 'weekly': {
      const week    = String(getISOWeek(d)).padStart(2, '0');
      const isoYear = getYear(d);
      return `${isoYear}-W${week}`;
    }
    case 'monthly':   return `${yyyy}-${mm}`;
    case 'quarterly': return `${yyyy}-Q${getQuarter(d)}`;
  }
}

function _computeModuleTrends(data: any[], period: TrendPeriod = 'monthly') {
  const incompletePeriod = _getPeriodKey(new Date(), period);
  const periodCounts: Record<string, Record<string, number>> = {};

  data.forEach(r => {
    if (!r.date || !r.module_case) return;
    const d = new Date(r.date + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    const key = _getPeriodKey(d, period);
    if (key === incompletePeriod) return;
    if (!periodCounts[key]) periodCounts[key] = {};
    periodCounts[key][r.module_case] = (periodCounts[key][r.module_case] || 0) + 1;
  });

  const periods = Object.keys(periodCounts).sort();
  if (periods.length < 2) {
    console.log(`⚠️  [actions/Trend] Hanya ${periods.length} periode lengkap — butuh ≥ 2`);
    return [];
  }

  const currentMap  = periodCounts[periods[periods.length - 1]] ?? {};
  const previousMap = periodCounts[periods[periods.length - 2]] ?? {};
  const allModules  = new Set([...Object.keys(currentMap), ...Object.keys(previousMap)]);

  console.log(`📊 [actions/Trend] "${periods[periods.length - 2]}" vs "${periods[periods.length - 1]}" | ${allModules.size} modules`);

  return Array.from(allModules)
    .map(name => {
      const current    = currentMap[name]  ?? 0;
      const previous   = previousMap[name] ?? 0;
      const change     = current - previous;
      const change_pct = previous === 0 ? null : Math.round((change / previous) * 100);
      const direction: 'up' | 'down' | 'stable' = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
      return { name, current, previous, change, change_pct, direction };
    })
    .filter(t => !(t.current === 0 && t.previous === 0))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 8);
}

function _computeStats(data: any[], trendPeriod: TrendPeriod = 'monthly') {
  const totalCases    = data.length;
  const totalSolved   = data.filter(r => r.status_case_solved === 'SOLVED').length;
  const solvedPct     = totalCases > 0 ? (totalSolved / totalCases) * 100 : 0;
  const uniqueClients = new Set(data.map(r => r.client_name).filter(Boolean));

  const categoryCounts: Record<string, number> = {};
  data.forEach(r => { if (r.category_case) categoryCounts[r.category_case] = (categoryCounts[r.category_case] || 0) + 1; });
  const trendingCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

  const clientCounts: Record<string, number> = {};
  data.forEach(r => { if (r.client_name) clientCounts[r.client_name] = (clientCounts[r.client_name] || 0) + 1; });
  const clientRankings = Object.entries(clientCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const moduleCounts: Record<string, number> = {};
  data.forEach(r => { if (r.module_case) moduleCounts[r.module_case] = (moduleCounts[r.module_case] || 0) + 1; });
  const moduleRankings = Object.entries(moduleCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const detailModuleCounts: Record<string, number> = {};
  data.forEach(r => { if (r.detail_module) detailModuleCounts[r.detail_module] = (detailModuleCounts[r.detail_module] || 0) + 1; });
  const detailModuleRankings = Object.entries(detailModuleCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

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
      trending_module:   moduleRankings[0]?.name ?? 'N/A',
      top_client:        clientRankings[0]?.name ?? 'N/A',
      top_module:        moduleRankings[0]?.name ?? 'N/A',
    },
    monthly_stats:          _pivotAndOrderMonthlyStats(unpivoted),
    client_rankings:        clientRankings,
    module_rankings:        moduleRankings,
    detail_module_rankings: detailModuleRankings,
    module_trends:          _computeModuleTrends(data, trendPeriod),
  };
}

async function _fetchAllRowsDirect(filters: {
  dateRange?: any;
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
      const fromDate = _formatDateDashboard(filters.dateRange.from);
      const toDate   = filters.dateRange.to ? _formatDateDashboard(filters.dateRange.to) : fromDate;
      q = q.gte('date', fromDate!).lte('date', toDate!);
    } else if (filters.years.length === 1) {
      const y = parseInt(filters.years[0], 10);
      if (!isNaN(y)) q = q.gte('date', `${y}-01-01`).lte('date', `${y}-12-31`);
    } else if (filters.years.length > 1) {
      const orParts = filters.years
        .map(y => { const n = parseInt(y, 10); return isNaN(n) ? null : `and(date.gte.${n}-01-01,date.lte.${n}-12-31)`; })
        .filter(Boolean).join(',');
      if (orParts) q = (q as any).or(orParts);
    }

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

  return allData;
}

async function _fetchDetailModuleRowsDirect(filters: {
  dateRange?: any;
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
      const fromDate = _formatDateDashboard(filters.dateRange.from);
      const toDate   = filters.dateRange.to ? _formatDateDashboard(filters.dateRange.to) : fromDate;
      q = q.gte('date', fromDate!).lte('date', toDate!);
    } else if (filters.years.length === 1) {
      const y = parseInt(filters.years[0], 10);
      if (!isNaN(y)) q = q.gte('date', `${y}-01-01`).lte('date', `${y}-12-31`);
    } else if (filters.years.length > 1) {
      const orParts = filters.years
        .map(y => { const n = parseInt(y, 10); return isNaN(n) ? null : `and(date.gte.${n}-01-01,date.lte.${n}-12-31)`; })
        .filter(Boolean).join(',');
      if (orParts) q = (q as any).or(orParts);
    }

    if (filters.categories.length    > 0) q = q.in('category_case', filters.categories);
    if (filters.clients.length       > 0) q = q.in('client_name',   filters.clients);
    if (filters.modules.length       > 0) q = q.in('module_case',   filters.modules);
    if (filters.detailModules.length > 0) q = q.in('detail_module', filters.detailModules);

    const { data: batch, error } = await q;
    if (error) { console.warn('⚠️  [actions/DetailModule] query error:', error.message); break; }
    if (!batch || batch.length === 0) break;

    batch.forEach((r: any) => {
      if (r.detail_module) countMap[r.detail_module] = (countMap[r.detail_module] || 0) + 1;
    });

    if (batch.length < BATCH) break;
    from += BATCH;
  }

  const result = Object.entries(countMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  console.log(`🔍 [actions/DetailModule] ${result.length} unique, ${result.reduce((s, r) => s + r.value, 0)} total`);
  return result;
}

async function _fetchTrendRowsDirect(filters: {
  dateRange?: any;
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

  const fromDate = _formatDateDashboard(lookbackStart);
  const toDate   = _formatDateDashboard(now);

  const BATCH = 1000;
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

  console.log(`📊 [actions/Trend] ${allData.length} rows (${fromDate} → ${toDate}, period=${filters.trendPeriod})`);
  return allData;
}

function _buildRpcDateParams(
  dateRange: { from?: Date | string; to?: Date | string } | undefined,
  yearValue: number | null
): { p_start_date: string | null; p_end_date: string | null } {
  if (dateRange?.from) {
    return {
      p_start_date: _formatDateDashboard(dateRange.from),
      p_end_date:   dateRange.to ? _formatDateDashboard(dateRange.to) : _formatDateDashboard(dateRange.from),
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

export async function getDashboardStats(filters: DashboardFilters): Promise<{
  success: boolean;
  data?: ReturnType<typeof _emptyStats>;
  error?: string;
}> {
  try {
    const { selectedYears, categoryFilter, clientFilter, moduleFilter, detailModuleFilter, dateRange } = filters;

    const trendPeriod: TrendPeriod = 'monthly';

    const sharedFilters = {
      dateRange,
      years:         selectedYears,
      categories:    categoryFilter,
      clients:       clientFilter,
      modules:       moduleFilter,
      detailModules: detailModuleFilter,
    };

    const isMultiFilter =
      categoryFilter.length     > 1 ||
      clientFilter.length       > 1 ||
      moduleFilter.length       > 1 ||
      detailModuleFilter.length > 1 ||
      selectedYears.length      > 1;

    if (!isMultiFilter) {
      const singleYear = selectedYears[0];
      const yearParsed = singleYear ? parseInt(singleYear, 10) : NaN;
      const yearValue  = isNaN(yearParsed) ? null : yearParsed;

      const { p_start_date, p_end_date } = _buildRpcDateParams(dateRange, yearValue);

      const rpcParams: Record<string, any> = {
        p_start_date,
        p_end_date,
        p_category:      categoryFilter[0]    ?? null,
        p_client:        clientFilter[0]       ?? null,
        p_module:        moduleFilter[0]       ?? null,
        p_year:          yearValue,
        p_detail_module: detailModuleFilter[0] ?? null,
      };

      console.log('🚀 [actions] RPC fn_dashboard_filtered:', rpcParams);

      const [rpcResult, detailModuleRankings, trendRows] = await Promise.all([
        supabaseAdmin.rpc('fn_dashboard_filtered', rpcParams),
        _fetchDetailModuleRowsDirect(sharedFilters),
        _fetchTrendRowsDirect({ ...sharedFilters, trendPeriod }),
      ]);

      const { data, error } = rpcResult;

      if (error) throw error;

      if (!data || data.length === 0 || data[0].out_total_cases === null) {
        return { success: true, data: _emptyStats() };
      }

      const result = data[0];
      const moduleRankings = _parseJSONB(result.out_module_rankings)
        .map((i: any) => ({ name: i.module, value: i.cases }));

      const moduleTrends = _computeModuleTrends(trendRows, trendPeriod);

      return {
        success: true,
        data: {
          summary: {
            total_cases:       result.out_total_cases       ?? 0,
            total_solved:      result.out_total_solved       ?? 0,
            total_clients:     result.out_total_clients      ?? 0,
            solved_percentage: result.out_solved_percentage  ?? 0,
            trending_category: result.out_trending_category  ?? 'N/A',
            trending_module:   result.out_trending_module    ?? moduleRankings[0]?.name ?? 'N/A',
            top_client:        result.out_top_client         ?? 'N/A',
            top_module:        result.out_top_module         ?? 'N/A',
          },
          monthly_stats:          _pivotAndOrderMonthlyStats(_parseJSONB(result.out_monthly_stats)),
          client_rankings:        _parseJSONB(result.out_client_rankings).map((i: any) => ({ name: i.client, value: i.cases })),
          module_rankings:        moduleRankings,
          detail_module_rankings: detailModuleRankings,
          module_trends:          moduleTrends,
        },
      };
    }

    const allData = await _fetchAllRowsDirect(sharedFilters);

    if (allData.length === 0) return { success: true, data: _emptyStats() };

    return { success: true, data: _computeStats(allData, trendPeriod) };

  } catch (error: any) {
    console.error('❌ [getDashboardStats] Error:', error);
    return { success: false, error: error.message || 'Failed to fetch dashboard stats' };
  }
}

// ============================================
// USER PREFERENCES
// ============================================

export type UserPreferences = {
    theme?:                  'light' | 'dark' | 'system';
    sidebarCollapsed?:       boolean;
    menuVisibility?:         Record<string, boolean>;
    dashboardTrendPeriod?:   'daily' | 'weekly' | 'monthly' | 'quarterly';
    dashboardDefaultYears?:  string[];
};

export async function getUserPreferences(userId: string): Promise<{
    success: boolean;
    data?: UserPreferences;
    error?: string;
}> {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_preferences')
            .select('preferences')
            .eq('user_id', userId)
            .single();

        // Row belum ada → return empty, akan dibuat saat pertama save
        if (error && error.code === 'PGRST116') {
            return { success: true, data: {} };
        }
        if (error) throw error;

        return { success: true, data: data.preferences as UserPreferences };
    } catch (err: any) {
        console.error('❌ [getUserPreferences]:', err);
        return { success: false, error: err.message };
    }
}

export async function saveUserPreferences(
    userId: string,
    preferences: Partial<UserPreferences>
): Promise<{ success: boolean; error?: string }> {
    try {
        // Ambil preferences lama untuk deep merge
        const { data: existing } = await supabaseAdmin
            .from('user_preferences')
            .select('preferences')
            .eq('user_id', userId)
            .single();

        const merged: UserPreferences = {
            ...(existing?.preferences ?? {}),
            ...preferences,
            // Deep merge menuVisibility agar tidak overwrite semua key
            menuVisibility: {
                ...(existing?.preferences?.menuVisibility ?? {}),
                ...(preferences.menuVisibility ?? {}),
            },
        };

        const { error } = await supabaseAdmin
            .from('user_preferences')
            .upsert({
                user_id:     userId,
                preferences: merged,
                updated_at:  new Date().toISOString(),
            }, { onConflict: 'user_id' });

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('❌ [saveUserPreferences]:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// L3 REPORT
// ============================================

export async function getL3ReportFromDB() {
  try {
    const { data, error } = await supabaseAdmin
      .from('all_cases')
      .select('client_name, detail_case, check_in, module_case, source_link_op, status_case, ticket_number')
      .is('deleted_at', null)
      .in('status_case', ['L3', 'ON HOLD'])
      .order('check_in', { ascending: true });

    if (error) throw new Error(`Database error: ${error.message}`);
    if (!data || data.length === 0) return { success: true, report: "Tidak ada kasus L3 atau On Hold yang ditemukan." };

    const formatDateLocal = (date: Date) => {
      if (!date || isNaN(date.getTime())) return '';
      return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
    };

    const minDate    = new Date(data[0].check_in!);
    const maxDate    = new Date(data[data.length - 1].check_in!);
    const today      = new Date();
    const header     = `*Update cases yang belum solved L3 on hold (${formatDateLocal(minDate)} - ${formatDateLocal(maxDate)})*`;
    const totalCases = data.length;

    const getGroupForModule = (m: string | null | undefined): string => {
      const u = (m || '').toUpperCase();
      if (u === 'PAYMENT' || u === 'PINTRO PAY') return 'Payment';
      if (u === 'APLIKASI/MOBILE' || u === 'AKSES PORTAL') return 'Aplikasi/Mobile';
      return 'Akademik';
    };

    const casesByGroup: Record<string, any[]> = {};
    data.forEach((c: any) => {
      const g = getGroupForModule(c.module_case);
      if (!casesByGroup[g]) casesByGroup[g] = [];
      casesByGroup[g].push(c);
    });

    const groupOrder   = ['Akademik', 'Payment', 'Aplikasi/Mobile'];
    const sortedGroups = Object.keys(casesByGroup).sort((a, b) => {
      const ia = groupOrder.indexOf(a), ib = groupOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1; if (ib === -1) return -1;
      return ia - ib;
    });

    const summaryLines = [`Total : ${totalCases}`, ...sortedGroups.map(g => `${g} > L3 : ${casesByGroup[g].length}`)];
    const detailLines: string[] = [];

    sortedGroups.forEach(g => {
      detailLines.push(`\n*${g.toUpperCase()} > L3*`);
      casesByGroup[g]
        .sort((a: any, b: any) => (a.client_name || '').localeCompare(b.client_name || ''))
        .forEach((c: any, i: number) => {
          const checkInDate = new Date(c.check_in!);
          const age = isNaN(checkInDate.getTime()) ? 0 : Math.max(1, Math.ceil((today.getTime() - checkInDate.getTime()) / 86400000));
          const parts = [c.client_name, c.ticket_number, c.detail_case, c.source_link_op].filter(Boolean);
          detailLines.push(`${i + 1}. ${parts.join(' ').trim()} (${age} hari)`);
        });
    });

    return { success: true, report: `${header}\n\n${summaryLines.join('\n')}\n${detailLines.join('\n')}`.trim() };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// CLIENT MANAGEMENT
// ============================================

export async function getDistinctClientsFromDB(): Promise<{ success: boolean; clients?: string[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.from('clients').select('name').order('name', { ascending: true });
    if (error) throw error;
    return { success: true, clients: data.map((c: { name: string }) => c.name).filter(Boolean) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addClient(clientName: string): Promise<{ success: boolean; client?: { name: string }; error?: string }> {
  try {
    if (!clientName?.trim()) return { success: false, error: "Client name cannot be empty." };
    const { data, error } = await supabaseAdmin.from('clients').insert({ name: clientName.trim() }).select('name').single();
    if (error) {
      if (error.code === '23505') return { success: false, error: `Client "${clientName}" already exists.` };
      throw error;
    }
    revalidatePath('/db'); revalidatePath('/dashboard');
    return { success: true, client: data as { name: string } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// CATEGORY MANAGEMENT
// ============================================

export async function getAllCategories(): Promise<{ success: boolean; categories?: { id: number; name: string }[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.from('ticket_categories').select('id, name').order('name', { ascending: true });
    if (error) throw error;
    return { success: true, categories: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addCategory(categoryName: string): Promise<{ success: boolean; category?: { id: number; name: string }; error?: string }> {
  try {
    if (!categoryName?.trim()) return { success: false, error: "Category name cannot be empty." };
    const { data, error } = await supabaseAdmin.from('ticket_categories').insert({ name: categoryName.trim() }).select('id, name').single();
    if (error) {
      if (error.code === '23505') return { success: false, error: `Category "${categoryName}" already exists.` };
      throw error;
    }
    revalidatePath('/db'); revalidatePath('/dashboard');
    return { success: true, category: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteCategory(categoryId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from('ticket_categories').update({ deleted_at: new Date().toISOString() }).eq('id', categoryId);
    if (error) throw error;
    revalidatePath('/db'); revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// MASTER STATUS MANAGEMENT
// ============================================

export async function addMasterStatus(name: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (!name?.trim()) return { success: false, error: "Status name cannot be empty." };
    const { data, error } = await supabaseAdmin.from('master_status').insert({ name: name.trim() }).select().single();
    if (error) {
      if (error.code === '23505') return { success: false, error: `Status "${name}" already exists.` };
      throw error;
    }
    revalidatePath('/db'); revalidatePath('/dashboard');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteMasterStatus(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from('master_status').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    revalidatePath('/db'); revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// MASTER MODULE MANAGEMENT
// ============================================

export async function addMasterModule(name: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (!name?.trim()) return { success: false, error: "Module name cannot be empty." };
    const { data, error } = await supabaseAdmin.from('master_module').insert({ nama_module: name.trim() }).select('id_module, nama_module').single();
    if (error) {
      if (error.code === '23505') return { success: false, error: `Module "${name}" already exists.` };
      throw error;
    }
    revalidatePath('/db'); revalidatePath('/dashboard');
    return { success: true, data: { id: data.id_module, name: data.nama_module } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteMasterModule(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from('master_module').update({ deleted_at: new Date().toISOString() }).eq('id_module', id);
    if (error) throw error;
    revalidatePath('/db'); revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// MASTER DETAIL MODULE MANAGEMENT
// ============================================

export async function addMasterDetailModule(name: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (!name?.trim()) return { success: false, error: "Detail module name cannot be empty." };
    const { data, error } = await supabaseAdmin.from('master_detail_module').insert({ detail_module: name.trim() }).select('id_module, detail_module').single();
    if (error) {
      if (error.code === '23505') return { success: false, error: `Detail module "${name}" already exists.` };
      throw error;
    }
    revalidatePath('/db'); revalidatePath('/dashboard');
    return { success: true, data: { id: data.id_module, name: data.detail_module } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteMasterDetailModule(id: number): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from('master_detail_module').update({ deleted_at: new Date().toISOString() }).eq('id_module', id);
    if (error) throw error;
    revalidatePath('/db'); revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// GET ALL MASTER DATA
// ============================================

export async function getMasterData(): Promise<{
  success: boolean;
  data?: {
    statuses:      { id: number; name: string }[];
    categories:    { id: number; name: string }[];
    modules:       { id: number; name: string }[];
    detailModules: { id: number; name: string }[];
  };
  error?: string;
}> {
  try {
    const [statusRes, categoryRes, moduleRes, detailModuleRes] = await Promise.all([
      supabaseAdmin.from('master_status').select('id, name').is('deleted_at', null).order('name'),
      supabaseAdmin.from('ticket_categories').select('id, name').is('deleted_at', null).order('name'),
      supabaseAdmin.from('master_module').select('id_module, nama_module').is('deleted_at', null).order('nama_module'),
      supabaseAdmin.from('master_detail_module').select('id_module, detail_module').is('deleted_at', null).order('detail_module'),
    ]);
    return {
      success: true,
      data: {
        statuses:      statusRes.data || [],
        categories:    categoryRes.data || [],
        modules:       (moduleRes.data || []).map((r: any) => ({ id: r.id_module, name: r.nama_module })),
        detailModules: (detailModuleRes.data || []).map((r: any) => ({ id: r.id_module, name: r.detail_module })),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// DUMMY FUNCTIONS
// ============================================

export async function importToSheet(data: any, url: string): Promise<any> { return { success: false, error: "Not implemented." }; }
export async function updateSheetStatus(data: any, url: string): Promise<any> { return { success: false, error: "Not implemented." }; }
export async function getUpdatePreview(data: any, url: string): Promise<any> { return { success: false, error: "Not implemented." }; }
export async function undoLastAction(data: any, url: string): Promise<any> { return { success: false, error: "Not implemented." }; }
export async function fetchL3ReportData(url: string): Promise<any> { return { success: false, error: "Not implemented." }; }
export async function mergeFilesOnServer(fileA: any, fileB: any, editMode: any): Promise<any> { return { success: false, error: "Not implemented." }; }

// ============================================
// GET SPREADSHEET TITLE
// ============================================

export async function getSpreadsheetTitle(url: string) {
  if (!url?.includes('docs.google.com/spreadsheets')) return { error: 'Invalid Google Sheet URL' };

  const sheetId = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (!sheetId) return { error: 'Tidak dapat mengekstrak Sheet ID dari URL.' };

  const apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title&key=${apiKey}`, { cache: 'no-store' });
      if (res.status === 403) return { error: 'Sheet tidak dapat diakses. Pastikan sheet bersifat publik.' };
      if (res.status === 404) return { error: 'Sheet tidak ditemukan.' };
      if (!res.ok) return { error: `Google API error (HTTP ${res.status}).` };
      const data = await res.json();
      const title = data?.properties?.title;
      if (title) return { success: true, title };
    } catch (e: any) { console.error('getSpreadsheetTitle (API Key) error:', e); }
  }

  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.status === 401 || res.status === 403) return { error: 'Sheet tidak dapat diakses.' };
    if (!res.ok) return { error: `Gagal mengakses sheet (HTTP ${res.status}).` };
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const rawTitle = titleMatch[1].replace(/ - Google Sheets$/, '').replace(/ - Google Spreadsheet$/, '').trim();
      if (rawTitle && rawTitle.toLowerCase() !== 'google sheets') return { success: true, title: rawTitle };
    }
    return { error: 'Tidak dapat membaca judul sheet.' };
  } catch (e: any) {
    return { error: `Gagal validasi: ${e.message}` };
  }
}

// ============================================
// SYNC GSHEET → DB
// ============================================

const _SYNC_COLUMN_MAP: Record<string, string> = {
  "no ticket": "ticket_number", "ticket number": "ticket_number",
  "ticket_number": "ticket_number", "no. ticket": "ticket_number",
  "tiket": "ticket_number", "no tiket": "ticket_number",
  "tanggal": "date", "date": "date",
  "bulan": "month", "month": "month",
  "client": "client_name", "client name": "client_name",
  "nama client": "client_name", "client_name": "client_name",
  "pic client": "pic_client", "pic": "pic_client", "pic_client": "pic_client",
  "customer name": "pic_client", "customer_name": "pic_client",
  "status": "status_case", "status case": "status_case", "status_case": "status_case",
  "kategori": "category_case", "category": "category_case",
  "category case": "category_case", "category_case": "category_case",
  "ticket category": "category_case", "ticket_category": "category_case",
  "modul": "module_case", "module": "module_case",
  "module case": "module_case", "module_case": "module_case",
  "detail modul": "detail_module", "detail module": "detail_module",
  "detail_module": "detail_module",
  "check in": "check_in", "check_in": "check_in", "masuk": "check_in",
  "created at": "check_in", "created_at": "check_in",
  "detail case": "detail_case", "detail_case": "detail_case",
  "judul": "detail_case", "title": "detail_case",
  "check out": "check_out", "check_out": "check_out", "selesai": "check_out",
  "resolved at": "check_out", "resolved_at": "check_out",
  "status solved": "status_case_solved", "status_case_solved": "status_case_solved",
  "link op": "source_link_op", "source link op": "source_link_op",
  "source_link_op": "source_link_op", "link": "source_link_op",
  "ticket op": "source_link_op", "ticket_op": "source_link_op",
  "catatan": "note", "note": "note", "notes": "note",
};

const _TICKET_REGEX = /^(IHO-\d+)\s*(.*)/i;

function _extractTicketFromDetail(raw: string | null): { ticketNumber: string | null; detailCase: string | null } {
  if (!raw?.trim()) return { ticketNumber: null, detailCase: null };
  const match = raw.trim().match(_TICKET_REGEX);
  if (match) return { ticketNumber: match[1].toUpperCase(), detailCase: match[2].trim() || null };
  return { ticketNumber: null, detailCase: raw.trim() };
}

function _extractSheetId(url: string): string | null { return url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null; }
function _extractGid(url: string): string | null { return url.match(/[?&#]gid=(\d+)/)?.[1] ?? null; }

function _parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let inQuotes = false, field = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) { row.push(field.trim()); field = ''; }
      else { field += ch; }
    }
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

function _normalizeSyncDate(raw: string): string | null {
  if (!raw?.trim()) return null;
  raw = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parts = raw.split('/');
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (c > 1900) return `${c}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function _normalizeSyncDatetime(rawTime: string | null, dateStr: string | null): string | null {
  if (!rawTime?.trim()) return null;
  const t = rawTime.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) { const d = new Date(t); return isNaN(d.getTime()) ? null : d.toISOString(); }
  if (t.includes('/')) {
    const parts = t.split('/');
    if (parts.length === 3) {
      const [a, b, c] = parts.map(Number);
      if (c > 1900) { const d = new Date(`${c}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`); return isNaN(d.getTime()) ? null : d.toISOString(); }
    }
  }
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t) && dateStr) {
    const combined = new Date(`${dateStr}T${t.length === 4 ? '0'+t : t}:00`);
    return isNaN(combined.getTime()) ? null : combined.toISOString();
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function syncGSheetToDB(sheetUrl: string): Promise<{
  success: boolean;
  inserted?: number;
  updated?: number;
  skipped?: number;
  error?: string;
}> {
  try {
    if (!sheetUrl?.includes('docs.google.com/spreadsheets')) return { success: false, error: 'URL GSheet tidak valid.' };

    const sheetId = _extractSheetId(sheetUrl);
    if (!sheetId) return { success: false, error: 'Tidak dapat mengekstrak Sheet ID dari URL.' };

    const gid    = _extractGid(sheetUrl);
    const csvUrl = gid
      ? `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`
      : `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

    console.log('🔄 [SYNC] Fetching CSV from:', csvUrl);
    const response = await fetch(csvUrl, { cache: 'no-store' });
    if (!response.ok) return { success: false, error: `Gagal fetch GSheet (HTTP ${response.status}). Pastikan sheet bersifat publik.` };

    const rows = _parseCsv(await response.text());
    if (rows.length < 2) return { success: true, inserted: 0, skipped: 0 };

    const rawHeaders = rows[0];
    const headers: (string | null)[] = rawHeaders.map(h => _SYNC_COLUMN_MAP[h.toLowerCase().trim()] ?? null);

    const detailCaseColIdx = headers.indexOf('detail_case');
    const ticketColIdx     = headers.indexOf('ticket_number');

    if (detailCaseColIdx === -1 && ticketColIdx === -1) {
      return { success: false, error: `Kolom "Detail Case" tidak ditemukan. Header: [${rawHeaders.join(', ')}]` };
    }

    const toProcess: { ticket: string; record: Record<string, any> }[] = [];

    for (const row of rows.slice(1)) {
      const detailCaseRaw  = detailCaseColIdx !== -1 ? (row[detailCaseColIdx] || '').trim() || null : null;
      const { ticketNumber: ihoTicket, detailCase: cleanDetailCase } = _extractTicketFromDetail(detailCaseRaw);
      const explicitTicket = ticketColIdx !== -1 ? (row[ticketColIdx] || '').trim() || null : null;
      const finalTicket    = ihoTicket ?? explicitTicket;
      if (!finalTicket) continue;

      const record: Record<string, any> = {};
      headers.forEach((col, i) => {
        if (!col || col === 'detail_case' || col === 'check_in' || col === 'check_out') return;
        let val: string | null = (row[i] || '').trim() || null;
        if (col === 'date'        && val) val = _normalizeSyncDate(val);
        if (col === 'client_name' && val) val = normalizeClientName(val);
        record[col] = val;
      });
      const dateStr = record['date'] as string | null;
      headers.forEach((col, i) => {
        if (col !== 'check_in' && col !== 'check_out') return;
        record[col] = _normalizeSyncDatetime((row[i] || '').trim() || null, dateStr);
      });
      record['ticket_number'] = finalTicket;
      record['detail_case']   = cleanDetailCase;
      toProcess.push({ ticket: finalTicket, record });
    }

    if (!toProcess.length) return { success: true, inserted: 0, skipped: 0 };

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('all_cases')
      .select('ticket_number, status_case, check_in, check_out')
      .in('ticket_number', toProcess.map(r => r.ticket));

    if (fetchErr) return { success: false, error: `DB error: ${fetchErr.message}` };

    const existingMap = new Map<string, { status_case: string | null; check_in: string | null; check_out: string | null }>(
      (existing || []).map((r: any) => [r.ticket_number, { status_case: r.status_case, check_in: r.check_in, check_out: r.check_out }])
    );

    const toInsert = toProcess.filter(r => !existingMap.has(r.ticket)).map(r => r.record);
    const toUpdate = toProcess.filter(r => {
      const db = existingMap.get(r.ticket);
      if (!db) return false;
      return (r.record.status_case && (db.status_case || '').trim().toLowerCase() !== (r.record.status_case || '').trim().toLowerCase())
        || (!db.check_in  && !!r.record.check_in)
        || (!db.check_out && !!r.record.check_out);
    });

    let insertedCount = 0;
    const BATCH = 500;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const { error: insErr } = await supabaseAdmin
        .from('all_cases')
        .upsert(toInsert.slice(i, i + BATCH), {
          onConflict:       'ticket_number',
          ignoreDuplicates: true,
        });
      if (insErr) return { success: false, inserted: insertedCount, error: `Insert error: ${insErr.message}` };
      insertedCount += Math.min(BATCH, toInsert.length - i);
    }

    let updatedCount = 0;
    for (const item of toUpdate) {
      const db    = existingMap.get(item.ticket)!;
      const patch: Record<string, any> = {};
      if (item.record.status_case && (db.status_case || '').trim().toLowerCase() !== (item.record.status_case || '').trim().toLowerCase()) patch.status_case = item.record.status_case;
      if (!db.check_in  && item.record.check_in)  patch.check_in  = item.record.check_in;
      if (!db.check_out && item.record.check_out) patch.check_out = item.record.check_out;
      if (item.record.status_case_solved) patch.status_case_solved = item.record.status_case_solved;
      if (Object.keys(patch).length === 0) continue;
      const { error: updErr } = await supabaseAdmin.from('all_cases').update(patch).eq('ticket_number', item.ticket).is('deleted_at', null);
      if (!updErr) updatedCount++;
    }

    revalidatePath('/db');
    revalidatePath('/dashboard');

    return { success: true, inserted: insertedCount, updated: updatedCount, skipped: existingMap.size - updatedCount };

  } catch (err: any) {
    console.error('❌ [SYNC] Unexpected error:', err);
    return { success: false, error: err.message || 'Terjadi kesalahan tak terduga.' };
  }
}

// ============================================
// GLOBAL APP SETTINGS
// ============================================

export async function saveAppSetting(key: string, value: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAppSetting(key: string): Promise<{ success: boolean; value?: string | null; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.from('app_settings').select('value').eq('key', key).single();
    if (error && error.code !== 'PGRST116') throw error;
    return { success: true, value: data?.value ?? null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}