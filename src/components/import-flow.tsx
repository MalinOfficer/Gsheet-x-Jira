"use client";

import { useState, useTransition, useEffect, useContext, useCallback, useRef, MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Upload, Import, Database, Save, CheckCircle2, XCircle, ShieldCheck, Undo, Braces, Trash2, Pencil, Copy, Check, BarChart, RefreshCw, AlertCircle } from 'lucide-react';
import { importOrUpdateCases, updateCaseStatus, previewImportCases } from '@/app/supabase-actions-import';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { SettingsContext } from '@/contexts/settings-provider';
import { TableDataContext } from '@/store/table-data-context';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateTime, type DateFormat } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { Spinner } from './ui/spinner';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { normalizeClientName } from '@/lib/db-mapper';


const DEFAULT_TEMPLATE = 'Client Name,Customer Name,Status,Ticket Number,Title,Ticket Category,Module,Detail Module,Created At,Kolom kosong2,Resolved At,Ticket OP';
const LOCAL_STORAGE_KEY_INPUT = 'jsonConverterInput';

declare const XLSX: any;

// ✅ Fix: Explicit type untuk tableData agar tidak bergantung pada typeof Context
type TableDataShape = { headers: string[]; rows: Record<string, any>[] } | null;

function ResultList({ items, title }: { items?: { ticket_number?: string, title?: string, reason?: string }[], title?: string }) {
    if (!items || items.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            {title && <p className="text-sm text-muted-foreground">{title}</p>}
            <div className="max-h-48 w-full overflow-y-auto rounded-md border bg-muted/30 p-2">
                <ul className="space-y-1">
                    {items.map((item, index) => (
                        <li key={index} className="text-xs p-1.5 bg-background rounded-md shadow-sm">
                            <span className="font-semibold">{item.ticket_number || item.title || "No Title"}</span>
                            {item.ticket_number && item.title && <span className="text-muted-foreground ml-2">{item.title}</span>}
                             {item.reason && <span className="text-destructive ml-2 text-[10px]">({item.reason})</span>}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

function ConflictItem({ item, onUpdateSuccess }: { item: any, onUpdateSuccess: (ticketNumber: string) => void }) {
  const [isUpdating, startUpdating] = useTransition();
  const { toast } = useToast();

  const handleUpdate = () => {
    startUpdating(async () => {
      const result = await updateCaseStatus(item.ticket_number, item.new_status);
      if (result.success) {
        toast({ title: "Status Updated", description: `Ticket ${item.ticket_number} updated to ${item.new_status}`});
        onUpdateSuccess(item.ticket_number);
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.error });
      }
    });
  }

  return (
    <li className="text-xs p-1.5 bg-amber-100/50 dark:bg-amber-900/20 rounded-md flex justify-between items-center gap-2">
      <div className="flex-grow overflow-hidden">
        <span className="font-semibold">{item.ticket_number}</span>
        <span className="text-muted-foreground ml-2 truncate">{item.title}</span>
        <div className="text-muted-foreground ml-2 text-[10px] mt-0.5">
          Status: <span className="font-semibold line-through">{item.old_status}</span> → <span className="font-semibold text-amber-600">{item.new_status}</span>
        </div>
      </div>
      <Button 
        size="sm"
        onClick={handleUpdate}
        disabled={isUpdating}
        className="bg-amber-400 hover:bg-amber-500 text-amber-900 h-7 px-2 flex-shrink-0"
      >
        {isUpdating ? <RefreshCw className="h-3 w-3 animate-spin"/> : 'Update Status'}
      </Button>
    </li>
  );
}

export function ImportFlow() {
  const { tableData, setTableData, isProcessing, setIsProcessing } = useContext(TableDataContext);
  const { toast } = useToast();

  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dateFormats, setDateFormats] = useState<Record<string, DateFormat>>({
    'Created At': 'jam',
    'Resolved At': 'jam',
  });
  const [isCopied, setIsCopied] = useState(false);
  const [importResult, setImportResult] = useState<{
      inserted: any[];
      skipped: any[];
      conflicts: any[];
  } | null>(null);
  const [isResultDialogOpen, setIsResultDialogOpen] = useState(false);

  // ── Preview / Confirm Import state ──────────────────────────────────────
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{
      newCount: number;
      duplicates: { ticket_number: string; title?: string }[];
  } | null>(null);
  const [isFetchingPreview, startFetchingPreview] = useTransition();
  // ────────────────────────────────────────────────────────────────────────

  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [isConverting, startConverting] = useTransition();
  const [isImportingToDb, startImportingToDb] = useTransition();
  
  const isAnyProcessing = isConverting || isImportingToDb || isFetchingPreview;

  // States for result dialog
  const [activeConflicts, setActiveConflicts] = useState<any[]>([]);
  const [newlyInserted, setNewlyInserted] = useState<any[]>([]);
  const [updatedItems, setUpdatedItems] = useState<any[]>([]);
  const [isUpdatingAll, startUpdatingAll] = useTransition();

  useEffect(() => {
      if (importResult) {
          setActiveConflicts(importResult.conflicts);
          setNewlyInserted(importResult.inserted);
          setUpdatedItems([]);
      }
  }, [importResult]);

  const handleUpdateSuccess = (ticketNumber: string) => {
      const item = activeConflicts.find(c => c.ticket_number === ticketNumber);
      if (item) {
          setActiveConflicts(prev => prev.filter(c => c.ticket_number !== ticketNumber));
          setUpdatedItems(prev => [...prev, item]);
      }
  };

  const handleUpdateAll = () => {
      if (activeConflicts.length === 0) return;

      startUpdatingAll(async () => {
          const updatePromises = activeConflicts.map(item =>
              updateCaseStatus(item.ticket_number, item.new_status).then(result => ({ ...item, ...result }))
          );

          const results = await Promise.all(updatePromises);
          
          const successfulUpdates = results.filter(r => r.success);
          const failedUpdates = results.filter(r => !r.success);
          
          if (successfulUpdates.length > 0) {
              toast({
                  title: `${successfulUpdates.length} Statuses Updated`,
                  description: `Successfully updated status for ${successfulUpdates.length} items.`
              });
              const successfulTicketNumbers = new Set(successfulUpdates.map(item => item.ticket_number));
              setActiveConflicts(prev => prev.filter(item => !successfulTicketNumbers.has(item.ticket_number)));
              setUpdatedItems(prev => [...prev, ...successfulUpdates]);
          }
          
          if (failedUpdates.length > 0) {
              toast({
                  variant: 'destructive',
                  title: `${failedUpdates.length} Updates Failed`,
                  description: 'Some items could not be updated.'
              });
          }
      });
  };

  useEffect(() => {
    setIsProcessing(isAnyProcessing);
  }, [isAnyProcessing, setIsProcessing]);

  useEffect(() => {
    const savedJson = localStorage.getItem(LOCAL_STORAGE_KEY_INPUT);
    if (savedJson) {
        setJsonInput(savedJson);
    }
  }, []);

  // ── Open preview/confirm dialog ──────────────────────────────────────────
  const handleOpenImportConfirm = () => {
    if (!tableData) return;
    startFetchingPreview(async () => {
      const payload = tableData.rows
        .map(row => ({
          ticket_number: String(row['Ticket Number'] || ''),
          title: String(row['Title'] || ''),
        }))
        .filter(p => p.ticket_number);

      const result = await previewImportCases(payload);
      if (result.success) {
        setImportPreview({
          newCount: result.newCount ?? 0,
          duplicates: result.duplicates ?? [],
        });
        setIsPreviewDialogOpen(true);
      } else {
        toast({ variant: 'destructive', title: 'Preview Gagal', description: result.error });
      }
    });
  };
  // ────────────────────────────────────────────────────────────────────────

  const handleImportToDb = () => {
    if (!tableData) {
        toast({ variant: "destructive", title: "No Data", description: "There is no data to import." });
        return;
    }
    startImportingToDb(async () => {
      try {
        const payload = tableData.rows.map(row => {
            const createdAt = row['Created At'] ? new Date(row['Created At']) : null;
            const resolvedAt = row['Resolved At'] ? new Date(row['Resolved At']) : null;

            let date = '';
            let month = '';
            if (createdAt && !isNaN(createdAt.getTime())) {
                date = createdAt.toISOString().split('T')[0];
                const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
                month = monthNames[createdAt.getMonth()];
            }
            
            return {
                date: date,
                month: month,
                created_at: createdAt && !isNaN(createdAt.getTime()) ? createdAt.toISOString() : undefined,
                client_name: String(row['Client Name'] || ''),
                customer_name: String(row['Customer Name'] || ''),
                status: String(row['Status'] || ''),
                ticket_number: String(row['Ticket Number'] || ''),
                ticket_category: String(row['Ticket Category'] || ''),
                module: String(row['Module'] || ''),
                detail_module: String(row['Detail Module'] || ''),
                title: String(row['Title'] || ''),
                resolved_at: resolvedAt && !isNaN(resolvedAt.getTime()) ? resolvedAt.toISOString() : undefined,
                ticket_op: String(row['Ticket OP'] || ''),
            };
        });

        const result = await importOrUpdateCases(payload);
        
        if (result.error) {
            throw new Error(result.error);
        }

        if (result.success) {
            setImportResult({
                inserted: result.inserted || [],
                skipped: result.skipped || [],
                conflicts: result.conflicts || [],
            });
            setIsResultDialogOpen(true);
        }

      } catch(err: any) {
        toast({
            variant: "destructive",
            title: "Database Import Failed",
            description: err.message,
        });
      }
    });
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
              'Issue key': 'Ticket Number',
              'Summary': 'Summary',
              'Issue Type': 'Ticket Category',
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
                     if (!newRow[mappedKey]) {
                         newRow[mappedKey] = row[originalKey];
                      }
                  } else if (row.hasOwnProperty(originalKey)) {
                      newRow[cleanOriginalKey] = row[originalKey];
                  }
              }
               if (newRow['Ticket Number'] && newRow['Summary']) {
                  newRow['Title'] = `${newRow['Ticket Number']} ${newRow['Summary']}`.trim();
              } else if (newRow['Summary']) {
                  newRow['Title'] = newRow['Summary'];
              }
              delete newRow['Summary'];
              return newRow;
          });
      }
      
      const flattenedData = processedData.map((item: any) => flattenJson(item));
      const headers = DEFAULT_TEMPLATE.split(',').map(h => {
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

              if (header === 'Client Name') {
                  value = normalizeClientName(String(value || ''));
              }

              if (header.toLowerCase() === 'status') {
                  const lowerCaseValue = String(value).toLowerCase();
                  switch (lowerCaseValue) {
                      case 'resolve':
                      case 'resolved': value = 'Solved'; break;
                      case 'open': value = 'L2'; break;
                      case 'pending': value = 'L1'; break;
                      case 'on hold':
                      case 'on-hold':
                      case 'in progress l3':
                      case 'l3 (on progress)':
                      case 'l3 need release':
                      case 'l3 review':
                      case 'queue l3': value = 'L3'; break;
                      case 'new': value = 'L1'; break;
                      case 'in progress l1': value = 'L1'; break;
                      case 'in progress l2': value = 'L2'; break;
                      case 'client review l1': value = 'L1'; break;
                      default: break;
                  }
                  if (!value) {
                      value = 'L1';
                  }
              }
              newRow[header] = value;
          });

          if (!newRow['Ticket Number'] && newRow['Title']) {
              const match = String(newRow['Title']).match(/(IHO-\d+)/);
              if (match) {
                  newRow['Ticket Number'] = match[0];
              }
          }

          if (newRow['Ticket Number'] && newRow['Title']) {
              const ticketNumber = String(newRow['Ticket Number']);
              const title = String(newRow['Title']);
              if (title.startsWith(ticketNumber)) {
                  newRow['Title'] = title.substring(ticketNumber.length).trim();
              }
          }

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
      startConverting(async () => {
          setJsonError(null);
          setTableData(null);

          if (!input.trim()) {
              setJsonError("Input cannot be empty.");
              return;
          }

          try {
              let data: any[];
              if (format === 'json') {
                  data = JSON.parse(input);
              } else {
                  data = parseCsvToJson(input);
              }
              processAndSetTableData(data, format === 'csv');
              
              setJsonInput(input);
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
    event.target.value = '';
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
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      <Card className="shadow-lg flex-shrink-0">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
                <CardTitle className="text-xl">1. Convert JSON / CSV</CardTitle>
                <CardDescription>
                    Impor file JSON atau CSV, atau tempel kontennya. Data akan dikonversi secara otomatis.
                </CardDescription>
            </div>
        </CardHeader>
        <CardContent className="px-10">
          <div className="grid grid-cols-1 gap-4 items-start">
              <div className="grid gap-2">
                  <Label htmlFor="json-input">Paste Content (JSON or CSV)</Label>
                  <Textarea
                      id="json-input"
                      placeholder='Paste your JSON or CSV data here, e.g., [{"id": 1, "name": "John"}]'
                      value={jsonInput}
                      onChange={(e) => { setJsonInput(e.target.value); setTableData(null); setJsonError(null); }}
                      rows={8}
                      className="font-mono text-xs px-4"
                      disabled={isProcessing || !!tableData}
                  />
              </div>
          </div>
          
          <input type="file" ref={jsonFileInputRef} onChange={(e) => handleFileChange(e, 'json')} className="hidden" accept=".json" />
          <input type="file" ref={csvFileInputRef} onChange={(e) => handleFileChange(e, 'csv')} className="hidden" accept=".csv" />
          
          {jsonError && <JsonErrorAlert message={jsonError} />}
        </CardContent>
        <CardFooter className="flex items-center justify-between px-10">
             <div className="flex flex-wrap gap-2">
                <Button onClick={handleJsonImportClick} variant="outline" size="sm" disabled={isProcessing || !!tableData}>
                  <Upload className="mr-2 h-4 w-4" /> Import Json
                </Button>
                <Button onClick={handleCsvImportClick} variant="outline" size="sm" disabled={isProcessing || !!tableData}>
                    <Upload className="mr-2 h-4 w-4" /> Import CSV
                </Button>
            </div>
             <div className="flex flex-wrap gap-2">
                 <Button onClick={() => handleConvert(jsonInput, jsonInput.trim().startsWith('[') || jsonInput.trim().startsWith('{') ? 'json' : 'csv')} size="sm" disabled={!jsonInput || isProcessing || !!tableData}>
                    <Braces className="mr-2 h-4 w-4" /> Convert
                </Button>
                <Button onClick={handleDeleteInput} variant="destructive" size="sm" disabled={isProcessing}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear Input
                </Button>
            </div>
        </CardFooter>
      </Card>
      
      {tableData && (
        <div className="space-y-4 lg:space-y-6">
          <PreviewTable
              initialData={tableData}
              dateFormats={dateFormats}
              isProcessing={isProcessing}
              handleDateFormatChange={handleDateFormatChange}
              handleCopyToClipboard={handleCopyToClipboard}
              isCopied={isCopied}
              handleNavigateToReport={handleNavigateToReport}
              handleImportToDb={handleImportToDb}
              isImportingToDb={isImportingToDb}
              onOpenImportConfirm={handleOpenImportConfirm}
              isFetchingPreview={isFetchingPreview}
          />
        </div>
      )}

      {/* ── Preview / Confirm Import Dialog ── */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent className="max-w-lg">
              <DialogHeader>
                  <DialogTitle>Konfirmasi Import ke Database</DialogTitle>
                  <DialogDescription>
                      Periksa ringkasan data sebelum melanjutkan proses import.
                  </DialogDescription>
              </DialogHeader>

              {importPreview && (
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border-2 border-green-200 bg-green-50 dark:bg-green-950/20 p-4 text-center">
                              <p className="text-4xl font-bold text-green-600">{importPreview.newCount}</p>
                              <p className="text-xs text-muted-foreground mt-1">Baris baru siap diimport</p>
                          </div>
                          <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
                              <p className="text-4xl font-bold text-amber-500">{importPreview.duplicates.length}</p>
                              <p className="text-xs text-muted-foreground mt-1">Duplikat akan dilewati</p>
                          </div>
                      </div>

                      {importPreview.duplicates.length > 0 && (
                          <div className="space-y-2">
                              <p className="text-sm font-medium">
                                  Daftar duplikat ({importPreview.duplicates.length}):
                              </p>
                              <div className="h-64 overflow-y-auto rounded-md border bg-muted/30 p-2">
                                  <ul className="space-y-1">
                                      {importPreview.duplicates.map((item, i) => (
                                          <li key={i} className="flex items-start gap-2 text-xs p-1.5 rounded-md hover:bg-muted/50">
                                              <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                                              <span>
                                                  <span className="font-semibold">{item.ticket_number}</span>
                                                  {item.title && (
                                                      <span className="text-muted-foreground ml-1.5">{item.title}</span>
                                                  )}
                                              </span>
                                          </li>
                                      ))}
                                  </ul>
                              </div>
                          </div>
                      )}
                  </div>
              )}

              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
                      Batal
                  </Button>
                  <Button
                      onClick={() => {
                          setIsPreviewDialogOpen(false);
                          handleImportToDb();
                      }}
                      disabled={isImportingToDb}
                  >
                      {isImportingToDb
                          ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Mengimpor...</>
                          : `Ya, Import ${importPreview?.newCount ?? 0} Baris`
                      }
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* ── Import Result Dialog ── */}
      <Dialog open={isResultDialogOpen} onOpenChange={setIsResultDialogOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Import Data</DialogTitle>
                    <DialogDescription>
                        The import process has finished. Here's a summary of the results.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto pr-1">
                  <div className="space-y-6">
                      {(newlyInserted.length > 0 || updatedItems.length > 0) && (
                          <div>
                              <h3 className="text-lg font-medium tracking-tight text-green-600">Processed ({newlyInserted.length + updatedItems.length})</h3>
                              <div className="mt-2 space-y-3">
                                  <ResultList items={newlyInserted} title="New items successfully inserted." />
                                  {updatedItems.length > 0 && <ResultList items={updatedItems.map(i => ({...i, title: `${i.title} (Status updated to ${i.new_status})`}))} title="Items with conflicting status have been updated." />}
                              </div>
                          </div>
                      )}

                      {activeConflicts.length > 0 && (
                          <div>
                              <div className="flex items-center justify-between">
                                  <h3 className="text-lg font-medium tracking-tight text-amber-600">Update Status ({activeConflicts.length})</h3>
                                  {activeConflicts.length > 1 && (
                                      <Button
                                          size="sm"
                                          onClick={handleUpdateAll}
                                          disabled={isUpdatingAll}
                                          className="bg-amber-400 hover:bg-amber-500 text-amber-900 h-7 px-2"
                                      >
                                          {isUpdatingAll && <RefreshCw className="mr-2 h-3 w-3 animate-spin"/>}
                                          Update All
                                      </Button>
                                  )}
                              </div>
                               <div className="mt-2 space-y-2">
                                  <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-2">
                                      <ul className="space-y-1">
                                          {activeConflicts.map((item) => (
                                              <ConflictItem key={item.ticket_number} item={item} onUpdateSuccess={handleUpdateSuccess} />
                                          ))}
                                      </ul>
                                  </div>
                              </div>
                          </div>
                      )}

                      {(importResult?.skipped?.length || 0) > 0 && (
                           <div>
                              <h3 className="text-lg font-medium tracking-tight text-muted-foreground">Duplicate ({importResult?.skipped.length})</h3>
                              <div className="mt-2">
                                  <ResultList items={importResult?.skipped} />
                              </div>
                          </div>
                      )}
                  </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => setIsResultDialogOpen(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}


function PreviewTable({
    initialData,
    dateFormats,
    isProcessing,
    handleDateFormatChange,
    handleCopyToClipboard,
    isCopied,
    handleNavigateToReport,
    handleImportToDb,
    isImportingToDb,
    onOpenImportConfirm,
    isFetchingPreview,
} : {
    // ✅ Fix: Gunakan TableDataShape (explicit type) bukan typeof TableDataContext['tableData']
    // Error TS2339: Property 'tableData' does not exist on type 'Context<...>'
    initialData: TableDataShape;
    dateFormats: Record<string, DateFormat>;
    isProcessing: boolean;
    handleDateFormatChange: (header: string, format: string) => void;
    handleCopyToClipboard: () => void;
    isCopied: boolean;
    handleNavigateToReport: () => void;
    handleImportToDb: () => void;
    isImportingToDb: boolean;
    onOpenImportConfirm: () => void;
    isFetchingPreview: boolean;
}) {
    const { tableData, setTableData } = useContext(TableDataContext);

    const initialColumnWidths = useCallback(() => {
        if (!initialData) return {};
        const widths: Record<string, number> = {};
        initialData.headers.forEach((header: string) => {
            const lowerHeader = header.toLowerCase();
            if (lowerHeader === 'title') widths[header] = 384;
            else if (lowerHeader.includes('ticket number')) widths[header] = 150;
            else if (lowerHeader.includes('customer name')) widths[header] = 180;
            else if (lowerHeader.includes('client name')) widths[header] = 160;
            else if (lowerHeader.includes('ticket category')) widths[header] = 150;
            else if (lowerHeader.includes('kolom kosong')) widths[header] = 150;
            else if (lowerHeader === 'status' || lowerHeader === 'ticket op') widths[header] = 100;
            else widths[header] = 128;
        });
        return widths;
    }, [initialData]);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(initialColumnWidths());

    const isResizing = useRef<string | null>(null);
    const startX = useRef(0);
    const startWidth = useRef(0);
    
    useEffect(() => {
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
            [isResizing.current as string]: Math.max(40, currentWidth)
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
        if (!tableData) return;
        const newRows = [...tableData.rows];
        newRows[rowIndex] = { ...newRows[rowIndex], [header]: value };
        const newTableData = { ...tableData, rows: newRows };
        setTableData(newTableData);
    };

    if (!tableData) return null;

    return (
         <Card className="shadow-lg mt-6">
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl">2. Data Preview & Actions</CardTitle>
                        <CardDescription>
                            Preview your converted data. Once ready, you can import it into the database.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
             <CardContent>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mb-4">
                    <Button onClick={handleCopyToClipboard} variant="outline" size="sm" className="w-full sm:w-auto" disabled={isProcessing}>
                        {isCopied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                        {isCopied ? 'Copied!' : 'Copy for Sheets/Excel'}
                    </Button>
                    <Button onClick={handleNavigateToReport} size="sm" className="w-full sm:w-auto bg-pink-500 hover:bg-pink-600 text-white" disabled={isProcessing || !tableData}>
                        <BarChart className="mr-2 h-4 w-4" />
                        Daily Report
                    </Button>
                    <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={isProcessing || isFetchingPreview}
                        onClick={onOpenImportConfirm}
                    >
                        {isFetchingPreview
                            ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Memeriksa...</>
                            : isImportingToDb
                                ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Mengimpor...</>
                                : <><Database className="mr-2 h-4 w-4" />Import File</>
                        }
                    </Button>
                </div>
                <div className="h-[500px] overflow-hidden">
                    <div
                        className="overflow-auto w-full h-full border rounded-md"
                        style={{
                            transform: 'scale(0.7)',
                            transformOrigin: 'top left',
                            width: '142.857%',
                            height: '142.857%',
                        }}
                    >
                        <table className="w-full" style={{ tableLayout: 'fixed', width: `${Object.values(columnWidths).reduce((a, b) => a + b, 64)}px` }}>
                            <thead className="sticky top-0 z-20 bg-muted">
                                <tr className="border-b transition-colors hover:bg-muted/50">
                                    <th
                                        className="h-12 px-4 text-center align-middle font-medium text-muted-foreground whitespace-nowrap p-2 border-r sticky left-0 bg-muted z-10"
                                        style={{ width: '64px', minWidth: '64px' }}
                                    >
                                        No
                                    </th>
                                    {tableData.headers.map((header, index) => (
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
                                {tableData.rows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                        <td
                                            className="align-middle p-1 border-r text-sm text-muted-foreground text-center sticky left-0 bg-background z-10"
                                            style={{ width: '64px', minWidth: '64px' }}
                                        >
                                            {rowIndex + 1}
                                        </td>
                                        {tableData.headers.map((header, headerIndex) => (
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
                </div>
            </CardContent>
            <CardFooter className="pt-4">
                <p className="text-sm text-muted-foreground">Showing {tableData.rows.length} rows.</p>
            </CardFooter>
        </Card>
    );
}