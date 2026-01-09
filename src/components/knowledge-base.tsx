
"use client";

import { BookOpen } from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardHeader, 
    CardTitle 
} from "@/components/ui/card";

// Placeholder component for the Knowledge Base page
export function KnowledgeBase() {

    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                    <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
                    <CardTitle>Knowledge Base</CardTitle>
                    <CardDescription className="mt-2 mb-4 max-w-sm">
                        This feature is under construction. Data from the configured Knowledge Base GSheet URL will be displayed here.
                    </CardDescription>
                </Card>
            </div>
        </div>
    );
}
