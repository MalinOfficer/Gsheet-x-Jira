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

  const [documents, setDocuments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDocs, setFilteredDocs] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [showAllDocs, setShowAllDocs] = useState(false);

  // Demo data
  const demoDocuments = [
    {
      id: '1',
      name: 'Panduan Onboarding Customer',
      type: 'docx',
      category: 'Onboarding',
      content: 'Langkah-langkah onboarding customer baru meliputi verifikasi data, setup akun, training awal, dan follow-up. Detail proses:\n\n1. Verifikasi Data Customer\n- Pastikan data lengkap dan valid\n- Cek dokumen pendukung\n- Konfirmasi email dan nomor telepon\n\n2. Setup Akun\n- Buat akun di sistem\n- Set permission sesuai paket\n- Kirim welcome email\n\n3. Training Awal\n- Schedule training session\n- Berikan user guide\n- Demo fitur utama\n\n4. Follow-up\n- Check-in setelah 1 minggu\n- Tanyakan kendala\n- Berikan support tambahan jika diperlukan',
      tags: ['onboarding', 'customer', 'setup', 'training'],
      lastModified: '2024-01-10',
      size: '245 KB',
      driveId: 'gdrive_001'
    },
    {
      id: '2',
      name: 'FAQ Pembayaran',
      type: 'xlsx',
      category: 'Payment',
      content: 'Pertanyaan umum tentang metode pembayaran, invoice, refund, dan billing cycle.\n\nMetode Pembayaran:\n- Transfer Bank (BCA, Mandiri, BNI)\n- Virtual Account\n- Credit Card\n- E-wallet (GoPay, OVO, Dana)\n\nProses Refund:\n- Request refund maksimal 7 hari\n- Proses 3-5 hari kerja\n- Dana kembali ke metode pembayaran asal\n\nBilling Cycle:\n- Monthly: setiap tanggal berlangganan\n- Yearly: diskon 20%\n- Invoice dikirim H-3 via email',
      tags: ['payment', 'invoice', 'refund', 'billing'],
      lastModified: '2024-01-12',
      size: '128 KB',
      driveId: 'gdrive_002'
    },
    {
      id: '3',
      name: 'Troubleshooting Login Issues',
      type: 'pdf',
      category: 'Technical',
      content: 'Panduan mengatasi masalah login:\n\n1. Lupa Password\n- Klik "Forgot Password" di halaman login\n- Masukkan email terdaftar\n- Cek email untuk reset link\n- Link valid 24 jam\n- Buat password baru (min 8 karakter)\n\n2. Akun Terkunci\n- Terjadi setelah 5x gagal login\n- Auto unlock setelah 30 menit\n- Atau hubungi admin untuk unlock manual\n\n3. Error Autentikasi\n- Clear browser cache dan cookies\n- Coba browser lain\n- Pastikan koneksi internet stabil\n- Disable VPN jika ada\n\n4. Two-Factor Authentication\n- Gunakan Google Authenticator atau SMS\n- Backup codes tersedia di profile settings',
      tags: ['login', 'password', 'authentication', 'troubleshooting'],
      lastModified: '2024-01-15',
      size: '890 KB',
      driveId: 'gdrive_003'
    },
    {
      id: '4',
      name: 'Product Feature Updates Q1 2024',
      type: 'docx',
      category: 'Product',
      content: 'Update fitur terbaru Q1 2024:\n\n✨ New Features:\n\n1. Dashboard Analytics\n- Real-time data visualization\n- Custom report builder\n- Export to PDF/Excel\n- Scheduled reports via email\n\n2. Advanced Export\n- Bulk export data\n- Custom field selection\n- Multiple format support\n- API integration\n\n3. New API Endpoints\n- Webhook support\n- REST API v2\n- Better rate limiting\n- Improved documentation\n\n4. Mobile App Enhancement\n- Offline mode\n- Push notifications\n- Dark mode\n- Biometric login\n\n🔧 Improvements:\n- 40% faster page load\n- Better search algorithm\n- Enhanced security\n- UI/UX refinements',
      tags: ['product', 'features', 'updates', 'analytics'],
      lastModified: '2024-01-14',
      size: '512 KB',
      driveId: 'gdrive_004'
    },
    {
      id: '5',
      name: 'Customer Complaint Handling',
      type: 'docx',
      category: 'Support',
      content: 'SOP Handling Customer Complaint:\n\n📋 Proses Standar:\n\n1. Penerimaan Complaint\n- Dengarkan dengan empati\n- Catat detail lengkap\n- Acknowledge dalam 1 jam\n- Buat ticket di sistem\n\n2. Analisis & Kategorisasi\n- Tentukan severity (Low/Medium/High)\n- Identifikasi root cause\n- Cek history customer\n\n3. Eskalasi (jika diperlukan)\n- Low: Handle sendiri\n- Medium: Supervisor approval\n- High: Manager + tim terkait\n\n4. Resolution\n- Berikan solusi konkret\n- Timeline yang jelas\n- Follow SLA agreement\n\n5. Follow-up\n- Konfirmasi resolution\n- Survey kepuasan\n- Update knowledge base\n\n⏰ SLA Response Time:\n- High: 2 jam\n- Medium: 4 jam\n- Low: 24 jam',
      tags: ['complaint', 'support', 'escalation', 'resolution'],
      lastModified: '2024-01-11',
      size: '156 KB',
      driveId: 'gdrive_005'
    },
    {
      id: '6',
      name: 'Data Migration Guide',
      type: 'docx',
      category: 'Technical',
      content: 'Panduan Migrasi Data Customer:\n\n1. Pre-Migration\n- Backup data existing\n- Validasi format data\n- Mapping field structure\n- Test environment ready\n\n2. Migration Process\n- Schedule downtime (off-peak)\n- Run migration script\n- Validate data integrity\n- Rollback plan ready\n\n3. Post-Migration\n- Data verification\n- User acceptance test\n- Performance monitoring\n- Documentation update',
      tags: ['migration', 'data', 'technical', 'backup'],
      lastModified: '2024-01-09',
      size: '324 KB',
      driveId: 'gdrive_006'
    }
  ];

  useEffect(() => {
    setDocuments(demoDocuments);
  }, []);

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

  const calculateRelevance = (doc: any, query: any) => {
    let score = 0;
    if (doc.name.toLowerCase().includes(query)) score += 10;
    if (doc.tags.some((tag: string) => tag.toLowerCase().includes(query))) score += 5;
    if (doc.content.toLowerCase().includes(query)) score += 3;
    return score;
  };

  useEffect(() => {
    if (!searchQuery.trim() && !showAllDocs) {
        setFilteredDocs([]);
        return;
    }
    
    let baseDocs = documents;
    
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        baseDocs = documents.filter(doc => 
            doc.name.toLowerCase().includes(query) ||
            doc.content.toLowerCase().includes(query) ||
            doc.tags.some((tag: string) => tag.toLowerCase().includes(query))
        );
    }
    
    const filtered = baseDocs.filter(doc => {
        const matchesType = filterType === 'all' || doc.type === filterType;
        const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
        return matchesType && matchesCategory;
    });

    const sorted = filtered.sort((a, b) => {
        const query = searchQuery.toLowerCase().trim();
        const aScore = query ? calculateRelevance(a, query) : 0;
        const bScore = query ? calculateRelevance(b, query) : 0;
        if (bScore !== aScore) {
            return bScore - aScore;
        }
        // If scores are equal, sort by lastModified date
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
    });

    setFilteredDocs(sorted);
  }, [searchQuery, filterType, selectedCategory, documents, showAllDocs]);

  const handleDocumentClick = (doc: any) => {
    setSelectedDoc(doc);
  };

  const getFileIcon = (type: any) => {
    const icons: Record<string, string> = {
      docx: '📄',
      xlsx: '📊',
      pdf: '📕',
      default: '📁'
    };
    return icons[type] || icons.default;
  };

  const categories = ['all', 'Onboarding', 'Payment', 'Technical', 'Product', 'Support'];

  const highlightText = (text: any, query: any) => {
    if (!query || typeof text !== 'string') return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-600 px-1 rounded">{part}</mark>
        : part
    );
  };

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
              
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{documents.length}</div>
                  <div className="text-xs text-muted-foreground">Total Documents</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{filteredDocs.length}</div>
                  <div className="text-xs text-muted-foreground">Search Results</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{categories.length - 1}</div>
                  <div className="text-xs text-muted-foreground">Categories</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">✓</div>
                  <div className="text-xs text-muted-foreground">Drive Connected</div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6">
            {!selectedDoc ? (
              <div className="max-w-6xl mx-auto">
                {isSearching ? (
                  <div className="bg-card rounded-lg border border-border p-12 text-center">
                    <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-3 animate-spin" />
                    <h3 className="text-lg font-semibold text-foreground mb-1">Searching...</h3>
                    <p className="text-sm text-muted-foreground">AI is analyzing the documents.</p>
                  </div>
                ) : aiResponse ? (
                  <div className="mb-6 bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <h2 className="text-lg font-semibold text-primary mb-2">AI Answer:</h2>
                    <div className="text-foreground whitespace-pre-wrap">{aiResponse}</div>
                  </div>
                ) : null}

                {searchQuery || showAllDocs ? (
                  // Search Results
                  <div className="grid grid-cols-12 gap-6">
                    {/* Filters Sidebar */}
                    <div className="col-span-3 space-y-4">
                      <div className="bg-card rounded-lg border border-border p-4">
                        <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                          <Folder className="w-4 h-4" />
                          Category
                        </h3>
                        <div className="space-y-1">
                          {categories.map(cat => (
                            <button
                              key={cat}
                              onClick={() => setSelectedCategory(cat)}
                              className={cn('w-full text-left px-3 py-1.5 rounded text-sm transition-colors', {
                                'bg-primary/10 text-primary font-medium': selectedCategory === cat,
                                'hover:bg-accent text-foreground': selectedCategory !== cat
                              })}
                            >
                              {cat === 'all' ? 'All Categories' : cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-card rounded-lg border border-border p-4">
                        <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                          <Filter className="w-4 h-4" />
                          File Type
                        </h3>
                        <div className="space-y-1">
                          {['all', 'docx', 'xlsx', 'pdf'].map(type => (
                            <button
                              key={type}
                              onClick={() => setFilterType(type)}
                              className={cn('w-full text-left px-3 py-1.5 rounded text-sm transition-colors', {
                                'bg-primary/10 text-primary font-medium': filterType === type,
                                'hover:bg-accent text-foreground': filterType !== type
                              })}
                            >
                              {type === 'all' ? 'All Files' : type.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Results */}
                    <div className="col-span-9 space-y-3">
                      {/* Results Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">
                            {showAllDocs && !searchQuery ? 'All Documents' : 'Search Results'}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''} found
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setAiResponse(null);
                            setShowAllDocs(false);
                            setFilterType('all');
                            setSelectedCategory('all');
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground bg-card hover:bg-accent border border-border rounded-lg transition-all"
                        >
                          <X className="w-4 h-4" />
                          Clear
                        </button>
                      </div>

                      {filteredDocs.length === 0 && !isSearching ? (
                        <div className="bg-card rounded-lg border border-border p-12 text-center">
                          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                          <h3 className="text-lg font-semibold text-foreground mb-1">No results found</h3>
                          <p className="text-sm text-muted-foreground">Try different keywords or filters</p>
                        </div>
                      ) : (
                        filteredDocs.map(doc => (
                          <div
                            key={doc.id}
                            onClick={() => handleDocumentClick(doc)}
                            className="bg-card rounded-lg border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer p-4 group"
                          >
                            <div className="flex items-start gap-4">
                              <div className="text-3xl group-hover:scale-110 transition-transform">{getFileIcon(doc.type)}</div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                                  {highlightText(doc.name, searchQuery)}
                                </h3>
                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                  {highlightText(doc.content.substring(0, 150), searchQuery)}...
                                </p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded">
                                    <Tag className="w-3 h-3" />
                                    {doc.category}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {doc.lastModified}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <File className="w-3 h-3" />
                                    {doc.size}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {doc.tags.slice(0, 3).map((tag: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20 transition-colors"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                  {doc.tags.length > 3 && (
                                    <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">
                                      +{doc.tags.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button className="text-primary hover:text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
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
                      
                      {/* Popular Topics */}
                      <div className="mt-8 pt-8 border-t border-border">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-4">Popular Topics</h3>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {['login', 'payment', 'onboarding', 'refund', 'troubleshooting', 'features'].map(topic => (
                            <button
                              key={topic}
                              onClick={() => setSearchQuery(topic)}
                              className="px-4 py-2 bg-card hover:bg-accent border border-border rounded-full text-sm text-foreground hover:text-primary hover:border-primary/50 transition-all"
                            >
                              {topic}
                            </button>
                          ))}
                        </div>
                      </div>

                       {/* All Documents Button */}
                      <div className="mt-8">
                        <button
                          onClick={() => setShowAllDocs(true)}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium rounded-lg shadow-md hover:shadow-lg transition-all"
                        >
                          <Folder className="w-5 h-5" />
                          Browse All Documents ({documents.length})
                        </button>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Document Detail View
              <div className="max-w-4xl mx-auto">
                <div className="bg-card rounded-lg border border-border shadow-sm">
                  {/* Header Actions */}
                  <div className="flex items-center justify-between p-6 border-b border-border">
                    <button
                      onClick={() => setSelectedDoc(null)}
                      className="flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm transition-colors"
                    >
                      <span>←</span> Back to results
                    </button>
                    <div className="flex gap-2">
                      <button className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-accent border border-border text-foreground text-sm rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded-lg transition-colors shadow-sm hover:shadow">
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>

                  {/* Document Info */}
                  <div className="p-6 border-b border-border bg-gradient-to-r from-primary/10 to-card">
                    <div className="flex items-start gap-4 mb-3">
                      <div className="text-5xl">{getFileIcon(selectedDoc.type)}</div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                          {selectedDoc.name}
                        </h2>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          <span className="flex items-center gap-1 px-2 py-1 bg-card rounded border border-border">
                            <Tag className="w-4 h-4" />
                            {selectedDoc.category}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Last updated: {selectedDoc.lastModified}
                          </span>
                          <span className="flex items-center gap-1">
                            <File className="w-4 h-4" />
                            {selectedDoc.size}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedDoc.tags.map((tag: any, idx: number) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium hover:bg-primary/30 cursor-pointer transition-colors"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Document Content */}
                  <div className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Document Content
                      </h3>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground rounded transition-colors">
                          Copy
                        </button>
                        <button className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground rounded transition-colors">
                          Print
                        </button>
                      </div>
                    </div>
                    
                    <div className="prose dark:prose-invert max-w-none">
                      <div className="text-foreground leading-relaxed whitespace-pre-line bg-muted/50 p-6 rounded-lg border border-border">
                        {selectedDoc.content}
                      </div>
                    </div>

                    {/* Related Documents */}
                    <div className="mt-8 pt-8 border-t border-border">
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Folder className="w-5 h-5" />
                        Related Documents
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {documents
                          .filter((d: any) => d.id !== selectedDoc.id && d.category === selectedDoc.category)
                          .slice(0, 4)
                          .map((doc: any) => (
                            <div
                              key={doc.id}
                              onClick={() => handleDocumentClick(doc)}
                              className="p-3 bg-card hover:bg-accent border border-border rounded-lg cursor-pointer transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-2xl">{getFileIcon(doc.type)}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground group-hover:text-primary truncate">
                                    {doc.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{doc.category}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
};
export default KnowledgeDashboard;
