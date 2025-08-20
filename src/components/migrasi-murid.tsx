
"use client";

import { useState, useCallback, useMemo } from "react";
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

const cellClassName = "border p-1 text-xs whitespace-nowrap min-w-[100px] h-6 focus:outline-none";
const headerCellClassName = "border bg-muted/50 p-2 text-xs font-bold text-center whitespace-nowrap";
const INITIAL_ROWS = 30;

// Helper to create an empty row
const createEmptyRow = (): MuridData => tableHeaders.reduce((acc, header) => ({ ...acc, [header]: '' }), {});

export function MigrasiMurid() {
    const [rows, setRows] = useState<MuridData[]>(() => Array.from({ length: INITIAL_ROWS }, createEmptyRow));
    const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
    const [numRowsToAdd, setNumRowsToAdd] = useState(1);
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
        
        setRows(currentRows => {
            const newRows = [...currentRows];
            let maxRowIndex = selectedCell.row;

            pastedLines.forEach((line, lineIndex) => {
                const rowIndex = selectedCell.row + lineIndex;
                
                // If paste exceeds current table bounds, add new rows
                while (rowIndex >= newRows.length) {
                    newRows.push(createEmptyRow());
                }

                const values = line.split('\t');
                values.forEach((value, valueIndex) => {
                    const colIndex = selectedCell.col + valueIndex;
                    if (colIndex >= tableHeaders.length) return; // Stop if paste exceeds table bounds horizontally

                    const header = tableHeaders[colIndex];
                    // Skip updating the "No" column from pasted data
                    if (header === "No") return;
                    
                    newRows[rowIndex][header] = value.trim();
                });
                maxRowIndex = rowIndex;
            });

             // Select the last cell that was pasted into
            const lastPastedLineValues = pastedLines[pastedLines.length - 1].split('\t');
            const lastColIndex = selectedCell.col + lastPastedLineValues.length - 1;
            setSelectedCell({
                row: maxRowIndex,
                col: Math.min(lastColIndex, tableHeaders.length - 1)
            });

            return newRows;
        });

        toast({
            title: "Data Ditempel!",
            description: `${pastedLines.length} baris data telah ditempelkan.`,
        });
    }, [selectedCell, toast]);
    
    const handleCellClick = (rowIndex: number, colIndex: number) => {
        setSelectedCell({ row: rowIndex, col: colIndex });
    };

    const handleAddRows = () => {
        const count = Number(numRowsToAdd);
        if (isNaN(count) || count < 1) {
            toast({
                variant: "destructive",
                title: "Input Tidak Valid",
                description: "Silakan masukkan jumlah baris yang valid.",
            });
            return;
        }
        
        const newEmptyRows = Array.from({ length: count }, createEmptyRow);
        setRows(prevRows => [...prevRows, ...newEmptyRows]);
        toast({
            title: "Baris Ditambahkan",
            description: `${count} baris kosong telah ditambahkan di akhir tabel.`,
        });
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
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <CardTitle>Data Murid untuk Migrasi</CardTitle>
                                <CardDescription className="mt-1">
                                    Tabel ini berfungsi seperti spreadsheet. Klik sel, lalu salin dan tempel data Anda. Tabel akan bertambah otomatis.
                                </CardDescription>
                            </div>
                        </div>
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
                                                           "w-[50px] min-w-[50px] text-center bg-muted/50": header === "No",
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
