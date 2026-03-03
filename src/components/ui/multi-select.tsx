"use client";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, X, ChevronsUpDown } from "lucide-react";
import * as React from "react";

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
    // FIX #3: Use plain function type instead of Dispatch so any handler works correctly
    onChange: (values: string[]) => void;
    className?: string;
    placeholder?: string;
}

const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
    ({ options, selected, onChange, className, variant, placeholder, ...props }, ref) => {
        const [open, setOpen] = React.useState(false);

        const handleUnselect = (item: string) => {
            onChange(selected.filter((i) => i !== item));
        };

        const handleSelect = (value: string) => {
            const next = selected.includes(value)
                ? selected.filter((item) => item !== value)
                : [...selected, value];
            onChange(next);
            // Keep dropdown open so user can keep selecting
            setOpen(true);
        };

        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        ref={ref}
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        // FIX #1: h-auto + min-h so the button grows with badge tags (no overlap)
                        className={cn(
                            "w-full justify-between h-auto min-h-10 py-1.5",
                            className
                        )}
                        onClick={() => setOpen(!open)}
                        {...props}
                    >
                        {/* FIX #1: flex-wrap so badges go to next line instead of overflowing */}
                        <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0 mr-2">
                            {selected.length > 0
                                ? options
                                    .filter((option) => selected.includes(option.value))
                                    .map((option) => (
                                        <Badge
                                            key={option.value}
                                            className={cn("shrink-0", multiSelectVariants({ variant }))}
                                        >
                                            {option.label}
                                            <span
                                                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleUnselect(option.value);
                                                }}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleUnselect(option.value);
                                                }}
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
                </PopoverTrigger>
                {/* FIX #2: match trigger width + proper z-index so it doesn't hide behind other elements */}
                <PopoverContent
                    className="p-0"
                    style={{ width: "var(--radix-popover-trigger-width)" }}
                    align="start"
                    // Stop click from bubbling up to any parent Popover/Panel
                    onInteractOutside={(e) => {
                        // Only close if click is truly outside (not on our trigger)
                        const target = e.target as HTMLElement;
                        if (target.closest('[role="combobox"]')) {
                            e.preventDefault();
                        }
                    }}
                >
                    <Command>
                        <CommandInput placeholder="Search ..." />
                        <CommandList>
                            <CommandEmpty>No item found.</CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        // FIX #3: use handleSelect which always reads latest `selected` array
                                        onSelect={() => handleSelect(option.value)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4 shrink-0",
                                                selected.includes(option.value) ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {option.icon && (
                                            <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                        )}
                                        {option.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    }
);

MultiSelect.displayName = "MultiSelect";

export { MultiSelect };