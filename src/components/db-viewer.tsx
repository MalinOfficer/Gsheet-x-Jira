

"use client";

import { AlertTriangle, Database, Cloud, RefreshCw, Search, Calendar as CalendarIcon, FilterX, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, X, Save, Copy, Check, ArrowLeft, ChevronDown, Trash2 } from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardHeader, 
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import { Button, buttonVariants } from "./ui/button";
import { Input } from "./ui/input";
import { useEffect, useState, useRef, useMemo, useCallback, useContext, MouseEvent, useTransition } from "react";
import { SettingsContext } from "@/contexts/settings-provider";
import { TableDataContext } from "@/store/table-data-context";
import { getAllCaseData, updateCase, deleteCase, deleteCases } from "@/app/actions";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Checkbox } from "./ui/checkbox";


interface DbViewerProps {
    initialData: any[] | null;
    initialSource: 'cache' | 'sheet' | 'N/A' | 'supabase';
    initialError?: string | null;
    availableYears?: string[];
}

interface DbViewerState {
    data: any[] | null;
    source: 'cache' | 'sheet' | 'N/A' | 'supabase' | 'view';
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
    status_case_2: 'Umur Case',
    note: 'Note',
};

const hiddenHeaders = [
    'id',
    'url_jira',
    'pic_client',
    'checkout',
    'ticket_number',
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
    'L1': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
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

const ALL_MODULES = [
    'PPDP/PMB',
    'LMS/KBM',
    'Administrasi Akademik',
    'CBT',
    'Penilaian/Raport',
    'Payment',
    'Perpustakaan',
    'Pesantren',
    'Pintro Pay',
    'Boarding',
    'Migrasi Data',
    'Aplikasi/Mobile',
    'Akses Portal',
];

const ALL_DETAIL_MODULES = [
    'Payment - Angsuran',
    'Payment - Daftar Ulang',
    'Payment - Diskon',
    'Payment - Double Bayar / Refund',
    'Payment - Gagal Transaksi',
    'Payment - Laporan / Selisih',
    'Payment - Pintro Cash',
    'Payment - SPPK',
    'Payment - Tagihan tidak terupdate',
    'Payment - Tambah Tagihan',
    'Payment - Hapus Data',
    'Payment - Update Tagihan',
    'PPDB - Setup PPDB',
    'PPDB - Jadwal PPDB',
    'PPDB - Form Pendaftar',
    'PPDB - Data Pendaftar',
    'PPDB - Status Pendaftar',
    'PPDB - Proses Kelulusan',
    'PPDB - Ujian Online',
    'PPDB - Laporan',
    'LMS - Materi',
    'LMS - Tugas',
    'LMS - Ujian / Quiz',
    'LMS - Absensi',
    'LMS - Forum Diskusi',
    'Akademik - Kalender Akademik',
    'Akademik - Kurikulum',
    'Akademik - Jadwal Pelajaran',
    'Akademik - Data Siswa',
    'Akademik - Data Guru',
    'CBT - Bank Soal',
    'CBT - Jadwal Ujian',
    'CBT - Pelaksanaan Ujian',
    'CBT - Hasil Ujian',
    'Penilaian - Input Nilai',
    'Penilaian - Proses Rapor',
    'Penilaian - Cetak Rapor',
    'Penilaian - Leger Nilai',
    'Mobile - Notifikasi',
    'Mobile - Login/Logout',
];

const moduleColorMap: Record<string, string> = {
    'Payment': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'Perpustakaan': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    'Pesantren': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'Pintro Pay': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Boarding': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'Migrasi Data': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'default': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const getUnsolvedCases = async () => {
    // This is a placeholder. In a real scenario, you would fetch from a specific view/endpoint.
    const { data, error, count } = await getAllCaseData({
        status: ['L1', 'L2', 'L3', 'ON HOLD']
    });

    if (error) {
        return { error };
    }

    // Since this is a view, there's no separate pagination data source.
    // The pagination will be handled client-side for this view if needed,
    // or we can assume the view returns a manageable number of rows.
    return { data, source: 'view' as const, pagination: null };
};


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
    const [isBulkDeleting, startBulkDeleting] = useTransition();
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
    
    // Report Dialog State
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [reportContent, setReportContent] = useState('');
    const [isGeneratingReport, startGeneratingReport] = useTransition();
    const [isReportCopied, setIsReportCopied] = useState(false);
    
    // Unsolved view state
    const [isUnsolvedView, setIsUnsolvedView] = useState(false);
    const [preUnsolvedState, setPreUnsolvedState] = useState<any>(null);

    // Delete confirmation state
    const [selectedRowIds, setSelectedRowIds] = useState(new Set<number>());


    const columnsToCenter = [
        'no', 'date', 'month',
        'ticket_category', 'module', 'detail_module', 'created_at', 
        'resolved_at', 'status_case_2', 'client_name', 'customer_name', 'status'
    ];


    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        setIsProcessing(isPending || isSaving || isGeneratingReport || isBulkDeleting);
    }, [isPending, isSaving, isGeneratingReport, isBulkDeleting, setIsProcessing]);

    const headers = useMemo(() => {
        if (!state.data || !state.data.length) return ['no'];
        // Use a predefined order but accommodate for missing columns from views
        const predefinedOrder = [
            'date', 'month', 'ticket_number', 'title', 'client_name', 'customer_name',
            'status', 'ticket_category', 'module', 'detail_module', 'created_at',
            'resolved_at', 'status_case_2', 'ticket_op', 'note'
        ];
        
        const allKeys = Object.keys(state.data[0]);
        const visibleKeys = allKeys.filter(key => !hiddenHeaders.includes(key) && key !== 'id');
        
        visibleKeys.sort((a, b) => {
            const indexA = predefinedOrder.indexOf(a);
            const indexB = predefinedOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        FILTER_COLUMNS = ['client_name', 'status', 'ticket_category', 'module', 'detail_module', 'month'];
        const baseHeaders = ['no', ...visibleKeys];
        return baseHeaders;
    }, [state.data, isEditMode]);

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
            status_case_2: 130, // Umur Case
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
    
    const fetchData = useCallback(async (isRefresh = false, forceSource?: 'unsolved') => {
        startTransition(async () => {
            if (isRefresh) {
                setIsRefreshing(true);
                setProgress(0);
            }
            
            let dataResult;
            if (forceSource === 'unsolved' || isUnsolvedView) {
                dataResult = await getUnsolvedCases();
            } else {
                 dataResult = await getAllCaseData({
                    year: yearFilter || undefined,
                    dateRange: dateRange,
                    category: columnFilters['ticket_category'],
                    client: columnFilters['client_name'],
                    module: columnFilters['module'],
                    status: columnFilters['status'],
                    detailModule: columnFilters['detail_module'],
                    month: columnFilters['month'],
                    search: debouncedSearchTerm || undefined,
                    page: currentPage,
                    pageSize: pageSize,
                });
            }

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
                } else {
                    // For views without pagination
                    const dataLength = dataResult.data?.length || 0;
                    setTotalRows(dataLength);
                    setTotalPages(dataLength > 0 ? 1 : 0);
                    setCurrentPage(1);
                }
            }

            if (isRefresh) {
                setProgress(100);
                if (dataResult.error) {
                    toast({ variant: 'destructive', title: "Refresh Failed", description: dataResult.error });
                } else {
                    toast({ 
                        title: "Data Refreshed", 
                        description: `Loaded ${dataResult.data?.length || 0} rows.` 
                    });
                }
                setIsRefreshing(false);
            }
        });
    }, [isUnsolvedView, yearFilter, dateRange, columnFilters, debouncedSearchTerm, currentPage, pageSize, toast]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            if (initialData) {
                setTotalRows(initialData.length);
                setTotalPages(Math.ceil(initialData.length / pageSize));
            }
            return;
        }
        if (!isUnsolvedView) { // Only trigger on filter changes if not in special view
            fetchData();
        }
    }, [yearFilter, dateRange, columnFilters, debouncedSearchTerm, currentPage, pageSize, fetchData, isUnsolvedView]);
    
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
        const monthOrder = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
        FILTER_COLUMNS.forEach(col => {
            const uniqueValues = [...new Set(state.data?.map(row => row[col]).filter(Boolean))];
            
            if (col === 'month') {
                uniqueValues.sort((a, b) => {
                    const indexA = monthOrder.indexOf(a);
                    const indexB = monthOrder.indexOf(b);
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                });
            } else {
                uniqueValues.sort((a, b) => a.localeCompare(b));
            }
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
        if (!state.data) return [];
        
        return state.data.map(row => {
            const newRow = {...row};
    
            // Format dates
            ['created_at', 'resolved_at'].forEach(header => {
                const cellValue = row[header];
                if (typeof cellValue === 'string' && cellValue) {
                    try {
                        const date = new Date(cellValue);
                        if (!isNaN(date.getTime())) {
                            const options: Intl.DateTimeFormatOptions = {
                                year: 'numeric', month: '2-digit', day: '2-digit',
                                hour: '2-digit', minute: '2-digit', hour12: false,
                                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                            };
                            const formatter = new Intl.DateTimeFormat('en-GB', options);
                            newRow[header] = formatter.format(date).replace(',', '');
                        }
                    } catch(e) { /* keep original */ }
                }
            });
    
            const dateCellValue = row['date'];
            if (typeof dateCellValue === 'string' && dateCellValue) {
                 try {
                    const date = new Date(dateCellValue);
                    if (!isNaN(date.getTime())) {
                        const year = date.getUTCFullYear();
                        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                        const day = String(date.getUTCDate()).padStart(2, '0');
                        newRow['date'] = `${year}-${month}-${day}`;
                    }
                } catch(e) { /* keep original */ }
            }
    
            // Calculate 'Umur Case'
            const status = newRow.status?.toUpperCase();
            if (['L1', 'L2', 'L3'].includes(status)) {
                const createdAtStr = row.created_at; // use original row data for calculation
                if (createdAtStr) {
                    const createdAt = new Date(createdAtStr);
                    if (!isNaN(createdAt.getTime())) {
                        const now = new Date();
                        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const startOfCreatedAt = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
                        
                        const diffTime = startOfToday.getTime() - startOfCreatedAt.getTime();
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        
                        const age = diffDays + 1;
                        newRow.status_case_2 = age;
                    } else {
                        newRow.status_case_2 = '';
                    }
                } else {
                     newRow.status_case_2 = '';
                }
            } else {
                newRow.status_case_2 = '';
            }
            
            return newRow;
        });
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
        setSelectedRowIds(new Set());
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
    
    const handleConfirmDelete = (caseId: number) => {
        startSaving(async () => {
            const result = await deleteCase(caseId);
            if (result.success) {
                toast({ title: "Case Deleted", description: `Case #${caseId} has been removed.` });
                setState(prevState => ({
                    ...prevState,
                    data: prevState.data?.filter(r => r.id !== caseId) || null,
                }));
                 setTotalRows(prev => prev - 1);
            } else {
                toast({ variant: 'destructive', title: "Delete Failed", description: result.error });
            }
        });
    }
    
    const confirmBulkDelete = () => {
        if (selectedRowIds.size === 0) return;
        startBulkDeleting(async () => {
            const ids = Array.from(selectedRowIds);
            const result = await deleteCases(ids);
            if (result.success) {
                toast({ title: "Cases Deleted", description: `${result.count} case(s) have been removed.` });
                setState(prevState => ({
                    ...prevState,
                    data: prevState.data?.filter(r => !selectedRowIds.has(r.id)) || null,
                }));
                setTotalRows(prev => prev - ids.length);
                setSelectedRowIds(new Set());
            } else {
                toast({ variant: 'destructive', title: "Delete Failed", description: result.error });
            }
        });
    };

    const handleUnsolvedFilterClick = () => {
        if (isUnsolvedView) {
            // Restore previous state and re-fetch
            setIsUnsolvedView(false);
            if(preUnsolvedState) {
                setSearchTerm(preUnsolvedState.searchTerm);
                setDateRange(preUnsolvedState.dateRange);
                setColumnFilters(preUnsolvedState.columnFilters);
                setYearFilter(preUnsolvedState.yearFilter);
                setCurrentPage(preUnsolvedState.currentPage);
                setPageSize(preUnsolvedState.pageSize);
            }
            // fetchData will be triggered by useEffect
        } else {
            // Save current state
            setPreUnsolvedState({
                searchTerm, dateRange, columnFilters, yearFilter, currentPage, pageSize
            });
            // Clear filters for the view
            handleClearAllFilters();
            setIsUnsolvedView(true);
            fetchData(false, 'unsolved');
        }
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
        const headerStyle = "text-muted-foreground";

        if (header === 'no' && isEditMode) {
            const isAllSelected = displayData.length > 0 && displayData.every(row => selectedRowIds.has(row.id));
            const isSomeSelected = displayData.length > 0 && displayData.some(row => selectedRowIds.has(row.id));
            return (
                <Checkbox
                    checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) => {
                        const newSelectedRowIds = new Set(selectedRowIds);
                        if (checked === true) {
                            displayData.forEach(row => row.id && newSelectedRowIds.add(row.id));
                        } else {
                            displayData.forEach(row => newSelectedRowIds.delete(row.id));
                        }
                        setSelectedRowIds(newSelectedRowIds);
                    }}
                    aria-label="Select all rows"
                    disabled={isBulkDeleting}
                />
            );
        }
        
        if (header === 'date') {
            return (
                <Popover open={isDatePopoverOpen} onOpenChange={(open) => {
                    if (open) {
                        setTempDateRange(dateRange);
                    }
                    setIsDatePopoverOpen(open);
                }}>
                    <PopoverTrigger asChild disabled={isEditMode || isUnsolvedView}>
                        <Button variant="ghost" className={cn(headerStyle, "p-0 h-auto data-[state=open]:bg-accent/20")}>
                            {displayHeader}
                            <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", dateRange ? "text-primary" : "text-muted-foreground/50", isDatePopoverOpen && "rotate-180")} />
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
            const isModuleFilter = header === 'module';
            const isDetailModuleFilter = header === 'detail_module';
            const options = isCategoryFilter
                ? ALL_CATEGORIES
                : isStatusFilter
                ? ALL_STATUSES
                : isModuleFilter
                ? ALL_MODULES
                : isDetailModuleFilter
                ? ALL_DETAIL_MODULES
                : (filterOptions[header] || []);
            return(
                <Popover>
                    <PopoverTrigger asChild disabled={isEditMode || isUnsolvedView}>
                        <Button variant="ghost" className={cn(headerStyle, "p-0 h-auto hover:bg-transparent data-[state=open]:bg-accent/20")}>
                            {displayHeader}
                            <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", isFilterActive ? "text-primary" : "text-muted-foreground/50")} />
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
                                                    <span className={cn('px-2 py-0.5 rounded-full text-xs', categoryColorMap[option] || categoryColorMap.default)}>
                                                        {option}
                                                    </span>
                                                ) : isStatusFilter ? (
                                                    <span className={cn('inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold', statusColorMap[option] || statusColorMap.default)}>
                                                        {option}
                                                    </span>
                                                ) : isModuleFilter ? (
                                                    <span className={cn('px-2 py-0.5 rounded-full text-xs', moduleColorMap[option] || moduleColorMap.default)}>
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
                                    disabled={isEditMode || isSaving || isUnsolvedView}
                                />
                            </div>
                            <div className="w-full sm:w-auto">
                                <Select 
                                    value={yearFilter} 
                                    onValueChange={(value) => {
                                        setYearFilter(value === 'all' ? '' : value);
                                    }}
                                    disabled={isEditMode || isSaving || isUnsolvedView}
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
                            {areFiltersActive && !isUnsolvedView && (
                                <Button onClick={handleClearAllFilters} variant="ghost" size="sm" disabled={isEditMode || isSaving}>
                                    <FilterX className="mr-2 h-4 w-4" />
                                    Clear All Filters
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {isEditMode ? (
                                <div className="flex items-center gap-2">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button size="sm" variant="destructive" disabled={selectedRowIds.size === 0 || isBulkDeleting}>
                                                {isBulkDeleting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                                Delete ({selectedRowIds.size})
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will permanently delete {selectedRowIds.size} selected case(s). This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={confirmBulkDelete} className={cn(buttonVariants({ variant: "destructive" }))}>
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    <Button onClick={handleCancelEdit} size="sm" variant="outline" disabled={isSaving || isBulkDeleting}>
                                        <X className="mr-2 h-4 w-4" /> Cancel
                                    </Button>
                                    <Button onClick={handleSaveChanges} size="sm" disabled={isSaving || isBulkDeleting}>
                                        {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        {isSaving ? "Saving..." : "Save"}
                                    </Button>
                                </div>
                            ) : (
                                <Button onClick={handleEditClick} size="sm" className="bg-yellow-400 text-black hover:bg-yellow-500">
                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                </Button>
                            )}
                             <Button
                                onClick={handleUnsolvedFilterClick}
                                size="sm"
                                variant={isUnsolvedView ? "default": "secondary"}
                                className={cn(
                                    "bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700"
                                )}
                                disabled={isPending || isRefreshing || isEditMode || isSaving}
                            >
                                {isUnsolvedView ? <ArrowLeft className="mr-2 h-4 w-4" /> : <Filter className="mr-2 h-4 w-4" />}
                                {isUnsolvedView ? "Show All Cases" : "Unsolved Filter"}
                            </Button>
                            <Button onClick={() => fetchData(true)} size="sm" variant="default" className="bg-blue-500 hover:bg-blue-600" disabled={isPending || isRefreshing || isEditMode || isSaving}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
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
                        {(!displayData || displayData.length === 0) && !isPending ? (
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
                                                const isEditable = isEditMode || (isUnsolvedView && isEditMode);
                                                const rowId = row?.id;
                                                
                                                let cellValue = row ? row[header] : null;
                                                
                                                const isDropdownColumn = isEditable && ['status', 'ticket_category', 'module', 'detail_module'].includes(header);

                                                if (header === 'no') {
                                                    return (
                                                        <div 
                                                            key={header}
                                                            className="align-middle flex items-center justify-center"
                                                            style={{ 
                                                                width: columnWidths[header], 
                                                                flexShrink: 0, 
                                                                borderRight: '1px solid hsl(var(--border))' 
                                                            }}
                                                        >
                                                            {isEditMode ? (
                                                                <Checkbox
                                                                    checked={selectedRowIds.has(rowId)}
                                                                    onCheckedChange={(checked) => {
                                                                        const newSelectedRowIds = new Set(selectedRowIds);
                                                                        if (checked) {
                                                                            newSelectedRowIds.add(rowId);
                                                                        } else {
                                                                            newSelectedRowIds.delete(rowId);
                                                                        }
                                                                        setSelectedRowIds(newSelectedRowIds);
                                                                    }}
                                                                    aria-label={`Select row ${rowNumber}`}
                                                                    disabled={!row || isBulkDeleting}
                                                                />
                                                            ) : (
                                                                <span className="truncate text-xs">{rowNumber}</span>
                                                            )}
                                                        </div>
                                                    )
                                                }

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
                                                                             header === 'status' ? (
                                                                                <span className={cn('text-xs inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-semibold', statusColorMap[cellValue as string] || statusColorMap.default)}>
                                                                                    {cellValue}
                                                                                </span>
                                                                             ) : (
                                                                                <span className={cn('px-2 py-0.5 rounded-full text-xs', categoryColorMap[cellValue as string] || categoryColorMap.default)}>
                                                                                    {cellValue}
                                                                                </span>
                                                                             )
                                                                        ) : (
                                                                            <span className="text-muted-foreground">Select...</span>
                                                                        )}
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {(header === 'ticket_category' ? ALL_CATEGORIES : ALL_STATUSES).map(option => (
                                                                            <SelectItem key={option} value={option}>
                                                                                {header === 'status' ? (
                                                                                    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', statusColorMap[option] || statusColorMap.default)}>
                                                                                        {option}
                                                                                    </span>
                                                                                ) : (
                                                                                     <span className={cn('px-2 py-0.5 rounded-full text-xs', categoryColorMap[option] || categoryColorMap.default)}>
                                                                                        {option}
                                                                                    </span>
                                                                                )}
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
                                                                        {cellValue ? (
                                                                            header === 'module' ? (
                                                                                <span className={cn('px-2 py-0.5 rounded-full text-xs', moduleColorMap[cellValue as string] || moduleColorMap.default)}>
                                                                                    {cellValue}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs">{cellValue}</span>
                                                                            )
                                                                        ) : (
                                                                            <span className="text-muted-foreground">Select...</span>
                                                                        )}
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {(header === 'module' ? ALL_MODULES : header === 'detail_module' ? ALL_DETAIL_MODULES : (filterOptions[header] || [])).map(option => (
                                                                            <SelectItem key={option} value={option}>
                                                                                {header === 'module' ? (
                                                                                    <span className={cn('px-2 py-0.5 rounded-full text-xs', moduleColorMap[option] || moduleColorMap.default)}>
                                                                                        {option}
                                                                                    </span>
                                                                                ) : (
                                                                                    option
                                                                                )}
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
                                                            <div className={cn("py-1 px-2 flex items-center h-full", !['title', 'note', 'ticket_number'].includes(header) && 'justify-center')}>
                                                                {row ? (
                                                                    (() => {
                                                                        if (header === 'status_case_2' && cellValue) {
                                                                            const age = Number(cellValue);
                                                                            const isOverdue = age > 3;
                                                                            return (
                                                                                <span className={cn('text-xs px-2 py-0.5 rounded-full font-mono', isOverdue ? 'bg-destructive text-destructive-foreground font-bold' : '')}>
                                                                                    {age}
                                                                                </span>
                                                                            );
                                                                        }
                                                                        if (header === 'ticket_category' && cellValue) {
                                                                            return (
                                                                                <span className={cn('text-xs px-2 py-0.5 rounded-full', categoryColorMap[cellValue as string] || categoryColorMap.default)}>
                                                                                    {cellValue}
                                                                                </span>
                                                                            );
                                                                        }
                                                                        if (header === 'status' && cellValue) {
                                                                            return (
                                                                                <span className={cn('text-xs inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-semibold', statusColorMap[cellValue as string] || statusColorMap.default)}>
                                                                                    {cellValue}
                                                                                </span>
                                                                            );
                                                                        }
                                                                        if (header === 'module' && cellValue) {
                                                                            return (
                                                                                <span className={cn('text-xs px-2 py-0.5 rounded-full', moduleColorMap[cellValue as string] || moduleColorMap.default)}>
                                                                                    {cellValue}
                                                                                </span>
                                                                            );
                                                                        }
                                                                        if (header === 'title' && cellValue) {
                                                                            const ticketNumberMatch = String(cellValue).match(/^(IHO-\d+)/);

                                                                            if (ticketNumberMatch) {
                                                                                const ticketNumber = ticketNumberMatch[0];
                                                                                const restOfTitle = String(cellValue).substring(ticketNumber.length).trim();
                                                                                const jiraUrl = `https://pintro.atlassian.net/browse/${ticketNumber}`;
                                                                                return (
                                                                                    <span className="truncate text-xs">
                                                                                        <a href={jiraUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                                                            {ticketNumber}
                                                                                        </a>
                                                                                        {' '}{restOfTitle}
                                                                                    </span>
                                                                                );
                                                                            }
                                                                        }
                                                                        return <span className="truncate text-xs">{cellValue}</span>;
                                                                    })()
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
                 {!isUnsolvedView && (
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
                 )}
            </Card>

            <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>L3 Case Report</DialogTitle>
                        <DialogDescription>
                            This is a snapshot of all active L3 and On Hold cases.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-md border bg-muted/50 p-4">
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                            {reportContent}
                        </pre>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => {
                                navigator.clipboard.writeText(reportContent);
                                setIsReportCopied(true);
                                toast({ title: 'Report copied to clipboard' });
                                setTimeout(() => setIsReportCopied(false), 2000);
                            }}
                            size="sm"
                            variant="outline"
                        >
                            {isReportCopied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                            {isReportCopied ? 'Copied!' : 'Copy Report'}
                        </Button>
                        <Button onClick={() => setIsReportDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
