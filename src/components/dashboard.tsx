

"use client";

import { AlertTriangle, BarChart as BarChartIcon, User, AppWindow, TrendingUp, RefreshCw } from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { useContext, useMemo, useState, useEffect, useTransition } from "react";
import { TableDataContext } from "@/store/table-data-context";
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, XAxis, YAxis, CartesianGrid, BarChart as RechartsBarChart, Bar as RechartsBar } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { getAllCaseData } from "@/app/actions";
import { Skeleton } from "./ui/skeleton";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


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
  'modules': { label: "Modules", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig

interface DashboardState {
    data: any[] | null;
    error?: string;
    loading: boolean;
}

export function Dashboard() {
    const { dbSheetUrl } = useContext(TableDataContext);
    const [state, setState] = useState<DashboardState>({ data: null, error: undefined, loading: true });
    const [isRefreshing, startRefresh] = useTransition();
    const { toast } = useToast();
    const [selectedYear, setSelectedYear] = useState<'all' | '2024' | '2025' | '2026'>('all');


    useEffect(() => {
        const loadData = async () => {
            if (!dbSheetUrl) {
                setState({ data: null, error: 'DB GSheet URL is not configured in Settings.', loading: false });
                return;
            }
            setState(prevState => ({ ...prevState, loading: true }));
            const result = await getAllCaseData(dbSheetUrl);
            setState({
                data: result.data || null,
                error: result.error,
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
                    data: result.data || null,
                    error: result.error,
                    loading: false
                });
            }
        })
    }

    const areaChartData = useMemo(() => {
        if (!state.data) return [];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyData: Record<string, { "2024": number; "2025": number; "2026": number }> = {};

        months.forEach(month => {
            monthlyData[month] = { "2024": 0, "2025": 0, "2026": 0 };
        });

        state.data.forEach(row => {
            const dateStr = row['DATE'];
            if (dateStr && typeof dateStr === 'string') {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    const monthIndex = parseInt(parts[1], 10) - 1;
                    const year = parts[2];
                    if (monthIndex >= 0 && monthIndex < 12 && ['2024', '2025', '2026'].includes(year)) {
                        const monthName = months[monthIndex];
                        monthlyData[monthName][year as "2024" | "2025" | "2026"] += 1;
                    }
                }
            }
        });

        return months.map(month => ({
            month,
            ...monthlyData[month]
        }));
    }, [state.data]);

    const dashboardStats = useMemo(() => {
        const data = state.data;
        if (!data || data.length === 0) {
            return {
                totalCases: 0,
                clientTrend: 'N/A',
                topModules: [],
                statusCounts: [],
                solvedVsUnsolved: [],
            };
        }

        const getMostFrequent = (field: string) => {
            const frequency: Record<string, number> = {};
            let maxCount = 0;
            let mostFrequent = 'N/A';
            const filteredData = data.filter(row => row[field]);
            if (filteredData.length === 0) return 'N/A';

            filteredData.forEach(row => {
                const value = row[field];
                if (value) {
                    frequency[value] = (frequency[value] || 0) + 1;
                }
            });

            Object.entries(frequency).forEach(([value, count]) => {
                if (count > maxCount) {
                    maxCount = count;
                    mostFrequent = value;
                }
            });
            return mostFrequent;
        };

        const moduleFrequency: Record<string, number> = {};
        data.forEach(row => {
            const module = row['DETAIL MODUL'];
            if (module) {
                moduleFrequency[module] = (moduleFrequency[module] || 0) + 1;
            }
        });

        const topModules = Object.entries(moduleFrequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, value]) => ({ name, value }));

        const statusFrequency: Record<string, number> = {};
        data.forEach(row => {
            const status = String(row['STATUS CASE'] || 'N/A').toUpperCase();
            statusFrequency[status] = (statusFrequency[status] || 0) + 1;
        });
        
        const statusCounts = Object.entries(statusFrequency).map(([name, value]) => ({ name, value, fill: `var(--color-${name})`}));

        const solvedCount = statusFrequency['SOLVED'] || 0;
        const unsolvedCount = data.length - solvedCount;

        const solvedVsUnsolved = [
            { name: 'Solved', value: solvedCount },
            { name: 'Unsolved', value: unsolvedCount }
        ];

        return {
            totalCases: data.length,
            clientTrend: getMostFrequent('CLIENT NAME'),
            topModules,
            statusCounts,
            solvedVsUnsolved,
        };
    }, [state.data]);
    
    if (state.loading) {
         return (
             <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                        <Skeleton className="h-[125px]" />
                        <Skeleton className="h-[125px]" />
                        <Skeleton className="h-[125px]" />
                        <Skeleton className="h-[125px]" />
                    </div>
                     <Skeleton className="h-[350px] w-full" />
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <Skeleton className="h-[300px] col-span-1 lg:col-span-4" />
                        <Skeleton className="h-[300px] col-span-1 lg:col-span-3" />
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
    
    const { totalCases, clientTrend, topModules, statusCounts, solvedVsUnsolved } = dashboardStats;

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                 <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Dashboard</h1>
                        <p className="text-muted-foreground">Sales performance overview</p>
                    </div>
                    <Button onClick={handleRefresh} disabled={isRefreshing} size="sm" variant="outline">
                        <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh Data
                    </Button>
                </div>

                {/* Header Report */}
                <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">Total Cases</CardTitle>
                      <BarChartIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalCases}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">Top Client</CardTitle>
                      <User className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold truncate">{clientTrend}</div>
                    </CardContent>
                  </Card>
                  <Card className="col-span-1 md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Top 5 Modules</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[60px]">
                        <ChartContainer config={chartConfig}>
                            <RechartsBarChart
                                accessibilityLayer
                                data={topModules}
                                layout="vertical"
                                margin={{ left: -10, right: 10, top: -20, bottom: -10 }}
                            >
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    tickLine={false}
                                    tick={false}
                                    axisLine={false}
                                    width={110}
                                />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                <RechartsBar
                                    dataKey="value"
                                    name="modules"
                                    layout="vertical"
                                    radius={5}
                                    barSize={12}
                                >
                                     {topModules.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={chartConfig[`chart-${(index % 5) + 1}` as keyof typeof chartConfig]?.color || 'hsl(var(--muted))'} />
                                     ))}
                                </RechartsBar>
                            </RechartsBarChart>
                        </ChartContainer>
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
                        <ChartContainer config={chartConfig} className="h-[350px] w-full">
                            <AreaChart data={areaChartData} margin={{ left: -20, right: 20, top: 10, bottom: 10 }}>
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
                                    stackId="a"
                                    strokeWidth={2}
                                />}
                                 {(selectedYear === 'all' || selectedYear === '2025') && <Area
                                    dataKey="2025"
                                    type="monotone"
                                    fill="url(#fill2025)"
                                    stroke="var(--color-2025)"
                                    stackId="b"
                                    strokeWidth={2}
                                />}
                                 {(selectedYear === 'all' || selectedYear === '2024') && <Area
                                    dataKey="2024"
                                    type="monotone"
                                    fill="url(#fill2024)"
                                    stroke="var(--color-2024)"
                                    stackId="c"
                                    strokeWidth={2}
                                />}
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Footer Content */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                  <Card className="col-span-1 lg:col-span-4">
                    <CardHeader>
                      <CardTitle>Case Status Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                            <PieChart>
                                <Tooltip
                                  cursor={false}
                                  content={<ChartTooltipContent hideLabel />}
                                />
                                <Pie
                                    data={statusCounts}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={50}
                                    strokeWidth={5}
                                >
                                  {statusCounts.map((entry) => (
                                    <Cell
                                      key={entry.name}
                                      fill={chartConfig[entry.name as keyof typeof chartConfig]?.color || 'hsl(var(--muted))'}
                                      className="focus:outline-none"
                                    />
                                  ))}
                                </Pie>
                                <Legend content={({ payload }) => {
                                    return (
                                        <ul className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-xs">
                                        {payload?.map((entry) => (
                                            <li key={`item-${entry.value}`} className="flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full" style={{backgroundColor: entry.color}} />
                                            <span>{entry.value}</span>
                                            </li>
                                        ))}
                                        </ul>
                                    )
                                    }}
                                />
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                  </Card>
                  <Card className="col-span-1 lg:col-span-3">
                     <CardHeader>
                        <CardTitle>Solved vs Unsolved</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                            <RechartsBarChart
                                data={solvedVsUnsolved}
                                layout="vertical"
                                margin={{ left: 10 }}
                            >
                                <CartesianGrid horizontal={false} />
                                <XAxis type="number" dataKey="value" hide />
                                <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} />
                                <Tooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                <RechartsBar dataKey="value" radius={5}>
                                     {solvedVsUnsolved.map((entry) => (
                                        <Cell key={entry.name} fill={chartConfig[entry.name.toLowerCase() as keyof typeof chartConfig]?.color} />
                                     ))}
                                </RechartsBar>
                            </RechartsBarChart>
                        </ChartContainer>
                      </CardContent>
                  </Card>
                </div>
            </div>
        </div>
    );
}
