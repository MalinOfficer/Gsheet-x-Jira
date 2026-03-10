"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import {
  mapDBArrayToFrontend,
  getSelectColumns,
  type YourDBRow,
  normalizeClientName,
} from "@/lib/db-mapper";

// ============================================
// HELPERS
// ============================================

const formatDate = (date: any) => {
    if (!date) return null;
    try {
        const d = new Date(date);
        if (d.getUTCHours() >= 12) {
          d.setUTCDate(d.getUTCDate() + 1);
        }
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error('Invalid date:', date);
        return null;
    }
};

// ============================================
// FETCH ALL CASES DATA
// ============================================

export async function getAllCaseData(filters?: {
  year?: string;
  category?: string[];
  client?: string[];
  module?: string[];
  status?: string[];
  detailModule?: string[];
  month?: string[];
  dateRange?: { from?: Date; to?: Date };
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  try {
    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.min(filters?.pageSize || 100, 500);
    const offset = (page - 1) * pageSize;

    console.log('📊 Pagination:', { page, pageSize, offset });

    let query = supabaseAdmin
      .from("all_cases")
      .select(getSelectColumns(), { count: "exact" })
      .is('deleted_at', null);

    const sortBy = filters?.sortBy || 'date';
    const sortOrder = filters?.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    if (filters?.dateRange?.from) {
      const fromDate = formatDate(filters.dateRange.from);
      const toDate = filters?.dateRange?.to
        ? formatDate(filters.dateRange.to)
        : formatDate(filters.dateRange.from);
      query = query.gte('date', fromDate).lte('date', toDate);
    } else if (filters?.year && filters.year !== 'all') {
      const yearNum = parseInt(filters.year, 10);
      query = query
        .gte('date', `${yearNum}-01-01`)
        .lte('date', `${yearNum}-12-31`);
    }

    if (filters?.category?.length)     query = query.in('category_case', filters.category);
    if (filters?.client?.length)       query = query.in('client_name',   filters.client);
    if (filters?.module?.length)       query = query.in('module_case',   filters.module);
    if (filters?.status?.length)       query = query.in('status_case',   filters.status);
    if (filters?.detailModule?.length) query = query.in('detail_module', filters.detailModule);
    if (filters?.month?.length)        query = query.in('month',         filters.month);

    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      query = query.or(
        `ticket_number.ilike.${searchTerm},` +
        `client_name.ilike.${searchTerm},` +
        `status_case.ilike.${searchTerm},` +
        `category_case.ilike.${searchTerm},` +
        `module_case.ilike.${searchTerm},` +
        `detail_module.ilike.${searchTerm},` +
        `detail_case.ilike.${searchTerm}`
      );
    }

    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("❌ Error fetching cases:", error);
      return { error: error.message };
    }

    console.log('✅ Fetched:', data?.length, 'rows out of', count, 'total');

    const mappedData = mapDBArrayToFrontend(data as YourDBRow[]);
    
    return { 
      data: mappedData, 
      source: "supabase" as const,
      pagination: {
        total: count || 0,
        page,
        pageSize,
        totalPages: count ? Math.ceil(count / pageSize) : 0,
        hasNextPage: count ? offset + pageSize < count : false,
        hasPrevPage: page > 1,
      }
    };
  } catch (error: any) {
    console.error("❌ Unexpected error fetching cases:", error);
    return { error: error.message || "Failed to fetch cases data" };
  }
}

