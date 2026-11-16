"use client";

import { useState } from "react";
import type { ToolDemoConfig } from "./types";

export function useToolDemoState<T>(config: ToolDemoConfig, createInitial: () => T) {
  const [state, setStateInternal] = useState<T>(() => createInitial());
  const [history, setHistory] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Pronto.");

  function setState(next: T | ((prev: T) => T)) {
    setStateInternal((prev) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      setHistory((h) => [...h.slice(-(19)), prev]);
      return value;
    });
    setError(null);
  }

  function reset() {
    setStateInternal(createInitial());
    setHistory([]);
    setError(null);
    setStatus("Demonstração reiniciada.");
  }

  function assertLimit(count: number): boolean {
    if (count >= config.maxItems) {
      setError(`Limite da demonstração: no máximo ${config.maxItems} itens.`);
      return false;
    }
    return true;
  }

  function undo() {
    setHistory((h) => {
      const prev = h[h.length - 1];
      if (!prev) return h;
      setStateInternal(prev);
      setStatus("Última alteração desfeita.");
      return h.slice(0, -1);
    });
  }

  return {
    config,
    state,
    setState,
    reset,
    undo,
    canUndo: history.length > 0,
    error,
    setError,
    status,
    setStatus,
    assertLimit,
    isDemo: true as const,
  };
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
