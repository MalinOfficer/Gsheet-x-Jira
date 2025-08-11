
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, AlertCircle, Server, Calendar as CalendarIcon } from 'lucide-react';
import { fetchExampleData, type Todo } from '../api-actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';


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
  const [fetchOption, setFetchOption] = useState<'today' | 'specific'>('today');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const handleFetchClick = async () => {
    setIsLoading(true);
    setError(null);
    setData(null);

    let dateToFetch: string | undefined;

    if (fetchOption === 'today') {
      dateToFetch = format(new Date(), 'yyyy-MM-dd');
    } else if (selectedDate) {
      dateToFetch = format(selectedDate, 'yyyy-MM-dd');
    }

    // Panggil Server Action dengan tanggal yang dipilih
    const result = await fetchExampleData(dateToFetch);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setData(result.data);
    }

    setIsLoading(false);
  };
  
  const isButtonDisabled = isLoading || (fetchOption === 'specific' && !selectedDate);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-primary font-headline">API Integration Example</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                This page demonstrates how to call a server-side function (Server Action) to fetch data from an external API, with date selection options.
            </p>
        </header>

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Fetch External Data</CardTitle>
                <CardDescription>
                    Choose a date option, then click the button. This will trigger a Server Action that securely calls an API from the server.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <RadioGroup
                        defaultValue="today"
                        onValueChange={(value: 'today' | 'specific') => setFetchOption(value)}
                        className="flex items-center space-x-4"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="today" id="r-today" />
                            <Label htmlFor="r-today">Today</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="specific" id="r-specific" />
                            <Label htmlFor="r-specific">Specific Date</Label>
                        </div>
                    </RadioGroup>

                    {fetchOption === 'specific' && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[280px] justify-start text-left font-normal",
                                        !selectedDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    )}

                    <Button onClick={handleFetchClick} disabled={isButtonDisabled}>
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
                </div>

                <div className="mt-6 min-h-[150px]">
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
