'use client';

import { useState, useEffect, useContext, useTransition } from 'react';
import { cn } from '@/lib/utils';
import {
  Card, CardContent, CardDescription, CardHeader,
  CardTitle, CardFooter,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Files, Link, Save, CheckCircle2, XCircle, RefreshCw,
  Pencil, Clock, Play, Pause, ChevronDown,
  Eye, ArrowRight, AlertCircle, Database,
  ListTree, BarChart, GitBranch, Combine, HardHat,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsContext } from '@/contexts/settings-provider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { getSpreadsheetTitle, syncGSheetToDB, saveAppSetting, getAppSetting } from '@/app/actions';
import { previewGSheetSync, type PreviewRow } from '@/app/preview-sync';
import { useUserPreferences } from '@/hooks/use-user-preferences'; // ✅ tambah

// ─── Types ────────────────────────────────────────────────────────────────────

type CronInterval = '5m' | '15m' | '30m' | '1h' | '6h' | '24h' | 'off';
interface CronConfig {
  interval: CronInterval;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
}

export interface MenuVisibility {
  showImportData: boolean;
  showDailyReport: boolean;
  showKnowledgeBase: boolean;
  showMigrasiMurid: boolean;
  showSecondaryTools: boolean;
}

export const DEFAULT_MENU_VISIBILITY: MenuVisibility = {
  showImportData: true,
  showDailyReport: true,
  showKnowledgeBase: true,
  showMigrasiMurid: true,
  showSecondaryTools: true,
};

export const MENU_VISIBILITY_KEY = 'menuVisibility';

const CRON_LABELS: Record<CronInterval, string> = {
  '5m': 'Every 5 minutes', '15m': 'Every 15 minutes',
  '30m': 'Every 30 minutes', '1h': 'Every 1 hour',
  '6h': 'Every 6 hours', '24h': 'Every 24 hours', 'off': 'Off',
};
const CRON_MS: Record<Exclude<CronInterval, 'off'>, number> = {
  '5m': 5*60*1000, '15m': 15*60*1000, '30m': 30*60*1000,
  '1h': 60*60*1000, '6h': 6*60*60*1000, '24h': 24*60*60*1000,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function ValidationResult({ isLoading, title, error }: {
  isLoading: boolean; title: string | null; error: string | null;
}) {
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
        <CheckCircle2 className="w-3 h-3" />{result.inserted} inserted
      </Badge>
      <Badge variant="secondary" className="gap-1">{result.skipped} skipped</Badge>
    </div>
  );
}

// ─── Preview Dialog ───────────────────────────────────────────────────────────

interface SyncPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  previewRows: PreviewRow[];
  updateCount: number;
  skippedCount: number;
  totalSheetRows: number;
  isConfirming: boolean;
  unmappedHeaders?: string[];
}

