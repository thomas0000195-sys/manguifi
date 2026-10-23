import type { Metadata } from "next";

// Console réservée au propriétaire de la plateforme : jamais indexée.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-navy-950">{children}</div>;
}
