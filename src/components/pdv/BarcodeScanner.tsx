import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, SwitchCamera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export default function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [cameraIdx, setCameraIdx] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "barcode-reader";

  useEffect(() => {
    if (!open) return;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices.length === 0) {
          setError("Nenhuma câmera encontrada");
          return;
        }
        setCameras(devices);
        // Prefer back camera
        const backIdx = devices.findIndex(
          (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("traseira") || d.label.toLowerCase().includes("environment")
        );
        setCameraIdx(backIdx >= 0 ? backIdx : devices.length - 1);
      })
      .catch(() => setError("Permissão de câmera negada"));
  }, [open]);

  useEffect(() => {
    if (!open || cameras.length === 0) return;

    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;
    setScanning(true);
    setError("");

    scanner
      .start(
        cameras[cameraIdx].id,
        { fps: 10, qrbox: { width: 280, height: 150 } },
        (decodedText) => {
          scanner.stop().then(() => {
            setScanning(false);
            onScan(decodedText);
          });
        },
        () => {} // ignore scan failures
      )
      .catch((err) => {
        console.error("Scanner start error:", err);
        setError("Não foi possível iniciar a câmera");
        setScanning(false);
      });

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [open, cameras, cameraIdx]);

  const handleClose = () => {
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
    setScanning(false);
    setError("");
    setCameras([]);
    onClose();
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().then(() => {
        setCameraIdx((prev) => (prev + 1) % cameras.length);
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Escanear Código de Barras
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-4 space-y-3">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-destructive text-center">{error}</p>
              <Button variant="outline" size="sm" onClick={handleClose}>
                Fechar
              </Button>
            </div>
          ) : (
            <>
              <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
                <div id={containerId} className="w-full h-full" />
                {scanning && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-[280px] h-[150px] border-2 border-primary rounded-lg animate-pulse" />
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Posicione o código de barras dentro da área destacada
              </p>

              <div className="flex gap-2 justify-center">
                {cameras.length > 1 && (
                  <Button variant="outline" size="sm" onClick={switchCamera}>
                    <SwitchCamera className="h-4 w-4 mr-1" /> Trocar Câmera
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleClose}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
