
import { promises as fs } from 'fs';
import path from 'path';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

// This is a server component, so we can use Node.js APIs
async function getFileContent(filePath: string): Promise<string> {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading file:', error);
    return `Error: Could not read file at ${filePath}`;
  }
}

export default async function CodeViewerPage() {
  const filePath = 'src/app/data-weaver/page.tsx';
  const fileContent = await getFileContent(filePath);

  return (
    <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Code Viewer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Menampilkan kode sumber dari file yang dipilih dalam proyek.
          </p>
        </header>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Viewing File</CardTitle>
            <CardDescription>{filePath}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh] w-full rounded-md border bg-muted/20">
                <pre className="p-4 text-xs font-code">
                    <code>
                        {fileContent}
                    </code>
                </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
