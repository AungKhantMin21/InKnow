import { useState, useCallback } from "react";
import { getToken } from "../lib/auth.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const useJobStream = () => {
  const [streaming, setStreaming] = useState(false);
  const [tokens, setTokens] = useState("");
  const [complete, setComplete] = useState(null);
  const [error, setError] = useState(null);

  const reset = useCallback(() => {
    setStreaming(false);
    setTokens("");
    setComplete(null);
    setError(null);
  }, []);

  const startStream = useCallback((jobId) => {
    setStreaming(true);
    setTokens("");
    setComplete(null);
    setError(null);

    const token = getToken();
    const eventSource = new EventSource(
      `${API_BASE}/api/jobs/${jobId}/stream?token=${token}`,
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "token") {
        setTokens((prev) => prev + data.chunk);
      }

      if (data.type === "complete") {
        setComplete(data.result);
        setStreaming(false);
        eventSource.close();
      }

      if (data.type === "error") {
        setError(data.error || "Something went wrong — try again.");
        setStreaming(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setError("Connection lost. Please try again.");
      setStreaming(false);
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  return { streaming, tokens, complete, error, startStream, reset };
};
