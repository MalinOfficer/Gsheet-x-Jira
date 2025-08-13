
"use client";

import { useState, useTransition, useEffect, useContext, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, ArrowLeft, Import, DatabaseZap, Save, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react';
import { importToSheet, updateSheetStatus, getSheetTitle } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { TableDataContext } from '@/store/table-data-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useDebouncedCallback } from 'use-debounce';

const LOCAL_STORAGE_KEY_SHEET_URL = 'gsheetDashboardSheetUrl';


export function GsheetDashboard() {
  const { tableData, setTableData } = useContext(TableDataContext);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetTitle, setSheetTitle] = useState<{ name: string; error: string | null; loading: boolean }>({ name: '', error: null, loading: false });

  const [isImporting, startImporting] = useTransition();
  const [isUpdating, startUpdating] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const savedUrl = localStorage.getItem(LOCAL_STORAGE_KEY_SHEET_URL);
    if (savedUrl) {
      setSheetUrl(savedUrl);
      fetchTitle(savedUrl);
    }
  }, []);

  const fetchTitle = useCallback(async (url: string) => {
    if (!url || !url.includes('spreadsheets/d/')) {
        setSheetTitle({ name: '', error: null, loading: false });
        return;
    }
    setSheetTitle(prev => ({ ...prev, loading: true, error: null }));
    const result = await getSheetTitle(url);
    if (result.title) {
        setSheetTitle({ name: result.title, error: null, loading: false });
    } else {
        setSheetTitle({ name: '', error: result.error || 'Failed to fetch title.', loading: false });
    }
  }, []);

  const debouncedFetchTitle = useDebouncedCallback(fetchTitle, 500);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setSheetUrl(newUrl);
    debouncedFetchTitle(newUrl);
  };


  const handleUpdate = async () => {
    if (!tableData || !sheetUrl) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "No data to update or sheet URL is missing.",
      });
      return;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_URL, sheetUrl);

    startUpdating(async () => {
      const result = await updateSheetStatus({ rows: tableData.rows }, sheetUrl);
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Update Error",
          description: `Failed to update sheet status: ${result.error}`,
        });
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
                    {result.updatedRows.map((item: { title: string, status: string }, index: number) => (
                      <li key={index}>{item.title} -> <strong>{item.status}</strong></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ),
        });
      }
    });
  };

  const handleImport = async () => {
    if (!tableData || !sheetUrl) {
        toast({
            variant: "destructive",
            title: "Import Failed",
            description: "No data to import or sheet URL is missing.",
        });
        return;
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_URL, sheetUrl);

    startImporting(async () => {
        if (!tableData) return;
        const result = await importToSheet({ headers: tableData.headers, rows: tableData.rows }, sheetUrl);

        if (result.error) {
            toast({
                variant: "destructive",
                title: "Import Error",
                description: `Failed to import to sheet: ${result.error}`,
            });
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
                        {sheetTitle.name && (
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
                    <Button onClick={handleImport} size="sm" disabled={isImporting || isUpdating || !sheetUrl}>
                      {isImporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Import to GSheet
                        </>
                      )}
                    </Button>
                    <Button 
                        onClick={handleUpdate} 
                        size="sm"
                        className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
                        disabled={isUpdating || isImporting || !sheetUrl}>
                        {isUpdating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            <>
                                <DatabaseZap className="mr-2 h-4 w-4" />
                                Update Status
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
