
"use client";

import React, { useState, useTransition, useCallback, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, Loader2, Trash2, Combine, Download, AlertCircle, CheckCircle2, ArrowLeft, FileScan, BookUser, CalendarDays } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { mergeFilesOnServer } from '@/app/actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/app-provider';

declare const XLSX: any;

type ExcelRow = Record<string, any>;

type EditMode = 'nisn' | 'year' | 'nis';

const readFile = (file: File): Promise<TableData> => {
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
                
                const headers = json[0].map(String);
                const rows = json.slice(1).map((rowArray: any[]) => {
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

function FileUploader({ fileId, onFileProcessed, currentFile, disabled, title, description }: { fileId: 'A' | 'B', onFileProcessed: (id: 'A' | 'B', data: TableData) => void, currentFile: TableData | null, disabled: boolean, title: string, description: string }) {
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const data = await readFile(file);
            onFileProcessed(fileId, data);
            toast({
                title: `File ${fileId} Uploaded`,
                description: `'${file.name}' has been processed.`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: `Error Processing File ${fileId}`,
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
        } finally {
            setIsUploading(false);
             if(inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>
                    {currentFile ? `Current file: ${currentFile.fileName}` : description}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div 
                    className="w-full p-6 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => inputRef.current?.click()}
                >
                    <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} disabled={disabled || isUploading} accept=".xlsx,.xls,.csv" />
                    {isUploading ? (
                        <>
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="mt-2 text-sm text-muted-foreground">Processing...</p>
                        </>
                    ) : (
                         <>
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <p className="mt-2 text-sm font-semibold">Click or drag to upload</p>
                            <p className="text-xs text-muted-foreground">.xlsx, .xls, or .csv</p>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
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
        return <div className="text-center py-8 text-muted-foreground">No data to display for this category.</div>;
    }
    
    return (
        <div className="space-y-2">
            <h3 className="font-semibold">{title} ({data.length} rows)</h3>
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
            <CardHeader>
                <CardTitle>Pilih Mode Edit Massal</CardTitle>
                <CardDescription>Pilih jenis data yang ingin Anda edit untuk memulai.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {modes.map(({ mode, title, icon: Icon, description }) => (
                    <Button
                        key={mode}
                        variant="outline"
                        className="h-auto p-6 flex flex-col items-start text-left justify-start"
                        onClick={() => onSelectMode(mode)}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <Icon className="h-6 w-6 text-primary" />
                            <span className="text-lg font-semibold">{title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground font-normal">{description}</p>
                    </Button>
                ))}
            </CardContent>
        </Card>
    );
}

export function DataWeaver() {
    const { fileA, setFileA, fileB, setFileB, resetState } = useApp();
    const { toast } = useToast();
    const [isMerging, startMerging] = useTransition();
    const [mergeKey] = useState<string>("Nama");
    
    const [mergedRows, setMergedRows] = useState<ExcelRow[]>([]);
    const [unmatchedRows, setUnmatchedRows] = useState<ExcelRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [editMode, setEditMode] = useState<EditMode | null>(null);

    const handleFileProcessed = useCallback((id: 'A' | 'B', data: TableData) => {
        if (id === 'A') {
            setFileA(data);
        } else {
            setFileB(data);
        }
    }, [setFileA, setFileB]);

    const handleMerge = useCallback(async () => {
        if (!fileA || !fileB) {
            toast({ variant: 'destructive', title: 'Files Missing', description: 'Please upload both File A and File B.' });
            return;
        }
        if (!mergeKey.trim()) {
            toast({ variant: 'destructive', title: 'Merge Key Missing', description: 'Please enter a column name to merge on.' });
            return;
        }
        
        setError(null);
        setMergedRows([]);
        setUnmatchedRows([]);
        startMerging(async () => {
            const result = await mergeFilesOnServer(fileA, fileB, mergeKey);
            if (result.error) {
                setError(result.error);
                toast({ variant: 'destructive', title: 'Merge Failed', description: result.error });
            } else {
                setMergedRows(result.mergedRows || []);
                setUnmatchedRows(result.unmatchedRowsB || []);
                toast({ title: 'Merge Complete', description: `${result.mergedRows?.length || 0} rows matched.` });
            }
        });

    }, [fileA, fileB, mergeKey, toast]);
    
    const handleDownload = () => {
        if (mergedRows.length === 0) {
            toast({ variant: 'destructive', title: 'No Data to Download', description: 'There are no merged rows to download.' });
            return;
        }
        if (typeof XLSX === 'undefined') {
            toast({ variant: 'destructive', title: 'Library Not Loaded', description: 'Excel export library is not available.' });
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(mergedRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Merged Data');
        XLSX.writeFile(workbook, 'Merged_Data.xlsx');
    };

    const handleClear = () => {
        resetState();
        setMergedRows([]);
        setUnmatchedRows([]);
        setError(null);
        toast({ title: "State Cleared", description: "All files and results have been cleared." });
    };

    const resetToModeSelection = () => {
        handleClear();
        setEditMode(null);
    }

    const resultHeaders = useMemo(() => {
        if (mergedRows.length === 0) return [];
        const headersA = fileA?.headers || [];
        const headersB = fileB?.headers || [];
        const combined = new Set([...headersA, ...headersB]);
        return Array.from(combined);
    }, [mergedRows, fileA, fileB]);
    
    const unmatchedHeaders = useMemo(() => fileB?.headers || [], [fileB]);

    const hasResults = mergedRows.length > 0 || unmatchedRows.length > 0;

    const fileATitle = useMemo(() => {
        if (editMode === 'nisn') return 'Upload NISN';
        if (editMode === 'year') return 'Upload Tahun Ajaran';
        if (editMode === 'nis') return 'Upload NIS';
        return 'Upload File A';
    }, [editMode]);

    const fileADescription = useMemo(() => {
        if (editMode === 'nisn') return 'File berisi daftar NISN yang akan dicocokkan.';
        if (editMode === 'year') return 'File berisi daftar tahun ajaran yang akan dicocokkan.';
        if (editMode === 'nis') return 'File berisi daftar NIS yang akan dicocokkan.';
        return 'Select an Excel file (.xlsx, .csv).';
    }, [editMode]);

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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FileUploader 
                                fileId="A" 
                                onFileProcessed={handleFileProcessed}
                                currentFile={fileA}
                                disabled={isMerging} 
                                title={fileATitle}
                                description={fileADescription}
                            />
                            <FileUploader 
                                fileId="B" 
                                onFileProcessed={handleFileProcessed}
                                currentFile={fileB}
                                disabled={isMerging}
                                title="Upload File ID"
                                description="File donwload dari menu edit Bulk atau edit Massal"
                            />
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Merge Configuration</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid w-full max-w-sm items-center gap-1.5">
                                    <Label htmlFor="merge-key">Merge On Column</Label>
                                    <Input
                                        id="merge-key"
                                        type="text"
                                        value={mergeKey}
                                        readOnly
                                        className="font-semibold bg-muted"
                                    />
                                    <p className="text-xs text-muted-foreground">Kunci penggabungan selalu menggunakan 'Nama' untuk hasil terbaik.</p>
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button onClick={handleMerge} disabled={!fileA || !fileB || isMerging}>
                                    {isMerging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Combine className="mr-2 h-4 w-4" />}
                                    {isMerging ? 'Merging...' : 'Merge Files'}
                                </Button>
                                <Button onClick={handleClear} variant="destructive" disabled={isMerging}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Clear All
                                </Button>
                            </CardFooter>
                        </Card>

                        {isMerging && (
                            <div className="flex items-center justify-center p-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="ml-4 text-muted-foreground">Merging files, this may take a moment...</p>
                            </div>
                        )}
                        
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Merge Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {hasResults && !isMerging && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Merge Results</CardTitle>
                                    <div className="flex justify-between items-center">
                                        <CardDescription>
                                            Review the matched and unmatched rows.
                                        </CardDescription>
                                        <Button onClick={handleDownload} variant="outline" size="sm" disabled={mergedRows.length === 0}>
                                            <Download className="mr-2 h-4 w-4" /> Download Merged Data
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Alert variant={mergedRows.length > 0 ? "default" : "destructive"} className="mb-4 bg-opacity-20">
                                        {mergedRows.length > 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                        <AlertTitle>Summary</AlertTitle>
                                        <AlertDescription>
                                            <p>{mergedRows.length} rows Matched.</p>
                                            <p>{unmatchedRows.length} names from File B were Unmatched.</p>
                                        </AlertDescription>
                                    </Alert>
                                    <Tabs defaultValue="matched">
                                        <TabsList>
                                            <TabsTrigger value="matched">Matched ({mergedRows.length})</TabsTrigger>
                                            <TabsTrigger value="unmatched">Unmatched ({unmatchedRows.length})</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="matched">
                                            <ResultsTable title="Matched Data" data={mergedRows} headers={resultHeaders} />
                                        </TabsContent>
                                        <TabsContent value="unmatched">
                                            <ResultsTable title="Unmatched Data from File B" data={unmatchedRows} headers={unmatchedHeaders} />
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

    
