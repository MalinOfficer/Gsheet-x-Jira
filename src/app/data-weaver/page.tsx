
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileDown, Columns, AlertCircle, Check, RefreshCw, ChevronsUpDown, PlusCircle, CheckCircle, ArrowRight, Settings, Save, Forward, X } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { MultiSelect } from "@/components/ui/multi-select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from '@/contexts/app-provider';
import type { TableData } from '@/contexts/app-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mergeFilesOnServer } from '@/app/actions';


declare const XLSX: any;

type SelectOption = {
    value: string;
    label: string;
};

// This represents a row from File B that couldn't be matched
type UnmatchedRow = {
    rowData: any; // Data from File B (unmatched)
};


const LOCAL_STORAGE_KEY_MERGE_KEY = 'dataWeaverDefaultMergeKey';
const LOCAL_STORAGE_KEY_HEADERS = 'dataWeaverDefaultHeaders';


// Helper to decode HTML entities
const decodeHtml = (html: string | null | undefined): string => {
    if (typeof document === 'undefined' || typeof html !== 'string') {
        return String(html ?? '');
    }
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
};


export default function DataWeaverPage() {
    const { fileA, setFileA, fileB, setFileB, resetState } = useApp();
    const [activeTab, setActiveTab] = useState("upload");
    const [mergedHeaders, setMergedHeaders] = useState<SelectOption[]>([]);
    const [selectedHeaders, setSelectedHeaders] = useState<string[]>([]);
    const [mergedData, setMergedData] = useState<any[] | null>(null);
    const [unmatchedData, setUnmatchedData] = useState<UnmatchedRow[] | null>(null);
    const [manualSelections, setManualSelections] = useState<Record<string, any>>({});
    const [mergeKey, setMergeKey] = useState<string>('');
    const [commonHeaders, setCommonHeaders] = useState<string[]>([]);

    const fileAInputRef = useRef<HTMLInputElement>(null);
    const fileBInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Effect to load defaults from localStorage on initial render
    useEffect(() => {
        const savedMergeKey = localStorage.getItem(LOCAL_STORAGE_KEY_MERGE_KEY);
        if (savedMergeKey) {
            setMergeKey(savedMergeKey);
        }

        const savedHeaders = localStorage.getItem(LOCAL_STORAGE_KEY_HEADERS);
        if (savedHeaders) {
            try {
                const parsedHeaders = JSON.parse(savedHeaders);
                if (Array.isArray(parsedHeaders)) {
                    setSelectedHeaders(parsedHeaders);
                }
            } catch (e) {
                console.error("Failed to parse saved headers from localStorage", e);
                 const defaultSelection = ['No', 'ID', 'Nama', 'NISN'];
                setSelectedHeaders(defaultSelection);
            }
        } else {
             const defaultSelection = ['No', 'ID', 'Nama', 'NISN'];
            setSelectedHeaders(defaultSelection);
        }
    }, []);

    // Effect to reset local state when context is reset
    useEffect(() => {
        if (!fileA && !fileB) {
            setMergedHeaders([]);
            setMergedData(null);
            setUnmatchedData(null);
            setCommonHeaders([]);
            setManualSelections({});
            setActiveTab("upload");
        }
    }, [fileA, fileB]);

    const handleReset = () => {
        resetState();
    };

    const updateCommonHeaders = useCallback((headersA?: string[], headersB?: string[]) => {
        if (headersA && headersB) {
            const lowercasedHeadersB = headersB.map(h => h.toLowerCase());
            const common = headersA.filter(h => lowercasedHeadersB.includes(h.toLowerCase()));
            setCommonHeaders(common);

            const savedMergeKey = localStorage.getItem(LOCAL_STORAGE_KEY_MERGE_KEY);
            
            if (savedMergeKey && common.map(h => h.toLowerCase()).includes(savedMergeKey.toLowerCase())) {
                setMergeKey(savedMergeKey);
            } else {
                const defaultKey = common.find(h => h.toLowerCase() === 'nama');
                if (defaultKey) {
                    setMergeKey(defaultKey);
                } else if (mergeKey && !common.map(h => h.toLowerCase()).includes(mergeKey.toLowerCase())) {
                    setMergeKey(common.length > 0 ? common[0] : '');
                } else if (!mergeKey && common.length > 0) {
                    setMergeKey(common[0]);
                }
            }
        } else {
            setCommonHeaders([]);
        }
    }, [mergeKey]);


    useEffect(() => {
        if (fileA && fileB) {
            const headerMap = new Map<string, string>();
            // Combine headers from both files. Use a Map to handle case-insensitivity.
            const allHeadersRaw = ['No', ...fileA.headers, ...fileB.headers];
            
            allHeadersRaw.forEach(header => {
                const lowerCaseHeader = header.toLowerCase();
                if (!headerMap.has(lowerCaseHeader)) {
                    headerMap.set(lowerCaseHeader, header);
                }
            });

            const uniqueHeaders = Array.from(headerMap.values());
            const headerOptions = uniqueHeaders.map(h => ({ value: h, label: h }));
            setMergedHeaders(headerOptions);
            
            updateCommonHeaders(fileA.headers, fileB.headers);

            const savedHeaders = localStorage.getItem(LOCAL_STORAGE_KEY_HEADERS);
            if (savedHeaders) {
                try {
                    const parsedHeaders = JSON.parse(savedHeaders);
                    const validSavedHeaders = parsedHeaders.filter((h: string) => uniqueHeaders.includes(h));
                    setSelectedHeaders(validSavedHeaders);
                } catch {
                    const defaultSelection = ['No', 'ID', 'Nama', 'NISN'];
                    const availableDefaults = defaultSelection.filter(h => 
                        uniqueHeaders.map(uh => uh.toLowerCase()).includes(h.toLowerCase())
                    );
                    setSelectedHeaders(availableDefaults);
                }
            } else {
                const defaultSelection = ['No', 'ID', 'Nama', 'NISN'];
                const availableDefaults = defaultSelection.filter(h => 
                    uniqueHeaders.map(uh => uh.toLowerCase()).includes(h.toLowerCase())
                );
                setSelectedHeaders(availableDefaults);
            }
        }
    }, [fileA, fileB, updateCommonHeaders]);


    const handleFileUpload = (file: File, fileType: 'A' | 'B') => {
        if (!file || typeof XLSX === 'undefined') {
            if (typeof XLSX === 'undefined') {
                 toast({ variant: "destructive", title: "Library Loading", description: "The Excel library is still loading. Please try again in a moment."});
            }
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                if (!data) {
                  toast({ variant: "destructive", title: "File Read Error", description: "Could not read the file data."});
                  return;
                }
                const workbook = XLSX.read(data, { type: 'binary' });
                
                let json: any[] = [];
                let sheetName = '';

                for (const name of workbook.SheetNames) {
                    const worksheet = workbook.Sheets[name];
                    const sheetJson = XLSX.utils.sheet_to_json<any>(worksheet);
                    if (sheetJson.length > 0) {
                        json = sheetJson;
                        sheetName = name;
                        break;
                    }
                }

                if (json.length === 0) {
                    toast({ variant: 'destructive', title: "Empty File", description: "Could not find any data in the sheets of this Excel file."});
                    return;
                }

                const headers = Object.keys(json[0]);
                const lowercasedHeaders = headers.map(h => h.toLowerCase());

                // Validation logic
                if (fileType === 'A' && !lowercasedHeaders.some(h => h === 'nisn')) {
                    toast({ variant: 'destructive', title: "Invalid File A", description: "File NISN must contain a 'NISN' column." });
                    if (fileAInputRef.current) fileAInputRef.current.value = "";
                    return;
                }

                if (fileType === 'B' && !lowercasedHeaders.some(h => h.toLowerCase().includes('id'))) {
                    toast({ variant: 'destructive', title: "Invalid File B", description: "File id Bulk must contain an 'id' column." });
                     if (fileBInputRef.current) fileBInputRef.current.value = "";
                    return;
                }

                const newTableData: TableData = { headers, rows: json, fileName: file.name };
                
                if (fileType === 'A') {
                    setFileA(newTableData);
                    updateCommonHeaders(newTableData.headers, fileB?.headers);
                } else {
                    setFileB(newTableData);
                    updateCommonHeaders(fileA?.headers, newTableData.headers);
                }

            } catch (error) {
                console.error("Error processing file:", error);
                toast({ variant: 'destructive', title: "File Read Error", description: "There was an issue reading the Excel file. Please ensure it's a valid, uncorrupted file."});
            }
        };
        reader.readAsBinaryString(file);
    };

    const runAutoMatch = useCallback((
        unmatched: UnmatchedRow[],
        allFileARows: any[],
        mergeKeyA: string,
        mergeKeyB: string
    ) => {
        if (!unmatched.length || !allFileARows.length || !mergeKeyA || !mergeKeyB) {
            return {};
        }

        const getSimilarityScore = (nameA: string, nameB: string): number => {
            if (!nameA || !nameB) return 0;
            
            // Normalize names: lowercase, remove hyphens/punctuation, split into words
            const normalize = (name: string) => name.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
            const wordsA = normalize(nameA);
            const wordsB = normalize(nameB);

            if (wordsA.length === 0 || wordsB.length === 0) return 0;

            const intersection = wordsA.filter(word => wordsB.includes(word));
            
            // Full match
            if (wordsA.join(' ') === wordsB.join(' ')) {
                return 100;
            }

            // Prefer intersection of at least 2 words
            if (intersection.length >= 2) {
                return intersection.length;
            }

            // Fallback to abbreviation check on normalized words
            const intersectionAbbr = wordsA.filter(wordA => wordsB.some(wordB => wordA.startsWith(wordB) || wordB.startsWith(wordA)));
            if (intersectionAbbr.length > 0) {
                return 0.5; // Lower score for abbreviations
            }
            
            return 0;
        };

        const newSelections: Record<string, any> = {};
        let autoMatchCount = 0;

        unmatched.forEach(unmatchedRow => {
            const nameB = unmatchedRow.rowData[mergeKeyB];
            if (!nameB) return;

            let bestMatch: any | null = null;
            let highestScore = 0;

            for (const rowA of allFileARows) {
                const nameA = rowA[mergeKeyA];
                if (!nameA) continue;
                
                const score = getSimilarityScore(nameA, nameB);

                if (score > highestScore && score >= 2) { // Require at least 2 words to match or a perfect score
                    highestScore = score;
                    bestMatch = rowA;
                }
            }

            if (bestMatch) {
                const originalRowBKey = String(unmatchedRow.rowData[mergeKeyB]);
                newSelections[originalRowBKey] = bestMatch;
                autoMatchCount++;
            }
        });
        
        if (autoMatchCount > 0) {
            toast({
                title: "Auto-Match Complete",
                description: `${autoMatchCount} potential matches were automatically selected. Please review them.`
            });
        }

        return newSelections;

    }, [toast]);

    const handleMerge = async () => {
        if (!fileA || !fileB || !mergeKey) {
            toast({
                variant: 'destructive',
                title: "Merge Failed",
                description: "Please upload both files and select a merge column."
            });
            return;
        }

        setMergedData(null);
        setUnmatchedData(null);
        setManualSelections({});
        
        toast({ title: "Merging in progress...", description: "Comparing files on the server." });
        
        const plainFileA = JSON.parse(JSON.stringify({ headers: fileA.headers, rows: fileA.rows }));
        const plainFileB = JSON.parse(JSON.stringify({ headers: fileB.headers, rows: fileB.rows }));

        const serverResult = await mergeFilesOnServer(plainFileA, plainFileB, mergeKey);
        
        if (serverResult.error) {
            toast({ variant: "destructive", title: "Server Error", description: serverResult.error });
            return;
        }

        const finalTableData = serverResult.mergedRows.map((row, index) => {
            const newRow = { ...row };
            delete newRow['No'];
            return {
                'No': index + 1,
                ...newRow
            };
        });
        
        const finalUnmatched = serverResult.unmatchedRowsB.map((rowB: any) => ({
            rowData: rowB,
        }));
        
        setMergedData(finalTableData);
        setUnmatchedData(finalUnmatched);
        
        // Run auto-match after setting the unmatched data
        const mergeKeyA = fileA.headers.find(h => h.toLowerCase() === mergeKey.toLowerCase()) || '';
        const mergeKeyB = fileB.headers.find(h => h.toLowerCase() === mergeKey.toLowerCase()) || '';
        const autoSelections = runAutoMatch(finalUnmatched, fileA.rows, mergeKeyA, mergeKeyB);
        setManualSelections(autoSelections);
        

        toast({ title: "Merge Processed", description: `${finalTableData.length} rows Matched. Proceed to Review.` });
        setActiveTab("review");
    };

    const handleManualSelection = (originalRowB: any, selectedRowA: any | null) => {
        if (!fileB || !mergeKey) return;
        const fileBMergeKey = fileB.headers.find(h => h.toLowerCase() === mergeKey.toLowerCase()) || '';
        const originalRowKey = String(originalRowB[fileBMergeKey]);

        setManualSelections(prev => {
            const newSelections = { ...prev };
            if (selectedRowA === null) {
                // If null is passed, it means deselect
                delete newSelections[originalRowKey];
            } else {
                newSelections[originalRowKey] = selectedRowA;
            }
            return newSelections;
        });
    };
    
    const handleBulkManualMerge = useCallback(() => {
        if (!unmatchedData || !fileB || !mergeKey || Object.keys(manualSelections).length === 0) {
            toast({ variant: "destructive", title: "No Selections to Add", description: "Please select at least one valid match before adding." });
            return;
        }

        const fileBMergeKey = fileB.headers.find(h => h.toLowerCase() === mergeKey.toLowerCase()) || '';
        
        const newlyMergedRows: any[] = [];
        const keysOfRowsToAdd = new Set<string>();

        unmatchedData.forEach(unmatchedRow => {
            const originalRowBKey = String(unmatchedRow.rowData[fileBMergeKey]);
            if (manualSelections[originalRowBKey]) {
                const selectedRowA = manualSelections[originalRowBKey];
                const mergedRow = { ...selectedRowA, ...unmatchedRow.rowData };
                newlyMergedRows.push(mergedRow);
                keysOfRowsToAdd.add(originalRowBKey);
            }
        });

        if (newlyMergedRows.length === 0) {
            toast({ variant: "destructive", title: "No Valid Selections", description: "Could not find any selections to merge. Please try again." });
            return;
        }

        const updatedMergedData = [...(mergedData || [])];
        newlyMergedRows.forEach(row => {
            row['No'] = updatedMergedData.length + 1;
            updatedMergedData.push(row);
        });

        const updatedUnmatchedData = unmatchedData.filter(item => {
            const itemKey = String(item.rowData[fileBMergeKey]);
            return !keysOfRowsToAdd.has(itemKey);
        });

        const updatedManualSelections = { ...manualSelections };
        keysOfRowsToAdd.forEach(key => delete updatedManualSelections[key]);

        setMergedData(updatedMergedData);
        setUnmatchedData(updatedUnmatchedData);
        setManualSelections(updatedManualSelections);

        toast({
            title: `${newlyMergedRows.length} Rows Added`,
            description: "The selected rows have been added to the final result.",
        });

    }, [unmatchedData, fileB, mergeKey, manualSelections, mergedData, toast]);

    const handleDownload = () => {
        if (!mergedData || mergedData.length === 0 || typeof XLSX === 'undefined') {
            toast({ variant: 'destructive', title: "Download Failed", description: "No merged data to download." });
            return;
        }
    
        const dataForSheet = mergedData.map(row => {
            const rowData: any[] = [];
            selectedHeaders.forEach(header => {
                const headerKey = Object.keys(row).find(k => k.toLowerCase() === header.toLowerCase());
                const cellValue = headerKey ? row[headerKey] : '';
                rowData.push(cellValue ?? '');
            });
            return rowData;
        });

        const worksheetData = [selectedHeaders, ...dataForSheet];

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Merged Data");
        XLSX.writeFile(workbook, "Merged_Data.xls");
    };

    
    const handleSaveDefaults = () => {
        if (!mergeKey) {
            toast({ variant: "destructive", title: "Cannot Save Defaults", description: "Please select a merge key first." });
            return;
        }
        if (selectedHeaders.length === 0) {
            toast({ variant: "destructive", title: "Cannot Save Defaults", description: "Please select at least one header to include." });
            return;
        }
        
        localStorage.setItem(LOCAL_STORAGE_KEY_MERGE_KEY, mergeKey);
        localStorage.setItem(LOCAL_STORAGE_KEY_HEADERS, JSON.stringify(selectedHeaders));
        
        toast({
            title: "Defaults Saved",
            description: "Your merge key and header selections have been saved in this browser.",
        });
    };


    return (
        <div className="flex-1 bg-background text-foreground">
             <header className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Data Weaver</h1>
                        <p className="text-sm text-muted-foreground mt-1">Upload two Excel files, select a common column to merge on, choose headers, and merge them into a single table.</p>
                    </div>
                     <div className="flex items-center gap-2">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Settings className="h-5 w-5" />
                                    <span className="sr-only">Settings</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Merge Settings</DialogTitle>
                                    <DialogDescription>
                                        Choose a common column to join the files on, then select the columns you want in the final table.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="merge-key-dialog">Kolom Acuan</Label>
                                        <Select value={mergeKey} onValueChange={setMergeKey} disabled={commonHeaders.length === 0}>
                                            <SelectTrigger id="merge-key-dialog">
                                                <SelectValue placeholder={commonHeaders.length > 0 ? "Select a column" : "No common columns"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {commonHeaders.map(header => (
                                                    <SelectItem key={header} value={header}>{header}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="headers-select-dialog">Headers to Include</Label>
                                        <MultiSelect
                                            id="headers-select-dialog"
                                            options={mergedHeaders}
                                            selected={selectedHeaders}
                                            onChange={setSelectedHeaders}
                                            className="w-full"
                                            placeholder="Select headers to include..."
                                        />
                                    </div>
                                    <div className="pt-4 border-t">
                                        <Button onClick={handleSaveDefaults} size="sm" variant="outline">
                                            <Save className="mr-2 h-4 w-4" />
                                            Set as Default
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                 <div className="px-4 sm:px-6 md:px-8 max-w-5xl mx-auto">
                    <TabsList className="p-1 rounded-lg grid w-full grid-cols-3 bg-muted">
                        <TabsTrigger 
                            value="upload" 
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground"
                        >
                            1. Upload
                        </TabsTrigger>
                        <TabsTrigger 
                            value="review" 
                            disabled={!mergedData}
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground"
                        >
                            2. Review
                        </TabsTrigger>
                        <TabsTrigger 
                            value="result" 
                            disabled={!mergedData}
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground"
                        >
                            3. Result
                        </TabsTrigger>
                    </TabsList>
                </div>
                
                <TabsContent value="upload" className="mt-4">
                     <div className="px-4 sm:px-6 md:px-8 max-w-5xl mx-auto">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Upload Files</CardTitle>
                                    <CardDescription>Select two Excel files (.xlsx, .xls). Data is saved in your browser.</CardDescription>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm" disabled={!fileA && !fileB}>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Reset All
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action will permanently delete the uploaded files and all merged data from your browser session. You will need to upload the files again.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleReset}>Yes, Reset</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardHeader>
                            <CardContent className="grid md:grid-cols-2 gap-6">
                                <div className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg min-h-[100px]">
                                    <h3 className="font-semibold">File NISN (File A)</h3>
                                    {fileA ? (
                                        <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                                            <CheckCircle className="h-5 w-5" />
                                            <span className="truncate">{fileA.fileName}</span>
                                        </div>
                                    ) : (
                                        <Button onClick={() => fileAInputRef.current?.click()} variant="outline">
                                            <Upload className="mr-2 h-4 w-4" />
                                            Upload File NISN
                                        </Button>
                                    )}
                                    <Input
                                        type="file"
                                        ref={fileAInputRef}
                                        className="hidden"
                                        accept=".xlsx, .xls"
                                        onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], 'A')}
                                    />
                                </div>
                                <div className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg min-h-[100px]">
                                    <h3 className="font-semibold">File id Bulk (File B)</h3>
                                    {fileB ? (
                                        <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                                            <CheckCircle className="h-5 w-5" />
                                            <span className="truncate">{fileB.fileName}</span>
                                        </div>
                                    ) : (
                                        <Button onClick={() => fileBInputRef.current?.click()} variant="outline">
                                            <Upload className="mr-2 h-4 w-4" />
                                            Upload File id Bulk
                                        </Button>
                                    )}
                                    <Input
                                        type="file"
                                        ref={fileBInputRef}
                                        className="hidden"
                                        accept=".xlsx, .xls"
                                        onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], 'B')}
                                    />
                                </div>
                            </CardContent>
                             <CardFooter>
                                <Button onClick={handleMerge} disabled={!fileA || !fileB || !mergeKey} className="w-full">
                                    <Columns className="mr-2 h-4 w-4" />
                                    Merge File
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="review" className="mt-4">
                    <div className="space-y-6 px-4 sm:px-6 md:px-8 max-w-5xl mx-auto">
                        {mergedData && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Review Summary</CardTitle>
                                    <CardDescription>
                                        The initial merge is complete. Review the unmatched data below or proceed to the final result.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-lg">
                                        <p><span className="font-bold text-green-600">{mergedData.length} rows</span> Matched.</p>
                                        {unmatchedData && <p><span className="font-bold text-yellow-600">{unmatchedData.length} names</span> Unmatched.</p>}
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button onClick={() => setActiveTab("result")} className="w-full sm:w-auto">
                                        Continue to Result
                                        <Forward className="ml-2 h-4 w-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}

                        {unmatchedData && unmatchedData.length > 0 && (
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-4">
                                    <div className="flex items-center gap-4">
                                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                                        <div>
                                            <CardTitle>Unmatched Data</CardTitle>
                                            <CardDescription>Validate these rows manually to add them to the result.</CardDescription>
                                        </div>
                                    </div>
                                    <Button onClick={handleBulkManualMerge} disabled={Object.keys(manualSelections).length === 0} size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950">
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Add Selected to Result
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="relative w-full overflow-auto rounded-md border max-h-[500px]">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-card z-10">
                                                <TableRow>
                                                    <TableHead>Name from id</TableHead>
                                                    <TableHead>Name from NISN</TableHead>
                                                    <TableHead className="text-center">Validasi</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(() => {
                                                    const fileAMergeKey = fileA?.headers.find(h => h.toLowerCase() === mergeKey?.toLowerCase()) || '';
                                                    
                                                    const alreadyMatchedValues = new Set([
                                                        ...(mergedData || []).map(row => row[fileAMergeKey]),
                                                        ...Object.values(manualSelections).filter(Boolean).map(rowA => rowA[fileAMergeKey])
                                                    ]);

                                                    return unmatchedData.map((unmatchedRow, rowIndex) => {
                                                        const fileBMergeKey = fileB?.headers.find(h => h.toLowerCase() === mergeKey?.toLowerCase()) || '';
                                                        const originalRowBKey = String(unmatchedRow.rowData[fileBMergeKey]);
                                                        const currentSelection = manualSelections[originalRowBKey];
                                                        
                                                        const availableRowsA = (fileA?.rows || []).filter(rowA => {
                                                            const rowAValue = rowA[fileAMergeKey];
                                                            // Show if it's not selected elsewhere, OR if it's the one currently selected for this row
                                                            return !alreadyMatchedValues.has(rowAValue) || (currentSelection && currentSelection[fileAMergeKey] === rowAValue);
                                                        });


                                                        return (
                                                            <TableRow key={rowIndex}>
                                                                <TableCell>
                                                                    {decodeHtml(String(unmatchedRow.rowData?.[fileBMergeKey] ?? 'No name'))}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <ManualSelectCombobox
                                                                        rowsA={availableRowsA}
                                                                        mergeKeyA={fileAMergeKey}
                                                                        value={currentSelection}
                                                                        onSelect={(selectedRowA) => {
                                                                            handleManualSelection(unmatchedRow.rowData, selectedRowA);
                                                                        }}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleManualSelection(unmatchedRow.rowData, currentSelection ? null : (manualSelections[originalRowBKey] || null))}
                                                                        variant={currentSelection ? "destructive" : "default"}
                                                                        disabled={!currentSelection && !manualSelections[originalRowBKey]}
                                                                        className="flex items-center justify-center gap-2 w-24"
                                                                    >
                                                                        {currentSelection ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                                                        <span>{currentSelection ? 'Unmatch' : 'Match'}</span>
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })
                                                })()}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="result" className="mt-4">
                     <div className="px-4 sm:px-6 md:px-8 max-w-5xl mx-auto">
                        {mergedData && (
                            <Card className="mb-6">
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle>Final Merged Result</CardTitle>
                                            <CardDescription>This is the combined table based on your selections. <span className="font-semibold">{mergedData.length} rows.</span></CardDescription>
                                        </div>
                                        <Button onClick={handleDownload} disabled={mergedData.length === 0}>
                                            <FileDown className="mr-2 h-4 w-4" />
                                            Download Merged File
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="relative w-full overflow-auto rounded-md border max-h-[500px]">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-card">
                                                <TableRow>
                                                    {selectedHeaders.map((header) => (
                                                        <TableHead key={header}>{header}</TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {mergedData.length > 0 ? (
                                                    mergedData.map((row, rowIndex) => (
                                                        <TableRow key={rowIndex}>
                                                            {selectedHeaders.map(header => {
                                                                const headerKey = Object.keys(row).find(k => k.toLowerCase() === header.toLowerCase());
                                                                const cellValue = headerKey ? row[headerKey] : '';
                                                                return (
                                                                    <TableCell key={`${header}-${rowIndex}`}>{decodeHtml(String(cellValue ?? ''))}</TableCell>

                                                                );
                                                            })}
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={selectedHeaders.length} className="text-center">
                                                            No merged data. Add data from the Review tab.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function ManualSelectCombobox({
    rowsA,
    mergeKeyA,
    value,
    onSelect,
}: {
    rowsA: any[],
    mergeKeyA: string,
    value: any | null,
    onSelect: (selectedRowA: any | null) => void
}) {
    const [open, setOpen] = useState(false)

    if (!mergeKeyA) {
         return <span className="text-xs text-muted-foreground">Pilih kolom acuan</span>;
    }
    
    if (!rowsA || rowsA.length === 0) {
        return <span className="text-xs text-muted-foreground">Tidak ada data untuk dipilih</span>;
    }

    const displayValue = value ? decodeHtml(String(value[mergeKeyA] ?? '')) : "Select name...";
    const hasValue = !!value;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-[250px] justify-between",
                        !hasValue && "bg-accent/50"
                    )}
                >
                    <span className="truncate">
                        {displayValue}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0">
                <Command>
                    <CommandInput placeholder="Search name..." />
                    <CommandList>
                        <CommandEmpty>No name found.</CommandEmpty>
                        <CommandGroup>
                            {rowsA.map((rowA, index) => {
                                const key = `${rowA[mergeKeyA]}-${index}`;
                                const displayVal = decodeHtml(String(rowA[mergeKeyA] ?? ''));
                                return (
                                    <CommandItem
                                        key={key}
                                        value={displayVal}
                                        onSelect={() => {
                                            onSelect(rowA)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value && value[mergeKeyA] === rowA[mergeKeyA] ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {displayVal}
                                    </CommandItem>
                                )}
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
