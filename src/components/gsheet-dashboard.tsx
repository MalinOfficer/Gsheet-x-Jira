"use client";

import { useState, useMemo, useTransition } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, FileSpreadsheet, Loader2, ChevronDown } from 'lucide-react';
import { fetchSheetData } from '@/app/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DataRow = Record<string, string | number>;

export function GsheetDashboard() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<DataRow[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [columnUniqueValues, setColumnUniqueValues] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFetch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setData(null);
    setHeaders([]);
    setFilters({});
    setColumnUniqueValues({});

    startTransition(async () => {
      const result = await fetchSheetData(url);
      if (result.error) {
        setError(result.error);
      } else if (result.data && result.headers) {
        setData(result.data);
        setHeaders(result.headers);

        const uniqueVals: Record<string, string[]> = {};
        result.headers.forEach(header => {
          const values = new Set(result.data.map(row => String(row[header] || '')));
          uniqueVals[header] = ['', ...Array.from(values).sort()];
        });
        setColumnUniqueValues(uniqueVals);
      }
    });
  };

  const handleFilterChange = (header: string, value: string) => {
    setFilters(prev => ({ ...prev, [header]: value === 'all' ? '' : value }));
  };

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter(row => {
      return headers.every(header => {
        const filterValue = filters[header]?.toLowerCase() || '';
        if (filterValue === '') return true;
        const cellValue = String(row[header] || '').toLowerCase();
        return cellValue === filterValue;
      });
    });
  }, [data, filters, headers]);

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
            {!isPending && !error && data && (
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>2. Filter Your Data</CardTitle>
                        <CardDescription>
                            Your data is ready. Use the dropdowns below each column header to instantly filter the table.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="w-full overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {headers.map(header => (
                                            <TableHead key={header} className="font-bold min-w-[150px]">{header}</TableHead>
                                        ))}
                                    </TableRow>
                                    <TableRow className="bg-muted/50">
                                        {headers.map(header => (
                                            <TableHead key={`${header}-filter`}>
                                                <Select
                                                  value={filters[header] || ''}
                                                  onValueChange={(value) => handleFilterChange(header, value)}
                                                >
                                                  <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="Filter..." />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="">All</SelectItem>
                                                    {(columnUniqueValues[header] || []).map(value => (
                                                      value && <SelectItem key={value} value={value}>{value}</SelectItem>
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
                                                {headers.map(header => (
                                                    <TableCell key={`${header}-${index}`}>{String(row[header] || '')}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={headers.length} className="h-24 text-center">
                                                No results found. Try adjusting your filters.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <p className="text-sm text-muted-foreground">Showing {filteredData.length} of {data.length} rows.</p>
                    </CardFooter>
                </Card>
            )}
        </div>
      </div>
    </div>
  );
}
