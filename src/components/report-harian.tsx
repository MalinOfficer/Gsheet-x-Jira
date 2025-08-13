
"use client";

import { useState, useMemo, useEffect, useContext, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, BarChart, ArrowLeft, Copy, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateTime, type DateFormat } from '@/lib/date-utils';
import { TableDataContext } from '@/store/table-data-context';
import { useToast } from '@/hooks/use-toast';

const ALL_ITEMS_VALUE = "__ALL__";

function InitialState() {
  const router = useRouter();
  return (
    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
        <BarChart className="w-16 h-16 text-muted-foreground mb-4" />
        <CardTitle>Report Data Not Found</CardTitle>
        <CardDescription className="mt-2 mb-4">
            Go back to the JSON Converter page to process your data first.
        </CardDescription>
        <Button onClick={() => router.push('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Converter
        </Button>
    </Card>
  );
};

export function ReportHarian() {
  const { tableData } = useContext(TableDataContext);
  const { toast } = useToast();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [columnUniqueValues, setColumnUniqueValues] = useState<Record<string, string[]>>({});
  const [dateFormats, setDateFormats] = useState<Record<string, DateFormat>>({
    'Created At': 'report',
    'Solved At': 'report',
    'Resolved At': 'report',
  });
  const [todayDate, setTodayDate] = useState('');

  useEffect(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    setTodayDate(`${day}/${month}/${year}`);
  }, []);

  const reportStats = useMemo(() => {
    if (!tableData?.rows) {
      return null;
    }

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
                    if (!latest || currentDate > latest) {
                        return currentDate;
                    }
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
    
    return {
      totalCases, escalatedL1, escalatedL2, escalatedL3, pending, solved,
      notResolvedCases: notResolvedCases.map(item => formatUnresolvedCase(item.clientName, item.title, item.status)),
      solvedCases: solvedCases.map(item => formatSolvedCase(item.clientName, item.title)),
      formattedLatestTime, trendingClient, trendingCase,
    };
  }, [tableData]);

  useEffect(() => {
    if (tableData?.rows) {
      const uniqueVals: Record<string, string[]> = {};
      tableData.headers.forEach(header => {
        const values = new Set(tableData.rows.map(row => String(row[header] || '')));
        uniqueVals[header] = [...Array.from(values).filter(v => v).sort()];
      });
      setColumnUniqueValues(uniqueVals);
    }
  }, [tableData]);
  

  const handleFilterChange = (header: string, value: string) => {
    setFilters(prev => {
        const newFilters = { ...prev };
        if (value === ALL_ITEMS_VALUE) {
            delete newFilters[header];
        } else {
            newFilters[header] = value;
        }
        return newFilters;
    });
  };

  const handleDateFormatChange = (header: string, format: string) => {
    if (format === 'origin' || format === 'jam' || format === 'report') {
      setDateFormats(prev => ({ ...prev, [header]: format as DateFormat }));
    }
  };

  const handleCopy = (text: string, sectionName: string) => {
    if (!text) {
        toast({
            variant: "destructive",
            title: "Nothing to copy",
            description: "This section is empty.",
        });
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        toast({
            title: "Copied to clipboard!",
            description: `${sectionName} has been copied.`,
        });
        setCopiedSection(sectionName);
        setTimeout(() => setCopiedSection(null), 2000);
    }, () => {
        toast({
            variant: "destructive",
            title: "Copy Failed",
            description: "Could not copy data to clipboard.",
        });
    });
  };

  const handleCopyAll = () => {
    if (!reportStats) return;
    const fullReport = `Case report ${todayDate} (update last entry time ${reportStats.formattedLatestTime})

Total cases: ${reportStats.totalCases}
Escalated L1: ${reportStats.escalatedL1}
Escalated L2: ${reportStats.escalatedL2}
Escalated L3: ${reportStats.escalatedL3}
Pending: ${reportStats.pending}
Solved: ${reportStats.solved}
Client Trend: ${reportStats.trendingClient}
Case Trend: ${reportStats.trendingCase}

Summary of unresolved case details:
${reportStats.notResolvedCases.map((item, i) => `${i + 1}. ${item}`).join('\n') || 'No unresolved cases.'}

Solved cases:
${reportStats.solvedCases.map((item, i) => `${i + 1}. ${item}`).join('\n') || 'No solved cases yet.'}
`;
    handleCopy(fullReport.trim(), 'Full Report');
  };

  const filteredData = useMemo(() => {
    if (!tableData?.rows) return [];
    
    const activeFilters = Object.entries(filters);
    if (activeFilters.length === 0) return tableData.rows;

    return tableData.rows.filter(row => {
        return activeFilters.every(([header, value]) => {
            const cellValue = String(row[header] || '');
            return cellValue.toLowerCase() === value.toLowerCase();
        });
    });
  }, [tableData, filters]);
  
  function MainContent() {
    if (!tableData) return null;
    return (
    <>
      {reportStats && (
          <Card className="shadow-lg mb-6">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle className="text-xl">Case report {todayDate} (update last entry time {reportStats.formattedLatestTime})</CardTitle>
                  <Button onClick={handleCopyAll} size="sm" variant="outline" className="w-full sm:w-auto">
                    <div className="flex items-center justify-center">
                      {copiedSection === 'Full Report' ? <Check className="text-green-500 mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copiedSection === 'Full Report' ? 'Copied!' : 'Copy Full Report'}
                    </div>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                   <div className="space-y-2">
                      <h3 className="font-semibold">Case Statistics</h3>
                      <div className="space-y-1">
                          <p>Total cases: <span className="font-medium">{reportStats.totalCases}</span></p>
                          <p>Escalated L1: <span className="font-medium">{reportStats.escalatedL1}</span></p>
                          <p>Escalated L2: <span className="font-medium">{reportStats.escalatedL2}</span></p>
                          <p>Escalated L3: <span className="font-medium">{reportStats.escalatedL3}</span></p>
                          <p>Pending: <span className="font-medium">{reportStats.pending}</span></p>
                          <p>Solved: <span className="font-medium">{reportStats.solved}</span></p>
                          <p>Client Trend: <span className="font-medium">{reportStats.trendingClient}</span></p>
                          <p>Case Trend: <span className="font-medium">{reportStats.trendingCase}</span></p>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <h3 className="font-semibold">Summary of unresolved case details:</h3>
                      <ol className="list-decimal list-inside space-y-1">
                          {reportStats.notResolvedCases.length > 0 ? (
                              reportStats.notResolvedCases.map((item, i) => <li key={i}>{item}</li>)
                          ) : (
                              <li>Tidak ada kasus yang belum selesai.</li>
                          )}
                      </ol>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">Solved cases:</h3>
                      <ol className="list-decimal list-inside space-y-1">
                          {reportStats.solvedCases.length > 0 ? (
                              reportStats.solvedCases.map((item, i) => <li key={i}>{item}</li>)
                          ) : (
                              <li>Belum ada kasus yang selesai.</li>
                          )}
                      </ol>
                  </div>
              </CardContent>
          </Card>
      )}

      {tableData && (
          <Card className="shadow-lg">
              <CardHeader>
                  <CardTitle>Filtered Report</CardTitle>
                  <CardDescription>
                      Data Anda sudah siap. Gunakan menu dropdown pada header kolom untuk memfilter laporan.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="relative w-full overflow-auto rounded-md border max-h-[500px]">
                      <Table>
                          <TableHeader className="sticky top-0 bg-card z-10">
                              <TableRow>
                                  {tableData.headers.map(header => (
                                      <TableHead key={header} className="font-bold whitespace-nowrap">
                                          {header.startsWith("__EMPTY__") ? "" : (
                                              (header === 'Created At' || header === 'Solved At' || header === 'Resolved At') ? (
                                                  <DropdownMenu>
                                                      <DropdownMenuTrigger asChild>
                                                          <Button variant="ghost" className="pl-0 text-xs text-left font-bold">
                                                              <span className="flex items-center gap-1">
                                                                {header}
                                                                <Pencil className="h-3 w-3 text-muted-foreground" />
                                                              </span>
                                                          </Button>
                                                      </DropdownMenuTrigger>
                                                      <DropdownMenuContent>
                                                          <DropdownMenuLabel>Date Format</DropdownMenuLabel>
                                                          <DropdownMenuSeparator />
                                                          <DropdownMenuRadioGroup value={dateFormats[header] || 'report'} onValueChange={(value) => handleDateFormatChange(header, value)}>
                                                              <DropdownMenuRadioItem value="origin">Origin</DropdownMenuRadioItem>
                                                              <DropdownMenuRadioItem value="jam">Time</DropdownMenuRadioItem>
                                                              <DropdownMenuRadioItem value="report">Report</DropdownMenuRadioItem>
                                                          </DropdownMenuRadioGroup>
                                                      </DropdownMenuContent>
                                                  </DropdownMenu>
                                              ) : header
                                          )}
                                      </TableHead>
                                  ))}
                              </TableRow>
                              <TableRow className="bg-muted/50">
                                  {tableData.headers.map(header => (
                                      <TableHead key={`${header}-filter`}>
                                          {(columnUniqueValues[header] || []).length > 0 && !header.toLowerCase().startsWith('kolom kosong') ? (
                                            <Select
                                              value={filters[header] || ALL_ITEMS_VALUE}
                                              onValueChange={(value) => handleFilterChange(header, value)}
                                            >
                                              <SelectTrigger className="text-xs h-8">
                                                <SelectValue placeholder={`Filter ${header}...`} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value={ALL_ITEMS_VALUE}>All</SelectItem>
                                                {(columnUniqueValues[header] || []).map(value => (
                                                  <SelectItem key={value} value={value}>{value}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          ) : <div style={{ height: '32px' }}></div>}
                                      </TableHead>
                                  ))}
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {filteredData.length > 0 ? (
                                  filteredData.map((row, index) => (
                                      <TableRow key={index} className="hover:bg-muted/50">
                                          {tableData.headers.map(header => (
                                              <TableCell key={`${header}-${index}`} className="text-xs">
                                                  {(header === 'Created At' || header === 'Solved At' || header === 'Resolved At')
                                                    ? formatDateTime(row[header], dateFormats[header] || 'report')
                                                    : String(row[header] || '')}
                                              </TableCell>
                                          ))}
                                      </TableRow>
                                  ))
                              ) : (
                                  <TableRow>
                                      <TableCell colSpan={tableData.headers.length} className="h-24 text-center">
                                          No results found. Try adjusting your filters.
                                      </TableCell>
                                  </TableRow>
                              )}
                          </TableBody>
                      </Table>
                  </div>
              </CardContent>
              <CardFooter>
                  <p className="text-sm text-muted-foreground">Showing {filteredData.length} of {tableData.rows.length} rows.</p>
              </CardFooter>
          </Card>
      )}
    </>
    );
  }

  return (
    <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Daily Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Laporan ini dibuat dari data yang Anda konversi. Gunakan menu dropdown untuk memfilter berdasarkan status.
          </p>
        </header>

        <div className="min-h-[400px]">
          {!tableData ? <InitialState /> : <MainContent />}
        </div>
      </div>
    </div>
  );
}
