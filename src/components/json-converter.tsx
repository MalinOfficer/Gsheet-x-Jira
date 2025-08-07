"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Braces, Copy, Check } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

type TableData = {
    headers: string[];
    rows: Record<string, string | number | boolean | null>[];
};

export function JsonConverter() {
    const [jsonInput, setJsonInput] = useState('');
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const { toast } = useToast();

    const flattenObject = (obj: any, parentKey = '', res: Record<string, any> = {}) => {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const propName = parentKey ? `${parentKey}.${key}` : key;
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    flattenObject(obj[key], propName, res);
                } else {
                    res[propName] = obj[key];
                }
            }
        }
        return res;
    };

    const handleConvert = () => {
        setError(null);
        setTableData(null);
        setIsCopied(false);

        if (!jsonInput.trim()) {
            setError("JSON input cannot be empty.");
            return;
        }

        try {
            let data = JSON.parse(jsonInput);
            if (!Array.isArray(data)) {
                data = [data];
            }

            if (data.length === 0) {
                setError("JSON array is empty.");
                return;
            }

            const flattenedData = data.map((item: any) => flattenObject(item));

            const headersSet = new Set<string>();
            flattenedData.forEach((row: any) => {
                Object.keys(row).forEach(key => headersSet.add(key));
            });
            
            const headers = Array.from(headersSet).sort();

            setTableData({ headers, rows: flattenedData });

        } catch (e) {
            setError(e instanceof Error ? e.message : "Invalid JSON format.");
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
                return String(value).replace(/\s+/g, ' ');
            }).join('\t'))
        ].join('\n');

        navigator.clipboard.writeText(tsv).then(() => {
            setIsCopied(true);
            toast({
                title: "Copied to clipboard!",
                description: "You can now paste the data into your spreadsheet.",
            });
            setTimeout(() => setIsCopied(false), 2000);
        }, () => {
            toast({
                variant: "destructive",
                title: "Failed to copy",
                description: "Could not copy data to clipboard.",
            });
        });
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
                        Paste your JSON data to convert it into a table, ready to be copied into Google Sheets or Excel.
                    </p>
                </header>
                
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>1. Paste Your JSON</CardTitle>
                        <CardDescription>
                            Enter your JSON content in the text area below. It can be a single object or an array of objects.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder='{ "name": "John Doe", "email": "john.doe@example.com" }'
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            rows={10}
                            className="font-code"
                        />
                         {error && <ErrorAlert message={error} />}
                        <Button onClick={handleConvert} className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!jsonInput}>
                            <Braces className="mr-2 h-4 w-4" />
                            Convert
                        </Button>
                    </CardContent>
                </Card>

                {tableData && (
                    <Card className="shadow-lg">
                        <CardHeader>
                             <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>2. Your Table is Ready</CardTitle>
                                    <CardDescription>
                                        The JSON data has been converted. You can now copy it.
                                    </CardDescription>
                                </div>
                                <Button onClick={handleCopyToClipboard} variant="outline">
                                    {isCopied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                                    {isCopied ? 'Copied!' : 'Copy Table'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="w-full overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {tableData.headers.map(header => (
                                                <TableHead key={header} className="font-bold whitespace-nowrap">{header}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tableData.rows.map((row, index) => (
                                            <TableRow key={index}>
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

