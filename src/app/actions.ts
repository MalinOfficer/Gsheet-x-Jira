
"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { unstable_cache, revalidateTag } from "next/cache";
import {
  mapDBArrayToFrontend,
  getSelectColumns,
  type YourDBRow,
} from "@/lib/db-mapper";

// ============================================
// FETCH ALL CASES DATA (Not used by dashboard, for DB viewer)
// ============================================

export async function getAllCaseData() {
  try {
    const { data, error, count } = await supabaseAdmin
      .from("all_cases")
      .select(getSelectColumns(), { count: "exact" })
      .order("date", { ascending: false });

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
    console.log('🔍 Fetching filter options from database...');
    
    const { data, error } = await supabaseAdmin
      .from("all_cases")
      .select("category_case, client_name, module_case, date")
      .order("date", { ascending: false });

    if (error) throw error;

    console.log('📊 Total rows fetched:', data.length);

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
      if (!d.date) return;
      
      try {
        // Karena kolom date bertipe DATE di PostgreSQL,
        // Supabase akan mengembalikannya sebagai string ISO format: 'YYYY-MM-DD'
        const dateStr = String(d.date).trim();
        
        // Langsung parse sebagai ISO date (format: YYYY-MM-DD)
        const dateObj = new Date(dateStr);
        
        if (!isNaN(dateObj.getTime())) {
          const year = dateObj.getFullYear();
          if (year >= 1900 && year <= 2100) {
            years.add(year.toString());
          }
        }
      } catch (e) {
        // Silent fail untuk data yang invalid
        console.warn(`Could not parse date: ${d.date}`);
      }
    });

    const sortedYears = Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
    
    console.log('📅 Years found:', sortedYears);

    return {
      success: true,
      data: {
        categories: uniqueCategories.map((c) => ({ label: c, value: c })),
        clients: uniqueClients.map((c) => ({ label: c, value: c })),
        modules: uniqueModules.map((m) => ({ label: m, value: m })),
        years: sortedYears,
      },
    };
  } catch (error: any) {
    console.error("❌ Error fetching filter options:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch filter options",
    };
  }
};

export async function getDashboardFilterOptions() {
  // Caching has been removed to ensure fresh data is always fetched.
  return _getDashboardFilterOptions();
}

// Dummy function implementations
export async function getSpreadsheetTitle(url: string) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    if (!url || !url.includes('docs.google.com/spreadsheets')) {
        return { error: 'Invalid Google Sheet URL' };
    }
    // Simulate finding a title
    const dummyId = url.split('/d/')[1]?.split('/')[0];
    return { success: true, title: `Dummy Sheet (${dummyId.slice(0, 6)})` };
}

export async function getProjectFileContents(): Promise<{ success: boolean; data?: { path: string; content: string; name: string }[]; error?: string }> {
    return { success: false, error: "This function is not implemented in the live demo." };
}

export async function importToSheet(data: any, url: string): Promise<any> {
    return { success: false, error: "This function is not implemented in the live demo." };
}

export async function updateSheetStatus(data: any, url: string): Promise<any> {
    return { success: false, error: "This function is not implemented in the live demo." };
}

export async function getUpdatePreview(data: any, url: string): Promise<any> {
    return { success: false, error: "This function is not implemented in the live demo." };
}

export async function undoLastAction(data: any, url: string): Promise<any> {
     return { success: false, error: "This function is not implemented in the live demo." };
}

export async function fetchL3ReportData(url: string): Promise<any> {
    return { success: false, error: "This function is not implemented in the live demo." };
}

export async function mergeFilesOnServer(fileA: any, fileB: any, editMode: any): Promise<any> {
    return { success: false, error: "This function is not implemented in the live demo." };
}
