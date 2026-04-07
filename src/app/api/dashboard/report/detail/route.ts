// app/api/dashboard/report/detail/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType,
    VerticalAlign, PageNumber, Footer, PageBreak,
} from 'docx';
import { format } from 'date-fns';

export const maxDuration = 60;
export const dynamic     = "force-dynamic";

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
const CONTENT_WIDTH = 13680;
const CELL_MARGINS  = { top: 80, bottom: 80, left: 120, right: 120 };

const BORDER_LIGHT = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDER_NONE  = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' };
const ALL_BORDERS  = { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT };

const HEADER_COLOR  = '1E3A5F';
const ACCENT_COLOR  = '2563EB';
const CLIENT_COLOR  = '0D6E56'; // hijau teal untuk client heading
const STRIPE_COLOR  = 'F0F4FF';
const STRIPE_WARN   = 'FFF5F5';
const WHITE         = 'FFFFFF';

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
        const diffMs    = end.getTime() - start.getTime();
        if (diffMs < 0) return '—';
        const totalMins = Math.floor(diffMs / 60000);
        const days      = Math.floor(totalMins / 1440);
        const hours     = Math.floor((totalMins % 1440) / 60);
        const mins      = totalMins % 60;
        if (days > 0)   return `${days}d ${hours}h`;
        if (hours > 0)  return `${hours}h ${mins}m`;
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

