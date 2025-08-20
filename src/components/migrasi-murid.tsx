
"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const tableHeaders = [
    "No", "Username", "NIS", "NISN", "NIK", "Kode", "Asal Sekolah", "Nama", "L/P",
    "Tempat Lahir", "Tanggal Lahir", "Handphone", "Telepon", "Email", "Alamat",
    "No Rumah", "RT", "RW", "Ayah", "Pekerjaan Ayah", "Ibu", "Pekerjaan Ibu",
    "Wali", "Pekerjaan Wali", "No Kartu Keluarga"
];

type MuridData = Record<string, string>;

const cellClassName = "border p-1 text-xs whitespace-nowrap min-w-[100px] h-6 focus:outline-none";
const headerCellClassName = "border bg-muted/50 p-2 text-xs font-bold text-center whitespace-nowrap";
const TOTAL_ROWS = 30;

// Helper to create an empty row
const createEmptyRow = (): MuridData => tableHeaders.reduce((acc, header) => ({ ...acc, [header]: '' }), {});

export function MigrasiMurid() {
    const [rows, setRows] = useState<MuridData[]>(() => Array.from({ length: TOTAL_ROWS }, createEmptyRow));
    const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
    const { toast } = useToast();

    const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!selectedCell) {
            toast({
                variant: "destructive",
                title: "Tidak Ada Sel yang Dipilih",
                description: "Silakan klik sel di tabel untuk menentukan tempat menempelkan data."
            });
            return;
        }

        const pasteData = event.clipboardData.getData("text");
        const pastedLines = pasteData.trim().split('\n');

        if (pastedLines.length === 0) return;
        
        const newRows = [...rows];
        let maxRowIndex = selectedCell.row;

        pastedLines.forEach((line, lineIndex) => {
            const rowIndex = selectedCell.row + lineIndex;
            if (rowIndex >= newRows.length) return; // Stop if paste exceeds table bounds

            const values = line.split('\t');
            values.forEach((value, valueIndex) => {
                const colIndex = selectedCell.col + valueIndex;
                if (colIndex >= tableHeaders.length) return; // Stop if paste exceeds table bounds

                const header = tableHeaders[colIndex];
                // Skip updating the "No" column from pasted data
                if (header === "No") return;
                
                newRows[rowIndex][header] = value.trim();
            });
            maxRowIndex = rowIndex;
        });

        setRows(newRows);

        // Select the last cell that was pasted into
        const lastPastedLineValues = pastedLines[pastedLines.length - 1].split('\t');
        const lastColIndex = selectedCell.col + lastPastedLineValues.length - 1;
        setSelectedCell({
            row: maxRowIndex,
            col: Math.min(lastColIndex, tableHeaders.length - 1)
        });

        toast({
            title: "Data Ditempel!",
            description: `${pastedLines.length} baris data telah ditempelkan.`,
        });
    }, [selectedCell, rows, toast]);
    
    const handleCellClick = (rowIndex: number, colIndex: number) => {
        setSelectedCell({ row: rowIndex, col: colIndex });
    };

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-full mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Migrasi Murid</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Klik pada sel untuk memilihnya, lalu tempelkan data Anda (Ctrl+V/Cmd+V). Data akan disisipkan mulai dari sel yang Anda pilih.
                    </p>
                </header>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Data Murid untuk Migrasi</CardTitle>
                        <CardDescription>
                            Tabel ini berfungsi seperti spreadsheet. Klik sel, lalu salin dan tempel data Anda.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div 
                            className="relative w-full overflow-auto rounded-md border max-h-[600px] focus:outline-none focus:ring-2 focus:ring-ring"
                            onPaste={handlePaste}
                            tabIndex={-1} 
                        >
                            <Table className="border-collapse">
                                <TableHeader className="sticky top-0 z-10 bg-card">
                                    <TableRow>
                                        {tableHeaders.map((header) => (
                                            <TableHead key={header} className={cn(
                                                headerCellClassName,
                                                header === "No" && "w-[50px] min-w-[50px]"
                                            )}>
                                                {header}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                   {rows.map((row, rowIndex) => (
                                       <TableRow key={`row-${rowIndex}`} className="border-0">
                                           {tableHeaders.map((header, colIndex) => (
                                               <TableCell 
                                                   key={`cell-${rowIndex}-${colIndex}`} 
                                                   className={cn(
                                                       cellClassName,
                                                       {
                                                           "w-[50px] min-w-[50px] text-center": header === "No",
                                                           "ring-2 ring-primary ring-inset": selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                                                       }
                                                   )}
                                                   onClick={() => handleCellClick(rowIndex, colIndex)}
                                               >
                                                   {header === "No"
                                                       ? (row["Username"] ? rowIndex + 1 : "")
                                                       : row[header]}
                                               </TableCell>
                                           ))}
                                       </TableRow>
                                   ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
