"use client";

import { useState, useMemo, useRef, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ChevronsUpDown, Pencil, BarChart, ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateTime, type DateFormat } from '@/lib/date-utils';
import { TableDataContext } from '@/store/table-data-context';

const ALL_ITEMS_VALUE = "__ALL__";

export function ReportHarian() {
  const { tableData } = useContext(TableDataContext);
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<string>(ALL_ITEMS_VALUE);
  const [columnUniqueValues, setColumnUniqueValues] = useState<Record<string, string[]>>({});
  const [dateFormats, setDateFormats] = useState<Record<string, DateFormat>>({
    'Created At': 'report',
    'Solved At': 'report',
    'Resolved At': 'report',
  });

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (!tableData) {
        return;
    }

    const uniqueVals: Record<string, string[]> = {};
    const statusHeader = 'Status';
    if (tableData.headers.includes(statusHeader)) {
        const values = new Set(tableData.rows.map(row => String(row[statusHeader] || '')));
        uniqueVals[statusHeader] = [...Array.from(values).filter(v => v).sort()];
    }
    setColumnUniqueValues(uniqueVals);
  }, [tableData]);

  useEffect(() => {
    const topDiv = topScrollRef.current;
    const tableDiv = tableScrollRef.current;

    if (!topDiv || !tableDiv) return;

    const syncScroll = (source: HTMLDivElement, target: HTMLDivElement) => {
        return () => {
            if (target.scrollLeft !== source.scrollLeft) {
                target.scrollLeft = source.scrollLeft;
            }
        };
    };

    const topSync = syncScroll(topDiv, tableDiv);
    const tableSync = syncScroll(tableDiv, topDiv);

    topDiv.addEventListener('scroll', topSync);
    tableDiv.addEventListener('scroll', tableSync);

    return () => {
        topDiv.removeEventListener('scroll', topSync);
        tableDiv.removeEventListener('scroll', tableSync);
    };
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
  
  const InitialState = () => (
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
            {!tableData ? <InitialState /> : (
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Filtered Report</CardTitle>
                        <CardDescription>
                            Your data is ready. Use the dropdown on the 'Status' column to filter the report.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div ref={topScrollRef} className="w-full overflow-x-auto overflow-y-hidden">
                           <div style={{ width: tableRef.current?.getBoundingClientRect().width, height: '1px' }}></div>
                        </div>
                        <div ref={tableScrollRef} className="w-full overflow-x-auto">
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
                                            <TableHead key={`${header}-filter`}>
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
                                                ) : <div></div>}
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
        </div>
      </div>
    </div>
  );
}
