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
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof multiSelectVariants> {
    options: {
        label: string;
        value: string;
        icon?: React.ComponentType<{ className?: string }>;
    }[];
    selected: string[];
    onChange: React.Dispatch<React.SetStateAction<string[]>>;
    className?: string;
    placeholder?: string;
}


const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
    ({ options, selected, onChange, className, variant, ...props }, ref) => {
        const [open, setOpen] = React.useState(false);

        const handleUnselect = (item: string) => {
            onChange(selected.filter((i) => i !== item));
        };

        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        ref={ref}
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn("w-full justify-between", className)}
                        onClick={() => setOpen(!open)}
                        {...props}
                    >
                        <div className="flex flex-wrap items-center gap-1">
                            {selected.length > 0
                                ? options
                                    .filter((option) => selected.includes(option.value))
                                    .map((option) => (
                                        <Badge
                                            key={option.value}
                                            className={cn("m-1", multiSelectVariants({ variant }))}

                                        >
                                            {option.label}
                                            <span
                                                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        handleUnselect(option.value);
                                                    }
                                                }}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                onClick={() => handleUnselect(option.value)}
                                            >
                                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                            </span>
                                        </Badge>
                                    ))
                                : <span>{props.placeholder ?? 'Select ...'}</span>}
                        </div>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                    <Command>
                        <CommandInput placeholder="Search ..." />
                        <CommandList>
                            <CommandEmpty>No item found.</CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        onSelect={() => {
                                            onChange(
                                                selected.includes(option.value)
                                                    ? selected.filter((item) => item !== option.value)
                                                    : [...selected, option.value]
                                            );
                                            setOpen(true);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
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
