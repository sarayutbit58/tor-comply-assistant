"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppShell({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-900">
              TOR Comply
            </Link>
            {title ? (
              <p className="truncate text-xs text-zinc-500">{title}</p>
            ) : (
              <p className="text-xs text-zinc-500">checklist · annotate · Word</p>
            )}
          </div>
          {path !== "/" && (
            <Link
              href="/"
              className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              โครงการทั้งหมด
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4 pb-24 sm:py-6">{children}</main>
    </div>
  );
}
