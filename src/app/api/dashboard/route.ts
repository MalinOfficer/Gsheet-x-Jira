
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

        const params: { [key: string]: any } = {
            p_start_date: dateRange?.from ? dateRange.from.toISOString().split('T')[0] : null,
            p_end_date: dateRange?.to ? dateRange.to.toISOString().split('T')[0] : null,
            p_category: categoryFilter || null,
            p_client: clientFilter || null,
            p_module: moduleFilter || null,
        };
        
        if (year && year !== 'all') {
            params.p_year = parseInt(year, 10);
        }

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

        // --- NORMALIZATION LOGIC ---
        // Ensures that the pivoted data from the DB is correctly ordered by month
        // and that all 12 months are present.
        const normalizeMonthlyStats = (stats: { month: string; [year: string]: any }[]) => {
            if (!stats || !Array.isArray(stats)) {
                return [];
            }
        
            const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const statsMap = new Map<string, any>();
            
            stats.forEach(item => {
                if (item && item.month) {
                    statsMap.set(item.month, item);
                }
            });
        
            // Ensure data is sorted by month and all 12 months are present
            return monthOrder.map(month => statsMap.get(month) || { month });
        };

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
            monthly_stats: normalizeMonthlyStats(result.out_monthly_stats),
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
