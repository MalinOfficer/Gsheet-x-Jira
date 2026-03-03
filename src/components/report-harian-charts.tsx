'use client';

import { useMemo, useContext, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ResponsiveContainer, Tooltip, AreaChart, Area, Bar,
    BarChart as RechartsBarChart, PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend
} from 'recharts';
import { TableDataContext } from '@/store/table-data-context';
import { ScrollArea } from './ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { TrendingUp, TrendingDown, Layers, Users, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Stat Mini Card ─────────────────────────────────────────────────────────
const StatPill = ({
    label, value, color, icon: Icon,
}: {
    label: string; value: number | string; color: string; icon?: React.ElementType;
}) => (
    <div className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3 border",
        "bg-white/60 dark:bg-white/5 backdrop-blur-sm shadow-sm",
        "hover:scale-[1.02] transition-transform duration-200 cursor-default"
    )}>
        {Icon && (
            <div className="rounded-xl p-2" style={{ backgroundColor: `${color}20` }}>
                <Icon size={16} style={{ color }} />
            </div>
        )}
        <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground leading-none mb-1">
                {label}
            </p>
            <p className="text-xl font-black leading-none" style={{ color }}>
                {value}
            </p>
        </div>
    </div>
);

// ─── Status Donut Chart ──────────────────────────────────────────────────────
const COLORS: Record<string, string> = {
    SOLVED: '#10b981',
    L3: '#ef4444',
    L2: '#3b82f6',
    L1: '#f97316',
    PENDING: '#a855f7',
    'ON HOLD': '#6b7280',
    'ON REVIEW': '#eab308',
    TIM: '#06b6d4',
    PRODUCT: '#ec4899',
};

