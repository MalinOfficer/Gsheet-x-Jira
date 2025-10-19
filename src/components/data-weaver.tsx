
"use client";

import React, { useState, useTransition, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, Trash2, Combine, Download, ArrowLeft, FileScan, BookUser, CalendarDays, Send, Shuffle, Users, CheckCheck, XCircle, FileClock } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { mergeFilesOnServer } from '@/app/actions';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/app-provider';
import { ScrollArea } from './ui/scroll-area';


declare const XLSX: any;

type ExcelRow = Record<string, any>;

type EditMode = 'nisn' | 'year' | 'nis';

type TableData = {
    headers: string[];
    rows: ExcelRow[];
    fileName: string;
};

type MergeResult = {
    mergedRows: ExcelRow[];
    unmatchedFileA: ExcelRow[];
    unmatchedFileB: ExcelRow[];
    summary: {
        total: number;
        existing: number;
        matched: number;
        unmatched: number;
    };
    error?: string;
}

const findNameInRow = (row: ExcelRow | null | undefined): string => {
    if (!row) return '';
    const nameHeaderKeys = ['nama', 'name', 'username'];
    const key = Object.keys(row).find(k => nameHeaderKeys.includes(k.toLowerCase().trim()));
    return key ? String(row[key] || '') : '';
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

                let headerRowIndex = -1;
                const headerKeywords = ['nama', 'name', 'username', 'nisn', 'nis', 'id', 'tahun ajaran', 'year'];
                
                for(let i = Math.min(json.length, 10) - 1; i >= 0; i--) {
                    const row = json[i];
                    if (Array.isArray(row) && row.some(cell => typeof cell === 'string' && headerKeywords.includes(cell.toLowerCase().trim()))) {
                        headerRowIndex = i;
                        break;
                    }
                }
                
                if(headerRowIndex === -1 && json.length > 0 && json[0].some(cell => String(cell).trim() !== '')) {
                    headerRowIndex = 0; 
                } else if (headerRowIndex === -1) {
                    return reject(new Error("No valid header row found."));
                }

                const headers = json[headerRowIndex].map(h => String(h || '').trim());
                const dataRows = json.slice(headerRowIndex + 1);

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

function FileUploader({ onFileProcessed, onFileRemoved, currentFile, disabled, title, description }: { onFileProcessed: (data: TableData) => void, onFileRemoved: () => void, currentFile: TableData | null, disabled: boolean, title: string, description: string }) {
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const data = await readFile(file);
            onFileProcessed(data);
            toast({
                title: `File Uploaded`,
                description: `'${file.name}' has been successfully processed.`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: `Error Processing File`,
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
                        <CheckCheck className="h-8 w-8 text-green-600" />
                        <p className="mt-2 text-sm font-semibold text-foreground truncate max-w-full px-2" title={currentFile.fileName}>
                            {currentFile.fileName}
                        </p>
                        <div className="flex gap-2 mt-2">
                             <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={triggerInput}>
                                Replace
                            </Button>
                            <span className="text-xs text-muted-foreground">|</span>
                             <Button variant="link" size="sm" className="h-auto p-0 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); onFileRemoved(); }}>
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

const ResultsTable = ({ data, headers, caption }: { data: ExcelRow[]; headers: string[], caption?: string }) => {
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const totalWidth = headers.reduce((acc, header) => acc + (header.toLowerCase().includes("nama") || header.toLowerCase().includes("name") ? 250 : 150), 0);

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
        <div ref={tableContainerRef} className="w-full overflow-auto rounded-md border h-[60vh]">
            <table className="relative text-sm" style={{ width: `${totalWidth}px` }}>
                {caption && <caption className="p-2 text-xs text-muted-foreground">{caption}</caption>}
                <thead className="sticky top-0 bg-muted z-10">
                    <tr>
                        {headers.map(header => (
                            <th 
                                key={header} 
                                className="p-2 border-b border-r text-left font-semibold whitespace-nowrap"
                                style={{
                                    width: header.toLowerCase().includes("nama") || header.toLowerCase().includes("name") ? '250px' : '150px'
                                }}
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
                                        style={{
                                            width: header.toLowerCase().includes("nama") || header.toLowerCase().includes("name") ? '250px' : '150px',
                                        }}
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

function Step1_Upload({ onNext, onClearAll, isMerging, editMode }: { onNext: () => void; onClearAll: () => void; isMerging: boolean; editMode: EditMode | null }) {
    const { fileA, setFileA, fileB, setFileB } = useApp();

    const fileADescriptions: Record<EditMode, string> = {
        nisn: 'The file with student names and NISN.',
        year: 'The file with student names and School Year.',
        nis: 'The file with student names and NIS.',
    };
    
    const fileATitles: Record<EditMode, string> = {
        nisn: 'File NISN (Source Data)',
        year: 'File Year (Source Data)',
        nis: 'File NIS (Source Data)',
    }

    const fileADescription = editMode ? fileADescriptions[editMode] : 'Select an Excel file.';
    const fileATitle = editMode ? fileATitles[editMode] : 'File A (Source Data)';

    return (
        <Card>
            <CardHeader>
                <CardTitle>Step 1: Upload & Configure</CardTitle>
                <CardDescription>Upload your source file and ID file to begin the merge process.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FileUploader
                        onFileProcessed={(data) => setFileA(data)}
                        onFileRemoved={() => setFileA(null)}
                        currentFile={fileA}
                        disabled={isMerging}
                        title={fileATitle}
                        description={fileADescription}
                    />
                    <FileUploader
                        onFileProcessed={(data) => setFileB(data)}
                        onFileRemoved={() => setFileB(null)}
                        currentFile={fileB}
                        disabled={isMerging}
                        title="File Id Bulk (ID File)"
                        description='The file from the "Bulk Edit" menu to be updated.'
                    />
                </div>
            </CardContent>
            <CardFooter className="flex justify-between flex-wrap gap-2">
                <Button onClick={onNext} disabled={!fileA || !fileB || isMerging}>
                    {isMerging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Combine className="mr-2 h-4 w-4" />}
                    {isMerging ? 'Merging...' : 'Merge & Review'}
                </Button>
                <Button onClick={onClearAll} variant="destructive" disabled={isMerging}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear All
                </Button>
            </CardFooter>
        </Card>
    );
}

function SummaryCard({ summary }: { summary: MergeResult['summary'] }) {
    const stats = [
        { title: 'Total', value: summary.total, icon: Users, color: 'text-blue-500' },
        { title: 'Existing Data', value: summary.existing, icon: FileClock, color: 'text-orange-500' },
        { title: 'Auto Matched', value: summary.matched, icon: CheckCheck, color: 'text-green-500' },
        { title: 'Unmatched', value: summary.unmatched, icon: XCircle, color: 'text-red-500' },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map(({ title, value, icon: Icon, color }) => (
                <Card key={title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{title}</CardTitle>
                        <Icon className={cn("h-4 w-4 text-muted-foreground", color)} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{value}</div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function Step2_ManualMatch({
    mergeResult,
    manualMatches,
    onMatch,
    onNext
}: {
    mergeResult: MergeResult | null;
    manualMatches: ExcelRow[];
    onMatch: (match: ExcelRow) => void;
    onNext: () => void;
}) {
    const { toast } = useToast();
    const [unmatchedA, setUnmatchedA] = useState<ExcelRow[]>(mergeResult?.unmatchedFileA || []);
    const [unmatchedB, setUnmatchedB] = useState<ExcelRow[]>(mergeResult?.unmatchedFileB || []);
    const [selectedA, setSelectedA] = useState<ExcelRow | null>(null);
    const [selectedB, setSelectedB] = useState<ExcelRow | null>(null);

    useEffect(() => {
        setUnmatchedA(mergeResult?.unmatchedFileA || []);
        setUnmatchedB(mergeResult?.unmatchedFileB || []);
    }, [mergeResult]);


    const handleMatch = () => {
        if (!selectedA || !selectedB) {
            toast({ variant: 'destructive', title: 'Selection Missing', description: 'Please select one item from each panel to match.' });
            return;
        }
        
        const newManualMatch = { ...selectedA, ...selectedB };
        onMatch(newManualMatch);

        setUnmatchedA(prev => prev.filter(row => row !== selectedA));
        setUnmatchedB(prev => prev.filter(row => row !== selectedB));

        setSelectedA(null);
        setSelectedB(null);

        toast({ title: 'Match Successful', description: `${findNameInRow(selectedA)} and ${findNameInRow(selectedB)} have been matched.` });
    };
    
    const renderRow = (row: ExcelRow, onSelect: (row: ExcelRow) => void, isSelected: boolean) => {
        const name = findNameInRow(row);
        return (
            <div 
                key={name + Math.random()} 
                onClick={() => onSelect(row)}
                className={cn(
                    "p-2 border-b cursor-pointer transition-colors text-sm",
                    isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
                )}
            >
                {name}
            </div>
        );
    }
    
    const manualMatchHeaders = useMemo(() => {
        if (manualMatches.length === 0) return [];
        return Object.keys(manualMatches[0]);
    }, [manualMatches]);

    if (!mergeResult) return null;

    return (
        <div className="space-y-6">
            <SummaryCard summary={mergeResult.summary} />

            <Card>
                <CardHeader>
                    <CardTitle>Manual Matching</CardTitle>
                    <CardDescription>Select one row from each panel and click "Match & Move" to pair them manually.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Panel title={`Unmatched Source File (${unmatchedA.length})`} data={unmatchedA} selected={selectedA} onSelect={setSelectedA} renderRow={renderRow} />
                        <Panel title={`Unmatched ID File (${unmatchedB.length})`} data={unmatchedB} selected={selectedB} onSelect={setSelectedB} renderRow={renderRow} />
                    </div>
                     <div className="flex justify-center">
                        <Button onClick={handleMatch} disabled={!selectedA || !selectedB}>
                            <Shuffle className="mr-2 h-4 w-4" /> Match & Move
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {manualMatches.length > 0 && (
                <Card>
                     <CardHeader>
                        <CardTitle>Manually Matched Data ({manualMatches.length} rows)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResultsTable data={manualMatches} headers={manualMatchHeaders} />
                    </CardContent>
                </Card>
            )}

             <div className="flex justify-end pt-4">
                <Button onClick={onNext}>
                   Continue to Final Result <Send className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

const Panel = ({ title, data, selected, onSelect, renderRow }: { title: string, data: ExcelRow[], selected: ExcelRow | null, onSelect: (row: ExcelRow) => void, renderRow: (row: ExcelRow, onSelect: (row: ExcelRow) => void, isSelected: boolean) => JSX.Element }) => (
    <Card>
        <CardHeader className="p-4">
            <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
            <ScrollArea className="h-72 border-t">
                {data.length > 0 ? (
                    data.map(row => renderRow(row, onSelect, row === selected))
                ) : (
                    <div className="p-4 text-center text-muted-foreground text-sm">No items left.</div>
                )}
            </ScrollArea>
        </CardContent>
    </Card>
);

function Step3_Result({ finalData, onDownload }: { finalData: ExcelRow[], onDownload: (data: ExcelRow[]) => void }) {
    
    const { fileA, fileB } = useApp();

    const resultHeaders = useMemo(() => {
        if (!fileA || !fileB) return [];
        // Start with File A headers, then add unique headers from File B
        const headers = [...fileA.headers];
        const headerSet = new Set(fileA.headers.map(h => h.toLowerCase()));
        fileB.headers.forEach(header => {
            if (!headerSet.has(header.toLowerCase())) {
                headers.push(header);
            }
        });
        return headers;
    }, [fileA, fileB]);

    const finalTableData = useMemo(() => {
        return finalData.map((row) => {
            const newRow: ExcelRow = {};
            resultHeaders.forEach(header => {
                newRow[header] = row[header] ?? '';
            });
            return newRow;
        });
    }, [finalData, resultHeaders]);


    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Step 3: Final Result</CardTitle>
                    <CardDescription className='mt-1'>
                        This is the final merged data, including automatic and manual matches. Click download to get the Excel file.
                    </CardDescription>
                </div>
                <Button onClick={() => onDownload(finalData)} variant="default" size="sm" disabled={finalData.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Download Merged Data
                </Button>
            </CardHeader>
            <CardContent>
                <ResultsTable data={finalTableData} headers={resultHeaders} caption={`Showing ${finalData.length} final rows`} />
            </CardContent>
        </Card>
    );
}

export function DataWeaver() {
    const { fileA, fileB, resetState } = useApp();
    const { toast } = useToast();
    const [isProcessing, startProcessing] = useTransition();
    const [editMode, setEditMode] = useState<EditMode | null>(null);
    const [currentStep, setCurrentStep] = useState(0); 
    const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
    const [manualMatches, setManualMatches] = useState<ExcelRow[]>([]);


    const handleClearAll = () => {
        resetState();
        setManualMatches([]);
        setMergeResult(null);
        toast({ title: "State Cleared", description: "All files and results have been cleared." });
    };

    const handleStartMerge = () => {
        if (!fileA || !fileB) return;
        startProcessing(async () => {
            const result = await mergeFilesOnServer(fileA, fileB, editMode);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Merge Failed', description: result.error });
                setMergeResult(null);
            } else {
                setMergeResult(result as MergeResult);
                setCurrentStep(2); // Go to Manual Matching
            }
        });
    };
    
    const handleProceedToResult = () => {
        if (!mergeResult) return;
        setCurrentStep(3);
    };

    const resetToModeSelection = () => {
        handleClearAll();
        setEditMode(null);
        setMergeResult(null);
        setManualMatches([]);
        setCurrentStep(0);
    }

    const handleHeaderBackClick = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
        } else {
            resetToModeSelection();
        }
    }
    
    const handleDownload = (data: ExcelRow[]) => {
        if (data.length === 0) {
            toast({ variant: 'destructive', title: 'No Data to Download' });
            return;
        }
        if (typeof XLSX === 'undefined') {
            toast({ variant: 'destructive', title: 'Library Not Loaded' });
            return;
        }
        
        if (!fileA || !fileB) {
             toast({ variant: 'destructive', title: 'File Data Missing', description: "Cannot determine headers for export." });
            return;
        }

        const finalHeaders = [...new Set([...fileA.headers, ...fileB.headers])];

        const dataToExport = data.map(row => finalHeaders.map(header => row[header] ?? ''));
        
        const worksheet = XLSX.utils.aoa_to_sheet([finalHeaders, ...dataToExport]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Merged Data');
        XLSX.writeFile(workbook, 'Final_Merged_Data.xlsx');
    };
    
    const finalData = useMemo(() => {
        if (!mergeResult) return [];
        return [...mergeResult.mergedRows, ...manualMatches];
    }, [mergeResult, manualMatches]);

    const handleNewManualMatch = (match: ExcelRow) => {
        setManualMatches(prev => [...prev, match]);
    }

    const getStepComponent = () => {
        switch (currentStep) {
            case 0: return <ModeSelectionScreen onSelectMode={(mode) => { setEditMode(mode); setCurrentStep(1); }} />;
            case 1: return <Step1_Upload onNext={handleStartMerge} onClearAll={handleClearAll} isMerging={isProcessing} editMode={editMode} />;
            case 2: return isProcessing 
                ? <div className="flex flex-col items-center justify-center p-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mb-4" /><h3 className='text-lg font-semibold'>Merging Files...</h3><p className="text-muted-foreground">This may take a moment.</p></div> 
                : <Step2_ManualMatch onNext={handleProceedToResult} mergeResult={mergeResult} manualMatches={manualMatches} onMatch={handleNewManualMatch} />;
            case 3: return <Step3_Result finalData={finalData} onDownload={handleDownload} />;
            default: return <ModeSelectionScreen onSelectMode={(mode) => { setEditMode(mode); setCurrentStep(1); }} />;
        }
    }
    
    const stepTitles = ["Select Mode", "Upload & Configure", "Manual Match", "Final Result"];
    const stepDescriptions = [
        "Choose the type of data you want to merge or update.",
        "Upload your source files to begin the merge process.",
        "Manually pair the remaining data from your source files.",
        "Your final merged data is ready for download."
    ];


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
                        <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">{stepTitles[currentStep]}</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {stepDescriptions[currentStep]}
                        </p>
                    </div>
                </header>
                {getStepComponent()}
            </div>
        </div>
    );
}
