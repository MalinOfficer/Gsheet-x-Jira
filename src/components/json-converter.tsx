
"use client";

import { useState, useRef, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Braces, Copy, Check, Upload, ArrowRight, Save, Pencil, BarChart, Trash2, GanttChartSquare } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, type DateFormat } from '@/lib/date-utils';
import { TableDataContext, type TableData } from '@/store/table-data-context';

const LOCAL_STORAGE_KEY_TEMPLATE = 'jsonConverterHeaderTemplate';
const LOCAL_STORAGE_KEY_INPUT = 'jsonConverterInput';
const DEFAULT_TEMPLATE = 'Customer Name,Client Name,Status,Kolom kosong1,Ticket Category,Module,Detail Module,Created At,Title,Kolom kosong2,Resolved At';

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
        setTemplateInput(savedTemplate || DEFAULT_TEMPLATE);
        
        const savedJson = localStorage.getItem(LOCAL_STORAGE_KEY_INPUT);
        if (savedJson) {
            setJsonInput(savedJson);
            handleConvert(savedJson, savedTemplate || DEFAULT_TEMPLATE, true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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


    const handleConvert = (jsonString: string, currentTemplate: string, silent = false) => {
        setError(null);
        setTableData(null);
        setIsCopied(false);

        if (!jsonString.trim()) {
            if (!silent) setError("Input JSON tidak boleh kosong.");
            return;
        }

        try {
            let data = JSON.parse(jsonString);
            if (!Array.isArray(data)) data = [data];
            if (data.length === 0) {
                if (!silent) setError("Array JSON kosong.");
                return;
            }

            const flattenedData = data.map((item: any) => flattenJson(item));
            const headers = currentTemplate.split(',').map(h => h.trim());
            
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
            localStorage.setItem(LOCAL_STORAGE_KEY_INPUT, jsonString);

            if (!silent) {
                toast({
                    title: "Konversi Berhasil",
                    description: "JSON Anda telah dikonversi dan diurutkan.",
                });
            }

        } catch (e) {
            setError(e instanceof Error ? `JSON tidak valid: ${e.message}` : "Terjadi kesalahan yang tidak diketahui saat konversi.");
        }
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
                title: "Berhasil disalin ke clipboard!",
                description: "Anda sekarang dapat menempelkan data ke Google Sheets, Excel, atau perangkat lunak spreadsheet lainnya.",
            });
            setTimeout(() => setIsCopied(false), 2000);
        }, () => {
            toast({
                variant: "destructive",
                title: "Gagal menyalin",
                description: "Tidak dapat menyalin data ke clipboard. Silakan coba lagi.",
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
                handleConvert(text, templateInput);
            }
        };
        reader.onerror = () => setError("Gagal membaca file.");
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleDelete = () => {
        setJsonInput('');
        setTableData(null);
        setError(null);
        localStorage.removeItem(LOCAL_STORAGE_KEY_INPUT);
        toast({
            title: "Input Dihapus",
            description: "Input JSON dan data yang tersimpan telah dihapus.",
        });
    };

    const handleSaveTemplate = () => {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY_TEMPLATE, templateInput);
            toast({
                title: "Templat Disimpan",
                description: "Templat header Anda saat ini telah disimpan sebagai default.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Gagal menyimpan templat",
                description: "Tidak dapat menyimpan templat ke penyimpanan lokal.",
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
            <AlertTitle>Kesalahan</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Konverter JSON ke Tabel</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Tempel data JSON Anda, sediakan templat header opsional, dan konversikan menjadi tabel yang siap disalin.
                    </p>
                </header>
                
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>1. Sediakan Data Anda</CardTitle>
                        <CardDescription>
                            Tempel JSON Anda, impor file, dan secara opsional berikan daftar header yang dipisahkan koma untuk output.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                            <div className="grid gap-2">
                                <Label htmlFor="json-input">Input JSON</Label>
                                <Textarea
                                    id="json-input"
                                    placeholder='[{"id": 1, "name": "John"}]'
                                    value={jsonInput}
                                    onChange={(e) => {
                                        setJsonInput(e.target.value);
                                        setTableData(null);
                                        setError(null);
                                    }}
                                    rows={8}
                                    className="font-mono text-xs"
                                    aria-label="JSON Input"
                                />
                                <div className="flex flex-wrap gap-2">
                                    <Button onClick={handleImportClick} variant="outline" size="sm" className="w-full sm:w-auto">
                                        <Upload className="mr-2 h-4 w-4" />
                                        Impor File JSON
                                    </Button>
                                     <Button onClick={handleDelete} variant="destructive" size="sm" className="w-full sm:w-auto">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Hapus
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
                                <Label htmlFor="template-input">Header "Konversi Ke" (Opsional)</Label>
                                <Textarea
                                    id="template-input"
                                    placeholder="contoh: id,nama,email"
                                    value={templateInput}
                                    onChange={(e) => setTemplateInput(e.target.value)}
                                    rows={4}
                                    className="font-mono text-xs"
                                    aria-label="Convert To Headers"
                                />
                                <div className="flex flex-wrap gap-2">
                                    <Button onClick={handleSaveTemplate} variant="outline" size="sm" className="w-full sm:w-auto">
                                        <Save className="mr-2 h-4 w-4" />
                                        Simpan sebagai Default
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Sediakan daftar header yang dipisahkan koma untuk digunakan pada tabel. Disimpan di browser.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4">
                            <Button onClick={() => handleConvert(jsonInput, templateInput)} size="sm" className="w-full md:w-auto" disabled={!jsonInput}>
                                <Braces className="mr-2 h-4 w-4" />
                                Konversi ke Tabel
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                        {error && <div className="mt-4"><ErrorAlert message={error} /></div>}
                    </CardContent>
                </Card>

                {tableData && (
                    <Card className="shadow-lg">
                        <CardHeader>
                             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                <div>
                                    <CardTitle>2. Tabel Anda Siap</CardTitle>
                                    <CardDescription>
                                        JSON telah dikonversi. Anda sekarang dapat menyalinnya atau pindah ke langkah berikutnya.
                                    </CardDescription>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                    <Button onClick={handleCopyToClipboard} variant="outline" size="sm" className="w-full sm:w-auto">
                                        {isCopied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                                        {isCopied ? 'Tersalin!' : 'Salin untuk Sheets/Excel'}
                                    </Button>
                                    <Button onClick={() => router.push('/report-harian')} size="sm" className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90">
                                        <BarChart className="mr-2 h-4 w-4" />
                                        Lihat sebagai Laporan
                                    </Button>
                                    <Button onClick={() => router.push('/update-case-l3')} variant="default" size="sm" className="w-full sm:w-auto">
                                        <GanttChartSquare className="mr-2 h-4 w-4" />
                                        Buka Halaman Impor
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
                                                                <Button variant="ghost" className="pl-0 text-xs text-left font-bold">
                                                                    <span className="flex items-center gap-1">
                                                                      {header}
                                                                      <Pencil className="h-3 w-3 text-muted-foreground" />
                                                                    </span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuLabel>Format Tanggal</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuRadioGroup value={dateFormats[header] || 'report'} onValueChange={(value) => handleDateFormatChange(header, value)}>
                                                                    <DropdownMenuRadioItem value="origin">Asli</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="jam">Jam</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="report">Laporan</DropdownMenuRadioItem>
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
                                                            <Select
                                                                value={String(row[header] ?? '')}
                                                                onValueChange={(newStatus) => handleStatusChange(rowIndex, newStatus)}
                                                            >
                                                                <SelectTrigger className="w-[120px] h-8 text-xs">
                                                                    <SelectValue placeholder="Pilih status" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="L1">L1</SelectItem>
                                                                    <SelectItem value="L2">L2</SelectItem>
                                                                    <SelectItem value="L3">L3</SelectItem>
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
