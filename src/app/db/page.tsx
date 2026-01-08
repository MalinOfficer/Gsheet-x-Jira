
import { DbViewer } from "@/components/db-viewer";

export default function DbPage() {
    // Data is now fetched on the client side within the DbViewer component
    // using the URL from the global context.
    return (
        <main>
            <DbViewer />
        </main>
    );
}
