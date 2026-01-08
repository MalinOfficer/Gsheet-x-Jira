
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
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "./ui/button";
import { useContext, useEffect, useState } from "react";
import { TableDataContext } from "@/store/table-data-context";
import { getAllCaseData } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";


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
    
    const headers = Object.keys(state.data[0]);

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
                        <div className="overflow-x-auto h-[75vh]">
                            <Table>
                                <TableHeader className="sticky top-0 bg-muted z-10">
                                    <TableRow>
                                        {headers.map(header => (
                                            <TableHead key={header}>{header}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {state.data.map((row, rowIndex) => (
                                        <TableRow key={rowIndex}>
                                            {headers.map(header => (
                                                <TableCell key={`${rowIndex}-${header}`}>
                                                    {row[header]}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    <CardFooter className="p-2 border-t overflow-x-auto">
                        <div className="text-xs text-muted-foreground">Scroll horizontally to see more columns.</div>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
