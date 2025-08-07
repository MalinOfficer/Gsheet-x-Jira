"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Braces, Copy, Check, Upload, ArrowRight, Save, Pencil, ChevronsUpDown } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type TableData = {
    headers: string[];
    rows: Record<string, any>[];
};

type DateFormat = 'origin' | 'jam' | 'report';

const LOCAL_STORAGE_KEY = 'jsonConverterHeaderTemplate';

const formatDateTime = (value: any, format: DateFormat): string => {
    if (!value || typeof value !== 'string') return '';
    if (format === 'origin') return value;

    try {
        const dateParts = value.match(/([A-Z][a-z]+)\s(\d{1,2}),\s(\d{4}),\s(\d{1,2}):(\d{2})\s(AM|PM)/);
        let date: Date;

        if (dateParts) {
             const [_, monthName, day, year, hourStr, minuteStr, ampm] = dateParts;
             const monthMap: { [key: string]: number } = {
                'January': 0, 'February': 1, 'March': 2, 'April': 3,
                'May': 4, 'June': 5, 'July': 6, 'August': 7,
                'September': 8, 'October': 9, 'November': 10, 'December': 11,
            };

            let hours = parseInt(hourStr, 10);
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;

            date = new Date(parseInt(year), monthMap[monthName], parseInt(day), hours, parseInt(minuteStr));
        } else {
            date = new Date(value);
        }

        if (isNaN(date.getTime())) {
            return value; // Return original if parsing fails
        }
        
        if (format === 'report') {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        }

        if (format === 'jam') {
            let hours = date.getHours();
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            const hoursPadded = String(hours).padStart(2, '0');
            return `${hoursPadded}:${minutes} ${ampm}`;
        }

        return value;
    } catch (e) {
        return value; // Return original on any error
    }
};

export function JsonConverter() {
    const [jsonInput, setJsonInput] = useState('');
    const [templateInput, setTemplateInput] = useState('Customer Name,Status,,Ticket Category,Module,Detail Module,Created At,Title,,Solved At');
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dateFormats, setDateFormats] = useState<Record<string, DateFormat>>({
        'Created At': 'report',
        'Solved At': 'report',
    });

    useEffect(() => {
        const savedTemplate = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedTemplate) {
            setTemplateInput(savedTemplate);
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


    const handleConvert = (jsonString: string) => {
        setError(null);
        setTableData(null);
        setIsCopied(false);

        if (!jsonString.trim()) {
            setError("JSON input cannot be empty.");
            return;
        }

        try {
            let data = JSON.parse(jsonString);
            if (!Array.isArray(data)) {
                data = [data];
            }

            if (data.length === 0) {
                setError("JSON array is empty.");
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
            toast({
                title: "Conversion Successful",
                description: "Your JSON has been converted to a table.",
            });

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
                if (header === 'Created At' || header === 'Solved At') {
                    value = formatDateTime(value, dateFormats[header]);
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

    const handleSaveTemplate = () => {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, templateInput);
            toast({
                title: "Template Saved",
                description: "Your header template has been saved in your browser.",
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
          setDateFormats(prev => ({ ...prev, [header]: format as DateFormat }));
        }
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
                                <Button onClick={handleImportClick} variant="outline" className="w-fit">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import JSON File
                                </Button>
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
                                        Save Template
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
                                        The JSON has been converted. Click the button to copy it for your spreadsheet.
                                    </CardDescription>
                                </div>
                                <Button onClick={handleCopyToClipboard} variant="outline" className="w-full sm:w-auto">
                                    {isCopied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                                    {isCopied ? 'Copied!' : 'Copy for Sheets/Excel'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="w-full overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {tableData.headers.map((header, index) => (
                                                <TableHead key={`${header}-${index}`} className="font-bold whitespace-nowrap bg-muted/50">
                                                    {(header === 'Created At' || header === 'Solved At') ? (
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
                                                                <DropdownMenuRadioGroup value={dateFormats[header]} onValueChange={(value) => handleDateFormatChange(header, value)}>
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
                                        {tableData.rows.map((row, index) => (
                                            <TableRow key={index} className="hover:bg-muted/50">
                                                {tableData.headers.map((header, headerIndex) => (
                                                    <TableCell key={`${header}-${headerIndex}-${index}`}>
                                                        {(header === 'Created At' || header === 'Solved At')
                                                          ? formatDateTime(row[header], dateFormats[header])
                                                          : String(row[header] ?? '')}
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
