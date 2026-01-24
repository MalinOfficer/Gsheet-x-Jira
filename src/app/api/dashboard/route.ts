
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { type DateRange } from 'react-day-picker';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const dateRangeString = searchParams.get('dateRange');
        let dateRange: DateRange | undefined;
        if (dateRangeString) {
            try {
                dateRange = JSON.parse(dateRangeString);
            } catch (e) {
                console.error('Invalid dateRange JSON:', e);
            }
        }

        const year = searchParams.get('selectedYear');
        const categoryFilter = searchParams.get('categoryFilter');
        const clientFilter = searchParams.get('clientFilter');
        const moduleFilter = searchParams.get('moduleFilter');

        // Parse filters - ambil nilai pertama untuk single-value filters
        const categoryValue = categoryFilter ? categoryFilter.split(',')[0] : null;
        const clientValue = clientFilter ? clientFilter.split(',')[0] : null;
        const moduleValue = moduleFilter ? moduleFilter.split(',')[0] : null;

        const params = {
            p_start_date: dateRange?.from ? dateRange.from.toISOString().split('T')[0] : null,
            p_end_date: dateRange?.to ? dateRange.to.toISOString().split('T')[0] : null,
            p_year: (year && year !== 'all') ? parseInt(year, 10) : null,
            p_category: categoryValue,
            p_client: clientValue,
            p_module: moduleValue,
        };

        console.log('🔍 Calling fn_dashboard_filtered with params:', params);

        const { data, error } = await supabaseAdmin.rpc('fn_dashboard_filtered', params);

        if (error) {
            console.error('❌ Supabase RPC Error:', error);
            throw error;
        }

        console.log('✅ Raw data from function:', data);

        if (!data || data.length === 0 || data[0].out_total_cases === null) {
            return NextResponse.json({
                success: true,
                data: {
                    summary: {
                        total_cases: 0,
                        total_solved: 0,
                        total_clients: 0,
                        solved_percentage: 0,
                        trending_category: 'N/A',
                        top_client: 'N/A',
                        top_module: 'N/A'
                    },
                    monthly_stats: [],
                    client_rankings: [],
                    module_rankings: []
                }
            });
        }

        const result = data[0];

        // 🎯 Data sudah pivoted dari database, langsung pakai
        const mappedData = {
            summary: {
                total_cases: result.out_total_cases ?? 0,
                total_solved: result.out_total_solved ?? 0,
                total_clients: result.out_total_clients ?? 0,
                solved_percentage: result.out_solved_percentage ?? 0,
                trending_category: result.out_trending_category ?? 'N/A',
                top_client: result.out_top_client ?? 'N/A',
                top_module: result.out_top_module ?? 'N/A'
            },
            // ✅ Data sudah dalam format: [{month: "Jan", "2024": 24, "2025": 700}, ...]
            monthly_stats: Array.isArray(result.out_monthly_stats) 
                ? result.out_monthly_stats 
                : [],
            client_rankings: Array.isArray(result.out_client_rankings)
                ? result.out_client_rankings.map((item: any) => ({
                    name: item.client,
                    value: item.cases
                }))
                : [],
            module_rankings: Array.isArray(result.out_module_rankings)
                ? result.out_module_rankings.map((item: any) => ({
                    name: item.module,
                    value: item.cases
                }))
                : [],
        };

        console.log('📊 Final mapped data:', mappedData);
        if (mappedData.monthly_stats.length > 0) {
            console.log('📊 Monthly stats sample:', mappedData.monthly_stats[0]);
        }

        return NextResponse.json({
            success: true,
            data: mappedData
        });

    } catch (error: any) {
        console.error('❌ Dashboard API Route Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error occurred'
        }, { status: 500 });
    }
}
