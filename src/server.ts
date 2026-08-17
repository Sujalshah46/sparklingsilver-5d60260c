import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { addSecurityHeaders, sanitizeErrorMessage } from "./lib/security";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const err = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(err);

  // Log SSR swallowed error to database
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_activity_log").insert({
      action: "server_ssr_swallowed_error",
      meta: {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
    });
  } catch (logErr) {
    console.error("Failed to write SSR error to DB:", logErr);
  }

  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      let response = await handler.fetch(request, env, ctx);
      response = await normalizeCatastrophicSsrResponse(response);
      return addSecurityHeaders(response);
    } catch (error) {
      console.error(error, sanitizeErrorMessage(error));

      // Log server crash exception to database
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("user_activity_log").insert({
          action: "server_crash_error",
          meta: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            url: request.url,
          },
        });
      } catch (logErr) {
        console.error("Failed to write crash error to DB:", logErr);
      }

      return addSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
