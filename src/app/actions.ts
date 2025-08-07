"use server";

export async function fetchSheetData(url: string) {
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
        const response = await fetch(exportUrl, { cache: 'no-store' });
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
}
