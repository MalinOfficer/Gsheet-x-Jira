
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
// FETCH ALL CASES DATA (Not used by dashboard, for DB viewer)
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
    // This now fetches from the base table to ensure all possible options are available
    const { data, error } = await supabaseAdmin
      .from("all_cases")
      .select("category_case, client_name, module_case, date")
      .order("date", { ascending: false }); // Sort by date to get recent years first

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
      if (d.date) {
        try {
            const dateObj = new Date(d.date);
            if(!isNaN(dateObj.getTime())) {
                years.add(dateObj.getFullYear().toString());
            }
        } catch(e) {
            // Ignore invalid date formats
        }
      }
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
  // We still cache the filter options, but revalidate them with the main data tag
  const cachedOptions = unstable_cache(
    async () => _getDashboardFilterOptions(),
    ["dashboard-filter-options"],
    {
      tags: ["all-case-data"],
      revalidate: 3600, // Revalidate every hour
    }
  );

  return cachedOptions();
}


// ============================================
// GET DASHBOARD STATS (LOGIC SWITCH BASED ON FILTERS)
// ============================================

interface DashboardFilters {
  selectedYear: string;
  categoryFilter: string[];
  clientFilter: string[];
  moduleFilter: string[];
  dateRange?: DateRange;
}

const areFiltersActive = (filters: DashboardFilters) => {
    return filters.selectedYear !== 'all' ||
           (filters.categoryFilter && filters.categoryFilter.length > 0) ||
           (filters.clientFilter && filters.clientFilter.length > 0) ||
           (filters.moduleFilter && filters.moduleFilter.length > 0) ||
           filters.dateRange !== undefined;
};

// --- PATH 1: Fast path using DB views when no filters are active ---
const calculateStatsFromViews = async () => {
    const [summaryRes, monthlyRes, clientsRes, modulesRes] = await Promise.all([
      supabaseAdmin.from('dashboard_summary').select('*').single(),
      supabaseAdmin.from('dashboard_stats_monthly').select('*'),
      supabaseAdmin.from('dashboard_clients_rank').select('name, value'),
      supabaseAdmin.from('dashboard_modules_rank').select('detail_module, total_cases'),
    ]);

    if (monthlyRes.error) throw new Error(`Database error in dashboard_stats_monthly: ${monthlyRes.error.message}`);
    if (clientsRes.error) throw new Error(`Database error in dashboard_clients_rank: ${clientsRes.error.message}`);
    if (modulesRes.error) throw new Error(`Database error in dashboard_modules_rank: ${modulesRes.error.message}`);

    const summaryData = summaryRes.data;
    
    const monthlyDataFromDB = monthlyRes.data || [];
    monthlyDataFromDB.sort((a, b) => (a.month_order || 0) - (b.month_order || 0));

    const yearLabels = monthlyDataFromDB[0]?.year_labels;
    const monthlyData = monthlyDataFromDB.map(row => {
        const monthData: { [key: string]: any } = { month: row.month_label || 'Unknown' };
        if (yearLabels && typeof yearLabels === 'object') {
            for (const genericYearKey in yearLabels) {
                if (Object.prototype.hasOwnProperty.call(row, genericYearKey)) {
                    const actualYearLabel = yearLabels[genericYearKey];
                    monthData[actualYearLabel] = row[genericYearKey];
                }
            }
        }
        return monthData;
    });

    return {
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
      };
};

