//db-viewer1
"use client";

import {
    Database, RefreshCw, Search, FilterX, ChevronLeft, ChevronRight, ChevronDown,
    Download, Check, UserPlus, Trash2, GripVertical, Pencil,
    Eye, ArrowRight, AlertCircle, CheckCircle2, XCircle, Maximize2, Minimize2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
    useEffect, useState, useRef, useMemo, useCallback,
    useContext, MouseEvent, useTransition, memo,
} from "react";
import { TableDataContext } from "@/store/table-data-context";
import { SettingsContext } from "@/contexts/settings-provider";
import {
    getAllCaseData, updateCase, addClient, deleteCases,
    addCategory as addTicketCategory, addMasterStatus, addMasterModule, addMasterDetailModule,
    getMasterData, deleteMasterStatus, deleteMasterModule, deleteMasterDetailModule, deleteCategory,
    syncGSheetToDB,
} from "@/app/actions";
import { previewGSheetSync, type PreviewRow, type PreviewUpdateRow } from "@/app/preview-sync";
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
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";

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

interface CellOptions {
    status: string[];
    ticket_category: string[];
    module: string[];
    detail_module: string[];
}

// ── Constants ──────────────────────────────────────────────

let FILTER_COLUMNS: string[] = [];

const headerDisplayMapping: Record<string, string> = {
    no: 'No', date: 'Date', month: 'Month', client_name: 'Client Name',
    customer_name: 'Customer Name', status: 'Status', ticket_category: 'Category',
    module: 'Module', detail_module: 'Detail Module', created_at: 'Created At',
    title: 'Title', resolved_at: 'Resolved At', ticket_op: 'Ticket OP',
    status_case_2: 'Case Age', duration: 'Duration', note: 'Note',
};

const hiddenHeaders: string[] = ['ticket_number', 'url_jira', 'pic_client', 'checkout'];

const categoryColorMap: Record<string, string> = {
    'Bug Fixing':      'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/25 dark:text-red-300 dark:ring-red-800',
    'Q & A':           'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/25 dark:text-sky-300 dark:ring-sky-800',
    'Assistance':      'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/25 dark:text-violet-300 dark:ring-violet-800',
    'Parameter Setup': 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:ring-amber-800',
    'Enhancement':     'bg-rose-600 text-white ring-1 ring-rose-700 dark:bg-rose-700',
    'Adjustment':      'bg-blue-600 text-white ring-1 ring-blue-700 dark:bg-blue-700',
    'default':         'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-[#2e2e30] dark:text-[#c8c8cc] dark:ring-[#3a3a3c]',
};

const statusColorMap: Record<string, string> = {
    'Solved':  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:ring-emerald-800',
    'L3':      'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/25 dark:text-red-300 dark:ring-red-800',
    'L2':      'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/25 dark:text-blue-300 dark:ring-blue-800',
    'L1':      'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:ring-amber-800',
    'PM':      'bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-900/25 dark:text-teal-300 dark:ring-teal-800',
    'default': 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-[#2e2e30] dark:text-[#c8c8cc] dark:ring-[#3a3a3c]',
};

const moduleColorMap: Record<string, string> = {
    'Payment':      'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/25 dark:text-red-300 dark:ring-red-800',
    'Perpustakaan': 'bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-900/25 dark:text-teal-300 dark:ring-teal-800',
    'Pesantren':    'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/25 dark:text-blue-300 dark:ring-blue-800',
    'Pintro Pay':   'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:ring-amber-800',
    'Boarding':     'bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-900/25 dark:text-orange-300 dark:ring-orange-800',
    'Migrasi Data': 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/25 dark:text-violet-300 dark:ring-violet-800',
    'default':      'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-[#2e2e30] dark:text-[#c8c8cc] dark:ring-[#3a3a3c]',
};

const ALL_CATEGORIES     = ['Adjustment', 'Assistance', 'Bug Fixing', 'Enhancement', 'Parameter Setup', 'Q & A'];
const ALL_STATUSES       = ['Solved', 'L3', 'L2', 'L1', 'PM'];
const ALL_MODULES        = ['PPDP/PMB', 'LMS/KBM', 'Administrasi Akademik', 'CBT', 'Penilaian/Raport', 'Payment', 'Perpustakaan', 'Pesantren', 'Pintro Pay', 'Boarding', 'Migrasi Data', 'Aplikasi/Mobile', 'Akses Portal'];
const ALL_DETAIL_MODULES = ['Payment - Angsuran', 'Payment - Daftar Ulang', 'Payment - Diskon', 'Payment - Double Bayar / Refund', 'Payment - Gagal Transaksi', 'Payment - Laporan / Selisih', 'Payment - Pintro Cash', 'Payment - SPPK', 'Payment - Tagihan tidak terupdate', 'Payment - Tambah Tagihan', 'Payment - Hapus Data', 'Payment - Update Tagihan'];
const ALL_MONTHS         = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const UNSOLVED_STATUSES = ['L1', 'L2', 'L3', 'PM'];

// ── Helpers ────────────────────────────────────────────────

const formatDateDDMMYYYY = (s: string | null | undefined): string => {
    if (!s) return '-';
    try { const d = new Date(s); if (isNaN(d.getTime())) return '-'; return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; } catch { return '-'; }
};
const formatDateTimeLocal = (s: string | null | undefined): string => {
    if (!s) return '-';
    try { const d = new Date(s); if (isNaN(d.getTime())) return '-'; return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; } catch { return '-'; }
};

// ── SyncPreviewDialog ──────────────────────────────────────

interface SyncPreviewDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    previewRows: PreviewRow[];
    updateRows: PreviewUpdateRow[];
    updateCount: number;
    skippedCount: number;
    totalSheetRows: number;
    isConfirming: boolean;
    unmappedHeaders?: string[];
}

