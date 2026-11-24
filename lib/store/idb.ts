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
  Array<Pick<AnalysisResult, "createdAt" | "sourceName" | "kpis"> & { displayName?: string; clusters?: number }>
> {
  const db = await openDb();
  const runs = await new Promise<
    Array<Pick<AnalysisResult, "createdAt" | "sourceName" | "kpis"> & { displayName?: string; clusters?: number }>
  >((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const all = (req.result as (AnalysisResult & { displayName?: string })[]).map((r) => ({
        createdAt: r.createdAt,
        sourceName: r.sourceName,
        kpis: r.kpis,
        displayName: r.displayName,
        clusters: r.clusters?.length,
      }));
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
  db.close();
  return runs.sort((a, b) => b.createdAt - a.createdAt);
}

/** The name a run should display: custom rename first, then source name. */
export function runDisplayName(r: { displayName?: string; sourceName: string }): string {
  return r.displayName?.trim() || r.sourceName;
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

/** Rename a run in place (custom display name kept on the record itself). */
export async function renameRun(createdAt: number, name: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(createdAt);
    req.onsuccess = () => {
      const run = req.result as (AnalysisResult & { displayName?: string }) | undefined;
      if (run) {
        run.displayName = name;
        store.put(run);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Delete every run. Returns the number of records removed. */
export async function clearRuns(): Promise<number> {
  const db = await openDb();
  const count = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.objectStore(STORE).clear();
  });
  db.close();
  return count;
}

/** Best-effort storage usage estimate for the "本地工作区" card. */
export async function storageEstimateMb(): Promise<number | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const { usage } = await navigator.storage.estimate();
    return typeof usage === "number" ? usage / 1048576 : null;
  } catch {
    return null;
  }
}

// ---- helpers shared by UI ----

/** Fire after any run mutation so the sidebar list can refresh live. */
export function notifyRunsChanged(): void {
  window.dispatchEvent(new CustomEvent("echo:runs-changed"));
}

export function membersOf(result: AnalysisResult, cluster: Cluster): CleanFeedback[] {
  const byId = new Map(result.items.map((i) => [i.id, i]));
  return cluster.memberIds.map((id) => byId.get(id)!).filter(Boolean);
}
