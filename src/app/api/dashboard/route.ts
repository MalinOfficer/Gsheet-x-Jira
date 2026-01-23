
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

        // Hanya tambahkan p_year jika tahun spesifik dipilih.
        // Ini mengasumsikan bahwa tidak adanya parameter p_year akan membuat fungsi DB mengembalikan semua tahun.
        if (year && year !== 'all') {
            params.p_year = parseInt(year, 10);
        } else {
            params.p_year = null;
        }

        const { data, error } = await supabaseAdmin.rpc('fn_dashboard_filtered', params);

        if (error) {
            console.error('❌ Supabase RPC Error:', error);
            throw error;
        }

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

        // --- Pivot monthly_stats data ---
        const monthlyStatsRaw = Array.isArray(result.out_monthly_stats) ? result.out_monthly_stats : [];
        
        const pivotData = monthlyStatsRaw.reduce((acc, { month, year, cases }) => {
            if (!acc[month]) {
                acc[month] = { month };
            }
            acc[month][year] = cases;
            return acc;
        }, {} as Record<string, any>);

        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        const pivotedMonthlyStats = Object.values(pivotData).sort((a: any, b: any) => 
            monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
        );
        // --- End of Pivot ---
        
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
            monthly_stats: pivotedMonthlyStats,
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
