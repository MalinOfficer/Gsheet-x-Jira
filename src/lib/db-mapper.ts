
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
      client_name: dbRow.client_name,
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
      client_name: frontendRow['client_name'] || frontendRow['Client Name'],
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
