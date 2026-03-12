"use client";

import { BarChart as BarChartIcon, CheckCircle, Users, FolderKanban, Filter, RefreshCw, FilterX, AlertTriangle, Calendar as CalendarIcon, X, GripHorizontal, Maximize2, Minimize2, ChevronDown, Check, Layers, TrendingUp, TrendingDown } from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { useContext, useState, useEffect, useTransition, useCallback, useMemo, useRef } from "react";
import { TableDataContext } from "@/store/table-data-context";
import { Area, AreaChart, Legend, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { getDashboardFilterOptions, refreshDashboardViews } from "@/app/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelect } from "@/components/ui/multi-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { format, getISOWeek, getYear, getQuarter, subDays, subWeeks, subQuarters, subMonths, startOfISOWeek, endOfISOWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "./ui/separator";

// ── Types ─────────────────────────────────────────────────────────────────────

type TrendPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

const TREND_PERIOD_OPTIONS: { value: TrendPeriod; label: string }[] = [
    { value: 'daily',     label: 'D' },
    { value: 'weekly',    label: 'W' },
    { value: 'monthly',   label: 'M' },
    { value: 'quarterly', label: 'Q' },
];

const chartConfig = {
  solved: { label: "Solved", color: "hsl(var(--chart-2))" },
  unsolved: { label: "Unsolved", color: "hsl(var(--chart-5))" },
  L1: { label: "L1", color: "hsl(var(--chart-1))" },
  L2: { label: "L2", color: "hsl(var(--chart-3))" },
  L3: { label: "L3", color: "hsl(var(--chart-4))" },
  'N/A': { label: 'N/A', color: 'hsl(var(--muted-foreground))' },
  'PENDING': { label: 'Pending', color: 'hsl(var(--chart-5))' },
  'ON HOLD': { label: 'On Hold', color: 'hsl(var(--chart-5))' },
  'OPEN': { label: 'Open', color: 'hsl(var(--chart-1))' },
  'RESOLVED': { label: 'Solved', color: 'hsl(var(--chart-2))' },
  clients: { label: "Clients", color: "hsl(var(--chart-2))" },
  modules: { label: "Modules", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

type IndexableChartConfig = Record<string, { label: string; color: string }>;

type ModuleTrend = {
    name: string;
    current: number;
    previous: number;
    change: number;
    change_pct?: number;          // optional, backend may return this
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
};

type FilterOptions = {
    categories: { label: string; value: string }[];
    clients: { label: string; value: string }[];
    modules: { label: string; value: string }[];
    detailModules: { label: string; value: string }[];
    years: string[];
};

interface DashboardProps {
    initialStats: DashboardStats | null;
    initialOptions: FilterOptions | null;
    error?: string | null;
}

// ── Helper: Compute comparison label + tooltip per period ─────────────────────
/**
 * Selalu exclude periode BERJALAN, bandingkan 2 periode SELESAI terakhir.
 * Returns { label, tooltip } — tooltip menjelaskan rentang tanggal lengkap.
 *
 * Contoh (hari ini 12 Mar 2026):
 *   Daily     label="10 Mar vs 11 Mar"  tooltip="Tue 10 Mar  vs  Wed 11 Mar"
 *   Weekly    label="W9 vs W10"         tooltip="23 Feb–1 Mar  vs  2–8 Mar 2026"
 *   Monthly   label="Jan vs Feb"        tooltip="Jan 2026  vs  Feb 2026"
 *   Quarterly label="Q3 vs Q4"          tooltip="Jul–Sep 2025  vs  Oct–Dec 2025"
 */
function getTrendComparisonInfo(period: TrendPeriod): { label: string; tooltip: string } {
    const now = new Date();

    if (period === 'daily') {
        const d1 = subDays(now, 2);
        const d2 = subDays(now, 1);
        const label   = `${format(d1, 'd MMM')} vs ${format(d2, 'd MMM')}`;
        const tooltip = `${format(d1, 'EEE d MMM yyyy')}  vs  ${format(d2, 'EEE d MMM yyyy')}`;
        return { label, tooltip };
    }

    if (period === 'weekly') {
        const w1Start = startOfISOWeek(subWeeks(now, 2));
        const w1End   = endOfISOWeek(subWeeks(now, 2));
        const w2Start = startOfISOWeek(subWeeks(now, 1));
        const w2End   = endOfISOWeek(subWeeks(now, 1));
        const w1Num   = getISOWeek(w1Start);
        const w2Num   = getISOWeek(w2Start);
        const label   = `W${w1Num} vs W${w2Num}`;
        // Same year → omit year on left side
        const sameYear = w1Start.getFullYear() === w2End.getFullYear();
        const fmtLeft  = sameYear ? 'd MMM' : 'd MMM yyyy';
        const tooltip  = `${format(w1Start, fmtLeft)}–${format(w1End, 'd MMM')}  vs  ${format(w2Start, 'd MMM')}–${format(w2End, 'd MMM yyyy')}`;
        return { label, tooltip };
    }

    if (period === 'monthly') {
        const m1 = subMonths(now, 2);
        const m2 = subMonths(now, 1);
        const label   = `${format(m1, 'MMM')} vs ${format(m2, 'MMM')}`;
        const tooltip = `${format(startOfMonth(m1), 'MMM yyyy')}  vs  ${format(startOfMonth(m2), 'MMM yyyy')}`;
        return { label, tooltip };
    }

    if (period === 'quarterly') {
        const q1 = subQuarters(now, 2);
        const q2 = subQuarters(now, 1);
        const q1Num = getQuarter(q1);
        const q2Num = getQuarter(q2);
        // Label: add year suffix only when crossing year boundary
        const sameYear = q1.getFullYear() === q2.getFullYear();
        const label = sameYear
            ? `Q${q1Num} vs Q${q2Num}`
            : `Q${q1Num} '${String(q1.getFullYear()).slice(2)} vs Q${q2Num} '${String(q2.getFullYear()).slice(2)}`;
        // Tooltip: full date range for each quarter
        const tooltip = `${format(startOfQuarter(q1), 'MMM')}–${format(endOfQuarter(q1), 'MMM yyyy')}  vs  ${format(startOfQuarter(q2), 'MMM')}–${format(endOfQuarter(q2), 'MMM yyyy')}`;
        return { label, tooltip };
    }

    return { label: 'vs last period', tooltip: '' };
}

// Keep old signature for backward compat (unused but safe)
function getTrendComparisonLabel(period: TrendPeriod, _monthlyStats: any[]): string {
    return getTrendComparisonInfo(period).label;
}

// ── Helper: derive pct from ModuleTrend if backend doesn't send it ────────────
function derivePct(trend: ModuleTrend): number | null {
    if (trend.change_pct !== undefined) return trend.change_pct;
    if (trend.previous === 0) return null;
    return Math.round((trend.change / trend.previous) * 100);
}

// ── Draggable Filter Panel ─────────────────────────────────────────────────────
interface DraggableFilterPanelProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    activeCount: number;
}

function DraggableFilterPanel({ open, onClose, children, activeCount }: DraggableFilterPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const dragState = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => { if (!open) setPos(null); }, [open]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (!panelRef.current) return;
        const rect = panelRef.current.getBoundingClientRect();
        dragState.current = {
            dragging: true,
            startX: e.clientX,
            startY: e.clientY,
            origX: pos?.x ?? rect.left,
            origY: pos?.y ?? rect.top,
        };
        e.preventDefault();
        const onMouseMove = (ev: MouseEvent) => {
            if (!dragState.current.dragging) return;
            setPos({
                x: dragState.current.origX + (ev.clientX - dragState.current.startX),
                y: dragState.current.origY + (ev.clientY - dragState.current.startY),
            });
        };
        const onMouseUp = () => {
            dragState.current.dragging = false;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }, [pos]);

    if (!open) return null;

    const style: React.CSSProperties = pos
        ? { position: "fixed", left: pos.x, top: pos.y, zIndex: 50 }
        : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 50 };

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div ref={panelRef} style={style} className="w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl">
                <div
                    onMouseDown={onMouseDown}
                    className="flex items-center justify-between px-4 py-2.5 border-b cursor-grab active:cursor-grabbing select-none bg-muted/50 rounded-t-lg"
                >
                    <div className="flex items-center gap-2">
                        <GripHorizontal className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">Filter Options</span>
                        {activeCount > 0 && (
                            <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs font-semibold">
                                {activeCount}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <ScrollArea className="max-h-[75vh]">
                    <div className="p-4 space-y-4">{children}</div>
                </ScrollArea>
            </div>
        </>
    );
}

// ── Year Multi-Select Dropdown ────────────────────────────────────────────────
interface YearMultiSelectProps {
    years: string[];
    selectedYears: string[];
    onChange: (years: string[]) => void;
}

function YearMultiSelect({ years, selectedYears, onChange }: YearMultiSelectProps) {
    const [open, setOpen] = useState(false);
    const allSelected  = selectedYears.length === years.length;
    const noneSelected = selectedYears.length === 0;

    const toggleYear = (year: string) => {
        if (selectedYears.includes(year)) {
            if (selectedYears.length === 1) return;
            onChange(selectedYears.filter(y => y !== year));
        } else {
            onChange([...selectedYears, year].sort((a, b) => parseInt(a) - parseInt(b)));
        }
    };

    const toggleAll = () => {
        if (allSelected) {
            onChange(years.length > 0 ? [years[years.length - 1]] : []);
        } else {
            onChange([...years]);
        }
    };

    const label = useMemo(() => {
        if (noneSelected || allSelected) return "All Years";
        if (selectedYears.length === 1) return selectedYears[0];
        return `${selectedYears.length} Years`;
    }, [selectedYears, allSelected, noneSelected]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn("w-full sm:w-[160px] justify-between font-normal", !allSelected && !noneSelected && "border-primary text-primary")}
                >
                    <span className="truncate">{label}</span>
                    <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
                <button
                    onClick={toggleAll}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                >
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
                        <button
                            key={year}
                            onClick={() => toggleYear(year)}
                            disabled={isLast}
                            title={isLast ? "At least one year must be selected" : undefined}
                            className={cn(
                                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                                isLast ? "opacity-50 cursor-not-allowed" : "hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
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

// ── Helper: default 3 most recent years ───────────────────────────────────────
function getDefault3RecentYears(years: string[]): string[] {
    const sorted = [...years].sort((a, b) => parseInt(b) - parseInt(a));
    return sorted.slice(0, 3).sort((a, b) => parseInt(a) - parseInt(b));
}

// ── Trend Period Dropdown ─────────────────────────────────────────────────────
const TREND_PERIOD_FULL: Record<TrendPeriod, string> = {
    daily:     'Daily',
    weekly:    'Weekly',
    monthly:   'Monthly',
    quarterly: 'Quarterly',
};

interface TrendPeriodDropdownProps {
    value: TrendPeriod;
    onChange: (v: TrendPeriod) => void;
}

function TrendPeriodDropdown({ value, onChange }: TrendPeriodDropdownProps) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-accent transition-colors leading-none">
                    {TREND_PERIOD_FULL[value]}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start" side="bottom">
                {TREND_PERIOD_OPTIONS.map(opt => {
                    const { tooltip } = getTrendComparisonInfo(opt.value);
                    return (
                        <TooltipProvider key={opt.value} delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => { onChange(opt.value); setOpen(false); }}
                                        className={cn(
                                            "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors",
                                            value === opt.value
                                                ? "bg-accent text-accent-foreground font-semibold"
                                                : "hover:bg-accent hover:text-accent-foreground"
                                        )}
                                    >
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

// ── Main Dashboard Component ──────────────────────────────────────────────────
export function Dashboard({ initialStats, initialOptions, error: initialError }: DashboardProps) {
    const { setIsProcessing } = useContext(TableDataContext);
    const { toast } = useToast();

    const [stats, setStats]               = useState<DashboardStats | null>(initialStats);
    const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(initialOptions);
    const [error, setError]               = useState<string | null>(initialError || null);
    const [isApplyingFilters, startApplyingFilters] = useTransition();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hasMounted, setHasMounted]     = useState(false);

    // ── Trend period state ──────────────────────────────────────────────────
    const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('monthly');

    const hasLoadedOnce = useRef<boolean>(initialStats !== null);

    // ── Filter states ───────────────────────────────────────────────────────
    const [selectedYears, setSelectedYears]         = useState<string[]>([]);
    const [categoryFilter, setCategoryFilter]       = useState<string[]>([]);
    const [clientFilter, setClientFilter]           = useState<string[]>([]);
    const [moduleFilter, setModuleFilter]           = useState<string[]>([]);
    const [detailModuleFilter, setDetailModuleFilter] = useState<string[]>([]);
    const [dateRange, setDateRange]                 = useState<DateRange | undefined>(undefined);

    useEffect(() => {
        setHasMounted(true);
        if (initialOptions?.years?.length) {
            setSelectedYears(getDefault3RecentYears(initialOptions.years));
        }
    }, [initialOptions]);

    const prevYearsRef = useRef<string[]>(initialOptions?.years ?? []);
    useEffect(() => {
        if (!filterOptions?.years) return;
        const newYears  = filterOptions.years;
        const prevYears = prevYearsRef.current;
        const added     = newYears.filter(y => !prevYears.includes(y));
        if (added.length > 0) setSelectedYears(getDefault3RecentYears(newYears));
        prevYearsRef.current = newYears;
    }, [filterOptions?.years]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isFullscreen]);

    const yearColorConfig = useMemo(() => {
        const allYears    = filterOptions?.years?.sort((a, b) => parseInt(a) - parseInt(b)) || [];
        const chartColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
        const config: ChartConfig = {};
        allYears.forEach((year, index) => {
            config[year] = { label: year, color: chartColors[index % chartColors.length] };
        });
        return config;
    }, [filterOptions?.years]);

    const { chartKeys, dynamicChartConfig } = useMemo(() => {
        const baseConfig: IndexableChartConfig = { ...chartConfig, ...yearColorConfig };
        if (!stats?.monthly_stats || stats.monthly_stats.length === 0) {
            return { chartKeys: [], dynamicChartConfig: baseConfig };
        }
        const keysInData = new Set<string>();
        stats.monthly_stats.forEach(monthData => {
            Object.keys(monthData).forEach(key => { if (/^\d{4}$/.test(key)) keysInData.add(key); });
        });
        const sortedKeys = selectedYears.filter(y => keysInData.has(y)).sort((a, b) => parseInt(a) - parseInt(b));
        return { chartKeys: sortedKeys, dynamicChartConfig: baseConfig };
    }, [stats?.monthly_stats, yearColorConfig, selectedYears]);

    useEffect(() => {
        setIsProcessing(isApplyingFilters || isRefreshing);
    }, [isApplyingFilters, isRefreshing, setIsProcessing]);

    const allYearsSelected = useMemo(() => {
        const available = filterOptions?.years ?? [];
        return available.length > 0 && selectedYears.length === available.length;
    }, [selectedYears, filterOptions?.years]);

    const areFiltersActive = useMemo(() => {
        return (
            dateRange !== undefined ||
            !allYearsSelected ||
            categoryFilter.length > 0 ||
            clientFilter.length > 0 ||
            moduleFilter.length > 0 ||
            detailModuleFilter.length > 0
        );
    }, [dateRange, allYearsSelected, categoryFilter, clientFilter, moduleFilter, detailModuleFilter]);

    const activeFilterCount = useMemo(() => {
        return [
            categoryFilter.length,
            clientFilter.length,
            moduleFilter.length,
            detailModuleFilter.length,
            dateRange ? 1 : 0,
            !allYearsSelected ? 1 : 0,
        ].reduce((a, b) => a + b, 0);
    }, [categoryFilter, clientFilter, moduleFilter, detailModuleFilter, dateRange, allYearsSelected]);

    const handleClearAllFilters = () => {
        if (filterOptions?.years?.length) setSelectedYears(getDefault3RecentYears(filterOptions.years));
        setCategoryFilter([]);
        setClientFilter([]);
        setModuleFilter([]);
        setDetailModuleFilter([]);
        setDateRange(undefined);
    };

    // ── Trend comparison label + tooltip ────────────────────────────────────────
    const { label: trendComparisonLabel, tooltip: trendComparisonTooltip } = useMemo(() => {
        return getTrendComparisonInfo(trendPeriod);
    }, [trendPeriod]);

    // ── Fetcher (includes trendPeriod so backend can return correct trends) ──
    const fetcher = useCallback(async (filters: any) => {
        const params = new URLSearchParams();
        if (filters.dateRange)         params.append('dateRange', JSON.stringify(filters.dateRange));
        params.append('selectedYears',     (filters.selectedYears as string[]).join(','));
        params.append('categoryFilter',    filters.categoryFilter.join(','));
        params.append('clientFilter',      filters.clientFilter.join(','));
        params.append('moduleFilter',      filters.moduleFilter.join(','));
        params.append('detailModuleFilter', filters.detailModuleFilter.join(','));
        params.append('trendPeriod',       filters.trendPeriod);   // ← new param

        const url      = `/api/dashboard?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch dashboard data: ${response.status} ${errorText}`);
        }
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'An unknown error occurred');
        return result.data;
    }, []);

    useEffect(() => {
        if (!hasMounted) return;
        startApplyingFilters(async () => {
            setError(null);
            try {
                const data = await fetcher({ selectedYears, categoryFilter, clientFilter, moduleFilter, detailModuleFilter, dateRange, trendPeriod });
                setStats(data);
                hasLoadedOnce.current = true;
            } catch (err: any) {
                setError(err.message);
                setStats(null);
                toast({ variant: "destructive", title: "Could not load dashboard data", description: err.message });
            }
        });
    }, [selectedYears, categoryFilter, clientFilter, moduleFilter, detailModuleFilter, dateRange, trendPeriod, fetcher, hasMounted]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        toast({ title: "Refreshing...", description: "Syncing data and recalculating stats." });
        refreshDashboardViews().then(async () => {
            try {
                const data = await fetcher({ selectedYears, categoryFilter, clientFilter, moduleFilter, detailModuleFilter, dateRange, trendPeriod });
                setStats(data);
                toast({ title: "Refreshed!", description: "Dashboard data has been updated." });
            } catch (err: any) {
                setError(err.message);
                setStats(null);
                toast({ variant: "destructive", title: "Refresh failed", description: err.message });
            } finally {
                setIsRefreshing(false);
            }
            getDashboardFilterOptions().then((optionsResult) => {
                if (optionsResult.error || !optionsResult.data) {
                    setFilterOptions({ categories: [], clients: [], modules: [], detailModules: [], years: [] });
                } else {
                    setFilterOptions(optionsResult.data);
                }
            });
        });
    }, [selectedYears, categoryFilter, clientFilter, moduleFilter, detailModuleFilter, dateRange, trendPeriod, fetcher]);

    const showSkeleton = !hasMounted || (isApplyingFilters && !stats && !hasLoadedOnce.current);

    // ── Skeleton ──────────────────────────────────────────────────────────────
    if (showSkeleton) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-4">
                    <style>{`@media (min-width: 1024px) { .header-cards-grid { grid-template-columns: repeat(4, 7fr) 12fr !important; } }`}</style>
                    <div className="header-cards-grid grid gap-4 md:grid-cols-2 md:gap-8">
                        <Skeleton className="h-[88px]" />
                        <Skeleton className="h-[88px]" />
                        <Skeleton className="h-[88px]" />
                        <Skeleton className="h-[88px]" />
                        <Skeleton className="h-[88px]" />
                    </div>
                    <Skeleton className="h-[300px] w-full" />
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                        <Skeleton className="h-[250px]" />
                        <Skeleton className="h-[250px]" />
                    </div>
                </div>
            </div>
        );
    }

    // ── Error ──────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                        <CardTitle className="text-2xl font-bold">Failed to Load Dashboard Data</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">{error}</CardDescription>
                        <Button onClick={handleRefresh} disabled={isRefreshing}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Try Again
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    // ── No data ────────────────────────────────────────────────────────────────
    if (!stats) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
                        <CardTitle className="text-2xl font-bold">No Data Found</CardTitle>
                        <p className="mt-2 text-muted-foreground">The database might be empty or inaccessible.</p>
                        <Button onClick={handleRefresh} disabled={isRefreshing} className="mt-4">
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    const { client_rankings, module_rankings, detail_module_rankings } = stats;
    const detailModuleRankings   = detail_module_rankings ?? module_rankings ?? [];
    const maxClientValue         = client_rankings.length > 0 ? client_rankings[0].value : 1;
    const maxDetailModuleValue   = detailModuleRankings.length > 0 ? detailModuleRankings[0].value : 1;
    const totalClientsCount      = client_rankings.length;
    const totalDetailModuleCases = detailModuleRankings.reduce((sum, item) => sum + item.value, 0);

    return (
        <div
            className={cn(
                "bg-background text-foreground transition-all duration-300",
                isFullscreen
                    ? "fixed inset-0 z-50 flex flex-col p-3 md:p-4 overflow-hidden"
                    : "flex-1 p-2 sm:p-3 md:p-4 overflow-auto"
            )}
        >
            <div className={cn(
                "mx-auto w-full transition-all duration-300 flex flex-col gap-3",
                isFullscreen ? "flex-1 max-w-none min-h-0" : "max-w-7xl"
            )}>

                {/* ── Header Cards ────────────────────────────────────── */}
                <style>{`@media (min-width: 1024px) { .header-cards-grid { grid-template-columns: repeat(4, 7fr) 12fr !important; } }`}</style>
                <div className="header-cards-grid grid gap-3 md:grid-cols-2 md:gap-4 shrink-0">

                    {/* Total Cases */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Total Cases</CardTitle>
                            <BarChartIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pb-3 px-4">
                            <div className="text-2xl font-bold">{stats.summary.total_cases}</div>
                        </CardContent>
                    </Card>

                    {/* Status Solved */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Status Solved</CardTitle>
                            <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pb-3 px-4">
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

                    {/* Trending Category */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Trending Category</CardTitle>
                            <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pb-3 px-4">
                            <div className="text-2xl font-bold truncate">{stats.summary.trending_category}</div>
                        </CardContent>
                    </Card>

                    {/* Trend Module */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Trend Module</CardTitle>
                            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pb-3 px-4">
                            <div className="text-2xl font-bold truncate">{stats.summary.trending_module ?? stats.summary.top_module ?? '—'}</div>
                        </CardContent>
                    </Card>

                    {/* ── Case Trend Card (with period dropdown) ── */}
                    <Card className="flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4 shrink-0">
                            {/* Left: "Case Trend" + dropdown inline */}
                            <div className="flex items-center gap-1 min-w-0">
                                <CardTitle className="text-xs font-medium text-muted-foreground flex-shrink-0">
                                    Case Trend
                                </CardTitle>
                                <TrendPeriodDropdown value={trendPeriod} onChange={setTrendPeriod} />
                            </div>
                            {/* Right: comparison label with tooltip */}
                            <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="text-[10px] text-muted-foreground/70 font-normal leading-none flex-shrink-0 tabular-nums underline decoration-dotted cursor-help">
                                            {trendComparisonLabel}
                                        </span>
                                    </TooltipTrigger>
                                    {trendComparisonTooltip && (
                                        <TooltipContent side="bottom" className="text-xs">
                                            <p>{trendComparisonTooltip}</p>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                        </CardHeader>

                        <CardContent className="pb-3 px-4 flex-1 min-h-0">
                            {(!stats.module_trends || stats.module_trends.length === 0) ? (
                                <p className="text-xs text-muted-foreground mt-1">Not enough data to compare periods.</p>
                            ) : (
                                <ScrollArea className="h-[70px]">
                                    <div className="space-y-1 pr-4">
                                        {stats.module_trends.map((t, i) => {
                                            const pct = derivePct(t);
                                            return (
                                                <div key={i} className="flex items-center justify-between gap-2 min-w-0">
                                                    {/* Icon + name */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {t.direction === 'up' ? (
                                                            <TrendingUp className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                                        ) : (
                                                            <TrendingDown className="h-3 w-3 text-red-500 flex-shrink-0" />
                                                        )}
                                                        <span className="text-xs text-foreground truncate">{t.name}</span>
                                                    </div>

                                                    {/* Absolute + percentage */}
                                                    <div className={cn(
                                                        "flex items-center gap-1 flex-shrink-0 tabular-nums",
                                                        t.direction === 'up' ? 'text-emerald-600' : 'text-red-500'
                                                    )}>
                                                        <span className="text-xs font-semibold">
                                                            {t.direction === 'up' ? '+' : ''}{t.change}
                                                        </span>
                                                        {pct !== null && (
                                                            <span className="text-[10px] opacity-75">
                                                                ({t.direction === 'up' ? '+' : ''}{pct}%)
                                                            </span>
                                                        )}
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

                {/* ── Chart Card ──────────────────────────────────────── */}
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
                                        dateRange && 'Date range set'
                                    ].filter(Boolean).join(', ')}
                                </CardDescription>
                            )}
                        </div>
                        <div className="flex w-full sm:w-auto items-center justify-end gap-2 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => setFilterPanelOpen(true)}>
                                <Filter className="mr-2 h-4 w-4" />
                                Filter
                                {activeFilterCount > 0 && (
                                    <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs font-semibold">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </Button>

                            {areFiltersActive && (
                                <Button onClick={handleClearAllFilters} variant="ghost" size="sm">
                                    <FilterX className="mr-2 h-4 w-4" />
                                    Clear Filters
                                </Button>
                            )}

                            <Button onClick={handleRefresh} disabled={isRefreshing || isApplyingFilters} size="sm" variant="outline">
                                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Refresh Data
                            </Button>

                            <YearMultiSelect
                                years={filterOptions?.years ?? []}
                                selectedYears={selectedYears}
                                onChange={setSelectedYears}
                            />

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsFullscreen(p => !p)}
                                title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
                                className="h-9 w-9 p-0 flex-shrink-0"
                            >
                                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className={cn("pb-1", isFullscreen ? "flex-1 min-h-0" : "")}>
                        {hasMounted && stats.monthly_stats.length > 0 && (
                            <ChartContainer
                                config={dynamicChartConfig as ChartConfig}
                                className={cn("w-full transition-all duration-300", isFullscreen ? "h-full" : "h-[310px]")}
                            >
                                <AreaChart data={stats.monthly_stats} margin={{ left: 0, right: 20, top: 10, bottom: 4 }}>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="month"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        tickFormatter={(value) => typeof value === 'string' ? value.slice(0, 3) : ''}
                                    />
                                    <YAxis tickLine={false} axisLine={false} tickMargin={8} tickCount={5} />
                                    <defs>
                                        {chartKeys.map((year) => (
                                            <linearGradient key={year} id={`fill${year}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={dynamicChartConfig[year]?.color} stopOpacity={0.8} />
                                                <stop offset="95%" stopColor={dynamicChartConfig[year]?.color} stopOpacity={0.1} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                    <Legend wrapperStyle={{ paddingTop: 4 }} />
                                    {chartKeys.map((year) => (
                                        <Area
                                            key={year}
                                            dataKey={year}
                                            type="monotone"
                                            fill={`url(#fill${year})`}
                                            stroke={dynamicChartConfig[year]?.color}
                                            strokeWidth={2}
                                        />
                                    ))}
                                </AreaChart>
                            </ChartContainer>
                        )}
                        {hasMounted && stats.monthly_stats.length === 0 && (
                            <div className="flex items-center justify-center h-[310px] text-muted-foreground border-2 border-dashed rounded-lg">
                                No historical data available for selected filters.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Bottom Cards ─────────────────────────────────────── */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 shrink-0">

                    {/* All Clients */}
                    <Card className="flex flex-col">
                        <CardHeader className="py-3 px-4 shrink-0">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-bold">All Clients</CardTitle>
                                <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2.5 py-1 tabular-nums">
                                    {totalClientsCount.toLocaleString()} clients
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-4">
                            <ScrollArea className="h-[140px] pr-4 transition-all duration-300">
                                <div className="space-y-2">
                                    {client_rankings.map((item, index) => (
                                        <TooltipProvider key={index} delayDuration={0}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-32 flex-shrink-0 text-right text-sm text-foreground pr-2 truncate">{item.name}</div>
                                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                                            <div className="flex-1 bg-muted rounded-full h-5 relative overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                                                                    style={{ width: `${(item.value / maxClientValue) * 100}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-semibold text-foreground w-14 flex-shrink-0">{item.value.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent><p>{item.name}</p></TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Detail Module */}
                    <Card className="flex flex-col">
                        <CardHeader className="py-3 px-4 shrink-0">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-bold">Detail Module</CardTitle>
                                <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2.5 py-1 tabular-nums">
                                    {totalDetailModuleCases.toLocaleString()} cases
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-4">
                            <ScrollArea className="h-[140px] pr-4 transition-all duration-300">
                                <div className="space-y-2">
                                    {detailModuleRankings.map((item, index) => (
                                        <TooltipProvider key={index} delayDuration={0}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-48 flex-shrink-0 text-right text-sm text-foreground pr-2 truncate">{item.name}</div>
                                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                                            <div className="flex-1 bg-muted rounded-full h-5 relative overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500"
                                                                    style={{ width: `${(item.value / maxDetailModuleValue) * 100}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-semibold text-foreground w-14 flex-shrink-0">{item.value.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent><p>{item.name}</p></TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ── Draggable Filter Panel ── */}
            <DraggableFilterPanel
                open={filterPanelOpen}
                onClose={() => setFilterPanelOpen(false)}
                activeCount={activeFilterCount}
            >
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold leading-none">Filter by Date</h4>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>{format(dateRange.from, "LLL dd, y")} – {format(dateRange.to, "LLL dd, y")}</>
                                    ) : format(dateRange.from, "LLL dd, y")
                                ) : <span>Pick a date range</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={setDateRange}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                <Separator />

                <div className="space-y-2">
                    <h4 className="text-sm font-semibold leading-none">Filter by Category</h4>
                    <MultiSelect
                        options={filterOptions?.categories || []}
                        selected={categoryFilter}
                        onChange={setCategoryFilter}
                        placeholder="Select categories..."
                    />
                </div>

                <div className="space-y-2">
                    <h4 className="text-sm font-semibold leading-none">Filter by Client</h4>
                    <MultiSelect
                        options={filterOptions?.clients || []}
                        selected={clientFilter}
                        onChange={setClientFilter}
                        placeholder="Select clients..."
                    />
                </div>

                <div className="space-y-2">
                    <h4 className="text-sm font-semibold leading-none">Filter by Module</h4>
                    <MultiSelect
                        options={filterOptions?.modules || []}
                        selected={moduleFilter}
                        onChange={setModuleFilter}
                        placeholder="Select modules..."
                    />
                </div>

                <div className="space-y-2">
                    <h4 className="text-sm font-semibold leading-none">Filter by Detail Module</h4>
                    <MultiSelect
                        options={filterOptions?.detailModules || []}
                        selected={detailModuleFilter}
                        onChange={setDetailModuleFilter}
                        placeholder="Select detail modules..."
                    />
                </div>

                {areFiltersActive && (
                    <>
                        <Separator />
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => { handleClearAllFilters(); }}
                        >
                            <FilterX className="mr-2 h-4 w-4" />
                            Clear All Filters
                        </Button>
                    </>
                )}
            </DraggableFilterPanel>
        </div>
    );
}