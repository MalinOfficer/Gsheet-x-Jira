
"use client";

import React, { useState, useTransition, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Trash2, Combine, Download, AlertCircle, CheckCircle2, ArrowLeft, FileScan, BookUser, CalendarDays, FileCheck, X, Link, ArrowRight, BookCheck, ClipboardList, Send, HelpCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { mergeFilesOnServer } from '@/app/actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/app-provider';
import { Badge } from './ui/badge';


declare const XLSX: any;

type ExcelRow = Record<string, any>;
type HighlySimilarRow = { 
    rowB: ExcelRow; 
    potentialMatchA: ExcelRow; 
    score: number 
};

type EditMode = 'nisn' | 'year' | 'nis';

type TableData = {
    headers: string[];
    rows: ExcelRow[];
    fileName: string;
};

type MergeResult = {
    mergedRows: ExcelRow[];
    highlySimilarRows: HighlySimilarRow[];
    unmatchedRows: ExcelRow[];
    summary: {
        total: number;
        existing: number;
        matched: number;
        review: number;
        unmatched: number;
    };
    error?: string;
}

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

                let headerRowIndex = -1;
                const headerKeywords = ['nama', 'name', 'username', 'nisn', 'nis', 'id', 'tahun ajaran', 'year'];
                
                // Scan from the bottom of the first 10 rows to find the last plausible header
                for(let i = Math.min(json.length, 10) - 1; i >= 0; i--) {
                    const row = json[i];
                    if (Array.isArray(row) && row.some(cell => typeof cell === 'string' && headerKeywords.includes(cell.toLowerCase().trim()))) {
                        headerRowIndex = i;
                        break;
                    }
                }
                
                // If no plausible header found, default to the first row if it has content
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
                title: `File ${fileId === 'A' ? 'A' : 'B'} Uploaded`,
                description: `'${file.name}' has been successfully processed.`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: `Error Processing File ${fileId === 'A' ? 'A' : 'B'}`,
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
                                flexGrow: 1,
                                flexShrink: 0,
                                flexBasis: header === "No" ? '60px' : (header.includes("Name") ? '250px' : (header === "Potential Match & Action" ? '300px' : '150px')),
                                minWidth: header === "No" ? '60px' : (header.includes("Name") ? '250px' : (header === "Potential Match & Action" ? '300px' : '150px')),
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
                                       flexGrow: 1,
                                        flexShrink: 0,
                                        flexBasis: header === "No" ? '60px' : (header.includes("Name") ? '250px' : (header === "Potential Match & Action" ? '300px' : '150px')),
                                        minWidth: header === "No" ? '60px' : (header.includes("Name") ? '250px' : (header === "Potential Match & Action" ? '300px' : '150px')),
                                    }}
                                >
                                    {header === "No" 
                                        ? virtualRow.index + 1 
                                        : header === "Potential Match & Action"
                                        ? row[header]
                                        : String(row[header] ?? '')}
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

    const handleFileProcessed = useCallback((id: 'A' | 'B', data: TableData) => {
        if (id === 'A') setFileA(data);
        else setFileB(data);
    }, [setFileA, setFileB]);

    const handleFileRemoved = useCallback((id: 'A' | 'B') => {
        if (id === 'A') setFileA(null);
        else setFileB(null);
    }, [setFileA, setFileB]);

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

    const fileADescription = editMode ? fileADescriptions[editMode] : 'Select an Excel file (.xlsx, .csv).';
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
                        fileId="A"
                        onFileProcessed={handleFileProcessed}
                        onFileRemoved={handleFileRemoved}
                        currentFile={fileA}
                        disabled={isMerging}
                        title={fileATitle}
                        description={fileADescription}
                    />
                    <FileUploader
                        fileId="B"
                        onFileProcessed={handleFileProcessed}
                        onFileRemoved={handleFileRemoved}
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

