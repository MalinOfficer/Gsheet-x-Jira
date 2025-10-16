
"use client";

import React, { useState, useTransition, useCallback, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, Loader2, Trash2, Combine, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { mergeFilesOnServer } from '@/app/actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

declare const XLSX: any;

type ExcelRow = Record<string, any>;
type TableData = {
    headers: string[];
    rows: ExcelRow[];
};

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

                resolve({ headers, rows });
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

function FileUploader({ fileId, onFileProcessed, currentFile, disabled }: { fileId: 'A' | 'B', onFileProcessed: (data: TableData) => void, currentFile: File | null, disabled: boolean }) {
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const data = await readFile(file);
            onFileProcessed({ ...data });
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
                <CardTitle>Upload File {fileId}</CardTitle>
                <CardDescription>
                    {currentFile ? `Current file: ${currentFile.name}` : `Select an Excel file (.xlsx, .csv).`}
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

export function DataWeaver() {
    const [fileA, setFileA] = useState<TableData | null>(null);
    const [fileB, setFileB] = useState<TableData | null>(null);
    const [rawFileA, setRawFileA] = useState<File | null>(null);
    const [rawFileB, setRawFileB] = useState<File | null>(null);
    const { toast } = useToast();
    const [isMerging, startMerging] = useTransition();
    const [mergeKey, setMergeKey] = useState<string>("Nama");
    
    const [mergedRows, setMergedRows] = useState<ExcelRow[]>([]);
    const [unmatchedRows, setUnmatchedRows] = useState<ExcelRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleFileAProcessed = (data: TableData, file: File) => {
        setFileA(data);
        setRawFileA(file);
    };

    const handleFileBProcessed = (data: TableData, file: File) => {
        setFileB(data);
        setRawFileB(file);
    };

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
        setFileA(null);
        setFileB(null);
        setRawFileA(null);
        setRawFileB(null);
        setMergedRows([]);
        setUnmatchedRows([]);
        setError(null);
        setMergeKey("Nama");
        toast({ title: "State Cleared", description: "All files and results have been cleared." });
    };

    const resultHeaders = useMemo(() => {
        if (mergedRows.length === 0) return [];
        // Combine headers from both files, prioritizing File A's order, then File B's unique headers
        const headersA = fileA?.headers || [];
        const headersB = fileB?.headers || [];
        const combined = new Set([...headersA, ...headersB]);
        return Array.from(combined);
    }, [mergedRows, fileA, fileB]);
    
    const unmatchedHeaders = useMemo(() => fileB?.headers || [], [fileB]);

    const hasResults = mergedRows.length > 0 || unmatchedRows.length > 0;

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Data Weaver</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Upload two Excel files, define a key, and merge them based on fuzzy name matching.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FileUploader 
                        fileId="A" 
                        onFileProcessed={(data: TableData, file: File) => handleFileAProcessed(data, file)}
                        currentFile={rawFileA}
                        disabled={isMerging} 
                    />
                    <FileUploader 
                        fileId="B" 
                        onFileProcessed={(data: TableData, file: File) => handleFileBProcessed(data, file)}
                        currentFile={rawFileB}
                        disabled={isMerging} 
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
                                placeholder="e.g., Nama, Name, Student Name"
                                value={mergeKey}
                                onChange={(e) => setMergeKey(e.target.value)}
                                disabled={isMerging}
                            />
                             <p className="text-xs text-muted-foreground">Enter the column name that contains the names to match.</p>
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
            </div>
        </div>
    );
}

// Overwrite the FileUploader to pass the raw file object
const newFileUploader = ({ fileId, onFileProcessed, currentFile, disabled }: { fileId: 'A' | 'B', onFileProcessed: (data: TableData, file: File) => void, currentFile: File | null, disabled: boolean }) => {
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const data = await readFile(file);
            onFileProcessed(data, file); // Pass the raw file object
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
            if (inputRef.current) inputRef.current.value = '';
        }
    };
    
    // The rest of the FileUploader component's JSX is the same as before
    return (
        <Card>
            <CardHeader>
                <CardTitle>Upload File {fileId}</CardTitle>
                <CardDescription>
                    {currentFile ? `Current file: ${currentFile.name}` : `Select an Excel file (.xlsx, .csv).`}
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
};
