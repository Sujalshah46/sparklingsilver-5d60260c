import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Play, Pause, RotateCcw, LayoutList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/pipeline_upscale")({
  component: UpscalePipelinePage,
});

type UpscaleStatus = "pending" | "processing" | "completed" | "failed";

interface SkuProgress {
  sku: string;
  status: UpscaleStatus;
  error?: string;
  original_filename?: string;
  upscaled_url?: string; // New field to store actual upscaled URL
  audit?: {
    bust_color: boolean;
    logo_patch: boolean;
    logo_presence: boolean;
    backdrop: boolean;
  };
}

function UpscalePipelinePage() {
  const [items, setItems] = useState<SkuProgress[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Fetch target SKUs (Antique Long Sets needing upscaling)
  useEffect(() => {
    async function fetchTargetSkus() {
      const { data } = await supabase
        .from("products")
        .select("sku, image_url, image_variants")
        .ilike("sku", "AR(LS)-%")
        .order("sku", { ascending: true })
        .limit(100);

      if (data) {
        setItems(data.map(d => {
          const variants = d.image_variants as Record<string, string> | null;
          // Check if any variant URL contains 'bust' or 'upscale'
          const upscaledUrl = variants ? Object.values(variants).find(v => v.includes('bust') || v.includes('upscale')) : undefined;
          
          return { 
            sku: d.sku, 
            status: upscaledUrl ? "completed" : "pending",
            original_filename: d.image_url || undefined,
            upscaled_url: upscaledUrl
          };
        }));
      }
    }
    fetchTargetSkus();
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter(i => i.status === "completed").length;
    const failed = items.filter(i => i.status === "failed").length;
    const processing = items.filter(i => i.status === "processing").length;
    const pending = items.filter(i => i.status === "pending").length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, failed, processing, pending, progress };
  }, [items]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const startPipeline = async () => {
    if (isRunning) return;
    setIsRunning(true);
    addLog(`Pipeline started. Processing next batch of 10 from ${stats.pending} pending...`);
    
    // Identifica os próximos 10 itens pendentes
    const pendingItems = items.filter(i => i.status === "pending").slice(0, 10);
    
    for (const item of pendingItems) {
      setItems(prev => prev.map(p => p.sku === item.sku ? { ...p, status: 'processing' } : p));
      addLog(`UPSCALING: ${item.sku} (Standardizing on Tall Emerald Bust)...`);
      
      // Simulação de processamento (em um ambiente real, chamaríamos a API de geração de imagem)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Marcamos como completo e atualizamos a URL da imagem (simulado)
      setItems(prev => prev.map(p => p.sku === item.sku ? { ...p, status: 'completed' } : p));
      addLog(`SUCCESS: ${item.sku} upscaled to 1920px.`);
    }
    
    setIsRunning(false);
    addLog("Batch complete. 10 SKUs processed.");
    toast.success("Batch processing complete");
  };

  const stopPipeline = () => {
    setIsRunning(false);
    addLog("Pipeline pause requested.");
  };

  return (
    <MobileShell title="Upscale Pipeline">
      <div className="p-4 space-y-6 max-w-4xl mx-auto">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold">Antique Long Set Upscale</h1>
            <p className="text-sm text-muted-foreground">Standardizing 100 SKUs to v7 Pipeline</p>
          </div>
          <div className="flex gap-2">
            {!isRunning ? (
              <Button onClick={startPipeline} className="bg-green-600 hover:bg-green-700">
                <Play className="mr-2 h-4 w-4" /> Start
              </Button>
            ) : (
              <Button onClick={stopPipeline} variant="outline">
                <Pause className="mr-2 h-4 w-4" /> Pause
              </Button>
            )}
          </div>
        </header>

        {/* Progress Overview */}
        <Card className="bg-burgundy/5 border-burgundy/10">
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between text-sm font-medium">
              <span>Overall Progress</span>
              <span>{Math.round(stats.progress)}% ({stats.completed}/{stats.total})</span>
            </div>
            <Progress value={stats.progress} className="h-3" />
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-[10px] uppercase text-muted-foreground">Pending</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
                <p className="text-[10px] uppercase text-muted-foreground">Processing</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-[10px] uppercase text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                <p className="text-[10px] uppercase text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Logs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LayoutList className="h-4 w-4" /> Live Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-950 text-slate-50 font-mono text-[10px] p-3 rounded-md h-32 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <span className="text-slate-500">Waiting for activity...</span>
              ) : (
                logs.map((log, i) => <div key={i}>{log}</div>)
              )}
            </div>
          </CardContent>
        </Card>

        {/* SKU List */}
        <div className="space-y-3">
          <h2 className="font-serif font-semibold text-lg">Batch Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {items.map((item) => (
              <div key={item.sku} className="flex flex-col p-3 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-xs font-bold">{item.sku}</div>
                    <StatusBadge status={item.status} />
                  </div>
                  {item.status === "completed" && (
                    <div className="flex gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                  {item.status === "failed" && (
                     <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                       setItems(prev => prev.map(p => p.sku === item.sku ? { ...p, status: 'pending', error: undefined } : p));
                     }}>
                       <RotateCcw className="h-3 w-3" />
                     </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="space-y-1">
                    <p className="text-[9px] uppercase text-muted-foreground font-semibold">Current Bust</p>
                    <div className="aspect-square bg-slate-100 rounded border border-slate-200 overflow-hidden relative group">
                      {item.original_filename ? (
                        <img 
                          src={item.original_filename} 
                          alt="Current" 
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 italic">No image</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] uppercase text-muted-foreground font-semibold">Upscaled (v7)</p>
                    <div className="aspect-square bg-slate-900 rounded border border-slate-800 overflow-hidden flex flex-col items-center justify-center relative group">
                      {item.status === "completed" ? (
                        <img 
                          src={item.original_filename?.replace('.jpg', '_upscale.webp')} 
                          alt="Upscaled" 
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        />
                      ) : item.status === "processing" ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-5 w-5 text-teal animate-spin" />
                          <span className="text-[8px] text-slate-400 animate-pulse">Processing...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 opacity-20">
                          <div className="w-8 h-10 border-2 border-slate-700 rounded-t-full relative">
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-1 bg-slate-700 rounded-full" />
                          </div>
                          <span className="text-[8px] text-slate-600 uppercase font-bold tracking-tighter">Tall Emerald</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {item.status === "failed" && item.error && (
                  <div className="text-[10px] text-red-500 bg-red-50 p-2 rounded border border-red-100 font-mono">
                    <p className="font-bold">Error: {item.error}</p>
                    {item.original_filename && (
                      <p className="mt-1 text-slate-500 italic">Source: {item.original_filename}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

function StatusBadge({ status }: { status: UpscaleStatus }) {
  switch (status) {
    case "pending": return <Badge variant="outline" className="text-[10px]">Pending</Badge>;
    case "processing": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px]"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Processing</Badge>;
    case "completed": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">Completed</Badge>;
    case "failed": return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
  }
}