function Step2_Review({ onNext, editMode }: { onNext: (finalMerged: ExcelRow[]) => void; editMode: EditMode | null }) {
    const { fileA, fileB } = useApp();
    const { toast } = useToast();

    const [mergedRows, setMergedRows] = useState<ExcelRow[]>([]);
    const [highlySimilarRows, setHighlySimilarRows] = useState<HighlySimilarRow[]>([]);
    const [unmatchedRows, setUnmatchedRows] = useState<ExcelRow[]>([]);
    const [summary, setSummary] = useState<MergeResult['summary'] | null>(null);
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
        setSummary(null);

        startMerging(async () => {
            const result = await mergeFilesOnServer(fileA, fileB, editMode);
            if (result.error) {
                setError(result.error);
                toast({ variant: 'destructive', title: 'Merge Failed', description: result.error });
            } else {
                setMergedRows(result.mergedRows || []);
                setHighlySimilarRows(result.highlySimilarRows || []);
                setUnmatchedRows(result.unmatchedRows || []);
                setSummary(result.summary || null);
                toast({ title: 'Merge Complete', description: `Review the results below.` });
            }
        });
    }, [fileA, fileB, toast, editMode]);

    useEffect(() => {
        handleMerge();
    }, [handleMerge]);

    const handleRematch = useCallback((similarItem: HighlySimilarRow) => {
        setHighlySimilarRows(prev => prev.filter(item => {
            const nameHeaderKeys = ['nama', 'name', 'username'];
            const findName = (row: ExcelRow) => {
                const key = Object.keys(row).find(k => nameHeaderKeys.includes(k.toLowerCase()));
                return key ? row[key] : '';
            };
            return findName(item.rowB) !== findName(similarItem.rowB);
        }));
        
        const nameHeaderKeys = ['nama', 'name', 'username'];
        const findHeader = (obj: Record<string, any>, keys: string[]) => {
            const lowerKeys = keys.map(k => k.toLowerCase());
            const key = Object.keys(obj).find(k => lowerKeys.includes(k.toLowerCase()));
            return key ? obj[key] : '';
        };

        const fileAKey = findHeader(similarItem.potentialMatchA, nameHeaderKeys);
        const fileBKey = findHeader(similarItem.rowB, nameHeaderKeys);

        const finalMergedRow = createCleanMergedRow(
            similarItem.potentialMatchA,
            similarItem.rowB,
            fileAKey,
            fileBKey,
            editMode
        );

        setMergedRows(prev => [...prev, finalMergedRow]);

        setSummary(prev => {
            if (!prev) return null;
            return {
                ...prev,
                matched: prev.matched + 1,
                review: prev.review - 1,
            };
        });

        toast({
            title: 'Row Rematched',
            description: `'${findHeader(similarItem.rowB, nameHeaderKeys) || ''}' has been moved to the matched list.`
        });
    }, [editMode, toast]);
    
    const getUnmatchedTableData = useMemo(() => {
        const allUnmatchedItems: (HighlySimilarRow | { rowB: ExcelRow, potentialMatchA: null, score: 0 })[] = [
            ...highlySimilarRows,
            ...unmatchedRows.map(row => ({ rowB: row, potentialMatchA: null, score: 0 }))
        ];

        return allUnmatchedItems.map(item => {
            const { rowB, potentialMatchA, score } = item;
            
            const nameHeaderKeys = ['nama', 'name', 'username'];

            const findName = (row: ExcelRow | null) => {
                if (!row) return '';
                const key = Object.keys(row).find(k => nameHeaderKeys.includes(k.toLowerCase()));
                return key ? row[key] : '';
            };

            const nameB = findName(rowB);
            const nameA = findName(potentialMatchA);

            let actionCell;
            if (potentialMatchA) {
                 actionCell = (
                    <div className="flex flex-col gap-1 items-start h-full justify-center">
                         <p className="text-xs font-semibold">{nameA}</p>
                         <div className="flex items-center gap-2">
                            <Badge variant="outline">{Math.round(score * 100)}% Match</Badge>
                            <Button size="sm" className="h-6 px-2 py-1 text-xs" onClick={() => handleRematch(item as HighlySimilarRow)}>
                                <Link className="mr-1.5 h-3 w-3" /> Rematch
                            </Button>
                        </div>
                    </div>
                );
            } else {
                actionCell = <p className="text-muted-foreground text-xs italic">No match found</p>;
            }
            
            return {
                "No": 0, // Placeholder, will be replaced by index
                "Name A": nameA,
                "Name B": nameB,
                "Potential Match & Action": actionCell,
            };
        });
    }, [highlySimilarRows, unmatchedRows, handleRematch]);


    const unmatchedHeaders = useMemo(() => ["No", "Name A", "Name B", "Potential Match & Action"], []);

    const hasResults = mergedRows.length > 0 || highlySimilarRows.length > 0 || unmatchedRows.length > 0;

    const summaryLabels: Record<string, { label: string, icon: React.ElementType }> = {
        nisn: { label: "Existing NISN", icon: FileScan },
        year: { label: "Existing Year", icon: CalendarDays },
        nis: { label: "Existing NIS", icon: BookUser },
    };
    const summaryInfo = editMode ? summaryLabels[editMode] : { label: "Existing", icon: BookCheck };
    
    // This is a helper function that should live inside the component that uses it or be imported.
    // It's not a React component itself.
    const createCleanMergedRow = (rowA: any, rowB: any, fileAKey: string, fileBKey: string, currentEditMode: EditMode | null) => {
        const merged: Record<string, any> = {};
        const addedKeys = new Set<string>();
    
        const synonymGroups = {
            'Id': ['id'],
            'Name': ['nama', 'name', 'username'],
            'NISN': ['nisn'],
            'NIS': ['nis'],
            'Year': ['year', 'tahun ajaran']
        };

        const findValueBySynonym = (synonyms: string[], fromRowA: any, fromRowB: any) => {
            // Prioritize File A for the edit mode column
            if (currentEditMode) {
                const editModeKey = currentEditMode.toUpperCase() as keyof typeof synonymGroups;
                const editModeSynonyms = synonymGroups[editModeKey] || [currentEditMode];
                if (synonyms.some(s => editModeSynonyms.map(es => es.toLowerCase()).includes(s.toLowerCase()))) {
                    for (const keyA in fromRowA) {
                         if (editModeSynonyms.map(es => es.toLowerCase()).includes(keyA.toLowerCase())) {
                            const value = fromRowA[keyA];
                            if (value !== null && value !== undefined && String(value).trim() !== '') {
                                return value;
                            }
                        }
                    }
                }
            }

            // Default behavior for other columns (prioritize File B)
            for (const keyB in fromRowB) {
                 if (synonyms.map(s => s.toLowerCase()).includes(keyB.toLowerCase())) {
                    const value = fromRowB[keyB];
                     if (value !== null && value !== undefined && String(value).trim() !== '') {
                        return value;
                    }
                }
            }
            for (const keyA in fromRowA) {
                if (synonyms.map(s => s.toLowerCase()).includes(keyA.toLowerCase())) {
                    const value = fromRowA[keyA];
                    if (value !== null && value !== undefined && String(value).trim() !== '') {
                        return value;
                    }
                }
            }
            return ''; 
        };
    
        const priorityGroupsToProcess: Record<string, string[]> = {
            'Id': synonymGroups.Id,
            'Name': synonymGroups.Name,
        };
        
        if (currentEditMode === 'nisn') {
            priorityGroupsToProcess['NISN'] = synonymGroups.NISN;
        } else if (currentEditMode === 'nis') {
            priorityGroupsToProcess['NIS'] = synonymGroups.NIS;
        } else if (currentEditMode === 'year') {
            priorityGroupsToProcess['Year'] = synonymGroups.Year;
        }
        
        for (const [standardHeader, synonyms] of Object.entries(priorityGroupsToProcess)) {
             const value = findValueBySynonym(synonyms, rowA, rowB);
             merged[standardHeader] = value;
             synonyms.forEach(s => addedKeys.add(s.toLowerCase()));
        }

        const allPrioritySynonyms = Object.values(synonymGroups).flat().map(s => s.toLowerCase());

        const addRemainingValue = (key: string, value: any, source: 'A' | 'B') => {
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'no' || allPrioritySynonyms.includes(lowerKey)) return;
            
            if (source === 'B' && !addedKeys.has(lowerKey)) {
                 merged[key] = value;
                 addedKeys.add(lowerKey);
            } else if (source === 'A' && !addedKeys.has(lowerKey)) {
                 merged[key] = value;
                 addedKeys.add(lowerKey);
            }
        };
    
        Object.entries(rowB).forEach(([key, value]) => addRemainingValue(key, value, 'B'));
        Object.entries(rowA).forEach(([key, value]) => addRemainingValue(key, value, 'A'));
    
        return merged;
    };


    return (
        <>
            {isMerging && (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <h3 className='text-lg font-semibold'>Merging Files...</h3>
                    <p className="text-muted-foreground">This may take a moment for large files.</p>
                </div>
            )}
            {error && (
                <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5" />
                        <h3 className='font-semibold'>Merge Error</h3>
                    </div>
                    <p className="text-sm mt-2 ml-8">{error}</p>
                </div>
            )}
            {hasResults && !isMerging && summary &&(
                <div className="space-y-6">
                    <Card>
                         <CardHeader>
                            <CardTitle>Step 2: Summary & Review</CardTitle>
                            <CardDescription>Review the automated matches and handle any unmatched data before proceeding.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="grid grid-cols-2 md:grid-cols-5 gap-4 rounded-lg border p-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                        <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total</p>
                                        <p className="text-xl font-bold">{summary.total}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                                        <summaryInfo.icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">{summaryInfo.label}</p>
                                        <p className="text-xl font-bold">{summary.existing}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Matched</p>
                                        <p className="text-xl font-bold">{summary.matched}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                                        <HelpCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Review</p>
                                        <p className="text-xl font-bold">{summary.review}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Unmatched</p>
                                        <p className="text-xl font-bold">{summary.unmatched}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Tabs defaultValue="unmatched" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1 h-auto">
                             <TabsTrigger value="unmatched" className="data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent">Unmatched ({summary.review + summary.unmatched})</TabsTrigger>
                            <TabsTrigger value="matched" className="data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent">Matched ({summary.matched})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="unmatched" className="mt-4">
                             <p className="text-sm text-muted-foreground mb-4">These rows could not be matched automatically. Review potential matches and use the 'Rematch' button to confirm them.</p>
                             <ResultsTable data={getUnmatchedTableData} headers={unmatchedHeaders} />
                        </TabsContent>
                        <TabsContent value="matched" className="mt-4">
                            <p className="text-sm text-muted-foreground mb-4">These rows were matched automatically. They will be included in the final download.</p>
                             <ResultsTable data={mergedRows} headers={["No", ...Object.keys(mergedRows[0] || {})]} />
                        </TabsContent>
                    </Tabs>
                    <div className="flex justify-end pt-4">
                        <Button onClick={() => onNext(mergedRows)}>
                           Continue to Final Result <Send className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}

function Step3_Result({ finalData, onDownload, editMode }: { finalData: ExcelRow[], onDownload: (data: ExcelRow[]) => void, editMode: EditMode | null }) {
    
    const resultHeaders = useMemo(() => {
        if (finalData.length === 0) return [];
        
        const allHeaders = Object.keys(finalData[0] || {});
        
        const priorityOrder: string[] = ['Id', 'Name'];
        if (editMode === 'nisn') priorityOrder.push('NISN');
        else if (editMode === 'nis') priorityOrder.push('NIS');
        else if (editMode === 'year') priorityOrder.push('Year');
        
        const lowerCasePriorityOrder = priorityOrder.map(p => p.toLowerCase());

        const priorityHeaders = priorityOrder
            .map(p => allHeaders.find(h => h.toLowerCase() === p.toLowerCase()))
            .filter((h): h is string => !!h);

        const otherHeaders = allHeaders.filter(h => !lowerCasePriorityOrder.includes(h.toLowerCase()));
        
        return ["No", ...priorityHeaders, ...otherHeaders];
    }, [finalData, editMode]);


    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Step 3: Final Result</CardTitle>
                    <CardDescription className='mt-1'>
                        This is the final merged data. Click download to get the Excel file.
                    </CardDescription>
                </div>
                <Button onClick={() => onDownload(finalData)} variant="default" size="sm" disabled={finalData.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Download Merged Data
                </Button>
            </CardHeader>
            <CardContent>
                <ResultsTable data={finalData} headers={resultHeaders} />
            </CardContent>
        </Card>
    );
}


export function DataWeaver() {
    const { resetState } = useApp();
    const { toast } = useToast();
    const [isMerging, startMerging] = useTransition();
    const [editMode, setEditMode] = useState<EditMode | null>(null);
    const [currentStep, setCurrentStep] = useState(0); // 0: mode, 1: upload, 2: review, 3: result
    const [finalData, setFinalData] = useState<ExcelRow[]>([]);


    const handleClearAll = () => {
        resetState();
        toast({ title: "State Cleared", description: "All files and results have been cleared." });
    };

    const handleStartMerge = () => {
        startMerging(async () => {
            setCurrentStep(2);
        });
    };

    const handleProceedToResult = (mergedRows: ExcelRow[]) => {
        setFinalData(mergedRows);
        setCurrentStep(3);
    };

    const resetToModeSelection = () => {
        handleClearAll();
        setEditMode(null);
        setFinalData([]);
        setCurrentStep(0);
    }

    const handleHeaderBackClick = () => {
        if (currentStep === 3) setCurrentStep(2);
        else if (currentStep === 2) setCurrentStep(1);
        else if (currentStep === 1) resetToModeSelection();
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
        const headers = Object.keys(data[0]).filter(h => h.toLowerCase() !== 'no');
        const dataToExport = data.map(row => headers.map(header => row[header]));
        
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataToExport]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Merged Data');
        XLSX.writeFile(workbook, 'Merged_Data.xlsx');
    };


    const getStepComponent = () => {
        switch (currentStep) {
            case 0: return <ModeSelectionScreen onSelectMode={(mode) => { setEditMode(mode); setCurrentStep(1); }} />;
            case 1: return <Step1 onNext={handleStartMerge} onClearAll={handleClearAll} isMerging={isMerging} editMode={editMode} />;
            case 2: return <Step2_Review onNext={handleProceedToResult} editMode={editMode} />;
            case 3: return <Step3_Result finalData={finalData} onDownload={handleDownload} editMode={editMode} />;
            default: return <ModeSelectionScreen onSelectMode={(mode) => { setEditMode(mode); setCurrentStep(1); }} />;
        }
    }
    
    const stepTitles = ["Data Weaver", "Step 1: Upload", "Step 2: Review", "Step 3: Download"];
    const stepDescriptions = [
        "Merge two Excel files based on intelligent name matching and manual rematching.",
        "Choose your source files to begin the merge process.",
        "Review matches and handle exceptions before finalizing.",
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

    
