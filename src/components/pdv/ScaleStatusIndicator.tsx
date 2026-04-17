import { Scale, Plug, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScale } from "@/contexts/ScaleContext";
import { toast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ScaleStatusIndicator() {
  const { isSerialSupported, isConnected, isReading, lastWeight, connectScale, disconnect } = useScale();

  const handleClick = async () => {
    if (!isSerialSupported) {
      toast({
        title: "Web Serial não suportada",
        description: "Use Chrome/Edge no desktop para conectar a balança.",
        variant: "destructive",
      });
      return;
    }
    if (isConnected) {
      disconnect();
      toast({ title: "Balança desconectada" });
    } else {
      const ok = await connectScale();
      toast({
        title: ok ? "Balança conectada" : "Falha na conexão",
        variant: ok ? "default" : "destructive",
      });
    }
  };

  // Visual state
  let dotClass = "bg-muted-foreground";
  let label = "Sem balança";
  let Icon = Scale;
  let title = "Balança não conectada — clique para conectar";

  if (!isSerialSupported) {
    dotClass = "bg-destructive";
    label = "N/D";
    Icon = AlertCircle;
    title = "Web Serial API não suportada neste navegador";
  } else if (isReading) {
    dotClass = "bg-warning animate-pulse";
    label = "Lendo...";
    Icon = Loader2;
    title = "Lendo peso da balança...";
  } else if (isConnected) {
    dotClass = "bg-success animate-pulse";
    label = lastWeight != null ? `${lastWeight.toFixed(3)} kg` : "Conectada";
    Icon = Scale;
    title = "Balança conectada — clique para desconectar";
  } else {
    Icon = Plug;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            className="h-8 px-2 text-xs shrink-0 touch-manipulation gap-1.5"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
            <Icon className={`h-3.5 w-3.5 ${isReading ? "animate-spin" : ""}`} />
            <span className="hidden md:inline tabular-nums">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
