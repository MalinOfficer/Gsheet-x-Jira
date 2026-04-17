"use client";

import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import {
    X, Download, RefreshCw, TrendingUp, TrendingDown, Minus, FileText,
    Loader2, Table2, LayoutList, AlertCircle, Search, Settings2, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getL3CasesForReport } from "@/app/actions";
import { DateRange } from "react-day-picker";
import { InlineFilterBar } from "@/components/inline-filter-bar";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ModuleTrend = {
    name: string; current: number; previous: number; change: number;
    change_pct?: number | null; direction: "up" | "down" | "stable";
};
type UnresolvedCase = {
    client_name: string; title: string; status: string;
    module?: string; detail_module?: string; created_at?: string;
};
type DetailedCase = {
    ticket_no?: string; client_name: string; title: string; status: string;
    category?: string; module?: string; detail_module?: string;
    created_at?: string; resolved_at?: string; pic?: string;
};
type DashboardStats = {
    summary: {
        total_cases: number; total_solved: number; total_clients: number;
        solved_percentage: number; trending_category: string;
        trending_module: string; top_client: string; top_module: string;
    };
    monthly_stats: Record<string, any>[];
    client_rankings: { name: string; value: number }[];
    module_rankings: { name: string; value: number }[];
    detail_module_rankings: { name: string; value: number }[];
    module_trends: ModuleTrend[];
    category_rankings?: { name: string; value?: number; [year: string]: any }[];
    unresolved_cases?: UnresolvedCase[];
};

export type ReportFilterSummary = {
    years: string[];
    dateRange?: string;
    dateFrom?: string;
    dateTo?: string;
    categories: string[];
    clients: string[];
    modules: string[];
    detailModules: string[];
    trendPeriod: string;
};

type FilterOptions = {
    categories:    { label: string; value: string }[];
    clients:       { label: string; value: string }[];
    modules:       { label: string; value: string }[];
    detailModules: { label: string; value: string }[];
    years:         string[];
};

// Tipe untuk Rincian Kendala
type RincianKendalaItem = {
    id: number;
    id_module: number;
    rincian_kendala: string;
};
type DetailModuleMasterItem = {
    id_module: number;
    detail_module: string;
};

// ─── Section visibility ───────────────────────────────────────────────────────
export type SectionKey =
    | "executive_summary"
    | "category_rankings"
    | "case_trend"
    | "monthly_stats"
    | "client_rankings"
    | "detail_module_rankings"
    | "unresolved_cases"
    | "summary_report_case";

export type SectionVisibility = Record<SectionKey, boolean>;

export const DEFAULT_SECTION_VISIBILITY: SectionVisibility = {
    executive_summary:       true,
    category_rankings:       true,
    case_trend:              true,
    monthly_stats:           true,
    client_rankings:         true,
    detail_module_rankings:  true,
    unresolved_cases:        true,
    summary_report_case:     true,
};

export const SECTION_LABELS: Record<SectionKey, string> = {
    executive_summary:       "Executive Summary",
    category_rankings:       "Category Rankings",
    case_trend:              "Case Trend",
    monthly_stats:           "Monthly Statistics",
    client_rankings:         "Client Rankings",
    detail_module_rankings:  "Detail Module Rankings",
    unresolved_cases:        "Outstanding Unresolved Cases",
    summary_report_case:     "Summary Report Case",
};

export const SECTION_VISIBILITY_KEY = "reportSectionVisibility";

