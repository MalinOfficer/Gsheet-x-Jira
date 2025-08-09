
"use client";

import { useState, useMemo, useEffect, useContext, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronsUpDown, Pencil, BarChart, ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateTime, type DateFormat } from '@/lib/date-utils';
import { TableDataContext } from '@/store/table-data-context';
import { cn } from '@/lib/utils';

const ALL_ITEMS_VALUE = "__ALL__";

function InitialState() {
  const router = useRouter();
  return (
    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px]">
        <BarChart className="w-16 h-16 text-muted-foreground mb-4" />
        <CardTitle>No Report Data Found</CardTitle>
        <CardDescription className="mt-2 mb-4">
            Go back to the JSON to Table page to convert your data first.
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

  const [statusFilter, setStatusFilter] = useState<string>(ALL_ITEMS_VALUE);
  const [columnUniqueValues, setColumnUniqueValues] = useState<Record<string, string[]>>({});
  const [dateFormats, setDateFormats] = useState<Record<string, DateFormat>>({
    'Created At': 'report',
    'Solved At': 'report',
    'Resolved At': 'report',
  });
  const [todayDate, setTodayDate] = useState('');

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    setTodayDate(`${day}/${month}/${year}`);
  }, []);

  useEffect(() => {
    const topDiv = topScrollRef.current;
    const tableContainerDiv = tableContainerRef.current;
    if (!topDiv || !tableContainerDiv || !tableRef.current) return;
    
    const topWidth = tableRef.current.offsetWidth;
    const topScrollChild = topDiv.firstElementChild as HTMLDivElement | null;
    if (topScrollChild) {
      topScrollChild.style.width = `${topWidth}px`;
    }

    let isSyncing = false;
    const handleTopScroll = () => {
        if (!isSyncing) {
            isSyncing = true;
            tableContainerDiv.scrollLeft = topDiv.scrollLeft;
            isSyncing = false;
        }
    };
    const handleTableScroll = () => {
        if (!isSyncing) {
            isSyncing = true;
            topDiv.scrollLeft = tableContainerDiv.scrollLeft;
            isSyncing = false;
        }
    };
    
    topDiv.addEventListener('scroll', handleTopScroll);
    tableContainerDiv.addEventListener('scroll', handleTableScroll);

    const resizeObserver = new ResizeObserver(() => {
        const newWidth = tableRef.current?.offsetWidth || 0;
         if (topScrollChild) {
            topScrollChild.style.width = `${newWidth}px`;
         }
    });

    resizeObserver.observe(tableRef.current);

    return () => {
        topDiv.removeEventListener('scroll', handleTopScroll);
        tableContainerDiv.removeEventListener('scroll', handleTableScroll);
        resizeObserver.disconnect();
    };
  }, [tableData]);

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
      .map(r => ({ clientName: r['Client Name'], title: r.Title as string }));

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
            } catch (e) {
                // Ignore invalid date strings
            }
        }
        return latest;
    }, null as Date | null);

    const formattedLatestTime = latestEntryTime 
        ? formatDateTime(latestEntryTime.toISOString(), 'jam')
        : 'N/A';
    
    const formatTitle = (clientName: string, title: string) => {
      if (!clientName || !title) return title || clientName || '';
      return `${clientName} ${title}`.trim();
    };
    
    return {
      totalCases,
      escalatedL1,
      escalatedL2,
      escalatedL3,
      pending,
      solved,
      notResolvedCases: notResolvedCases.map(item => formatTitle(item.clientName, item.title)),
      solvedCases: solvedCases.map(item => formatTitle(item.clientName, item.title)),
      formattedLatestTime,
      trendingClient,
      trendingCase,
    };
  }, [tableData]);

  useEffect(() => {
    if (tableData?.rows) {
      const uniqueVals: Record<string, string[]> = {};
      const statusHeader = 'Status';
      if (tableData.headers.includes(statusHeader)) {
          const values = new Set(tableData.rows.map(row => String(row[statusHeader] || '')));
          uniqueVals[statusHeader] = [...Array.from(values).filter(v => v).sort()];
      }
      setColumnUniqueValues(uniqueVals);
    }
  }, [tableData]);
  

  const handleFilterChange = (header: string, value: string) => {
    if (header === 'Status') {
        setStatusFilter(value);
    }
  };

  const handleDateFormatChange = (header: string, format: string) => {
    if (format === 'origin' || format === 'jam' || format === 'report') {
      setDateFormats(prev => ({ ...prev, [header]: format as DateFormat }));
    }
  };

  const filteredData = useMemo(() => {
    if (!tableData?.rows) return [];
    return tableData.rows.filter(row => {
      if (statusFilter === ALL_ITEMS_VALUE) return true;
      const cellValue = String(row['Status'] || '');
      return cellValue.toLowerCase() === statusFilter.toLowerCase();
    });
  }, [tableData, statusFilter]);

  
  function MainContent() {
    return (
    <>
      {reportStats && (
          <Card className="shadow-lg mb-8">
              <CardHeader>
                  <CardTitle>Reporting cases {todayDate} (update jam masuk terakhir {reportStats.formattedLatestTime})</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                   <div className="space-y-4">
                      <h3 className="font-semibold">Case Statistics</h3>
                      <div className="text-sm space-y-2">
                          <p>Total cases: <span className="font-medium">{reportStats.totalCases}</span></p>
                          <p>Escalated L1: <span className="font-medium">{reportStats.escalatedL1}</span></p>
                          <p>Escalated L2: <span className="font-medium">{reportStats.escalatedL2}</span></p>
                          <p>Escalated L3: <span className="font-medium">{reportStats.escalatedL3}</span></p>
                          <p>Pending: <span className="font-medium">{reportStats.pending}</span></p>
                          <p>Solved: <span className="font-medium">{reportStats.solved}</span></p>
                          <p>Tren Client: <span className="font-medium">{reportStats.trendingClient}</span></p>
                          <p>Tren Case: <span className="font-medium">{reportStats.trendingCase}</span></p>
                      </div>
                  </div>
                  <div className="space-y-4">
                      <h3 className="font-semibold">Summary detail case yang belum Resolved:</h3>
                      <ol className="list-decimal list-inside text-sm space-y-1">
                          {reportStats.notResolvedCases.length > 0 ? (
                              reportStats.notResolvedCases.map((item, i) => <li key={i}>{item}</li>)
                          ) : (
                              <li>No unresolved cases.</li>
                          )}
                      </ol>
                  </div>
                  <div className="space-y-4">
                      <h3 className="font-semibold">Case yang solved:</h3>
                      <ol className="list-decimal list-inside text-sm space-y-1">
                          {reportStats.solvedCases.length > 0 ? (
                              reportStats.solvedCases.map((item, i) => <li key={i}>{item}</li>)
                          ) : (
                              <li>No solved cases yet.</li>
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
                      Your data is ready. Use the dropdown on the 'Status' column to filter the report.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <div ref={topScrollRef} className="w-full overflow-x-auto overflow-y-hidden">
                    <div style={{ height: '1px' }}></div>
                  </div>
                  <div ref={tableContainerRef} className="w-full overflow-x-auto rounded-md border">
                      <Table ref={tableRef}>
                          <TableHeader>
                              <TableRow>
                                  {tableData.headers.map(header => (
                                      <TableHead key={header} className="font-bold whitespace-nowrap">
                                          {header.startsWith("__EMPTY__") ? "" : (
                                              (header === 'Created At' || header === 'Solved At' || header === 'Resolved At') ? (
                                                  <DropdownMenu>
                                                      <DropdownMenuTrigger asChild>
                                                          <Button variant="ghost" className="pl-0">
                                                              <span className="flex items-center gap-2">
                                                                {header}
                                                                <Pencil className="h-3 w-3 text-muted-foreground" />
                                                              </span>
                                                              <ChevronsUpDown className="ml-2 h-4 w-4" />
                                                          </Button>
                                                      </DropdownMenuTrigger>
                                                      <DropdownMenuContent>
                                                          <DropdownMenuLabel>Date Format</DropdownMenuLabel>
                                                          <DropdownMenuSeparator />
                                                          <DropdownMenuRadioGroup value={dateFormats[header] || 'report'} onValueChange={(value) => handleDateFormatChange(header, value)}>
                                                              <DropdownMenuRadioItem value="origin">Origin</DropdownMenuRadioItem>
                                                              <DropdownMenuRadioItem value="jam">Jam</DropdownMenuRadioItem>
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
                                      <TableHead key={`${header}-filter`} className="whitespace-nowrap">
                                          {header === 'Status' ? (
                                            <Select
                                              value={statusFilter}
                                              onValueChange={(value) => handleFilterChange(header, value)}
                                            >
                                              <SelectTrigger>
                                                <SelectValue placeholder="Filter by Status..." />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value={ALL_ITEMS_VALUE}>All Statuses</SelectItem>
                                                {(columnUniqueValues[header] || []).map(value => (
                                                  <SelectItem key={value} value={value}>{value}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          ) : <div style={{ height: '40px' }}></div>}
                                      </TableHead>
                                  ))}
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {filteredData.length > 0 ? (
                                  filteredData.map((row, index) => (
                                      <TableRow key={index} className="hover:bg-muted/50">
                                          {tableData.headers.map(header => (
                                              <TableCell key={`${header}-${index}`} className="whitespace-nowrap">
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
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary font-headline">Report Harian</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            This report is generated from the data you converted. Use the dropdown to filter by status.
          </p>
        </header>

        <div className="min-h-[400px]">
          {!tableData ? <InitialState /> : <MainContent />}
        </div>
      </div>
    </div>
  );
}
