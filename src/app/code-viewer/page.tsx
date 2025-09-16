
import { promises as fs } from 'fs';
import path from 'path';
import { CodeViewerClient } from '@/components/code-viewer-client';

// Daftar semua file yang relevan untuk deployment dan peninjauan
const projectFiles = [
  // File konfigurasi root
  "README.md",
  ".gitignore",
  "apphosting.yaml",
  "components.json",
  "firebase.json",
  "next.config.ts",
  "package.json",
  "tailwind.config.ts",
  "tsconfig.json",

  // Struktur Aplikasi & Halaman Utama
  "src/app/layout.tsx",
  "src/app/globals.css",
  "src/app/page.tsx", // Halaman root untuk Import Flow
  "src/app/report-harian/page.tsx",
  "src/app/migrasi-murid/page.tsx",
  "src/app/cek-duplikasi/page.tsx",
  "src/app/data-weaver/page.tsx",
  "src/app/data-normalisasi/page.tsx",
  "src/app/settings/page.tsx",
  "src/app/code-viewer/page.tsx",

  // Komponen Utama (logika untuk setiap halaman)
  "src/components/import-flow.tsx",
  "src/components/report-harian.tsx",
  "src/components/migrasi-murid.tsx",
  "src/components/cek-duplikasi.tsx",
  "src/components/data-weaver.tsx",
  "src/components/layout/client-layout.tsx",
  "src/components/code-viewer-client.tsx",

  // Aksi & Logika Server
  "src/app/actions.ts",
  "src/lib/utils.ts",
  "src/lib/date-utils.ts",
  "src/lib/gcp-credentials.json",

  // Manajemen State (Konteks & Provider)
  "src/store/store-provider.tsx",
  "src/store/table-data-context.tsx",
  "src/contexts/app-provider.tsx",

  // Hooks Kustom
  "src/hooks/use-toast.ts",
  "src/hooks/use-theme.ts",
  "src/hooks/theme-provider.tsx",
  "src/hooks/use-mobile.tsx",

  // File terkait AI
  "src/ai/genkit.ts",
  "src/ai/dev.ts",

  // Komponen UI (ShadCN)
  "src/components/ui/accordion.tsx",
  "src/components/ui/alert-dialog.tsx",
  "src/components/ui/alert.tsx",
  "src/components/ui/avatar.tsx",
  "src/components/ui/badge.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/calendar.tsx",
  "src/components/ui/card.tsx",
  "src/components/ui/carousel.tsx",
  "src/components/ui/chart.tsx",
  "src/components/ui/checkbox.tsx",
  "src/components/ui/collapsible.tsx",
  "src/components/ui/command.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/dropdown-menu.tsx",
  "src/components/ui/form.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/label.tsx",
  "src/components/ui/menubar.tsx",
  "src/components/ui/multi-select.tsx",
  "src/components/ui/popover.tsx",
  "src/components/ui/progress.tsx",
  "src/components/ui/radio-group.tsx",
  "src/components/ui/scroll-area.tsx",
  "src/components/ui/select.tsx",
  "src/components/ui/separator.tsx",
  "src/components/ui/sheet.tsx",
  "src/components/ui/skeleton.tsx",
  "src/components/ui/slider.tsx",
  "src/components/ui/switch.tsx",
  "src/components/ui/table.tsx",
  "src/components/ui/tabs.tsx",
  "src/components/ui/textarea.tsx",
  "src/components/ui/toast.tsx",
  "src/components/ui/toaster.tsx",
  "src/components/ui/tooltip.tsx",
];

async function getFileContent(filePath: string): Promise<string> {
    try {
        const fullPath = path.join(process.cwd(), filePath);
        // Pengecekan stat tidak diperlukan jika kita hanya ingin membaca file
        const content = await fs.readFile(fullPath, 'utf-8');
        return content;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return `// File tidak ditemukan di path: ${filePath}\n// File ini mungkin belum dibuat.`;
        }
        console.error(`Error reading file at ${filePath}:`, error);
        return `Error: Tidak dapat membaca file di ${filePath}`;
    }
}

export default async function CodeViewerPage() {
    const fileContents = await Promise.all(
        projectFiles.map(async (filePath) => {
            const content = await getFileContent(filePath);
            return { path: filePath, content, name: path.basename(filePath) };
        })
    );

    return <CodeViewerClient fileContents={fileContents} />;
}