const StatusCaseChart = ({
    data, totalCases, avgResolutionTime,
}: {
    data: { name: string; value: number }[];
    totalCases: number;
    avgResolutionTime: number;
}) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const chartData = useMemo(() =>
        data.map(item => ({
            ...item,
            name: item.name.toUpperCase(),
            fill: COLORS[item.name.toUpperCase()] ?? '#6b7280',
            percentage: totalCases > 0 ? (item.value / totalCases) * 100 : 0,
        })).filter(d => d.value > 0)
        , [data, totalCases]);

    const resolvedPct = chartData.find(d => d.name === 'SOLVED')?.percentage ?? 0;
    const inProgressPct = 100 - resolvedPct;

    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload;
        return (
            <div className="bg-background/95 backdrop-blur border rounded-xl shadow-xl px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-sm mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                    {d.name}
                </div>
                <p className="text-muted-foreground">{d.value} cases · <span className="text-foreground font-semibold">{d.percentage.toFixed(1)}%</span></p>
            </div>
        );
    };

    return (
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
            {/* Header accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500" />
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-black tracking-tight flex items-center gap-2">
                    <Layers size={16} className="text-blue-500" /> Status Overview
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Donut */}
                    <div className="relative flex-shrink-0">
                        <ResponsiveContainer width={200} height={200}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    dataKey="value"
                                    innerRadius={62}
                                    outerRadius={88}
                                    paddingAngle={3}
                                    startAngle={90}
                                    endAngle={-270}
                                    onMouseEnter={(_, i) => setActiveIndex(i)}
                                    onMouseLeave={() => setActiveIndex(null)}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={entry.name}
                                            fill={entry.fill}
                                            opacity={activeIndex === null || activeIndex === index ? 1 : 0.35}
                                            stroke="transparent"
                                            style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                {/* Centre text */}
                                <text x="50%" y="44%" textAnchor="middle" dominantBaseline="central"
                                    className="fill-foreground" style={{ fontSize: 28, fontWeight: 900 }}>
                                    {totalCases}
                                </text>
                                <text x="50%" y="60%" textAnchor="middle" dominantBaseline="central"
                                    className="fill-muted-foreground" style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>
                                    TOTAL CASES
                                </text>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend pills */}
                    <div className="grid grid-cols-2 gap-2 flex-1">
                        {chartData.map(entry => (
                            <div key={entry.name}
                                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold bg-white/70 dark:bg-white/5 border shadow-sm hover:scale-105 transition-transform cursor-default">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.fill }} />
                                <span className="truncate text-muted-foreground">{entry.name}</span>
                                <span className="ml-auto font-black text-foreground">{entry.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom stats */}
                <div className="mt-5 pt-4 border-t grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-3">
                        <p className="text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-semibold mb-1">Resolved</p>
                        <p className="text-2xl font-black text-emerald-600">{resolvedPct.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 p-3">
                        <p className="text-[10px] uppercase tracking-widest text-blue-700 dark:text-blue-400 font-semibold mb-1">In Progress</p>
                        <p className="text-2xl font-black text-blue-600">{inProgressPct.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 dark:bg-white/5 p-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Avg. Resolution</p>
                        <p className="text-2xl font-black text-foreground">{Math.ceil(avgResolutionTime)}<span className="text-sm font-semibold ml-1">jam</span></p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// ─── Unsolved Cases Table ────────────────────────────────────────────────────
const statusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'l3') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (s === 'l2') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (s === 'l1') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    if (s === 'pending' || s === 'on hold') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
};

const UnsolvedTable = ({ cases }: { cases: any[] }) => (
    <Card className="flex flex-col overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
        <div className="h-1 w-full bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400" />
        <CardHeader className="pb-2">
            <CardTitle className="text-base font-black tracking-tight flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500" />
                Unsolved Cases
                <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    {cases.length} open
                </span>
            </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-grow">
            <ScrollArea className="h-64">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b-2">
                            <TableHead className="w-[40px] py-2.5 text-[11px] font-black uppercase tracking-wider">#</TableHead>
                            <TableHead className="py-2.5 text-[11px] font-black uppercase tracking-wider">Client</TableHead>
                            <TableHead className="py-2.5 text-[11px] font-black uppercase tracking-wider">Detail</TableHead>
                            <TableHead className="py-2.5 text-[11px] font-black uppercase tracking-wider text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {cases.map((c, i) => (
                            <TableRow key={i} className="text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                <TableCell className="py-2 font-bold text-muted-foreground">{i + 1}</TableCell>
                                <TableCell className="py-2 font-semibold">{c['Client Name']}</TableCell>
                                <TableCell className="py-2 text-muted-foreground max-w-[180px] truncate">{c['Title']}</TableCell>
                                <TableCell className="py-2 text-right">
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                                        statusColor(String(c.Status))
                                    )}>
                                        {c.Status}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </CardContent>
    </Card>
);

// ─── Trend Cards ─────────────────────────────────────────────────────────────
const TrendCard = ({
    label, value, chartData, type, color,
}: {
    label: string; value: string; chartData: any[]; type: 'area' | 'bar'; color: string;
}) => (
    <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 group">
        <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${color}, ${color}88)` }} />
        <CardContent className="pt-5 pb-3 px-5">
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color }}>
                {type === 'area' ? <><Users size={10} className="inline mr-1" /> {label}</> : <><TrendingUp size={10} className="inline mr-1" /> {label}</>}
            </p>
            <p className="font-black text-base leading-snug text-foreground mb-3 truncate" title={value}>{value}</p>
            <div className="rounded-xl overflow-hidden">
                <ResponsiveContainer width="100%" height={64}>
                    {type === 'area' ? (
                        <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                formatter={(v: any, _: any, p: any) => [v, p.payload.name]}
                                contentStyle={{ fontSize: 11, padding: '4px 10px', borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                cursor={false}
                            />
                            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5}
                                fill={`url(#grad-${label})`} dot={false} activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                    ) : (
                        <RechartsBarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`bar-${label}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0.3} />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                content={({ active, payload }) => active && payload?.length ? (
                                    <div className="bg-background/95 border rounded-xl shadow-lg px-3 py-1.5 text-xs font-semibold">
                                        {payload[0].payload.name}: <span style={{ color }}>{payload[0].value}</span>
                                    </div>
                                ) : null}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Bar dataKey="value" fill={`url(#bar-${label})`} radius={[6, 6, 0, 0]} barSize={20} />
                        </RechartsBarChart>
                    )}
                </ResponsiveContainer>
            </div>
        </CardContent>
    </Card>
);

