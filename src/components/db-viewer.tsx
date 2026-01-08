
"use client";

import { AlertTriangle, Database, Cloud, RefreshCw, Search, Calendar as CalendarIcon, X } from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardHeader, 
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useContext, useEffect, useState, useRef, useMemo } from "react";
import { TableDataContext } from "@/store/table-data-context";
import { getAllCaseData } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from "@/lib/utils";
import { useDebounce } from 'use-debounce';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from 'date-fns';
import { DateRange } from "react-day-picker"


interface DbViewerState {
    data: any[] | null;
    source: 'cache' | 'sheet' | 'N/A';
    error?: string;
    loading: boolean;
}

// Helper to parse DD/MM/YYYY strings into Date objects
const parseDate = (dateStr: string): Date | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    try {
        // Use date-fns for reliable parsing of DD/MM/YYYY format
        const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
        if (isNaN(parsed.getTime())) return null;
        return parsed;
    } catch (e) {
        return null;
    }
};


export function DbViewer() {
    const { dbSheetUrl } = useContext(TableDataContext);
    const [state, setState] = useState<DbViewerState>({
        data: null,
        source: 'N/A',
        loading: true,
    });
    const { toast } = useToast();
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);


    const fetchData = async (showToast = false) => {
        if (!dbSheetUrl) {
            setState({ data: null, source: 'N/A', error: 'DB GSheet URL is not configured in Settings.', loading: false });
            return;
        }

        setState(prevState => ({ ...prevState, loading: true }));
        const result = await getAllCaseData(dbSheetUrl);
        setState({
            data: result.data || null,
            source: result.source || 'N/A',
            error: result.error,
            loading: false,
        });

        if (showToast) {
            if (result.error) {
                 toast({ variant: 'destructive', title: "Refresh Failed", description: result.error });
            } else {
                 toast({ title: "Data Refreshed", description: `Data loaded from ${result.source}.` });
            }
        }
    };
    
    useEffect(() => {
        fetchData();
    }, [dbSheetUrl]);

    const filteredData = useMemo(() => {
        if (!state.data) return [];
        
        let dataToFilter = state.data;

        // Apply date range filter first
        if (dateRange?.from) {
             dataToFilter = dataToFilter.filter(row => {
                const dateValue = row['DATE']; // Assuming the column name is 'DATE'
                if (!dateValue) return false;

                const rowDate = parseDate(dateValue);
                if (!rowDate) return false;

                const fromDate = dateRange.from ? new Date(dateRange.from.setHours(0, 0, 0, 0)) : null;
                const toDate = dateRange.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : fromDate;

                if (fromDate && toDate) {
                    return rowDate >= fromDate && rowDate <= toDate;
                }
                if (fromDate) {
                    return rowDate >= fromDate;
                }
                return true;
            });
        }


        // Then apply search term filter
        if (!debouncedSearchTerm) return dataToFilter;

        const lowercasedQuery = debouncedSearchTerm.toLowerCase();

        return dataToFilter.filter(row => {
            return Object.values(row).some(value =>
                String(value).toLowerCase().includes(lowercasedQuery)
            );
        });
    }, [state.data, debouncedSearchTerm, dateRange]);
    
    const headers = filteredData.length > 0 ? Object.keys(filteredData[0]) : [];
    
    const rowVirtualizer = useVirtualizer({
        count: filteredData.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 49, // h-12 (48px) + 1px border
        overscan: 5,
    });
    
    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalHeight = rowVirtualizer.getTotalSize();

    const getColumnWidth = (header: string) => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('detail case') || lowerHeader.includes('penanganan case')) {
            return 350;
        }
        if (lowerHeader.includes('client') || lowerHeader.includes('customer name') || lowerHeader.includes('ticket number')) {
            return 180;
        }
        if (lowerHeader === 'no') {
            return 60;
        }
        return 120;
    };

    const totalWidth = useMemo(() => headers.reduce((acc, header) => acc + getColumnWidth(header), 0), [headers]);


    if (state.loading && !state.data) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                 <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <RefreshCw className="w-16 h-16 text-muted-foreground mb-4 animate-spin" />
                        <CardTitle>Loading "All Case" Data...</CardTitle>
                    </Card>
                </div>
            </div>
        )
    }

    if (state.error) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                        <CardTitle>Failed to Load "All Case" Data</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">
                            {state.error}
                        </CardDescription>
                         <Button onClick={() => fetchData(true)} disabled={state.loading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
                            Try Again
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    if (!state.data || state.data.length === 0) {
        return (
             <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <Database className="w-16 h-16 text-muted-foreground mb-4" />
                        <CardTitle>No Data Found</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">
                            The "All Case" database is currently empty.
                        </CardDescription>
                         <Button onClick={() => fetchData(true)} disabled={state.loading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
                            Refresh Now
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                 <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">All Case Database</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                          Menampilkan semua data dari Google Sheet "All Case".
                        </p>
                    </div>
                     <div className="flex items-center gap-2">
                         <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search data..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 sm:w-[300px]"
                            />
                        </div>
                         <Button onClick={() => fetchData(true)} size="sm" variant="outline" disabled={state.loading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Badge variant={state.source === 'cache' ? 'default' : 'secondary'} className="w-fit">
                            {state.source === 'cache' ? <Database className="mr-2 h-4 w-4"/> : <Cloud className="mr-2 h-4 w-4"/>}
                            Data source: {state.source}
                        </Badge>
                    </div>
                </header>
                
                <Card>
                    <CardContent className="p-0">
                        <div ref={tableContainerRef} className="overflow-auto h-[75vh] border rounded-md">
                           <table className="text-sm" style={{ tableLayout: 'fixed', width: totalWidth }}>
                                <thead className="sticky top-0 bg-muted z-10">
                                    <tr style={{ width: totalWidth, display: 'flex' }} className="items-center">
                                        {headers.map(header => {
                                            const lowerHeader = header.toLowerCase();
                                            const isWrapHeader = lowerHeader.includes('first response') || lowerHeader.includes('status case 2');
                                            
                                            if (header === 'DATE') {
                                                return (
                                                    <th 
                                                        key={header} 
                                                        className="h-12 px-4 text-left font-medium text-muted-foreground flex items-center justify-center"
                                                        style={{ width: getColumnWidth(header), flexShrink: 0 }}
                                                    >
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="ghost" className="p-0 h-auto font-medium text-muted-foreground hover:bg-transparent data-[state=open]:bg-accent/20">
                                                                     {header}
                                                                     {dateRange && <CalendarIcon className="ml-2 h-4 w-4 text-primary" />}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0" align="start">
                                                                 <div className="p-2 border-b">
                                                                    <div
                                                                        className={cn(
                                                                            "w-full justify-start text-left font-normal",
                                                                            !dateRange && "text-muted-foreground"
                                                                        )}
                                                                    >
                                                                        {dateRange?.from ? (
                                                                            dateRange.to ? (
                                                                                <>
                                                                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                                                                    {format(dateRange.to, "LLL dd, y")}
                                                                                </>
                                                                            ) : (
                                                                                format(dateRange.from, "LLL dd, y")
                                                                            )
                                                                        ) : (
                                                                            <span>Pick a date range</span>
                                                                        )}
                                                                    </div>
                                                                 </div>
                                                                <Calendar
                                                                    initialFocus
                                                                    mode="range"
                                                                    defaultMonth={dateRange?.from}
                                                                    selected={dateRange}
                                                                    onSelect={setDateRange}
                                                                    numberOfMonths={2}
                                                                />
                                                                <div className="p-2 border-t flex justify-end">
                                                                    <Button
                                                                        onClick={() => setDateRange(undefined)}
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        disabled={!dateRange}
                                                                    >
                                                                        Reset
                                                                    </Button>
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </th>
                                                );
                                            }

                                            return (
                                                <th 
                                                    key={header} 
                                                    className={cn(
                                                        "h-12 px-4 text-left font-medium text-muted-foreground flex items-center justify-center",
                                                        isWrapHeader ? "whitespace-normal text-center" : "whitespace-nowrap"
                                                    )}
                                                    style={{ width: getColumnWidth(header), flexShrink: 0 }}
                                                >
                                                    {header}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody style={{ height: `${totalHeight}px`, position: 'relative' }}>
                                    {virtualRows.map((virtualRow) => {
                                        const row = filteredData[virtualRow.index];
                                        return (
                                            <tr 
                                                key={virtualRow.key}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: totalWidth,
                                                    height: `${virtualRow.size}px`,
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                    display: 'flex',
                                                }}
                                                className="border-b transition-colors hover:bg-muted/50"
                                            >
                                                {headers.map(header => (
                                                    <td key={header} className="p-4 align-middle truncate" style={{ width: getColumnWidth(header), flexShrink: 0 }}>
                                                        {row[header]}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                           </table>
                        </div>
                    </CardContent>
                    <CardFooter className="p-2 border-t text-xs text-muted-foreground">
                        Showing {filteredData.length} of {state.data?.length || 0} rows.
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

    