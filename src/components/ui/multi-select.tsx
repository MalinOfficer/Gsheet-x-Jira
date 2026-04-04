"use client";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, X, ChevronsUpDown, GripHorizontal } from "lucide-react";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

const multiSelectVariants = cva(
    "m-1",
    {
        variants: {
            variant: {
                default:
                    "border-foreground bg-secondary-foreground text-secondary hover:bg-secondary-foreground hover:text-secondary",
                secondary:
                    "border-secondary-foreground bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

interface MultiSelectProps
    extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'>,
    VariantProps<typeof multiSelectVariants> {
    options: {
        label: string;
        value: string;
        icon?: React.ComponentType<{ className?: string }>;
    }[];
    selected: string[];
    onChange: (values: string[]) => void;
    className?: string;
    placeholder?: string;
    /** Controlled open state — untuk exclusive dropdown di filter panel */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** "left" = draggable floating panel, "bottom" = popover biasa ke bawah */
    side?: "bottom" | "left";
    /** Label di header draggable panel */
    panelLabel?: string;
    /**
     * Ref ke elemen luar (mis. header filter panel).
     * Kalau ada, top posisi awal options panel akan sejajar dengan elemen ini.
     * Kalau tidak ada, fallback ke posisi trigger button.
     */
    alignTopRef?: React.RefObject<HTMLElement | null>;
}

// ─── Draggable Options Panel ──────────────────────────────────────────────────
interface DraggableOptionsPanelProps {
    open: boolean;
    onClose: () => void;
    label?: string;
    /** Ref trigger button — dipakai untuk posisi X (left) */
    anchorRef: React.RefObject<HTMLButtonElement | null>;
    /** Ref elemen luar — dipakai untuk posisi Y (top), mis. header filter panel */
    alignTopRef?: React.RefObject<HTMLElement | null>;
    children: React.ReactNode;
}

function DraggableOptionsPanel({
    open,
    onClose,
    label,
    anchorRef,
    alignTopRef,
    children,
}: DraggableOptionsPanelProps) {
    const panelRef   = React.useRef<HTMLDivElement>(null);
    const dragState  = React.useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
    const hasDragged = React.useRef(false);
    const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);

    React.useEffect(() => {
        if (!open) {
            hasDragged.current = false;
            setPos(null);
            return;
        }
        if (hasDragged.current) return;
        if (!anchorRef.current) return;

        const triggerRect = anchorRef.current.getBoundingClientRect();

        // X: tepat di sebelah kiri trigger (panel lebar 288px + 4px gap)
        const x = triggerRect.left - 292;

        // Y: sejajar dengan alignTopRef kalau ada, fallback ke trigger
        const topEl = alignTopRef?.current ?? anchorRef.current;
        const y = topEl.getBoundingClientRect().top;

        setPos({ x, y });
    }, [open, anchorRef, alignTopRef]);

    const onMouseDown = React.useCallback((e: React.MouseEvent) => {
        if (!panelRef.current) return;
        const rect = panelRef.current.getBoundingClientRect();
        dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
        e.preventDefault();
        const onMove = (ev: MouseEvent) => {
            if (!dragState.current.dragging) return;
            hasDragged.current = true;
            setPos({
                x: dragState.current.origX + (ev.clientX - dragState.current.startX),
                y: dragState.current.origY + (ev.clientY - dragState.current.startY),
            });
        };
        const onUp = () => {
            dragState.current.dragging = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, []);

    if (!open) return null;

    const style: React.CSSProperties = pos
        ? { position: "fixed", left: pos.x, top: pos.y, zIndex: 60 }
        : { position: "fixed", top: "30%", left: "20%", zIndex: 60 };

    return ReactDOM.createPortal(
        <>
            {/* z-[49]: di bawah filter panel (z-50) agar klik trigger lain tidak terblokir */}
            <div className="fixed inset-0 z-[49]" onClick={onClose} />
            <div
                ref={panelRef}
                style={style}
                className="w-72 rounded-lg border bg-popover text-popover-foreground shadow-xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag handle */}
                <div
                    onMouseDown={onMouseDown}
                    className="flex items-center justify-between px-3 py-2 border-b cursor-grab active:cursor-grabbing select-none bg-muted/50 rounded-t-lg shrink-0"
                >
                    <div className="flex items-center gap-1.5">
                        <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        {label && <span className="text-xs font-semibold text-muted-foreground">{label}</span>}
                    </div>
                    <button onClick={onClose} className="rounded-sm opacity-60 hover:opacity-100 transition-opacity">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
                {/* Options content — min-h tetap agar tidak mengecil saat search */}
                {children}
            </div>
        </>,
        document.body
    );
}

// ─── MultiSelect ──────────────────────────────────────────────────────────────
const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
    ({
        options,
        selected,
        onChange,
        className,
        variant,
        placeholder,
        open: openProp,
        onOpenChange,
        side = "bottom",
        panelLabel,
        alignTopRef,
        ...props
    }, ref) => {
        const [internalOpen, setInternalOpen] = React.useState(false);
        const triggerRef = React.useRef<HTMLButtonElement>(null);

        React.useImperativeHandle(ref, () => triggerRef.current!);

        const isControlled = openProp !== undefined;
        const open = isControlled ? openProp : internalOpen;

        const handleOpenChange = React.useCallback((val: boolean) => {
            if (!isControlled) setInternalOpen(val);
            onOpenChange?.(val);
        }, [isControlled, onOpenChange]);

        const handleUnselect = (item: string) => {
            onChange(selected.filter((i) => i !== item));
        };

        const handleSelect = (value: string) => {
            const next = selected.includes(value)
                ? selected.filter((item) => item !== value)
                : [...selected, value];
            onChange(next);
            handleOpenChange(true);
        };

        const triggerButton = (
            <Button
                ref={triggerRef}
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn("w-full justify-between h-auto min-h-10 py-1.5", className)}
                onClick={() => handleOpenChange(!open)}
                {...props}
            >
                <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0 mr-2">
                    {selected.length > 0
                        ? options
                            .filter((opt) => selected.includes(opt.value))
                            .map((opt) => (
                                <Badge key={opt.value} className={cn("shrink-0", multiSelectVariants({ variant }))}>
                                    {opt.label}
                                    <span
                                        className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        onKeyDown={(e) => { if (e.key === "Enter") handleUnselect(opt.value); }}
                                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUnselect(opt.value); }}
                                    >
                                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </span>
                                </Badge>
                            ))
                        : <span className="text-muted-foreground font-normal">{placeholder ?? 'Select ...'}</span>
                    }
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
        );

        const commandContent = (
            <Command>
                <CommandInput placeholder="Search ..." />
                <CommandList className="min-h-[220px] max-h-[280px]">
                    <CommandEmpty>No item found.</CommandEmpty>
                    <CommandGroup>
                        {options.map((opt) => (
                            <CommandItem key={opt.value} value={opt.value} onSelect={() => handleSelect(opt.value)}>
                                <Check className={cn("mr-2 h-4 w-4 shrink-0", selected.includes(opt.value) ? "opacity-100" : "opacity-0")} />
                                {opt.icon && <opt.icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                                {opt.label}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>
        );

        if (side === "left") {
            return (
                <>
                    {triggerButton}
                    <DraggableOptionsPanel
                        open={open}
                        onClose={() => handleOpenChange(false)}
                        label={panelLabel}
                        anchorRef={triggerRef}
                        alignTopRef={alignTopRef}
                    >
                        {commandContent}
                    </DraggableOptionsPanel>
                </>
            );
        }

        return (
            <Popover open={open} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    {triggerButton}
                </PopoverTrigger>
                <PopoverContent
                    className="p-0"
                    style={{ width: "var(--radix-popover-trigger-width)" }}
                    align="start"
                    sideOffset={4}
                    onInteractOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('[role="combobox"]')) e.preventDefault();
                    }}
                >
                    {commandContent}
                </PopoverContent>
            </Popover>
        );
    }
);

MultiSelect.displayName = "MultiSelect";

export { MultiSelect };