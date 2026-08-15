import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FinalResult, InferenceTask, WorkerInfo } from "@murmur/core";
import {
  createClient,
  type MurmurClient,
  type MurmurClientOptions,
  type MurmurStatus,
  type ClientEvent,
} from "@murmur/client";

export interface MurmurContextValue {
  status: MurmurStatus;
  clientId: string | null;
  workers: WorkerInfo[];
  recentTasks: InferenceTask[];
  completions: FinalResult[];
  requestTask: (input: { model: string; input: unknown; timeoutMs?: number }) => Promise<FinalResult>;
}

const MurmurContext = createContext<MurmurContextValue | null>(null);

export interface MurmurProviderProps {
  coordinator: string;
  options?: Omit<MurmurClientOptions, "coordinator">;
  children: ReactNode;
}

export function MurmurProvider({ coordinator, options, children }: MurmurProviderProps) {
  const clientRef = useRef<MurmurClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = createClient({ coordinator, ...options });
  }

  const [status, setStatus] = useState<MurmurStatus>("idle");
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [recentTasks, setRecentTasks] = useState<InferenceTask[]>([]);
  const [completions, setCompletions] = useState<FinalResult[]>([]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    setStatus(client.status);

    const onEvent = (event: ClientEvent) => {
      switch (event.type) {
        case "status":
          setStatus(event.status);
          break;
        case "workers":
          setWorkers(event.workers);
          break;
        case "task":
          setRecentTasks((prev) => [...prev, event.task].slice(-20));
          break;
        case "complete":
          setCompletions((prev) => [event.final, ...prev].slice(0, 20));
          break;
      }
    };

    client.subscribe(onEvent);
    void client.connect();

    return () => {
      client.disconnect();
    };
  }, []);

  const requestTask = useCallback(async (input: { model: string; input: unknown; timeoutMs?: number }) => {
    const client = clientRef.current;
    if (!client) throw new Error("Murmur client not initialized");
    return client.requestTask(input);
  }, []);

  const value = useMemo<MurmurContextValue>(
    () => ({
      status,
      clientId: clientRef.current?.clientId ?? null,
      workers,
      recentTasks,
      completions,
      requestTask,
    }),
    [status, workers, recentTasks, completions, requestTask],
  );

  return <MurmurContext.Provider value={value}>{children}</MurmurContext.Provider>;
}

export function useMurmur(): MurmurContextValue {
  const context = useContext(MurmurContext);
  if (!context) {
    throw new Error("useMurmur must be used inside a <MurmurProvider>");
  }
  return context;
}
