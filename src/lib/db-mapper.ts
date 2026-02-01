// src/lib/db-mapper.ts
// Mapping layer between your DB columns and frontend expectations

export interface YourDBRow {
    id?: number;
    date?: string;
    month?: string;
    ticket_number?: string;
    client_name?: string;
    pic_client?: string;
    status_case?: string;
    category_case?: string;
    module_case?: string;
    detail_module?: string;
    check_in?: string;
    detail_case?: string;
    check_out?: string;
    status_case_solved?: string;
    source_link_op?: string;
    note?: string;
  }
  
  export interface FrontendExpectedRow {
    id?: number;
    date?: string;
    month?: string;
    ticket_number?: string;
    client_name?: string;
    customer_name?: string;
    status?: string;
    ticket_category?: string;
    module?: string;
    detail_module?: string;
    created_at?: string;
    title?: string;
    resolved_at?: string;
    ticket_op?: string;
    url_jira?: string;
    status_case_2?: string;
    pic_client?: string;
    checkout?: string;
    note?: string;
  }

const CANONICAL_CLIENT_NAMES = [
    "Darma Bangsa", "Al Aqobah", "Penus", "Alazka", "Darul Jannah", "Makarima Solo", "AL Izzah", "LabSchool", "Muthahhari", "AL Hamidiyah", "Irsyadul Ibad", "Al Barokah", "BMS", "ASBC", "STIKES Sumber Waras", "ICM", "Romu", "Mumtaza", "Dian Didaktika", "BSB Semarang", "Asram", "AL Azhar Pontianak", "YDAI", "YPI Cerme", "Lazuardi", "Al Hikmah", "LIA", "Al Amanah", "Muga Yogya", "Muhajirin Purwakarta", "Al Bunyan", "Monkey Tree", "Al Fatih", "Yasporbi", "Gunacipta", "Amahan", "MANICS", "Stikes Prima", "ASSURYANIYAH BEKASI", "Al Masoem", "Annibras Subang", "UNRI", "Immanuel Lampung", "BRKS", "SIPINTER EDU", "Al Izzah Batu", "Universitas Strada", "Sekolah Cikal", "Nurul Falah Ploso", "Al Kahfi", "Global Islamic School", "RSIJ Sukapura", "LMS Pesantren", "Baitul Jannah", "Ummul", "PKP JIS", "Mumtaz Al Bantani", "BIM", "UNISKA", "Annajah", "SDIT Baiturrahman", "Embun Pagi Islamic School", "Al Azhar Mandiri", "Al Ikhlas", "Ar Rohmah", "Al Azhar Syifa Budi Cibubur", "SMK Hassina", "IDN", "YKWK", "Al Muflihun"
].filter((value, index, self) => self.map(v => v.toLowerCase()).indexOf(value.toLowerCase()) === index);


const buildNormalizationMap = () => {
    const map = new Map<string, string>();
    CANONICAL_CLIENT_NAMES.forEach(name => {
        // Normalize by lowercasing and removing spaces and special characters
        const normalizedKey = name.toLowerCase().replace(/[^a-z0-9]/gi, '');
        if (!map.has(normalizedKey)) {
            map.set(normalizedKey, name);
        }
    });

    // Add special custom mappings for common typos/variations
    map.set('yayasanassuryaniyah', 'ASSURYANIYAH BEKASI');
    map.set('yayasanmuthahhari', 'Muthahhari');
    map.set('alhamidiyah', 'AL Hamidiyah');
    map.set('irsyadulibad', 'Irsyadul Ibad');
    map.set('stikessumberwaras', 'STIKES Sumber Waras');
    map.set('al_iklas', 'Al Ikhlas');
    map.set('darma_bangsa', 'Darma Bangsa');
    map.set('asram', 'Asram');

    return map;
};

const clientNameNormalizationMap = buildNormalizationMap();

