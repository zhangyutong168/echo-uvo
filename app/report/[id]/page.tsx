import { Suspense } from "react";
import ReportClient from "./ReportClient";

export const instant = false;

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const runId = Number.parseInt(id, 10);
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-6 py-24 text-center text-gray-500">加载中…</div>}>
      <ReportClient runId={Number.isFinite(runId) ? runId : 0} />
    </Suspense>
  );
}