const SyncPreviewDialog = memo(function SyncPreviewDialog({
    open, onClose, onConfirm,
    previewRows, updateRows, updateCount, skippedCount, totalSheetRows,
    isConfirming, unmappedHeaders = [],
}: SyncPreviewDialogProps) {
    const newCount    = previewRows.length;
    const totalActions = newCount + updateCount;

    // ── Shared table header
    const TABLE_COLS = (showTypeBadge: boolean) => (
        <tr className="border-b">
            <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground w-6">#</th>
            {showTypeBadge && (
                <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Tipe</th>
            )}
            <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Ticket</th>
            <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Client</th>
            <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Status</th>
            <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Kategori</th>
            <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Modul</th>
            <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Detail Modul</th>
            <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Field Berubah</th>
        </tr>
    );

    // ── Shared table row renderer
    const TABLE_ROW = (row: any, i: number, type: 'insert' | 'update', showTypeBadge: boolean) => {
        // Untuk update: highlight field mana saja yang berubah
        const changedFields: string[] = type === 'update' ? (row.changedFields ?? []) : [];
        const isChanged = (field: string) => type === 'update' && changedFields.some(f =>
            f.toLowerCase() === field.toLowerCase()
        );

        return (
            <tr
                key={row.ticket_number ?? i}
                className={cn(
                    'border-b last:border-0 transition-colors hover:bg-primary/5',
                    i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                )}
            >
                <td className="py-2 px-3 text-muted-foreground text-xs">{i + 1}</td>

                {showTypeBadge && (
                    <td className="py-2 px-3">
                        <span className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded',
                            type === 'insert'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        )}>
                            {type === 'insert' ? 'NEW' : 'UPDATE'}
                        </span>
                    </td>
                )}

                {/* Ticket */}
                <td className="py-2 px-3">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded font-medium">
                        {row.ticket_number || '—'}
                    </span>
                </td>

                {/* Client — highlight jika berubah */}
                <td className={cn(
                    "py-2 px-3 text-xs font-medium max-w-[110px] truncate",
                    isChanged('Client') && "bg-blue-50 dark:bg-blue-950/30 rounded"
                )} title={row.client_name ?? ''}>
                    {row.client_name || '—'}
                </td>

                {/* Status — highlight jika berubah */}
                <td className={cn(
                    "py-2 px-3",
                    isChanged('Status') && "bg-blue-50 dark:bg-blue-950/30 rounded"
                )}>
                    {row.status_case ? (
                        <Badge
                            variant={row.status_case.toLowerCase() === 'solved' ? 'default' : 'secondary'}
                            className={cn(
                                'text-[10px] px-1.5 py-0',
                                row.status_case.toLowerCase() === 'solved' && 'bg-green-600 hover:bg-green-700'
                            )}
                        >
                            {row.status_case}
                        </Badge>
                    ) : '—'}
                </td>

                {/* Kategori — highlight jika berubah */}
                <td className={cn(
                    "py-2 px-3",
                    isChanged('Kategori') && "bg-blue-50 dark:bg-blue-950/30 rounded"
                )}>
                    {row.category_case ? (
                        <span className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap',
                            categoryColorMap[row.category_case] || categoryColorMap.default
                        )}>
                            {row.category_case}
                        </span>
                    ) : '—'}
                </td>

                {/* Modul — highlight jika berubah */}
                <td className={cn(
                    "py-2 px-3",
                    isChanged('Modul') && "bg-blue-50 dark:bg-blue-950/30 rounded"
                )}>
                    {row.module_case ? (
                        <span className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap',
                            moduleColorMap[row.module_case] || moduleColorMap.default
                        )}>
                            {row.module_case}
                        </span>
                    ) : '—'}
                </td>

                {/* Detail Modul — highlight jika berubah */}
                <td className={cn(
                    "py-2 px-3 text-xs text-muted-foreground max-w-[140px] truncate",
                    isChanged('Detail Modul') && "bg-blue-50 dark:bg-blue-950/30 rounded"
                )} title={row.detail_module ?? ''}>
                    {row.detail_module || '—'}
                </td>

                {/* Field Berubah — badge ringkas */}
                <td className="py-2 px-3">
                    {type === 'update' && changedFields.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {changedFields.map(f => (
                                <span
                                    key={f}
                                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 whitespace-nowrap"
                                >
                                    {f}
                                </span>
                            ))}
                        </div>
                    ) : type === 'insert' ? (
                        <span className="text-[10px] text-muted-foreground italic">baru</span>
                    ) : '—'}
                </td>
            </tr>
        );
    };

    // ── Render tabel tunggal
    const renderTable = (rows: any[], type: 'insert' | 'update') => (
        <ScrollArea className="h-[340px] rounded-lg border">
            <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    {TABLE_COLS(false)}
                </thead>
                <tbody>
                    {rows.map((row, i) => TABLE_ROW(row, i, type, false))}
                </tbody>
            </table>
        </ScrollArea>
    );

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-5xl w-full max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Eye className="h-5 w-5 text-primary" />
                        Preview Data Sebelum Sync
                    </DialogTitle>
                    <DialogDescription className="text-sm mt-1">
                        Periksa data di bawah sebelum di-insert ke database. Klik{' '}
                        <strong>Lanjut &amp; Sync</strong> untuk melanjutkan.
                    </DialogDescription>
                </DialogHeader>

                {/* ── Stats bar ── */}
                <div className="flex items-center gap-3 px-6 py-4 bg-muted/30 border-b flex-wrap">
                    <div className="flex items-center gap-2 rounded-lg bg-background border px-3 py-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Total GSheet</span>
                        <span className="text-sm font-bold">{totalSheetRows}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-700 dark:text-green-400">Akan Di-insert</span>
                        <span className="text-sm font-bold text-green-700 dark:text-green-400">{newCount}</span>
                    </div>
                    {updateCount > 0 && (
                        <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
                            <RefreshCw className="h-4 w-4 text-blue-600" />
                            <span className="text-xs text-blue-700 dark:text-blue-400">Akan Di-update</span>
                            <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{updateCount}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 rounded-lg bg-muted border px-3 py-2">
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Sudah Ada (Skip)</span>
                        <span className="text-sm font-bold">{skippedCount}</span>
                    </div>
                    {unmappedHeaders.length > 0 && (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 px-3 py-2 ml-auto">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <span className="text-xs text-amber-700 dark:text-amber-400">
                                Kolom tidak ter-map: {unmappedHeaders.join(', ')}
                            </span>
                        </div>
                    )}
                </div>

                {/* ── Table content ── */}
                <div className="flex-1 overflow-hidden px-6 py-4">
                    {newCount === 0 && updateCount === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center">
                            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                            <p className="font-semibold text-lg">Semua data sudah tersync!</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Tidak ada tiket baru dan tidak ada data yang perlu diperbarui.
                            </p>
                        </div>

                    ) : newCount === 0 && updateCount > 0 ? (
                        // Hanya update
                        <div className="flex flex-col gap-3 h-full">
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex-shrink-0">
                                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <p className="text-sm text-blue-700 dark:text-blue-400">
                                    <span className="font-semibold">{updateCount} tiket</span> memiliki perbedaan data yang akan diperbarui.
                                    Kolom yang berubah ditandai dengan badge biru.
                                </p>
                            </div>
                            {renderTable(updateRows, 'update')}
                        </div>

                    ) : newCount > 0 && updateCount > 0 ? (
                        // Insert + update gabungan
                        <div className="flex flex-col gap-3 h-full">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border flex-shrink-0 text-xs text-muted-foreground">
                                <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-bold px-1.5 py-0.5 rounded text-[10px]">NEW</span>
                                <span>{newCount} akan di-insert</span>
                                <span className="mx-1">·</span>
                                <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded text-[10px]">UPDATE</span>
                                <span>{updateCount} akan di-update</span>
                            </div>
                            <ScrollArea className="flex-1 rounded-lg border">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                                        {TABLE_COLS(true)}
                                    </thead>
                                    <tbody>
                                        {[
                                            ...previewRows.map(r => ({ ...r, _type: 'insert' as const })),
                                            ...updateRows.map(r  => ({ ...r, _type: 'update' as const })),
                                        ].map((row, i) => TABLE_ROW(row, i, row._type, true))}
                                    </tbody>
                                </table>
                            </ScrollArea>
                        </div>

                    ) : (
                        // Hanya insert
                        renderTable(previewRows, 'insert')
                    )}
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-muted/20 gap-2">
                    <Button variant="outline" onClick={onClose} disabled={isConfirming}>Batal</Button>
                    {totalActions > 0 && (
                        <Button onClick={onConfirm} disabled={isConfirming} className="gap-2 min-w-[140px]">
                            {isConfirming
                                ? <><RefreshCw className="h-4 w-4 animate-spin" />Menyimpan...</>
                                : <><CheckCircle2 className="h-4 w-4" />Lanjut &amp; Sync ({totalActions})</>
                            }
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});

// ── HeaderFilterPopover ────────────────────────────────────

const HeaderFilterPopover = memo(({
    label, options, selected, onSelectionChange, renderOption,
    showAddClient, onAddClient, showAdd, onAdd, addLabel,
    dbItemsMap, isEditMode, onDeleteItem,
}: {
    label: string; options: string[]; selected: string[];
    onSelectionChange: (v: string[]) => void;
    renderOption?: (v: string) => React.ReactNode;
    showAddClient?: boolean; onAddClient?: () => void;
    showAdd?: boolean; onAdd?: (v: string) => Promise<void> | void; addLabel?: string;
    dbItemsMap?: Map<string, number>; isEditMode?: boolean;
    onDeleteItem?: (id: number, name: string) => Promise<void>;
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [newItemInput, setNewItemInput] = useState('');
    const [showInlineAdd, setShowInlineAdd] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [staged, setStaged] = useState<string[]>(selected);

    const handleOpenChange = (v: boolean) => {
        if (v) { setStaged(selected); }
        else { setSearch(''); setShowInlineAdd(false); setNewItemInput(''); }
        setOpen(v);
    };

    const hasPendingChanges = useMemo(() => {
        if (staged.length !== selected.length) return true;
        const sortedStaged = [...staged].sort();
        const sortedSelected = [...selected].sort();
        return sortedStaged.some((v, i) => v !== sortedSelected[i]);
    }, [staged, selected]);

    const filteredOptions = useMemo(() =>
        !search ? options : options.filter(o => o.toLowerCase().includes(search.toLowerCase())),
        [options, search]
    );

    const toggleOption = (o: string) =>
        setStaged(prev => prev.includes(o) ? prev.filter(s => s !== o) : [...prev, o]);

    const handleApply = () => {
        onSelectionChange(staged);
        setOpen(false);
        setSearch('');
        setShowInlineAdd(false);
        setNewItemInput('');
    };

    const handleAddInline = async () => {
        const t = newItemInput.trim();
        if (!t || !onAdd) return;
        await onAdd(t); setNewItemInput(''); setShowInlineAdd(false);
    };

    const handleDelete = async (e: React.MouseEvent, name: string) => {
        e.stopPropagation();
        if (!dbItemsMap || !onDeleteItem) return;
        const id = dbItemsMap.get(name);
        if (id === undefined) return;
        setDeletingId(id); await onDeleteItem(id, name); setDeletingId(null);
    };

    const hasActive = selected.length > 0;
    const allStagedSelected = staged.length === options.length && options.length > 0;

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button className={cn("inline-flex items-center justify-center gap-1 w-full h-full px-2 rounded transition-colors", "hover:bg-slate-100 dark:hover:bg-[#2e2e30]", open && "bg-slate-100 dark:bg-[#2e2e30]")}>
                    <span className={cn("truncate text-[11px] font-semibold tracking-wide uppercase", hasActive ? "text-primary" : "text-slate-500 dark:text-[#909098]")}>{label}</span>
                    <ChevronDown className={cn("h-3 w-3 flex-shrink-0 transition-transform duration-150", hasActive ? "text-primary" : "text-slate-400", open && "rotate-180")} />
                    {hasActive && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary shadow-sm" />}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0 shadow-xl border-slate-200 dark:border-[#3a3a3c] rounded-xl overflow-hidden" align="center">
                <Command>
                    {showAddClient && onAddClient && (
                        <div className="border-b border-slate-100 dark:border-[#3a3a3c] p-2 bg-slate-50 dark:bg-[#242426]/80">
                            <Button onClick={() => { onAddClient(); setOpen(false); }} className="w-full h-8 text-xs font-medium" size="sm" variant="outline">
                                <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add New Client
                            </Button>
                        </div>
                    )}
                    {showAdd && onAdd && (
                        <div className="border-b border-slate-100 dark:border-[#3a3a3c] p-2 bg-slate-50 dark:bg-[#242426]/80">
                            {showInlineAdd ? (
                                <div className="flex gap-1.5">
                                    <Input autoFocus value={newItemInput} onChange={e => setNewItemInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddInline(); if (e.key === 'Escape') { setShowInlineAdd(false); setNewItemInput(''); } }} placeholder={`New ${addLabel || 'item'}...`} className="h-7 text-xs flex-1" />
                                    <Button onClick={handleAddInline} size="sm" className="h-7 px-2.5" disabled={!newItemInput.trim()}><Check className="h-3 w-3" /></Button>
                                </div>
                            ) : (
                                <Button onClick={() => setShowInlineAdd(true)} className="w-full h-8 text-xs font-medium" size="sm" variant="outline">
                                    <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add {addLabel || 'Item'}
                                </Button>
                            )}
                        </div>
                    )}
                    <CommandInput placeholder="Search..." value={search} onValueChange={setSearch} className="text-xs h-9 border-b border-slate-100 dark:border-[#3a3a3c]" />
                    <CommandList className="max-h-[220px]">
                        <CommandEmpty className="text-xs py-4 text-center text-slate-400">No results found.</CommandEmpty>
                        <CommandGroup>
                            {filteredOptions.map(option => {
                                const isStagedSelected = staged.includes(option);
                                const isInDB = dbItemsMap ? dbItemsMap.has(option) : true;
                                const dbId = dbItemsMap?.get(option);
                                const isThisDeleting = deletingId !== null && deletingId === dbId;
                                return (
                                    <CommandItem key={option} value={option} onSelect={() => toggleOption(option)} className={cn("flex items-center gap-2 text-xs cursor-pointer py-2 px-3 rounded-none", isStagedSelected && "bg-primary/5")}>
                                        <div className={cn("h-4 w-4 rounded border-[1.5px] flex items-center justify-center flex-shrink-0 transition-colors", isStagedSelected ? "bg-primary border-primary text-white" : "border-slate-300 dark:border-[#3a3a3c] bg-white dark:bg-[#1f1f21]")}>
                                            {isStagedSelected && <Check className="h-2.5 w-2.5" />}
                                        </div>
                                        <span className="flex-1 truncate min-w-0 font-medium">{renderOption ? renderOption(option) : option}</span>
                                        <div className="flex-shrink-0">
                                            {!isInDB ? (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-800">● missing</span>
                                            ) : isEditMode && onDeleteItem ? (
                                                <button onClick={e => handleDelete(e, option)} disabled={isThisDeleting} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40">
                                                    {isThisDeleting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                                </button>
                                            ) : null}
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
                <div className="border-t border-slate-100 dark:border-[#3a3a3c] px-3 py-2 flex items-center justify-between bg-slate-50 dark:bg-[#242426]/80 gap-2">
                    <div className="flex items-center gap-2">
                        {options.length > 0 && (
                            <button onClick={() => setStaged(allStagedSelected ? [] : [...options])} className="text-xs text-primary font-medium hover:underline">
                                {allStagedSelected ? 'Deselect All' : 'Select All'}
                            </button>
                        )}
                        {staged.length > 0 && (
                            <button onClick={() => setStaged([])} className="text-xs text-slate-400 hover:text-red-500 font-medium transition-colors">
                                Clear ({staged.length})
                            </button>
                        )}
                    </div>
                    <Button size="sm" onClick={handleApply} className={cn("h-7 px-3 text-xs font-semibold rounded-lg transition-all", hasPendingChanges ? "bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-sm" : "bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-[#2e2e30] dark:hover:bg-[#3a3a3c] dark:text-[#c8c8cc] border border-slate-200 dark:border-[#3a3a3c]")}>
                        {hasPendingChanges && <span className="mr-1 text-[10px]">●</span>}
                        Apply
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
});
HeaderFilterPopover.displayName = "HeaderFilterPopover";

// ── DateRangeHeaderPopover ─────────────────────────────────

const DateRangeHeaderPopover = memo(({ dateRange, onDateRangeChange }: { dateRange: DateRange | undefined; onDateRangeChange: (r: DateRange | undefined) => void }) => {
    const [open, setOpen] = useState(false);
    const [temp, setTemp] = useState<DateRange | undefined>(undefined);
    const hasActive = !!dateRange?.from;
    return (
        <Popover open={open} onOpenChange={v => { if (v) setTemp(dateRange); setOpen(v); }}>
            <PopoverTrigger asChild>
                <button className={cn("inline-flex items-center justify-center gap-1 w-full h-full px-2 rounded transition-colors", "hover:bg-slate-100 dark:hover:bg-[#2e2e30]", open && "bg-slate-100 dark:bg-[#2e2e30]")}>
                    <span className={cn("truncate text-[11px] font-semibold tracking-wide uppercase", hasActive ? "text-primary" : "text-slate-500 dark:text-[#909098]")}>Date</span>
                    <ChevronDown className={cn("h-3 w-3 flex-shrink-0 transition-transform duration-150", hasActive ? "text-primary" : "text-slate-400", open && "rotate-180")} />
                    {hasActive && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 shadow-xl border-slate-200 dark:border-[#3a3a3c] rounded-xl overflow-hidden" align="start">
                <Calendar initialFocus mode="range" defaultMonth={temp?.from ?? dateRange?.from} selected={temp} onSelect={setTemp} numberOfMonths={2} />
                <div className="flex justify-end gap-2 p-3 border-t border-slate-100 dark:border-[#3a3a3c] bg-slate-50 dark:bg-[#242426]/80">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => { onDateRangeChange(undefined); setOpen(false); }}>Clear</Button>
                    <Button size="sm" className="text-xs" onClick={() => { onDateRangeChange(temp); setOpen(false); }}>Apply Range</Button>
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
        if (existingClientsSet?.has(name.trim().toLowerCase())) { toast({ variant: "destructive", title: "Client Already Exists" }); return; }
        startSaving(async () => {
            const r = await addClient(name.trim());
            if (r.success && r.client) { toast({ title: "Client Added" }); onClientAdded(r.client.name); onOpenChange(false); }
            else toast({ variant: "destructive", title: "Failed", description: r.error });
        });
    };
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px] rounded-xl shadow-2xl">
                <DialogHeader><DialogTitle className="text-base font-semibold">Add New Client</DialogTitle></DialogHeader>
                <div className="space-y-1.5 py-2">
                    <Label htmlFor="ncn" className="text-sm font-medium">Client Name</Label>
                    <Input id="ncn" value={name} onChange={e => setName(e.target.value)} placeholder="Masukkan nama client..." className="h-10 text-sm" onKeyDown={e => e.key === 'Enter' && handleSave()} disabled={isSaving} />
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving || !name.trim()}>{isSaving && <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />}Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});
AddClientDialog.displayName = "AddClientDialog";

// ── SearchableComboboxCell ─────────────────────────────────

const SearchableComboboxCell = memo(({
    value, options, onSelect, onClose, placeholder, cellStyle, renderOption,
}: {
    value: string; options: string[]; onSelect: (v: string) => void;
    onClose: () => void; placeholder?: string;
    cellStyle: React.CSSProperties; renderOption?: (v: string) => React.ReactNode;
}) => {
    return (
        <div className="align-middle relative" style={cellStyle}>
            <Popover open onOpenChange={o => { if (!o) onClose(); }}>
                <PopoverTrigger asChild>
                    <button className="h-full w-full rounded-none border-2 border-primary bg-white dark:bg-[#1f1f21] px-3 text-xs text-left flex items-center gap-1 focus:outline-none min-h-[48px]">
                        <span className="flex-1 truncate text-slate-800 dark:text-[#e0e0e2]">
                            {value || <span className="text-slate-400">{placeholder || 'Pilih...'}</span>}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0 shadow-xl rounded-xl border-slate-200 dark:border-[#3a3a3c] overflow-hidden" align="start" side="bottom" sideOffset={2}>
                    <Command>
                        <CommandInput placeholder="Cari..." className="text-xs h-8 border-b border-slate-100 dark:border-[#3a3a3c]" autoFocus />
                        <CommandList className="max-h-[220px]">
                            <CommandEmpty className="text-xs py-3 text-center text-slate-400">Tidak ditemukan.</CommandEmpty>
                            <CommandGroup>
                                {options.map(o => (
                                    <CommandItem key={o} value={o} onSelect={() => onSelect(o)} className={cn('text-xs cursor-pointer py-1.5 px-3 flex items-center gap-2', value === o && 'bg-primary/10')}>
                                        <div className={cn('h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors', value === o ? 'bg-primary border-primary text-white' : 'border-slate-300 dark:border-[#3a3a3c] bg-white dark:bg-[#1f1f21]')}>
                                            {value === o && <Check className="h-2.5 w-2.5" />}
                                        </div>
                                        <span className="flex-1 truncate min-w-0">{renderOption ? renderOption(o) : o}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
});
SearchableComboboxCell.displayName = "SearchableComboboxCell";

// ── LazyEditableCell ───────────────────────────────────────

const LazyEditableCell = memo(({
    header, value, rowId, rowNumber, columnWidth,
    onCellChange, onCellSave, availableClients, availableClientsSet,
    activeCell, onCellClick, isSelected, onToggleSelect, isEditMode, cellOptions,
}: {
    header: string; value: any; rowId: number; rowNumber: number; columnWidth: number;
    onCellChange: (id: number, h: string, v: string) => void; onCellSave: (id: number) => void;
    availableClients: string[]; availableClientsSet: Set<string>;
    activeCell: { rowId: number; header: string } | null; onCellClick: (rowId: number, h: string) => void;
    isSelected: boolean; onToggleSelect: (id: number) => void; isEditMode: boolean;
    cellOptions: CellOptions;
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
    const frozenStyle = header === 'no' ? { ...cellStyle, position: 'sticky' as 'sticky', left: 0, zIndex: 5, backgroundColor: 'hsl(var(--background))', boxShadow: '2px 0 8px -2px rgba(0,0,0,0.08)', borderRight: '2px solid hsl(var(--border))' } : cellStyle;

    if (header === 'no') return (
        <div className={cn("align-middle flex items-center justify-center h-full transition-colors", isEditMode && "cursor-pointer", isSelected ? "bg-primary/8 dark:bg-primary/10" : isEditMode && "hover:bg-slate-50 dark:hover:bg-[#2e2e30]/70")} style={frozenStyle} onClick={() => isEditMode && onToggleSelect(rowId)}>
            <div className="flex items-center gap-2 px-2">
                {isEditMode && <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(rowId)} onClick={e => e.stopPropagation()} className="border-slate-300 dark:border-[#3a3a3c]" />}
                <span className="text-[11px] font-mono text-slate-400 dark:text-[#6e6e76] tabular-nums select-none">{rowNumber}</span>
            </div>
        </div>
    );

    if (header === 'client_name') {
        const str = (value as string) || '';
        const valid = availableClientsSet.has(str.toLowerCase());
        if (isActive && isEditMode) return (
            <SearchableComboboxCell value={local ?? ''} options={availableClients} placeholder="Pilih client..." cellStyle={cellStyle} onClose={() => onCellClick(0, '')} onSelect={v => { setLocal(v); onCellChange(rowId, header, v); onCellSave(rowId); onCellClick(0, ''); }} />
        );
        return (
            <div className={cn("align-middle relative h-full transition-colors", isEditable && "cursor-pointer hover:bg-slate-50 dark:hover:bg-[#2e2e30]/60")} style={cellStyle} onClick={() => isEditable && onCellClick(rowId, header)}>
                <div className="py-2 px-3 flex items-center h-full justify-center">
                    {value ? <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-md", valid ? "bg-slate-100 text-slate-700 dark:bg-[#2e2e30] dark:text-[#c8c8cc]" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400")}>{value}</span> : <span className="text-xs text-slate-300 dark:text-[#555559]">—</span>}
                </div>
            </div>
        );
    }

    const isSimpleDropdown = ['status', 'ticket_category'].includes(header);
    if (isSimpleDropdown && isActive && isEditMode) {
        const opts = header === 'ticket_category' ? cellOptions.ticket_category : cellOptions.status;
        return (
            <div className="align-middle" style={frozenStyle}>
                <Select value={local ?? ''} onValueChange={v => { setLocal(v); onCellChange(rowId, header, v); onCellSave(rowId); onCellClick(0, ''); }} open onOpenChange={o => { if (!o) onCellClick(0, ''); }}>
                    <SelectTrigger className="h-full w-full rounded-none border-2 border-primary bg-white dark:bg-[#1f1f21] px-2 text-xs focus:ring-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {opts.map(o => (
                            <SelectItem key={o} value={o} className="text-xs">
                                {header === 'status'
                                    ? <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', statusColorMap[o] || statusColorMap.default)}>{o}</span>
                                    : <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', categoryColorMap[o] || categoryColorMap.default)}>{o}</span>
                                }
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        );
    }

    if (header === 'module' && isActive && isEditMode) return (
        <SearchableComboboxCell value={local ?? ''} options={cellOptions.module} placeholder="Pilih module..." cellStyle={cellStyle} onClose={() => onCellClick(0, '')}
            renderOption={o => <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', moduleColorMap[o] || moduleColorMap.default)}>{o}</span>}
            onSelect={v => { setLocal(v); onCellChange(rowId, header, v); onCellSave(rowId); onCellClick(0, ''); }}
        />
    );

    if (header === 'detail_module' && isActive && isEditMode) return (
        <SearchableComboboxCell value={local ?? ''} options={cellOptions.detail_module} placeholder="Pilih detail module..." cellStyle={cellStyle} onClose={() => onCellClick(0, '')}
            onSelect={v => { setLocal(v); onCellChange(rowId, header, v); onCellSave(rowId); onCellClick(0, ''); }}
        />
    );

    if (isEditable && isActive) return (
        <div className="align-middle" style={frozenStyle}>
            <Input ref={inputRef} type="text" value={local ?? ''} onChange={e => setLocal(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown} className="h-full w-full rounded-none border-2 border-primary bg-white dark:bg-[#1f1f21] px-3 text-xs focus-visible:ring-0" />
        </div>
    );

    return (
        <div className={cn("align-middle h-full transition-colors", isEditable && "cursor-pointer hover:bg-slate-50 dark:hover:bg-[#2e2e30]/60")} style={frozenStyle} onClick={() => isEditable && onCellClick(rowId, header)}>
            <div className={cn("py-2 px-3 flex items-center h-full text-xs", !['title','note'].includes(header) && 'justify-center')}>
                {(() => {
                    if (header === 'date') return <span className="truncate font-mono text-[11px] text-slate-700 dark:text-[#c8c8cc] tabular-nums font-medium">{formatDateDDMMYYYY(value)}</span>;
                    if (header === 'created_at' || header === 'resolved_at') return <span className="truncate font-mono text-[11px] text-slate-600 dark:text-[#909098] tabular-nums">{formatDateTimeLocal(value)}</span>;
                    if (header === 'status_case_2' && value) { const age = Number(value); return <span className={cn('text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md tabular-nums', age > 7 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : age > 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-[#2e2e30] dark:text-[#909098]')}>{age}d</span>; }
                    if (header === 'duration' && value) return <span className="text-[11px] font-mono text-slate-700 dark:text-[#c8c8cc] tabular-nums font-medium">{value}</span>;
                    if (header === 'ticket_category' && value) return <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap', categoryColorMap[value as string] || categoryColorMap.default)}>{value}</span>;
                    if (header === 'status' && value) return <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap', statusColorMap[value as string] || statusColorMap.default)}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />{value}</span>;
                    if (header === 'module' && value) return <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap', moduleColorMap[value] || moduleColorMap.default)}>{value}</span>;
                    if (header === 'title' && value) {
                        const m = String(value).match(/^(IHO-\d+)/);
                        if (m) { const t = m[0]; const rest = String(value).substring(t.length).trim(); return <span className="truncate text-xs flex items-center gap-1.5"><a href={`https://pintro.atlassian.net/browse/${t}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className={cn("flex-shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded", "bg-primary/10 text-primary hover:bg-primary/20 transition-colors")}>{t}</a><span className="truncate text-slate-700 dark:text-[#c8c8cc] font-medium">{rest}</span></span>; }
                    }
                    return <span className="truncate text-xs text-slate-800 dark:text-[#e0e0e2] font-medium">{value || <span className="text-slate-300 dark:text-[#555559] font-normal">—</span>}</span>;
                })()}
            </div>
        </div>
    );
});
LazyEditableCell.displayName = "LazyEditableCell";

// ── MemoizedRow ────────────────────────────────────────────

const MemoizedRow = memo(({ row, headers, columnWidths, rowNumber, handleCellChange, handleCellSave, availableClients, availableClientsSet, activeCell, onCellClick, isSelected, onToggleSelect, isEditMode, cellOptions }: {
    row: any; headers: string[]; columnWidths: Record<string,number>; rowNumber: number;
    handleCellChange: (id: number, h: string, v: string) => void; handleCellSave: (id: number) => void;
    availableClients: string[]; availableClientsSet: Set<string>;
    activeCell: { rowId: number; header: string } | null; onCellClick: (id: number, h: string) => void;
    isSelected: boolean; onToggleSelect: (id: number) => void; isEditMode: boolean;
    cellOptions: CellOptions;
}) => (
    <div className={cn("flex border-b border-slate-100 dark:border-[#3a3a3c] transition-colors h-full", isSelected ? "bg-primary/5 dark:bg-primary/8" : "hover:bg-slate-50/80 dark:hover:bg-[#2e2e30]/40")}>
        {headers.map(h => (
            <LazyEditableCell key={`${row.id}-${h}`} header={h} value={row[h]} rowId={row.id} rowNumber={rowNumber} columnWidth={columnWidths[h]} onCellChange={handleCellChange} onCellSave={handleCellSave} availableClients={availableClients} availableClientsSet={availableClientsSet} activeCell={activeCell} onCellClick={onCellClick} isSelected={isSelected} onToggleSelect={onToggleSelect} isEditMode={isEditMode} cellOptions={cellOptions} />
        ))}
    </div>
));
MemoizedRow.displayName = "MemoizedRow";

// ── DbViewer ───────────────────────────────────────────────

export function DbViewer({ initialData, initialSource, initialError, availableYears = [], availableClients: initialClients = [] }: DbViewerProps) {
    const { setIsProcessing } = useContext(TableDataContext);
    const { verifiedUrl, sheetUrl: contextSheetUrl } = useContext(SettingsContext);

    const [state, setState] = useState<DbViewerState>({ data: initialData, source: initialSource, error: initialError });
    const [isPending, startTransition] = useTransition();
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

    const [yearFilter, setYearFilter] = useState<string>(() => {
        if (availableYears.length > 0) {
            return [...availableYears].sort((a, b) => parseInt(b) - parseInt(a))[0];
        }
        return 'all';
    });

    const [showUnsolvedOnly, setShowUnsolvedOnly] = useState(false);
    const [pageSize, setPageSize] = useState(50);
    const [pageSizeInput, setPageSizeInput] = useState('50');
    const [isFullscreen, setIsFullscreen] = useState(false);
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
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isEditConfirmOpen, setIsEditConfirmOpen] = useState(false);
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

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isFetchingPreview, setIsFetchingPreview] = useState(false);
    const [isConfirmingSync, setIsConfirmingSync] = useState(false);
    const [previewData, setPreviewData] = useState<{
        rows: PreviewRow[];
        updateRows: PreviewUpdateRow[];
        skippedCount: number;
        totalSheetRows: number;
        unmappedHeaders: string[];
    } | null>(null);

    const stateDataRef = useRef(state.data);
    useEffect(() => { stateDataRef.current = state.data; }, [state.data]);

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
            setDetailModuleOptions(detailModules.map(d => d.name));
        });
    }, []);

    const availableClientsSet = useMemo(() => new Set(availableClients.map(c => c.toLowerCase())), [availableClients]);
    const allAvailableYears = useMemo(() => {
        const years = new Set(availableYears);
        state.data?.forEach(row => { if (row.date) { try { const y = new Date(row.date).getFullYear(); if (!isNaN(y)) years.add(String(y)); } catch {} } });
        return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
    }, [availableYears, state.data]);

    const headers = useMemo(() => {
        if (!state.data?.length) return ['no'];
        const order = ['date','month','title','client_name','customer_name','status','ticket_category','module','detail_module','created_at','resolved_at','status_case_2','duration','ticket_op','note'];
        const keys = [...new Set([...Object.keys(state.data[0]), 'duration'])].filter(k => !hiddenHeaders.includes(k) && k !== 'id');
        keys.sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); if (ia === -1 && ib === -1) return a.localeCompare(b); if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib; });
        FILTER_COLUMNS = ['client_name','status','ticket_category','module','detail_module','month'];
        return ['no', ...keys];
    }, [state.data]);

    const visibleFilterColumns = useMemo(() => FILTER_COLUMNS.filter(c => headers.includes(c)), [headers]);
    useEffect(() => { setIsClient(true); }, []);
    useEffect(() => { setIsProcessing(isPending || isSaving); }, [isPending, isSaving, setIsProcessing]);

    const initialColumnWidths = useCallback(() => {
        const w: Record<string,number> = { no: 72, date: 110, month: 90, title: 360, client_name: 160, customer_name: 170, status: 140, ticket_category: 155, module: 150, detail_module: 210, created_at: 140, resolved_at: 140, status_case_2: 110, duration: 110, ticket_op: 130, note: 250 };
        headers.forEach(h => { if (!w[h]) w[h] = 120; });
        return w;
    }, [headers]);

    const [columnWidths, setColumnWidths] = useState<Record<string,number>>({});
    useEffect(() => { if (headers.length > 0) setColumnWidths(initialColumnWidths()); }, [headers, initialColumnWidths]);
    const totalWidth = useMemo(() => Object.values(columnWidths).reduce((a, w) => a + w, 0), [columnWidths]);

    const handleResizeStart = useCallback((e: MouseEvent<HTMLDivElement>, h: string) => { e.preventDefault(); e.stopPropagation(); setResizingColumn(h); setStartX(e.clientX); setStartWidth(columnWidths[h]); }, [columnWidths]);
    const handleResizeMove = useCallback((e: globalThis.MouseEvent) => { if (!resizingColumn) return; setColumnWidths(p => ({ ...p, [resizingColumn]: Math.max(60, startWidth + (e.clientX - startX)) })); }, [resizingColumn, startX, startWidth]);
    const handleResizeEnd = useCallback(() => { setResizingColumn(null); }, []);
    useEffect(() => {
        if (resizingColumn) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
            return () => { document.removeEventListener('mousemove', handleResizeMove); document.removeEventListener('mouseup', handleResizeEnd); };
        }
    }, [resizingColumn, handleResizeMove, handleResizeEnd]);

    const effectiveStatus = useMemo<string[] | undefined>(() => {
        if ((columnFilters['status'] ?? []).length > 0) return columnFilters['status'];
        if (showUnsolvedOnly) return UNSOLVED_STATUSES;
        return undefined;
    }, [columnFilters, showUnsolvedOnly]);

    const isUnsolvedOnlyActive = showUnsolvedOnly && (columnFilters['status'] ?? []).length === 0;

    const activeFilterCount = useMemo(() =>
        Object.values(columnFilters).reduce((s, a) => s + a.length, 0)
        + (dateRange ? 1 : 0)
        + (yearFilter !== 'all' ? 1 : 0),
        [columnFilters, dateRange, yearFilter]
    );

    const setFilterForColumn = useCallback((col: string, vals: string[]) => { setColumnFilters(p => { const n = {...p}; if (!vals.length) delete n[col]; else n[col] = vals; return n; }); setCurrentPage(1); }, []);
    const clearAllFilters = useCallback(() => { setColumnFilters({}); setDateRange(undefined); setCurrentPage(1); setYearFilter('all'); setShowUnsolvedOnly(false); }, []);

    const filterOptionsMap = useMemo(() => ({ client_name: availableClients, status: statusOptions, ticket_category: categoryOptions, module: moduleOptions, detail_module: detailModuleOptions, month: ALL_MONTHS }), [availableClients, statusOptions, categoryOptions, moduleOptions, detailModuleOptions]);
    const dbItemsMapsForColumn = useMemo(() => ({ status: dbStatusMap, ticket_category: dbCategoryMap, module: dbModuleMap, detail_module: dbDetailModuleMap }), [dbStatusMap, dbCategoryMap, dbModuleMap, dbDetailModuleMap]);
    const renderFilterOption = useCallback((col: string) => (v: string) => {
        if (col === 'status') return <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold', statusColorMap[v] || statusColorMap.default)}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{v}</span>;
        if (col === 'ticket_category') return <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', categoryColorMap[v] || categoryColorMap.default)}>{v}</span>;
        if (col === 'module') return <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', moduleColorMap[v] || moduleColorMap.default)}>{v}</span>;
        return <span className="text-xs">{v}</span>;
    }, []);

    const handleAddStatus       = useCallback(async (value: string) => { const r = await addMasterStatus(value);      if (r.success) { if (r.data?.id)     setDbStatusMap(p => new Map(p).set(value, r.data.id));      setStatusOptions(p => p.includes(value) ? p : [...p, value]); } }, []);
    const handleAddCategory     = useCallback(async (value: string) => { const r = await addTicketCategory(value);   if (r.success) { if (r.category?.id) setDbCategoryMap(p => new Map(p).set(value, r.category!.id)); setCategoryOptions(p => p.includes(value) ? p : [...p, value]); } }, []);
    const handleAddModule       = useCallback(async (value: string) => { const r = await addMasterModule(value);     if (r.success) { if (r.data?.id)     setDbModuleMap(p => new Map(p).set(value, r.data.id));      setModuleOptions(p => p.includes(value) ? p : [...p, value]); } }, []);
    const handleAddDetailModule = useCallback(async (value: string) => { const r = await addMasterDetailModule(value); if (r.success) { if (r.data?.id)   setDbDetailModuleMap(p => new Map(p).set(value, r.data.id)); setDetailModuleOptions(p => p.includes(value) ? p : [...p, value]); } }, []);

    const handleDeleteMasterItem = useCallback(async (column: string, id: number, name: string) => {
        let result: { success: boolean; error?: string };
        if (column === 'status')        result = await deleteMasterStatus(id);
        else if (column === 'ticket_category') result = await deleteCategory(id);
        else if (column === 'module')   result = await deleteMasterModule(id);
        else if (column === 'detail_module') result = await deleteMasterDetailModule(id);
        else return;
        if (result.success) {
            if (column === 'status')             { setDbStatusMap(p => { const m = new Map(p); m.delete(name); return m; }); setStatusOptions(p => p.filter(o => o !== name)); }
            else if (column === 'ticket_category') { setDbCategoryMap(p => { const m = new Map(p); m.delete(name); return m; }); setCategoryOptions(p => p.filter(o => o !== name)); }
            else if (column === 'module')          { setDbModuleMap(p => { const m = new Map(p); m.delete(name); return m; }); setModuleOptions(p => p.filter(o => o !== name)); }
            else if (column === 'detail_module')   { setDbDetailModuleMap(p => { const m = new Map(p); m.delete(name); return m; }); setDetailModuleOptions(p => p.filter(o => o !== name)); }
        }
    }, []);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const r = await getAllCaseData({
                year: yearFilter !== 'all' ? yearFilter : undefined,
                dateRange, category: columnFilters['ticket_category'], client: columnFilters['client_name'],
                module: columnFilters['module'], status: effectiveStatus, detailModule: columnFilters['detail_module'],
                month: columnFilters['month'], search: debouncedSearchTerm || undefined,
                page: currentPage, pageSize,
            });
            if (r.error) { setState({ data: null, source: 'N/A', error: r.error }); setTotalRows(0); setTotalPages(0); }
            else { setState({ data: r.data || null, source: (r.source as any) || 'N/A', error: null }); if (r.pagination) { setTotalRows(r.pagination.total); setTotalPages(r.pagination.totalPages); } }
        });
    }, [yearFilter, dateRange, columnFilters, debouncedSearchTerm, currentPage, pageSize, effectiveStatus]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSyncNowClick = useCallback(async () => {
        const targetUrl = verifiedUrl || contextSheetUrl;
        if (!targetUrl) {
            toast({ variant: 'destructive', title: 'URL belum diset', description: 'Silakan atur URL Google Sheet di halaman Settings terlebih dahulu.' });
            return;
        }
        setIsFetchingPreview(true);
        try {
            const result = await previewGSheetSync(targetUrl);
            if (!result.success) { toast({ variant: 'destructive', title: 'Gagal Fetch Preview', description: result.error }); return; }
            setPreviewData({
                rows: result.toInsert ?? [],
                updateRows: result.toUpdate ?? [],
                skippedCount: result.skippedCount ?? 0,
                totalSheetRows: result.totalSheetRows ?? 0,
                unmappedHeaders: result.unmappedHeaders ?? [],
            });
            setIsPreviewOpen(true);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsFetchingPreview(false);
        }
    }, [verifiedUrl, contextSheetUrl, toast]);

    const handleConfirmSync = useCallback(async () => {
        const targetUrl = verifiedUrl || contextSheetUrl;
        if (!targetUrl) return;
        setIsConfirmingSync(true);
        try {
            const res = await syncGSheetToDB(targetUrl);
            if (res.success) {
                const parts: string[] = [];
                if ((res.inserted ?? 0) > 0) parts.push(`${res.inserted} baris baru`);
                if ((res.updated  ?? 0) > 0) parts.push(`${res.updated} diperbarui`);
                if ((res.skipped  ?? 0) > 0) parts.push(`${res.skipped} dilewati`);
                toast({ title: '✅ Sync Selesai', description: parts.length > 0 ? parts.join(', ') + '.' : 'Semua data sudah tersinkronisasi.' });
                setIsPreviewOpen(false);
                setPreviewData(null);
                fetchData();
            } else {
                toast({ variant: 'destructive', title: 'Sync Gagal', description: res.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Sync Error', description: e.message });
        } finally {
            setIsConfirmingSync(false);
        }
    }, [verifiedUrl, contextSheetUrl, toast, fetchData]);

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
                if (!isNaN(created.getTime())) { const today = new Date(); today.setHours(0,0,0,0); const cd = new Date(created); cd.setHours(0,0,0,0); newRow.status_case_2 = Math.floor((today.getTime() - cd.getTime()) / 86400000) + 1; } else newRow.status_case_2 = '';
            } else newRow.status_case_2 = '';
            return newRow;
        });
    }, [state.data]);

    const cellOptions = useMemo<CellOptions>(() => ({
        status: statusOptions, ticket_category: categoryOptions,
        module: moduleOptions, detail_module: detailModuleOptions,
    }), [statusOptions, categoryOptions, moduleOptions, detailModuleOptions]);

    const handleToggleSelect = useCallback((id: number) => { setSelectedRows(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; }); }, []);
    const handleSelectAll    = useCallback(() => { setSelectedRows(p => p.size === displayData.length ? new Set() : new Set(displayData.map(r => r.id))); }, [displayData]);
    const handleBulkDelete   = useCallback(async () => {
        if (!selectedRows.size) return;
        setIsBulkDeleting(true);
        const ids = Array.from(selectedRows);
        const r = await deleteCases(ids);
        if (r.success) { toast({ title: "Rows Deleted", description: `${ids.length} row(s) berhasil dihapus.` }); setState(p => ({ ...p, data: p.data?.filter(row => !selectedRows.has(row.id)) || null })); setTotalRows(p => p - ids.length); setSelectedRows(new Set()); }
        else toast({ variant: "destructive", title: "Delete Failed", description: r.error });
        setIsBulkDeleting(false);
    }, [selectedRows, toast]);

    const rv = useVirtualizer({ count: displayData.length, getScrollElement: () => tableContainerRef.current, estimateSize: () => 48, overscan: 10 });
    const virtualRows = rv.getVirtualItems();
    const totalRowHeight = rv.getTotalSize();

    const handleCellClick  = useCallback((rowId: number, h: string) => { setActiveCell(rowId === 0 ? null : { rowId, header: h }); }, []);
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
            const row = stateDataRef.current?.find(r => r.id === id);
            if (!row) return;
            setIsSaving(true);
            const r = await updateCase(id, row);
            if (r.success) toast({ title: "Tersimpan", duration: 2000 });
            else toast({ variant: "destructive", title: "Save Failed", description: r.error });
            setIsSaving(false);
        }, 800);
    }, [toast]);

    const confirmDelete = useCallback(async () => {
        if (deleteConfirmId === null) return;
        setIsDeleting(true);
        const r = await deleteCases([deleteConfirmId]);
        if (r.success) { toast({ title: "Row Deleted" }); setState(p => ({ ...p, data: p.data?.filter(row => row.id !== deleteConfirmId) || null })); setTotalRows(p => p - 1); }
        else toast({ variant: "destructive", title: "Delete Failed", description: r.error });
        setIsDeleting(false); setDeleteConfirmId(null);
    }, [deleteConfirmId, toast]);

    const handleExport = () => {
        if (!displayData.length) { toast({ variant: "destructive", title: "No Data to Export" }); return; }
        if (typeof XLSX === 'undefined') { toast({ variant: 'destructive', title: "Library Not Loaded" }); return; }
        const eHeaders = headers.map(h => headerDisplayMapping[h] || h);
        const eData = displayData.map(row => headers.map(h => { const v = row[h]; if ((h === 'created_at' || h === 'resolved_at') && v) return formatDateTimeLocal(v); if (h === 'date' && v) return formatDateDDMMYYYY(v); return v ?? ''; }));
        const ws = XLSX.utils.aoa_to_sheet([eHeaders, ...eData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "All Cases");
        XLSX.writeFile(wb, `All_Cases_${new Date().toISOString().slice(0,10)}.xlsx`);
        toast({ title: "Export Berhasil" });
    };

    const FILTERABLE_SET = useMemo(() => new Set(visibleFilterColumns), [visibleFilterColumns]);
    const outerHeight = 'calc(100vh - 64px)';

    if (!isClient) return (
        <div className="flex-1 p-6 space-y-4">
            <div className="flex gap-3"><Skeleton className="h-10 w-72 rounded-lg" /><Skeleton className="h-10 w-32 rounded-lg" /></div>
            <Skeleton className="h-[70vh] w-full rounded-xl" />
        </div>
    );

    return (
        <div className={cn("flex flex-col overflow-hidden bg-slate-50 dark:bg-[#1f1f21]", isFullscreen ? "fixed inset-0 z-50 p-0" : "p-3 sm:p-4")} style={isFullscreen ? undefined : { height: outerHeight }}>

            {/* ── Dialogs ── */}
            {previewData && (
                <SyncPreviewDialog
                    open={isPreviewOpen}
                    onClose={() => { setIsPreviewOpen(false); setPreviewData(null); }}
                    onConfirm={handleConfirmSync}
                    previewRows={previewData.rows}
                    updateRows={previewData.updateRows}
                    updateCount={previewData.updateRows.length}
                    skippedCount={previewData.skippedCount}
                    totalSheetRows={previewData.totalSheetRows}
                    unmappedHeaders={previewData.unmappedHeaders}
                    isConfirming={isConfirmingSync}
                />
            )}

            <AddClientDialog isOpen={isAddClientOpen} onOpenChange={setIsAddClientOpen} existingClientsSet={availableClientsSet} onClientAdded={name => setAvailableClients(p => { if (p.some(c => c.toLowerCase() === name.toLowerCase())) return p; return [...p, name].sort((a, b) => a.localeCompare(b)); })} />

            <Dialog open={deleteConfirmId !== null} onOpenChange={o => { if (!o) setDeleteConfirmId(null); }}>
                <DialogContent className="sm:max-w-[380px] rounded-xl shadow-2xl">
                    <DialogHeader><DialogTitle className="text-base font-semibold">Hapus Row</DialogTitle><DialogDescription className="text-sm text-slate-500">Tindakan ini tidak dapat dibatalkan.</DialogDescription></DialogHeader>
                    <DialogFooter className="flex-row justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)} disabled={isDeleting}>Cancel</Button>
                        <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={isDeleting}>{isDeleting ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditConfirmOpen} onOpenChange={setIsEditConfirmOpen}>
                <DialogContent className="sm:max-w-[420px] rounded-xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold flex items-center gap-2">
                            <Pencil className="h-4 w-4 text-amber-500" />Aktifkan Mode Edit
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500 mt-2 leading-relaxed">
                            Perubahan yang kamu buat hanya akan tersimpan di{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Dashboard</span>{' '}
                            dan <span className="font-semibold text-red-500">tidak akan mempengaruhi</span>{' '}
                            file Google Sheet yang terhubung.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-start gap-3 px-3 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mt-1">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                            Untuk mengubah data di Google Sheet, lakukan perubahan langsung di GSheet lalu gunakan fitur{' '}
                            <strong>Sync Now</strong> untuk menyinkronkan ke Dashboard.
                        </p>
                    </div>
                    <DialogFooter className="gap-2 mt-2">
                        <Button variant="outline" size="sm" onClick={() => setIsEditConfirmOpen(false)}>Batal</Button>
                        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm" onClick={() => { setIsEditMode(true); setIsEditConfirmOpen(false); }}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />Lanjut Edit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="flex flex-col flex-1 min-h-0 h-full shadow-sm border-slate-200 dark:border-[#3a3a3c] rounded-xl overflow-hidden">

                {/* ── TOOLBAR ── */}
                <CardHeader className="flex-shrink-0 px-4 py-3 border-b border-slate-100 dark:border-[#3a3a3c] bg-white dark:bg-[#242426]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                                <Input type="search" placeholder="Cari ticket, client, detail..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={cn("pl-9 h-9 sm:w-[260px] text-sm rounded-lg", "bg-slate-50 dark:bg-[#2e2e30] border-slate-200 dark:border-[#3a3a3c]", "focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary")} />
                            </div>
                            <Select value={yearFilter} onValueChange={setYearFilter}>
                                <SelectTrigger className="w-[110px] h-9 text-sm rounded-lg bg-slate-50 dark:bg-[#2e2e30] border-slate-200 dark:border-[#3a3a3c]"><SelectValue placeholder="Year" /></SelectTrigger>
                                <SelectContent className="rounded-xl shadow-xl">
                                    <SelectItem value="all" className="text-sm">All Years</SelectItem>
                                    {allAvailableYears.map(y => <SelectItem key={y} value={y} className="text-sm">{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <button onClick={() => setShowUnsolvedOnly(p => !p)} className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors", isUnsolvedOnlyActive ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 dark:bg-[#2e2e30] dark:text-[#909098] dark:border-[#3a3a3c] dark:hover:bg-[#3a3a3c]")}>
                                <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", isUnsolvedOnlyActive ? "bg-amber-500" : "bg-slate-400 dark:bg-[#909098]")} />
                                Unsolved Only
                            </button>
                            {(activeFilterCount > 0 || isUnsolvedOnlyActive) && (
                                <button onClick={clearAllFilters} className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold", "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400", "border border-red-200 dark:border-red-800 transition-colors")}>
                                    <FilterX className="h-3 w-3" />
                                    Clear {activeFilterCount + (isUnsolvedOnlyActive ? 1 : 0)} filter{(activeFilterCount + (isUnsolvedOnlyActive ? 1 : 0)) > 1 ? 's' : ''}
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {isEditMode && selectedRows.size > 0 && (
                                <Button onClick={handleBulkDelete} size="sm" variant="destructive" disabled={isBulkDeleting} className="h-9 text-xs font-semibold rounded-lg">
                                    {isBulkDeleting ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />} Delete ({selectedRows.size})
                                </Button>
                            )}
                            <Button onClick={handleSyncNowClick} size="sm" disabled={isFetchingPreview || isPending} className="h-9 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-sm">
                                {isFetchingPreview ? <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />Memuat Preview...</> : <><Eye className="mr-1.5 h-3.5 w-3.5" />Sync Now</>}
                            </Button>
                            <Button onClick={handleExport} size="sm" variant="outline" className="h-9 text-xs font-semibold rounded-lg border-slate-200 dark:border-[#3a3a3c]">
                                <Download className="mr-1.5 h-3.5 w-3.5" /> Export
                            </Button>
                            <Button onClick={() => { if (isEditMode) { setIsEditMode(false); setSelectedRows(new Set()); } else { setIsEditConfirmOpen(true); } }} size="sm" variant={isEditMode ? "default" : "outline"} className={cn("h-9 text-xs font-semibold rounded-lg", !isEditMode && "border-slate-200 dark:border-[#3a3a3c]")}>
                                <Pencil className="mr-1.5 h-3.5 w-3.5" />{isEditMode ? "Done Editing" : "Edit"}
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                {/* ── TABLE ── */}
                <CardContent className="flex flex-col flex-1 min-h-0 p-0 overflow-hidden">
                    <div ref={tableContainerRef} className="flex-1 min-h-0 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-[#3a3a3c] scrollbar-track-transparent">
                        {!displayData.length ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-[#2e2e30] flex items-center justify-center"><Database className="h-8 w-8 text-slate-400" /></div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-slate-600 dark:text-[#909098]">Tidak ada data</p>
                                    <p className="text-xs text-slate-400 dark:text-[#6e6e76] mt-1">{(activeFilterCount > 0 || isUnsolvedOnlyActive) ? 'Coba ubah atau hapus filter Anda' : 'Belum ada data untuk ditampilkan'}</p>
                                </div>
                                {(activeFilterCount > 0 || isUnsolvedOnlyActive) && <button onClick={clearAllFilters} className="text-xs text-primary font-semibold hover:underline">Hapus semua filter</button>}
                            </div>
                        ) : (
                            <div style={{ width: `${totalWidth}px` }}>
                                {/* Sticky header */}
                                <div className="sticky top-0 z-10 flex bg-slate-50 dark:bg-[#242426] border-b-2 border-slate-200 dark:border-[#3a3a3c]">
                                    {headers.map((header, idx) => {
                                        const isFilterable = FILTERABLE_SET.has(header);
                                        const isNoCol = header === 'no';
                                        const isDateCol = header === 'date';
                                        const isLast = idx === headers.length - 1;
                                        const hStyle: React.CSSProperties = isNoCol
                                            ? { width: columnWidths[header], flexShrink: 0, borderBottom: '2px solid hsl(var(--border))', borderRight: '2px solid hsl(var(--border))', position: 'sticky', left: 0, zIndex: 20, backgroundColor: 'hsl(var(--muted))', boxShadow: '2px 0 8px -2px rgba(0,0,0,0.08)' }
                                            : { width: columnWidths[header], flexShrink: 0, borderRight: '1px solid hsl(var(--border))' };
                                        return (
                                            <div key={header} className="h-11 flex items-center justify-center relative group" style={hStyle}>
                                                {isNoCol ? (
                                                    <div className="flex items-center gap-2 px-2">
                                                        {isEditMode && <Checkbox checked={selectedRows.size === displayData.length && displayData.length > 0} onCheckedChange={handleSelectAll} className="border-slate-300 dark:border-[#3a3a3c] cursor-pointer" />}
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 select-none">No</span>
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
                                                        onDeleteItem={['status','ticket_category','module','detail_module'].includes(header) ? (id, name) => handleDeleteMasterItem(header, id, name) : undefined}
                                                    />
                                                ) : (
                                                    <span className="truncate px-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#909098] select-none">{headerDisplayMapping[header] || header}</span>
                                                )}
                                                {!isLast && !isNoCol && (
                                                    <div className={cn("absolute right-0 top-0 bottom-0 w-1 cursor-col-resize transition-colors", "hover:bg-primary/40 group-hover:opacity-100 opacity-0", resizingColumn === header && "bg-primary opacity-100")} onMouseDown={e => handleResizeStart(e, header)}>
                                                        <div className="absolute inset-y-0 left-0 flex items-center"><GripVertical className="h-3.5 w-3.5 text-slate-400 -ml-1" /></div>
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
                                                <MemoizedRow row={row} headers={headers} columnWidths={columnWidths} rowNumber={rowNumber} handleCellChange={handleCellChange} handleCellSave={handleCellSave} availableClients={availableClients} availableClientsSet={availableClientsSet} activeCell={activeCell} onCellClick={handleCellClick} isSelected={selectedRows.has(row.id)} onToggleSelect={handleToggleSelect} isEditMode={isEditMode} cellOptions={cellOptions} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>

                {/* ── PAGINATION ── */}
                <CardFooter className="flex-shrink-0 px-4 py-2.5 border-t border-slate-100 dark:border-[#3a3a3c] bg-white dark:bg-[#242426]">
                    <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-slate-500 dark:text-[#909098] tabular-nums whitespace-nowrap">
                                Showing{' '}
                                <span className="font-semibold text-slate-700 dark:text-[#e0e0e2]">{totalRows > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span>
                                {' – '}
                                <span className="font-semibold text-slate-700 dark:text-[#e0e0e2]">{Math.min(currentPage * pageSize, totalRows).toLocaleString()}</span>
                                {' of '}
                                <span className="font-semibold text-slate-700 dark:text-[#e0e0e2]">{totalRows.toLocaleString()}</span>
                                {' rows'}
                            </span>
                            {isUnsolvedOnlyActive && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 font-semibold text-[11px]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />unsolved
                                </span>
                            )}
                            {selectedRows.size > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-[11px]">{selectedRows.size} selected</span>
                            )}
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#909098]">
                                <span>Rows:</span>
                                <input type="number" min={1} max={1000} value={pageSizeInput} onChange={e => setPageSizeInput(e.target.value)} onFocus={e => { setPageSizeInput(String(pageSize)); e.target.select(); }}
                                    onBlur={() => { const val = parseInt(pageSizeInput); if (val > 0 && val <= 1000) { setPageSize(val); setCurrentPage(1); setPageSizeInput(String(val)); } else { setPageSizeInput(String(pageSize)); } }}
                                    onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { setPageSizeInput(String(pageSize)); (e.target as HTMLInputElement).blur(); } }}
                                    className={cn("h-7 w-12 rounded-md border text-xs text-center font-semibold tabular-nums", "bg-slate-50 dark:bg-[#2e2e30] border-slate-200 dark:border-[#3a3a3c]", "text-slate-700 dark:text-[#c8c8cc]", "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20", "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg border-slate-200 dark:border-[#3a3a3c]" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                            <span className="text-xs text-slate-500 px-2 tabular-nums whitespace-nowrap">
                                Page <span className="font-semibold text-slate-700 dark:text-[#e0e0e2]">{currentPage}</span> of <span className="font-semibold text-slate-700 dark:text-[#e0e0e2]">{totalPages || 1}</span>
                            </span>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg border-slate-200 dark:border-[#3a3a3c]" onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))} disabled={currentPage >= (totalPages || 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
                            <div className="w-px h-5 bg-slate-200 dark:bg-[#3a3a3c] mx-1" />
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg border-slate-200 dark:border-[#3a3a3c]" onClick={() => setIsFullscreen(p => !p)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}