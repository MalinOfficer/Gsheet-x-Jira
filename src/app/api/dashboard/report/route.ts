// route report
import { NextRequest, NextResponse } from 'next/server';
import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
    VerticalAlign, PageNumber, Footer, LevelFormat,
} from 'docx';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ModuleTrend = {
    name: string;
    current: number;
    previous: number;
    change: number;
    change_pct?: number | null;
    direction: 'up' | 'down' | 'stable';
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
    client_rankings: { name: string; value: number }[];
    module_rankings: { name: string; value: number }[];
    detail_module_rankings: { name: string; value: number }[];
    module_trends: ModuleTrend[];
    category_rankings: { name: string; value: number }[]; // ← NEW
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

function headerCell(text: string, width: number, span?: number): TableCell {
    return new TableCell({
        width:   { size: width, type: WidthType.DXA },
        borders: ALL_BORDERS,
        shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR },
        margins: CELL_MARGINS,
        columnSpan: span,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children:  [new TextRun({ text, bold: true, color: WHITE, size: 20, font: 'Arial' })],
        })],
    });
}

function dataCell(text: string, width: number, opts: {
    bold?: boolean; center?: boolean; stripe?: boolean; color?: string; size?: number;
} = {}): TableCell {
    const { bold = false, center = false, stripe = false, color, size = 20 } = opts;
    return new TableCell({
        width:   { size: width, type: WidthType.DXA },
        borders: ALL_BORDERS,
        shading: { fill: stripe ? STRIPE_COLOR : WHITE, type: ShadingType.CLEAR },
        margins: CELL_MARGINS,
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
// DOCX Generator
// ─────────────────────────────────────────────────────────────────────────────
async function generateDocxBuffer(stats: DashboardStats, filters: FilterSummary): Promise<Buffer> {
    const now         = new Date();
    const reportDate  = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const reportTime  = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const { summary } = stats;
    const detailModules = stats.detail_module_rankings ?? stats.module_rankings ?? [];

    // ── Filter summary string ─────────────────────────────────────────────────
    const filterParts: string[] = [];
    if (filters.years?.length)         filterParts.push(`Years: ${filters.years.join(', ')}`);
    if (filters.dateRange)             filterParts.push(`Date Range: ${filters.dateRange}`);
    if (filters.categories?.length)    filterParts.push(`Categories: ${filters.categories.join(', ')}`);
    if (filters.clients?.length)       filterParts.push(`Clients: ${filters.clients.join(', ')}`);
    if (filters.modules?.length)       filterParts.push(`Modules: ${filters.modules.join(', ')}`);
    if (filters.detailModules?.length) filterParts.push(`Detail Modules: ${filters.detailModules.join(', ')}`);
    const filterText = filterParts.length ? filterParts.join('  |  ') : 'No filters applied — showing all data';
    const trendLabel = filters.trendPeriod
        ? filters.trendPeriod.charAt(0).toUpperCase() + filters.trendPeriod.slice(1)
        : 'Monthly';

    // ── 1. Cover / Title ──────────────────────────────────────────────────────
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

    // ── 2. Executive Summary table ────────────────────────────────────────────
    const col1 = 5000, col2 = 4360;
    const summaryRows = [
        ['Total Cases',       summary.total_cases.toLocaleString()],
        ['Total Solved',      summary.total_solved.toLocaleString()],
        ['Solved Rate',       `${summary.solved_percentage?.toFixed(1) ?? '0.0'}%`],
        ['Total Clients',     (summary.total_clients ?? 0).toLocaleString()],
        ['Trending Category', summary.trending_category ?? '—'],
        ['Trending Module',   summary.trending_module ?? summary.top_module ?? '—'],
        ['Top Client',        summary.top_client ?? '—'],
    ];

    const summaryTable = new Table({
        width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [col1, col2],
        rows: [
            new TableRow({
                children: [
                    headerCell('Metric', col1),
                    headerCell('Value',  col2),
                ],
            }),
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

    // ── 3. Category Rankings table (NEW) ──────────────────────────────────────
    const catC1 = 900, catC2 = 6100, catC3 = 2360;
    const categoryRankings = stats.category_rankings ?? [];
    const categoryTable = categoryRankings.length === 0 ? null : new Table({
        width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [catC1, catC2, catC3],
        rows: [
            new TableRow({
                children: [
                    headerCell('#',        catC1),
                    headerCell('Category', catC2),
                    headerCell('Cases',    catC3),
                ],
            }),
            ...categoryRankings.map((item, i) =>
                new TableRow({
                    children: [
                        dataCell(String(i + 1),               catC1, { center: true, stripe: i % 2 === 1, color: '6B7280' }),
                        dataCell(item.name,                   catC2, { stripe: i % 2 === 1, bold: i === 0 }),
                        dataCell(item.value.toLocaleString(), catC3, { center: true, bold: true, stripe: i % 2 === 1 }),
                    ],
                })
            ),
        ],
    });

    // ── 4. Module Trends table ────────────────────────────────────────────────
    const tC1 = 3200, tC2 = 1900, tC3 = 1900, tC4 = 2360;
    const trendsTable = (stats.module_trends?.length ?? 0) === 0 ? null : new Table({
        width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [tC1, tC2, tC3, tC4],
        rows: [
            new TableRow({
                children: [
                    headerCell('Module',   tC1),
                    headerCell('Previous', tC2),
                    headerCell('Current',  tC3),
                    headerCell('Change',   tC4),
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

    // ── 5. Monthly Statistics table ───────────────────────────────────────────
    let monthlyTable: Table | null = null;
    if (stats.monthly_stats?.length > 0) {
        const yearKeys = Object.keys(stats.monthly_stats[0]).filter(k => /^\d{4}$/.test(k)).sort();
        if (yearKeys.length > 0) {
            const mC0       = 1600;
            const rest      = CONTENT_WIDTH - mC0;
            const mCN       = Math.floor(rest / yearKeys.length);
            const allWidths = [mC0, ...yearKeys.map(() => mCN)];
            monthlyTable = new Table({
                width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: allWidths,
                rows: [
                    new TableRow({
                        children: [
                            headerCell('Month', mC0),
                            ...yearKeys.map(y => headerCell(y, mCN)),
                        ],
                    }),
                    ...stats.monthly_stats.map((row, i) =>
                        new TableRow({
                            children: [
                                dataCell(row.month ?? '', mC0, { bold: true, stripe: i % 2 === 1 }),
                                ...yearKeys.map(y =>
                                    dataCell(
                                        row[y] !== undefined ? row[y].toLocaleString() : '—',
                                        mCN,
                                        { center: true, stripe: i % 2 === 1 }
                                    )
                                ),
                            ],
                        })
                    ),
                ],
            });
        }
    }

    // ── 6. Client Rankings table ──────────────────────────────────────────────
    const rC1 = 900, rC2 = 6100, rC3 = 2360;
    const clientTable = new Table({
        width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [rC1, rC2, rC3],
        rows: [
            new TableRow({
                children: [
                    headerCell('#',      rC1),
                    headerCell('Client', rC2),
                    headerCell('Cases',  rC3),
                ],
            }),
            ...stats.client_rankings.slice(0, 50).map((item, i) =>
                new TableRow({
                    children: [
                        dataCell(String(i + 1),              rC1, { center: true, stripe: i % 2 === 1, color: '6B7280' }),
                        dataCell(item.name,                  rC2, { stripe: i % 2 === 1 }),
                        dataCell(item.value.toLocaleString(), rC3, { center: true, bold: true, stripe: i % 2 === 1 }),
                    ],
                })
            ),
        ],
    });

    // ── 7. Detail Module Rankings table ──────────────────────────────────────
    const dmC1 = 900, dmC2 = 6100, dmC3 = 2360;
    const moduleTable = new Table({
        width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [dmC1, dmC2, dmC3],
        rows: [
            new TableRow({
                children: [
                    headerCell('#',             dmC1),
                    headerCell('Detail Module', dmC2),
                    headerCell('Cases',         dmC3),
                ],
            }),
            ...detailModules.slice(0, 50).map((item, i) =>
                new TableRow({
                    children: [
                        dataCell(String(i + 1),              dmC1, { center: true, stripe: i % 2 === 1, color: '6B7280' }),
                        dataCell(item.name,                  dmC2, { stripe: i % 2 === 1 }),
                        dataCell(item.value.toLocaleString(), dmC3, { center: true, bold: true, stripe: i % 2 === 1 }),
                    ],
                })
            ),
        ],
    });

    // ── Footer ────────────────────────────────────────────────────────────────
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

    // ── Dynamic section numbering ─────────────────────────────────────────────
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

                    // Section 1: Executive Summary
                    sectionHeading(`${s()}. Executive Summary`),
                    spacer(80),
                    summaryTable,
                    spacer(200),

                    // Section 2: Category Rankings (NEW — only if data exists)
                    ...(categoryTable ? [
                        sectionHeading(`${s()}. Category Rankings`),
                        spacer(80),
                        categoryTable,
                        spacer(200),
                    ] : []),

                    // Section 3: Case Trend
                    sectionHeading(`${s()}. Case Trend — ${trendLabel}`),
                    spacer(80),
                    ...(trendsTable
                        ? [trendsTable]
                        : [new Paragraph({ children: [new TextRun({ text: 'No trend data available for the selected period.', italics: true, color: '6B7280', font: 'Arial', size: 20 })] })]
                    ),
                    spacer(200),

                    // Section 4: Monthly Statistics (optional)
                    ...(monthlyTable ? [
                        sectionHeading(`${s()}. Monthly Statistics`),
                        spacer(80),
                        monthlyTable,
                        spacer(200),
                    ] : []),

                    // Section 5: Client Rankings
                    sectionHeading(`${s()}. Client Rankings`),
                    spacer(80),
                    clientTable,
                    spacer(200),

                    // Section 6: Detail Module Rankings
                    sectionHeading(`${s()}. Detail Module Rankings`),
                    spacer(80),
                    moduleTable,
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
        const { stats, filterSummary } = (await request.json()) as {
            stats: DashboardStats;
            filterSummary: FilterSummary;
        };

        if (!stats) {
            return NextResponse.json({ error: 'Missing stats' }, { status: 400 });
        }

        const docxBuffer = await generateDocxBuffer(stats, filterSummary ?? {});
        const dateSlug   = new Date().toISOString().slice(0, 10);

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