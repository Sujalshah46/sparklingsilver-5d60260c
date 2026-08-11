import { pageTitle } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: pageTitle("Admin — Users") }] }),
});
