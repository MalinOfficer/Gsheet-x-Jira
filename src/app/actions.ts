
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
        const d = date instanceof Date ? date : new Date(date);
        // Use local date parts to avoid timezone conversion issues from toISOString()
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error('Invalid date:', date);
        return null;
    }
};

// ============================================
// FETCH ALL CASES DATA (Not used by dashboard, for DB viewer)
// ============================================

export async function getAllCaseData(filters?: {
  year?: string;
  category?: string | string[];
  client?: string | string[];
  module?: string | string[];
  status?: string | string[];
  detailModule?: string | string[];
  dateRange?: { from?: Date; to?: Date };
}) {
  try {
    let query = supabaseAdmin
      .from("all_cases")
      .select(getSelectColumns(), { count: "exact" })
      .order("date", { ascending: false });

    // Apply year filter
    if (filters?.year && filters.year !== 'all') {
      const yearNum = parseInt(filters.year, 10);
      query = query
        .gte('date', `${yearNum}-01-01`)
        .lte('date', `${yearNum}-12-31`);
    }

    // Apply date range filter
    if (filters?.dateRange?.from) {
      query = query.gte('date', formatDate(filters.dateRange.from));
    }
    if (filters?.dateRange?.to) {
      query = query.lte('date', formatDate(filters.dateRange.to));
    }

    // Apply category filter
    if (filters?.category && Array.isArray(filters.category) && filters.category.length > 0) {
      query = query.in('category_case', filters.category);
    }

    // Apply client filter  
    if (filters?.client && Array.isArray(filters.client) && filters.client.length > 0) {
      query = query.in('client_name', filters.client);
    }

    // Apply module filter
    if (filters?.module && Array.isArray(filters.module) && filters.module.length > 0) {
      query = query.in('module_case', filters.module);
    }

    // Apply status filter
    if (filters?.status && Array.isArray(filters.status) && filters.status.length > 0) {
        query = query.in('status_case', filters.status);
    }

    // Apply detail module filter
    if (filters?.detailModule && Array.isArray(filters.detailModule) && filters.detailModule.length > 0) {
        query = query.in('detail_module', filters.detailModule);
    }

    const { data, error, count } = await query;

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
        modules: uniqueModules.map((m) => ({ label: m, value: m })),
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
