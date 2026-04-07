"use client";

import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import {
    X, Download, RefreshCw, TrendingUp, TrendingDown, Minus, FileText,
    Loader2, Table2, LayoutList, AlertCircle, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getL3CasesForReport } from "@/app/actions";
import { DateRange } from "react-day-picker";

// 1. Import InlineFilterBar
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
function RankingTable({ items, nameHeader, limit = 50 }: { items: { name: string; value?: number; [year: string]: any }[]; nameHeader: string; limit?: number }) {
    if (!items?.length) return <p className="text-xs text-muted-foreground italic">No data available.</p>;
    const sliced    = items.slice(0, limit);
    const yearKeys  = extractYearKeys(sliced);
    const isMulti   = yearKeys.length > 0;
    const hasChange = yearKeys.length >= 2;
    const fromYear  = hasChange ? yearKeys[yearKeys.length - 2] : "";
    const toYear    = hasChange ? yearKeys[yearKeys.length - 1]  : "";
    return (
        <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-auto border-collapse text-xs">
                <thead>
                    <tr>
                        <Th>#</Th><Th>{nameHeader}</Th>
                        {isMulti ? yearKeys.map(y => <Th key={y} right>{y}</Th>) : <Th right>Cases</Th>}
                        {isMulti && <Th right>Total</Th>}
                        {hasChange && <Th right>Change ({fromYear}→{toYear})</Th>}
                    </tr>
                </thead>
                <tbody>
                    {sliced.map((item, i) => {
                        const stripe  = i % 2 === 1;
                        const total   = isMulti ? yearKeys.reduce((s, y) => s + (item[y] ?? 0), 0) : (item.value ?? 0);
                        const prev    = hasChange ? (item[fromYear] ?? 0) : 0;
                        const curr    = hasChange ? (item[toYear]   ?? 0) : 0;
                        const change  = curr - prev;
                        const pct     = prev !== 0 ? Math.round((change / prev) * 100) : null;
                        const chStr   = change === 0 ? "—" : `${change > 0 ? "+" : ""}${change.toLocaleString()}${pct !== null ? ` (${change > 0 ? "+" : ""}${pct}%)` : ""}`;
                        return (
                            <tr key={i} className={stripe ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-background"}>
                                <Td muted right>{i + 1}</Td>
                                <Td bold={i === 0}>{item.name}</Td>
                                {isMulti ? yearKeys.map(y => <Td key={y} right muted={(item[y] ?? 0) === 0}>{(item[y] ?? 0) > 0 ? (item[y] as number).toLocaleString() : "—"}</Td>) : <Td right bold>{(item.value ?? 0).toLocaleString()}</Td>}
                                {isMulti && <Td right bold>{total.toLocaleString()}</Td>}
                                {hasChange && <Td right bold color={change > 0 ? "text-red-600" : change < 0 ? "text-emerald-600" : "text-muted-foreground"}>{chStr}</Td>}
                            </tr>
                        );
                    })}
                </tbody>
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
function TrendsSection({ trends, trendPeriod, sectionNumber }: { trends: ModuleTrend[]; trendPeriod: string; sectionNumber?: number }) {
    const title = `Case Trend — ${trendPeriod.charAt(0).toUpperCase() + trendPeriod.slice(1)}`;
    if (!trends?.length) return (
        <section><SectionTitle number={sectionNumber}>{title}</SectionTitle><p className="text-xs text-muted-foreground italic">No trend data available.</p></section>
    );
    return (
        <section>
            <SectionTitle number={sectionNumber}>{title}</SectionTitle>
            <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-auto border-collapse text-xs">
                    <thead><tr><Th>Module</Th><Th right>Previous</Th><Th right>Current</Th><Th right>Change</Th></tr></thead>
                    <tbody>
                        {trends.map((t, i) => {
                            const pct   = t.change_pct ?? (t.previous !== 0 ? Math.round((t.change / t.previous) * 100) : null);
                            const chStr = `${t.direction === "up" ? "+" : ""}${t.change}${pct !== null ? ` (${t.direction === "up" ? "+" : ""}${pct}%)` : ""}`;
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
                                    <Td right bold color={t.direction === "up" ? "text-red-600" : t.direction === "down" ? "text-emerald-600" : "text-muted-foreground"}>{chStr}</Td>
                                </tr>
                            );
                        })}
                    </tbody>
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
    // Callbacks to lift download state to parent header
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

    const [cases, setCases]                     = useState<DetailedCase[] | null>(null);
    const [loading, setLoading]                 = useState(false);
    const [isDownloading, setIsDownloading]     = useState(false);
    const [hasGenerated, setHasGenerated]       = useState(false);
    const [sortKey, setSortKey]                 = useState<keyof DetailedCase>("created_at");
    const [sortDir, setSortDir]                 = useState<"asc" | "desc">("desc");
    const [page, setPage]                       = useState(1);
    const PAGE_SIZE                             = 50;

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

    // ── Notify parent when download availability changes ──────────────────
    useEffect(() => {
        const canDownload = hasGenerated && !loading && (cases?.length ?? 0) > 0;
        if (canDownload) {
            onDownloadReady?.(handleDownloadDetail);
        } else {
            onDownloadUnavailable?.();
        }
    }, [hasGenerated, loading, cases, handleDownloadDetail, onDownloadReady, onDownloadUnavailable]);

    // ── Notify parent when downloading state changes ──────────────────────
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

            {/* ── Banner "Filter dari Dashboard" ─────────────────────────── */}
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

            {/* ── InlineFilterBar — Download disembunyikan (ada di header) ── */}
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

                hideDownload // ← Download dipindah ke header modal
            />

            {/* ── Results ── */}
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

                        {/* Status summary strip */}
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

                        {/* Table */}
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

                        {/* Pagination */}
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

    // ── Sheet 2 download state (lifted from child) ────────────────────────
    const sheet2DownloadFn                      = useRef<(() => void) | null>(null);
    const [sheet2CanDownload, setSheet2CanDownload] = useState(false);
    const [sheet2Downloading, setSheet2Downloading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setActiveSheet(1);
        // Reset sheet 2 download state when modal reopens
        sheet2DownloadFn.current = null;
        setSheet2CanDownload(false);
        setSheet2Downloading(false);
        const run = async () => {
            setLoadingCases(true); setUnresolvedCases([]);
            try { const c = await getL3CasesForReport(); setUnresolvedCases(c); }
            catch (err: any) { toast({ variant: "destructive", title: "Gagal load unresolved cases", description: err.message }); }
            finally { setLoadingCases(false); }
        };
        run();
    }, [open]);

    const handleDownloadSummary = useCallback(async () => {
        setIsDownloading(true);
        toast({ title: "Generating Report…", description: "Menyiapkan laporan Word, harap tunggu." });
        try {
            const res = await fetch("/api/dashboard/report", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stats: { ...stats, unresolved_cases: unresolvedCases }, filterSummary }),
            });
            if (!res.ok) { const e = await res.json().catch(() => ({ error: "Unknown" })); throw new Error(e.error ?? `HTTP ${res.status}`); }
            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href = url; a.download = `dashboard-report-${new Date().toISOString().slice(0, 10)}.docx`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast({ title: "Download selesai!" });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Download gagal", description: err.message });
        } finally { setIsDownloading(false); }
    }, [stats, filterSummary, unresolvedCases, toast]);

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

                        {/* Sheet 1: Download Summary */}
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

                        {/* Sheet 2: Download Detailed (lifted from child) */}
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
                            <SummarySection stats={stats} unresolvedCount={unresolvedCases.length} sectionNumber={1} />
                            {(stats.category_rankings?.length ?? 0) > 0 && (
                                <section>
                                    <SectionTitle number={2}>Category Rankings</SectionTitle>
                                    <RankingTable items={stats.category_rankings!} nameHeader="Category" />
                                </section>
                            )}
                            <TrendsSection trends={stats.module_trends ?? []} trendPeriod={filterSummary.trendPeriod} sectionNumber={3} />
                            <MonthlyStatsSection monthly={stats.monthly_stats ?? []} sectionNumber={4} />
                            {stats.client_rankings?.length > 0 && (
                                <section>
                                    <SectionTitle count={stats.client_rankings.length} number={5}>Client Rankings</SectionTitle>
                                    <RankingTable items={stats.client_rankings} nameHeader="Client" />
                                </section>
                            )}
                            {detailModules.length > 0 && (
                                <section>
                                    <SectionTitle number={6}>Detail Module Rankings</SectionTitle>
                                    <RankingTable items={detailModules} nameHeader="Detail Module" />
                                </section>
                            )}
                            <UnresolvedSection cases={unresolvedCases} sectionNumber={7} />
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
                            // ── Lift download state ke header ──
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
                    </span>
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">Close</Button>
                </div>
            </div>
        </div>
    );
}