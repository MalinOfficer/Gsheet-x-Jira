import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex-1 bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        <style>{`@media (min-width: 1024px) { .header-cards-grid { grid-template-columns: repeat(4, 7fr) 12fr !important; } }`}</style>
        <div className="header-cards-grid grid gap-4 md:grid-cols-2 md:gap-8">
          <Skeleton className="h-[88px]" />
          <Skeleton className="h-[88px]" />
          <Skeleton className="h-[88px]" />
          <Skeleton className="h-[88px]" />
          <Skeleton className="h-[88px]" />
        </div>
        <Skeleton className="h-[300px] w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[250px]" />
          <Skeleton className="h-[250px]" />
        </div>
      </div>
    </div>
  );
}