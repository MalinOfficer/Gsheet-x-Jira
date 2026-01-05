
"use server";

import { unstable_cache } from 'next/cache';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Daftar file yang sama seperti di code-viewer sebelumnya
const projectFilesForAction = [
  // File konfigurasi root
  "README.md",
  "next.config.js",
  "package.json",
  "postcss.config.js",
  "tailwind.config.ts",
  "tsconfig.json",
  "components.json",
  "next-env.d.ts",

  // Struktur Aplikasi & Halaman Utama
  "src/app/layout.tsx",
  "src/app/globals.css",
  "src/app/page.tsx", // Halaman root untuk Import Flow
  "src/app/report-harian/page.tsx",
  "src/app/migrasi-murid/page.tsx",
  "src/app/cek-duplikasi/page.tsx",
  "src/app/data-weaver/page.tsx",
  "src/app/settings/page.tsx",
  "src/app/code-viewer/page.tsx",
  "src/app/migrasi-produk/page.tsx",

  // Komponen Utama (logika untuk setiap halaman)
  "src/components/import-flow.tsx",
  "src/components/report-harian.tsx",
  "src/components/migrasi-murid.tsx",
  "src/components/cek-duplikasi.tsx",
  "src/components/data-weaver.tsx",
  "src/components/layout/client-layout.tsx",
  "src/components/migrasi-produk.tsx",


  // Aksi & Logika Server
  "src/app/actions.ts",
  "src/lib/utils.ts",
  "src/lib/date-utils.ts",

  // Manajemen State (Konteks & Provider)
  "src/store/store-provider.tsx",
  "src/store/table-data-context.tsx",
  "src/contexts/app-provider.tsx",

  // Hooks Kustom
  "src/hooks/use-toast.ts",
  "src/hooks/use-theme.ts",
  "src/hooks/theme-provider.tsx",
  "src/hooks/use-mobile.tsx",

  // File terkait AI
  "src/ai/genkit.ts",
  "src/ai/dev.ts",

  // Komponen UI (ShadCN)
  "src/components/ui/accordion.tsx",
  "src/components/ui/alert-dialog.tsx",
  "src/components/ui/alert.tsx",
  "src/components/ui/avatar.tsx",
  "src/components/ui/badge.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/calendar.tsx",
  "src/components/ui/card.tsx",
  "src/components/ui/carousel.tsx",
  "src/components/ui/chart.tsx",
  "src/components/ui/checkbox.tsx",
  "src/components/ui/collapsible.tsx",
  "src/components/ui/command.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/dropdown-menu.tsx",
  "src/components/ui/form.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/label.tsx",
  "src/components/ui/menubar.tsx",
  "src/components/ui/multi-select.tsx",
  "src/components/ui/navigation-menu.tsx",
  "src/components/ui/popover.tsx",
  "src/components/ui/progress.tsx",
  "src/components/ui/radio-group.tsx",
  "src/components/ui/scroll-area.tsx",
  "src/components/ui/select.tsx",
  "src/components/ui/separator.tsx",
  "src/components/ui/sheet.tsx",
  "src/components/ui/skeleton.tsx",
  "src/components/ui/slider.tsx",
  "src/components/ui/spinner.tsx",
  "src/components/ui/switch.tsx",
  "src/components/ui/table.tsx",
  "src/components/ui/tabs.tsx",
  "src/components/ui/textarea.tsx",
  "src/components/ui/toast.tsx",
  "src/components/ui/toaster.tsx",
  "src/components/ui/theme-switch.css",
  "src/components/ui/theme-switch.tsx",
];


async function getFileContent(filePath: string) {
    try {
        const fullPath = path.join(process.cwd(), filePath);
        // Pengecekan stat tidak diperlukan jika kita hanya ingin membaca file
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        return content;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return `// File tidak ditemukan di path: ${filePath}\n// File ini mungkin belum dibuat atau sudah dihapus.`;
        }
        console.error(`Error reading file at ${filePath}:`, error);
        return `Error: Tidak dapat membaca file di ${filePath}`;
    }
}


export async function getProjectFileContents() {
    try {
        const fileContents = await Promise.all(
            projectFilesForAction.map(async (filePath) => {
                const content = await getFileContent(filePath);
                return { path: filePath, content, name: path.basename(filePath) };
            })
        );
        return { success: true, data: fileContents };
    } catch (error) {
        console.error("Failed to get project file contents:", error);
        return { success: false, error: "Gagal mengambil file proyek. Silakan coba lagi." };
    }
}

