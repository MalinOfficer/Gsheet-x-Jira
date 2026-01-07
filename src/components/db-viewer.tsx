
"use client";

import { AlertTriangle, Database, Cloud } from "lucide-react";
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

interface DbViewerProps {
    initialData: any[] | null;
    source: 'cache' | 'sheet' | 'N/A';
    error?: string;
}

export function DbViewer({ initialData, source, error }: DbViewerProps) {

    if (error) {
        return (
            <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                        <CardTitle>Failed to Load "All Case" Data</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">
                            {error}
                        </CardDescription>
                    </Card>
                </div>
            </div>
        );
    }

    if (!initialData || initialData.length === 0) {
        return (
             <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                        <Database className="w-16 h-16 text-muted-foreground mb-4" />
                        <CardTitle>No Data Found</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">
                            The "All Case" database is currently empty.
                        </CardDescription>
                    </Card>
                </div>
            </div>
        );
    }
    
    const headers = Object.keys(initialData[0]);

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
                    <Badge variant={source === 'cache' ? 'default' : 'secondary'} className="w-fit">
                        {source === 'cache' ? <Database className="mr-2 h-4 w-4"/> : <Cloud className="mr-2 h-4 w-4"/>}
                        Data source: {source}
                    </Badge>
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
                                    {initialData.map((row, rowIndex) => (
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
