"use server";

import { supabaseAdmin } from '@/lib/supabase';
import { unstable_cache, revalidateTag } from 'next/cache';
import { 
  mapDBToFrontend, 
  mapDBArrayToFrontend, 
  getSelectColumns, 
  getDBColumn,
  type YourDBRow,
  type FrontendExpectedRow 
} from '@/lib/db-mapper';

// ============================================
// FETCH ALL CASES DATA
// ============================================

export async function getAllCaseData() {
  try {
    const { data, error, count } = await supabaseAdmin
      .from('all_cases')
      .select(getSelectColumns(), { count: 'exact' })
      .order('date', { ascending: false })
      .range(0, 9999); // Fetch up to 10000 rows, adjust if needed


    if (error) {
      console.error('Error fetching all cases:', error);
      return { error: error.message };
    }

    // Map DB format to Frontend expected format
    const mappedData = mapDBArrayToFrontend(data as YourDBRow[]);

    return { data: mappedData, source: 'supabase', count: count };
  } catch (error: any) {
    console.error('Unexpected error fetching all cases:', error);
    return { error: error.message || 'Failed to fetch cases data' };
  }
}

// ============================================
// REFRESH DASHBOARD (compatibility function)
// ============================================

export async function refreshDashboardViews() {
  // This function is intended to refresh materialized views if they exist.
  // For now, it just revalidates the cache.
  // If you create an RPC function in Supabase (e.g., `refresh_dashboard_views`), you can call it here.
  // Example: await supabaseAdmin.rpc('refresh_dashboard_views');
  
  revalidateTag('all-case-data');
  return { success: true, message: 'Cache refreshed successfully' };
}

export async function syncDashboardCache() {
  revalidateTag('all-case-data');
  return { success: true, message: 'Cache synchronized.' };
}

// ============================================
// GET DASHBOARD FILTER OPTIONS
// ============================================

const _getDashboardFilterOptions = async () => {
  try {
    // Fetch all rows to ensure complete filter options
    const { data, error } = await supabaseAdmin
        .from('all_cases')
        .select('category_case, client_name, module_case, date')
        .range(0, 20000); // Adjust range if you have more than 20000 cases

    if (error) {
        throw error;
    }

    const uniqueCategories = [...new Set(data.map(c => c.category_case).filter(Boolean))];
    const uniqueClients = [...new Set(data.map(c => c.client_name).filter(Boolean))];
    const uniqueModules = [...new Set(data.map(m => m.module_case).filter(Boolean))];
    
    const years = new Set<string>();
    data.forEach(d => {
        if (d.date) {
            const year = new Date(d.date).getFullYear().toString();
            years.add(year);
        }
    });

    return {
        success: true,
        data: {
            categories: uniqueCategories.map(c => ({ label: c, value: c })),
            clients: uniqueClients.map(c => ({ label: c, value: c })),
            modules: uniqueModules.map(m => ({ label: m, value: m })),
            years: Array.from(years).sort((a, b) => parseInt(b) - parseInt(a))
        }
    };
  } catch (error: any) {
    console.error('Error fetching filter options:', error);
    return { success: false, error: error.message || 'Failed to fetch filter options' };
  }
};

export async function getDashboardFilterOptions() {
  const cachedOptions = unstable_cache(
    async () => _getDashboardFilterOptions(),
    ['dashboard-filter-options'],
    {
      tags: ['all-case-data'],
      revalidate: 3600 // Cache for 1 hour
    }
  );
  
  return cachedOptions();
}

// ============================================
// GET DASHBOARD STATS WITH FILTERS
// ============================================

interface DashboardFilters {
  selectedYear: string;
  categoryFilter: string[];
  clientFilter: string[];
  moduleFilter: string[];
  dateRange?: { from?: Date; to?: Date };
}

const _calculateDashboardStats = async (filters: DashboardFilters) => {
  try {
    // Parallel fetch from all dashboard views. This is much faster.
    const [summaryRes, monthlyRes, clientsRes, modulesRes] = await Promise.all([
      supabaseAdmin.from('dashboard_summary').select('*').single(),
      supabaseAdmin.from('dashboard_stats_monthly').select('*'),
      supabaseAdmin.from('dashboard_clients_rank').select('name, value'),
      supabaseAdmin.from('dashboard_modules_rank').select('module, value'),
    ]);

    // Error handling for each request
    if (summaryRes.error) throw new Error(`Database error in dashboard_summary: ${summaryRes.error.message}`);
    if (monthlyRes.error) throw new Error(`Database error in dashboard_stats_monthly: ${monthlyRes.error.message}`);
    if (clientsRes.error) throw new Error(`Database error in dashboard_clients_rank: ${clientsRes.error.message}`);
    if (modulesRes.error) throw new Error(`Database error in dashboard_modules_rank: ${modulesRes.error.message}`);

    const summaryData = summaryRes.data;
    const monthlyData = monthlyRes.data || [];
    const clientsData = clientsRes.data || [];
    const modulesData = modulesRes.data || [];

    // Map modules data to expected format for the chart
    const allModules = modulesData.map(item => ({
      name: item.module,
      value: item.value
    }));
    
    // Consolidate data for the frontend
    return {
      totalCases: summaryData?.total_cases ?? 0,
      totalClients: summaryData?.total_clients ?? 0,
      totalSolved: summaryData?.total_solved ?? 0,
      categoryTrend: summaryData?.trending_category ?? 'N/A',
      solvedVsUnsolved: [
        { name: 'Solved', value: summaryData?.total_solved ?? 0 },
        { name: 'Unsolved', value: (summaryData?.total_cases ?? 0) - (summaryData?.total_solved ?? 0) }
      ],
      monthlyData,
      allClients: clientsData,
      allModules,
    };

  } catch (error: any) {
    console.error('Error calculating dashboard stats:', error);
    return { error: error.message || 'Failed to calculate stats' };
  }
};

