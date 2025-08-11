
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, Server } from 'lucide-react';
import { fetchExampleData, type Todo } from '../api-actions';

// Komponen untuk menampilkan data yang berhasil diambil
function DataDisplay({ data }: { data: Todo }) {
    return (
        <Card className="mt-4 bg-muted/50">
            <CardHeader>
                <CardTitle>Success!</CardTitle>
                <CardDescription>Data successfully fetched from the API.</CardDescription>
            </CardHeader>
            <CardContent>
                <pre className="p-4 bg-background rounded-md overflow-x-auto text-sm">
                    {JSON.stringify(data, null, 2)}
                </pre>
            </CardContent>
        </Card>
    );
}

// Komponen untuk menampilkan pesan error
function ErrorDisplay({ message }: { message: string }) {
    return (
        <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );
}

export default function ApiExamplePage() {
  const [data, setData] = useState<Todo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFetchClick = async () => {
    setIsLoading(true);
    setError(null);
    setData(null);

    // Panggil Server Action
    const result = await fetchExampleData();

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setData(result.data);
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-primary font-headline">API Integration Example</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                This page demonstrates how to call a server-side function (Server Action) to fetch data from an external API.
            </p>
        </header>

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Fetch External Data</CardTitle>
                <CardDescription>
                    Click the button below. This will trigger a Server Action that securely calls the JSONPlaceholder API from the server and returns the data here.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleFetchClick} disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Fetching...
                        </>
                    ) : (
                        <>
                            <Server className="mr-2 h-4 w-4" />
                            Fetch Data from Server
                        </>
                    )}
                </Button>

                <div className="mt-4 min-h-[150px]">
                    {isLoading && (
                        <div className="flex items-center justify-center pt-10">
                             <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {error && <ErrorDisplay message={error} />}
                    {data && <DataDisplay data={data} />}
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
