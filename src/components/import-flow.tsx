
"use client";

import { useState, useTransition, useEffect, useContext, useCallback, useRef, MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Upload, Import, DatabaseZap, Save, CheckCircle2, XCircle, ShieldCheck, Undo, Braces, Trash2, Pencil, Copy, Check, BarChart, FileCog, RefreshCw } from 'lucide-react';
import { getSpreadsheetTitle, importToSheet, updateSheetStatus, getUpdatePreview, undoLastAction, fetchL3ReportData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { TableDataContext, type TableData, type L3ReportData } from '@/store/table-data-context';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateTime, type DateFormat } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { Spinner } from './ui/spinner';


const LOCAL_STORAGE_KEY_SHEET_URL = 'gsheetDashboardSheetUrl';
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1aWpDRyFyl6a8bV0-e1ddYVkcfDK5WA498OHMU2Wv9iU/edit?gid=0#gid=0';
const LOCAL_STORAGE_KEY_TEMPLATE = 'jsonConverterHeaderTemplate';
const DEFAULT_TEMPLATE = 'Client Name,Customer Name,Status,TICKET NUMBER,Ticket Category,Module,Detail Module,Created At,Title,Kolom kosong2,Resolved At,Ticket OP';
const LOCAL_STORAGE_KEY_INPUT = 'jsonConverterInput';


type UpdatePreview = {
    title: string;
    oldStatus: string;
    newStatus: string;
    oldTicketOp: string;
    newTicketOp: string;
    oldCheckout: string;
    newCheckout: string;
};

type LastActionUndoData = {
    operationType: 'IMPORT' | 'UPDATE';
    [key: string]: any;
} | null;

declare const XLSX: any;

