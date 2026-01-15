'use client';

import React from 'react';
import { HardHat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

const KnowledgeDashboard = () => {
  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto p-4 sm:p-6 md:p-8">
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-lg text-center">
            <CardHeader>
                <div className="mx-auto bg-muted p-3 rounded-full">
                    <HardHat className="h-12 w-12 text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent>
                <CardTitle className="text-2xl font-bold">Fitur dalam Pengembangan</CardTitle>
                <CardDescription className="mt-2 text-muted-foreground">
                    Fitur Knowledge Base sedang dalam tahap riset ulang dan pengembangan untuk memberikan
                    kemampuan yang lebih baik. Terima kasih atas kesabaran Anda.
                </CardDescription>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KnowledgeDashboard;
