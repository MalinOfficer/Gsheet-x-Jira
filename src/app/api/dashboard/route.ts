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

        // Pass filter strings directly to the RPC, as the Postgres function likely handles parsing.
        const params: { [key: string]: any } = {
            p_start_date: dateRange?.from ? new Date(dateRange.from).toISOString() : null,
            p_end_date: dateRange?.to ? new Date(dateRange.to).toISOString() : null,
            p_year: (year && year !== 'all') ? parseInt(year, 10) : null,
            p_category: categoryFilter || null,
            p_client: clientFilter || null,
            p_module: moduleFilter || null,
        };

        const { data, error } = await supabaseAdmin.rpc('fn_dashboard_filtered', params);

        if (error) {
            console.error('Supabase RPC Error:', error);
            throw error;
        }

        const noDataReturned = !data || data.length === 0 || data[0].total_cases === null;

        if (noDataReturned) {
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
        
        const mappedData = {
            summary: {
                total_cases: result.total_cases ?? 0,
                total_solved: result.total_solved ?? 0,
                total_clients: result.total_clients ?? 0,
                solved_percentage: result.solved_percentage ?? 0,
                trending_category: result.trending_category ?? 'N/A',
                top_client: result.top_client ?? 'N/A',
                top_module: result.top_module ?? 'N/A'
            },
            monthly_stats: result.monthly_stats ?? [],
            client_rankings: result.client_rankings ?? [],
            module_rankings: result.module_rankings ?? [],
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
