
"use client";

import { useState, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Upload, FileText, X, Download, Trash2, FileCog } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

type FileData = {
    name: string;
    size: number;
};

export function MigrasiProduk() {
    const [file, setFile] = useState<FileData | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            // Placeholder for file reading logic
            if (!selectedFile.type.includes('spreadsheet') && !selectedFile.name.endsWith('.xls') && !selectedFile.name.endsWith('.xlsx')) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid File Type',
                    description: `File '${selectedFile.name}' is not a valid Excel file.`,
                });
                return;
            }
            setFile({ name: selectedFile.name, size: selectedFile.size });
            toast({
                title: 'File Selected',
                description: `'${selectedFile.name}' is ready to be processed.`,
            });
        }
    };

    const handleClearFile = () => {
        setFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    const handleProcess = () => {
         toast({
            title: "Fitur Belum Tersedia",
            description: "Fungsi untuk memproses file akan segera ditambahkan.",
        });
    }

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
             <div className="max-w-7xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Migrasi Product</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Alat untuk mengelola dan memformat data migrasi produk.
                    </p>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Upload Template</CardTitle>
                        <CardDescription>
                            Gunakan template Excel yang disediakan atau unggah file Anda untuk memulai.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                "w-full p-6 border-2 border-dashed rounded-lg transition-colors duration-200 cursor-pointer",
                                "border-border hover:border-primary/50"
                            )}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload-produk"
                                accept=".xlsx, .xls, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                disabled={isProcessing}
                            />
                            {file ? (
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                                    <div className="flex items-center gap-3">
                                        <FileText className="h-5 w-5 text-muted-foreground" />
                                        <div className='flex flex-col'>
                                            <span className="font-medium text-foreground truncate">{file.name}</span>
                                            <span className='text-xs text-muted-foreground'>{formatFileSize(file.size)}</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleClearFile();
                                        }}
                                        disabled={isProcessing}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
                                    <Upload className="w-10 h-10 mb-2" />
                                    <p className="font-semibold">Klik untuk menelusuri atau seret dan lepas file di sini</p>
                                    <p className="text-xs mt-1">Mendukung .xlsx dan .xls</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex-wrap gap-2">
                        <Button onClick={handleProcess} disabled={isProcessing || !file}>
                           <FileCog className="mr-2 h-4 w-4" />
                           Proses Edit
                        </Button>
                        <Button onClick={handleClearFile} variant="destructive" disabled={isProcessing || !file}>
                           <Trash2 className="mr-2 h-4 w-4" />
                           Delete
                        </Button>
                    </CardFooter>
                </Card>
                
                 {/* Placeholder for the data table */}
                 <Card>
                    <CardHeader>
                        <CardTitle>Data Produk</CardTitle>
                        <CardDescription>
                            Data dari template Anda akan ditampilkan di sini setelah diproses.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg">
                            <p className="text-muted-foreground">Tabel data akan muncul di sini setelah file diproses.</p>
                        </div>
                    </CardContent>
                </Card>
             </div>
        </div>
    );
}
