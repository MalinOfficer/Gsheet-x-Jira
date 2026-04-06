// app/api/dashboard/report/detail/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType,
    VerticalAlign, PageNumber, Footer,
} from 'docx';
import { format } from 'date-fns';

export const maxDuration = 60;  // detik — ganti 300 jika Vercel Pro
export const dynamic     = "force-dynamic";

// Batas maksimal cases yang bisa di-export
// Vercel Hobby: ~1500, Vercel Pro: ~5000 (sesuaikan dengan maxDuration)
const MAX_CASES = 1500;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type DetailedCase = {
    ticket_no?:     string;
    client_name:    string;
    title?:         string;
    status:         string;
    category?:      string;
    module?:        string;
    detail_module?: string;
    created_at?:    string;
    resolved_at?:   string;
    pic?:           string;
};

type DetailedFilters = {
    years?:         string[];
    dateRange?:     { from?: string; to?: string };
    categories?:    string[];
    clients?:       string[];
    modules?:       string[];
    detailModules?: string[];
    statuses?:      string[];
    search?:        string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Style constants
// ─────────────────────────────────────────────────────────────────────────────
// PERBAIKAN: Halaman Landscape width 15840 - margin (1080 * 2) = 13680
const CONTENT_WIDTH = 13680; 
const CELL_MARGINS  = { top: 80, bottom: 80, left: 120, right: 120 };

const BORDER_LIGHT = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDER_NONE  = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' };
const ALL_BORDERS  = { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT };

const HEADER_COLOR = '1E3A5F';
const ACCENT_COLOR = '2563EB';
const STRIPE_COLOR = 'F0F4FF';
const STRIPE_WARN  = 'FFF5F5';
const WHITE        = 'FFFFFF';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getStatusColor(status: string): string {
    const s = status.toLowerCase();
    if (s === 'l3')       return 'DC2626';
    if (s === 'l2')       return 'EA580C';
    if (s === 'l1')       return 'D97706';
    if (s === 'pending')  return '7C3AED';
    if (s === 'on hold')  return '6B7280';
    if (s === 'resolved' || s === 'solved') return '16A34A';
    return '374151';
}

function isUnresolved(status: string): boolean {
    const s = status.toLowerCase();
    return ['l1', 'l2', 'l3', 'pending', 'on hold'].includes(s);
}

function formatDateDisplay(raw?: string): string {
    if (!raw) return '—';
    try {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return format(d, 'd MMM yyyy HH:mm');
    } catch { /* noop */ }
    return raw;
}

function formatDuration(created?: string, resolved?: string): string {
    if (!created || !resolved) return '—';
    try {
        const start = new Date(created);
        const end   = new Date(resolved);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return '—';
        const diffMs      = end.getTime() - start.getTime();
        if (diffMs < 0)   return '—';
        const totalMins   = Math.floor(diffMs / 60000);
        const days        = Math.floor(totalMins / 1440);
        const hours       = Math.floor((totalMins % 1440) / 60);
        const mins        = totalMins % 60;
        if (days > 0)     return `${days}d ${hours}h`;
        if (hours > 0)    return `${hours}h ${mins}m`;
        return `${mins}m`;
    } catch { return '—'; }
}

function headerCell(text: string, width: number): TableCell {
    return new TableCell({
        width:         { size: width, type: WidthType.DXA },
        borders:       ALL_BORDERS,
        shading:       { fill: HEADER_COLOR, type: ShadingType.CLEAR },
        margins:       CELL_MARGINS,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children:  [new TextRun({ text, bold: true, color: WHITE, size: 18, font: 'Arial' })],
        })],
    });
}

function dataCell(text: string, width: number, opts: {
    bold?: boolean; center?: boolean; stripe?: boolean; warnStripe?: boolean;
    color?: string; size?: number; mono?: boolean;
} = {}): TableCell {
    const { bold = false, center = false, stripe = false, warnStripe = false, color, size = 18, mono = false } = opts;
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
                text,
                bold,
                size,
                font: mono ? 'Courier New' : 'Arial',
                ...(color ? { color } : {}),
            })],
        })],
    });
}

function spacer(space = 160): Paragraph {
    return new Paragraph({ spacing: { after: space }, children: [] });
}

