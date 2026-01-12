
"use server";

import { unstable_cache } from 'next/cache';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { redis } from '@/lib/redis';
import { knowledgeBaseFlow } from '@/ai/flows/knowledge-base-flow';

const CACHE_KEY = 'dashboard_data_cache';
const CACHE_KEY_ALL_CASE = 'all_case_data_cache';


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
  "src/app/dashboard/page.tsx",
  "src/app/db/page.tsx",
  "src/app/knowledge-base/page.tsx",

  // Komponen Utama (logika untuk setiap halaman)
  "src/components/import-flow.tsx",
  "src/components/report-harian.tsx",
  "src/components/migrasi-murid.tsx",
  "src/components/cek-duplikasi.tsx",
  "src/components/data-weaver.tsx",
  "src/components/layout/client-layout.tsx",
  "src/components/migrasi-produk.tsx",
  "src/components/dashboard.tsx",
  "src/components/db-viewer.tsx",
  "src/components/knowledge-base.tsx",


  // Aksi & Logika Server
  "src/app/actions.ts",
  "src/lib/utils.ts",
  "src/lib/date-utils.ts",
  "src/lib/redis.ts",

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
  "src/ai/flows/knowledge-base-flow.ts",

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
  "src/components/ui/theme-switch.css",
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

const getGoogleApiClients = () => {
    let credentials;
    if (process.env.GCP_CREDENTIALS) {
        try {
            credentials = JSON.parse(process.env.GCP_CREDENTIALS);
        } catch (error) {
            console.error('Error parsing GCP_CREDENTIALS:', error);
            throw new Error('Could not parse Google Cloud credentials.');
        }
    } else {
        try {
            const filePath = path.join(process.cwd(), 'src', 'lib', 'gcp-credentials.json');
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            credentials = JSON.parse(fileContent);
        } catch (error) {
            console.error('Error reading or parsing credentials file:', error);
            throw new Error('Could not load Google Cloud credentials.');
        }
    }
    
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: credentials.client_email,
            private_key: credentials.private_key.replace(/\\n/g, '\n'),
        },
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.readonly' 
        ],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    return { sheets, drive };
}

export async function getGoogleDriveFileTitle(fileUrl: string) {
    if (!fileUrl) {
        return { error: "URL is empty. Please provide a Google Drive URL." };
    }

    const idRegex = /(?:spreadsheets\/d\/|document\/d\/|file\/d\/|folders\/)([a-zA-Z0-9-_]+)/;
    const match = fileUrl.match(idRegex);

    if (!match || !match[1]) {
        return { error: 'Invalid Google Drive URL format.' };
    }
    const fileId = match[1];

    try {
        const { drive } = getGoogleApiClients();
        const response = await drive.files.get({
            fileId: fileId,
            fields: 'name',
        });

        const title = response.data.name;

        if (!title) {
            return { error: "Could not retrieve the file/folder title." };
        }

        return { success: true, title };
    } catch (error: any) {
        console.error('Failed to get Google Drive file title:', error.message);
        const apiError = error.errors?.[0]?.message || error.message || 'An unknown error occurred while analyzing the URL.';
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

    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];
    const sheetName = 'All Case';

    try {
        const { sheets } = getGoogleApiClients();
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
    
    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];
    const sheetName = 'All Case';

    try {
        const { sheets } = getGoogleApiClients();
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
        
        // After successful update, trigger cache sync
        await syncDashboardCache(sheetUrl);

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
    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];
    const sheetName = 'All Case';

    try {
        const { sheets } = getGoogleApiClients();

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

        // After successful import, trigger cache sync
        await syncDashboardCache(sheetUrl);

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

    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];
    const sheetName = 'All Case';

    try {
        const { sheets } = getGoogleApiClients();

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
            await syncDashboardCache(sheetUrl); // Resync cache after undo
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
            await syncDashboardCache(sheetUrl); // Resync cache after undo
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

export async function fetchL3ReportData(sheetUrl: string) {
    if (!sheetUrl) {
        return { error: "URL is empty. Please provide a Google Sheet URL." };
    }
    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];

    try {
        const { sheets } = getGoogleApiClients();

        // More efficient: request multiple specific columns in one batchGet call
        const ranges = [
            'All Case!B:B', // DATE
            'All Case!E:E', // CLIENT NAME
            'All Case!G:G', // STATUS CASE
            'All Case!J:J', // MODULE
            'All Case!M:M', // DETAIL CASE
            'All Case!T:T', // TICKET OP
            'All Case!W:W', // URL Jira
        ];

        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges,
        });

        const valueRanges = response.data.valueRanges;
        if (!valueRanges || valueRanges.length === 0) {
            return { error: 'No data found in the specified columns.' };
        }

        const [
            dateValues, clientValues, statusValues, 
            moduleValues, titleValues, ticketOpValues, jiraValues
        ] = valueRanges.map(vr => vr.values || []);
        
        const numRows = statusValues.length;
        const l3CasesWithDuration = [];
        const today = new Date();

        for (let i = 1; i < numRows; i++) { // Start from 1 to skip header
            const status = statusValues[i]?.[0];
            if (status === 'L3') {
                const dateStr = dateValues[i]?.[0];
                let duration = -1;
                if (dateStr) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        const caseDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); // DD/MM/YYYY
                        if (!isNaN(caseDate.getTime())) {
                            const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                            const caseDateAtMidnight = new Date(caseDate.getFullYear(), caseDate.getMonth(), caseDate.getDate());
                            const diffTime = Math.abs(todayAtMidnight.getTime() - caseDateAtMidnight.getTime());
                            duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        }
                    }
                }

                const clientName = clientValues[i]?.[0] || '';
                const moduleValue = moduleValues[i]?.[0] || '';
                const title = titleValues[i]?.[0] || '';
                const ticketOp = ticketOpValues[i]?.[0] || '';
                const jiraUrl = jiraValues[i]?.[0] || '';
                
                let category = 'Akademik';
                if (['Payment', 'Pintro Pay'].includes(moduleValue)) category = 'Payment';
                else if (moduleValue === 'Aplikasi/Mobile') category = 'Aplikasi/Mobile';
                else if (moduleValue === 'Akses Portal') category = 'Akses Portal';
                
                const fullTitle = [clientName, title, ticketOp, jiraUrl].filter(Boolean).join(' ');

                l3CasesWithDuration.push({ category, title: fullTitle, duration, date: dateStr });
            }
        }

        if (l3CasesWithDuration.length === 0) {
            return { success: true, report: `*Update cases yang belum solved L3 on hold*\n\nTotal : 0` };
        }

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
        reportText += `Total : ${l3CasesWithDuration.length}\n`;
        
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


