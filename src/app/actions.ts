
"use server";

import { unstable_cache } from 'next/cache';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Daftar file yang sama seperti di code-viewer sebelumnya
const projectFilesForAction = [
  // File konfigurasi root
  "README.md",
  ".gitignore",
  "postcss.config.js",
  "components.json",
  "next.config.ts",
  "package.json",
  "tailwind.config.ts",
  "tsconfig.json",

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

  // Komponen Utama (logika untuk setiap halaman)
  "src/components/import-flow.tsx",
  "src/components/report-harian.tsx",
  "src/components/migrasi-murid.tsx",
  "src/components/cek-duplikasi.tsx",
  "src/components/data-weaver.tsx",
  "src/components/layout/client-layout.tsx",

  // Aksi & Logika Server
  "src/app/actions.ts",
  "src/lib/utils.ts",
  "src/lib/date-utils.ts",
  "src/lib/gcp-credentials.json",

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
  "src/components/ui/switch.tsx",
  "src/components/ui/table.tsx",
  "src/components/ui/tabs.tsx",
  "src/components/ui/textarea.tsx",
  "src/components/ui/toast.tsx",
  "src/components/ui/toaster.tsx",
  "src/components/ui/tooltip.tsx",
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

    const ticketNumberRegex = /#(\d+)/;
    const rowMap: Record<string, { rowIndex: number, currentStatus: string; currentTicketOp: string; title: string, currentCheckout: string; }> = {};
    sheetRows.forEach((row, index) => {
        const currentStatus = row[0] || ''; // Column G
        const detailCase = row[6]; // Column M (G is 0, so M is 6)
        const currentCheckout = row[8] || ''; // Column O (G is 0, so O is 8)
        const currentTicketOp = row[13] || ''; // Column T (G is 0, so T is 13)

        if (typeof detailCase === 'string') {
            const match = detailCase.match(ticketNumberRegex);
            if (match && match[1]) {
                const ticketNumber = match[1];
                rowMap[ticketNumber] = {
                    rowIndex: index + 1, // 1-based index
                    currentStatus: currentStatus,
                    currentTicketOp: currentTicketOp,
                    title: detailCase,
                    currentCheckout: currentCheckout
                };
            }
        }
    });
    return rowMap;
}

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
            const newCheckout = appRow['Resolved At'] || '';

            if (typeof detailCase === 'string') {
                const match = detailCase.match(ticketNumberRegex);
                if (match && match[1]) {
                    const ticketNumber = match[1];
                    const sheetRowInfo = rowMap[ticketNumber];
                    
                    if (sheetRowInfo) {
                        const statusChanged = sheetRowInfo.currentStatus !== newStatus;
                        // Only consider it a change if the new Ticket OP is not empty
                        const ticketOpChanged = newTicketOp && sheetRowInfo.currentTicketOp !== newTicketOp;
                        const checkoutChanged = newStatus === 'Solved' && sheetRowInfo.currentCheckout !== newCheckout;

                        if (statusChanged || ticketOpChanged || checkoutChanged) {
                             changesToPreview.push({
                                title: sheetRowInfo.title,
                                oldStatus: sheetRowInfo.currentStatus,
                                newStatus: newStatus,
                                oldTicketOp: sheetRowInfo.currentTicketOp,
                                newTicketOp: ticketOpChanged ? newTicketOp : sheetRowInfo.currentTicketOp,
                                oldCheckout: sheetRowInfo.currentCheckout,
                                newCheckout: newStatus === 'Solved' ? newCheckout : sheetRowInfo.currentCheckout,
                            });
                        }
                    }
                }
            }
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
            const newCheckout = appRow['Resolved At'] || '';

            if (typeof detailCase === 'string') {
                const match = detailCase.match(ticketNumberRegex);
                if (match && match[1]) {
                    const ticketNumber = match[1];
                    const sheetRowInfo = rowMap[ticketNumber];
                    
                    if (sheetRowInfo) {
                        const statusChanged = sheetRowInfo.currentStatus !== newStatus;
                        // Only trigger an update if the new Ticket OP from the app is not empty and different.
                        const ticketOpChanged = newTicketOp && sheetRowInfo.currentTicketOp !== newTicketOp;
                        const isSolvedNow = newStatus === 'Solved';
                        const checkoutWillChange = isSolvedNow && sheetRowInfo.currentCheckout !== newCheckout;
                        
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
                                    values: [[newCheckout]],
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
                                newCheckout: isSolvedNow ? newCheckout : sheetRowInfo.currentCheckout
                            });
                        }
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
                'Title', 'Kolom kosong2', 'Resolved At'
            ];
            
            const mainData = mainDataHeaders.map(header => row[header] || '');

            return [
                lastNo + index + 1,        // A - NO
                dateStr,                   // B - DATE
                monthStr,                  // C - MONTH
                ticketFormula,             // D - TICKET NUMBER (Formula)
                ...mainData,               // E-O (11 columns from JSON)
                '', '',                    // P-Q - Empty
                statusCase2Formula,        // R - STATUS CASE 2 (Formula)
                '',                        // S - Empty
                row['Ticket OP'] || '',    // T - Ticket OP
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

export async function mergeFilesOnServer(fileAData: any, fileBData: any, mergeKey: string) {
    // Helper to find header case-insensitively
    const findHeader = (headers: string[] | undefined, key: string) => {
        if (!headers) return undefined;
        return headers.find(h => h.toLowerCase() === key.toLowerCase());
    };
    
    // Validate required data and headers
    if (!fileAData?.rows || !fileBData?.rows || !mergeKey) {
        return { mergedRows: [], unmatchedRowsB: fileBData?.rows || [], error: "Missing file data or merge key." };
    }

    const fileAMergeKey = findHeader(fileAData.headers, mergeKey);
    const fileBMergeKey = findHeader(fileBData.headers, mergeKey);
    const nisnHeaderA = findHeader(fileAData.headers, 'nisn');

    if (!fileAMergeKey || !fileBMergeKey) {
        return { 
            mergedRows: [], 
            unmatchedRowsB: fileBData.rows,
            error: `Merge key "${mergeKey}" not found in one or both files.`
        };
    }
     if (!nisnHeaderA) {
        return { 
            mergedRows: [], 
            unmatchedRowsB: fileBData.rows,
            error: `Required "NISN" header not found in File A.`
        };
    }

    // Create a map of File A for efficient lookups.
    // Key: lowercase mergeKey value. Value: Array of rows from File A that match the key.
    const fileAMap = new Map<string, any[]>();
    for (const rowA of fileAData.rows) {
        const key = String(rowA[fileAMergeKey] || '').toLowerCase().trim();
        const nisnValue = String(rowA[nisnHeaderA] || '').trim();
        
        // Only add to map if the key is valid and it has a NISN.
        if (key && nisnValue) { 
            if (!fileAMap.has(key)) {
                fileAMap.set(key, []);
            }
            // Add the row to the array for that key. We'll handle multiple matches later.
            fileAMap.get(key)?.push(rowA);
        }
    }

    const mergedRows: any[] = [];
    const unmatchedRowsB: any[] = [];
    
    for (const rowB of fileBData.rows) {
        const key = String(rowB[fileBMergeKey] || '').toLowerCase().trim();
        let matchFound = false;

        if (key && fileAMap.has(key)) {
            const potentialMatches = fileAMap.get(key) || [];
            // For simplicity, we take the first valid match.
            // More complex logic could be added here to handle multiple matches if needed.
            const firstValidMatch = potentialMatches.find(match => match[nisnHeaderA]);

            if (firstValidMatch) {
                // Match found and it has a NISN.
                const mergedRow = { ...firstValidMatch, ...rowB };
                mergedRows.push(mergedRow);
                matchFound = true;
            }
        }
        
        if (!matchFound) {
            // No match in File A OR the match in File A had no NISN
            unmatchedRowsB.push(rowB);
        }
    }
    
    return { mergedRows, unmatchedRowsB };
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

    try {
        const sheets = getGoogleSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'All Case!B:T', // DATE to Ticket OP
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) {
            return { error: 'No data found in the sheet.' };
        }

        const dataRows = rows.slice(1);

        // Hardcoded indexes based on the provided range B:T
        const dateIndex = 0;         // DATE is in column B (index 0)
        const statusIndex = 5;       // STATUS CASE is in column G (index 5)
        const moduleIndex = 8;       // Modul is in column J (index 8)
        const titleIndex = 11;       // TITLE is in column M (index 11)
        const ticketOpIndex = 18;    // Ticket OP is in column T (index 18)

        const l3Cases = dataRows.filter(row => row[statusIndex] === 'L3');

        const l3CasesWithDuration = l3Cases.map(row => {
            const today = new Date();
            const dateStr = row[dateIndex];
            let duration = -1; // Default/error value
            if (dateStr) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    // Assuming DD/MM/YYYY
                    const caseDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    if (!isNaN(caseDate.getTime())) {
                        // Set time to 00:00:00 for both dates to get clean day difference
                        const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                        const caseDateAtMidnight = new Date(caseDate.getFullYear(), caseDate.getMonth(), caseDate.getDate());
                        
                        const diffTime = Math.abs(todayAtMidnight.getTime() - caseDateAtMidnight.getTime());
                        duration = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    }
                }
            }
            
            const moduleValue = row[moduleIndex] || '';
            let category = 'Akademik'; // Default category
            if (moduleValue === 'Payment' || moduleValue === 'Pintro Pay') {
                category = 'Payment';
            } else if (moduleValue === 'Aplikasi/Mobile') {
                category = 'Aplikasi/Mobile';
            } else if (moduleValue === 'Akses Portal') {
                category = 'Akses Portal';
            }

            const title = row[titleIndex] || '';
            const ticketOp = row[ticketOpIndex] || '';
            const fullTitle = [title, ticketOp].filter(Boolean).join(' ');

            return {
                category: category,
                title: fullTitle,
                duration: duration,
            };
        });

        const groupedCases: Record<string, typeof l3CasesWithDuration> = {};
        l3CasesWithDuration.forEach(caseItem => {
            if (!groupedCases[caseItem.category]) {
                groupedCases[caseItem.category] = [];
            }
            groupedCases[caseItem.category].push(caseItem);
        });

        const minDate = l3Cases.reduce((min, row) => {
             const dateStr = row[dateIndex];
             if (!dateStr) return min;
             const parts = dateStr.split('/');
             if (parts.length !== 3) return min;
             const caseDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
             return !min || caseDate < min ? caseDate : min;
        }, null as Date | null);

        const maxDate = l3Cases.reduce((max, row) => {
            const dateStr = row[dateIndex];
             if (!dateStr) return max;
             const parts = dateStr.split('/');
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

        let reportText = `Update cases yang belum solved L3 on hold (${formatDate(minDate)} - ${formatDate(maxDate)})\n\n`;
        reportText += `Total : ${l3Cases.length}\n`;
        
        const categoryCounts = Object.entries(groupedCases).map(([category, cases]) => `${category} > L3 : ${cases.length}`).join('\n');
        reportText += `${categoryCounts}\n\n`;

        Object.entries(groupedCases).forEach(([category, cases]) => {
            reportText += `${category.toUpperCase()} > L3\n`;
            cases.forEach((caseItem, index) => {
                reportText += `${index + 1}. ${caseItem.title} (${caseItem.duration >= 0 ? `${caseItem.duration} hari` : 'N/A'})\n`;
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
    
    

    






    

    