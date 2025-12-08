
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Download, Archive, RefreshCw } from 'lucide-react';
import { getProjectFileContents } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Spinner } from '@/components/ui/spinner';

type FileContent = {
  path: string;
  content: string;
  name: string;
};

const LOCAL_STORAGE_KEY_CODE_VIEWER = 'codeViewerFileContents';

export default function CodeViewerPage() {
    const [fileContents, setFileContents] = useState<FileContent[] | null>(null);
    const [isSyncing, startSyncing] = useTransition();
    const [isZipping, startZipping] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        try {
            const savedContent = localStorage.getItem(LOCAL_STORAGE_KEY_CODE_VIEWER);
            if (savedContent) {
                setFileContents(JSON.parse(savedContent));
            }
        } catch (error) {
            console.error("Failed to load code from localStorage", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY_CODE_VIEWER);
        }
    }, []);

    const handleSync = () => {
        startSyncing(async () => {
            const result = await getProjectFileContents();
            if (result.success && result.data) {
                setFileContents(result.data);
                try {
                    localStorage.setItem(LOCAL_STORAGE_KEY_CODE_VIEWER, JSON.stringify(result.data));
                } catch (error) {
                    console.error("Failed to save code to localStorage", error);
                }
                toast({
                    title: "Sinkronisasi Berhasil",
                    description: "Kode sumber terbaru telah berhasil dimuat.",
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Sinkronisasi Gagal",
                    description: result.error || "Terjadi kesalahan yang tidak diketahui.",
                });
            }
        });
    };

    const handleDownloadAll = () => {
        if (!fileContents) return;
        startZipping(async () => {
            try {
                const zip = new JSZip();
                fileContents.forEach(file => {
                    zip.file(file.path, file.content);
                });
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                saveAs(zipBlob, 'GSheetDashboard-SourceCode.zip');
                toast({
                    title: 'Download Started',
                    description: 'Your ZIP file is being generated and will download shortly.',
                });
            } catch (error) {
                console.error('Error creating ZIP file:', error);
                toast({
                    variant: 'destructive',
                    title: 'Download Failed',
                    description: 'Could not create the ZIP file. Please try again.',
                });
            }
        });
    };

    const handleDownload = (content: string, fileName: string) => {
        try {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            saveAs(blob, fileName);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Download Failed',
                description: 'Could not prepare the file for download.',
            });
        }
    };

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Code Viewer</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                          Klik tombol untuk memuat dan menampilkan kode sumber terbaru dari proyek ini.
                        </p>
                    </div>
                    <div className='flex gap-2'>
                        <Button onClick={handleSync} disabled={isSyncing || isZipping} className="w-full sm:w-auto">
                            {isSyncing ? (
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            {isSyncing ? 'Menyinkronkan...' : 'Sinkronisasi Kode'}
                        </Button>
                         {fileContents && (
                            <Button onClick={handleDownloadAll} disabled={isZipping || isSyncing} className="w-full sm:w-auto">
                                {isZipping ? (
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Archive className="mr-2 h-4 w-4" />
                                )}
                                {isZipping ? 'Zipping...' : 'Download Semua (.zip)'}
                            </Button>
                        )}
                    </div>
                </header>
                
                {isSyncing && (
                    <div className="flex items-center justify-center p-12">
                        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}
                
                {!fileContents && !isSyncing && (
                     <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px]">
                        <CardHeader>
                            <CardTitle>Menunggu Sinkronisasi</CardTitle>
                            <CardDescription>
                                Klik tombol "Sinkronisasi Kode" untuk memuat pratinjau file proyek.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                )}

                {fileContents && (
                    <Accordion type="multiple" className="w-full space-y-4">
                        {fileContents.map(({ path, content, name }, index) => (
                            <AccordionItem value={`item-${index}`} key={path} className="border-b-0">
                                <Card>
                                    <AccordionTrigger className="p-4 md:p-6 text-left hover:no-underline w-full">
                                        <div className="flex justify-between items-center w-full pr-4">
                                            <div className='flex flex-col items-start'>
                                                <CardTitle className="text-lg">File: {path}</CardTitle>
                                                <CardDescription className="text-xs mt-1">Klik untuk melihat atau menyembunyikan kode</CardDescription>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 md:px-6 pb-4 md:pb-6">
                                        <div className="flex justify-end mb-2">
                                            <Button onClick={() => handleDownload(content, name)} variant="outline" size="sm" disabled={isZipping || isSyncing}>
                                                <Download className="mr-2 h-4 w-4" />
                                                Unduh File
                                            </Button>
                                        </div>
                                        <ScrollArea className="h-[40vh] w-full rounded-md border bg-muted/20">
                                            <pre className="p-4 text-xs font-code">
                                                <code>{content}</code>
                                            </pre>
                                        </ScrollArea>
                                    </AccordionContent>
                                </Card>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </div>
        </div>
    );
}
