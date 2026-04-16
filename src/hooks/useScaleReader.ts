import { useState, useCallback, useRef } from "react";

/**
 * Protocolos suportados para leitura de balanças via Web Serial API.
 * Toledo: STX + dados + ETX, peso em gramas/kg nos bytes centrais.
 * Filizola: Formato similar com delimitadores diferentes.
 * 
 * Fallback: entrada manual de peso quando a Web Serial API não está disponível
 * ou a balança não está conectada.
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

// Parse Toledo protocol: STX(02h) + Status + Peso(6 bytes) + ETX(03h)
function parseToledoData(data: string): number | null {
  // Common Toledo format: the weight is embedded as ASCII digits
  // Example: \x02S     1.234\x03 -> 1.234 kg
  const cleaned = data.replace(/[\x02\x03\x00]/g, "").trim();
  // Try to extract a decimal number
  const match = cleaned.match(/(\d+[.,]\d+)/);
  if (match) {
    return parseFloat(match[1].replace(",", "."));
  }
  // Try integer (grams)
  const intMatch = cleaned.match(/(\d+)/);
  if (intMatch) {
    const val = parseInt(intMatch[1], 10);
    // If > 100, likely grams
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

  const isSerialSupported = typeof navigator !== "undefined" && "serial" in navigator;

  const connectScale = useCallback(async (): Promise<boolean> => {
    if (!isSerialSupported) return false;
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({
        baudRate: 9600,
        dataBits: 8,
        parity: "none",
        stopBits: 1,
      });
      portRef.current = port;
      setIsConnected(true);
      return true;
    } catch {
      setIsConnected(false);
      return false;
    }
  }, [isSerialSupported]);

  const readWeight = useCallback(async (): Promise<ScaleReading | null> => {
    if (!portRef.current) return null;
    setIsReading(true);
    try {
      const reader = portRef.current.readable.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";
      const timeout = setTimeout(() => {
        reader.cancel();
      }, 3000);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Check for ETX (end of transmission) or newline
        if (buffer.includes("\x03") || buffer.includes("\n") || buffer.includes("\r")) {
          clearTimeout(timeout);
          break;
        }
      }
      reader.releaseLock();
      readerRef.current = null;

      const weight = parseToledoData(buffer);
      if (weight !== null && weight > 0) {
        setLastWeight(weight);
        setIsReading(false);
        return { weight, stable: true, source: "scale" };
      }
      setIsReading(false);
      return null;
    } catch {
      setIsReading(false);
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    try {
      if (readerRef.current) {
        readerRef.current.cancel();
        readerRef.current = null;
      }
      if (portRef.current) {
        portRef.current.close();
        portRef.current = null;
      }
    } catch {
      // ignore
    }
    setIsConnected(false);
    setLastWeight(null);
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
