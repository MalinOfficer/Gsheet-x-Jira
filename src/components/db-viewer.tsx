
"use client";

import { AlertTriangle, Database, RefreshCw, Search, FilterX, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowLeft, ChevronDown, Download, Check, Copy, UserPlus, Calendar as CalendarIcon } from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardHeader, 
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useEffect, useState, useRef, useMemo, useCallback, useContext, MouseEvent, useTransition, memo } from "react";
import { TableDataContext } from "@/store/table-data-context";
import { getAllCaseData, updateCase, addClient, refreshDashboardViews, deleteCases } from "@/app/actions";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectViewport, SelectScrollUpButton, SelectScrollDownButton } from "./ui/select";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Label } from "./ui/label";

declare const XLSX: any;

interface DbViewerProps {
    initialData: any[] | null;
    initialSource: 'cache' | 'sheet' | 'N/A' | 'supabase';
    initialError?: string | null;
    availableYears?: string[];
    availableClients?: string[];
}

interface DbViewerState {
    data: any[] | null;
    source: 'cache' | 'sheet' | 'N/A' | 'supabase' | 'view';
    error?: string | null;
}

let FILTER_COLUMNS: string[] = [];

const headerDisplayMapping: Record<string, string> = {
    no: 'No',
    date: 'Date',
    month: 'Month',
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
    duration: 'Duration',
    note: 'Note',
};

const hiddenHeaders: string[] = ['ticket_number', 'url_jira', 'pic_client', 'checkout'];

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

