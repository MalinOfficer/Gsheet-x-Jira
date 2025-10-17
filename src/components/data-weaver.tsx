
"use client";

import React, { useState, useTransition, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Trash2, Combine, Download, AlertCircle, CheckCircle2, ArrowLeft, FileScan, BookUser, CalendarDays, FileCheck, X, Link, ArrowRight } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { mergeFilesOnServer } from '@/app/actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/app-provider';
import { Badge } from './ui/badge';


declare const XLSX: any;

type ExcelRow = Record<string, any>;
type HighlySimilarRow = { rowB: ExcelRow; potentialMatchA: ExcelRow; score: number };

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

                // Heuristic to find header row (look for 'nama')
                let headerRowIndex = -1;
                for(let i=0; i<Math.min(json.length, 10); i++) {
                    if (json[i].some(cell => typeof cell === 'string' && cell.toLowerCase().includes('nama'))) {
                        headerRowIndex = i;
                        break;
                    }
                }
                
                if(headerRowIndex === -1) {
                    // Fallback to first row if no 'nama' found
                    headerRowIndex = 0; 
                }

                headers = json[headerRowIndex].map(String);
                dataRows = json.slice(headerRowIndex + 1);


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

function FileUploader({ fileId, onFileProcessed, onFileRemoved, currentFile, disabled, title, description }: { fileId: 'A' | 'B', onFileProcessed: (id: 'A' | 'B', data: TableData) => void, onFileRemoved: (id: 'A' | 'B') => void, currentFile: TableData | null, disabled: boolean, title: string, description: string }) {
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const data = await readFile(file, fileId);
            onFileProcessed(fileId, data);
            toast({
                title: `File ${fileId === 'A' ? 'A' : 'ID'} Uploaded`,
                description: `'${file.name}' has been successfully processed.`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: `Error Processing File ${fileId === 'A' ? 'A' : 'ID'}`,
                description: error instanceof Error ? error.message : "An unknown error occurred.",
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
                    currentFile && "border-solid border-green-600/50 bg-muted/30"
                )}
            >
                <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} disabled={disabled || isUploading} accept=".xlsx,.xls,.csv" />
                {isUploading ? (
                    <div className="flex flex-col items-center justify-center h-24">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="mt-2 text-sm text-muted-foreground">Processing...</p>
                    </div>
                ) : currentFile ? (
                    <div className="flex flex-col items-center justify-center h-24 w-full">
                        <FileCheck className="h-8 w-8 text-green-600" />
                        <p className="mt-2 text-sm font-semibold text-foreground truncate max-w-full px-2" title={currentFile.fileName}>
                            {currentFile.fileName}
                        </p>
                        <div className="flex gap-2 mt-2">
                             <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={triggerInput}>
                                Replace
                            </Button>
                            <span className="text-xs text-muted-foreground">|</span>
                             <Button variant="link" size="sm" className="h-auto p-0 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); onFileRemoved(fileId); }}>
                                Remove
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-24" onClick={triggerInput}>
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <p className="mt-2 text-sm font-semibold">Click or drag file</p>
                        <p className="text-xs text-muted-foreground">.xlsx, .xls</p>
                    </div>
                )}
            </div>
             <p className='text-xs text-muted-foreground h-4'>{description}</p>
        </div>
    );
}

