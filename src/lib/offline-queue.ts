/**
 * Degraded-connectivity fallback for pointage: the phone's GPS chip works
 * without a data connection, but reaching the server obviously doesn't. If
 * a scan happens while offline (or the request fails mid-flight), we keep
 * the captured payload in localStorage and retry automatically once the
 * browser reports it's back online — the employee sees an immediate local
 * confirmation instead of a dead end.
 */

const KEY = "manguifi_offline_punches";

export type QueuedPunch = {
  id: string;
  siteToken: string;
  latitude: number;
  longitude: number;
  photoDataUrl?: string;
  deviceFingerprint?: string;
  queuedAt: number;
};

export function queuePunch(payload: Omit<QueuedPunch, "id" | "queuedAt">): QueuedPunch {
  const entry: QueuedPunch = { ...payload, id: crypto.randomUUID(), queuedAt: Date.now() };
  const queue = getQueuedPunches();
  queue.push(entry);
  localStorage.setItem(KEY, JSON.stringify(queue));
  return entry;
}

export function getQueuedPunches(): QueuedPunch[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function removeQueuedPunch(id: string) {
  const queue = getQueuedPunches().filter((p) => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(queue));
}
