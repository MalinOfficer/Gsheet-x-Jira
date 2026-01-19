'use client';

import { useMemo, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, Tooltip, AreaChart, Area, Bar, BarChart as RechartsBarChart, PieChart, Pie } from 'recharts';
import { TableDataContext } from '@/store/table-data-context';
import { ScrollArea } from './ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const StatusCaseChart = ({ data, totalCases, avgResolutionTime }: {
    data: { name: string; value: number; }[],
    totalCases: number,
    avgResolutionTime: number
}) => {

    const chartData = useMemo(() => {
        const colorMap: Record<string, string> = {
            'SOLVED': '#22c55e',       // green-500
            'L3': '#ef4444',           // red-500
            'L2': '#3b82f6',           // blue-500
            'L1': '#f97316',           // orange-500
        };

        return data.map(item => ({
            ...item,
            name: item.name.toUpperCase(),
            fill: colorMap[item.name.toUpperCase()] || '#6b7280', // gray-500
            percentage: totalCases > 0 ? (item.value / totalCases) * 100 : 0,
        })).filter(item => item.value > 0);
    }, [data, totalCases]);

    const resolvedItem = chartData.find(d => d.name === 'SOLVED');
    const inProgressItems = chartData.filter(d => d.name !== 'SOLVED');
    const resolvedValue = resolvedItem ? resolvedItem.percentage : 0;
    const inProgressValue = inProgressItems.reduce((sum, item) => sum + item.percentage, 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl font-bold">Status Case</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="w-full h-[250px] grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                            >
                            </Pie>
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-background border rounded-lg shadow-lg p-2 text-xs">
                                                <p className="font-bold text-foreground">{`${payload[0].name} : ${payload[0].value}`}</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <text
                                x="50%"
                                y="45%"
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="text-3xl font-bold fill-foreground"
                            >
                                {totalCases}
                            </text>
                            <text
                                x="50%"
                                y="60%"
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="text-sm fill-muted-foreground"
                            >
                                Total Cases
                            </text>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {chartData.map((entry, index) => (
                            <div key={`legend-${index}`} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                                <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-medium">{entry.name}</span>
                                    <span className="font-bold">{entry.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-6 pt-6 border-t border-border grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-sm text-muted-foreground">Resolved</p>
                        <p className="text-xl font-bold text-green-600">{resolvedValue.toFixed(1)}%</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">In Progress</p>
                        <p className="text-xl font-bold text-blue-600">
                            {inProgressValue.toFixed(1)}%
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Avg. Resolution</p>
                        <p className="text-xl font-bold text-foreground">{Math.ceil(avgResolutionTime)} jam</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export function DashboardChart() {
    const { tableData: contextData } = useContext(TableDataContext);
    const finalData = contextData?.rows;

    const dashboardStats = useMemo(() => {
        if (!finalData || finalData.length === 0) {
            return {
                totalCases: 0,
                clientTrend: 'N/A',
                moduleTrend: 'N/A',
                statusCounts: [],
                solvedVsUnsolved: [],
                topClientsData: [],
                topModulesData: [],
                unsolvedCases: [],
                clientTrendHistory: [],
                avgResolutionTime: 0,
            };
        }
        
        const getTopN = (data: typeof finalData, field: string, n: number) => {
            const frequency: Record<string, number> = {};
            data.forEach(row => {
                const value = row[field];
                if (value) {
                    frequency[value] = (frequency[value] || 0) + 1;
                }
            });
            return Object.entries(frequency)
                .sort(([, a], [, b]) => b - a)
                .slice(0, n)
                .map(([name, value]) => ({ name, value }));
        };

        const topClientsData = getTopN(finalData, 'Client Name', 5);
        const topModulesData = getTopN(finalData, 'Detail Module', 5);

        const statusFrequency: Record<string, number> = {};
        finalData.forEach(row => {
            const status = String(row.Status || 'N/A').toUpperCase();
            statusFrequency[status] = (statusFrequency[status] || 0) + 1;
        });

        const statusCounts = Object.entries(statusFrequency).map(([name, value]) => ({ 
            name, 
            value,
        }));


        const solvedCount = statusFrequency['SOLVED'] || 0;
        const unsolvedCount = finalData.length - solvedCount;

        const solvedVsUnsolved = [
            { name: 'Solved', value: solvedCount },
            { name: 'Unsolved', value: unsolvedCount }
        ];

        const unsolvedCases = finalData.filter(row => String(row.Status).toLowerCase() !== 'solved');

        // Fake data for client trend chart
        const clientTrendHistory = [
            { month: 'Jan', cases: Math.floor(Math.random() * 20) + 5 },
            { month: 'Feb', cases: Math.floor(Math.random() * 20) + 5 },
            { month: 'Mar', cases: Math.floor(Math.random() * 20) + 5 },
            { month: 'Apr', cases: Math.floor(Math.random() * 20) + 5 },
            { month: 'May', cases: Math.floor(Math.random() * 20) + 5 },
            { month: 'Jun', cases: Math.floor(Math.random() * 20) + 5 },
        ];

        let totalResolutionTime = 0;
        let resolvedCountWithTime = 0;

        const solvedCasesForTimeCalc = finalData.filter(
            row => String(row.Status).toLowerCase() === 'solved'
        );

        solvedCasesForTimeCalc.forEach(row => {
            const createdAt = new Date(row['Created At']);
            const resolvedAt = new Date(row['Resolved At']);

            if (
                !isNaN(createdAt.getTime()) &&
                !isNaN(resolvedAt.getTime()) &&
                resolvedAt > createdAt
            ) {
                totalResolutionTime += resolvedAt.getTime() - createdAt.getTime();
                resolvedCountWithTime++;
            }
        });

        const avgResolutionHours =
            resolvedCountWithTime > 0
                ? (totalResolutionTime / resolvedCountWithTime) / (1000 * 60 * 60)
                : 0;

        return {
            totalCases: finalData.length,
            clientTrend: topClientsData.length > 0 ? topClientsData[0].name : 'N/A',
            moduleTrend: topModulesData.length > 0 ? topModulesData[0].name : 'N/A',
            statusCounts,
            solvedVsUnsolved,
            topClientsData,
            topModulesData,
            unsolvedCases,
            clientTrendHistory,
            avgResolutionTime: avgResolutionHours,
        };
    }, [finalData]);

    if (!finalData || finalData.length === 0) {
      return null;
    }

    const { totalCases, clientTrend, moduleTrend, statusCounts, unsolvedCases, topClientsData, topModulesData, avgResolutionTime } = dashboardStats;
    
    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                 <Card className="p-6 flex flex-col min-h-[150px]">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Client Trend</p>
                    <p className="font-bold text-lg mt-2 text-wrap">{clientTrend}</p>
                    <ResponsiveContainer width="100%" height={60}>
                         <AreaChart data={topClientsData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorClient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Tooltip
                                formatter={(value, name, props) => [value, props.payload.name]}
                                contentStyle={{ fontSize: '12px', padding: '4px 8px' }}
                                wrapperClassName="!border-none !shadow-lg !rounded-lg"
                                cursor={false}
                            />
                            <Area type="monotone" dataKey="value" name="name" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#colorClient)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>
                 <Card className="p-6 flex flex-col min-h-[150px]">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Module Trend</p>
                    <p className="font-bold text-lg mt-2 text-wrap">{moduleTrend}</p>
                     <ResponsiveContainer width="100%" height={60}>
                        <RechartsBarChart data={topModulesData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                             <defs>
                                <linearGradient id="colorModule" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.2}/>
                                </linearGradient>
                            </defs>
                            <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-background border rounded-lg shadow-lg p-2 text-xs">
                                        <p className="font-bold text-foreground">{`${payload[0].payload.name} : ${payload[0].value}`}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                                wrapperClassName="!border-none !shadow-lg !rounded-lg"
                                cursor={{fill: 'hsl(var(--background))', opacity: 0.5}}
                            />
                            <Bar dataKey="value" barSize={20} fill="url(#colorModule)" />
                        </RechartsBarChart>
                    </ResponsiveContainer>
                </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StatusCaseChart data={statusCounts} totalCases={totalCases} avgResolutionTime={avgResolutionTime} />
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className='text-xl font-bold'>List Unsolved Case</CardTitle>
                    </CardHeader>
                    <CardContent className='flex-grow p-0 shadow-inner bg-muted/30 rounded-b-lg'>
                        <ScrollArea className="h-64">
                            <Table>
                                <TableHeader className="sticky top-0 bg-green-100 dark:bg-green-900/20 z-10">
                                    <TableRow>
                                    <TableHead className="w-[50px] text-green-900 dark:text-green-100 py-2">NO</TableHead>
                                    <TableHead className="text-green-900 dark:text-green-100 py-2">CLIENT</TableHead>
                                    <TableHead className="text-green-900 dark:text-green-100 py-2">DETAIL CASE</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {unsolvedCases.map((caseItem, index) => (
                                    <TableRow key={index} className="text-xs">
                                        <TableCell className="font-medium py-1.5">{index + 1}</TableCell>
                                        <TableCell className="py-1.5">{caseItem['Client Name']}</TableCell>
                                        <TableCell className="py-1.5">{caseItem['Title']}</TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
