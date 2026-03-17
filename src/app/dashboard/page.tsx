import { Dashboard } from "@/components/dashboard";
import { getDashboardFilterOptions } from "@/app/actions";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // ✅ Hanya fetch filter options (ringan), bukan stats data yang berat
  // Stats di-fetch client-side oleh Dashboard component
  let initialOptions = null;
  try {
    const result = await getDashboardFilterOptions();
    if (!result.error && result.data) {
      initialOptions = result.data;
    }
  } catch {
    // Gagal pun tidak masalah, Dashboard akan fetch sendiri
  }

  return (
    <Dashboard
      initialStats={null}
      initialOptions={initialOptions}
      defaultYears={[]}
      error={null}
    />
  );
}