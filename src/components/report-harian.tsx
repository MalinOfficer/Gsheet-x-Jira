"use client";

import { useState, useMemo, useEffect, useContext, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, BarChart as BarChartIcon, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { formatDateTime } from '@/lib/date-utils';
import { TableDataContext } from '@/store/table-data-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getL3ReportFromDB } from '@/app/actions';
import Link from 'next/link';
import { Skeleton } from './ui/skeleton';

// Dynamically import the heavy chart components
const DashboardChart = dynamic(
    () => import('./report-harian-charts').then(mod => mod.DashboardChart),
    {
        ssr: false,
        loading: () => <Skeleton className="w-full h-[650px]" />,
    }
);


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
            {error ? error : "To view reports, please go to the Import Data page and convert your data."}
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

function DailyReportCard() {
    const { tableData } = useContext(TableDataContext);
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);
    const [todayDate, setTodayDate] = useState('');

    const finalData = tableData?.rows;

    useEffect(() => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        setTodayDate(`${day}/${month}/${year}`);
    }, []);

    const reportTextForCopy = useMemo(() => {
        if (!finalData || finalData.length === 0) return null;

        const rows = finalData;
        const totalCases = rows.length;
        const escalatedL1 = rows.filter(r => String(r.Status).toLowerCase() === 'l1').length;
        const escalatedL2 = rows.filter(r => String(r.Status).toLowerCase() === 'l2').length;
        const escalatedL3 = rows.filter(r => String(r.Status).toLowerCase() === 'l3').length;
        const pending = rows.filter(r => ['pending', 'on hold'].includes(String(r.Status).toLowerCase())).length;
        const solved = rows.filter(r => String(r.Status).toLowerCase() === 'solved').length;
        
        const notResolvedCases = rows
          .filter(r => ['l1', 'l2', 'l3', 'pending', 'on hold'].includes(String(r.Status).toLowerCase()) && r['Client Name'] && r.Title)
          .map(r => ({ clientName: r['Client Name'], title: r.Title as string, status: r.Status as string }));

        const solvedCases = rows
          .filter(r => String(r.Status).toLowerCase() === 'solved' && r['Client Name'] && r.Title)
          .map(r => ({ clientName: r['Client Name'], title: r.Title as string }));
        
        const getMostFrequent = (data: typeof rows, field: string) => {
          const frequency: Record<string, number> = {};
          let maxCount = 0;
          let mostFrequent = 'N/A';
          const filteredData = data.filter(row => row[field]);
          if (filteredData.length === 0) return 'N/A';
          filteredData.forEach(row => {
            const value = row[field];
            frequency[value] = (frequency[value] || 0) + 1;
          });
          Object.entries(frequency).forEach(([value, count]) => {
              if (count > maxCount) {
                  maxCount = count;
                  mostFrequent = value;
              }
          });
          return mostFrequent;
        };
        
        const trendingClient = getMostFrequent(rows, 'Client Name');
        const clientSpecificRows = rows.filter(row => row['Client Name'] === trendingClient);
        const trendingCase = getMostFrequent(clientSpecificRows, 'Detail Module');

        const latestEntryTime = rows.reduce((latest, row) => {
            const createdAt = row['Created At'];
            if (createdAt && typeof createdAt === 'string') {
                try {
                    const currentDate = new Date(createdAt);
                    if (!isNaN(currentDate.getTime())) {
                        if (!latest || currentDate > latest) return currentDate;
                    }
                } catch (e) { }
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
          let caseDetail = '';
          if (clientName) caseDetail += clientName;
          if (title) caseDetail += ` ${title}`;
          if (status) caseDetail += ` ${status}`;
          return caseDetail.trim();
        }
        
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

    if (!finalData || finalData.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-bold">Daily Report</CardTitle>
                    <CardDescription>This report is generated from the data you converted on the Import Data page.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex items-center justify-center">
                   <div className="text-center text-muted-foreground">
                        <BarChartIcon className="mx-auto h-12 w-12 mb-2" />
                        <p>No data from Import Data found.</p>
                   </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle className="text-xl font-bold">Daily Report</CardTitle>
                  <Button onClick={handleCopy} size="sm" variant="outline" className="w-full sm:w-auto">
                      {isCopied ? <Check className="text-green-500 mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {isCopied ? 'Copied!' : 'Copy Report'}
                  </Button>
                </div>
                <CardDescription>
                    This report is generated from the data you converted on the Import Data page.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                 <div
                    className="h-96 text-xs font-mono bg-muted/20 rounded-md border p-3 overflow-auto whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: reportTextForDisplay.replace(/\n/g, '<br />') }}
                />
            </CardContent>
        </Card>
    );
}

type ReportData = {
    report?: string;
    error?: string;
} | null;

function L3CaseReportCard() {
    const [l3ReportData, setL3ReportData] = useState<ReportData>(null);
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);
    const [isGenerating, startGenerating] = useTransition();

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
         <Card>
            <CardHeader>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle className="text-xl font-bold">L3 Case Report</CardTitle>
                   <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={handleGenerate} size="sm" className="w-full sm:w-auto" disabled={isGenerating}>
                            {isGenerating ? <RefreshCw className="text-muted-foreground animate-spin mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {isGenerating ? 'Membuat...' : 'Generate Report'}
                        </Button>
                        <Button onClick={handleCopy} size="sm" variant="outline" className="w-full sm:w-auto" disabled={!l3ReportData?.report || isGenerating}>
                            {isCopied ? <Check className="text-green-500 mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                            {isCopied ? 'Copied!' : 'Copy'}
                        </Button>
                  </div>
                </div>
                <CardDescription>
                    This report is generated from the 'report_l3' database view.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
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

interface ReportHarianProps {
  initialDashboardData: any[] | null; // This prop is no longer used but kept for page compatibility
  error?: string;
}

export function ReportHarian({ error }: ReportHarianProps) {
  const { tableData } = useContext(TableDataContext);

  // Check if data exists in the context from the import flow
  const hasData = tableData && tableData.rows.length > 0;

  if (error) {
      return (
          <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
              <div className="max-w-7xl mx-auto space-y-6">
                <InitialState error={error} />
              </div>
          </div>
      )
  }

  return (
    <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        

        {hasData ? <DashboardChart /> : <InitialState />}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <DailyReportCard />
          <L3CaseReportCard />
        </div>
      </div>
    </div>
  );
}