export function ImportFlow() {
  const { 
    tableData, setTableData, 
    isProcessing, setIsProcessing: setGlobalProcessing, 
    l3ReportData, setL3ReportData,
    sheetUrl, setSheetUrl,
    verifiedUrl, setVerifiedUrl,
    spreadsheetTitle, setSpreadsheetTitle
  } = useContext(TableDataContext);
  const { toast } = useToast();

  const [updatePreview, setUpdatePreview] = useState<UpdatePreview[]>([]);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [lastActionUndoData, setLastActionUndoData] = useState<LastActionUndoData | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [templateInput, setTemplateInput] = useState(DEFAULT_TEMPLATE);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dateFormats, setDateFormats] = useState<Record<string, DateFormat>>({
    'Created At': 'jam',
    'Resolved At': 'jam',
  });
   const [isCopied, setIsCopied] = useState(false);

  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const destinationCardRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const router = useRouter();
  const [isImporting, startImporting] = useTransition();
  const [isUpdating, startUpdating] = useTransition();
  const [isPreviewing, startPreviewing] = useTransition();
  const [isUndoing, startUndoing] = useTransition();
  const [isAnalyzing, startAnalyzing] = useTransition();
  const [isConverting, startConverting] = useTransition();
  
  const isAnyProcessing = isImporting || isUpdating || isPreviewing || isUndoing || isAnalyzing || isConverting;

  useEffect(() => {
    setGlobalProcessing(isAnyProcessing);
  }, [isAnyProcessing, setGlobalProcessing]);


  useEffect(() => {
    const savedUrl = localStorage.getItem(LOCAL_STORAGE_KEY_SHEET_URL);
    if (!sheetUrl) { // Only set from localStorage if context is empty
        setSheetUrl(savedUrl || DEFAULT_SHEET_URL);
    }
    const savedTemplate = localStorage.getItem(LOCAL_STORAGE_KEY_TEMPLATE);
    setTemplateInput(savedTemplate || DEFAULT_TEMPLATE);
    const savedJson = localStorage.getItem(LOCAL_STORAGE_KEY_INPUT);
    if (savedJson) {
        setJsonInput(savedJson);
    }
  }, []);

  // Effect for auto-scrolling
  useEffect(() => {
    if (tableData && destinationCardRef.current && !hasScrolledRef.current) {
        destinationCardRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
        hasScrolledRef.current = true;
    }
  }, [tableData]);


  const handleAnalyzeSheet = useCallback(async () => {
    if (!sheetUrl) {
        toast({ variant: 'destructive', title: 'URL is missing', description: 'Please enter a Google Sheet URL to verify.' });
        return;
    }
    setSpreadsheetTitle(null);
    setAnalysisError(null);
    if (!l3ReportData) { // Avoid re-fetching if already present
      setL3ReportData(null);
    }
    startAnalyzing(async () => {
        const [titleResult, l3Result] = await Promise.all([
            getSpreadsheetTitle(sheetUrl),
            // Only fetch L3 data if it's not already in context
            l3ReportData ? Promise.resolve({ success: true, report: l3ReportData.report }) : fetchL3ReportData(sheetUrl)
        ]);

        if (titleResult.error) {
            setAnalysisError(titleResult.error);
            setVerifiedUrl('');
        } else if (titleResult.title) {
            setSpreadsheetTitle(titleResult.title);
            setVerifiedUrl(sheetUrl);
            setAnalysisError(null);
        }

        if (l3Result.error) {
            toast({
                variant: 'destructive',
                title: 'L3 Report Failed',
                description: l3Result.error,
            });
            setL3ReportData({ error: l3Result.error });
        } else if (l3Result.success) {
            setL3ReportData({ report: l3Result.report });
        }
    });
}, [sheetUrl, toast, setSpreadsheetTitle, setVerifiedUrl, setL3ReportData, l3ReportData]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setSheetUrl(newUrl);
    setLastActionUndoData(null);
    if (newUrl !== verifiedUrl) {
      setSpreadsheetTitle(null);
      setAnalysisError(null);
      setVerifiedUrl('');
      setL3ReportData(null); // Clear L3 report if URL changes
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
            setUpdatePreview([]);
            setIsUpdateConfirmOpen(false);
            return;
        }

        if (result.changes && result.changes.length > 0) {
            setUpdatePreview(result.changes);
            setIsUpdateConfirmOpen(true);
        } else {
            toast({
                title: (
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Everything is Up-to-Date
                    </div>
                ),
                description: "No changes were detected between your data and the Google Sheet.",
            });
            setUpdatePreview([]);
            setIsUpdateConfirmOpen(false);
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
        if (result.updatedRows && result.updatedRows.length > 0) {
            toast({
              title: "Update Successful",
              description: (
                <div>
                  <p className="mb-2">{result.message}</p>
                  <div className="mt-2 text-xs">
                    <p className="font-bold">Updated Cases:</p>
                    <ul className="list-disc pl-5 max-h-40 overflow-y-auto">
                      {result.updatedRows.map((item: { title: string, newStatus: string, newTicketOp: string }, index: number) => (
                        <li key={index}>{item.title} {'→'} <strong>{item.newStatus} / {item.newTicketOp}</strong></li>
                      ))}
                    </ul>
                  </div>
                </div>
              ),
            });
            setLastActionUndoData({ operationType: 'UPDATE', updatedRows: result.updatedRows });
        } else {
            toast({
                title: "Everything is Up-to-Date",
                description: "No changes were detected, so no updates were made.",
            });
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
    
  const toTitleCase = (str: string) => {
      if (str.toUpperCase() === 'TICKET OP') return 'Ticket OP';
      return str.replace(
          /\w\S*/g,
          (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
      );
  };

  const parseCsvToJson = (csv: string): Record<string, any>[] => {
    const lines = csv.trim().split(/\r\n|\n/);
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    const headerCounts: Record<string, number> = {};
    const uniqueHeaders = headerLine.split(',').map(h => {
        const cleanedHeader = h.trim().replace(/^"|"$/g, '');
        if (headerCounts[cleanedHeader]) {
            headerCounts[cleanedHeader]++;
            return `${cleanedHeader}_${headerCounts[cleanedHeader] - 1}`;
        } else {
            headerCounts[cleanedHeader] = 1;
            return cleanedHeader;
        }
    });

    const jsonResult = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const entry: Record<string, string> = {};
        for (let j = 0; j < uniqueHeaders.length; j++) {
            entry[uniqueHeaders[j]] = (values[j] || '').trim().replace(/^"|"$/g, '');
        }
        jsonResult.push(entry);
    }
    return jsonResult;
  };


    const processAndSetTableData = (data: any[], isCsv: boolean = false) => {
        if (!Array.isArray(data)) data = [data];
        if (data.length === 0) {
            setJsonError("Input data is empty.");
            return;
        }

        let processedData = data;
        if (isCsv) {
             const csvHeaderMapping: Record<string, string> = {
                'Issue Type': 'Ticket Category',
                'Issue key': 'Title',
                'Summary': 'Title',
                'Custom field (Client Name)': 'Client Name',
                'Custom field (Client Name)_1': 'Client Name',
                'Custom field (Client Name)_2': 'Client Name',
                'Custom field (Client Name)_3': 'Client Name',
                'Custom field (Customer Name)': 'Customer Name',
                'Custom field (Customer Name)_1': 'Customer Name',
                'Client Name': 'Client Name',
                'Customer Name': 'Customer Name',
                'Status': 'Status',
                'Custom field (Module)': 'Module',
                'Custom field (Detail Module)': 'Detail Module',
                'Custom field (Detail Module)_1': 'Detail Module',
                'Custom field (Detail Module)_2': 'Detail Module',
                'Created': 'Created At',
                'Resolved': 'Resolved At',
                'Resolve': 'Resolved At',
            };

            processedData = data.map(row => {
                const newRow: Record<string, any> = {};
                for (const originalKey in row) {
                    const cleanOriginalKey = originalKey.trim().replace(/^"|"$/g, '');
                    const mappedKey = csvHeaderMapping[cleanOriginalKey];
                    if (mappedKey) {
                        if (mappedKey === 'Title') {
                             if (!newRow[mappedKey]) newRow[mappedKey] = '';
                             newRow[mappedKey] += `${row[originalKey] || ''} `;
                        } else if (!newRow[mappedKey]) { // Only assign if target is empty to prioritize first match
                           newRow[mappedKey] = row[originalKey];
                        }
                    } else if (row.hasOwnProperty(originalKey)) { // Handle keys not in mapping
                        newRow[cleanOriginalKey] = row[originalKey];
                    }
                }
                 if (newRow.Title) {
                    newRow.Title = newRow.Title.trim();
                }
                return newRow;
            });
        }
        
        const flattenedData = processedData.map((item: any) => flattenJson(item));
        const headers = templateInput.split(',').map(h => {
            const trimmed = h.trim();
            return toTitleCase(trimmed);
        });
        
        let processedRows = flattenedData.map(flatRow => {
            const newRow: Record<string, any> = {};
            headers.forEach(header => {
                if (header.toLowerCase().startsWith('kolom kosong')) {
                    newRow[header] = '';
                    return;
                }

                const matchingKey = Object.keys(flatRow).find(k => k.toLowerCase() === header.toLowerCase());
                
                let value = matchingKey ? flatRow[matchingKey] : '';

                if (header.toLowerCase() === 'status') {
                    const lowerCaseValue = String(value).toLowerCase();
                    switch (lowerCaseValue) {
                        case 'resolve':
                        case 'resolved': value = 'Solved'; break;
                        case 'open': value = 'L2'; break;
                        case 'pending': value = 'L1'; break;
                        case 'on hold': case 'on-hold': value = 'L3'; break;
                        case 'new': value = 'L1'; break;
                        case 'in progress l1': value = 'L1'; break;
                        case 'in progress l2': value = 'L2'; break;
                        case 'in progress l3': value = 'L3'; break;
                        case 'client review l1': value = 'L1'; break;
                        case 'l3 (on progress)': value = 'L3'; break;
                        case 'l3 need release': value = 'L3'; break;
                        case 'l3 review': value = 'L3'; break;
                        default: break;
                    }
                    if (!value) {
                        value = 'L1';
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
            const dateA = new Date(a['Created At']);
            const dateB = new Date(b['Created At']);
            
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
            }

            const numA = extractTicketNumber(a.Title);
            const numB = extractTicketNumber(b.Title);
            if (numA === null && numB === null) return 0;
            if (numA === null) return 1;
            if (numB === null) return -1;
            return numA - numB;
        });
        
        setTableData({ headers, rows: processedRows });
        toast({ title: "Conversion Successful", description: "Your data has been converted and sorted." });
    };

    const handleConvert = (input: string, format: 'json' | 'csv') => {
        startConverting(() => {
            setJsonError(null);
            setTableData(null);
            hasScrolledRef.current = false; // Reset scroll flag

            if (!input.trim()) {
                setJsonError("Input cannot be empty.");
                return;
            }

            try {
                let data: any[];
                if (format === 'json') {
                    data = JSON.parse(input);
                } else { // csv
                    data = parseCsvToJson(input);
                }
                processAndSetTableData(data, format === 'csv');
                
                setJsonInput(input); // Store the raw input for reference
                localStorage.setItem(LOCAL_STORAGE_KEY_INPUT, input);

            } catch (e) {
                setJsonError(e instanceof Error ? `Invalid ${format.toUpperCase()} format: ${e.message}` : "An unknown error occurred during conversion.");
            }
        });
    };
    
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, format: 'json' | 'csv') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
            handleConvert(text, format);
        }
    };
    reader.onerror = () => setJsonError("Failed to read file.");
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  const handleJsonImportClick = () => jsonFileInputRef.current?.click();
  const handleCsvImportClick = () => csvFileInputRef.current?.click();

  const handleDeleteInput = () => {
    setJsonInput('');
    setTableData(null);
    setJsonError(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY_INPUT);
    toast({ title: "Input Cleared", description: "JSON or CSV input has been cleared." });
  };
  const handleSaveTemplate = () => {
    localStorage.setItem(LOCAL_STORAGE_KEY_TEMPLATE, templateInput);
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
            <CardTitle>1. Convert JSON / CSV</CardTitle>
            <CardDescription>
              Impor file JSON atau CSV, atau tempel kontennya. Data akan dikonversi secara otomatis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="grid gap-2">
                    <Label htmlFor="json-input">Paste Content (JSON or CSV)</Label>
                    <Textarea
                        id="json-input"
                        placeholder='Paste your JSON or CSV data here, e.g., [{"id": 1, "name": "John"}]'
                        value={jsonInput}
                        onChange={(e) => { setJsonInput(e.target.value); setTableData(null); setJsonError(null); }}
                        rows={8}
                        className="font-mono text-xs"
                        disabled={isProcessing || !!tableData}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => handleConvert(jsonInput, jsonInput.trim().startsWith('[') || jsonInput.trim().startsWith('{') ? 'json' : 'csv')} size="sm" disabled={!jsonInput || isProcessing || !!tableData}>
                            <Braces className="mr-2 h-4 w-4" /> Convert
                        </Button>
                        <Button onClick={handleDeleteInput} variant="destructive" size="sm" disabled={isProcessing}>
                            <Trash2 className="mr-2 h-4 w-4" /> Clear Input
                        </Button>
                    </div>
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
                        disabled={isProcessing || !!tableData}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={handleSaveTemplate} variant="outline" size="sm" disabled={isProcessing || !!tableData}>
                            <Save className="mr-2 h-4 w-4" /> Save Template
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={handleJsonImportClick} variant="outline" size="sm" disabled={isProcessing || !!tableData}>
                    <Upload className="mr-2 h-4 w-4" /> Import Json
                </Button>
                <Button onClick={handleCsvImportClick} variant="outline" size="sm" disabled={isProcessing || !!tableData}>
                    <Upload className="mr-2 h-4 w-4" /> Import CSV
                </Button>
            </div>

            <Input type="file" ref={jsonFileInputRef} onChange={(e) => handleFileChange(e, 'json')} className="hidden" accept=".json" />
            <Input type="file" ref={csvFileInputRef} onChange={(e) => handleFileChange(e, 'csv')} className="hidden" accept=".csv" />
            
            {jsonError && <JsonErrorAlert message={jsonError} />}
          </CardContent>
        </Card>
        
        {tableData && (
          <>
            <Card className="shadow-lg" ref={destinationCardRef}>
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
                        {isVerified ? (
                            <Button size="sm" disabled className="bg-green-600 hover:bg-green-600 text-white">
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Verified
                            </Button>
                        ) : (
                            <Button
                              onClick={handleAnalyzeSheet}
                              variant={isVerified ? 'secondary' : 'default'}
                              size="sm"
                              className={!isVerified ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}
                              disabled={isProcessing || !sheetUrl}
                            >
                                {isAnalyzing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                                {isAnalyzing ? 'Verifying...' : 'Verify'}
                            </Button>
                        )}
                     </div>
                    <div className="mt-1 h-5">
                      {isAnalyzing && <div className="flex items-center text-xs text-muted-foreground"><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /><span>Analyzing...</span></div>}
                      {spreadsheetTitle && <div className="flex items-center text-xs text-green-600 font-medium"><CheckCircle2 className="w-3 h-3 mr-1.5" /><span>{spreadsheetTitle}</span></div>}
                      {analysisError && <div className="flex items-center text-xs text-destructive font-medium"><XCircle className="w-3 h-3 mr-1.5" /><span>{analysisError}</span></div>}
                    </div>
                  </div>
                
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-4 border-t">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button size="sm" disabled={isProcessing || !isVerified}>
                           {isImporting ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Mengekspor...</> : <><Upload className="mr-2 h-4 w-4" />Export to GSheet</>}
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
                            {isImporting ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Mengekspor...</> : "Ya, Lanjutkan Ekspor"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    <AlertDialog open={isUpdateConfirmOpen} onOpenChange={setIsUpdateConfirmOpen}>
                        <Button onClick={handleUpdatePreview} size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950" disabled={isProcessing || !isVerified}>
                            {isPreviewing ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Mengecek...</> : <><DatabaseZap className="mr-2 h-4 w-4" />Update Status</>}
                        </Button>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                           <AlertDialogTitle>Konfirmasi Pembaruan Status</AlertDialogTitle>
                           <div className="text-sm text-muted-foreground">
                                {isPreviewing ? (
                                    <div className="flex items-center justify-center p-8">
                                        <RefreshCw className="mr-2 h-6 w-6 animate-spin" />
                                        <span>Mencari perubahan...</span>
                                    </div>
                                ) : (
                                    <>
                                        <p className='mb-2'>Apakah Anda yakin ingin memperbarui {updatePreview.length} kasus di sheet target?</p>
                                        <div className="mt-2 text-xs max-h-48 overflow-y-auto border bg-muted/50 p-2 rounded-md space-y-1">
                                            <p className="font-bold">Detail Perubahan:</p>
                                            <ul className="list-disc pl-5">
                                                {updatePreview.map((item, index) => (
                                                  <li key={index} className='text-foreground'>
                                                    {item.title}:
                                                    {item.oldStatus !== item.newStatus && <span> Status: <span className='line-through'>{item.oldStatus || 'Kosong'}</span> {'→'} <strong>{item.newStatus}</strong></span>}
                                                    {item.oldTicketOp !== item.newTicketOp && <span>, Ticket Op: <span className='line-through'>{item.oldTicketOp || 'Kosong'}</span> {'→'} <strong>{item.newTicketOp}</strong></span>}
                                                    {item.newStatus === 'Solved' && item.oldCheckout !== item.newCheckout && <span>, Check Out: <strong>{formatDateTime(item.newCheckout, 'jam')}</strong></span>}
                                                  </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </>
                                )}
                            </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setUpdatePreview([])}>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={handleConfirmUpdate} disabled={isUpdating || isPreviewing || updatePreview.length === 0}>
                            {isUpdating ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Memperbarui...</> : "Ya, Lanjutkan Update"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button onClick={handleUndo} size="sm" variant="destructive" disabled={!lastActionUndoData || isProcessing || !isVerified}>
                        {isUndoing ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Membatalkan...</> : <><Undo className="mr-2 h-4 w-4" />Undo Last Action</>}
                    </Button>
                </div>
              </CardContent>
            </Card>

            <PreviewTable
                initialData={tableData}
                dateFormats={dateFormats}
                isProcessing={isProcessing}
                onUndoDataChange={setLastActionUndoData}
                handleDateFormatChange={handleDateFormatChange}
                handleCopyToClipboard={handleCopyToClipboard}
                isCopied={isCopied}
                handleNavigateToReport={handleNavigateToReport}
            />
          </>
        )}
      </div>
    </div>
  );
}


function PreviewTable({
    initialData,
    dateFormats,
    isProcessing,
    onUndoDataChange,
    handleDateFormatChange,
    handleCopyToClipboard,
    isCopied,
    handleNavigateToReport,
} : {
    initialData: TableData;
    dateFormats: Record<string, DateFormat>;
    isProcessing: boolean;
    onUndoDataChange: (data: LastActionUndoData) => void;
    handleDateFormatChange: (header: string, format: string) => void;
    handleCopyToClipboard: () => void;
    isCopied: boolean;
    handleNavigateToReport: () => void;
}) {
    const { setTableData } = useContext(TableDataContext);
    const [localTableData, setLocalTableData] = useState<TableData>(initialData);

    const initialColumnWidths = useCallback(() => {
        const widths: Record<string, number> = {};
        initialData.headers.forEach(header => {
            const lowerHeader = header.toLowerCase();
            if (lowerHeader === 'title') widths[header] = 384;
            else if (lowerHeader.includes('customer name')) widths[header] = 180;
            else if (lowerHeader.includes('client name')) widths[header] = 160;
            else if (lowerHeader.includes('ticket number')) widths[header] = 150;
            else if (lowerHeader.includes('ticket category')) widths[header] = 150;
            else if (lowerHeader.includes('kolom kosong')) widths[header] = 150;
            else if (lowerHeader === 'status' || lowerHeader === 'ticket op') widths[header] = 100;
            else widths[header] = 128;
        });
        return widths;
    }, [initialData.headers]);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(initialColumnWidths);

    const isResizing = useRef<string | null>(null);
    const startX = useRef(0);
    const startWidth = useRef(0);
    
    useEffect(() => {
        setLocalTableData(initialData);
        setColumnWidths(initialColumnWidths());
    }, [initialData, initialColumnWidths]);


    const handleResizeMouseDown = (header: string, e: MouseEvent) => {
        isResizing.current = header;
        startX.current = e.clientX;
        startWidth.current = columnWidths[header];
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleResizeMouseMove);
        window.addEventListener('mouseup', handleResizeMouseUp);
    };

    const handleResizeMouseMove = useCallback((e: globalThis.MouseEvent) => {
        if (!isResizing.current) return;
        const currentWidth = startWidth.current + e.clientX - startX.current;
        setColumnWidths(prev => ({
            ...prev,
            [isResizing.current as string]: Math.max(40, currentWidth) // Minimum width 40px
        }));
    }, []);

    const handleResizeMouseUp = useCallback(() => {
        isResizing.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleResizeMouseMove);
        window.removeEventListener('mouseup', handleResizeMouseUp);
    }, [handleResizeMouseMove]);

    const handleStatusChange = (rowIndex: number, header: string, value: string) => {
        const newRows = [...localTableData.rows];
        newRows[rowIndex] = { ...newRows[rowIndex], [header]: value };
        const newTableData = { ...localTableData, rows: newRows };
        
        setLocalTableData(newTableData);
        setTableData(newTableData);
        onUndoDataChange(null);
    };

    return (
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
                         <Button onClick={handleNavigateToReport} size="sm" className="w-full sm:w-auto bg-pink-500 hover:bg-pink-600 text-white" disabled={isProcessing || !localTableData}>
                            <BarChart className="mr-2 h-4 w-4" />
                            Report Harian
                        </Button>
                    </div>
                </div>
            </CardHeader>
             <CardContent>
                <div className="overflow-auto w-full h-[500px] border rounded-md">
                    <table className="w-full" style={{ tableLayout: 'fixed', width: `${Object.values(columnWidths).reduce((a, b) => a + b, 64)}px` }}>
                        <thead className="sticky top-0 z-20 bg-muted">
                            <tr className="border-b transition-colors hover:bg-muted/50">
                                <th
                                    className="h-12 px-4 text-center align-middle font-medium text-muted-foreground whitespace-nowrap p-2 border-r sticky left-0 bg-muted z-10"
                                    style={{ width: '64px', minWidth: '64px' }}
                                >
                                    No
                                </th>
                                {localTableData.headers.map((header, index) => (
                                    <th 
                                      key={`header-${header}-${index}`}
                                      className="h-12 px-4 text-center align-middle font-medium text-muted-foreground whitespace-nowrap p-2 border-r relative"
                                      style={{ width: columnWidths[header] || 128, minWidth: columnWidths[header] || 128 }}
                                    >
                                        {(header === 'Created At' || header === 'Resolved At') ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="p-0 h-auto text-sm font-medium text-muted-foreground hover:bg-transparent" disabled={isProcessing}>
                                                        <span className="flex items-center justify-center gap-1 w-full">
                                                            {header}
                                                            <Pencil className="h-3 w-3" />
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
                                        ) : <span className="truncate block w-full">{header}</span>}
                                        <div
                                            onMouseDown={(e: MouseEvent) => handleResizeMouseDown(header, e)}
                                            className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-10"
                                        />
                                    </th>
                                ))}
                             </tr>
                        </thead>
                         <tbody>
                            {localTableData.rows.map((row, rowIndex) => (
                                <tr key={rowIndex} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <td
                                        className="align-middle p-1 border-r text-sm text-muted-foreground text-center sticky left-0 bg-background z-10"
                                        style={{ width: '64px', minWidth: '64px' }}
                                    >
                                        {rowIndex + 1}
                                    </td>
                                    {localTableData.headers.map((header, headerIndex) => (
                                        <td 
                                            key={`cell-${header}-${headerIndex}-${rowIndex}`}
                                            className="align-middle p-1 border-r"
                                            style={{ width: columnWidths[header] || 128, minWidth: columnWidths[header] || 128 }}
                                        >
                                           {header === 'Status' ? (
                                                <Select value={String(row[header] ?? '')} onValueChange={(newStatus) => handleStatusChange(rowIndex, header, newStatus)} disabled={isProcessing}>
                                                    <SelectTrigger className="w-full h-8 text-xs">
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
                                                    className="w-full h-8 text-xs"
                                                    disabled={isProcessing}
                                                />
                                            ) : (header === 'Created At' || header === 'Resolved At') ? (
                                                <span className="truncate block px-2">{formatDateTime(row[header], dateFormats[header] || 'report')}</span>
                                            ) : (
                                                <span className="truncate block px-2">{String(row[header] || '')}</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
            <CardFooter className="pt-4">
                <p className="text-sm text-muted-foreground">Showing {localTableData.rows.length} rows.</p>
            </CardFooter>
        </Card>
    );
}
    

    

    

    




    

    

    

    

    

    




    
