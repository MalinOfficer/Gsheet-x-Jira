
"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { unstable_cache, revalidateTag } from "next/cache";
import {
  mapDBArrayToFrontend,
  getSelectColumns,
  type YourDBRow,
} from "@/lib/db-mapper";
import { parse } from "date-fns";

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
    const { data, error } = await supabaseAdmin
      .from("all_cases")
      .select("category_case, client_name, module_case, date")
      .order("date", { ascending: false });

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
    const parseErrors: string[] = []; // untuk debugging
    
    data.forEach((d, index) => {
      if (!d.date) return;
      
      try {
        const dateStr = String(d.date).trim();
        let dateObj: Date | null = null;

        // Try multiple date formats
        const formats = [
          'dd/MM/yyyy',
          'yyyy-MM-dd',
          'MM/dd/yyyy',
          'd/M/yyyy',
        ];

        for (const format of formats) {
          try {
            const parsed = parse(dateStr, format, new Date());
            if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
              dateObj = parsed;
              break;
            }
          } catch {}
        }

        // Fallback to native Date parsing
        if (!dateObj) {
          const isoDate = new Date(dateStr);
          if (!isNaN(isoDate.getTime()) && isoDate.getFullYear() > 1900 && isoDate.getFullYear() < 2100) {
            dateObj = isoDate;
          }
        }

        if (dateObj && !isNaN(dateObj.getTime())) {
          const year = dateObj.getFullYear().toString();
          years.add(year);
        } else {
          parseErrors.push(`Row ${index}: Could not parse date "${dateStr}"`);
        }
      } catch (e: any) {
        parseErrors.push(`Row ${index}: Error parsing date "${d.date}" - ${e}`);
      }
    });

    // Log errors untuk debugging (hanya di development)
    if (process.env.NODE_ENV === 'development' && parseErrors.length > 0) {
      console.warn('Date parsing errors:', parseErrors.slice(0, 10)); // Show first 10 errors
    }

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
  // Caching has been removed to ensure fresh data is always fetched.
  return _getDashboardFilterOptions();
}

// REMOVED FOR DEMO
// export async function getSpreadsheetTitle(url: string) {
//     return { success: true, title: 'Dummy Sheet Title' };
// }
// export async function importToSheet(data: any, url: string) {
//     return { success: true, message: 'Dummy import successful', importedCount: 10, duplicateCount: 2, duplicates: ['T-123', 'T-456'], undoData: { operationType: 'IMPORT', importedIds: [1,2,3] } };
// }
// export async function updateSheetStatus(data: any, url: string) {
//     return { success: true, message: 'Dummy update successful', updatedRows: [{ title: 'Case A', newStatus: 'Solved', newTicketOp: 'John' }] };
// }
// export async function getUpdatePreview(data: any, url: string) {
//     return { success: true, changes: [{ title: 'Case A', oldStatus: 'L3', newStatus: 'Solved' }] };
// }
// export async function undoLastAction(data: any, url: string) {
//     return { success: true, message: 'Dummy undo successful' };
// }
// export async function fetchL3ReportData(url: string) {
//     return { success: true, report: 'Dummy L3 report data' };
// }
// export async function getProjectFileContents() {
//     return { success: true, data: [{ path: 'test.js', content: 'hello world', name: 'test.js' }] };
// }
// export async function mergeFilesOnServer(fileA: any, fileB: any, mode: any) {
//     return { success: true, mergedRows: [], unmatchedFileA: [], unmatchedFileB: [], summary: { total: 10, existing: 5, matched: 3, unmatched: 2} };
// }

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
