
"use client";

import { useState, useCallback, KeyboardEvent, MouseEvent, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { PlusCircle, Wand2, Download, Undo2, Redo2, Trash2, Files } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

declare const XLSX: any;

const tableHeaders = [
    "No", "Username", "NIS", "NISN", "NIK", "Kode", "Asal Sekolah", "Nama", "L/P",
    "Tempat Lahir", "Tanggal Lahir", "Handphone", "Telepon", "Email", "Alamat",
    "No Rumah", "RT", "RW", "Ayah", "Pekerjaan Ayah", "Ibu", "Pekerjaan Ibu",
    "Wali", "Pekerjaan Wali", "No Kartu Keluarga"
];

type MuridData = Record<string, string | number>;
type CellSelection = {
    row: number;
    col: number;
};

// Helper to create an empty row
const createEmptyRow = (): MuridData => tableHeaders.reduce((acc, header) => ({ ...acc, [header]: '' }), {});

const INITIAL_ROWS = 30;

const monthMap: { [key: string]: string } = {
    'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
    'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'desember': '12',
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
};

const parseAndFormatDate = (dateStr: string): string | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const trimmedDate = dateStr.trim();
    
    // Check if it's already in DD/MM/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmedDate)) {
        const parts = trimmedDate.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        if (parseInt(month, 10) > 12) { // Likely MM/DD/YYYY format
             return `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}/${parts[2]}`;
        }
        return `${day}/${month}/${parts[2]}`;
    }

    // Try parsing MM/DD/YYYY or M/D/YYYY
    const americanDateMatch = trimmedDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (americanDateMatch) {
        const month = americanDateMatch[1].padStart(2, '0');
        const day = americanDateMatch[2].padStart(2, '0');
        const year = americanDateMatch[3];
        return `${day}/${month}/${year}`;
    }

    // Try parsing DD-MonthName-YYYY (e.g., 03-Januari-2009)
    const monthMatch = trimmedDate.match(/^(\d{1,2})[-.\s]([a-zA-Z]+)[-.\s](\d{4})$/);
    if (monthMatch) {
        const day = monthMatch[1].padStart(2, '0');
        const monthName = monthMatch[2].toLowerCase();
        const year = monthMatch[3];
        const month = monthMap[monthName];
        if (day && month && year) {
            return `${day}/${month}/${year}`;
        }
    }
    
    // Try parsing YYYY-MM-DD
    const isoMatch = trimmedDate.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (isoMatch) {
        const year = isoMatch[1];
        const month = isoMatch[2];
        const day = isoMatch[3];
        return `${day}/${month}/${year}`;
    }

    return null; // Return null if no format matches
};


