"use client";

import { AlertTriangle, Database, Cloud, RefreshCw, Search, Calendar as CalendarIcon, FilterX, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
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
import { TableDataContext } from "@/store/table-data-context";
import { getAllCaseData, getDashboardFilterOptions } from "@/app/actions";
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


interface DbViewerProps {
    initialData: any[] | null;
    initialSource: 'cache' | 'sheet' | 'N/A' | 'supabase';
    initialError?: string | null;
    availableYears?: string[];
}

interface DbViewerState {
    data: any[] | null;
    source: 'cache' | 'sheet' | 'N/A' | 'supabase';
    error?: string | null;
}

const extractYearFromDate = (dateStr: string): string | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    const trimmed = dateStr.trim();
    
    // Format: YYYY-MM-DD
    if (trimmed.length >= 4) {
        const firstFour = trimmed.substring(0, 4);
        if (/^\d{4}$/.test(firstFour)) {
            const year = parseInt(firstFour, 10);
            if (year >= 2000 && year <= 2100) {
                return firstFour;
            }
        }
    }
    
    // Format: DD/MM/YYYY or other formats with year at the end
    const match = trimmed.match(/\b(20\d{2})\b/);
    if (match) {
        return match[1];
    }
    
    return null;
};

let FILTER_COLUMNS: string[] = [];

