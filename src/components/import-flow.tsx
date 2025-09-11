
"use client";

import { useState, useTransition, useEffect, useContext, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, Import, DatabaseZap, Save, CheckCircle2, XCircle, ShieldCheck, Undo, Braces, Trash2, Pencil, Copy, Check, BarChart } from 'lucide-react';
import { getSpreadsheetTitle, importToSheet, updateSheetStatus, getUpdatePreview, undoLastAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { TableDataContext, type TableData } from '@/store/table-data-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AlertCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateTime, type DateFormat } from '@/lib/date-utils';


const LOCAL_STORAGE_KEY_SHEET_URL = 'gsheetDashboardSheetUrl';
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1aWpDRyFyl6a8bV0-e1ddYVkcfDK5WA498OHMU2Wv9iU/edit?gid=0#gid=0';
const LOCAL_storage_key_template = 'jsonConverterHeaderTemplate';
const LOCAL_STORAGE_KEY_INPUT = 'jsonConverterInput';
const DEFAULT_TEMPLATE = 'Client Name,Customer Name,Status,Kolom kosong1,Ticket Category,Module,Detail Module,Created At,Title,Kolom kosong2,Resolved At,Ticket OP';


type UpdatePreview = {
    title: string;
    oldStatus: string;
    newStatus: string;
    oldTicketOp: string;
    newTicketOp: string;
};

type LastActionUndoData = {
    operationType: 'IMPORT' | 'UPDATE';
    [key: string]: any;
} | null;

export function ImportFlow() {
  const { tableData, setTableData, setIsProcessing: setGlobalProcessing } = useContext(TableDataContext);
  const [sheetUrl, setSheetUrl] = useState('');
  const [verifiedUrl, setVerifiedUrl] = useState('');
  const [updatePreview, setUpdatePreview] = useState<UpdatePreview[]>([]);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [lastActionUndoData, setLastActionUndoData] = useState<LastActionUndoData>(null);
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [templateInput, setTemplateInput] = useState(DEFAULT_TEMPLATE);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dateFormats, setDateFormats] = useState<Record<string, DateFormat>>({
    'Created At': 'report',
    'Resolved At': 'report',
  });
   const [isCopied, setIsCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [isImporting, startImporting] = useTransition();
  const [isUpdating, startUpdating] = useTransition();
  const [isPreviewing, startPreviewing] = useTransition();
  const [isUndoing, startUndoing] = useTransition();
  const [isAnalyzing, startAnalyzing] = useTransition();
  const [isConverting, startConverting] = useTransition();
  
  const isProcessing = isImporting || isUpdating || isPreviewing || isUndoing || isAnalyzing || isConverting;

  useEffect(() => {
    setGlobalProcessing(isProcessing);
  }, [isProcessing, setGlobalProcessing]);


  const { toast } = useToast();

  useEffect(() => {
    const savedUrl = localStorage.getItem(LOCAL_STORAGE_KEY_SHEET_URL);
    setSheetUrl(savedUrl || DEFAULT_SHEET_URL);
    const savedTemplate = localStorage.getItem(LOCAL_storage_key_template);
    setTemplateInput(savedTemplate || DEFAULT_TEMPLATE);
    const savedJson = localStorage.getItem(LOCAL_STORAGE_KEY_INPUT);
    if (savedJson) {
        setJsonInput(savedJson);
    }
  }, []);

  const handleAnalyzeSheet = useCallback(async () => {
    if (!sheetUrl) {
        toast({ variant: 'destructive', title: 'URL is missing', description: 'Please enter a Google Sheet URL to verify.' });
        return;
    }
    setSpreadsheetTitle(null);
    setAnalysisError(null);
    startAnalyzing(async () => {
        const result = await getSpreadsheetTitle(sheetUrl);
        if (result.error) {
            setAnalysisError(result.error);
            setVerifiedUrl('');
        } else if (result.title) {
            setSpreadsheetTitle(result.title);
            setVerifiedUrl(sheetUrl);
            setAnalysisError(null);
        }
    });
  }, [sheetUrl, toast]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setSheetUrl(newUrl);
    setLastActionUndoData(null);
    if (newUrl !== verifiedUrl) {
      setSpreadsheetTitle(null);
      setAnalysisError(null);
      setVerifiedUrl('');
    }
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
                description: "All statuses and ticket OPs are already up-to-date in the Google Sheet.",
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
                    {result.updatedRows.map((item: { title: string, newStatus: string, newTicketOp: string }, index: number) => (
                      <li key={index}>{item.title} {'→'} <strong>{item.newStatus} / {item.newTicketOp}</strong></li>
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
    if (!tableData || !sheetUrl) {
        toast({
            variant: "destructive",
            title: "Export Failed",
            description: "No data to export or sheet URL is missing.",
        });
        return;
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_URL, sheetUrl);

    startImporting(async () => {
        if (!tableData) return;
        const result = await importToSheet(tableData, sheetUrl);

        if (result.error) {
            toast({
                variant: "destructive",
                title: "Export Error",
                description: `Failed to export to sheet: ${result.error}`,
            });
            setLastActionUndoData(null);
        } else {
            toast({
                title: "Export Complete",
                description: (
                    <div>
                        {result.importedCount > 0 && <p>{result.importedCount} new rows exported successfully.</p>}
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
                        {(!result.importedCount && !result.duplicateCount) && <p>No new data to export.</p>}
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
        setLastActionUndoData(null);
      }
    });
  };

  const handleSaveUrlAsDefault = () => {
    if (!sheetUrl) {
        toast({ variant: "destructive", title: "Cannot Save", description: "Please enter a URL before saving it as default." });
        return;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_URL, sheetUrl);
    toast({ title: "URL Saved", description: "Google Sheet URL has been saved as your default." });
  };
  
  const handleStatusChange = (rowIndex: number, header: string, value: string) => {
    if (!tableData) return;
    const newRows = [...tableData.rows];
    newRows[rowIndex][header] = value;
    setTableData({ ...tableData, rows: newRows });
    setLastActionUndoData(null);
};
  
    const handleDateFormatChange = (header: string, format: string) => {
        if (format === 'origin' || format === 'jam' || format === 'report') {
            setDateFormats(prev => ({
                ...prev,
                'Created At': format as DateFormat,
                'Resolved At': format as DateFormat,
            }));
        }
    };

  const flattenJson = (obj: any, path: string = '', res: Record<string, any> = {}): Record<string, any> => {
      if (obj === null || typeof obj !== 'object') {
          if (path) res[path] = obj;
          return res;
      }
      if (Array.isArray(obj)) {
          if (path.endsWith('custom_fields')) {
              obj.forEach(field => {
                  if (field && typeof field.name === 'string' && field.value !== undefined) {
                      res[field.name] = field.value;
                  }
              });
          } else {
              if (path) res[path] = JSON.stringify(obj);
          }
          return res;
      }
      Object.keys(obj).forEach(key => {
          const newPath = path ? `${path}.${key}` : key;
          const value = obj[key];
          if (typeof value === 'object' && value !== null) {
              flattenJson(value, newPath, res);
          } else if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
               try {
                  const parsedJson = JSON.parse(value);
                  if (typeof parsedJson === 'object' && parsedJson !== null) {
                      Object.keys(parsedJson).forEach(innerKey => {
                           res[innerKey] = parsedJson[innerKey];
                      });
                  } else {
                     res[newPath] = value;
                  }
              } catch (e) {
                 res[newPath] = value;
              }
          }
          else {
              res[newPath] = value;
          }
      });
      return res;
  };

  const handleConvert = () => {
    startConverting(() => {
        setJsonError(null);
        setTableData(null);

        if (!jsonInput.trim()) {
            setJsonError("JSON input cannot be empty.");
            return;
        }

        try {
            let data = JSON.parse(jsonInput);
            if (!Array.isArray(data)) data = [data];
            if (data.length === 0) {
                setJsonError("JSON array is empty.");
                return;
            }

            const flattenedData = data.map((item: any) => flattenJson(item));
            const headers = templateInput.split(',').map(h => h.trim());
            
            let processedRows = flattenedData.map(flatRow => {
                const newRow: Record<string, any> = {};
                headers.forEach(header => {
                    if (header.toLowerCase().startsWith('kolom kosong')) {
                        newRow[header] = '';
                        return;
                    }
                    const matchingKey = Object.keys(flatRow).find(k => k.toLowerCase() === header.toLowerCase());
                    let value = matchingKey ? flatRow[matchingKey] : '';

                    if (header.toLowerCase() === 'status' && typeof value === 'string') {
                        const lowerCaseValue = value.toLowerCase();
                        switch (lowerCaseValue) {
                            case 'resolved': value = 'Solved'; break;
                            case 'open': value = 'L2'; break;
                            case 'pending': value = 'L1'; break;
                            case 'on hold': case 'on-hold': value = 'L3'; break;
                            default: break;
                        }
                    }
                    newRow[header] = value;
                });
                return newRow;
            });

            const extractTicketNumber = (title: string) => {
                if (typeof title !== 'string') return null;
                const match = title.match(/#(\d+)/);
                return match ? parseInt(match[1], 10) : null;
            };

            processedRows.sort((a, b) => {
                const numA = extractTicketNumber(a.Title);
                const numB = extractTicketNumber(b.Title);
                if (numA === null && numB === null) return 0;
                if (numA === null) return 1;
                if (numB === null) return -1;
                return numA - numB;
            });
            
            setTableData({ headers, rows: processedRows });
            localStorage.setItem(LOCAL_STORAGE_KEY_INPUT, jsonInput);
            toast({ title: "Conversion Successful", description: "Your JSON has been converted and sorted." });
        } catch (e) {
            setJsonError(e instanceof Error ? `Invalid JSON: ${e.message}` : "An unknown error occurred during conversion.");
        }
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
            setJsonInput(text);
        }
    };
    reader.onerror = () => setJsonError("Failed to read file.");
    reader.readAsText(file);
    event.target.value = '';
  };
  const handleImportClick = () => fileInputRef.current?.click();
  const handleDeleteInput = () => {
    setJsonInput('');
    setTableData(null);
    setJsonError(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY_INPUT);
    toast({ title: "Input Cleared", description: "JSON input has been cleared." });
  };
  const handleSaveTemplate = () => {
    localStorage.setItem(LOCAL_storage_key_template, templateInput);
    toast({ title: "Template Saved", description: "Header template has been saved." });
  };
  const isVerified = !!verifiedUrl && verifiedUrl === sheetUrl;

   const handleCopyToClipboard = () => {
        if (!tableData) return;

        const { headers, rows } = tableData;
        const tsv = [
            ...rows.map(row => headers.map(header => {
                let value = row[header];
                 if (header === 'Created At' || header === 'Resolved At') {
                    value = formatDateTime(value, dateFormats[header] || 'report');
                }
                if (value === null || value === undefined) return '';
                let stringValue = String(value);
                if (stringValue.includes('\t') || stringValue.includes('\n') || stringValue.includes('"')) {
                    stringValue = `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            }).join('\t'))
        ].join('\n');

        navigator.clipboard.writeText(tsv).then(() => {
            setIsCopied(true);
            toast({
                title: "Copied to clipboard!",
                description: "You can now paste the data into Google Sheets, Excel, or other spreadsheet software.",
            });
            setTimeout(() => setIsCopied(false), 2000);
        }, () => {
            toast({
                variant: "destructive",
                title: "Copy failed",
                description: "Could not copy data to clipboard. Please try again.",
            });
        });
    };
    
   const handleNavigateToReport = () => {
    if (!tableData) {
        toast({
            variant: "destructive",
            title: "Data Not Ready",
            description: "Please convert your JSON to a table before viewing the report.",
        });
        return;
    }
    router.push('/report-harian');
  };


  const JsonErrorAlert = ({ message }: { message: string }) => (
      <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
      </Alert>
  );

  return (
    <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Import Flow</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Satu alur kerja untuk mengonversi JSON, meninjaunya, dan mengekspornya ke Google Sheets.
          </p>
        </header>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>1. Provide and Convert JSON</CardTitle>
            <CardDescription>
              Tempel JSON atau impor file. Konversikan untuk melihat pratinjau tabel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="grid gap-2">
                    <Label htmlFor="json-input">JSON Input</Label>
                    <Textarea
                        id="json-input"
                        placeholder='[{"id": 1, "name": "John"}]'
                        value={jsonInput}
                        onChange={(e) => { setJsonInput(e.target.value); setTableData(null); setJsonError(null); }}
                        rows={8}
                        className="font-mono text-xs"
                        disabled={isProcessing}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={handleImportClick} variant="outline" size="sm" disabled={isProcessing}>
                            <Upload className="mr-2 h-4 w-4" /> Import JSON
                        </Button>
                        <Button onClick={handleDeleteInput} variant="destructive" size="sm" disabled={isProcessing}>
                            <Trash2 className="mr-2 h-4 w-4" /> Clear Input
                        </Button>
                    </div>
                    <Input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="application/json,.json" />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="template-input">"Convert To" Headers</Label>
                    <Textarea
                        id="template-input"
                        placeholder="e.g., id,name,email"
                        value={templateInput}
                        onChange={(e) => setTemplateInput(e.target.value)}
                        rows={4}
                        className="font-mono text-xs"
                        disabled={isProcessing}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={handleSaveTemplate} variant="outline" size="sm" disabled={isProcessing}>
                            <Save className="mr-2 h-4 w-4" /> Save Template
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mt-4">
                <Button onClick={handleConvert} size="sm" disabled={!jsonInput || isProcessing}>
                    {isConverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Braces className="mr-2 h-4 w-4" />}
                    {isConverting ? 'Converting...' : 'Convert to Table'}
                </Button>
            </div>
            {jsonError && <JsonErrorAlert message={jsonError} />}
          </CardContent>
        </Card>
        
        {tableData && (
          <>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>2. Set Destination and Export</CardTitle>
                <CardDescription>
                  Verifikasi URL Google Sheet Anda, lalu ekspor atau perbarui data.
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
                        disabled={isProcessing}
                      />
                       <Button onClick={handleSaveUrlAsDefault} variant="outline" size="sm" className="w-full sm:w-auto" disabled={isProcessing}>
                          <Save className="h-4 w-4 mr-2" /> Set as Default
                      </Button>
                    </div>
                     <div className='mt-2'>
                        <Button onClick={handleAnalyzeSheet} variant="outline" size="sm" disabled={isProcessing || isVerified}>
                            {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                            {isAnalyzing ? 'Verifying...' : 'Verify'}
                        </Button>
                     </div>
                    <div className="mt-1 h-5">
                      {isAnalyzing && <div className="flex items-center text-xs text-muted-foreground"><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /><span>Analyzing...</span></div>}
                      {spreadsheetTitle && <div className="flex items-center text-xs text-green-600 font-medium"><CheckCircle2 className="w-3 h-3 mr-1.5" /><span>{spreadsheetTitle}</span></div>}
                      {analysisError && <div className="flex items-center text-xs text-destructive font-medium"><XCircle className="w-3 h-3 mr-1.5" /><span>{analysisError}</span></div>}
                    </div>
                  </div>
                
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-4 border-t">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button size="sm" disabled={isProcessing || !isVerified}>
                           {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengekspor...</> : <><Upload className="mr-2 h-4 w-4" />Export to GSheet</>}
                         </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Konfirmasi Ekspor</AlertDialogTitle>
                          <AlertDialogDescription>
                            Apakah Anda yakin akan mengekspor {tableData.rows.length} baris ke sheet <span className="font-bold">{spreadsheetTitle || 'target'}</span>?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={handleImport} disabled={isImporting}>
                            {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengekspor...</> : "Ya, Lanjutkan Ekspor"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    <AlertDialog open={isUpdateConfirmOpen} onOpenChange={setIsUpdateConfirmOpen}>
                      <AlertDialogTrigger asChild>
                         <Button onClick={handleUpdatePreview} size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950" disabled={isProcessing || !isVerified}>
                            {isPreviewing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengecek...</> : <><DatabaseZap className="mr-2 h-4 w-4" />Update Status</>}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                           <AlertDialogTitle>Konfirmasi Pembaruan Status</AlertDialogTitle>
                           <div className="text-sm text-muted-foreground">
                                <p className='mb-2'>Apakah Anda yakin ingin memperbarui {updatePreview.length} kasus di sheet target?</p>
                                <div className="mt-2 text-xs max-h-48 overflow-y-auto border bg-muted/50 p-2 rounded-md space-y-1">
                                    <p className="font-bold">Detail Perubahan:</p>
                                    <ul className="list-disc pl-5">
                                        {updatePreview.map((item, index) => (
                                          <li key={index} className='text-foreground'>
                                            {item.title}:
                                            {item.oldStatus !== item.newStatus && <span> Status: <span className='line-through'>{item.oldStatus || 'Kosong'}</span> {'→'} <strong>{item.newStatus}</strong></span>}
                                            {item.oldTicketOp !== item.newTicketOp && <span> Ticket OP: <span className='line-through'>{item.oldTicketOp || 'Kosong'}</span> {'→'} <strong>{item.newTicketOp}</strong></span>}
                                          </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setUpdatePreview([])}>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={handleConfirmUpdate} disabled={isUpdating}>
                            {isUpdating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memperbarui...</> : "Ya, Lanjutkan Update"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button onClick={handleUndo} size="sm" variant="destructive" disabled={!lastActionUndoData || isProcessing || !isVerified}>
                        {isUndoing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Membatalkan...</> : <><Undo className="mr-2 h-4 w-4" />Undo Last Action</>}
                    </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg mt-6">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div>
                            <CardTitle>3. Data Preview</CardTitle>
                            <CardDescription>
                                Ini adalah pratinjau data yang akan diekspor. Anda dapat mengubah status di sini sebelum mengekspor.
                            </CardDescription>
                        </div>
                         <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <Button onClick={handleCopyToClipboard} variant="outline" size="sm" className="w-full sm:w-auto" disabled={isProcessing}>
                                {isCopied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                                {isCopied ? 'Copied!' : 'Copy for Sheets/Excel'}
                            </Button>
                             <Button onClick={handleNavigateToReport} size="sm" className="w-full sm:w-auto bg-pink-500 hover:bg-pink-600 text-white" disabled={isProcessing || !tableData}>
                                <BarChart className="mr-2 h-4 w-4" />
                                Report Harian
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto rounded-md border max-h-[500px]">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-card">
                                <TableRow>
                                    {tableData.headers.map((header, index) => (
                                        <TableHead key={`${header}-${index}`} className="font-bold bg-muted/50 whitespace-nowrap">
                                            {(header === 'Created At' || header === 'Resolved At') ? (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="pl-0 text-xs text-left font-bold" disabled={isProcessing}>
                                                            <span className="flex items-center gap-1">
                                                                {header}
                                                                <Pencil className="h-3 w-3 text-muted-foreground" />
                                                            </span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuLabel>Date Format</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuRadioGroup value={dateFormats[header] || 'report'} onValueChange={(value) => handleDateFormatChange(header, value)}>
                                                            <DropdownMenuRadioItem value="origin">Origin</DropdownMenuRadioItem>
                                                            <DropdownMenuRadioItem value="jam">Time</DropdownMenuRadioItem>
                                                            <DropdownMenuRadioItem value="report">Report</DropdownMenuRadioItem>
                                                        </DropdownMenuRadioGroup>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            ) : header}
                                        </TableHead>
                                    ))}
                                 </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tableData.rows.map((row, rowIndex) => (
                                    <TableRow key={rowIndex} className="hover:bg-muted/50">
                                        {tableData.headers.map((header, headerIndex) => (
                                            <TableCell key={`${header}-${headerIndex}-${rowIndex}`} className="text-xs">
                                               {header === 'Status' ? (
                                                    <Select value={String(row[header] ?? '')} onValueChange={(newStatus) => handleStatusChange(rowIndex, header, newStatus)} disabled={isProcessing}>
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
                                                ) : header === 'Ticket OP' ? (
                                                    <Input
                                                        type="text"
                                                        value={row[header] || ''}
                                                        onChange={(e) => handleStatusChange(rowIndex, header, e.target.value)}
                                                        className="w-[120px] h-8 text-xs"
                                                        disabled={isProcessing}
                                                    />
                                                ) : (header === 'Created At' || header === 'Resolved At') ? (
                                                    formatDateTime(row[header], dateFormats[header] || 'report')
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
                    <p className="text-sm text-muted-foreground">Showing {tableData.rows.length} rows.</p>
                </CardFooter>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

    