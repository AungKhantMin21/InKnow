import { useState, useCallback, useRef } from "react";
import { getToken } from "../lib/auth.js";
import api from "../lib/api.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const MAX_RECONNECTS = 3;
const RECONNECT_DELAY_MS = 1000;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

export const useJobStream = () => {
  const [streaming, setStreaming] = useState(false);
  const [tokens, setTokens] = useState("");
  const [complete, setComplete] = useState(null);
  const [error, setError] = useState(null);

  const esRef = useRef(null);
  const pollTimerRef = useRef(null);

  const reset = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    setStreaming(false);
    setTokens("");
    setComplete(null);
    setError(null);
  }, []);

  const startPollingFallback = useCallback((jobId) => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    pollTimerRef.current = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(pollTimerRef.current);
        setError("Something went wrong — try again.");
        setStreaming(false);
        return;
      }
      try {
        const res = await api.get(`/api/jobs/${jobId}`);
        const job = res.data?.data?.job;
        if (!job) return;
        if (job.status === "completed" && job.result) {
          clearInterval(pollTimerRef.current);
          setComplete(job.result);
          setStreaming(false);
        } else if (job.status === "failed") {
          clearInterval(pollTimerRef.current);
          setError(job.error || "Something went wrong — try again.");
          setStreaming(false);
        }
      } catch {
        // non-fatal — keep polling until deadline
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const startStream = useCallback((jobId) => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }

    setStreaming(true);
    setTokens("");
    setComplete(null);
    setError(null);

    let reconnects = 0;

    const connect = () => {
      const token = getToken();
      const es = new EventSource(`${API_BASE}/api/jobs/${jobId}/stream?token=${token}`);
      esRef.current = es;

      es.onmessage = (event) => {
        reconnects = 0; // successful message — reset reconnect counter
        const data = JSON.parse(event.data);

        if (data.type === "token") {
          setTokens((prev) => prev + data.chunk);
        }
        if (data.type === "complete") {
          setComplete(data.result);
          setStreaming(false);
          es.close();
          esRef.current = null;
        }
        if (data.type === "error") {
          setError(data.error || "Something went wrong — try again.");
          setStreaming(false);
          es.close();
          esRef.current = null;
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (reconnects < MAX_RECONNECTS) {
          reconnects++;
          setTimeout(connect, RECONNECT_DELAY_MS);
        } else {
          // SSE failed after max retries — fall back to polling
          startPollingFallback(jobId);
        }
      };
    };

    connect();

    return () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    };
  }, [startPollingFallback]);

  return { streaming, tokens, complete, error, startStream, reset };
};