const getSheetData = unstable_cache(
    async (url: string) => {
        if (!url) {
            return { error: 'Please provide a Google Sheets URL.' };
        }

        const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
        const match = url.match(sheetIdRegex);

        if (!match || !match[1]) {
            return { error: 'Invalid Google Sheets URL format. Please use a valid share link.' };
        }

        const sheetId = match[1];
        const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

        try {
            const response = await fetch(exportUrl, { next: { revalidate: 3600 } }); // Cache for 1 hour
            if (!response.ok) {
                throw new Error(`Failed to fetch sheet. Status: ${response.status}. Make sure the sheet sharing setting is "Anyone with the link".`);
            }
            const csvText = await response.text();
            if (!csvText) {
                return { error: 'The Google Sheet appears to be empty or could not be read.' };
            }
            
            const lines = csvText.trim().split(/\r\n|\n/);
            const headersLine = lines.shift() || '';
            const headers = headersLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            
            const data = lines.map(line => {
                const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                const row: Record<string, string> = {};
                headers.forEach((header, i) => {
                    row[header] = (values[i] || '').trim().replace(/^"|"$/g, '');
                });
                return row;
            }).filter(row => Object.values(row).some(val => val !== ''));

            if (data.length === 0) {
                return { error: 'No data found in the sheet (after the header row).' };
            }

            return { data, headers };

        } catch (error) {
            console.error(error);
            return { error: error instanceof Error ? error.message : 'An unknown error occurred while fetching the data.' };
        }
    },
    ['sheet-data'],
    {
        tags: ['sheet-data']
    }
)

export async function fetchSheetData(url: string) {
    return getSheetData(url);
}

const getGoogleSheetsClient = () => {
    let credentials;
    // Vercel/Production environment: Read from environment variable
    if (process.env.GCP_CREDENTIALS) {
        try {
            credentials = JSON.parse(process.env.GCP_CREDENTIALS);
        } catch (error) {
            console.error('Error parsing GCP_CREDENTIALS from environment variable:', error);
            throw new Error('Could not parse Google Cloud credentials from environment variable.');
        }
    } 
    // Local development environment: Read from file
    else {
        try {
            const filePath = path.join(process.cwd(), 'src', 'lib', 'gcp-credentials.json');
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            credentials = JSON.parse(fileContent);
        } catch (error) {
            console.error('Error reading or parsing credentials file:', error);
            throw new Error('Could not load Google Cloud credentials. Make sure src/lib/gcp-credentials.json exists for local development.');
        }
    }
    
    const clientEmail = credentials.client_email;
    const privateKey = credentials.private_key;

    if (!clientEmail || !privateKey) {
        throw new Error('Google Cloud credentials are not configured correctly.');
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: clientEmail,
            private_key: privateKey.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
}

export async function getSpreadsheetTitle(sheetUrl: string) {
    if (!sheetUrl) {
        return { error: "URL is empty. Please provide a Google Sheet URL." };
    }

    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-T-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];

    try {
        const sheets = getGoogleSheetsClient();
        const response = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'properties.title',
        });

        const title = response.data.properties?.title;

        if (!title) {
            return { error: "Could not retrieve the spreadsheet title." };
        }

        return { success: true, title };
    } catch (error: any) {
        console.error('Failed to get spreadsheet title:', error.message);
        const apiError = error.errors?.[0]?.message || error.message || 'An unknown error occurred while analyzing the sheet.';
        return { error: `Analysis Failed: ${apiError}` };
    }
}


async function getSheetRowMap(sheets: any, spreadsheetId: string, sheetName: string) {
    const rangeToRead = `${sheetName}!G:T`; // Read from Status (G) to Ticket OP (T)
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: rangeToRead,
    });

    const sheetRows = response.data.values;
    if (!sheetRows || sheetRows.length === 0) {
        return {};
    }
    
    const rowMap: Record<string, { rowIndex: number, currentStatus: string; currentTicketOp: string; title: string, currentCheckout: string; }> = {};
    const ticketNumberRegex = /#(\d+)/;

    sheetRows.forEach((row, index) => {
        const currentStatus = row[0] || ''; // Column G
        const detailCase = row[6] || ''; // Column M (G is 0, so M is 6)
        const currentCheckout = row[8] || ''; // Column O (G is 0, so O is 8)
        const currentTicketOp = row[13] || ''; // Column T (G is 0, so T is 13)

        if (typeof detailCase === 'string' && detailCase.trim() !== '') {
            const key = detailCase.trim();
            const match = detailCase.match(ticketNumberRegex);
            
            // Primary key: full title string
            rowMap[key] = {
                rowIndex: index + 1, // 1-based index
                currentStatus: currentStatus,
                currentTicketOp: currentTicketOp,
                title: detailCase,
                currentCheckout: currentCheckout
            };
            
            // Secondary key (fallback): ticket number if it exists
            if (match && match[1]) {
                const ticketNumberKey = `#${match[1]}`;
                 if (!rowMap[ticketNumberKey]) { // Avoid overwriting if already set by full title
                    rowMap[ticketNumberKey] = rowMap[key];
                 }
            }
        }
    });
    return rowMap;
}

