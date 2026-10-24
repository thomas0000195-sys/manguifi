/** Bloc gris animé pendant le chargement. Respecte « réduire les animations ». */
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-navy-100 motion-reduce:animate-none ${className}`}
    />
  );
}
