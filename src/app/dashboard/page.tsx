
import { Dashboard } from "@/components/dashboard";

export default function DashboardPage() {
    // Data is now fetched on the client side within the Dashboard component
    // using the URL from the global context.
    return (
        <main>
            <Dashboard />
        </main>
    );
}
