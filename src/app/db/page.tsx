
import { DbViewer } from '@/components/db-viewer';
import { getAllCaseData } from '@/app/actions';

export default async function DbPage() {
    // Penjelasan: Fungsi getAllCaseData saat ini mengambil data langsung dari Supabase,
    // bukan dari URL Google Sheet. Kode di bawah ini disederhanakan untuk mencerminkan hal tersebut.
    const result = await getAllCaseData();

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
