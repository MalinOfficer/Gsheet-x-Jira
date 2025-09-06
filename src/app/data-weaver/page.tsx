
"use client";

import { useState, useRef, useTransition } from 'react';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileDown, Columns, Loader2, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type TableData = {
    headers: string[];
    rows: any[];
    fileName: string;
};

type SelectOption = {
    value: string;
    label: string;
};

// This is a placeholder for a real server action.
// In a real app, this would be in `src/app/actions.ts`.
async function mergeFilesOnServer(fileAData: TableData, fileBData: TableData, mergeKey: string) {
    // Simulate server-side processing
    console.log("Merging on server with key:", mergeKey);
    const fileAMap = new Map(fileAData.rows.map(row => [String(row[mergeKey]).toLowerCase(), row]));
    
    const mergedRows: any[] = [];
    const unmatchedRowsB: any[] = [];

    fileBData.rows.forEach(rowB => {
        const key = String(rowB[mergeKey]).toLowerCase();
        const rowA = fileAMap.get(key);
        if (rowA) {
            mergedRows.push({ ...rowA, ...rowB });
            fileAMap.delete(key); // Remove matched row
        } else {
            unmatchedRowsB.push(rowB);
        }
    });

    const unmatchedRowsA = Array.from(fileAMap.values());

    return { mergedRows, unmatchedRowsA, unmatchedRowsB };
}


