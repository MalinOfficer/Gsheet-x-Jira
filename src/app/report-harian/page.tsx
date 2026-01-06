
import { ReportHarian } from "@/components/report-harian";

export default function ReportHarianPage() {
    // Data now comes from client-side context or is fetched on client-side within the component
    return (
        <main>
            <ReportHarian initialDashboardData={null} />
        </main>
    );
}
