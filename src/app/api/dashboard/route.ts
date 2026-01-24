
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { type DateRange } from 'react-day-picker';

export const dynamic = 'force-dynamic';

// Helper function to ensure monthly stats are ordered and complete
const ensureOrderedMonthlyStats = (pivotedDbData: any[] | null | undefined): any[] => {
    if (!pivotedDbData || !Array.isArray(pivotedDbData) || pivotedDbData.length === 0) {
        return [];
    }

    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Create a map of the data from the DB for quick lookups
    const dataByMonth = new Map(pivotedDbData.map(item => [item.month, item]));
    
    // Get all unique year keys present in the dataset
    const allYearKeys = new Set<string>();
    pivotedDbData.forEach(row => {
        Object.keys(row).forEach(key => {
            if (/^\d{4}$/.test(key)) { // It's a year
                allYearKeys.add(key);
            }
        });
    });

    // Build the final, ordered, and complete array
    const orderedStats = monthOrder.map(month => {
        const existingData = dataByMonth.get(month);
        const newMonthData: Record<string, any> = { month };

        allYearKeys.forEach(year => {
            newMonthData[year] = existingData?.[year] ?? 0;
        });

        return newMonthData;
    });

    return orderedStats;
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

        const categoryValue = categoryFilter || null;
        const clientValue = clientFilter || null;
        const moduleValue = moduleFilter || null;

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
        const finalMonthlyStats = ensureOrderedMonthlyStats(rawMonthlyStats);
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
            monthly_stats: finalMonthlyStats,
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
