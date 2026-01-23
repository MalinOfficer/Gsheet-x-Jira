"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { unstable_cache, revalidateTag } from "next/cache";
import {
  mapDBArrayToFrontend,
  getSelectColumns,
  type YourDBRow,
} from "@/lib/db-mapper";
import { DateRange } from "react-day-picker";

// ============================================
// FETCH ALL CASES DATA
// ============================================

export async function getAllCaseData() {
  try {
    const { data, error, count } = await supabaseAdmin
      .from("all_cases")
      .select(getSelectColumns(), { count: "exact" })
      .order("date", { ascending: false })
      .range(0, 9999);

    if (error) {
      console.error("Error fetching all cases:", error);
      return { error: error.message };
    }

    const mappedData = mapDBArrayToFrontend(data as YourDBRow[]);
    return { data: mappedData, source: "supabase", count };
  } catch (error: any) {
    console.error("Unexpected error fetching all cases:", error);
    return { error: error.message || "Failed to fetch cases data" };
  }
}

// ============================================
// REFRESH DASHBOARD
// ============================================

export async function refreshDashboardViews() {
  // This function calls the RPC in supabase to refresh the materialized views
  await supabaseAdmin.rpc('refresh_dashboard_views');

  // Revalidate the cache tag to force a refetch of stats and options
  revalidateTag("all-case-data");
  return { success: true, message: "Views refreshed and cache revalidated." };
}

// ============================================
// GET DASHBOARD FILTER OPTIONS
// ============================================

const _getDashboardFilterOptions = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from("all_cases")
      .select("category_case, client_name, module_case, date")
      .range(0, 20000);

    if (error) throw error;

    const uniqueCategories = [
      ...new Set(data.map((c) => c.category_case).filter(Boolean)),
    ];
    const uniqueClients = [
      ...new Set(data.map((c) => c.client_name).filter(Boolean)),
    ];
    const uniqueModules = [
      ...new Set(data.map((m) => m.module_case).filter(Boolean)),
    ];

    const years = new Set<string>();
    data.forEach((d) => {
      if (d.date) years.add(new Date(d.date).getFullYear().toString());
    });

    return {
      success: true,
      data: {
        categories: uniqueCategories.map((c) => ({ label: c, value: c })),
        clients: uniqueClients.map((c) => ({ label: c, value: c })),
        modules: uniqueModules.map((m) => ({ label: m, value: m })),
        years: Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)),
      },
    };
  } catch (error: any) {
    console.error("Error fetching filter options:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch filter options",
    };
  }
};

export async function getDashboardFilterOptions() {
  const cachedOptions = unstable_cache(
    async () => _getDashboardFilterOptions(),
    ["dashboard-filter-options"],
    {
      tags: ["all-case-data"],
      revalidate: 3600,
    }
  );

  return cachedOptions();
}

// ============================================
// GET DASHBOARD STATS FROM VIEWS
// ============================================

interface DashboardFilters {
  selectedYear: string;
  categoryFilter: string[];
  clientFilter: string[];
  moduleFilter: string[];
  dateRange?: DateRange;
}

const _calculateDashboardStats = async (filters: DashboardFilters) => {
  try {
    const [summaryRes, monthlyRes, clientsRes, modulesRes] = await Promise.all([
      supabaseAdmin.from('dashboard_summary').select('*').single(),
      supabaseAdmin.from('dashboard_stats_monthly').select('*'),
      supabaseAdmin.from('dashboard_clients_rank').select('name, value'),
      supabaseAdmin.from('dashboard_modules_rank').select('detail_module, total_cases'),
    ]);

    if (summaryRes.error) throw new Error(`Database error in dashboard_summary: ${summaryRes.error.message}`);
    if (monthlyRes.error) throw new Error(`Database error in dashboard_stats_monthly: ${monthlyRes.error.message}`);
    if (clientsRes.error) throw new Error(`Database error in dashboard_clients_rank: ${clientsRes.error.message}`);
    if (modulesRes.error) throw new Error(`Database error in dashboard_modules_rank: ${modulesRes.error.message}`);

    const summaryData = summaryRes.data;
    
    const monthlyDataFromDB = monthlyRes.data || [];

    // Sort by month_order to ensure chronological order
    monthlyDataFromDB.sort((a, b) => (a.month_order || 0) - (b.month_order || 0));

    // Transform the data into the "wide" format expected by the chart
    const monthlyData = monthlyDataFromDB.map(row => ({
      month: row.month_label || 'Unknown',
      ...(row.values || {})
    }));

    return {
      success: true,
      data: {
        totalCases: summaryData?.total_cases ?? 0,
        totalSolved: summaryData?.total_solved ?? 0,
        totalClients: summaryData?.total_clients ?? 0,
        categoryTrend: summaryData?.trending_category ?? 'N/A',
        monthlyData: monthlyData,
        allClients: clientsRes.data || [],
        allModules: (modulesRes.data || []).map((m: { detail_module: string, total_cases: number }) => ({ name: m.detail_module, value: m.total_cases })),
        solvedVsUnsolved: [
          { name: 'Solved', value: summaryData?.total_solved ?? 0 },
          { name: 'Unsolved', value: (summaryData?.total_cases ?? 0) - (summaryData?.total_solved ?? 0) },
        ],
      },
    };
  } catch (error: any) {
    console.error('Error calculating dashboard stats from views:', error);
    return { success: false, error: error.message };
  }
};

export async function getDashboardStats(filters: DashboardFilters) {
  const cachedStats = unstable_cache(
    async () => _calculateDashboardStats(filters),
    ["dashboard-stats-from-views"],
    {
      tags: ["all-case-data"],
      revalidate: 3600,
    }
  );

  const result = await cachedStats();
  if (result.success && result.data) {
    return result.data;
  }
  return { error: result.error || 'Failed to get dashboard stats.' };
}