// ─── Main Export ─────────────────────────────────────────────────────────────
export function DashboardChart() {
    const { tableData: contextData } = useContext(TableDataContext);
    const finalData = contextData?.rows;

    const stats = useMemo(() => {
        if (!finalData?.length) return null;

        const freq = (field: string, n = 5) => {
            const f: Record<string, number> = {};
            finalData.forEach(r => { if (r[field]) f[r[field]] = (f[r[field]] || 0) + 1; });
            return Object.entries(f).sort(([, a], [, b]) => b - a).slice(0, n).map(([name, value]) => ({ name, value }));
        };

        const topClients = freq('Client Name');
        const topModules = freq('Detail Module');

        const statusFreq: Record<string, number> = {};
        finalData.forEach(r => {
            const s = String(r.Status || 'N/A').toUpperCase();
            statusFreq[s] = (statusFreq[s] || 0) + 1;
        });
        const statusCounts = Object.entries(statusFreq).map(([name, value]) => ({ name, value }));

        const unsolvedCases = finalData.filter(r => String(r.Status).toLowerCase() !== 'solved');

        let totalRes = 0, resCount = 0;
        finalData.filter(r => String(r.Status).toLowerCase() === 'solved').forEach(r => {
            const c = new Date(r['Created At']), s = new Date(r['Resolved At']);
            if (!isNaN(c.getTime()) && !isNaN(s.getTime()) && s > c) {
                totalRes += s.getTime() - c.getTime(); resCount++;
            }
        });

        return {
            totalCases: finalData.length,
            solvedCount: statusFreq['SOLVED'] || 0,
            l3Count: statusFreq['L3'] || 0,
            pendingCount: (statusFreq['PENDING'] || 0) + (statusFreq['ON HOLD'] || 0),
            clientTrend: topClients[0]?.name ?? 'N/A',
            moduleTrend: topModules[0]?.name ?? 'N/A',
            statusCounts,
            topClients,
            topModules,
            unsolvedCases,
            avgResolution: resCount > 0 ? totalRes / resCount / 3_600_000 : 0,
        };
    }, [finalData]);

    if (!finalData?.length || !stats) return null;

    return (
        <div className="space-y-5">
            {/* Top stat pills row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatPill label="Total Cases" value={stats.totalCases} color="#6366f1" icon={Layers} />
                <StatPill label="Solved" value={stats.solvedCount} color="#10b981" icon={CheckCircle2} />
                <StatPill label="L3 Cases" value={stats.l3Count} color="#ef4444" icon={AlertCircle} />
                <StatPill label="Avg. Resolution" value={`${Math.ceil(stats.avgResolution)}h`} color="#f97316" icon={Clock} />
            </div>

            {/* Trend cards */}
            <div className="grid gap-4 sm:grid-cols-2">
                <TrendCard label="Client Trend" value={stats.clientTrend}
                    chartData={stats.topClients} type="area" color="#6366f1" />
                <TrendCard label="Module Trend" value={stats.moduleTrend}
                    chartData={stats.topModules} type="bar" color="#06b6d4" />
            </div>

            {/* Status + Unsolved */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <StatusCaseChart data={stats.statusCounts} totalCases={stats.totalCases}
                    avgResolutionTime={stats.avgResolution} />
                <UnsolvedTable cases={stats.unsolvedCases} />
            </div>
        </div>
    );
}