export async function getDashboardStats(filters: DashboardFilters) {
  const getCacheKey = (f: typeof filters) => [
    'dashboard-stats-v3', // Incremented cache key
    f.selectedYear,
    ...(f.categoryFilter || []).sort().join(','),
    ...(f.clientFilter || []).sort().join(','),
    ...(f.moduleFilter || []).sort().join(','),
    f.dateRange?.from?.toISOString() || 'null',
    f.dateRange?.to?.toISOString() || 'null',
  ];

  const cachedStats = unstable_cache(
    async () => _calculateDashboardStats(filters),
    getCacheKey(filters),
    {
      tags: ['all-case-data'],
      revalidate: 300 // Cache for 5 minutes
    }
  );

  return cachedStats();
}

// ============================================
// FETCH L3 REPORT (if needed)
// ============================================

export async function fetchL3ReportData() {
  try {
    const { data: l3Cases, error } = await supabaseAdmin
      .from('all_cases')
      .select('date, client_name, module_case, detail_case, source_link_op, status_case')
      .eq('status_case', 'L3')
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching L3 report:', error);
      return { error: error.message };
    }

    if (!l3Cases || l3Cases.length === 0) {
      return { success: true, report: `*Update cases yang belum solved L3 on hold*\n\nTotal : 0` };
    }

    const today = new Date();
    const l3CasesWithDuration = l3Cases.map(row => {
      let duration = -1;
      if (row.date) {
        const caseDate = new Date(row.date);
        if (!isNaN(caseDate.getTime())) {
          const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const caseDateAtMidnight = new Date(caseDate.getFullYear(), caseDate.getMonth(), caseDate.getDate());
          const diffTime = Math.abs(todayAtMidnight.getTime() - caseDateAtMidnight.getTime());
          duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      }

      let category = 'Akademik';
      if (['Payment', 'Pintro Pay'].includes(row.module_case || '')) category = 'Payment';
      else if (row.module_case === 'Aplikasi/Mobile') category = 'Aplikasi/Mobile';
      else if (row.module_case === 'Akses Portal') category = 'Akses Portal';

      const fullTitle = [row.client_name, row.detail_case, row.source_link_op].filter(Boolean).join(' ');

      return { category, title: fullTitle, duration, date: row.date };
    });

    // Group by category
    const groupedCases: Record<string, typeof l3CasesWithDuration> = {};
    l3CasesWithDuration.forEach(caseItem => {
      if (!groupedCases[caseItem.category]) groupedCases[caseItem.category] = [];
      groupedCases[caseItem.category].push(caseItem);
    });

    // Format report
    const minDate = l3CasesWithDuration.reduce((min, item) => {
      if (!item.date) return min;
      const caseDate = new Date(item.date);
      return !min || caseDate < min ? caseDate : min;
    }, null as Date | null);

    const maxDate = l3CasesWithDuration.reduce((max, item) => {
      if (!item.date) return max;
      const caseDate = new Date(item.date);
      return !max || caseDate > max ? caseDate : max;
    }, null as Date | null);

    const formatDate = (date: Date | null) => {
      if (!date) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    let reportText = `*Update cases yang belum solved L3 on hold (${formatDate(minDate)} - ${formatDate(maxDate)})*\n\n`;
    reportText += `Total : ${l3CasesWithDuration.length}\n`;

    const categoryCounts = Object.entries(groupedCases).map(([category, cases]) => `${category} > L3 : ${cases.length}`).join('\n');
    reportText += `${categoryCounts}\n\n`;

    Object.entries(groupedCases).forEach(([category, cases]) => {
      reportText += `*${category.toUpperCase()} > L3*\n`;
      cases.forEach((caseItem, index) => {
        const durationText = caseItem.duration >= 0 ? `(${caseItem.duration} hari)` : '';
        reportText += `${index + 1}. ${caseItem.title} ${durationText}\n`;
      });
      reportText += '\n';
    });

    return { success: true, report: reportText.trim() };

  } catch (error: any) {
    console.error('Failed to fetch L3 report:', error);
    return { error: error.message || 'Failed to fetch L3 report' };
  }
}
