
import { promises as fs } from 'fs';
import path from 'path';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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

// List of files to display, matching the user's request
const projectFiles = [
  // App Structure
  "src/app/layout.tsx",
  "src/app/page.tsx", // Root page for Import Flow
  "src/app/report-harian/page.tsx",
  "src/app/migrasi-murid/page.tsx",
  "src/app/cek-duplikasi/page.tsx",
  "src/app/data-weaver/page.tsx",

  // Main Components
  "src/components/import-flow.tsx",
  "src/components/report-harian.tsx",
  "src/components/migrasi-murid.tsx",
  "src/components/cek-duplikasi.tsx",

  // Config files
  "next.config.ts",
  "package.json",
  "tailwind.config.ts",
  "tsconfig.json",
  "components.json",

  // Other important files
  "src/app/actions.ts",
  "src/lib/utils.ts",
];


export default async function CodeViewerPage() {
  const fileContents = await Promise.all(
    projectFiles.map(async (filePath) => {
      const content = await getFileContent(filePath);
      return { path: filePath, content };
    })
  );

  return (
    <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Code Viewer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Menampilkan kode sumber dari file-file penting dalam proyek.
          </p>
        </header>

        <Accordion type="multiple" className="w-full space-y-4">
          {fileContents.map(({ path, content }, index) => (
            <AccordionItem value={`item-${index}`} key={path} className="border-b-0">
                 <Card className="shadow-lg">
                    <AccordionTrigger className="p-4 md:p-6 text-left hover:no-underline">
                        <div className='flex flex-col items-start'>
                           <CardTitle className="text-lg">File: {path}</CardTitle>
                           <CardDescription className="text-xs mt-1">Klik untuk melihat atau menyembunyikan kode</CardDescription>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 md:px-6 pb-4 md:pb-6">
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