const normalizeAndFormatDate = (dateStr: string): string | null => {
    if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
        return null;
    }
    const trimmed = dateStr.trim();

    // Try parsing various formats into a Date object
    let dateObj: Date | null = null;
    try {
        // Try ISO format first (from our app) e.g., "2024-07-31T07:38:15.123Z"
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
            dateObj = new Date(trimmed);
        } else {
            // Try DD/MM/YYYY HH:mm format (from Google Sheets)
            const gsheetMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})/);
            if (gsheetMatch) {
                const [_, day, month, year, hour, minute] = gsheetMatch;
                dateObj = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
            }
        }
    } catch (e) {
        return null; // Invalid date string
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
        return null;
    }

    // Format to a consistent YYYY-MM-DD HH:mm string
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hour = String(dateObj.getHours()).padStart(2, '0');
    const minute = String(dateObj.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}`;
};

export async function getUpdatePreview(
    data: { rows: Record<string, any>[] },
    sheetUrl: string
) {
    if (!data || data.rows.length === 0) {
        return { error: 'No data provided to preview.' };
    }

    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-T-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];
    const sheetName = 'All Case';

    try {
        const sheets = getGoogleSheetsClient();
        const rowMap = await getSheetRowMap(sheets, spreadsheetId, sheetName);
        
        const changesToPreview: { 
            title: string, 
            oldStatus: string, newStatus: string, 
            oldTicketOp: string, newTicketOp: string,
            oldCheckout: string, newCheckout: string 
        }[] = [];
        const ticketNumberRegex = /#(\d+)/;

        for (const appRow of data.rows) {
            const detailCase = appRow['Title'];
            const newStatus = appRow['Status'];
            const newTicketOp = appRow['Ticket OP'] || '';
            const newCheckoutRaw = appRow['Resolved At'] || '';

            if (typeof detailCase === 'string' && detailCase.trim()) {
                const match = detailCase.match(ticketNumberRegex);
                // First, try matching by full title. If not found, try matching by ticket number as a fallback.
                const sheetRowInfo = rowMap[detailCase.trim()] || (match && match[1] ? rowMap[`#${match[1]}`] : undefined);
                
                if (sheetRowInfo) {
                    const statusChanged = sheetRowInfo.currentStatus !== newStatus;
                    // Only consider it a change if the new Ticket OP is not empty
                    const ticketOpChanged = newTicketOp && sheetRowInfo.currentTicketOp !== newTicketOp;
                    
                    const formattedSheetCheckout = normalizeAndFormatDate(sheetRowInfo.currentCheckout);
                    const formattedNewCheckout = normalizeAndFormatDate(newCheckoutRaw);
                    const checkoutChanged = newStatus === 'Solved' && formattedSheetCheckout !== formattedNewCheckout;

                    if (statusChanged || ticketOpChanged || checkoutChanged) {
                         changesToPreview.push({
                            title: sheetRowInfo.title,
                            oldStatus: sheetRowInfo.currentStatus,
                            newStatus: newStatus,
                            oldTicketOp: sheetRowInfo.currentTicketOp,
                            newTicketOp: ticketOpChanged ? newTicketOp : sheetRowInfo.currentTicketOp,
                            oldCheckout: sheetRowInfo.currentCheckout,
                            newCheckout: newStatus === 'Solved' ? newCheckoutRaw : sheetRowInfo.currentCheckout,
                        });
                    }
                }
            }
        }
        
        if (changesToPreview.length === 0) {
            return { success: true, message: 'No changes detected. Everything is up-to-date.' };
        }

        return { success: true, changes: changesToPreview };

    } catch (error: any) {
        console.error('Failed to get update preview:', error.message);
        const apiError = error.errors?.[0]?.message || error.message || 'An unknown error occurred during preview generation.';
        return { error: apiError };
    }
}


