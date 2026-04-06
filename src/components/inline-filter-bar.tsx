"use client";

import { useRef, useState, useCallback } from "react";
import { ChevronDown, X, Download, RefreshCw, Search, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Option = { label: string; value: string };

interface InlineFilterBarProps {
    // Options
    yearOptions:         Option[];
    statusOptions:       Option[];
    categoryOptions:     Option[];
    clientOptions:       Option[];
    moduleOptions:       Option[];
    detailModuleOptions: Option[];

    // Selected
    selectedYears:         string[];
    selectedStatuses:      string[];
    selectedCategories:    string[];
    selectedClients:       string[];
    selectedModules:       string[];
    selectedDetailModules: string[];
    dateRange?:            DateRange;
    search:                string;

    // Callbacks
    onYearsChange:         (v: string[]) => void;
    onStatusesChange:      (v: string[]) => void;
    onCategoriesChange:    (v: string[]) => void;
    onClientsChange:       (v: string[]) => void;
    onModulesChange:       (v: string[]) => void;
    onDetailModulesChange: (v: string[]) => void;
    onDateRangeChange:     (v: DateRange | undefined) => void;
    onSearchChange:        (v: string) => void;
    onClearAll:            () => void;

    // State & actions
    isLoading:    boolean;
    isDownloading: boolean;
    hasGenerated: boolean;
    casesCount:   number;
    onGenerate:   () => void;
    onDownload:   () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-select dropdown
// ─────────────────────────────────────────────────────────────────────────────
function MultiSelect({
    label, options, selected, onChange, maxLabelWidth = 90,
}: {
    label: string; options: Option[]; selected: string[];
    onChange: (v: string[]) => void; maxLabelWidth?: number;
}) {
    const [open, setOpen] = useState(false);
    const ref             = useRef<HTMLDivElement>(null);
    const count           = selected.length;
    const isActive        = count > 0;

    const toggle = (val: string) => {
        onChange(
            selected.includes(val)
                ? selected.filter(v => v !== val)
                : [...selected, val]
        );
    };

    // Close on outside click
    const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
    }, []);

    return (
        <div ref={ref} className="relative" onBlur={handleBlur}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={cn(
                    "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap",
                    isActive
                        ? "bg-[#1E3A5F] text-white border-[#1E3A5F] hover:bg-[#2D4F7C]"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                )}
            >
                <span style={{ maxWidth: maxLabelWidth }} className="truncate">{label}</span>
                {isActive && (
                    <span className="flex-shrink-0 bg-white/20 text-white text-[9px] font-bold rounded-full px-1.5 py-px leading-none">
                        {count}
                    </span>
                )}
                <ChevronDown className={cn("h-3 w-3 flex-shrink-0 transition-transform opacity-60", open && "rotate-180")} />
            </button>

            {open && (
                <div
                    tabIndex={-1}
                    className="absolute top-full left-0 mt-1 z-50 w-52 max-h-64 overflow-y-auto rounded-lg border bg-popover shadow-lg py-1"
                >
                    {options.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground italic">No options</div>
                    )}
                    {options.map(opt => {
                        const checked = selected.includes(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => toggle(opt.value)}
                                className={cn(
                                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors",
                                    checked
                                        ? "bg-[#1E3A5F]/8 text-[#1E3A5F] dark:text-blue-400 font-medium"
                                        : "hover:bg-muted text-foreground"
                                )}
                            >
                                <span className={cn(
                                    "flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center",
                                    checked ? "bg-[#1E3A5F] border-[#1E3A5F]" : "border-border"
                                )}>
                                    {checked && <span className="text-white text-[8px] leading-none">✓</span>}
                                </span>
                                <span className="truncate">{opt.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Date range picker button
// ─────────────────────────────────────────────────────────────────────────────
function DateRangeFilter({
    value, onChange,
}: {
    value: DateRange | undefined;
    onChange: (v: DateRange | undefined) => void;
}) {
    const [open, setOpen] = useState(false);
    const isActive = !!value?.from;

    const label = isActive
        ? value?.to
            ? `${format(value.from!, "d MMM yy")} – ${format(value.to, "d MMM yy")}`
            : format(value.from!, "d MMM yy")
        : "Dates";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap",
                        isActive
                            ? "bg-[#1E3A5F] text-white border-[#1E3A5F] hover:bg-[#2D4F7C]"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    )}
                >
                    <Calendar className="h-3 w-3 flex-shrink-0 opacity-70" />
                    <span className="max-w-[140px] truncate">{label}</span>
                    {isActive && (
                        <span
                            className="flex-shrink-0 rounded-full bg-white/20 hover:bg-white/30 text-white p-px"
                            onClick={(e) => { e.stopPropagation(); onChange(undefined); setOpen(false); }}
                        >
                            <X className="h-2.5 w-2.5" />
                        </span>
                    )}
                    {!isActive && <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-60" />}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                    mode="range"
                    selected={value}
                    onSelect={onChange}
                    numberOfMonths={2}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function InlineFilterBar({
    yearOptions, statusOptions, categoryOptions, clientOptions, moduleOptions, detailModuleOptions,
    selectedYears, selectedStatuses, selectedCategories, selectedClients, selectedModules, selectedDetailModules,
    dateRange, search,
    onYearsChange, onStatusesChange, onCategoriesChange, onClientsChange, onModulesChange, onDetailModulesChange,
    onDateRangeChange, onSearchChange, onClearAll,
    isLoading, isDownloading, hasGenerated, casesCount, onGenerate, onDownload,
}: InlineFilterBarProps) {

    const totalActive =
        selectedYears.length +
        selectedStatuses.length +
        selectedCategories.length +
        selectedClients.length +
        selectedModules.length +
        selectedDetailModules.length +
        (dateRange?.from ? 1 : 0);

    return (
        <div className="shrink-0 border-b bg-background">

            {/* ── Row 1: Filter dropdowns ───────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-dashed border-border/60">
                <MultiSelect
                    label="All Years"
                    options={yearOptions}
                    selected={selectedYears}
                    onChange={onYearsChange}
                />
                <MultiSelect
                    label="Status"
                    options={statusOptions}
                    selected={selectedStatuses}
                    onChange={onStatusesChange}
                    maxLabelWidth={70}
                />
                <MultiSelect
                    label="Category"
                    options={categoryOptions}
                    selected={selectedCategories}
                    onChange={onCategoriesChange}
                />
                <MultiSelect
                    label="Clients"
                    options={clientOptions}
                    selected={selectedClients}
                    onChange={onClientsChange}
                />
                <MultiSelect
                    label="Modules"
                    options={moduleOptions}
                    selected={selectedModules}
                    onChange={onModulesChange}
                />
                <MultiSelect
                    label="Detail Module"
                    options={detailModuleOptions}
                    selected={selectedDetailModules}
                    onChange={onDetailModulesChange}
                    maxLabelWidth={100}
                />
                <DateRangeFilter value={dateRange} onChange={onDateRangeChange} />
            </div>

            {/* ── Row 2: Clear badge · · · Search + Download + Generate ── */}
            <div className="flex items-center gap-2 px-4 py-2">

                {/* Left: clear badge */}
                {totalActive > 0 && (
                    <button
                        type="button"
                        onClick={onClearAll}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-3 w-3" />
                        <span>Clear ({totalActive})</span>
                    </button>
                )}

                {/* Spacer pushes the right group all the way right */}
                <div className="flex-1" />

                {/* Right: Search + cases count + Download + Generate */}
                <div className="flex items-center gap-2">

                    {/* cases count */}
                    {hasGenerated && !isLoading && (
                        <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                            {casesCount.toLocaleString()} cases
                        </span>
                    )}

                    {/* Search input */}
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => onSearchChange(e.target.value)}
                            placeholder="Cari ticket / judul / client…"
                            className="h-7 w-48 pl-6 pr-2 rounded-md border border-border bg-muted/30 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]/40 focus:border-[#1E3A5F]/50 transition"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => onSearchChange("")}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>

                    {/* Download */}
                    {hasGenerated && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onDownload}
                            disabled={isDownloading || isLoading || casesCount === 0}
                            className="h-7 gap-1.5 text-xs px-2.5"
                        >
                            {isDownloading
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Download className="h-3.5 w-3.5" />
                            }
                            <span>{isDownloading ? "Downloading…" : "Download .docx"}</span>
                        </Button>
                    )}

                    {/* Generate */}
                    <Button
                        size="sm"
                        onClick={onGenerate}
                        disabled={isLoading}
                        className="h-7 gap-1.5 text-xs px-3 bg-[#1E3A5F] hover:bg-[#2D4F7C] text-white border-0"
                    >
                        {isLoading
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RefreshCw className="h-3.5 w-3.5" />
                        }
                        <span>{isLoading ? "Loading…" : "Generate"}</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}