const isRedisConfigured = () => {
    return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
}
    
export async function getDashboardData(sheetUrl: string) {
    if (isRedisConfigured()) {
        try {
            const cachedData = await redis.get(CACHE_KEY);
            if (cachedData) {
                console.log('Cache hit for dashboard data.');
                return { data: JSON.parse(cachedData as string), source: 'cache' };
            }
        } catch (error) {
            console.warn('Could not read from Redis cache. Falling back to Google Sheets.', error);
        }
    }

    console.log('Cache miss or Redis not configured. Fetching dashboard data from Google Sheets.');
    const result = await fetchDashboardDataFromSheet(sheetUrl, "Summary");

    if (result.data && isRedisConfigured()) {
        // Asynchronously update cache but don't block the response
        syncCache(sheetUrl, result.data, CACHE_KEY).catch(err => {
             console.error("Async dashboard cache update failed:", err);
        });
    }

    return { ...result, source: 'sheet' };
}

async function fetchDashboardDataFromSheet(sheetUrl: string, sheetName: 'Summary' | 'All Case') {
    if (!sheetUrl) {
        return { error: "URL is empty. Please provide a Google Sheet URL." };
    }
    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];

    const { sheets } = getGoogleApiClients();

    const tryFetch = async (name: string) => {
        // Sheet names with spaces or special characters need to be quoted.
        const range = `'${name}'!A:Z`;
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                return { error: `No data found in the ${name} sheet.` };
            }
            const headers = rows.shift();
            if (!headers) {
                return { error: `No headers found in the ${name} sheet.` };
            }
            const jsonData = rows.map(row => {
                const rowData: Record<string, string> = {};
                headers.forEach((header, index) => {
                    rowData[header] = row[index] || '';
                });
                return rowData;
            });
            return { data: jsonData };
        } catch (error: any) {
            // Check if it's a "range not found" error, which is expected if the sheet name is wrong.
            if (error.message && error.message.includes('Unable to parse range')) {
                return { error: `Sheet '${name}' not found.`, isSheetNotFoundError: true };
            }
            throw error; // Re-throw other errors
        }
    };
    
    if (sheetName === 'All Case') {
        const primaryName = 'All Case';
        const fallbackName = 'CASES';

        let result = await tryFetch(primaryName);

        // If the first attempt fails because the sheet is not found, try the fallback.
        if (result.error && (result as any).isSheetNotFoundError) {
            console.log(`Sheet '${primaryName}' not found, trying '${fallbackName}'.`);
            result = await tryFetch(fallbackName);
        }

        // If even the fallback fails with a sheet not found error, return a cleaner message.
        if (result.error && (result as any).isSheetNotFoundError) {
             return { error: `Could not find sheet '${primaryName}' or '${fallbackName}'.` };
        }
        
        return result;

    } else { // For 'Summary' or other direct names
        return await tryFetch(sheetName);
    }
}