export async function updateSheetStatus(
    data: { rows: Record<string, any>[] },
    sheetUrl: string
) {
     if (!data || data.rows.length === 0) {
        return { error: 'No data provided to update.' };
    }
    
    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-T-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];
    const sheetName = 'All Case';

    try {
        const sheets = getGoogleSheetsClient();
        const rowMap = await getSheetRowMap(sheets, spreadsheetId, sheetName);

        const updateRequests = [];
        const updatedRows: { 
            title: string, 
            rowIndex: number, 
            oldStatus: string, newStatus: string, 
            oldTicketOp: string, newTicketOp: string,
            oldCheckout: string, newCheckout: string,
        }[] = [];
        const ticketNumberRegex = /#(\d+)/;
        
        for (const appRow of data.rows) {
            const detailCase = appRow['Title'];
            const newStatus = appRow['Status'];
            const newTicketOp = appRow['Ticket OP'] || '';
            const newCheckoutRaw = appRow['Resolved At'] || '';

            if (typeof detailCase === 'string' && detailCase.trim()) {
                const match = detailCase.match(ticketNumberRegex);
                 // First, try matching by full title. If not found, try matching by ticket number as a fallback.
                const sheetRowInfo = rowMap[detailCase.trim()] || (match && match[1] ? rowMap[`#${match[1]}`] : undefined);
                
                if (sheetRowInfo) {
                    const statusChanged = sheetRowInfo.currentStatus !== newStatus;
                    // Only trigger an update if the new Ticket OP from the app is not empty and different.
                    const ticketOpChanged = newTicketOp && sheetRowInfo.currentTicketOp !== newTicketOp;

                    const formattedSheetCheckout = normalizeAndFormatDate(sheetRowInfo.currentCheckout);
                    const formattedNewCheckout = normalizeAndFormatDate(newCheckoutRaw);
                    const checkoutWillChange = newStatus === 'Solved' && formattedSheetCheckout !== formattedNewCheckout;
                    
                    if (statusChanged || ticketOpChanged || checkoutWillChange) {
                        if (statusChanged) {
                            updateRequests.push({
                                range: `${sheetName}!G${sheetRowInfo.rowIndex}`,
                                values: [[newStatus]],
                            });
                        }
                         if (ticketOpChanged) {
                            updateRequests.push({
                                range: `${sheetName}!T${sheetRowInfo.rowIndex}`,
                                values: [[newTicketOp]],
                            });
                        }
                         if (checkoutWillChange) { // Only update checkout if it's changing
                            updateRequests.push({
                                range: `${sheetName}!O${sheetRowInfo.rowIndex}`,
                                values: [[newCheckoutRaw]],
                            });
                        }

                        updatedRows.push({ 
                            title: detailCase, 
                            rowIndex: sheetRowInfo.rowIndex,
                            oldStatus: sheetRowInfo.currentStatus, 
                            newStatus, 
                            oldTicketOp: sheetRowInfo.currentTicketOp,
                            newTicketOp: ticketOpChanged ? newTicketOp : sheetRowInfo.currentTicketOp,
                            oldCheckout: sheetRowInfo.currentCheckout,
                            newCheckout: newStatus === 'Solved' ? newCheckoutRaw : sheetRowInfo.currentCheckout
                        });
                    }
                }
            }
        }
        
        if (updateRequests.length === 0) {
            return { success: true, message: 'No changes detected. Everything is up-to-date.', updatedRows: [] };
        }
        
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updateRequests,
            },
        });
        
        return { success: true, message: `Successfully updated ${updatedRows.length} rows.`, updatedRows, operationType: 'UPDATE' };

    } catch (error: any) {
        console.error('Failed to update sheet status:', error.message);
        const apiError = error.errors?.[0]?.message || error.message || 'An unknown error occurred during sheet update.';
        return { error: apiError };
    }
}

async function getSheetProperties(sheets: any, spreadsheetId: string, sheetName: string) {
    const response = await sheets.spreadsheets.get({
        spreadsheetId,
        ranges: [sheetName],
        fields: 'sheets.properties',
    });
    const sheet = response.data.sheets?.find(
        (s: any) => s.properties?.title?.trim().toLowerCase() === sheetName.trim().toLowerCase()
    );
    return sheet?.properties ?? null;
}