function sectionHeading(text: string): Paragraph {
    return new Paragraph({
        spacing: { before: 320, after: 160 },
        border:  { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT_COLOR, space: 4 } },
        children: [new TextRun({ text, bold: true, size: 28, font: 'Arial', color: HEADER_COLOR })],
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Build filter summary string
// ─────────────────────────────────────────────────────────────────────────────
function buildFilterText(filters: DetailedFilters): string {
    const parts: string[] = [];

    const activeYears = (filters.years ?? []).filter(y => y !== '__all__');
    if (activeYears.length)             parts.push(`Years: ${activeYears.join(', ')}`);

    if (filters.dateRange?.from) {
        const from = formatDateDisplay(filters.dateRange.from);
        const to   = filters.dateRange.to ? formatDateDisplay(filters.dateRange.to) : from;
        parts.push(`Date: ${from} – ${to}`);
    }

    if (filters.categories?.length)    parts.push(`Categories: ${filters.categories.join(', ')}`);
    if (filters.clients?.length)       parts.push(`Clients: ${filters.clients.join(', ')}`);
    if (filters.modules?.length)       parts.push(`Modules: ${filters.modules.join(', ')}`);
    if (filters.detailModules?.length) parts.push(`Detail Modules: ${filters.detailModules.join(', ')}`);
    if (filters.statuses?.length)      parts.push(`Status: ${filters.statuses.join(', ')}`);
    if (filters.search?.trim())        parts.push(`Search: "${filters.search.trim()}"`);

    return parts.length ? parts.join('  |  ') : 'No filters applied — showing all data';
}

function buildStatusSummary(cases: DetailedCase[]): string {
    const counts: Record<string, number> = {};
    cases.forEach(c => {
        const s = c.status.toLowerCase();
        counts[s] = (counts[s] ?? 0) + 1;
    });

    const STATUS_ORDER = ['l3', 'l2', 'l1', 'pending', 'on hold', 'resolved', 'solved'];
    return Object.entries(counts)
        .sort(([a], [b]) => {
            const ai = STATUS_ORDER.indexOf(a);
            const bi = STATUS_ORDER.indexOf(b);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        })
        .map(([s, n]) => `${s.toUpperCase()}: ${n}`)
        .join('  ·  ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the main cases table
// ─────────────────────────────────────────────────────────────────────────────
function buildDetailedCasesTable(cases: DetailedCase[]): Table {
    const hasPic        = cases.some(c => c.pic?.trim());
    const hasCategory   = cases.some(c => c.category?.trim());
    const hasModule     = cases.some(c => c.module?.trim());
    const hasDetailMod  = cases.some(c => c.detail_module?.trim());

    const COL_NO       = 500;
    const COL_STATUS   = 900;
    const COL_CREATED  = 1500;
    const COL_SOLVED   = 1500; 
    const COL_DURATION = 900;  
    const COL_PIC      = hasPic        ? 1000 : 0;
    const COL_CAT      = hasCategory   ? 1100 : 0;
    const COL_MOD      = hasModule     ? 1200 : 0;
    const COL_DM       = hasDetailMod  ? 1300 : 0;

    const fixedWidth = COL_NO + COL_STATUS + COL_CREATED + COL_SOLVED + COL_DURATION +
                       COL_PIC + COL_CAT + COL_MOD + COL_DM;

    // PERBAIKAN: Safety net agar remaining tidak pernah bernilai negatif
    const remaining  = Math.max(0, CONTENT_WIDTH - fixedWidth);
    const COL_CLIENT = Math.max(800, Math.floor(remaining * 0.28));
    const COL_TITLE  = Math.max(1000, remaining - COL_CLIENT); // Pastikan tabel title tetap punya ruang

    const colWidths: number[] = [COL_NO, COL_TITLE, COL_CLIENT, COL_STATUS];
    if (hasCategory)  colWidths.push(COL_CAT);
    if (hasModule)    colWidths.push(COL_MOD);
    if (hasDetailMod) colWidths.push(COL_DM);
    colWidths.push(COL_CREATED, COL_SOLVED, COL_DURATION);
    if (hasPic)       colWidths.push(COL_PIC);

    const headerCells: TableCell[] = [
        headerCell('#',            COL_NO),
        headerCell('Title',        COL_TITLE),
        headerCell('Client',       COL_CLIENT),
        headerCell('Status',       COL_STATUS),
    ];
    if (hasCategory)  headerCells.push(headerCell('Category',     COL_CAT));
    if (hasModule)    headerCells.push(headerCell('Module',        COL_MOD));
    if (hasDetailMod) headerCells.push(headerCell('Detail Module', COL_DM));
    headerCells.push(
        headerCell('Created At', COL_CREATED),
        headerCell('Solved At',  COL_SOLVED),
        headerCell('Durasi',     COL_DURATION),
    );
    if (hasPic) headerCells.push(headerCell('PIC', COL_PIC));

    const dataRows = cases.map((c, i) => {
        const stripe      = i % 2 === 1;
        const warn        = isUnresolved(c.status);
        const warnStripe  = warn && stripe;
        const statusColor = getStatusColor(c.status);
        const duration = formatDuration(c.created_at, c.resolved_at);

        const cells: TableCell[] = [
            dataCell(String(i + 1), COL_NO, {
                center: true, stripe: !warn && stripe, warnStripe, color: '6B7280',
            }),
            new TableCell({
                width:         { size: COL_TITLE, type: WidthType.DXA },
                borders:       ALL_BORDERS,
                shading:       { fill: warnStripe ? STRIPE_WARN : stripe && !warn ? STRIPE_COLOR : WHITE, type: ShadingType.CLEAR },
                margins:       CELL_MARGINS,
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        ...(c.ticket_no ? [
                            new TextRun({ text: c.ticket_no, bold: true, size: 17, font: 'Courier New', color: '1E3A5F' }),
                            new TextRun({ text: '  ', size: 17, font: 'Arial' }),
                        ] : []),
                        new TextRun({ text: c.title ?? '—', size: 18, font: 'Arial' }),
                    ],
                })],
            }),
            dataCell(c.client_name ?? '—', COL_CLIENT, {
                bold: true, stripe: !warn && stripe, warnStripe,
            }),
            dataCell(c.status.toUpperCase(), COL_STATUS, {
                center: true, bold: true, color: statusColor,
                stripe: !warn && stripe, warnStripe,
            }),
        ];

        if (hasCategory) {
            cells.push(dataCell(c.category ?? '—', COL_CAT, {
                stripe: !warn && stripe, warnStripe, color: '6B7280',
            }));
        }
        if (hasModule) {
            cells.push(dataCell(c.module ?? '—', COL_MOD, {
                stripe: !warn && stripe, warnStripe, color: '6B7280',
            }));
        }
        if (hasDetailMod) {
            cells.push(dataCell(c.detail_module ?? '—', COL_DM, {
                stripe: !warn && stripe, warnStripe, color: '6B7280',
            }));
        }

        const solvedColor    = c.resolved_at ? '16A34A' : (warn ? 'DC2626' : '9CA3AF');
        const durationColor  = duration !== '—' ? '374151' : '9CA3AF';

        cells.push(
            dataCell(formatDateDisplay(c.created_at), COL_CREATED, {
                center: true, stripe: !warn && stripe, warnStripe, color: '374151', size: 17,
            }),
            dataCell(c.resolved_at ? formatDateDisplay(c.resolved_at) : '—', COL_SOLVED, {
                center: true, stripe: !warn && stripe, warnStripe, color: solvedColor, size: 17,
            }),
            dataCell(duration, COL_DURATION, {
                center: true, stripe: !warn && stripe, warnStripe, color: durationColor, size: 17,
            }),
        );

        if (hasPic) {
            cells.push(dataCell(c.pic ?? '—', COL_PIC, {
                stripe: !warn && stripe, warnStripe, color: '6B7280',
            }));
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
// Generate DOCX buffer
// ─────────────────────────────────────────────────────────────────────────────
async function generateDetailDocx(
    cases: DetailedCase[],
    filters: DetailedFilters,
): Promise<Buffer> {
    const now        = new Date();
    const reportDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const reportTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const filterText = buildFilterText(filters);

    const totalCases     = cases.length;
    const unresolvedCount = cases.filter(c => isUnresolved(c.status)).length;
    const resolvedCount  = totalCases - unresolvedCount;
    const solvedPct      = totalCases > 0 ? ((resolvedCount / totalCases) * 100).toFixed(1) : '0.0';
    const statusSummary  = buildStatusSummary(cases);

    const footerParagraph = new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 4 } },
        children: [
            new TextRun({ text: 'Detailed Cases Report  ·  ', size: 16, font: 'Arial', color: '9CA3AF' }),
            new TextRun({ text: `Generated ${reportDate}  ·  Page `, size: 16, font: 'Arial', color: '9CA3AF' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '9CA3AF' }),
            new TextRun({ text: ' of ', size: 16, font: 'Arial', color: '9CA3AF' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Arial', color: '9CA3AF' }),
        ],
    });

    const coverSection: Paragraph[] = [
        spacer(480),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing:   { after: 120 },
            children:  [new TextRun({ text: 'DETAILED CASES REPORT', bold: true, size: 52, font: 'Arial', color: HEADER_COLOR })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing:   { after: 80 },
            children:  [new TextRun({ text: 'Per-Ticket Case Detail', size: 28, font: 'Arial', color: '6B7280' })],
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
            children:  [new TextRun({ text: filterText, size: 18, font: 'Arial', color: '6B7280', italics: true })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing:   { after: 480 },
            children:  [new TextRun({
                text: `${totalCases.toLocaleString()} case${totalCases !== 1 ? 's' : ''}  ·  ${resolvedCount.toLocaleString()} resolved (${solvedPct}%)  ·  ${unresolvedCount.toLocaleString()} unresolved`,
                size: 20, font: 'Arial', color: '374151', bold: true,
            })],
        }),
    ];

    const summaryRows = [
        ['Total Cases',      totalCases.toLocaleString()],
        ['Resolved',         `${resolvedCount.toLocaleString()} (${solvedPct}%)`],
        ['Unresolved',       unresolvedCount.toLocaleString()],
        ['Status Breakdown', statusSummary],
    ];

    const COL1 = 3000, COL2 = CONTENT_WIDTH - COL1;
    const summaryTable = new Table({
        width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [COL1, COL2],
        rows: [
            new TableRow({ children: [headerCell('Metric', COL1), headerCell('Value', COL2)] }),
            ...summaryRows.map(([label, value], i) =>
                new TableRow({
                    children: [
                        dataCell(label, COL1, { bold: true, stripe: i % 2 === 1 }),
                        dataCell(value, COL2, {
                            stripe: i % 2 === 1,
                            color: label === 'Unresolved' && unresolvedCount > 0 ? 'DC2626' : undefined,
                            bold:  label === 'Unresolved' && unresolvedCount > 0,
                        }),
                    ],
                })
            ),
        ],
    });

    const casesTable = buildDetailedCasesTable(cases);

    const doc = new Document({
        styles: {
            default: {
                document: { run: { font: 'Arial', size: 18 } },
            },
            paragraphStyles: [
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
                        size:   { width: 15840, height: 12240 },
                        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
                    },
                },
                footers: { default: new Footer({ children: [footerParagraph] }) },
                children: [
                    ...coverSection,

                    sectionHeading('1. Summary'),
                    spacer(80),
                    summaryTable,
                    spacer(200),

                    sectionHeading(`2. Detailed Cases (${totalCases.toLocaleString()})`),
                    spacer(80),
                    new Paragraph({
                        spacing: { after: 120 },
                        children: [
                            new TextRun({
                                text: unresolvedCount > 0
                                    ? `${unresolvedCount} unresolved case${unresolvedCount !== 1 ? 's' : ''} ditandai dengan highlight merah muda.`
                                    : 'Semua case telah resolved.',
                                size: 18, font: 'Arial', color: '6B7280', italics: true,
                            }),
                        ],
                    }),
                    casesTable,
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
            cases:   DetailedCase[];
            filters: DetailedFilters;
        };

        const { cases, filters } = body;

        if (!Array.isArray(cases)) {
            return NextResponse.json({ error: 'Missing or invalid cases array' }, { status: 400 });
        }

        if (cases.length > MAX_CASES) {
            return NextResponse.json({
                error:   'EXPORT_LIMIT_EXCEEDED',
                message: `Data terlalu besar. Maksimal ${MAX_CASES.toLocaleString()} cases per download, saat ini ${cases.length.toLocaleString()} cases. Gunakan filter yang lebih spesifik (tahun, client, status, atau date range).`,
                limit:   MAX_CASES,
                current: cases.length,
            }, { status: 413 });
        }

        console.log(`[POST /api/dashboard/report/detail] ${cases.length} cases received`);

        const docxBuffer = await generateDetailDocx(cases, filters ?? {});
        const dateSlug   = new Date().toISOString().slice(0, 10);

        return new NextResponse(docxBuffer, {
            headers: {
                'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="detailed-report-${dateSlug}.docx"`,
            },
        });

    } catch (error) { // PERBAIKAN: Type check error yang lebih aman
        console.error('[Detail Report API Error]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}