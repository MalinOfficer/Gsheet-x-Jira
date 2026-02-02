import { DbViewer } from '@/components/db-viewer';
import { getAllCaseData, getDashboardFilterOptions, getDistinctClientsFromDB } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function DbPage() {
    const [dataResult, filterOptionsResult, clientsResult] = await Promise.all([
        getAllCaseData(),
        getDashboardFilterOptions(),
        getDistinctClientsFromDB()
    ]);

    return (
        <main>
            <DbViewer 
                initialData={dataResult.data ?? null}
                initialSource={dataResult.source ?? 'N/A'}
                initialError={dataResult.error ?? undefined}
                availableYears={filterOptionsResult.data?.years ?? []}
                availableClients={clientsResult.success ? clientsResult.clients : []}
            />
        </main>
    );
}
