import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-md space-y-4 px-5 py-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
