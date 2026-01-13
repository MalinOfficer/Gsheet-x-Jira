
"use client";

import { useState, useMemo, useEffect, useContext, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Copy, Check, BarChart as BarChartIcon, AlertTriangle, User, AppWindow, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { formatDateTime } from '@/lib/date-utils';
import { SettingsContext, TableData } from '@/contexts/settings-provider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, XAxis, YAxis, CartesianGrid, BarChart as RechartsBarChart } from 'recharts';
import type { ChartConfig } from "@/components/ui/chart"
import { fetchL3ReportData } from '@/app/actions';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const chartConfig = {
  solved: { label: "Solved", color: "hsl(var(--chart-2))" },
  unsolved: { label: "Unsolved", color: "hsl(var(--chart-5))" },
  L1: { label: "L1", color: "hsl(var(--chart-1))" },
  L2: { label: "L2", color: "hsl(var(--chart-3))" },
  L3: { label: "L3", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig

// State for this page is now managed locally
type ReportData = {
    report?: string;
    error?: string;
} | null;

function DashboardChart() {
    const { tableData: contextData } = useContext(SettingsContext);
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

        const statusCounts = Object.entries(statusFrequency).map(([name, value]) => ({ name, value, fill: `var(--color-${name})`}));

        const solvedCount = statusFrequency['SOLVED'] || 0;
        const unsolvedCount = finalData.length - solvedCount;

        const solvedVsUnsolved = [
            { name: 'Solved', value: solvedCount },
            { name: 'Unsolved', value: unsolvedCount }
        ];

        return {
            totalCases: finalData.length,
            clientTrend: topClientsData.length > 0 ? topClientsData[0].name : 'N/A',
            moduleTrend: topModulesData.length > 0 ? topModulesData[0].name : 'N/A',
            statusCounts,
            solvedVsUnsolved,
            topClientsData,
            topModulesData,
        };
    }, [finalData]);

    if (!finalData || finalData.length === 0) {
      return null;
    }

    const { totalCases, clientTrend, moduleTrend, statusCounts, solvedVsUnsolved, topClientsData, topModulesData } = dashboardStats;

    const MiniBarChart = ({ data, color }: { data: {name: string, value: number}[], color: string }) => (
        <ResponsiveContainer width="100%" height={50}>
            <RechartsBarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="value" radius={20} barSize={6}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={color} opacity={(index + 1) / data.length} />
                    ))}
                </Bar>
            </RechartsBarChart>
        </ResponsiveContainer>
    );

    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-10 mb-6">
        <Card className="lg:col-span-2 p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Case</p>
            <p className="text-3xl font-bold text-slate-800 mt-2">{totalCases}</p>
        </Card>
        <Card className="lg:col-span-3 p-6 flex justify-between items-end">
            <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Client Trend</p>
                <p className="text-xl font-bold text-slate-800 mt-2 text-wrap">{clientTrend}</p>
            </div>
            <div className='w-2/5'>
                <MiniBarChart data={topClientsData} color="hsl(var(--chart-1))" />
            </div>
        </Card>
        <Card className="lg:col-span-3 p-6 flex justify-between items-end">
            <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Module Trend</p>
                <p className="text-xl font-bold text-slate-800 mt-2 text-wrap">{moduleTrend}</p>
            </div>
             <div className='w-2/5'>
                <MiniBarChart data={topModulesData} color="hsl(var(--chart-2))" />
            </div>
        </Card>
        <Card className="lg:col-span-2 p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Solved vs Unsolved</p>
            <p className="text-3xl font-bold text-slate-800 mt-2">{solvedVsUnsolved.find(d => d.name === 'Solved')?.value || 0} / {solvedVsUnsolved.find(d => d.name === 'Unsolved')?.value || 0}</p>
        </Card>
        <Card className="lg:col-span-5 p-6">
          <CardHeader className='p-0'>
            <CardTitle className='text-base'>Status Case</CardTitle>
          </CardHeader>
          <CardContent className='p-0 mt-4'>
            <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                    <Pie
                        data={statusCounts}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        dataKey="value"
                    >
                        {statusCounts.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5 p-6">
           <CardHeader className='p-0'>
            <CardTitle className='text-base'>Solved vs Unsolved</CardTitle>
          </CardHeader>
          <CardContent className='p-0 mt-4'>
              <ResponsiveContainer width="100%" height={250}>
                  <RechartsBarChart data={solvedVsUnsolved} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} />
                      <Tooltip cursor={{fill: 'hsl(var(--muted))'}}/>
                      <Bar dataKey="value" name="Total" background={{ fill: 'hsl(var(--muted))' }} radius={8}>
                           {solvedVsUnsolved.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.name === 'Solved' ? chartConfig.solved.color : chartConfig.unsolved.color} />
                           ))}
                      </Bar>
                  </RechartsBarChart>
              </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
}


function InitialState({ error }: { error?: string }) {
  const router = useRouter();
  return (
    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
        {error ? (
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        ) : (
          <BarChartIcon className="w-16 h-16 text-muted-foreground mb-4" />
        )}
        <CardTitle>{error ? "Failed to Load Data" : "No Report Data Found"}</CardTitle>
        <CardDescription className="mt-2 mb-4 max-w-sm">
            {error ? error : "To view reports, please go to the Import Data page and convert your data."}
        </CardDescription>
        <Button onClick={() => router.push('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Import Data
        </Button>
    </Card>
  );
};

function DailyReportCard() {
    const { tableData } = useContext(SettingsContext); // Changed to SettingsContext
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
             <Card className="shadow-lg flex flex-col">
                <CardHeader>
                    <CardTitle>Daily Report</CardTitle>
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

function L3CaseReportCard() {
    const { sheetUrl } = useContext(SettingsContext); // Changed to SettingsContext
    const [l3ReportData, setL3ReportData] = useState<ReportData>(null); // State is now local
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);
    const [isGenerating, startGenerating] = useTransition();

    const handleGenerate = () => {
        startGenerating(async () => {
            if (!sheetUrl) {
                toast({ variant: 'destructive', title: "URL Not Set", description: "Google Sheet URL is not configured in Settings." });
                return;
            }
            const result = await fetchL3ReportData(sheetUrl);
            setL3ReportData(result);
            if (result.error) {
                toast({ variant: 'destructive', title: "Generation Failed", description: result.error });
            } else {
                toast({ title: "L3 Report Generated", description: "The report has been updated with the latest data." });
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
         <Card className="shadow-lg flex flex-col">
            <CardHeader>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle>L3 Case Report</CardTitle>
                   <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={handleGenerate} size="sm" className="w-full sm:w-auto" disabled={isGenerating}>
                            {isGenerating ? <RefreshCw className="text-muted-foreground animate-spin mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {isGenerating ? 'Generating...' : 'Generate Report'}
                        </Button>
                        <Button onClick={handleCopy} size="sm" variant="outline" className="w-full sm:w-auto" disabled={!l3ReportData?.report || isGenerating}>
                            {isCopied ? <Check className="text-green-500 mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                            {isCopied ? 'Copied!' : 'Copy'}
                        </Button>
                  </div>
                </div>
                <CardDescription>
                    This report is generated from the verified Google Sheet and shows 'L3' status.
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
  const router = useRouter();
  const { tableData } = useContext(SettingsContext); // Changed to SettingsContext

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
        <div className="flex">
          <Button
            onClick={() => router.push('/')}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Import Data
          </Button>
        </div>

        {hasData ? <DashboardChart /> : <InitialState />}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <DailyReportCard />
          <L3CaseReportCard />
        </div>
      </div>
    </div>
  );
}

    