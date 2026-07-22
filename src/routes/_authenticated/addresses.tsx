import { pageTitle } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/addresses")({
  head: () => ({ meta: [{ title: "My Addresses — Sparkling Silver" }] }),
  component: AddressesPage,
});

function AddressesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ recipient_name: "", mobile: "", line1: "", line2: "", city: "", state: "", pincode: "" });

  const { data } = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("addresses").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("addresses").insert({ ...form, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Address added"); setOpen(false); setForm({ recipient_name: "", mobile: "", line1: "", line2: "", city: "", state: "", pincode: "" }); qc.invalidateQueries({ queryKey: ["addresses"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("addresses").delete().eq("id", id); },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["addresses"] }); },
  });

  return (
    <MobileShell title="My Addresses">
      <div className="space-y-3 p-4">
        {data?.map((a) => (
          <div key={a.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{a.recipient_name} · {a.mobile}</p>
              <p className="text-xs text-muted-foreground">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}</p>
            </div>
            <button onClick={() => del.mutate(a.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {data?.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No addresses yet.</p>}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Address</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif">New Address</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Recipient name" value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} maxLength={100} />
              <Input placeholder="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} maxLength={15} />
              <Input placeholder="Address line 1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} maxLength={200} />
              <Input placeholder="Address line 2 (optional)" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} maxLength={200} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <Input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <Input placeholder="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} maxLength={10} />
              <Button className="w-full bg-burgundy hover:bg-burgundy/90" onClick={() => add.mutate()} disabled={add.isPending}>Save Address</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MobileShell>
  );
}
