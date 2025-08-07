"use client";

import { useState, useMemo, useTransition, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, FileSpreadsheet, Loader2, ChevronsUpDown, Edit } from 'lucide-react';
import { fetchSheetData } from '@/app/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";


type DataRow = Record<string, string | number>;
type DateFormat = 'origin' | 'jam' | 'report';

const ALL_ITEMS_VALUE = "__ALL__";
const EMPTY_COLUMN_KEY = "__EMPTY__";

const desiredHeadersConfig = [
  'Customer Name',
  'Status',
  EMPTY_COLUMN_KEY,
  'Ticket Category',
  'Module',
  'Detail Module',
  'Created At',
  'Title',
  EMPTY_COLUMN_KEY,
  'Solved At'
];

const formatDateTime = (value: any, format: DateFormat): string => {
    if (!value || typeof value !== 'string') return '';
    if (format === 'origin') return value;

    try {
        const dateParts = value.match(/([A-Z][a-z]+)\s(\d{1,2}),\s(\d{4}),\s(\d{1,2}):(\d{2})\s(AM|PM)/);
        let date: Date;

        if (dateParts) {
             const [_, monthName, day, year, hourStr, minuteStr, ampm] = dateParts;
             const monthMap: { [key: string]: number } = {
                'January': 0, 'February': 1, 'March': 2, 'April': 3,
                'May': 4, 'June': 5, 'July': 6, 'August': 7,
                'September': 8, 'October': 9, 'November': 10, 'December': 11,
            };

            let hours = parseInt(hourStr, 10);
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;

            date = new Date(parseInt(year), monthMap[monthName], parseInt(day), hours, parseInt(minuteStr));
        } else {
            date = new Date(value);
        }

        if (isNaN(date.getTime())) {
            return value; // Return original if parsing fails
        }
        
        if (format === 'report') {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        }

        if (format === 'jam') {
            let hours = date.getHours();
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            const hoursPadded = String(hours).padStart(2, '0');
            return `${hoursPadded}:${minutes} ${ampm}`;
        }

        return value;
    } catch (e) {
        return value; // Return original on any error
    }
};

export function GsheetDashboard() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<DataRow[] | null>(null);
  const [processedData, setProcessedData] = useState<DataRow[] | null>(null);
  const [displayHeaders, setDisplayHeaders] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [columnUniqueValues, setColumnUniqueValues] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dateFormats, setDateFormats] = useState<Record<string, DateFormat>>({
    'Created At': 'report',
    'Solved At': 'report',
  });

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

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
  }, [processedData]);

  const handleFetch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setData(null);
    setProcessedData(null);
    setDisplayHeaders([]);
    setFilters({});
    setColumnUniqueValues({});

    startTransition(async () => {
      const result = await fetchSheetData(url);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setData(result.data);
        const headersWithUniqueKeys = desiredHeadersConfig.map((h, i) => 
            h === EMPTY_COLUMN_KEY ? `${EMPTY_COLUMN_KEY}_${i}` : h
        );
        setDisplayHeaders(headersWithUniqueKeys);

        const transformedData = result.data.map(originalRow => {
            const newRow: DataRow = {};
            headersWithUniqueKeys.forEach(headerKey => {
                if (headerKey.startsWith(EMPTY_COLUMN_KEY)) {
                    newRow[headerKey] = '';
                } else {
                    newRow[headerKey] = originalRow[headerKey] || '';
                }
            });
            return newRow;
        });
        setProcessedData(transformedData);

        const uniqueVals: Record<string, string[]> = {};
        headersWithUniqueKeys.forEach(header => {
          if (header.startsWith(EMPTY_COLUMN_KEY)) return;
          const values = new Set(transformedData.map(row => String(row[header] || '')));
          uniqueVals[header] = [...Array.from(values).filter(v => v).sort()];
        });
        setColumnUniqueValues(uniqueVals);
      }
    });
  };

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

  const filteredData = useMemo(() => {
    if (!processedData) return [];
    return processedData.filter(row => {
      return Object.entries(filters).every(([header, filterValue]) => {
        if (!filterValue) return true;
        const cellValue = String(row[header] || '');
        return cellValue.toLowerCase() === filterValue.toLowerCase();
      });
    });
  }, [processedData, filters]);

  const TableSkeleton = () => (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </CardContent>
    </Card>
  );

  const InitialState = () => (
    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px]">
        <FileSpreadsheet className="w-16 h-16 text-muted-foreground mb-4" />
        <CardTitle>Your Dashboard Awaits</CardTitle>
        <CardDescription className="mt-2">
            Enter a Google Sheet link above to get started.
        </CardDescription>
    </Card>
  );

  const ErrorAlert = ({ message }: { message: string }) => (
    <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
    </Alert>
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary font-headline">GSheet Dashboard</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Instantly turn your Google Sheets into interactive, filterable dashboards. Just paste a link to begin.
          </p>
        </header>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>1. Enter Google Sheet Link</CardTitle>
            <CardDescription>
              Paste the share link of your Google Sheet. Make sure it's accessible to "Anyone with the link".
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleFetch}>
            <CardContent>
              <div className="flex w-full items-center space-x-2">
                <div className="relative flex-grow">
                    <FileSpreadsheet className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="url"
                        placeholder="e.g., https://docs.google.com/spreadsheets/d/..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        required
                        className="pl-10"
                        aria-label="Google Sheet URL"
                    />
                </div>
                <Button type="submit" disabled={isPending || !url} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    "Fetch Data"
                  )}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>

        <div className="min-h-[400px]">
            {isPending && <TableSkeleton />}
            {error && <ErrorAlert message={error} />}
            {!isPending && !error && !data && <InitialState />}
            {!isPending && !error && data && processedData && (
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>3. Your Table is Ready</CardTitle>
                        <CardDescription>
                            Your data is ready. Use the dropdowns to filter or change date formats.
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
                                        {displayHeaders.map(header => (
                                            <TableHead key={header} className="font-bold whitespace-nowrap">
                                                {header.startsWith(EMPTY_COLUMN_KEY) ? "" : (
                                                    (header === 'Created At' || header === 'Solved At') ? (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="pl-0">
                                                                    <span className="flex items-center gap-2">
                                                                      {header}
                                                                      <Edit className="h-3 w-3 text-muted-foreground" />
                                                                    </span>
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuLabel>Date Format</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuRadioGroup value={dateFormats[header]} onValueChange={(value) => handleDateFormatChange(header, value)}>
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
                                        {displayHeaders.map(header => (
                                            <TableHead key={`${header}-filter`}>
                                                {!header.startsWith(EMPTY_COLUMN_KEY) ? (
                                                  <Select
                                                    value={filters[header] || ALL_ITEMS_VALUE}
                                                    onValueChange={(value) => handleFilterChange(header, value)}
                                                  >
                                                    <SelectTrigger>
                                                      <SelectValue placeholder="Filter..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value={ALL_ITEMS_VALUE}>All</SelectItem>
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
                                                {displayHeaders.map(header => (
                                                    <TableCell key={`${header}-${index}`} className="whitespace-nowrap">
                                                        {(header === 'Created At' || header === 'Solved At')
                                                          ? formatDateTime(row[header], dateFormats[header])
                                                          : String(row[header] || '')}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={displayHeaders.length} className="h-24 text-center">
                                                No results found. Try adjusting your filters.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <p className="text-sm text-muted-foreground">Showing {filteredData.length} of {processedData.length} rows.</p>
                    </CardFooter>
                </Card>
            )}
        </div>
      </div>
    </div>
  );
}
