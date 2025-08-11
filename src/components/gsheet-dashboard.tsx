
"use client";

import { useState, useTransition, useRef, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, KeyRound, ArrowLeft, Import, Pencil } from 'lucide-react';
import { importToSheet } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { TableDataContext } from '@/store/table-data-context';

const LOCAL_STORAGE_KEY_GCP_EMAIL = 'gsheetDashboardGcpEmail';
const LOCAL_STORAGE_KEY_GCP_KEY = 'gsheetDashboardGcpKey';
const LOCAL_STORAGE_KEY_SHEET_URL = 'gsheetDashboardSheetUrl';


export function GsheetDashboard() {
  const { tableData } = useContext(TableDataContext);
  const [gcpEmail, setGcpEmail] = useState('');
  const [gcpKey, setGcpKey] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [showCredentials, setShowCredentials] = useState(false);
  const [isImporting, startImporting] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem(LOCAL_STORAGE_KEY_GCP_EMAIL);
    const savedKey = localStorage.getItem(LOCAL_STORAGE_KEY_GCP_KEY);
    const savedUrl = localStorage.getItem(LOCAL_STORAGE_KEY_SHEET_URL);
    if (savedEmail) setGcpEmail(savedEmail);
    if (savedKey) {
      setGcpKey(savedKey);
      setShowCredentials(false); // Hide if key exists
    } else {
      setShowCredentials(true); // Show if no key
    }
    if (savedUrl) setSheetUrl(savedUrl);
  }, []);

  useEffect(() => {
    const topDiv = topScrollRef.current;
    const tableDiv = tableScrollRef.current;

    if (!topDiv || !tableDiv) return;

    const syncScroll = (source: HTMLDivElement, target: HTMLDivElement) => {
        return () => {
            if (target.scrollLeft !== source.scrollLeft) {
                target.scrollLeft = source.scrollLeft;
            }
        };
    };

    const topSync = syncScroll(topDiv, tableDiv);
    const tableSync = syncScroll(tableDiv, topDiv);

    topDiv.addEventListener('scroll', topSync);
    tableDiv.addEventListener('scroll', tableSync);

    return () => {
        topDiv.removeEventListener('scroll', topSync);
        tableDiv.removeEventListener('scroll', tableSync);
    };
  }, [tableData]);

  const handleImport = async () => {
    if (!tableData || !sheetUrl) {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: "No data to import or sheet URL is missing.",
      });
      return;
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEY_GCP_EMAIL, gcpEmail);
    localStorage.setItem(LOCAL_STORAGE_KEY_GCP_KEY, gcpKey);
    localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_URL, sheetUrl);


    startImporting(async () => {
      const result = await importToSheet({ headers: tableData.headers, rows: tableData.rows }, sheetUrl, gcpEmail, gcpKey);

      if (result.error) {
        toast({
          variant: "destructive",
          title: "Import Error",
          description: `Failed to import to sheet: ${result.error}`,
        });
      } else {
        toast({
          title: "Import Successful",
          description: result.message,
        });
      }
    });
  };

  const InitialState = () => (
    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px]">
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
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary font-headline">Update Cases</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Review the data converted from JSON and import it into your target Google Sheet.
          </p>
        </header>

        {!tableData ? (
            <InitialState />
        ) : (
          <>
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Import Destination</CardTitle>
                        <CardDescription>
                          Enter your Google Sheet URL and Service Account credentials. The sheet content will be overwritten.
                        </CardDescription>
                    </div>
                    {!showCredentials && (
                        <Button variant="outline" size="sm" onClick={() => setShowCredentials(true)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Credentials
                        </Button>
                    )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="grid gap-2">
                    <Label htmlFor="gsheet-url">Target Google Sheet URL</Label>
                    <Input
                      id="gsheet-url"
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                    />
                  </div>
                
                {showCredentials && (
                    <div className="space-y-4 animate-in fade-in-0 duration-300">
                        <div className="grid gap-2">
                          <Label htmlFor="gcp-email">Service Account Email</Label>
                          <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                              id="gcp-email"
                              type="email"
                              placeholder="your-service-account@your-project.iam.gserviceaccount.com"
                              value={gcpEmail}
                              onChange={(e) => setGcpEmail(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="gcp-key">Service Account Private Key</Label>
                          <Textarea
                            id="gcp-key"
                            placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
                            value={gcpKey}
                            onChange={(e) => setGcpKey(e.target.value)}
                            rows={6}
                            className="font-mono"
                          />
                        </div>
                    </div>
                )}
                
                <Button onClick={handleImport} disabled={isImporting || !gcpEmail || !gcpKey || !sheetUrl}>
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
              </CardContent>
            </Card>

            <Card className="shadow-lg mt-8">
                <CardHeader>
                    <CardTitle>Preview Data for Import</CardTitle>
                    <CardDescription>
                        This is the data you converted. It will overwrite the content of the target sheet.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div ref={topScrollRef} className="w-full overflow-x-auto overflow-y-hidden">
                       <div style={{ width: tableRef.current?.getBoundingClientRect().width, height: '1px' }}></div>
                    </div>
                    <div ref={tableScrollRef} className="w-full overflow-x-auto rounded-md border">
                        <Table ref={tableRef}>
                            <TableHeader>
                                <TableRow>
                                    {tableData.headers.map(header => (
                                        <TableHead 
                                            key={header} 
                                            className="font-bold whitespace-nowrap bg-muted/50"
                                        >
                                           {header}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tableData.rows.map((row, index) => (
                                    <TableRow key={index} className="hover:bg-muted/50">
                                        {tableData.headers.map(header => (
                                            <TableCell 
                                                key={`${header}-${index}`} 
                                                className="whitespace-nowrap"
                                            >
                                                {String(row[header] || '')}
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
