
"use client";

import { useState, useTransition, useEffect, useContext, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, ArrowLeft, Import, DatabaseZap, Save, CheckCircle2, XCircle, FileSpreadsheet, ArrowRight, Undo } from 'lucide-react';
import { importToSheet, updateSheetStatus, getSheetTitle, getUpdatePreview, undoLastAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { TableDataContext } from '@/store/table-data-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useDebouncedCallback } from 'use-debounce';
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
} from "@/components/ui/alert-dialog"

const LOCAL_STORAGE_KEY_SHEET_URL = 'gsheetDashboardSheetUrl';
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1aWpDRyFyl6a8bV0-e1ddYVkcfDK5WA498OHMU2Wv9iU/edit?gid=0#gid=0';

type UpdatePreview = {
    title: string;
    oldStatus: string;
    newStatus: string;
};

type LastActionUndoData = {
    operationType: 'IMPORT' | 'UPDATE';
    [key: string]: any;
} | null;

export function GsheetDashboard() {
  const { tableData, setTableData } = useContext(TableDataContext);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetTitle, setSheetTitle] = useState<{ name: string; error: string | null; loading: boolean, sheetId: number | null }>({ name: '', error: null, loading: false, sheetId: null });
  const [updatePreview, setUpdatePreview] = useState<UpdatePreview[]>([]);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [lastActionUndoData, setLastActionUndoData] = useState<LastActionUndoData>(null);

  const [isImporting, startImporting] = useTransition();
  const [isUpdating, startUpdating] = useTransition();
  const [isPreviewing, startPreviewing] = useTransition();
  const [isUndoing, startUndoing] = useTransition();

  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const savedUrl = localStorage.getItem(LOCAL_STORAGE_KEY_SHEET_URL);
    const initialUrl = savedUrl || DEFAULT_SHEET_URL;
    setSheetUrl(initialUrl);
    fetchTitle(initialUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTitle = useCallback(async (url: string) => {
    if (!url || !url.includes('spreadsheets/d/')) {
        setSheetTitle({ name: '', error: null, loading: false, sheetId: null });
        return;
    }
    setSheetTitle(prev => ({ ...prev, loading: true, name: '', error: null, sheetId: null }));
    const result = await getSheetTitle(url);
    
    setSheetTitle({
        name: result.title || '',
        error: result.error || null,
        loading: false,
        sheetId: result.sheetId || null,
    });
  }, []);

  const debouncedFetchTitle = useDebouncedCallback(fetchTitle, 500);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setSheetUrl(newUrl);
    debouncedFetchTitle(newUrl);
    setLastActionUndoData(null);
  };

  const handleUpdatePreview = async () => {
    if (!tableData || !sheetUrl) {
      toast({
        variant: "destructive",
        title: "Preview Failed",
        description: "No data to preview or sheet URL is missing.",
      });
      return;
    }

    startPreviewing(async () => {
        const result = await getUpdatePreview({ rows: tableData.rows }, sheetUrl);
        if (result.error) {
            toast({
                variant: "destructive",
                title: "Preview Error",
                description: `Failed to get update preview: ${result.error}`,
            });
            return;
        }

        if (result.changes && result.changes.length > 0) {
            setUpdatePreview(result.changes);
            setIsUpdateConfirmOpen(true);
        } else {
            toast({
                title: "No Changes Detected",
                description: "All statuses are already up-to-date in the Google Sheet.",
            });
        }
    });
  };

  const handleConfirmUpdate = async () => {
    if (!tableData || !sheetUrl) return;
    setIsUpdateConfirmOpen(false);

    localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_URL, sheetUrl);

    startUpdating(async () => {
      const result = await updateSheetStatus({ rows: tableData.rows }, sheetUrl);
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Update Error",
          description: `Failed to update sheet status: ${result.error}`,
        });
        setLastActionUndoData(null);
      } else {
        toast({
          title: "Update Successful",
          description: (
            <div>
              <p className="mb-2">{result.message}</p>
              {result.updatedRows && result.updatedRows.length > 0 && (
                <div className="mt-2 text-xs">
                  <p className="font-bold">Updated Cases:</p>
                  <ul className="list-disc pl-5 max-h-40 overflow-y-auto">
                    {result.updatedRows.map((item: { title: string, newStatus: string }, index: number) => (
                      <li key={index}>{item.title} -> <strong>{item.newStatus}</strong></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ),
        });
        if (result.updatedRows && result.updatedRows.length > 0) {
            setLastActionUndoData({ operationType: 'UPDATE', updatedRows: result.updatedRows });
        } else {
            setLastActionUndoData(null);
        }
      }
    });
  };

  const handleImport = async () => {
    if (!tableData || !sheetUrl || !sheetTitle.sheetId) {
        toast({
            variant: "destructive",
            title: "Import Failed",
            description: "No data to import, sheet URL is missing, or sheet ID could not be determined.",
        });
        return;
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_URL, sheetUrl);

    startImporting(async () => {
        if (!tableData || !sheetTitle.sheetId) return;
        const result = await importToSheet({ headers: tableData.headers, rows: tableData.rows }, sheetUrl, sheetTitle.sheetId);

        if (result.error) {
            toast({
                variant: "destructive",
                title: "Import Error",
                description: `Failed to import to sheet: ${result.error}`,
            });
            setLastActionUndoData(null);
        } else {
            toast({
                title: "Import Complete",
                description: (
                    <div>
                        {result.importedCount > 0 && <p>{result.importedCount} new rows imported successfully.</p>}
                        {result.duplicateCount > 0 && (
                            <div className="mt-2 text-xs">
                                <p className="font-bold">{result.duplicateCount} duplicate rows found and skipped:</p>
                                <ul className="list-disc pl-5 max-h-40 overflow-y-auto">
                                    {(result.duplicates ?? []).map((item, index) => (
                                        <li key={index}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {!result.importedCount && !result.duplicateCount && <p>No new data to import.</p>}
                    </div>
                ),
            });
            if (result.undoData) {
                setLastActionUndoData(result.undoData);
            } else {
                setLastActionUndoData(null);
            }
        }
    });
  };

  const handleUndo = async () => {
    if (!lastActionUndoData || !sheetUrl) {
      toast({
        variant: "destructive",
        title: "Undo Failed",
        description: "There is no action to undo.",
      });
      return;
    }

    startUndoing(async () => {
      const result = await undoLastAction(lastActionUndoData, sheetUrl);
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Undo Error",
          description: result.error,
        });
      } else {
        toast({
          title: "Undo Successful",
          description: result.message,
        });
        setLastActionUndoData(null); // Clear undo data after successful undo
      }
    });
  };

  const handleSaveUrlAsDefault = () => {
    if (!sheetUrl) {
        toast({
            variant: "destructive",
            title: "Cannot Save",
            description: "Please enter a URL before saving it as default.",
        });
        return;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_URL, sheetUrl);
    toast({
        title: "URL Saved",
        description: "Google Sheet URL has been saved as your default.",
    });
  };
  
  const handleStatusChange = (rowIndex: number, newStatus: string) => {
    if (!tableData) return;
    const newRows = [...tableData.rows];
    newRows[rowIndex]['Status'] = newStatus;
    setTableData({ ...tableData, rows: newRows });
    setLastActionUndoData(null); // Invalidate last action on data change
  };

  const InitialState = () => (
    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
        <Import className="w-16 h-16 text-muted-foreground mb-4" />
        <CardTitle>No Data to Import</CardTitle>
        <CardDescription className="mt-2 mb-4">
            First, convert your JSON data on the converter page.
        </CardDescription>
        <Button onClick={() => router.push('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Converter
        </Button>
    </Card>
  );

  return (
    <div className="flex-1 bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Update Cases</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tinjau data yang dikonversi dari JSON dan impor ke Google Sheet target Anda.
          </p>
        </header>

        {!tableData ? (
            <InitialState />
        ) : (
          <>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Import Destination</CardTitle>
                <CardDescription>
                  Masukkan URL Google Sheet Anda. Data akan diimpor ke sheet "All Case".
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="grid gap-2">
                    <Label htmlFor="gsheet-url">Target Google Sheet URL</Label>
                    <div className="flex flex-col sm:flex-row items-stretch gap-2">
                      <Input
                        id="gsheet-url"
                        type="url"
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        value={sheetUrl}
                        onChange={handleUrlChange}
                        className="flex-grow"
                      />
                      <Button onClick={handleSaveUrlAsDefault} variant="outline" size="sm" className="w-full sm:w-auto">
                          <Save className="h-4 w-4 mr-2" /> Set as Default
                      </Button>
                    </div>
                     <div className="h-5 mt-2 text-xs">
                        {sheetTitle.loading && (
                            <p className="flex items-center text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Fetching title...
                            </p>
                        )}
                        {sheetTitle.error && (
                            <p className="flex items-center text-destructive">
                                <XCircle className="mr-2 h-4 w-4" />
                                {sheetTitle.error}
                            </p>
                        )}
                        {sheetTitle.name && !sheetTitle.error && (
                            <p className="flex items-center text-green-600 font-medium">
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {sheetTitle.name}
                            </p>
                        )}
                         {!sheetTitle.loading && !sheetTitle.error && !sheetTitle.name && (
                            <p className="flex items-center text-muted-foreground">
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                Sheet title will appear here.
                            </p>
                         )}
                    </div>
                  </div>
                
                <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button size="sm" disabled={isImporting || isUpdating || !sheetUrl || sheetTitle.loading || !!sheetTitle.error || isPreviewing || isUndoing}>
                           <Upload className="mr-2 h-4 w-4" />
                           Import to GSheet
                         </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Konfirmasi Impor</AlertDialogTitle>
                          <AlertDialogDescription>
                            Apakah Anda yakin akan mengimpor {tableData.rows.length} baris ke Google Sheet <span className="font-bold text-foreground">"{sheetTitle.name}"</span>? Tindakan ini tidak dapat dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={handleImport} disabled={isImporting}>
                            {isImporting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Mengimpor...
                                </>
                              ) : (
                                "Ya, Lanjutkan Impor"
                              )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    <AlertDialog open={isUpdateConfirmOpen} onOpenChange={setIsUpdateConfirmOpen}>
                      <AlertDialogTrigger asChild>
                         <Button 
                            onClick={handleUpdatePreview} 
                            size="sm"
                            className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
                            disabled={isUpdating || isImporting || !sheetUrl || sheetTitle.loading || !!sheetTitle.error || isPreviewing || isUndoing}>
                            {isPreviewing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Mengecek...
                                </>
                            ) : (
                                <>
                                    <DatabaseZap className="mr-2 h-4 w-4" />
                                    Update Status
                                </>
                            )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Konfirmasi Pembaruan Status</AlertDialogTitle>
                           <div className="text-sm text-muted-foreground">
                                <p className='mb-2'>Apakah Anda yakin ingin memperbarui status untuk {updatePreview.length} kasus di sheet <span className="font-bold text-foreground">"{sheetTitle.name}"</span>?</p>
                                <div className="mt-2 text-xs max-h-48 overflow-y-auto border bg-muted/50 p-2 rounded-md space-y-1">
                                    <p className="font-bold">Detail Perubahan:</p>
                                    <ul className="list-disc pl-5">
                                        {updatePreview.map((item, index) => (
                                          <li key={index} className='text-foreground'>
                                            {item.title}: <span className='line-through'>{item.oldStatus || 'Kosong'}</span> <ArrowRight className="inline h-3 w-3" /> <strong>{item.newStatus}</strong>
                                          </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setUpdatePreview([])}>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={handleConfirmUpdate} disabled={isUpdating}>
                            {isUpdating ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Memperbarui...
                                </>
                              ) : (
                                "Ya, Lanjutkan Update"
                              )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button 
                        onClick={handleUndo} 
                        size="sm"
                        variant="destructive"
                        disabled={!lastActionUndoData || isUndoing || isImporting || isUpdating || isPreviewing}>
                        {isUndoing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Membatalkan...
                            </>
                        ) : (
                            <>
                                <Undo className="mr-2 h-4 w-4" />
                                Undo Last Action
                            </>
                        )}
                    </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg mt-6">
                <CardHeader>
                    <CardTitle>Data Preview for Import</CardTitle>
                    <CardDescription>
                        Ini adalah data yang Anda konversi. Data ini akan diimpor ke sheet target.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto rounded-md border max-h-[500px]">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-card">
                                <TableRow>
                                    {tableData.headers.map(header => (
                                        <TableHead 
                                            key={header} 
                                            className="font-bold bg-muted/50 whitespace-nowrap"
                                        >
                                           {header}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tableData.rows.map((row, rowIndex) => (
                                    <TableRow key={rowIndex} className="hover:bg-muted/50">
                                        {tableData.headers.map((header, headerIndex) => (
                                            <TableCell 
                                                key={`${header}-${headerIndex}-${rowIndex}`} 
                                                className="text-xs"
                                            >
                                               {header === 'Status' ? (
                                                    <Select
                                                        value={String(row[header] ?? '')}
                                                        onValueChange={(newStatus) => handleStatusChange(rowIndex, newStatus)}
                                                    >
                                                        <SelectTrigger className="w-[120px] h-8 text-xs">
                                                            <SelectValue placeholder="Select status" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="L1">L1</SelectItem>
                                                            <SelectItem value="L2">L2</SelectItem>
                                                            <SelectItem value="L3">L3</SelectItem>
                                                            <SelectItem value="Solved">Solved</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    String(row[header] || '')
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter>
                    <p className="text-sm text-muted-foreground">Showing {tableData.rows.length} rows to be imported.</p>
                </CardFooter>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
