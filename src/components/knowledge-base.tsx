'use client';

import React, { useState, useEffect, useTransition, useCallback, useContext } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Search, FileText, Download, Eye, Filter, RefreshCw, Folder, BookOpen, Tag, Clock, File, X } from 'lucide-react';
import { runKnowledgeBaseEngine } from '@/app/actions';
import { SettingsContext } from '@/contexts/settings-provider';

const KnowledgeDashboard = () => {
  const { knowledgeBaseUrl } = useContext(SettingsContext);
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
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors">
                  <RefreshCw className="w-4 h-4" />
                  Sync Drive
                </button>
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
                <button 
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded-md transition-colors shadow-sm hover:shadow disabled:opacity-50"
                >
                  {isSearching ? 'Asking...' : 'Ask'}
                </button>
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
                    <div className="bg-card rounded-lg border border-border p-12 text-center">
                      <div className="inline-block p-4 bg-muted rounded-full mb-4">
                        <BookOpen className="w-12 h-12 text-muted-foreground" />
                      </div>
                      <h2 className="text-xl font-semibold text-foreground mb-2">Ready to Answer</h2>
                      <p className="text-muted-foreground mb-8">
                        Enter a question above to get insights from your knowledge base.
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-left">
                        <div className="group p-4 bg-primary/10 hover:bg-primary/20 rounded-lg border border-primary/20 cursor-pointer transition-all" onClick={() => setSearchQuery('login issues')}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">📘</span>
                            <p className="text-sm font-semibold text-primary">Try asking:</p>
                          </div>
                          <p className="text-sm text-primary/80 group-hover:text-primary">"How to handle login issues?"</p>
                        </div>
                        <div className="group p-4 bg-green-500/10 hover:bg-green-500/20 rounded-lg border border-green-500/20 cursor-pointer transition-all" onClick={() => setSearchQuery('payment')}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">🔍</span>
                            <p className="text-sm font-semibold text-green-600">Search for:</p>
                          </div>
                          <p className="text-sm text-green-600/80 group-hover:text-green-600">"payment", "onboarding", "refund"</p>
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
