"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const tableHeaders = [
    "No", "Username/NIS", "NIS", "NISN", "NIK", "Nama Kelas", "Kode Siswa",
    "Asal Sekolah", "Nama", "L/P", "Tempat Lahir", "Tanggal Lahir (dd/mm/yyyy)",
    "Handphone", "Telepon", "Email", "Alamat", "No Rumah", "RT", "RW", "Ayah",
    "Pekerjaan Ayah", "Ibu", "Pekerjaan Ibu", "Wali", "Pekerjaan Wali",
    "No Kartu Keluarga"
];

export function MigrasiMurid() {
    return (
        <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-full mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Migrasi Murid</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gunakan tabel di bawah ini untuk mengelola proses migrasi data murid.
                    </p>
                </header>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Data Murid untuk Migrasi</CardTitle>
                        <CardDescription>
                            Tabel ini berisi semua data murid yang akan dimigrasikan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="relative w-full overflow-auto rounded-md border max-h-[600px]">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-card">
                                    <TableRow>
                                        {tableHeaders.map((header) => (
                                            <TableHead key={header} className="font-bold bg-muted/50 whitespace-nowrap">
                                                {header}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell colSpan={tableHeaders.length} className="h-24 text-center">
                                            Belum ada data murid.
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
