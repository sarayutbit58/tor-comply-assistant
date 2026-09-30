"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AiSettingsButton } from "./AiSettings";

export function AppShell({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <div className="min-h-dvh border-t-4 border-[#ff0038] bg-[#f5f5f6] text-[#262629]">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="TOR Comply หน้าแรก" className="shrink-0">
              <Image src="/brand-logo.png" alt="1toAll" width={128} height={58} priority className="h-auto w-24 sm:w-32" />
            </Link>
            <div className="min-w-0 border-l border-zinc-200 pl-3">
              <Link href="/" className="text-sm font-bold tracking-tight text-[#262629]">TOR <span className="text-[#ff0038]">Comply</span></Link>
            {title ? (
              <p className="truncate text-xs text-zinc-500">{title}</p>
            ) : (
              <p className="text-xs text-zinc-500">พื้นที่ทำงาน Presales</p>
            )}
            </div>
          </div>
          <AiSettingsButton />
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
      <main className="mx-auto max-w-6xl px-4 py-5 pb-24 sm:py-8">{children}</main>
    </div>
  );
}
