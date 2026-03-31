"use client";

import { useState, useMemo, useEffect, useContext, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, BarChart as BarChartIcon, AlertTriangle, RefreshCw, ArrowLeft, Download } from 'lucide-react';
import { formatDateTime } from '@/lib/date-utils';
import { TableDataContext } from '@/store/table-data-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getL3ReportFromDB, getL3CasesForReport } from '@/app/actions';
import Link from 'next/link';
import { Skeleton } from './ui/skeleton';

const DashboardChart = dynamic(
    () => import('./report-harian-charts').then(mod => mod.DashboardChart),
    {
        ssr: false,
        loading: () => <Skeleton className="w-full h-[650px]" />,
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type UnresolvedCase = {
    client_name: string;
    title: string;
    status: string;
    module?: string;
    detail_module?: string;
    created_at?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// buildDashboardStats
// ─────────────────────────────────────────────────────────────────────────────
function buildDashboardStats(rows: any[], unresolvedCases: UnresolvedCase[]) {
    const total_cases  = rows.length;
    const total_solved = rows.filter(r => String(r.Status ?? '').toLowerCase() === 'solved').length;
    const solved_pct   = total_cases > 0 ? (total_solved / total_cases) * 100 : 0;

    const uniqueClients = new Set(rows.map(r => r['Client Name']).filter(Boolean));

    const freq = (field: string): Record<string, number> => {
        const map: Record<string, number> = {};
        rows.forEach(r => {
            const v = String(r[field] ?? '').trim();
            if (v) map[v] = (map[v] || 0) + 1;
        });
        return map;
    };

    const clientFreq    = freq('Client Name');
    const moduleFreq    = freq('Module');
    const detailModFreq = freq('Detail Module');
    const categoryFreq  = freq('Category');

    const topOf = (f: Record<string, number>): string =>
        Object.entries(f).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    const toRanking = (f: Record<string, number>): { name: string; value: number }[] =>
        Object.entries(f)
            .sort((a, b) => b[1] - a[1])
            .map(([name, value]) => ({ name, value }));

    const MONTHS = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December',
    ];
    const monthlyMap: Record<string, Record<string, any>> = {};

    rows.forEach(r => {
        const raw = r['Created At'];
        if (!raw) return;
        try {
            const d = new Date(raw);
            if (isNaN(d.getTime())) return;
            const month = MONTHS[d.getMonth()];
            const year  = String(d.getFullYear());
            if (!monthlyMap[month]) monthlyMap[month] = { month };
            monthlyMap[month][year] = (monthlyMap[month][year] ?? 0) + 1;
        } catch { /* skip bad date */ }
    });

    const monthly_stats = MONTHS.filter(m => monthlyMap[m]).map(m => monthlyMap[m]);

    // ── Validate & sanitize unresolved cases ─────────────────────────────────
    const safeUnresolved: UnresolvedCase[] = Array.isArray(unresolvedCases)
        ? unresolvedCases.filter(c =>
            c != null &&
            typeof c.client_name === 'string' && c.client_name.trim() !== '' &&
            typeof c.title       === 'string' && c.title.trim()       !== '' &&
            typeof c.status      === 'string' && c.status.trim()      !== ''
          )
        : [];

    console.log('[buildDashboardStats] unresolved_cases injected:', safeUnresolved.length);
    if (safeUnresolved.length > 0) {
        console.log('[buildDashboardStats] sample:', JSON.stringify(safeUnresolved[0]));
    }

    return {
        summary: {
            total_cases,
            total_solved,
            total_clients:      uniqueClients.size,
            solved_percentage:  solved_pct,
            trending_category:  topOf(categoryFreq),
            trending_module:    topOf(moduleFreq),
            top_client:         topOf(clientFreq),
            top_module:         topOf(moduleFreq),
        },
        monthly_stats,
        client_rankings:        toRanking(clientFreq),
        module_rankings:        toRanking(moduleFreq),
        detail_module_rankings: toRanking(detailModFreq),
        category_rankings:      toRanking(categoryFreq),
        module_trends:          [] as any[],
        unresolved_cases:       safeUnresolved,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// InitialState
// ─────────────────────────────────────────────────────────────────────────────
const InitialState = ({ error }: { error?: string }) => {
    return (
        <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px]">
            {error ? (
                <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            ) : (
                <BarChartIcon className="w-16 h-16 text-muted-foreground mb-4" />
            )}
            <CardTitle>{error ? "Failed to Load Data" : "No Report Data Found"}</CardTitle>
            <CardDescription className="mt-2 mb-4 max-w-sm">
                {error
                    ? error
                    : "To view reports, please go to the Import Data page and convert your data."}
            </CardDescription>
            {!error && (
                <Button asChild variant="outline">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Import Data
                    </Link>
                </Button>
            )}
        </Card>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// DailyReportCard
// ─────────────────────────────────────────────────────────────────────────────
function DailyReportCard() {
    const { tableData } = useContext(TableDataContext);
    const { toast }     = useToast();
    const [isCopied, setIsCopied] = useState(false);
    const [todayDate, setTodayDate] = useState('');

    const finalData = tableData?.rows;

    useEffect(() => {
        const today = new Date();
        const day   = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year  = today.getFullYear();
        setTodayDate(`${day}/${month}/${year}`);
    }, []);

    const reportTextForCopy = useMemo(() => {
        if (!finalData || finalData.length === 0) return null;

        const rows         = finalData;
        const totalCases   = rows.length;
        const escalatedL1  = rows.filter(r => String(r.Status).toLowerCase() === 'l1').length;
        const escalatedL2  = rows.filter(r => String(r.Status).toLowerCase() === 'l2').length;
        const escalatedL3  = rows.filter(r => String(r.Status).toLowerCase() === 'l3').length;
        const pending      = rows.filter(r => ['pending', 'on hold'].includes(String(r.Status).toLowerCase())).length;
        const solved       = rows.filter(r => String(r.Status).toLowerCase() === 'solved').length;

        const notResolvedCases = rows
            .filter(r => ['l1','l2','l3','pending','on hold'].includes(String(r.Status).toLowerCase()) && r['Client Name'] && r.Title)
            .map(r => ({ clientName: r['Client Name'], title: r.Title as string, status: r.Status as string }));

        const solvedCases = rows
            .filter(r => String(r.Status).toLowerCase() === 'solved' && r['Client Name'] && r.Title)
            .map(r => ({ clientName: r['Client Name'], title: r.Title as string }));

        const getMostFrequent = (data: typeof rows, field: string) => {
            const frequency: Record<string, number> = {};
            let maxCount     = 0;
            let mostFrequent = 'N/A';
            const filtered   = data.filter(row => row[field]);
            if (filtered.length === 0) return 'N/A';
            filtered.forEach(row => {
                const value = row[field];
                frequency[value] = (frequency[value] || 0) + 1;
            });
            Object.entries(frequency).forEach(([value, count]) => {
                if (count > maxCount) { maxCount = count; mostFrequent = value; }
            });
            return mostFrequent;
        };

        const trendingClient     = getMostFrequent(rows, 'Client Name');
        const clientSpecificRows = rows.filter(row => row['Client Name'] === trendingClient);
        const trendingCase       = getMostFrequent(clientSpecificRows, 'Detail Module');

        const latestEntryTime = rows.reduce((latest, row) => {
            const createdAt = row['Created At'];
            if (createdAt && typeof createdAt === 'string') {
                try {
                    const d = new Date(createdAt);
                    if (!isNaN(d.getTime())) {
                        if (!latest || d > latest) return d;
                    }
                } catch {}
            }
            return latest;
        }, null as Date | null);

        const formattedLatestTime = latestEntryTime
            ? formatDateTime(latestEntryTime.toISOString(), 'jam')
            : 'N/A';

        const formatSolvedCase = (clientName: string, title: string) => {
            if (!clientName || !title) return title || clientName || '';
            return `${clientName} ${title}`.trim();
        };

        const formatUnresolvedCase = (clientName: string, title: string, status: string) => {
            let detail = '';
            if (clientName) detail += clientName;
            if (title)      detail += ` ${title}`;
            if (status)     detail += ` ${status}`;
            return detail.trim();
        };

        const reportText = `*Case report ${todayDate} (update last entry time ${formattedLatestTime})*

Total cases: ${totalCases}
Escalated L1: ${escalatedL1}
Escalated L2: ${escalatedL2}
Escalated L3: ${escalatedL3}
Pending: ${pending}
Solved: ${solved}
Client Trend: ${trendingClient}
Case Trend: ${trendingCase}

*Summary of unresolved case details:*
${notResolvedCases.map((item, i) => `${i + 1}. ${formatUnresolvedCase(item.clientName, item.title, item.status)}`).join('\n') || 'No unresolved cases.'}

*Solved cases:*
${solvedCases.map((item, i) => `${i + 1}. ${formatSolvedCase(item.clientName, item.title)}`).join('\n') || 'No solved cases yet.'}
`;
        return reportText.trim();
    }, [finalData, todayDate]);

    const reportTextForDisplay = useMemo(() => {
        if (!reportTextForCopy) return '';
        return reportTextForCopy.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    }, [reportTextForCopy]);

    const handleCopy = () => {
        if (!reportTextForCopy) return;
        navigator.clipboard.writeText(reportTextForCopy).then(() => {
            toast({ title: "Copied to clipboard!" });
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }, () => {
            toast({ variant: "destructive", title: "Copy Failed" });
        });
    };

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <CardTitle className="text-xl font-bold">Daily Report</CardTitle>
                    <Button
                        onClick={handleCopy}
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={!reportTextForCopy}
                    >
                        {isCopied ? <Check className="text-green-500 mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                        {isCopied ? 'Copied!' : 'Copy Report'}
                    </Button>
                </div>
                <CardDescription>
                    This report is generated from the data you converted on the Import Data page.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                {finalData && finalData.length > 0 ? (
                    <div
                        className="h-96 text-xs bg-muted/20 rounded-md border p-3 overflow-auto font-mono whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: reportTextForDisplay.replace(/\n/g, '<br />') }}
                    />
                ) : (
                    <div className="h-96 text-xs bg-muted/20 rounded-md border p-3 overflow-auto flex flex-col items-center justify-center text-center text-muted-foreground">
                        <BarChartIcon className="h-10 w-10 mb-3 opacity-40" />
                        <p className="text-sm font-medium">No data from Import Data found.</p>
                        <p className="text-xs mt-1 opacity-70">Import data first to generate a report.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// L3CaseReportCard
// ─────────────────────────────────────────────────────────────────────────────
type ReportData = {
    report?: string;
    error?: string;
} | null;

function L3CaseReportCard() {
    const [l3ReportData, setL3ReportData] = useState<ReportData>(null);
    const { toast }                        = useToast();
    const [isCopied, setIsCopied]          = useState(false);
    const [isGenerating, startGenerating]  = useTransition();

    const handleGenerate = () => {
        startGenerating(async () => {
            const result = await getL3ReportFromDB();
            setL3ReportData(result);
            if (result.error) {
                toast({ variant: "destructive", title: "Pembuatan Laporan Gagal", description: result.error });
            } else {
                toast({ title: "Laporan L3 Dibuat", description: "Laporan telah diperbarui dengan data terbaru." });
            }
        });
    };

    const reportTextForDisplay = useMemo(() => {
        if (isGenerating) {
            return '<div class="flex items-center justify-center h-full text-muted-foreground"><svg class="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Generating...</span></div>';
        }
        if (!l3ReportData) return "Click 'Generate Report' to create the report.";
        if (l3ReportData.error) return `Error: ${l3ReportData.error}`;
        if (!l3ReportData.report) return "No L3 cases found.";
        return l3ReportData.report.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    }, [l3ReportData, isGenerating]);

    const reportTextForCopy = useMemo(() => {
        if (!l3ReportData?.report) return '';
        return l3ReportData.report;
    }, [l3ReportData]);

    const handleCopy = () => {
        if (!reportTextForCopy) return;
        navigator.clipboard.writeText(reportTextForCopy).then(() => {
            toast({ title: "Copied to clipboard!" });
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }, () => {
            toast({ variant: "destructive", title: "Copy Failed" });
        });
    };

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <CardTitle className="text-xl font-bold">L3 Case Report</CardTitle>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={handleGenerate} size="sm" className="w-full sm:w-auto" disabled={isGenerating}>
                            {isGenerating
                                ? <RefreshCw className="text-muted-foreground animate-spin mr-2 h-4 w-4" />
                                : <RefreshCw className="mr-2 h-4 w-4" />}
                            {isGenerating ? 'Membuat...' : 'Generate Report'}
                        </Button>
                        <Button
                            onClick={handleCopy}
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            disabled={!l3ReportData?.report || isGenerating}
                        >
                            {isCopied ? <Check className="text-green-500 mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                            {isCopied ? 'Copied!' : 'Copy'}
                        </Button>
                    </div>
                </div>
                <CardDescription>
                    This report is generated from the 'Report L3' database view.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <div
                    className={cn(
                        "h-96 text-xs font-mono bg-muted/20 rounded-md border p-3 overflow-auto whitespace-pre-wrap",
                        l3ReportData?.error && "text-destructive",
                        !l3ReportData && !isGenerating && "text-muted-foreground flex items-center justify-center"
                    )}
                    dangerouslySetInnerHTML={{ __html: reportTextForDisplay.replace(/\n/g, '<br />') }}
                />
            </CardContent>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DownloadReportButton
//
// FIX 1: getL3CasesForReport() dipanggil di luar startTransition agar hasil
//         async-nya tidak discarded oleh React transition scheduler.
//
// FIX 2: Validasi eksplisit bahwa hasil getL3CasesForReport adalah array,
//         bukan object error shape.
//
// FIX 3: Log payload lengkap sebelum fetch untuk memudahkan debug.
// ─────────────────────────────────────────────────────────────────────────────
function DownloadReportButton() {
    const { tableData }                  = useContext(TableDataContext);
    const { toast }                      = useToast();
    const [isDownloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        if (isDownloading) return;
        setDownloading(true);

        try {
            const rows = tableData?.rows ?? [];

            // ── STEP 1: Fetch unresolved cases dari DB ──────────────────────────
            // FIX: Dipanggil langsung (bukan di dalam useTransition/startTransition)
            // agar hasil Promise-nya benar-benar ditunggu sebelum lanjut.
            let safeL3Cases: UnresolvedCase[] = [];

            try {
                console.log('[DownloadReport] Fetching L3 cases from DB...');
                const result = await getL3CasesForReport();

                console.log('[DownloadReport] Raw result type:', typeof result);
                console.log('[DownloadReport] Is array:', Array.isArray(result));
                console.log('[DownloadReport] Raw result:', JSON.stringify(result)?.slice(0, 300));

                // FIX: Pastikan result benar-benar array (bukan {success, error} shape)
                if (!Array.isArray(result)) {
                    console.warn('[DownloadReport] getL3CasesForReport did not return an array:', result);
                    throw new Error('getL3CasesForReport mengembalikan bukan array');
                }

                safeL3Cases = result.filter(c =>
                    c != null &&
                    typeof c.client_name === 'string' && c.client_name.trim() !== '' &&
                    typeof c.title       === 'string' && c.title.trim()       !== '' &&
                    typeof c.status      === 'string' && c.status.trim()      !== ''
                );

                console.log('[DownloadReport] safeL3Cases after filter:', safeL3Cases.length);

            } catch (fetchErr: any) {
                console.error('[DownloadReport] getL3CasesForReport failed:', fetchErr);
                toast({
                    variant:     'destructive',
                    title:       'Warning: Gagal fetch unresolved cases',
                    description: `${fetchErr?.message ?? 'Unknown error'} — report tetap dibuat tanpa data unresolved cases.`,
                });
            }

            // ── STEP 2: Build stats dengan unresolved cases dari DB ─────────────
            const stats = buildDashboardStats(rows, safeL3Cases);

            console.log('[DownloadReport] stats.unresolved_cases count:', stats.unresolved_cases?.length);
            console.log('[DownloadReport] stats.unresolved_cases sample:', JSON.stringify(stats.unresolved_cases?.[0]));

            // ── STEP 3: Validasi payload sebelum stringify ──────────────────────
            const payload = {
                stats,
                filterSummary: {
                    years:         [] as string[],
                    categories:    [] as string[],
                    clients:       [] as string[],
                    modules:       [] as string[],
                    detailModules: [] as string[],
                    trendPeriod:   'monthly',
                },
            };

            // FIX: Pastikan unresolved_cases tidak hilang saat JSON.stringify
            // (field dengan nilai undefined akan di-drop oleh JSON.stringify)
            const payloadJson = JSON.stringify(payload);
            const payloadParsed = JSON.parse(payloadJson);
            console.log('[DownloadReport] payload after JSON round-trip, unresolved_cases count:',
                payloadParsed?.stats?.unresolved_cases?.length ?? 'MISSING');

            // ── STEP 4: Kirim ke /api/report ────────────────────────────────────
            const res = await fetch('/api/dashboard/report', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    payloadJson,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(err.error ?? `Server error (HTTP ${res.status})`);
            }

            // ── STEP 5: Trigger file download di browser ─────────────────────────
            const blob     = await res.blob();
            const url      = URL.createObjectURL(blob);
            const anchor   = document.createElement('a');
            const dateSlug = new Date().toISOString().slice(0, 10);
            anchor.href     = url;
            anchor.download = `dashboard-report-${dateSlug}.docx`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);

            toast({
                title:       'Report berhasil didownload!',
                description: `${safeL3Cases.length} unresolved case(s) disertakan.`,
            });

        } catch (e: any) {
            console.error('[DownloadReport] Error:', e);
            toast({
                variant:     'destructive',
                title:       'Download Gagal',
                description: e?.message ?? 'Terjadi kesalahan saat membuat report.',
            });
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Button
            onClick={handleDownload}
            disabled={isDownloading || !tableData?.rows?.length}
            variant="default"
            size="sm"
        >
            {isDownloading
                ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                : <Download className="mr-2 h-4 w-4" />}
            {isDownloading ? 'Membuat Report...' : 'Download Report (.docx)'}
        </Button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReportHarian (main export)
// ─────────────────────────────────────────────────────────────────────────────
interface ReportHarianProps {
    initialDashboardData: any[] | null;
    error?: string;
}

export function ReportHarian({ error }: ReportHarianProps) {
    const { tableData } = useContext(TableDataContext);
    const hasData       = tableData && tableData.rows.length > 0;

    if (error) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    <InitialState error={error} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {hasData ? <DashboardChart /> : <InitialState />}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                    <DailyReportCard />
                    <L3CaseReportCard />
                </div>

            </div>
        </div>
    );
}