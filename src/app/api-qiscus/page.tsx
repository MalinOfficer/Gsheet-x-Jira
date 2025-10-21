
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link } from 'lucide-react';
import { syncQiscusToSheet } from '../actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ApiQiscusPage() {
  const [appCode, setAppCode] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [isSyncing, startSyncing] = useTransition();
  const { toast } = useToast();

  const handleSync = () => {
    if (!secretKey || !sheetUrl) {
      toast({
        variant: 'destructive',
        title: 'Input Missing',
        description: 'Please provide both the Qiscus Secret Key and the Google Sheet URL.',
      });
      return;
    }

    startSyncing(async () => {
      const result = await syncQiscusToSheet(appCode, secretKey, sheetUrl);
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Sync Failed',
          description: result.error,
        });
      } else {
        toast({
          title: 'Sync Successful',
          description: result.message,
        });
      }
    });
  };

  return (
    <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
            Qiscus API Sync
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hubungkan API Qiscus untuk menyinkronkan data tiket langsung ke Google Sheets.
          </p>
        </header>

        <Alert>
          <Link className="h-4 w-4" />
          <AlertTitle>Perhatian!</AlertTitle>
          <AlertDescription>
            Fitur ini sedang dalam pengembangan aktif. Penggunaan header dan URL endpoint dapat berubah.
            Saat ini, fungsi ini hanya mengambil data dan belum menyimpannya ke sheet.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>API Credentials</CardTitle>
            <CardDescription>
             Masukkan kredensial Anda untuk menghubungkan ke API Qiscus. Informasi ini tidak disimpan secara permanen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qiscus-app-code">Qiscus App Code (Opsional)</Label>
              <Input
                id="qiscus-app-code"
                value={appCode}
                onChange={(e) => setAppCode(e.target.value)}
                placeholder="cth: 'pintro-123456789'"
                disabled={isSyncing}
              />
               <p className="text-xs text-muted-foreground">
                Hanya diperlukan jika API Anda membutuhkannya. Biarkan kosong jika tidak yakin.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qiscus-secret-key">Qiscus Secret Key / API Token</Label>
              <Input
                id="qiscus-secret-key"
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Masukkan API Token atau Bearer Token Anda di sini"
                disabled={isSyncing}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="google-sheet-url">Google Sheet URL</Label>
              <Input
                id="google-sheet-url"
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                disabled={isSyncing}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSync} disabled={isSyncing || !secretKey || !sheetUrl}>
              {isSyncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSyncing ? 'Menyinkronkan...' : 'Mulai Sinkronisasi'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
