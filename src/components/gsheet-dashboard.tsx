
"use client";

import { useState, useMemo, useTransition, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, FileSpreadsheet, Loader2, ChevronsUpDown, Pencil, RefreshCw, Upload, KeyRound } from 'lucide-react';
import { fetchSheetData, importToSheet } from '@/app/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateTime, type DateFormat } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

type DataRow = Record<string, string | number>;

const ALL_ITEMS_VALUE = "__ALL__";
const LOCAL_STORAGE_KEY_URL = 'gsheetDashboardUrl';
const LOCAL_STORAGE_KEY_GCP_EMAIL = 'gsheetDashboardGcpEmail';
const LOCAL_STORAGE_KEY_GCP_KEY = 'gsheetDashboardGcpKey';
const STATUS_COLUMN_NAME = 'STATUS CASE'; 
const STATUS_FILTER_VALUE = 'l3';

export function GsheetDashboard() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<DataRow[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [displayHeaders, setDisplayHeaders] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [columnUniqueValues, setColumnUniqueValues] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isFetching, startFetching] = useTransition();
  const [isImporting, startImporting] = useTransition();
  const [isMounted, setIsMounted] = useState(false);
  const [dateFormats, setDateFormats] = useState<Record<string, DateFormat>>({
    'Created At': 'report',
    'Solved At': 'report',
  });
  const [gcpEmail, setGcpEmail] = useState('');
  const [gcpKey, setGcpKey] = useState('');
  const { toast } = useToast();

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  
  const processAndSetData = (resultData: DataRow[], resultHeaders: string[]) => {
      const columnsToExclude = ['PENANGANAN CASE', 'CHECK OUT', 'PIC L2 DURASI'];
      const filteredHeaders = resultHeaders.filter(header => !columnsToExclude.includes(header));
      
      setData(resultData);
      setHeaders(resultHeaders); // Store original headers
      setDisplayHeaders(filteredHeaders);

      const uniqueVals: Record<string, string[]> = {};
      filteredHeaders.forEach(header => {
        const values = new Set(resultData.map(row => String(row[header] || '')));
        uniqueVals[header] = [...Array.from(values).filter(v => v).sort()];
      });
      setColumnUniqueValues(uniqueVals);
  };

  const executeFetch = (fetchUrl: string) => {
    if (!fetchUrl) return;
    
    setError(null);
    setData(null);
    setDisplayHeaders([]);
    setFilters({});
    setColumnUniqueValues({});

    startFetching(async () => {
      const result = await fetchSheetData(fetchUrl);
      if (result.error) {
        setError(result.error);
        localStorage.removeItem(LOCAL_STORAGE_KEY_URL);
      } else if (result.data && result.headers) {
        processAndSetData(result.data, result.headers);
        localStorage.setItem(LOCAL_STORAGE_KEY_URL, fetchUrl);
      }
    });
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      const savedUrl = localStorage.getItem(LOCAL_STORAGE_KEY_URL);
      const savedEmail = localStorage.getItem(LOCAL_STORAGE_KEY_GCP_EMAIL);
      const savedKey = localStorage.getItem(LOCAL_STORAGE_KEY_GCP_KEY);

      if (savedUrl) {
        setUrl(savedUrl);
        executeFetch(savedUrl);
      }
      if (savedEmail) {
        setGcpEmail(savedEmail);
      }
      if (savedKey) {
        setGcpKey(savedKey);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

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
  }, [data]);

  const handleFetchFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    executeFetch(url);
  };

  const handleReset = () => {
    setUrl('');
    setData(null);
    setDisplayHeaders([]);
    setFilters({});
    setColumnUniqueValues({});
    setError(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY_URL);
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
    if (!data) return [];
    
    const baseData = data.filter(row => {
      const statusValue = String(row[STATUS_COLUMN_NAME] || '').toLowerCase();
      return statusValue === STATUS_FILTER_VALUE;
    });

    return baseData.filter(row => {
      return Object.entries(filters).every(([header, filterValue]) => {
        if (!filterValue || filterValue === ALL_ITEMS_VALUE) return true;
        const cellValue = String(row[header] || '');
        return cellValue.toLowerCase() === filterValue.toLowerCase();
      });
    });
  }, [data, filters]);

  const handleImport = async () => {
    if (!filteredData || !url) {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: "No data to import or sheet URL is missing.",
      });
      return;
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEY_GCP_EMAIL, gcpEmail);
    localStorage.setItem(LOCAL_STORAGE_KEY_GCP_KEY, gcpKey);

    startImporting(async () => {
      const result = await importToSheet({ headers, rows: filteredData }, url, gcpEmail, gcpKey);

      if (result.error) {
        toast({
          variant: "destructive",
          title: "Import Error",
          description: `Failed to import to sheet: ${result.error}`,
        });
      } else {
        toast({
          title: "Import Successful",
          description: result.message,
        });
      }
    });
  };


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

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
           <TableSkeleton />
        </div>
      </div>
    );
  }
  
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
            <CardTitle>Enter Google Sheet Link</CardTitle>
            <CardDescription>
              Paste the share link of your Google Sheet. Make sure it's accessible to "Anyone with the link".
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleFetchFormSubmit}>
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
                <Button type="submit" disabled={isFetching || !url} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  {isFetching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    "Fetch Data"
                  )}
                </Button>
                <Button type="button" variant="destructive" onClick={handleReset}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Return
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>

        <div className="min-h-[400px]">
            {isFetching && <TableSkeleton />}
            {error && <ErrorAlert message={error} />}
            {!isFetching && !error && !data && <InitialState />}
            {!isFetching && !error && data && (
              <>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Update Cases</CardTitle>
                        <CardDescription>
                           Showing default cases with status L3. Use dropdowns to filter further.
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
                                            <TableHead 
                                                key={header} 
                                                className={cn(
                                                    "font-bold whitespace-nowrap",
                                                    header.toLowerCase() === 'no' && "w-[30px]",
                                                    header.toLowerCase().includes('date') && "w-[80px]"
                                                )}
                                            >
                                                {(header === 'Created At' || header === 'Solved At') ? (
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
                                                            <DropdownMenuRadioGroup value={dateFormats[header]} onValueChange={(value) => handleDateFormatChange(header, value)}>
                                                                <DropdownMenuRadioItem value="origin">Origin</DropdownMenuRadioItem>
                                                                <DropdownMenuRadioItem value="jam">Jam</DropdownMenuRadioItem>
                                                                <DropdownMenuRadioItem value="report">Report</DropdownMenuRadioItem>
                                                            </DropdownMenuRadioGroup>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                ) : header}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                    <TableRow className="bg-muted/50">
                                        {displayHeaders.map(header => (
                                            <TableHead key={`${header}-filter`}>
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
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.length > 0 ? (
                                        filteredData.map((row, index) => (
                                            <TableRow key={index} className="hover:bg-muted/50">
                                                {displayHeaders.map(header => (
                                                    <TableCell 
                                                        key={`${header}-${index}`} 
                                                        className={cn(
                                                            "whitespace-nowrap",
                                                            header.toLowerCase() === 'no' && "w-[30px]",
                                                            header.toLowerCase().includes('date') && "w-[80px]"
                                                        )}
                                                    >
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
                                                No results found for "L3" status. Try adjusting your filters or checking the sheet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <p className="text-sm text-muted-foreground">Showing {filteredData.length} of {data?.length || 0} total rows (filtered by L3 status).</p>
                    </CardFooter>
                </Card>

                <Card className="shadow-lg mt-8">
                  <CardHeader>
                    <CardTitle>Import Destination</CardTitle>
                    <CardDescription>
                      Enter your Google Cloud Service Account credentials to import the filtered data into the Google Sheet.
                      The sheet content will be overwritten.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="gcp-email">Service Account Email</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="gcp-email"
                          type="email"
                          placeholder="your-service-account@your-project.iam.gserviceaccount.com"
                          value={gcpEmail}
                          onChange={(e) => setGcpEmail(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gcp-key">Service Account Private Key</Label>
                      <Textarea
                        id="gcp-key"
                        placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
                        value={gcpKey}
                        onChange={(e) => setGcpKey(e.target.value)}
                        rows={6}
                        className="font-mono"
                      />
                    </div>
                    <Button onClick={handleImport} disabled={isImporting || !gcpEmail || !gcpKey || !filteredData.length}>
                      {isImporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Import to GSheet
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
        </div>
      </div>
    </div>
  );
}
