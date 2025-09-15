
"use client";

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Upload, FileDown, PlusCircle, Trash2, CheckCircle, RefreshCw, Wand2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Input } from '@/components/ui/input';

declare const XLSX: any;

type FileInfo = {
    name: string;
    columns: string[]; // Changed from headers to columns
    rows: any[][];     // Changed to array of arrays
};

type Mapping = {
    id: number;
    sourceColumn: string; // Will store column letter e.g., "A"
    targetColumn: string; // Will store column letter e.g., "B"
};

// Helper to convert index to Excel-like column name (A, B, ..., Z, AA, etc.)
const toColumnName = (num: number): string => {
    let s = '', t;
    while (num > 0) {
        t = (num - 1) % 26;
        s = String.fromCharCode(65 + t) + s;
        num = (num - t) / 26 | 0;
    }
    return s || '';
};

export default function DataNormalisasiPage() {
    const [fileA, setFileA] = useState<FileInfo | null>(null);
    const [fileB, setFileB] = useState<FileInfo | null>(null);
    const [mappings, setMappings] = useState<Mapping[]>([{ id: 1, sourceColumn: '', targetColumn: '' }]);
    const [resultFile, setResultFile] = useState<FileInfo | null>(null);
    
    const fileAInputRef = useRef<HTMLInputElement>(null);
    const fileBInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

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
                
                let sheetData: any[][] = [];

                // Find the first sheet with data
                for (const name of workbook.SheetNames) {
                    const worksheet = workbook.Sheets[name];
                    const sheetJson = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
                    if (sheetJson.length > 0) {
                        sheetData = sheetJson;
                        break;
                    }
                }

                if (sheetData.length === 0) {
                    toast({ variant: 'destructive', title: "Empty File", description: "Could not find any data in the sheets of this Excel file."});
                    return;
                }

                const maxCols = Math.max(...sheetData.map(row => row.length));
                const columns = Array.from({ length: maxCols }, (_, i) => toColumnName(i + 1));
                
                const fileInfo = { name: file.name, columns, rows: sheetData };
                
                if (fileType === 'A') {
                    setFileA(fileInfo);
                } else {
                    setFileB(fileInfo);
                }
                setResultFile(null); // Reset result if a new file is uploaded
            } catch (error) {
                console.error("Error processing file:", error);
                toast({ variant: 'destructive', title: "File Read Error", description: "There was an issue reading the Excel file."});
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleReset = () => {
        setFileA(null);
        setFileB(null);
        setMappings([{ id: 1, sourceColumn: '', targetColumn: '' }]);
        setResultFile(null);
        if (fileAInputRef.current) fileAInputRef.current.value = "";
        if (fileBInputRef.current) fileBInputRef.current.value = "";
    };

    const addMapping = () => {
        setMappings([...mappings, { id: Date.now(), sourceColumn: '', targetColumn: '' }]);
    };

    const removeMapping = (id: number) => {
        setMappings(mappings.filter(m => m.id !== id));
    };

    const updateMapping = (id: number, key: 'sourceColumn' | 'targetColumn', value: string) => {
        setMappings(mappings.map(m => m.id === id ? { ...m, [key]: value } : m));
    };

    // Helper to convert column letter to 0-based index
    const fromColumnName = (name: string): number => {
      let number = 0;
      for (let i = 0; i < name.length; i++) {
        number = number * 26 + (name.charCodeAt(i) - ('A'.charCodeAt(0) - 1));
      }
      return number - 1;
    };

    const runNormalization = () => {
        if (!fileA || !fileB) {
            toast({ variant: 'destructive', title: "Files Missing", description: "Please upload both File Data (A) and File Input (B)." });
            return;
        }

        const validMappings = mappings.filter(m => m.sourceColumn && m.targetColumn);
        if (validMappings.length === 0) {
            toast({ variant: 'destructive', title: "No Mappings", description: "Please configure at least one valid column mapping." });
            return;
        }

        toast({ title: "Processing...", description: "Normalizing data based on your configuration." });

        // Using the first column as a key. This assumes the key is in the first column for both files.
        const keyColumnAIndex = 0;
        const keyColumnBIndex = 0;
        
        // Create a map from File A for faster lookups.
        const fileAMap = new Map(fileA.rows.map(row => [row[keyColumnAIndex], row]));
        
        const newRowsB = fileB.rows.map(rowB => {
            const newRow = [...rowB]; // Create a mutable copy
            const keyB = rowB[keyColumnBIndex];
            const matchingRowA = fileAMap.get(keyB);

            if (matchingRowA) {
                validMappings.forEach(mapping => {
                    const sourceIndex = fromColumnName(mapping.sourceColumn);
                    const targetIndex = fromColumnName(mapping.targetColumn);
                    
                    if (sourceIndex >= 0 && sourceIndex < matchingRowA.length) {
                        newRow[targetIndex] = matchingRowA[sourceIndex];
                    }
                });
            }
            return newRow;
        });
        
        // Determine the headers for the result file. It should be the original headers from File B's first row.
        const resultHeaders = fileB.rows[0]?.map((_, i) => toColumnName(i + 1)) || [];
        const finalColumns = Array.from({length: Math.max(...newRowsB.map(r => r.length))}, (_, i) => toColumnName(i + 1));

        setResultFile({
            name: `Normalized_${fileB.name}`,
            columns: finalColumns,
            rows: newRowsB
        });

        toast({ title: "Normalization Complete!", description: "The result is ready for download." });
    };
    
    const handleDownload = () => {
        if (!resultFile || typeof XLSX === 'undefined') {
            toast({ variant: 'destructive', title: "Download Failed", description: "No result data to download." });
            return;
        }

        const worksheet = XLSX.utils.aoa_to_sheet(resultFile.rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Normalized Data");

        XLSX.writeFile(workbook, resultFile.name);
    };

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Data Normalisasi</h1>
                    <p className="text-sm text-muted-foreground mt-1">Upload File Data (A) dan File Input (B), konfigurasikan pemetaan kolom, lalu proses untuk mentransfer data.</p>
                </header>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>1. Upload Files</CardTitle>
                            <CardDescription>Pilih File Data sumber dan File Input target.</CardDescription>
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
                                        This action will clear all uploaded files and mapping configurations.
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
                            <h3 className="font-semibold">File Data (A)</h3>
                            {fileA ? (
                                <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                                    <CheckCircle className="h-5 w-5" />
                                    <span className="truncate">{fileA.name}</span>
                                </div>
                            ) : (
                                <Button onClick={() => fileAInputRef.current?.click()} variant="outline">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload File A
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
                            <h3 className="font-semibold">File Input (B)</h3>
                            {fileB ? (
                                <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                                    <CheckCircle className="h-5 w-5" />
                                    <span className="truncate">{fileB.name}</span>
                                </div>
                            ) : (
                                <Button onClick={() => fileBInputRef.current?.click()} variant="outline">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload File B
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
                </Card>

                {fileA && fileB && (
                    <Card>
                        <CardHeader>
                            <CardTitle>2. Konfigurasi Pemetaan</CardTitle>
                            <CardDescription>Pilih kolom dari File A yang datanya ingin dimasukkan ke kolom di File B.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {mappings.map((mapping) => (
                                    <div key={mapping.id} className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] gap-4 items-center p-3 border rounded-lg">
                                        <div className="grid gap-1.5">
                                            <label className="text-sm font-medium">Kolom File A (Sumber)</label>
                                            <Select
                                                value={mapping.sourceColumn}
                                                onValueChange={(value) => updateMapping(mapping.id, 'sourceColumn', value)}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Pilih Kolom..." /></SelectTrigger>
                                                <SelectContent>
                                                    {fileA.columns.map(c => <SelectItem key={c} value={c}>Kolom {c}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <label className="text-sm font-medium">Kolom File B (Target)</label>
                                            <Select
                                                value={mapping.targetColumn}
                                                onValueChange={(value) => updateMapping(mapping.id, 'targetColumn', value)}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Pilih Kolom..." /></SelectTrigger>
                                                <SelectContent>
                                                    {fileB.columns.map(c => <SelectItem key={c} value={c}>Kolom {c}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeMapping(mapping.id)}
                                            className="self-end text-muted-foreground hover:text-destructive"
                                            disabled={mappings.length <= 1}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Remove Mapping</span>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <Button onClick={addMapping} variant="outline" size="sm" className="mt-4">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Tambah Pemetaan
                            </Button>
                        </CardContent>
                        <CardFooter className="border-t pt-6">
                             <Button onClick={runNormalization} className="w-full sm:w-auto">
                                <Wand2 className="mr-2 h-4 w-4" />
                                Proses Normalisasi
                            </Button>
                        </CardFooter>
                    </Card>
                )}
                
                {resultFile && (
                    <Card>
                        <CardHeader>
                            <CardTitle>3. Hasil</CardTitle>
                            <CardDescription>Proses normalisasi selesai. Anda dapat mengunduh file hasilnya.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 p-4 border rounded-md bg-muted/50">
                                <CheckCircle className="h-6 w-6 text-green-600" />
                                <div>
                                    <p className="font-semibold">File hasil siap diunduh.</p>
                                    <p className="text-sm text-muted-foreground">{resultFile.rows.length} baris telah diproses.</p>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleDownload}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Download Hasil ({resultFile.name})
                            </Button>
                        </CardFooter>
                    </Card>
                )}

            </div>
        </div>
    );
}

    