// ============================================
// UPDATE SINGLE CASE
// ============================================
export async function updateCase(caseId: number, data: Record<string, any>) {
  try {
    const dbData = {
      date: data.date,
      month: data.month,
      client_name: normalizeClientName(data.client_name),
      pic_client: data.customer_name,
      status_case: data.status,
      category_case: data.ticket_category,
      module_case: data.module,
      detail_module: data.detail_module,
      check_in: data.created_at,
      detail_case: data.title,
      check_out: data.resolved_at,
      status_case_solved: data.status_case_2,
      source_link_op: data.ticket_op,
      note: data.note,
    };

    const { error } = await supabaseAdmin
      .from('all_cases')
      .update(dbData)
      .eq('id', caseId);

    if (error) {
      console.error(`Error updating case ${caseId}:`, error);
      throw error;
    }
    
    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true, id: caseId };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// DELETE SINGLE CASE
// ============================================
export async function deleteCase(caseId: number) {
  try {
    const { error } = await supabaseAdmin
      .from('all_cases')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', caseId);

    if (error) {
      console.error(`Error deleting case ${caseId}:`, error);
      throw error;
    }
    
    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true, id: caseId };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// DELETE MULTIPLE CASES
// ============================================
export async function deleteCases(caseIds: number[]) {
  try {
    if (caseIds.length === 0) {
      return { success: true, count: 0 };
    }

    const { error } = await supabaseAdmin
      .from('all_cases')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', caseIds);

    if (error) {
      console.error(`Error deleting cases:`, error);
      throw error;
    }
    
    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true, count: caseIds.length };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// REFRESH DASHBOARD
// ============================================

export async function refreshDashboardViews() {
  try {
    await supabaseAdmin.rpc('refresh_dashboard_views');
    revalidatePath('/dashboard');
    return { success: true, message: "Views refreshed and cache revalidated." };
  } catch (error: any) {
    console.error("Error refreshing dashboard views:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// GET DASHBOARD FILTER OPTIONS
// ============================================

const _getDashboardFilterOptions = async () => {
  try {
    console.log('🔍 [FILTER OPTIONS] Starting fetch...');
    
    const [categoriesResult, casesResult, yearsResult] = await Promise.all([
      supabaseAdmin
        .from("ticket_categories")
        .select("name")
        .order('name', { ascending: true }),
      supabaseAdmin
        .from("all_cases")
        .select("client_name, module_case, detail_module")
        .is('deleted_at', null),
      supabaseAdmin.rpc('get_distinct_years')
    ]);

    console.log('📦 [RAW YEARS RESULT]:', yearsResult);
    
    if (categoriesResult.error) throw categoriesResult.error;
    if (casesResult.error) throw casesResult.error;
    if (yearsResult.error) console.error('⚠️ Error fetching years:', yearsResult.error);

    const categoriesData = categoriesResult.data || [];
    const casesData      = casesResult.data || [];
    const yearsData      = yearsResult.data || [];

    const uniqueCategories    = categoriesData.map((c: any) => c.name).filter(Boolean);
    const uniqueClients       = [...new Set(casesData.map((c: any) => c.client_name).filter(Boolean))];
    const uniqueModules       = [...new Set(casesData.map((m: any) => m.module_case).filter(Boolean))];
    const uniqueDetailModules = [...new Set(casesData.map((m: any) => m.detail_module).filter(Boolean))];

    const sortedYears = yearsData
      .map((item: any) => String(item.year))
      .filter((year: string) => year && !['null', 'undefined', 'NaN'].includes(year));

    return {
      success: true,
      data: {
        categories:    uniqueCategories.map((c: any) => ({ label: c, value: c })),
        clients:       uniqueClients.map((c: any) => ({ label: c, value: c })),
        modules:       uniqueModules.map((m: any) => ({ label: m, value: m })),
        detailModules: uniqueDetailModules.map((d: any) => ({ label: d, value: d })),
        years:         sortedYears,
      },
    };
  } catch (error: any) {
    console.error("❌ Error fetching filter options:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch filter options",
    };
  }
};

export async function getDashboardFilterOptions() {
  return await _getDashboardFilterOptions();
}

// ============================================
// L3 REPORT
// ============================================

export async function getL3ReportFromDB() {
  try {
    const { data, error } = await supabaseAdmin
      .from('all_cases')
      .select('client_name, detail_case, check_in, module_case, source_link_op, status_case, ticket_number')
      .is('deleted_at', null)
      .in('status_case', ['L3', 'ON HOLD'])
      .order('check_in', { ascending: true });

    if (error) {
      console.error("❌ Supabase error fetching L3/On Hold cases:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return { success: true, report: "Tidak ada kasus L3 atau On Hold yang ditemukan." };
    }

    const formatDateLocal = (date: Date) => {
      if (!date || isNaN(date.getTime())) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const minDate = new Date(data[0].check_in!);
    const maxDate = new Date(data[data.length - 1].check_in!);
    const today = new Date();

    const header = `*Update cases yang belum solved L3 on hold (${formatDateLocal(minDate)} - ${formatDateLocal(maxDate)})*`;
    const totalCases = data.length;

    const getGroupForModule = (moduleName: string | null | undefined): string => {
        const upperCaseModule = (moduleName || '').toUpperCase();
        if (upperCaseModule === 'PAYMENT' || upperCaseModule === 'PINTRO PAY') return 'Payment';
        if (upperCaseModule === 'APLIKASI/MOBILE' || upperCaseModule === 'AKSES PORTAL') return 'Aplikasi/Mobile';
        return 'Akademik';
    };

    const casesByGroup: Record<string, any[]> = {};
    data.forEach((c: any) => {
      const groupName = getGroupForModule(c.module_case);
      if (!casesByGroup[groupName]) casesByGroup[groupName] = [];
      casesByGroup[groupName].push(c);
    });

    const summaryLines = [`Total : ${totalCases}`];
    const groupOrder = ['Akademik', 'Payment', 'Aplikasi/Mobile'];
    const sortedGroups = Object.keys(casesByGroup).sort((a, b) => {
        const indexA = groupOrder.indexOf(a);
        const indexB = groupOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    sortedGroups.forEach(groupName => {
        const cases = casesByGroup[groupName];
        summaryLines.push(`${groupName} > L3 : ${cases.length}`);
    });
    const summary = summaryLines.join('\n');

    const detailLines: string[] = [];
    sortedGroups.forEach(groupName => {
      detailLines.push(`\n*${groupName.toUpperCase()} > L3*`);
      const cases = casesByGroup[groupName];
      cases.sort((a: any, b: any) => (a.client_name || '').localeCompare(b.client_name || '')).forEach((c: any, index: number) => {
        const checkInDate = new Date(c.check_in!);
        let age = 0;
        if (!isNaN(checkInDate.getTime())) {
            const ageDiff = Math.ceil((today.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
            age = Math.max(1, ageDiff);
        }
        const caseLineParts = [c.client_name, c.ticket_number, c.detail_case, c.source_link_op].filter(Boolean);
        const caseLine = caseLineParts.join(' ').trim();
        detailLines.push(`${index + 1}. ${caseLine} (${age} hari)`.trim());
      });
    });
    const details = detailLines.join('\n');
    const reportText = `${header}\n\n${summary}\n${details}`;
    return { success: true, report: reportText.trim() };

  } catch (err: any) {
    console.error('❌ Error generating L3 report from DB:', err);
    return { success: false, error: err.message };
  }
}

// ============================================
// CLIENT MANAGEMENT
// ============================================

export async function getDistinctClientsFromDB(): Promise<{ success: boolean; clients?: string[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('name')
      .order('name', { ascending: true });

    if (error) throw error;
    return { success: true, clients: data.map((c: { name: string }) => c.name).filter(Boolean) };
  } catch (err: any) {
    console.error("❌ Error fetching distinct clients:", err);
    return { success: false, error: err.message };
  }
}

export async function addClient(clientName: string): Promise<{ success: boolean; client?: { name: string }; error?: string }> {
  try {
    if (!clientName || clientName.trim() === '') {
      return { success: false, error: "Client name cannot be empty." };
    }

    const { data, error } = await supabaseAdmin
      .from('clients')
      .insert({ name: clientName.trim() })
      .select('name')
      .single();

    if (error) {
      if (error.code === '23505') return { success: false, error: `Client "${clientName}" already exists.` };
      throw error;
    }
    
    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true, client: data as { name: string } };
  } catch (err: any) {
    console.error("❌ Error adding new client:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// CATEGORY MANAGEMENT
// ============================================

export async function getAllCategories(): Promise<{ success: boolean; categories?: { id: number; name: string }[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ticket_categories')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;
    return { success: true, categories: data };
  } catch (err: any) {
    console.error("❌ Error fetching categories:", err);
    return { success: false, error: err.message };
  }
}

export async function addCategory(categoryName: string): Promise<{ success: boolean; category?: { id: number; name: string }; error?: string }> {
  try {
    if (!categoryName || categoryName.trim() === '') {
      return { success: false, error: "Category name cannot be empty." };
    }

    const { data, error } = await supabaseAdmin
      .from('ticket_categories')
      .insert({ name: categoryName.trim() })
      .select('id, name')
      .single();

    if (error) {
      if (error.code === '23505') return { success: false, error: `Category "${categoryName}" already exists.` };
      throw error;
    }
    
    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true, category: data };
  } catch (err: any) {
    console.error("❌ Error adding new category:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteCategory(categoryId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('ticket_categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', categoryId);

    if (error) throw error;

    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error("❌ Error deleting category:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// MASTER STATUS MANAGEMENT
// ============================================

export async function addMasterStatus(name: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (!name || name.trim() === '') {
      return { success: false, error: "Status name cannot be empty." };
    }

    const { data, error } = await supabaseAdmin
      .from('master_status')
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return { success: false, error: `Status "${name}" already exists.` };
      throw error;
    }

    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true, data };
  } catch (err: any) {
    console.error("❌ Error adding master status:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteMasterStatus(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('master_status')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error("❌ Error deleting master status:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// MASTER MODULE MANAGEMENT
// ============================================

export async function addMasterModule(name: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (!name || name.trim() === '') {
      return { success: false, error: "Module name cannot be empty." };
    }

    const { data, error } = await supabaseAdmin
      .from('master_module')
      .insert({ nama_module: name.trim() })
      .select('id_module, nama_module')
      .single();

    if (error) {
      if (error.code === '23505') return { success: false, error: `Module "${name}" already exists.` };
      throw error;
    }

    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true, data: { id: data.id_module, name: data.nama_module } };
  } catch (err: any) {
    console.error("❌ Error adding master module:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteMasterModule(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('master_module')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id_module', id);

    if (error) throw error;

    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error("❌ Error deleting master module:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// MASTER DETAIL MODULE MANAGEMENT
// ============================================

export async function addMasterDetailModule(name: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (!name || name.trim() === '') {
      return { success: false, error: "Detail module name cannot be empty." };
    }

    const { data, error } = await supabaseAdmin
      .from('master_detail_module')
      .insert({ detail_module: name.trim() })
      .select('id_module, detail_module')
      .single();

    if (error) {
      if (error.code === '23505') return { success: false, error: `Detail module "${name}" already exists.` };
      throw error;
    }

    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true, data: { id: data.id_module, name: data.detail_module } };
  } catch (err: any) {
    console.error("❌ Error adding master detail module:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteMasterDetailModule(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('master_detail_module')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id_module', id);

    if (error) throw error;

    revalidatePath('/db');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error("❌ Error deleting master detail module:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// GET ALL MASTER DATA
// ============================================

export async function getMasterData(): Promise<{
  success: boolean;
  data?: {
    statuses: { id: number; name: string }[];
    categories: { id: number; name: string }[];
    modules: { id: number; name: string }[];
    detailModules: { id: number; name: string }[];
  };
  error?: string;
}> {
  try {
    const [statusRes, categoryRes, moduleRes, detailModuleRes] = await Promise.all([
      supabaseAdmin.from('master_status').select('id, name').is('deleted_at', null).order('name'),
      supabaseAdmin.from('ticket_categories').select('id, name').is('deleted_at', null).order('name'),
      supabaseAdmin.from('master_module').select('id_module, nama_module').is('deleted_at', null).order('nama_module'),
      supabaseAdmin.from('master_detail_module').select('id_module, detail_module').is('deleted_at', null).order('detail_module'),
    ]);

    const modules = (moduleRes.data || []).map((row: any) => ({
      id: row.id_module as number,
      name: row.nama_module as string,
    }));

    const detailModules = (detailModuleRes.data || []).map((row: any) => ({
      id: row.id_module as number,
      name: row.detail_module as string,
    }));

    return {
      success: true,
      data: {
        statuses: statusRes.data || [],
        categories: categoryRes.data || [],
        modules,
        detailModules,
      },
    };
  } catch (err: any) {
    console.error("❌ Error fetching master data:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// DUMMY FUNCTIONS
// ============================================

export async function importToSheet(data: any, url: string): Promise<any> {
  return { success: false, error: "This function is not implemented in the live demo." };
}

export async function updateSheetStatus(data: any, url: string): Promise<any> {
  return { success: false, error: "This function is not implemented in the live demo." };
}

export async function getUpdatePreview(data: any, url: string): Promise<any> {
  return { success: false, error: "This function is not implemented in the live demo." };
}

export async function undoLastAction(data: any, url: string): Promise<any> {
  return { success: false, error: "This function is not implemented in the live demo." };
}

export async function fetchL3ReportData(url: string): Promise<any> {
  return { success: false, error: "This function is not implemented in the live demo." };
}

export async function mergeFilesOnServer(fileA: any, fileB: any, editMode: any): Promise<any> {
  return { success: false, error: "This function is not implemented in the live demo." };
}

// ============================================
// GET SPREADSHEET TITLE — REAL IMPLEMENTATION
// ============================================

export async function getSpreadsheetTitle(url: string) {
  if (!url || !url.includes('docs.google.com/spreadsheets')) {
    return { error: 'Invalid Google Sheet URL' };
  }

  const sheetId = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (!sheetId) {
    return { error: 'Tidak dapat mengekstrak Sheet ID dari URL.' };
  }

  // OPSI A: Google Sheets API v4 (tambahkan GOOGLE_API_KEY di .env.local)
  const apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title&key=${apiKey}`,
        { cache: 'no-store' }
      );
      if (res.status === 403) return { error: 'Sheet tidak dapat diakses. Pastikan sheet bersifat publik.' };
      if (res.status === 404) return { error: 'Sheet tidak ditemukan. Periksa kembali URL.' };
      if (!res.ok) return { error: `Google API error (HTTP ${res.status}).` };

      const data = await res.json();
      const title = data?.properties?.title;
      if (!title) return { error: 'Gagal membaca judul sheet.' };
      return { success: true, title };
    } catch (e: any) {
      console.error('getSpreadsheetTitle (API Key) error:', e);
    }
  }

  // OPSI B: Parse HTML title (fallback, hanya untuk sheet publik)
  try {
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      {
        cache: 'no-store',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NextJS server-side fetch)' },
      }
    );

    if (res.status === 401 || res.status === 403) {
      return { error: 'Sheet tidak dapat diakses. Pastikan share settings-nya: "Anyone with the link → Viewer".' };
    }
    if (!res.ok) return { error: `Gagal mengakses sheet (HTTP ${res.status}).` };

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const rawTitle = titleMatch[1]
        .replace(/ - Google Sheets$/, '')
        .replace(/ - Google Spreadsheet$/, '')
        .trim();
      if (rawTitle && rawTitle.toLowerCase() !== 'google sheets') {
        return { success: true, title: rawTitle };
      }
    }

    return { error: 'Tidak dapat membaca judul sheet. Tambahkan GOOGLE_API_KEY di .env.local, atau pastikan sheet bersifat publik.' };
  } catch (e: any) {
    console.error('getSpreadsheetTitle (HTML fallback) error:', e);
    return { error: `Gagal validasi: ${e.message}` };
  }
}

// ============================================
// SYNC GSHEET → DB
// FIX: IHO-XXX di-extract dari kolom "detail_case"
// ============================================

const _SYNC_COLUMN_MAP: Record<string, string> = {
  "no ticket": "ticket_number", "ticket number": "ticket_number",
  "ticket_number": "ticket_number", "no. ticket": "ticket_number",
  "tiket": "ticket_number", "no tiket": "ticket_number",
  "tanggal": "date", "date": "date",
  "bulan": "month", "month": "month",
  "client": "client_name", "client name": "client_name",
  "nama client": "client_name", "client_name": "client_name",
  "pic client": "pic_client", "pic": "pic_client", "pic_client": "pic_client",
  "customer name": "pic_client", "customer_name": "pic_client",
  "status": "status_case", "status case": "status_case", "status_case": "status_case",
  "kategori": "category_case", "category": "category_case",
  "category case": "category_case", "category_case": "category_case",
  "ticket category": "category_case", "ticket_category": "category_case",
  "modul": "module_case", "module": "module_case",
  "module case": "module_case", "module_case": "module_case",
  "detail modul": "detail_module", "detail module": "detail_module",
  "detail_module": "detail_module",
  "check in": "check_in", "check_in": "check_in", "masuk": "check_in",
  "created at": "check_in", "created_at": "check_in",
  "detail case": "detail_case", "detail_case": "detail_case",
  "judul": "detail_case", "title": "detail_case",
  "check out": "check_out", "check_out": "check_out", "selesai": "check_out",
  "resolved at": "check_out", "resolved_at": "check_out",
  "status solved": "status_case_solved", "status_case_solved": "status_case_solved",
  "link op": "source_link_op", "source link op": "source_link_op",
  "source_link_op": "source_link_op", "link": "source_link_op",
  "ticket op": "source_link_op", "ticket_op": "source_link_op",
  "catatan": "note", "note": "note", "notes": "note",
};

const _TICKET_REGEX = /^(IHO-\d+)\s*(.*)/i;

function _extractTicketFromDetail(raw: string | null): {
  ticketNumber: string | null;
  detailCase: string | null;
} {
  if (!raw?.trim()) return { ticketNumber: null, detailCase: null };
  const match = raw.trim().match(_TICKET_REGEX);
  if (match) {
    return {
      ticketNumber: match[1].toUpperCase(),
      detailCase: match[2].trim() || null,
    };
  }
  return { ticketNumber: null, detailCase: raw.trim() };
}

function _extractSheetId(url: string): string | null {
  return url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;
}

function _extractGid(url: string): string | null {
  return url.match(/[?&#]gid=(\d+)/)?.[1] ?? null;
}

function _parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let inQuotes = false;
    let field = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(field.trim()); field = '';
      } else {
        field += ch;
      }
    }
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

function _normalizeSyncDate(raw: string): string | null {
  if (!raw?.trim()) return null;
  raw = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parts = raw.split('/');
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (c > 1900) return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Gabungkan date (YYYY-MM-DD) dengan time-only (H:mm / HH:mm) dari GSheet.
 * Contoh: date="2026-02-24", rawTime="8:58" → "2026-02-24T08:58:00.000Z"
 * Jika rawTime sudah berisi tanggal lengkap, langsung parse.
 */
function _normalizeSyncDatetime(rawTime: string | null, dateStr: string | null): string | null {
  if (!rawTime?.trim()) return null;
  const t = rawTime.trim();

  // Sudah ISO atau dd/mm/yyyy → parse langsung
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (t.includes('/')) {
    const parts = t.split('/');
    if (parts.length === 3) {
      const [a, b, c] = parts.map(Number);
      if (c > 1900) {
        const d = new Date(`${c}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`);
        return isNaN(d.getTime()) ? null : d.toISOString();
      }
    }
  }

  // Hanya waktu H:mm atau HH:mm → gabungkan dengan date
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t) && dateStr) {
    const timePadded = t.length === 4 ? `0${t}` : t; // "8:58" → "08:58"
    const combined = new Date(`${dateStr}T${timePadded}:00`);
    return isNaN(combined.getTime()) ? null : combined.toISOString();
  }

  // Fallback
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function syncGSheetToDB(sheetUrl: string): Promise<{
  success: boolean;
  inserted?: number;
  updated?: number;
  skipped?: number;
  error?: string;
}> {
  try {
    if (!sheetUrl?.includes('docs.google.com/spreadsheets')) {
      return { success: false, error: 'URL GSheet tidak valid.' };
    }

    const sheetId = _extractSheetId(sheetUrl);
    if (!sheetId) return { success: false, error: 'Tidak dapat mengekstrak Sheet ID dari URL.' };

    const gid = _extractGid(sheetUrl);
    const csvUrl = gid
      ? `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`
      : `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

    console.log('🔄 [SYNC] Fetching CSV from:', csvUrl);

    const response = await fetch(csvUrl, { cache: 'no-store' });
    if (!response.ok) {
      return {
        success: false,
        error: `Gagal fetch GSheet (HTTP ${response.status}). Pastikan sheet bersifat publik.`,
      };
    }

    const csvText = await response.text();
    const rows = _parseCsv(csvText);
    if (rows.length < 2) return { success: true, inserted: 0, skipped: 0 };

    const rawHeaders = rows[0];
    console.log('📋 [SYNC] Raw headers:', rawHeaders);

    const headers: (string | null)[] = rawHeaders.map(
      h => _SYNC_COLUMN_MAP[h.toLowerCase().trim()] ?? null
    );

    const detailCaseColIdx = headers.indexOf('detail_case');
    const ticketColIdx     = headers.indexOf('ticket_number');

    if (detailCaseColIdx === -1 && ticketColIdx === -1) {
      return {
        success: false,
        error: `Kolom "Detail Case" tidak ditemukan. Header GSheet: [${rawHeaders.join(', ')}]`,
      };
    }

    const dataRows = rows.slice(1);
    const toProcess: { ticket: string; record: Record<string, any> }[] = [];

    for (const row of dataRows) {
      const detailCaseRaw = detailCaseColIdx !== -1
        ? (row[detailCaseColIdx] || '').trim() || null
        : null;

      const { ticketNumber: ihoTicket, detailCase: cleanDetailCase } =
        _extractTicketFromDetail(detailCaseRaw);

      const explicitTicket = ticketColIdx !== -1
        ? (row[ticketColIdx] || '').trim() || null
        : null;

      const finalTicket = ihoTicket ?? explicitTicket;
      if (!finalTicket) continue;

      const record: Record<string, any> = {};

      // Pass 1: kumpulkan semua kolom kecuali check_in, check_out, detail_case
      headers.forEach((col, i) => {
        if (!col || col === 'detail_case' || col === 'check_in' || col === 'check_out') return;
        let val: string | null = (row[i] || '').trim() || null;
        if (col === 'date' && val) val = _normalizeSyncDate(val);
        if (col === 'client_name' && val) val = normalizeClientName(val);
        record[col] = val;
      });

      // Pass 2: check_in & check_out — GSheet menyimpan HANYA waktu (H:mm)
      // Gabungkan dengan kolom date agar menjadi datetime lengkap
      const dateStr = record['date'] as string | null;
      headers.forEach((col, i) => {
        if (col !== 'check_in' && col !== 'check_out') return;
        const rawVal = (row[i] || '').trim() || null;
        record[col] = _normalizeSyncDatetime(rawVal, dateStr);
      });

      record['ticket_number'] = finalTicket;
      record['detail_case']   = cleanDetailCase;

      toProcess.push({ ticket: finalTicket, record });
    }

    const allTickets = toProcess.map(r => r.ticket);
    console.log(`📊 [SYNC] Total rows valid: ${toProcess.length}`);

    if (!allTickets.length) return { success: true, inserted: 0, skipped: 0 };

    // Fetch tiket yang sudah ada beserta kolom yang perlu dicek
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('all_cases')
      .select('ticket_number, status_case, check_in, check_out')
      .in('ticket_number', allTickets)
      .is('deleted_at', null);

    if (fetchErr) return { success: false, error: `DB error: ${fetchErr.message}` };

    // Map: ticket_number → { status_case, check_in, check_out } di DB
    const existingMap = new Map<string, { status_case: string | null; check_in: string | null; check_out: string | null }>(
      (existing || []).map((r: any) => [r.ticket_number, {
        status_case: r.status_case,
        check_in: r.check_in,
        check_out: r.check_out,
      }])
    );

    const toInsert = toProcess
      .filter(r => !existingMap.has(r.ticket))
      .map(r => r.record);

    // Tiket sudah ada → update jika ada field yang perlu diisi/diperbarui:
    // 1. status_case berbeda
    // 2. check_in kosong di DB tapi ada di GSheet
    // 3. check_out kosong di DB tapi ada di GSheet
    const toUpdate = toProcess.filter(r => {
      const db = existingMap.get(r.ticket);
      if (!db) return false;

      const statusChanged = r.record.status_case &&
        (db.status_case || '').trim().toLowerCase() !== (r.record.status_case || '').trim().toLowerCase();
      const checkInMissing  = !db.check_in  && !!r.record.check_in;
      const checkOutMissing = !db.check_out && !!r.record.check_out;

      return statusChanged || checkInMissing || checkOutMissing;
    });

    console.log(`📊 [SYNC] Insert: ${toInsert.length}, Update: ${toUpdate.length}, Skip: ${existingMap.size - toUpdate.length}`);

    // ── INSERT baris baru ─────────────────────────────────────────────────
    let insertedCount = 0;
    const BATCH = 500;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const { error: insErr } = await supabaseAdmin
        .from('all_cases')
        .insert(batch);

      if (insErr) {
        console.error(`❌ [SYNC] Insert error batch ${Math.floor(i / BATCH) + 1}:`, insErr);
        return {
          success: false,
          inserted: insertedCount,
          error: `Insert error: ${insErr.message} (code: ${insErr.code})`,
        };
      }
      insertedCount += batch.length;
    }

    // ── UPDATE untuk tiket yang sudah ada ────────────────────────────────
    let updatedCount = 0;
    for (const item of toUpdate) {
      const db = existingMap.get(item.ticket)!;

      // Hanya kirim field yang memang berubah / perlu diisi
      const patch: Record<string, any> = {};

      if (item.record.status_case &&
          (db.status_case || '').trim().toLowerCase() !== (item.record.status_case || '').trim().toLowerCase()) {
        patch.status_case = item.record.status_case;
      }
      if (!db.check_in && item.record.check_in) {
        patch.check_in = item.record.check_in;
      }
      if (!db.check_out && item.record.check_out) {
        patch.check_out = item.record.check_out;
      }
      // Ikut update status_case_solved jika ada di GSheet
      if (item.record.status_case_solved) {
        patch.status_case_solved = item.record.status_case_solved;
      }

      if (Object.keys(patch).length === 0) continue;

      const { error: updErr } = await supabaseAdmin
        .from('all_cases')
        .update(patch)
        .eq('ticket_number', item.ticket)
        .is('deleted_at', null);

      if (updErr) {
        console.error(`❌ [SYNC] Update error untuk ${item.ticket}:`, updErr);
      } else {
        updatedCount++;
      }
    }

    revalidatePath('/db');
    revalidatePath('/dashboard');

    return {
      success: true,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: existingMap.size - updatedCount,
    };

  } catch (err: any) {
    console.error('❌ [SYNC] Unexpected error:', err);
    return { success: false, error: err.message || 'Terjadi kesalahan tak terduga.' };
  }
}

// ============================================
// GLOBAL APP SETTINGS (key-value store di Supabase)
// Tabel: app_settings (key TEXT PRIMARY KEY, value TEXT)
//
// SQL untuk buat tabelnya di Supabase:
//   create table if not exists app_settings (
//     key   text primary key,
//     value text,
//     updated_at timestamptz default now()
//   );
// ============================================

export async function saveAppSetting(key: string, value: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error(`❌ Error saving app setting [${key}]:`, err);
    return { success: false, error: err.message };
  }
}

export async function getAppSetting(key: string): Promise<{ success: boolean; value?: string | null; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = row not found
    return { success: true, value: data?.value ?? null };
  } catch (err: any) {
    console.error(`❌ Error fetching app setting [${key}]:`, err);
    return { success: false, error: err.message };
  }
}
