
"use client";

import { useState, useCallback, useTransition, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, CheckCircle2, AlertTriangle, Trash2, Search, FileWarning, Copy, Check, Cake } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

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


export function CekDuplikasi() {
    const [filesData, setFilesData] = useState<FileData[]>([]);
    const [duplicates, setDuplicates] = useState<StudentRecord[]>([]);
    const [emptyIdRecords, setEmptyIdRecords] = useState<StudentRecord[]>([]);
    const [emptyDobRecords, setEmptyDobRecords] = useState<StudentRecord[]>([]);
    const [isChecking, startChecking] = useTransition();
    const [hasChecked, setHasChecked] = useState(false);
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setDuplicates([]);
            setEmptyIdRecords([]);
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
            
            const nisIndex = lowerCaseHeaders.findIndex(h => h === 'nis' || h === 'no. induk');
            const nisnIndex = lowerCaseHeaders.findIndex(h => h === 'nisn');
            const namaIndex = lowerCaseHeaders.findIndex(h => h.includes('nama'));
            const dobIndex = lowerCaseHeaders.findIndex(h => h.includes('tanggal lahir') || h.includes('tgl lahir'));
            
            // Check for duplicates and empty IDs requires Nama and at least one of NIS or NISN.
            if (namaIndex !== -1 && (nisIndex !== -1 || nisnIndex !== -1)) {
                return { rowIndex: i, nisIndex, nisnIndex, namaIndex, dobIndex };
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

                        const headerInfo = findHeaderRow(sheetData);

                        if (!headerInfo) {
                            continue; // Skip sheets that don't have the required headers.
                        }
                        
                        fileHasValidSheet = true; // Mark that this file has at least one processable sheet.
                        const { rowIndex: headerRowIndex, nisIndex, nisnIndex, namaIndex, dobIndex } = headerInfo;
                        const startRow = headerRowIndex + 1;

                        for (let i = startRow; i < sheetData.length; i++) {
                            const row = sheetData[i];
                            if (!row || row.length === 0) continue;

                            const nisValue = nisIndex !== -1 ? String(row[nisIndex] || '').trim() : '';
                            const nisnValue = nisnIndex !== -1 ? String(row[nisnIndex] || '').trim() : '';
                            const namaValue = String(row[namaIndex] || '').trim();
                            
                            // Use NIS as the primary ID, fallback to NISN
                            const id = nisValue || nisnValue;
                             
                            const isIdEmpty = !id || !/\d/.test(id);
                            const isNamePresent = namaValue && namaValue.toLowerCase() !== 'nama';
                            
                            // Check for empty DOB only if the column was found
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
                    } else {
                         toast({
                            variant: 'destructive',
                            title: `Invalid File Format: ${fileData.name}`,
                            description: `The file must contain at least one sheet with a 'Nama' column and either a 'NIS' or 'NISN' column.`,
                        });
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
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Cek Duplikasi & Validasi Data</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Upload beberapa file Excel untuk menemukan NIS/NISN duplikat, ID kosong, dan tanggal lahir kosong di semua file dan sheet.
                    </p>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>1. Upload Files</CardTitle>
                        <CardDescription>
                            Pilih file Excel (.xls, .xlsx) yang ingin Anda periksa. Anda dapat memilih beberapa file sekaligus.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="flex flex-col items-start gap-4">
                            <Input
                                id="file-upload"
                                type="file"
                                multiple
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".xls, .xlsx, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                className="hidden"
                            />
                             <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                                <Upload className="mr-2 h-4 w-4" />
                                {filesData.length > 0 ? `${filesData.length} file(s) chosen` : 'Choose Files'}
                            </Button>
                            
                            {filesData.length > 0 && (
                                <div className="text-sm text-muted-foreground">
                                    <p className='font-medium'>Selected files:</p>
                                    <ul className='list-disc pl-5 mt-1'>
                                        {filesData.map(f => <li key={f.name}>{f.name}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex gap-2 border-t pt-6">
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
