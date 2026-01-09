
"use client";

import { useState, useContext, useTransition, useCallback } from 'react';
import { BookOpen, Search, RefreshCw, Bot, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { runKnowledgeBaseEngine } from '@/app/actions';
import { TableDataContext } from '@/store/table-data-context';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';

export function KnowledgeBase() {
    const { knowledgeBaseUrl } = useContext(TableDataContext);
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, startSearch] = useTransition();
    const [aiResponse, setAiResponse] = useState<string | null>(null);

    const handleSearch = useCallback(() => {
        if (!searchTerm.trim()) {
            toast({
                variant: 'destructive',
                title: 'Search is empty',
                description: 'Please ask a question to get started.',
            });
            return;
        }

        if (!knowledgeBaseUrl) {
            toast({
                variant: 'destructive',
                title: 'URL Not Configured',
                description: 'Please set the Knowledge Base URL in the Settings page first.',
            });
            return;
        }
        
        startSearch(async () => {
            setAiResponse(null); // Clear previous response
            const result = await runKnowledgeBaseEngine(knowledgeBaseUrl, searchTerm);

            if (result.success && result.data?.answer) {
                setAiResponse(result.data.answer);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Failed to Get Answer',
                    description: result.error || 'An unknown error occurred.',
                });
                setAiResponse(null);
            }
        });
    }, [searchTerm, knowledgeBaseUrl, toast]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
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
                           Ask questions about your case data in natural language.
                        </p>
                    </div>
                </header>

                <div className="flex w-full items-center space-x-2">
                    <div className="relative flex-grow">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Ask a question, e.g., 'how many CBT cases are there?'"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pl-10 h-12 text-base"
                            disabled={isSearching}
                        />
                    </div>
                    <Button type="submit" onClick={handleSearch} disabled={isSearching} className="h-12">
                        {isSearching ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        {isSearching ? "Thinking..." : "Ask"}
                    </Button>
                </div>

                <div className="mt-8">
                    {isSearching ? (
                        <Card>
                            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                                <Bot className="h-8 w-8 text-primary"/>
                                <CardTitle>AI is generating an answer...</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-4/5" />
                            </CardContent>
                        </Card>
                    ) : aiResponse ? (
                         <Card className="bg-muted/30">
                            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                                <Bot className="h-8 w-8 text-primary"/>
                                <CardTitle>AI Response</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: aiResponse.replace(/\n/g, '<br />') }} />
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[300px] bg-card">
                            <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
                            <CardTitle>Ready to Answer</CardTitle>
                            <CardDescription className="mt-2 mb-4 max-w-sm">
                                Enter a question above to get insights from your knowledge base.
                            </CardDescription>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
