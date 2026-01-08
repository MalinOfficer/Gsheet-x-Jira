
'use client';

import { useState, useEffect, useContext, useTransition } from 'react';
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
import { CodeXml, Files, Link, Save, CheckCircle2, XCircle, RefreshCw, Pencil } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TableDataContext } from '@/store/table-data-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getSpreadsheetTitle } from '@/app/actions';

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
      // Main URL states
      verifiedUrl, setVerifiedUrl,
      spreadsheetTitle, setSpreadsheetTitle,
      // DB URL states
      verifiedDbUrl, setVerifiedDbUrl,
      dbSpreadsheetTitle, setDbSpreadsheetTitle,
  } = useContext(TableDataContext);
  
  const [isClient, setIsClient] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [isValidatingOnLoad, setIsValidatingOnLoad] = useState(true);

  // Local state for inputs
  const [sheetUrl, setSheetUrl] = useState('');
  const [dbSheetUrl, setDbSheetUrl] = useState('');
  
  // Local state for validation results to avoid context race conditions
  const [mainSheetError, setMainSheetError] = useState<string | null>(null);
  const [dbSheetError, setDbSheetError] = useState<string | null>(null);


  const { toast } = useToast();

  // Effect to initialize inputs from context and validate on load
  useEffect(() => {
    setIsClient(true);
    const mainUrl = contextSheetUrl;
    const databaseUrl = contextDbSheetUrl;
    
    setSheetUrl(mainUrl);
    setDbSheetUrl(databaseUrl);

    // Auto-validate URLs on initial load
    const validateOnLoad = async () => {
        setIsValidatingOnLoad(true);
        const [mainResult, dbResult] = await Promise.all([
            getSpreadsheetTitle(mainUrl),
            getSpreadsheetTitle(databaseUrl)
        ]);
        
        let isMainValid = false;
        let isDbValid = false;

        if (mainResult.error) {
            setMainSheetError(mainResult.error);
            setVerifiedUrl('');
        } else {
            setSpreadsheetTitle(mainResult.title || null);
            setVerifiedUrl(mainUrl);
            isMainValid = true;
        }

        if (dbResult.error) {
            setDbSheetError(dbResult.error);
            setVerifiedDbUrl('');
        } else {
            setDbSpreadsheetTitle(dbResult.title || null);
            setVerifiedDbUrl(databaseUrl);
            isDbValid = true;
        }
        
        // If both URLs are valid on load, start in non-editing mode.
        if(isMainValid && isDbValid) {
            setIsEditing(false);
        } else {
            setIsEditing(true);
        }
        setIsValidatingOnLoad(false);
    };

    validateOnLoad();
  }, []); // Runs only once on mount

  const handleSaveUrls = () => {
    startSaving(async () => {
        // Save to localStorage and update context immediately for responsiveness
        setContextSheetUrl(sheetUrl);
        setContextDbSheetUrl(dbSheetUrl);

        toast({
            title: "Settings Saved",
            description: "Your Google Sheet URLs have been updated. Now verifying...",
        });

        // Clear previous validation results
        setSpreadsheetTitle(null);
        setDbSpreadsheetTitle(null);
        setMainSheetError(null);
        setDbSheetError(null);

        // --- Validation Logic ---
        const [mainResult, dbResult] = await Promise.all([
            getSpreadsheetTitle(sheetUrl),
            getSpreadsheetTitle(dbSheetUrl)
        ]);
        
        let isMainValid = false;
        let isDbValid = false;

        // Handle Main URL validation
        if (mainResult.error) {
            setMainSheetError(mainResult.error);
            setVerifiedUrl('');
        } else {
            setSpreadsheetTitle(mainResult.title || null);
            setVerifiedUrl(sheetUrl);
            isMainValid = true;
        }

        // Handle DB URL validation
        if (dbResult.error) {
            setDbSheetError(dbResult.error);
            setVerifiedDbUrl('');
        } else {
            setDbSpreadsheetTitle(dbResult.title || null);
            setVerifiedDbUrl(dbSheetUrl);
            isDbValid = true;
        }
        
        if (isMainValid && isDbValid) {
            setIsEditing(false); // Exit editing mode on successful save & validation
        }
    });
  };
  
  const handleEditClick = () => {
      setIsEditing(true);
  }

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

  const ValidationResult = ({ isLoading, title, error, verifiedUrl, currentUrl }: { isLoading: boolean, title: string | null, error: string | null, verifiedUrl: string, currentUrl: string }) => {
      if (isLoading) {
          return <div className="flex items-center text-xs text-muted-foreground"><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /><span>Validating...</span></div>;
      }
      if (verifiedUrl === currentUrl && title) {
          return <div className="flex items-center text-xs text-green-600 font-medium"><CheckCircle2 className="w-3 h-3 mr-1.5" /><span>{title}</span></div>;
      }
      if (error) {
           return <div className="flex items-center text-xs text-destructive font-medium"><XCircle className="w-3 h-3 mr-1.5" /><span>{error}</span></div>;
      }
      return <div className="h-5"></div>; // Placeholder to prevent layout shift
  }

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
                    Atur URL Google Sheet default untuk berbagai fitur di aplikasi ini. Klik "Save" untuk memvalidasi.
                </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
                 <div className="grid gap-2">
                    <Label htmlFor="url-destination">URL Destination (Import & Update)</Label>
                    <div className='flex items-center gap-2'>
                        <Link className="h-9 w-9 p-2 bg-muted rounded-md flex items-center justify-center shrink-0" />
                        <Input
                          id="url-destination"
                          type="url"
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          value={sheetUrl}
                          onChange={(e) => setSheetUrl(e.target.value)}
                          readOnly={!isEditing}
                          disabled={isSaving || isValidatingOnLoad}
                          className={!isEditing ? 'bg-muted/50' : ''}
                        />
                    </div>
                    <div className="mt-1 pl-11">
                        <ValidationResult 
                            isLoading={isSaving || isValidatingOnLoad}
                            title={spreadsheetTitle}
                            error={mainSheetError}
                            verifiedUrl={verifiedUrl}
                            currentUrl={sheetUrl}
                        />
                    </div>
                 </div>
                 <div className="grid gap-2">
                    <Label htmlFor="url-gsheet-db">URL GSheet DB (Dashboard & DB Viewer)</Label>
                     <div className='flex items-center gap-2'>
                        <Link className="h-9 w-9 p-2 bg-muted rounded-md flex items-center justify-center shrink-0" />
                        <Input
                          id="url-gsheet-db"
                          type="url"
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          value={dbSheetUrl}
                          onChange={(e) => setDbSheetUrl(e.target.value)}
                          readOnly={!isEditing}
                          disabled={isSaving || isValidatingOnLoad}
                          className={!isEditing ? 'bg-muted/50' : ''}
                        />
                    </div>
                     <div className="mt-1 pl-11">
                        <ValidationResult 
                            isLoading={isSaving || isValidatingOnLoad}
                            title={dbSpreadsheetTitle}
                            error={dbSheetError}
                            verifiedUrl={verifiedDbUrl}
                            currentUrl={dbSheetUrl}
                        />
                    </div>
                 </div>
            </CardContent>
            <CardFooter>
                 {isEditing ? (
                    <Button onClick={handleSaveUrls} disabled={isSaving || isValidatingOnLoad}>
                        {(isSaving || isValidatingOnLoad) ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {(isSaving || isValidatingOnLoad) ? 'Validating...' : 'Save URLs'}
                    </Button>
                 ) : (
                    <Button onClick={handleEditClick} variant="destructive">
                        <Pencil className="mr-2 h-4 w-4" />
                        Change Urls
                    </Button>
                 )}
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
