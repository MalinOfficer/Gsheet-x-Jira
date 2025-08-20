
"use client";

import { useState, useCallback } from "react";
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

const cellClassName = "border p-2 text-xs whitespace-nowrap";
const headerCellClassName = "border bg-muted/50 p-2 text-xs font-bold text-center whitespace-nowrap";

export function MigrasiMurid() {
    const [rows, setRows] = useState<MuridData[]>([]);
    const { toast } = useToast();

    const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault();
        const pasteData = event.clipboardData.getData("text");
        
        const parsedRows = pasteData
            .trim()
            .split('\n')
            .map(line => {
                const values = line.split('\t');
                const row: MuridData = {};
                tableHeaders.forEach((header, i) => {
                    row[header] = values[i] || '';
                });
                return row;
            });
        
        setRows(prevRows => [...prevRows, ...parsedRows]);

        toast({
            title: "Data Ditempel!",
            description: `${parsedRows.length} baris baru telah ditambahkan ke tabel.`,
        });

    }, [toast]);


    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-full mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Migrasi Murid</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Salin data dari spreadsheet Anda dan tempelkan langsung ke area tabel di bawah ini.
                    </p>
                </header>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Data Murid untuk Migrasi</CardTitle>
                        <CardDescription>
                            Tabel ini berisi semua data murid yang akan dimigrasikan. Klik di area tabel dan tekan Ctrl+V (atau Cmd+V) untuk menempelkan data.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div 
                            className="relative w-full overflow-auto rounded-md border max-h-[600px] focus:outline-none focus:ring-2 focus:ring-ring"
                            onPaste={handlePaste}
                            tabIndex={0} 
                        >
                            <Table className="border-collapse">
                                <TableHeader className="sticky top-0 z-10 bg-card">
                                    <TableRow>
                                        {tableHeaders.map((header) => (
                                            <TableHead key={header} className={cn(headerCellClassName)}>
                                                {header}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                   {rows.length > 0 ? (
                                        rows.map((row, rowIndex) => (
                                            <TableRow key={rowIndex} className="border-0">
                                                {tableHeaders.map((header) => (
                                                    <TableCell key={`${rowIndex}-${header}`} className={cn(cellClassName)}>
                                                        {row[header]}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                   ) : (
                                     <TableRow>
                                        <TableCell colSpan={tableHeaders.length} className="h-24 text-center text-muted-foreground border">
                                            Area untuk menempelkan data. Salin dari Excel/Sheets lalu tempel di sini.
                                        </TableCell>
                                    </TableRow>
                                   )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
