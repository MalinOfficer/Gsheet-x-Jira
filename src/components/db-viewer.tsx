

"use client";

import { AlertTriangle, Database, Cloud, RefreshCw, Search, Calendar as CalendarIcon, FilterX, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, X, Save, Copy, Check } from "lucide-react";
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
import { getAllCaseData, updateCase } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useDebounce } from 'use-debounce';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { DateRange } from "react-day-picker"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Skeleton } from "./ui/skeleton";
import { Progress } from "./ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";


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

// Header mapping and visibility configuration
const headerDisplayMapping: Record<string, string> = {
    no: 'No',
    date: 'Date',
    month: 'Month',
    ticket_number: 'Ticket Number',
    client_name: 'Client Name',
    customer_name: 'Customer Name',
    status: 'Status',
    ticket_category: 'Ticket Category',
    module: 'Module',
    detail_module: 'Detail Module',
    created_at: 'Created At',
    title: 'Title',
    resolved_at: 'Resolved At',
    ticket_op: 'Ticket OP',
    status_case_2: 'Status Solved',
    note: 'Note',
};

const hiddenHeaders = [
    'id',
    'url_jira',
    'pic_client',
    'checkout',
    'ticket_number'
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
    const { setIsProcessing } = useContext(TableDataContext);
    const [state, setState] = useState<DbViewerState>({
        data: initialData,
        source: initialSource,
        error: initialError,
    });
    const [isPending, startTransition] = useTransition();
    const [isSaving, startSaving] = useTransition();
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

    // Pagination state - SERVER-SIDE
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        setIsProcessing(isPending || isSaving);
    }, [isPending, isSaving, setIsProcessing]);

    const headers = useMemo(() => {
        if (!state.data || !state.data.length) return [];
        const allKeys = Object.keys(state.data[0]);
        const visibleKeys = allKeys.filter(key => !hiddenHeaders.includes(key));
        
        const order = [
            'date',
            'month',
            'ticket_number',
            'title',
            'client_name',
            'customer_name',
            'status',
            'ticket_category',
            'module',
            'detail_module',
            'created_at',
            'resolved_at',
            'status_case_2',
            'ticket_op',
            'note'
        ];

        visibleKeys.sort((a, b) => {
            const indexA = order.indexOf(a);
            const indexB = order.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
        
        FILTER_COLUMNS = ['client_name', 'status', 'ticket_category', 'module', 'detail_module', 'status_case_2'];

        return ['no', ...visibleKeys];
    }, [state.data]);

    const initialColumnWidths = useCallback(() => {
        const widths: Record<string, number> = {
            no: 60,
            date: 120,
            month: 90,
            title: 350,
            client_name: 180,
            customer_name: 180,
            status: 140,
            ticket_category: 160,
            module: 150,
            detail_module: 200,
            created_at: 150,
            resolved_at: 150,
            status_case_2: 130, // Status Solved
            ticket_op: 150,
            note: 250,
        };
        
        // Add any missing headers with a default value
        headers.forEach(header => {
            if (!widths[header]) {
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
                search: debouncedSearchTerm || undefined,
                page: currentPage,
                pageSize: pageSize,
            });

            if (dataResult.error) {
                setState({ data: null, source: 'N/A', error: dataResult.error });
                setTotalRows(0);
                setTotalPages(0);
            } else {
                setState({
                    data: dataResult.data || null,
                    source: (dataResult.source as any) || 'N/A',
                    error: null,
                });
                
                if (dataResult.pagination) {
                    setTotalRows(dataResult.pagination.total);
                    setTotalPages(dataResult.pagination.totalPages);
                }
            }

            if (isRefresh) {
                setProgress(100);
                if (dataResult.error) {
                    toast({ variant: 'destructive', title: "Refresh Failed", description: dataResult.error });
                } else {
                    toast({ 
                        title: "Data Refreshed", 
                        description: `Loaded page ${currentPage} of ${totalPages || 1}` 
                    });
                }
                setIsRefreshing(false);
            }
        });
    }, [yearFilter, dateRange, columnFilters, debouncedSearchTerm, currentPage, pageSize, toast]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            if (initialData) {
                setTotalRows(initialData.length);
                setTotalPages(Math.ceil(initialData.length / pageSize));
            }
            return;
        }
        fetchData();
    }, [yearFilter, dateRange, columnFilters, debouncedSearchTerm, currentPage, pageSize, fetchData]);
    
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

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, dateRange, columnFilters, yearFilter]);
    
    const displayData = useMemo(() => {
        return state.data || [];
    }, [state.data]);

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
        setDataBeforeEdit(JSON.parse(JSON.stringify(state.data))); // Deep copy
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
        startSaving(async () => {
            if (!dataBeforeEdit || !state.data) return;

            const modifiedRows = state.data.filter(currentRow => {
                const originalRow = dataBeforeEdit.find(o => o.id === currentRow.id);
                if (!originalRow) return false;
                return JSON.stringify(currentRow) !== JSON.stringify(originalRow);
            });

            if (modifiedRows.length === 0) {
                toast({ title: "No Changes Detected", description: "You haven't made any changes to save." });
                setIsEditMode(false);
                return;
            }

            toast({ title: "Saving...", description: `Updating ${modifiedRows.length} rows.` });

            const updatePromises = modifiedRows.map(row => updateCase(row.id, row));
            const results = await Promise.all(updatePromises);
            
            const failedUpdates = results.filter(r => !r.success);

            if (failedUpdates.length > 0) {
                toast({
                    variant: "destructive",
                    title: "Save Failed",
                    description: `Could not save ${failedUpdates.length} rows. Error: ${failedUpdates[0].error}`,
                });
            } else {
                toast({
                    title: "Changes Saved Successfully",
                    description: `${modifiedRows.length} rows have been updated in the database.`,
                });
                setIsEditMode(false);
                setDataBeforeEdit(null);
                fetchData(); // Refetch data to confirm changes from DB
            }
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

    const handleL3FilterToggle = () => {
        const isCurrentlyFilteringL3 = columnFilters.status?.length === 1 && columnFilters.status[0] === 'L3';

        if (isCurrentlyFilteringL3) {
            // If the only status filter is L3, clear it.
            const newFilters = { ...columnFilters };
            delete newFilters.status;
            setColumnFilters(newFilters);
            toast({ title: "L3 Filter Cleared", description: "Showing all statuses again." });
        } else {
            // Otherwise, set the filter to be *only* L3.
            setColumnFilters(prev => ({
                ...prev,
                status: ['L3']
            }));
            toast({ title: "L3 Filter Applied", description: "Showing only L3 status cases." });
        }
    };
    
    const isL3FilterActive = columnFilters.status?.length === 1 && columnFilters.status[0] === 'L3';


    const renderHeaderContent = (header: string) => {
        const displayHeader = headerDisplayMapping[header] || header;
        const isFilterable = FILTER_COLUMNS.includes(header);
        const isFilterActive = columnFilters[header]?.length > 0;
        const headerStyle = "text-muted-foreground";

        if (header === 'date') {
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
                                                    <span className={cn('px-2 py-0.5 rounded-md text-xs', categoryColorMap[option] || categoryColorMap.default)}>
                                                        {option}
                                                    </span>
                                                ) : isStatusFilter ? (
                                                    <span className={cn('inline-flex items-center justify-center w-[100px] px-2 py-0.5 rounded-md text-xs', statusColorMap[option] || statusColorMap.default)}>
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

    if (!isClient) {
        return (
            <div className="flex-1 bg-background text-foreground px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3 md:px-8 md:pb-8 md:pt-4">
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-2">
                               <Skeleton className="h-10 w-[300px]" />
                               <Skeleton className="h-10 w-[180px]" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-9 w-24" />
                                <Skeleton className="h-9 w-28" />
                                <Skeleton className="h-6 w-40" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-auto h-[75vh] border-t rounded-b-md">
                            <div className="p-4 space-y-2">
                                {Array.from({ length: 15 }).map((_, i) => (
                                    <Skeleton key={i} className="h-8 w-full" />
                                ))}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="p-3 border-t">
                        <div className="flex items-center justify-between w-full">
                            <Skeleton className="h-5 w-48" />
                            <div className="flex items-center space-x-6">
                                <Skeleton className="h-8 w-40" />
                                <Skeleton className="h-8 w-24" />
                                <div className="flex items-center space-x-1">
                                    <Skeleton className="h-9 w-9" />
                                    <Skeleton className="h-9 w-9" />
                                    <Skeleton className="h-9 w-9" />
                                    <Skeleton className="h-9 w-9" />
                                </div>
                            </div>
                        </div>
                    </CardFooter>
                </Card>
            </div>
        )
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
                                    disabled={isEditMode || isSaving}
                                />
                            </div>
                            <div className="w-full sm:w-auto">
                                <Select 
                                    value={yearFilter} 
                                    onValueChange={(value) => {
                                        setYearFilter(value === 'all' ? '' : value);
                                    }}
                                    disabled={isEditMode || isSaving}
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
                                <Button onClick={handleClearAllFilters} variant="ghost" size="sm" disabled={isEditMode || isSaving}>
                                    <FilterX className="mr-2 h-4 w-4" />
                                    Clear All Filters
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {isEditMode ? (
                                <div className="flex items-center gap-2">
                                    <Button onClick={handleCancelEdit} size="sm" variant="destructive" disabled={isSaving}>
                                        <X className="mr-2 h-4 w-4" /> Cancel
                                    </Button>
                                    <Button onClick={handleSaveChanges} size="sm" disabled={isSaving}>
                                        {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        {isSaving ? "Saving..." : "Save"}
                                    </Button>
                                </div>
                            ) : (
                                <Button onClick={handleEditClick} size="sm" className="bg-yellow-400 text-black hover:bg-yellow-500">
                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                </Button>
                            )}
                             <Button onClick={handleL3FilterToggle} size="sm" variant={isL3FilterActive ? "default" : "outline"} disabled={isPending || isRefreshing || isEditMode || isSaving}>
                                <Filter className="mr-2 h-4 w-4" />
                                {isL3FilterActive ? "Clear L3 Filter" : "Filter L3 Cases"}
                            </Button>
                            <Button onClick={() => fetchData(true)} size="sm" variant="outline" disabled={isPending || isRefreshing || isEditMode || isSaving}>
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
                            <div style={{ width: `${totalWidth}px` }}>
                                {/* Header row */}
                                <div className="sticky top-0 z-10 flex bg-muted">
                                    {headers.map(header => (
                                        <div
                                            key={header}
                                            className="h-12 px-4 flex items-center justify-center relative"
                                            style={{ 
                                                width: columnWidths[header], 
                                                flexShrink: 0, 
                                                borderBottom: '1px solid hsl(var(--border))', 
                                                borderRight: '1px solid hsl(var(--border))' 
                                            }}
                                        >
                                            {renderHeaderContent(header)}
                                            <div
                                                onMouseDown={(e) => handleResizeMouseDown(header, e)}
                                                className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-20"
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Data rows */}
                                {displayData.map((row, index) => {
                                    const rowNumber = (currentPage - 1) * pageSize + index + 1;
                                    
                                    return (
                                        <div 
                                            key={row?.id || index} 
                                            className="flex border-b transition-colors hover:bg-muted/50"
                                        >
                                            {headers.map(header => {
                                                const isNoColumn = header.toLowerCase() === 'no';
                                                const isEditable = isEditMode && !isNoColumn;
                                                const rowId = row?.id;
                                                
                                                let cellValue = row ? (isNoColumn ? rowNumber : row[header]) : null;

                                                // Date/Time formatting
                                                if (row && ['date', 'created_at', 'resolved_at'].includes(header) && typeof cellValue === 'string' && cellValue) {
                                                    try {
                                                        const date = new Date(cellValue);
                                                        if (!isNaN(date.getTime())) {
                                                            const timeZoneOffset = date.getTimezoneOffset() * 60000;
                                                            const localDate = new Date(date.getTime() + timeZoneOffset);

                                                            if (header === 'date') {
                                                                cellValue = localDate.toISOString().split('T')[0];
                                                            } else {
                                                                cellValue = localDate.toISOString().replace('T', ' ').substring(0, 16);
                                                            }
                                                        }
                                                    } catch(e) {
                                                        // Keep original value on error
                                                    }
                                                }

                                                const isDropdownColumn = isEditable && ['status', 'ticket_category', 'module', 'detail_module'].includes(header);
                                                
                                                const columnsToCenter = [
                                                    'no',
                                                    'date',
                                                    'month', 
                                                    'client_name', 
                                                    'customer_name', 
                                                    'ticket_category', 
                                                    'module', 
                                                    'detail_module', 
                                                    'created_at', 
                                                    'resolved_at', 
                                                    'status_case_2'
                                                ];

                                                return (
                                                    <div 
                                                        key={header} 
                                                        className="align-middle" 
                                                        style={{ 
                                                            width: columnWidths[header], 
                                                            flexShrink: 0, 
                                                            borderRight: '1px solid hsl(var(--border))' 
                                                        }}
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
                                                                    <SelectTrigger className="h-full w-full rounded-none border-0 bg-transparent p-0 py-1 px-2 text-xs focus:ring-0 focus:ring-offset-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary">
                                                                        {cellValue ? (
                                                                            <span className={cn('px-2 py-0.5 rounded-md text-xs', header === 'status' && 'inline-flex items-center justify-center w-[100px]', header === 'ticket_category' ? (categoryColorMap[cellValue as string] || categoryColorMap.default) : (statusColorMap[cellValue as string] || statusColorMap.default))}>
                                                                                {cellValue}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-muted-foreground">Select...</span>
                                                                        )}
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {(header === 'ticket_category' ? ALL_CATEGORIES : ALL_STATUSES).map(option => (
                                                                            <SelectItem key={option} value={option}>
                                                                                <span className={cn('px-2 py-0.5 rounded-md text-xs', header === 'ticket_category' ? (categoryColorMap[option] || categoryColorMap.default) : (statusColorMap[option] || statusColorMap.default))}>
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
                                                                    <SelectTrigger className="h-full w-full rounded-none border-0 bg-transparent p-0 py-1 px-2 text-xs focus:ring-0 focus:ring-offset-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary">
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
                                                                className="h-full w-full rounded-none border-0 bg-transparent p-2 text-xs focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary disabled:bg-transparent"
                                                                disabled={!row}
                                                            />
                                                        ) : (
                                                            <div className={cn("py-1 px-2 flex items-center h-full", columnsToCenter.includes(header) && 'justify-center')}>
                                                                {row ? (
                                                                    (header === 'ticket_category' && cellValue) ? (
                                                                        <span className={cn('text-xs px-2 py-0.5 rounded-md', categoryColorMap[cellValue as string] || categoryColorMap.default)}>
                                                                            {cellValue}
                                                                        </span>
                                                                    ) : (header === 'status' && cellValue) ? (
                                                                        <span className={cn('text-xs inline-flex items-center justify-center w-[100px] px-2 py-0.5 rounded-md', statusColorMap[cellValue as string] || statusColorMap.default)}>
                                                                            {cellValue}
                                                                        </span>
                                                                    ) : (header === 'title' && cellValue && typeof cellValue === 'string' && cellValue.match(/(IHO-\d+)/)) ? (
                                                                        (() => {
                                                                            const match = cellValue.match(/(IHO-\d+)/);
                                                                            if (!match) return <span className="truncate text-xs">{cellValue}</span>;
                                                                            const ticketId = match[0];
                                                                            const parts = cellValue.split(ticketId);
                                                                            return (
                                                                                <span className="truncate text-xs">
                                                                                    {parts[0]}
                                                                                    <a
                                                                                        href={`https://pintro.atlassian.net/browse/${ticketId}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="text-primary underline hover:text-primary/80"
                                                                                    >
                                                                                        {ticketId}
                                                                                    </a>
                                                                                    {parts[1]}
                                                                                </span>
                                                                            );
                                                                        })()
                                                                    ) : (
                                                                        <span className="truncate text-xs">{cellValue}</span>
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
                <CardFooter className="p-3 border-t">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex-1 text-sm text-muted-foreground">
                            Showing {totalRows > 0 ? ((currentPage - 1) * pageSize) + 1 : 0} to {Math.min(currentPage * pageSize, totalRows)} of {totalRows.toLocaleString()} rows
                        </div>
                        <div className="flex items-center space-x-6">
                            <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium">Rows per page</p>
                                <Select
                                    value={`${pageSize}`}
                                    onValueChange={(value) => setPageSize(Number(value))}
                                    disabled={isPending || isEditMode}
                                >
                                    <SelectTrigger className="h-8 w-[70px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        {[50, 100, 250, 500].map((size) => (
                                            <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium">
                                    Page {currentPage} of {totalPages || 1}
                                </p>
                            </div>
                            <div className="flex items-center space-x-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1 || isPending || isEditMode}
                                    title="First page"
                                >
                                    <ChevronsLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1 || isPending || isEditMode}
                                    title="Previous page"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))}
                                    disabled={currentPage >= (totalPages || 1) || isPending || isEditMode}
                                    title="Next page"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(totalPages || 1)}
                                    disabled={currentPage >= (totalPages || 1) || isPending || isEditMode}
                                    title="Last page"
                                >
                                    <ChevronsRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardFooter>
            </Card>

        </div>
    );
}
