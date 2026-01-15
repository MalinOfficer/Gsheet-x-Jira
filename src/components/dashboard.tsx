
"use client";

import { AlertTriangle, BarChart as BarChartIcon, User, AppWindow, TrendingUp, RefreshCw, CheckCircle, Users, FolderKanban, Filter, Maximize, FilterX } from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useContext, useMemo, useState, useEffect, useTransition } from "react";
import { SettingsContext } from "@/contexts/settings-provider";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, BarChart as RechartsBarChart, Bar, Tooltip, Legend, LabelList } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { getAllCaseData } from "@/app/actions";
import { Skeleton } from "./ui/skeleton";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelect } from "@/components/ui/multi-select";
import { ScrollArea } from "./ui/scroll-area";


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

interface DashboardState {
    data: any[] | null;
    error?: string;
    loading: boolean;
}

const CustomYAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const value = payload.value;
    const maxCharsPerLine = 18;
    const lineHeight = 12;

    const chunkSubstr = (str: string, size: number) => {
        const numChunks = Math.ceil(str.length / size);
        const chunks = new Array(numChunks);
        for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
            chunks[i] = str.substring(o, o + size);
        }
        return chunks;
    };
    
    if (value.length > maxCharsPerLine) {
        const lines = chunkSubstr(value, maxCharsPerLine);
        return (
            <g transform={`translate(${x},${y})`}>
                <text x={-10} y={0} dy={4} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: '11px', fontWeight: 500 }}>
                    {lines.map((line, i) => (
                        <tspan key={i} x={-10} dy={i > 0 ? lineHeight : 0}>{line}</tspan>
                    ))}
                </text>
            </g>
        );
    }

    return (
        <g transform={`translate(${x},${y})`}>
            <text x={-10} y={0} dy={4} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: '11px', fontWeight: 500 }}>
                {value}
            </text>
        </g>
    );
};

