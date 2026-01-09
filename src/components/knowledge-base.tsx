
"use client";

import { useState, useContext, useTransition } from 'react';
import { BookOpen, Search, FileCog, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { runKnowledgeBaseEngine } from '@/app/actions';
import { TableDataContext } from '@/store/table-data-context';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

// Component for the Knowledge Base page with search functionality
export function KnowledgeBase() {
    const { knowledgeBaseUrl } = useContext(TableDataContext);
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, startProcessing] = useTransition();
    // Placeholder for search results
    const [results, setResults] = useState<any[]>([]);

    const handleSearch = () => {
        if (!searchTerm.trim()) return;

        if (!knowledgeBaseUrl) {
            toast({
                variant: 'destructive',
                title: 'URL Not Configured',
                description: 'Please set the Knowledge Base URL in the Settings page first.',
            });
            return;
        }

        startProcessing(async () => {
            toast({
                title: 'Building Knowledge Base...',
                description: 'Processing data before searching. This may take a moment.',
            });

            const buildResult = await runKnowledgeBaseEngine(knowledgeBaseUrl);

            if (buildResult.success) {
                toast({
                    title: 'Processing Complete',
                    description: 'Knowledge Base is ready. Now searching for your query...',
                });
                
                // --- FUTURE SEARCH LOGIC ---
                // Here you would take the `buildResult.data` and the `searchTerm` 
                // to perform the actual search against the vectorized data.
                // For now, we simulate the search part.
                setIsLoading(true);
                setTimeout(() => {
                    setResults([]); // Resetting to show the placeholder message for now
                    setIsLoading(false);
                     toast({
                        title: 'Search Completed',
                        description: `(Simulation) Finished searching for: "${searchTerm}"`,
                    });
                }, 1000);
                
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Processing Failed',
                    description: buildResult.error,
                });
            }
        });
    };


    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="text-center sm:text-left">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
                            Knowledge Base
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Search for articles, guides, and solutions. The knowledge base will be built on-the-fly.
                        </p>
                    </div>
                </header>

                <div className="flex w-full items-center space-x-2">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Ask a question or search for a topic..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="pl-10 h-12 text-base"
                            disabled={isProcessing}
                        />
                    </div>
                    <Button type="submit" onClick={handleSearch} disabled={isProcessing || isLoading} className="h-12">
                        {isProcessing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        {isProcessing ? "Building..." : (isLoading ? "Searching..." : "Search")}
                    </Button>
                </div>

                <div className="mt-8">
                    {/* This is where search results would be displayed */}
                    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[300px] bg-card">
                        <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
                        <CardTitle>Search Results</CardTitle>
                        <CardDescription className="mt-2 mb-4 max-w-sm">
                            The AI search engine is under construction. Search results will appear here once the engine is connected.
                        </CardDescription>
                    </Card>
                </div>
            </div>
        </div>
    );
}
