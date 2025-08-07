"use client";

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Braces, Copy, Check, Upload, ArrowRight } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type TableData = {
    headers: string[];
    rows: Record<string, string | number | boolean | null>[];
};

export function JsonConverter() {
    const [jsonInput, setJsonInput] = useState('');
    const [templateInput, setTemplateInput] = useState('');
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const flattenObject = (obj: any, parentKey = '', res: Record<string, any> = {}) => {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const propName = parentKey ? `${parentKey}.${key}` : key;
                const value = obj[key];

                if (typeof value === 'string') {
                    try {
                        const parsed = JSON.parse(value);
                        if (typeof parsed === 'object' && parsed !== null) {
                            flattenObject(parsed, propName, res);
                            continue;
                        }
                    } catch (e) {
                        // Not a JSON string, treat as a normal string
                    }
                }

                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flattenObject(value, propName, res);
                } else {
                    res[propName] = value;
                }
            }
        }
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

            const flattenedData = data.map((item: any) => flattenObject(item));
            
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

            setTableData({ headers, rows: flattenedData });
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
                const value = row[header];
                if (value === null || value === undefined) return '';
                let stringValue = String(value);
                if (stringValue.includes('\t') || stringValue.includes('\n')) {
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
                setError(null);
                setTableData(null);
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
                                <p className="text-xs text-muted-foreground">
                                    Provide a comma-separated list of headers to use for the table.
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
                                            {tableData.headers.map(header => (
                                                <TableHead key={header} className="font-bold whitespace-nowrap bg-muted/50">{header}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tableData.rows.map((row, index) => (
                                            <TableRow key={index} className="hover:bg-muted/50">
                                                {tableData.headers.map(header => (
                                                    <TableCell key={`${header}-${index}`}>
                                                        {String(row[header] ?? '')}
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
