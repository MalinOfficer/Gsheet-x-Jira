
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageSearch } from "lucide-react";

export function MigrasiProduk() {
    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
             <div className="max-w-7xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Migrasi Product</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Halaman ini sedang dalam pengembangan untuk fitur migrasi produk.
                    </p>
                </header>
                 <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[400px]">
                    <CardHeader>
                        <div className="mx-auto bg-muted p-3 rounded-full">
                           <PackageSearch className="w-12 h-12 text-muted-foreground" />
                        </div>
                        <CardTitle className="mt-4">Under Construction</CardTitle>
                        <CardDescription>
                            Fitur untuk migrasi produk sedang disiapkan. Silakan kembali lagi nanti.
                        </CardDescription>
                    </CardHeader>
                </Card>
             </div>
        </div>
    )
}
