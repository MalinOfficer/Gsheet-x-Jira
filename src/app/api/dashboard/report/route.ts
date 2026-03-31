// route report
import { NextRequest, NextResponse } from 'next/server';
import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
    VerticalAlign, PageNumber, Footer, LevelFormat,
} from 'docx';
import {
    format, subDays, subWeeks, subMonths, subQuarters,
    startOfISOWeek, endOfISOWeek, startOfMonth, endOfMonth,
    startOfQuarter, endOfQuarter, getISOWeek, getQuarter,
} from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type TrendPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

type ModuleTrend = {
    name: string;
    current: number;
    previous: number;
    change: number;
    change_pct?: number | null;
    direction: 'up' | 'down' | 'stable';
};

type RankingItem = {
    name: string;
    value?: number;
    [year: string]: any;
};

export type UnresolvedCase = {
    client_name: string;
    title: string;
    status: string;
    module?: string;
    detail_module?: string;
    created_at?: string;
};

type DashboardStats = {
    summary: {
        total_cases: number;
        total_solved: number;
        total_clients: number;
        solved_percentage: number;
        trending_category: string;
        trending_module: string;
        top_client: string;
        top_module: string;
    };
    monthly_stats: Record<string, any>[];
    client_rankings: RankingItem[];
    module_rankings: RankingItem[];
    detail_module_rankings: RankingItem[];
    module_trends: ModuleTrend[];
    category_rankings: RankingItem[];
    unresolved_cases?: UnresolvedCase[];
};

