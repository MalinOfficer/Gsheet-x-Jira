
import { cookies } from 'next/headers';
import { DbViewer } from '@/components/db-viewer';
import { getAllCaseData } from '@/app/actions';

const DEFAULT_DB_SHEET_URL = 'https://docs.google.com/spreadsheets/d/17IreWvSgn3gr-kUmvI4-nOhqOYm9tJtUkwzPxo2wODU/edit?usp=drive_link';

export default async function DbPage() {
    const cookieStore = cookies();
    const dbSheetUrl = cookieStore.get('gsheetDashboardDbSheetUrl')?.value || DEFAULT_DB_SHEET_URL;

    const result = await getAllCaseData(dbSheetUrl);

    return (
        <main>
            <DbViewer 
                initialData={result.data ?? null}
                initialSource={result.source ?? 'N/A'}
                initialError={result.error ?? undefined}
            />
        </main>
    );
}
