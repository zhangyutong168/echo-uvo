import type { AnalysisResult, CleanFeedback, Cluster } from "../types";

// Thin IndexedDB wrapper: one object store "runs", keyed by createdAt.
// Keeps the app backend-free (deploy anywhere, data stays on device).

const DB_NAME = "echo-uvo";
const DB_VERSION = 1;
const STORE = "runs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "createdAt" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRun(result: AnalysisResult): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(result);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listRuns(): Promise<
  Array<Pick<AnalysisResult, "createdAt" | "sourceName" | "kpis">>
> {
  const db = await openDb();
  const runs = await new Promise<
    Array<Pick<AnalysisResult, "createdAt" | "sourceName" | "kpis">>
  >((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const all = (req.result as AnalysisResult[]).map((r) => ({
        createdAt: r.createdAt,
        sourceName: r.sourceName,
        kpis: r.kpis,
      }));
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
  db.close();
  return runs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getRun(createdAt: number): Promise<AnalysisResult | null> {
  const db = await openDb();
  const run = await new Promise<AnalysisResult | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(createdAt);
    req.onsuccess = () => resolve((req.result as AnalysisResult) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return run;
}

export async function deleteRun(createdAt: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(createdAt);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// ---- helpers shared by UI ----

export function membersOf(result: AnalysisResult, cluster: Cluster): CleanFeedback[] {
  const byId = new Map(result.items.map((i) => [i.id, i]));
  return cluster.memberIds.map((id) => byId.get(id)!).filter(Boolean);
}