type FilterSummary = {
    years: string[];
    dateRange?: string;
    categories: string[];
    clients: string[];
    modules: string[];
    detailModules: string[];
    trendPeriod: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function extractYearKeys(items: RankingItem[]): string[] {
    const yearSet = new Set<string>();
    items.forEach(item => {
        Object.keys(item).forEach(k => {
            if (/^\d{4}$/.test(k)) yearSet.add(k);
        });
    });
    return Array.from(yearSet).sort();
}

function getRankingTotal(item: RankingItem, yearKeys: string[]): number {
    if (yearKeys.length > 0) {
        return yearKeys.reduce((sum, y) => sum + (item[y] ?? 0), 0);
    }
    return item.value ?? 0;
}

function getChangeInfo(
    item: RankingItem,
    yearKeys: string[]
): { change: number; fromYear: string; toYear: string } | null {
    if (yearKeys.length < 2) return null;
    const fromYear = yearKeys[yearKeys.length - 2];
    const toYear   = yearKeys[yearKeys.length - 1];
    const prev     = item[fromYear] ?? 0;
    const curr     = item[toYear]   ?? 0;
    return { change: curr - prev, fromYear, toYear };
}

function formatChangeStr(change: number, prev: number): string {
    if (change === 0) return '—';
    const sign = change > 0 ? '+' : '';
    const pct  = prev !== 0
        ? ` (${sign}${Math.round((change / prev) * 100)}%)`
        : '';
    return `${sign}${change.toLocaleString()}${pct}`;
}

function getChangeColor(change: number): string {
    if (change > 0) return 'DC2626';
    if (change < 0) return '16A34A';
    return '6B7280';
}

function getStatusColor(status: string): string {
    const s = status.toLowerCase();
    if (s === 'l3')       return 'DC2626';
    if (s === 'l2')       return 'EA580C';
    if (s === 'l1')       return 'D97706';
    if (s === 'pending')  return '7C3AED';
    if (s === 'on hold')  return '6B7280';
    return '374151';
}

function isSubstantiallyComplete(period: TrendPeriod): boolean {
    const now   = new Date();
    const day   = now.getDate();
    const month = now.getMonth();
    switch (period) {
        case 'daily':     return now.getHours() >= 18;
        case 'weekly':    return now.getDay() >= 4;
        case 'monthly':   return day >= 20;
        case 'quarterly': {
            const isLastMonthOfQ = [2, 5, 8, 11].includes(month);
            return isLastMonthOfQ && day >= 15;
        }
    }
}

function getPeriodLabels(period: TrendPeriod): { previous: string; current: string } {
    const now             = new Date();
    const includesCurrent = isSubstantiallyComplete(period);
    const prevOffset      = includesCurrent ? 1 : 2;
    const currentOffset   = includesCurrent ? 0 : 1;

    switch (period) {
        case 'daily': {
            const d1 = subDays(now, prevOffset);
            const d2 = subDays(now, currentOffset);
            return {
                previous: format(d1, 'EEE, d MMM yyyy'),
                current:  format(d2, 'EEE, d MMM yyyy'),
            };
        }
        case 'weekly': {
            const w1Start = startOfISOWeek(subWeeks(now, prevOffset));
            const w1End   = endOfISOWeek(subWeeks(now, prevOffset));
            const w2Start = startOfISOWeek(subWeeks(now, currentOffset));
            const w2End   = endOfISOWeek(subWeeks(now, currentOffset));
            return {
                previous: `W${getISOWeek(w1Start)} (${format(w1Start, 'd MMM')}–${format(w1End, 'd MMM')})`,
                current:  `W${getISOWeek(w2Start)} (${format(w2Start, 'd MMM')}–${format(w2End, 'd MMM')})`,
            };
        }
        case 'monthly': {
            const m1 = subMonths(now, prevOffset);
            const m2 = subMonths(now, currentOffset);
            return {
                previous: format(startOfMonth(m1), 'MMMM yyyy'),
                current:  format(startOfMonth(m2), 'MMMM yyyy'),
            };
        }
        case 'quarterly': {
            const q1 = subQuarters(now, prevOffset);
            const q2 = subQuarters(now, currentOffset);
            return {
                previous: `Q${getQuarter(q1)} ${q1.getFullYear()}`,
                current:  `Q${getQuarter(q2)} ${q2.getFullYear()}`,
            };
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────────────────────────
const CONTENT_WIDTH = 9360;
const CELL_MARGINS  = { top: 80, bottom: 80, left: 120, right: 120 };

const BORDER_LIGHT = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDER_NONE  = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' };
const ALL_BORDERS  = { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT };
const NO_BORDERS   = { top: BORDER_NONE,  bottom: BORDER_NONE,  left: BORDER_NONE,  right: BORDER_NONE  };

const HEADER_COLOR = '1E3A5F';
const ACCENT_COLOR = '2563EB';
const STRIPE_COLOR = 'F0F4FF';
const WHITE        = 'FFFFFF';
const STRIPE_WARN  = 'FFF5F5';

function headerCell(text: string, width: number, span?: number): TableCell {
    return new TableCell({
        width:         { size: width, type: WidthType.DXA },
        borders:       ALL_BORDERS,
        shading:       { fill: HEADER_COLOR, type: ShadingType.CLEAR },
        margins:       CELL_MARGINS,
        columnSpan:    span,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children:  [new TextRun({ text, bold: true, color: WHITE, size: 20, font: 'Arial' })],
        })],
    });
}

function headerCellTwoLine(line1: string, line2: string, width: number): TableCell {
    return new TableCell({
        width:         { size: width, type: WidthType.DXA },
        borders:       ALL_BORDERS,
        shading:       { fill: HEADER_COLOR, type: ShadingType.CLEAR },
        margins:       CELL_MARGINS,
        verticalAlign: VerticalAlign.CENTER,
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing:   { after: 30 },
                children:  [new TextRun({ text: line1, bold: true, color: WHITE, size: 20, font: 'Arial' })],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children:  [new TextRun({ text: line2, bold: false, color: 'BDD0F0', size: 17, font: 'Arial' })],
            }),
        ],
    });
}

function dataCell(text: string, width: number, opts: {
    bold?: boolean; center?: boolean; stripe?: boolean; color?: string; size?: number; warnStripe?: boolean;
} = {}): TableCell {
    const { bold = false, center = false, stripe = false, warnStripe = false, color, size = 20 } = opts;
    const fillColor = warnStripe ? STRIPE_WARN : stripe ? STRIPE_COLOR : WHITE;
    return new TableCell({
        width:         { size: width, type: WidthType.DXA },
        borders:       ALL_BORDERS,
        shading:       { fill: fillColor, type: ShadingType.CLEAR },
        margins:       CELL_MARGINS,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
            alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
            children:  [new TextRun({
                text, bold, size, font: 'Arial',
                ...(color ? { color } : {}),
            })],
        })],
    });
}

