
"use client";

import React, { useState, useTransition, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, Loader2, Trash2, Combine, Download, AlertCircle, CheckCircle2, ArrowLeft, FileScan, BookUser, CalendarDays, FileCheck, X } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { mergeFilesOnServer } from '@/app/actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/app-provider';

declare const XLSX: any;

type ExcelRow = Record<string, any>;

type EditMode = 'nisn' | 'year' | 'nis';

type TableData = {
    headers: string[];
    rows: ExcelRow[];
    fileName: string;
};

const readFile = (file: File, fileId: 'A' | 'B'): Promise<TableData> => {
    return new Promise((resolve, reject) => {
        if (typeof XLSX === 'undefined') {
            return reject(new Error("Excel library (XLSX) not loaded."));
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                
                if (json.length < 1) {
                    return reject(new Error("File is empty or format is invalid."));
                }

                let headers: string[];
                let dataRows: any[][];

                if (fileId === 'B' && json.length > 1) {
                    headers = json[1].map(String);
                    dataRows = json.slice(2);
                } else {
                    headers = json[0].map(String);
                    dataRows = json.slice(1);
                }

                const rows = dataRows.map((rowArray: any[]) => {
                    const row: ExcelRow = {};
                    headers.forEach((header, i) => {
                        row[header] = rowArray[i];
                    });
                    return row;
                });

                resolve({ headers, rows, fileName: file.name });
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

function FileUploader({ fileId, onFileProcessed, onFileRemoved, currentFile, disabled, title, description, editMode }: { fileId: 'A' | 'B', onFileProcessed: (id: 'A' | 'B', data: TableData) => void, onFileRemoved: (id: 'A' | 'B') => void, currentFile: TableData | null, disabled: boolean, title: string, description: string, editMode: EditMode | null }) {
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const data = await readFile(file, fileId);

            if (editMode) {
                let requiredColumn: string;
                let alternativeColumns: string[] = [];

                if (fileId === 'B') {
                    requiredColumn = 'id';
                } else { // File A
                    if (editMode === 'year') {
                        requiredColumn = 'Tahun Ajaran';
                        alternativeColumns = ['year'];
                    } else {
                        requiredColumn = editMode.toUpperCase();
                    }
                }
                
                 const hasRequiredColumn = data.headers.some(h => 
                    h.toLowerCase() === requiredColumn.toLowerCase() ||
                    alternativeColumns.some(alt => h.toLowerCase() === alt.toLowerCase())
                );
                
                if (!hasRequiredColumn) {
                    toast({
                        variant: 'destructive',
                        title: 'File Upload Gagal',
                        description: `File yang Anda unggah tidak memiliki kolom '${requiredColumn}'.`,
                    });
                    setIsUploading(false);
                    if(inputRef.current) inputRef.current.value = '';
                    return;
                }
            }

            onFileProcessed(fileId, data);
            toast({
                title: `File ${fileId === 'A' ? 'A' : 'ID'} Diunggah`,
                description: `'${file.name}' telah berhasil diproses.`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: `Error Memproses File ${fileId === 'A' ? 'A' : 'ID'}`,
                description: error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.",
            });
        } finally {
            setIsUploading(false);
             if(inputRef.current) inputRef.current.value = '';
        }
    };

    const triggerInput = () => {
        if (!disabled && !isUploading) {
            inputRef.current?.click();
        }
    };

    return (
        <div className='space-y-2'>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <div 
                className={cn(
                    "w-full p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center transition-colors",
                    !currentFile && "cursor-pointer hover:border-primary/50",
                    currentFile && "border-solid border-green-500/50 bg-muted/30"
                )}
            >
                <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} disabled={disabled || isUploading} accept=".xlsx,.xls,.csv" />
                {isUploading ? (
                    <div className="flex flex-col items-center justify-center h-24">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="mt-2 text-sm text-muted-foreground">Memproses...</p>
                    </div>
                ) : currentFile ? (
                    <div className="flex flex-col items-center justify-center h-24 w-full">
                        <FileCheck className="h-8 w-8 text-green-600" />
                        <p className="mt-2 text-sm font-semibold text-foreground truncate max-w-full px-2" title={currentFile.fileName}>
                            {currentFile.fileName}
                        </p>
                        <div className="flex gap-2 mt-2">
                             <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={triggerInput}>
                                Ganti
                            </Button>
                            <span className="text-xs text-muted-foreground">|</span>
                             <Button variant="link" size="sm" className="h-auto p-0 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); onFileRemoved(fileId); }}>
                                Hapus
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-24" onClick={triggerInput}>
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <p className="mt-2 text-sm font-semibold">Klik atau seret file</p>
                        <p className="text-xs text-muted-foreground">.xlsx, .xls</p>
                    </div>
                )}
            </div>
             <p className='text-xs text-muted-foreground h-4'>{description}</p>
        </div>
    );
}

const ResultsTable = ({ title, data, headers }: { title: string; data: ExcelRow[]; headers: string[] }) => {
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: data.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 37, // h-9 + border
        overscan: 5,
    });
    
    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalHeight = rowVirtualizer.getTotalSize();

    if (data.length === 0) {
        return <div className="text-center py-8 text-muted-foreground">Tidak ada data untuk ditampilkan pada kategori ini.</div>;
    }
    
    return (
        <div className="space-y-2">
            <h3 className="font-semibold">{title} ({data.length} baris)</h3>
            <div ref={tableContainerRef} className="w-full overflow-auto rounded-md border h-[500px]">
                <div style={{ height: `${totalHeight}px`, width: `${headers.length * 150}px`, position: 'relative' }}>
                    <div className="flex sticky top-0 bg-muted z-10 font-medium text-sm">
                        {headers.map(header => (
                            <div key={header} className="p-2 border-b border-r flex-shrink-0" style={{ width: '150px' }}>{header}</div>
                        ))}
                    </div>
                    {virtualRows.map(virtualRow => {
                        const row = data[virtualRow.index];
                        return (
                            <div
                                key={virtualRow.key}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start + 41}px)`, // Offset by header height
                                }}
                                className="flex text-xs"
                            >
                                {headers.map(header => (
                                    <div key={header} className="p-2 border-b border-r truncate flex-shrink-0" style={{ width: '150px' }}>
                                        {String(row[header] ?? '')}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

function ModeSelectionScreen({ onSelectMode }: { onSelectMode: (mode: EditMode) => void }) {
    const modes = [
        { mode: 'nisn' as EditMode, title: 'Edit bulk NISN', icon: FileScan, description: 'Gunakan mode ini untuk mengedit atau menambahkan data NISN secara massal.' },
        { mode: 'year' as EditMode, title: 'Edit bulk Tahun Ajaran', icon: CalendarDays, description: 'Gunakan mode ini untuk memperbarui tahun ajaran siswa secara massal.' },
        { mode: 'nis' as EditMode, title: 'Edit bulk NIS', icon: BookUser, description: 'Gunakan mode ini untuk mengedit atau menambahkan data NIS secara massal.' }
    ];

    return (
        <Card>
            <CardHeader className="items-center text-center">
                <CardTitle>Pilih Mode Edit Massal</CardTitle>
                <CardDescription>Pilih jenis data yang ingin Anda gabungkan atau perbarui secara massal.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {modes.map(({ mode, title, icon: Icon, description }) => (
                    <div
                        key={mode}
                        className="relative flex flex-col items-center justify-center rounded-lg border bg-background p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 cursor-pointer"
                        onClick={() => onSelectMode(mode)}
                    >
                         <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="mb-1 text-lg font-semibold">{title}</h3>
                        <p className="text-center text-sm text-muted-foreground">{description}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}


export function DataWeaver() {
    const { fileA, setFileA, fileB, setFileB, resetState } = useApp();
    const { toast } = useToast();
    const [isMerging, startMerging] = useTransition();
    
    const [mergedRows, setMergedRows] = useState<ExcelRow[]>([]);
    const [unmatchedRows, setUnmatchedRows] = useState<ExcelRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [editMode, setEditMode] = useState<EditMode | null>(null);
    const [mergeKey, setMergeKey] = useState('Nama');

    useEffect(() => {
        if (editMode === 'nisn') setMergeKey('NISN');
        else if (editMode === 'nis') setMergeKey('NIS');
        else if (editMode === 'year') setMergeKey('Tahun Ajaran');
    }, [editMode]);

    const handleFileProcessed = useCallback((id: 'A' | 'B', data: TableData) => {
        if (id === 'A') {
            setFileA(data);
        } else {
            setFileB(data);
        }
    }, [setFileA, setFileB]);

    const handleFileRemoved = useCallback((id: 'A' | 'B') => {
        if (id === 'A') {
            setFileA(null);
        } else {
            setFileB(null);
        }
    }, [setFileA, setFileB]);

    const fileATitle = useMemo(() => {
        if (editMode === 'nisn') return 'Upload File NISN';
        if (editMode === 'year') return 'Upload File Tahun Ajaran';
        if (editMode === 'nis') return 'Upload File NIS';
        return 'Upload File A';
    }, [editMode]);

    const fileADescription = useMemo(() => {
        if (editMode === 'nisn') {
            return 'File harus memiliki kolom "NISN".';
        }
        if (editMode === 'year') {
            return 'File harus memiliki kolom "Tahun Ajaran" atau "Year".';
        }
        if (editMode === 'nis') {
            return 'File harus memiliki kolom "NIS".';
        }
        return 'Select an Excel file (.xlsx, .csv).';
    }, [editMode]);
    
    const handleMerge = useCallback(async () => {
        if (!fileA || !fileB) {
            toast({ variant: 'destructive', title: 'File Hilang', description: 'Mohon unggah kedua file yang diperlukan.' });
            return;
        }
        
        setError(null);
        setMergedRows([]);
        setUnmatchedRows([]);
        startMerging(async () => {
            const result = await mergeFilesOnServer(fileA, fileB, 'Nama'); // Always merge on 'Nama'
            if (result.error) {
                let errorMessage = result.error;
                if (errorMessage.includes("File B")) {
                    errorMessage = errorMessage.replace("File B", "File ID");
                }
                if (errorMessage.includes("File A")) {
                    errorMessage = errorMessage.replace("File A", fileATitle.replace("Upload ", ""));
                }
                setError(errorMessage);
                toast({ variant: 'destructive', title: 'Penggabungan Gagal', description: errorMessage });
            } else {
                setMergedRows(result.mergedRows || []);
                setUnmatchedRows(result.unmatchedRowsB || []);
                toast({ title: 'Penggabungan Selesai', description: `${result.mergedRows?.length || 0} baris cocok.` });
            }
        });

    }, [fileA, fileB, toast, fileATitle]);
    
    const resultHeaders = useMemo(() => {
        if (!fileA || !fileB) return [];
        
        const irrelevantBHeaders = new Set(['nama']);
        if (editMode === 'nisn') {
            irrelevantBHeaders.add('nis').add('tahun ajaran').add('year');
        } else if (editMode === 'nis') {
            irrelevantBHeaders.add('nisn').add('tahun ajaran').add('year');
        } else if (editMode === 'year') {
            irrelevantBHeaders.add('nisn').add('nis');
        }

        const headersA = fileA.headers;
        const headersB = fileB.headers.filter(h => !irrelevantBHeaders.has(h.toLowerCase()));
        
        const combinedHeaders = [...headersA, ...headersB.filter(h => !headersA.some(hA => hA.toLowerCase() === h.toLowerCase()))];
        
        const findHeader = (headers: string[], names: string[]) => {
            const lowerNames = names.map(n => n.toLowerCase());
            return headers.find(h => lowerNames.includes(h.toLowerCase()));
        };

        let dynamicColName: string | undefined;
        if (editMode === 'nisn') dynamicColName = findHeader(combinedHeaders, ['nisn']);
        else if (editMode === 'nis') dynamicColName = findHeader(combinedHeaders, ['nis']);
        else if (editMode === 'year') dynamicColName = findHeader(combinedHeaders, ['tahun ajaran', 'year']);

        const idCol = findHeader(combinedHeaders, ['id']);
        const nameCol = findHeader(combinedHeaders, ['nama']);

        const priorityHeaders = [idCol, nameCol, dynamicColName].filter((h): h is string => !!h);
        
        const remainingHeaders = combinedHeaders.filter(h => !priorityHeaders.some(pH => pH.toLowerCase() === h.toLowerCase()));
        
        return [...new Set([...priorityHeaders, ...remainingHeaders])];
    }, [fileA, fileB, editMode]);

    const handleDownload = () => {
        if (mergedRows.length === 0) {
            toast({ variant: 'destructive', title: 'Tidak Ada Data untuk Diunduh', description: 'Tidak ada baris gabungan untuk diunduh.' });
            return;
        }
        if (typeof XLSX === 'undefined' || !fileA || !fileB) {
            toast({ variant: 'destructive', title: 'Library atau Data Belum Dimuat', description: 'Pastikan library Excel telah dimuat dan kedua file telah diunggah.' });
            return;
        }

        const headerRow1 = resultHeaders.map(header => fileB.headers.find(h => h.toLowerCase() === header.toLowerCase()) || '');
        const headerRow2 = resultHeaders.map(header => fileA.headers.find(h => h.toLowerCase() === header.toLowerCase()) || '');

        const dataRows = mergedRows.map(row => {
            return resultHeaders.map(header => row[header] ?? '');
        });

        const dataToExport = [headerRow1, headerRow2, ...dataRows];
        
        const worksheet = XLSX.utils.aoa_to_sheet(dataToExport);

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Merged Data');
        XLSX.writeFile(workbook, 'Merged_Data.xlsx');
    };

    const handleClear = () => {
        resetState();
        setMergedRows([]);
        setUnmatchedRows([]);
        setError(null);
        toast({ title: "Status Dihapus", description: "All file dan hasil telah dihapus." });
    };

    const resetToModeSelection = () => {
        handleClear();
        setEditMode(null);
    }
    
    const unmatchedHeaders = useMemo(() => fileB?.headers || [], [fileB]);

    const hasResults = mergedRows.length > 0 || unmatchedRows.length > 0;

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header className="flex items-center gap-4">
                    {editMode && (
                         <Button variant="outline" size="icon" onClick={resetToModeSelection}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Data Weaver</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Gabungkan dua file Excel berdasarkan pencocokan nama yang cerdas.
                        </p>
                    </div>
                </header>

                {!editMode ? (
                    <ModeSelectionScreen onSelectMode={setEditMode} />
                ) : (
                    <>
                         <Card>
                            <CardHeader>
                                <CardTitle>Langkah 1: Unggah & Konfigurasi</CardTitle>
                                <CardDescription>Unggah file sumber dan file ID untuk memulai proses penggabungan.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                     <FileUploader 
                                        fileId="A" 
                                        onFileProcessed={handleFileProcessed}
                                        onFileRemoved={handleFileRemoved}
                                        currentFile={fileA}
                                        disabled={isMerging} 
                                        title={fileATitle}
                                        description={fileADescription}
                                        editMode={editMode}
                                    />
                                    <FileUploader 
                                        fileId="B" 
                                        onFileProcessed={handleFileProcessed}
                                        onFileRemoved={handleFileRemoved}
                                        currentFile={fileB}
                                        disabled={isMerging}
                                        title="Upload File ID"
                                        description='File dari menu "Edit Bulk" yang memiliki kolom "id".'
                                        editMode={editMode}
                                    />
                                </div>
                            </CardContent>
                             <CardFooter className="flex justify-between flex-wrap gap-2">
                                <Button onClick={handleMerge} disabled={!fileA || !fileB || isMerging}>
                                    {isMerging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Combine className="mr-2 h-4 w-4" />}
                                    {isMerging ? 'Menggabungkan...' : 'Gabungkan File'}
                                </Button>
                                <Button onClick={handleClear} variant="destructive" disabled={isMerging}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Hapus Semua
                                </Button>
                            </CardFooter>
                        </Card>


                        {isMerging && (
                            <div className="flex items-center justify-center p-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="ml-4 text-muted-foreground">Menggabungkan file, ini mungkin memerlukan waktu sejenak...</p>
                            </div>
                        )}
                        
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Kesalahan Penggabungan</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {hasResults && !isMerging && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Langkah 2: Hasil Penggabungan</CardTitle>
                                    <div className="flex justify-between items-center">
                                        <CardDescription>
                                            Tinjau baris yang cocok dan tidak cocok. Unduh hasilnya jika sudah sesuai.
                                        </CardDescription>
                                        <Button onClick={handleDownload} variant="outline" size="sm" disabled={mergedRows.length === 0}>
                                            <Download className="mr-2 h-4 w-4" /> Unduh Data Gabungan
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Alert variant={mergedRows.length > 0 ? "default" : "destructive"} className="mb-4 bg-opacity-20">
                                        {mergedRows.length > 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                        <AlertTitle>Ringkasan</AlertTitle>
                                        <AlertDescription>
                                            <p>{mergedRows.length} baris Cocok.</p>
                                            <p>{unmatchedRows.length} nama dari File ID Tidak Cocok.</p>
                                        </AlertDescription>
                                    </Alert>
                                    <Tabs defaultValue="matched">
                                        <TabsList>
                                            <TabsTrigger value="matched">Cocok ({mergedRows.length})</TabsTrigger>
                                            <TabsTrigger value="unmatched">Tidak Cocok ({unmatchedRows.length})</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="matched">
                                            <ResultsTable title="Data Cocok" data={mergedRows} headers={resultHeaders} />
                                        </TabsContent>
                                        <TabsContent value="unmatched">
                                            <ResultsTable title="Data Tidak Cocok dari File ID" data={unmatchedRows} headers={unmatchedHeaders} />
                                        </TabsContent>
                                    </Tabs>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

    