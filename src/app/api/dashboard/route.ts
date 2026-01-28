import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { type DateRange } from 'react-day-picker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const pivotAndOrderMonthlyStats = (unpivotedData: any[] | null | undefined): any[] => {
    if (!unpivotedData || !Array.isArray(unpivotedData) || unpivotedData.length === 0) {
        return [];
    }

    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const statsByMonth: { [key: string]: any } = {};

    monthOrder.forEach(month => {
        statsByMonth[month] = { month };
    });

    const allYears = new Set<string>();
    
    unpivotedData.forEach(item => {
        if (item.month && monthOrder.includes(item.month)) {
            const monthData = statsByMonth[item.month];
            
            if (item.year && typeof item.cases !== 'undefined') {
                const yearStr = String(item.year);
                monthData[yearStr] = (monthData[yearStr] || 0) + item.cases;
                allYears.add(yearStr);
            } else {
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

        console.log('🔍 [API] All search params:', Object.fromEntries(searchParams.entries()));

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

        console.log('📥 [API] Raw params from URL:', {
            year,
            categoryFilter,
            clientFilter,
            moduleFilter,
            dateRangeString
        });

        const categoryValue = (categoryFilter && categoryFilter !== '') ? categoryFilter.split(',')[0] : null;
        const clientValue = (clientFilter && clientFilter !== '') ? clientFilter.split(',')[0] : null;
        const moduleValue = (moduleFilter && moduleFilter !== '') ? moduleFilter.split(',')[0] : null;

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

        let yearValue: number | null = null;
        if (year && year !== 'all' && year !== '') {
            const parsed = parseInt(year, 10);
            if (!isNaN(parsed)) {
                yearValue = parsed;
                console.log('✅ [API] Year parsed successfully:', yearValue);
            } else {
                console.log('⚠️ [API] Failed to parse year:', year);
            }
        } else {
            console.log('ℹ️ [API] Year is null/all/empty:', year);
        }

        const params: Record<string, any> = {
            p_start_date: formatDate(dateRange?.from),
            p_end_date: formatDate(dateRange?.to),
            p_category: categoryValue,
            p_client: clientValue,
            p_module: moduleValue,
            p_year: yearValue,
        };

        console.log('🚀 [API] Calling fn_dashboard_filtered with params:', JSON.stringify(params, null, 2));

        const { data, error } = await supabaseAdmin.rpc('fn_dashboard_filtered', params);

        if (error) {
            console.error('❌ [API] Supabase RPC Error:', error);
            throw error;
        }

        console.log('📦 [API] Data received, out_total_cases:', data?.[0]?.out_total_cases);

        if (!data || data.length === 0 || data[0].out_total_cases === null) {
            console.log('⚠️ [API] No data returned from database');
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

        console.log('✅ [API] Returning data with', mappedData.summary.total_cases, 'cases');

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