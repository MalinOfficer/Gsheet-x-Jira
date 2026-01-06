import { MigrasiMurid } from "@/components/migrasi-murid";

export default function MigrasiMuridPage() {
    return (
        <main className="h-screen w-screen overflow-hidden">
            <div style={{ 
                width: '111.11%', 
                height: '111.11%', 
                transform: 'scale(0.9)', 
                transformOrigin: 'top left' 
            }}>
                <MigrasiMurid />
            </div>
        </main>
    );
}
