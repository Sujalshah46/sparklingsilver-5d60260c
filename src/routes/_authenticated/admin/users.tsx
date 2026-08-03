import { pageTitle } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListUsers,
  adminListResetRequests,
  adminCreateUser,
  adminResetPassword,
  adminSetPassword,
  adminSetUserStatus,
  adminSendCredentials,
  adminResolveResetRequest,
  adminDeleteUser,
} from "@/lib/users.functions";

import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { UserPlus, Copy, KeyRound, Power, Send, RefreshCw, Mail, CheckCircle2, MessageCircle, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { openWhatsAppUrl } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: pageTitle("Admin — Users") }] }),
  component: AdminUsersPage,
});

type UserRow = {
  id: string; username: string | null; business_name: string | null; contact_person: string | null;
  email: string | null; mobile: string | null; status: string; must_change_password: boolean; created_at: string;
  is_admin?: boolean;
};

function AdminUsersPage() {
  const qc = useQueryClient();
  const listUsers = useServerFn(adminListUsers);
  const listReqs = useServerFn(adminListResetRequests);

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => listUsers() });
  const reqs = useQuery({ queryKey: ["admin-reset-requests"], queryFn: () => listReqs() });

  const [showCreate, setShowCreate] = useState(false);
  const [credsView, setCredsView] = useState<{ username: string; email: string; password: string; user_id: string } | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-reset-requests"] });
  };

  return (
    <MobileShell title="Users">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-serif text-2xl font-semibold">Users</h1>
            <p className="text-xs text-muted-foreground">Admin-created buyer accounts</p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}><UserPlus className="mr-1 h-4 w-4" /> New</Button>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">All Users</TabsTrigger>
            <TabsTrigger value="requests">
              Reset Requests
              {(reqs.data ?? []).filter((r: any) => r.status === "pending").length > 0 && (
                <span className="ml-1 rounded-full bg-burgundy px-1.5 text-[10px] font-semibold text-white">
                  {(reqs.data ?? []).filter((r: any) => r.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-2">
            {users.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
            {(users.data ?? []).map((u: UserRow) => (
              <UserCard key={u.id} u={u} onDone={invalidate} onShowCreds={setCredsView} />
            ))}
            {users.data && users.data.length === 0 && (
              <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">No users yet. Tap New to create one.</p>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-2">
            {reqs.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
            {(reqs.data ?? []).map((r: any) => (
              <ResetRequestCard key={r.id} r={r} onDone={invalidate} onShowCreds={setCredsView} />
            ))}
            {reqs.data && reqs.data.length === 0 && (
              <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">No requests.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateUserDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(c) => { setCredsView(c); invalidate(); }}
      />
      <CredentialsDialog creds={credsView} onOpenChange={(o) => !o && setCredsView(null)} />
    </MobileShell>
  );
}

function UserCard({ u, onDone, onShowCreds }: { u: UserRow; onDone: () => void; onShowCreds: (c: { username: string; email: string; password: string; user_id: string }) => void }) {
  const reset = useServerFn(adminResetPassword);
  const setPassword = useServerFn(adminSetPassword);
  const setStatus = useServerFn(adminSetUserStatus);
  const del = useServerFn(adminDeleteUser);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwValue, setPwValue] = useState("");

  const onSetPassword = async () => {
    setBusy(true);
    try {
      await setPassword({ data: { user_id: u.id, password: pwValue, force_change: false } });
      toast.success("Password set");
      setPwOpen(false);
      setPwValue("");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const onReset = async () => {

    setBusy(true);
    try {
      const r = await reset({ data: { user_id: u.id } });
      onShowCreds({ user_id: u.id, username: u.username ?? "", email: u.email ?? "", password: r.password });
      toast.success("New password generated");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };
  const onToggle = async () => {
    setBusy(true);
    try {
      const next = u.status === "active" ? "inactive" : "active";
      await setStatus({ data: { user_id: u.id, status: next } });
      toast.success(next === "active" ? "Reactivated" : "Deactivated");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };
  const onDelete = async () => {
    setBusy(true);
    try {
      await del({ data: { user_id: u.id } });
      toast.success("User deleted");
      setConfirmDelete(false);
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-serif text-sm font-semibold">{u.business_name ?? u.contact_person ?? u.email}</p>
            {u.is_admin && (
              <Badge className="shrink-0 gap-0.5 bg-burgundy px-1.5 py-0 text-[10px] font-semibold text-white">
                <ShieldCheck className="h-3 w-3" /> Admin
              </Badge>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">@{u.username ?? "—"} · {u.email}</p>
          <p className="text-[11px] text-muted-foreground">Created {formatDate(u.created_at)}</p>
        </div>
        <Badge className={u.status === "active" ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}>
          {u.status}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={onReset}><KeyRound className="mr-1 h-3.5 w-3.5" /> Reset password</Button>
        {!u.is_admin && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setPwOpen(true)}>
            <KeyRound className="mr-1 h-3.5 w-3.5" /> Set password
          </Button>
        )}

        <Button size="sm" variant="outline" disabled={busy} onClick={onToggle}>
          <Power className="mr-1 h-3.5 w-3.5" /> {u.status === "active" ? "Deactivate" : "Reactivate"}
        </Button>
        {u.status !== "active" && !u.is_admin && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        )}
      </div>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this user?</DialogTitle>
            <DialogDescription>
              The account will be hidden from the admin panel. Data remains in the database and can be restored by support if needed. This action is logged.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{u.business_name ?? u.contact_person ?? u.email}</p>
            <p className="text-[11px] text-muted-foreground">@{u.username ?? "—"} · {u.email}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</Button>
            <Button
              onClick={onDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Yes, delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResetRequestCard({ r, onDone, onShowCreds }: { r: any; onDone: () => void; onShowCreds: (c: { username: string; email: string; password: string; user_id: string }) => void }) {
  const reset = useServerFn(adminResetPassword);
  const resolve = useServerFn(adminResolveResetRequest);
  const [busy, setBusy] = useState(false);

  const onResetAndResolve = async () => {
    if (!r.user_id) return toast.error("No linked user for this email");
    setBusy(true);
    try {
      const p = await reset({ data: { user_id: r.user_id } });
      await resolve({ data: { request_id: r.id } });
      onShowCreds({ user_id: r.user_id, username: "", email: r.email, password: p.password });
      toast.success("Reset & resolved");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{r.email}</p>
          <p className="text-[11px] text-muted-foreground">{formatDate(r.created_at)}</p>
          {r.note && <p className="mt-1 text-[11px] text-muted-foreground">"{r.note}"</p>}
        </div>
        <Badge className={r.status === "pending" ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900"}>
          {r.status}
        </Badge>
      </div>
      {r.status === "pending" && (
        <div className="mt-2">
          <Button size="sm" disabled={busy} onClick={onResetAndResolve}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Reset & Send
          </Button>
        </div>
      )}
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (b: boolean) => void; onCreated: (c: { username: string; email: string; password: string; user_id: string }) => void }) {
  const create = useServerFn(adminCreateUser);
  const [form, setForm] = useState({ business_name: "", contact_person: "", email: "", mobile: "", note: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await create({ data: {
        business_name: form.business_name, contact_person: form.contact_person, email: form.email,
        mobile: form.mobile || undefined, note: form.note || undefined,
      } });
      onOpenChange(false);
      setForm({ business_name: "", contact_person: "", email: "", mobile: "", note: "" });
      onCreated({ user_id: r.user_id, username: r.username, email: r.email, password: r.password });
      toast.success("User created");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create buyer account</DialogTitle>
          <DialogDescription>System generates a unique username and strong password.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Business name" value={form.business_name} onChange={(v) => setForm({ ...form, business_name: v })} required />
          <Field label="Contact person" value={form.contact_person} onChange={(v) => setForm({ ...form, contact_person: v })} required />
          <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
          <Field label="Phone" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} />
          <Field label="Note (optional)" value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create user"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

function buildWaMessage(opts: { greetName: string; username: string; email: string; password: string }) {
  return [
    opts.greetName ? `Hello ${opts.greetName},` : "Hello,",
    "",
    "Your Sparkling Silver account credentials:",
    opts.username ? `Username: ${opts.username}` : null,
    `Email: ${opts.email}`,
    `Password: ${opts.password}`,
    "",
    "Please log in and change your password after first sign-in.",
  ].filter(Boolean).join("\n");
}

function formatPhoneDisplay(phone: string) {
  // phone is digits only, e.g. 919330615237
  if (phone.length === 12 && phone.startsWith("91")) {
    return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`;
  }
  return `+${phone}`;
}

function CredentialsDialog({ creds, onOpenChange }: { creds: { username: string; email: string; password: string; user_id: string } | null; onOpenChange: (b: boolean) => void }) {
  const send = useServerFn(adminSendCredentials);
  const [sending, setSending] = useState(false);
  const [waSending, setWaSending] = useState(false);
  const [confirmChannel, setConfirmChannel] = useState<null | "email" | "whatsapp">(null);
  const [waPreview, setWaPreview] = useState<{ phone: string; message: string; greetName: string } | null>(null);
  const [waPreviewError, setWaPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  if (!creds) return null;

  const copy = (v: string, label: string) => {
    navigator.clipboard.writeText(v);
    toast.success(`${label} copied`);
  };

  const logAudit = async (channel: "email" | "whatsapp", ok: boolean, extra?: Record<string, unknown>) => {
    const { data: u } = await supabase.auth.getUser();
    const actor = u.user?.id;
    if (!actor) return;
    await supabase.from("user_activity_log").insert({
      user_id: creds.user_id,
      actor_id: actor,
      action: ok ? `credentials_sent_${channel}` : `credentials_send_failed_${channel}`,
      meta: { channel, email: creds.email, username: creds.username || null, ...(extra ?? {}) },
    });
  };

  const openWhatsAppConfirm = async () => {
    setConfirmChannel("whatsapp");
    setWaPreview(null);
    setWaPreviewError(null);
    setLoadingPreview(true);
    try {
      const { data: p, error } = await supabase
        .from("profiles")
        .select("mobile, business_name, contact_person")
        .eq("id", creds.user_id)
        .maybeSingle();
      if (error) throw error;
      const raw = (p?.mobile ?? "").replace(/\D/g, "");
      if (!raw) {
        setWaPreviewError("This user has no mobile number in their profile.");
        return;
      }
      const phone = raw.length === 10 ? `91${raw}` : raw;
      const greetName = (p?.contact_person || p?.business_name || "").trim();
      const message = buildWaMessage({
        greetName,
        username: creds.username,
        email: creds.email,
        password: creds.password,
      });
      setWaPreview({ phone, message, greetName });
    } catch (e) {
      setWaPreviewError(e instanceof Error ? e.message : "Failed to load recipient");
    } finally {
      setLoadingPreview(false);
    }
  };

  const onSend = async () => {
    setSending(true);
    try {
      const r = await send({ data: { user_id: creds.user_id, password: creds.password } });
      if (r.skipped) { toast.warning("Email connector not configured — share manually"); await logAudit("email", false, { reason: "connector_not_configured" }); }
      else if (r.ok) { toast.success("Credentials emailed"); await logAudit("email", true); }
      else { toast.error(r.error ?? "Send failed"); await logAudit("email", false, { error: r.error ?? null }); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      await logAudit("email", false, { error: e instanceof Error ? e.message : String(e) });
    }
    finally { setSending(false); }
  };

  const onSendWhatsApp = async () => {
    if (!waPreview) return;
    setWaSending(true);
    try {
      const url = `https://wa.me/${waPreview.phone}?text=${encodeURIComponent(waPreview.message)}`;
      openWhatsAppUrl(url);
      await logAudit("whatsapp", true, { phone_last4: waPreview.phone.slice(-4) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      await logAudit("whatsapp", false, { error: e instanceof Error ? e.message : String(e) });
    } finally {
      setWaSending(false);
    }
  };

  const closeConfirm = () => {
    setConfirmChannel(null);
    setWaPreview(null);
    setWaPreviewError(null);
  };

  const confirmSend = async () => {
    const channel = confirmChannel;
    closeConfirm();
    if (channel === "email") await onSend();
    else if (channel === "whatsapp") await onSendWhatsApp();
  };

  const canConfirm =
    confirmChannel === "email" ||
    (confirmChannel === "whatsapp" && !!waPreview && !loadingPreview);

  return (
    <Dialog open={!!creds} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-700" /> Credentials ready</DialogTitle>
          <DialogDescription>Copy these now or send them to the user. They can't be retrieved later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
          {creds.username && (
            <Row label="Username" value={creds.username} onCopy={() => copy(creds.username, "Username")} />
          )}
          <Row label="Email" value={creds.email} onCopy={() => copy(creds.email, "Email")} />
          <Row label="Password" value={creds.password} onCopy={() => copy(creds.password, "Password")} mono />
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:gap-2">
          <Button onClick={() => setConfirmChannel("email")} disabled={sending || waSending} className="w-full">
            <Send className="mr-1 h-4 w-4" /> {sending ? "Sending…" : "Send credentials (Email)"}
          </Button>
          <Button
            onClick={openWhatsAppConfirm}
            disabled={sending || waSending}
            className="w-full bg-green-600 text-white hover:bg-green-700"
          >
            <MessageCircle className="mr-1 h-4 w-4" /> {waSending ? "Opening…" : "Send credentials (WhatsApp)"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">Close</Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={confirmChannel !== null} onOpenChange={(o) => !o && closeConfirm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmChannel === "whatsapp" ? "Send credentials via WhatsApp?" : "Send credentials via Email?"}
            </DialogTitle>
            <DialogDescription>
              {confirmChannel === "whatsapp"
                ? "Review the recipient and message below. The action will be logged in the audit trail."
                : `This will email the username and password to ${creds.email}. The action will be logged in the audit trail.`}
            </DialogDescription>
          </DialogHeader>

          {confirmChannel === "whatsapp" && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Recipient</p>
                {loadingPreview && <p className="text-muted-foreground">Loading…</p>}
                {waPreviewError && <p className="text-destructive">{waPreviewError}</p>}
                {waPreview && (
                  <>
                    <p className="font-mono">{formatPhoneDisplay(waPreview.phone)}</p>
                    {waPreview.greetName && (
                      <p className="text-[11px] text-muted-foreground">{waPreview.greetName}</p>
                    )}
                  </>
                )}
              </div>
              {waPreview && (
                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Message preview</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copy(waPreview.message, "WhatsApp message")}
                      className="h-7 gap-1 text-xs"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy message
                    </Button>
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">
                    {waPreview.message}
                  </pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeConfirm}>Cancel</Button>
            <Button
              onClick={confirmSend}
              disabled={!canConfirm}
              className={confirmChannel === "whatsapp" ? "bg-green-600 text-white hover:bg-green-700" : ""}
            >
              Yes, send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}



function Row({ label, value, onCopy, mono = false }: { label: string; value: string; onCopy: () => void; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`truncate ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
      <Button size="icon" variant="ghost" onClick={onCopy}><Copy className="h-4 w-4" /></Button>
    </div>
  );
}
