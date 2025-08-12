
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
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
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

        // 1. Fetch current data from the sheet (column M for Detail Case)
        const rangeToRead = `${sheetName}!M:M`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: rangeToRead,
        });

        const sheetRows = response.data.values;
        if (!sheetRows || sheetRows.length === 0) {
            return { error: 'Could not find any data in the target sheet.' };
        }

        // 2. Create a map of ticket numbers to their row index
        const ticketNumberRegex = /#(\d+)/;
        const rowMap: Record<string, number> = {};
        sheetRows.forEach((row, index) => {
            const detailCase = row[0]; // Column M is the first column in our range
            if (typeof detailCase === 'string') {
                const match = detailCase.match(ticketNumberRegex);
                if (match && match[1]) {
                    const ticketNumber = match[1];
                    rowMap[ticketNumber] = index + 1; // Sheets rows are 1-based
                }
            }
        });

        // 3. Prepare batch update requests
        const updateRequests = [];
        let updatedCount = 0;
        
        for (const appRow of data.rows) {
            const detailCase = appRow['Title']; // As per component logic
            const newStatus = appRow['Status'];

            if (typeof detailCase === 'string' && newStatus) {
                const match = detailCase.match(ticketNumberRegex);
                if (match && match[1]) {
                    const ticketNumber = match[1];
                    const rowToUpdate = rowMap[ticketNumber];
                    
                    if (rowToUpdate) {
                        updateRequests.push({
                            range: `${sheetName}!G${rowToUpdate}`,
                            values: [[newStatus]],
                        });
                        updatedCount++;
                    }
                }
            }
        }
        
        if (updateRequests.length === 0) {
            return { success: true, message: 'No matching tickets found to update.' };
        }
        
        // 4. Execute batch update
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updateRequests,
            },
        });
        
        return { success: true, message: `Successfully updated ${updatedCount} rows.` };

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

        // Prepare rows without headers for appending, and add 4 empty columns at the beginning of each row
        const values = data.rows.map(row => {
            const rowValues = data.headers.map(header => row[header]);
            return ['', '', '', '', ...rowValues];
        });

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A1`, // Append to the whole sheet, letting it find the first empty row
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values,
            },
        });

        return { success: true, message: `Successfully imported ${data.rows.length} rows to '${sheetName}' sheet.` };

    } catch (error: any) {
        console.error('Failed to import to sheet:', error.message);
        // Provide more detailed error messages from the API if available
        const apiError = error.errors?.[0]?.message || error.message || 'An unknown error occurred during sheet import.';
        return { error: apiError };
    }
}
