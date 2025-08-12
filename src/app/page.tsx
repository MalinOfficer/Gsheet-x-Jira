import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Braces, GanttChartSquare, BarChart, ArrowRight } from "lucide-react";
import Link from "next/link";

const tools = [
  {
    title: "JSON to Table Converter",
    description: "Paste raw JSON, convert it into a structured table, and copy it for Sheets/Excel.",
    icon: Braces,
    href: "/json-converter",
    cta: "Go to Converter",
  },
  {
    title: "Update Cases",
    description: "Import new cases from your converted data or update the status of existing cases.",
    icon: GanttChartSquare,
    href: "/update-case-l3",
    cta: "Go to Updater",
  },
   {
    title: "Daily Report",
    description: "View a summarized report from your data, filterable by status.",
    icon: BarChart,
    href: "/report-harian",
    cta: "View Report",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 sm:p-6 md:p-8">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-primary font-headline">GSheet Dashboard & Tools</h1>
        <p className="text-muted-foreground mt-4 text-lg">
          A suite of tools designed to streamline your workflow with Google Sheets. Convert, update, and analyze your data with ease.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto mt-12 w-full">
        {tools.map((tool) => (
          <Card key={tool.title} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex-row items-start gap-4 space-y-0">
                <div className="p-3 bg-primary/10 rounded-full border border-primary/20">
                    <tool.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <CardTitle>{tool.title}</CardTitle>
                    <CardDescription className="mt-1">{tool.description}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex-grow flex items-end">
              <Button asChild className="w-full">
                <Link href={tool.href}>
                  {tool.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
