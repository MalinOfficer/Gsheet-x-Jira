
"use client";

import { AlertTriangle, Database, Cloud, RefreshCw, Search, Calendar as CalendarIcon, FilterX, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, X, Save } from "lucide-react";
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
import { getAllCaseData } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from "@/lib/utils";
import { useDebounce } from 'use-debounce';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
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

let FILTER_COLUMNS: string[] = [];

// New: Header mapping and visibility configuration
const headerDisplayMapping: Record<string, string> = {
    no: 'No',
    date: 'Date',
    month: 'Month',
    ticket_number: 'Ticket Number',
    client_name: 'Client',
    status: 'Status',
    ticket_category: 'Category',
    module: 'Module',
    detail_module: 'Detail Module',
    created_at: 'Check In',
    title: 'Case Title',
    checkout: 'Check Out',
    url_jira: 'Url Jira',
    status_case_2: 'Status Solved',
    note: 'Note',
};

const hiddenHeaders = [
    'id',
    'resolved_at',
    'ticket_op',
    'customer_name', // Redundant with note logic
    'pic_client', // Is now 'Note', we will hide the original
];

const categoryColorMap: Record<string, string> = {
    'Bug Fixing': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'Q & A': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    'Assistance': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'Parameter Setup': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Enhancement': 'bg-rose-600 text-white dark:bg-rose-700',
    'Adjustment': 'bg-blue-600 text-white dark:bg-blue-700',
    'default': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const statusColorMap: Record<string, string> = {
    'Solved': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'L3': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'L2': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'L1': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'PM': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    'Move to Issue Tracker': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    'default': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const ALL_CATEGORIES = [
    'Adjustment',
    'Assistance',
    'Bug Fixing',
    'Enhancement',
    'Parameter Setup',
    'Q & A',
];

const ALL_STATUSES = [
    'Solved',
    'L3',
    'L2',
    'L1',
    'PM',
    'Move to Issue Tracker',
];

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
    const [isEditMode, setIsEditMode] = useState(false);
    const [dataBeforeEdit, setDataBeforeEdit] = useState<any[] | null>(null);

    const [progress, setProgress] = useState(0);
    const { toast } = useToast();
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
    const [yearFilter, setYearFilter] = useState<string>('');
    const isInitialMount = useRef(true);
    
    // States for date popover
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
    const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined);


    // Pagination state
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setIsProcessing(isPending);
    }, [isPending, setIsProcessing]);

    const headers = useMemo(() => {
        if (!state.data || !state.data.length) return [];
        const allKeys = Object.keys(state.data[0]);
        // Filter out hidden headers
        const visibleKeys = allKeys.filter(key => !hiddenHeaders.includes(key));
        
        // Define a desired order
        const order = [
            'no', 'date', 'month', 'ticket_number', 'client_name', 
            'status', 'ticket_category', 'module', 'detail_module', 'title',
            'created_at', 'checkout', 'status_case_2', 'url_jira', 'note'
        ];

        // Sort keys based on the defined order
        visibleKeys.sort((a, b) => {
            const indexA = order.indexOf(a);
            const indexB = order.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
        
        // The filterable columns are based on frontend keys now
        FILTER_COLUMNS = ['client_name', 'status', 'ticket_category', 'module', 'detail_module', 'status_case_2'];

        return visibleKeys;
    }, [state.data]);


    const initialColumnWidths = useCallback(() => {
        const widths: Record<string, number> = {};
        headers.forEach(header => {
            const displayHeader = (headerDisplayMapping[header] || header).toLowerCase();
            
            if (displayHeader.includes('date')) {
                widths[header] = 140;
            } else if (displayHeader.includes('check in') || displayHeader.includes('check out')) {
                widths[header] = 140;
            } else if (displayHeader.includes('case title')) {
                widths[header] = 350;
            } else if (displayHeader.includes('detail module')) {
                widths[header] = 250;
            } else if (displayHeader.includes('client') || displayHeader.includes('ticket number') || displayHeader.includes('module')) {
                widths[header] = 180;
            } else if (displayHeader.includes('status solved')) {
                widths[header] = 120;
            } else if (displayHeader === 'no') {
                widths[header] = 60;
            } else {
                widths[header] = 120;
            }
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
                category: columnFilters['ticket_category'],
                client: columnFilters['client_name'],
                module: columnFilters['module'],
                status: columnFilters['status'],
                detailModule: columnFilters['detail_module'],
            });

            if (dataResult.error) {
                 setState({ data: null, source: 'N/A', error: dataResult.error });
            } else {
                 setState({
                    data: dataResult.data || null,
                    source: (dataResult.source as any) || 'N/A',
                    error: null,
                });
            }

            if (isRefresh) {
                const filterOptionsResult = await getDashboardFilterOptions();
                if (filterOptionsResult.data?.years) {
                    setFetchedYears(filterOptionsResult.data.years);
                }
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
            return;
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
        return [];
    }, [fetchedYears]);


    const filteredData = useMemo(() => {
        if (!state.data) return [];
        
        let dataToFilter = state.data;

        // Frontend search term filtering
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
    
    const handleEditClick = () => {
        setDataBeforeEdit(state.data);
        setIsEditMode(true);
    };

    const handleCancelEdit = () => {
        if (dataBeforeEdit) {
            setState(prev => ({...prev, data: dataBeforeEdit}));
        }
        setIsEditMode(false);
        setDataBeforeEdit(null);
    };

    const handleSaveChanges = () => {
        // Here you would typically call an API to save the changes.
        // For now, it just exits edit mode, keeping the local changes.
        setIsEditMode(false);
        setDataBeforeEdit(null);
        toast({
            title: "Changes Saved Locally",
            description: "Your edits are saved in this session. They are not yet persisted to the database."
        });
    };

    const handleCellChange = (id: number, header: string, value: string) => {
        setState(prevState => {
            if (!prevState.data) {
                return prevState;
            }
            const newData = prevState.data.map(row => {
                if (row.id === id) {
                    return { ...row, [header]: value };
                }
                return row;
            });
            return { ...prevState, data: newData };
        });
    };

    const renderHeaderContent = (header: string) => {
        const displayHeader = headerDisplayMapping[header] || header;
        const isFilterable = FILTER_COLUMNS.includes(header);
        const isFilterActive = columnFilters[header]?.length > 0;
        const headerStyle = "text-base font-bold text-muted-foreground";

        if (header === dateHeaderKey) {
            return (
                <Popover open={isDatePopoverOpen} onOpenChange={(open) => {
                    if (open) {
                        setTempDateRange(dateRange);
                    }
                    setIsDatePopoverOpen(open);
                }}>
                    <PopoverTrigger asChild disabled={isEditMode}>
                         <Button variant="ghost" className={cn(headerStyle, "p-0 h-auto data-[state=open]:bg-accent/20")}>
                             {displayHeader}
                             <Filter className={cn("ml-2 h-3 w-3", dateRange ? "text-primary" : "text-muted-foreground/50")} />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-3 border-b">
                            <div className="text-sm font-medium">
                                {tempDateRange?.from ? (
                                    tempDateRange.to ? (
                                        <>
                                            {format(tempDateRange.from, "LLL dd, y")} - {format(tempDateRange.to, "LLL dd, y")}
                                        </>
                                    ) : (
                                        format(tempDateRange.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span className="text-muted-foreground">Pilih rentang tanggal</span>
                                )}
                            </div>
                        </div>
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={tempDateRange?.from}
                            selected={tempDateRange}
                            onSelect={setTempDateRange}
                            numberOfMonths={2}
                        />
                        <div className="p-2 border-t flex justify-between items-center">
                            <Button
                                onClick={() => {
                                    const today = new Date();
                                    setTempDateRange({ from: today, to: today });
                                }}
                                variant="ghost"
                                size="sm"
                            >
                                Today
                            </Button>
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => setTempDateRange(undefined)}
                                    variant="ghost"
                                    size="sm"
                                >
                                    Reset
                                </Button>
                                <Button
                                    onClick={() => {
                                        setDateRange(tempDateRange);
                                        setIsDatePopoverOpen(false);
                                    }}
                                    size="sm"
                                >
                                    Apply
                                </Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            );
        }

        if (isFilterable) {
            const isCategoryFilter = header === 'ticket_category';
            const isStatusFilter = header === 'status';
            const options = isCategoryFilter ? ALL_CATEGORIES : isStatusFilter ? ALL_STATUSES : (filterOptions[header] || []);
            return(
                <Popover>
                    <PopoverTrigger asChild disabled={isEditMode}>
                        <Button variant="ghost" className={cn(headerStyle, "p-0 h-auto hover:bg-transparent data-[state=open]:bg-accent/20")}>
                             {displayHeader}
                             <Filter className={cn("ml-2 h-3 w-3", isFilterActive ? "text-primary" : "text-muted-foreground/50")} />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder={`Filter ${displayHeader}...`} />
                            <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                    {options.map(option => {
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
                                                {isCategoryFilter ? (
                                                    <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', categoryColorMap[option] || categoryColorMap.default)}>
                                                        {option}
                                                    </span>
                                                ) : isStatusFilter ? (
                                                    <span className={cn('inline-flex items-center justify-center w-[100px] px-2 py-0.5 rounded-md text-xs font-medium', statusColorMap[option] || statusColorMap.default)}>
                                                        {option}
                                                    </span>
                                                ) : (
                                                    <span>{option}</span>
                                                )}
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

        return <span className={cn(headerStyle, "truncate")}>{displayHeader}</span>;
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
                                    disabled={isEditMode}
                                />
                            </div>
                            <div className="w-full sm:w-auto">
                                <Select 
                                    value={yearFilter} 
                                    onValueChange={(value) => {
                                        setYearFilter(value === 'all' ? '' : value);
                                    }}
                                    disabled={isEditMode}
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
                                <Button onClick={handleClearAllFilters} variant="ghost" size="sm" disabled={isEditMode}>
                                <FilterX className="mr-2 h-4 w-4" />
                                Clear All Filters
                            </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                             {isEditMode ? (
                                <div className="flex items-center gap-2">
                                    <Button onClick={handleCancelEdit} size="sm" variant="destructive">
                                        <X className="mr-2 h-4 w-4" /> Cancel
                                    </Button>
                                    <Button onClick={handleSaveChanges} size="sm">
                                        <Save className="mr-2 h-4 w-4" /> Save
                                    </Button>
                                </div>
                            ) : (
                                <Button onClick={handleEditClick} size="sm" variant="outline">
                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                </Button>
                            )}

                            <Button onClick={() => fetchData(true)} size="sm" variant="outline" disabled={isPending || isRefreshing || isEditMode}>
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
                                       const isWrapHeader = false;
                                       
                                       return (
                                           <div
                                               key={header}
                                               className={cn(
                                                   "h-12 px-4 flex items-center justify-center bg-muted relative",
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
                                            const isEditable = isEditMode && !isNoColumn;
                                            const rowId = row?.id;
                                            
                                            let cellValue = row ? (isNoColumn ? rowNumber : row[header]) : null;

                                            if (row && header === dateHeaderKey && typeof cellValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(cellValue)) {
                                                try {
                                                    const date = new Date(cellValue);
                                                    const day = String(date.getUTCDate()).padStart(2, '0');
                                                    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                                                    const year = date.getUTCFullYear();
                                                    cellValue = `${day}/${month}/${year}`;
                                                } catch(e) {
                                                    // if format fails, just use original value
                                                }
                                            }

                                            const isDropdownColumn = isEditable && ['status', 'ticket_category', 'module', 'detail_module'].includes(header);
                                            
                                            return (
                                                <div 
                                                    key={header} 
                                                    className="align-middle" 
                                                    style={{ width: columnWidths[header], flexShrink: 0, borderRight: '1px solid hsl(var(--border))' }}
                                                >
                                                     {isDropdownColumn ? (
                                                        (header === 'ticket_category' || header === 'status') ? (
                                                            <Select
                                                                value={(cellValue as string) ?? ''}
                                                                onValueChange={(newValue) => {
                                                                    if (rowId !== undefined) {
                                                                        handleCellChange(rowId, header, newValue);
                                                                    }
                                                                }}
                                                                disabled={!row}
                                                            >
                                                                <SelectTrigger className="h-full w-full rounded-none border-0 bg-transparent p-0 px-4 focus:ring-0 focus:ring-offset-0 text-sm focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary">
                                                                    {cellValue ? (
                                                                        <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', header === 'status' && 'inline-flex items-center justify-center w-[100px]', header === 'ticket_category' ? (categoryColorMap[cellValue as string] || categoryColorMap.default) : (statusColorMap[cellValue as string] || statusColorMap.default))}>
                                                                            {cellValue}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">Select...</span>
                                                                    )}
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {(header === 'ticket_category' ? ALL_CATEGORIES : ALL_STATUSES).map(option => (
                                                                        <SelectItem key={option} value={option}>
                                                                            <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', header === 'ticket_category' ? (categoryColorMap[option] || categoryColorMap.default) : (statusColorMap[option] || statusColorMap.default))}>
                                                                                {option}
                                                                            </span>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <Select
                                                                value={(cellValue as string) ?? ''}
                                                                onValueChange={(newValue) => {
                                                                    if (rowId !== undefined) {
                                                                        handleCellChange(rowId, header, newValue);
                                                                    }
                                                                }}
                                                                disabled={!row}
                                                            >
                                                                <SelectTrigger className="h-full w-full rounded-none border-0 bg-transparent p-0 px-4 focus:ring-0 focus:ring-offset-0 text-sm focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary">
                                                                    <SelectValue placeholder="Select..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {(filterOptions[header] || []).map(option => (
                                                                        <SelectItem key={option} value={option}>
                                                                            {option}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )
                                                     ) : isEditable ? (
                                                        <Input
                                                            type="text"
                                                            value={cellValue ?? ''}
                                                            onChange={(e) => rowId !== undefined && handleCellChange(rowId, header, e.target.value)}
                                                            className="h-full w-full rounded-none border-0 bg-transparent p-4 text-sm focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary disabled:bg-transparent"
                                                            disabled={!row}
                                                        />
                                                    ) : (
                                                        <div className="p-4 flex items-center text-sm">
                                                            {row ? (
                                                                (header === 'ticket_category' && cellValue) ? (
                                                                    <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', categoryColorMap[cellValue as string] || categoryColorMap.default)}>
                                                                        {cellValue}
                                                                    </span>
                                                                ) : (header === 'status' && cellValue) ? (
                                                                    <span className={cn('inline-flex items-center justify-center w-[100px] px-2 py-0.5 rounded-md text-xs font-medium', statusColorMap[cellValue as string] || statusColorMap.default)}>
                                                                        {cellValue}
                                                                    </span>
                                                                ) : (
                                                                    <span className="truncate">{cellValue}</span>
                                                                )
                                                            ) : (
                                                                <Skeleton className="h-4 w-full" />
                                                            )}
                                                        </div>
                                                    )}
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
