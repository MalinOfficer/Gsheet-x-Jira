
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
} from '@/components/ui/card';
import { Check, CodeXml } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TableDataContext } from '@/store/table-data-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { isCodeViewerEnabled, toggleCodeViewer } = useContext(TableDataContext);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Sesuaikan tampilan dan nuansa aplikasi sesuai preferensi Anda.
          </p>
        </header>
        
        <Card>
            <CardHeader>
                <CardTitle>Feature Activation</CardTitle>
                <CardDescription>
                Aktifkan atau nonaktifkan fitur-fitur tertentu dalam aplikasi.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!isClient ? (
                    <div className="flex items-center space-x-4">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-4 w-[200px]" />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center space-x-3">
                            <div className='bg-muted p-2 rounded-full'>
                                <CodeXml className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="code-viewer-toggle" className="text-base font-medium">
                                    Code Viewer
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Tampilkan menu untuk melihat dan mengunduh kode sumber aplikasi.
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="code-viewer-toggle"
                            checked={isCodeViewerEnabled}
                            onCheckedChange={toggleCodeViewer}
                            aria-label="Toggle Code Viewer"
                        />
                    </div>
                )}
            </CardContent>
        </Card>

      </div>
    </div>
  );
}
