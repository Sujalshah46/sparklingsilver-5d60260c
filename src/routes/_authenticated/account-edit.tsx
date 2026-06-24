import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account-edit")({
  head: () => ({ meta: [{ title: "Personal Details — Sparkling Jewellers" }] }),
  component: AccountEdit,
});

function AccountEdit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["profile-edit", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    full_name: data?.full_name ?? "",
    mobile: data?.mobile ?? "",
    city: data?.city ?? "",
    business_type: (data?.business_type as "retailer" | "wholesaler" | "individual") ?? "individual",
    business_name: data?.business_name ?? "",
    gstin: data?.gstin ?? "",
  });

  // Sync state when data loads
  if (data && !form.full_name && data.full_name) {
    setForm({
      full_name: data.full_name ?? "",
      mobile: data.mobile ?? "",
      city: data.city ?? "",
      business_type: (data.business_type as "retailer" | "wholesaler" | "individual") ?? "individual",
      business_name: data.business_name ?? "",
      gstin: data.gstin ?? "",
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["profile"] }); },
  });

  return (
    <MobileShell title="Personal Details">
      <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="Full Name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={100} /></Field>
        <Field label="Mobile"><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} maxLength={15} /></Field>
        <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={80} /></Field>
        <Field label="Business Type">
          <Select value={form.business_type} onValueChange={(v) => setForm({ ...form, business_type: v as "retailer" | "wholesaler" | "individual" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="retailer">Retailer</SelectItem>
              <SelectItem value="wholesaler">Wholesaler</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Business Name (optional)"><Input value={form.business_name ?? ""} onChange={(e) => setForm({ ...form, business_name: e.target.value })} maxLength={150} /></Field>
        <Field label="GSTIN (optional)"><Input value={form.gstin ?? ""} onChange={(e) => setForm({ ...form, gstin: e.target.value })} maxLength={15} /></Field>
        <Button type="submit" className="w-full bg-burgundy hover:bg-burgundy/90" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </form>
    </MobileShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-sm font-semibold">{label}</Label>{children}</div>;
}
