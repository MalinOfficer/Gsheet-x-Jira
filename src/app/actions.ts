
"use server";

import { unstable_cache } from 'next/cache';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

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
    try {
        const filePath = path.join(process.cwd(), 'src', 'lib', 'gcp-credentials.json');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        credentials = JSON.parse(fileContent);
    } catch (error) {
        console.error('Error reading or parsing credentials file:', error);
        throw new Error('Could not load Google Cloud credentials from the server.');
    }
    
    const clientEmail = credentials.client_email;
    const privateKey = credentials.private_key;

    if (!clientEmail || !privateKey) {
        throw new Error('Google Cloud credentials are not configured correctly in gcp-credentials.json.');
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: clientEmail,
            private_key: privateKey.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    return google.sheets({ version: 'v4', auth });
}


export async function getSheetTitle(url: string) {
  if (!url) {
    return { error: 'URL is required.' };
  }

  const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const match = url.match(sheetIdRegex);
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
        return { error: 'Could not retrieve the sheet title.' };
    }
    return { title };
  } catch (error: any) {
    console.error('Failed to get sheet title:', error.message);
    const apiError = error.errors?.[0]?.message || 'Could not access the sheet. Please check the URL and sharing permissions.';
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
        const sheets = getGoogleSheetsClient();

        // Read the title (M) and status (G) columns to map ticket numbers to row indices and get current status
        const rangeToRead = `${sheetName}!G:M`; 
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: rangeToRead,
        });

        const sheetRows = response.data.values;
        if (!sheetRows || sheetRows.length === 0) {
            return { error: 'Could not find any data in the target sheet.' };
        }

        const ticketNumberRegex = /#(\d+)/;
        // The G column is index 0, and M is index 6 in the response
        const rowMap: Record<string, { rowIndex: number, currentStatus: string }> = {};
        sheetRows.forEach((row, index) => {
            const currentStatus = row[0] || '';
            const detailCase = row[6]; // Column M
            if (typeof detailCase === 'string') {
                const match = detailCase.match(ticketNumberRegex);
                if (match && match[1]) {
                    const ticketNumber = match[1];
                    rowMap[ticketNumber] = { 
                        rowIndex: index + 1, // 1-based index for sheets
                        currentStatus: currentStatus 
                    };
                }
            }
        });

        const updateRequests = [];
        const updatedRows: { title: string, status: string }[] = [];
        
        for (const appRow of data.rows) {
            const detailCase = appRow['Title'];
            const newStatus = appRow['Status'];

            if (typeof detailCase === 'string' && newStatus) {
                const match = detailCase.match(ticketNumberRegex);
                if (match && match[1]) {
                    const ticketNumber = match[1];
                    const sheetRowInfo = rowMap[ticketNumber];
                    
                    if (sheetRowInfo && sheetRowInfo.currentStatus !== newStatus) {
                        updateRequests.push({
                            range: `${sheetName}!G${sheetRowInfo.rowIndex}`,
                            values: [[newStatus]],
                        });
                        updatedRows.push({ title: detailCase, status: newStatus });
                    }
                }
            }
        }
        
        if (updateRequests.length === 0) {
            return { success: true, message: 'No status changes detected. Everything is up-to-date.', updatedRows: [] };
        }
        
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updateRequests,
            },
        });
        
        return { success: true, message: `Successfully updated ${updatedRows.length} rows.`, updatedRows };

    } catch (error: any) {
        console.error('Failed to update sheet status:', error.message);
        const apiError = error.errors?.[0]?.message || error.message || 'An unknown error occurred during sheet update.';
        return { error: apiError };
    }
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

    try {
        const sheets = getGoogleSheetsClient();
        const sheetName = 'All Case';

        // 1. Get existing titles from the sheet to check for duplicates.
        // The title is in column M.
        const titleRange = `${sheetName}!M:M`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: titleRange,
        });

        const existingTitles = new Set(response.data.values ? response.data.values.flat() : []);

        // 2. Filter out rows that are already in the sheet.
        const newRows = [];
        const duplicateRows = [];
        for (const row of data.rows) {
            const title = row['Title'];
            if (title && !existingTitles.has(title)) {
                newRows.push(row);
            } else {
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

        // 3. Prepare values for appending, adding empty columns for A-D.
        const values = newRows.map(row => {
            const rowValues = data.headers.map(header => row[header]);
            return ['', '', '', '', ...rowValues];
        });

        // 4. Append only the new rows.
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A1`, 
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values,
            },
        });

        return {
            success: true,
            message: `Import complete.`,
            importedCount: newRows.length,
            duplicateCount: duplicateRows.length,
            duplicates: duplicateRows
        };

    } catch (error: any) {
        console.error('Failed to import to sheet:', error.message);
        const apiError = error.errors?.[0]?.message || error.message || 'An unknown error occurred during sheet import.';
        return { error: apiError };
    }
}
