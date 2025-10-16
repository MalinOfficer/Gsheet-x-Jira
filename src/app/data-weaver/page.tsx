
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combine } from "lucide-react";

export default function DataWeaverPage() {
    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6 flex items-center justify-center min-h-[60vh]">
                <Card className="text-center p-8 w-full max-w-lg">
                    <CardHeader>
                        <div className="mx-auto bg-muted rounded-full p-3 w-fit">
                           <Combine className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <CardTitle className="mt-4">
                            Fitur Dalam Pengembangan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            Fitur "Data Weaver" untuk penggabungan file sedang dalam perbaikan dan akan segera tersedia kembali. Terima kasih atas kesabaran Anda.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
