
"use client";

import React, { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
import { Search, FileText, Download, Eye, Filter, RefreshCw, Folder, BookOpen, Tag, Clock, File, Menu, LayoutDashboard, Upload, Database, BarChart3, Settings, X, ShieldOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { runKnowledgeBaseEngine } from '@/app/actions';
import { SettingsContext } from '@/contexts/settings-provider';
import { Button } from './ui/button';

// This is a simplified version of the provided component, adapted to fit the existing app structure.
// The sidebar from the provided code is removed to avoid duplication with the app's main layout.
// Data fetching is integrated with the existing `runKnowledgeBaseEngine` action.

const KnowledgeDashboard = () => {
  const { knowledgeBaseUrl } = React.useContext(SettingsContext);
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, startSearch] = useTransition();
  const [filteredDocs, setFilteredDocs] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAllDocs, setShowAllDocs] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

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
        setFilteredDocs(demoDocuments);
    }, []);

    const handleSearch = useCallback(() => {
        if (!searchQuery.trim()) {
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
            setAiResponse(null); 
            const result = await runKnowledgeBaseEngine(knowledgeBaseUrl, searchQuery);

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
    }, [searchQuery, knowledgeBaseUrl, toast]);


  useEffect(() => {
    if (!searchQuery.trim()) {
      const filtered = documents.filter(doc => {
        const matchesType = filterType === 'all' || doc.type === filterType;
        const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
        return matchesType && matchesCategory;
      });
      setFilteredDocs(filtered);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = documents.filter(doc => {
      const matchesSearch = 
        doc.name.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query) ||
        doc.tags.some((tag: string) => tag.toLowerCase().includes(query)) ||
        doc.category.toLowerCase().includes(query);

      const matchesType = filterType === 'all' || doc.type === filterType;
      const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;

      return matchesSearch && matchesType && matchesCategory;
    });

    const sorted = filtered.sort((a, b) => {
      const aScore = calculateRelevance(a, query);
      const bScore = calculateRelevance(b, query);
      return bScore - aScore;
    });

    setFilteredDocs(sorted);
  }, [searchQuery, filterType, selectedCategory, documents]);

  const calculateRelevance = (doc: any, query: string) => {
    let score = 0;
    if (doc.name.toLowerCase().includes(query)) score += 10;
    if (doc.tags.some((tag: string) => tag.toLowerCase().includes(query))) score += 5;
    if (doc.content.toLowerCase().includes(query)) score += 3;
    return score;
  };

  const handleDocumentClick = (doc: any) => {
    setSelectedDoc(doc);
  };

  const getFileIcon = (type: string) => {
    const icons: Record<string, string> = {
      docx: '📄',
      xlsx: '📊',
      pdf: '📕',
      default: '📁'
    };
    return icons[type] || icons.default;
  };

  const categories = ['all', 'Onboarding', 'Payment', 'Technical', 'Product', 'Support'];

  const highlightText = (text: string, query: string) => {
    if (!query || typeof text !== 'string') return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-yellow-200 px-1 rounded">{part}</mark>
        : part
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-y-auto">
        <div className="bg-white border-b border-gray-200 px-6 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Ask a question, e.g., 'how many CBT cases are there?'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter') handleSearch(); }}
                className="w-full pl-12 pr-24 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                disabled={isSearching}
              />
              <button 
                onClick={handleSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors shadow-sm hover:shadow"
                disabled={isSearching}
              >
                {isSearching ? 'Asking...' : 'Ask'}
              </button>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{documents.length}</div>
                <div className="text-xs text-gray-500">Total Documents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{filteredDocs.length}</div>
                <div className="text-xs text-gray-500">Search Results</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{categories.length - 1}</div>
                <div className="text-xs text-gray-500">Categories</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">✓</div>
                <div className="text-xs text-gray-500">Drive Connected</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 flex-grow">
          {aiResponse ? (
             <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">AI Answer</h2>
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: aiResponse.replace(/\n/g, '<br />') }} />
                <Button onClick={() => setAiResponse(null)} className="mt-4">Clear Answer</Button>
            </div>
          ) : !selectedDoc ? (
            <div className="max-w-6xl mx-auto">
              {searchQuery || showAllDocs ? (
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-3 space-y-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                        <Folder className="w-4 h-4" />
                        Category
                      </h3>
                      <div className="space-y-1">
                        {categories.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                              selectedCategory === cat
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            {cat === 'all' ? 'All Categories' : cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        File Type
                      </h3>
                      <div className="space-y-1">
                        {['all', 'docx', 'xlsx', 'pdf'].map(type => (
                          <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                              filterType === type
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            {type === 'all' ? 'All Files' : type.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-9 space-y-3">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {showAllDocs && !searchQuery ? 'All Documents' : 'Search Results'}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''} found
                        </p>
                      </div>
                      {(showAllDocs || searchQuery) && (
                        <button
                          onClick={() => {
                            setShowAllDocs(false);
                            setSearchQuery('');
                            setFilterType('all');
                            setSelectedCategory('all');
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-all"
                        >
                          <X className="w-4 h-4" />
                          Clear
                        </button>
                      )}
                    </div>

                    {filteredDocs.length === 0 ? (
                      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                        <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No results found</h3>
                        <p className="text-sm text-gray-500">Try different keywords or filters</p>
                      </div>
                    ) : (
                      filteredDocs.map(doc => (
                        <div
                          key={doc.id}
                          onClick={() => handleDocumentClick(doc)}
                          className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer p-4 group"
                        >
                          <div className="flex items-start gap-4">
                            <div className="text-3xl group-hover:scale-110 transition-transform">{getFileIcon(doc.type)}</div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                                {highlightText(doc.name, searchQuery)}
                              </h3>
                              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                {highlightText(doc.content.substring(0, 150), searchQuery)}...
                              </p>
                              <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded">
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
                                    className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100 transition-colors"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                                {doc.tags.length > 3 && (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                    +{doc.tags.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                            <button className="text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <div className="inline-block p-4 bg-gray-50 rounded-full mb-4">
                      <BookOpen className="w-12 h-12 text-gray-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Ready to Answer</h2>
                    <p className="text-gray-600 mb-8">
                      Enter a question above to get insights from your knowledge base.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div className="group p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 cursor-pointer transition-all" onClick={() => setSearchQuery('login issues')}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">📘</span>
                          <p className="text-sm font-semibold text-blue-900">Try asking:</p>
                        </div>
                        <p className="text-sm text-blue-700 group-hover:text-blue-900">"How to handle login issues?"</p>
                      </div>
                      <div className="group p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 cursor-pointer transition-all" onClick={() => setSearchQuery('payment')}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">🔍</span>
                          <p className="text-sm font-semibold text-green-900">Search for:</p>
                        </div>
                        <p className="text-sm text-green-700 group-hover:text-green-900">"payment", "onboarding", "refund"</p>
                      </div>
                    </div>
                    
                    <div className="mt-8 pt-8 border-t border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">Popular Topics</h3>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {['login', 'payment', 'onboarding', 'refund', 'troubleshooting', 'features'].map(topic => (
                          <button
                            key={topic}
                            onClick={() => setSearchQuery(topic)}
                            className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-700 hover:text-blue-600 hover:border-blue-300 transition-all"
                          >
                            {topic}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-8">
                      <button
                        onClick={() => setShowAllDocs(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all"
                      >
                        <Folder className="w-5 h-5" />
                        Browse All Documents ({documents.length})
                      </button>
                    </div>

                    <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-lg">✨</span>
                        <p className="text-sm font-semibold text-amber-900">Recently Updated</p>
                      </div>
                      <p className="text-xs text-amber-800">
                        {documents.length} documents synced from Google Drive • Last sync: Today at 10:30 AM
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
                  >
                    <span>←</span> Back to results
                  </button>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg transition-colors">
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors shadow-sm hover:shadow">
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>

                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
                  <div className="flex items-start gap-4 mb-3">
                    <div className="text-5xl">{getFileIcon(selectedDoc.type)}</div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {selectedDoc.name}
                      </h2>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <span className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200">
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
                        {selectedDoc.tags.map((tag: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-200 cursor-pointer transition-colors"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Document Content
                    </h3>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors">
                        Copy
                      </button>
                      <button className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors">
                        Print
                      </button>
                    </div>
                  </div>
                  
                  <div className="prose max-w-none">
                    <div className="text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-6 rounded-lg border border-gray-200">
                      {selectedDoc.content}
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Folder className="w-5 h-5" />
                      Related Documents
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {documents
                        .filter(d => d.id !== selectedDoc.id && d.category === selectedDoc.category)
                        .slice(0, 4)
                        .map(doc => (
                          <div
                            key={doc.id}
                            onClick={() => handleDocumentClick(doc)}
                            className="p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg cursor-pointer transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-2xl">{getFileIcon(doc.type)}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">
                                  {doc.name}
                                </p>
                                <p className="text-xs text-gray-500">{doc.category}</p>
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
