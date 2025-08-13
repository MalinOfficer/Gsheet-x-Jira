
"use client";

import { useState, useTransition, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, ArrowLeft, Import, DatabaseZap, Save } from 'lucide-react';
import { importToSheet, updateSheetStatus } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { TableDataContext } from '@/store/table-data-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const LOCAL_STORAGE_KEY_SHEET_URL = 'gsheetDashboardSheetUrl';


export function GsheetDashboard() {
  const { tableData, setTableData } = useContext(TableDataContext);
  const [sheetUrl, setSheetUrl] = useState('');
  const [isImporting, startImporting] = useTransition();
  const [isUpdating, startUpdating] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const savedUrl = localStorage.getItem(LOCAL_STORAGE_KEY_SHEET_URL);
    if (savedUrl) setSheetUrl(savedUrl);
  }, []);

  const handleUpdate = async () => {
    if (!tableData || !sheetUrl) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "No data available to update or sheet URL is missing.",
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
                        {result.importedCount > 0 && <p>{result.importedCount} new rows imported.</p>}
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
                        {!result.importedCount && !result.duplicateCount && <p>No new data was imported.</p>}
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
            description: "Please enter a URL before setting it as default.",
        });
        return;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_URL, sheetUrl);
    toast({
        title: "URL Saved",
        description: "The Google Sheet URL has been saved as your default.",
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
            Review the data converted from JSON and import it into your target Google Sheet.
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
                  Enter your Google Sheet URL. The data will be imported into the "All Case" sheet.
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
                        onChange={(e) => setSheetUrl(e.target.value)}
                        className="flex-grow"
                      />
                      <Button onClick={handleSaveUrlAsDefault} variant="outline" size="sm" className="w-full sm:w-auto">
                          <Save className="h-4 w-4 mr-2" /> Set as default
                      </Button>
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
                    <CardTitle>Preview Data for Import</CardTitle>
                    <CardDescription>
                        This is the data you converted. It will be imported into the target sheet.
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

    