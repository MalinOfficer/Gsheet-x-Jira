
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { type DateRange } from 'react-day-picker';

export const dynamic = 'force-dynamic';

/**
 * Pivots and orders monthly statistics from the database.
 * Assumes the input is in a "long" format like: [{ month: "Jan", year: "2024", cases: 15 }, ...]
 * And transforms it into a "wide" format like: [{ month: "Jan", "2024": 15, "2025": 0 }, ...]
 */
const pivotAndOrderMonthlyStats = (unpivotedData: any[] | null | undefined): any[] => {
    if (!unpivotedData || !Array.isArray(unpivotedData) || unpivotedData.length === 0) {
        return [];
    }

    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const statsByMonth: { [key: string]: any } = {};

    // Initialize map with all months to ensure correct order
    monthOrder.forEach(month => {
        statsByMonth[month] = { month };
    });

    const allYears = new Set<string>();
    
    // Populate the map with data from the database
    unpivotedData.forEach(item => {
        // Handle both pivoted and unpivoted formats gracefully
        if (item.month && monthOrder.includes(item.month)) {
            const monthData = statsByMonth[item.month];
            
            // Case 1: Data is unpivoted { month: "Jan", year: "2024", cases: 10 }
            if (item.year && typeof item.cases !== 'undefined') {
                const yearStr = String(item.year);
                monthData[yearStr] = (monthData[yearStr] || 0) + item.cases;
                allYears.add(yearStr);
            } 
            
            // Case 2: Data is already pivoted { month: "Jan", "2024": 10 }
            else {
                Object.keys(item).forEach(key => {
                    if (/^\d{4}$/.test(key)) {
                        monthData[key] = (monthData[key] || 0) + item[key];
                        allYears.add(key);
                    }
                });
            }
            statsByMonth[item.month] = monthData;
        }
    });

    const sortedYears = Array.from(allYears).sort();

    // Final pass to ensure all months have all year keys, filling with 0 if missing
    return monthOrder.map(month => {
        const monthData = statsByMonth[month];
        sortedYears.forEach(year => {
            if (!monthData.hasOwnProperty(year)) {
                monthData[year] = 0;
            }
        });
        return monthData;
    });
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
            p_year: (year && year !== 'all') ? parseInt(year, 10) : null,
        };

        console.log('🔍 [API] Calling fn_dashboard_filtered with params:', params);

        const { data, error } = await supabaseAdmin.rpc('fn_dashboard_filtered', params);

        if (process.env.NODE_ENV === 'development') {
            console.log('📦 [API] Data received from DB for year:', params.p_year, JSON.stringify(data, null, 2));
        }

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
                    console.error('Failed to parse JSONB:', field, e);
                    return [];
                }
            }
            return [];
        };

        const rawMonthlyStats = parseJSONB(result.out_monthly_stats);
        const finalMonthlyStats = pivotAndOrderMonthlyStats(rawMonthlyStats);
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