const ResultsTable = ({ data, headers }: { data: ExcelRow[]; headers: string[] }) => {
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
        return <div className="text-center py-8 text-muted-foreground">No data to display in this category.</div>;
    }
    
    return (
        <div ref={tableContainerRef} className="w-full overflow-auto rounded-md border h-[500px]">
            <div style={{ height: `${totalHeight}px`, width: '100%', position: 'relative' }}>
                <div className="flex sticky top-0 bg-muted z-10 font-medium text-sm">
                    {headers.map(header => (
                        <div 
                            key={header} 
                            className="p-2 border-b border-r flex items-center"
                            style={{
                                flexGrow: header === "No" ? 0 : 1,
                                flexShrink: 0,
                                flexBasis: header === "No" ? '60px' : '0',
                                minWidth: header === "No" ? '60px' : '150px'
                            }}
                        >
                            {header}
                        </div>
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
                                <div 
                                    key={header} 
                                    className="p-2 border-b border-r truncate flex items-center"
                                    style={{
                                        flexGrow: header === "No" ? 0 : 1,
                                        flexShrink: 0,
                                        flexBasis: header === "No" ? '60px' : '0',
                                        minWidth: header === "No" ? '60px' : '150px'
                                    }}
                                >
                                    {header === "No" ? virtualRow.index + 1 : String(row[header] ?? '')}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

function ModeSelectionScreen({ onSelectMode }: { onSelectMode: (mode: EditMode) => void }) {
    const modes = [
        { mode: 'nisn' as EditMode, title: 'Bulk Edit NISN', icon: FileScan, description: 'Use this mode to edit or add NISN data in bulk.' },
        { mode: 'year' as EditMode, title: 'Bulk Edit School Year', icon: CalendarDays, description: 'Use this mode to update student school years in bulk.' },
        { mode: 'nis' as EditMode, title: 'Bulk Edit NIS', icon: BookUser, description: 'Use this mode to edit or add NIS data in bulk.' }
    ];

    return (
        <Card>
            <CardHeader className="items-center text-center">
                <CardTitle>Select Bulk Edit Mode</CardTitle>
                <CardDescription>Choose the type of data you want to merge or update in bulk.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {modes.map(({ mode, title, icon: Icon, description }) => (
                    <button
                        key={mode}
                        className="relative flex flex-col items-center justify-start text-center rounded-lg border bg-background p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 h-full"
                        onClick={() => onSelectMode(mode)}
                    >
                         <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                        <p className="text-sm text-muted-foreground flex-grow">{description}</p>
                    </button>
                ))}
            </CardContent>
        </Card>
    );
}

function Step1({ onNext, onClearAll, isMerging, editMode }: { onNext: () => void; onClearAll: () => void; isMerging: boolean; editMode: EditMode | null }) {
    const { fileA, setFileA, fileB, setFileB } = useApp();
    const { toast } = useToast();

    const handleFileProcessed = useCallback((id: 'A' | 'B', data: TableData) => {
        if (id === 'A') setFileA(data);
        else setFileB(data);
    }, [setFileA, setFileB]);

    const handleFileRemoved = useCallback((id: 'A' | 'B') => {
        if (id === 'A') setFileA(null);
        else setFileB(null);
    }, [setFileA, setFileB]);
    
    const validateFiles = useCallback(() => {
        if (!fileA || !fileB || !editMode) return false;

        const findHeader = (headers: string[] | undefined, keys: string[]) => {
            if (!headers) return undefined;
            const lowerKeys = keys.map(k => k.toLowerCase());
            return headers.find(h => lowerKeys.includes(h.toLowerCase()));
        };
        
        const hasNameInA = findHeader(fileA.headers, ['nama', 'name', 'username']);
        const hasNameInB = findHeader(fileB.headers, ['nama', 'name', 'username']);
        if (!hasNameInA || !hasNameInB) {
            toast({ variant: 'destructive', title: 'Validation Failed', description: "Both files must contain a 'Nama', 'Name', or 'Username' column." });
            return false;
        }

        const requiredColumnsA: Record<EditMode, string[]> = {
            nisn: ['nisn'],
            nis: ['nis'],
            year: ['year', 'tahun ajaran']
        };

        const hasRequiredColA = findHeader(fileA.headers, requiredColumnsA[editMode]);
        if (!hasRequiredColA) {
            toast({ variant: 'destructive', title: 'Validation Failed', description: `File A is missing the required column for this mode: '${requiredColumnsA[editMode].join(' or ')}'.` });
            return false;
        }
        
        return true;

    }, [fileA, fileB, editMode, toast]);

    const handleNextClick = () => {
        if (validateFiles()) {
            onNext();
        }
    }


    const fileADescription = useMemo(() => {
        if (editMode === 'nisn') return 'The file with student names and NISN.';
        if (editMode === 'year') return 'The file with student names and School Year.';
        if (editMode === 'nis') return 'The file with student names and NIS.';
        return 'Select an Excel file (.xlsx, .csv).';
    }, [editMode]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Step 1: Upload & Configure</CardTitle>
                <CardDescription>Upload your source file and ID file to begin the merge process.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FileUploader
                        fileId="A"
                        onFileProcessed={handleFileProcessed}
                        onFileRemoved={handleFileRemoved}
                        currentFile={fileA}
                        disabled={isMerging}
                        title="File A (Source Data)"
                        description={fileADescription}
                    />
                    <FileUploader
                        fileId="B"
                        onFileProcessed={handleFileProcessed}
                        onFileRemoved={handleFileRemoved}
                        currentFile={fileB}
                        disabled={isMerging}
                        title="File B (ID File)"
                        description='The file from the "Bulk Edit" menu to be updated.'
                    />
                </div>
            </CardContent>
            <CardFooter className="flex justify-between flex-wrap gap-2">
                <Button onClick={handleNextClick} disabled={!fileA || !fileB || isMerging}>
                    {isMerging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Combine className="mr-2 h-4 w-4" />}
                    {isMerging ? 'Merging...' : 'Merge Files'}
                </Button>
                <Button onClick={onClearAll} variant="destructive" disabled={isMerging}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear All
                </Button>
            </CardFooter>
        </Card>
    );
}

function Step2({ onBack, editMode }: { onBack: () => void; editMode: EditMode | null }) {
    const { fileA, fileB } = useApp();
    const { toast } = useToast();

    const [mergedRows, setMergedRows] = useState<ExcelRow[]>([]);
    const [highlySimilarRows, setHighlySimilarRows] = useState<HighlySimilarRow[]>([]);
    const [unmatchedRows, setUnmatchedRows] = useState<ExcelRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isMerging, startMerging] = useTransition();


    const handleMerge = useCallback(async () => {
        if (!fileA || !fileB) {
            toast({ variant: 'destructive', title: 'Files Missing', description: 'Please upload both required files.' });
            return;
        }

        setError(null);
        setMergedRows([]);
        setHighlySimilarRows([]);
        setUnmatchedRows([]);

        startMerging(async () => {
            const result = await mergeFilesOnServer(fileA, fileB, 'Nama', editMode);
            if (result.error) {
                setError(result.error);
                toast({ variant: 'destructive', title: 'Merge Failed', description: result.error });
            } else {
                setMergedRows(result.mergedRows || []);
                setHighlySimilarRows(result.highlySimilarRows || []);
                setUnmatchedRows(result.unmatchedRowsB || []);
                toast({ title: 'Merge Complete', description: `${result.mergedRows?.length || 0} rows matched directly.` });
            }
        });
    }, [fileA, fileB, toast, editMode]);

    useEffect(() => {
        handleMerge();
    }, [handleMerge]);

    const handleRematch = (similarRow: HighlySimilarRow) => {
        const idHeaderB = Object.keys(similarRow.rowB).find(k => k.toLowerCase() === 'id');
        const newMergedRow = { ...similarRow.rowB, ...similarRow.potentialMatchA };
        setMergedRows(prev => [...prev, newMergedRow]);
        setHighlySimilarRows(prev => prev.filter(r => {
            const rIdHeaderB = Object.keys(r.rowB).find(k => k.toLowerCase() === 'id');
            if (!idHeaderB || !rIdHeaderB) return true; // Failsafe
            return r.rowB[rIdHeaderB] !== similarRow.rowB[idHeaderB];
        }));
        toast({
            title: 'Row Rematched',
            description: `'${Object.values(similarRow.rowB).find((v, i) => fileB?.headers[i]?.toLowerCase().includes('nama')) || ''}' has been moved to the matched list.`
        });
    };

    const resultHeaders = useMemo(() => {
        if (!fileA || !fileB) return [];
    
        const allHeaders = [...fileA.headers, ...fileB.headers];
        const uniqueHeadersMap = new Map<string, string>();
        allHeaders.forEach(h => {
            if (h) { // Ensure header is not null/undefined
                const lowerCaseHeader = h.toLowerCase();
                if (!uniqueHeadersMap.has(lowerCaseHeader)) {
                    uniqueHeadersMap.set(lowerCaseHeader, h);
                }
            }
        });
    
        const combined = Array.from(uniqueHeadersMap.values());
    
        const findHeader = (headers: string[], names: string[]) => {
            const lowerNames = names.map(n => n.toLowerCase());
            for (const name of lowerNames) {
                for (const header of headers) {
                    if (header && header.toLowerCase() === name) {
                        return header;
                    }
                }
            }
            return undefined;
        };
    
        const idCol = findHeader(combined, ['id']);
        const nameCol = findHeader(combined, ['nama', 'name', 'username']);
        let dynamicCol: string | undefined;
    
        if (editMode === 'nisn') {
            dynamicCol = findHeader(combined, ['nisn']);
        } else if (editMode === 'nis') {
            dynamicCol = findHeader(combined, ['nis']);
        } else if (editMode === 'year') {
            dynamicCol = findHeader(combined, ['tahun ajaran', 'year']);
        }
    
        const priorityHeaders = [idCol, nameCol, dynamicCol].filter((h): h is string => !!h);
        
        const uniquePriorityHeaders = Array.from(new Set(priorityHeaders.map(p => {
             return combined.find(c => c && p && c.toLowerCase() === c.toLowerCase())!;
        }))).filter(Boolean);
    
        const remainingHeaders = combined.filter(h => 
            h && !uniquePriorityHeaders.some(p => p && p.toLowerCase() === h.toLowerCase())
        );
    
        return ["No", ...uniquePriorityHeaders, ...remainingHeaders];
    }, [fileA, fileB, editMode]);

    const handleDownload = () => {
        if (mergedRows.length === 0) {
            toast({ variant: 'destructive', title: 'No Data to Download', description: 'There are no merged rows to download.' });
            return;
        }
        if (typeof XLSX === 'undefined' || !fileA || !fileB) {
            toast({ variant: 'destructive', title: 'Library or Data Not Loaded', description: 'Ensure the Excel library is loaded and both files are uploaded.' });
            return;
        }
        const downloadableHeaders = resultHeaders.filter(h => h !== 'No');
        const dataRows = mergedRows.map((row, index) => {
             const orderedRow = downloadableHeaders.map(header => {
                const rowHeader = Object.keys(row).find(k => k.toLowerCase() === header.toLowerCase());
                return rowHeader ? row[rowHeader] : '';
             });
             return [index + 1, ...orderedRow];
        });
        const dataToExport = [downloadableHeaders, ...dataRows.map(row => row.slice(1))];
        const worksheet = XLSX.utils.aoa_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Merged Data');
        XLSX.writeFile(workbook, 'Merged_Data.xlsx');
    };

    const unmatchedHeaders = useMemo(() => ["No", ...(fileB?.headers || [])], [fileB]);
    const hasResults = mergedRows.length > 0 || highlySimilarRows.length > 0 || unmatchedRows.length > 0;

    return (
        <>
            {isMerging && (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-4 text-muted-foreground">Merging files, this may take a moment...</p>
                </div>
            )}
            {error && (
                <div className="p-4 rounded-md bg-destructive/10 text-destructive-foreground border border-destructive">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5" />
                        <h3 className='font-semibold'>Merge Error</h3>
                    </div>
                    <p className="text-sm mt-2 ml-8">{error}</p>
                </div>
            )}
            {hasResults && !isMerging && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Step 2: Merge Results</CardTitle>
                            <CardDescription className='mt-1'>
                                Review the matched and unmatched rows. Download the result when ready.
                            </CardDescription>
                        </div>
                        <div className='flex gap-2'>
                             <Button onClick={handleDownload} variant="default" size="sm" disabled={mergedRows.length === 0}>
                                <Download className="mr-2 h-4 w-4" /> Download Merged Data
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Matched</p>
                                    <p className="text-xl font-bold">{mergedRows.length}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Unmatched</p>
                                    <p className="text-xl font-bold">{unmatchedRows.length + highlySimilarRows.length}</p>
                                </div>
                            </div>
                        </div>
                        <Tabs defaultValue="matched" className="w-full">
                           <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1 h-auto">
                               <TabsTrigger value="matched" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground hover:text-foreground">Matched ({mergedRows.length})</TabsTrigger>
                               <TabsTrigger value="unmatched" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground hover:text-foreground">Unmatched ({unmatchedRows.length + highlySimilarRows.length})</TabsTrigger>
                           </TabsList>
                            <TabsContent value="matched" className="mt-4">
                                <ResultsTable data={mergedRows} headers={resultHeaders} />
                            </TabsContent>
                            <TabsContent value="unmatched" className="mt-4 space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Highly Similar (Rematch)</h3>
                                    <p className="text-sm text-muted-foreground mb-4">These rows have a high probability of being a match. Click 'Rematch' to confirm and move them to the 'Matched' list.</p>
                                    <HighlySimilarTable data={highlySimilarRows} onRematch={handleRematch} fileAHeaders={fileA?.headers || []} fileBHeaders={fileB?.headers || []} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Unmatched (No Similarity Found)</h3>
                                     <p className="text-sm text-muted-foreground mb-4">These rows could not be matched automatically and have no similar candidates.</p>
                                    <ResultsTable data={unmatchedRows} headers={unmatchedHeaders} />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            )}
        </>
    );
}

export function DataWeaver() {
    const { resetState } = useApp();
    const { toast } = useToast();
    const [isMerging, startMerging] = useTransition();
    const [editMode, setEditMode] = useState<EditMode | null>(null);
    const [currentStep, setCurrentStep] = useState(0); // 0: mode selection, 1: upload, 2: results

    const handleClearAll = () => {
        resetState();
        toast({ title: "State Cleared", description: "All files and results have been cleared." });
    };

    const handleStartMerge = () => {
        startMerging(async () => {
            setCurrentStep(2);
        });
    };

    const handleBackToUpload = () => {
        setCurrentStep(1);
    }
    
    const resetToModeSelection = () => {
        handleClearAll();
        setEditMode(null);
        setCurrentStep(0);
    }

    const handleHeaderBackClick = () => {
        if (currentStep === 2) {
            handleBackToUpload();
        } else if (currentStep === 1) {
            resetToModeSelection();
        }
    }

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header className="flex items-center gap-4">
                    {currentStep > 0 && (
                        <Button variant="outline" size="icon" onClick={handleHeaderBackClick}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Data Weaver</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Merge two Excel files based on intelligent name matching and manual rematching.
                        </p>
                    </div>
                </header>

                {currentStep === 0 && <ModeSelectionScreen onSelectMode={(mode) => { setEditMode(mode); setCurrentStep(1); }} />}
                {currentStep === 1 && <Step1 onNext={handleStartMerge} onClearAll={handleClearAll} isMerging={isMerging} editMode={editMode} />}
                {currentStep === 2 && <Step2 onBack={() => {}} editMode={editMode} />}
            </div>
        </div>
    );
}

function HighlySimilarTable({ data, onRematch, fileAHeaders, fileBHeaders }: { data: HighlySimilarRow[], onRematch: (row: HighlySimilarRow) => void, fileAHeaders: string[], fileBHeaders: string[] }) {
    if (data.length === 0) {
        return <div className="text-center py-8 text-muted-foreground">No highly similar rows found.</div>;
    }
    
    const findNameHeader = (headers: string[]) => headers.find(h => h.toLowerCase().includes('nama')) || headers.find(h => h.toLowerCase().includes('name')) || headers.find(h => h.toLowerCase().includes('username')) || headers[0];
    
    const nameHeaderA = findNameHeader(fileAHeaders);
    const nameHeaderB = findNameHeader(fileBHeaders);

    const findIdHeader = (headers: string[]) => headers.find(h => h.toLowerCase() === 'id');
    const idHeaderB = findIdHeader(fileBHeaders);

    return (
        <div className="border rounded-lg overflow-hidden">
            <div className="divide-y">
                {data.map((item, index) => {
                    const rowBId = idHeaderB ? item.rowB[idHeaderB] : index;
                    return (
                        <div key={rowBId} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center p-4 gap-4 hover:bg-muted/50">
                            {/* File B Data */}
                            <div className="text-sm">
                                <Badge variant="secondary" className="mb-2">From ID File</Badge>
                                <p><strong>Name:</strong> {nameHeaderB ? item.rowB[nameHeaderB] : 'N/A'}</p>
                                {Object.entries(item.rowB).map(([key, value]) => (
                                    key.toLowerCase() !== (nameHeaderB || '').toLowerCase() && <p key={key}><strong>{key}:</strong> {String(value)}</p>
                                ))}
                            </div>
                            
                            {/* Action */}
                            <div className="flex flex-col items-center justify-center gap-2">
                                 <ArrowRight className="hidden md:block h-6 w-6 text-muted-foreground" />
                                 <Button size="sm" onClick={() => onRematch(item)}>
                                    <Link className="mr-2 h-4 w-4" /> Rematch
                                </Button>
                                <Badge variant="outline">{Math.round(item.score * 100)}% Similar</Badge>
                            </div>
                            
                            {/* Potential Match A Data */}
                            <div className="text-sm">
                                <Badge variant="secondary" className="mb-2">Potential Match</Badge>
                                <p><strong>Name:</strong> {nameHeaderA ? item.potentialMatchA[nameHeaderA] : 'N/A'}</p>
                                 {Object.entries(item.potentialMatchA).map(([key, value]) => (
                                    key.toLowerCase() !== (nameHeaderA || '').toLowerCase() && <p key={key}><strong>{key}:</strong> {String(value)}</p>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
