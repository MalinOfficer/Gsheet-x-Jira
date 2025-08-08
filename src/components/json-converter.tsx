"use client";

import { useState, useRef, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Braces, Copy, Check, Upload, ArrowRight, Save, Pencil, ChevronsUpDown, BarChart, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, type DateFormat } from '@/lib/date-utils';
import { TableDataContext, type TableData } from '@/store/table-data-context';

const LOCAL_STORAGE_KEY_TEMPLATE = 'jsonConverterHeaderTemplate';
const LOCAL_STORAGE_KEY_INPUT = 'jsonConverterInput';
const DEFAULT_TEMPLATE = 'Client Name,Customer Name,Status,Ticket Category,Module,Detail Module,Created At,Title,Resolved At';

export function JsonConverter() {
    const [jsonInput, setJsonInput] = useState('');
    const [templateInput, setTemplateInput] = useState(DEFAULT_TEMPLATE);
    const { tableData, setTableData } = useContext(TableDataContext);
    const [error, setError] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dateFormats, setDateFormats] = useState<Record<string, DateFormat>>({
        'Created At': 'report',
        'Resolved At': 'report',
    });
    const router = useRouter();


    useEffect(() => {
        const savedTemplate = localStorage.getItem(LOCAL_STORAGE_KEY_TEMPLATE);
        if (savedTemplate) {
            setTemplateInput(savedTemplate);
        } else {
            setTemplateInput(DEFAULT_TEMPLATE);
        }

        const savedJson = localStorage.getItem(LOCAL_STORAGE_KEY_INPUT);
        if (savedJson) {
            setJsonInput(savedJson);
            handleConvert(savedJson, true); // Don't show toast on initial load
        }
    }, []);

    const flattenAndProcessJson = (obj: any, path: string = '', res: Record<string, any> = {}): Record<string, any> => {
        if (obj === null || typeof obj !== 'object') {
            if (path) res[path] = obj;
            return res;
        }

        if (Array.isArray(obj)) {
            if (path) res[path] = JSON.stringify(obj);
            return res;
        }
        
        Object.keys(obj).forEach(key => {
            const newPath = path ? `${path}.${key}` : key;
            const value = obj[key];

            if (typeof value === 'string') {
                try {
                    const parsedValue = JSON.parse(value);
                    if (typeof parsedValue === 'object' && parsedValue !== null) {
                        flattenAndProcessJson(parsedValue, '', res); 
                    } else {
                        res[newPath] = value;
                    }
                } catch (e) {
                    res[newPath] = value;
                }
            } else if (typeof value === 'object' && value !== null) {
                flattenAndProcessJson(value, newPath, res);
            } else {
                res[newPath] = value;
            }
        });
        return res;
    };


    const handleConvert = (jsonString: string, silent = false) => {
        setError(null);
        setTableData(null);
        setIsCopied(false);

        if (!jsonString.trim()) {
            if (!silent) setError("JSON input cannot be empty.");
            return;
        }

        try {
            let data = JSON.parse(jsonString);
            if (!Array.isArray(data)) {
                data = [data];
            }

            if (data.length === 0) {
                if (!silent) setError("JSON array is empty.");
                return;
            }

            const flattenedData = data.map((item: any) => flattenAndProcessJson(item));
            
            let headers: string[];
            if (templateInput.trim()) {
                headers = templateInput.split(',').map(h => h.trim());
            } else {
                const headersSet = new Set<string>();
                flattenedData.forEach((row: any) => {
                    Object.keys(row).forEach(key => headersSet.add(key));
                });
                headers = Array.from(headersSet).sort();
            }
            
            const processedRows = flattenedData.map(row => {
                const newRow: Record<string, any> = {};
                headers.forEach(header => {
                    newRow[header] = row[header] !== undefined ? row[header] : '';
                });
                return newRow;
            });
            
            setTableData({ headers, rows: processedRows });
            
            localStorage.setItem(LOCAL_STORAGE_KEY_INPUT, jsonString);

            if (!silent) {
                toast({
                    title: "Conversion Successful",
                    description: "Your JSON has been converted to a table.",
                });
            }

        } catch (e) {
            setError(e instanceof Error ? `Invalid JSON: ${e.message}` : "An unknown error occurred during conversion.");
        }
    };
    
    const handleCopyToClipboard = () => {
        if (!tableData) return;

        const { headers, rows } = tableData;
        const tsv = [
            headers.join('\t'),
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
                title: "Failed to copy",
                description: "Could not copy data to clipboard. Please try again.",
            });
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
                handleConvert(text);
            }
        };
        reader.onerror = () => {
            setError("Failed to read file.");
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleDelete = () => {
        setJsonInput('');
        setTableData(null);
        setError(null);
        localStorage.removeItem(LOCAL_STORAGE_KEY_INPUT);
        toast({
            title: "Input Cleared",
            description: "The JSON input and saved data have been cleared.",
        });
    };

    const handleSaveTemplate = () => {
        try {
            const newTemplate = DEFAULT_TEMPLATE;
            setTemplateInput(newTemplate);
            localStorage.setItem(LOCAL_STORAGE_KEY_TEMPLATE, newTemplate);
            toast({
                title: "Default Template Saved",
                description: "The default header template has been saved in your browser.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Failed to save template",
                description: "Could not save template to local storage.",
            });
        }
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
    
    const handleStatusChange = (rowIndex: number, newStatus: string) => {
        if (!tableData) return;
        const newRows = [...tableData.rows];
        newRows[rowIndex]['Status'] = newStatus;
        setTableData({ ...tableData, rows: newRows });
    };

    const ErrorAlert = ({ message }: { message: string }) => (
        <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );

    return (
        <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <header className="text-center">
                    <h1 className="text-4xl font-bold tracking-tight text-primary font-headline">JSON to Table Converter</h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                        Paste your JSON data, provide an optional header template, and convert it into a table ready to be copied.
                    </p>
                </header>
                
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>1. Provide Your Data</CardTitle>
                        <CardDescription>
                            Paste your JSON, import a file, and optionally provide a comma-separated list of headers for the output.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <div className="grid gap-2">
                                <Label htmlFor="json-input">JSON Input</Label>
                                <Textarea
                                    id="json-input"
                                    placeholder='[{"id": 1, "name": "John"}]'
                                    value={jsonInput}
                                    onChange={(e) => {
                                        setJsonInput(e.target.value);
                                        setTableData(null);
                                        setError(null);
                                    }}
                                    rows={10}
                                    className="font-mono"
                                    aria-label="JSON Input"
                                />
                                <div className="flex gap-2">
                                    <Button onClick={handleImportClick} variant="outline" className="w-fit">
                                        <Upload className="mr-2 h-4 w-4" />
                                        Import JSON File
                                    </Button>
                                     <Button onClick={handleDelete} variant="destructive" className="w-fit">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </Button>
                                </div>
                                <Input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept="application/json,.json"
                                />
                            </div>
                             <div className="grid gap-2">
                                <Label htmlFor="template-input">"Convert To" Headers (Optional)</Label>
                                <Textarea
                                    id="template-input"
                                    placeholder="e.g., id,name,email"
                                    value={templateInput}
                                    onChange={(e) => setTemplateInput(e.target.value)}
                                    rows={10}
                                    className="font-mono"
                                    aria-label="Convert To Headers"
                                />
                                <div className="flex gap-2">
                                    <Button onClick={handleSaveTemplate} variant="outline" className="w-fit">
                                        <Save className="mr-2 h-4 w-4" />
                                        Save as Default
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Provide a comma-separated list of headers to use for the table. Saved in browser.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6">
                            <Button onClick={() => handleConvert(jsonInput)} className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!jsonInput}>
                                <Braces className="mr-2 h-4 w-4" />
                                Convert to Table
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                        {error && <div className="mt-4"><ErrorAlert message={error} /></div>}
                    </CardContent>
                </Card>

                {tableData && (
                    <Card className="shadow-lg">
                        <CardHeader>
                             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle>2. Your Table is Ready</CardTitle>
                                    <CardDescription>
                                        The JSON has been converted. You can now copy it or view it as a report.
                                    </CardDescription>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                    <Button onClick={handleCopyToClipboard} variant="outline" className="w-full sm:w-auto">
                                        {isCopied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                                        {isCopied ? 'Copied!' : 'Copy for Sheets/Excel'}
                                    </Button>
                                    <Button onClick={() => router.push('/report-harian')} variant="default" className="w-full sm:w-auto">
                                        <BarChart className="mr-2 h-4 w-4" />
                                        View as Report
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="w-full overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {tableData.headers.map((header, index) => (
                                                <TableHead key={`${header}-${index}`} className="font-bold whitespace-nowrap bg-muted/50">
                                                    {(header === 'Created At' || header === 'Resolved At') ? (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="pl-0">
                                                                    <span className="flex items-center gap-2">
                                                                      {header}
                                                                      <Pencil className="h-3 w-3 text-muted-foreground" />
                                                                    </span>
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuLabel>Date Format</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuRadioGroup value={dateFormats[header] || 'report'} onValueChange={(value) => handleDateFormatChange(header, value)}>
                                                                    <DropdownMenuRadioItem value="origin">Origin</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="jam">Jam</DropdownMenuRadioItem>
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
                                                    <TableCell key={`${header}-${headerIndex}-${rowIndex}`} className="whitespace-nowrap">
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
                                                                    <SelectItem value="On hold">On hold</SelectItem>
                                                                    <SelectItem value="Solved">Solved</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (header === 'Created At' || header === 'Resolved At') ? (
                                                            formatDateTime(row[header], dateFormats[header] || 'report')
                                                        ) : (
                                                            String(row[header] ?? '')
                                                        )}
                                                    </TableCell>
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
