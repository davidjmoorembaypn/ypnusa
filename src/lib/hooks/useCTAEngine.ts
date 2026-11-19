"use client";

import { useCallback, useRef, useState } from "react";
import type { CtaContext, CtaSet } from "@/lib/cta/ctaEngine";

interface UseCTAEngineState {
  data: CtaSet | null;
  error: string | null;
  loading: boolean;
}

const EMPTY: UseCTAEngineState = { data: null, error: null, loading: false };

export function useCTAEngine() {
  const [state, setState] = useState<UseCTAEngineState>(EMPTY);
  // Each generate() or reset() takes a new ticket. A response whose ticket is no longer the latest
  // belongs to an earlier lookup and is dropped, so it can never overwrite the current ZIP code's data.
  const ticket = useRef(0);

  /** Clears the current set. Call at the start of every new lookup. */
  const reset = useCallback(() => {
    ticket.current += 1;
    setState(EMPTY);
  }, []);

  const generate = useCallback(async (context: CtaContext) => {
    const mine = (ticket.current += 1);
    setState({ data: null, error: null, loading: true });
    try {
      const response = await fetch("/api/cta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
        cache: "no-store",
      });
      const result = (await response.json()) as { ok: boolean; cta?: CtaSet; error?: string };
      if (mine !== ticket.current) return result;
      if (result.ok && result.cta) {
        setState({ data: result.cta, error: null, loading: false });
      } else {
        setState({ data: null, error: result.error ?? "CTA generation failed.", loading: false });
      }
      return result;
    } catch (error) {
      if (mine !== ticket.current) return null;
      const message = error instanceof Error ? error.message : "CTA generation failed.";
      setState({ data: null, error: message, loading: false });
      return null;
    }
  }, []);

  return { ...state, generate, reset };
}
