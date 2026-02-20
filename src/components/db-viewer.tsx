"use client";

import { Database, RefreshCw, Search, FilterX, ChevronLeft, ChevronRight, ChevronDown, Download, Check, UserPlus, Trash2, GripVertical, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useEffect, useState, useRef, useMemo, useCallback, useContext, MouseEvent, useTransition, memo } from "react";
import { TableDataContext } from "@/store/table-data-context";
import {
    getAllCaseData, updateCase, addClient, refreshDashboardViews, deleteCases,
    addCategory as addTicketCategory, addMasterStatus, addMasterModule, addMasterDetailModule,
    getMasterData, deleteMasterStatus, deleteMasterModule, deleteMasterDetailModule, deleteCategory,
} from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useDebounce } from 'use-debounce';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Skeleton } from "./ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectViewport, SelectScrollUpButton, SelectScrollDownButton } from "./ui/select";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";

declare const XLSX: any;

// ── Types ──────────────────────────────────────────────────

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

// ── Constants ──────────────────────────────────────────────

let FILTER_COLUMNS: string[] = [];

const headerDisplayMapping: Record<string, string> = {
    no: 'No', date: 'Date', month: 'Month', client_name: 'Client Name',
    customer_name: 'Customer Name', status: 'Status', ticket_category: 'Ticket Category',
    module: 'Module', detail_module: 'Detail Module', created_at: 'Created At',
    title: 'Title', resolved_at: 'Resolved At', ticket_op: 'Ticket OP',
    status_case_2: 'Umur Case', duration: 'Duration', note: 'Note',
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

const moduleColorMap: Record<string, string> = {
    'Payment': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'Perpustakaan': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    'Pesantren': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'Pintro Pay': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Boarding': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'Migrasi Data': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'default': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const ALL_CATEGORIES = ['Adjustment', 'Assistance', 'Bug Fixing', 'Enhancement', 'Parameter Setup', 'Q & A'];
const ALL_STATUSES = ['Solved', 'L3', 'L2', 'L1', 'PM', 'Move to Issue Tracker'];
const ALL_MODULES = ['PPDP/PMB', 'LMS/KBM', 'Administrasi Akademik', 'CBT', 'Penilaian/Raport', 'Payment', 'Perpustakaan', 'Pesantren', 'Pintro Pay', 'Boarding', 'Migrasi Data', 'Aplikasi/Mobile', 'Akses Portal'];
const ALL_DETAIL_MODULES = ['Payment - Angsuran', 'Payment - Daftar Ulang', 'Payment - Diskon', 'Payment - Double Bayar / Refund', 'Payment - Gagal Transaksi', 'Payment - Laporan / Selisih', 'Payment - Pintro Cash', 'Payment - SPPK', 'Payment - Tagihan tidak terupdate', 'Payment - Tambah Tagihan', 'Payment - Hapus Data', 'Payment - Update Tagihan', 'PPDB - Setup PPDB', 'PPDB - Jadwal PPDB', 'PPDB - Form Pendaftar', 'PPDB - Data Pendaftar', 'PPDB - Status Pendaftar', 'PPDB - Proses Kelulusan', 'PPDB - Ujian Online', 'PPDB - Laporan', 'LMS - Materi', 'LMS - Tugas', 'LMS - Ujian / Quiz', 'LMS - Absensi', 'LMS - Forum Diskusi', 'Akademik - Kalender Akademik', 'Akademik - Kurikulum', 'Akademik - Jadwal Pelajaran', 'Akademik - Data Siswa', 'Akademik - Data Guru', 'CBT - Bank Soal', 'CBT - Jadwal Ujian', 'CBT - Pelaksanaan Ujian', 'CBT - Hasil Ujian', 'Penilaian - Input Nilai', 'Penilaian - Proses Rapor', 'Penilaian - Cetak Rapor', 'Penilaian - Leger Nilai', 'Mobile - Notifikasi', 'Mobile - Login/Logout'];
const ALL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ── Helpers ────────────────────────────────────────────────

const formatDateDDMMYYYY = (s: string | null | undefined): string => {
    if (!s) return '-';
    try {
        const d = new Date(s);
        if (isNaN(d.getTime())) return '-';
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    } catch { return '-'; }
};

const formatDateTimeLocal = (s: string | null | undefined): string => {
    if (!s) return '-';
    try {
        const d = new Date(s);
        if (isNaN(d.getTime())) return '-';
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return '-'; }
};

// ── HeaderFilterPopover ────────────────────────────────────

const HeaderFilterPopover = memo(({
    label, options, selected, onSelectionChange, renderOption,
    showAddClient, onAddClient,
    showAdd, onAdd, addLabel,
    dbItemsMap, isEditMode, onDeleteItem,
}: {
    label: string;
    options: string[];
    selected: string[];
    onSelectionChange: (v: string[]) => void;
    renderOption?: (v: string) => React.ReactNode;
    showAddClient?: boolean;
    onAddClient?: () => void;
    showAdd?: boolean;
    onAdd?: (v: string) => Promise<void> | void;
    addLabel?: string;
    dbItemsMap?: Map<string, number>;
    isEditMode?: boolean;
    onDeleteItem?: (id: number, name: string) => Promise<void>;
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [newItemInput, setNewItemInput] = useState('');
    const [showInlineAdd, setShowInlineAdd] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const filteredOptions = useMemo(() =>
        !search ? options : options.filter(o => o.toLowerCase().includes(search.toLowerCase())),
        [options, search]
    );

    const toggleOption = (o: string) =>
        onSelectionChange(selected.includes(o) ? selected.filter(s => s !== o) : [...selected, o]);

    const handleAddInline = async () => {
        const t = newItemInput.trim();
        if (!t || !onAdd) return;
        await onAdd(t);
        setNewItemInput(''); setShowInlineAdd(false);
    };

    const handleDelete = async (e: React.MouseEvent, name: string) => {
        e.stopPropagation();
        if (!dbItemsMap || !onDeleteItem) return;
        const id = dbItemsMap.get(name);
        if (id === undefined) return;
        setDeletingId(id);
        await onDeleteItem(id, name);
        setDeletingId(null);
    };

    const hasActive = selected.length > 0;

    return (
        <Popover open={open} onOpenChange={v => {
            setOpen(v);
            if (!v) { setSearch(''); setShowInlineAdd(false); setNewItemInput(''); }
        }}>
            <PopoverTrigger asChild>
                <button className="inline-flex items-center justify-center gap-1 w-full h-full group">
                    <span className={cn("truncate text-xs font-semibold", hasActive && "text-primary")}>{label}</span>
                    <ChevronDown className={cn("h-3 w-3 flex-shrink-0 transition-all",
                        hasActive ? "text-primary opacity-100" : "text-muted-foreground opacity-50",
                        open && "rotate-180"
                    )} />
                    {hasActive && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>
            </PopoverTrigger>

            <PopoverContent className="w-[250px] p-0 shadow-lg" align="center">
                <Command>
                    {showAddClient && onAddClient && (
                        <div className="border-b p-1.5 sticky top-0 bg-popover z-10">
                            <Button onClick={() => { onAddClient(); setOpen(false); }} className="w-full h-7" size="sm" variant="outline">
                                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                                <span className="text-xs">Add New Client</span>
                            </Button>
                        </div>
                    )}

                    {showAdd && onAdd && (
                        <div className="border-b p-1.5 sticky top-0 bg-popover z-10">
                            {showInlineAdd ? (
                                <div className="flex gap-1">
                                    <Input
                                        autoFocus value={newItemInput}
                                        onChange={e => setNewItemInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleAddInline();
                                            if (e.key === 'Escape') { setShowInlineAdd(false); setNewItemInput(''); }
                                        }}
                                        placeholder={`New ${addLabel || 'item'}...`}
                                        className="h-7 text-xs flex-1 px-2"
                                    />
                                    <Button onClick={handleAddInline} size="sm" className="h-7 px-2" disabled={!newItemInput.trim()}>
                                        <Check className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <Button onClick={() => setShowInlineAdd(true)} className="w-full h-7" size="sm" variant="outline">
                                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                                    <span className="text-xs">Add {addLabel || 'New Item'}</span>
                                </Button>
                            )}
                        </div>
                    )}

                    <CommandInput placeholder="Search..." value={search} onValueChange={setSearch} className="text-xs h-8" />

                    <CommandList className="max-h-[220px]">
                        <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">No results.</CommandEmpty>
                        <CommandGroup>
                            {filteredOptions.map(option => {
                                const isSelected = selected.includes(option);
                                const isInDB = dbItemsMap ? dbItemsMap.has(option) : true;
                                const dbId = dbItemsMap?.get(option);
                                const isThisDeleting = deletingId !== null && deletingId === dbId;

                                return (
                                    <CommandItem
                                        key={option} value={option}
                                        onSelect={() => toggleOption(option)}
                                        className="flex items-center gap-2 text-xs cursor-pointer py-1.5 pr-1.5"
                                    >
                                        <div className={cn(
                                            "h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0",
                                            isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted bg-white dark:bg-slate-950"
                                        )}>
                                            {isSelected && <Check className="h-2.5 w-2.5" />}
                                        </div>

                                        <span className="flex-1 truncate min-w-0">
                                            {renderOption ? renderOption(option) : option}
                                        </span>

                                        <div className="flex-shrink-0 ml-1">
                                            {!isInDB ? (
                                                <span
                                                    title="Data belum di ditambahkan"
                                                    className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 border border-red-300 dark:border-red-700 leading-none select-none"
                                                >
                                                    ● data
                                                </span>
                                            ) : isEditMode && onDeleteItem ? (
                                                <button
                                                    onClick={e => handleDelete(e, option)}
                                                    disabled={isThisDeleting}
                                                    className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                                                    title={`Hapus "${option}" dari master DB`}
                                                >
                                                    {isThisDeleting
                                                        ? <RefreshCw className="h-3 w-3 animate-spin" />
                                                        : <Trash2 className="h-3 w-3" />
                                                    }
                                                </button>
                                            ) : null}
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>

                {options.length > 0 && (
                    <div className="border-t px-2 py-1.5 flex items-center justify-between">
                        <button
                            onClick={() => onSelectionChange(selected.length === options.length ? [] : [...options])}
                            className="text-xs text-primary hover:underline"
                        >
                            {selected.length === options.length ? 'Deselect All' : 'Select All'}
                        </button>
                        {hasActive && (
                            <button onClick={() => onSelectionChange([])} className="text-xs text-muted-foreground hover:text-destructive">
                                Clear
                            </button>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
});
HeaderFilterPopover.displayName = "HeaderFilterPopover";

// ── DateRangeHeaderPopover ─────────────────────────────────

const DateRangeHeaderPopover = memo(({ dateRange, onDateRangeChange }: {
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [temp, setTemp] = useState<DateRange | undefined>(undefined);
    const hasActive = !!dateRange?.from;
    return (
        <Popover open={open} onOpenChange={v => { if (v) setTemp(dateRange); setOpen(v); }}>
            <PopoverTrigger asChild>
                <button className="inline-flex items-center justify-center gap-1 w-full h-full group">
                    <span className={cn("truncate text-xs font-semibold", hasActive && "text-primary")}>Date</span>
                    <ChevronDown className={cn("h-3 w-3 flex-shrink-0 transition-all", hasActive ? "text-primary opacity-100" : "text-muted-foreground opacity-50", open && "rotate-180")} />
                    {hasActive && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 shadow-lg" align="start">
                <Calendar initialFocus mode="range" defaultMonth={temp?.from ?? dateRange?.from} selected={temp} onSelect={setTemp} numberOfMonths={2} />
                <div className="flex justify-end gap-2 p-3 border-t">
                    <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="outline" size="sm" onClick={() => { onDateRangeChange(undefined); setOpen(false); }}>Clear</Button>
                    <Button size="sm" onClick={() => { onDateRangeChange(temp); setOpen(false); }}>Apply</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
});
DateRangeHeaderPopover.displayName = "DateRangeHeaderPopover";

// ── AddClientDialog ────────────────────────────────────────

const AddClientDialog = memo(({ isOpen, onOpenChange, onClientAdded, existingClientsSet }: {
    isOpen: boolean; onOpenChange: (o: boolean) => void;
    onClientAdded: (name: string) => void; existingClientsSet?: Set<string>;
}) => {
    const [name, setName] = useState('');
    const [isSaving, startSaving] = useTransition();
    const { toast } = useToast();
    useEffect(() => { if (!isOpen) setName(''); }, [isOpen]);
    const handleSave = async () => {
        if (!name.trim()) return;
        if (existingClientsSet?.has(name.trim().toLowerCase())) {
            toast({ variant: "destructive", title: "Client Already Exists", description: `"${name.trim()}" already exists.` });
            return;
        }
        startSaving(async () => {
            const r = await addClient(name.trim());
            if (r.success && r.client) {
                toast({ title: "Client Added", description: `"${r.client.name}" has been added.` });
                onClientAdded(r.client.name); onOpenChange(false);
            } else { toast({ variant: "destructive", title: "Failed to Add Client", description: r.error }); }
        });
    };
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Client</DialogTitle>
                    <DialogDescription>Enter the name of the new client. This will be saved to the database.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="ncn" className="text-right">Name</Label>
                        <Input id="ncn" value={name} onChange={e => setName(e.target.value)} className="col-span-3" disabled={isSaving} />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isSaving || !name.trim() || existingClientsSet?.has(name.trim().toLowerCase())}>
                        {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : 'Save Client'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});
AddClientDialog.displayName = "AddClientDialog";

// ── LazyEditableCell ───────────────────────────────────────

const LazyEditableCell = memo(({
    header, value, rowId, rowNumber, columnWidth,
    onCellChange, onCellSave, availableClients, availableClientsSet,
    activeCell, onCellClick, isSelected, onToggleSelect, isEditMode,
}: {
    header: string; value: any; rowId: number; rowNumber: number; columnWidth: number;
    onCellChange: (id: number, h: string, v: string) => void;
    onCellSave: (id: number) => void;
    availableClients: string[]; availableClientsSet: Set<string>;
    activeCell: { rowId: number; header: string } | null;
    onCellClick: (rowId: number, h: string) => void;
    isSelected: boolean; onToggleSelect: (id: number) => void;
    isEditMode: boolean;
}) => {
    const [local, setLocal] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const isActive = activeCell?.rowId === rowId && activeCell?.header === header;
    const isEditable = isEditMode && !['no','date','month','created_at','resolved_at','status_case_2','duration'].includes(header);

    useEffect(() => { setLocal(value); }, [value]);
    useEffect(() => { if (isActive && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isActive]);

    const handleBlur = () => { if (local !== value) { onCellChange(rowId, header, local); onCellSave(rowId); } };
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); handleBlur(); onCellClick(0, ''); }
        else if (e.key === 'Escape') { setLocal(value); onCellClick(0, ''); }
    };

    const cellStyle = { width: columnWidth, flexShrink: 0, borderRight: '1px solid hsl(var(--border))' };
    const frozenStyle = header === 'no'
        ? { ...cellStyle, position: 'sticky' as const, left: 0, zIndex: 5, backgroundColor: 'hsl(var(--background))', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }
        : cellStyle;

    // ── No column ──
    if (header === 'no') return (
        <div
            className={cn("align-middle flex items-center justify-center border-r-2", isEditMode && "cursor-pointer hover:bg-accent/50", isSelected && "bg-primary/10")}
            style={frozenStyle}
            onClick={() => isEditMode && onToggleSelect(rowId)}
        >
            <div className="flex items-center gap-2">
                {isEditMode && (
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(rowId)}
                        onClick={e => e.stopPropagation()}
                    />
                )}
                <span className="truncate text-xs font-medium">{rowNumber}</span>
            </div>
        </div>
    );

    // ── Client name column ──
    if (header === 'client_name') {
        const str = (value as string) || '';
        const valid = availableClientsSet.has(str.toLowerCase());
        if (isActive && isEditMode) return (
            <div className="align-middle relative" style={cellStyle}>
                <Select value={local} onValueChange={v => { setLocal(v); onCellChange(rowId, header, v); onCellSave(rowId); onCellClick(0, ''); }} open onOpenChange={o => { if (!o) onCellClick(0, ''); }}>
                    <SelectTrigger className={cn("h-full w-full rounded-none border-2 border-primary bg-white dark:bg-slate-950 p-0 py-1 px-2 text-xs focus:ring-0", !valid && str && "text-destructive font-semibold")}>
                        <SelectValue placeholder="Select client..." />
                    </SelectTrigger>
                    <SelectContent><SelectScrollUpButton /><SelectViewport>{availableClients.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectViewport><SelectScrollDownButton /></SelectContent>
                </Select>
                {!valid && str && <div className="absolute top-0 right-0 w-0 h-0 border-solid border-t-red-500 border-l-transparent border-t-[8px] border-l-[8px]" />}
            </div>
        );
        return (
            <div className="align-middle relative cursor-pointer hover:bg-accent/50" style={cellStyle} onClick={() => isEditable && onCellClick(rowId, header)}>
                <div className="py-1 px-2 flex items-center h-full justify-center"><span className="truncate text-xs">{value || '-'}</span></div>
                {!valid && str && <div className="absolute top-0 right-0 w-0 h-0 border-solid border-t-red-500 border-l-transparent border-t-[8px] border-l-[8px]" />}
            </div>
        );
    }

    // ── Dropdown columns ──
    const isDropdown = ['status','ticket_category','module','detail_module'].includes(header);
    if (isDropdown && isActive && isEditMode) {
        const opts = header === 'ticket_category' ? ALL_CATEGORIES : header === 'status' ? ALL_STATUSES : header === 'module' ? ALL_MODULES : ALL_DETAIL_MODULES;
        return (
            <div className="align-middle" style={frozenStyle}>
                <Select value={local ?? ''} onValueChange={v => { setLocal(v); onCellChange(rowId, header, v); onCellSave(rowId); onCellClick(0, ''); }} open onOpenChange={o => { if (!o) onCellClick(0, ''); }}>
                    <SelectTrigger className="h-full w-full rounded-none border-2 border-primary bg-white dark:bg-slate-950 p-0 py-1 px-2 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{opts.map(o => (
                        <SelectItem key={o} value={o}>
                            {header === 'status' ? <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', statusColorMap[o] || statusColorMap.default)}>{o}</span>
                            : header === 'ticket_category' ? <span className={cn('px-2 py-0.5 rounded-full text-xs', categoryColorMap[o] || categoryColorMap.default)}>{o}</span>
                            : header === 'module' ? <span className={cn('px-2 py-0.5 rounded-full text-xs', moduleColorMap[o] || moduleColorMap.default)}>{o}</span>
                            : o}
                        </SelectItem>
                    ))}</SelectContent>
                </Select>
            </div>
        );
    }

    // ── Text input ──
    if (isEditable && isActive) return (
        <div className="align-middle" style={frozenStyle}>
            <Input ref={inputRef} type="text" value={local ?? ''} onChange={e => setLocal(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown} className="h-full w-full rounded-none border-2 border-primary bg-white dark:bg-slate-950 p-2 text-xs focus-visible:ring-0" />
        </div>
    );

    // ── Read-only display ──
    return (
        <div className={cn("align-middle", isEditable && "cursor-pointer hover:bg-accent/50")} style={frozenStyle} onClick={() => isEditable && onCellClick(rowId, header)}>
            <div className={cn("py-1 px-2 flex items-center h-full", !['title','note'].includes(header) && 'justify-center')}>
                {(() => {
                    if (header === 'date') return <span className="truncate text-xs">{formatDateDDMMYYYY(value)}</span>;
                    if (header === 'created_at' || header === 'resolved_at') return <span className="truncate text-xs">{formatDateTimeLocal(value)}</span>;
                    if (header === 'status_case_2' && value) { const age = Number(value); return <span className={cn('text-xs px-2 py-0.5 rounded-full font-mono', age > 3 ? 'bg-destructive text-destructive-foreground font-bold' : '')}>{age}</span>; }
                    if (header === 'duration' && value) return <span className="text-xs px-2 py-0.5 rounded-full font-mono">{value}</span>;
                    if (header === 'ticket_category' && value) return <span className={cn('text-xs px-2 py-0.5 rounded-full', categoryColorMap[value as string] || categoryColorMap.default)}>{value}</span>;
                    if (header === 'status' && value) return <span className={cn('text-xs inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-semibold', statusColorMap[value as string] || statusColorMap.default)}>{value}</span>;
                    if (header === 'module' && value) return <span className={cn('px-2 py-0.5 rounded-full text-xs', moduleColorMap[value] || moduleColorMap.default)}>{value}</span>;
                    if (header === 'title' && value) {
                        const m = String(value).match(/^(IHO-\d+)/);
                        if (m) { const t = m[0]; const rest = String(value).substring(t.length).trim(); return <span className="truncate text-xs"><a href={`https://pintro.atlassian.net/browse/${t}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{t}</a>{' '}{rest}</span>; }
                    }
                    return <span className="truncate text-xs">{value || '-'}</span>;
                })()}
            </div>
        </div>
    );
});
LazyEditableCell.displayName = "LazyEditableCell";

// ── MemoizedRow ────────────────────────────────────────────

const MemoizedRow = memo(({ row, headers, columnWidths, rowNumber, handleCellChange, handleCellSave, availableClients, availableClientsSet, activeCell, onCellClick, isSelected, onToggleSelect, isEditMode }: {
    row: any; headers: string[]; columnWidths: Record<string,number>; rowNumber: number;
    handleCellChange: (id: number, h: string, v: string) => void; handleCellSave: (id: number) => void;
    availableClients: string[]; availableClientsSet: Set<string>;
    activeCell: { rowId: number; header: string } | null; onCellClick: (id: number, h: string) => void;
    isSelected: boolean; onToggleSelect: (id: number) => void;
    isEditMode: boolean;
}) => (
    <div className={cn("flex border-b transition-colors hover:bg-muted/50 h-full", isSelected && "bg-primary/5")}>
        {headers.map(h => (
            <LazyEditableCell
                key={`${row.id}-${h}`} header={h} value={row[h]} rowId={row.id} rowNumber={rowNumber}
                columnWidth={columnWidths[h]} onCellChange={handleCellChange} onCellSave={handleCellSave}
                availableClients={availableClients} availableClientsSet={availableClientsSet}
                activeCell={activeCell} onCellClick={onCellClick}
                isSelected={isSelected} onToggleSelect={onToggleSelect}
                isEditMode={isEditMode}
            />
        ))}
    </div>
));
MemoizedRow.displayName = "MemoizedRow";

// ── DbViewer (main component) ──────────────────────────────

export function DbViewer({ initialData, initialSource, initialError, availableYears = [], availableClients: initialClients = [] }: DbViewerProps) {
    const { setIsProcessing } = useContext(TableDataContext);
    const [state, setState] = useState<DbViewerState>({ data: initialData, source: initialSource, error: initialError });
    const [isPending, startTransition] = useTransition();
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
    const [yearFilter, setYearFilter] = useState<string>('all');
    const [pageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isClient, setIsClient] = useState(false);
    const [availableClients, setAvailableClients] = useState<string[]>(() => {
        const seen = new Set<string>();
        return initialClients.filter(c => { const k = c.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    });
    const [isAddClientOpen, setIsAddClientOpen] = useState(false);
    const [activeCell, setActiveCell] = useState<{ rowId: number; header: string } | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout>();
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [resizingColumn, setResizingColumn] = useState<string | null>(null);
    const [startX, setStartX] = useState(0);
    const [startWidth, setStartWidth] = useState(0);

    const [statusOptions, setStatusOptions] = useState<string[]>(ALL_STATUSES);
    const [categoryOptions, setCategoryOptions] = useState<string[]>(ALL_CATEGORIES);
    const [moduleOptions, setModuleOptions] = useState<string[]>(ALL_MODULES);
    const [detailModuleOptions, setDetailModuleOptions] = useState<string[]>(ALL_DETAIL_MODULES);

    const [dbStatusMap, setDbStatusMap] = useState<Map<string, number>>(new Map());
    const [dbCategoryMap, setDbCategoryMap] = useState<Map<string, number>>(new Map());
    const [dbModuleMap, setDbModuleMap] = useState<Map<string, number>>(new Map());
    const [dbDetailModuleMap, setDbDetailModuleMap] = useState<Map<string, number>>(new Map());

    useEffect(() => {
        getMasterData().then(res => {
            if (!res.success || !res.data) return;
            const { statuses, categories, modules, detailModules } = res.data;
            setDbStatusMap(new Map(statuses.map(s => [s.name, s.id])));
            setDbCategoryMap(new Map(categories.map(c => [c.name, c.id])));
            setDbModuleMap(new Map(modules.map(m => [m.name, m.id])));
            setDbDetailModuleMap(new Map(detailModules.map(d => [d.name, d.id])));
            setStatusOptions(prev => [...new Set([...statuses.map(s => s.name), ...prev])]);
            setCategoryOptions(prev => [...new Set([...categories.map(c => c.name), ...prev])]);
            setModuleOptions(prev => [...new Set([...modules.map(m => m.name), ...prev])]);
            setDetailModuleOptions(prev => [...new Set([...detailModules.map(d => d.name), ...prev])]);
        });
    }, []);

    const availableClientsSet = useMemo(() => new Set(availableClients.map(c => c.toLowerCase())), [availableClients]);

    const allAvailableYears = useMemo(() => {
        const years = new Set(availableYears);
        state.data?.forEach(row => {
            if (row.date) { try { const y = new Date(row.date).getFullYear(); if (!isNaN(y)) years.add(String(y)); } catch {} }
        });
        return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
    }, [availableYears, state.data]);

    const headers = useMemo(() => {
        if (!state.data?.length) return ['no'];
        const order = ['date','month','title','client_name','customer_name','status','ticket_category','module','detail_module','created_at','resolved_at','status_case_2','duration','ticket_op','note'];
        const keys = [...new Set([...Object.keys(state.data[0]), 'duration'])].filter(k => !hiddenHeaders.includes(k) && k !== 'id');
        keys.sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); if (ia === -1 && ib === -1) return a.localeCompare(b); if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib; });
        FILTER_COLUMNS = ['client_name','status','ticket_category','module','detail_module','month'];
        // ✅ FIX: kolom 'no' selalu ada, tidak bergantung pada isEditMode
        return ['no', ...keys];
    }, [state.data]);

    const visibleFilterColumns = useMemo(() => FILTER_COLUMNS.filter(c => headers.includes(c)), [headers]);
    useEffect(() => { setIsClient(true); }, []);
    useEffect(() => { setIsProcessing(isPending || isSaving); }, [isPending, isSaving, setIsProcessing]);

    const initialColumnWidths = useCallback(() => {
        const w: Record<string,number> = { no:80, date:120, month:90, title:350, client_name:180, customer_name:180, status:140, ticket_category:160, module:150, detail_module:200, created_at:150, resolved_at:150, status_case_2:130, duration:130, ticket_op:150, note:250 };
        headers.forEach(h => { if (!w[h]) w[h] = 120; });
        return w;
    }, [headers]);

    const [columnWidths, setColumnWidths] = useState<Record<string,number>>({});
    useEffect(() => { if (headers.length > 0) setColumnWidths(initialColumnWidths()); }, [headers, initialColumnWidths]);
    const totalWidth = useMemo(() => Object.values(columnWidths).reduce((a, w) => a + w, 0), [columnWidths]);

    const handleResizeStart = useCallback((e: MouseEvent<HTMLDivElement>, h: string) => { e.preventDefault(); e.stopPropagation(); setResizingColumn(h); setStartX(e.clientX); setStartWidth(columnWidths[h]); }, [columnWidths]);
    const handleResizeMove = useCallback((e: globalThis.MouseEvent) => { if (!resizingColumn) return; setColumnWidths(p => ({ ...p, [resizingColumn]: Math.max(60, startWidth + (e.clientX - startX)) })); }, [resizingColumn, startX, startWidth]);
    const handleResizeEnd = useCallback(() => { setResizingColumn(null); }, []);
    useEffect(() => { if (resizingColumn) { document.addEventListener('mousemove', handleResizeMove); document.addEventListener('mouseup', handleResizeEnd); return () => { document.removeEventListener('mousemove', handleResizeMove); document.removeEventListener('mouseup', handleResizeEnd); }; } }, [resizingColumn, handleResizeMove, handleResizeEnd]);

    const activeFilterCount = useMemo(() => Object.values(columnFilters).reduce((s, a) => s + a.length, 0) + (dateRange ? 1 : 0) + (yearFilter !== 'all' ? 1 : 0), [columnFilters, dateRange, yearFilter]);
    const setFilterForColumn = useCallback((col: string, vals: string[]) => { setColumnFilters(p => { const n = {...p}; if (!vals.length) delete n[col]; else n[col] = vals; return n; }); setCurrentPage(1); }, []);
    const clearAllFilters = useCallback(() => { setColumnFilters({}); setDateRange(undefined); setCurrentPage(1); setYearFilter('all'); }, []);

    const filterOptionsMap = useMemo(() => ({
        client_name: availableClients, status: statusOptions, ticket_category: categoryOptions,
        module: moduleOptions, detail_module: detailModuleOptions, month: ALL_MONTHS,
    }), [availableClients, statusOptions, categoryOptions, moduleOptions, detailModuleOptions]);

    const dbItemsMapsForColumn = useMemo(() => ({
        status: dbStatusMap,
        ticket_category: dbCategoryMap,
        module: dbModuleMap,
        detail_module: dbDetailModuleMap,
    }), [dbStatusMap, dbCategoryMap, dbModuleMap, dbDetailModuleMap]);

    const renderFilterOption = useCallback((col: string) => (v: string) => {
        if (col === 'status') return <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', statusColorMap[v] || statusColorMap.default)}>{v}</span>;
        if (col === 'ticket_category') return <span className={cn('px-2 py-0.5 rounded-full text-xs', categoryColorMap[v] || categoryColorMap.default)}>{v}</span>;
        if (col === 'module') return <span className={cn('px-2 py-0.5 rounded-full text-xs', moduleColorMap[v] || moduleColorMap.default)}>{v}</span>;
        return <span className="truncate text-xs">{v}</span>;
    }, []);

    // ── Master ADD handlers ──────────────────────────────────

    const handleAddStatus = useCallback(async (value: string) => {
        const r = await addMasterStatus(value);
        if (r.success) {
            if (r.data?.id) setDbStatusMap(p => new Map(p).set(value, r.data.id));
            setStatusOptions(p => p.includes(value) ? p : [...p, value]);
            toast({ title: "Status Added", description: `"${value}" berhasil ditambahkan.`, duration: 2000 });
        } else toast({ variant: "destructive", title: "Gagal", description: r.error });
    }, [toast]);

    const handleAddCategory = useCallback(async (value: string) => {
        const r = await addTicketCategory(value);
        if (r.success) {
            if (r.category?.id) setDbCategoryMap(p => new Map(p).set(value, r.category!.id));
            setCategoryOptions(p => p.includes(value) ? p : [...p, value]);
            toast({ title: "Category Added", description: `"${value}" berhasil ditambahkan.`, duration: 2000 });
        } else toast({ variant: "destructive", title: "Gagal", description: r.error });
    }, [toast]);

    const handleAddModule = useCallback(async (value: string) => {
        const r = await addMasterModule(value);
        if (r.success) {
            if (r.data?.id) setDbModuleMap(p => new Map(p).set(value, r.data.id));
            setModuleOptions(p => p.includes(value) ? p : [...p, value]);
            toast({ title: "Module Added", description: `"${value}" berhasil ditambahkan.`, duration: 2000 });
        } else toast({ variant: "destructive", title: "Gagal", description: r.error });
    }, [toast]);

    const handleAddDetailModule = useCallback(async (value: string) => {
        const r = await addMasterDetailModule(value);
        if (r.success) {
            if (r.data?.id) setDbDetailModuleMap(p => new Map(p).set(value, r.data.id));
            setDetailModuleOptions(p => p.includes(value) ? p : [...p, value]);
            toast({ title: "Detail Module Added", description: `"${value}" berhasil ditambahkan.`, duration: 2000 });
        } else toast({ variant: "destructive", title: "Gagal", description: r.error });
    }, [toast]);

    // ── Master DELETE handler ────────────────────────────────

    const handleDeleteMasterItem = useCallback(async (column: string, id: number, name: string) => {
        let result: { success: boolean; error?: string };
        if (column === 'status') result = await deleteMasterStatus(id);
        else if (column === 'ticket_category') result = await deleteCategory(id);
        else if (column === 'module') result = await deleteMasterModule(id);
        else if (column === 'detail_module') result = await deleteMasterDetailModule(id);
        else return;

        if (result.success) {
            if (column === 'status') setDbStatusMap(p => { const m = new Map(p); m.delete(name); return m; });
            else if (column === 'ticket_category') setDbCategoryMap(p => { const m = new Map(p); m.delete(name); return m; });
            else if (column === 'module') setDbModuleMap(p => { const m = new Map(p); m.delete(name); return m; });
            else if (column === 'detail_module') setDbDetailModuleMap(p => { const m = new Map(p); m.delete(name); return m; });
            if (column === 'status') setStatusOptions(p => p.filter(o => o !== name));
            else if (column === 'ticket_category') setCategoryOptions(p => p.filter(o => o !== name));
            else if (column === 'module') setModuleOptions(p => p.filter(o => o !== name));
            else if (column === 'detail_module') setDetailModuleOptions(p => p.filter(o => o !== name));
            toast({ title: "Deleted", description: `"${name}" dihapus dari master DB.`, duration: 2000 });
        } else {
            toast({ variant: "destructive", title: "Gagal Hapus", description: result.error });
        }
    }, [toast]);

    // ── Data fetch ───────────────────────────────────────────

    const fetchData = useCallback(async () => {
        startTransition(async () => {
            const r = await getAllCaseData({
                year: yearFilter !== 'all' ? yearFilter : undefined, dateRange,
                category: columnFilters['ticket_category'], client: columnFilters['client_name'],
                module: columnFilters['module'], status: columnFilters['status'],
                detailModule: columnFilters['detail_module'], month: columnFilters['month'],
                search: debouncedSearchTerm || undefined, page: currentPage, pageSize,
            });
            if (r.error) { setState({ data: null, source: 'N/A', error: r.error }); setTotalRows(0); setTotalPages(0); }
            else {
                setState({ data: r.data || null, source: (r.source as any) || 'N/A', error: null });
                if (r.pagination) { setTotalRows(r.pagination.total); setTotalPages(r.pagination.totalPages); }
            }
        });
    }, [yearFilter, dateRange, columnFilters, debouncedSearchTerm, currentPage, pageSize]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Derived display data ─────────────────────────────────

    const displayData = useMemo(() => {
        if (!state.data) return [];
        return state.data.map(row => {
            const newRow = { ...row };
            const ca = row.created_at ? new Date(row.created_at) : null;
            const ra = row.resolved_at ? new Date(row.resolved_at) : null;
            if (ca && !isNaN(ca.getTime()) && ra && !isNaN(ra.getTime()) && ra > ca) {
                let ms = ra.getTime() - ca.getTime();
                const d = Math.floor(ms / 86400000); ms -= d * 86400000;
                const h = Math.floor(ms / 3600000); ms -= h * 3600000;
                const m = Math.floor(ms / 60000);
                newRow.duration = [d > 0 && `${d}d`, h > 0 && `${h}h`, `${m}m`].filter(Boolean).join(' ');
            } else { newRow.duration = ''; }
            const status = newRow.status?.toUpperCase();
            if (['L1','L2','L3','ON HOLD'].includes(status) && row.created_at) {
                const created = new Date(row.created_at);
                if (!isNaN(created.getTime())) {
                    const today = new Date(); today.setHours(0,0,0,0);
                    const cd = new Date(created); cd.setHours(0,0,0,0);
                    newRow.status_case_2 = Math.floor((today.getTime() - cd.getTime()) / 86400000) + 1;
                } else newRow.status_case_2 = '';
            } else newRow.status_case_2 = '';
            return newRow;
        });
    }, [state.data]);

    // ── Row selection ────────────────────────────────────────

    const handleToggleSelect = useCallback((id: number) => {
        setSelectedRows(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
    }, []);
    const handleSelectAll = useCallback(() => {
        setSelectedRows(p => p.size === displayData.length ? new Set() : new Set(displayData.map(r => r.id)));
    }, [displayData]);
    const handleBulkDelete = useCallback(async () => {
        if (!selectedRows.size) return;
        setIsBulkDeleting(true);
        const ids = Array.from(selectedRows);
        const r = await deleteCases(ids);
        if (r.success) {
            toast({ title: "Rows Deleted", description: `${ids.length} row(s) deleted.`, duration: 2000 });
            setState(p => ({ ...p, data: p.data?.filter(row => !selectedRows.has(row.id)) || null }));
            setTotalRows(p => p - ids.length); setSelectedRows(new Set());
        } else toast({ variant: "destructive", title: "Delete Failed", description: r.error });
        setIsBulkDeleting(false);
    }, [selectedRows, toast]);

    // ── Virtualizer ──────────────────────────────────────────

    const rv = useVirtualizer({ count: displayData.length, getScrollElement: () => tableContainerRef.current, estimateSize: () => 48, overscan: 10 });
    const virtualRows = rv.getVirtualItems();
    const totalRowHeight = rv.getTotalSize();

    // ── Cell edit ────────────────────────────────────────────

    const handleCellClick = useCallback((rowId: number, h: string) => { setActiveCell(rowId === 0 ? null : { rowId, header: h }); }, []);
    const handleCellChange = useCallback((id: number, h: string, v: string) => {
        setState(p => {
            if (!p.data) return p;
            return { ...p, data: p.data.map(row => {
                if (row.id !== id) return row;
                const u = { ...row, [h]: v };
                if (h === 'status') {
                    const nowSolved = v === 'Solved' || v === 'RESOLVED';
                    const wasSolved = row.status === 'Solved' || row.status === 'RESOLVED';
                    if (nowSolved && !wasSolved) u.resolved_at = new Date().toISOString();
                    else if (!nowSolved && wasSolved) u.resolved_at = '';
                }
                return u;
            })};
        });
    }, []);
    const handleCellSave = useCallback((id: number) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
            const row = state.data?.find(r => r.id === id);
            if (!row) return;
            setIsSaving(true);
            const r = await updateCase(id, row);
            if (r.success) toast({ title: "Saved", description: "Changes saved.", duration: 2000 });
            else toast({ variant: "destructive", title: "Save Failed", description: r.error });
            setIsSaving(false);
        }, 800);
    }, [state.data, toast]);
    const handleDeleteRow = useCallback((id: number) => { setDeleteConfirmId(id); }, []);
    const confirmDelete = useCallback(async () => {
        if (deleteConfirmId === null) return;
        setIsDeleting(true);
        const r = await deleteCases([deleteConfirmId]);
        if (r.success) {
            toast({ title: "Row Deleted", duration: 2000 });
            setState(p => ({ ...p, data: p.data?.filter(row => row.id !== deleteConfirmId) || null }));
            setTotalRows(p => p - 1);
        } else toast({ variant: "destructive", title: "Delete Failed", description: r.error });
        setIsDeleting(false); setDeleteConfirmId(null);
    }, [deleteConfirmId, toast]);

    // ── Export ───────────────────────────────────────────────

    const handleExport = () => {
        if (!displayData.length) { toast({ variant: "destructive", title: "No Data to Export" }); return; }
        if (typeof XLSX === 'undefined') { toast({ variant: 'destructive', title: "Library Not Loaded" }); return; }
        const eHeaders = headers.map(h => headerDisplayMapping[h] || h);
        const eData = displayData.map(row => headers.map(h => {
            const v = row[h];
            if ((h === 'created_at' || h === 'resolved_at') && v) return formatDateTimeLocal(v);
            if (h === 'date' && v) return formatDateDDMMYYYY(v);
            return v ?? '';
        }));
        const ws = XLSX.utils.aoa_to_sheet([eHeaders, ...eData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "All Cases");
        XLSX.writeFile(wb, `All_Cases_${new Date().toISOString().slice(0,10)}.xlsx`);
        toast({ title: "Export Successful", description: `${displayData.length} rows exported.` });
    };

    const FILTERABLE_SET = useMemo(() => new Set(visibleFilterColumns), [visibleFilterColumns]);

    if (!isClient) return <div className="flex-1 p-8"><Skeleton className="h-[600px] w-full" /></div>;

    return (
        <div className="flex-1 bg-background text-foreground px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3 md:px-8 md:pb-8 md:pt-4">
            <AddClientDialog isOpen={isAddClientOpen} onOpenChange={setIsAddClientOpen} existingClientsSet={availableClientsSet}
                onClientAdded={name => setAvailableClients(p => {
                    if (p.some(c => c.toLowerCase() === name.toLowerCase())) return p;
                    return [...p, name].sort((a,b) => a.localeCompare(b));
                })}
            />

            <Dialog open={deleteConfirmId !== null} onOpenChange={o => { if (!o) setDeleteConfirmId(null); }}>
                <DialogContent className="sm:max-w-[380px]">
                    <DialogHeader>
                        <DialogTitle>Delete Row</DialogTitle>
                        <DialogDescription>Apakah Anda yakin ingin menghapus row ini? Tindakan ini tidak dapat dibatalkan.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-row justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)} disabled={isDeleting}>Cancel</Button>
                        <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={isDeleting}>
                            {isDeleting ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input type="search" placeholder="Search all data..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 sm:w-[280px]" />
                            </div>
                            <Select value={yearFilter} onValueChange={setYearFilter}>
                                <SelectTrigger className="w-[120px] h-10"><SelectValue placeholder="Year" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Years</SelectItem>
                                    {allAvailableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {activeFilterCount > 0 && (
                                <button onClick={clearAllFilters} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap">
                                    <FilterX className="h-3 w-3" /> Clear ({activeFilterCount})
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {isSaving && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><RefreshCw className="h-3 w-3 animate-spin" /> Saving...</span>}
                            {isEditMode && selectedRows.size > 0 && (
                                <Button onClick={handleBulkDelete} size="sm" variant="destructive" disabled={isBulkDeleting}>
                                    {isBulkDeleting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete ({selectedRows.size})
                                </Button>
                            )}
                            <Button onClick={handleExport} size="sm" variant="outline"><Download className="mr-2 h-4 w-4" /> Export</Button>
                            <Button onClick={() => { setIsEditMode(p => !p); setSelectedRows(new Set()); }} size="sm" variant={isEditMode ? "default" : "outline"}>
                                <Pencil className="mr-2 h-4 w-4" />{isEditMode ? "Done" : "Edit"}
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div ref={tableContainerRef} className="overflow-auto h-[75vh] border-t rounded-b-md">
                        {!displayData.length ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center text-muted-foreground"><Database className="mx-auto h-12 w-12 mb-2" /><p>No data found.</p></div>
                            </div>
                        ) : (
                            <div style={{ width: `${totalWidth}px` }}>
                                {/* Sticky header */}
                                <div className="sticky top-0 z-10 flex bg-muted">
                                    {headers.map((header, idx) => {
                                        const isFilterable = FILTERABLE_SET.has(header);
                                        const isNoCol = header === 'no';
                                        const isDateCol = header === 'date';
                                        const isLast = idx === headers.length - 1;
                                        const hStyle: React.CSSProperties = isNoCol ? {
                                            width: columnWidths[header], flexShrink: 0,
                                            borderBottom: '1px solid hsl(var(--border))', borderRight: '2px solid hsl(var(--border))',
                                            position: 'sticky', left: 0, zIndex: 20,
                                            backgroundColor: 'hsl(var(--muted))', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.2)',
                                        } : { width: columnWidths[header], flexShrink: 0, borderBottom: '1px solid hsl(var(--border))', borderRight: '1px solid hsl(var(--border))' };

                                        return (
                                            <div key={header} className="h-12 flex items-center justify-center relative text-xs font-semibold group" style={hStyle}>
                                                {isNoCol ? (
                                                    <div className="flex items-center gap-2">
                                                        {isEditMode ? (
                                                            <div className="cursor-pointer" onClick={handleSelectAll}>
                                                                <Checkbox checked={selectedRows.size === displayData.length && displayData.length > 0} onCheckedChange={handleSelectAll} />
                                                            </div>
                                                        ) : null}
                                                        <span className="truncate text-xs font-semibold">No</span>
                                                    </div>
                                                ) : isDateCol ? (
                                                    <DateRangeHeaderPopover dateRange={dateRange} onDateRangeChange={r => { setDateRange(r); setCurrentPage(1); }} />
                                                ) : isFilterable ? (
                                                    <HeaderFilterPopover
                                                        label={headerDisplayMapping[header] || header}
                                                        options={(filterOptionsMap as any)[header] || []}
                                                        selected={columnFilters[header] || []}
                                                        onSelectionChange={v => setFilterForColumn(header, v)}
                                                        renderOption={renderFilterOption(header)}
                                                        showAddClient={header === 'client_name'}
                                                        onAddClient={header === 'client_name' ? () => setIsAddClientOpen(true) : undefined}
                                                        showAdd={['status','ticket_category','module','detail_module'].includes(header)}
                                                        addLabel={header === 'status' ? 'Status' : header === 'ticket_category' ? 'Category' : header === 'module' ? 'Module' : header === 'detail_module' ? 'Detail Module' : undefined}
                                                        onAdd={header === 'status' ? handleAddStatus : header === 'ticket_category' ? handleAddCategory : header === 'module' ? handleAddModule : header === 'detail_module' ? handleAddDetailModule : undefined}
                                                        dbItemsMap={(dbItemsMapsForColumn as any)[header]}
                                                        isEditMode={isEditMode}
                                                        onDeleteItem={['status','ticket_category','module','detail_module'].includes(header)
                                                            ? (id, name) => handleDeleteMasterItem(header, id, name)
                                                            : undefined}
                                                    />
                                                ) : (
                                                    <span className="truncate px-2">{headerDisplayMapping[header] || header}</span>
                                                )}
                                                {!isLast && !isNoCol && (
                                                    <div className={cn("absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors", resizingColumn === header && "bg-primary")}
                                                        onMouseDown={e => handleResizeStart(e, header)} title="Drag to resize">
                                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <GripVertical className="h-4 w-4 text-muted-foreground -ml-1.5" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Virtual rows */}
                                <div style={{ height: `${totalRowHeight}px`, position: 'relative' }}>
                                    {virtualRows.map(vr => {
                                        const row = displayData[vr.index];
                                        const rowNumber = (currentPage - 1) * pageSize + vr.index + 1;
                                        return (
                                            <div key={vr.key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${vr.size}px`, transform: `translateY(${vr.start}px)` }}>
                                                <MemoizedRow
                                                    row={row} headers={headers} columnWidths={columnWidths} rowNumber={rowNumber}
                                                    handleCellChange={handleCellChange} handleCellSave={handleCellSave}
                                                    availableClients={availableClients} availableClientsSet={availableClientsSet}
                                                    activeCell={activeCell} onCellClick={handleCellClick}
                                                    isSelected={selectedRows.has(row.id)} onToggleSelect={handleToggleSelect}
                                                    isEditMode={isEditMode}
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
                            Showing {totalRows > 0 ? (currentPage-1)*pageSize+1 : 0} to {Math.min(currentPage*pageSize, totalRows)} of {totalRows.toLocaleString()} rows
                            {selectedRows.size > 0 && <span className="ml-2 text-primary font-medium">({selectedRows.size} selected)</span>}
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                            <span className="text-sm">Page {currentPage} of {totalPages || 1}</span>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages||1, p+1))} disabled={currentPage >= (totalPages||1)}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}