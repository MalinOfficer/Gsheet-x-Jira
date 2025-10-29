
"use client";

import { useState, useRef, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Upload, FileText, X, Download, Trash2, FileCog, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';

declare const XLSX: any;

type ExcelRow = Record<string, any>;
type PreviewData = {
    headers: string[];
    rows: ExcelRow[];
};

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
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                
                if (json.length < 1) {
                    return reject(new Error("File is empty or format is invalid."));
                }

                const headers = json[0].map(h => String(h || '').trim());
                const dataRows = json.slice(1);

                const rows = dataRows.map((rowArray: any[]) => {
                    const row: ExcelRow = {};
                    headers.forEach((header, i) => {
                        row[header] = rowArray[i];
                    });
                    return row;
                }).filter(row => Object.values(row).some(val => val !== ''));


                resolve({ headers, rows });
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};


function ResultsTable({ data, headers }: { data: ExcelRow[]; headers: string[]; }) {
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
        return <div className="text-center py-8 text-muted-foreground">No data to display.</div>;
    }
    
    const totalWidth = headers.reduce((acc, header) => acc + (header.length * 8 + 40), 0);

    return (
        <div ref={tableContainerRef} className="w-full overflow-auto rounded-md border h-[60vh]">
            <table className="border-collapse min-w-full" style={{ width: Math.max(totalWidth, window.innerWidth) }}>
                <thead className="sticky top-0 bg-muted z-10">
                    <tr>
                        {headers.map(header => (
                            <th 
                                key={header} 
                                className="p-2 border-b border-r text-left font-semibold whitespace-nowrap bg-muted"
                                style={{ minWidth: 150 }}
                            >
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody style={{ height: `${totalHeight}px`, position: 'relative' }}>
                    {virtualRows.map(virtualRow => {
                        const row = data[virtualRow.index];
                        return (
                            <tr
                                key={virtualRow.key}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                {headers.map(header => (
                                    <td 
                                        key={header} 
                                        className="p-2 border-b border-r truncate"
                                        style={{ minWidth: 150 }}
                                    >
                                        {String(row[header] ?? '')}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};


export function MigrasiProduk() {
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [currentStep, setCurrentStep] = useState<'upload' | 'preview'>('upload');
    const [isProcessing, setIsProcessing] = useState(false);
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
            setCurrentStep('preview');
             toast({ title: "File Processed", description: "Showing preview of your data." });
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
        setPreviewData(null);
        setCurrentStep('upload');
    }

    if (currentStep === 'preview' && previewData) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    <header className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={handleBackToUpload}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Preview Data</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                              This is a preview of the data from <strong>{file?.name}</strong>.
                            </p>
                        </div>
                    </header>
                     <Card>
                        <CardHeader>
                            <CardTitle>Data Preview ({previewData.rows.length} rows)</CardTitle>
                             <CardDescription>
                                Review your data below. More actions will be available in future updates.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                           <ResultsTable headers={previewData.headers} data={previewData.rows} />
                        </CardContent>
                        <CardFooter>
                           <Button disabled>
                               <Download className="mr-2 h-4 w-4" />
                               Download (coming soon)
                           </Button>
                        </CardFooter>
                    </Card>
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
                        <CardTitle>Upload Template</CardTitle>
                        <CardDescription>
                            Unggah file Excel Anda untuk memulai.
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
                           {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCog className="mr-2 h-4 w-4" />}
                           {isProcessing ? "Processing..." : "Proses Edit"}
                        </Button>
                        <Button onClick={handleClearFile} variant="destructive" disabled={isProcessing || !file}>
                           <Trash2 className="mr-2 h-4 w-4" />
                           Delete
                        </Button>
                    </CardFooter>
                </Card>
             </div>
        </div>
    );
}
