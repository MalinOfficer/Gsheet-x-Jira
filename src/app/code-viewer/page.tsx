
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CodeViewerClient } from '@/components/code-viewer-client';
import { getProjectFileContents } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type FileContent = {
  path: string;
  content: string;
  name: string;
};

export default function CodeViewerPage() {
    const [fileContents, setFileContents] = useState<FileContent[] | null>(null);
    const [isSyncing, startSyncing] = useTransition();
    const { toast } = useToast();

    const handleSync = () => {
        startSyncing(async () => {
            const result = await getProjectFileContents();
            if (result.success && result.data) {
                setFileContents(result.data);
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
                     <Button onClick={handleSync} disabled={isSyncing} className="w-full sm:w-auto">
                        {isSyncing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        {isSyncing ? 'Menyinkronkan...' : 'Sinkronisasi Kode'}
                      </Button>
                </header>
                
                {isSyncing && (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                    <CodeViewerClient fileContents={fileContents} />
                )}
            </div>
        </div>
    );
}

  