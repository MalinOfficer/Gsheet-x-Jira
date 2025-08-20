
"use client";

import { useState, useCallback, KeyboardEvent, MouseEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { PlusCircle } from "lucide-react";

const tableHeaders = [
    "No", "Username", "NIS", "NISN", "NIK", "Kode", "Asal Sekolah", "Nama", "L/P",
    "Tempat Lahir", "Tanggal Lahir", "Handphone", "Telepon", "Email", "Alamat",
    "No Rumah", "RT", "RW", "Ayah", "Pekerjaan Ayah", "Ibu", "Pekerjaan Ibu",
    "Wali", "Pekerjaan Wali", "No Kartu Keluarga"
];

type MuridData = Record<string, string>;
type CellSelection = {
    row: number;
    col: number;
};

// Helper to create an empty row
const createEmptyRow = (): MuridData => tableHeaders.reduce((acc, header) => ({ ...acc, [header]: '' }), {});

const INITIAL_ROWS = 30;

export function MigrasiMurid() {
    const [rows, setRows] = useState<MuridData[]>(() => Array.from({ length: INITIAL_ROWS }, createEmptyRow));
    const [selectedRange, setSelectedRange] = useState<{ start: CellSelection | null, end: CellSelection | null }>({ start: null, end: null });
    const [numRowsToAdd, setNumRowsToAdd] = useState(1);
    const { toast } = useToast();

    const handleCellChange = (rowIndex: number, header: string, value: string) => {
        setRows(currentRows => {
            const newRows = [...currentRows];
            newRows[rowIndex] = { ...newRows[rowIndex], [header]: value };
            return newRows;
        });
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, { row, col }: CellSelection) => {
        const move = (dRow: number, dCol: number) => {
            const nextRow = Math.max(0, Math.min(rows.length - 1, row + dRow));
            const nextCol = Math.max(0, Math.min(tableHeaders.length - 1, col + dCol));
            const nextCell = document.querySelector(`[data-row='${nextRow}'][data-col='${nextCol}']`) as HTMLInputElement;
            if (nextCell) {
                nextCell.focus();
                setSelectedRange({ start: { row: nextRow, col: nextCol }, end: { row: nextRow, col: nextCol } });
            }
        };

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
                if (selectedRange.start && selectedRange.end) {
                    e.preventDefault();
                    setRows(currentRows => {
                        const newRows = [...currentRows];
                        const { startRow, endRow, startCol, endCol } = getNormalizedRange();
                        for (let r = startRow; r <= endRow; r++) {
                            for (let c = startCol; c <= endCol; c++) {
                                const header = tableHeaders[c];
                                if (header !== "No") {
                                  newRows[r] = { ...newRows[r], [header]: '' };
                                }
                            }
                        }
                        return newRows;
                    });
                }
                break;
        }
    };
    
    const getNormalizedRange = () => {
        if (!selectedRange.start || !selectedRange.end) {
            return { startRow: -1, endRow: -1, startCol: -1, endCol: -1 };
        }
        const startRow = Math.min(selectedRange.start.row, selectedRange.end.row);
        const endRow = Math.max(selectedRange.start.row, selectedRange.end.row);
        const startCol = Math.min(selectedRange.start.col, selectedRange.end.col);
        const endCol = Math.max(selectedRange.start.col, selectedRange.end.col);
        return { startRow, endRow, startCol, endCol };
    };

    const getCellBorderClass = (row: number, col: number) => {
        if (!selectedRange.start || !selectedRange.end) return "";
        const { startRow, endRow, startCol, endCol } = getNormalizedRange();

        if (row < startRow || row > endRow || col < startCol || col > endCol) return "";

        const isTop = row === startRow;
        const isBottom = row === endRow;
        const isLeft = col === startCol;
        const isRight = col === endCol;

        const classes = [];
        if (isTop) classes.push("border-t-2 border-t-primary");
        if (isBottom) classes.push("border-b-2 border-b-primary");
        if (isLeft) classes.push("border-l-2 border-l-primary");
        if (isRight) classes.push("border-r-2 border-r-primary");

        return classes.join(" ");
    };
    
    const handleCellClick = (e: MouseEvent<HTMLInputElement>, { row, col }: CellSelection) => {
        if (e.shiftKey && selectedRange.start) {
            setSelectedRange({ ...selectedRange, end: { row, col } });
        } else {
            setSelectedRange({ start: { row, col }, end: { row, col } });
        }
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

        setRows(currentRows => {
            let newRows = [...currentRows];
            pastedLines.forEach((line, lineIndex) => {
                const rowIndex = startCell.row + lineIndex;
                if (rowIndex >= newRows.length) {
                    newRows = [...newRows, ...Array.from({ length: rowIndex - newRows.length + 1 }, createEmptyRow)];
                }
                const values = line.split('\t');
                values.forEach((value, valueIndex) => {
                    const colIndex = startCell.col + valueIndex;
                    if (colIndex >= tableHeaders.length) return;

                    const header = tableHeaders[colIndex];
                    if (header !== "No") {
                        newRows[rowIndex][header] = value.trim();
                    }
                });
            });
            return newRows;
        });

        toast({
            title: "Data Pasted!",
            description: `${pastedLines.length} rows of data have been pasted.`,
        });
    }, [selectedRange.start, toast]);

    const handleAddRows = () => {
        const count = Number(numRowsToAdd);
        if (isNaN(count) || count < 1) return;
        setRows(prev => [...prev, ...Array.from({ length: count }, createEmptyRow)]);
        toast({ title: "Rows Added", description: `${count} empty rows have been added.` });
    };

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-full mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Migrasi Murid</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                       Click to select a cell, Shift+Click to select a range. Use arrow keys to navigate. Press Delete to clear selected cells. Paste data from your spreadsheet.
                    </p>
                </header>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Data Murid untuk Migrasi</CardTitle>
                        <CardDescription className="mt-1">
                            This table behaves like a spreadsheet. Edit cells directly, select ranges, and paste data. The table will expand automatically.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div 
                            className="relative w-full overflow-auto rounded-md border max-h-[600px]"
                            onPaste={handlePaste}
                        >
                            <Table className="border-collapse w-full">
                                <TableHeader className="sticky top-0 z-10 bg-card">
                                    <TableRow>
                                        {tableHeaders.map((header) => (
                                            <TableHead key={header} className={cn(
                                                "border bg-muted/50 p-0 text-xs font-bold text-center whitespace-nowrap",
                                                header === "No" && "w-[50px] min-w-[50px]"
                                            )}>
                                                <div className="px-2 py-2">{header}</div>
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
                                                   className={cn(
                                                       "border p-0 m-0 h-auto relative",
                                                       { "bg-muted/50 text-center": header === "No" }
                                                   )}
                                               >
                                                    <div className={cn("absolute inset-[-1px] pointer-events-none z-10", getCellBorderClass(rowIndex, colIndex))}></div>
                                                   <Input
                                                      type="text"
                                                      value={header === "No" ? (row["Username"] ? rowIndex + 1 : "") : row[header]}
                                                      readOnly={header === "No"}
                                                      onChange={(e) => handleCellChange(rowIndex, header, e.target.value)}
                                                      onKeyDown={(e) => handleKeyDown(e, { row: rowIndex, col: colIndex })}
                                                      onClick={(e) => handleCellClick(e, { row: rowIndex, col: colIndex })}
                                                      data-row={rowIndex}
                                                      data-col={colIndex}
                                                      className={cn(
                                                          "w-full h-full min-w-[100px] text-xs p-1 rounded-none border-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary",
                                                          { "w-[50px] min-w-[50px] text-center cursor-default": header === "No" }
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

    