
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
            let dateObj: Date | null = null;
            // First, try parsing as ISO string (which new Date handles well)
            const isoDate = new Date(d.date);
            if (!isNaN(isoDate.getTime())) {
                dateObj = isoDate;
            } else {
                // Fallback to DD/MM/YYYY if ISO parsing fails
                try {
                    const parsed = parse(d.date, 'dd/MM/yyyy', new Date());
                    if (!isNaN(parsed.getTime())) {
                        dateObj = parsed;
                    }
                } catch(parseErr) {
                    // Ignore parse error
                }
            }

            if (dateObj && !isNaN(dateObj.getTime())) {
                years.add(dateObj.getFullYear().toString());
            }
        } catch(e) {
            // Ignore any other unexpected errors during date parsing
        }
      }
    });

    // DEBUG LOG
    console.log("✅ [DEBUG] Tahun yang ditemukan untuk filter:", Array.from(years));

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
