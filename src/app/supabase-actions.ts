"use server";

import { createClient } from "@supabase/supabase-js";
import { DateRange } from "react-day-picker";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ================= TYPES ================= */

type DashboardFilter = {
  selectedYear: string;
  categoryFilter: string[];
  clientFilter: string[];
  moduleFilter: string[];
  dateRange?: DateRange;
};

export type DashboardStats = {
  totalCases: number;
  totalSolved: number;
  totalClients: number;
  categoryTrend: string;
  monthlyData: any[];
  allClients: { name: string; value: number }[];
  allModules: { name: string; value: number }[];
  solvedVsUnsolved: { name: string; value: number }[];
};

/* ================= HELPERS ================= */

function applyFilters(query: any, filter: DashboardFilter) {
  if (filter.selectedYear !== "all") {
    query = query.eq("year", filter.selectedYear);
  }

  if (filter.categoryFilter.length > 0) {
    query = query.in("ticket_category", filter.categoryFilter);
  }

  if (filter.clientFilter.length > 0) {
    query = query.in("client_name", filter.clientFilter);
  }

  if (filter.moduleFilter.length > 0) {
    query = query.in("module", filter.moduleFilter);
  }

  if (filter.dateRange?.from) {
    query = query.gte("date", filter.dateRange.from.toISOString());
  }

  if (filter.dateRange?.to) {
    query = query.lte("date", filter.dateRange.to.toISOString());
  }

  return query;
}

/* ================= DASHBOARD STATS ================= */

export async function getDashboardStats(filter: DashboardFilter) {
  try {
    /* ---------- BASE QUERY ---------- */
    let baseQuery = supabase.from("all_cases").select("*", { count: "exact" });
    baseQuery = applyFilters(baseQuery, filter);

    const { data, count, error } = await baseQuery;
    if (error) throw error;

    const totalCases = count || 0;

    /* ---------- SOLVED ---------- */
    const solvedCases = data.filter(
      (d) => d.status === "RESOLVED" || d.status_case_2 === "SOLVED"
    );

    /* ---------- CLIENT AGG ---------- */
    const clientMap: Record<string, number> = {};
    const moduleMap: Record<string, number> = {};
    const categoryMap: Record<string, number> = {};
    const monthMap: Record<string, any> = {};

    data.forEach((row) => {
      // Client
      if (row.client_name) {
        clientMap[row.client_name] = (clientMap[row.client_name] || 0) + 1;
      }

      // Module
      if (row.module) {
        moduleMap[row.module] = (moduleMap[row.module] || 0) + 1;
      }

      // Category
      if (row.ticket_category) {
        categoryMap[row.ticket_category] =
          (categoryMap[row.ticket_category] || 0) + 1;
      }

      // Monthly
      if (row.month && row.date) {
        const year = new Date(row.date).getFullYear();
        if (!monthMap[row.month]) {
          monthMap[row.month] = { month: row.month };
        }
        monthMap[row.month][year] =
          (monthMap[row.month][year] || 0) + 1;
      }
    });

    /* ---------- SORTED RESULT ---------- */
    const allClients = Object.entries(clientMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const allModules = Object.entries(moduleMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const categoryTrend =
      Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    const monthlyData = Object.values(monthMap);

    return {
      totalCases,
      totalSolved: solvedCases.length,
      totalClients: Object.keys(clientMap).length,
      categoryTrend,
      monthlyData,
      allClients,
      allModules,
      solvedVsUnsolved: [
        { name: "Solved", value: solvedCases.length },
        { name: "Unsolved", value: totalCases - solvedCases.length },
      ],
    } satisfies DashboardStats;
  } catch (err: any) {
    return { error: err.message };
  }
}
