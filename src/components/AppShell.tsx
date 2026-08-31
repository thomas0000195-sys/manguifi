"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Clock,
  Repeat,
  FileCheck2,
  BarChart3,
  Settings,
  LogOut,
  QrCode,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import InstallPrompt from "./InstallPrompt";

const navItems = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/employes", label: "Employés", icon: Users },
  { href: "/equipes", label: "Équipes & sites", icon: Building2 },
  { href: "/horaires", label: "Horaires", icon: Clock },
  { href: "/justificatifs", label: "Justificatifs", icon: FileCheck2 },
  { href: "/planning", label: "Planning", icon: Repeat },
  { href: "/rapports", label: "Rapports", icon: BarChart3 },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

const mobileItems = navItems.slice(0, 5);

export default function AppShell({
  children,
  orgName,
  userEmail,
  role,
  isDemo,
}: {
  children: React.ReactNode;
  orgName: string;
  userEmail: string | null;
  role: string;
  isDemo?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-white">
            <QrCode className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-navy-900">
            Manguifi
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-navy-900 text-white shadow-sm"
                    : "text-navy-800/80 hover:bg-navy-50"
                }`}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <div className="mb-2 rounded-xl bg-navy-50 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-navy-900">{orgName}</p>
            <p className="truncate text-xs text-muted">{userEmail ?? "Connecté par WhatsApp"}</p>
            <span className="mt-1 inline-block rounded-full bg-navy-900/10 px-2 py-0.5 text-[11px] font-medium text-navy-800">
              {role === "ADMIN" ? "Administrateur" : "Responsable"}
            </span>
          </div>
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted transition hover:bg-red-50 hover:text-red-600">
              <LogOut className="h-4 w-4" /> Déconnexion
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-white">
              <QrCode className="h-4 w-4" />
            </div>
            <span className="font-semibold text-navy-900">Manguifi</span>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-navy-900 hover:bg-navy-50"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-navy-950/40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute right-0 top-0 h-full w-72 bg-surface p-5 shadow-2xl animate-fade-in-up">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-navy-900">Menu</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 hover:bg-navy-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-5 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                      pathname.startsWith(item.href)
                        ? "bg-navy-900 text-white"
                        : "text-navy-800/80 hover:bg-navy-50"
                    }`}
                  >
                    <item.icon className="h-4.5 w-4.5" />
                    {item.label}
                  </Link>
                ))}
              </nav>
              <form action={logoutAction} className="mt-4 border-t border-border pt-4">
                <button className="flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                  <LogOut className="h-4 w-4" /> Déconnexion
                </button>
              </form>
            </div>
          </div>
        )}

        {isDemo && (
          <div className="border-b border-orange-100 bg-orange-50 px-4 py-2 text-center text-xs font-medium text-orange-700">
            Mode démonstration — données fictives isolées, aucun impact sur de vraies organisations.
          </div>
        )}

        <InstallPrompt />

        <main className="flex-1 pb-20 lg:pb-0">{children}</main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 backdrop-blur lg:hidden">
          {mobileItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  active ? "text-navy-900" : "text-muted"
                }`}
              >
                <item.icon className={`h-5 w-5 ${active ? "text-navy-900" : ""}`} />
                {item.label.split(" ")[0]}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
