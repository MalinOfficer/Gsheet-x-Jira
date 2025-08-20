"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch } from "lucide-react";

export function MigrasiMurid() {
    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Migrasi Murid</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Fitur ini sedang dalam pengembangan.
                    </p>
                </header>
                <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] bg-card">
                    <GitBranch className="w-16 h-16 text-muted-foreground mb-4" />
                    <CardTitle>Segera Hadir</CardTitle>
                    <CardDescription className="mt-2 mb-4">
                        Fitur untuk migrasi data murid sedang kami persiapkan.
                    </CardDescription>
                </Card>
            </div>
        </div>
    );
}
