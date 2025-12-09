

"use client";

import { useState, useCallback, useTransition, useMemo, useRef, DragEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Upload, CheckCircle2, AlertTriangle, Trash2, Search, FileWarning, Copy, Check, Cake, XCircle, FileText, X, RefreshCw } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { Spinner } from './ui/spinner';

declare const XLSX: any;

type StudentRecord = {
    type: 'NIS' | 'NISN' | 'ID Kosong' | 'TTL Kosong';
    value: string;
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
    size: number;
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
    const [isDragging, setIsDragging] = useState(false);


    const processFiles = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setDuplicates([]);
        setEmptyIdRecords([]);
        setEmptyDobRecords([]);
        setHasChecked(false);
        setProcessedFileCount(0);

        try {
            const filePromises = Array.from(files).map(file => {
                if (!file.type.includes('spreadsheet') && !file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
                    toast({
                        variant: 'destructive',
                        title: 'Invalid File Type',
                        description: `Skipping '${file.name}' as it is not a valid Excel file.`,
                    });
                    return Promise.resolve(null);
                }

                return new Promise<FileData>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if (e.target?.result instanceof ArrayBuffer) {
                            resolve({ name: file.name, buffer: e.target.result, size: file.size });
                        } else {
                            reject(new Error('Failed to read file as ArrayBuffer.'));
                        }
                    };
                    reader.onerror = (e) => reject(new Error('File reading error: ' + reader.error));
                    reader.readAsArrayBuffer(file);
                });
            });

            const allFilesData = (await Promise.all(filePromises)).filter((f): f is FileData => f !== null);
            setFilesData(allFilesData);

        } catch (error) {
             toast({
                variant: 'destructive',
                title: 'Error Reading Files',
                description: `Could not read the selected files. Please try again. Error: ${error instanceof Error ? error.message : 'Unknown'}`,
            });
        }
    }, [toast]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        processFiles(event.target.files);
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        if (event.dataTransfer.files) {
            processFiles(event.dataTransfer.files);
        }
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
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

        if (potentialHeaderRow === -1 || missing.length > 0) {
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
            
            type RecordInfo = { nama: string; fileName: string; sheetName: string };
            const nisMap = new Map<string, RecordInfo[]>();
            const nisnMap = new Map<string, RecordInfo[]>();
            
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
                             if(headerResult.missing.length > 0) {
                                const missingMessage = `Sheet '${sheetName}' is missing required column(s): ${headerResult.missing.join(', ')}.`;
                                toast({
                                    variant: 'destructive',
                                    title: `Invalid Format: ${fileData.name}`,
                                    description: missingMessage,
                                });
                            }
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
                            
                            const recordInfo = { nama: namaValue, fileName: fileData.name, sheetName };

                            const isIdEmpty = !nisValue && !nisnValue;
                            const isNamePresent = namaValue && namaValue.toLowerCase() !== 'nama';
                            
                            if (dobIndex !== -1) {
                                const dobValue = row[dobIndex];
                                const isDobEmpty = !dobValue || (typeof dobValue === 'string' && dobValue.startsWith('#'));
                                if (isNamePresent && isDobEmpty) {
                                    foundEmptyDob.push({ type: 'TTL Kosong', value: 'N/A', ...recordInfo });
                                }
                            }
                            
                            if (isIdEmpty) {
                                if (isNamePresent) {
                                    foundEmptyId.push({ type: 'ID Kosong', value: 'N/A', ...recordInfo });
                                }
                            } else {
                                if (nisValue) {
                                    if (!nisMap.has(nisValue)) nisMap.set(nisValue, []);
                                    nisMap.get(nisValue)!.push(recordInfo);
                                }
                                if (nisnValue) {
                                    if (!nisnMap.has(nisnValue)) nisnMap.set(nisnValue, []);
                                    nisnMap.get(nisnValue)!.push(recordInfo);
                                }
                            }
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
            nisMap.forEach((records, nis) => {
                if (records.length > 1) {
                    records.forEach(record => foundDuplicates.push({ type: 'NIS', value: nis, ...record }));
                }
            });
            nisnMap.forEach((records, nisn) => {
                if (records.length > 1) {
                    records.forEach(record => foundDuplicates.push({ type: 'NISN', value: nisn, ...record }));
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
            const key = `${curr.type}:${curr.value}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(curr);
            return acc;
        }, {} as Record<string, StudentRecord[]>);
    
        const duplicateEntries = Object.values(groupedDuplicates);
        if (duplicateEntries.length > 0) {
            summary += "Data yang terduplikasi:\n";
            duplicateEntries.forEach((records) => {
                const { type, value } = records[0];
                const names = [...new Set(records.map(r => r.nama))].join(' dan ');
                const sheetNames = [...new Set(records.map(r => r.sheetName))].join(', ');
                summary += `- ${type} ${value} telah digunakan pada nama ${names} di sheet ${sheetNames}\n`;
            });
            summary += "\n";
        }
    
        // Empty ID summary
        if (emptyIdRecords.length > 0) {
            summary += "Siswa dengan NIS/NISN Kosong:\n";
            emptyIdRecords.forEach(record => {
                summary += `- ${record.nama} di sheet ${record.sheetName}\n`;
            });
            summary += "\n";
        }
        
        // Empty DOB summary
        if (emptyDobRecords.length > 0) {
            summary += "Siswa dengan Tanggal Lahir Kosong:\n";
            emptyDobRecords.forEach(record => {
                summary += `- ${record.nama} di sheet ${record.sheetName}\n`;
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
            <div className="grid grid-cols-1 gap-6">
                <div className="space-y-6">
                    {duplicates.length > 0 && (
                        <ResultTable title="Data Duplikat" icon={AlertTriangle} count={new Set(duplicates.map(d => `${d.type}:${d.value}`)).size} data={duplicates} type="duplicate" />
                    )}

                    {emptyIdRecords.length > 0 && (
                        <ResultTable title="Siswa dengan NIS/NISN Kosong" icon={FileWarning} count={emptyIdRecords.length} data={emptyIdRecords} type="emptyId" />

                    )}
                    
                    {emptyDobRecords.length > 0 && (
                         <ResultTable title="Siswa dengan Tanggal Lahir Kosong" icon={Cake} count={emptyDobRecords.length} data={emptyDobRecords} type="emptyDob" />
                    )}
                </div>

                {summaryText && (
                    <div>
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
    
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

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
                            Clear All
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                "w-full p-6 border-2 border-dashed rounded-lg transition-colors duration-200 cursor-pointer",
                                isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                            )}
                        >
                            <Input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                                accept=".xlsx, .xls, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                disabled={isChecking}
                            />
                            {filesData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
                                    <Upload className="w-10 h-10 mb-2" />
                                    <p className="font-semibold">Click to browse or drag and drop files here</p>
                                    <p className="text-xs mt-1">Supports .xlsx and .xls</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="font-semibold mb-3 text-center sm:text-left">Selected Files:</p>
                                    <div className="space-y-2">
                                        {filesData.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                                                <div className="flex items-center gap-3">
                                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                                    <div className='flex flex-col'>
                                                        <span className="font-medium text-foreground truncate">{file.name}</span>
                                                        <span className='text-xs text-muted-foreground'>{formatFileSize(file.size)}</span>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFilesData(filesData.filter((_, i) => i !== index));
                                                    }}
                                                    disabled={isChecking}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-center text-xs text-muted-foreground mt-4">Click area to add more files.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleCheckDuplicates} disabled={isChecking || filesData.length === 0} className="w-full sm:w-auto">
                            {isChecking ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
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

function ResultTable({ title, icon: Icon, count, data, type }: { title: string, icon: React.ElementType, count: number, data: StudentRecord[], type: 'duplicate' | 'emptyId' | 'emptyDob' }) {
    const tableContainerRef = useRef<HTMLDivElement>(null);
    
    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    }, [data]);
    

    const rowVirtualizer = useVirtualizer({
        count: sortedData.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 41,
        overscan: 5,
    });
    
    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalHeight = rowVirtualizer.getTotalSize();

    let titleText = title;
    if (type === 'duplicate') titleText = `${title} (${count} ID unik)`;
    if (type === 'emptyId' || type === 'emptyDob') titleText = `${title} (${count} Siswa)`;

    const rowBgClass = type === 'duplicate' ? 'bg-destructive/10' 
                     : type === 'emptyId' ? 'bg-amber-100 dark:bg-amber-900/20'
                     : 'bg-sky-100 dark:bg-sky-900/20';
    
    const titleColorClass = type === 'duplicate' ? 'text-destructive' 
                          : type === 'emptyId' ? 'text-amber-600'
                          : 'text-sky-600';

    const headers = useMemo(() => type === 'duplicate' 
        ? ['Jenis Duplikat', 'Nama', 'File', 'Sheet'] 
        : ['Nama', 'File', 'Sheet'], [type]);
    
    const columnWidths = useMemo(() => type === 'duplicate' 
        ? ['25%', '30%', '25%', '20%'] 
        : ['40%', '40%', '20%'], [type]);


    return (
        <Card>
            <CardHeader>
                <CardTitle className={cn('flex items-center gap-2', titleColorClass)}>
                    <Icon />
                    {titleText}
                </CardTitle>
            </CardHeader>
            <CardContent>
               <div ref={tableContainerRef} className="w-full overflow-auto rounded-md border h-[400px]">
                   <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                       {/* Header */}
                       <div className="flex sticky top-0 bg-card z-10 font-medium text-muted-foreground text-sm border-b">
                           {headers.map((header, index) => (
                               <div key={header} style={{ width: columnWidths[index] }} className="p-4 text-left">
                                   {header}
                               </div>
                           ))}
                       </div>

                       {/* Virtualized Rows */}
                       {virtualRows.map((virtualRow) => {
                           const item = sortedData[virtualRow.index];
                           const cells = type === 'duplicate' 
                               ? [`${item.type}: ${item.value}`, item.nama, item.fileName, item.sheetName]
                               : [item.nama, item.fileName, item.sheetName];
                           
                           return (
                               <div 
                                   key={virtualRow.key}
                                   style={{
                                       position: 'absolute',
                                       top: 0,
                                       left: 0,
                                       width: '100%',
                                       height: `${virtualRow.size}px`,
                                       transform: `translateY(${virtualRow.start + 49}px)`, // +49px to offset for header height
                                   }}
                                   className={cn("flex items-center text-sm border-b", rowBgClass)}
                               >
                                  {cells.map((cellContent, cellIndex) => (
                                      <div 
                                        key={cellIndex} 
                                        style={{ width: columnWidths[cellIndex] }}
                                        className="p-4 break-words"
                                      >
                                          {cellContent}
                                      </div>
                                  ))}
                               </div>
                           );
                       })}
                   </div>
               </div>
            </CardContent>
        </Card>
    );
}
    


    




    
