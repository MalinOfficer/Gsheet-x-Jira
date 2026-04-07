/*Dashboard.tsx*/
"use client";

import { BarChart as BarChartIcon, CheckCircle, FolderKanban, Filter, RefreshCw, FilterX, AlertTriangle, Calendar as CalendarIcon, X, GripHorizontal, Maximize2, Minimize2, ChevronDown, Check, Layers, TrendingUp, TrendingDown, Minus, Download, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useContext, useState, useEffect, useTransition, useCallback, useMemo, useRef } from "react";
import { TableDataContext } from "@/store/table-data-context";
import { Area, AreaChart, Legend, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { getDashboardFilterOptions, refreshDashboardViews, getL3CasesForReport } from "@/app/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelect } from "@/components/ui/multi-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { format, getISOWeek, getQuarter, subDays, subWeeks, subQuarters, subMonths, startOfISOWeek, endOfISOWeek, startOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "./ui/separator";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { ReportPreviewModal } from "@/components/report-preview-modal";


// ─────────────────────────────────────────────────────────────────────────────
// Module-level cache
// ─────────────────────────────────────────────────────────────────────────────
type CacheEntry = {
    stats: DashboardStats;
    filtersKey: string;
    timestamp: number;
};

const _dashboardCache: { current: CacheEntry | null } = { current: null };

function buildFiltersKey(filters: {
    selectedYears: string[];
    categoryFilter: string[];
    clientFilter: string[];
    moduleFilter: string[];
    detailModuleFilter: string[];
    dateRange?: DateRange;
    trendPeriod: TrendPeriod;
}): string {
    return JSON.stringify({
        y:  [...filters.selectedYears].sort(),
        c:  [...filters.categoryFilter].sort(),
        cl: [...filters.clientFilter].sort(),
        m:  [...filters.moduleFilter].sort(),
        dm: [...filters.detailModuleFilter].sort(),
        dr: filters.dateRange ? `${filters.dateRange.from}_${filters.dateRange.to}` : '',
        tp: filters.trendPeriod,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type TrendPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

type UnresolvedCase = {
    client_name: string;
    title: string;
    status: string;
    module?: string;
    detail_module?: string;
    created_at?: string;
};

const TREND_PERIOD_OPTIONS: { value: TrendPeriod; label: string }[] = [
    { value: 'daily',     label: 'D' },
    { value: 'weekly',    label: 'W' },
    { value: 'monthly',   label: 'M' },
    { value: 'quarterly', label: 'Q' },
];

const CHART_HEX_COLORS = [
    "#3b82f6",
    "#22c55e",
    "#eab308",
    "#f97316",
    "#ef4444",
];

const chartConfig = {
    solved:    { label: "Solved",   color: "#22c55e" },
    unsolved:  { label: "Unsolved", color: "#ef4444" },
    L1:        { label: "L1",       color: "#3b82f6" },
    L2:        { label: "L2",       color: "#eab308" },
    L3:        { label: "L3",       color: "#f97316" },
    'N/A':     { label: 'N/A',      color: '#94a3b8' },
    'PENDING': { label: 'Pending',  color: '#ef4444' },
    'ON HOLD': { label: 'On Hold',  color: '#ef4444' },
    'OPEN':    { label: 'Open',     color: '#3b82f6' },
    'RESOLVED':{ label: 'Solved',   color: '#22c55e' },
    clients:   { label: "Clients",  color: "#22c55e" },
    modules:   { label: "Modules",  color: "#3b82f6" },
} satisfies ChartConfig;

type IndexableChartConfig = Record<string, { label: string; color: string }>;

type ModuleTrend = {
    name: string;
    current: number;
    previous: number;
    change: number;
    change_pct?: number | null;
    direction: 'up' | 'down' | 'stable';
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
    monthly_stats: any[];
    client_rankings: { name: string; value: number }[];
    module_rankings: { name: string; value: number }[];
    detail_module_rankings: { name: string; value: number }[];
    module_trends: ModuleTrend[];
    unresolved_cases?: UnresolvedCase[];
};

type FilterOptions = {
    categories:    { label: string; value: string }[];
    clients:       { label: string; value: string }[];
    modules:       { label: string; value: string }[];
    detailModules: { label: string; value: string }[];
    years:         string[];
};

interface DashboardProps {
    initialStats:   DashboardStats | null;
    initialOptions: FilterOptions | null;
    defaultYears?:  string[];
    error?:         string | null;
}

const UNRESOLVED_STATUSES = new Set(['l1', 'l2', 'l3', 'pending', 'on hold']);

function buildUnresolvedFromTableData(rows: any[]): UnresolvedCase[] {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows
        .filter(r => {
            const status = String(r.Status ?? r.status ?? r.status_case ?? '').toLowerCase().trim();
            return UNRESOLVED_STATUSES.has(status);
        })
        .map(r => ({
            client_name:   String(r['Client Name'] ?? r.client_name ?? '').trim() || '—',
            title:         String(r.Title ?? r.title ?? r['Detail Case'] ?? r.detail_case ?? '').trim() || '—',
            status:        String(r.Status ?? r.status ?? r.status_case ?? '').trim() || '—',
            module:        String(r.Module ?? r.module ?? r.module_case ?? '').trim(),
            detail_module: String(r['Detail Module'] ?? r.detail_module ?? '').trim(),
            created_at:    String(r['Created At'] ?? r.created_at ?? r.check_in ?? '').trim(),
        }))
        .filter(c => c.client_name !== '—' && c.title !== '—' && c.status !== '—');
}

function isSubstantiallyComplete(period: TrendPeriod): boolean {
    const now   = new Date();
    const day   = now.getDate();
    const month = now.getMonth();
    switch (period) {
        case 'daily':     return now.getHours() >= 18;
        case 'weekly':    return now.getDay() >= 4;
        case 'monthly':   return day >= 20;
        case 'quarterly': return [2, 5, 8, 11].includes(month) && day >= 15;
    }
}

function getTrendComparisonInfo(period: TrendPeriod): { label: string; tooltip: string } {
    const now             = new Date();
    const includesCurrent = isSubstantiallyComplete(period);
    const prevOffset      = includesCurrent ? 1 : 2;
    const currentOffset   = includesCurrent ? 0 : 1;

    if (period === 'daily') {
        const d1 = subDays(now, prevOffset);
        const d2 = subDays(now, currentOffset);
        return { label: `${format(d1, 'd MMM')} vs ${format(d2, 'd MMM')}`, tooltip: `${format(d1, 'EEE d MMM yyyy')}  vs  ${format(d2, 'EEE d MMM yyyy')}` };
    }
    if (period === 'weekly') {
        const w1Start = startOfISOWeek(subWeeks(now, prevOffset));
        const w1End   = endOfISOWeek(subWeeks(now, prevOffset));
        const w2Start = startOfISOWeek(subWeeks(now, currentOffset));
        const w2End   = endOfISOWeek(subWeeks(now, currentOffset));
        return { label: `W${getISOWeek(w1Start)} vs W${getISOWeek(w2Start)}`, tooltip: `${format(w1Start, 'd MMM')}–${format(w1End, 'd MMM')}  vs  ${format(w2Start, 'd MMM')}–${format(w2End, 'd MMM yyyy')}` };
    }
    if (period === 'monthly') {
        const m1 = subMonths(now, prevOffset);
        const m2 = subMonths(now, currentOffset);
        return { label: `${format(m1, 'MMM')} vs ${format(m2, 'MMM')}`, tooltip: `${format(startOfMonth(m1), 'MMM yyyy')}  vs  ${format(startOfMonth(m2), 'MMM yyyy')}` };
    }
    if (period === 'quarterly') {
        const q1 = subQuarters(now, prevOffset);
        const q2 = subQuarters(now, currentOffset);
        const sameYear = q1.getFullYear() === q2.getFullYear();
        return {
            label: sameYear ? `Q${getQuarter(q1)} vs Q${getQuarter(q2)}` : `Q${getQuarter(q1)} '${String(q1.getFullYear()).slice(2)} vs Q${getQuarter(q2)} '${String(q2.getFullYear()).slice(2)}`,
            tooltip: `${format(startOfQuarter(q1), 'MMM')}–${format(endOfQuarter(q1), 'MMM yyyy')}  vs  ${format(startOfQuarter(q2), 'MMM')}–${format(endOfQuarter(q2), 'MMM yyyy')}`,
        };
    }
    return { label: 'vs last period', tooltip: '' };
}

function derivePct(trend: ModuleTrend): number | null {
    if (trend.change_pct !== undefined && trend.change_pct !== null) return trend.change_pct;
    if (trend.previous === 0) return null;
    return Math.round((trend.change / trend.previous) * 100);
}

function getDefault3RecentYears(years: string[]): string[] {
    return [...years].sort((a, b) => parseInt(b) - parseInt(a)).slice(0, 3).sort((a, b) => parseInt(a) - parseInt(b));
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function TrendIcon({ direction }: { direction: 'up' | 'down' | 'stable' }) {
    if (direction === 'up')   return <TrendingUp   className="h-3 w-3 text-red-500 flex-shrink-0" />;
    if (direction === 'down') return <TrendingDown className="h-3 w-3 text-emerald-500 flex-shrink-0" />;
    return <Minus className="h-3 w-3 text-muted-foreground flex-shrink-0" />;
}

function trendColor(direction: 'up' | 'down' | 'stable'): string {
    if (direction === 'up')   return 'text-red-600';
    if (direction === 'down') return 'text-emerald-500';
    return 'text-muted-foreground';
}

// ─────────────────────────────────────────────────────────────────────────────
// DraggableFilterPanel
// ─────────────────────────────────────────────────────────────────────────────
interface DraggableFilterPanelProps {
    open: boolean; onClose: () => void; children: React.ReactNode; activeCount: number;
    headerRef?: React.RefObject<HTMLDivElement | null>;
}

function DraggableFilterPanel({ open, onClose, children, activeCount, headerRef }: DraggableFilterPanelProps) {
    const panelRef  = useRef<HTMLDivElement>(null);
    const dragState = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => { if (!open) setPos(null); }, [open]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (!panelRef.current) return;
        const rect = panelRef.current.getBoundingClientRect();
        dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: pos?.x ?? rect.left, origY: pos?.y ?? rect.top };
        e.preventDefault();
        const onMouseMove = (ev: MouseEvent) => {
            if (!dragState.current.dragging) return;
            setPos({ x: dragState.current.origX + (ev.clientX - dragState.current.startX), y: dragState.current.origY + (ev.clientY - dragState.current.startY) });
        };
        const onMouseUp = () => { dragState.current.dragging = false; window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
        window.addEventListener("mousemove", onMouseMove); window.addEventListener("mouseup", onMouseUp);
    }, [pos]);

    if (!open) return null;

    const style: React.CSSProperties = pos
        ? { position: "fixed", left: pos.x, top: pos.y, zIndex: 50 }
        : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 50 };

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div ref={panelRef} style={style} className="w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl">
                <div ref={headerRef} onMouseDown={onMouseDown} className="flex items-center justify-between px-4 py-2.5 border-b cursor-grab active:cursor-grabbing select-none bg-muted/50 rounded-t-lg">
                    <div className="flex items-center gap-2">
                        <GripHorizontal className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">Filter Options</span>
                        {activeCount > 0 && <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs font-semibold">{activeCount}</span>}
                    </div>
                    <button onClick={onClose} className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"><X className="h-4 w-4" /></button>
                </div>
                <ScrollArea className="max-h-[75vh]"><div className="p-4 space-y-4">{children}</div></ScrollArea>
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// YearMultiSelect
// ─────────────────────────────────────────────────────────────────────────────
interface YearMultiSelectProps { years: string[]; selectedYears: string[]; onChange: (years: string[]) => void; }

function YearMultiSelect({ years, selectedYears, onChange }: YearMultiSelectProps) {
    const [open, setOpen] = useState(false);
    const allSelected     = selectedYears.length === years.length;
    const noneSelected    = selectedYears.length === 0;

    const toggleYear = (year: string) => {
        if (allSelected) { onChange([year]); return; }
        if (selectedYears.includes(year)) { if (selectedYears.length === 1) return; onChange(selectedYears.filter(y => y !== year)); }
        else onChange([...selectedYears, year].sort((a, b) => parseInt(a) - parseInt(b)));
    };

    const toggleAll = () => {
        if (allSelected) onChange(years.length > 0 ? [years[years.length - 1]] : []);
        else onChange([...years]);
    };

    const label = useMemo(() => {
        if (noneSelected || allSelected) return "All Years";
        if (selectedYears.length === 1) return selectedYears[0];
        return `${selectedYears.length} Years`;
    }, [selectedYears, allSelected, noneSelected]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full sm:w-[160px] justify-between font-normal", !allSelected && !noneSelected && "border-primary text-primary")}>
                    <span className="truncate">{label}</span>
                    <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
                <button onClick={toggleAll} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors">
                    <div className={cn("flex h-4 w-4 items-center justify-center rounded border", allSelected ? "bg-primary border-primary text-primary-foreground" : "border-input")}>
                        {allSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="font-medium">All Years</span>
                </button>
                <div className="my-1 border-t" />
                {[...years].sort((a, b) => parseInt(b) - parseInt(a)).map((year) => {
                    const checked = selectedYears.includes(year);
                    const isLast  = selectedYears.length === 1 && checked;
                    return (
                        <button key={year} onClick={() => toggleYear(year)} disabled={isLast}
                            className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors", isLast ? "opacity-50 cursor-not-allowed" : "hover:bg-accent hover:text-accent-foreground")}>
                            <div className={cn("flex h-4 w-4 items-center justify-center rounded border", checked ? "bg-primary border-primary text-primary-foreground" : "border-input")}>
                                {checked && <Check className="h-3 w-3" />}
                            </div>
                            <span>{year}</span>
                        </button>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TrendPeriodDropdown
// ─────────────────────────────────────────────────────────────────────────────
const TREND_PERIOD_FULL: Record<TrendPeriod, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' };

function TrendPeriodDropdown({ value, onChange }: { value: TrendPeriod; onChange: (v: TrendPeriod) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-accent transition-colors leading-none">
                    {TREND_PERIOD_FULL[value]}<ChevronDown className="h-3 w-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start" side="bottom">
                {TREND_PERIOD_OPTIONS.map(opt => {
                    const { tooltip } = getTrendComparisonInfo(opt.value);
                    return (
                        <TooltipProvider key={opt.value} delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button onClick={() => { onChange(opt.value); setOpen(false); }}
                                        className={cn("flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors",
                                            value === opt.value ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-accent hover:text-accent-foreground")}>
                                        <span>{TREND_PERIOD_FULL[opt.value]}</span>
                                        {value === opt.value && <Check className="h-3 w-3" />}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="text-xs max-w-[180px]">
                                    <p className="font-medium mb-0.5">{TREND_PERIOD_FULL[opt.value]}</p>
                                    <p className="text-muted-foreground">{tooltip}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SkeletonDashboard
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonDashboard() {
    return (
        <div className="flex-1 bg-background text-foreground p-40 sm:p-6 md:p-4">
            <div className="max-w-7xl mx-auto space-y-4">
                <style>{`@media (min-width: 1024px) { .header-cards-grid { grid-template-columns: repeat(4, 7fr) 12fr !important; } }`}</style>
                <div className="header-cards-grid grid gap-4 md:grid-cols-2 md:gap-8">
                    <Skeleton className="h-[88px]" /><Skeleton className="h-[88px]" />
                    <Skeleton className="h-[88px]" /><Skeleton className="h-[88px]" />
                    <Skeleton className="h-[88px]" />
                </div>
                <Skeleton className="h-[300px] w-full" />
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-[250px]" /><Skeleton className="h-[250px]" />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────────────────────────────
export function Dashboard({ initialStats, initialOptions, defaultYears, error: initialError }: DashboardProps) {
    const { setIsProcessing }   = useContext(TableDataContext);
    const { toast }             = useToast();
    const { prefs, updatePref } = useUserPreferences();

    const [stats, setStats]                 = useState<DashboardStats | null>(_dashboardCache.current?.stats ?? initialStats ?? null);
    const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(initialOptions);
    const [error, setError]                 = useState<string | null>(initialError || null);
    const [isApplyingFilters, startApplyingFilters] = useTransition();
    const [isRefreshing, setIsRefreshing]   = useState(false);
    const [isRevalidating, setIsRevalidating] = useState(false);
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    const [openFilter, setOpenFilter] = useState<string | null>(null);
    const filterPanelHeaderRef = useRef<HTMLDivElement>(null);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [isFullscreen, setIsFullscreen]   = useState(false);
    const [hasMounted, setHasMounted]       = useState(false);
    const [trendPeriod, setTrendPeriod]     = useState<TrendPeriod>(prefs.dashboardTrendPeriod ?? 'monthly');

    const hasLoadedOnce        = useRef<boolean>(_dashboardCache.current !== null || initialStats !== null);
    const requestIdRef         = useRef(0);
    const trendPeriodSyncedRef = useRef(false);

    const [selectedYears, setSelectedYears]           = useState<string[]>([]);
    const [categoryFilter, setCategoryFilter]         = useState<string[]>([]);
    const [clientFilter, setClientFilter]             = useState<string[]>([]);
    const [moduleFilter, setModuleFilter]             = useState<string[]>([]);
    const [detailModuleFilter, setDetailModuleFilter] = useState<string[]>([]);
    const [dateRange, setDateRange]                   = useState<DateRange | undefined>(undefined);

    useEffect(() => {
        if (trendPeriodSyncedRef.current || !prefs.dashboardTrendPeriod) return;
        setTrendPeriod(prefs.dashboardTrendPeriod);
        trendPeriodSyncedRef.current = true;
    }, [prefs.dashboardTrendPeriod]);

    const handleTrendPeriodChange = useCallback((period: TrendPeriod) => {
        setTrendPeriod(period); updatePref('dashboardTrendPeriod', period);
    }, [updatePref]);

    useEffect(() => {
        setHasMounted(true);
        if (defaultYears?.length) setSelectedYears(defaultYears);
        else if (prefs.dashboardDefaultYears?.length) setSelectedYears(prefs.dashboardDefaultYears);
        else if (initialOptions?.years?.length) setSelectedYears(getDefault3RecentYears(initialOptions.years));
    }, [initialOptions, defaultYears]);

    const yearsSyncedRef = useRef(false);
    useEffect(() => {
        if (yearsSyncedRef.current || !prefs.dashboardDefaultYears?.length) return;
        if (selectedYears.length > 0) { yearsSyncedRef.current = true; return; }
        setSelectedYears(prefs.dashboardDefaultYears);
        yearsSyncedRef.current = true;
    }, [prefs.dashboardDefaultYears]);

    const prevYearsRef = useRef<string[]>(initialOptions?.years ?? []);
    useEffect(() => {
        if (!filterOptions?.years) return;
        const added = filterOptions.years.filter(y => !prevYearsRef.current.includes(y));
        if (added.length > 0) setSelectedYears(getDefault3RecentYears(filterOptions.years));
        prevYearsRef.current = filterOptions.years;
    }, [filterOptions?.years]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isFullscreen]);

    const yearColorConfig = useMemo(() => {
        const allYears = filterOptions?.years?.slice().sort((a, b) => parseInt(a) - parseInt(b)) || [];
        const config: ChartConfig = {};
        allYears.forEach((year, index) => {
            config[year] = { label: year, color: CHART_HEX_COLORS[index % CHART_HEX_COLORS.length] };
        });
        return config;
    }, [filterOptions?.years]);

    const { chartKeys, dynamicChartConfig } = useMemo(() => {
        const baseConfig: IndexableChartConfig = { ...chartConfig, ...yearColorConfig };
        if (!stats?.monthly_stats?.length) return { chartKeys: [], dynamicChartConfig: baseConfig };
        const keysInData = new Set<string>();
        stats.monthly_stats.forEach(m => Object.keys(m).forEach(k => { if (/^\d{4}$/.test(k)) keysInData.add(k); }));
        const sortedKeys = selectedYears.filter(y => keysInData.has(y)).sort((a, b) => parseInt(a) - parseInt(b));
        return { chartKeys: sortedKeys, dynamicChartConfig: baseConfig };
    }, [stats?.monthly_stats, yearColorConfig, selectedYears]);

    useEffect(() => { setIsProcessing(isApplyingFilters || isRefreshing); }, [isApplyingFilters, isRefreshing, setIsProcessing]);

    const allYearsSelected = useMemo(() => {
        const available = filterOptions?.years ?? [];
        return available.length > 0 && selectedYears.length === available.length;
    }, [selectedYears, filterOptions?.years]);

    const areFiltersActive = useMemo(() => (
        dateRange !== undefined || !allYearsSelected ||
        categoryFilter.length > 0 || clientFilter.length > 0 ||
        moduleFilter.length > 0 || detailModuleFilter.length > 0
    ), [dateRange, allYearsSelected, categoryFilter, clientFilter, moduleFilter, detailModuleFilter]);

    const activeFilterCount = useMemo(() => [
        categoryFilter.length, clientFilter.length, moduleFilter.length,
        detailModuleFilter.length, dateRange ? 1 : 0, !allYearsSelected ? 1 : 0,
    ].reduce((a, b) => a + b, 0), [categoryFilter, clientFilter, moduleFilter, detailModuleFilter, dateRange, allYearsSelected]);

    const handleClearAllFilters = useCallback(() => {
        const defaultYearsValue = filterOptions?.years?.length ? getDefault3RecentYears(filterOptions.years) : [];
        if (defaultYearsValue.length) { setSelectedYears(defaultYearsValue); updatePref('dashboardDefaultYears', defaultYearsValue); }
        setCategoryFilter([]); setClientFilter([]); setModuleFilter([]); setDetailModuleFilter([]); setDateRange(undefined);
    }, [filterOptions?.years, updatePref]);

    const handleYearsChange = useCallback((years: string[]) => {
        setSelectedYears(years); updatePref('dashboardDefaultYears', years);
    }, [updatePref]);

    const { label: trendComparisonLabel, tooltip: trendComparisonTooltip } = useMemo(
        () => getTrendComparisonInfo(trendPeriod), [trendPeriod]
    );

    const fetcher = useCallback(async (filters: {
        selectedYears: string[]; categoryFilter: string[]; clientFilter: string[];
        moduleFilter: string[]; detailModuleFilter: string[]; dateRange?: DateRange; trendPeriod: TrendPeriod;
    }) => {
        const params = new URLSearchParams();
        if (filters.dateRange) params.append('dateRange', JSON.stringify(filters.dateRange));
        params.append('selectedYears',      filters.selectedYears.join(','));
        params.append('categoryFilter',     filters.categoryFilter.join(','));
        params.append('clientFilter',       filters.clientFilter.join(','));
        params.append('moduleFilter',       filters.moduleFilter.join(','));
        params.append('detailModuleFilter', filters.detailModuleFilter.join(','));
        params.append('trendPeriod',        filters.trendPeriod);
        const response = await fetch(`/api/dashboard?${params.toString()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Failed to fetch dashboard data: ${response.status} ${await response.text()}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'An unknown error occurred');
        return result.data as DashboardStats;
    }, []);

    const currentFilters = useMemo(() => ({
        selectedYears, categoryFilter, clientFilter, moduleFilter, detailModuleFilter, dateRange, trendPeriod,
    }), [selectedYears, categoryFilter, clientFilter, moduleFilter, detailModuleFilter, dateRange, trendPeriod]);

    const reportFilterSummary = useMemo(() => ({
        years: selectedYears,
        dateRange: dateRange ? `${format(dateRange.from!, 'LLL dd, yyyy')}${dateRange.to ? ` – ${format(dateRange.to, 'LLL dd, yyyy')}` : ''}` : undefined,
        categories: categoryFilter, clients: clientFilter, modules: moduleFilter, detailModules: detailModuleFilter, trendPeriod,
    }), [selectedYears, dateRange, categoryFilter, clientFilter, moduleFilter, detailModuleFilter, trendPeriod]);

    const CACHE_TTL_MS = 5 * 60 * 1000;

    useEffect(() => {
        if (!hasMounted) return;
        const filtersKey   = buildFiltersKey(currentFilters);
        const cached       = _dashboardCache.current;
        const isCacheHit   = cached && cached.filtersKey === filtersKey;
        const isCacheFresh = isCacheHit && (Date.now() - cached.timestamp) < CACHE_TTL_MS;

        if (isCacheHit) {
            setStats(cached.stats); hasLoadedOnce.current = true;
            if (isCacheFresh) return;
            setIsRevalidating(true);
            fetcher(currentFilters).then(data => { _dashboardCache.current = { stats: data, filtersKey, timestamp: Date.now() }; setStats(data); }).catch(() => {}).finally(() => setIsRevalidating(false));
            return;
        }

        const requestId = ++requestIdRef.current;
        startApplyingFilters(async () => {
            setError(null);
            try {
                const data = await fetcher(currentFilters);
                if (requestId !== requestIdRef.current) return;
                _dashboardCache.current = { stats: data, filtersKey, timestamp: Date.now() };
                setStats(data); hasLoadedOnce.current = true;
            } catch (err: any) {
                if (requestId !== requestIdRef.current) return;
                setError(err.message); setStats(null);
                toast({ variant: "destructive", title: "Could not load dashboard data", description: err.message });
            }
        });
    }, [hasMounted, selectedYears, categoryFilter, clientFilter, moduleFilter, detailModuleFilter, dateRange, trendPeriod, fetcher]);

    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        toast({ title: "Refreshing...", description: "Syncing data terbaru." });
        try {
            await fetch('/api/dashboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: false }) });
            await refreshDashboardViews();
            const data = await fetcher(currentFilters);
            const filtersKey = buildFiltersKey(currentFilters);
            _dashboardCache.current = { stats: data, filtersKey, timestamp: Date.now() };
            setStats(data); hasLoadedOnce.current = true;
            toast({ title: "Refreshed!", description: "Dashboard data has been updated." });
            getDashboardFilterOptions().then(r => { if (!r.error && r.data) setFilterOptions(r.data); });
        } catch (err: any) {
            setError(err.message); setStats(null);
            toast({ variant: "destructive", title: "Refresh failed", description: err.message });
        } finally { setIsRefreshing(false); }
    }, [isRefreshing, currentFilters, fetcher, toast]);

    const handleForceReload = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        toast({ title: "Force reload semua data...", description: "Cache semua tahun dihapus." });
        try {
            await fetch('/api/dashboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) });
            await refreshDashboardViews();
            const data = await fetcher(currentFilters);
            const filtersKey = buildFiltersKey(currentFilters);
            _dashboardCache.current = { stats: data, filtersKey, timestamp: Date.now() };
            setStats(data); hasLoadedOnce.current = true;
            toast({ title: "Selesai", description: "Semua data dimuat ulang dari database." });
            getDashboardFilterOptions().then(r => { if (!r.error && r.data) setFilterOptions(r.data); });
        } catch (err: any) {
            setError(err.message); setStats(null);
            toast({ variant: "destructive", title: "Force reload gagal", description: err.message });
        } finally { setIsRefreshing(false); }
    }, [isRefreshing, currentFilters, fetcher, toast]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.ctrlKey && e.shiftKey && e.key === 'R') { e.preventDefault(); handleForceReload(); } };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleForceReload]);

    if (!hasMounted && !_dashboardCache.current) return <SkeletonDashboard />;
    if (!stats && isApplyingFilters) return <SkeletonDashboard />;

    if (error && !stats) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                        <CardTitle className="text-2xl font-bold">Failed to Load Dashboard Data</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">{error}</CardDescription>
                        <Button onClick={handleRefresh} disabled={isRefreshing}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />Try Again
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
                        <CardTitle className="text-2xl font-bold">No Data Found</CardTitle>
                        <p className="mt-2 text-muted-foreground">The database might be empty or inaccessible.</p>
                        <Button onClick={handleRefresh} disabled={isRefreshing} className="mt-4">
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />Refresh
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    const { client_rankings, module_rankings, detail_module_rankings } = stats;
    const detailModuleRankings   = detail_module_rankings ?? module_rankings ?? [];
    const maxClientValue         = client_rankings.length > 0 ? (client_rankings[0].value ?? 1) : 1;
    const maxDetailModuleValue   = detailModuleRankings.length > 0 ? (detailModuleRankings[0].value ?? 1) : 1;
    const totalClientsCount      = client_rankings.length;
    const totalDetailModuleCases = detailModuleRankings.reduce((sum, item) => sum + (item.value ?? 0), 0);
    const isUpdating             = (isApplyingFilters && hasLoadedOnce.current) || isRevalidating;

    return (
        // Wrapper luar: fixed height, no scroll
        <div className={cn("bg-background text-foreground transition-all duration-300",
            isFullscreen 
                ? "fixed inset-0 z-50 flex flex-col p-3 md:p-4 overflow-hidden" 
                : "flex-1 flex flex-col overflow-hidden p-2 sm:p-3 md:p-4")}>
            <div className={cn("mx-auto w-full flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-2",
                isFullscreen ? "max-w-none overflow-hidden" : "max-w-7xl")}>

                {isRevalidating && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse self-end">
                        <RefreshCw className="h-3 w-3 animate-spin" /><span>Memperbarui data...</span>
                    </div>
                )}

                {/* Header Cards */}
                <style>{`@media (min-width: 1024px) { .header-cards-grid { grid-template-columns: repeat(4, 7fr) 12fr !important; } }`}</style>
                <div className={cn("header-cards-grid grid gap-3 md:grid-cols-2 md:gap-4 shrink-0 transition-opacity duration-300", isUpdating ? "opacity-60" : "opacity-100")}>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-4 pb-1 pt-2 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Total Cases</CardTitle>
                            <BarChartIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pb-2 px-4"><div className="text-2xl font-bold">{stats.summary.total_cases}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-4 pb-1 pt-2 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Status Solved</CardTitle>
                            <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pb-2 px-4">
                            <div className="flex items-baseline gap-2">
                                <div className="text-2xl font-bold">{stats.summary.total_solved}</div>
                                {stats.summary.total_cases > 0 && (
                                    <span className="text-xs font-medium text-green-600 bg-card border border-green-300 dark:border-green-700 rounded-full px-2 py-0.5">
                                        {stats.summary.solved_percentage?.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-4 pb-1 pt-2 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Trending Category</CardTitle>
                            <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pb-2 px-4"><div className="text-2xl font-bold truncate">{stats.summary.trending_category}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-4 pb-1 pt-2 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Trend Module</CardTitle>
                            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pb-2 px-4">
                            <div className="text-2xl font-bold truncate">{stats.summary.trending_module ?? stats.summary.top_module ?? '—'}</div>
                        </CardContent>
                    </Card>
                    <Card className="flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2 px-4 shrink-0">
                            <div className="flex items-center gap-1 min-w-0">
                                <CardTitle className="text-xs font-medium text-muted-foreground flex-shrink-0">Case Trend</CardTitle>
                                <TrendPeriodDropdown value={trendPeriod} onChange={handleTrendPeriodChange} />
                            </div>
                            <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="text-[10px] text-muted-foreground/70 font-normal leading-none flex-shrink-0 tabular-nums underline decoration-dotted cursor-help">
                                            {trendComparisonLabel}
                                        </span>
                                    </TooltipTrigger>
                                    {trendComparisonTooltip && <TooltipContent side="bottom" className="text-xs"><p>{trendComparisonTooltip}</p></TooltipContent>}
                                </Tooltip>
                            </TooltipProvider>
                        </CardHeader>
                        <CardContent className="pb-2 px-4 flex-1 min-h-0">
                            {(!stats.module_trends || stats.module_trends.length === 0) ? (
                                <p className="text-xs text-muted-foreground mt-1">Not enough data to compare periods.</p>
                            ) : (
                                <ScrollArea className="h-[75px]">
                                    <div className="space-y-0 pr-3">
                                        {stats.module_trends.map((t, i) => {
                                            const pct = derivePct(t);
                                            return (
                                                <div key={i} className="flex items-center justify-between gap-2 min-w-0">
                                                    <div className="flex items-center gap-1 min-w-0">
                                                        <TrendIcon direction={t.direction} />
                                                        <span className="text-xs text-foreground truncate">{t.name}</span>
                                                    </div>
                                                    <div className={cn("flex items-center gap-1 flex-shrink-0 tabular-nums", trendColor(t.direction))}>
                                                        <span className="text-xs font-semibold">{t.direction === 'up' ? '+' : ''}{t.change}</span>
                                                        {pct !== null && <span className="text-[10px] opacity-75">({t.direction === 'up' ? '+' : ''}{pct}%)</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Chart Card */}
                <Card className={cn("flex flex-col", isFullscreen ? "flex-1 min-h-0" : "")}>
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-[0.45rem] px-4 shrink-0">
                        <div>
                            <CardTitle className="text-base font-bold">Total Case</CardTitle>
                            {areFiltersActive && (
                                <CardDescription className="text-xs text-muted-foreground mt-1">
                                    Filters active: {[
                                        !allYearsSelected && selectedYears.length > 0 && `Years: ${selectedYears.join(', ')}`,
                                        categoryFilter.length > 0 && `Categories: ${categoryFilter.length}`,
                                        clientFilter.length > 0 && `Clients: ${clientFilter.length}`,
                                        moduleFilter.length > 0 && `Modules: ${moduleFilter.length}`,
                                        detailModuleFilter.length > 0 && `Detail Modules: ${detailModuleFilter.length}`,
                                        dateRange && 'Date range set',
                                    ].filter(Boolean).join(', ')}
                                </CardDescription>
                            )}
                        </div>
                        <div className="flex w-full sm:w-auto items-center justify-end gap-2 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => setFilterPanelOpen(true)}>
                                <Filter className="mr-2 h-4 w-4" />Filter
                                {activeFilterCount > 0 && <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs font-semibold">{activeFilterCount}</span>}
                            </Button>
                            {areFiltersActive && (
                                <Button onClick={handleClearAllFilters} variant="ghost" size="sm">
                                    <FilterX className="mr-2 h-4 w-4" />Clear Filters
                                </Button>
                            )}
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button onClick={handleRefresh} disabled={isRefreshing || isApplyingFilters} size="sm" variant="outline">
                                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />Refresh Data
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                                        Refresh data terbaru. Data tahun lama tidak di-reload (sudah di-cache).
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isApplyingFilters || isRefreshing}
                                            onClick={() => setReportModalOpen(true)}
                                            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white border-0"
                                        >
                                            <FileText className="h-4 w-4" />
                                            <span className="hidden sm:inline">Report</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                        Buka preview report — bisa download .docx dari sana
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <YearMultiSelect years={filterOptions?.years ?? []} selectedYears={selectedYears} onChange={handleYearsChange} />
                            <Button size="sm" variant="outline" onClick={() => setIsFullscreen(p => !p)}
                                title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'} className="h-9 w-9 p-0 flex-shrink-0">
                                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className={cn("pb-1", isFullscreen ? "flex-1 min-h-0 flex flex-col" : "")}>
                        <div className={cn("relative transition-opacity duration-300", isUpdating ? "opacity-60 pointer-events-none" : "opacity-100", isFullscreen ? "flex-1 h-full" : "")}>
                            {stats.monthly_stats.length > 0 ? (
                                <ChartContainer config={dynamicChartConfig as ChartConfig}
                                    className={cn("w-full transition-all duration-300", isFullscreen ? "h-full" : "h-[270px]")}>
                                    <AreaChart data={stats.monthly_stats} margin={{ left: 0, right: 20, top: 10, bottom: 4 }}>
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8}
                                            tickFormatter={(value) => typeof value === 'string' ? value.slice(0, 3) : ''} />
                                        <YAxis tickLine={false} axisLine={false} tickMargin={8} tickCount={5} />
                                        <defs>
                                            {chartKeys.map((year) => (
                                                <linearGradient key={year} id={`fill${year}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%"  stopColor={dynamicChartConfig[year]?.color} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={dynamicChartConfig[year]?.color} stopOpacity={0.1} />
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                        <Legend wrapperStyle={{ paddingTop: 4 }} />
                                        {chartKeys.map((year) => (
                                            <Area key={year} dataKey={year} type="monotone"
                                                fill={`url(#fill${year})`}
                                                stroke={dynamicChartConfig[year]?.color}
                                                strokeWidth={2} />
                                        ))}
                                    </AreaChart>
                                </ChartContainer>
                            ) : (
                                <div className="flex items-center justify-center h-[310px] text-muted-foreground border-2 border-dashed rounded-lg">
                                    No historical data available for selected filters.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Bottom Cards */}
                <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-2 shrink-0 transition-opacity duration-300", isUpdating ? "opacity-60" : "opacity-100")}>

                    {/* All Clients */}
                    <Card className="flex flex-col">
                        <CardHeader className="py-2 px-4 shrink-0">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-bold">All Clients</CardTitle>
                                <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2.5 py-1 tabular-nums">{totalClientsCount.toLocaleString()} clients</span>
                            </div>
                        </CardHeader>
                        <CardContent className="py-2 px-4">
                            <ScrollArea className="h-[110px] pr-2">
                                <div className="space-y-1">
                                    {client_rankings.map((item, index) => {
                                        const safeValue = item.value ?? 0;
                                        return (
                                            <TooltipProvider key={index} delayDuration={0}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-48 flex-shrink-0 text-right text-sm text-foreground pr-2 truncate">{item.name}</div>
                                                            <div className="flex-1 flex items-center gap-2 min-w-0">
                                                                <div className="flex-1 bg-muted rounded-full h-4 relative overflow-hidden">
                                                                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                                                                        style={{ width: `${(safeValue / maxClientValue) * 100}%` }} />
                                                                </div>
                                                                <span className="text-xs font-semibold text-foreground w-14 flex-shrink-0">{safeValue.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>{item.name}</p></TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Detail Module */}
                    <Card className="flex flex-col">
                        <CardHeader className="py-2 px-4 shrink-0">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-bold">Detail Module</CardTitle>
                                <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2.5 py-1 tabular-nums">{totalDetailModuleCases.toLocaleString()} cases</span>
                            </div>
                        </CardHeader>
                        <CardContent className="py-2 px-4">
                            {detailModuleRankings.length === 0 ? (
                                <div className="flex items-center justify-center h-[140px] text-muted-foreground text-sm border-2 border-dashed rounded-lg">No detail module data available.</div>
                            ) : (
                                <ScrollArea className="h-[110px] pr-2">
                                    <div className="space-y-1">
                                        {detailModuleRankings.map((item, index) => {
                                            const safeValue = item.value ?? 0;
                                            return (
                                                <TooltipProvider key={index} delayDuration={0}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-48 flex-shrink-0 text-right text-sm text-foreground pr-2 truncate">{item.name}</div>
                                                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                                                    <div className="flex-1 bg-muted rounded-full h-4 relative overflow-hidden">
                                                                        <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500"
                                                                            style={{ width: `${(safeValue / maxDetailModuleValue) * 100}%` }} />
                                                                    </div>
                                                                    <span className="text-xs font-semibold text-foreground w-14 flex-shrink-0">{safeValue.toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>{item.name}</p></TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ── Draggable Filter Panel ─────────────────────────────────────────── */}
            <DraggableFilterPanel open={filterPanelOpen} onClose={() => { setFilterPanelOpen(false); setOpenFilter(null); }} activeCount={activeFilterCount} headerRef={filterPanelHeaderRef}>
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold leading-none">Filter by Date</h4>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd, y")} – {format(dateRange.to, "LLL dd, y")}</> : format(dateRange.from, "LLL dd, y")) : <span>Pick a date range</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                        </PopoverContent>
                    </Popover>
                </div>
                <Separator />
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold leading-none">Filter by Category</h4>
                    <MultiSelect options={filterOptions?.categories || []} selected={categoryFilter} onChange={setCategoryFilter} placeholder="Select categories..."
                        open={openFilter === 'category'} onOpenChange={(o) => setOpenFilter(o ? 'category' : null)} side="left" panelLabel="Filter by Category" alignTopRef={filterPanelHeaderRef} />
                </div>
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold leading-none">Filter by Client</h4>
                    <MultiSelect options={filterOptions?.clients || []} selected={clientFilter} onChange={setClientFilter} placeholder="Select clients..."
                        open={openFilter === 'client'} onOpenChange={(o) => setOpenFilter(o ? 'client' : null)} side="left" panelLabel="Filter by Client" alignTopRef={filterPanelHeaderRef} />
                </div>
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold leading-none">Filter by Module</h4>
                    <MultiSelect options={filterOptions?.modules || []} selected={moduleFilter} onChange={setModuleFilter} placeholder="Select modules..."
                        open={openFilter === 'module'} onOpenChange={(o) => setOpenFilter(o ? 'module' : null)} side="left" panelLabel="Filter by Module" alignTopRef={filterPanelHeaderRef} />
                </div>
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold leading-none">Filter by Detail Module</h4>
                    <MultiSelect options={filterOptions?.detailModules || []} selected={detailModuleFilter} onChange={setDetailModuleFilter} placeholder="Select detail modules..."
                        open={openFilter === 'detailModule'} onOpenChange={(o) => setOpenFilter(o ? 'detailModule' : null)} side="left" panelLabel="Filter by Detail Module" alignTopRef={filterPanelHeaderRef} />
                </div>
                {areFiltersActive && (
                    <>
                        <Separator />
                        <Button variant="outline" size="sm" className="w-full" onClick={handleClearAllFilters}>
                            <FilterX className="mr-2 h-4 w-4" />Clear All Filters
                        </Button>
                    </>
                )}
            </DraggableFilterPanel>

            {/* ── Report Preview Modal — di LUAR DraggableFilterPanel ────────────── */}
            <ReportPreviewModal
                open={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                stats={stats}
                filterSummary={reportFilterSummary}
                filterOptions={filterOptions}
            />
        </div>
    );
}