export function Dashboard() {
    const { dbSheetUrl } = useContext(SettingsContext);
    const [state, setState] = useState<DashboardState>({ data: null, error: undefined, loading: true });
    const [isRefreshing, startRefresh] = useTransition();
    const { toast } = useToast();
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
    const [clientFilter, setClientFilter] = useState<string[]>([]);
    const [moduleFilter, setModuleFilter] = useState<string[]>([]);


    useEffect(() => {
        const loadData = async () => {
            if (!dbSheetUrl) {
                setState({ data: null, error: 'DB GSheet URL is not configured in Settings.', loading: false });
                return;
            }
            setState(prevState => ({ ...prevState, loading: true }));
            const result = await getAllCaseData(dbSheetUrl);
            setState({
                data: result?.data || null,
                error: result?.error,
                loading: false
            });
        };
        loadData();
    }, [dbSheetUrl]);
    
    const handleRefresh = () => {
        startRefresh(async () => {
            if (!dbSheetUrl) {
                toast({ variant: 'destructive', title: "URL Not Set", description: "Google Sheet URL is not configured in Settings." });
                return;
            }
            const result = await getAllCaseData(dbSheetUrl);
             if (result.error) {
                toast({ variant: 'destructive', title: "Refresh Failed", description: result.error });
            } else {
                toast({ title: "Cache Refreshed", description: "Dashboard data has been synced with Google Sheets." });
                setState({
                    data: result?.data || null,
                    error: result.error,
                    loading: false
                });
            }
        })
    }
    
    const findHeader = (possibleNames: string[]): string | undefined => {
         if (!state.data || !state.data[0]) return undefined;
         const actualHeaders = Object.keys(state.data[0]);
         for (const name of possibleNames) {
             const found = actualHeaders.find(header => header.toLowerCase() === name.toLowerCase());
             if (found) return found;
         }
         return undefined;
    };
    
    const categoryHeader = useMemo(() => findHeader(['KATEGORI', 'Ticket Category', 'Category']), [state.data]);
    const clientHeader = useMemo(() => findHeader(['CLIENT NAME', 'Client Name', 'Client']), [state.data]);
    const moduleHeader = useMemo(() => findHeader(['MODULE', 'Module']), [state.data]);
    const detailModuleHeader = useMemo(() => findHeader(['DETAIL MODUL', 'Detail Module']), [state.data]);
    const dateHeader = useMemo(() => findHeader(['DATE', 'Date']), [state.data]);

    const filterOptions = useMemo(() => {
        if (!state.data) return { categories: [], clients: [], modules: [], years: [] };
        
        const createOptions = (header: string | undefined) => {
            if (!header) return [];
            const values = [...new Set(state.data.map(row => row[header]).filter(Boolean))];
            return values.map(val => ({ label: val, value: val }));
        }

        const years = new Set<string>();
        if (dateHeader) {
            state.data.forEach(row => {
                const dateStr = row[dateHeader];
                if (dateStr && typeof dateStr === 'string' && dateStr.includes('/')) {
                    const year = dateStr.split('/')[2];
                    if (year) years.add(year);
                }
            });
        }

        return {
            categories: createOptions(categoryHeader),
            clients: createOptions(clientHeader),
            modules: createOptions(moduleHeader),
            years: Array.from(years).sort((a, b) => parseInt(b) - parseInt(a))
        }
    }, [state.data, categoryHeader, clientHeader, moduleHeader, dateHeader]);

    const filteredData = useMemo(() => {
        if (!state.data) return [];
        
        let data = state.data;
        
        if (selectedYear !== 'all' && dateHeader) {
            data = data.filter(row => {
                const dateStr = row[dateHeader];
                return dateStr && typeof dateStr === 'string' && dateStr.endsWith(`/${selectedYear}`);
            });
        }

        if (categoryFilter.length > 0 && categoryHeader) {
            data = data.filter(row => categoryFilter.includes(row[categoryHeader]));
        }
        if (clientFilter.length > 0 && clientHeader) {
            data = data.filter(row => clientFilter.includes(row[clientHeader]));
        }
        if (moduleFilter.length > 0 && moduleHeader) {
            data = data.filter(row => moduleFilter.includes(row[moduleHeader]));
        }

        return data;

    }, [state.data, selectedYear, categoryFilter, clientFilter, moduleFilter, categoryHeader, clientHeader, moduleHeader, dateHeader]);

    const dashboardStats = useMemo(() => {
        const data = filteredData;
        if (!data || data.length === 0) {
            return {
                totalCases: 0,
                allClients: [],
                allModules: [],
                statusCounts: [],
                solvedVsUnsolved: [],
                monthlyData: [],
                totalClients: 0,
                moduleTrend: 'N/A',
                totalSolved: 0,
            };
        }
        
        const allDataForMonthly = filteredData;

        const createFrequencyMap = (field: string | undefined) => {
            if (!field) return {};
            const frequency: Record<string, number> = {};
            data.forEach(row => {
                const value = row[field];
                if (value) {
                    frequency[value] = (frequency[value] || 0) + 1;
                }
            });
            return frequency;
        };
        
        const clientFrequency = createFrequencyMap(clientHeader);
        const allClients = Object.entries(clientFrequency)
            .sort(([, a], [, b]) => b - a)
            .map(([name, value]) => ({ name, value }));

        const totalClients = Object.keys(clientFrequency).length;

        const moduleFrequency = createFrequencyMap(moduleHeader);
        const topCategories = Object.entries(moduleFrequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, value]) => ({ name, value }));

        const moduleTrend = topCategories.length > 0 ? topCategories[0].name : 'N/A';
        
        const detailModuleFrequency = createFrequencyMap(detailModuleHeader);
        const allModules = Object.entries(detailModuleFrequency)
            .sort(([, a], [, b]) => b - a)
            .map(([name, value]) => ({ name, value }));

        const statusHeader = findHeader(['STATUS CASE', 'Status Case', 'Status']);
        const statusFrequency: Record<string, number> = {};
        if (statusHeader) {
            data.forEach(row => {
                const status = String(row[statusHeader] || 'N/A').toUpperCase();
                statusFrequency[status] = (statusFrequency[status] || 0) + 1;
            });
        }
        
        const statusCounts = Object.entries(statusFrequency).map(([name, value]) => ({ name, value }));

        const totalSolved = statusFrequency['SOLVED'] || 0;
        const unsolvedCount = data.length - totalSolved;

        const solvedVsUnsolved = [
            { name: 'Solved', value: totalSolved },
            { name: 'Unsolved', value: unsolvedCount }
        ];

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyAggregation: Record<string, { "2024": number; "2025": number; "2026": number }> = {};
        months.forEach(month => {
            monthlyAggregation[month] = { "2024": 0, "2025": 0, "2026": 0 };
        });

        if (dateHeader) {
            allDataForMonthly.forEach(row => {
                const dateStr = row[dateHeader];
                if (dateStr && typeof dateStr === 'string') {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        const monthIndex = parseInt(parts[1], 10) - 1;
                        const year = parts[2];
                        if (monthIndex >= 0 && monthIndex < 12 && ['2024', '2025', '2026'].includes(year)) {
                            const monthName = months[monthIndex];
                            monthlyAggregation[monthName][year as "2024" | "2025" | "2026"] += 1;
                        }
                    }
                }
            });
        }

        const monthlyData = months.map(month => ({
            month,
            ...monthlyAggregation[month]
        }));


        return {
            totalCases: data.length,
            allClients,
            allModules,
            statusCounts,
            solvedVsUnsolved,
            monthlyData,
            totalClients,
            moduleTrend,
            totalSolved
        };
    }, [filteredData, clientHeader, moduleHeader, detailModuleHeader, dateHeader]);
    
    if (state.loading) {
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

    if (state.error) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                        <CardTitle>Failed to Load Dashboard Data</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">
                            {state.error}
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
    
    if (!state.data || state.data.length === 0) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
                        <CardTitle>No Data Found</CardTitle>
                        <p className="mt-2 text-muted-foreground">The configured Google Sheet might be empty.</p>
                         <Button onClick={handleRefresh} disabled={isRefreshing} className="mt-4">
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }
    
    const { allClients, allModules } = dashboardStats;

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
                      <div className="text-2xl font-bold">{dashboardStats.totalCases}</div>
                    </CardContent>
                  </Card>
                   <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                      <CardTitle className="text-sm font-medium">Trending Category</CardTitle>
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-6 pt-2">
                      <div className="text-2xl font-bold truncate">{dashboardStats.moduleTrend}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                      <CardTitle className="text-sm font-medium">Status Solved</CardTitle>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-6 pt-2">
                      <div className="text-2xl font-bold">{dashboardStats.totalSolved}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                      <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-6 pt-2">
                      <div className="text-2xl font-bold">{dashboardStats.totalClients}</div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Main Content */}
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Total Case of This Year</CardTitle>
                            <CardDescription>Comparison of total cases over the last three years.</CardDescription>
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
                                        <h4 className="font-medium leading-none">Filter by Category</h4>
                                        <MultiSelect
                                            options={filterOptions.categories}
                                            selected={categoryFilter}
                                            onChange={setCategoryFilter}
                                            placeholder="Select categories..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none">Filter by Client</h4>
                                        <MultiSelect
                                            options={filterOptions.clients}
                                            selected={clientFilter}
                                            onChange={setClientFilter}
                                            placeholder="Select clients..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none">Filter by Module</h4>
                                        <MultiSelect
                                            options={filterOptions.modules}
                                            selected={moduleFilter}
                                            onChange={setModuleFilter}
                                            placeholder="Select modules..."
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
                            <Button onClick={handleRefresh} disabled={isRefreshing} size="sm" variant="outline">
                                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Refresh Data
                            </Button>
                            <Select value={selectedYear} onValueChange={(value) => setSelectedYear(value)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select a year" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Years</SelectItem>
                                    {filterOptions.years.map(year => (
                                        <SelectItem key={year} value={year}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                            <AreaChart data={dashboardStats.monthlyData} margin={{ left: -20, right: 20, top: 10, bottom: 10 }}>
                                <defs>
                                    <linearGradient id="fill2026" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="fill2025" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
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
                                    stroke="hsl(var(--chart-1))"
                                    strokeWidth={2}
                                />
                                 <Area
                                    dataKey="2025"
                                    type="monotone"
                                    fill="url(#fill2025)"
                                    stroke="hsl(var(--chart-2))"
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
                            <CardTitle className="text-xl font-bold">All Clients</CardTitle>
                        </CardHeader>
                         <CardContent>
                            <div style={{ height: '220px', overflowY: 'auto' }} className="rounded-lg bg-muted/30">
                                <ResponsiveContainer width="100%" height={allClients.length * 60}>
                                    <RechartsBarChart
                                        data={allClients}
                                        layout="vertical"
                                        margin={{ top: 5, right: 70, left: -20, bottom: 5 }}
                                    >
                                        <defs>
                                          <linearGradient id="clientsGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="hsl(160 60% 45%)" stopOpacity={0.9}/>
                                            <stop offset="100%" stopColor="hsl(160 60% 45%)" stopOpacity={0.4}/>
                                          </linearGradient>
                                          <filter id="softGlowClients">
                                            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                            <feMerge>
                                              <feMergeNode in="coloredBlur"/>
                                              <feMergeNode in="SourceGraphic"/>
                                            </feMerge>
                                          </filter>
                                        </defs>
                                        <XAxis type="number" stroke="hsl(var(--border))" style={{ fontSize: '11px' }} tick={{ fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="name" width={130} stroke="hsl(var(--border))" tick={<CustomYAxisTick />} axisLine={false} tickLine={false} />
                                        <Tooltip
                                          contentStyle={{ 
                                            backgroundColor: 'hsl(var(--background))', 
                                            borderColor: 'hsl(160 60% 45%)', 
                                            color: 'hsl(var(--foreground))',
                                            borderRadius: 'var(--radius)',
                                            fontWeight: '600',
                                            boxShadow: '0 10px 25px rgba(20, 184, 166, 0.3)'
                                          }}
                                          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                                        />
                                        <Bar dataKey="value" fill="url(#clientsGradient)" radius={[0, 6, 6, 0]} maxBarSize={36} filter="url(#softGlowClients)">
                                            <LabelList dataKey="value" position="right" formatter={(value: number) => value.toLocaleString()} style={{ fontSize: '13px', fontWeight: '600', fill: 'hsl(var(--foreground))' }}/>
                                        </Bar>
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-xl font-bold">All Modules</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div style={{ height: '220px', overflowY: 'auto' }} className="rounded-lg bg-muted/30">
                                <ResponsiveContainer width="100%" height={allModules.length * 60}>
                                    <RechartsBarChart
                                        data={allModules}
                                        layout="vertical"
                                        margin={{ top: 5, right: 70, left: -20, bottom: 5 }}
                                    >
                                        <defs>
                                          <linearGradient id="modulesGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="hsl(221 83% 53%)" stopOpacity={0.9}/>
                                            <stop offset="100%" stopColor="hsl(221 83% 53%)" stopOpacity={0.4}/>
                                          </linearGradient>
                                          <filter id="softGlowModules">
                                            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                            <feMerge>
                                              <feMergeNode in="coloredBlur"/>
                                              <feMergeNode in="SourceGraphic"/>
                                            </feMerge>
                                          </filter>
                                        </defs>
                                        <XAxis type="number" stroke="hsl(var(--border))" style={{ fontSize: '11px' }} tick={{ fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="name" width={140} stroke="hsl(var(--border))" tick={<CustomYAxisTick />} axisLine={false} tickLine={false} />
                                        <Tooltip
                                          contentStyle={{ 
                                            backgroundColor: 'hsl(var(--background))', 
                                            borderColor: 'hsl(221 83% 53%)',
                                            color: 'hsl(var(--foreground))',
                                            borderRadius: 'var(--radius)',
                                            fontWeight: '600',
                                            boxShadow: '0 10px 25px rgba(99, 102, 241, 0.3)'
                                          }}
                                          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                                        />
                                        <Bar dataKey="value" fill="url(#modulesGradient)" radius={[0, 6, 6, 0]} maxBarSize={36} filter="url(#softGlowModules)">
                                             <LabelList dataKey="value" position="right" formatter={(value: number) => value.toLocaleString()} style={{ fontSize: '13px', fontWeight: '600', fill: 'hsl(var(--foreground))' }}/>
                                        </Bar>
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

    