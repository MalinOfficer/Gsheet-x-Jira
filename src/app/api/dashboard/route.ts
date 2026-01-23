import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { type DateRange } from 'react-day-picker';

export const dynamic = 'force-dynamic'; // Ensure fresh data on every request

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const dateRangeString = searchParams.get('dateRange');
        let dateRange: DateRange | undefined;
        if (dateRangeString) {
            try {
                dateRange = JSON.parse(dateRangeString);
            } catch (e) {
                // Ignore invalid JSON
            }
        }

        const year = searchParams.get('selectedYear');
        const categoryFilter = searchParams.get('categoryFilter');
        const clientFilter = searchParams.get('clientFilter');
        const moduleFilter = searchParams.get('moduleFilter');

        const params: { [key: string]: any } = {
            p_start_date: dateRange?.from ? new Date(dateRange.from).toISOString() : null,
            p_end_date: dateRange?.to ? new Date(dateRange.to).toISOString() : null,
            p_year: (year && year !== 'all') ? parseInt(year, 10) : null,
            p_category: categoryFilter ? categoryFilter.split(',').filter(i => i) : null,
            p_client: clientFilter ? clientFilter.split(',').filter(i => i) : null,
            p_module: moduleFilter ? moduleFilter.split(',').filter(i => i) : null,
        };
        
        if (params.p_category && params.p_category.length === 0) params.p_category = null;
        if (params.p_client && params.p_client.length === 0) params.p_client = null;
        if (params.p_module && params.p_module.length === 0) params.p_module = null;


        const { data, error } = await supabaseAdmin.rpc('fn_dashboard_filtered', params);

        if (error) {
            console.error('Supabase RPC Error:', error);
            throw error;
        }

        if (!data || data.length === 0) {
             return NextResponse.json({
                success: true,
                data: {
                    totalCases: 0,
                    totalSolved: 0,
                    totalClients: 0,
                    categoryTrend: 'N/A',
                    monthlyData: [],
                    allClients: [],
                    allModules: [],
                    solvedVsUnsolved: [{ name: 'Solved', value: 0 }, { name: 'Unsolved', value: 0 }]
                }
            });
        }
        
        const result = data[0];
        
        const mappedData = {
            totalCases: result.total_cases ?? 0,
            totalSolved: result.total_solved ?? 0,
            totalClients: result.total_clients ?? 0,
            categoryTrend: result.trending_category ?? 'N/A',
            monthlyData: result.monthly_stats ?? [],
            allClients: (result.client_rankings ?? []).map((c: { name: string; value: number; }) => ({ name: c.name, value: c.value })),
            allModules: (result.module_rankings ?? []).map((m: { name: string; value: number; }) => ({ name: m.name, value: m.value })),
            solvedVsUnsolved: [
              { name: 'Solved', value: result.total_solved ?? 0 },
              { name: 'Unsolved', value: (result.total_cases ?? 0) - (result.total_solved ?? 0) },
            ],
        };

        return NextResponse.json({
            success: true,
            data: mappedData
        });

    } catch (error: any) {
        console.error('Dashboard API Route Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