const TablePreview = ({ title, tableData }: { title: string, tableData: TableData | null }) => {
    if (!tableData) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>Preview of {tableData.fileName}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative w-full overflow-auto rounded-md border max-h-[300px]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                            <TableRow>
                                {tableData.headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tableData.rows.slice(0, 5).map((row, rowIndex) => (
                                <TableRow key={rowIndex}>
                                    {tableData.headers.map(header => (
                                        <TableCell key={`${header}-${rowIndex}`}>{String(row[header] ?? '')}</TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                 {tableData.rows.length > 5 && <p className="text-xs text-muted-foreground mt-2">Showing 5 of {tableData.rows.length} rows.</p>}
            </CardContent>
        </Card>
    );
};


export default function DataWeaverPage() {
    const [fileA, setFileA] = useState<TableData | null>(null);
    const [fileB, setFileB] = useState<TableData | null>(null);
    const [mergedData, setMergedData] = useState<any[] | null>(null);
    const [unmatchedData, setUnmatchedData] = useState<any[] | null>(null);
    
    const [mergeKey, setMergeKey] = useState<string>('');
    const [commonHeaders, setCommonHeaders] = useState<string[]>([]);
    
    const [isMerging, startMergeTransition] = useTransition();

    const fileAInputRef = useRef<HTMLInputElement>(null);
    const fileBInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleReset = () => {
        setFileA(null);
        setFileB(null);
        setMergedData(null);
        setUnmatchedData(null);
        setMergeKey('');
        setCommonHeaders([]);
        if(fileAInputRef.current) fileAInputRef.current.value = '';
        if(fileBInputRef.current) fileBInputRef.current.value = '';
        toast({ title: "Reset Complete", description: "All files and data have been cleared." });
    };

    const updateCommonHeaders = (headersA?: string[], headersB?: string[]) => {
        if (headersA && headersB) {
            const common = headersA.filter(h => headersB.includes(h));
            setCommonHeaders(common);
            if (common.includes('nama')) {
                setMergeKey('nama');
            } else if (common.length > 0) {
                setMergeKey(common[0]);
            } else {
                setMergeKey('');
            }
        } else {
            setCommonHeaders([]);
        }
    };

    const handleFileUpload = (file: File, fileType: 'A' | 'B') => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json<any>(worksheet);

                if (json.length === 0) {
                    toast({ variant: 'destructive', title: "Empty File", description: "The selected Excel file is empty."});
                    return;
                }
                const headers = Object.keys(json[0]);
                const newTableData = { headers, rows: json, fileName: file.name };

                if (fileType === 'A') {
                    setFileA(newTableData);
                    updateCommonHeaders(newTableData.headers, fileB?.headers);
                } else {
                    setFileB(newTableData);
                    updateCommonHeaders(fileA?.headers, newTableData.headers);
                }
                toast({ title: "File Uploaded", description: `${file.name} has been processed.` });
            } catch (error) {
                console.error("Error processing file:", error);
                toast({ variant: 'destructive', title: "File Read Error", description: "There was an issue reading the Excel file."});
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleMerge = () => {
        if (!fileA || !fileB || !mergeKey) {
            toast({
                variant: 'destructive',
                title: "Merge Failed",
                description: "Please upload both files and select a merge column."
            });
            return;
        }

        startMergeTransition(async () => {
            try {
                const { mergedRows, unmatchedRowsA } = await mergeFilesOnServer(fileA, fileB, mergeKey);
                setMergedData(mergedRows);
                setUnmatchedData(unmatchedRowsA);
                toast({
                    title: "Merge Successful",
                    description: `${mergedRows.length} rows were matched and merged. ${unmatchedRowsA.length} rows were not matched.`
                });
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: "Server Error",
                    description: "An error occurred while merging the files on the server."
                });
            }
        });
    };
    
    const handleDownload = (data: any[], fileName: string) => {
        if (!data || data.length === 0) {
            toast({ variant: 'destructive', title: "Download Failed", description: "No data to download."});
            return;
        }
        const headers = Object.keys(data[0]);
        const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Data Weaver</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                           Upload two Excel files, select a common column, and merge them together.
                        </p>
                    </div>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Reset
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will clear all uploaded files and merged data. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleReset}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </header>

                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>1. Upload Files</CardTitle>
                        <CardDescription>Select two Excel files (.xlsx, .xls) to begin.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-6">
                        <div className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg">
                            <h3 className="font-semibold">File A (e.g., File NISN)</h3>
                            <Button onClick={() => fileAInputRef.current?.click()} variant="outline" disabled={isMerging}>
                                <Upload className="mr-2 h-4 w-4" />
                                {fileA ? "Change File A" : "Upload File A"}
                            </Button>
                             {fileA && <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4"/> {fileA.fileName}</p>}
                            <Input
                                type="file"
                                ref={fileAInputRef}
                                className="hidden"
                                accept=".xlsx, .xls"
                                onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], 'A')}
                            />
                        </div>
                        <div className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg">
                            <h3 className="font-semibold">File B (e.g., File id Bulk)</h3>
                            <Button onClick={() => fileBInputRef.current?.click()} variant="outline" disabled={isMerging}>
                                <Upload className="mr-2 h-4 w-4" />
                                {fileB ? "Change File B" : "Upload File B"}
                            </Button>
                             {fileB && <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4"/> {fileB.fileName}</p>}
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

                <div className="grid md:grid-cols-2 gap-6">
                    <TablePreview title="File A Preview" tableData={fileA} />
                    <TablePreview title="File B Preview" tableData={fileB} />
                </div>

                {(fileA && fileB) && (
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>2. Configure & Merge</CardTitle>
                            <CardDescription>Choose a common column to join the files on.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4 items-start">
                                <div className="space-y-2">
                                    <Label htmlFor="merge-key">Kolom Acuan</Label>
                                    <Select value={mergeKey} onValueChange={setMergeKey} disabled={commonHeaders.length === 0 || isMerging}>
                                        <SelectTrigger id="merge-key">
                                            <SelectValue placeholder={commonHeaders.length > 0 ? "Select a column" : "No common columns"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {commonHeaders.map(header => (
                                                <SelectItem key={header} value={header}>{header}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button onClick={handleMerge} disabled={isMerging || !mergeKey}>
                                {isMerging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Columns className="mr-2 h-4 w-4" />}
                                {isMerging ? 'Merging...' : 'Merge Files'}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {mergedData && (
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div>
                                    <CardTitle>3. Merged Result ({mergedData.length} rows)</CardTitle>
                                    <CardDescription>Data that was successfully matched and merged.</CardDescription>
                                </div>
                                <Button onClick={() => handleDownload(mergedData, "Merged_Data.xlsx")} disabled={mergedData.length === 0}>
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Download Merged
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="relative w-full overflow-auto rounded-md border max-h-[500px]">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-card z-10">
                                        <TableRow>
                                            {mergedData.length > 0 && Object.keys(mergedData[0]).map(header => <TableHead key={header}>{header}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {mergedData.length > 0 ? (
                                            mergedData.map((row, rowIndex) => (
                                                <TableRow key={rowIndex}>
                                                    {Object.keys(row).map(header => (
                                                        <TableCell key={`${header}-${rowIndex}`}>{String(row[header] ?? '')}</TableCell>
                                                    ))}
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={fileA?.headers.length || 1} className="h-24 text-center">
                                                    No results match your criteria.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                 {unmatchedData && unmatchedData.length > 0 && (
                    <Card>
                        <CardHeader>
                           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div>
                                    <CardTitle>Unmatched Data from File A ({unmatchedData.length} rows)</CardTitle>
                                    <CardDescription>These rows from the first file could not find a match in the second file.</CardDescription>
                                </div>
                                <Button onClick={() => handleDownload(unmatchedData, "Unmatched_Data.xlsx")}>
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Download Unmatched
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="relative w-full overflow-auto rounded-md border max-h-[500px]">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-card z-10">
                                        <TableRow>
                                            {Object.keys(unmatchedData[0]).map(header => <TableHead key={header}>{header}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {unmatchedData.map((row, rowIndex) => (
                                            <TableRow key={rowIndex}>
                                                {Object.keys(row).map(header => (
                                                    <TableCell key={`${header}-${rowIndex}`}>{String(row[header] ?? '')}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