function SyncPreviewDialog({
  open, onClose, onConfirm,
  previewRows, updateCount, skippedCount, totalSheetRows,
  isConfirming, unmappedHeaders = [],
}: SyncPreviewDialogProps) {
  const newCount = previewRows.length;
  const totalActions = newCount + updateCount;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0 gap-0">

        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Eye className="h-5 w-5 text-primary" />
            Preview Data Sebelum Sync
          </DialogTitle>
          <DialogDescription className="text-sm mt-1">
            Periksa data di bawah sebelum di-insert ke database. Klik{' '}
            <strong>Lanjut & Sync</strong> untuk melanjutkan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 px-6 py-4 bg-muted/30 border-b flex-wrap">
          <div className="flex items-center gap-2 rounded-lg bg-background border px-3 py-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total GSheet</span>
            <span className="text-sm font-bold">{totalSheetRows}</span>
          </div>

          <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />

          <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-700 dark:text-green-400">Akan Di-insert</span>
            <span className="text-sm font-bold text-green-700 dark:text-green-400">{newCount}</span>
          </div>

          {updateCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
              <RefreshCw className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-blue-700 dark:text-blue-400">Akan Di-update</span>
              <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{updateCount}</span>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg bg-muted border px-3 py-2">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Sudah Ada (Skip)</span>
            <span className="text-sm font-bold">{skippedCount}</span>
          </div>

          {unmappedHeaders.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 px-3 py-2 ml-auto">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Kolom tidak ter-map: {unmappedHeaders.join(', ')}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden px-6 py-4">
          {newCount === 0 && updateCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
              <p className="font-semibold text-lg">Semua data sudah tersync!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tidak ada tiket baru dan tidak ada data yang perlu diperbarui.
              </p>
            </div>
          ) : newCount === 0 && updateCount > 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <RefreshCw className="h-12 w-12 text-blue-500 mb-3" />
              <p className="font-semibold text-lg">Ada {updateCount} data yang perlu diperbarui</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tidak ada tiket baru, tapi {updateCount} tiket akan diisi <strong>Created At</strong>,{' '}
                <strong>Resolved At</strong>, atau status-nya diperbarui.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[340px] rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <tr className="border-b">
                    <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground w-6">#</th>
                    <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Ticket</th>
                    <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Tanggal</th>
                    <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Client</th>
                    <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Modul</th>
                    <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground min-w-[200px]">Detail Case</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr
                      key={row.ticket_number ?? i}
                      className={cn(
                        'border-b last:border-0 transition-colors',
                        i % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                        'hover:bg-primary/5'
                      )}
                    >
                      <td className="py-2 px-3 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded font-medium">
                          {row.ticket_number || '—'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{row.date || '—'}</td>
                      <td className="py-2 px-3 text-xs font-medium max-w-[120px] truncate" title={row.client_name ?? ''}>{row.client_name || '—'}</td>
                      <td className="py-2 px-3">
                        {row.status_case ? (
                          <Badge
                            variant={row.status_case.toLowerCase() === 'solved' ? 'default' : 'secondary'}
                            className={cn('text-[10px] px-1.5 py-0', row.status_case.toLowerCase() === 'solved' && 'bg-green-600 hover:bg-green-700')}
                          >
                            {row.status_case}
                          </Badge>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground max-w-[100px] truncate" title={row.module_case ?? ''}>{row.module_case || '—'}</td>
                      <td className="py-2 px-3 text-xs max-w-[200px] truncate text-muted-foreground" title={row.detail_case ?? ''}>{row.detail_case || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isConfirming}>Batal</Button>
          {totalActions > 0 && (
            <Button onClick={onConfirm} disabled={isConfirming} className="gap-2 min-w-[140px]">
              {isConfirming
                ? <><RefreshCw className="h-4 w-4 animate-spin" />Menyimpan...</>
                : <><CheckCircle2 className="h-4 w-4" />Lanjut &amp; Sync ({totalActions})</>
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const {
    areSecondaryToolsEnabled, toggleSecondaryTools,
    sheetUrl: contextSheetUrl, setSheetUrl: setContextSheetUrl,
    verifiedUrl, setVerifiedUrl,
    spreadsheetTitle, setSpreadsheetTitle,
  } = useContext(SettingsContext);

  // ✅ User preferences — sync menuVisibility ke DB
  const { prefs, updatePref, isLoading: isPrefsLoading } = useUserPreferences();

  const [isClient, setIsClient]           = useState(false);
  const [isSaving, startSaving]           = useTransition();
  const [isEditing, setIsEditing]         = useState(false);
  const [isValidating, setIsValidating]   = useState(false);
  const [sheetUrl, setSheetUrl]           = useState('');
  const [mainSheetError, setMainSheetError] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [isSyncRunning, setIsSyncRunning] = useState(false);

  // ── Menu Visibility
  // Inisialisasi dari localStorage untuk tampil cepat, DB akan override setelah load
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibility>(DEFAULT_MENU_VISIBILITY);

  // ── Preview dialog state
  const [isPreviewOpen, setIsPreviewOpen]             = useState(false);
  const [isFetchingPreview, setIsFetchingPreview]     = useState(false);
  const [isConfirmingSyncRef, setIsConfirmingSyncRef] = useState(false);
  const [previewData, setPreviewData] = useState<{
    rows: PreviewRow[];
    updateRows: any[];
    skippedCount: number;
    totalSheetRows: number;
    unmappedHeaders: string[];
  } | null>(null);

  // ── Cron state
  const [cronConfig, setCronConfig] = useState<CronConfig>({
    interval: 'off', enabled: false, lastRun: null, nextRun: null,
  });
  const [cronTimerId, setCronTimerId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const { toast } = useToast();

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsClient(true);

    const initUrl = async () => {
      let url = contextSheetUrl;
      if (!url) {
        try { url = localStorage.getItem('globalSheetUrl') || ''; } catch (_) {}
      }
      if (!url) {
        try {
          const res = await getAppSetting('global_sheet_url');
          if (res.success && res.value) url = res.value;
        } catch (_) {}
      }
      if (url) { setSheetUrl(url); setContextSheetUrl(url); }
      if (spreadsheetTitle && contextSheetUrl === verifiedUrl) setMainSheetError(null);
      setIsEditing(!spreadsheetTitle && !url);
    };

    initUrl();

    // Load cron config dari localStorage
    try {
      const saved = localStorage.getItem('cronConfig');
      if (saved) setCronConfig(JSON.parse(saved));
    } catch (_) {}

    // ✅ Load menuVisibility dari localStorage dulu (fast path)
    // DB preferences akan override via useEffect setelah prefs load
    try {
      const saved = localStorage.getItem(MENU_VISIBILITY_KEY);
      if (saved) setMenuVisibility({ ...DEFAULT_MENU_VISIBILITY, ...JSON.parse(saved) });
    } catch (_) {}
  }, []);

  // ✅ Sync menuVisibility dari DB setelah prefs selesai load
  // Prioritas: DB > localStorage — sehingga setting dari device lain ikut ter-apply
  useEffect(() => {
    if (isPrefsLoading) return;
    if (!prefs.menuVisibility) return;

    const merged = { ...DEFAULT_MENU_VISIBILITY, ...prefs.menuVisibility };
    setMenuVisibility(merged);

    // Sync ke localStorage agar client-layout bisa baca langsung
    try { localStorage.setItem(MENU_VISIBILITY_KEY, JSON.stringify(merged)); } catch (_) {}

    // Dispatch event agar sidebar langsung update
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('menuVisibilityChange', { detail: merged }));
    }, 0);
  }, [isPrefsLoading, prefs.menuVisibility]);

  // ── Cron scheduler ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (cronTimerId) clearTimeout(cronTimerId);
    if (!cronConfig.enabled || cronConfig.interval === 'off') return;

    const intervalMs = CRON_MS[cronConfig.interval as Exclude<CronInterval, 'off'>];
    updateCronConfig({ nextRun: new Date(Date.now() + intervalMs).toISOString() });

    const id = setTimeout(async () => { await runSync(true); }, intervalMs);
    setCronTimerId(id);
    return () => clearTimeout(id);
  }, [cronConfig.enabled, cronConfig.interval]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function updateCronConfig(patch: Partial<CronConfig>) {
    setCronConfig(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('cronConfig', JSON.stringify(next));
      return next;
    });
  }

  function updateMenuVisibility(key: keyof MenuVisibility, value: boolean) {
    const next: MenuVisibility = { ...menuVisibility, [key]: value };

    // 1. Update React state (instan)
    setMenuVisibility(next);

    // 2. Persist ke localStorage
    try { localStorage.setItem(MENU_VISIBILITY_KEY, JSON.stringify(next)); } catch (_) {}

    // 3. ✅ Persist ke DB via user preferences (auto-save dengan debounce 1.5 detik)
    updatePref('menuVisibility', next);

    // 4. Dispatch event agar sidebar langsung update tanpa reload
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('menuVisibilityChange', { detail: next }));
    }, 0);

    // 5. Sync SettingsContext untuk secondary tools
    if (key === 'showSecondaryTools' && value !== areSecondaryToolsEnabled) {
      toggleSecondaryTools();
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSaveUrls = () => {
    startSaving(async () => {
      setIsValidating(true);
      setContextSheetUrl(sheetUrl);
      setSpreadsheetTitle(null);
      setMainSheetError(null);

      const result = await getSpreadsheetTitle(sheetUrl);
      if (result.error) {
        setMainSheetError(result.error);
        setVerifiedUrl('');
        setSpreadsheetTitle(null);
        setIsValidating(false);
        return;
      }

      setSpreadsheetTitle(result.title || null);
      setVerifiedUrl(sheetUrl);
      setIsEditing(false);

      try { localStorage.setItem('globalSheetUrl', sheetUrl); } catch (_) {}

      const saveRes = await saveAppSetting('global_sheet_url', sheetUrl);
      if (saveRes.success) {
        toast({
          title: '✅ URL Disimpan sebagai Default Global',
          description: `"${result.title}" akan digunakan sebagai URL default di semua perangkat.`,
        });
      } else {
        toast({
          title: '⚠️ URL Disimpan Lokal',
          description: 'Tersimpan di browser ini. Gagal simpan ke server: ' + saveRes.error,
        });
      }
      setIsValidating(false);
    });
  };

  const handleSyncNowClick = async () => {
    const targetUrl = verifiedUrl || sheetUrl;
    if (!targetUrl) return;

    setIsFetchingPreview(true);
    try {
      const result = await previewGSheetSync(targetUrl);
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Gagal Fetch Preview', description: result.error });
        return;
      }
      setPreviewData({
        rows: result.toInsert ?? [],
        updateRows: result.toUpdate ?? [],
        skippedCount: result.skippedCount ?? 0,
        totalSheetRows: result.totalSheetRows ?? 0,
        unmappedHeaders: result.unmappedHeaders ?? [],
      });
      setIsPreviewOpen(true);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsFetchingPreview(false);
    }
  };

  const handleConfirmSync = async () => {
    setIsConfirmingSyncRef(true);
    try {
      const res = await syncGSheetToDB(verifiedUrl || sheetUrl);
      if (res.success) {
        setLastSyncResult({ inserted: res.inserted ?? 0, skipped: res.skipped ?? 0 });
        toast({ title: '✅ Sync Complete', description: `${res.inserted} rows inserted, ${res.skipped} skipped.` });
        updateCronConfig({ lastRun: new Date().toISOString() });
        setIsPreviewOpen(false);
        setPreviewData(null);
      } else {
        toast({ variant: 'destructive', title: 'Sync Failed', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Sync Error', description: e.message });
    } finally {
      setIsConfirmingSyncRef(false);
    }
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
          updateCronConfig({ lastRun: now, nextRun: new Date(Date.now() + intervalMs).toISOString() });
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

  // ── Menu toggles definition ──────────────────────────────────────────────────

  type MenuToggle = {
    id: string;
    label: string;
    description: string;
    icon: React.ElementType;
    visibilityKey: keyof MenuVisibility;
  };

  const menuToggles: MenuToggle[] = [
    {
      id: 'toggle-import-data',
      label: 'Import Data',
      description: 'Menu untuk melakukan import data dari Google Sheet.',
      icon: ListTree,
      visibilityKey: 'showImportData',
    },
    {
      id: 'toggle-daily-report',
      label: 'Daily Report',
      description: 'Menu laporan harian untuk melihat ringkasan tiket per hari.',
      icon: BarChart,
      visibilityKey: 'showDailyReport',
    },
    {
      id: 'toggle-knowledge-base',
      label: 'Knowledge Base',
      description: 'Menu Knowledge Base (saat ini dalam pengembangan).',
      icon: HardHat,
      visibilityKey: 'showKnowledgeBase',
    },
    {
      id: 'toggle-migrasi-murid',
      label: 'Migrasi Murid',
      description: 'Menu untuk migrasi data murid antar sistem.',
      icon: GitBranch,
      visibilityKey: 'showMigrasiMurid',
    },
    {
      id: 'toggle-secondary-tools',
      label: 'Alat Sekunder (Cek Duplikasi & Edit NIS)',
      description: 'Tampilkan menu Cek Duplikasi dan Edit NIS di navigasi.',
      icon: Files,
      visibilityKey: 'showSecondaryTools',
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

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
              Atur URL Google Sheet untuk sinkronisasi data. Data baru dari GSheet akan di-insert ke DB;
              data yang sudah ada (berdasarkan nomor tiket) akan di-skip.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
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
                <ValidationResult isLoading={isValidating} title={spreadsheetTitle} error={mainSheetError} />
              </div>
            </div>

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

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSyncNowClick}
                  disabled={isFetchingPreview || isSyncRunning || isSaving}
                  className="gap-2"
                >
                  {isFetchingPreview
                    ? <><RefreshCw className="h-4 w-4 animate-spin" />Memuat Preview...</>
                    : <><Eye className="h-4 w-4" />Sync Now</>
                  }
                </Button>

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
                        <DropdownMenuRadioItem key={key} value={key}>{CRON_LABELS[key]}</DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

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
                    <span>Last run: <span className="font-medium text-foreground">{formatRelativeTime(cronConfig.lastRun)}</span></span>
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
                <Pencil className="mr-2 h-4 w-4" />Change URL
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* ── Feature Activation Card ── */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Activation</CardTitle>
            <CardDescription>
              Aktifkan atau nonaktifkan menu navigasi tertentu. Menu <strong>Dashboard</strong> dan{' '}
              <strong>Data All Case</strong> selalu ditampilkan.
              {/* ✅ Indikator loading preferences dari DB */}
              {isPrefsLoading && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Memuat preferensi...
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {menuToggles.map(toggle => {
                const isOn = menuVisibility[toggle.visibilityKey];
                return (
                  <div
                    key={toggle.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-4 transition-colors',
                      !isOn && 'bg-muted/30 opacity-70'
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn('p-2 rounded-full transition-colors', isOn ? 'bg-primary/10' : 'bg-muted')}>
                        <toggle.icon className={cn('h-5 w-5 transition-colors', isOn ? 'text-primary' : 'text-muted-foreground')} />
                      </div>
                      <div className="space-y-0.5">
                        <Label
                          htmlFor={toggle.id}
                          className={cn('text-base font-medium cursor-pointer', !isOn && 'text-muted-foreground')}
                        >
                          {toggle.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{toggle.description}</p>
                      </div>
                    </div>
                    <Switch
                      id={toggle.id}
                      checked={isOn}
                      onCheckedChange={val => updateMenuVisibility(toggle.visibilityKey, val)}
                      aria-label={`Toggle ${toggle.label}`}
                      disabled={isPrefsLoading}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-dashed bg-muted/20 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Selalu tampil:</span>{' '}
                Dashboard dan Data All Case tidak dapat disembunyikan.
                <span className="ml-2 text-muted-foreground/70">
                  · Pengaturan tersimpan otomatis dan berlaku di semua perangkat.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Preview Dialog ── */}
      {previewData && (
        <SyncPreviewDialog
          open={isPreviewOpen}
          onClose={() => { setIsPreviewOpen(false); setPreviewData(null); }}
          onConfirm={handleConfirmSync}
          previewRows={previewData.rows}
          updateCount={previewData.updateRows.length}
          skippedCount={previewData.skippedCount}
          totalSheetRows={previewData.totalSheetRows}
          unmappedHeaders={previewData.unmappedHeaders}
          isConfirming={isConfirmingSyncRef}
        />
      )}
    </div>
  );
}