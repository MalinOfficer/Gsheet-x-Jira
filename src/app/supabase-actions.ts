"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { DateRange } from "react-day-picker";

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
    const yearNum = parseInt(filter.selectedYear, 10);
    query = query
      .gte("date", `${yearNum}-01-01`)
      .lte("date", `${yearNum}-12-31`);
  }

  if (filter.categoryFilter.length > 0) {
    query = query.in("category_case", filter.categoryFilter);
  }

  if (filter.clientFilter.length > 0) {
    query = query.in("client_name", filter.clientFilter);
  }

  if (filter.moduleFilter.length > 0) {
    query = query.in("module_case", filter.moduleFilter);
  }

  if (filter.dateRange?.from) {
    const from = filter.dateRange.from.toISOString().split("T")[0];
    query = query.gte("date", from);
  }

  if (filter.dateRange?.to) {
    const to = filter.dateRange.to.toISOString().split("T")[0];
    query = query.lte("date", to);
  }

  return query;
}

/* ================= DASHBOARD STATS ================= */

export async function getDashboardStats(filter: DashboardFilter) {
  try {
    let baseQuery = supabaseAdmin
      .from("all_cases")
      .select(
        "client_name, status_case, category_case, module_case, month, date",
        { count: "exact" }
      )
      .is("deleted_at", null);

    baseQuery = applyFilters(baseQuery, filter);

    const { data, count, error } = await baseQuery;
    if (error) throw error;

    const rows = data || [];
    const totalCases = count || 0;

    /* ---------- SOLVED ---------- */
    const solvedCases = rows.filter(
      (d) =>
        (d.status_case || "").toLowerCase() === "solved" ||
        (d.status_case || "").toLowerCase() === "resolved"
    );

    /* ---------- AGGREGATIONS ---------- */
    const clientMap: Record<string, number> = {};
    const moduleMap: Record<string, number> = {};
    const categoryMap: Record<string, number> = {};
    const monthMap: Record<string, any> = {};

    const monthOrder = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];

    rows.forEach((row) => {
      // Client
      if (row.client_name) {
        clientMap[row.client_name] = (clientMap[row.client_name] || 0) + 1;
      }

      // Module
      if (row.module_case) {
        moduleMap[row.module_case] = (moduleMap[row.module_case] || 0) + 1;
      }

      // Category
      if (row.category_case) {
        categoryMap[row.category_case] =
          (categoryMap[row.category_case] || 0) + 1;
      }

      // Monthly — group by month + year
      if (row.month && row.date) {
        const year = new Date(row.date).getFullYear();
        if (!monthMap[row.month]) {
          monthMap[row.month] = { month: row.month };
        }
        monthMap[row.month][year] = (monthMap[row.month][year] || 0) + 1;
      }
    });

    /* ---------- SORTED RESULTS ---------- */
    const allClients = Object.entries(clientMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const allModules = Object.entries(moduleMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const categoryTrend =
      Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    // Sort monthly data sesuai urutan bulan
    const monthlyData = Object.values(monthMap).sort((a, b) => {
      const indexA = monthOrder.indexOf(a.month);
      const indexB = monthOrder.indexOf(b.month);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

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
    console.error("❌ getDashboardStats error:", err);
    return { error: err.message };
  }
}