'use client';

import React, { useState, useEffect, useTransition, useCallback, useContext } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Search, FileText, RefreshCw, Folder, BookOpen } from 'lucide-react';
import { runKnowledgeBaseEngine } from '@/app/actions';
import { SettingsContext } from '@/contexts/settings-provider';
import { Button } from './ui/button';

const KnowledgeDashboard = () => {
  const { knowledgeBaseUrl, kbSpreadsheetTitle } = useContext(SettingsContext);
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      toast({
        variant: "destructive",
        title: "Query is empty",
        description: "Please enter a question to search.",
      });
      return;
    }

    startSearch(async () => {
      setAiResponse(null);
      const result = await runKnowledgeBaseEngine(knowledgeBaseUrl, searchQuery);
      if (result.success && result.data) {
        setAiResponse(result.data.answer);
      } else {
        setAiResponse(`Error: ${result.error}`);
        toast({
          variant: "destructive",
          title: "AI Engine Error",
          description: result.error,
        });
      }
    });
  }, [searchQuery, knowledgeBaseUrl, toast]);


  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto">
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* Header */}
          <div className="bg-card border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
                <p className="text-sm text-muted-foreground">Ask questions about your case data in natural language.</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-card px-6 py-6 border-b border-border">
            <div className="max-w-4xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Ask a question, e.g., 'how many CBT cases are there?'"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => { if (e.key === 'Enter') handleSearch() }}
                  className="w-full pl-12 pr-24 py-3 border border-input rounded-lg text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
                <Button 
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                >
                  {isSearching ? 'Asking...' : 'Ask'}
                </Button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6">
              <div className="max-w-4xl mx-auto">
                {isSearching ? (
                  <div className="bg-card rounded-lg border border-border p-12 text-center">
                    <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-3 animate-spin" />
                    <h3 className="text-lg font-semibold text-foreground mb-1">Searching...</h3>
                    <p className="text-sm text-muted-foreground">AI is analyzing the documents.</p>
                  </div>
                ) : aiResponse ? (
                  <div className="mb-6 bg-primary/10 border border-primary/20 rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-primary mb-3">AI Answer:</h2>
                    <div className="prose dark:prose-invert max-w-none text-foreground whitespace-pre-wrap">{aiResponse}</div>
                  </div>
                ) : (
                  // Empty State
                  <div className="max-w-2xl mx-auto">
                    <div className="bg-card rounded-lg border border-border p-8 text-center">
                      <div className="inline-block p-4 bg-muted rounded-full mb-4">
                        <BookOpen className="w-12 h-12 text-muted-foreground" />
                      </div>
                      <h2 className="text-xl font-semibold text-foreground mb-2">Ready to Answer</h2>
                      <p className="text-muted-foreground mb-6">
                        Enter a question above to get insights from your knowledge base.
                      </p>
                      
                       <div className="border-t pt-4">
                        <p className="text-xs text-muted-foreground mb-2">CURRENT DATA SOURCE</p>
                        <div className="flex items-center justify-center gap-2 p-3 bg-muted rounded-md text-sm">
                            <Folder className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-foreground truncate">{kbSpreadsheetTitle || 'Not Configured'}</span>
                            <Button variant="link" size="sm" className="h-auto p-0 text-xs as-child">
                               <Link href="/settings">Change</Link>
                            </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
          </div>
        </div>
      </div>
  );
};
export default KnowledgeDashboard;
