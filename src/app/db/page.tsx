import { DbViewer } from '@/components/db-viewer';
import { getAllCaseData, getDashboardFilterOptions } from '@/app/actions';

export default async function DbPage() {
    const [dataResult, filterOptionsResult] = await Promise.all([
        getAllCaseData(),
        getDashboardFilterOptions()
    ]);

    return (
        <main>
            <DbViewer 
                initialData={dataResult.data ?? null}
                initialSource={dataResult.source ?? 'N/A'}
                initialError={dataResult.error ?? undefined}
                availableYears={filterOptionsResult.data?.years ?? []}
            />
        </main>
    );
}