interface ReportPreviewModalProps {
    open: boolean; onClose: () => void;
    stats: DashboardStats; filterSummary: ReportFilterSummary;
    filterOptions?: FilterOptions | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function statusBadgeClass(status: string): string {
    const s = status.toLowerCase();
    if (s === "l3")                         return "bg-red-100 text-red-700 border-red-200";
    if (s === "l2")                         return "bg-orange-100 text-orange-700 border-orange-200";
    if (s === "l1")                         return "bg-amber-100 text-amber-700 border-amber-200";
    if (s === "pending")                    return "bg-purple-100 text-purple-700 border-purple-200";
    if (s === "on hold")                    return "bg-slate-100 text-slate-600 border-slate-200";
    if (s === "resolved" || s === "solved") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    return "bg-gray-100 text-gray-600 border-gray-200";
}
function extractYearKeys(items: Record<string, any>[]): string[] {
    const set = new Set<string>();
    items.forEach(item => Object.keys(item).forEach(k => { if (/^\d{4}$/.test(k)) set.add(k); }));
    return Array.from(set).sort();
}
function CaseTitle({ title }: { title?: string | null }) {
    if (!title) return <span className="text-muted-foreground italic">—</span>;
    const match = title.match(/^(IHO-\d+)\s*(.*)/i);
    if (match) return (
        <>
            <span className="font-mono font-semibold text-[#1E3A5F] dark:text-blue-400 mr-1.5">{match[1]}</span>
            <span>{match[2]}</span>
        </>
    );
    return <span>{title}</span>;
}
function formatDate(raw?: string): string {
    if (!raw || raw === "—") return "—";
    try { const d = new Date(raw); if (!isNaN(d.getTime())) return format(d, "d MMM yyyy HH:mm"); } catch { /**/ }
    return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// Table primitives
// ─────────────────────────────────────────────────────────────────────────────
function Th({ children, right, red }: { children: React.ReactNode; right?: boolean; red?: boolean }) {
    return (
        <th style={{ textAlign: right ? "right" : "left" }}
            className={cn("px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white border whitespace-nowrap",
                red ? "bg-[#7F1D1D] border-[#991B1B]" : "bg-[#1E3A5F] border-[#2D4F7C]")}>
            {children}
        </th>
    );
}
function Td({ children, right, bold, muted, color }: {
    children: React.ReactNode; right?: boolean; bold?: boolean; muted?: boolean; color?: string;
}) {
    return (
        <td style={{ textAlign: right ? "right" : "left" }}
            className={cn("px-3 py-1.5 text-xs border border-border whitespace-nowrap",
                right && "tabular-nums", bold && "font-semibold", muted && "text-muted-foreground", color)}>
            {children}
        </td>
    );
}
function SectionTitle({ children, count, number }: { children: React.ReactNode; count?: number; number?: number }) {
    return (
        <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-bold text-foreground tracking-wide uppercase">
                {number !== undefined && <span className="text-[#1E3A5F] dark:text-blue-400 mr-1.5">{number}.</span>}
                {children}
            </h2>
            {count !== undefined && (
                <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5 tabular-nums">{count.toLocaleString()}</span>
            )}
            <div className="flex-1 h-px bg-border" />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PctBar
// ─────────────────────────────────────────────────────────────────────────────
function PctBar({ pct }: { pct: number }) {
    return (
        <div className="flex items-center gap-1.5 min-w-[90px]">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                    className="h-full rounded-full bg-yellow-400 transition-all"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
            <span className="tabular-nums text-[10px] text-muted-foreground w-9 text-right">
                {pct.toFixed(1)}%
            </span>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Toggle Panel
// ─────────────────────────────────────────────────────────────────────────────
function SectionTogglePanel({
    visibility,
    onChange,
    onClose,
}: {
    visibility: SectionVisibility;
    onChange: (key: SectionKey, val: boolean) => void;
    onClose: () => void;
}) {
    const allOn  = Object.values(visibility).every(Boolean);
    const allOff = Object.values(visibility).every(v => !v);

    const toggleAll = () => {
        const next = !allOn;
        (Object.keys(visibility) as SectionKey[]).forEach(k => onChange(k, next));
    };

    return (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-background shadow-xl">
            {/* header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b">
                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Tampilkan Section</span>
                <button
                    onClick={onClose}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* toggle all */}
            <div className="px-4 py-2 border-b bg-muted/30">
                <button
                    onClick={toggleAll}
                    className="text-[11px] font-medium text-[#1E3A5F] dark:text-blue-400 hover:underline"
                >
                    {allOn ? "Sembunyikan semua" : "Tampilkan semua"}
                </button>
            </div>

            {/* list */}
            <div className="py-1.5 max-h-72 overflow-y-auto">
                {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key, idx) => {
                    const on = visibility[key];
                    return (
                        <button
                            key={key}
                            onClick={() => onChange(key, !on)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                                on ? "hover:bg-blue-50/50 dark:hover:bg-blue-950/20" : "opacity-50 hover:opacity-70 hover:bg-muted/50"
                            )}
                        >
                            <span className="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                                style={{
                                    borderColor: on ? "#1E3A5F" : "#9CA3AF",
                                    backgroundColor: on ? "#1E3A5F" : "transparent",
                                }}>
                                {on && (
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </span>
                            <span className="text-xs font-medium">
                                <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
                                {SECTION_LABELS[key]}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="px-4 py-2 border-t bg-muted/20">
                <p className="text-[10px] text-muted-foreground">
                    {Object.values(visibility).filter(Boolean).length} dari {Object.keys(visibility).length} section aktif
                </p>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 1 sub-components
// ─────────────────────────────────────────────────────────────────────────────
function SummarySection({ stats, unresolvedCount, sectionNumber }: { stats: DashboardStats; unresolvedCount: number; sectionNumber?: number }) {
    const rows = [
        ["Total Cases",       stats.summary.total_cases.toLocaleString()],
        ["Total Solved",      stats.summary.total_solved.toLocaleString()],
        ["Solved Rate",       `${stats.summary.solved_percentage?.toFixed(1) ?? "0.0"}%`],
        ["Unresolved Cases",  unresolvedCount.toLocaleString()],
        ["Total Clients",     (stats.summary.total_clients ?? 0).toLocaleString()],
        ["Trending Category", stats.summary.trending_category ?? "—"],
        ["Trending Module",   stats.summary.trending_module ?? stats.summary.top_module ?? "—"],
        ["Top Client",        stats.summary.top_client ?? "—"],
    ];
    return (
        <section>
            <SectionTitle number={sectionNumber}>Executive Summary</SectionTitle>
            <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-auto border-collapse text-xs">
                    <thead><tr><Th>Metric</Th><Th right>Value</Th></tr></thead>
                    <tbody>
                        {rows.map(([label, value], i) => (
                            <tr key={label} className={i % 2 === 1 ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-background"}>
                                <Td bold>{label}</Td>
                                <Td right color={label === "Unresolved Cases" && unresolvedCount > 0 ? "text-red-600 font-bold" : label === "Solved Rate" ? "text-emerald-600 font-semibold" : undefined}>{value}</Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// RankingTable
// ─────────────────────────────────────────────────────────────────────────────
function RankingTable({
    items,
    nameHeader,
    limit = 50,
    showPct,
}: {
    items: { name: string; value?: number; [year: string]: any }[];
    nameHeader: string;
    limit?: number;
    showPct?: boolean;
}) {
    if (!items?.length) return <p className="text-xs text-muted-foreground italic">No data available.</p>;

    const sliced    = items.slice(0, limit);
    const yearKeys  = extractYearKeys(sliced);
    const isMulti   = yearKeys.length > 0;
    const hasChange = yearKeys.length >= 2;
    const fromYear  = hasChange ? yearKeys[yearKeys.length - 2] : "";
    const toYear    = hasChange ? yearKeys[yearKeys.length - 1] : "";

    const grandTotal = sliced.reduce((s, item) => {
        const t = isMulti
            ? yearKeys.reduce((acc, y) => acc + ((item[y] ?? 0) as number), 0)
            : (item.value ?? 0);
        return s + t;
    }, 0);

    return (
        <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-auto border-collapse text-xs">
                <thead>
                    <tr>
                        <Th>#</Th>
                        <Th>{nameHeader}</Th>
                        {isMulti ? yearKeys.map(y => <Th key={y} right>{y}</Th>) : <Th right>Cases</Th>}
                        {isMulti && <Th right>Total</Th>}
                        {showPct && <Th right>Share</Th>}
                        {hasChange && <Th right>Change ({fromYear}→{toYear})</Th>}
                    </tr>
                </thead>
                <tbody>
                    {sliced.map((item, i) => {
                        const stripe = i % 2 === 1;
                        const total  = isMulti
                            ? yearKeys.reduce((s, y) => s + ((item[y] ?? 0) as number), 0)
                            : (item.value ?? 0);
                        const pct    = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
                        const prev   = hasChange ? (item[fromYear] ?? 0) as number : 0;
                        const curr   = hasChange ? (item[toYear]   ?? 0) as number : 0;
                        const change = curr - prev;
                        const chPct  = prev !== 0 ? Math.round((change / prev) * 100) : null;
                        const chStr  = change === 0
                            ? "—"
                            : `${change > 0 ? "+" : ""}${change.toLocaleString()}${chPct !== null ? ` (${change > 0 ? "+" : ""}${chPct}%)` : ""}`;

                        return (
                            <tr key={i} className={stripe ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-background"}>
                                <Td muted right>{i + 1}</Td>
                                <Td bold={i === 0}>{item.name}</Td>
                                {isMulti
                                    ? yearKeys.map(y => (
                                        <Td key={y} right muted={(item[y] ?? 0) === 0}>
                                            {(item[y] ?? 0) > 0 ? (item[y] as number).toLocaleString() : "—"}
                                        </Td>
                                    ))
                                    : <Td right bold>{(item.value ?? 0).toLocaleString()}</Td>
                                }
                                {isMulti && <Td right bold>{total.toLocaleString()}</Td>}
                                {showPct && (
                                    <td className="px-3 py-1.5 text-xs border border-border">
                                        <PctBar pct={pct} />
                                    </td>
                                )}
                                {hasChange && (
                                    <Td right bold color={change > 0 ? "text-red-600" : change < 0 ? "text-emerald-600" : "text-muted-foreground"}>
                                        {chStr}
                                    </Td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>

                {showPct && grandTotal > 0 && (
                    <tfoot>
                        <tr className="bg-muted/50 border-t-2 border-border">
                            <td
                                colSpan={isMulti ? yearKeys.length + 2 : 2}
                                className="px-3 py-1.5 text-xs font-bold text-right border border-border text-muted-foreground uppercase tracking-wide"
                            >
                                Total
                            </td>
                            <td className="px-3 py-1.5 text-xs font-bold text-right border border-border tabular-nums">
                                {grandTotal.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-xs border border-border">
                                <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">100.0%</span>
                            </td>
                            {hasChange && <td className="border border-border" />}
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
}

function MonthlyStatsSection({ monthly, sectionNumber }: { monthly: Record<string, any>[]; sectionNumber?: number }) {
    if (!monthly?.length) return null;
    const yearKeys  = Object.keys(monthly[0]).filter(k => /^\d{4}$/.test(k)).sort();
    if (!yearKeys.length) return null;
    const hasChange = yearKeys.length >= 2;
    const fromYear  = hasChange ? yearKeys[yearKeys.length - 2] : "";
    const toYear    = hasChange ? yearKeys[yearKeys.length - 1]  : "";
    return (
        <section>
            <SectionTitle number={sectionNumber}>Monthly Statistics</SectionTitle>
            <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-auto border-collapse text-xs">
                    <thead>
                        <tr>
                            <Th>Month</Th>
                            {yearKeys.map(y => <Th key={y} right>{y}</Th>)}
                            <Th right>Total</Th>
                            {hasChange && <Th right>Change ({fromYear}→{toYear})</Th>}
                        </tr>
                    </thead>
                    <tbody>
                        {monthly.map((row, i) => {
                            const stripe = i % 2 === 1;
                            const total  = yearKeys.reduce((s, y) => s + ((row[y] ?? 0) as number), 0);
                            const prev   = hasChange ? (row[fromYear] ?? 0) as number : 0;
                            const curr   = hasChange ? (row[toYear]   ?? 0) as number : 0;
                            const change = curr - prev;
                            const pct    = prev !== 0 ? Math.round((change / prev) * 100) : null;
                            const chStr  = change === 0 ? "—" : `${change > 0 ? "+" : ""}${change.toLocaleString()}${pct !== null ? ` (${change > 0 ? "+" : ""}${pct}%)` : ""}`;
                            return (
                                <tr key={i} className={stripe ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-background"}>
                                    <Td bold>{row.month ?? ""}</Td>
                                    {yearKeys.map(y => <Td key={y} right muted={(row[y] ?? 0) === 0}>{row[y] !== undefined ? (row[y] as number).toLocaleString() : "—"}</Td>)}
                                    <Td right bold>{total.toLocaleString()}</Td>
                                    {hasChange && <Td right bold color={change > 0 ? "text-red-600" : change < 0 ? "text-emerald-600" : "text-muted-foreground"}>{chStr}</Td>}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TrendsSection
// ─────────────────────────────────────────────────────────────────────────────
function TrendsSection({ trends, trendPeriod, sectionNumber }: { trends: ModuleTrend[]; trendPeriod: string; sectionNumber?: number }) {
    const title = `Case Trend — ${trendPeriod.charAt(0).toUpperCase() + trendPeriod.slice(1)}`;

    if (!trends?.length) return (
        <section>
            <SectionTitle number={sectionNumber}>{title}</SectionTitle>
            <p className="text-xs text-muted-foreground italic">No trend data available.</p>
        </section>
    );

    const sorted = [...trends].sort((a, b) => b.current - a.current);
    const grandCurrentTotal = trends.reduce((s, t) => s + t.current, 0);

    return (
        <section>
            <SectionTitle number={sectionNumber}>{title}</SectionTitle>
            <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-auto border-collapse text-xs">
                    <thead>
                        <tr>
                            <Th>Module</Th>
                            <Th right>Previous</Th>
                            <Th right>Current</Th>
                            <Th right>Share (current)</Th>
                            <Th right>Change</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((t, i) => {
                            const pct      = t.change_pct ?? (t.previous !== 0 ? Math.round((t.change / t.previous) * 100) : null);
                            const chStr    = `${t.direction === "up" ? "+" : ""}${t.change}${pct !== null ? ` (${t.direction === "up" ? "+" : ""}${pct}%)` : ""}`;
                            const sharePct = grandCurrentTotal > 0 ? (t.current / grandCurrentTotal) * 100 : 0;
                            return (
                                <tr key={i} className={i % 2 === 1 ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-background"}>
                                    <Td>
                                        <span className="flex items-center gap-1.5">
                                            {t.direction === "up"     && <TrendingUp   className="h-3 w-3 text-red-500 flex-shrink-0" />}
                                            {t.direction === "down"   && <TrendingDown className="h-3 w-3 text-emerald-500 flex-shrink-0" />}
                                            {t.direction === "stable" && <Minus        className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                                            {t.name}
                                        </span>
                                    </Td>
                                    <Td right>{t.previous.toLocaleString()}</Td>
                                    <Td right>{t.current.toLocaleString()}</Td>
                                    <td className="px-3 py-1.5 text-xs border border-border">
                                        <PctBar pct={sharePct} />
                                    </td>
                                    <Td right bold color={t.direction === "up" ? "text-red-600" : t.direction === "down" ? "text-emerald-600" : "text-muted-foreground"}>
                                        {chStr}
                                    </Td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-muted/50 border-t-2 border-border">
                            <td className="px-3 py-1.5 text-xs font-bold border border-border text-muted-foreground uppercase tracking-wide">
                                Total
                            </td>
                            <td className="px-3 py-1.5 text-xs font-bold text-right border border-border tabular-nums">
                                {trends.reduce((s, t) => s + t.previous, 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-xs font-bold text-right border border-border tabular-nums">
                                {grandCurrentTotal.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-xs border border-border">
                                <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">100.0%</span>
                            </td>
                            <td className="border border-border" />
                        </tr>
                    </tfoot>
                </table>
            </div>
        </section>
    );
}

function UnresolvedSection({ cases, sectionNumber }: { cases: UnresolvedCase[]; sectionNumber?: number }) {
    const STATUS_ORDER: Record<string, number> = { l3: 0, l2: 1, l1: 2, pending: 3, "on hold": 4 };
    const sorted       = [...cases].sort((a, b) => (STATUS_ORDER[a.status.toLowerCase()] ?? 99) - (STATUS_ORDER[b.status.toLowerCase()] ?? 99));
    const hasModule    = cases.some(c => c.module?.trim());
    const hasDetail    = cases.some(c => c.detail_module?.trim());
    const hasCreatedAt = cases.some(c => c.created_at?.trim());
    return (
        <section>
            <SectionTitle count={cases.length} number={sectionNumber}>Outstanding Unresolved Cases</SectionTitle>
            {cases.length === 0 ? (
                <div className="flex items-center gap-2 py-4 px-3 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 text-sm">
                    <span>✓</span><span className="font-medium">All cases have been resolved.</span>
                </div>
            ) : (
                <>
                    <p className="text-[11px] text-muted-foreground mb-2 italic">Sorted by severity: L3 → L2 → L1 → Pending → On Hold</p>
                    <div className="overflow-x-auto rounded-md border border-red-200">
                        <table className="w-auto border-collapse text-xs">
                            <thead>
                                <tr>
                                    <Th red>#</Th><Th red>Client</Th><Th red>Case / Title</Th><Th red>Status</Th>
                                    {hasModule    && <Th red>Module</Th>}
                                    {hasDetail    && <Th red>Detail Module</Th>}
                                    {hasCreatedAt && <Th red>Created At</Th>}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((c, i) => (
                                    <tr key={i} className={i % 2 === 1 ? "bg-red-50/60 dark:bg-red-950/20" : "bg-white dark:bg-background"}>
                                        <td className="px-3 py-1.5 text-xs border border-border text-muted-foreground text-right tabular-nums">{i + 1}</td>
                                        <td className="px-3 py-1.5 text-xs border border-border font-medium whitespace-nowrap">{c.client_name}</td>
                                        <td className="px-3 py-1.5 text-xs border border-border max-w-[320px]"><span className="line-clamp-2"><CaseTitle title={c.title} /></span></td>
                                        <td className="px-3 py-1.5 text-xs border border-border text-center">
                                            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", statusBadgeClass(c.status))}>{c.status}</span>
                                        </td>
                                        {hasModule    && <td className="px-3 py-1.5 text-xs border border-border text-muted-foreground whitespace-nowrap">{c.module || "—"}</td>}
                                        {hasDetail    && <td className="px-3 py-1.5 text-xs border border-border text-muted-foreground whitespace-nowrap">{c.detail_module || "—"}</td>}
                                        {hasCreatedAt && <td className="px-3 py-1.5 text-xs border border-border text-center text-muted-foreground tabular-nums whitespace-nowrap">{formatDate(c.created_at)}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </section>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 8 — Summary Report Case
// ─────────────────────────────────────────────────────────────────────────────
function SummaryReportCaseSection({
    items,
    total,
    sectionNumber,
    rincianList,
    detailModuleMaster,
}: {
    items: { name: string; value?: number; [year: string]: any }[];
    total: number;
    sectionNumber?: number;
    rincianList: RincianKendalaItem[];
    detailModuleMaster: DetailModuleMasterItem[];
}) {
    if (!items?.length) return null;

    const { toast } = useToast();

    const idModuleByName = useMemo(() => {
        const map: Record<string, number> = {};
        detailModuleMaster.forEach(d => {
            map[d.detail_module.toLowerCase().trim()] = d.id_module;
        });
        return map;
    }, [detailModuleMaster]);

    const rincianById = useMemo(() => {
        const map: Record<number, string> = {};
        rincianList.forEach(r => {
            map[r.id_module] = r.rincian_kendala;
        });
        return map;
    }, [rincianList]);

    const yearKeys = extractYearKeys(items);
    const isMulti  = yearKeys.length > 0;

    const top10 = useMemo(() => {
        return items
            .map(item => {
                const count = isMulti
                    ? yearKeys.reduce((s, y) => s + ((item[y] ?? 0) as number), 0)
                    : (item.value ?? 0);
                const pct       = total > 0 ? (count / total) * 100 : 0;
                const id_module = idModuleByName[item.name.toLowerCase().trim()] ?? null;
                const rincian   = id_module != null ? (rincianById[id_module] ?? "") : "";
                return { name: item.name, count, pct, id_module, rincian };
            })
            .filter(x => x.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [items, isMulti, yearKeys, total, idModuleByName, rincianById]);

    if (!top10.length) return null;

    const [allCopied, setAllCopied] = useState(false);

    const handleCopyAll = () => {
        const DIVIDER = "─".repeat(30);
    
        const header = `📊 *Summary Report Case*\n${DIVIDER}`;
    
        const lines = top10.map((item, idx) => {
            const rincian = item.rincian.trim() || "_belum ada rincian kendala_";
            return `${idx + 1}. *${item.name}* — ${item.count} case (${item.pct.toFixed(1)}%)\n    ${rincian}`;        });
    
        const footer = `${DIVIDER}\nTotal: ${total.toLocaleString()} cases`;
    
        const text = [header, ...lines, footer].join("\n\n");
    
        navigator.clipboard.writeText(text).then(() => {
            setAllCopied(true);
            setTimeout(() => setAllCopied(false), 2000);
            toast({ title: "Semua formula disalin!" });
        });
    };

    return (
        <section>
            <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-bold text-foreground tracking-wide uppercase">
                    <span className="text-[#1E3A5F] dark:text-blue-400 mr-1.5">{sectionNumber}.</span>
                    Summary Report Case
                </h2>
                <div className="flex-1 h-px bg-border" />
                <button
                    onClick={handleCopyAll}
                    className={cn(
                        "flex-shrink-0 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors",
                        allCopied
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30"
                            : "border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                >
                    {allCopied
                        ? <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    }
                    {allCopied ? "Tersalin!" : "Salin semua"}
                </button>
            </div>

            <p className="text-[11px] text-muted-foreground mb-3 italic">
                10 Detail Module dengan jumlah case terbanyak.
            </p>

            <div className="rounded-lg border border-border bg-background overflow-hidden">
                {top10.map((item, idx) => {
                    const rankColors = [
                        "bg-yellow-400 text-yellow-900",
                        "bg-slate-300 text-slate-700",
                        "bg-amber-600/70 text-white",
                    ];
                    const rankColor = rankColors[idx] ?? "bg-muted text-muted-foreground";
                    const isLast    = idx === top10.length - 1;

                    return (
                        <div
                            key={item.name}
                            className={cn(
                                "px-4 py-3",
                                !isLast && "border-b border-border",
                                idx % 2 === 1 && "bg-muted/20"
                            )}
                        >
                            <div className="flex gap-3 items-start">
                                <span className={cn(
                                    "flex-shrink-0 inline-flex w-5 h-5 rounded-full items-center justify-center text-[9px] font-bold mt-0.5",
                                    rankColor
                                )}>
                                    {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs leading-relaxed">
                                        <span className={cn("font-semibold", idx === 0 && "text-[#1E3A5F] dark:text-blue-400")}>
                                            {item.name}
                                        </span>
                                        <span className="text-muted-foreground"> — </span>
                                        <span className="tabular-nums font-semibold">{item.count.toLocaleString()} case</span>
                                        <span className="text-muted-foreground"> ({item.pct.toFixed(1)}%)</span>
                                    </p>
                                    <p className={cn(
                                        "mt-0.5 text-[11px] leading-relaxed",
                                        item.rincian.trim()
                                            ? "text-muted-foreground italic"
                                            : "text-muted-foreground/40 italic"
                                    )}>
                                        {item.rincian.trim() || "Belum ada rincian kendala"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <div className="px-4 py-2 border-t border-border bg-muted/30">
                    <p className="text-[11px] text-muted-foreground text-right tabular-nums">
                        Total keseluruhan: <span className="font-semibold text-foreground">{total.toLocaleString()} cases</span>
                    </p>
                </div>
            </div>
        </section>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 2 — Detailed Cases
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
    { label: "L3",       value: "l3" },
    { label: "L2",       value: "l2" },
    { label: "L1",       value: "l1" },
    { label: "Pending",  value: "pending" },
    { label: "On Hold",  value: "on hold" },
    { label: "Resolved", value: "resolved" },
];

interface DetailedFilters {
    years: string[]; dateRange?: DateRange;
    categories: string[]; clients: string[];
    modules: string[]; detailModules: string[];
    statuses: string[]; search: string;
}

interface DetailedCasesSheetProps {
    filterOptions: FilterOptions | null;
    initialYears: string[];
    initialCategories: string[];
    initialClients: string[];
    initialModules: string[];
    initialDetailModules: string[];
    initialDateFrom?: string;
    initialDateTo?: string;
    onDownloadReady?: (handler: () => void) => void;
    onDownloadUnavailable?: () => void;
    onDownloadingChange?: (v: boolean) => void;
}

function DetailedCasesSheet({
    filterOptions,
    initialYears,
    initialCategories,
    initialClients,
    initialModules,
    initialDetailModules,
    initialDateFrom,
    initialDateTo,
    onDownloadReady,
    onDownloadUnavailable,
    onDownloadingChange,
}: DetailedCasesSheetProps) {
    const { toast } = useToast();

    const yearOptions = useMemo(() => [
        { label: "All Years", value: "__all__" },
        ...(filterOptions?.years ?? [])
            .sort((a, b) => parseInt(b) - parseInt(a))
            .map(y => ({ label: y, value: y })),
    ], [filterOptions?.years]);

    const [filters, setFilters] = useState<DetailedFilters>(() => ({
        years:         initialYears,
        dateRange:     initialDateFrom
                           ? {
                               from: new Date(initialDateFrom),
                               to:   initialDateTo ? new Date(initialDateTo) : undefined,
                             }
                           : undefined,
        categories:    initialCategories,
        clients:       initialClients,
        modules:       initialModules,
        detailModules: initialDetailModules,
        statuses:      [],
        search:        "",
    }));

    const [cases, setCases]                 = useState<DetailedCase[] | null>(null);
    const [loading, setLoading]             = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [hasGenerated, setHasGenerated]   = useState(false);
    const [sortKey, setSortKey]             = useState<keyof DetailedCase>("created_at");
    const [sortDir, setSortDir]             = useState<"asc" | "desc">("desc");
    const [page, setPage]                   = useState(1);
    const PAGE_SIZE                         = 50;

    const setF = <K extends keyof DetailedFilters>(key: K, value: DetailedFilters[K]) =>
        setFilters(f => ({ ...f, [key]: value }));

    const clearAll = () => setFilters(f => ({
        years: [], search: f.search,
        dateRange: undefined, categories: [], clients: [],
        modules: [], detailModules: [], statuses: [],
    }));

    const hasInheritedFilters = useMemo(() =>
        initialYears.length > 0 ||
        initialCategories.length > 0 ||
        initialClients.length > 0 ||
        initialModules.length > 0 ||
        initialDetailModules.length > 0 ||
        !!initialDateFrom,
    [initialYears, initialCategories, initialClients, initialModules, initialDetailModules, initialDateFrom]);

    const handleGenerate = useCallback(async () => {
        setLoading(true); setHasGenerated(true); setPage(1);
        try {
            const params = new URLSearchParams();
            const activeYears = filters.years.filter(y => y !== "__all__");
            if (activeYears.length)           params.append("years",         activeYears.join(","));
            if (filters.categories.length)    params.append("categories",    filters.categories.join(","));
            if (filters.clients.length)       params.append("clients",       filters.clients.join(","));
            if (filters.modules.length)       params.append("modules",       filters.modules.join(","));
            if (filters.detailModules.length) params.append("detailModules", filters.detailModules.join(","));
            if (filters.statuses.length)      params.append("statuses",      filters.statuses.join(","));
            if (filters.search.trim())        params.append("search",        filters.search.trim());
            if (filters.dateRange?.from)      params.append("dateFrom",      filters.dateRange.from.toISOString());
            if (filters.dateRange?.to)        params.append("dateTo",        filters.dateRange.to.toISOString());

            const res = await fetch(`/api/dashboard/cases?${params.toString()}`, { cache: "no-store" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                throw new Error(err.error ?? `HTTP ${res.status}`);
            }
            const data = await res.json();
            setCases(data.cases ?? data ?? []);
        } catch (err: any) {
            toast({ variant: "destructive", title: "Gagal generate report", description: err.message });
            setCases([]);
        } finally { setLoading(false); }
    }, [filters, toast]);

    const handleDownloadDetail = useCallback(async () => {
        if (!cases?.length) return;
        setIsDownloading(true);
        try {
            const res = await fetch("/api/dashboard/report/detail", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ cases, filters }),
            });

            if (res.status === 413) {
                const err = await res.json().catch(() => ({}));
                toast({
                    variant:     "destructive",
                    title:       "Data terlalu besar untuk di-export",
                    description: err.message ?? `Maksimal ${(err.limit ?? 1500).toLocaleString()} cases. Saat ini: ${(err.current ?? cases.length).toLocaleString()} cases. Gunakan filter yang lebih spesifik.`,
                    duration:    8000,
                });
                return;
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                throw new Error(err.message ?? err.error ?? `HTTP ${res.status}`);
            }

            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href     = url;
            a.download = `detailed-report-${new Date().toISOString().slice(0, 10)}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast({ title: "Download selesai!" });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Download gagal", description: err.message });
        } finally {
            setIsDownloading(false);
        }
    }, [cases, filters, toast]);

    useEffect(() => {
        const canDownload = hasGenerated && !loading && (cases?.length ?? 0) > 0;
        if (canDownload) {
            onDownloadReady?.(handleDownloadDetail);
        } else {
            onDownloadUnavailable?.();
        }
    }, [hasGenerated, loading, cases, handleDownloadDetail, onDownloadReady, onDownloadUnavailable]);

    useEffect(() => {
        onDownloadingChange?.(isDownloading);
    }, [isDownloading, onDownloadingChange]);

    const sorted = useMemo(() => {
        if (!cases) return [];
        return [...cases].sort((a, b) => {
            const av = a[sortKey] ?? ""; const bv = b[sortKey] ?? "";
            return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
    }, [cases, sortKey, sortDir]);

    const filtered = useMemo(() => {
        const q = filters.search.trim().toLowerCase();
        if (!q) return sorted;
        return sorted.filter(c =>
            (c.ticket_no ?? "").toLowerCase().includes(q) ||
            (c.title ?? "").toLowerCase().includes(q) ||
            (c.client_name ?? "").toLowerCase().includes(q)
        );
    }, [sorted, filters.search]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSort = (key: keyof DetailedCase) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    const SortTh = ({ children, field }: { children: React.ReactNode; field: keyof DetailedCase }) => (
        <th onClick={() => handleSort(field)}
            className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-[#1E3A5F] border border-[#2D4F7C] whitespace-nowrap cursor-pointer hover:bg-[#2D4F7C] transition-colors select-none">
            <span className="flex items-center gap-1">
                {children}
                {sortKey === field && <span className="opacity-70 text-[9px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
            </span>
        </th>
    );

    return (
        <div className="flex flex-col h-full min-h-0">

            {hasInheritedFilters && (
                <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800">
                    <span className="text-blue-500 text-sm">✦</span>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300">
                        Filter otomatis diisi dari Dashboard —{" "}
                        <span className="font-semibold">
                            {[
                                initialYears.length          && `${initialYears.length} year(s)`,
                                initialClients.length        && `${initialClients.length} client(s)`,
                                initialCategories.length     && `${initialCategories.length} categor${initialCategories.length > 1 ? "ies" : "y"}`,
                                initialModules.length        && `${initialModules.length} module(s)`,
                                initialDetailModules.length  && `${initialDetailModules.length} detail module(s)`,
                                initialDateFrom              && `date range`,
                            ].filter(Boolean).join(", ")}
                        </span>
                        {" "}— kamu bisa ubah sebelum generate.
                    </p>
                </div>
            )}

            <InlineFilterBar
                yearOptions={yearOptions}
                statusOptions={STATUS_OPTIONS}
                categoryOptions={filterOptions?.categories ?? []}
                clientOptions={filterOptions?.clients ?? []}
                moduleOptions={filterOptions?.modules ?? []}
                detailModuleOptions={filterOptions?.detailModules ?? []}

                selectedYears={filters.years}
                selectedStatuses={filters.statuses}
                selectedCategories={filters.categories}
                selectedClients={filters.clients}
                selectedModules={filters.modules}
                selectedDetailModules={filters.detailModules}
                dateRange={filters.dateRange}
                search={filters.search}

                onYearsChange={v => setF("years", v)}
                onStatusesChange={v => setF("statuses", v)}
                onCategoriesChange={v => setF("categories", v)}
                onClientsChange={v => setF("clients", v)}
                onModulesChange={v => setF("modules", v)}
                onDetailModulesChange={v => setF("detailModules", v)}
                onDateRangeChange={v => setF("dateRange", v)}
                onSearchChange={v => setF("search", v)}
                onClearAll={clearAll}

                isLoading={loading}
                isDownloading={isDownloading}
                hasGenerated={hasGenerated}
                casesCount={filtered.length}
                onGenerate={handleGenerate}
                onDownload={handleDownloadDetail}

                hideDownload
            />

            <div className="flex-1 min-h-0 overflow-y-auto">

                {!hasGenerated && !loading && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                        <div className="w-14 h-14 rounded-2xl bg-[#1E3A5F]/6 flex items-center justify-center">
                            <LayoutList className="h-7 w-7 text-[#1E3A5F]/30" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                            {hasInheritedFilters
                                ? <>Filter sudah terisi dari Dashboard — klik <span className="text-[#1E3A5F]">Generate Report</span></>
                                : <>Atur filter lalu klik <span className="text-[#1E3A5F]">Generate Report</span></>
                            }
                        </p>
                        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                            Sheet 2 menampilkan data per ticket — nomor tiket, client, deskripsi case, status, modul, dan timestamp.
                        </p>
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <Loader2 className="h-7 w-7 animate-spin text-[#1E3A5F]/40" />
                        <p className="text-sm text-muted-foreground">Mengambil data cases…</p>
                    </div>
                )}

                {!loading && hasGenerated && cases !== null && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                        <AlertCircle className="h-7 w-7 text-muted-foreground/30" />
                        <p className="text-sm font-medium text-muted-foreground">Tidak ada case yang cocok.</p>
                        <p className="text-xs text-muted-foreground">Coba perlonggar beberapa kriteria filter.</p>
                    </div>
                )}

                {!loading && hasGenerated && filtered.length > 0 && (
                    <div className="p-4 space-y-3">

                        <div className="flex flex-wrap gap-1.5">
                            {(() => {
                                const byStatus: Record<string, number> = {};
                                filtered.forEach(c => { const s = c.status.toLowerCase(); byStatus[s] = (byStatus[s] ?? 0) + 1; });
                                return Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                                    <span key={s} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", statusBadgeClass(s))}>
                                        {s} <span className="opacity-60 font-normal">({n})</span>
                                    </span>
                                ));
                            })()}
                        </div>

                        <div className="overflow-x-auto rounded-md border border-border">
                            <table className="w-auto border-collapse text-xs">
                                <thead>
                                    <tr>
                                        <Th>#</Th>
                                        <SortTh field="ticket_no">Title</SortTh>
                                        <SortTh field="client_name">Client</SortTh>
                                        <SortTh field="status">Status</SortTh>
                                        <SortTh field="category">Category</SortTh>
                                        <SortTh field="module">Module</SortTh>
                                        <SortTh field="detail_module">Detail Module</SortTh>
                                        <SortTh field="created_at">Created At</SortTh>
                                        <SortTh field="resolved_at">Resolved At</SortTh>
                                        {paginated.some(c => c.pic) && <SortTh field="pic">PIC</SortTh>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((c, i) => {
                                        const realIdx = (page - 1) * PAGE_SIZE + i;
                                        const hasPic  = paginated.some(x => x.pic);
                                        return (
                                            <tr key={i} className={realIdx % 2 === 1 ? "bg-blue-50/40 dark:bg-blue-950/20" : "bg-white dark:bg-background"}>
                                                <td className="px-3 py-1.5 text-xs border border-border text-muted-foreground text-right tabular-nums w-8">
                                                    {realIdx + 1}
                                                </td>
                                                <td className="px-3 py-1.5 text-xs border border-border max-w-[400px]">
                                                    <span className="flex items-start gap-1.5">
                                                        {c.ticket_no && (
                                                            <span className="flex-shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1E3A5F]/10 text-[#1E3A5F] dark:text-blue-400 whitespace-nowrap mt-px">
                                                                {c.ticket_no}
                                                            </span>
                                                        )}
                                                        <span className="line-clamp-2 leading-relaxed">{c.title || "—"}</span>
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 text-xs border border-border font-medium whitespace-nowrap">
                                                    {c.client_name || "—"}
                                                </td>
                                                <td className="px-3 py-1.5 text-xs border border-border text-center whitespace-nowrap">
                                                    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", statusBadgeClass(c.status))}>
                                                        {c.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 text-xs border border-border text-muted-foreground whitespace-nowrap">
                                                    {c.category || "—"}
                                                </td>
                                                <td className="px-3 py-1.5 text-xs border border-border text-muted-foreground whitespace-nowrap">
                                                    {c.module || "—"}
                                                </td>
                                                <td className="px-3 py-1.5 text-xs border border-border text-muted-foreground whitespace-nowrap">
                                                    {c.detail_module || "—"}
                                                </td>
                                                <td className="px-3 py-1.5 text-xs border border-border text-muted-foreground tabular-nums whitespace-nowrap">
                                                    {formatDate(c.created_at)}
                                                </td>
                                                <td className="px-3 py-1.5 text-xs border border-border tabular-nums whitespace-nowrap">
                                                    {c.resolved_at
                                                        ? <span className="text-muted-foreground">{formatDate(c.resolved_at)}</span>
                                                        : <span className="text-red-400 font-medium">—</span>
                                                    }
                                                </td>
                                                {hasPic && (
                                                    <td className="px-3 py-1.5 text-xs border border-border text-muted-foreground whitespace-nowrap">
                                                        {c.pic || "—"}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-1">
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
                                </span>
                                <div className="flex items-center gap-1">
                                    <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-7 px-2.5 text-xs">← Prev</Button>
                                    <span className="px-2 text-xs text-muted-foreground tabular-nums">{page} / {totalPages}</span>
                                    <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="h-7 px-2.5 text-xs">Next →</Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: ReportPreviewModal
// ─────────────────────────────────────────────────────────────────────────────
export function ReportPreviewModal({ open, onClose, stats, filterSummary, filterOptions }: ReportPreviewModalProps) {
    const { toast } = useToast();
    const [isDownloading, setIsDownloading]     = useState(false);
    const [activeSheet, setActiveSheet]         = useState<1 | 2>(1);
    const [unresolvedCases, setUnresolvedCases] = useState<UnresolvedCase[]>([]);
    const [loadingCases, setLoadingCases]       = useState(false);

    // Section visibility — load dari localStorage, merge dengan default
    const [sectionVisibility, setSectionVisibility] = useState<SectionVisibility>(() => {
        try {
            const saved = localStorage.getItem(SECTION_VISIBILITY_KEY);
            if (saved) return { ...DEFAULT_SECTION_VISIBILITY, ...JSON.parse(saved) };
        } catch (_) {}
        return DEFAULT_SECTION_VISIBILITY;
    });
    const [showTogglePanel, setShowTogglePanel] = useState(false);
    const togglePanelRef = useRef<HTMLDivElement>(null);

    // State untuk Rincian Kendala
    const [rincianList, setRincianList]               = useState<RincianKendalaItem[]>([]);
    const [detailModuleMaster, setDetailModuleMaster] = useState<DetailModuleMasterItem[]>([]);

    const sheet2DownloadFn                          = useRef<(() => void) | null>(null);
    const [sheet2CanDownload, setSheet2CanDownload] = useState(false);
    const [sheet2Downloading, setSheet2Downloading] = useState(false);

    // Close toggle panel on outside click
    useEffect(() => {
        if (!showTogglePanel) return;
        const handler = (e: MouseEvent) => {
            if (togglePanelRef.current && !togglePanelRef.current.contains(e.target as Node)) {
                setShowTogglePanel(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showTogglePanel]);

    const handleSectionVisibilityChange = (key: SectionKey, val: boolean) => {
        setSectionVisibility(prev => {
            const next = { ...prev, [key]: val };
            try { localStorage.setItem(SECTION_VISIBILITY_KEY, JSON.stringify(next)); } catch (_) {}
            return next;
        });
    };

    useEffect(() => {
        if (!open) return;
        setActiveSheet(1);
        setShowTogglePanel(false);
        sheet2DownloadFn.current = null;
        setSheet2CanDownload(false);
        setSheet2Downloading(false);

        // Reload section visibility from localStorage when modal opens
        try {
            const saved = localStorage.getItem(SECTION_VISIBILITY_KEY);
            if (saved) setSectionVisibility({ ...DEFAULT_SECTION_VISIBILITY, ...JSON.parse(saved) });
        } catch (_) {}

        const runUnresolved = async () => {
            setLoadingCases(true); setUnresolvedCases([]);
            try { const c = await getL3CasesForReport(); setUnresolvedCases(c); }
            catch (err: any) { toast({ variant: "destructive", title: "Gagal load unresolved cases", description: err.message }); }
            finally { setLoadingCases(false); }
        };

        const fetchRincian = async () => {
            try {
                const [rincianRes, modRes] = await Promise.all([
                    fetch("/api/master/rincian-kendala"),
                    fetch("/api/master/detail-module"),
                ]);
                const rincianJson = await rincianRes.json();
                const modJson     = await modRes.json();
                setRincianList(rincianJson.data ?? []);
                setDetailModuleMaster(modJson.data ?? []);
            } catch (_) {}
        };

        runUnresolved();
        fetchRincian();
    }, [open]);

    const handleDownloadSummary = useCallback(async () => {
        setIsDownloading(true);
        toast({ title: "Generating Report…", description: "Menyiapkan laporan Word, harap tunggu." });
        try {
            // Sama persis dengan yang dirender di preview
            const detailModules = stats.detail_module_rankings ?? stats.module_rankings ?? [];
    
            const res = await fetch("/api/dashboard/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    stats: {
                        ...stats,
                        unresolved_cases: unresolvedCases,      // ✅ sama dengan preview
                        detail_module_rankings: detailModules,  // ✅ sudah resolve fallback
                    },
                    filterSummary,
                    sectionVisibility,
                    rincianList,        // ✅ kirim untuk Summary Report Case
                    detailModuleMaster, // ✅ kirim untuk Summary Report Case
                }),
            });
    
            if (!res.ok) {
                const e = await res.json().catch(() => ({ error: "Unknown" }));
                throw new Error(e.error ?? `HTTP ${res.status}`);
            }
    
            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href     = url;
            a.download = `dashboard-report-${new Date().toISOString().slice(0, 10)}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast({ title: "Download selesai!" });
    
        } catch (err: any) {
            toast({ variant: "destructive", title: "Download gagal", description: err.message });
        } finally {
            setIsDownloading(false);
        }
    }, [
        stats,
        filterSummary,
        unresolvedCases,
        sectionVisibility,
        rincianList,           // ✅ tambah dependency
        detailModuleMaster,    // ✅ tambah dependency
        toast,
    ]);

    const filterParts = useMemo(() => {
        const p: string[] = [];
        if (filterSummary.years?.length)        p.push(`Years: ${filterSummary.years.join(", ")}`);
        if (filterSummary.dateRange)             p.push(`Date: ${filterSummary.dateRange}`);
        if (filterSummary.categories?.length)    p.push(`Categories: ${filterSummary.categories.length}`);
        if (filterSummary.clients?.length)       p.push(`Clients: ${filterSummary.clients.length}`);
        if (filterSummary.modules?.length)       p.push(`Modules: ${filterSummary.modules.length}`);
        if (filterSummary.detailModules?.length) p.push(`Detail Modules: ${filterSummary.detailModules.length}`);
        return p.length ? p : ["No filters applied — showing all data"];
    }, [filterSummary]);

    const detailModules = stats.detail_module_rankings ?? stats.module_rankings ?? [];

    // Hitung section number hanya untuk yang aktif
    const activeSections = useMemo(() => {
        const order: SectionKey[] = [
            "executive_summary",
            "category_rankings",
            "case_trend",
            "monthly_stats",
            "client_rankings",
            "detail_module_rankings",
            "unresolved_cases",
            "summary_report_case",
        ];
        let num = 1;
        const map: Partial<Record<SectionKey, number>> = {};
        for (const key of order) {
            if (sectionVisibility[key]) {
                map[key] = num++;
            }
        }
        return map;
    }, [sectionVisibility]);

    const activeCount = Object.values(sectionVisibility).filter(Boolean).length;

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 flex flex-col w-full max-w-5xl h-[90vh] rounded-xl border bg-background shadow-2xl overflow-hidden">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-3 border-b bg-[#1E3A5F] shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-blue-300 flex-shrink-0" />
                        <div className="min-w-0">
                            <h1 className="text-sm font-bold text-white">Dashboard Report Preview</h1>
                            <p className="text-[10px] text-blue-300 truncate max-w-[480px]">{filterParts.join("  ·  ")}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">

                        {/* Section toggle button — hanya muncul di Sheet 1 */}
                        {activeSheet === 1 && (
                            <div className="relative" ref={togglePanelRef}>
                                <button
                                    onClick={() => setShowTogglePanel(v => !v)}
                                    className={cn(
                                        "flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border transition-colors",
                                        showTogglePanel
                                            ? "bg-white/20 border-white/30 text-white"
                                            : "bg-white/10 border-white/20 text-blue-200 hover:bg-white/15 hover:text-white"
                                    )}
                                    title="Atur section yang ditampilkan"
                                >
                                    <Settings2 className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Sections</span>
                                    <span className={cn(
                                        "inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold",
                                        activeCount < 8
                                            ? "bg-yellow-400 text-yellow-900"
                                            : "bg-white/20 text-white"
                                    )}>
                                        {activeCount}
                                    </span>
                                </button>

                                {showTogglePanel && (
                                    <SectionTogglePanel
                                        visibility={sectionVisibility}
                                        onChange={handleSectionVisibilityChange}
                                        onClose={() => setShowTogglePanel(false)}
                                    />
                                )}
                            </div>
                        )}

                        {activeSheet === 1 && (
                            <Button
                                size="sm"
                                onClick={handleDownloadSummary}
                                disabled={isDownloading || loadingCases}
                                className="gap-1.5 bg-blue-500 hover:bg-blue-400 text-white border-0 h-8"
                            >
                                {isDownloading
                                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    : <Download className="h-3.5 w-3.5" />
                                }
                                <span className="hidden sm:inline text-xs">
                                    {isDownloading ? "Generating…" : "Download .docx"}
                                </span>
                            </Button>
                        )}

                        {activeSheet === 2 && (
                            <Button
                                size="sm"
                                onClick={() => sheet2DownloadFn.current?.()}
                                disabled={!sheet2CanDownload || sheet2Downloading}
                                className="gap-1.5 bg-blue-500 hover:bg-blue-400 text-white border-0 h-8 disabled:opacity-40"
                            >
                                {sheet2Downloading
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Download className="h-3.5 w-3.5" />
                                }
                                <span className="hidden sm:inline text-xs">
                                    {sheet2Downloading ? "Downloading…" : "Download .docx"}
                                </span>
                            </Button>
                        )}

                        <button
                            onClick={onClose}
                            className="rounded-sm p-1 text-blue-300 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* ── Sheet tabs ───────────────────────────────────────────── */}
                <div className="flex items-center px-5 border-b bg-muted/20 shrink-0">
                    {([{ id: 1 as const, label: "Summary Report" }, { id: 2 as const, label: "Detailed Cases" }] as const).map(({ id, label }) => (
                        <button key={id} onClick={() => setActiveSheet(id)}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors",
                                activeSheet === id
                                    ? "border-[#1E3A5F] text-[#1E3A5F] dark:border-blue-400 dark:text-blue-400"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                            )}>
                            {label}
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full tabular-nums",
                                activeSheet === id ? "bg-[#1E3A5F]/10 text-[#1E3A5F]" : "bg-muted text-muted-foreground")}>
                                {id}
                            </span>
                        </button>
                    ))}
                    <div className="ml-auto flex items-center gap-2 py-1.5">
                        {/* Section disabled indicator */}
                        {activeSheet === 1 && activeCount < 8 && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                <EyeOff className="h-3 w-3" />
                                {8 - activeCount} section disembunyikan
                            </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                            {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                        {loadingCases && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground animate-pulse">
                                <RefreshCw className="h-3 w-3 animate-spin" />Loading…
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Content ──────────────────────────────────────────────── */}
                <div className="flex-1 min-h-0 flex flex-col">

                    {/* Sheet 1 */}
                    <div className={cn("flex-1 min-h-0 overflow-y-auto", activeSheet !== 1 && "hidden")}>
                        <div className="p-5 space-y-6">

                            {/* 1. Executive Summary */}
                            {sectionVisibility.executive_summary && (
                                <SummarySection
                                    stats={stats}
                                    unresolvedCount={unresolvedCases.length}
                                    sectionNumber={activeSections.executive_summary}
                                />
                            )}

                            {/* 2. Category Rankings */}
                            {sectionVisibility.category_rankings && (stats.category_rankings?.length ?? 0) > 0 && (
                                <section>
                                    <SectionTitle number={activeSections.category_rankings}>Category Rankings</SectionTitle>
                                    <RankingTable items={stats.category_rankings!} nameHeader="Category" />
                                </section>
                            )}

                            {/* 3. Case Trend */}
                            {sectionVisibility.case_trend && (
                                <TrendsSection
                                    trends={stats.module_trends ?? []}
                                    trendPeriod={filterSummary.trendPeriod}
                                    sectionNumber={activeSections.case_trend}
                                />
                            )}

                            {/* 4. Monthly Statistics */}
                            {sectionVisibility.monthly_stats && (
                                <MonthlyStatsSection
                                    monthly={stats.monthly_stats ?? []}
                                    sectionNumber={activeSections.monthly_stats}
                                />
                            )}

                            {/* 5. Client Rankings */}
                            {sectionVisibility.client_rankings && stats.client_rankings?.length > 0 && (
                                <section>
                                    <SectionTitle count={stats.client_rankings.length} number={activeSections.client_rankings}>Client Rankings</SectionTitle>
                                    <RankingTable items={stats.client_rankings} nameHeader="Client" />
                                </section>
                            )}

                            {/* 6. Detail Module Rankings */}
                            {sectionVisibility.detail_module_rankings && detailModules.length > 0 && (
                                <section>
                                    <SectionTitle number={activeSections.detail_module_rankings}>Detail Module Rankings</SectionTitle>
                                    <RankingTable items={detailModules} nameHeader="Detail Module" showPct />
                                </section>
                            )}

                            {/* 7. Outstanding Unresolved Cases */}
                            {sectionVisibility.unresolved_cases && (
                                <UnresolvedSection
                                    cases={unresolvedCases}
                                    sectionNumber={activeSections.unresolved_cases}
                                />
                            )}

                            {/* 8. Summary Report Case */}
                            {sectionVisibility.summary_report_case && detailModules.length > 0 && (
                                <SummaryReportCaseSection
                                    items={detailModules}
                                    total={stats.summary.total_cases}
                                    sectionNumber={activeSections.summary_report_case}
                                    rincianList={rincianList}
                                    detailModuleMaster={detailModuleMaster}
                                />
                            )}

                            {/* Empty state jika semua section dinonaktifkan */}
                            {activeCount === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                                    <EyeOff className="h-10 w-10 text-muted-foreground/25" />
                                    <p className="text-sm font-medium text-muted-foreground">Semua section disembunyikan</p>
                                    <p className="text-xs text-muted-foreground max-w-xs">
                                        Klik tombol <strong>Sections</strong> di header untuk menampilkan kembali section yang diinginkan.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sheet 2 */}
                    <div className={cn("flex-1 min-h-0 flex flex-col", activeSheet !== 2 && "hidden")}>
                        <DetailedCasesSheet
                            filterOptions={filterOptions ?? null}
                            initialYears={filterSummary.years}
                            initialCategories={filterSummary.categories}
                            initialClients={filterSummary.clients}
                            initialModules={filterSummary.modules}
                            initialDetailModules={filterSummary.detailModules}
                            initialDateFrom={filterSummary.dateFrom}
                            initialDateTo={filterSummary.dateTo}
                            onDownloadReady={fn => {
                                sheet2DownloadFn.current = fn;
                                setSheet2CanDownload(true);
                            }}
                            onDownloadUnavailable={() => {
                                sheet2DownloadFn.current = null;
                                setSheet2CanDownload(false);
                            }}
                            onDownloadingChange={setSheet2Downloading}
                        />
                    </div>
                </div>

                {/* ── Footer ───────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-2.5 border-t bg-muted/30 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                        {stats.summary.total_cases.toLocaleString()} total cases · {stats.summary.total_clients ?? 0} clients
                        {activeSheet === 1 && ` · ${loadingCases ? "loading…" : `${unresolvedCases.length} unresolved`}`}
                        {activeSheet === 1 && activeCount < 8 && (
                            <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                                · {activeCount}/8 sections aktif
                            </span>
                        )}
                    </span>
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">Close</Button>
                </div>
            </div>
        </div>
    );
}