export const normalizeClientName = (name: string | null | undefined): string => {
    if (!name) return name || '';
    const normalizedKey = name.toLowerCase().replace(/[^a-z0-9]/gi, '');
    return clientNameNormalizationMap.get(normalizedKey) || name;
};
  
  /**
   * Map DB row to Frontend expected format
   */
  export function mapDBToFrontend(dbRow: YourDBRow): FrontendExpectedRow {
    let title = dbRow.detail_case || '';
    // Prepend ticket number to title if it's not already there and is in the IHO format
    if (dbRow.ticket_number && /^IHO-\d+$/.test(dbRow.ticket_number) && !title.startsWith(dbRow.ticket_number)) {
      title = `${dbRow.ticket_number} ${title}`;
    }
  
    return {
      id: dbRow.id,
      date: dbRow.date,
      month: dbRow.month,
      ticket_number: dbRow.ticket_number,
      client_name: normalizeClientName(dbRow.client_name),
      customer_name: dbRow.pic_client, // PIC Client → Customer Name
      status: dbRow.status_case,
      ticket_category: dbRow.category_case,
      module: dbRow.module_case,
      detail_module: dbRow.detail_module,
      created_at: dbRow.check_in,
      title: title.trim(),
      resolved_at: dbRow.check_out,
      ticket_op: dbRow.source_link_op,
      url_jira: dbRow.source_link_op, // Same field
      status_case_2: dbRow.status_case_solved,
      pic_client: dbRow.pic_client,
      checkout: dbRow.check_out,
      note: dbRow.note,
    };
  }
  
  /**
   * Map multiple DB rows to Frontend format
   */
  export function mapDBArrayToFrontend(dbRows: YourDBRow[]): FrontendExpectedRow[] {
    return dbRows.map(mapDBToFrontend);
  }
  
  /**
   * Map Frontend data back to DB format for INSERT/UPDATE
   */
  export function mapFrontendToDB(frontendRow: Record<string, any>): Partial<YourDBRow> {
    return {
      // Map from frontend field names to your DB column names
      date: frontendRow['date'] || frontendRow['Date'],
      month: frontendRow['month'] || frontendRow['Month'],
      client_name: normalizeClientName(frontendRow['client_name'] || frontendRow['Client Name']),
      pic_client: frontendRow['customer_name'] || frontendRow['Customer Name'] || frontendRow['pic_client'],
      status_case: frontendRow['status'] || frontendRow['Status'],
      category_case: frontendRow['ticket_category'] || frontendRow['Ticket Category'],
      module_case: frontendRow['module'] || frontendRow['Module'],
      detail_module: frontendRow['detail_module'] || frontendRow['Detail Module'],
      check_in: frontendRow['created_at'] || frontendRow['Created At'],
      detail_case: frontendRow['title'] || frontendRow['Title'],
      check_out: frontendRow['resolved_at'] || frontendRow['Resolved At'],
      source_link_op: frontendRow['ticket_op'] || frontendRow['Ticket OP'],
      note: frontendRow['note'] || frontendRow['Note'] || '',
    };
  }
  
  /**
   * Column mapping reference for queries
   */
  export const COLUMN_MAP = {
    // Frontend → DB
    customer_name: 'pic_client',
    status: 'status_case',
    ticket_category: 'category_case',
    module: 'module_case',
    created_at: 'check_in',
    title: 'detail_case',
    resolved_at: 'check_out',
    ticket_op: 'source_link_op',
    url_jira: 'source_link_op',
    status_case_2: 'status_case_solved',
    checkout: 'check_out',
  } as const;
  
  /**
   * Get actual DB column name from frontend field name
   */
  export function getDBColumn(frontendField: string): string {
    return COLUMN_MAP[frontendField as keyof typeof COLUMN_MAP] || frontendField;
  }
  
  /**
   * Build Supabase select string with all needed columns
   */
  export function getSelectColumns(): string {
    return `
      id,
      date,
      month,
      ticket_number,
      client_name,
      pic_client,
      status_case,
      category_case,
      module_case,
      detail_module,
      check_in,
      detail_case,
      check_out,
      status_case_solved,
      source_link_op,
      note
    `.trim().replace(/\s+/g, ' ');
  }
