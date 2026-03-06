'use client';

import { useMemo, useContext, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ResponsiveContainer, Tooltip, PieChart, Pie, Cell,
    BarChart as RechartsBarChart, Bar,
} from 'recharts';
import { TableDataContext } from '@/store/table-data-context';
import { ScrollArea } from './ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Color System ─────────────────────────────────────────────────────────────
// Refined palette: slate neutrals + single blue accent
const STATUS_COLORS: Record<string, string> = {
    SOLVED:        '#2563eb', // blue-600  — primary
    L3:            '#dc2626', // red-600
    L2:            '#64748b', // slate-500
    L1:            '#94a3b8', // slate-400
    PENDING:       '#475569', // slate-600
    'ON HOLD':     '#cbd5e1', // slate-300
    'ON REVIEW':   '#94a3b8', // slate-400
    TIM:           '#94a3b8',
    PRODUCT:       '#cbd5e1',
};

const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'l3') return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800';
    if (s === 'l2') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700';
    if (s === 'l1') return 'bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700';
    if (s.includes('hold') || s.includes('pending')) return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700';
    return 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800';
};

// ─── Stat Row ─────────────────────────────────────────────────────────────────
const StatRow = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0 border-slate-100 dark:border-slate-800">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <div className="text-right">
            <span className="text-sm font-bold text-foreground tabular-nums">{value}</span>
            {sub && <span className="text-xs text-muted-foreground ml-1.5">{sub}</span>}
        </div>
    </div>
);

