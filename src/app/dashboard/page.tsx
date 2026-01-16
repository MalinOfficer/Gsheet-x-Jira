
import { cookies } from 'next/headers';
import { Dashboard } from '@/components/dashboard';
import { getDashboardStats, getDashboardFilterOptions } from '@/app/actions';

const DEFAULT_DB_SHEET_URL = 'https://docs.google.com/spreadsheets/d/17IreWvSgn3gr-kUmvI4-nOhqOYm9tJtUkwzPxo2wODU/edit?usp=drive_link';

export default async function DashboardPage() {
    const cookieStore = cookies();
    const dbSheetUrl = cookieStore.get('gsheetDashboardDbSheetUrl')?.value || DEFAULT_DB_SHEET_URL;

    // Fetch initial data in parallel on the server
    const [statsResult, optionsResult] = await Promise.all([
        getDashboardStats({ sheetUrl: dbSheetUrl, selectedYear: 'all', categoryFilter: [], clientFilter: [], moduleFilter: [] }),
        getDashboardFilterOptions(dbSheetUrl)
    ]);
    
    const error = statsResult.error || optionsResult.error;

    return (
        <main>
            <Dashboard
                initialStats={statsResult.error ? null : statsResult}
                initialOptions={optionsResult.error || !optionsResult.data ? null : optionsResult.data}
                error={error}
            />
        </main>
    );
}
