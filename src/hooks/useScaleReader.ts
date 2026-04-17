import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Leitura contínua de balanças via Web Serial API.
 * Após conectar, um loop de fundo lê o stream da balança e atualiza
 * `lastWeight` em tempo real. `readWeight` retorna o último valor estável
 * para uso no diálogo de captura de peso.
 *
 * Protocolos suportados: Toledo, Filizola (formatos ASCII com STX/ETX ou newline).
 */

export interface ScaleReading {
  weight: number; // em kg
  stable: boolean;
  source: "scale" | "manual";
}

interface UseScaleReaderReturn {
  isSerialSupported: boolean;
  isConnected: boolean;
  isReading: boolean;
  lastWeight: number | null;
  connectScale: () => Promise<boolean>;
  readWeight: () => Promise<ScaleReading | null>;
  disconnect: () => void;
}

// Parse ASCII frames common to Toledo/Filizola
function parseScaleFrame(data: string): number | null {
  const cleaned = data.replace(/[\x02\x03\x00\r\n]/g, "").trim();
  if (!cleaned) return null;
  const match = cleaned.match(/(\d+[.,]\d+)/);
  if (match) return parseFloat(match[1].replace(",", "."));
  const intMatch = cleaned.match(/(\d+)/);
  if (intMatch) {
    const val = parseInt(intMatch[1], 10);
    return val > 100 ? val / 1000 : val;
  }
  return null;
}

export function useScaleReader(): UseScaleReaderReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [lastWeight, setLastWeight] = useState<number | null>(null);

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const loopActiveRef = useRef(false);
  const lastWeightRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const isSerialSupported = typeof navigator !== "undefined" && "serial" in navigator;

  const stopReadLoop = useCallback(async () => {
    loopActiveRef.current = false;
    try {
      if (readerRef.current) {
        await readerRef.current.cancel().catch(() => {});
        try { readerRef.current.releaseLock(); } catch { /* ignore */ }
        readerRef.current = null;
      }
    } catch { /* ignore */ }
    setIsReading(false);
  }, []);

  const startReadLoop = useCallback(async (port: any) => {
    if (loopActiveRef.current) return;
    if (!port?.readable) return;
    loopActiveRef.current = true;
    setIsReading(true);

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (loopActiveRef.current && port.readable) {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        try {
          while (loopActiveRef.current) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // Split on common terminators (ETX, CR, LF)
            const parts = buffer.split(/[\x03\r\n]/);
            buffer = parts.pop() ?? ""; // keep incomplete tail

            for (const frame of parts) {
              if (!frame) continue;
              const w = parseScaleFrame(frame);
              if (w !== null && w >= 0) {
                lastWeightRef.current = w;
                lastUpdateRef.current = Date.now();
                setLastWeight(w);
              }
            }
          }
        } catch {
          // read error — break inner loop and try to reacquire
          break;
        } finally {
          try { reader.releaseLock(); } catch { /* ignore */ }
          readerRef.current = null;
        }
      }
    } finally {
      loopActiveRef.current = false;
      setIsReading(false);
    }
  }, []);

  const openPort = useCallback(async (port: any): Promise<boolean> => {
    try {
      if (!port.readable) {
        await port.open({
          baudRate: 9600,
          dataBits: 8,
          parity: "none",
          stopBits: 1,
        });
      }
      portRef.current = port;
      setIsConnected(true);
      // Start streaming in background (do not await)
      startReadLoop(port);
      return true;
    } catch {
      return false;
    }
  }, [startReadLoop]);

  const connectScale = useCallback(async (): Promise<boolean> => {
    if (!isSerialSupported) return false;
    try {
      const port = await (navigator as any).serial.requestPort();
      return await openPort(port);
    } catch {
      setIsConnected(false);
      return false;
    }
  }, [isSerialSupported, openPort]);

  // Auto-reconnect to previously authorized ports + hardware events
  useEffect(() => {
    if (!isSerialSupported) return;
    let cancelled = false;

    (async () => {
      try {
        const ports = await (navigator as any).serial.getPorts();
        if (cancelled || !ports || ports.length === 0) return;
        await openPort(ports[0]);
      } catch { /* ignore */ }
    })();

    const serial = (navigator as any).serial;
    const handleConnect = (e: any) => {
      if (!portRef.current && e.target) openPort(e.target);
    };
    const handleDisconnect = (e: any) => {
      if (portRef.current === e.target) {
        loopActiveRef.current = false;
        portRef.current = null;
        readerRef.current = null;
        setIsConnected(false);
        setIsReading(false);
      }
    };
    serial.addEventListener?.("connect", handleConnect);
    serial.addEventListener?.("disconnect", handleDisconnect);

    return () => {
      cancelled = true;
      serial.removeEventListener?.("connect", handleConnect);
      serial.removeEventListener?.("disconnect", handleDisconnect);
    };
  }, [isSerialSupported, openPort]);

  // Returns the latest streamed weight (waits briefly for a fresh frame)
  const readWeight = useCallback(async (): Promise<ScaleReading | null> => {
    if (!portRef.current) return null;
    // Wait up to 1.5s for a fresh frame
    const startedAt = Date.now();
    const baseline = lastUpdateRef.current;
    while (Date.now() - startedAt < 1500) {
      if (lastUpdateRef.current > baseline && lastWeightRef.current !== null) break;
      await new Promise((r) => setTimeout(r, 80));
    }
    const w = lastWeightRef.current;
    if (w !== null && w > 0) {
      return { weight: w, stable: true, source: "scale" };
    }
    return null;
  }, []);

  const disconnect = useCallback(() => {
    (async () => {
      await stopReadLoop();
      try {
        if (portRef.current) {
          await portRef.current.close().catch(() => {});
          portRef.current = null;
        }
      } catch { /* ignore */ }
      lastWeightRef.current = null;
      setIsConnected(false);
      setLastWeight(null);
    })();
  }, [stopReadLoop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      loopActiveRef.current = false;
      try { readerRef.current?.cancel?.(); } catch { /* ignore */ }
      try { portRef.current?.close?.(); } catch { /* ignore */ }
    };
  }, []);

  return {
    isSerialSupported,
    isConnected,
    isReading,
    lastWeight,
    connectScale,
    readWeight,
    disconnect,
  };
}
