
"use client";

import { useState, useCallback, useTransition } from 'react';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, CheckCircle2, AlertTriangle, Trash2, Search } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from './ui/input';

type DuplicateRecord = {
    nis: string;
    nama: string;
    fileName: string;
    sheetName: string;
};

type HeaderInfo = {
    rowIndex: number;
    nisIndex: number;
    namaIndex: number;
};


export function CekDuplikasi() {
    const [files, setFiles] = useState<File[]>([]);
    const [duplicates, setDuplicates] = useState<DuplicateRecord[]>([]);
    const [isChecking, startChecking] = useTransition();
    const [hasChecked, setHasChecked] = useState(false);
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(Array.from(event.target.files));
            setDuplicates([]);
            setHasChecked(false);
        }
    };

    const findHeaderRow = (sheetData: any[][]): HeaderInfo | null => {
        for (let i = 0; i < Math.min(sheetData.length, 20); i++) {
            const row = sheetData[i];
            if (!Array.isArray(row)) continue;

            const lowerCaseHeaders = row.map(h => String(h || '').toLowerCase().trim());
            
            let nisIndex = -1;
            let namaIndex = -1;

            // Priority 1: Exact matches or very specific 'nis'
            nisIndex = lowerCaseHeaders.findIndex(h => h === 'nis' || h === 'no. induk');
            if (nisIndex === -1) {
                // Priority 2: Contains 'nis' but not 'nisn'
                nisIndex = lowerCaseHeaders.findIndex(h => h.includes('nis') && !h.includes('nisn'));
            }
            if (nisIndex === -1) {
                // Priority 3: Fallback to any 'nis'
                nisIndex = lowerCaseHeaders.findIndex(h => h.includes('nis'));
            }

            // Priority 1: Exact matches for "Nama"
            const exactNamaMatches = ['nama', 'nama siswa', 'nama lengkap'];
            namaIndex = lowerCaseHeaders.findIndex(h => exactNamaMatches.includes(h));
            if (namaIndex === -1) {
                // Priority 2: Contains 'nama' but exclude common false positives
                const excludeKeywords = ['kelas', 'sekolah', 'wali', 'ayah', 'ibu', 'orang tua'];
                namaIndex = lowerCaseHeaders.findIndex(h => h.includes('nama') && !excludeKeywords.some(keyword => h.includes(keyword)));
            }
            if (namaIndex === -1) {
                // Priority 3: Fallback to any 'nama'
                namaIndex = lowerCaseHeaders.findIndex(h => h.includes('nama'));
            }

            if (nisIndex !== -1 && namaIndex !== -1) {
                return { rowIndex: i, nisIndex, namaIndex };
            }
        }
        return null;
    };


    const handleCheckDuplicates = useCallback(async () => {
        if (files.length === 0) {
            toast({
                variant: 'destructive',
                title: 'No Files Selected',
                description: 'Please upload at least one Excel file to check for duplicates.',
            });
            return;
        }

        startChecking(async () => {
            setHasChecked(true);
            const nisMap = new Map<string, { nama: string, fileName: string, sheetName: string }[]>();

            for (const file of files) {
                try {
                    const data = await file.arrayBuffer();
                    const workbook = XLSX.read(data, { type: 'buffer' });
                    
                    for (const sheetName of workbook.SheetNames) {
                        const worksheet = workbook.Sheets[sheetName];
                        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                        if (sheetData.length === 0) continue;

                        const headerInfo = findHeaderRow(sheetData);

                        if (!headerInfo) {
                            console.warn(`Could not find a valid header row in ${file.name} -> ${sheetName}. Skipping sheet.`);
                            continue;
                        }
                        
                        const { rowIndex: headerRowIndex, nisIndex, namaIndex } = headerInfo;
                        const startRow = headerRowIndex + 1;

                        for (let i = startRow; i < sheetData.length; i++) {
                            const row = sheetData[i];
                            if (!row || row.length === 0) continue;

                            const nisValue = row[nisIndex];
                            // Skip row if NIS is empty, null, or doesn't contain any numbers
                            if (!nisValue || String(nisValue).trim() === '' || !/\d/.test(String(nisValue))) continue;

                            const nis = String(nisValue).trim();
                            
                            const nama = namaIndex !== -1 ? String(row[namaIndex] || '').trim() : 'N/A';
                            
                            if (!nisMap.has(nis)) {
                                nisMap.set(nis, []);
                            }
                            nisMap.get(nis)?.push({ nama, fileName: file.name, sheetName });
                        }
                    }
                } catch (error) {
                    console.error("Error processing file:", file.name, error);
                    toast({
                        variant: 'destructive',
                        title: `Error Reading ${file.name}`,
                        description: `The file might be corrupted or in an unsupported format. Error: ${error instanceof Error ? error.message : 'Unknown'}`,
                    });
                }
            }

            const foundDuplicates: DuplicateRecord[] = [];
            nisMap.forEach((records, nis) => {
                if (records.length > 1) {
                    records.forEach(record => {
                        foundDuplicates.push({ nis, ...record });
                    });
                }
            });

            setDuplicates(foundDuplicates);
        });
    }, [files, toast]);
    
    const handleClear = () => {
        setFiles([]);
        setDuplicates([]);
        setHasChecked(false);
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    }

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Cek Duplikasi NIS</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Upload beberapa file Excel sekaligus untuk menemukan NIS yang duplikat di antara semua file dan semua sheet.
                    </p>
                </header>

                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>1. Upload Files</CardTitle>
                        <CardDescription>
                            Pilih file Excel (.xls, .xlsx) yang ingin Anda periksa. Anda dapat memilih beberapa file sekaligus.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-4">
                            <Input
                                id="file-upload"
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                accept=".xls, .xlsx, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                className="block w-full text-sm text-slate-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-primary/10 file:text-primary
                                hover:file:bg-primary/20"
                            />
                            {files.length > 0 && (
                                <div className="text-sm text-muted-foreground">
                                    <p className='font-medium'>{files.length} file(s) selected:</p>
                                    <ul className='list-disc pl-5 mt-1'>
                                        {files.map(f => <li key={f.name}>{f.name}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex gap-2">
                        <Button onClick={handleCheckDuplicates} disabled={isChecking || files.length === 0}>
                            {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            {isChecking ? 'Mengecek...' : 'Cek Duplikasi'}
                        </Button>
                        <Button onClick={handleClear} variant="outline" disabled={isChecking || files.length === 0}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Clear
                        </Button>
                    </CardFooter>
                </Card>

                {hasChecked && !isChecking && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Hasil Pengecekan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {duplicates.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="flex items-center text-destructive">
                                        <AlertTriangle className="mr-2 h-5 w-5" />
                                        <p className="font-semibold">{new Set(duplicates.map(d => d.nis)).size} NIS ditemukan duplikat ({duplicates.length} total entri).</p>
                                    </div>
                                    <div className="relative w-full overflow-auto rounded-md border max-h-[400px]">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-card z-10">
                                                <TableRow>
                                                    <TableHead>NIS</TableHead>
                                                    <TableHead>Nama</TableHead>
                                                    <TableHead>Nama File</TableHead>
                                                    <TableHead>Nama Sheet</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {duplicates.sort((a, b) => a.nis.localeCompare(b.nis) || a.fileName.localeCompare(b.fileName)).map((item, index) => (
                                                    <TableRow key={index} className="bg-destructive/10">
                                                        <TableCell className="font-medium">{item.nis}</TableCell>
                                                        <TableCell>{item.nama}</TableCell>
                                                        <TableCell>{item.fileName}</TableCell>
                                                        <TableCell>{item.sheetName}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center py-8">
                                    <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                                    <p className="font-semibold text-lg">Tidak Ada Duplikasi Ditemukan</p>
                                    <p className="text-muted-foreground mt-1">Semua NIS di file yang Anda upload unik.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