async function syncCache(sheetUrl: string, data: any, cacheKey: string) {
    if (!isRedisConfigured()) {
        console.log(`Skipping cache sync for ${cacheKey}: Redis is not configured.`);
        return { success: true, message: "Skipped: Redis not configured." };
    }

    try {
        if (data) {
            await redis.set(cacheKey, JSON.stringify(data));
            console.log(`Successfully synchronized ${cacheKey} to Redis cache.`);
            return { success: true, message: 'Cache synchronized.' };
        }
        return { success: false, error: `No data provided to sync for ${cacheKey}.` };
    } catch (error: any) {
        console.error(`An unexpected error occurred during cache synchronization for ${cacheKey}:`, error);
        return { success: false, error: error.message || `Unknown error during ${cacheKey} sync.` };
    }
}

export async function syncDashboardCache(sheetUrl: string) {
    const result = await fetchDashboardDataFromSheet(sheetUrl, "Summary");
    if (result.error) {
        console.warn(`Dashboard cache sync failed: ${result.error}`);
        return { success: false, error: result.error };
    }
    return syncCache(sheetUrl, result.data, CACHE_KEY);
}

export async function getAllCaseData(sheetUrl: string) {
    if (isRedisConfigured()) {
        try {
            const cachedData = await redis.get(CACHE_KEY_ALL_CASE);
            if (cachedData) {
                console.log('Cache hit for All Case data.');
                return { data: JSON.parse(cachedData as string), source: 'cache' };
            }
        } catch (error) {
            console.warn('Could not read All Case from Redis cache. Falling back to Google Sheets.', error);
        }
    }

    console.log('Cache miss or Redis not configured. Fetching All Case data from Google Sheets.');
    const result = await fetchDashboardDataFromSheet(sheetUrl, "All Case");

    if (result.data && isRedisConfigured()) {
        // Asynchronously update cache
        redis.set(CACHE_KEY_ALL_CASE, JSON.stringify(result.data)).catch(err => {
             console.error("Async All Case cache update failed:", err);
        });
    }

    return { ...result, source: 'sheet' };
}

// ---- AI KNOWLEDGE BASE ENGINE ----

async function fetchRawKnowledgeData(sheetUrl: string): Promise<string[][]> {
    const idRegex = /(?:spreadsheets\/d\/|document\/d\/|file\/d\/|folders\/)([a-zA-Z0-9-_]+)/;
    const match = sheetUrl.match(idRegex);
    if (!match || !match[1]) {
        throw new Error("Invalid Google Drive URL format for Knowledge Base.");
    }
    const spreadsheetId = match[1];

    try {
        const { sheets } = getGoogleApiClients();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'A:Z', // Ambil semua data dari sheet pertama
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            throw new Error("Knowledge Base sheet is empty.");
        }
        return rows as string[][];
    } catch (error: any) {
        console.error("Error fetching from KB sheet:", error.message);
        throw new Error(`Failed to fetch data from Knowledge Base sheet. ${error.message}`);
    }
}

export async function runKnowledgeBaseEngine(
    knowledgeBaseUrl: string,
    query: string
) {
    try {
        // Step 1: Data Validation & Cleaning
        console.log("KB Engine - Step 1: Fetching and validating data...");
        const rawData = await fetchRawKnowledgeData(knowledgeBaseUrl);
        const headers = rawData.shift() || [];
        if (headers.length === 0) {
            return { success: false, error: "Knowledge Base sheet is missing a header row." };
        }
        const cleanedData = rawData.filter(row => row.some(cell => typeof cell === 'string' && cell.trim() !== ''));
        console.log(`KB Engine - Step 1: Completed. Found ${cleanedData.length} valid rows.`);

        // Step 2: Content Structuring & Chunking
        console.log("KB Engine - Step 2: Structuring content into chunks...");
        // Combine all rows into a single string for the context. This is a simple approach.
        // For very large datasets, a more sophisticated chunking and retrieval strategy would be needed.
        const context = cleanedData.map(row => headers.map((h, i) => `${h}: ${row[i] || 'N/A'}`).join(', ')).join('\n');
        console.log("KB Engine - Step 2: Completed. Context is ready.");

        // Step 3-5 are now handled by the Genkit Flow
        console.log("KB Engine - Step 3: Passing to AI for analysis...");
        const response = await knowledgeBaseFlow({ query, context });
        console.log("KB Engine - Step 4: AI analysis complete.");

        console.log("KNOWLEDGE BASE ENGINE PIPELINE FINISHED SUCCESSFULLY.");
        return { success: true, message: "Successfully generated an answer.", data: { answer: response.answer } };

    } catch (error: any) {
        console.error("Knowledge Base Engine pipeline failed:", error);
        return { success: false, error: error.message };
    }
}
    


    

    
