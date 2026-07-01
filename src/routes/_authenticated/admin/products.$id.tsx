import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createProduct, updateProduct } from "@/lib/products.functions";
import { getErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/admin/products/$id")({
  head: () => ({ meta: [{ title: "Admin — Product" }] }),
  component: ProductForm,
});

const METALS = ["silver"] as const;

function ProductForm() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const nav = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createProduct);
  const update = useServerFn(updateProduct);
  const [saving, setSaving] = useState(false);

  const { data: cats } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: product } = useQuery({
    queryKey: ["admin-product-edit", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: subs } = useQuery({
    queryKey: ["admin-subcategories-list"],
    queryFn: async () => {
      const { data } = await supabase.from("subcategories").select("id, name").order("sort_order");
      return data ?? [];
    },
  });

  const [form, setForm] = useState<any>({
    name: "", slug: "", sku: "", description: "",
    category_id: "", subcategory_id: "", metal: "silver", purity: "925",
    gross_weight: 0, net_weight: 0, stone_weight: 0, stone_type: "",
    price: 0, making_charge_pct: 0, moq: 1,
    image_url: "", stock_quantity: 0, low_stock_threshold: 5,
    is_new: false, is_bestseller: false, is_trending: false,
  });

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name ?? "",
        slug: product.slug ?? "",
        sku: product.sku ?? "",
        description: product.description ?? "",
        category_id: product.category_id ?? "",
        metal: product.metal ?? "silver",
        purity: product.purity ?? "925",
        gross_weight: Number(product.gross_weight ?? 0),
        net_weight: Number(product.net_weight ?? 0),
        stone_weight: Number(product.stone_weight ?? 0),
        stone_type: product.stone_type ?? "",
        price: Number(product.price ?? 0),
        making_charge_pct: Number(product.making_charge_pct ?? 0),
        moq: product.moq ?? 1,
        image_url: product.image_url ?? "",
        stock_quantity: product.stock_quantity ?? 0,
        low_stock_threshold: product.low_stock_threshold ?? 5,
        is_new: !!product.is_new,
        is_bestseller: !!product.is_bestseller,
        is_trending: !!product.is_trending,
      });
    }
  }, [product]);

  function up(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        category_id: form.category_id || null,
        gross_weight: Number(form.gross_weight),
        net_weight: Number(form.net_weight),
        stone_weight: form.stone_weight ? Number(form.stone_weight) : null,
        stone_type: form.stone_type || null,
        price: Number(form.price),
        making_charge_pct: form.making_charge_pct ? Number(form.making_charge_pct) : null,
        moq: form.moq ? Number(form.moq) : null,
        description: form.description || null,
        stock_quantity: Number(form.stock_quantity),
        low_stock_threshold: Number(form.low_stock_threshold),
      };
      if (isNew) {
        await create({ data: payload });
        toast.success("Product created");
      } else {
        const { stock_quantity, ...patch } = payload; // stock managed in inventory
        await update({ data: { id, patch } });
        toast.success("Product updated");
      }
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      nav({ to: "/admin/products" });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileShell title={isNew ? "New product" : "Edit product"}>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-xl font-semibold">{isNew ? "Add product" : "Edit product"}</h1>
          <Link to="/admin/products" className="text-xs text-muted-foreground hover:text-foreground">← Products</Link>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => up("name", e.target.value)} required /></Field>
          <Field label="Slug (URL)"><Input value={form.slug} onChange={(e) => up("slug", e.target.value)} placeholder="elegant-silver-chain" required /></Field>
          <Field label="SKU"><Input value={form.sku} onChange={(e) => up("sku", e.target.value)} required /></Field>
          <Field label="Image URL"><Input value={form.image_url} onChange={(e) => up("image_url", e.target.value)} required /></Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => up("description", e.target.value)} rows={3} />
          </Field>

          <Field label="Category">
            <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={form.category_id} onChange={(e) => up("category_id", e.target.value)}>
              <option value="">— None —</option>
              {(cats ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Metal">
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.metal} onChange={(e) => up("metal", e.target.value)}>
                {METALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Purity"><Input value={form.purity} onChange={(e) => up("purity", e.target.value)} /></Field>
            <Field label="Gross weight (g)"><Input type="number" step="0.01" value={form.gross_weight} onChange={(e) => up("gross_weight", e.target.value)} /></Field>
            <Field label="Net weight (g)"><Input type="number" step="0.01" value={form.net_weight} onChange={(e) => up("net_weight", e.target.value)} /></Field>
            <Field label="Stone weight (g)"><Input type="number" step="0.01" value={form.stone_weight} onChange={(e) => up("stone_weight", e.target.value)} /></Field>
            <Field label="Stone type"><Input value={form.stone_type} onChange={(e) => up("stone_type", e.target.value)} /></Field>
            <Field label="Price (₹)"><Input type="number" step="1" value={form.price} onChange={(e) => up("price", e.target.value)} required /></Field>
            <Field label="Making %"><Input type="number" step="0.1" value={form.making_charge_pct} onChange={(e) => up("making_charge_pct", e.target.value)} /></Field>
            <Field label="MOQ"><Input type="number" step="1" value={form.moq} onChange={(e) => up("moq", e.target.value)} /></Field>
            <Field label="Low-stock threshold"><Input type="number" step="1" value={form.low_stock_threshold} onChange={(e) => up("low_stock_threshold", e.target.value)} /></Field>
            {isNew && (
              <Field label="Initial stock"><Input type="number" step="1" value={form.stock_quantity} onChange={(e) => up("stock_quantity", e.target.value)} /></Field>
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Toggle label="New arrival" checked={form.is_new} onChange={(v) => up("is_new", v)} />
            <Toggle label="Bestseller" checked={form.is_bestseller} onChange={(v) => up("is_bestseller", v)} />
            <Toggle label="Trending" checked={form.is_trending} onChange={(v) => up("is_trending", v)} />
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : isNew ? "Create product" : "Save changes"}
          </Button>
          {!isNew && (
            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              Stock is managed in <Link to="/admin/inventory/$id" params={{ id }} className="text-burgundy underline">Inventory</Link>.
            </p>
          )}
        </form>
      </div>
    </MobileShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