// ─── Status Donut ─────────────────────────────────────────────────────────────
const StatusDonut = ({
    data, totalCases, avgResolutionTime,
}: {
    data: { name: string; value: number }[];
    totalCases: number;
    avgResolutionTime: number;
}) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const chartData = useMemo(() =>
        data
            .map(item => ({
                ...item,
                name: item.name.toUpperCase(),
                fill: STATUS_COLORS[item.name.toUpperCase()] ?? '#94a3b8',
                pct: totalCases > 0 ? (item.value / totalCases) * 100 : 0,
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value)
    , [data, totalCases]);

    const resolvedPct = chartData.find(d => d.name === 'SOLVED')?.pct ?? 0;

    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload;
        return (
            <div className="bg-background border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-3 py-2 text-xs">
                <p className="font-semibold text-foreground mb-0.5">{d.name}</p>
                <p className="text-muted-foreground">{d.value} cases · <span className="text-foreground font-bold">{d.pct.toFixed(1)}%</span></p>
            </div>
        );
    };

    return (
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Status Overview</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
                {/* Top section: donut + legend side by side */}
                <div className="flex items-center gap-4">
                    {/* Donut — larger to fill card height */}
                    <div className="flex-shrink-0">
                        <ResponsiveContainer width={202} height={202}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    dataKey="value"
                                    innerRadius={63}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    startAngle={90}
                                    endAngle={-270}
                                    onMouseEnter={(_, i) => setActiveIndex(i)}
                                    onMouseLeave={() => setActiveIndex(null)}
                                    strokeWidth={0}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={entry.name}
                                            fill={entry.fill}
                                            opacity={activeIndex === null || activeIndex === index ? 1 : 0.25}
                                            style={{ transition: 'opacity 0.15s', outline: 'none' }}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <text x="50%" y="44%" textAnchor="middle" dominantBaseline="central"
                                    className="fill-foreground" style={{ fontSize: 28, fontWeight: 800 }}>
                                    {totalCases}
                                </text>
                                <text x="50%" y="60%" textAnchor="middle" dominantBaseline="central"
                                    className="fill-muted-foreground" style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.8 }}>
                                    TOTAL
                                </text>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend — compact rows */}
                    <div className="flex-1 min-w-0 space-y-1">
                        {chartData.map((entry, i) => (
                            <div key={entry.name}
                                onMouseEnter={() => setActiveIndex(i)}
                                onMouseLeave={() => setActiveIndex(null)}
                                className="flex items-center gap-2 cursor-default py-0.5"
                            >
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.fill }} />
                                <span className="text-xs font-bold text-foreground truncate flex-1 leading-none">{entry.name}</span>
                                <span className="text-xs font-bold text-foreground tabular-nums">{entry.value}</span>
                                <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{entry.pct.toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Divider + 3 stats in a row */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                        <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Resolved</p>
                        <p className="text-base font-black text-foreground tabular-nums">{resolvedPct.toFixed(1)}<span className="text-xs font-semibold">%</span></p>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                        <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">In Progress</p>
                        <p className="text-base font-black text-foreground tabular-nums">{(100 - resolvedPct).toFixed(1)}<span className="text-xs font-semibold">%</span></p>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                        <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Avg. Resolv.</p>
                        <p className="text-base font-black text-foreground tabular-nums">{Math.ceil(avgResolutionTime)}<span className="text-xs font-semibold ml-0.5">jam</span></p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// ─── Top Modules Bar ──────────────────────────────────────────────────────────
const TopModulesCard = ({ data }: { data: { name: string; value: number }[] }) => {
    const max = data[0]?.value ?? 1;

    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-background border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-3 py-2 text-xs">
                <p className="font-semibold text-foreground mb-0.5 max-w-[160px] truncate">{payload[0].payload.name}</p>
                <p className="text-muted-foreground"><span className="text-foreground font-bold">{payload[0].value}</span> cases</p>
            </div>
        );
    };

    return (
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Top Modules</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
                {/* Mini bar chart */}
                <ResponsiveContainer width="100%" height={80}>
                    <RechartsBarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="30%">
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
                        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                            {data.map((_, i) => (
                                <Cell key={i} fill={i === 0 ? '#2563eb' : '#cbd5e1'} />
                            ))}
                        </Bar>
                    </RechartsBarChart>
                </ResponsiveContainer>

                {/* List */}
                <div className="mt-3 space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
                    {data.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-3 py-2">
                            <span className="text-[10px] font-bold text-muted-foreground w-4 text-center">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-xs text-foreground font-medium truncate">{item.name}</span>
                                    <span className="text-xs font-bold tabular-nums text-foreground flex-shrink-0">{item.value}</span>
                                </div>
                                <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${(item.value / max) * 100}%`,
                                            background: i === 0 ? '#2563eb' : '#94a3b8',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

// ─── Unsolved Table ───────────────────────────────────────────────────────────
const UnsolvedTable = ({ cases }: { cases: any[] }) => (
    <Card className="flex flex-col border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500" />
                Unsolved Cases
                <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground">
                    {cases.length}
                </span>
            </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1">
            <ScrollArea className="h-[240px]">
                <Table>
                    <TableHeader>
                        <TableRow className="border-slate-100 dark:border-slate-800 hover:bg-transparent">
                            <TableHead className="py-2 pl-5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-8">#</TableHead>
                            <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Client</TableHead>
                            <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detail</TableHead>
                            <TableHead className="py-2 pr-5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {cases.map((c, i) => (
                            <TableRow key={i} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <TableCell className="py-2 pl-5 text-[11px] font-semibold text-muted-foreground">{i + 1}</TableCell>
                                <TableCell className="py-2 text-xs font-semibold text-foreground">{c['Client Name']}</TableCell>
                                <TableCell className="py-2 text-xs text-muted-foreground max-w-[180px] truncate">{c['Title']}</TableCell>
                                <TableCell className="py-2 pr-5 text-right">
                                    <span className={cn(
                                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-md",
                                        statusBadge(String(c.Status))
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

// ─── Main Export ──────────────────────────────────────────────────────────────
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
            statusCounts,
            topModules,
            unsolvedCases,
            avgResolution: resCount > 0 ? totalRes / resCount / 3_600_000 : 0,
        };
    }, [finalData]);

    if (!finalData?.length || !stats) return null;

    return (
        <div className="space-y-4">
            {/* Status + Modules row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <StatusDonut
                    data={stats.statusCounts}
                    totalCases={stats.totalCases}
                    avgResolutionTime={stats.avgResolution}
                />
                <TopModulesCard data={stats.topModules} />
            </div>

            {/* Unsolved table full width */}
            <UnsolvedTable cases={stats.unsolvedCases} />
        </div>
    );
}