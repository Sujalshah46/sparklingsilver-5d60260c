import { pageTitle } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/orders/")({
  head: () => ({ meta: [{ title: pageTitle("Admin — Orders") }] }),
});
