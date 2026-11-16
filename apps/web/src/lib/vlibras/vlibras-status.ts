export type VLibrasUiStatus = "idle" | "loading" | "ready" | "error" | "unavailable";

type Listener = (status: VLibrasUiStatus) => void;

let currentStatus: VLibrasUiStatus = "idle";
const listeners = new Set<Listener>();

export function getVLibrasUiStatus(): VLibrasUiStatus {
  return currentStatus;
}

export function setVLibrasUiStatus(status: VLibrasUiStatus): void {
  if (currentStatus === status) return;
  currentStatus = status;
  for (const listener of listeners) {
    listener(status);
  }
}

export function subscribeVLibrasUiStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only reset. */
export function __resetVLibrasUiStatusForTests(): void {
  currentStatus = "idle";
  listeners.clear();
}
