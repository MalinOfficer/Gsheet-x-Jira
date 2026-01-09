
"use client";

import { useState, useContext, useTransition, useMemo, useEffect, useCallback } from 'react';
import { BookOpen, Search, RefreshCw, Layers, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { runKnowledgeBaseEngine } from '@/app/actions';
import { TableDataContext } from '@/store/table-data-context';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';

type Chunk = {
    page_content: string;
    metadata: {
        source: string;
        headers: string[];
        chunk_id: string;
        processing_timestamp: string;
    };
};

type PipelineResult = {
    processedAt: string;
    source_url: string;
    total_chunks: number;
    chunks: Chunk[];
} | null;


export function KnowledgeBase() {
    const { knowledgeBaseUrl } = useContext(TableDataContext);
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isProcessing, startProcessing] = useTransition();
    const [pipelineResult, setPipelineResult] = useState<PipelineResult>(null);
    const [displayedResults, setDisplayedResults] = useState<Chunk[] | null>(null);

    const handleRunEngine = useCallback(() => {
        // Prevent running if already running or if URL is not set
        if (isProcessing || !knowledgeBaseUrl) {
            if (!knowledgeBaseUrl) {
                toast({
                    variant: 'destructive',
                    title: 'URL Not Configured',
                    description: 'Please set the Knowledge Base URL in the Settings page first.',
                });
            }
            return;
        }
        
        startProcessing(async () => {
            setPipelineResult(null); // Clear previous results
            setDisplayedResults(null);
            
            toast({
                title: 'Building Knowledge Base...',
                description: 'Processing data in the background. You can start typing your query.',
            });

            const buildResult = await runKnowledgeBaseEngine(knowledgeBaseUrl);

            if (buildResult.success && buildResult.data) {
                toast({
                    title: 'Knowledge Base Ready',
                    description: `Processing complete with ${buildResult.data.total_chunks} chunks.`,
                });
                setPipelineResult(buildResult.data);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Processing Failed',
                    description: buildResult.error,
                });
                setPipelineResult(null);
            }
        });
    }, [knowledgeBaseUrl, isProcessing, toast]);

    const handleSearchTrigger = () => {
        if (!pipelineResult) {
            toast({
                variant: 'destructive',
                title: 'Knowledge Base Not Ready',
                description: isProcessing ? 'Please wait for the engine to finish processing.' : 'Please type something to start the engine.',
            });
            return;
        }

        if (!searchTerm.trim()) {
            setDisplayedResults(pipelineResult.chunks); // Show all if search is empty
        } else {
            const lowercasedTerm = searchTerm.toLowerCase();
            const filtered = pipelineResult.chunks.filter(chunk => 
                chunk.page_content.toLowerCase().includes(lowercasedTerm)
            );
            setDisplayedResults(filtered);
        }
    };
    
    // Proactively run engine when user starts typing for the first time
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSearchTerm = e.target.value;
        setSearchTerm(newSearchTerm);

        // If engine hasn't run yet and user starts typing, trigger it in the background.
        if (!pipelineResult && !isProcessing && newSearchTerm.length > 0) {
            handleRunEngine();
        }
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
                           Engine will start when you type. Search for articles, guides, and solutions.
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
                            onChange={handleInputChange}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchTrigger()}
                            className="pl-10 h-12 text-base"
                            disabled={isProcessing && !pipelineResult}
                        />
                    </div>
                    <Button type="submit" onClick={handleSearchTrigger} disabled={isProcessing && !pipelineResult} className="h-12">
                        {isProcessing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        {isProcessing ? "Building..." : "Search"}
                    </Button>
                </div>

                <div className="mt-8">
                    {isProcessing && !pipelineResult ? (
                        <div className="space-y-4">
                           <Skeleton className="h-24 w-full" />
                           <Skeleton className="h-24 w-full" />
                           <Skeleton className="h-24 w-full" />
                        </div>
                    ) : displayedResults !== null ? (
                         <Card>
                            <CardHeader>
                                <CardTitle>Search Results ({displayedResults.length})</CardTitle>
                                <CardDescription>
                                    {searchTerm.trim() ? `Showing results for "${searchTerm}"` : "Showing all processed chunks."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {displayedResults.length > 0 ? (
                                    <ScrollArea className="h-[60vh] pr-4">
                                        <div className="space-y-4">
                                            {displayedResults.map((chunk, index) => (
                                                <Card key={chunk.metadata.chunk_id || index} className="bg-muted/50">
                                                    <CardHeader className='pb-2'>
                                                        <CardTitle className="text-base flex items-center gap-2">
                                                            <Layers className="h-4 w-4 text-primary" />
                                                            Source: {chunk.metadata.source}
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <p className="text-sm text-foreground/80 mb-3">{chunk.page_content}</p>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <FileText className="h-3 w-3" />
                                                            <span>Chunk ID: {chunk.metadata.chunk_id}</span>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center p-8 min-h-[300px]">
                                        <Search className="w-16 h-16 text-muted-foreground mb-4" />
                                        <h3 className="font-semibold text-lg">No Results Found</h3>
                                        <p className="text-muted-foreground mt-1">Your search for "{searchTerm}" did not match any content.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[300px] bg-card">
                            <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
                            <CardTitle>Ready to Search</CardTitle>
                            <CardDescription className="mt-2 mb-4 max-w-sm">
                                {isProcessing 
                                    ? "Engine is warming up in the background..." 
                                    : "Enter a query and click \"Search\" to find answers."
                                }
                            </CardDescription>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
