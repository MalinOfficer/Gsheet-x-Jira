
"use client";

import { BarChart as BarChartIcon, CheckCircle, Users, FolderKanban, Filter, RefreshCw, FilterX, ArrowLeft, AlertTriangle, Calendar as CalendarIcon } from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { useContext, useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { SettingsContext } from "@/contexts/settings-provider";
import { TableDataContext } from "@/store/table-data-context";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, Bar, BarChart as RechartsBarChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { getDashboardStats, getDashboardFilterOptions, syncDashboardCache } from "@/app/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelect } from "@/components/ui/multi-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Separator } from "./ui/separator";


const chartConfig = {
  "2026": { label: "2026", color: "hsl(var(--chart-1))" },
  "2025": { label: "2025", color: "hsl(var(--chart-2))" },
  "2024": { label: "2024", color: "hsl(var(--chart-3))" },
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
    totalCases: number;
    allClients: { name: string; value: number }[];
    allModules: { name: string; value: number }[];
    solvedVsUnsolved: { name: string; value: number }[];
    monthlyData: any[];
    totalClients: number;
    categoryTrend: string;
    totalSolved: number;
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
    const { dbSheetUrl } = useContext(SettingsContext);
    const { setIsProcessing } = useContext(TableDataContext);
    const { toast } = useToast();

    // State is initialized with data passed from the Server Component
    const [stats, setStats] = useState<DashboardStats | null>(initialStats);
    const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(initialOptions);
    const [error, setError] = useState<string | null>(initialError || null);
    const [isPending, startTransition] = useTransition();
    const [isRefreshing, setIsRefreshing] = useState(false);


    // Filter states
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
    const [clientFilter, setClientFilter] = useState<string[]>([]);
    const [moduleFilter, setModuleFilter] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    useEffect(() => {
        setIsProcessing(isPending);
    }, [isPending, setIsProcessing]);

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
        toast({ title: "Filters Cleared", description: "All active filters have been reset." });
    };

    // Effect to re-fetch stats when filters change. Initial fetch is done by the server.
    useEffect(() => {
        // Skip fetch on initial render if we have initial data
        if (!initialStats) return;

        const fetchFilteredStats = () => {
             if (!dbSheetUrl) return;
             startTransition(async () => {
                setError(null);
                const result = await getDashboardStats({
                    sheetUrl: dbSheetUrl,
                    selectedYear,
                    categoryFilter,
                    clientFilter,
                    moduleFilter,
                    dateRange,
                });

                if (result.error) {
                    toast({ variant: 'destructive', title: "Error applying filters", description: result.error });
                } else {
                    setStats(result as DashboardStats);
                }
            });
        }
        
        fetchFilteredStats();

    }, [selectedYear, categoryFilter, clientFilter, moduleFilter, dbSheetUrl, toast, initialStats, dateRange]);


    const handleRefresh = useCallback(() => {
        if (!dbSheetUrl) {
            setError('DB GSheet URL is not configured in Settings.');
            return;
        }

        startTransition(async () => {
            setIsRefreshing(true);
            setError(null);
            toast({ title: "Refreshing...", description: "Syncing data and recalculating stats." });
            
            await syncDashboardCache(dbSheetUrl);

            const [statsResult, optionsResult] = await Promise.all([
                getDashboardStats({ sheetUrl: dbSheetUrl, selectedYear, categoryFilter, clientFilter, moduleFilter, dateRange }),
                getDashboardFilterOptions(dbSheetUrl)
            ]);

            if (statsResult.error) {
                setError(statsResult.error);
                setStats(null);
            } else {
                setStats(statsResult as DashboardStats);
            }

            if (optionsResult.error || !optionsResult.data) {
                console.error("Could not load filter options:", optionsResult.error);
                setFilterOptions({ categories: [], clients: [], modules: [], years: [] });
            } else {
                setFilterOptions(optionsResult.data);
            }
            setIsRefreshing(false);
        });
    }, [dbSheetUrl, selectedYear, categoryFilter, clientFilter, moduleFilter, toast, dateRange]);

    if (isPending && !stats) {
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
                        <CardTitle>Failed to Load Dashboard Data</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">
                            {error}
                        </CardDescription>
                         <Button onClick={handleRefresh} disabled={isPending}>
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
                        <CardTitle>No Data Found</CardTitle>
                        <p className="mt-2 text-muted-foreground">The configured Google Sheet might be empty or inaccessible.</p>
                         <Button onClick={handleRefresh} disabled={isPending} className="mt-4">
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }
    
    const { allClients, allModules } = stats;
    const maxClientValue = allClients.length > 0 ? allClients[0].value : 1;
    const maxModuleValue = allModules.length > 0 ? allModules[0].value : 1;


    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4">
                {/* Header Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                      <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
                      <BarChartIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-6 pt-2">
                      <div className="text-2xl font-bold">{stats.totalCases}</div>
                    </CardContent>
                  </Card>
                   <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                      <CardTitle className="text-sm font-medium">Trending Category</CardTitle>
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-6 pt-2">
                      <div className="text-2xl font-bold truncate">{stats.categoryTrend}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                      <CardTitle className="text-sm font-medium">Status Solved</CardTitle>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-6 pt-2">
                      <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-bold">{stats.totalSolved}</div>
                        {stats.totalCases > 0 && (
                            <span className="text-xs font-medium text-green-600 border border-green-200 dark:border-green-800 rounded-full px-2 py-0.5">
                                {((stats.totalSolved / stats.totalCases) * 100).toFixed(1)}%
                            </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                      <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-6 pt-2">
                      <div className="text-2xl font-bold">{stats.totalClients}</div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Main Content */}
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Total Case</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
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
                                                    id="date"
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
                                                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                                                {format(dateRange.to, "LLL dd, y")}
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
                            <Button onClick={handleRefresh} disabled={isPending} size="sm" variant="outline">
                                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Refresh Data
                            </Button>
                            <Select value={selectedYear} onValueChange={(value) => setSelectedYear(value)}>
                                <SelectTrigger className="w-[180px]">
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
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                            <AreaChart data={stats.monthlyData} margin={{ left: 12, right: 20, top: 10, bottom: 10 }}>
                                <defs>
                                    <linearGradient id="fill2026" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(221 83% 53%)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="hsl(221 83% 53%)" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="fill2025" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(160 60% 45%)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="hsl(160 60% 45%)" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="fill2024" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => `${value}`}
                                />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent indicator="dot" />}
                                />
                                <Legend />
                                <Area
                                    dataKey="2026"
                                    type="monotone"
                                    fill="url(#fill2026)"
                                    stroke="hsl(221 83% 53%)"
                                    strokeWidth={2}
                                />
                                 <Area
                                    dataKey="2025"
                                    type="monotone"
                                    fill="url(#fill2025)"
                                    stroke="hsl(160 60% 45%)"
                                    strokeWidth={2}
                                />
                                 <Area
                                    dataKey="2024"
                                    type="monotone"
                                    fill="url(#fill2024)"
                                    stroke="hsl(var(--chart-3))"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl font-semibold">All Clients</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-48 pr-4">
                                <div className="space-y-4">
                                  {allClients.map((item, index) => (
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
                            <CardTitle className="text-xl font-semibold">All Modules</CardTitle>
                        </CardHeader>
                        <CardContent>
                           <ScrollArea className="h-48 pr-4">
                                <div className="space-y-4">
                                  {allModules.map((item, index) => (
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
