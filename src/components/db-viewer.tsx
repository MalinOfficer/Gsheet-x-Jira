
"use client";

import { AlertTriangle, Database, Cloud, RefreshCw } from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardHeader, 
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "./ui/button";
import { useContext, useEffect, useState, useRef, useMemo } from "react";
import { TableDataContext } from "@/store/table-data-context";
import { getAllCaseData } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from "@/lib/utils";


interface DbViewerState {
    data: any[] | null;
    source: 'cache' | 'sheet' | 'N/A';
    error?: string;
    loading: boolean;
}

export function DbViewer() {
    const { dbSheetUrl } = useContext(TableDataContext);
    const [state, setState] = useState<DbViewerState>({
        data: null,
        source: 'N/A',
        loading: true,
    });
    const { toast } = useToast();
    const tableContainerRef = useRef<HTMLDivElement>(null);


    const fetchData = async (showToast = false) => {
        if (!dbSheetUrl) {
            setState({ data: null, source: 'N/A', error: 'DB GSheet URL is not configured in Settings.', loading: false });
            return;
        }

        setState(prevState => ({ ...prevState, loading: true }));
        const result = await getAllCaseData(dbSheetUrl);
        setState({
            data: result.data || null,
            source: result.source || 'N/A',
            error: result.error,
            loading: false,
        });

        if (showToast) {
            if (result.error) {
                 toast({ variant: 'destructive', title: "Refresh Failed", description: result.error });
            } else {
                 toast({ title: "Data Refreshed", description: `Data loaded from ${result.source}.` });
            }
        }
    };
    
    useEffect(() => {
        fetchData();
    }, [dbSheetUrl]);
    
    const headers = state.data ? Object.keys(state.data[0]) : [];
    
    const rowVirtualizer = useVirtualizer({
        count: state.data?.length ?? 0,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 49, // h-12 (48px) + 1px border
        overscan: 5,
    });
    
    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalHeight = rowVirtualizer.getTotalSize();

    const getColumnWidth = (header: string) => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('detail case') || lowerHeader.includes('penanganan case')) {
            return 350;
        }
        if (lowerHeader.includes('client') || lowerHeader.includes('customer name') || lowerHeader.includes('ticket number')) {
            return 180;
        }
        if (lowerHeader === 'no') {
            return 60;
        }
        // Default width for other columns
        return 120;
    };

    const totalWidth = useMemo(() => headers.reduce((acc, header) => acc + getColumnWidth(header), 0), [headers]);


    if (state.loading && !state.data) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                 <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <RefreshCw className="w-16 h-16 text-muted-foreground mb-4 animate-spin" />
                        <CardTitle>Loading "All Case" Data...</CardTitle>
                    </Card>
                </div>
            </div>
        )
    }

    if (state.error) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                        <CardTitle>Failed to Load "All Case" Data</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">
                            {state.error}
                        </CardDescription>
                         <Button onClick={() => fetchData(true)} disabled={state.loading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
                            Try Again
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    if (!state.data || state.data.length === 0) {
        return (
             <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <Database className="w-16 h-16 text-muted-foreground mb-4" />
                        <CardTitle>No Data Found</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">
                            The "All Case" database is currently empty.
                        </CardDescription>
                         <Button onClick={() => fetchData(true)} disabled={state.loading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
                            Refresh Now
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                 <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">All Case Database</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                          Menampilkan semua data dari Google Sheet "All Case".
                        </p>
                    </div>
                     <div className="flex items-center gap-2">
                         <Button onClick={() => fetchData(true)} size="sm" variant="outline" disabled={state.loading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Badge variant={state.source === 'cache' ? 'default' : 'secondary'} className="w-fit">
                            {state.source === 'cache' ? <Database className="mr-2 h-4 w-4"/> : <Cloud className="mr-2 h-4 w-4"/>}
                            Data source: {state.source}
                        </Badge>
                    </div>
                </header>
                
                <Card>
                    <CardContent className="p-0">
                        <div ref={tableContainerRef} className="overflow-auto h-[75vh] border rounded-md">
                           <table className="text-sm" style={{ tableLayout: 'fixed', width: totalWidth }}>
                                <thead className="sticky top-0 bg-muted z-10">
                                    <tr className="border-b transition-colors hover:bg-muted/50 flex items-center" style={{ width: totalWidth }}>
                                        {headers.map(header => (
                                            <th 
                                                key={header} 
                                                className={cn(
                                                    "h-12 px-4 text-left font-medium text-muted-foreground flex items-center",
                                                    header.toLowerCase().includes('first response') ? "whitespace-normal" : "whitespace-nowrap"
                                                )}
                                                style={{ width: getColumnWidth(header), flexShrink: 0 }}
                                            >
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody style={{ height: `${totalHeight}px`, position: 'relative' }}>
                                    {virtualRows.map((virtualRow) => {
                                        const row = state.data![virtualRow.index];
                                        return (
                                            <tr 
                                                key={virtualRow.key}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: totalWidth,
                                                    height: `${virtualRow.size}px`,
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                    display: 'flex',
                                                }}
                                                className="border-b transition-colors hover:bg-muted/50"
                                            >
                                                {headers.map(header => (
                                                    <td key={header} className="p-4 align-middle truncate" style={{ width: getColumnWidth(header), flexShrink: 0 }}>
                                                        {row[header]}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                           </table>
                        </div>
                    </CardContent>
                    <CardFooter className="p-2 border-t text-xs text-muted-foreground">
                        Showing {virtualRows.length > 0 ? virtualRows.length : state.data.length} of {state.data.length} rows.
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