function sectionHeading(text: string): Paragraph {
    return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 160 },
        border:  { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT_COLOR, space: 4 } },
        children: [new TextRun({ text, bold: true, size: 28, font: 'Arial', color: HEADER_COLOR })],
    });
}

function spacer(space = 160): Paragraph {
    return new Paragraph({ spacing: { after: space }, children: [] });
}

// ─────────────────────────────────────────────────────────────────────────────
// buildRankingTable
// ─────────────────────────────────────────────────────────────────────────────
function buildRankingTable(items: RankingItem[], nameHeader: string, limit = 50): Table | null {
    if (!items || items.length === 0) return null;

    const sliced    = items.slice(0, limit);
    const yearKeys  = extractYearKeys(sliced);
    const isMulti   = yearKeys.length > 0;
    const hasChange = yearKeys.length >= 2;

    const COL_NO     = 700;
    const COL_TOTAL  = isMulti ? 1300 : 0;
    const COL_CHANGE = hasChange ? 1800 : 0;
    const singleValW = 2360;

    const fixedWidth = COL_NO + COL_TOTAL + COL_CHANGE;
    const yearColW   = isMulti
        ? Math.max(900, Math.floor((CONTENT_WIDTH - fixedWidth) / (yearKeys.length + 1.5)))
        : 0;
    const nameColW   = isMulti
        ? CONTENT_WIDTH - COL_NO - yearColW * yearKeys.length - COL_TOTAL - COL_CHANGE
        : CONTENT_WIDTH - COL_NO - singleValW;

    const headerCells: TableCell[] = [
        headerCell('#',        COL_NO),
        headerCell(nameHeader, nameColW),
    ];

    if (isMulti) {
        yearKeys.forEach(y => headerCells.push(headerCell(y, yearColW)));
        headerCells.push(headerCell('Total', COL_TOTAL));
        if (hasChange) {
            headerCells.push(headerCellTwoLine(
                'Change',
                `${yearKeys[yearKeys.length - 2]} → ${yearKeys[yearKeys.length - 1]}`,
                COL_CHANGE
            ));
        }
    } else {
        headerCells.push(headerCell('Cases', singleValW));
    }

    const colWidths: number[] = [COL_NO, nameColW];
    if (isMulti) {
        yearKeys.forEach(() => colWidths.push(yearColW));
        colWidths.push(COL_TOTAL);
        if (hasChange) colWidths.push(COL_CHANGE);
    } else {
        colWidths.push(singleValW);
    }

    const dataRows = sliced.map((item, i) => {
        const stripe     = i % 2 === 1;
        const total      = getRankingTotal(item, yearKeys);
        const changeInfo = hasChange ? getChangeInfo(item, yearKeys) : null;

        const cells: TableCell[] = [
            dataCell(String(i + 1), COL_NO,   { center: true, stripe, color: '6B7280' }),
            dataCell(item.name,     nameColW, { stripe, bold: i === 0 }),
        ];

        if (isMulti) {
            yearKeys.forEach(y => {
                const val = item[y] ?? 0;
                cells.push(dataCell(
                    val > 0 ? val.toLocaleString() : '—',
                    yearColW,
                    { center: true, stripe }
                ));
            });

            cells.push(dataCell(
                total.toLocaleString(),
                COL_TOTAL,
                { center: true, bold: true, stripe }
            ));

            if (hasChange && changeInfo !== null) {
                const prevVal     = item[changeInfo.fromYear] ?? 0;
                const changeStr   = formatChangeStr(changeInfo.change, prevVal);
                const changeColor = getChangeColor(changeInfo.change);
                cells.push(dataCell(changeStr, COL_CHANGE, {
                    center: true, bold: changeInfo.change !== 0, color: changeColor, stripe,
                }));
            }
        } else {
            cells.push(dataCell(
                (item.value ?? 0).toLocaleString(),
                singleValW,
                { center: true, bold: true, stripe }
            ));
        }

        return new TableRow({ children: cells });
    });

    return new Table({
        width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: colWidths,
        rows: [new TableRow({ children: headerCells }), ...dataRows],
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// buildMonthlyTable
// ─────────────────────────────────────────────────────────────────────────────
function buildMonthlyTable(monthlyStats: Record<string, any>[]): Table | null {
    if (!monthlyStats || monthlyStats.length === 0) return null;

    const yearKeys = Object.keys(monthlyStats[0])
        .filter(k => /^\d{4}$/.test(k))
        .sort();

    if (yearKeys.length === 0) return null;

    const hasChange      = yearKeys.length >= 2;
    const changeFromYear = hasChange ? yearKeys[yearKeys.length - 2] : '';
    const changeToYear   = hasChange ? yearKeys[yearKeys.length - 1]  : '';

    const COL_MONTH  = 1400;
    const COL_TOTAL  = 1300;
    const COL_CHANGE = hasChange ? 1800 : 0;
    const fixedWidth = COL_MONTH + COL_TOTAL + COL_CHANGE;
    const yearColW   = Math.max(900, Math.floor((CONTENT_WIDTH - fixedWidth) / yearKeys.length));
    const actualMonthW = CONTENT_WIDTH - yearColW * yearKeys.length - COL_TOTAL - COL_CHANGE;

    const colWidths: number[] = [actualMonthW, ...yearKeys.map(() => yearColW), COL_TOTAL];
    if (hasChange) colWidths.push(COL_CHANGE);

    const headerCells: TableCell[] = [
        headerCell('Month', actualMonthW),
        ...yearKeys.map(y => headerCell(y, yearColW)),
        headerCell('Total', COL_TOTAL),
    ];
    if (hasChange) {
        headerCells.push(headerCellTwoLine('Change', `${changeFromYear} → ${changeToYear}`, COL_CHANGE));
    }

    const dataRows = monthlyStats.map((row, i) => {
        const stripe   = i % 2 === 1;
        const yearVals = yearKeys.map(y => (row[y] ?? 0) as number);
        const total    = yearVals.reduce((s, v) => s + v, 0);
        const prevVal  = hasChange ? (row[changeFromYear] ?? 0) as number : 0;
        const currVal  = hasChange ? (row[changeToYear]   ?? 0) as number : 0;
        const change   = currVal - prevVal;

        const cells: TableCell[] = [
            dataCell(row.month ?? '', actualMonthW, { bold: true, stripe }),
            ...yearKeys.map(y =>
                dataCell(
                    row[y] !== undefined ? (row[y] as number).toLocaleString() : '—',
                    yearColW,
                    { center: true, stripe }
                )
            ),
            dataCell(total.toLocaleString(), COL_TOTAL, { center: true, bold: true, stripe }),
        ];

        if (hasChange) {
            cells.push(dataCell(
                formatChangeStr(change, prevVal),
                COL_CHANGE,
                { center: true, bold: change !== 0, color: getChangeColor(change), stripe }
            ));
        }

        return new TableRow({ children: cells });
    });

    return new Table({
        width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: colWidths,
        rows: [new TableRow({ children: headerCells }), ...dataRows],
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// buildUnresolvedCasesTable
// ─────────────────────────────────────────────────────────────────────────────
function buildUnresolvedCasesTable(cases: UnresolvedCase[]): Table | null {
    if (!cases || cases.length === 0) return null;

    const hasModule       = cases.some(c => c.module       && c.module.trim()        !== '');
    const hasDetailModule = cases.some(c => c.detail_module && c.detail_module.trim() !== '');
    const hasCreatedAt    = cases.some(c => c.created_at   && c.created_at.trim()    !== '');

    const COL_NO         = 600;
    const COL_STATUS     = 1100;
    const COL_CREATED    = hasCreatedAt    ? 1600 : 0;
    const COL_MODULE     = hasModule       ? 1600 : 0;
    const COL_DETAIL_MOD = hasDetailModule ? 1800 : 0;

    const fixedWidth = COL_NO + COL_STATUS + COL_CREATED + COL_MODULE + COL_DETAIL_MOD;
    const remaining  = CONTENT_WIDTH - fixedWidth;

    const COL_CLIENT = Math.floor(remaining * 0.38);
    const COL_TITLE  = remaining - COL_CLIENT;

    const colWidths: number[] = [COL_NO, COL_CLIENT, COL_TITLE, COL_STATUS];
    if (hasModule)       colWidths.push(COL_MODULE);
    if (hasDetailModule) colWidths.push(COL_DETAIL_MOD);
    if (hasCreatedAt)    colWidths.push(COL_CREATED);

    const UNRESOLVED_HDR = '7F1D1D';

    const mkUnresolvedHeader = (text: string, width: number): TableCell =>
        new TableCell({
            width:         { size: width, type: WidthType.DXA },
            borders:       ALL_BORDERS,
            shading:       { fill: UNRESOLVED_HDR, type: ShadingType.CLEAR },
            margins:       CELL_MARGINS,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children:  [new TextRun({ text, bold: true, color: WHITE, size: 20, font: 'Arial' })],
            })],
        });

    const headerCells: TableCell[] = [
        mkUnresolvedHeader('#',            COL_NO),
        mkUnresolvedHeader('Client',       COL_CLIENT),
        mkUnresolvedHeader('Case / Title', COL_TITLE),
        mkUnresolvedHeader('Status',       COL_STATUS),
    ];
    if (hasModule)       headerCells.push(mkUnresolvedHeader('Module',        COL_MODULE));
    if (hasDetailModule) headerCells.push(mkUnresolvedHeader('Detail Module', COL_DETAIL_MOD));
    if (hasCreatedAt)    headerCells.push(mkUnresolvedHeader('Created At',    COL_CREATED));

    const STATUS_ORDER: Record<string, number> = {
        l3: 0, l2: 1, l1: 2, pending: 3, 'on hold': 4,
    };
    const sorted = [...cases].sort((a, b) => {
        const ao = STATUS_ORDER[a.status.toLowerCase()] ?? 99;
        const bo = STATUS_ORDER[b.status.toLowerCase()] ?? 99;
        return ao - bo;
    });

    const dataRows = sorted.map((c, i) => {
        const warnStripe  = i % 2 === 1;
        const statusColor = getStatusColor(c.status);

        const cells: TableCell[] = [
            dataCell(String(i + 1),              COL_NO,     { center: true, warnStripe, color: '6B7280' }),
            dataCell(c.client_name ?? '—',       COL_CLIENT, { warnStripe }),
            dataCell(c.title       ?? '—',       COL_TITLE,  { warnStripe }),
            dataCell(c.status.toUpperCase(),     COL_STATUS, { center: true, bold: true, warnStripe, color: statusColor }),
        ];

        if (hasModule) {
            cells.push(dataCell(c.module ?? '—', COL_MODULE, { warnStripe }));
        }
        if (hasDetailModule) {
            cells.push(dataCell(c.detail_module ?? '—', COL_DETAIL_MOD, { warnStripe }));
        }
        if (hasCreatedAt) {
            let displayDate = c.created_at ?? '—';
            if (displayDate !== '—') {
                try {
                    const d = new Date(displayDate);
                    if (!isNaN(d.getTime())) {
                        displayDate = format(d, 'd MMM yyyy HH:mm');
                    }
                } catch { /* leave as-is */ }
            }
            cells.push(dataCell(displayDate, COL_CREATED, { center: true, warnStripe, size: 18 }));
        }

        return new TableRow({ children: cells });
    });

    return new Table({
        width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: colWidths,
        rows: [new TableRow({ children: headerCells }), ...dataRows],
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCX Generator
// ─────────────────────────────────────────────────────────────────────────────
async function generateDocxBuffer(stats: DashboardStats, filters: FilterSummary): Promise<Buffer> {
    const now        = new Date();
    const reportDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const reportTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const { summary } = stats;
    const detailModules = stats.detail_module_rankings ?? stats.module_rankings ?? [];

    // ── FIX: Re-validate unresolved_cases setelah diterima dari JSON parse ──
    // JSON.parse mempertahankan array, tapi pastikan tidak ada item corrupt
    const rawUnresolved = stats.unresolved_cases;
    const unresolvedCases: UnresolvedCase[] = Array.isArray(rawUnresolved)
        ? rawUnresolved.filter(c =>
            c != null &&
            typeof c.client_name === 'string' && c.client_name.trim() !== '' &&
            typeof c.title       === 'string' && c.title.trim()       !== '' &&
            typeof c.status      === 'string' && c.status.trim()      !== ''
          )
        : [];

    console.log(`[generateDocxBuffer] unresolved_cases received: ${unresolvedCases.length}`);
    if (unresolvedCases.length > 0) {
        console.log(`[generateDocxBuffer] sample[0]:`, JSON.stringify(unresolvedCases[0]));
    }

    const trendPeriod = (
        ['daily', 'weekly', 'monthly', 'quarterly'].includes(filters.trendPeriod ?? '')
            ? filters.trendPeriod
            : 'monthly'
    ) as TrendPeriod;

    const periodLabels = getPeriodLabels(trendPeriod);

    // ── Filter summary string ────────────────────────────────────────────────
    const filterParts: string[] = [];
    if (filters.years?.length)         filterParts.push(`Years: ${filters.years.join(', ')}`);
    if (filters.dateRange)             filterParts.push(`Date Range: ${filters.dateRange}`);
    if (filters.categories?.length)    filterParts.push(`Categories: ${filters.categories.join(', ')}`);
    if (filters.clients?.length)       filterParts.push(`Clients: ${filters.clients.join(', ')}`);
    if (filters.modules?.length)       filterParts.push(`Modules: ${filters.modules.join(', ')}`);
    if (filters.detailModules?.length) filterParts.push(`Detail Modules: ${filters.detailModules.join(', ')}`);
    const filterText = filterParts.length ? filterParts.join('  |  ') : 'No filters applied — showing all data';
    const trendLabel = trendPeriod.charAt(0).toUpperCase() + trendPeriod.slice(1);

    // ── Cover section ────────────────────────────────────────────────────────
    const coverSection: Paragraph[] = [
        spacer(480),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing:   { after: 120 },
            children:  [new TextRun({ text: 'DASHBOARD REPORT', bold: true, size: 52, font: 'Arial', color: HEADER_COLOR })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing:   { after: 80 },
            children:  [new TextRun({ text: 'Case Management Summary', size: 28, font: 'Arial', color: '6B7280' })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            border:    { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_COLOR, space: 4 } },
            spacing:   { after: 200 },
            children:  [],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing:   { after: 60 },
            children:  [new TextRun({ text: `Generated: ${reportDate} at ${reportTime}`, size: 20, font: 'Arial', color: '374151' })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing:   { after: 40 },
            children:  [new TextRun({ text: `Trend Period: ${trendLabel}`, size: 20, font: 'Arial', color: '374151' })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing:   { after: 480 },
            children:  [new TextRun({ text: filterText, size: 18, font: 'Arial', color: '6B7280', italics: true })],
        }),
    ];

    // ── Executive Summary table ──────────────────────────────────────────────
    const col1 = 5000, col2 = 4360;
    const summaryRows = [
        ['Total Cases',      summary.total_cases.toLocaleString()],
        ['Total Solved',     summary.total_solved.toLocaleString()],
        ['Solved Rate',      `${summary.solved_percentage?.toFixed(1) ?? '0.0'}%`],
        ['Unresolved Cases', unresolvedCases.length.toLocaleString()],
        ['Total Clients',    (summary.total_clients ?? 0).toLocaleString()],
        ['Trending Category',summary.trending_category ?? '—'],
        ['Trending Module',  summary.trending_module ?? summary.top_module ?? '—'],
        ['Top Client',       summary.top_client ?? '—'],
    ];

    const summaryTable = new Table({
        width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [col1, col2],
        rows: [
            new TableRow({ children: [headerCell('Metric', col1), headerCell('Value', col2)] }),
            ...summaryRows.map(([label, value], i) =>
                new TableRow({
                    children: [
                        dataCell(label, col1, { bold: true, stripe: i % 2 === 1 }),
                        dataCell(value, col2, { center: true, stripe: i % 2 === 1 }),
                    ],
                })
            ),
        ],
    });

    // ── Category Rankings table ──────────────────────────────────────────────
    const categoryTable = buildRankingTable(stats.category_rankings ?? [], 'Category');

    // ── Module Trends table ──────────────────────────────────────────────────
    const tC1 = 3200, tC2 = 1900, tC3 = 1900, tC4 = 2360;
    const trendsTable = (stats.module_trends?.length ?? 0) === 0 ? null : new Table({
        width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [tC1, tC2, tC3, tC4],
        rows: [
            new TableRow({
                children: [
                    headerCell('Module',                                    tC1),
                    headerCellTwoLine('Previous', periodLabels.previous,    tC2),
                    headerCellTwoLine('Current',  periodLabels.current,     tC3),
                    headerCell('Change',                                    tC4),
                ],
            }),
            ...stats.module_trends.map((t, i) => {
                const pct = t.change_pct !== undefined && t.change_pct !== null
                    ? t.change_pct
                    : t.previous !== 0 ? Math.round((t.change / t.previous) * 100) : null;
                const changeStr   = `${t.direction === 'up' ? '+' : ''}${t.change}${pct !== null ? ` (${t.direction === 'up' ? '+' : ''}${pct}%)` : ''}`;
                const changeColor = t.direction === 'up' ? 'DC2626' : t.direction === 'down' ? '16A34A' : '6B7280';
                const stripe      = i % 2 === 1;
                return new TableRow({
                    children: [
                        dataCell(t.name,                      tC1, { stripe }),
                        dataCell(t.previous.toLocaleString(), tC2, { center: true, stripe }),
                        dataCell(t.current.toLocaleString(),  tC3, { center: true, stripe }),
                        dataCell(changeStr,                   tC4, { center: true, bold: true, color: changeColor, stripe }),
                    ],
                });
            }),
        ],
    });

    // ── Monthly Statistics table ─────────────────────────────────────────────
    const monthlyTable = buildMonthlyTable(stats.monthly_stats ?? []);

    // ── Client Rankings table ────────────────────────────────────────────────
    const clientTable = buildRankingTable(stats.client_rankings ?? [], 'Client');

    // ── Detail Module Rankings table ─────────────────────────────────────────
    const moduleTable = buildRankingTable(detailModules, 'Detail Module');

    // ── Unresolved Cases table ───────────────────────────────────────────────
    const unresolvedTable = buildUnresolvedCasesTable(unresolvedCases);

    // ── Footer ───────────────────────────────────────────────────────────────
    const footerParagraph = new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 4 } },
        children: [
            new TextRun({ text: 'Dashboard Report  ·  ', size: 16, font: 'Arial', color: '9CA3AF' }),
            new TextRun({ text: `Generated ${reportDate}  ·  Page `, size: 16, font: 'Arial', color: '9CA3AF' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '9CA3AF' }),
            new TextRun({ text: ' of ', size: 16, font: 'Arial', color: '9CA3AF' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Arial', color: '9CA3AF' }),
        ],
    });

    // ── Section numbering ────────────────────────────────────────────────────
    let sectionNum = 1;
    const s = () => sectionNum++;

    // ── Assemble document ─────────────────────────────────────────────────────
    const doc = new Document({
        styles: {
            default: {
                document: { run: { font: 'Arial', size: 20 } },
            },
            paragraphStyles: [
                {
                    id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run:       { size: 36, bold: true, font: 'Arial', color: HEADER_COLOR },
                    paragraph: { spacing: { before: 480, after: 240 }, outlineLevel: 0 },
                },
                {
                    id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run:       { size: 28, bold: true, font: 'Arial', color: HEADER_COLOR },
                    paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 1 },
                },
            ],
        },
        sections: [
            {
                properties: {
                    page: {
                        size:   { width: 12240, height: 15840 },
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                    },
                },
                footers: { default: new Footer({ children: [footerParagraph] }) },
                children: [
                    ...coverSection,

                    sectionHeading(`${s()}. Executive Summary`),
                    spacer(80),
                    summaryTable,
                    spacer(200),

                    ...(categoryTable ? [
                        sectionHeading(`${s()}. Category Rankings`),
                        spacer(80),
                        categoryTable,
                        spacer(200),
                    ] : []),

                    sectionHeading(`${s()}. Case Trend — ${trendLabel}`),
                    spacer(80),
                    ...(trendsTable
                        ? [trendsTable]
                        : [new Paragraph({ children: [new TextRun({ text: 'No trend data available for the selected period.', italics: true, color: '6B7280', font: 'Arial', size: 20 })] })]
                    ),
                    spacer(200),

                    ...(monthlyTable ? [
                        sectionHeading(`${s()}. Monthly Statistics`),
                        spacer(80),
                        monthlyTable,
                        spacer(200),
                    ] : []),

                    ...(clientTable ? [
                        sectionHeading(`${s()}. Client Rankings`),
                        spacer(80),
                        clientTable,
                        spacer(200),
                    ] : []),

                    ...(moduleTable ? [
                        sectionHeading(`${s()}. Detail Module Rankings`),
                        spacer(80),
                        moduleTable,
                        spacer(200),
                    ] : []),

                    sectionHeading(`${s()}. Outstanding Unresolved Cases`),
                    spacer(80),
                    new Paragraph({
                        spacing: { after: 120 },
                        children: [
                            new TextRun({
                                text: `${unresolvedCases.length} case${unresolvedCases.length !== 1 ? 's' : ''} outstanding`,
                                bold: true, size: 22, font: 'Arial',
                                color: unresolvedCases.length > 0 ? 'DC2626' : '16A34A',
                            }),
                            new TextRun({
                                text: unresolvedCases.length > 0
                                    ? '  —  sorted by severity (L3 → L2 → L1 → Pending → On Hold)'
                                    : '  —  all cases have been resolved ✓',
                                size: 19, font: 'Arial', color: '6B7280', italics: true,
                            }),
                        ],
                    }),
                    ...(unresolvedTable
                        ? [unresolvedTable]
                        : [new Paragraph({
                            children: [new TextRun({
                                text: 'No outstanding cases at the time of this report.',
                                italics: true, color: '16A34A', font: 'Arial', size: 20,
                            })],
                          })]
                    ),
                    spacer(80),
                ],
            },
        ],
    });

    return await Packer.toBuffer(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handler
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as {
            stats: DashboardStats;
            filterSummary: FilterSummary;
        };

        const { stats, filterSummary } = body;

        if (!stats) {
            return NextResponse.json({ error: 'Missing stats' }, { status: 400 });
        }

        // ── FIX: Log payload yang diterima untuk debug ───────────────────────
        const rawCount = Array.isArray(stats.unresolved_cases)
            ? stats.unresolved_cases.length
            : 'undefined/null';
        console.log(`[POST /api/report] unresolved_cases received: ${rawCount}`);
        if (Array.isArray(stats.unresolved_cases) && stats.unresolved_cases.length > 0) {
            console.log(`[POST /api/report] sample[0]:`, JSON.stringify(stats.unresolved_cases[0]));
        }

        const docxBuffer = await generateDocxBuffer(stats, filterSummary ?? {
            years: [], categories: [], clients: [], modules: [], detailModules: [], trendPeriod: 'monthly',
        });

        const dateSlug = new Date().toISOString().slice(0, 10);

        return new NextResponse(docxBuffer, {
            headers: {
                'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="dashboard-report-${dateSlug}.docx"`,
            },
        });

    } catch (error: any) {
        console.error('[Report API Error]', error);
        return NextResponse.json({ error: error.message ?? 'Unknown error' }, { status: 500 });
    }
}