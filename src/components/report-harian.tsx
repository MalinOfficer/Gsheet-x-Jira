
"use client";

import { useState, useMemo, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Copy, Check, BarChart } from 'lucide-react';
import { formatDateTime } from '@/lib/date-utils';
import { TableDataContext, L3ReportData } from '@/store/table-data-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function InitialState() {
  const router = useRouter();
  return (
    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
        <BarChart className="w-16 h-16 text-muted-foreground mb-4" />
        <CardTitle>No Report Data Found</CardTitle>
        <CardDescription className="mt-2 mb-4 max-w-sm">
            To view reports, please go to the Import Flow page, convert your JSON data, and verify your Google Sheet URL.
        </CardDescription>
        <Button onClick={() => router.push('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Import Flow
        </Button>
    </Card>
  );
};

function DailyReportCard() {
    const { tableData } = useContext(TableDataContext);
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);
    const [todayDate, setTodayDate] = useState('');

    useEffect(() => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        setTodayDate(`${day}/${month}/${year}`);
    }, []);

    const reportTextForCopy = useMemo(() => {
        if (!tableData?.rows) return null;

        const rows = tableData.rows;
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
    }, [tableData, todayDate]);

    const reportTextForDisplay = useMemo(() => {
        if (!reportTextForCopy) return '';
        // Convert markdown-style bold to HTML strong tags for display
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

    if (!reportTextForCopy) return null;

    return (
        <Card className="shadow-lg flex flex-col">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle>Daily Report</CardTitle>
                  <Button onClick={handleCopy} size="sm" variant="outline" className="w-full sm:w-auto">
                      {isCopied ? <Check className="text-green-500 mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {isCopied ? 'Copied!' : 'Copy Report'}
                  </Button>
                </div>
                <CardDescription>
                    This report is generated from the data you converted on the Import Flow page.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                 <div
                    className="h-96 text-xs font-mono bg-muted/20 rounded-md border p-3 overflow-auto whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: reportTextForDisplay.replace(/\n/g, '<br />') }}
                />
            </CardContent>
            <CardFooter />
        </Card>
    );
}

function L3CaseReportCard() {
    const { l3ReportData } = useContext(TableDataContext);
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);

    const reportTextForDisplay = useMemo(() => {
        if (!l3ReportData) return "Go to the Import Flow page and click 'Verify' to generate this report.";
        if (l3ReportData.error) return `Error: ${l3ReportData.error}`;
        if (!l3ReportData.report) return "No L3 cases found.";

        // Replace markdown-style bold with HTML bold for display
        return l3ReportData.report.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    }, [l3ReportData]);

    const reportTextForCopy = useMemo(() => {
        if (!l3ReportData?.report) return '';
        // The report is already formatted for WhatsApp, so just use it as is.
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
         <Card className="shadow-lg flex flex-col">
            <CardHeader>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle>L3 Case Report</CardTitle>
                  <Button onClick={handleCopy} size="sm" variant="outline" className="w-full sm:w-auto" disabled={!l3ReportData?.report}>
                      {isCopied ? <Check className="text-green-500 mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {isCopied ? 'Copied!' : 'Copy Report'}
                  </Button>
                </div>
                <CardDescription>
                    This report is generated from the verified Google Sheet and shows 'L3' status
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <div
                    className={cn(
                        "h-96 text-xs font-mono bg-muted/20 rounded-md border p-3 overflow-auto whitespace-pre-wrap",
                        l3ReportData?.error && "text-destructive",
                        !l3ReportData && "text-muted-foreground"
                    )}
                    dangerouslySetInnerHTML={{ __html: reportTextForDisplay.replace(/\n/g, '<br />') }}
                />
            </CardContent>
        </Card>
    );
}

export function ReportHarian() {
  const { tableData, l3ReportData } = useContext(TableDataContext);
  const router = useRouter();

  const hasAnyData = tableData || l3ReportData;

  return (
    <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="relative flex justify-center items-center h-10">
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              size="sm"
              className="absolute left-0 top-1/2 -translate-y-1/2"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Import Flow
            </Button>
          <div className="text-center">
             <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Report Center</h1>
              <p className="text-sm text-muted-foreground mt-1">
                View the daily case summary and the L3 case report from your Google Sheet.
              </p>
          </div>
        </header>

        {!hasAnyData ? (
          <InitialState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <DailyReportCard />
            <L3CaseReportCard />
          </div>
        )}
      </div>
    </div>
  );
}
