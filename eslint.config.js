import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Guard: WhatsApp deep-link helpers must never be reachable from admin
    // status-update code paths. WhatsApp is a one-time, user-initiated CTA
    // on the Order Placed screen only — never a per-stage notification.
    files: [
      "src/lib/admin.functions.ts",
      "src/lib/admin.server.ts",
      "src/lib/push.server.ts",
      "src/lib/push.functions.ts",
      "src/routes/_authenticated/admin/**/*.{ts,tsx}",
      "src/routes/api/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/site",
              importNames: ["whatsappUrl", "WHATSAPP_NUMBER", "WHATSAPP_DEFAULT_MESSAGE"],
              message:
                "WhatsApp deep-link helpers must not be used from admin status-update paths. WhatsApp is a one-time, user-initiated CTA on the Order Placed screen only.",
            },
          ],
          patterns: [
            {
              group: ["**/site", "**/whatsapp*"],
              importNames: ["whatsappUrl", "WHATSAPP_NUMBER", "WHATSAPP_DEFAULT_MESSAGE"],
              message:
                "WhatsApp helpers are banned from admin/server order paths. Use in-app push (notifyUser) instead.",
            },
          ],
        },
      ],
    },
  },
  eslintPluginPrettier,
);
