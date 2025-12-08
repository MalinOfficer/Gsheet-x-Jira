
"use client";

import { useState, useRef, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Upload, FileText, X, Trash2, FileCog, ArrowLeft, ShieldOff, View, RefreshCw } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Spinner } from './ui/spinner';


declare const XLSX: any;

type ExcelSheetData = {
    sheetName: string;
    data: any[][];
};
type PreviewData = ExcelSheetData[];

const readFile = (file: File): Promise<PreviewData> => {
    return new Promise((resolve, reject) => {
        if (typeof XLSX === 'undefined') {
            return reject(new Error("Excel library (XLSX) not loaded."));
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                
                const allSheetsData: PreviewData = [];

                for (const sheetName of workbook.SheetNames) {
                    const worksheet = workbook.Sheets[sheetName];
                    const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                    
                    allSheetsData.push({ sheetName, data: sheetData });
                }
                
                if (allSheetsData.length === 0) {
                    return reject(new Error("No sheets found in the file."));
                }

                resolve(allSheetsData);

            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

const toColumnName = (num: number) => {
  let s = '', t;
  while (num > 0) {
    t = (num - 1) % 26;
    s = String.fromCharCode(65 + t) + s;
    num = (num - t) / 26 | 0;
  }
  return s || undefined;
};

function ExcelSheetPreview({ sheet }: { sheet: ExcelSheetData }) {
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const { data } = sheet;

    const maxCols = useMemo(() => {
        if (!data || data.length === 0) return 0;
        return data.reduce((max, row) => Math.max(max, row ? row.length : 0), 0)
    }, [data]);

    const rowCount = useMemo(() => data ? data.length : 0, [data]);

    const rowVirtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 25,
        overscan: 10,
    });
    
    const colVirtualizer = useVirtualizer({
        horizontal: true,
        count: maxCols,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 120, // default column width
        overscan: 5,
    });

    const virtualRows = rowVirtualizer.getVirtualItems();
    const virtualCols = colVirtualizer.getVirtualItems();

    const totalHeight = rowVirtualizer.getTotalSize();
    const totalWidth = colVirtualizer.getTotalSize();
    
    const ROW_HEADER_WIDTH = 50;

    return (
        <div ref={tableContainerRef} className="w-full h-full overflow-auto rounded-md border bg-card">
             <div style={{ width: `${totalWidth + ROW_HEADER_WIDTH}px`, height: `${totalHeight + 25}px`, position: 'relative' }}>
                
                {/* Top-left empty corner */}
                <div 
                    className="sticky top-0 left-0 z-30 bg-muted border-b border-r"
                    style={{ width: `${ROW_HEADER_WIDTH}px`, height: `25px`, boxShadow: '2px 2px 3px -1px rgba(0,0,0,0.1)' }}
                />
                
                {/* Column Headers */}
                <div className="sticky top-0 z-20" style={{ left: `${ROW_HEADER_WIDTH}px`, width: `${totalWidth}px`, height: '25px', boxShadow: '0px 2px 3px -1px rgba(0,0,0,0.1)' }}>
                    {virtualCols.map(virtualCol => (
                        <div
                            key={virtualCol.key}
                            className="absolute top-0 left-0 flex h-[25px] items-center justify-center bg-muted border-b border-r text-xs font-semibold text-muted-foreground"
                            style={{ width: `${virtualCol.size}px`, transform: `translateX(${virtualCol.start}px)` }}
                        >
                            {toColumnName(virtualCol.index + 1)}
                        </div>
                    ))}
                </div>

                {/* Row Headers */}
                <div className="sticky left-0 z-20" style={{ top: '25px', width: `${ROW_HEADER_WIDTH}px`, height: `${totalHeight}px`, boxShadow: '2px 0px 3px -1px rgba(0,0,0,0.1)' }}>
                     {virtualRows.map(virtualRow => (
                        <div
                            key={virtualRow.key}
                            className="absolute top-0 left-0 flex items-center justify-center bg-muted border-b border-r text-xs font-semibold text-muted-foreground"
                            style={{ width: `${ROW_HEADER_WIDTH}px`, height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                        >
                            {virtualRow.index + 1}
                        </div>
                    ))}
                </div>

                {/* Grid Data */}
                <div className="absolute" style={{ top: '25px', left: `${ROW_HEADER_WIDTH}px`, width: totalWidth, height: totalHeight }}>
                    {virtualRows.map(virtualRow => (
                        <div key={virtualRow.key} className="flex absolute top-0 left-0" style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)`}}>
                           {virtualCols.map(virtualCol => {
                                const cellData = data[virtualRow.index]?.[virtualCol.index] ?? '';
                                return (
                                     <div
                                        key={virtualCol.key}
                                        className="absolute top-0 left-0 flex items-center border-b border-r px-2 text-sm truncate bg-background"
                                        style={{ height: `${virtualRow.size}px`, width: `${virtualCol.size}px`, transform: `translateX(${virtualCol.start}px)` }}
                                     >
                                        {String(cellData)}
                                    </div>
                                );
                           })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function MigrasiProduk() {
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [currentStep, setCurrentStep] = useState<'upload' | 'preview'>('upload');
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeSheet, setActiveSheet] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.type.includes('spreadsheet') && !selectedFile.name.endsWith('.xls') && !selectedFile.name.endsWith('.xlsx')) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid File Type',
                    description: `File '${selectedFile.name}' is not a valid Excel file.`,
                });
                return;
            }
            setFile(selectedFile);
            toast({
                title: 'File Selected',
                description: `'${selectedFile.name}' is ready to be processed.`,
            });
        }
    };

    const handleClearFile = () => {
        setFile(null);
        setPreviewData(null);
        setCurrentStep('upload');
        setActiveSheet(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    const handleProcess = async () => {
        if (!file) {
            toast({ variant: 'destructive', title: 'No File', description: 'Please upload a file to process.' });
            return;
        }
        setIsProcessing(true);
        try {
            const data = await readFile(file);
            setPreviewData(data);
            if (data.length > 0) {
                setActiveSheet(data[0].sheetName);
            }
            setCurrentStep('preview');
             toast({ title: "File Processed", description: `Showing preview for ${data.length} sheet(s).` });
        } catch (error) {
             toast({
                variant: 'destructive',
                title: `Error Processing File`,
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBackToUpload = () => {
        handleClearFile();
    }

    const displayedSheet = useMemo(() => {
        if (!previewData || !activeSheet) return null;
        return previewData.find(s => s.sheetName === activeSheet) || null;
    }, [previewData, activeSheet]);


    if (currentStep === 'preview' && previewData) {
        return (
            <div className="flex-1 bg-background text-foreground p-0 sm:p-2 md:p-4 flex flex-col h-full">
                <div className="flex flex-col flex-grow h-full max-w-full mx-auto w-full space-y-2">
                    <header className="flex items-center gap-4 flex-shrink-0 px-4 sm:px-0">
                        <Button variant="outline" size="icon" onClick={handleBackToUpload}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Excel Viewer</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                              File: <strong>{file?.name}</strong>
                            </p>
                        </div>
                    </header>
                    <div className="flex-grow flex flex-col min-h-0">
                        {displayedSheet ? <ExcelSheetPreview sheet={displayedSheet} /> : <div className='flex-grow flex items-center justify-center text-muted-foreground'>Select a sheet to view.</div>}
                    </div>
                    <div className="flex-shrink-0 border-t pt-2 mt-auto">
                        <div className="flex justify-between items-center px-2">
                            <div className="flex items-center gap-1 overflow-x-auto pb-2 flex-grow">
                                {previewData.map(sheet => (
                                    <Button
                                        key={sheet.sheetName}
                                        variant={activeSheet === sheet.sheetName ? "secondary" : "ghost"}
                                        size="sm"
                                        onClick={() => setActiveSheet(sheet.sheetName)}
                                        className="h-8 px-3 flex-shrink-0 text-sm"
                                    >
                                        {sheet.sheetName}
                                    </Button>
                                ))}
                            </div>
                            <div className="flex-shrink-0 pl-4">
                                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
                                    <ShieldOff className="h-4 w-4" />
                                    <span>VIEWER MODE - EDITING DISABLED</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
             <div className="max-w-7xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Migrasi Product</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Alat untuk mengelola dan memformat data migrasi produk.
                    </p>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Upload File</CardTitle>
                        <CardDescription>
                            Unggah file Excel Anda untuk melihat pratinjau.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                "w-full p-6 border-2 border-dashed rounded-lg transition-colors duration-200 cursor-pointer",
                                "border-border hover:border-primary/50"
                            )}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload-produk"
                                accept=".xlsx, .xls, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                disabled={isProcessing}
                            />
                            {file ? (
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                        <div className='flex flex-col overflow-hidden'>
                                            <span className="font-medium text-foreground truncate">{file.name}</span>
                                            <span className='text-xs text-muted-foreground'>{formatFileSize(file.size)}</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 flex-shrink-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleClearFile();
                                        }}
                                        disabled={isProcessing}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
                                    <Upload className="w-10 h-10 mb-2" />
                                    <p className="font-semibold">Klik untuk menelusuri atau seret dan lepas file di sini</p>
                                    <p className="text-xs mt-1">Mendukung .xlsx dan .xls</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex-wrap gap-2">
                        <Button onClick={handleProcess} disabled={isProcessing || !file}>
                           {isProcessing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <View className="mr-2 h-4 w-4" />}
                           {isProcessing ? "Processing..." : "Preview File"}
                        </Button>
                         {file && (
                            <Button onClick={handleClearFile} variant="destructive" disabled={isProcessing}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        )}
                    </CardFooter>
                </Card>
             </div>
        </div>
    );
}

    
