
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { type DateRange } from 'react-day-picker';

export const dynamic = 'force-dynamic';

// Helper function to pivot the monthly stats data
const pivotMonthlyStats = (dbData: any[] | null | undefined): any[] => {
    if (!dbData || !Array.isArray(dbData) || dbData.length === 0) {
        return [];
    }

    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const pivoted = dbData.reduce((acc, { month, year, cases }) => {
        // Ensure year is a string, as it will become an object key
        const yearStr = String(year);

        if (!acc[month]) {
            acc[month] = { month };
        }
        acc[month][yearStr] = cases;
        return acc;
    }, {} as Record<string, any>);

    // Get all unique year keys found in the data
    const allYearKeys = dbData.reduce((keys, { year }) => {
        if (year) keys.add(String(year));
        return keys;
    }, new Set<string>());

    // Ensure all months are present in the final array and have all year keys
    const result = monthOrder.map(month => {
        const monthData = pivoted[month] || { month };
        // Ensure every year key exists for this month, defaulting to 0 if not present
        allYearKeys.forEach(yearKey => {
            if (!monthData.hasOwnProperty(yearKey)) {
                monthData[yearKey] = 0;
            }
        });
        return monthData;
    });

    return result;
};


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

        const categoryValue = categoryFilter ? categoryFilter.split(',')[0] : null;
        const clientValue = clientFilter ? clientFilter.split(',')[0] : null;
        const moduleValue = moduleFilter ? moduleFilter.split(',')[0] : null;

        // 🔥 Helper to safely format dates
        const formatDate = (date: any) => {
            if (!date) return null;
            try {
                const d = date instanceof Date ? date : new Date(date);
                return d.toISOString().split('T')[0];
            } catch (e) {
                console.error('Invalid date:', date);
                return null;
            }
        };

        const params: Record<string, any> = {
            p_start_date: formatDate(dateRange?.from),
            p_end_date: formatDate(dateRange?.to),
            p_category: categoryValue,
            p_client: clientValue,
            p_module: moduleValue,
        };
        
        // Only include p_year if a specific year is selected
        if (year && year !== 'all') {
            params.p_year = parseInt(year, 10);
        }

        console.log('🔍 [API] Calling fn_dashboard_filtered with params:', params);

        const { data, error } = await supabaseAdmin.rpc('fn_dashboard_filtered', params);

        if (error) {
            console.error('❌ [API] Supabase RPC Error:', error);
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

        // 🔥 Parse JSONB fields
        const parseJSONB = (field: any) => {
            if (!field) return [];
            if (Array.isArray(field)) return field;
            if (typeof field === 'string') {
                try {
                    return JSON.parse(field);
                } catch (e) {
                    console.error('Failed to parse JSONB:', e);
                    return [];
                }
            }
            return [];
        };

        const rawMonthlyStats = parseJSONB(result.out_monthly_stats);
        const pivotedStats = pivotMonthlyStats(rawMonthlyStats);
        const clientRankings = parseJSONB(result.out_client_rankings);
        const moduleRankings = parseJSONB(result.out_module_rankings);
        
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
            monthly_stats: pivotedStats,
            client_rankings: clientRankings.map((item: any) => ({
                name: item.client,
                value: item.cases
            })),
            module_rankings: moduleRankings.map((item: any) => ({
                name: item.module,
                value: item.cases
            })),
        };

        return NextResponse.json({
            success: true,
            data: mappedData
        });

    } catch (error: any) {
        console.error('❌ [API] Dashboard API Route Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error occurred'
        }, { status: 500 });
    }
}
