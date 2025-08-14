
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

async function getSheetRowMap(sheets: any, spreadsheetId: string, sheetName: string) {
    const rangeToRead = `${sheetName}!G:M`;
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: rangeToRead,
    });

    const sheetRows = response.data.values;
    if (!sheetRows || sheetRows.length === 0) {
        return {};
    }

    const ticketNumberRegex = /#(\d+)/;
    const rowMap: Record<string, { rowIndex: number, currentStatus: string, title: string }> = {};
    sheetRows.forEach((row, index) => {
        const currentStatus = row[0] || ''; // Column G
        const detailCase = row[6]; // Column M
        if (typeof detailCase === 'string') {
            const match = detailCase.match(ticketNumberRegex);
            if (match && match[1]) {
                const ticketNumber = match[1];
                rowMap[ticketNumber] = {
                    rowIndex: index + 1, // 1-based index
                    currentStatus: currentStatus,
                    title: detailCase,
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

    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        return { error: 'Invalid Google Sheets URL format.' };
    }
    const spreadsheetId = match[1];
    const sheetName = 'All Case';

    try {
        const sheets = getGoogleSheetsClient();
        const rowMap = await getSheetRowMap(sheets, spreadsheetId, sheetName);
        
        const changesToPreview: { title: string, oldStatus: string, newStatus: string }[] = [];
        const ticketNumberRegex = /#(\d+)/;

        for (const appRow of data.rows) {
            const detailCase = appRow['Title'];
            const newStatus = appRow['Status'];

            if (typeof detailCase === 'string' && newStatus) {
                const match = detailCase.match(ticketNumberRegex);
                if (match && match[1]) {
                    const ticketNumber = match[1];
                    const sheetRowInfo = rowMap[ticketNumber];
                    
                    if (sheetRowInfo && sheetRowInfo.currentStatus !== newStatus) {
                        changesToPreview.push({
                            title: sheetRowInfo.title,
                            oldStatus: sheetRowInfo.currentStatus,
                            newStatus: newStatus
                        });
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
    
    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
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
        const updatedRows: { title: string, oldStatus: string, newStatus: string, rowIndex: number }[] = [];
        const ticketNumberRegex = /#(\d+)/;
        
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
                        updatedRows.push({ title: detailCase, oldStatus: sheetRowInfo.currentStatus, newStatus, rowIndex: sheetRowInfo.rowIndex });
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
        
        return { success: true, message: `Successfully updated ${updatedRows.length} rows.`, updatedRows, operationType: 'UPDATE' };

    } catch (error: any) {
        console.error('Failed to update sheet status:', error.message);
        const apiError = error.errors?.[0]?.message || error.message || 'An unknown error occurred during sheet update.';
        return { error: apiError };
    }
}

async function getSheetIdByName(sheets: any, spreadsheetId: string, sheetName: string) {
    const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.sheetId,sheets.properties.title',
    });
    const sheet = response.data.sheets?.find(
        (s: any) => s.properties?.title?.trim().toLowerCase() === sheetName.trim().toLowerCase()
    );
    return sheet?.properties?.sheetId ?? null;
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

        const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);
        if (sheetId === null) {
            return { error: `The target sheet named "${sheetName}" was not found in the spreadsheet.` };
        }

        const titleRange = `${sheetName}!M:M`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: titleRange,
        });

        const existingTitles = new Set(response.data.values ? response.data.values.flat() : []);
        
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
        
        const valuesToAppend = newRows.map(row => 
            data.headers.map(header => row[header] || '')
        );

        const appendResult = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!E1`, // Start from column E
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: valuesToAppend },
        });

        const updatedRange = appendResult.data.updates?.updatedRange;
        if (!updatedRange) throw new Error("Could not determine the range of appended data for undo.");
        
        const rangeRegex = /'?(.*?)'?!?[A-Z]+\d+:?[A-Z]*(\d+)/;
        const rangeMatch = updatedRange.match(rangeRegex);
        if (!rangeMatch || !rangeMatch[2]) throw new Error("Could not parse the updated range.");
        
        const endRowIndex = parseInt(rangeMatch[2], 10);
        const startRowIndex = endRowIndex - newRows.length + 1;

        const undoData = {
            operationType: 'IMPORT',
            spreadsheetId,
            sheetId,
            startIndex: startRowIndex - 1,
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
        return { error: apiError };
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
             const updateRequests = undoData.updatedRows.map((row: { rowIndex: number, oldStatus: string }) => ({
                range: `${sheetName}!G${row.rowIndex}`,
                values: [[row.oldStatus]],
            }));

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

    