"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "./AppShell";
import { selectActive, useProjectStore } from "@/store/projectStore";
import { exportComplyWord } from "@/lib/exportWord";

type Tab = "checklist" | "docs" | "annotate";

export function ProjectClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const store = useProjectStore();
  const project = selectActive(store.projects, projectId);
  const [tab, setTab] = useState<Tab>("checklist");
  const [q, setQ] = useState("");
  const [selectedReq, setSelectedReq] = useState<string | null>(null);
  const [newReqId, setNewReqId] = useState("");
  const [newReqTitle, setNewReqTitle] = useState("");
  const [newReqText, setNewReqText] = useState("");
  const [refDocId, setRefDocId] = useState("");
  const [refPage, setRefPage] = useState("1");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!project) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return project.requirements;
    return project.requirements.filter(
      (r) =>
        r.id.toLowerCase().includes(needle) ||
        r.title.toLowerCase().includes(needle) ||
        r.textSnapshot.toLowerCase().includes(needle)
    );
  }, [project, q]);

  if (!project) {
    return (
      <AppShell>
        <p className="text-sm text-zinc-600">ไม่พบโครงการ</p>
        <button
          type="button"
          className="mt-3 text-sm text-blue-600 underline"
          onClick={() => router.push("/")}
        >
          กลับหน้าแรก
        </button>
      </AppShell>
    );
  }

  const activeReqId = selectedReq ?? filtered[0]?.id ?? null;
  const activeReq = project.requirements.find((r) => r.id === activeReqId);
  const activeRow = activeReqId ? project.rows[activeReqId] : undefined;

  function statusOf(id: string) {
    const row = project!.rows[id];
    if (!row) return "ว่าง";
    if (row.bidderText.trim() && row.compareText.trim() && row.refs.length) return "ครบ";
    if (row.bidderText.trim() || row.compareText.trim() || row.refs.length) return "บางส่วน";
    return "ว่าง";
  }

  return (
    <AppShell title={project.name}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm sm:max-w-md"
          value={project.name}
          onChange={(e) => store.rename(project.id, e.target.value)}
        />
        <button
          type="button"
          disabled={busy || project.requirements.length === 0}
          className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
          onClick={async () => {
            setBusy(true);
            try {
              await exportComplyWord(project);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "กำลังสร้าง…" : "Export Word (Red Cross)"}
        </button>
      </div>

      <nav className="mb-4 flex gap-1 rounded-xl bg-zinc-200/60 p-1 text-sm">
        {(
          [
            ["checklist", "Checklist"],
            ["docs", "เอกสาร"],
            ["annotate", "Annotate"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 font-medium ${
              tab === id ? "bg-white shadow-sm" : "text-zinc-600"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "checklist" && (
        <div className="space-y-4">
          <input
            placeholder="ค้นหาข้อ / ข้อความ…"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <details className="rounded-xl border border-zinc-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium">
              เพิ่มข้อกำหนด (ติด section id)
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                placeholder="เช่น 5.1"
                value={newReqId}
                onChange={(e) => setNewReqId(e.target.value)}
              />
              <input
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                placeholder="หัวข้อ"
                value={newReqTitle}
                onChange={(e) => setNewReqTitle(e.target.value)}
              />
              <textarea
                className="sm:col-span-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                rows={3}
                placeholder="ข้อความ snapshot จาก TOR"
                value={newReqText}
                onChange={(e) => setNewReqText(e.target.value)}
              />
              <button
                type="button"
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white sm:col-span-2"
                onClick={() => {
                  const id = newReqId.trim();
                  if (!id) return;
                  store.upsertRequirement(project.id, {
                    id,
                    title: newReqTitle.trim(),
                    textSnapshot: newReqText.trim(),
                  });
                  setNewReqId("");
                  setNewReqTitle("");
                  setNewReqText("");
                  setSelectedReq(id);
                }}
              >
                บันทึกข้อ
              </button>
            </div>
          </details>

          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {filtered.length === 0 ? (
              <li className="p-4 text-sm text-zinc-500">
                ยังไม่มีข้อ — โหลด demo จากหน้าแรก หรือเพิ่มข้อด้านบน
              </li>
            ) : (
              filtered.map((r) => {
                const st = statusOf(r.id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                      onClick={() => {
                        setSelectedReq(r.id);
                        setTab("annotate");
                      }}
                    >
                      <span className="w-14 shrink-0 font-mono text-sm font-semibold text-zinc-800">
                        {r.id}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {r.title || "(ไม่มีหัวข้อ)"}
                        </span>
                        <span className="line-clamp-2 text-xs text-zinc-500">
                          {r.textSnapshot}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          st === "ครบ"
                            ? "bg-emerald-100 text-emerald-800"
                            : st === "บางส่วน"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {st}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {tab === "docs" && (
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center hover:bg-zinc-50">
            <span className="text-sm font-medium">แนบเอกสารโครงการ (PDF/DOCX)</span>
            <span className="mt-1 text-xs text-zinc-500">
              เก็บในเบราว์เซอร์ · docId อยู่ในโครงการนี้เท่านั้น
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  store.addDoc(project.id, {
                    name: file.name,
                    mimeType: file.type,
                    dataUrl: typeof reader.result === "string" ? reader.result : undefined,
                  });
                };
                reader.readAsDataURL(file);
                e.target.value = "";
              }}
            />
          </label>
          <ul className="space-y-2">
            {project.docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{d.name}</div>
                  <div className="font-mono text-[11px] text-zinc-500">docId: {d.id}</div>
                </div>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => store.removeDoc(project.id, d.id)}
                >
                  ลบ
                </button>
              </li>
            ))}
            {project.docs.length === 0 && (
              <li className="text-sm text-zinc-500">ยังไม่มีเอกสาร</li>
            )}
          </ul>
        </div>
      )}

      {tab === "annotate" && (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <aside className="max-h-[50vh] overflow-auto rounded-xl border border-zinc-200 bg-white lg:max-h-[70vh]">
            <ul className="divide-y divide-zinc-100 text-sm">
              {project.requirements.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`block w-full px-3 py-2 text-left hover:bg-zinc-50 ${
                      r.id === activeReqId ? "bg-zinc-100 font-semibold" : ""
                    }`}
                    onClick={() => setSelectedReq(r.id)}
                  >
                    {r.id}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
            {!activeReq ? (
              <p className="text-sm text-zinc-500">เลือกข้อจาก checklist ก่อน</p>
            ) : (
              <>
                <div>
                  <div className="font-mono text-xs text-zinc-500">ข้อ {activeReq.id}</div>
                  <h2 className="text-lg font-semibold">{activeReq.title}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                    {activeReq.textSnapshot}
                  </p>
                </div>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium">รายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ</span>
                  <textarea
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    rows={4}
                    value={activeRow?.bidderText ?? ""}
                    onChange={(e) =>
                      store.setRow(project.id, activeReq.id, {
                        bidderText: e.target.value,
                      })
                    }
                    placeholder="ข้อความที่เสนอ / สเปคสินค้า…"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium">เปรียบเทียบรายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ</span>
                  <textarea
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    rows={3}
                    value={activeRow?.compareText ?? ""}
                    onChange={(e) =>
                      store.setRow(project.id, activeReq.id, {
                        compareText: e.target.value,
                      })
                    }
                    placeholder="เช่น รายละเอียดตรงตามข้อกำหนด"
                  />
                </label>

                <div>
                  <div className="mb-2 text-sm font-medium">เอกสารอ้างอิง (docId + หน้า)</div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={refDocId || project.docs[0]?.id || ""}
                      onChange={(e) => setRefDocId(e.target.value)}
                    >
                      {project.docs.length === 0 && (
                        <option value="">— แนบเอกสารก่อน —</option>
                      )}
                      {project.docs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      className="w-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={refPage}
                      onChange={(e) => setRefPage(e.target.value)}
                      placeholder="หน้า"
                    />
                    <button
                      type="button"
                      className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-40"
                      disabled={project.docs.length === 0}
                      onClick={() => {
                        const docId = refDocId || project.docs[0]?.id;
                        const page = Number(refPage) || 1;
                        if (!docId) return;
                        store.addRef(project.id, activeReq.id, { docId, page });
                      }}
                    >
                      เพิ่ม ref
                    </button>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {(activeRow?.refs ?? []).map((ref, i) => {
                      const doc = project.docs.find((d) => d.id === ref.docId);
                      return (
                        <li
                          key={`${ref.docId}-${ref.page}-${i}`}
                          className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm"
                        >
                          <span>
                            {doc?.name ?? ref.docId} · หน้า {ref.page}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-red-600"
                            onClick={() => store.removeRef(project.id, activeReq.id, i)}
                          >
                            ลบ
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