/** Heading per client — warna berbeda agar mudah dibedakan */
function clientHeading(clientName: string, caseCount: number, index: number): Paragraph {
    return new Paragraph({
        spacing: { before: index === 0 ? 80 : 360, after: 100 },
        border:  { bottom: { style: BorderStyle.SINGLE, size: 2, color: CLIENT_COLOR, space: 3 } },
        children: [
            new TextRun({ text: clientName, bold: true, size: 24, font: 'Arial', color: CLIENT_COLOR }),
            new TextRun({ text: `  (${caseCount} case${caseCount !== 1 ? 's' : ''})`, bold: false, size: 20, font: 'Arial', color: '6B7280' }),
        ],
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
// Group & sort logic
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Kelompokkan cases per client, urutkan:
 *   1. Client → by total kasus terbanyak (desc)
 *   2. Dalam tiap client → by module terbanyak (desc), lalu by created_at desc
 */
function groupByClient(cases: DetailedCase[]): { client: string; cases: DetailedCase[] }[] {
    // Group
    const map = new Map<string, DetailedCase[]>();
    for (const c of cases) {
        const key = c.client_name?.trim() || '(Unknown Client)';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
    }

    // Sort cases within each client: by module count desc → created_at desc
    const result: { client: string; cases: DetailedCase[] }[] = [];
    for (const [client, clientCases] of map.entries()) {
        // Hitung frekuensi per module
        const moduleCounts: Record<string, number> = {};
        for (const c of clientCases) {
            const m = c.module?.trim() || '(No Module)';
            moduleCounts[m] = (moduleCounts[m] ?? 0) + 1;
        }

        const sorted = [...clientCases].sort((a, b) => {
            const ma = a.module?.trim() || '(No Module)';
            const mb = b.module?.trim() || '(No Module)';
            const countDiff = (moduleCounts[mb] ?? 0) - (moduleCounts[ma] ?? 0);
            if (countDiff !== 0) return countDiff;
            // same module → sort by created_at desc
            return (b.created_at ?? '').localeCompare(a.created_at ?? '');
        });

        result.push({ client, cases: sorted });
    }

    // Sort clients by total case count desc
    result.sort((a, b) => b.cases.length - a.cases.length);
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build table untuk satu client
// ─────────────────────────────────────────────────────────────────────────────
function buildClientTable(cases: DetailedCase[], globalOffset: number): Table {
    const hasPic       = cases.some(c => c.pic?.trim());
    const hasCategory  = cases.some(c => c.category?.trim());
    const hasModule    = cases.some(c => c.module?.trim());
    const hasDetailMod = cases.some(c => c.detail_module?.trim());

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
    const remaining  = Math.max(0, CONTENT_WIDTH - fixedWidth);
    const COL_CLIENT = 0; // tidak perlu kolom client (sudah di-group)
    const COL_TITLE  = Math.max(2000, remaining);

    const colWidths: number[] = [COL_NO, COL_TITLE, COL_STATUS];
    if (hasCategory)  colWidths.push(COL_CAT);
    if (hasModule)    colWidths.push(COL_MOD);
    if (hasDetailMod) colWidths.push(COL_DM);
    colWidths.push(COL_CREATED, COL_SOLVED, COL_DURATION);
    if (hasPic)       colWidths.push(COL_PIC);

    const headerCells: TableCell[] = [
        headerCell('#',            COL_NO),
        headerCell('Title',        COL_TITLE),
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

    // Track current module for visual grouping (subtle separator)
    let lastModule = '';

    const dataRows = cases.map((c, i) => {
        const globalIdx   = globalOffset + i;
        const stripe      = globalIdx % 2 === 1;
        const warn        = isUnresolved(c.status);
        const warnStripe  = warn && stripe;
        const statusColor = getStatusColor(c.status);
        const duration    = formatDuration(c.created_at, c.resolved_at);

        const currentModule = c.module?.trim() || '';
        const isModuleChange = currentModule !== lastModule && i > 0;
        lastModule = currentModule;

        const cells: TableCell[] = [
            dataCell(String(globalOffset + i + 1), COL_NO, {
                center: true, stripe: !warn && stripe, warnStripe, color: '6B7280',
            }),
            // Title cell — highlight module change dengan top border berbeda
            new TableCell({
                width:         { size: COL_TITLE, type: WidthType.DXA },
                borders:       isModuleChange
                    ? { top: { style: BorderStyle.SINGLE, size: 3, color: '9CA3AF' }, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT }
                    : ALL_BORDERS,
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
                stripe: !warn && stripe, warnStripe, color: '374151', bold: false,
            }));
        }
        if (hasDetailMod) {
            cells.push(dataCell(c.detail_module ?? '—', COL_DM, {
                stripe: !warn && stripe, warnStripe, color: '6B7280',
            }));
        }

        const solvedColor   = c.resolved_at ? '16A34A' : (warn ? 'DC2626' : '9CA3AF');
        const durationColor = duration !== '—' ? '374151' : '9CA3AF';

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
// Build semua konten grouped (return array of Paragraph | Table)
// ─────────────────────────────────────────────────────────────────────────────
function buildGroupedContent(groups: { client: string; cases: DetailedCase[] }[]): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];
    let globalOffset = 0;

    groups.forEach(({ client, cases: clientCases }, groupIdx) => {
        // Client heading
        elements.push(clientHeading(client, clientCases.length, groupIdx));

        // Module breakdown hint (kecil, di bawah heading)
        const moduleCounts: Record<string, number> = {};
        for (const c of clientCases) {
            const m = c.module?.trim() || '(No Module)';
            moduleCounts[m] = (moduleCounts[m] ?? 0) + 1;
        }
        const topModules = Object.entries(moduleCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([m, n]) => `${m} (${n})`)
            .join('  ·  ');

        elements.push(new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({
                text: `Modules: ${topModules}`,
                size: 16, font: 'Arial', color: '9CA3AF', italics: true,
            })],
        }));

        // Table
        elements.push(buildClientTable(clientCases, globalOffset));
        globalOffset += clientCases.length;

        // Spacer setelah tiap grup (kecuali terakhir)
        elements.push(spacer(groupIdx < groups.length - 1 ? 200 : 80));
    });

    return elements;
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

    const totalCases      = cases.length;
    const unresolvedCount = cases.filter(c => isUnresolved(c.status)).length;
    const resolvedCount   = totalCases - unresolvedCount;
    const solvedPct       = totalCases > 0 ? ((resolvedCount / totalCases) * 100).toFixed(1) : '0.0';
    const statusSummary   = buildStatusSummary(cases);

    // Group cases
    const groups = groupByClient(cases);

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

    // ── Cover ──────────────────────────────────────────────────────────────
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
            children:  [new TextRun({ text: 'Grouped by Client · Sorted by Module', size: 28, font: 'Arial', color: '6B7280' })],
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
            spacing:   { after: 240 },
            children:  [new TextRun({
                text: `${totalCases.toLocaleString()} case${totalCases !== 1 ? 's' : ''}  ·  ${groups.length} client${groups.length !== 1 ? 's' : ''}  ·  ${resolvedCount.toLocaleString()} resolved (${solvedPct}%)  ·  ${unresolvedCount.toLocaleString()} unresolved`,
                size: 20, font: 'Arial', color: '374151', bold: true,
            })],
        }),
    ];

    // ── Summary table ──────────────────────────────────────────────────────
    const COL1 = 3000, COL2 = CONTENT_WIDTH - COL1;

    // Client ranking mini-table (top 10)
    const clientRankingRows = groups.slice(0, 10).map(({ client, cases: cc }, i) => {
        const stripe     = i % 2 === 1;
        const unres      = cc.filter(c => isUnresolved(c.status)).length;
        const pct        = cc.length > 0 ? `${((( cc.length - unres) / cc.length) * 100).toFixed(0)}%` : '0%';
        return new TableRow({
            children: [
                dataCell(String(i + 1),      700,  { center: true, stripe, color: '6B7280' }),
                dataCell(client,             5500, { bold: i === 0, stripe }),
                dataCell(cc.length.toString(), 1500, { center: true, bold: true, stripe }),
                dataCell(unres > 0 ? unres.toString() : '—', 1500, { center: true, stripe, color: unres > 0 ? 'DC2626' : '6B7280', bold: unres > 0 }),
                dataCell(pct,                1500, { center: true, stripe, color: '16A34A' }),
            ],
        });
    });

    const clientRankTable = new Table({
        width:        { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [700, 5500, 1500, 1500, 1500],
        rows: [
            new TableRow({
                children: [
                    headerCell('#',          700),
                    headerCell('Client',     5500),
                    headerCell('Total',      1500),
                    headerCell('Unresolved', 1500),
                    headerCell('Solved %',   1500),
                ],
            }),
            ...clientRankingRows,
        ],
    });

    const summaryRows = [
        ['Total Cases',      totalCases.toLocaleString()],
        ['Total Clients',    groups.length.toLocaleString()],
        ['Resolved',         `${resolvedCount.toLocaleString()} (${solvedPct}%)`],
        ['Unresolved',       unresolvedCount.toLocaleString()],
        ['Status Breakdown', statusSummary],
    ];

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

    // ── Grouped case content ───────────────────────────────────────────────
    const groupedContent = buildGroupedContent(groups);

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

                    sectionHeading(`2. Client Ranking (${groups.length} clients)`),
                    spacer(80),
                    clientRankTable,
                    spacer(200),

                    sectionHeading(`3. Detailed Cases by Client (${totalCases.toLocaleString()})`),
                    spacer(80),
                    new Paragraph({
                        spacing: { after: 160 },
                        children: [
                            new TextRun({
                                text: `Dikelompokkan per client, diurutkan by module terbanyak. ${unresolvedCount > 0 ? `${unresolvedCount} unresolved case ditandai highlight merah muda.` : 'Semua case telah resolved.'}`,
                                size: 18, font: 'Arial', color: '6B7280', italics: true,
                            }),
                        ],
                    }),

                    // All grouped tables
                    ...groupedContent,
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

        console.log(`[POST /api/dashboard/report/detail] ${cases.length} cases, ${[...new Set(cases.map(c => c.client_name))].length} clients`);

        const docxBuffer = await generateDetailDocx(cases, filters ?? {});
        const dateSlug   = new Date().toISOString().slice(0, 10);

        return new NextResponse(docxBuffer, {
            headers: {
                'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="detailed-report-${dateSlug}.docx"`,
            },
        });

    } catch (error) {
        console.error('[Detail Report API Error]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}