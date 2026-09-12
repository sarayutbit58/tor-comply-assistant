"use client";

import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { AppShell } from "./AppShell";

export function HomeClient() {
  const router = useRouter();
  const { projects, createBlank, createDemo, deleteProject } = useProjectStore();

  return (
    <AppShell>
      <section className="mb-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-6 sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          เริ่มโครงการว่าง
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600">
          เลือกสินค้าและดึง datasheet เอง — แอพช่วยขีด checklist, ผูกหน้าเอกสาร, แล้ว export ตาราง
          ตาราง Word แบบ Red Cross (รวมคอลัมน์เปรียบเทียบ) โดยไม่ใช้ AI บนเส้นทางหลัก
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
            onClick={() => {
              const id = createBlank();
              router.push(`/project/${id}`);
            }}
          >
            สร้างโครงการใหม่
          </button>
          <button
            type="button"
            className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            onClick={() => {
              const id = createDemo();
              router.push(`/project/${id}`);
            }}
          >
            โหลด demo กพบ (42 ข้อ)
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-700">โครงการล่าสุด</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-zinc-500">ยังไม่มี — กดสร้างหรือโหลด demo</p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => {
              const filled = Object.values(p.rows).filter(
                (r) => r.bidderText.trim() || r.refs.length
              ).length;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => router.push(`/project/${p.id}`)}
                  >
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-zinc-500">
                      {p.requirements.length} ข้อ · กรอกแล้ว {filled} · เอกสาร {p.docs.length}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-red-600 hover:underline"
                    onClick={() => deleteProject(p.id)}
                  >
                    ลบ
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
