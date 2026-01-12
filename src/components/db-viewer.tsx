
"use client";

import { AlertTriangle, Database, Cloud, RefreshCw, Search, Calendar as CalendarIcon, FilterX, Filter } from "lucide-react";
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
import { useEffect, useState, useRef, useMemo, useTransition, useCallback, useContext, MouseEvent } from "react";
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Check } from 'lucide-react';
import { Skeleton } from "./ui/skeleton";
import { Progress } from "./ui/progress";


interface DbViewerState {
    data: any[] | null;
    source: 'cache' | 'sheet' | 'N/A';
    error?: string;
    loading: boolean;
    isSyncing: boolean;
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

const FILTER_COLUMNS = [
    'CLIENT NAME',
    'STATUS CASE',
    'KATEGORI',
    'MODULE',
    'DETAIL MODUL',
    'STATUS CASE 2',
];


export function DbViewer() {
    const { dbSheetUrl } = useContext(TableDataContext);
    const [state, setState] = useState<DbViewerState>({
        data: null,
        source: 'N/A',
        error: undefined,
        loading: true,
        isSyncing: false,
    });
    const [progress, setProgress] = useState(0);
    const { toast } = useToast();
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
    const [isPending, startTransition] = useTransition();

    const headers = useMemo(() => state.data?.length ? Object.keys(state.data[0]) : [], [state.data]);

    const initialColumnWidths = useCallback(() => {
        const widths: Record<string, number> = {};
        headers.forEach(header => {
            const lowerHeader = header.toLowerCase();
            if (lowerHeader.includes('detail case') || lowerHeader.includes('penanganan case')) widths[header] = 350;
            else if (lowerHeader.includes('detail modul')) widths[header] = 250;
            else if (lowerHeader.includes('client') || lowerHeader.includes('customer name') || lowerHeader.includes('ticket number') || lowerHeader.includes('module')) widths[header] = 180;
            else if (lowerHeader.includes('status case 2')) widths[header] = 120;
            else if (lowerHeader === 'no') widths[header] = 60;
            else widths[header] = 120;
        });
        return widths;
    }, [headers]);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

    useEffect(() => {
        if (headers.length > 0) {
            setColumnWidths(initialColumnWidths());
        }
    }, [headers, initialColumnWidths]);


    const isResizing = useRef<string | null>(null);
    const startX = useRef(0);
    const startWidth = useRef(0);
    
    const handleResizeMouseDown = useCallback((header: string, e: MouseEvent) => {
        isResizing.current = header;
        startX.current = e.clientX;
        startWidth.current = columnWidths[header];
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handleMouseMove = (event: globalThis.MouseEvent) => {
            if (!isResizing.current) return;
            const currentWidth = startWidth.current + event.clientX - startX.current;
            setColumnWidths(prev => ({
                ...prev,
                [isResizing.current as string]: Math.max(50, currentWidth) // Minimum width 50px
            }));
        };

        const handleMouseUp = () => {
            isResizing.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [columnWidths]);

    const totalWidth = useMemo(() => Object.values(columnWidths).reduce((acc, width) => acc + width, 0), [columnWidths]);


     const filterOptions = useMemo(() => {
        if (!state.data) return {};
        const options: Record<string, string[]> = {};
        FILTER_COLUMNS.forEach(col => {
            const uniqueValues = [...new Set(state.data?.map(row => row[col]).filter(Boolean))];
            uniqueValues.sort((a, b) => a.localeCompare(b));
            options[col] = uniqueValues;
        });
        return options;
    }, [state.data]);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!dbSheetUrl) {
            setState({ data: null, source: 'N/A', error: 'DB GSheet URL is not configured in Settings.', loading: false, isSyncing: false });
            return;
        }

        if (isRefresh) {
            setState(prevState => ({ ...prevState, isSyncing: true }));
            setProgress(0);
        } else {
            setState(prevState => ({ ...prevState, loading: true }));
        }

        const result = await getAllCaseData(dbSheetUrl);

        startTransition(() => {
            setState({
                data: result.data || null,
                source: result.source || 'N/A',
                error: result.error,
                loading: false,
                isSyncing: false,
            });
            setProgress(100);
        });

        if (isRefresh) {
            if (result.error) {
                 toast({ variant: 'destructive', title: "Refresh Failed", description: result.error });
            } else {
                 toast({ title: "Data Refreshed", description: `Data loaded from ${result.source}.` });
            }
        }
    }, [dbSheetUrl, toast]);
    