export function DbViewer({ 
    initialData, 
    initialSource, 
    initialError,
    availableYears = []
}: DbViewerProps) {
    const { dbSheetUrl } = useContext(SettingsContext);
    const { setIsProcessing } = useContext(TableDataContext);
    const [state, setState] = useState<DbViewerState>({
        data: initialData,
        source: initialSource,
        error: initialError,
    });
    const [isPending, startTransition] = useTransition();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [fetchedYears, setFetchedYears] = useState<string[]>(availableYears);

    const [progress, setProgress] = useState(0);
    const { toast } = useToast();
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
    const [yearFilter, setYearFilter] = useState<string>('');
    const isInitialMount = useRef(true);

    // Pagination state
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setIsProcessing(isPending);
    }, [isPending, setIsProcessing]);

    const headers = useMemo(() => {
        if (!state.data || !state.data.length) return [];
        const firstRowKeys = Object.keys(state.data[0]).filter(key => key.toLowerCase() !== 'id');

        const potentialFilterCols = ['client name', 'client_name', 'status case', 'status_case', 'kategori', 'category', 'module', 'detail modul', 'detail_module', 'status case 2', 'status_case_2', 'category_case', 'module_case'];
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
                [isResizing.current as string]: Math.max(50, currentWidth)
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
            if (isRefresh) {
                setIsRefreshing(true);
                setProgress(0);
            }
            
            const dataResult = await getAllCaseData({
                year: yearFilter || undefined,
                dateRange: dateRange,
                category: columnFilters['category_case']?.[0],
                client: columnFilters['client_name']?.[0],
                module: columnFilters['module_case']?.[0],
            });

            const filterOptionsResult = await getDashboardFilterOptions();

            setState({
                data: dataResult.data || null,
                source: (dataResult.source as any) || 'N/A',
                error: dataResult.error,
            });

            if (filterOptionsResult.data?.years) {
                setFetchedYears(filterOptionsResult.data.years);
            }

            if (isRefresh) {
                setProgress(100);
                if (dataResult.error) {
                    toast({ variant: 'destructive', title: "Refresh Failed", description: dataResult.error });
                } else {
                    toast({ title: "Data Refreshed", description: `Data loaded from ${dataResult.source}.` });
                }
                setIsRefreshing(false);
            }
        });
    }, [yearFilter, dateRange, columnFilters, toast]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            if (state.data && state.data.length > 0) {
                 return;
            }
        }
        fetchData();
    }, [yearFilter, dateRange, columnFilters, fetchData]);
    
    useEffect(() => {
        let timer: NodeJS.Timeout | undefined;
        if (isPending && !isRefreshing) {
             setIsProcessing(true);
             setProgress(0);
             timer = setInterval(() => {
                 setProgress(oldProgress => {
                     if (oldProgress >= 95) {
                         clearInterval(timer);
                         return oldProgress;
                     }
                     return Math.min(oldProgress + 2, 95);
                 });
             }, 80);
        } else {
            setIsProcessing(false);
            setProgress(100);
        }
    
        return () => {
            if (timer) clearInterval(timer);
            setIsProcessing(false);
        };
    }, [isPending, isRefreshing, setIsProcessing]);
    
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
        if (fetchedYears.length > 0) {
            return fetchedYears.sort((a, b) => b.localeCompare(a));
        }
        
        if (!state.data) return [];
        const years = new Set<string>();
        const dateColumns = headers.filter(h => 
            h.toLowerCase().includes('date') || 
            h.toLowerCase().includes('tanggal')
        );
        
        state.data.forEach(row => {
            dateColumns.forEach(col => {
                const year = extractYearFromDate(String(row[col]));
                if (year) years.add(year);
            });
        });
        
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [fetchedYears, state.data, headers]);


    const filteredData = useMemo(() => {
        if (!state.data) return [];
        
        let dataToFilter = state.data;

        // Year, date range, and column filters are now handled by backend.
        // Only the general search term is filtered on the client for responsiveness.
        if (debouncedSearchTerm) {
            const lowercasedQuery = debouncedSearchTerm.toLowerCase();
            dataToFilter = dataToFilter.filter(row => {
                return Object.values(row).some(value =>
                    String(value).toLowerCase().includes(lowercasedQuery)
                );
            });
        }

        return dataToFilter;
    }, [state.data, debouncedSearchTerm]);

    // Reset page to 1 when any filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, dateRange, columnFilters, yearFilter, pageSize]);
    
    // Calculate total pages
    const totalPages = useMemo(() => {
        if (!filteredData || pageSize === 0) return 1;
        const pages = Math.ceil(filteredData.length / pageSize);
        return pages > 0 ? pages : 1;
    }, [filteredData, pageSize]);
    
    // Get data for the current page
    const paginatedData = useMemo(() => {
        if (!filteredData) return [];
        const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
        if (pageSize === 0) return filteredData;
        const startIndex = (validCurrentPage - 1) * pageSize;
        return filteredData.slice(startIndex, startIndex + pageSize);
    }, [filteredData, currentPage, pageSize, totalPages]);
    
    const displayData = useMemo(() => {
        if (isPending && !state.data) {
             const skeletonRowCount = pageSize === 0 ? 20 : pageSize;
            return Array.from({ length: skeletonRowCount }, () => ({}));
        }
        return paginatedData;
    }, [isPending, state.data, paginatedData, pageSize]);
    
    const rowVirtualizer = useVirtualizer({
        count: displayData.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 49,
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


    if (state.error && !isPending) {
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
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
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
                            <Button onClick={() => fetchData(true)} size="sm" variant="outline" disabled={isPending || isRefreshing}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Badge variant={state.source === 'supabase' ? 'default' : 'secondary'} className="w-fit">
                                {state.source === 'supabase' ? <Database className="mr-2 h-4 w-4"/> : <Cloud className="mr-2 h-4 w-4"/>}
                                Data source: {state.source}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                     {(isPending && !isRefreshing) && (
                         <div className="px-4 pb-2 space-y-1">
                            <div className='flex items-center gap-2'>
                                <Progress value={progress} className="w-full" />
                                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{Math.round(progress)}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Loading data...</p>
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
                                   const rowNumber = pageSize === 0 
                                     ? virtualRow.index + 1 
                                     : (currentPage - 1) * pageSize + virtualRow.index + 1;
                                   
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
                                         {headers.map(header => {
                                            const isNoColumn = header.toLowerCase() === 'no';
                                            return (
                                                <div 
                                                    key={header} 
                                                    className="p-4 align-middle truncate" 
                                                    style={{ width: columnWidths[header], flexShrink: 0, borderRight: '1px solid hsl(var(--border))' }}
                                                >
                                                    {row ? (isNoColumn ? rowNumber : row[header]) : <Skeleton className="h-4 w-full" />}
                                                </div>
                                            );
                                         })}
                                       </div>
                                   );
                               })}
                           </div>
                       )}
                    </div>
                </CardContent>
                <CardFooter className="p-3 border-t text-xs text-muted-foreground">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex-1 text-sm text-muted-foreground">
                            {filteredData.length} row(s) total.
                        </div>

                        <div className="flex items-center space-x-6 lg:space-x-8">
                            <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium">Rows per page</p>
                                <Select
                                    value={`${pageSize}`}
                                    onValueChange={(value) => {
                                        setPageSize(Number(value));
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-[70px]">
                                        <SelectValue placeholder={`${pageSize}`} />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        {[50, 100, 250, 500].map((size) => (
                                            <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
