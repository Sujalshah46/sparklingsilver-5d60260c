import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, ImageIcon } from "lucide-react";
import { categoryPlaceholder, resolveProductImage } from "@/lib/product-images";
import { setCategoryImage, clearCategoryImage } from "@/lib/categories.functions";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Admin — Category Images" }] }),
  component: AdminCategories,
});

type Cat = { id: string; slug: string; name: string; image_url: string | null };

function AdminCategories() {
  const qc = useQueryClient();
  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, image_url")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Cat[];
    },
  });

  return (
    <MobileShell title="Category Images">
      <div className="p-4 space-y-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Category Images</h1>
          <p className="text-xs text-muted-foreground">
            Upload a photo for each category. Shown on the home page collection grid.
          </p>
        </div>

        <ul className="space-y-2">
          {(categories ?? []).map((c) => (
            <CategoryRow
              key={c.id}
              cat={c}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["admin-categories"] });
                qc.invalidateQueries({ queryKey: ["home"] });
              }}
            />
          ))}
        </ul>
      </div>
    </MobileShell>
  );
}

function CategoryRow({ cat, onSaved }: { cat: Cat; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = cat.image_url ?? resolveProductImage(`cat-${cat.slug}-a.jpg`);
  const setImageFn = useServerFn(setCategoryImage);
  const clearImageFn = useServerFn(clearCategoryImage);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${cat.slug}/${Date.now()}.${ext}`;
      // Upload still happens client-side (gated by storage RLS), but the
      // DB write + signed-URL minting is server-verified admin only.
      const up = await supabase.storage
        .from("category-images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;

      await setImageFn({ data: { category_id: cat.id, storage_path: path } });

      toast.success(`${cat.name} image updated`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function clearImage() {
    setBusy(true);
    try {
      await clearImageFn({ data: { category_id: cat.id } });
      toast.success(`${cat.name} reset to default`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
        {preview ? (
          <img src={preview} alt={cat.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{cat.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {cat.image_url ? "Custom image set" : "Using default image"}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <div className="flex flex-col gap-1.5">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-1 h-3.5 w-3.5" />
          {busy ? "Uploading…" : "Upload"}
        </Button>
        {cat.image_url && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={clearImage}>
            Reset
          </Button>
        )}
      </div>
    </li>
  );
}
