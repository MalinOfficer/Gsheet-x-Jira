
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
import { useEffect, useState, useRef, useMemo, useCallback, useContext, MouseEvent, useTransition } from "react";
import { SettingsContext } from "@/contexts/settings-provider";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";


interface DbViewerState {
    data: any[] | null;
    source: 'cache' | 'sheet' | 'N/A';
    error?: string;
}

// Helper to parse DD/MM/YYYY strings into Date objects
const parseDate = (dateStr: string): Date | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    // Handle ISO 8601 format from Supabase (e.g., "2024-07-29T17:00:00+00:00")
    if (dateStr.includes('T')) {
        try {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) return parsed;
        } catch (e) { /* ignore and fallback */ }
    }

    // Handle DD/MM/YYYY format from GSheets
    try {
        const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
        if (!isNaN(parsed.getTime())) return parsed;
    } catch (e) { /* ignore and fallback */ }

    return null;
};

let FILTER_COLUMNS: string[] = [];

export function DbViewer() {
    const { dbSheetUrl } = useContext(SettingsContext);
    const [state, setState] = useState<DbViewerState>({
        data: null,
        source: 'N/A',
        error: undefined,
    });
    const [isPending, startTransition] = useTransition();

    const [progress, setProgress] = useState(0);
    const { toast } = useToast();
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
    const [yearFilter, setYearFilter] = useState<string>('');

    const headers = useMemo(() => {
        if (!state.data || !state.data.length) return [];
        // Dynamically create headers from the first row of data
        const firstRowKeys = Object.keys(state.data[0]);

        // Find potential dynamic filter columns
        const potentialFilterCols = ['client name', 'client_name', 'status case', 'status_case', 'kategori', 'category', 'module', 'detail modul', 'detail_module', 'status case 2', 'status_case_2'];
        FILTER_COLUMNS = firstRowKeys.filter(h => potentialFilterCols.includes(h.toLowerCase()));

        return firstRowKeys;
    }, [state.data]);


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

    const dateHeaderKey = useMemo(() => headers.find(h => h.toLowerCase() === 'date'), [headers]);
    
    const fetchData = useCallback(async (isRefresh = false) => {
        startTransition(async () => {
            if (!dbSheetUrl) {
                setState({ data: null, source: 'N/A', error: 'DB GSheet URL is not configured in Settings.' });
                return;
            }

            if (isRefresh) {
                setProgress(0);
            }
            
            const result = await getAllCaseData(dbSheetUrl);

            setState({
                data: result.data || null,
                source: result.source || 'N/A',
                error: result.error,
            });

            if (isRefresh) {
                setProgress(100);
                if (result.error) {
                    toast({ variant: 'destructive', title: "Refresh Failed", description: result.error });
                } else {
                    toast({ title: "Data Refreshed", description: `Data loaded from ${result.source}.` });
                }
            }
        });
    }, [dbSheetUrl, toast]);
    
    useEffect(() => {
        fetchData(false);
    }, [fetchData]);

    useEffect(() => {
        let timer: NodeJS.Timeout | undefined;
        if (isPending) {
             setProgress(0);
             // Start a smoother animation
             timer = setInterval(() => {
                 setProgress(oldProgress => {
                     if (oldProgress >= 95) {
                         clearInterval(timer);
                         return oldProgress;
                     }
                     // Use a smaller increment for a smoother feel
                     return Math.min(oldProgress + 2, 95);
                 });
             }, 80);
        } else {
            // When loading finishes, jump to 100%
            setProgress(100);
        }
    
        return () => {
            if (timer) {
                clearInterval(timer);
            }
        };
    }, [isPending]);
    
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

    const yearOptions = useMemo(() => {
        if (!state.data || !dateHeaderKey) return [];
        const years = new Set<string>();
        state.data.forEach(row => {
            const dateValue = row[dateHeaderKey];
            const dateObj = parseDate(dateValue);
            if(dateObj) {
                years.add(dateObj.getFullYear().toString());
            }
        });
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [state.data, dateHeaderKey]);


    const filteredData = useMemo(() => {
        if (!state.data) return [];
        
        let dataToFilter = state.data;

        // 1. Date range filter
        if (dateRange?.from && dateHeaderKey) {
             dataToFilter = dataToFilter.filter(row => {
                const dateValue = row[dateHeaderKey];
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

        // 4. Year filter
        if (yearFilter && dateHeaderKey) {
            dataToFilter = dataToFilter.filter(row => {
                const dateValue = row[dateHeaderKey];
                const dateObj = parseDate(dateValue);
                return dateObj && dateObj.getFullYear().toString() === yearFilter;
            });
        }

        return dataToFilter;
    }, [state.data, debouncedSearchTerm, dateRange, columnFilters, yearFilter, dateHeaderKey]);
    
    
    const displayData = useMemo(() => {
        if (isPending && !state.data) {
            return Array.from({ length: 10 }, () => ({}));
        }
        return filteredData;
    }, [isPending, state.data, filteredData]);
    
    
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
        setYearFilter('');
        toast({ title: "Filters Cleared", description: "All search, date, and column filters have been reset." });
    };

    const areFiltersActive = useMemo(() => {
        return searchTerm || dateRange || yearFilter || Object.values(columnFilters).some(f => f.length > 0);
    }, [searchTerm, dateRange, yearFilter, columnFilters]);


    if (state.error) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                        <CardTitle>Failed to Load "All Case" Data</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">
                            {state.error}
                        </CardDescription>
                         <Button onClick={() => fetchData(true)} disabled={isPending}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
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

        if (header === dateHeaderKey) {
            return (
                <Popover>
                    <PopoverTrigger asChild>
                         <Button variant="ghost" className="p-0 h-auto font-medium text-muted-foreground data-[state=open]:bg-accent/20">
                             {header}
                             <Filter className={cn("ml-2 h-3 w-3", dateRange ? "text-primary" : "text-muted-foreground/50")} />
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
        <div className="flex-1 bg-background text-foreground px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3 md:px-8 md:pb-8 md:pt-4">
            <Card>
                 <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
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
                            <div className="w-full sm:w-auto">
                                <Select 
                                    value={yearFilter} 
                                    onValueChange={(value) => {
                                        setYearFilter(value === 'all' ? '' : value);
                                    }}
                                >
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="Filter by year..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Years</SelectItem>
                                        {yearOptions.map(year => (
                                            <SelectItem key={year} value={year}>{year}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {areFiltersActive && (
                                <Button onClick={handleClearAllFilters} variant="ghost" size="sm">
                                <FilterX className="mr-2 h-4 w-4" />
                                Clear All Filters
                            </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button onClick={() => fetchData(true)} size="sm" variant="outline" disabled={isPending}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Badge variant={state.source === 'cache' ? 'default' : 'secondary'} className="w-fit">
                                {state.source === 'cache' ? <Database className="mr-2 h-4 w-4"/> : <Cloud className="mr-2 h-4 w-4"/>}
                                Data source: {state.source}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                     {isPending && (
                         <div className="px-4 pb-2 space-y-1">
                            <div className='flex items-center gap-2'>
                                <Progress value={progress} className="w-full" />
                                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{Math.round(progress)}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Syncing latest data...</p>
                        </div>
                     )}
                    <div ref={tableContainerRef} className="overflow-auto h-[75vh] border-t rounded-b-md">
                       {(!state.data || state.data.length === 0) && !isPending ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center text-muted-foreground">
                                    <Database className="mx-auto h-12 w-12 mb-2" />
                                    <p>No data found.</p>
                                </div>
                            </div>
                        ) : (
                           <div style={{ height: `${totalHeight}px`, width: `${totalWidth}px`, position: 'relative' }}>
                               <div
                                   className="sticky top-0 z-10 flex"
                               >
                                   {headers.map(header => {
                                       const lowerHeader = header.toLowerCase();
                                       const isWrapHeader = lowerHeader.includes('first response') || lowerHeader.includes('status case 2');
                                       
                                       return (
                                           <div
                                               key={header}
                                               className={cn(
                                                   "h-12 px-4 text-left font-medium text-muted-foreground flex items-center justify-start bg-muted relative",
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
                                   
                                   return (
                                       <div
                                           key={virtualRow.key}
                                           style={{
                                               position: 'absolute',
                                               top: 0,
                                               left: 0,
                                               width: '100%',
                                               height: `${virtualRow.size}px`,
                                               transform: `translateY(${virtualRow.start + 48}px)`,
                                           }}
                                           className="flex border-b transition-colors hover:bg-muted/50"
                                       >
                                         {headers.map(header => (
                                            <div 
                                                key={header} 
                                                className="p-4 align-middle truncate" 
                                                style={{ width: columnWidths[header], flexShrink: 0, borderRight: '1px solid hsl(var(--border))' }}
                                            >
                                                {row ? row[header] : <Skeleton className="h-4 w-full" />}
                                            </div>
                                         ))}
                                       </div>
                                   );
                               })}
                           </div>
                       )}
                    </div>
                </CardContent>
                <CardFooter className="p-2 border-t text-xs text-muted-foreground">
                    {isPending ? 'Loading...' : `Showing ${displayData.length} of ${state.data?.length || 0} rows.`}
                </CardFooter>
            </Card>
        </div>
    );
}
