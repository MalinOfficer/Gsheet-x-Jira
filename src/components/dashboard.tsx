
"use client";

import { BarChart as BarChartIcon, CheckCircle, Users, FolderKanban, Filter, RefreshCw, FilterX, AlertTriangle, Calendar as CalendarIcon } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelect } from "@/components/ui/multi-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "./ui/separator";

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
} satisfies ChartConfig

type DashboardStats = {
    summary: {
        total_cases: number;
        total_solved: number;
        total_clients: number;
        solved_percentage: number;
        trending_category: string;
        top_client: string;
        top_module: string;
    };
    monthly_stats: any[];
    client_rankings: { name: string; value: number }[];
    module_rankings: { name: string; value: number }[];
};

type FilterOptions = {
    categories: { label: string; value: string }[];
    clients: { label: string; value: string }[];
    modules: { label: string; value: string }[];
    years: string[];
};

interface DashboardProps {
    initialStats: DashboardStats | null;
    initialOptions: FilterOptions | null;
    error?: string | null;
}

export function Dashboard({ initialStats, initialOptions, error: initialError }: DashboardProps) {
    const { setIsProcessing } = useContext(TableDataContext);
    const { toast } = useToast();

    const [stats, setStats] = useState<DashboardStats | null>(initialStats);
    const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(initialOptions);
    const [error, setError] = useState<string | null>(initialError || null);
    const [isApplyingFilters, startApplyingFilters] = useTransition();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const isInitialMount = useRef(true);

    // Filter states
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
    const [clientFilter, setClientFilter] = useState<string[]>([]);
    const [moduleFilter, setModuleFilter] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    const { chartKeys, dynamicChartConfig } = useMemo(() => {
        if (!stats?.monthly_stats || stats.monthly_stats.length === 0) {
            return { chartKeys: [], dynamicChartConfig: chartConfig };
        }
        
        const keys = new Set<string>();
        stats.monthly_stats.forEach(monthData => {
            Object.keys(monthData).forEach(key => {
                if (/^\d{4}$/.test(key)) { // Find keys that are 4-digit years
                    keys.add(key);
                }
            });
        });
        
        const sortedKeys = Array.from(keys).sort((a, b) => parseInt(a) - parseInt(b));

        const chartColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

        const newConfig: ChartConfig = {};
        sortedKeys.forEach((key, index) => {
            newConfig[key] = {
                label: key, // The label is the year itself, e.g. "2024"
                color: chartColors[index % chartColors.length],
            };
        });

        return { chartKeys: sortedKeys, dynamicChartConfig: { ...chartConfig, ...newConfig } };
    }, [stats?.monthly_stats]);

    useEffect(() => {
        setIsProcessing(isApplyingFilters || isRefreshing);
    }, [isApplyingFilters, isRefreshing, setIsProcessing]);

    const areFiltersActive = useMemo(() => {
        return (
            dateRange !== undefined ||
            selectedYear !== 'all' ||
            categoryFilter.length > 0 ||
            clientFilter.length > 0 ||
            moduleFilter.length > 0
        );
    }, [dateRange, selectedYear, categoryFilter, clientFilter, moduleFilter]);

    const handleClearAllFilters = () => {
        setSelectedYear('all');
        setCategoryFilter([]);
        setClientFilter([]);
        setModuleFilter([]);
        setDateRange(undefined);
    };

    const fetcher = useCallback(async (filters: any) => {
        const params = new URLSearchParams();
        if (filters.dateRange) params.append('dateRange', JSON.stringify(filters.dateRange));
        params.append('selectedYear', filters.selectedYear);
        params.append('categoryFilter', filters.categoryFilter.join(','));
        params.append('clientFilter', filters.clientFilter.join(','));
        params.append('moduleFilter', filters.moduleFilter.join(','));
        
        const url = `/api/dashboard?${params.toString()}`;
        console.log('🌐 [Fetcher] Fetching URL:', url);
        
        const response = await fetch(url);
        console.log('📡 [Fetcher] Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ [Fetcher] Error response:', errorText);
            throw new Error(`Failed to fetch dashboard data: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        console.log('📦 [Fetcher] Result:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'An unknown error occurred');
        }
        return result.data;
    }, []);

    // Effect to fetch data
    useEffect(() => {
        // Skip pada mount pertama jika ada initialStats
        if (isInitialMount.current) {
            isInitialMount.current = false;
            if (initialStats) {
                return; // Ada initial data, skip fetch
            }
        }

        console.log('🔄 [Dashboard] useEffect triggered with filters:', {
            selectedYear,
            categoryFilter,
            clientFilter,
            moduleFilter,
            dateRange
        });

        startApplyingFilters(async () => {
            setError(null);
            try {
                console.log('📞 [Dashboard] Calling fetcher...');
                const data = await fetcher({ 
                    selectedYear, 
                    categoryFilter, 
                    clientFilter, 
                    moduleFilter, 
                    dateRange 
                });
                console.log('✅ [Dashboard] Data received:', data?.summary?.total_cases, 'cases');
                setStats(data);
            } catch (err: any) {
                console.error('❌ [Dashboard] Fetch error:', err);
                setError(err.message);
                setStats(null);
                toast({
                    variant: "destructive",
                    title: "Could not load dashboard data",
                    description: err.message,
                });
            }
        });
    }, [selectedYear, categoryFilter, clientFilter, moduleFilter, dateRange, fetcher, toast]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        toast({ title: "Refreshing...", description: "Syncing data and recalculating stats." });
        
        refreshDashboardViews().then(() => {
             // Re-fetch data using the current filter state
             fetcher({ selectedYear, categoryFilter, clientFilter, moduleFilter, dateRange })
                .then(data => setStats(data))
                .catch(err => {
                    setError(err.message);
                    setStats(null);
                })
                .finally(() => setIsRefreshing(false));
                
             // Also refresh filter options
             getDashboardFilterOptions().then((optionsResult) => {
                if (optionsResult.error || !optionsResult.data) {
                    console.error("Could not load filter options:", optionsResult.error);
                    setFilterOptions({ categories: [], clients: [], modules: [], years: [] });
                } else {
                    setFilterOptions(optionsResult.data);
                }
             });
        });
    }, [selectedYear, categoryFilter, clientFilter, moduleFilter, dateRange, fetcher, toast]);

    if (isApplyingFilters && !stats) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
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
        )
    }

    if (error) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                        <CardTitle className="text-2xl font-bold">Failed to Load Dashboard Data</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">
                            {error}
                        </CardDescription>
                        <Button onClick={handleRefresh} disabled={isRefreshing}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Try Again
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
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }
    
    const { client_rankings, module_rankings } = stats;
    const maxClientValue = client_rankings.length > 0 ? client_rankings[0].value : 1;
    const maxModuleValue = module_rankings.length > 0 ? module_rankings[0].value : 1;

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-base font-medium">Total Cases</CardTitle>
                            <BarChartIcon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.summary.total_cases}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-base font-medium">Trending Category</CardTitle>
                            <FolderKanban className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold truncate">{stats.summary.trending_category}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-base font-medium">Status Solved</CardTitle>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <div className="text-3xl font-bold">{stats.summary.total_solved}</div>
                                {stats.summary.total_cases > 0 && (
                                    <span className="text-sm font-medium text-green-600 bg-card border border-green-300 dark:border-green-700 rounded-full px-2 py-0.5">
                                        {stats.summary.solved_percentage?.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-base font-medium">Total Clients</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.summary.total_clients}</div>
                        </CardContent>
                    </Card>
                </div>
                
                {/* Main Content */}
                <Card>
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl font-bold">Total Case</CardTitle>
                        </div>
                        <div className="flex w-full sm:w-auto items-center justify-end gap-2 flex-wrap">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button size="sm" variant="outline">
                                        <Filter className="mr-2 h-4 w-4" />
                                        Filter
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 space-y-4">
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none">Filter by Date</h4>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !dateRange && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {dateRange?.from ? (
                                                        dateRange.to ? (
                                                            <>
                                                                {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                                                            </>
                                                        ) : (
                                                            format(dateRange.from, "LLL dd, y")
                                                        )
                                                    ) : (
                                                        <span>Pick a date range</span>
                                                    )}
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
                                        <h4 className="font-medium leading-none">Filter by Category</h4>
                                        <MultiSelect
                                            options={filterOptions?.categories || []}
                                            selected={categoryFilter}
                                            onChange={setCategoryFilter}
                                            placeholder="Select categories..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none">Filter by Client</h4>
                                        <MultiSelect
                                            options={filterOptions?.clients || []}
                                            selected={clientFilter}
                                            onChange={setClientFilter}
                                            placeholder="Select clients..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none">Filter by Module</h4>
                                        <MultiSelect
                                            options={filterOptions?.modules || []}
                                            selected={moduleFilter}
                                            onChange={setModuleFilter}
                                            placeholder="Select modules..."
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
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
                            <Select value={selectedYear} onValueChange={(value) => setSelectedYear(value)}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Select a year" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Years</SelectItem>
                                    {(filterOptions?.years || []).map(year => (
                                        <SelectItem key={year} value={year}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                       <ChartContainer config={dynamicChartConfig} className="h-[250px] w-full">
                            <AreaChart data={stats.monthly_stats} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => typeof value === 'string' ? value.slice(0, 3) : ''}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickCount={5}
                                />
                                <defs>
                                    {chartKeys.map((year) => (
                                        <linearGradient key={year} id={`fill${year}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={dynamicChartConfig[year]?.color} stopOpacity={0.8} />
                                            <stop offset="95%" stopColor={dynamicChartConfig[year]?.color} stopOpacity={0.1} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                <Legend />
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
                    </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl font-bold">All Clients</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-48 pr-4">
                                <div className="space-y-4">
                                    {client_rankings.map((item, index) => (
                                        <TooltipProvider key={index} delayDuration={0}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-32 flex-shrink-0 text-right text-sm text-foreground pr-2 truncate">{item.name}</div>
                                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                                            <div className="flex-1 bg-muted rounded-full h-8 relative overflow-hidden">
                                                                <div 
                                                                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                                                                    style={{ width: `${(item.value / maxClientValue) * 100}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="text-sm font-semibold text-foreground w-16 flex-shrink-0">{item.value.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{item.name}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl font-bold">All Modules</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-48 pr-4">
                                <div className="space-y-4">
                                    {module_rankings.map((item, index) => (
                                        <TooltipProvider key={index} delayDuration={0}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-48 flex-shrink-0 text-right text-sm text-foreground pr-2 truncate">{item.name}</div>
                                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                                            <div className="flex-1 bg-muted rounded-full h-8 relative overflow-hidden">
                                                                <div 
                                                                    className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500"
                                                                    style={{ width: `${(item.value / maxModuleValue) * 100}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="text-sm font-semibold text-foreground w-16 flex-shrink-0">{item.value.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{item.name}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
