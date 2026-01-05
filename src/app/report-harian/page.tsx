import { ReportHarian } from "@/components/report-harian";
import { getDashboardData } from "@/app/actions";

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1S9oSokUh8SyWlNObCLdwpn2r2iXA8Gy73OnxsZa728E/edit?gid=0#gid=0';


export default async function ReportHarianPage() {
    // This is a server component, so we can fetch data directly.
    // The default URL should ideally come from a centralized config.
    const result = await getDashboardData(DEFAULT_SHEET_URL);

    if (result.error) {
        return (
            <main>
                <ReportHarian initialDashboardData={null} error={result.error} />
            </main>
        );
    }
    
    return (
        <main>
            <ReportHarian initialDashboardData={result.data || null} />
        </main>
    );
}