    useEffect(() => {
        fetchData(false);
    }, [fetchData]);

    useEffect(() => {
        if (state.isSyncing) {
            const timer = setInterval(() => {
                setProgress(oldProgress => {
                    if (oldProgress >= 95) {
                        clearInterval(timer);
                        return oldProgress;
                    }
                    return Math.min(oldProgress + 5, 95);
                });
            }, 200);

            return () => {
                clearInterval(timer);
            };
        }
    }, [state.isSyncing]);

    const filteredData = useMemo(() => {
        if (!state.data) return [];
        
        let dataToFilter = state.data;

        // 1. Date range filter
        if (dateRange?.from) {
             dataToFilter = dataToFilter.filter(row => {
                const dateValue = row['DATE'];
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

        // 2. General search term filter
        if (debouncedSearchTerm) {
            const lowercasedQuery = debouncedSearchTerm.toLowerCase();
            dataToFilter = dataToFilter.filter(row => {
                return Object.values(row).some(value =>
                    String(value).toLowerCase().includes(lowercasedQuery)
                );
            });
        }
        
        // 3. Column-specific multi-select filters
        const activeColumnFilters = Object.entries(columnFilters).filter(([, values]) => values.length > 0);
        if (activeColumnFilters.length > 0) {
            dataToFilter = dataToFilter.filter(row => {
                return activeColumnFilters.every(([column, selectedValues]) => {
                    const cellValue = row[column];
                    return cellValue && selectedValues.includes(cellValue);
                });
            });
        }

        return dataToFilter;
    }, [state.data, debouncedSearchTerm, dateRange, columnFilters]);
    
    
    const displayData = useMemo(() => {
        if (state.loading && !state.data) {
            return Array.from({ length: 10 }, () => ({}));
        }
        return filteredData;
    }, [state.loading, state.data, filteredData]);
    
    
    const rowVirtualizer = useVirtualizer({
        count: displayData.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 49, // h-12 (48px) + 1px border
        overscan: 5,
    });
    
    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalHeight = rowVirtualizer.getTotalSize();

    const handleClearAllFilters = () => {
        setSearchTerm('');
        setDateRange(undefined);
        setColumnFilters({});
        toast({ title: "Filters Cleared", description: "All search, date, and column filters have been reset." });
    };

    const areFiltersActive = useMemo(() => {
        return searchTerm || dateRange || Object.values(columnFilters).some(f => f.length > 0);
    }, [searchTerm, dateRange, columnFilters]);


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
                         <Button onClick={() => fetchData(true)} disabled={state.isSyncing}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${state.isSyncing ? 'animate-spin' : ''}`} />
                            Try Again
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }
    
    const renderHeaderContent = (header: string) => {
        const isFilterable = FILTER_COLUMNS.includes(header);
        const isFilterActive = columnFilters[header]?.length > 0;

        if (header === 'DATE') {
            return (
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
            );
        }

        if (isFilterable) {
            return(
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" className="p-0 h-auto font-medium text-muted-foreground hover:bg-transparent data-[state=open]:bg-accent/20">
                             {header}
                             <Filter className={cn("ml-2 h-3 w-3", isFilterActive ? "text-primary" : "text-muted-foreground/50")} />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder={`Filter ${header}...`} />
                            <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                    {(filterOptions[header] || []).map(option => {
                                        const isSelected = columnFilters[header]?.includes(option);
                                        return (
                                             <CommandItem
                                                key={option}
                                                onSelect={() => {
                                                     const currentFilters = columnFilters[header] || [];
                                                     const newFilters = isSelected
                                                         ? currentFilters.filter(item => item !== option)
                                                         : [...currentFilters, option];
                                                     setColumnFilters(prev => ({ ...prev, [header]: newFilters }));
                                                }}
                                            >
                                                <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                                    <Check className={cn("h-4 w-4")} />
                                                </div>
                                                <span>{option}</span>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </CommandList>
                            {isFilterActive && (
                                 <div className="p-1 border-t">
                                    <Button 
                                        className="w-full justify-center" 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setColumnFilters(prev => ({...prev, [header]: []}))}
                                    >
                                        Clear filter
                                    </Button>
                                 </div>
                            )}
                        </Command>
                    </PopoverContent>
                </Popover>
            );
        }

        return <span className="truncate">{header}</span>;
    }

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4">
                 <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">All Case Database</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                          Menampilkan semua data dari Google Sheet "All Case".
                        </p>
                    </div>
                     <div className="flex items-center gap-2">
                         <Button onClick={() => fetchData(true)} size="sm" variant="outline" disabled={state.isSyncing || state.loading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${state.isSyncing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Badge variant={state.source === 'cache' ? 'default' : 'secondary'} className="w-fit">
                            {state.source === 'cache' ? <Database className="mr-2 h-4 w-4"/> : <Cloud className="mr-2 h-4 w-4"/>}
                            Data source: {state.source}
                        </Badge>
                    </div>
                </header>
                
                <Card>
                     <CardHeader>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search all data..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8 sm:w-[300px]"
                                />
                            </div>
                            {areFiltersActive && (
                                    <Button onClick={handleClearAllFilters} variant="ghost" size="sm">
                                    <FilterX className="mr-2 h-4 w-4" />
                                    Clear All Filters
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                         {(state.isSyncing || isPending) && (
                             <div className="px-4 pb-2 space-y-1">
                                <div className='flex items-center gap-2'>
                                    <Progress value={progress} className="w-full" />
                                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{Math.round(progress)}%</span>
                                </div>
                                <p className="text-xs text-muted-foreground">Syncing latest data from Google Sheets...</p>
                            </div>
                         )}
                        <div ref={tableContainerRef} className="overflow-auto h-[65vh] border-t rounded-b-md">
                           {(!state.data || state.data.length === 0) && !state.loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center text-muted-foreground">
                                        <Database className="mx-auto h-12 w-12 mb-2" />
                                        <p>No data found.</p>
                                    </div>
                                </div>
                            ) : (
                               <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                                   <div
                                       className="sticky top-0 z-10 flex"
                                       style={{ width: totalWidth }}
                                   >
                                       {headers.map(header => {
                                           const lowerHeader = header.toLowerCase();
                                           const isWrapHeader = lowerHeader.includes('first response') || lowerHeader.includes('status case 2');
                                           
                                           return (
                                               <div
                                                   key={header}
                                                   className={cn(
                                                       "h-12 px-4 text-left font-medium text-muted-foreground flex items-center justify-center bg-muted relative",
                                                       isWrapHeader ? "whitespace-normal text-center" : "whitespace-nowrap"
                                                   )}
                                                   style={{ width: columnWidths[header], flexShrink: 0, borderBottom: '1px solid hsl(var(--border))', borderRight: '1px solid hsl(var(--border))' }}
                                               >
                                                  {renderHeaderContent(header)}
                                                  <div
                                                    onMouseDown={(e) => handleResizeMouseDown(header, e)}
                                                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-20"
                                                  />
                                               </div>
                                           );
                                       })}
                                   </div>
                                   {virtualRows.map((virtualRow) => {
                                       const row = displayData[virtualRow.index];
                                       let currentOffset = 0;
                                       const cells = headers.map(header => {
                                           const width = columnWidths[header] || 120;
                                           const cell = (
                                                <div key={header} className="p-4 align-middle truncate" style={{ width, position: 'absolute', left: currentOffset, borderRight: '1px solid hsl(var(--border))' }}>
                                                    {row ? row[header] : <Skeleton className="h-4 w-full" />}
                                                </div>
                                           );
                                           currentOffset += width;
                                           return cell;
                                       });

                                       return (
                                           <div
                                               key={virtualRow.key}
                                               style={{
                                                   position: 'absolute',
                                                   top: 0,
                                                   left: 0,
                                                   width: totalWidth,
                                                   height: `${virtualRow.size}px`,
                                                   transform: `translateY(${virtualRow.start + 48}px)`,
                                               }}
                                               className="border-b transition-colors hover:bg-muted/50"
                                           >
                                             {cells}
                                           </div>
                                       );
                                   })}
                               </div>
                           )}
                        </div>
                    </CardContent>
                    <CardFooter className="p-2 border-t text-xs text-muted-foreground">
                        {state.loading ? 'Loading...' : `Showing ${displayData.length} of ${state.data?.length || 0} rows.`}
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

