
"use client";

import { useState, useCallback, useTransition, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, CheckCircle2, AlertTriangle, Trash2, Search, FileWarning, Copy, Check, Cake, XCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

declare const XLSX: any;

type StudentRecord = {
    id: string; // Combined NIS or NISN
    nama: string;
    fileName: string;
    sheetName: string;
};

type HeaderInfo = {
    rowIndex: number;
    nisIndex: number;
    nisnIndex: number;
    namaIndex: number;
    dobIndex: number; // Date of Birth index
};

type FileData = {
    name: string;
    buffer: ArrayBuffer;
};


type HeaderValidationResult = {
    success: true;
    headerInfo: HeaderInfo;
} | {
    success: false;
    missing: ('Nama' | 'NIS/NISN')[];
};


export function CekDuplikasi() {
    const [filesData, setFilesData] = useState<FileData[]>([]);
    const [duplicates, setDuplicates] = useState<StudentRecord[]>([]);
    const [emptyIdRecords, setEmptyIdRecords] = useState<StudentRecord[]>([]);
    const [emptyDobRecords, setEmptyDobRecords] = useState<StudentRecord[]>([]);
    const [isChecking, startChecking] = useTransition();
    const [hasChecked, setHasChecked] = useState(false);
    const [processedFileCount, setProcessedFileCount] = useState(0);
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setDuplicates([]);
            setEmptyIdRecords([]);
            setEmptyDobRecords([]);
            setHasChecked(false);
            setProcessedFileCount(0);
            
            try {
                const filePromises = Array.from(event.target.files).map(file => {
                    return new Promise<FileData>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            if (e.target?.result instanceof ArrayBuffer) {
                                resolve({ name: file.name, buffer: e.target.result });
                            } else {
                                reject(new Error('Failed to read file as ArrayBuffer.'));
                            }
                        };
                        reader.onerror = (e) => reject(new Error('File reading error: ' + reader.error));
                        reader.readAsArrayBuffer(file);
                    });
                });

                const allFilesData = await Promise.all(filePromises);
                setFilesData(allFilesData);

            } catch (error) {
                 toast({
                    variant: 'destructive',
                    title: 'Error Reading Files',
                    description: `Could not read the selected files. Please try again. Error: ${error instanceof Error ? error.message : 'Unknown'}`,
                });
            }
        }
    };

    const findHeaderRow = (sheetData: any[][]): HeaderValidationResult => {
        let potentialHeaderRow = -1;
        let nisIndex = -1;
        let nisnIndex = -1;
        let namaIndex = -1;

        // Try to find a header row in the first 20 rows
        for (let i = 0; i < Math.min(sheetData.length, 20); i++) {
            const row = sheetData[i];
            if (!Array.isArray(row)) continue;
    
            const lowerCaseHeaders = row.map(h => String(h || '').toLowerCase().trim());
            const tempNisIndex = lowerCaseHeaders.findIndex(h => h === 'nis' || h === 'no. induk');
            const tempNisnIndex = lowerCaseHeaders.findIndex(h => h === 'nisn');
            const tempNamaIndex = lowerCaseHeaders.findIndex(h => h.includes('nama'));
            
            // If we find at least one of the key headers, we'll assume this is the header row
            if (tempNamaIndex !== -1 || tempNisIndex !== -1 || tempNisnIndex !== -1) {
                 potentialHeaderRow = i;
                 nisIndex = tempNisIndex;
                 nisnIndex = tempNisnIndex;
                 namaIndex = tempNamaIndex;
                 break;
            }
        }

        const missing: ('Nama' | 'NIS/NISN')[] = [];
        if (namaIndex === -1) {
            missing.push('Nama');
        }
        if (nisIndex === -1 && nisnIndex === -1) {
            missing.push('NIS/NISN');
        }

        if (missing.length > 0) {
            return { success: false, missing };
        }

        // Only return success if we found everything
        const dobIndex = sheetData[potentialHeaderRow].map(h => String(h || '').toLowerCase().trim()).findIndex(h => h.includes('tanggal lahir') || h.includes('tgl lahir'));
        return {
            success: true,
            headerInfo: { rowIndex: potentialHeaderRow, nisIndex, nisnIndex, namaIndex, dobIndex }
        };
    };


    const handleCheckDuplicates = useCallback(async () => {
        if (filesData.length === 0) {
            toast({
                variant: 'destructive',
                title: 'No Files Selected',
                description: 'Please upload at least one Excel file to check for duplicates.',
            });
            return;
        }

        if (typeof XLSX === 'undefined') {
            toast({
                variant: 'destructive',
                title: 'Library Not Loaded',
                description: 'The required Excel processing library (XLSX) is not available. Please check your internet connection and try reloading the page.',
            });
            return;
        }

        startChecking(async () => {
            setHasChecked(true);
            setProcessedFileCount(0);
            const idMap = new Map<string, { nama: string, fileName: string, sheetName: string }[]>();
            const foundEmptyId: StudentRecord[] = [];
            const foundEmptyDob: StudentRecord[] = [];
            let filesProcessed = 0;

            for (const fileData of filesData) {
                let fileHasValidSheet = false;
                try {
                    const workbook = XLSX.read(fileData.buffer, { type: 'buffer' });
                    
                    for (const sheetName of workbook.SheetNames) {
                        const worksheet = workbook.Sheets[sheetName];
                        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                        if (sheetData.length === 0) continue;

                        const headerResult = findHeaderRow(sheetData);
                        
                        if (!headerResult.success) {
                            const missingMessage = `Sheet '${sheetName}' is missing required column(s): ${headerResult.missing.join(', ')}.`;
                             toast({
                                variant: 'destructive',
                                title: `Invalid Format: ${fileData.name}`,
                                description: missingMessage,
                            });
                            continue; // Skip this sheet
                        }
                        
                        fileHasValidSheet = true;
                        const { headerInfo } = headerResult;
                        const { rowIndex: headerRowIndex, nisIndex, nisnIndex, namaIndex, dobIndex } = headerInfo;
                        const startRow = headerRowIndex + 1;

                        for (let i = startRow; i < sheetData.length; i++) {
                            const row = sheetData[i];
                            if (!row || row.length === 0) continue;

                            const nisValue = nisIndex !== -1 ? String(row[nisIndex] || '').trim() : '';
                            const nisnValue = nisnIndex !== -1 ? String(row[nisnIndex] || '').trim() : '';
                            const namaValue = String(row[namaIndex] || '').trim();
                            
                            const id = nisValue || nisnValue;
                             
                            const isIdEmpty = !id || !/\d/.test(id);
                            const isNamePresent = namaValue && namaValue.toLowerCase() !== 'nama';
                            
                            if (dobIndex !== -1) {
                                const dobValue = row[dobIndex];
                                const isDobEmpty = !dobValue || (typeof dobValue === 'string' && dobValue.startsWith('#'));
                                if (isNamePresent && isDobEmpty) {
                                    foundEmptyDob.push({ id: 'N/A', nama: namaValue, fileName: fileData.name, sheetName });
                                }
                            }
                            
                            if (isIdEmpty) {
                                if (isNamePresent) {
                                    foundEmptyId.push({ id: 'N/A', nama: namaValue, fileName: fileData.name, sheetName });
                                }
                                continue; 
                            }
                            
                            if (!idMap.has(id)) {
                                idMap.set(id, []);
                            }
                            idMap.get(id)?.push({ nama: namaValue, fileName: fileData.name, sheetName });
                        }
                    }
                     if (fileHasValidSheet) {
                        filesProcessed++;
                    }

                } catch (error) {
                    console.error("Error processing file:", fileData.name, error);
                    toast({
                        variant: 'destructive',
                        title: `Error Reading ${fileData.name}`,
                        description: `The file might be corrupted or in an unsupported format. Error: ${error instanceof Error ? error.message : 'Unknown'}`,
                    });
                }
            }
            
            setProcessedFileCount(filesProcessed);

            const foundDuplicates: StudentRecord[] = [];
            idMap.forEach((records, id) => {
                if (records.length > 1) {
                    records.forEach(record => {
                        foundDuplicates.push({ id, ...record });
                    });
                }
            });

            setDuplicates(foundDuplicates);
            setEmptyIdRecords(foundEmptyId);
            setEmptyDobRecords(foundEmptyDob);
        });
    }, [filesData, toast]);
    
    const handleClear = () => {
        setFilesData([]);
        setDuplicates([]);
        setEmptyIdRecords([]);
        setEmptyDobRecords([]);
        setHasChecked(false);
        setProcessedFileCount(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const summaryText = useMemo(() => {
        if (!hasChecked || isChecking) return "";

        let summary = "";

        // Duplicates summary
        const groupedDuplicates = duplicates.reduce((acc, curr) => {
            const { id } = curr;
            if (id) {
                if (!acc[id]) acc[id] = [];
                acc[id].push(curr);
            }
            return acc;
        }, {} as Record<string, StudentRecord[]>);

        const duplicateEntries = Object.entries(groupedDuplicates);
        if (duplicateEntries.length > 0) {
            summary += "NIS/NISN yang terduplikasi:\n";
            duplicateEntries.forEach(([id, records]) => {
                const names = records.map(r => r.nama).join(' dan ');
                const sheetNames = [...new Set(records.map(r => r.sheetName))].join(', ');
                summary += `- ${id} telah digunakan pada nama ${names} di sheet ${sheetNames}\n`;
            });
            summary += "\n";
        }

        // Empty ID summary
        if (emptyIdRecords.length > 0) {
            summary += "Siswa dengan NIS/NISN Kosong:\n";
            emptyIdRecords.forEach(record => {
                summary += `- ${record.nama} sheet ${record.sheetName}\n`;
            });
            summary += "\n";
        }
        
        // Empty DOB summary
        if (emptyDobRecords.length > 0) {
            summary += "Siswa dengan Tanggal Lahir Kosong:\n";
            emptyDobRecords.forEach(record => {
                summary += `- ${record.nama} sheet ${record.sheetName}\n`;
            });
        }

        return summary.trim() || "Tidak ada masalah ditemukan.";
    }, [duplicates, emptyIdRecords, emptyDobRecords, hasChecked, isChecking]);


    const handleCopySummary = () => {
        navigator.clipboard.writeText(summaryText).then(() => {
            toast({
                title: "Summary Copied!",
                description: "The summary has been copied to your clipboard.",
            });
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            toast({
                variant: "destructive",
                title: "Copy Failed",
                description: "Could not copy summary to clipboard.",
            });
            console.error('Failed to copy: ', err);
        });
    };

    const renderResults = () => {
        if (processedFileCount === 0) {
            return (
                <div className="flex flex-col items-center justify-center text-center py-8">
                    <XCircle className="w-16 h-16 text-destructive mb-4" />
                    <p className="font-semibold text-lg">Pengecekan Gagal</p>
                    <p className="text-muted-foreground mt-1 max-w-md">
                        Pastikan setiap file memiliki kolom 'Nama' dan 'NIS' atau 'NISN' sesuai petunjuk notifikasi.
                    </p>
                </div>
            );
        }

        if (duplicates.length === 0 && emptyIdRecords.length === 0 && emptyDobRecords.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center text-center py-8">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                    <p className="font-semibold text-lg">Tidak Ada Masalah Ditemukan</p>
                    <p className="text-muted-foreground mt-1">Tidak ada NIS/NISN duplikat, ID kosong, atau tanggal lahir kosong pada file yang Anda unggah.</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                 <div className="space-y-6">
                    {duplicates.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-destructive">
                                    <AlertTriangle />
                                    NIS/NISN Duplikat ({new Set(duplicates.map(d => d.id)).size} ID)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                               <div className="relative w-full overflow-auto rounded-md border max-h-[400px]">
                                   <Table>
                                       <TableHeader className="sticky top-0 bg-card z-10">
                                           <TableRow>
                                               <TableHead>NIS/NISN</TableHead>
                                               <TableHead>Nama</TableHead>
                                               <TableHead>File</TableHead>
                                               <TableHead>Sheet</TableHead>
                                           </TableRow>
                                       </TableHeader>
                                       <TableBody>
                                           {duplicates.sort((a, b) => (a.id || '').localeCompare(b.id || '') || a.fileName.localeCompare(b.fileName)).map((item, index) => (
                                               <TableRow key={index} className="bg-destructive/10">
                                                   <TableCell className="font-medium">{item.id}</TableCell>
                                                   <TableCell>{item.nama}</TableCell>
                                                   <TableCell>{item.fileName}</TableCell>
                                                   <TableCell>{item.sheetName}</TableCell>
                                               </TableRow>
                                           ))}
                                       </TableBody>
                                   </Table>
                               </div>
                            </CardContent>
                        </Card>
                    )}

                    {emptyIdRecords.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-amber-600">
                                    <FileWarning />
                                    Siswa dengan NIS/NISN Kosong ({emptyIdRecords.length} Siswa)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                               <div className="relative w-full overflow-auto rounded-md border max-h-[400px]">
                                   <Table>
                                       <TableHeader className="sticky top-0 bg-card z-10">
                                           <TableRow>
                                               <TableHead>Nama</TableHead>
                                               <TableHead>File</TableHead>
                                               <TableHead>Sheet</TableHead>
                                           </TableRow>
                                       </TableHeader>
                                       <TableBody>
                                           {emptyIdRecords.sort((a, b) => a.nama.localeCompare(b.nama)).map((item, index) => (
                                               <TableRow key={index} className="bg-amber-100 dark:bg-amber-900/20">
                                                   <TableCell className="font-medium">{item.nama}</TableCell>
                                                   <TableCell>{item.fileName}</TableCell>
                                                   <TableCell>{item.sheetName}</TableCell>
                                               </TableRow>
                                           ))}
                                       </TableBody>
                                   </Table>
                               </div>
                            </CardContent>
                        </Card>
                    )}
                    
                    {emptyDobRecords.length > 0 && (
                         <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-sky-600">
                                    <Cake />
                                    Siswa dengan Tanggal Lahir Kosong ({emptyDobRecords.length} Siswa)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                               <div className="relative w-full overflow-auto rounded-md border max-h-[400px]">
                                   <Table>
                                       <TableHeader className="sticky top-0 bg-card z-10">
                                           <TableRow>
                                               <TableHead>Nama</TableHead>
                                               <TableHead>File</TableHead>
                                               <TableHead>Sheet</TableHead>
                                           </TableRow>
                                       </TableHeader>
                                       <TableBody>
                                           {emptyDobRecords.sort((a, b) => a.nama.localeCompare(b.nama)).map((item, index) => (
                                               <TableRow key={index} className="bg-sky-100 dark:bg-sky-900/20">
                                                   <TableCell className="font-medium">{item.nama}</TableCell>
                                                   <TableCell>{item.fileName}</TableCell>
                                                   <TableCell>{item.sheetName}</TableCell>
                                               </TableRow>
                                           ))}
                                       </TableBody>
                                   </Table>
                               </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {summaryText && (
                    <div className="lg:sticky lg:top-24">
                        <Card>
                            <CardHeader>
                                <CardTitle>Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    readOnly
                                    value={summaryText}
                                    className="h-96 text-xs font-mono"
                                    placeholder="Summary will appear here after checking files..."
                                />
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleCopySummary} size="sm" variant="outline" disabled={!summaryText || summaryText === "Tidak ada masalah ditemukan."}>
                                    {isCopied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                                    {isCopied ? 'Copied!' : 'Copy Summary'}
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Cek Duplikasi</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Unggah beberapa file Excel untuk menemukan NIS/NISN duplikat, atau siswa tanpa NIS/NISN atau tanggal lahir.
                    </p>
                </header>

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>1. Upload Files</CardTitle>
                            <CardDescription>Pilih satu atau lebih file Excel (.xlsx, .xls) untuk diperiksa.</CardDescription>
                        </div>
                        <Button onClick={handleClear} variant="destructive" size="sm" disabled={isChecking || filesData.length === 0}>
                            <Trash2 className="mr-2 h-4 w-4"/>
                            Clear
                        </Button>
                    </CardHeader>
                    <CardContent>
                         <div className="w-full p-6 border-2 border-dashed rounded-lg">
                            <Input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                                accept=".xlsx, .xls"
                            />
                             <Button onClick={() => document.getElementById('file-upload')?.click()} variant="outline" disabled={isChecking}>
                                <Upload className="mr-2 h-4 w-4" />
                                {filesData.length > 0 ? `Selected ${filesData.length} files` : 'Select Files'}
                            </Button>
                            {filesData.length > 0 && (
                                <ul className="mt-4 text-xs text-muted-foreground list-disc pl-5">
                                    {filesData.map(f => <li key={f.name}>{f.name}</li>)}
                                </ul>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleCheckDuplicates} disabled={isChecking || filesData.length === 0} className="w-full sm:w-auto">
                            {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            {isChecking ? 'Checking...' : 'Check Files'}
                        </Button>
                    </CardFooter>
                </Card>

                 {hasChecked && !isChecking && (
                    <Card>
                        <CardHeader>
                            <CardTitle>2. Hasil Pengecekan</CardTitle>
                            <CardDescription>Berikut adalah ringkasan dari hasil pengecekan file yang Anda unggah.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {renderResults()}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