export async function importToSheet(
    data: { headers: string[], rows: Record<string, any>[] },
    sheetUrl: string
) {
    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-T-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];
    const sheetName = 'All Case';

    try {
        const sheets = getGoogleSheetsClient();

        // 1. Get sheet properties for sheetId and rowCount
        const sheetProperties = await getSheetProperties(sheets, spreadsheetId, sheetName);
        if (!sheetProperties || typeof sheetProperties.sheetId !== 'number') {
            return { error: `The target sheet named "${sheetName}" was not found in the spreadsheet.` };
        }
        const sheetId = sheetProperties.sheetId;
        const currentTotalRows = sheetProperties.gridProperties?.rowCount || 0;


        // 2. Get last row data by reading the entire 'No' column (A)
        const lastRowResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:A`, // Read the entire 'No' column
            majorDimension: 'ROWS',
        });
        const columnA = lastRowResponse.data.values || [];
        
        let lastRowIndex = 0;
        let lastNo = 0;
        
        // Find the last row that has a numerical value in column A.
        for (let i = columnA.length - 1; i >= 0; i--) {
            const noValue = columnA[i][0];
            if (noValue && !isNaN(Number(noValue))) {
                lastNo = parseInt(noValue, 10);
                lastRowIndex = i + 1; // 1-based index of the last row with a number
                break;
            }
        }
        
        // If the sheet is completely empty or has no numbers in column A, start from row 0.
        if (lastRowIndex === 0) {
            lastRowIndex = columnA.length;
        }


        // 3. Find existing titles to avoid duplicates (from column M)
        const titleRange = `${sheetName}!M:M`;
        const titleResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: titleRange,
        });
        const existingTitles = new Set(titleResponse.data.values ? titleResponse.data.values.flat() : []);
        
        const newRows = [];
        const duplicateRows = [];
        for (const row of data.rows) {
            const title = row['Title'];
            if (title && !existingTitles.has(title)) {
                newRows.push(row);
            } else if (title) {
                duplicateRows.push(title);
            }
        }
        
        if (newRows.length === 0) {
            return {
                success: true,
                message: 'No new data to import.',
                importedCount: 0,
                duplicateCount: duplicateRows.length,
                duplicates: duplicateRows
            };
        }
        
        // 4. Check if we need to add more rows to the sheet
        const requiredRowCount = lastRowIndex + newRows.length;
        if (requiredRowCount > currentTotalRows) {
            const rowsToAdd = requiredRowCount - currentTotalRows;
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{
                        appendDimension: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            length: rowsToAdd
                        }
                    }]
                }
            });
        }


        // 5. Prepare data for the operation.
        const valuesToAppend = newRows.map((row, index) => {
            const createdAtStr = row['Created At'];
            const dateForNewRow = createdAtStr ? new Date(createdAtStr) : new Date();

            if (isNaN(dateForNewRow.getTime())) {
                console.warn(`Invalid 'Created At' date for row, using current date: ${createdAtStr}`);
            }

            const day = dateForNewRow.getDate(); // No padding
            const month = String(dateForNewRow.getMonth() + 1).padStart(2, '0');
            const year = dateForNewRow.getFullYear();
            const dateStr = `${day}/${month}/${year}`;
            
            const monthStr = dateForNewRow.toLocaleString('id-ID', { month: 'long' });
            
            const currentRowNumberInSheet = lastRowIndex + index + 1;
            const ticketFormula = `=CONCATENATE("TKT-", TEXT(B${currentRowNumberInSheet}, "YYMMDD"), "-", TEXT(ROW()-2, "00000"))`;
            const statusCase2Formula = `=IF(G${currentRowNumberInSheet}="solved","SOLVED",IF(OR(G${currentRowNumberInSheet}="L1",G${currentRowNumberInSheet}="L2",G${currentRowNumberInSheet}="L3",G${currentRowNumberInSheet}="PM"),"UNSOLVED",""))`;
            const durationFormula = `=IF(R${currentRowNumberInSheet}="UNSOLVED", TODAY() - B${currentRowNumberInSheet}, "")`;

            const mainDataHeaders = [
                'Client Name', 'Customer Name', 'Status', 'Kolom kosong1', 
                'Ticket Category', 'Module', 'Detail Module', 'Created At', 
                'Title', 'Kolom kosong2', 'Resolved At', 'Ticket OP'
            ];
            
            const mainData = mainDataHeaders.map(header => row[header] || '');

            return [
                lastNo + index + 1,        // A - NO
                dateStr,                   // B - DATE
                monthStr,                  // C - MONTH
                ticketFormula,             // D - TICKET NUMBER (Formula)
                ...mainData.slice(0, 9),   // E-M (Client Name to Title)
                mainData[9],               // N - Kolom kosong2
                mainData[10],              // O - Resolved At
                '', '',                    // P-Q - Empty
                statusCase2Formula,        // R - STATUS CASE 2 (Formula)
                '',                        // S - Empty
                mainData[11],              // T - Ticket OP
                '',                        // U - Empty
                durationFormula            // V - Umur Case/Hari (Formula)
            ];
        });

        // 6. Use `update` instead of `append` to be resistant to filters.
        const startRowForUpdate = lastRowIndex + 1;
        const updateRange = `${sheetName}!A${startRowForUpdate}`;

        const updateResult = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: updateRange,
            valueInputOption: 'USER_ENTERED', // This is crucial for formulas
            requestBody: {
                values: valuesToAppend,
            },
        });


        // 7. Prepare data for the 'Undo' action
        const updatedRange = updateResult.data.updatedRange;
        if (!updatedRange) {
            return {
                success: true,
                message: `Import complete, but could not get range for undo action.`,
                importedCount: newRows.length,
                duplicateCount: duplicateRows.length,
                duplicates: duplicateRows,
            };
        }
        
        const startRowIndex = startRowForUpdate -1; // 0-indexed for API

        const undoData = {
            operationType: 'IMPORT',
            spreadsheetId,
            sheetId,
            startIndex: startRowIndex,
            count: newRows.length
        };

        return {
            success: true,
            message: `Import complete.`,
            importedCount: newRows.length,
            duplicateCount: duplicateRows.length,
            duplicates: duplicateRows,
            undoData
        };

    } catch (error: any) {
        console.error('Failed to import to sheet:', error.message);
        const apiError = error.errors?.[0]?.message || error.message || 'An unknown error occurred during sheet import.';
        return { error: `Import Error: ${apiError}` };
    }
}


export async function undoLastAction(
    undoData: any,
    sheetUrl: string,
) {
    if (!undoData) {
        return { error: 'No undo data available.' };
    }

    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-T-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];
    const sheetName = 'All Case';

    try {
        const sheets = getGoogleSheetsClient();

        if (undoData.operationType === 'IMPORT') {
            if (typeof undoData.sheetId !== 'number') {
                return { error: 'Invalid sheet ID for undo operation.' };
            }
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: undoData.sheetId,
                                dimension: 'ROWS',
                                startIndex: undoData.startIndex,
                                endIndex: undoData.startIndex + undoData.count
                            }
                        }
                    }]
                }
            });
            return { success: true, message: `Successfully undone import of ${undoData.count} rows.` };
        }

        if (undoData.operationType === 'UPDATE') {
             const updateRequests = undoData.updatedRows.flatMap((row: { 
                rowIndex: number, 
                oldStatus: string, 
                oldTicketOp: string,
                oldCheckout: string,
                newStatus: string, // to check if we need to revert checkout
                newTicketOp: string,
             }) => {
                const requests = [];
                // Always revert status
                requests.push({
                    range: `${sheetName}!G${row.rowIndex}`,
                    values: [[row.oldStatus]],
                });
                
                // Only revert Ticket OP if it was actually changed
                if (row.newTicketOp && row.oldTicketOp !== row.newTicketOp) {
                    requests.push({
                        range: `${sheetName}!T${row.rowIndex}`,
                        values: [[row.oldTicketOp]],
                    });
                }

                // Only revert checkout if it was changed
                if (row.newStatus === 'Solved') {
                    requests.push({
                         range: `${sheetName}!O${row.rowIndex}`,
                         values: [[row.oldCheckout]],
                    });
                }
                return requests;
             });

            if (updateRequests.length > 0) {
                 await sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        valueInputOption: 'USER_ENTERED',
                        data: updateRequests,
                    },
                });
            }
            return { success: true, message: `Successfully undone update of ${undoData.updatedRows.length} rows.` };
        }

        return { error: 'Unknown operation type for undo.' };

    } catch (error: any) {
        console.error('Failed to undo last action:', error.message);
        const apiError = error.errors?.[0]?.message || 'An unknown error occurred during undo operation.';
        return { error: apiError };
    }
}

export async function mergeFilesOnServer(
    fileAData: any,
    fileBData: any,
    editMode: 'nisn' | 'year' | 'nis' | null
) {
    if (!fileAData?.rows || !fileBData?.rows || !editMode) {
        return { error: "Missing file data or edit mode." };
    }

    const findHeader = (headers: string[] | undefined, keys: string[]) => {
        if (!headers) return undefined;
        const lowerKeys = keys.map(k => k.toLowerCase());
        return headers.find(h => lowerKeys.includes(h.toLowerCase()));
    };

    const normalizeName = (name: any): string => {
        if (typeof name !== 'string') return '';
        return name.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s{2,}/g, " ");
    };

    const nameHeaderKeys = ['nama', 'name', 'username'];
    const fileANameKey = findHeader(fileAData.headers, nameHeaderKeys);
    if (!fileANameKey) return { error: `Required 'Name' column not found in Source File.` };
    
    const fileBNameKey = findHeader(fileBData.headers, nameHeaderKeys);
    if (!fileBNameKey) return { error: `Required 'Name' column not found in ID File.` };

    const eliminationKeys: Record<typeof editMode, string[]> = {
        nisn: ['nisn'],
        nis: ['nis'],
        year: ['year', 'tahun ajaran']
    };
    const columnToCheck = findHeader(fileBData.headers, eliminationKeys[editMode]);
     if (!columnToCheck) {
         return { error: `Required column for this mode ('${eliminationKeys[editMode].join("' or '")}') not found in ID File.` };
    }
    
    // --- Start of New Logic ---

    // 1. Filter File B to only include rows with a valid name.
    const validFileBRows = fileBData.rows.filter((row: any) => {
        const name = row[fileBNameKey];
        return name && typeof name === 'string' && name.trim() !== '';
    });

    // 2. Identify rows in File B that already have data and should be eliminated.
    const namesToEliminate = new Set<string>();
    validFileBRows.forEach((row: any) => {
        const valueInB = row[columnToCheck];
        const hasExistingValue = valueInB !== null && valueInB !== undefined && String(valueInB).trim() !== '';
        if (hasExistingValue) {
            namesToEliminate.add(normalizeName(row[fileBNameKey]));
        }
    });

    // 3. Create a map of clean File B rows for matching.
    const fileBMap = new Map<string, any>();
    validFileBRows.forEach((row: any) => {
        const normalizedName = normalizeName(row[fileBNameKey]);
        if (!namesToEliminate.has(normalizedName)) {
            fileBMap.set(normalizedName, row);
        }
    });

    // 4. Iterate through File A and perform matching.
    const mergedRows: any[] = [];
    const unmatchedFileA: any[] = [];
    const usedInMatch_B_Names = new Set<string>();

    let existingCount = 0;

    for (const rowA of fileAData.rows) {
        const normalizedNameA = normalizeName(rowA[fileANameKey]);
        if (namesToEliminate.has(normalizedNameA)) {
            existingCount++;
            continue; // Skip this row from File A as its match in File B already has data.
        }

        const matchedRowB = fileBMap.get(normalizedNameA);
        if (matchedRowB) {
            mergedRows.push({ ...rowA, ...matchedRowB });
            usedInMatch_B_Names.add(normalizeName(matchedRowB[fileBNameKey]));
        } else {
            unmatchedFileA.push(rowA);
        }
    }
    
    // 5. Determine unmatched rows from both files.
    const matchedCount = mergedRows.length;
    const totalInFileA = fileAData.rows.length;
    const unmatchedACount = unmatchedFileA.length; // This is the real unmatched count from source

    const unmatchedFileB = Array.from(fileBMap.values()).filter(rowB => {
        const normalizedNameB = normalizeName(rowB[fileBNameKey]);
        return !usedInMatch_B_Names.has(normalizedNameB);
    });

    return {
        mergedRows,
        unmatchedFileA,
        unmatchedFileB,
        summary: {
            total: totalInFileA,
            existing: existingCount,
            matched: matchedCount,
            unmatched: unmatchedACount,
        }
    };
}


// New function to fetch and format L3 report data
export async function fetchL3ReportData(sheetUrl: string) {
    if (!sheetUrl) {
        return { error: "URL is empty. Please provide a Google Sheet URL." };
    }
    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-T-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];
    const sheetName = 'All Case';

    try {
        const sheets = getGoogleSheetsClient();
        
        // 1. First pass: Get only the STATUS column (G) from the second row downwards
        const statusResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!G2:G`,
        });

        const statusRows = statusResponse.data.values;
        if (!statusRows || statusRows.length === 0) {
            return { error: 'No data found in the status column.' };
        }

        const l3RowNumbers: number[] = [];
        statusRows.forEach((row, index) => {
            // Check if the first cell of the row is 'L3'
            if (row[0] === 'L3') {
                // Add 2 to the index because our range starts from G2 and indices are 0-based
                l3RowNumbers.push(index + 2);
            }
        });

        if (l3RowNumbers.length === 0) {
            return { success: true, report: `*Update cases yang belum solved L3 on hold*\n\nTotal : 0` };
        }
        
        // 2. Second pass: Get the full data only for the identified L3 rows
        const l3DataRanges = l3RowNumbers.map(rowNum => `${sheetName}!B${rowNum}:W${rowNum}`);
        const fullDataResponse = await sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges: l3DataRanges,
        });

        const l3Rows = fullDataResponse.data.valueRanges?.map(vr => vr.values?.[0] || []) || [];

        const l3CasesWithDuration = l3Rows.map(row => {
            const today = new Date();
            // Indexes are now relative to the range B:W (0 to 21)
            const dateStr = row[0]; // B
            let duration = -1;
            if (dateStr) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    const caseDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); // DD/MM/YYYY
                    if (!isNaN(caseDate.getTime())) {
                         const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                         const caseDateAtMidnight = new Date(caseDate.getFullYear(), caseDate.getMonth(), today.getDate());
                         const diffTime = Math.abs(todayAtMidnight.getTime() - caseDateAtMidnight.getTime());
                         duration = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    }
                }
            }

            const clientName = row[3] || '';  // E
            const moduleValue = row[8] || ''; // J
            const title = row[11] || '';      // M
            const ticketOp = row[18] || '';    // T
            const jiraUrl = row[21] || '';    // W

            let category = 'Akademik';
            if (['Payment', 'Pintro Pay'].includes(moduleValue)) category = 'Payment';
            else if (moduleValue === 'Aplikasi/Mobile') category = 'Aplikasi/Mobile';
            else if (moduleValue === 'Akses Portal') category = 'Akses Portal';
            
            const fullTitle = [clientName, title, ticketOp, jiraUrl].filter(Boolean).join(' ');

            return { category, title: fullTitle, duration, date: dateStr };
        });

        const groupedCases: Record<string, typeof l3CasesWithDuration> = {};
        l3CasesWithDuration.forEach(caseItem => {
            if (!groupedCases[caseItem.category]) groupedCases[caseItem.category] = [];
            groupedCases[caseItem.category].push(caseItem);
        });

        const minDate = l3CasesWithDuration.reduce((min, item) => {
            if (!item.date) return min;
            const parts = item.date.split('/');
            if (parts.length !== 3) return min;
            const caseDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            return !min || caseDate < min ? caseDate : min;
        }, null as Date | null);

        const maxDate = l3CasesWithDuration.reduce((max, item) => {
            if (!item.date) return max;
            const parts = item.date.split('/');
            if (parts.length !== 3) return max;
            const caseDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            return !max || caseDate > max ? caseDate : max;
        }, null as Date | null);

        const formatDate = (date: Date | null) => {
            if (!date) return '';
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }

        let reportText = `*Update cases yang belum solved L3 on hold (${formatDate(minDate)} - ${formatDate(maxDate)})*\n\n`;
        reportText += `Total : ${l3Rows.length}\n`;
        
        const categoryCounts = Object.entries(groupedCases).map(([category, cases]) => `${category} > L3 : ${cases.length}`).join('\n');
        reportText += `${categoryCounts}\n\n`;

        Object.entries(groupedCases).forEach(([category, cases]) => {
            reportText += `*${category.toUpperCase()} > L3*\n`;
            cases.forEach((caseItem, index) => {
                const durationText = caseItem.duration >= 0 ? `(${caseItem.duration} hari)` : '';
                reportText += `${index + 1}. ${caseItem.title} ${durationText}\n`;
            });
            reportText += '\n';
        });

        return { success: true, report: reportText.trim() };

    } catch (error: any) {
        console.error('Failed to fetch L3 report data:', error.message);
        const apiError = error.errors?.[0]?.message || 'An unknown error occurred while fetching L3 report.';
        return { error: `Report Generation Failed: ${apiError}` };
    }
}
    
    

    






    

    

    

    


  


      



    

    

    

    




    

    

    

    

    

    

    
