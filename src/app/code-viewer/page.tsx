
import { promises as fs } from 'fs';
import path from 'path';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

// This is a server component, so we can use Node.js APIs
async function getFileContent(filePath: string): Promise<string> {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    // Use fs.stat to check if the file exists before reading
    await fs.stat(fullPath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  } catch (error: any) {
    // If the error is that the file doesn't exist, return a specific message
    if (error.code === 'ENOENT') {
        return `// File tidak ditemukan di path: ${filePath}\n// File ini mungkin belum dibuat.`;
    }
    console.error(`Error reading file at ${filePath}:`, error);
    return `Error: Tidak dapat membaca file di ${filePath}`;
  }
}

// List of all relevant files for deployment and review
const projectFiles = [
  // Root configuration files
  "README.md",
  "apphosting.yaml",
  "components.json",
  "next.config.ts",
  "package.json",
  "tailwind.config.ts",
  "tsconfig.json",

  // App Structure & Main Pages
  "src/app/layout.tsx",
  "src/app/globals.css",
  "src/app/page.tsx", // Root page for Import Flow
  "src/app/report-harian/page.tsx",
  "src/app/migrasi-murid/page.tsx",
  "src/app/cek-duplikasi/page.tsx",
  "src/app/data-weaver/page.tsx",
  "src/app/settings/page.tsx",
  "src/app/code-viewer/page.tsx",

  // Main Components (logic for each page)
  "src/components/import-flow.tsx",
  "src/components/report-harian.tsx",
  "src/components/migrasi-murid.tsx",
  "src/components/cek-duplikasi.tsx",
  "src/components/layout/client-layout.tsx",

  // Server Actions & Logic
  "src/app/actions.ts",
  "src/lib/utils.ts",
  "src/lib/date-utils.ts",
  "src/lib/gcp-credentials.json",

  // State Management (Contexts & Providers)
  "src/store/store-provider.tsx",
  "src/store/table-data-context.tsx",
  "src/contexts/app-provider.tsx",

  // Custom Hooks
  "src/hooks/use-toast.ts",
  "src/hooks/use-theme.ts",
  "src/hooks/theme-provider.tsx",
  "src/hooks/use-mobile.tsx",

  // AI related files
  "src/ai/genkit.ts",
  "src/ai/dev.ts",

  // UI Components (ShadCN)
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


export default async function CodeViewerPage() {
  const fileContents = await Promise.all(
    projectFiles.map(async (filePath) => {
      const content = await getFileContent(filePath);
      return { path: filePath, content, name: path.basename(filePath) };
    })
  );

  return (
    <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Code Viewer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Menampilkan kode sumber dari file-file penting dalam proyek. Klik tombol unduh untuk menyimpan salinan file.
          </p>
        </header>

        <Accordion type="multiple" className="w-full space-y-4">
          {fileContents.map(({ path, content, name }, index) => (
            <AccordionItem value={`item-${index}`} key={path} className="border-b-0">
                 <Card className="shadow-lg">
                    <AccordionTrigger className="p-4 md:p-6 text-left hover:no-underline w-full">
                       <div className="flex justify-between items-center w-full pr-4">
                            <div className='flex flex-col items-start'>
                               <CardTitle className="text-lg">File: {path}</CardTitle>
                               <CardDescription className="text-xs mt-1">Klik untuk melihat atau menyembunyikan kode</CardDescription>
                            </div>
                       </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 md:px-6 pb-4 md:pb-6">
                         <div className="flex justify-end mb-2">
                             <a
                                href={`data:text/plain;charset=utf-8,${encodeURIComponent(content)}`}
                                download={name}
                             >
                                <Button variant="outline" size="sm">
                                    <Download className="mr-2 h-4 w-4" />
                                    Unduh File
                                </Button>
                             </a>
                         </div>
                         <ScrollArea className="h-[40vh] w-full rounded-md border bg-muted/20">
                            <pre className="p-4 text-xs font-code">
                                <code>
                                    {content}
                                </code>
                            </pre>
                        </ScrollArea>
                    </AccordionContent>
                 </Card>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