export function MigrasiMurid() {
    const [rows, setRows] = useState<MuridData[]>(() => Array.from({ length: INITIAL_ROWS }, (_, i) => createEmptyRow()));
    const [selectedRange, setSelectedRange] = useState<{ start: CellSelection | null, end: CellSelection | null }>({ start: null, end: null });
    const [numRowsToAdd, setNumRowsToAdd] = useState(1);
    const { toast } = useToast();
    const isSelecting = useRef(false);
    const router = useRouter();

    const [history, setHistory] = useState<MuridData[][]>([rows]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const recordHistory = (newRows: MuridData[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        setHistory([...newHistory, newRows]);
        setHistoryIndex(newHistory.length);
    };
    
    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setRows(history[newIndex]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setRows(history[newIndex]);
        }
    };

    const handleRowsChange = (newRows: MuridData[], record: boolean = true) => {
        setRows(newRows);
        if (record) {
            recordHistory(newRows);
        }
    };
    
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const initialWidths: Record<string, number> = {};
        tableHeaders.forEach(header => {
            if (header === "No") initialWidths[header] = 50;
            else if (header === "Nama") initialWidths[header] = 200;
            else initialWidths[header] = 120; // default width
        });
        return initialWidths;
    });

    const isResizing = useRef<string | null>(null);
    const startX = useRef(0);
    const startWidth = useRef(0);

    const handleResizeMouseDown = (header: string, e: MouseEvent) => {
        isResizing.current = header;
        startX.current = e.clientX;
        startWidth.current = columnWidths[header];
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleResizeMouseMove);
        window.addEventListener('mouseup', handleResizeMouseUp);
    };

    const handleResizeMouseMove = useCallback((e: globalThis.MouseEvent) => {
        if (!isResizing.current) return;
        const currentWidth = startWidth.current + e.clientX - startX.current;
        setColumnWidths(prev => ({
            ...prev,
            [isResizing.current as string]: Math.max(40, currentWidth) // Minimum width 40px
        }));
    }, []);

    const handleResizeMouseUp = useCallback(() => {
        isResizing.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleResizeMouseMove);
        window.removeEventListener('mouseup', handleResizeMouseUp);
    }, [handleResizeMouseMove]);

    const handleCellChange = (rowIndex: number, header: string, value: string) => {
        const newRows = [...rows];
        newRows[rowIndex] = { ...newRows[rowIndex], [header]: value };
        handleRowsChange(newRows);
    };
    
    const getNormalizedRange = useCallback(() => {
        if (!selectedRange.start) {
            return { startRow: -1, endRow: -1, startCol: -1, endCol: -1 };
        }
        const end = selectedRange.end || selectedRange.start;
        const startRow = Math.min(selectedRange.start.row, end.row);
        const endRow = Math.max(selectedRange.start.row, end.row);
        const startCol = Math.min(selectedRange.start.col, end.col);
        const endCol = Math.max(selectedRange.start.col, end.col);
        return { startRow, endRow, startCol, endCol };
    }, [selectedRange]);

    const isCellSelected = useCallback((row: number, col: number) => {
        if (!selectedRange.start) return false;
        const { startRow, endRow, startCol, endCol } = getNormalizedRange();
        return row >= startRow && row <= endRow && col >= startCol && col <= endCol;
    }, [getNormalizedRange, selectedRange.start]);

    const handleClearSelectedCells = () => {
         if (!selectedRange.start) return;
        const newRows = [...rows];
        const { startRow, endRow, startCol, endCol } = getNormalizedRange();
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const header = tableHeaders[c];
                if (header !== "No") {
                  newRows[r] = { ...newRows[r], [header]: '' };
                }
            }
        }
        handleRowsChange(newRows);
    };


    const handleCopy = useCallback(() => {
        if (!selectedRange.start) {
            return;
        }

        const { startRow, endRow, startCol, endCol } = getNormalizedRange();
        
        let copyString = "";
        for (let r = startRow; r <= endRow; r++) {
            const rowValues = [];
            for (let c = startCol; c <= endCol; c++) {
                const header = tableHeaders[c];
                rowValues.push(rows[r][header] || "");
            }
            copyString += rowValues.join("\t");
            if (r < endRow) {
                copyString += "\n";
            }
        }

        navigator.clipboard.writeText(copyString).then(() => {
            toast({
                title: "Copied to Clipboard",
                description: `Selected data has been copied.`,
            });
        }, () => {
            toast({
                variant: "destructive",
                title: "Copy Failed",
                description: "Could not copy data to clipboard.",
            });
        });
    }, [rows, getNormalizedRange, toast]);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, { row, col }: CellSelection) => {
        const move = (dRow: number, dCol: number) => {
            e.preventDefault();
            const nextRow = Math.max(0, Math.min(rows.length - 1, row + dRow));
            const nextCol = Math.max(1, Math.min(tableHeaders.length - 1, col + dCol)); // skip "No" column
            const nextCell = document.querySelector(`[data-row='${nextRow}'][data-col='${nextCol}']`) as HTMLInputElement;
            if (nextCell) {
                nextCell.focus();
                setSelectedRange({ start: { row: nextRow, col: nextCol }, end: { row: nextRow, col: nextCol } });
            }
        };

        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault();
            handleCopy();
            return;
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            handleUndo();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'Z' && e.shiftKey))) {
            e.preventDefault();
            handleRedo();
            return;
        }

        switch (e.key) {
            case "ArrowUp":    move(-1, 0); break;
            case "ArrowDown":  move(1, 0);  break;
            case "ArrowLeft":  move(0, -1); break;
            case "ArrowRight": move(0, 1);  break;
            case "Tab":
                e.preventDefault();
                move(0, e.shiftKey ? -1 : 1);
                break;
            case "Delete":
            case "Backspace":
                if (selectedRange.start) {
                    e.preventDefault();
                    handleClearSelectedCells();
                }
                break;
        }
    };
    
    const handleMouseDown = (e: MouseEvent<HTMLInputElement>, { row, col }: CellSelection) => {
        if (tableHeaders[col] === "No") return;
        isSelecting.current = true;
        if (e.shiftKey && selectedRange.start) {
            setSelectedRange(prev => ({ ...prev, end: { row, col } }));
        } else {
            setSelectedRange({ start: { row, col }, end: { row, col } });
        }
    };

    const handleMouseOver = (e: MouseEvent<HTMLInputElement>, { row, col }: CellSelection) => {
        if (isSelecting.current) {
            e.preventDefault();
            if (tableHeaders[col] === "No") return;
            setSelectedRange(prev => ({ ...prev, end: { row, col } }));
        }
    };
    
    const handleMouseUp = () => {
        isSelecting.current = false;
    };

    const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault();
        const startCell = selectedRange.start;
        if (!startCell) {
            toast({
                variant: "destructive",
                title: "No Cell Selected",
                description: "Please click a cell to select where to paste data."
            });
            return;
        }

        const pasteData = event.clipboardData.getData("text");
        const pastedLines = pasteData.trim().split('\n');
        if (pastedLines.length === 0) return;

        let newRows = [...rows];
        let changes = 0;
        const dateHeader = "Tanggal Lahir";

        pastedLines.forEach((line, lineIndex) => {
            const rowIndex = startCell.row + lineIndex;
            if (rowIndex >= newRows.length) {
                newRows = [...newRows, ...Array.from({ length: rowIndex - newRows.length + 1 }, createEmptyRow)];
            }

            const values = line.split('\t');
            let updatedRow = { ...newRows[rowIndex] };

            values.forEach((value, valueIndex) => {
                const colIndex = startCell.col + valueIndex;
                if (colIndex >= tableHeaders.length) return;

                const header = tableHeaders[colIndex];
                if (header !== "No") {
                    updatedRow[header] = value.trim();
                }
            });

            const originalDate = updatedRow[dateHeader];
            if (originalDate && typeof originalDate === 'string') {
                const formattedDate = parseAndFormatDate(originalDate);
                if (formattedDate && formattedDate !== originalDate) {
                    updatedRow[dateHeader] = formattedDate;
                    changes++;
                }
            }
            newRows[rowIndex] = updatedRow;
        });

        handleRowsChange(newRows);
        toast({
            title: "Data Pasted!",
            description: `${pastedLines.length} rows of data have been pasted.`,
        });

        if (changes > 0) {
            toast({
                title: "Dates Auto-Formatted",
                description: `Automatically formatted ${changes} dates to DD/MM/YYYY.`,
            });
        }
    }, [selectedRange.start, toast, rows, handleRowsChange]);

    const handleAddRows = () => {
        const count = Number(numRowsToAdd);
        if (isNaN(count) || count < 1) return;
        const newRows = [...rows, ...Array.from({ length: count }, createEmptyRow)];
        handleRowsChange(newRows);
        toast({ title: "Rows Added", description: `${count} empty rows have been added.` });
    };

    const handleFormatDates = () => {
        let changes = 0;
        const dateHeader = "Tanggal Lahir";
        
        const newRows = rows.map(row => {
            const originalValue = row[dateHeader];
            if (originalValue && typeof originalValue === 'string') {
                const formattedValue = parseAndFormatDate(originalValue);
                if (formattedValue && formattedValue !== originalValue) {
                    changes++;
                    return { ...row, [dateHeader]: formattedValue };
                }
            }
            return row;
        });

        if (changes > 0) {
            handleRowsChange(newRows);
            toast({
                title: "Dates Formatted",
                description: `Successfully formatted ${changes} dates to DD/MM/YYYY.`,
            });
        } else {
            toast({
                variant: "default",
                title: "No Dates to Format",
                description: "No dates needed reformatting or the format was not recognized.",
            });
        }
    };
    
    const parseDateString = (dateString: string): Date | null => {
        if (typeof dateString !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateString.trim())) return null;
        const parts = dateString.trim().split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JS
        const year = parseInt(parts[2], 10);
        const date = new Date(Date.UTC(year, month, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
            return null;
        }
        return date;
    };

    const handleExportExcel = () => {
        if (typeof XLSX === 'undefined') {
            toast({ variant: 'destructive', title: "Library Not Loaded", description: "The Excel library is still loading. Please try again in a moment."});
            return;
        }
        const dateHeader = "Tanggal Lahir";
        const processedRows = rows
            .map((row, index) => {
                const newRow: Record<string, any> = { ...row, No: row.Username ? String(index + 1) : '' };
                const dateValue = newRow[dateHeader];
                if (dateValue && typeof dateValue === 'string') {
                    const parsedDate = parseDateString(dateValue);
                    if (parsedDate) {
                        newRow[dateHeader] = parsedDate;
                    }
                }
                return newRow;
            })
            .filter(row => Object.values(row).some(val => val !== null && val !== ''));


        if (processedRows.length === 0) {
            toast({
                variant: "destructive",
                title: "No Data to Export",
                description: "The table is empty. Please add some data before exporting.",
            });
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(processedRows, { header: tableHeaders, skipHeader: false });
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data Murid");
        
        const date = new Date().toISOString().slice(0, 10);
        const filename = `Data_Murid_${date}.xls`;

        XLSX.writeFile(workbook, filename, { bookType: "biff8" });
        
        toast({
            title: "Export Successful",
            description: `${processedRows.length} rows have been exported to ${filename}.`,
        });
    };

    const handleClearTable = () => {
        const newRows = Array.from({ length: INITIAL_ROWS }, (_, i) => createEmptyRow());
        handleRowsChange(newRows);
        toast({ title: "Table Cleared", description: "All data has been cleared from the table." });
    };

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Migrasi Murid</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                       Click and drag to select a range. Use arrow keys to navigate. Press Delete to clear selected cells. Paste data from your spreadsheet.
                    </p>
                </header>
                <Card className="shadow-lg">
                    <CardHeader>
                        <div>
                            <CardTitle>Data Murid untuk Migrasi</CardTitle>
                            <CardDescription className="mt-1">
                                This table behaves like a spreadsheet. Edit cells directly, select ranges, and paste data. The table will expand automatically.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <div className="px-6 pb-4 flex flex-wrap items-center gap-2 border-b">
                         <Button onClick={handleUndo} size="sm" variant="outline" disabled={historyIndex === 0}>
                            <Undo2 className="mr-2 h-4 w-4" /> Undo
                        </Button>
                        <Button onClick={handleRedo} size="sm" variant="outline" disabled={historyIndex === history.length - 1}>
                            <Redo2 className="mr-2 h-4 w-4" /> Redo
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action will permanently delete all data from the table. You cannot undo this action.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleClearTable}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button
                          onClick={handleExportExcel}
                          size="sm"
                          className="bg-green-600 text-white hover:bg-green-700"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                    </div>
                    <CardContent className="pt-6">
                        <div 
                            className="relative w-full overflow-auto rounded-md border max-h-[600px]"
                            onPaste={handlePaste}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            <Table className="border-collapse w-full" style={{ tableLayout: 'fixed' }}>
                                <TableHeader className="sticky top-0 z-10 bg-card">
                                    <TableRow>
                                        {tableHeaders.map((header) => (
                                            <TableHead 
                                                key={header} 
                                                style={{ width: `${columnWidths[header]}px`}}
                                                className={cn(
                                                    "border bg-muted/50 p-0 text-xs font-bold text-center relative select-none",
                                                    "sticky top-0 z-10"
                                                )}
                                            >
                                                <div className="px-2 py-2 flex items-center justify-center gap-1 whitespace-normal break-words">
                                                    {header}
                                                    {header === "Tanggal Lahir" && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-5 w-5">
                                                                    <Wand2 className="h-3 w-3" />
                                                                    <span className="sr-only">Format Menu</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuItem onClick={handleFormatDates}>
                                                                    Format ke DD/MM/YYYY
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </div>
                                                <div
                                                    onMouseDown={(e: MouseEvent) => handleResizeMouseDown(header, e)}
                                                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize"
                                                />
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                   {rows.map((row, rowIndex) => (
                                       <TableRow key={`row-${rowIndex}`} className="border-0 m-0 p-0">
                                           {tableHeaders.map((header, colIndex) => (
                                               <TableCell 
                                                   key={`cell-${rowIndex}-${colIndex}`} 
                                                   style={{ width: `${columnWidths[header]}px`}}
                                                   className={cn(
                                                       "border p-0 m-0 h-auto relative",
                                                       { "bg-muted/30": header === "No" },
                                                       isCellSelected(rowIndex, colIndex) && header !== "No" ? 'bg-green-200/50' : ''
                                                   )}
                                               >
                                                   <Input
                                                      type="text"
                                                      value={String(header === "No" ? (row["Username"] ? rowIndex + 1 : "") : row[header] || '')}
                                                      readOnly={header === "No"}
                                                      onChange={(e) => handleCellChange(rowIndex, header, e.target.value)}
                                                      onKeyDown={(e) => handleKeyDown(e, { row: rowIndex, col: colIndex })}
                                                      onMouseDown={(e) => handleMouseDown(e, { row: rowIndex, col: colIndex })}
                                                      onMouseOver={(e) => handleMouseOver(e, { row: rowIndex, col: colIndex })}
                                                      data-row={rowIndex}
                                                      data-col={colIndex}
                                                      className={cn(
                                                          "w-full h-full text-xs p-1 rounded-none border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary",
                                                          "whitespace-normal break-words py-2",
                                                          header === "No" && "text-center cursor-default bg-muted/30 focus-visible:ring-0",
                                                          isCellSelected(rowIndex, colIndex) ? 'bg-transparent' : ''
                                                      )}
                                                   />
                                               </TableCell>
                                           ))}
                                       </TableRow>
                                   ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                     <CardFooter>
                        <div className="flex items-center gap-2">
                           <Input
                                type="number"
                                value={numRowsToAdd}
                                onChange={(e) => setNumRowsToAdd(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="w-24 h-9"
                                min="1"
                            />
                            <Button onClick={handleAddRows} size="sm" variant="outline">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Tambah Baris
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
