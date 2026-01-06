
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
import { Check, CodeXml, Files } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TableDataContext } from '@/store/table-data-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { isCodeViewerEnabled, toggleCodeViewer, areSecondaryToolsEnabled, toggleSecondaryTools } = useContext(TableDataContext);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

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

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
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
                )}
            </CardContent>
        </Card>

      </div>
    </div>
  );
}
