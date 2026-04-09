import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ProductImageUploadProps {
  imageUrl?: string;
  onImageChange: (url: string | undefined) => void;
}

export default function ProductImageUpload({ imageUrl, onImageChange }: ProductImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Erro", description: "Selecione um arquivo de imagem.", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Erro", description: "Imagem deve ter no máximo 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      onImageChange(urlData.publicUrl);
      toast({ title: "Imagem enviada!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!imageUrl) return;
    try {
      const urlParts = imageUrl.split("/product-images/");
      if (urlParts[1]) {
        await supabase.storage.from("product-images").remove([urlParts[1]]);
      }
    } catch {}
    onImageChange(undefined);
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-foreground">Imagem</span>
      {imageUrl ? (
        <div className="relative w-24 h-24 rounded-md overflow-hidden border border-border bg-muted">
          <img src={imageUrl} alt="Produto" className="w-full h-full object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-0.5 right-0.5 h-6 w-6"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-1 w-24 h-24 rounded-md border-2 border-dashed border-border bg-muted/50 hover:bg-muted transition-colors text-muted-foreground"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span className="text-[10px]">Upload</span>
            </>
          )}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
    </div>
  );
}
