
"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { revalidateTag } from "next/cache";
import {
  mapDBArrayToFrontend,
  getSelectColumns,
  type YourDBRow,
} from "@/lib/db-mapper";

// ============================================
// HELPERS
// ============================================

const formatDate = (date: any) => {
    if (!date) return null;
    try {
        const d = new Date(date);
        // Heuristic to correct for timezone shifts.
        // If the date from the client is past noon in UTC, it's likely the next day in the user's timezone.
        // This happens for users in timezones ahead of UTC (e.g., Asia).
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

// ============================================
// FETCH ALL CASES DATA (Not used by dashboard, for DB viewer)
// ============================================

// File: actions.ts - Update getAllCaseData function
// File: app/actions.ts

export async function getAllCaseData(filters?: {
  year?: string;
  category?: string[];
  client?: string[];
  module?: string[];
  status?: string[];
  detailModule?: string[];
  dateRange?: { from?: Date; to?: Date };
  search?: string;           // 🔥 NEW: Global search
  page?: number;              // 🔥 NEW: Current page (1-based)
  pageSize?: number;          // 🔥 NEW: Rows per page
  sortBy?: string;            // 🔥 NEW: Sort column
  sortOrder?: 'asc' | 'desc'; // 🔥 NEW: Sort direction
}) {
  try {
    // Pagination params with safe defaults
    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.min(filters?.pageSize || 100, 500); // Max 500 rows
    const offset = (page - 1) * pageSize;

    console.log('📊 Pagination:', { page, pageSize, offset });

    // Build base query
    let query = supabaseAdmin
      .from("all_cases")
      .select(getSelectColumns(), { count: "exact" });

    // Apply sorting
    const sortBy = filters?.sortBy || 'date';
    const sortOrder = filters?.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply date range filter OR year filter, with date range taking precedence.
    if (filters?.dateRange?.from) {
      const fromDate = formatDate(filters.dateRange.from);
      const toDate = filters?.dateRange?.to
        ? formatDate(filters.dateRange.to)
        : formatDate(filters.dateRange.from);

      query = query.gte('date', fromDate).lte('date', toDate);
    } else if (filters?.year && filters.year !== 'all') {
      const yearNum = parseInt(filters.year, 10);
      query = query
        .gte('date', `${yearNum}-01-01`)
        .lte('date', `${yearNum}-12-31`);
    }

    // Apply multi-select filters
    if (filters?.category?.length) {
      query = query.in('category_case', filters.category);
    }

    if (filters?.client?.length) {
      query = query.in('client_name', filters.client);
    }

    if (filters?.module?.length) {
      query = query.in('module_case', filters.module);
    }

    if (filters?.status?.length) {
      query = query.in('status_case', filters.status);
    }

    if (filters?.detailModule?.length) {
      query = query.in('detail_module', filters.detailModule);
    }

    // 🔥 NEW: Global search (server-side)
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

    // 🔥 Apply pagination (CRITICAL!)
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("❌ Error fetching cases:", error);
      return { error: error.message };
    }

    console.log('✅ Fetched:', data?.length, 'rows out of', count, 'total');

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
    // Map frontend-friendly names back to actual DB column names
    const dbData = {
      date: data.date,
      month: data.month,
      client_name: data.client_name,
      pic_client: data.customer_name, // customer_name -> pic_client
      status_case: data.status, // status -> status_case
      category_case: data.ticket_category, // ticket_category -> category_case
      module_case: data.module, // module -> module_case
      detail_module: data.detail_module,
      check_in: data.created_at, // created_at -> check_in
      detail_case: data.title, // title -> detail_case
      check_out: data.resolved_at, // resolved_at -> check_out
      status_case_solved: data.status_case_2, // status_case_2 -> status_case_solved
      source_link_op: data.ticket_op, // ticket_op -> source_link_op
      note: data.note,
    };

    const { error } = await supabaseAdmin
      .from('all_cases')
      .update(dbData)
      .eq('id', caseId);

    if (error) {
      console.error(`Error updating case ${caseId}:`, error);
      throw error;
    }
    
    revalidateTag("all-case-data"); // Invalidate cache for dashboard
    return { success: true, id: caseId };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// REFRESH DASHBOARD
// ============================================

export async function refreshDashboardViews() {
  try {
    // This function calls the RPC in supabase to refresh the materialized views
    await supabaseAdmin.rpc('refresh_dashboard_views');

    // Revalidate the cache tag to force a refetch of stats and options
    revalidateTag("all-case-data");
    
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
  try {
    console.log('🔍 [FILTER OPTIONS] Starting fetch...');
    
    // Fetch data menggunakan Promise.all untuk parallel execution
    const [casesResult, yearsResult] = await Promise.all([
      supabaseAdmin
        .from("all_cases")
        .select("category_case, client_name, module_case"),
      supabaseAdmin.rpc('get_distinct_years')
    ]);

    console.log('📦 [RAW YEARS RESULT]:', yearsResult);
    
    if (casesResult.error) {
      console.error('❌ Error fetching cases:', casesResult.error);
      throw casesResult.error;
    }
    
    if (yearsResult.error) {
      console.error('⚠️ Error fetching years:', yearsResult.error);
      // Continue with empty years array instead of throwing
    }

    const casesData = casesResult.data || [];
    const yearsData = yearsResult.data || [];

    console.log('📊 Total cases fetched:', casesData.length);
    console.log('📅 Years data:', yearsData);

    // Extract unique values
    const uniqueCategories = [
      ...new Set(casesData.map((c) => c.category_case).filter(Boolean)),
    ];
    const uniqueClients = [
      ...new Set(casesData.map((c) => c.client_name).filter(Boolean)),
    ];
    const uniqueModules = [
      ...new Set(casesData.map((m) => m.module_case).filter(Boolean)),
    ];

    // Convert years dari database function
    // Function returns: [{ year: 2024 }, { year: 2025 }, etc.]
    const sortedYears = yearsData
      .map((item: any) => {
        console.log('🔄 Processing year item:', item);
        return String(item.year);
      })
      .filter((year: string) => {
        const isValid = year && year !== 'null' && year !== 'undefined' && year !== 'NaN';
        console.log(`🔍 Year "${year}" is valid?`, isValid);
        return isValid;
      });

    console.log('✅ Final years array:', sortedYears);

    const result = {
      success: true,
      data: {
        categories: uniqueCategories.map((c) => ({ label: c, value: c })),
        clients: uniqueClients.map((c) => ({ label: c, value: c })),
        modules: uniqueModules.map((m) => ({ label: m, value: c })),
        years: sortedYears,
      },
    };

    console.log('📤 [RETURNING RESULT]:', JSON.stringify(result, null, 2));

    return result;
  } catch (error: any) {
    console.error("❌ Error fetching filter options:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch filter options",
    };
  }
};

export async function getDashboardFilterOptions() {
  console.log('🚀 getDashboardFilterOptions called');
  const result = await _getDashboardFilterOptions();
  console.log('📤 getDashboardFilterOptions returning:', result);
  return result;
}

export async function getL3ReportFromDB() {
  try {
    const { data, error } = await supabaseAdmin
      .from('all_cases')
      .select('client_name, detail_case, check_in, module_case, source_link_op, status_case, ticket_number')
      .in('status_case', ['L3', 'ON HOLD'])
      .order('check_in', { ascending: true });

    if (error) {
      console.error("❌ Supabase error fetching L3/On Hold cases:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return { success: true, report: "Tidak ada kasus L3 atau On Hold yang ditemukan." };
    }

    const formatDate = (date: Date) => {
      if (!date || isNaN(date.getTime())) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const minDate = new Date(data[0].check_in!);
    const maxDate = new Date(data[data.length - 1].check_in!);
    const today = new Date();

    const header = `*Update cases yang belum solved L3 on hold (${formatDate(minDate)} - ${formatDate(maxDate)})*`;
    const totalCases = data.length;

    // --- New Grouping Logic ---
    const getGroupForModule = (moduleName: string | null | undefined): string => {
        const upperCaseModule = (moduleName || '').toUpperCase();
        if (upperCaseModule === 'PAYMENT' || upperCaseModule === 'PINTRO PAY') {
            return 'Payment';
        }
        if (upperCaseModule === 'APLIKASI/MOBILE' || upperCaseModule === 'AKSES PORTAL') {
            return 'Aplikasi/Mobile';
        }
        return 'Akademik';
    };

    const casesByGroup: Record<string, any[]> = {};
    data.forEach(c => {
      const groupName = getGroupForModule(c.module_case);
      if (!casesByGroup[groupName]) {
        casesByGroup[groupName] = [];
      }
      casesByGroup[groupName].push(c);
    });

    // --- Create summary of groups ---
    const summaryLines = [`Total : ${totalCases}`];
    
    // Custom sort order for groups
    const groupOrder = ['Akademik', 'Payment', 'Aplikasi/Mobile'];
    const sortedGroups = Object.keys(casesByGroup).sort((a, b) => {
        const indexA = groupOrder.indexOf(a);
        const indexB = groupOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b); // Fallback for unexpected groups
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    sortedGroups.forEach(groupName => {
        const cases = casesByGroup[groupName];
        summaryLines.push(`${groupName} > L3 : ${cases.length}`);
    });
    const summary = summaryLines.join('\n');

    // --- Create detailed list ---
    const detailLines: string[] = [];
    sortedGroups.forEach(groupName => {
      detailLines.push(`\n*${groupName.toUpperCase()} > L3*`);
      const cases = casesByGroup[groupName];

      cases.sort((a,b) => (a.client_name || '').localeCompare(b.client_name || '')).forEach((c, index) => {
        const checkInDate = new Date(c.check_in!);
        
        let age = 0;
        if (!isNaN(checkInDate.getTime())) {
            const ageDiff = Math.ceil((today.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
            age = Math.max(1, ageDiff); // Ensure age is at least 1 day
        }

        const caseLineParts = [
            c.client_name,
            c.ticket_number,
            c.detail_case,
            c.source_link_op,
        ].filter(Boolean); // Filter out any null/undefined/empty parts

        const caseLine = caseLineParts.join(' ').trim();
        
        detailLines.push(`${index + 1}. ${caseLine} (${age} hari)`.trim());
      });
    });
    const details = detailLines.join('\n');

    const reportText = `${header}\n\n${summary}\n${details}`;

    return { success: true, report: reportText.trim() };

  } catch (err: any) {
    console.error('❌ Error generating L3 report from DB:', err);
    return { success: false, error: err.message };
  }
}


// ============================================
// DUMMY FUNCTION IMPLEMENTATIONS
// ============================================

export async function getSpreadsheetTitle(url: string) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (!url || !url.includes('docs.google.com/spreadsheets')) {
    return { error: 'Invalid Google Sheet URL' };
  }
  
  // Simulate finding a title
  const dummyId = url.split('/d/')[1]?.split('/')[0];
  return { success: true, title: `Dummy Sheet (${dummyId?.slice(0, 6) || 'unknown'})` };
}

export async function getProjectFileContents(): Promise<{ 
  success: boolean; 
  data?: { path: string; content: string; name: string }[]; 
  error?: string 
}> {
  return { 
    success: false, 
    error: "This function is not implemented in the live demo." 
  };
}

export async function importToSheet(data: any, url: string): Promise<any> {
  return { 
    success: false, 
    error: "This function is not implemented in the live demo." 
  };
}

export async function updateSheetStatus(data: any, url: string): Promise<any> {
  return { 
    success: false, 
    error: "This function is not implemented in the live demo." 
  };
}

export async function getUpdatePreview(data: any, url: string): Promise<any> {
  return { 
    success: false, 
    error: "This function is not implemented in the live demo." 
  };
}

export async function undoLastAction(data: any, url: string): Promise<any> {
  return { 
    success: false, 
    error: "This function is not implemented in the live demo." 
  };
}

export async function fetchL3ReportData(url: string): Promise<any> {
  return { 
    success: false, 
    error: "This function is not implemented in the live demo." 
  };
}

export async function mergeFilesOnServer(
  fileA: any, 
  fileB: any, 
  editMode: any
): Promise<any> {
  return { 
    success: false, 
    error: "This function is not implemented in the live demo." 
  };
}

    

    