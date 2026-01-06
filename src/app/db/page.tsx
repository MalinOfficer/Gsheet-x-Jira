
import { DbViewer } from "@/components/db-viewer";
import { getAllCaseData } from "@/app/actions";

// This should ideally come from a centralized config or context
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1S9oSokUh8SyWlNObCLdwpn2r2iXA8Gy73OnxsZa728E/edit?gid=0#gid=0';

export default async function DbPage() {
    // This is a server component, so we can fetch data directly.
    const result = await getAllCaseData(DEFAULT_SHEET_URL);

    return (
        <main>
            <DbViewer 
                initialData={result.data || null} 
                source={result.source || 'N/A'}
                error={result.error} 
            />
        </main>
    );
}
