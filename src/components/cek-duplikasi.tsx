
"use client";

import { useState, useCallback, useTransition, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, CheckCircle2, AlertTriangle, Trash2, Search, FileWarning, Copy, Check, Cake } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

declare const XLSX: any;

type StudentRecord = {
    nis?: string;
    nama: string;
    fileName: string;
    sheetName: string;
};

type HeaderInfo = {
    rowIndex: number;
    nisIndex: number;
    namaIndex: number;
    dobIndex: number; // Date of Birth index
};

type FileData = {
    name: string;
    buffer: ArrayBuffer;
};


export function CekDuplikasi() {
    const [filesData, setFilesData] = useState<FileData[]>([]);
    const [duplicates, setDuplicates] = useState<StudentRecord[]>([]);
    const [emptyNisRecords, setEmptyNisRecords] = useState<StudentRecord[]>([]);
    const [emptyDobRecords, setEmptyDobRecords] = useState<StudentRecord[]>([]);
    const [isChecking, startChecking] = useTransition();
    const [hasChecked, setHasChecked] = useState(false);
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setDuplicates([]);
            setEmptyNisRecords([]);
            setEmptyDobRecords([]);
            setHasChecked(false);
            
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

    const findHeaderRow = (sheetData: any[][]): HeaderInfo | null => {
        for (let i = 0; i < Math.min(sheetData.length, 20); i++) {
            const row = sheetData[i];
            if (!Array.isArray(row)) continue;

            const lowerCaseHeaders = row.map(h => String(h || '').toLowerCase().trim());
            
            let nisIndex = -1;
            let namaIndex = -1;
            let dobIndex = -1;

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

            // Find Date of Birth column by looking for headers that *include* the keywords
            const dobKeywords = ['tanggal lahir', 'tgl lahir'];
            dobIndex = lowerCaseHeaders.findIndex(h => dobKeywords.some(keyword => h.includes(keyword)));
            
            if (nisIndex !== -1 && namaIndex !== -1 && dobIndex !== -1) {
                return { rowIndex: i, nisIndex, namaIndex, dobIndex };
            }
        }
        return null;
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
            const nisMap = new Map<string, { nama: string, fileName: string, sheetName: string }[]>();
            const foundEmptyNis: StudentRecord[] = [];
            const foundEmptyDob: StudentRecord[] = [];

            for (const fileData of filesData) {
                try {
                    const workbook = XLSX.read(fileData.buffer, { type: 'buffer' });
                    
                    for (const sheetName of workbook.SheetNames) {
                        const worksheet = workbook.Sheets[sheetName];
                        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                        if (sheetData.length === 0) continue;

                        const headerInfo = findHeaderRow(sheetData);

                        if (!headerInfo) {
                            console.warn(`Could not find a valid header row in ${fileData.name} -> ${sheetName}. Skipping sheet.`);
                            continue;
                        }
                        
                        const { rowIndex: headerRowIndex, nisIndex, namaIndex, dobIndex } = headerInfo;
                        const startRow = headerRowIndex + 1;

                        for (let i = startRow; i < sheetData.length; i++) {
                            const row = sheetData[i];
                            if (!row || row.length === 0) continue;

                            const nisValue = row[nisIndex];
                            const namaValue = String(row[namaIndex] || '').trim();
                            const dobValue = row[dobIndex];
                            const nis = String(nisValue).trim();

                            const isNisEmpty = !nis || !/\d/.test(nis);
                            const isNamePresent = namaValue && namaValue.toLowerCase() !== 'nama';
                            
                            // A cell is considered empty if it's falsy (empty string, null, undefined) or an excel error string like #VALUE!
                            const isDobEmpty = !dobValue || (typeof dobValue === 'string' && dobValue.startsWith('#'));

                            if (isNamePresent && isDobEmpty) {
                                foundEmptyDob.push({ nama: namaValue, fileName: fileData.name, sheetName });
                            }
                            
                            if (isNisEmpty) {
                                if (isNamePresent) {
                                    foundEmptyNis.push({ nama: namaValue, fileName: fileData.name, sheetName });
                                }
                                continue; 
                            }
                            
                            if (!nisMap.has(nis)) {
                                nisMap.set(nis, []);
                            }
                            nisMap.get(nis)?.push({ nama: namaValue, fileName: fileData.name, sheetName });
                        }
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

            const foundDuplicates: StudentRecord[] = [];
            nisMap.forEach((records, nis) => {
                if (records.length > 1) {
                    records.forEach(record => {
                        foundDuplicates.push({ nis, ...record });
                    });
                }
            });

            setDuplicates(foundDuplicates);
            setEmptyNisRecords(foundEmptyNis);
            setEmptyDobRecords(foundEmptyDob);
        });
    }, [filesData, toast]);
    
    const handleClear = () => {
        setFilesData([]);
        setDuplicates([]);
        setEmptyNisRecords([]);
        setEmptyDobRecords([]);
        setHasChecked(false);
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    }

    const summaryText = useMemo(() => {
        if (!hasChecked || isChecking) return "";

        let summary = "";

        // Duplicates summary
        const groupedDuplicates = duplicates.reduce((acc, curr) => {
            const { nis } = curr;
            if (nis) {
                if (!acc[nis]) acc[nis] = [];
                acc[nis].push(curr);
            }
            return acc;
        }, {} as Record<string, StudentRecord[]>);

        const duplicateEntries = Object.entries(groupedDuplicates);
        if (duplicateEntries.length > 0) {
            summary += "NIS yang terduplikasi:\n";
            duplicateEntries.forEach(([nis, records]) => {
                const names = records.map(r => r.nama).join(' dan ');
                const sheetNames = [...new Set(records.map(r => r.sheetName))].join(', ');
                summary += `- ${nis} telah digunakan pada nama ${names} di sheet ${sheetNames}\n`;
            });
            summary += "\n";
        }

        // Empty NIS summary
        if (emptyNisRecords.length > 0) {
            summary += "Siswa dengan NIS Kosong:\n";
            emptyNisRecords.forEach(record => {
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
    }, [duplicates, emptyNisRecords, emptyDobRecords, hasChecked, isChecking]);


    const handleCopySummary = () => {
        navigator.clipboard.writeText(summaryText).then(() => {
            setIsCopied(true);
            toast({
                title: "Summary Copied!",
                description: "The summary has been copied to your clipboard.",
            });
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
        if (duplicates.length === 0 && emptyNisRecords.length === 0 && emptyDobRecords.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center text-center py-8">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                    <p className="font-semibold text-lg">Tidak Ada Masalah Ditemukan</p>
                    <p className="text-muted-foreground mt-1">Tidak ada NIS duplikat, NIS kosong, atau tanggal lahir kosong pada file yang Anda unggah.</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    {duplicates.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-destructive">
                                    <AlertTriangle />
                                    Hasil Pengecekan Duplikasi
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                               <p className="font-semibold mb-4">{new Set(duplicates.map(d => d.nis)).size} NIS ditemukan duplikat ({duplicates.length} total entri).</p>
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
                                           {duplicates.sort((a, b) => (a.nis || '').localeCompare(b.nis || '') || a.fileName.localeCompare(b.fileName)).map((item, index) => (
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
                            </CardContent>
                        </Card>
                    )}

                    {emptyNisRecords.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-amber-600">
                                    <FileWarning />
                                    Siswa dengan NIS Kosong
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                               <p className="font-semibold mb-4">{emptyNisRecords.length} siswa ditemukan tanpa NIS yang valid.</p>
                               <div className="relative w-full overflow-auto rounded-md border max-h-[400px]">
                                   <Table>
                                       <TableHeader className="sticky top-0 bg-card z-10">
                                           <TableRow>
                                               <TableHead>Nama</TableHead>
                                               <TableHead>Nama File</TableHead>
                                               <TableHead>Nama Sheet</TableHead>
                                           </TableRow>
                                       </TableHeader>
                                       <TableBody>
                                           {emptyNisRecords.sort((a, b) => a.nama.localeCompare(b.nama)).map((item, index) => (
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
                                    Siswa dengan Tanggal Lahir Kosong
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                               <p className="font-semibold mb-4">{emptyDobRecords.length} siswa ditemukan tanpa tanggal lahir.</p>
                               <div className="relative w-full overflow-auto rounded-md border max-h-[400px]">
                                   <Table>
                                       <TableHeader className="sticky top-0 bg-card z-10">
                                           <TableRow>
                                               <TableHead>Nama</TableHead>
                                               <TableHead>Nama File</TableHead>
                                               <TableHead>Nama Sheet</TableHead>
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

                <div className="lg:col-span-1">
                    <Card className="sticky top-24">
                        <CardHeader>
                            <CardTitle>Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                readOnly
                                value={summaryText}
                                className="h-64 text-xs font-mono"
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
            </div>
        );
    }


    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Cek Duplikasi & Validasi Data</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Upload beberapa file Excel untuk menemukan NIS duplikat, NIS kosong, dan tanggal lahir kosong di semua file dan sheet.
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
                            {filesData.length > 0 && (
                                <div className="text-sm text-muted-foreground">
                                    <p className='font-medium'>{filesData.length} file(s) selected:</p>
                                    <ul className='list-disc pl-5 mt-1'>
                                        {filesData.map(f => <li key={f.name}>{f.name}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex gap-2">
                        <Button onClick={handleCheckDuplicates} disabled={isChecking || filesData.length === 0}>
                            {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            {isChecking ? 'Mengecek...' : 'Cek File'}
                        </Button>
                        <Button onClick={handleClear} variant="outline" disabled={isChecking || filesData.length === 0}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Clear
                        </Button>
                    </CardFooter>
                </Card>

                {hasChecked && !isChecking && (
                    renderResults()
                )}
            </div>
        </div>
    );
}
