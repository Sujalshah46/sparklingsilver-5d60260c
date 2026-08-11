import { pageTitle } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/scan")({
  head: () => ({ meta: [{ title: pageTitle("Admin — Scan Inventory") }] }),
});
