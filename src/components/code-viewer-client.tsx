'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Download, Archive, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type FileContent = {
  path: string;
  content: string;
  name: string;
};

export function CodeViewerClient({ fileContents }: { fileContents: FileContent[] }) {
  const { toast } = useToast();
  const [isZipping, startZipping] = useTransition();

  const handleDownloadAll = () => {
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
              Menampilkan kode sumber dari file-file penting dalam proyek. Klik tombol unduh untuk menyimpan salinan file.
            </p>
          </div>
          <Button onClick={handleDownloadAll} disabled={isZipping} className="w-full sm:w-auto">
            {isZipping ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            {isZipping ? 'Zipping...' : 'Download Semua File (.zip)'}
          </Button>
        </header>

        <Accordion type="multiple" className="w-full space-y-4">
          {fileContents.map(({ path, content, name }, index) => (
            <AccordionItem value={`item-${index}`} key={path} className="border-b-0">
                 <Card className="shadow-lg">
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
                             <Button onClick={() => handleDownload(content, name)} variant="outline" size="sm" disabled={isZipping}>
                                <Download className="mr-2 h-4 w-4" />
                                Unduh File
                            </Button>
                         </div>
                         <ScrollArea className="h-[40vh] w-full rounded-md border bg-muted/20">
                            <pre className="p-4 text-xs font-code">
                                <code>
                                    {content}
                                </code>
                            </pre>
                        </ScrollArea>
                    </AccordionContent>
                 </Card>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}