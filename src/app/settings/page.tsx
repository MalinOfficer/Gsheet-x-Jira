
'use client';

import { useState, useEffect, useContext } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { CodeXml, Files, Link, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TableDataContext } from '@/store/table-data-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const LOCAL_STORAGE_KEY_SHEET_URL = 'gsheetDashboardSheetUrl';
const LOCAL_STORAGE_KEY_DB_SHEET_URL = 'gsheetDashboardDbSheetUrl';

export default function SettingsPage() {
  const { 
      isCodeViewerEnabled, 
      toggleCodeViewer, 
      areSecondaryToolsEnabled, 
      toggleSecondaryTools,
      sheetUrl: contextSheetUrl,
      setSheetUrl: setContextSheetUrl,
      dbSheetUrl: contextDbSheetUrl,
      setDbSheetUrl: setContextDbSheetUrl,
  } = useContext(TableDataContext);
  
  const [isClient, setIsClient] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [dbSheetUrl, setDbSheetUrl] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    setSheetUrl(contextSheetUrl);
    setDbSheetUrl(contextDbSheetUrl);
  }, [contextSheetUrl, contextDbSheetUrl]);

  const handleSaveUrls = () => {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_URL, sheetUrl);
        setContextSheetUrl(sheetUrl);
        
        localStorage.setItem(LOCAL_STORAGE_KEY_DB_SHEET_URL, dbSheetUrl);
        setContextDbSheetUrl(dbSheetUrl);

        toast({
            title: "Settings Saved",
            description: "Your Google Sheet URLs have been updated.",
        });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Save Failed",
            description: "Could not save URLs to local storage.",
        });
    }
  };

  const featureToggles = [
    {
        id: 'secondary-tools-toggle',
        label: 'Tampilkan Alat Sekunder',
        description: 'Aktifkan untuk menampilkan menu Cek Duplikasi, Edit NIS, & Migrasi Produk.',
        icon: Files,
        checked: areSecondaryToolsEnabled,
        onCheckedChange: toggleSecondaryTools,
    },
    {
        id: 'code-viewer-toggle',
        label: 'Code Viewer',
        description: 'Tampilkan menu untuk melihat dan mengunduh kode sumber aplikasi.',
        icon: CodeXml,
        checked: isCodeViewerEnabled,
        onCheckedChange: toggleCodeViewer,
    }
  ];

  if (!isClient) {
      return (
          <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
              <div className="max-w-4xl mx-auto space-y-8">
                   <Skeleton className="h-48 w-full" />
                   <Skeleton className="h-48 w-full" />
              </div>
          </div>
      )
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Card>
            <CardHeader>
                <CardTitle>URL Configuration</CardTitle>
                <CardDescription>
                    Atur URL Google Sheet default untuk berbagai fitur di aplikasi ini.
                </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
                 <div className="grid gap-2">
                    <Label htmlFor="url-destination">URL Destination (Import & Update)</Label>
                    <div className='flex items-center gap-2'>
                        <Link className="h-9 w-9 p-2 bg-muted rounded-md flex items-center justify-center" />
                        <Input
                        id="url-destination"
                        type="url"
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        />
                    </div>
                 </div>
                 <div className="grid gap-2">
                    <Label htmlFor="url-gsheet-db">URL GSheet DB (Dashboard & DB Viewer)</Label>
                     <div className='flex items-center gap-2'>
                        <Link className="h-9 w-9 p-2 bg-muted rounded-md flex items-center justify-center" />
                        <Input
                        id="url-gsheet-db"
                        type="url"
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        value={dbSheetUrl}
                        onChange={(e) => setDbSheetUrl(e.target.value)}
                        />
                    </div>
                 </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSaveUrls}>
                    <Save className="mr-2 h-4 w-4" /> Save URLs
                </Button>
            </CardFooter>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Feature Activation</CardTitle>
                <CardDescription>
                Aktifkan atau nonaktifkan fitur-fitur tertentu dalam aplikasi.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {featureToggles.map(feature => (
                         <div key={feature.id} className="flex items-center justify-between rounded-lg border p-4">
                            <div className="flex items-center space-x-3">
                                <div className='bg-muted p-2 rounded-full'>
                                    <feature.icon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor={feature.id} className="text-base font-medium">
                                        {feature.label}
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                       {feature.description}
                                    </p>
                                </div>
                            </div>
                            <Switch
                                id={feature.id}
                                checked={feature.checked}
                                onCheckedChange={feature.onCheckedChange}
                                aria-label={`Toggle ${feature.label}`}
                            />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

      </div>
    </div>
  );
}
