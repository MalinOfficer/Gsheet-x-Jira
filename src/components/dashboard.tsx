

"use client";

import { AlertTriangle, BarChart as BarChartIcon, User, AppWindow, TrendingUp, RefreshCw, CheckCircle, Users, FolderKanban, Filter } from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle,
    CardDescription
} from "@/components/ui/card";
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
  modules: { label: "Modules", color: "hsl(var(--chart-1))" },
  "Top 5 Modules": { label: "Modules", color: "hsl(var(--chart-1))" },
  clients: { label: "Clients", color: "hsl(var(--primary))" },
  "Top 5 Clients": { label: "Clients", color: "hsl(var(--primary))" },
} satisfies ChartConfig

interface DashboardState {
    data: any[] | null;
    error?: string;
    loading: boolean;
}

export function Dashboard() {
    const { dbSheetUrl } = useContext(SettingsContext);
    const [state, setState] = useState<DashboardState>({ data: null, error: undefined, loading: true });
    const [isRefreshing, startRefresh] = useTransition();
    const { toast } = useToast();
    const [selectedYear, setSelectedYear] = useState<'all' | '2024' | '2025' | '2026'>('all');
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

    const filterOptions = useMemo(() => {
        if (!state.data) return { categories: [], clients: [], modules: [] };
        
        const createOptions = (header: string | undefined) => {
            if (!header) return [];
            const values = [...new Set(state.data.map(row => row[header]).filter(Boolean))];
            return values.map(val => ({ label: val, value: val }));
        }

        return {
            categories: createOptions(categoryHeader),
            clients: createOptions(clientHeader),
            modules: createOptions(moduleHeader)
        }
    }, [state.data, categoryHeader, clientHeader, moduleHeader]);

    const filteredData = useMemo(() => {
        if (!state.data) return [];
        
        let data = state.data;

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

    }, [state.data, categoryFilter, clientFilter, moduleFilter, categoryHeader, clientHeader, moduleHeader]);

    const dashboardStats = useMemo(() => {
        const data = filteredData;
        if (!data || data.length === 0) {
            return {
                totalCases: 0,
                topClients: [],
                allClients: [],
                topModules: [],
                statusCounts: [],
                solvedVsUnsolved: [],
                monthlyData: [],
                totalClients: 0,
                moduleTrend: 'N/A',
                totalSolved: 0,
            };
        }

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

        const topClients = allClients.slice(0, 5);
        
        const totalClients = Object.keys(clientFrequency).length;

        const categoryFrequency = createFrequencyMap(categoryHeader);
        const topCategories = Object.entries(categoryFrequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, value]) => ({ name, value }));

        const moduleTrend = topCategories.length > 0 ? topCategories[0].name : 'N/A';
        
        const detailModuleHeader = findHeader(['DETAIL MODUL', 'Detail Module']);
        const moduleFrequency = createFrequencyMap(detailModuleHeader);
        const topModules = Object.entries(moduleFrequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
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

        const dateHeader = findHeader(['DATE', 'Date']);
        if (dateHeader) {
            data.forEach(row => {
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
            topClients,
            allClients,
            topModules,
            statusCounts,
            solvedVsUnsolved,
            monthlyData,
            totalClients,
            moduleTrend,
            totalSolved
        };
    }, [filteredData, categoryHeader, clientHeader]);
    
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
    
    const { totalCases, topClients, allClients, topModules, statusCounts, solvedVsUnsolved, monthlyData, totalClients, moduleTrend, totalSolved } = dashboardStats;

    return (
        <div className="flex-1 bg-background text-foreground px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
            <div className="max-w-7xl mx-auto space-y-4">
                 <div className="flex justify-between items-center pt-4 sm:pt-6 md:pt-8">
                    <div>
                        <h1 className="text-2xl font-bold">Dashboard</h1>
                        <p className="text-muted-foreground">Sales performance overview</p>
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
                    </div>
                </div>

                {/* Header Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
                      <BarChartIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalCases}</div>
                    </CardContent>
                  </Card>
                   <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Trending Category</CardTitle>
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold truncate">{moduleTrend}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Status Solved</CardTitle>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalSolved}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalClients}</div>
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
                        <Select value={selectedYear} onValueChange={(value) => setSelectedYear(value as 'all' | '2024' | '2025' | '2026')}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select a year" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Years</SelectItem>
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                            <AreaChart data={monthlyData} margin={{ left: -20, right: 20, top: 10, bottom: 10 }}>
                                <defs>
                                    <linearGradient id="fill2026" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-2026)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="var(--color-2026)" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="fill2025" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-2025)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="var(--color-2025)" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="fill2024" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-2024)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="var(--color-2024)" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} />
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
                                {(selectedYear === 'all' || selectedYear === '2026') && <Area
                                    dataKey="2026"
                                    type="monotone"
                                    fill="url(#fill2026)"
                                    stroke="var(--color-2026)"
                                    strokeWidth={2}
                                />}
                                 {(selectedYear === 'all' || selectedYear === '2025') && <Area
                                    dataKey="2025"
                                    type="monotone"
                                    fill="url(#fill2025)"
                                    stroke="var(--color-2025)"
                                    strokeWidth={2}
                                />}
                                 {(selectedYear === 'all' || selectedYear === '2024') && <Area
                                    dataKey="2024"
                                    type="monotone"
                                    fill="url(#fill2024)"
                                    stroke="var(--color-2024)"
                                    strokeWidth={2}
                                />}
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Footer Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader className="p-4">
                            <CardTitle className="text-base font-medium">Clients by Case Count</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[200px] pr-0">
                            <ScrollArea className="h-full">
                                <ChartContainer config={chartConfig} className="w-full h-[400px]">
                                    <RechartsBarChart
                                        accessibilityLayer
                                        data={allClients}
                                        layout="vertical"
                                        margin={{ left: 10, top: 10, right: 40, bottom: 10 }}
                                    >
                                        <CartesianGrid horizontal={false} />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            tickLine={false}
                                            tickMargin={10}
                                            axisLine={false}
                                            className="text-xs"
                                            interval={0}
                                            width={80}
                                        />
                                        <XAxis dataKey="value" type="number" hide />
                                        <ChartTooltip
                                            cursor={{ fill: "hsl(var(--muted))" }}
                                            content={<ChartTooltipContent />}
                                        />
                                        <Bar dataKey="value" name="Clients" radius={5} fill="var(--color-clients)" barSize={20}>
                                            <LabelList dataKey="value" position="right" offset={8} className="fill-foreground text-xs" />
                                        </Bar>
                                    </RechartsBarChart>
                                </ChartContainer>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-4">
                            <CardTitle className="text-base font-medium">Top 5 Modules</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[200px] flex items-center justify-center">
                           <ChartContainer config={chartConfig} className="w-full h-full">
                                <RechartsBarChart
                                    data={topModules}
                                    margin={{ top: 20, right: 20, left: -20, bottom: 5 }}
                                >
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        tick={false}
                                    />
                                    <YAxis />
                                    <ChartTooltip
                                        cursor={{ fill: "hsl(var(--muted))" }}
                                        content={<ChartTooltipContent />}
                                    />
                                    <Bar dataKey="value" name="Top 5 Modules" fill="var(--color-modules)" radius={4} />
                                </RechartsBarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}



    

    