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
    const { data, error } = await supabaseAdmin
      .from('all_cases')
      .select(getSelectColumns())
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching all cases:', error);
      return { error: error.message };
    }

    // Map DB format to Frontend expected format
    const mappedData = mapDBArrayToFrontend(data as YourDBRow[]);

    return { data: mappedData, source: 'supabase' };
  } catch (error: any) {
    console.error('Unexpected error fetching all cases:', error);
    return { error: error.message || 'Failed to fetch cases data' };
  }
}

// ============================================
// REFRESH DASHBOARD (compatibility function)
// ============================================

export async function refreshDashboardViews() {
  // Since we don't have materialized views, just revalidate cache
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
    // Get all unique categories
    const { data: categories } = await supabaseAdmin
      .from('all_cases')
      .select('category_case')
      .not('category_case', 'is', null)
      .not('category_case', 'eq', '');

    // Get all unique clients
    const { data: clients } = await supabaseAdmin
      .from('all_cases')
      .select('client_name')
      .not('client_name', 'is', null)
      .not('client_name', 'eq', '');

    // Get all unique modules
    const { data: modules } = await supabaseAdmin
      .from('all_cases')
      .select('module_case')
      .not('module_case', 'is', null)
      .not('module_case', 'eq', '');

    // Get all unique years from dates
    const { data: dates } = await supabaseAdmin
      .from('all_cases')
      .select('date')
      .not('date', 'is', null);

    const uniqueCategories = [...new Set(categories?.map(c => c.category_case))];
    const uniqueClients = [...new Set(clients?.map(c => c.client_name))];
    const uniqueModules = [...new Set(modules?.map(m => m.module_case))];
    
    const years = new Set<string>();
    dates?.forEach(d => {
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
    // Build query with filters using your DB column names
    let query = supabaseAdmin
      .from('all_cases')
      .select(getSelectColumns());

    // Apply date range filter (highest priority)
    if (filters.dateRange?.from) {
      const fromDate = new Date(filters.dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      
      const toDate = filters.dateRange.to 
        ? new Date(filters.dateRange.to) 
        : new Date(filters.dateRange.from);
      toDate.setHours(23, 59, 59, 999);

      query = query
        .gte('date', fromDate.toISOString())
        .lte('date', toDate.toISOString());
    } 
    // Apply year filter as fallback
    else if (filters.selectedYear !== 'all') {
      const yearStart = `${filters.selectedYear}-01-01`;
      const yearEnd = `${filters.selectedYear}-12-31`;
      query = query.gte('date', yearStart).lte('date', yearEnd);
    }

    // Apply category filter (using your DB column name)
    if (filters.categoryFilter.length > 0) {
      query = query.in('category_case', filters.categoryFilter);
    }

    // Apply client filter
    if (filters.clientFilter.length > 0) {
      query = query.in('client_name', filters.clientFilter);
    }

    // Apply module filter (using your DB column name)
    if (filters.moduleFilter.length > 0) {
      query = query.in('module_case', filters.moduleFilter);
    }

    const { data: dbData, error } = await query;

    if (error) {
      console.error('Error fetching dashboard stats:', error);
      return { error: error.message };
    }

    if (!dbData || dbData.length === 0) {
      return {
        totalCases: 0,
        allClients: [],
        allModules: [],
        solvedVsUnsolved: [],
        monthlyData: [],
        totalClients: 0,
        categoryTrend: 'N/A',
        totalSolved: 0,
      };
    }

    // Map to frontend format
    const filteredData = mapDBArrayToFrontend(dbData as YourDBRow[]);

    // Aggregate client counts
    const clientFrequency: Record<string, number> = {};
    filteredData.forEach(row => {
      if (row.client_name) {
        clientFrequency[row.client_name] = (clientFrequency[row.client_name] || 0) + 1;
      }
    });
    const allClients = Object.entries(clientFrequency)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));

    // Aggregate module counts
    const moduleFrequency: Record<string, number> = {};
    filteredData.forEach(row => {
      if (row.detail_module) {
        moduleFrequency[row.detail_module] = (moduleFrequency[row.detail_module] || 0) + 1;
      }
    });
    const allModules = Object.entries(moduleFrequency)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));

    // Find trending category
    const categoryFrequency: Record<string, number> = {};
    filteredData.forEach(row => {
      if (row.ticket_category) {
        categoryFrequency[row.ticket_category] = (categoryFrequency[row.ticket_category] || 0) + 1;
      }
    });
    const sortedCategories = Object.entries(categoryFrequency).sort(([,a],[,b]) => b-a);
    const categoryTrend = sortedCategories.length > 0 ? sortedCategories[0][0] : 'N/A';

    // Count solved vs unsolved
    const totalSolved = filteredData.filter(row => 
      row.status?.toUpperCase() === 'SOLVED' || row.status?.toUpperCase() === 'RESOLVED'
    ).length;
    const unsolvedCount = filteredData.length - totalSolved;

    // Monthly aggregation
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyAggregation: Record<string, { "2024": number; "2025": number; "2026": number }> = {};
    months.forEach(month => {
      monthlyAggregation[month] = { "2024": 0, "2025": 0, "2026": 0 };
    });

    filteredData.forEach(row => {
      if (row.date) {
        const date = new Date(row.date);
        const year = date.getFullYear().toString();
        const monthIndex = date.getMonth();
        
        if (['2024', '2025', '2026'].includes(year) && monthIndex >= 0 && monthIndex < 12) {
          const monthName = months[monthIndex];
          monthlyAggregation[monthName][year as "2024" | "2025" | "2026"] += 1;
        }
      }
    });

    const monthlyData = months.map(month => ({
      month,
      ...monthlyAggregation[month]
    }));

    return {
      totalCases: filteredData.length,
      allClients,
      allModules,
      solvedVsUnsolved: [
        { name: 'Solved', value: totalSolved },
        { name: 'Unsolved', value: unsolvedCount }
      ],
      monthlyData,
      totalClients: Object.keys(clientFrequency).length,
      categoryTrend,
      totalSolved,
    };

  } catch (error: any) {
    console.error('Error calculating dashboard stats:', error);
    return { error: error.message || 'Failed to calculate stats' };
  }
};

export async function getDashboardStats(filters: DashboardFilters) {
  const getCacheKey = (f: typeof filters) => [
    'dashboard-stats',
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