//Supabase_DB
'use client';

import { useState, useEffect, useContext, useTransition } from 'react';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { CodeXml, Files, Link, Save, CheckCircle2, XCircle, RefreshCw, Pencil, RefreshCcw, Clock, Play, Pause, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsContext } from '@/contexts/settings-provider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { getSpreadsheetTitle, syncGSheetToDB } from '@/app/actions';

// ─── Types ──────────────────────────────────────────────────────────────────

type CronInterval = '5m' | '15m' | '30m' | '1h' | '6h' | '24h' | 'off';

interface CronConfig {
  interval: CronInterval;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
}

const CRON_LABELS: Record<CronInterval, string> = {
  '5m':  'Every 5 minutes',
  '15m': 'Every 15 minutes',
  '30m': 'Every 30 minutes',
  '1h':  'Every 1 hour',
  '6h':  'Every 6 hours',
  '24h': 'Every 24 hours',
  'off': 'Off',
};

const CRON_MS: Record<Exclude<CronInterval, 'off'>, number> = {
  '5m':  5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h':  60 * 60 * 1000,
  '6h':  6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatNextRun(isoString: string | null): string {
  if (!isoString) return '—';
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return 'soon';
  if (diff < 60_000) return `in ${Math.ceil(diff / 1_000)}s`;
  if (diff < 3_600_000) return `in ${Math.ceil(diff / 60_000)}m`;
  return `in ${Math.ceil(diff / 3_600_000)}h`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ValidationResult({ isLoading, title, error }: { isLoading: boolean; title: string | null; error: string | null }) {
  if (isLoading) return (
    <div className="flex items-center text-xs text-muted-foreground">
      <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /><span>Validating...</span>
    </div>
  );
  if (title) return (
    <div className="flex items-center text-xs text-green-600 font-medium">
      <CheckCircle2 className="w-3 h-3 mr-1.5" /><span>{title}</span>
    </div>
  );
  if (error) return (
    <div className="flex items-center text-xs text-destructive font-medium">
      <XCircle className="w-3 h-3 mr-1.5" /><span>{error}</span>
    </div>
  );
  return <div className="h-5" />;
}

function SyncResultBadge({ result }: { result: { inserted: number; skipped: number } | null }) {
  if (!result) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
        <CheckCircle2 className="w-3 h-3" />
        {result.inserted} inserted
      </Badge>
      <Badge variant="secondary" className="gap-1">
        {result.skipped} skipped
      </Badge>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const {
    isCodeViewerEnabled,
    toggleCodeViewer,
    areSecondaryToolsEnabled,
    toggleSecondaryTools,
    sheetUrl: contextSheetUrl,
    setSheetUrl: setContextSheetUrl,
    verifiedUrl, setVerifiedUrl,
    spreadsheetTitle, setSpreadsheetTitle,
  } = useContext(SettingsContext);

  const [isClient, setIsClient] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isSyncing, startSyncing] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Local state for URL input
  const [sheetUrl, setSheetUrl] = useState('');
  const [mainSheetError, setMainSheetError] = useState<string | null>(null);

  // Sync state
  const [lastSyncResult, setLastSyncResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [isSyncRunning, setIsSyncRunning] = useState(false);

  // Cron state (persisted in localStorage)
  const [cronConfig, setCronConfig] = useState<CronConfig>({
    interval: 'off',
    enabled: false,
    lastRun: null,
    nextRun: null,
  });
  const [cronTimerId, setCronTimerId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const { toast } = useToast();

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    setIsClient(true);
    setSheetUrl(contextSheetUrl);

    if (spreadsheetTitle && contextSheetUrl === verifiedUrl) setMainSheetError(null);
    setIsEditing(!spreadsheetTitle);

    // Restore cron config from localStorage
    try {
      const saved = localStorage.getItem('cronConfig');
      if (saved) {
        const parsed: CronConfig = JSON.parse(saved);
        setCronConfig(parsed);
      }
    } catch (_) {}
  }, []);

  // ── Cron job scheduler ────────────────────────────────────────────────────

  useEffect(() => {
    // Clear existing timer when config changes
    if (cronTimerId) clearTimeout(cronTimerId);

    if (!cronConfig.enabled || cronConfig.interval === 'off') return;

    const intervalMs = CRON_MS[cronConfig.interval as Exclude<CronInterval, 'off'>];
    const nextRunTime = new Date(Date.now() + intervalMs);
    updateCronConfig({ nextRun: nextRunTime.toISOString() });

    const id = setTimeout(async () => {
      await runSync(true);
    }, intervalMs);

    setCronTimerId(id);
    return () => clearTimeout(id);
  }, [cronConfig.enabled, cronConfig.interval]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function updateCronConfig(patch: Partial<CronConfig>) {
    setCronConfig(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('cronConfig', JSON.stringify(next));
      return next;
    });
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveUrls = () => {
    startSaving(async () => {
      setIsValidating(true);
      setContextSheetUrl(sheetUrl);
      toast({ title: 'Settings Saved', description: 'Verifying your Google Sheet URL...' });

      setSpreadsheetTitle(null);
      setMainSheetError(null);

      const result = await getSpreadsheetTitle(sheetUrl);

      if (result.error) {
        setMainSheetError(result.error);
        setVerifiedUrl('');
        setSpreadsheetTitle(null);
      } else {
        setSpreadsheetTitle(result.title || null);
        setVerifiedUrl(sheetUrl);
        setIsEditing(false);
      }

      setIsValidating(false);
    });
  };

  const runSync = async (isCron = false) => {
    setIsSyncRunning(true);
    try {
      const res = await syncGSheetToDB(verifiedUrl || sheetUrl);
      if (res.success) {
        setLastSyncResult({ inserted: res.inserted ?? 0, skipped: res.skipped ?? 0 });
        const now = new Date().toISOString();
        toast({
          title: isCron ? '🔄 Auto-Sync Complete' : '✅ Sync Complete',
          description: `${res.inserted} rows inserted, ${res.skipped} skipped.`,
        });
        if (isCron && cronConfig.enabled && cronConfig.interval !== 'off') {
          const intervalMs = CRON_MS[cronConfig.interval as Exclude<CronInterval, 'off'>];
          updateCronConfig({
            lastRun: now,
            nextRun: new Date(Date.now() + intervalMs).toISOString(),
          });
        } else {
          updateCronConfig({ lastRun: now });
        }
      } else {
        toast({ variant: 'destructive', title: 'Sync Failed', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Sync Error', description: e.message });
    } finally {
      setIsSyncRunning(false);
    }
  };

  const handleManualSync = () => {
    startSyncing(() => runSync(false));
  };

  const handleToggleCron = () => {
    const next = !cronConfig.enabled;
    updateCronConfig({
      enabled: next,
      nextRun: next && cronConfig.interval !== 'off'
        ? new Date(Date.now() + CRON_MS[cronConfig.interval as Exclude<CronInterval, 'off'>]).toISOString()
        : null,
    });
    toast({
      title: next ? '⏱ Auto-Sync Enabled' : '⏸ Auto-Sync Paused',
      description: next ? `Will sync ${CRON_LABELS[cronConfig.interval]}` : 'Scheduled sync stopped.',
    });
  };

  const handleIntervalChange = (value: string) => {
    const interval = value as CronInterval;
    updateCronConfig({
      interval,
      enabled: interval !== 'off' ? cronConfig.enabled : false,
      nextRun: cronConfig.enabled && interval !== 'off'
        ? new Date(Date.now() + CRON_MS[interval as Exclude<CronInterval, 'off'>]).toISOString()
        : null,
    });
  };

  // ── Feature toggles ───────────────────────────────────────────────────────

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
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isClient) {
    return (
      <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const canSync = !!(verifiedUrl || (sheetUrl && sheetUrl.includes('docs.google.com')));
  const cronIsActive = cronConfig.enabled && cronConfig.interval !== 'off';

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* ── URL Configuration Card ── */}
        <Card>
          <CardHeader>
            <CardTitle>URL Configuration</CardTitle>
            <CardDescription>
              Atur URL Google Sheet untuk sinkronisasi data. Data baru dari GSheet akan di-insert ke DB; data yang sudah ada (berdasarkan nomor tiket) akan di-skip.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* URL Input */}
            <div className="grid gap-2">
              <Label htmlFor="url-destination">URL Destination (Import & Update)</Label>
              <div className="flex items-center gap-2">
                <Link className="h-9 w-9 p-2 bg-muted rounded-md flex items-center justify-center shrink-0" />
                <Input
                  id="url-destination"
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl}
                  onChange={e => setSheetUrl(e.target.value)}
                  readOnly={!isEditing}
                  disabled={isSaving || isValidating}
                  className={!isEditing ? 'bg-muted/50' : ''}
                />
              </div>
              <div className="mt-1 pl-11">
                <ValidationResult
                  isLoading={isValidating}
                  title={spreadsheetTitle}
                  error={mainSheetError}
                />
              </div>
            </div>

            {/* ── Sync Controls Panel ── */}
            <div className={cn(
              'rounded-xl border bg-muted/30 p-4 space-y-4 transition-opacity duration-200',
              !canSync && 'opacity-40 pointer-events-none'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">GSheet → DB Sync</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Insert tiket baru dari GSheet; tiket yang sudah ada di DB akan di-skip otomatis.
                  </p>
                </div>
                {lastSyncResult && <SyncResultBadge result={lastSyncResult} />}
              </div>

              {/* Action row */}
              <div className="flex flex-wrap items-center gap-3">

                {/* Manual Sync */}
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleManualSync}
                  disabled={isSyncRunning || isSaving}
                  className="gap-2"
                >
                  {isSyncRunning
                    ? <RefreshCw className="h-4 w-4 animate-spin" />
                    : <RefreshCcw className="h-4 w-4" />
                  }
                  {isSyncRunning ? 'Syncing...' : 'Sync Now'}
                </Button>

                {/* Cron Interval Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Clock className="h-4 w-4" />
                      {CRON_LABELS[cronConfig.interval]}
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    <DropdownMenuLabel>Auto-sync interval</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={cronConfig.interval} onValueChange={handleIntervalChange}>
                      {(Object.keys(CRON_LABELS) as CronInterval[]).map(key => (
                        <DropdownMenuRadioItem key={key} value={key}>
                          {CRON_LABELS[key]}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Toggle cron on/off */}
                <Button
                  variant={cronIsActive ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={handleToggleCron}
                  disabled={cronConfig.interval === 'off'}
                  className={cn('gap-2', cronIsActive && 'text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100')}
                >
                  {cronIsActive
                    ? <><Pause className="h-4 w-4" />Pause Auto-Sync</>
                    : <><Play className="h-4 w-4" />Start Auto-Sync</>
                  }
                </Button>
              </div>

              {/* Cron status row */}
              {(cronConfig.lastRun || cronIsActive) && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                  {cronIsActive && (
                    <span className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                      Next sync: <span className="font-medium text-foreground">{formatNextRun(cronConfig.nextRun)}</span>
                    </span>
                  )}
                  {cronConfig.lastRun && (
                    <span>
                      Last run: <span className="font-medium text-foreground">{formatRelativeTime(cronConfig.lastRun)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter>
            {isEditing ? (
              <Button onClick={handleSaveUrls} disabled={isSaving || isValidating}>
                {(isSaving || isValidating)
                  ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  : <Save className="mr-2 h-4 w-4" />
                }
                {(isSaving || isValidating) ? 'Validating...' : 'Save URL'}
              </Button>
            ) : (
              <Button onClick={() => setIsEditing(true)} variant="destructive">
                <Pencil className="mr-2 h-4 w-4" />
                Change URL
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* ── Feature Activation Card ── */}
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
                    <div className="bg-muted p-2 rounded-full">
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