// --- PATH 2: Slower path with direct query when filters ARE active ---
const calculateStatsWithFilters = async (filters: DashboardFilters) => {
    let query = supabaseAdmin.from("all_cases").select(getSelectColumns(), { count: "exact" });

    // Apply filters
    if (filters.dateRange?.from) {
        query = query.gte("date", filters.dateRange.from.toISOString());
        if (filters.dateRange.to) {
            query = query.lte("date", filters.dateRange.to.toISOString());
        }
    } else if (filters.selectedYear && filters.selectedYear !== 'all') {
        const year = parseInt(filters.selectedYear, 10);
        if (!isNaN(year)) {
            query = query.gte('date', `${year}-01-01T00:00:00.000Z`);
            query = query.lte('date', `${year}-12-31T23:59:59.999Z`);
        }
    }
    if (filters.categoryFilter.length > 0) {
        query = query.in("category_case", filters.categoryFilter);
    }
    if (filters.clientFilter.length > 0) {
        query = query.in("client_name", filters.clientFilter);
    }
    if (filters.moduleFilter.length > 0) {
        query = query.in("module_case", filters.moduleFilter);
    }

    const { data, count, error } = await query;
    if (error) throw error;
    
    const mappedData = mapDBArrayToFrontend(data as YourDBRow[]);

    // Aggregations
    const totalCases = count || 0;
    const solvedCases = mappedData.filter(d => d.status === "RESOLVED" || d.status_case_2 === "SOLVED");

    const clientMap: Record<string, number> = {};
    const moduleMap: Record<string, number> = {};
    const categoryMap: Record<string, number> = {};
    const monthMap: Record<string, any> = {};
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    mappedData.forEach((row) => {
        if (row.client_name) clientMap[row.client_name] = (clientMap[row.client_name] || 0) + 1;
        if (row.detail_module) moduleMap[row.detail_module] = (moduleMap[row.detail_module] || 0) + 1;
        if (row.ticket_category) categoryMap[row.ticket_category] = (categoryMap[row.ticket_category] || 0) + 1;
        
        if (row.date) {
            const dateObj = new Date(row.date);
            if (isNaN(dateObj.getTime())) return;

            const year = dateObj.getFullYear().toString();
            const monthName = monthOrder[dateObj.getMonth()];
            if (monthName) {
                 if (!monthMap[monthName]) monthMap[monthName] = { month: monthName };
                 monthMap[monthName][year] = (monthMap[monthName][year] || 0) + 1;
            }
        }
    });

    const allYearsInFilteredData = new Set<string>();
    Object.values(monthMap).forEach(monthData => {
        Object.keys(monthData).forEach(key => {
            if (key !== 'month') {
                allYearsInFilteredData.add(key);
            }
        });
    });

    const monthlyData = monthOrder.map(monthName => {
        const monthData = monthMap[monthName] || { month: monthName };
        allYearsInFilteredData.forEach(year => {
            if (!monthData[year]) {
                monthData[year] = 0;
            }
        });
        return monthData;
    });
    
    const allClients = Object.entries(clientMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const allModules = Object.entries(moduleMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const categoryTrend = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    return {
        totalCases,
        totalSolved: solvedCases.length,
        totalClients: Object.keys(clientMap).length,
        categoryTrend,
        monthlyData,
        allClients,
        allModules,
        solvedVsUnsolved: [
          { name: 'Solved', value: solvedCases.length },
          { name: 'Unsolved', value: totalCases - solvedCases.length },
        ],
    };
};

const _calculateDashboardStats = async (filters: DashboardFilters) => {
  try {
    const useViews = !areFiltersActive(filters);
    const data = useViews
      ? await calculateStatsFromViews()
      : await calculateStatsWithFilters(filters);
    
    return { success: true, data };
  } catch (error: any) {
    console.error('Error calculating dashboard stats:', error);
    return { success: false, error: error.message };
  }
};


export async function getDashboardStats(filters: DashboardFilters) {
  const cachedStats = unstable_cache(
    async () => _calculateDashboardStats(filters),
    ["dashboard-stats", JSON.stringify(filters)], // Dynamic cache key
    {
      tags: ["all-case-data"],
      revalidate: 3600, // Cache for an hour
    }
  );

  const result = await cachedStats();
  if (result.success && result.data) {
    return result.data;
  }
  return { error: result.error || 'Failed to get dashboard stats.' };
}
