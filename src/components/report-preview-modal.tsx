"use client";

import { useCallback, useState, useMemo } from "react";
import { X, Download, RefreshCw, TrendingUp, TrendingDown, Minus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getL3CasesForReport } from "@/app/actions";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ModuleTrend = {
    name: string;
    current: number;
    previous: number;
    change: number;
    change_pct?: number | null;
    direction: "up" | "down" | "stable";
};

type UnresolvedCase = {
    client_name: string;
    title: string;
    status: string;
    module?: string;
    detail_module?: string;
    created_at?: string;
};

type DashboardStats = {
    summary: {
        total_cases: number;
        total_solved: number;
        total_clients: number;
        solved_percentage: number;
        trending_category: string;
        trending_module: string;
        top_client: string;
        top_module: string;
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
    categories: string[];
    clients: string[];
    modules: string[];
    detailModules: string[];
    trendPeriod: string;
};

interface ReportPreviewModalProps {
    open: boolean;
    onClose: () => void;
    stats: DashboardStats;
    filterSummary: ReportFilterSummary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: warna status unresolved
// ─────────────────────────────────────────────────────────────────────────────
function statusBadgeClass(status: string): string {
    const s = status.toLowerCase();
    if (s === "l3")       return "bg-red-100 text-red-700 border-red-200";
    if (s === "l2")       return "bg-orange-100 text-orange-700 border-orange-200";
    if (s === "l1")       return "bg-amber-100 text-amber-700 border-amber-200";
    if (s === "pending")  return "bg-purple-100 text-purple-700 border-purple-200";
    if (s === "on hold")  return "bg-slate-100 text-slate-600 border-slate-200";
    return "bg-gray-100 text-gray-600 border-gray-200";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: extract year keys dari ranking items
// ─────────────────────────────────────────────────────────────────────────────
function extractYearKeys(items: Record<string, any>[]): string[] {
    const set = new Set<string>();
    items.forEach(item => Object.keys(item).forEach(k => { if (/^\d{4}$/.test(k)) set.add(k); }));
    return Array.from(set).sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: render judul case — ticket number di-highlight, sisa teks biasa
// title sudah berbentuk "IHO-1811 Permintaan hide option AIS..."
// (digabung di getL3CasesForReport: parts.join(' ').trim())
// ─────────────────────────────────────────────────────────────────────────────
function CaseTitle({ title }: { title: string }) {
    const match = title.match(/^(IHO-\d+)\s*(.*)/i);
    if (match) {
        return (
            <>
                <span className="font-mono font-semibold text-[#1E3A5F] dark:text-blue-400 mr-1.5">
                    {match[1]}
                </span>
                <span>{match[2]}</span>
            </>
        );
    }
    return <span>{title}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionTitle({ children, count, number }: { children: React.ReactNode; count?: number; number?: number }) {
    return (
        <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-bold text-foreground tracking-wide uppercase">
                {number !== undefined && (
                    <span className="text-[#1E3A5F] dark:text-blue-400 mr-1.5">{number}.</span>
                )}
                {children}
            </h2>
            {count !== undefined && (
                <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5 tabular-nums">
                    {count.toLocaleString()}
                </span>
            )}
            <div className="flex-1 h-px bg-border" />
        </div>
    );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
    return (
        <th
            style={{ textAlign: right ? "right" : "left" }}
            className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-[#1E3A5F] border border-[#2D4F7C] whitespace-nowrap"
        >
            {children}
        </th>
    );
}

function Td({ children, right, bold, muted, color }: {
    children: React.ReactNode; right?: boolean; bold?: boolean; muted?: boolean; color?: string;
}) {
    return (
        <td
            style={{ textAlign: right ? "right" : "left" }}
            className={cn(
                "px-3 py-1.5 text-xs border border-border whitespace-nowrap",
                right && "tabular-nums",
                bold && "font-semibold",
                muted && "text-muted-foreground",
                color
            )}
        >
            {children}
        </td>
    );
}

// ─── Executive Summary ────────────────────────────────────────────────────────
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
                    <thead>
                        <tr><Th>Metric</Th><Th right>Value</Th></tr>
                    </thead>
                    <tbody>
                        {rows.map(([label, value], i) => (
                            <tr key={label} className={i % 2 === 1 ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-background"}>
                                <Td bold>{label}</Td>
                                <Td right
                                    color={
                                        label === "Unresolved Cases" && unresolvedCount > 0
                                            ? "text-red-600 font-bold"
                                            : label === "Solved Rate"
                                            ? "text-emerald-600 font-semibold"
                                            : undefined
                                    }
                                >{value}</Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// ─── Generic Ranking Table ────────────────────────────────────────────────────
function RankingTable({
    items, nameHeader, limit = 50,
}: {
    items: { name: string; value?: number; [year: string]: any }[];
    nameHeader: string;
    limit?: number;
}) {
    if (!items || items.length === 0) return (
        <p className="text-xs text-muted-foreground italic">No data available.</p>
    );

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
                        <Th>#</Th>
                        <Th>{nameHeader}</Th>
                        {isMulti
                            ? yearKeys.map(y => <Th key={y} right>{y}</Th>)
                            : <Th right>Cases</Th>
                        }
                        {isMulti && <Th right>Total</Th>}
                        {hasChange && <Th right>Change ({fromYear}→{toYear})</Th>}
                    </tr>
                </thead>
                <tbody>
                    {sliced.map((item, i) => {
                        const stripe    = i % 2 === 1;
                        const total     = isMulti
                            ? yearKeys.reduce((s, y) => s + (item[y] ?? 0), 0)
                            : (item.value ?? 0);
                        const prev      = hasChange ? (item[fromYear] ?? 0) : 0;
                        const curr      = hasChange ? (item[toYear]   ?? 0) : 0;
                        const change    = curr - prev;
                        const pct       = prev !== 0 ? Math.round((change / prev) * 100) : null;
                        const changeStr = change === 0
                            ? "—"
                            : `${change > 0 ? "+" : ""}${change.toLocaleString()}${pct !== null ? ` (${change > 0 ? "+" : ""}${pct}%)` : ""}`;

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
                                {hasChange && (
                                    <Td right bold
                                        color={change > 0 ? "text-red-600" : change < 0 ? "text-emerald-600" : "text-muted-foreground"}
                                    >
                                        {changeStr}
                                    </Td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Monthly Stats ────────────────────────────────────────────────────────────
function MonthlyStatsSection({ monthly, sectionNumber }: { monthly: Record<string, any>[]; sectionNumber?: number }) {
    if (!monthly || monthly.length === 0) return null;
    const yearKeys = Object.keys(monthly[0]).filter(k => /^\d{4}$/.test(k)).sort();
    if (yearKeys.length === 0) return null;

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
                            const vals   = yearKeys.map(y => (row[y] ?? 0) as number);
                            const total  = vals.reduce((s, v) => s + v, 0);
                            const prev   = hasChange ? (row[fromYear] ?? 0) as number : 0;
                            const curr   = hasChange ? (row[toYear]   ?? 0) as number : 0;
                            const change = curr - prev;
                            const pct    = prev !== 0 ? Math.round((change / prev) * 100) : null;
                            const chStr  = change === 0 ? "—" : `${change > 0 ? "+" : ""}${change.toLocaleString()}${pct !== null ? ` (${change > 0 ? "+" : ""}${pct}%)` : ""}`;

                            return (
                                <tr key={i} className={stripe ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-background"}>
                                    <Td bold>{row.month ?? ""}</Td>
                                    {yearKeys.map(y => (
                                        <Td key={y} right muted={(row[y] ?? 0) === 0}>
                                            {row[y] !== undefined ? (row[y] as number).toLocaleString() : "—"}
                                        </Td>
                                    ))}
                                    <Td right bold>{total.toLocaleString()}</Td>
                                    {hasChange && (
                                        <Td right bold color={change > 0 ? "text-red-600" : change < 0 ? "text-emerald-600" : "text-muted-foreground"}>
                                            {chStr}
                                        </Td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// ─── Module Trends ────────────────────────────────────────────────────────────
function TrendsSection({ trends, trendPeriod, sectionNumber }: { trends: ModuleTrend[]; trendPeriod: string; sectionNumber?: number }) {
    if (!trends || trends.length === 0) return (
        <section>
            <SectionTitle number={sectionNumber}>Case Trend — {trendPeriod.charAt(0).toUpperCase() + trendPeriod.slice(1)}</SectionTitle>
            <p className="text-xs text-muted-foreground italic">No trend data available.</p>
        </section>
    );

    return (
        <section>
            <SectionTitle number={sectionNumber}>Case Trend — {trendPeriod.charAt(0).toUpperCase() + trendPeriod.slice(1)}</SectionTitle>
            <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-auto border-collapse text-xs">
                    <thead>
                        <tr>
                            <Th>Module</Th>
                            <Th right>Previous</Th>
                            <Th right>Current</Th>
                            <Th right>Change</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {trends.map((t, i) => {
                            const pct    = t.change_pct ?? (t.previous !== 0 ? Math.round((t.change / t.previous) * 100) : null);
                            const chStr  = `${t.direction === "up" ? "+" : ""}${t.change}${pct !== null ? ` (${t.direction === "up" ? "+" : ""}${pct}%)` : ""}`;
                            const stripe = i % 2 === 1;
                            return (
                                <tr key={i} className={stripe ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-background"}>
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
                                    <Td right bold
                                        color={t.direction === "up" ? "text-red-600" : t.direction === "down" ? "text-emerald-600" : "text-muted-foreground"}
                                    >
                                        {chStr}
                                    </Td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// ─── Unresolved Cases ─────────────────────────────────────────────────────────
function UnresolvedSection({ cases, sectionNumber }: { cases: UnresolvedCase[]; sectionNumber?: number }) {
    const STATUS_ORDER: Record<string, number> = { l3: 0, l2: 1, l1: 2, pending: 3, "on hold": 4 };
    const sorted = [...cases].sort((a, b) => {
        const ao = STATUS_ORDER[a.status.toLowerCase()] ?? 99;
        const bo = STATUS_ORDER[b.status.toLowerCase()] ?? 99;
        return ao - bo;
    });

    const hasModule    = cases.some(c => c.module?.trim());
    const hasDetail    = cases.some(c => c.detail_module?.trim());
    const hasCreatedAt = cases.some(c => c.created_at?.trim());

    return (
        <section>
            <SectionTitle count={cases.length} number={sectionNumber}>
                Outstanding Unresolved Cases
            </SectionTitle>
            {cases.length === 0 ? (
                <div className="flex items-center gap-2 py-4 px-3 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 text-sm">
                    <span>✓</span>
                    <span className="font-medium">All cases have been resolved.</span>
                </div>
            ) : (
                <>
                    <p className="text-[11px] text-muted-foreground mb-2 italic">
                        Sorted by severity: L3 → L2 → L1 → Pending → On Hold
                    </p>
                    <div className="overflow-x-auto rounded-md border border-red-200">
                        <table className="w-auto border-collapse text-xs">
                            <thead>
                                <tr>
                                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-[#7F1D1D] border border-[#991B1B] text-left whitespace-nowrap">#</th>
                                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-[#7F1D1D] border border-[#991B1B] text-left whitespace-nowrap">Client</th>
                                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-[#7F1D1D] border border-[#991B1B] text-left whitespace-nowrap">Case / Title</th>
                                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-[#7F1D1D] border border-[#991B1B] text-center whitespace-nowrap">Status</th>
                                    {hasModule    && <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-[#7F1D1D] border border-[#991B1B] text-left whitespace-nowrap">Module</th>}
                                    {hasDetail    && <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-[#7F1D1D] border border-[#991B1B] text-left whitespace-nowrap">Detail Module</th>}
                                    {hasCreatedAt && <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-[#7F1D1D] border border-[#991B1B] text-center whitespace-nowrap">Created At</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((c, i) => {
                                    const stripe = i % 2 === 1;
                                    let displayDate = c.created_at ?? "—";
                                    if (displayDate !== "—") {
                                        try {
                                            const d = new Date(displayDate);
                                            if (!isNaN(d.getTime())) displayDate = format(d, "d MMM yyyy HH:mm");
                                        } catch { /* leave as-is */ }
                                    }
                                    return (
                                        <tr key={i} className={stripe ? "bg-red-50/60 dark:bg-red-950/20" : "bg-white dark:bg-background"}>
                                            <td className="px-3 py-1.5 text-xs border border-border text-muted-foreground text-right tabular-nums">{i + 1}</td>
                                            <td className="px-3 py-1.5 text-xs border border-border font-medium whitespace-nowrap">{c.client_name}</td>

                                            {/* ── Case / Title — ticket number di-highlight ── */}
                                            <td className="px-3 py-1.5 text-xs border border-border max-w-[320px]">
                                                <span className="line-clamp-2">
                                                    <CaseTitle title={c.title} />
                                                </span>
                                            </td>

                                            <td className="px-3 py-1.5 text-xs border border-border text-center">
                                                <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", statusBadgeClass(c.status))}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            {hasModule    && <td className="px-3 py-1.5 text-xs border border-border text-muted-foreground whitespace-nowrap">{c.module || "—"}</td>}
                                            {hasDetail    && <td className="px-3 py-1.5 text-xs border border-border text-muted-foreground whitespace-nowrap">{c.detail_module || "—"}</td>}
                                            {hasCreatedAt && <td className="px-3 py-1.5 text-xs border border-border text-center text-muted-foreground tabular-nums whitespace-nowrap">{displayDate}</td>}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </section>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: ReportPreviewModal
// ─────────────────────────────────────────────────────────────────────────────
export function ReportPreviewModal({ open, onClose, stats, filterSummary }: ReportPreviewModalProps) {
    const { toast }       = useToast();
    const [isDownloading, setIsDownloading] = useState(false);
    const [unresolvedCases, setUnresolvedCases] = useState<UnresolvedCase[]>(stats.unresolved_cases ?? []);
    const [loadingCases, setLoadingCases]       = useState(false);

    const fetchUnresolved = useCallback(async () => {
        if (unresolvedCases.length > 0) return;
        setLoadingCases(true);
        try {
            const cases = await getL3CasesForReport();
            setUnresolvedCases(cases);
        } catch {
            // fallback ke data yang sudah ada
        } finally {
            setLoadingCases(false);
        }
    }, [unresolvedCases.length]);

    if (open && unresolvedCases.length === 0 && !loadingCases) {
        fetchUnresolved();
    }

    const handleDownload = useCallback(async () => {
        setIsDownloading(true);
        toast({ title: "Generating Report…", description: "Menyiapkan laporan Word, harap tunggu." });
        try {
            const response = await fetch("/api/dashboard/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    stats:         { ...stats, unresolved_cases: unresolvedCases },
                    filterSummary,
                }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(err.error ?? `HTTP ${response.status}`);
            }
            const blob = await response.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href     = url;
            a.download = `dashboard-report-${new Date().toISOString().slice(0, 10)}.docx`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast({ title: "Download selesai!", description: `${unresolvedCases.length} unresolved case(s) disertakan.` });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Download gagal", description: err.message });
        } finally { setIsDownloading(false); }
    }, [stats, filterSummary, unresolvedCases, toast]);

    const filterParts = useMemo(() => {
        const parts: string[] = [];
        if (filterSummary.years?.length)        parts.push(`Years: ${filterSummary.years.join(", ")}`);
        if (filterSummary.dateRange)             parts.push(`Date: ${filterSummary.dateRange}`);
        if (filterSummary.categories?.length)    parts.push(`Categories: ${filterSummary.categories.length}`);
        if (filterSummary.clients?.length)       parts.push(`Clients: ${filterSummary.clients.length}`);
        if (filterSummary.modules?.length)       parts.push(`Modules: ${filterSummary.modules.length}`);
        if (filterSummary.detailModules?.length) parts.push(`Detail Modules: ${filterSummary.detailModules.length}`);
        return parts.length ? parts : ["No filters applied — showing all data"];
    }, [filterSummary]);

    const detailModules = stats.detail_module_rankings ?? stats.module_rankings ?? [];

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative z-10 flex flex-col w-full max-w-5xl max-h-[92vh] mx-4 rounded-xl border bg-background shadow-2xl overflow-hidden">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 py-3 border-b bg-[#1E3A5F] shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-blue-300 flex-shrink-0" />
                        <div className="min-w-0">
                            <h1 className="text-sm font-bold text-white">Dashboard Report Preview</h1>
                            <p className="text-[10px] text-blue-300 truncate max-w-[480px]">
                                {filterParts.join("  ·  ")}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                            size="sm"
                            onClick={handleDownload}
                            disabled={isDownloading}
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
                        <button
                            onClick={onClose}
                            className="rounded-sm p-1 text-blue-300 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* ── Timestamp bar ── */}
                <div className="flex items-center gap-2 px-5 py-1.5 bg-muted/40 border-b shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                        Generated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                        {" "}·{" "}
                        Trend period: <span className="font-semibold">{filterSummary.trendPeriod}</span>
                    </span>
                    {loadingCases && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground animate-pulse ml-auto">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Loading unresolved cases…
                        </span>
                    )}
                </div>

                {/* ── Scrollable Content ── */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="p-5 space-y-6">

                        {/* 1. Executive Summary */}
                        <SummarySection stats={stats} unresolvedCount={unresolvedCases.length} sectionNumber={1} />

                        {/* 2. Category Rankings */}
                        {(stats.category_rankings?.length ?? 0) > 0 && (
                            <section>
                                <SectionTitle number={2}>Category Rankings</SectionTitle>
                                <RankingTable items={stats.category_rankings!} nameHeader="Category" />
                            </section>
                        )}

                        {/* 3. Case Trend */}
                        <TrendsSection trends={stats.module_trends ?? []} trendPeriod={filterSummary.trendPeriod} sectionNumber={3} />

                        {/* 4. Monthly Statistics */}
                        <MonthlyStatsSection monthly={stats.monthly_stats ?? []} sectionNumber={4} />

                        {/* 5. Client Rankings */}
                        {stats.client_rankings?.length > 0 && (
                            <section>
                                <SectionTitle count={stats.client_rankings.length} number={5}>Client Rankings</SectionTitle>
                                <RankingTable items={stats.client_rankings} nameHeader="Client" />
                            </section>
                        )}

                        {/* 6. Detail Module Rankings */}
                        {detailModules.length > 0 && (
                            <section>
                                <SectionTitle number={6}>Detail Module Rankings</SectionTitle>
                                <RankingTable items={detailModules} nameHeader="Detail Module" />
                            </section>
                        )}

                        {/* 7. Unresolved Cases */}
                        <UnresolvedSection cases={unresolvedCases} sectionNumber={7} />

                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-between px-5 py-2.5 border-t bg-muted/30 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                        {stats.summary.total_cases.toLocaleString()} total cases
                        {" "}·{" "}
                        {stats.summary.total_clients ?? 0} clients
                        {" "}·{" "}
                        {unresolvedCases.length} unresolved
                    </span>
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}