const ALL_CATEGORIES = ['Adjustment', 'Assistance', 'Bug Fixing', 'Enhancement', 'Parameter Setup', 'Q & A'];
const ALL_STATUSES = ['Solved', 'L3', 'L2', 'L1', 'PM', 'Move to Issue Tracker'];
const ALL_MODULES = ['PPDP/PMB', 'LMS/KBM', 'Administrasi Akademik', 'CBT', 'Penilaian/Raport', 'Payment', 'Perpustakaan', 'Pesantren', 'Pintro Pay', 'Boarding', 'Migrasi Data', 'Aplikasi/Mobile', 'Akses Portal'];
const ALL_DETAIL_MODULES = ['Payment - Angsuran', 'Payment - Daftar Ulang', 'Payment - Diskon', 'Payment - Double Bayar / Refund', 'Payment - Gagal Transaksi', 'Payment - Laporan / Selisih', 'Payment - Pintro Cash', 'Payment - SPPK', 'Payment - Tagihan tidak terupdate', 'Payment - Tambah Tagihan', 'Payment - Hapus Data', 'Payment - Update Tagihan', 'PPDB - Setup PPDB', 'PPDB - Jadwal PPDB', 'PPDB - Form Pendaftar', 'PPDB - Data Pendaftar', 'PPDB - Status Pendaftar', 'PPDB - Proses Kelulusan', 'PPDB - Ujian Online', 'PPDB - Laporan', 'LMS - Materi', 'LMS - Tugas', 'LMS - Ujian / Quiz', 'LMS - Absensi', 'LMS - Forum Diskusi', 'Akademik - Kalender Akademik', 'Akademik - Kurikulum', 'Akademik - Jadwal Pelajaran', 'Akademik - Data Siswa', 'Akademik - Data Guru', 'CBT - Bank Soal', 'CBT - Jadwal Ujian', 'CBT - Pelaksanaan Ujian', 'CBT - Hasil Ujian', 'Penilaian - Input Nilai', 'Penilaian - Proses Rapor', 'Penilaian - Cetak Rapor', 'Penilaian - Leger Nilai', 'Mobile - Notifikasi', 'Mobile - Login/Logout'];
const ALL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const moduleColorMap: Record<string, string> = {
    'Payment': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'Perpustakaan': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    'Pesantren': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'Pintro Pay': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Boarding': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'Migrasi Data': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'default': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

// ============================================
// 🔽 FILTER DROPDOWN POPOVER (Multi-select)
// ============================================

const FilterDropdown = memo(({
    label,
    options,
    selected,
    onSelectionChange,
    renderOption,
    onAddClient,
    availableClientsSet,
}: {
    label: string;
    options: string[];
    selected: string[];
    onSelectionChange: (selected: string[]) => void;
    renderOption?: (option: string) => React.ReactNode;
    onAddClient?: () => void;
    availableClientsSet?: Set<string>;
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredOptions = useMemo(() => {
        if (!search) return options;
        return options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
    }, [options, search]);

    const toggleOption = (option: string) => {
        const newSelected = selected.includes(option)
            ? selected.filter(s => s !== option)
            : [...selected, option];
        onSelectionChange(newSelected);
    };

    const hasActive = selected.length > 0;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        hasActive
                            ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                            : "bg-white dark:bg-slate-950 border-muted text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    <Filter className="h-3 w-3" />
                    <span>{label}</span>
                    {hasActive && (
                        <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary-foreground text-primary text-[10px] font-bold w-4 h-4">
                            {selected.length}
                        </span>
                    )}
                    <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0 shadow-lg" align="start">
                <Command>
                    {label === "Client Name" && onAddClient && (
                         <div className="border-b p-2 sticky top-0 bg-popover z-10">
                             <Button onClick={onAddClient} className="w-full h-8" size="sm">
                                <UserPlus className="mr-2 h-4 w-4" />
                                Add New Client
                            </Button>
                        </div>
                    )}
                    <CommandInput
                        placeholder={`Search ${label.toLowerCase()}...`}
                        value={search}
                        onValueChange={setSearch}
                        className="text-xs"
                    />
                    <CommandList>
                        <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">No results found.</CommandEmpty>
                        <CommandGroup>
                            {filteredOptions.map(option => {
                                const isSelected = selected.includes(option);
                                return (
                                    <CommandItem
                                        key={option}
                                        value={option}
                                        onSelect={() => toggleOption(option)}
                                        className="flex items-center gap-2 text-xs cursor-pointer"
                                    >
                                        {/* Checkbox */}
                                        <div className={cn(
                                            "h-4 w-4 rounded border flex items-center justify-center flex-shrink-0",
                                            isSelected
                                                ? "bg-primary border-primary text-primary-foreground"
                                                : "border-muted bg-white dark:bg-slate-950"
                                        )}>
                                            {isSelected && <Check className="h-3 w-3" />}
                                        </div>

                                        {/* Label / Badge */}
                                        {renderOption ? renderOption(option) : (
                                            <span className="truncate">{option}</span>
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>

                {/* Footer: Select All / Clear */}
                {options.length > 0 && (
                    <div className="border-t px-2 py-1.5 flex items-center justify-between">
                        <button
                            onClick={() => onSelectionChange(selected.length === options.length ? [] : [...options])}
                            className="text-xs text-primary hover:underline"
                        >
                            {selected.length === options.length ? 'Deselect All' : 'Select All'}
                        </button>
                        {hasActive && (
                            <button
                                onClick={() => onSelectionChange([])}
                                className="text-xs text-muted-foreground hover:text-destructive"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
});
FilterDropdown.displayName = "FilterDropdown";


const AddClientDialog = memo(({ 
    onClientAdded
}: {
    onClientAdded: (name: string) => void;
}) => {
    const [newClientName, setNewClientName] = useState('');
    const [isSaving, startSaving] = useTransition();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);

    const handleSave = async () => {
        if (!newClientName.trim()) return;

        startSaving(async () => {
            const result = await addClient(newClientName.trim());
            if (result.success && result.client) {
                toast({ title: "Client Added", description: `"${result.client.name}" has been added.` });
                onClientAdded(result.client.name);
                setNewClientName('');
                setIsOpen(false);
            } else {
                toast({ variant: "destructive", title: "Failed to Add Client", description: result.error });
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
             <DialogTrigger asChild>
                <Button className="w-full h-8" size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add New Client
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Client</DialogTitle>
                    <DialogDescription>
                        Enter the name of the new client. This will be saved to the database.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="new-client-name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="new-client-name"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            className="col-span-3"
                            disabled={isSaving}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isSaving || !newClientName.trim()}>
                        {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : 'Save Client'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});
AddClientDialog.displayName = "AddClientDialog";

// ============================================
// 🔥 LAZY EDITABLE CELL (Google Sheets Style)
// ============================================

const LazyEditableCell = memo(({
    header,
    value,
    rowId,
    rowNumber,
    columnWidth,
    onCellChange,
    onCellSave,
    availableClients,
    availableClientsSet,
    activeCell,
    onCellClick,
}: {
    header: string;
    value: any;
    rowId: number;
    rowNumber: number;
    columnWidth: number;
    onCellChange: (id: number, header: string, value: string) => void;
    onCellSave: (id: number) => void;
    availableClients: string[];
    availableClientsSet: Set<string>;
    activeCell: { rowId: number; header: string } | null;
    onCellClick: (rowId: number, header: string) => void;
}) => {
    const [localValue, setLocalValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const selectTriggerRef = useRef<HTMLButtonElement>(null);
    
    const isActive = activeCell?.rowId === rowId && activeCell?.header === header;
    const isEditable = !['no', 'date', 'month', 'created_at', 'resolved_at', 'status_case_2', 'duration'].includes(header);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    useEffect(() => {
        if (isActive && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isActive]);

    const handleBlur = () => {
        if (localValue !== value) {
            onCellChange(rowId, header, localValue);
            onCellSave(rowId);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleBlur();
            onCellClick(0, ''); // Clear active cell
        } else if (e.key === 'Escape') {
            setLocalValue(value);
            onCellClick(0, '');
        }
    };

    const cellStyle = {
        width: columnWidth,
        flexShrink: 0,
        borderRight: '1px solid hsl(var(--border))'
    };

    // No column (read-only)
    if (header === 'no') {
        return (
            <div className="align-middle flex items-center justify-center" style={cellStyle}>
                <span className="truncate text-xs">{rowNumber}</span>
            </div>
        );
    }

    // Client Name with dropdown
    if (header === 'client_name') {
        const cellValueStr = (value as string) || '';
        const isValid = availableClientsSet.has(cellValueStr.toLowerCase());

        if (isActive) {
            return (
                <div className="align-middle relative" style={cellStyle}>
                    <Select
                        value={localValue}
                        onValueChange={(newValue) => {
                            setLocalValue(newValue);
                            onCellChange(rowId, header, newValue);
                            onCellSave(rowId);
                            onCellClick(0, '');
                        }}
                        open={isActive}
                        onOpenChange={(open) => {
                            if (!open) onCellClick(0, '');
                        }}
                    >
                        <SelectTrigger 
                            ref={selectTriggerRef}
                            className={cn(
                                "h-full w-full rounded-none border-2 border-primary bg-white dark:bg-slate-950 p-0 py-1 px-2 text-xs focus:ring-0 focus:ring-offset-0",
                                !isValid && cellValueStr && "text-destructive font-semibold"
                            )}
                        >
                            <SelectValue placeholder="Select client..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectScrollUpButton />
                            <SelectViewport>
                                {availableClients.map(option => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectViewport>
                            <SelectScrollDownButton />
                        </SelectContent>
                    </Select>
                    {!isValid && cellValueStr && (
                        <div className="absolute top-0 right-0 w-0 h-0 border-solid border-t-red-500 border-l-transparent border-t-[8px] border-l-[8px]"></div>
                    )}
                </div>
            );
        }

        return (
            <div 
                className="align-middle relative cursor-pointer hover:bg-accent/50" 
                style={cellStyle}
                onClick={() => isEditable && onCellClick(rowId, header)}
            >
                <div className="py-1 px-2 flex items-center h-full justify-center">
                    <span className="truncate text-xs">{value || '-'}</span>
                </div>
                {!isValid && cellValueStr && (
                    <div className="absolute top-0 right-0 w-0 h-0 border-solid border-t-red-500 border-l-transparent border-t-[8px] border-l-[8px]"></div>
                )}
            </div>
        );
    }

    // Dropdown columns (status, category, module, detail_module)
    const isDropdownColumn = ['status', 'ticket_category', 'module', 'detail_module'].includes(header);
    
    if (isDropdownColumn && isActive) {
        const options = 
            header === 'ticket_category' ? ALL_CATEGORIES :
            header === 'status' ? ALL_STATUSES :
            header === 'module' ? ALL_MODULES :
            header === 'detail_module' ? ALL_DETAIL_MODULES : [];

        return (
            <div className="align-middle" style={cellStyle}>
                <Select
                    value={localValue ?? ''}
                    onValueChange={(newValue) => {
                        setLocalValue(newValue);
                        onCellChange(rowId, header, newValue);
                        onCellSave(rowId);
                        onCellClick(0, '');
                    }}
                    open={isActive}
                    onOpenChange={(open) => {
                        if (!open) onCellClick(0, '');
                    }}
                >
                    <SelectTrigger className="h-full w-full rounded-none border-2 border-primary bg-white dark:bg-slate-950 p-0 py-1 px-2 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map(option => (
                            <SelectItem key={option} value={option}>
                                {header === 'status' ? (
                                    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', statusColorMap[option] || statusColorMap.default)}>
                                        {option}
                                    </span>
                                ) : header === 'ticket_category' ? (
                                    <span className={cn('px-2 py-0.5 rounded-full text-xs', categoryColorMap[option] || categoryColorMap.default)}>
                                        {option}
                                    </span>
                                ) : header === 'module' ? (
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
            </div>
        );
    }

    // Text input for editable fields
    if (isEditable && isActive) {
        return (
            <div className="align-middle" style={cellStyle}>
                <Input
                    ref={inputRef}
                    type="text"
                    value={localValue ?? ''}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="h-full w-full rounded-none border-2 border-primary bg-white dark:bg-slate-950 p-2 text-xs focus-visible:ring-0"
                />
            </div>
        );
    }

    // Read-only display with special formatting
    return (
        <div 
            className={cn(
                "align-middle",
                isEditable && "cursor-pointer hover:bg-accent/50"
            )}
            style={cellStyle}
            onClick={() => isEditable && onCellClick(rowId, header)}
        >
            <div className={cn("py-1 px-2 flex items-center h-full", !['title', 'note'].includes(header) && 'justify-center')}>
                {(() => {
                    if (header === 'status_case_2' && value) {
                        const age = Number(value);
                        const isOverdue = age > 3;
                        return (
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-mono', isOverdue ? 'bg-destructive text-destructive-foreground font-bold' : '')}>
                                {age}
                            </span>
                        );
                    }
                    if (header === 'duration' && value) {
                        return <span className="text-xs px-2 py-0.5 rounded-full font-mono">{value}</span>;
                    }
                    if (header === 'ticket_category' && value) {
                        return (
                            <span className={cn('text-xs px-2 py-0.5 rounded-full', categoryColorMap[value as string] || categoryColorMap.default)}>
                                {value}
                            </span>
                        );
                    }
                    if (header === 'status' && value) {
                        return (
                            <span className={cn('text-xs inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-semibold', statusColorMap[value as string] || statusColorMap.default)}>
                                {value}
                            </span>
                        );
                    }
                    if (header === 'module' && value) {
                        return (
                            <span className={cn('px-2 py-0.5 rounded-full text-xs', moduleColorMap[value] || moduleColorMap.default)}>
                                {value}
                            </span>
                        );
                    }
                    if (header === 'title' && value) {
                        const ticketNumberMatch = String(value).match(/^(IHO-\d+)/);
                        if (ticketNumberMatch) {
                            const ticketNumber = ticketNumberMatch[0];
                            const restOfTitle = String(value).substring(ticketNumber.length).trim();
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
                    return <span className="truncate text-xs">{value || '-'}</span>;
                })()}
            </div>
        </div>
    );
});
LazyEditableCell.displayName = "LazyEditableCell";

const MemoizedRow = memo(({
    row,
    headers,
    columnWidths,
    rowNumber,
    handleCellChange,
    handleCellSave,
    availableClients,
    availableClientsSet,
    activeCell,
    onCellClick,
}: {
    row: any;
    headers: string[];
    columnWidths: Record<string, number>;
    rowNumber: number;
    handleCellChange: (id: number, header: string, value: string) => void;
    handleCellSave: (id: number) => void;
    availableClients: string[];
    availableClientsSet: Set<string>;
    activeCell: { rowId: number; header: string } | null;
    onCellClick: (rowId: number, header: string) => void;
}) => {
    return (
        <div className="flex border-b transition-colors hover:bg-muted/50 h-full">
            {headers.map(header => (
                <LazyEditableCell
                    key={`${row.id}-${header}`}
                    header={header}
                    value={row[header]}
                    rowId={row.id}
                    rowNumber={rowNumber}
                    columnWidth={columnWidths[header]}
                    onCellChange={handleCellChange}
                    onCellSave={handleCellSave}
                    availableClients={availableClients}
                    availableClientsSet={availableClientsSet}
                    activeCell={activeCell}
                    onCellClick={onCellClick}
                />
            ))}
        </div>
    );
});
MemoizedRow.displayName = "MemoizedRow";

// ============================================
// MAIN COMPONENT
// ============================================

export function DbViewer({ 
    initialData, 
    initialSource, 
    initialError,
    availableYears = [],
    availableClients: initialClients = [],
}: DbViewerProps) {
    const { setIsProcessing } = useContext(TableDataContext);
    const [state, setState] = useState<DbViewerState>({
        data: initialData,
        source: initialSource,
        error: initialError,
    });
    
    const [isPending, startTransition] = useTransition();
    const [isSaving, setIsSaving] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [progress, setProgress] = useState(0);
    const { toast } = useToast();
    
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined);
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
    const [yearFilter, setYearFilter] = useState<string>('');
    
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    
    const [isClient, setIsClient] = useState(false);
    const [availableClients, setAvailableClients] = useState<string[]>(initialClients);
    
    // 🔥 Active cell for lazy editing (Google Sheets style)
    const [activeCell, setActiveCell] = useState<{ rowId: number; header: string } | null>(null);
    
    // 🔥 Auto-save debounce
    const saveTimeoutRef = useRef<NodeJS.Timeout>();
    
    const availableClientsSet = useMemo(
        () => new Set(availableClients.map(c => c.toLowerCase())), 
        [availableClients]
    );

    const headers = useMemo(() => {
        if (!state.data || !state.data.length) return ['no'];
        const predefinedOrder = [
            'date', 'month', 'title', 'client_name', 'customer_name',
            'status', 'ticket_category', 'module', 'detail_module', 'created_at',
            'resolved_at', 'status_case_2', 'duration', 'ticket_op', 'note'
        ];
        
        const existingKeys = Object.keys(state.data[0]);
        const allConsideredKeys = [...new Set([...existingKeys, 'duration'])];
        const visibleKeys = allConsideredKeys.filter(key => !hiddenHeaders.includes(key) && key !== 'id');
        
        visibleKeys.sort((a, b) => {
            const indexA = predefinedOrder.indexOf(a);
            const indexB = predefinedOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        FILTER_COLUMNS = ['client_name', 'status', 'ticket_category', 'module', 'detail_module', 'month'];
        return ['no', ...visibleKeys];
    }, [state.data]);

    // Which filter columns are actually present in the current headers
    const visibleFilterColumns = useMemo(
        () => FILTER_COLUMNS.filter(col => headers.includes(col)),
        [headers]
    );

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        setIsProcessing(isPending || isSaving);
    }, [isPending, isSaving, setIsProcessing]);


    const initialColumnWidths = useCallback(() => {
        const widths: Record<string, number> = {
            no: 60, date: 120, month: 90, title: 350, client_name: 180,
            customer_name: 180, status: 140, ticket_category: 160, module: 150,
            detail_module: 200, created_at: 150, resolved_at: 150,
            status_case_2: 130, duration: 130, ticket_op: 150, note: 250,
        };
        
        headers.forEach(header => {
            if (!widths[header]) widths[header] = 120;
        });
        return widths;
    }, [headers]);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

    useEffect(() => {
        if (headers.length > 0) {
            setColumnWidths(initialColumnWidths());
        }
    }, [headers, initialColumnWidths]);

    const totalWidth = useMemo(() => Object.values(columnWidths).reduce((acc, width) => acc + width, 0), [columnWidths]);

    // ── Filter helpers ──────────────────────────────────────────
    const activeFilterCount = useMemo(
        () => Object.values(columnFilters).reduce((sum, arr) => sum + arr.length, 0) + (dateRange ? 1 : 0),
        [columnFilters, dateRange]
    );

    const setFilterForColumn = useCallback((column: string, values: string[]) => {
        setColumnFilters(prev => {
            const next = { ...prev };
            if (values.length === 0) {
                delete next[column];
            } else {
                next[column] = values;
            }
            return next;
        });
        // Reset to page 1 whenever a filter changes
        setCurrentPage(1);
    }, []);

    const clearAllFilters = useCallback(() => {
        setColumnFilters({});
        setDateRange(undefined);
        setCurrentPage(1);
    }, []);

    // Options map per filterable column
    const filterOptionsMap: Record<string, string[]> = useMemo(() => ({
        client_name: availableClients,
        status: ALL_STATUSES,
        ticket_category: ALL_CATEGORIES,
        module: ALL_MODULES,
        detail_module: ALL_DETAIL_MODULES,
        month: ALL_MONTHS,
    }), [availableClients]);

    // Render badge inside the filter dropdown list
    const renderFilterOption = useCallback((column: string) => {
        return (option: string) => {
            if (column === 'status') {
                return <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', statusColorMap[option] || statusColorMap.default)}>{option}</span>;
            }
            if (column === 'ticket_category') {
                return <span className={cn('px-2 py-0.5 rounded-full text-xs', categoryColorMap[option] || categoryColorMap.default)}>{option}</span>;
            }
            if (column === 'module') {
                return <span className={cn('px-2 py-0.5 rounded-full text-xs', moduleColorMap[option] || moduleColorMap.default)}>{option}</span>;
            }
            return <span className="truncate text-xs">{option}</span>;
        };
    }, []);
    // ── end filter helpers ──────────────────────────────────────
    
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
                month: columnFilters['month'],
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
                if (!dataResult.error) {
                    await refreshDashboardViews();
                    toast({ 
                        title: "Data Refreshed", 
                        description: `Loaded ${dataResult.data?.length || 0} rows.` 
                    });
                }
                setIsRefreshing(false);
            }
        });
    }, [yearFilter, dateRange, columnFilters, debouncedSearchTerm, currentPage, pageSize, toast]);

    useEffect(() => {
        fetchData();
    }, [yearFilter, dateRange, columnFilters, debouncedSearchTerm, currentPage, pageSize, fetchData]);
    
    const displayData = useMemo(() => {
        if (!state.data) return [];
        
        return state.data.map(row => {
            const newRow = {...row};
    
            const createdAtDate = row.created_at ? new Date(row.created_at) : null;
            const resolvedAtDate = row.resolved_at ? new Date(row.resolved_at) : null;
            
            if (createdAtDate && !isNaN(createdAtDate.getTime()) && resolvedAtDate && !isNaN(resolvedAtDate.getTime()) && resolvedAtDate > createdAtDate) {
                let diffMs = resolvedAtDate.getTime() - createdAtDate.getTime();
                const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                diffMs -= days * (1000 * 60 * 60 * 24);
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                diffMs -= hours * (1000 * 60 * 60);
                const minutes = Math.floor(diffMs / (1000 * 60));
                
                let durationString = '';
                if (days > 0) durationString += `${days}d `;
                if (hours > 0) durationString += `${hours}h `;
                if (minutes >= 0) durationString += `${minutes}m`;
                
                newRow.duration = durationString.trim();
            } else {
                newRow.duration = '';
            }

            const status = newRow.status?.toUpperCase();
            if (['L1', 'L2', 'L3', 'ON HOLD'].includes(status)) {
                const createdAtStr = row.created_at;
                if (createdAtStr) {
                    const createdAt = new Date(createdAtStr);
                    if (!isNaN(createdAt.getTime())) {
                        const now = new Date();
                        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const startOfCreatedAt = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
                        
                        const diffTime = startOfToday.getTime() - startOfCreatedAt.getTime();
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        
                        newRow.status_case_2 = diffDays + 1;
                    }
                }
            }
            
            return newRow;
        });
    }, [state.data]);

    const rowVirtualizer = useVirtualizer({
        count: displayData.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 48,
        overscan: 10,
    });

    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalRowHeight = rowVirtualizer.getTotalSize();

    // 🔥 Lazy cell editing handlers
    const handleCellClick = useCallback((rowId: number, header: string) => {
        if (rowId === 0) {
            setActiveCell(null);
        } else {
            setActiveCell({ rowId, header });
        }
    }, []);

    const handleCellChange = useCallback((id: number, header: string, value: string) => {
        setState(prevState => {
            if (!prevState.data) return prevState;
            
            const newData = prevState.data.map(row => {
                if (row.id === id) {
                    const updatedRow = { ...row, [header]: value };
                    
                    if (header === 'status') {
                        const isNowSolved = value === 'Solved' || value === 'RESOLVED';
                        const wasSolvedBefore = row.status === 'Solved' || row.status === 'RESOLVED';

                        if (isNowSolved && !wasSolvedBefore) {
                            updatedRow.resolved_at = new Date().toISOString();
                        } else if (!isNowSolved && wasSolvedBefore) {
                            updatedRow.resolved_at = '';
                        }
                    }
                    return updatedRow;
                }
                return row;
            });
            
            return { ...prevState, data: newData };
        });
    }, []);

    // 🔥 Auto-save with debounce
    const handleCellSave = useCallback((id: number) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            const rowToSave = state.data?.find(r => r.id === id);
            if (!rowToSave) return;

            setIsSaving(true);
            const result = await updateCase(id, rowToSave);
            
            if (result.success) {
                toast({ 
                    title: "Saved", 
                    description: "Changes saved automatically.",
                    duration: 2000 
                });
            } else {
                toast({ 
                    variant: "destructive",
                    title: "Save Failed", 
                    description: result.error 
                });
            }
            setIsSaving(false);
        }, 800); // Debounce 800ms
    }, [state.data, toast]);

    const handleExport = () => {
        if (!displayData || displayData.length === 0) {
            toast({
                variant: "destructive",
                title: "No Data to Export",
                description: "There is no data to display or export.",
            });
            return;
        }
        if (typeof XLSX === 'undefined') {
            toast({ variant: 'destructive', title: "Library Not Loaded" });
            return;
        }

        const exportHeaders = headers.map(h => headerDisplayMapping[h] || h);
        const dataForSheet = displayData.map(row => headers.map(header => row[header] ?? ''));
        const worksheet = XLSX.utils.aoa_to_sheet([exportHeaders, ...dataForSheet]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "All Cases");
        const date = new Date().toISOString().slice(0, 10);
        const filename = `All_Cases_${date}.xlsx`;
        XLSX.writeFile(workbook, filename);

        toast({
            title: "Export Successful",
            description: `${displayData.length} rows exported.`,
        });
    };

    if (!isClient) {
        return <div className="flex-1 p-8"><Skeleton className="h-[600px] w-full" /></div>;
    }


    return (
        <div className="flex-1 bg-background text-foreground px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3 md:px-8 md:pb-8 md:pt-4">
            <Card>
                <CardHeader>
                    {/* ── Row 1: Search + Action buttons ── */}
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
                        </div>
                        <div className="flex items-center gap-2">
                            {isSaving && (
                                <span className="text-xs text-muted-foreground flex items-center gap-2">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    Saving...
                                </span>
                            )}
                            <Button onClick={handleExport} size="sm" variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Export
                            </Button>
                            <Button onClick={() => fetchData(true)} size="sm" className="bg-blue-500 hover:bg-blue-600">
                                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* ── Row 2: Filter dropdowns ── */}
                    <div className="flex flex-wrap items-center gap-2 pt-3">
                        {visibleFilterColumns.map(col => (
                            <FilterDropdown
                                key={col}
                                label={headerDisplayMapping[col] || col}
                                options={filterOptionsMap[col] || []}
                                selected={columnFilters[col] || []}
                                onSelectionChange={(values) => setFilterForColumn(col, values)}
                                renderOption={renderFilterOption(col)}
                                onAddClient={col === 'client_name' ? () => {
                                    const trigger = document.querySelector('#add-client-dialog-trigger');
                                    if (trigger instanceof HTMLElement) trigger.click();
                                } : undefined}
                                availableClientsSet={col === 'client_name' ? availableClientsSet : undefined}
                            />
                        ))}
                        <AddClientDialog onClientAdded={(newClient) => {
                            setAvailableClients(prev => [...prev, newClient].sort((a,b) => a.localeCompare(b)));
                        }} />

                         <Popover open={isDatePopoverOpen} onOpenChange={(open) => {
                            if (open) {
                                setTempDateRange(dateRange);
                            }
                            setIsDatePopoverOpen(open);
                        }}>
                            <PopoverTrigger asChild>
                                <button
                                    className={cn(
                                        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                                        dateRange
                                            ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                                            : "bg-white dark:bg-slate-950 border-muted text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <CalendarIcon className="h-3 w-3" />
                                    <span>
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>
                                                    {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                                                </>
                                            ) : (
                                                format(dateRange.from, "LLL dd, y")
                                            )
                                        ) : (
                                            "Date Range"
                                        )}
                                    </span>
                                    <ChevronDown className="h-3 w-3" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={tempDateRange?.from ?? dateRange?.from}
                                    selected={tempDateRange}
                                    onSelect={setTempDateRange}
                                    numberOfMonths={2}
                                />
                                <div className="flex justify-end gap-2 p-3 border-t">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsDatePopoverOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setDateRange(undefined);
                                            setCurrentPage(1);
                                            setIsDatePopoverOpen(false);
                                        }}
                                    >
                                        Clear
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setDateRange(tempDateRange);
                                            setCurrentPage(1);
                                            setIsDatePopoverOpen(false);
                                        }}
                                    >
                                        Apply
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Clear-all button — only visible when something is active */}
                        {activeFilterCount > 0 && (
                            <button
                                onClick={clearAllFilters}
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                            >
                                <FilterX className="h-3 w-3" />
                                Clear All
                                <span className="ml-0.5 text-[10px] opacity-60">({activeFilterCount})</span>
                            </button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div ref={tableContainerRef} className="overflow-auto h-[75vh] border-t rounded-b-md">
                        {(!displayData || displayData.length === 0) ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center text-muted-foreground">
                                    <Database className="mx-auto h-12 w-12 mb-2" />
                                    <p>No data found.</p>
                                </div>
                            </div>
                        ) : (
                            <div style={{ width: `${totalWidth}px` }}>
                                <div className="sticky top-0 z-10 flex bg-muted">
                                    {headers.map(header => (
                                        <div
                                            key={header}
                                            className="h-12 px-4 flex items-center justify-center relative text-xs font-semibold"
                                            style={{ 
                                                width: columnWidths[header], 
                                                flexShrink: 0, 
                                                borderBottom: '1px solid hsl(var(--border))', 
                                                borderRight: '1px solid hsl(var(--border))' 
                                            }}
                                        >
                                            {headerDisplayMapping[header] || header}
                                            {/* Small filter-active indicator dot on column headers */}
                                            {columnFilters[header]?.length ? (
                                                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
                                            ) : null}
                                        </div>
                                    ))}
                                </div>

                                <div style={{ height: `${totalRowHeight}px`, position: 'relative' }}>
                                    {virtualRows.map((virtualRow) => {
                                        const row = displayData[virtualRow.index];
                                        const rowNumber = (currentPage - 1) * pageSize + virtualRow.index + 1;
                                        return (
                                            <div
                                                key={virtualRow.key}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: `${virtualRow.size}px`,
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                }}
                                            >
                                                <MemoizedRow
                                                    row={row}
                                                    headers={headers}
                                                    columnWidths={columnWidths}
                                                    rowNumber={rowNumber}
                                                    handleCellChange={handleCellChange}
                                                    handleCellSave={handleCellSave}
                                                    availableClients={availableClients}
                                                    availableClientsSet={availableClientsSet}
                                                    activeCell={activeCell}
                                                    onCellClick={handleCellClick}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="p-3 border-t">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex-1 text-sm text-muted-foreground">
                            Showing {totalRows > 0 ? ((currentPage - 1) * pageSize) + 1 : 0} to {Math.min(currentPage * pageSize, totalRows)} of {totalRows.toLocaleString()} rows
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm">Page {currentPage} of {totalPages || 1}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))}
                                disabled={currentPage >= (totalPages || 1)}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

