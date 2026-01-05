
import { Dashboard } from "@/components/dashboard";
import { getDashboardData } from "@/app/actions";
import { TableDataContext } from "@/store/table-data-context";

// This should ideally come from a centralized config or context
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1S9oSokUh8SyWlNObCLdwpn2r2iXA8Gy73OnxsZa728E/edit?gid=0#gid=0';

export default async function DashboardPage() {
    // This is a server component, so we can fetch data directly.
    const result = await getDashboardData(DEFAULT_SHEET_URL);

    return (
        <main>
            <Dashboard 
                initialData={result.data || null} 
                source={result.source || 'N/A'}
                error={result.error} 
            />
        </main>
    );
}

    