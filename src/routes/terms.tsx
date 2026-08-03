import { createFileRoute } from "@tanstack/react-router";
import { pageTitle, pageDescription, descriptionTags } from "@/lib/seo";
import { WHATSAPP_NUMBER } from "@/lib/site";

const TITLE = pageTitle("Terms of Use");
const DESC = pageDescription(
  "Terms governing use of the Sparkling Silver wholesale jewellery catalogue, buyer accounts and order placement.",
);

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: TITLE },
      ...descriptionTags(DESC),
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "https://sparklingsilver.in/terms" },
    ],
    links: [{ rel: "canonical", href: "https://sparklingsilver.in/terms" }],
  }),
  component: TermsPage,
});

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-lg font-semibold text-foreground">{heading}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-serif text-3xl font-bold text-foreground">Terms of Use</h1>
      <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
        Last updated 3 August 2026
      </p>

      <Section heading="Who may use this service">
        <p>
          Sparkling Silver is a wholesale catalogue for approved business buyers. Accounts are
          issued by our team; public self-registration is not available. You are responsible for
          keeping your password confidential and for all activity under your account.
        </p>
      </Section>

      <Section heading="Catalogue, weights and pricing">
        <p>
          Product images are representative. Gross weights are stated per piece and may vary
          slightly between handcrafted items. Prices, weights and stock are wholesale figures and
          may be revised before an order is confirmed.
        </p>
      </Section>

      <Section heading="Orders">
        <p>
          Submitting an order is a request, not a binding sale. Orders move through pending,
          accepted, confirmed, production and dispatch stages. Minimum order quantities apply per
          SKU.
        </p>
        <p>
          You may edit quantities or remove SKUs while an order is still pending or accepted. After
          confirmation, changes are at our discretion — for example when stock is short or a piece
          is damaged in production, we may adjust quantity or gross weight and the change will be
          reflected in your account.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>
          Do not scrape, resell or republish catalogue images and data, attempt to access other
          buyers' accounts, or interfere with the service's security or availability.
        </p>
      </Section>

      <Section heading="Intellectual property">
        <p>
          All product photography, designs and branding remain the property of Sparkling Silver and
          may not be used without written permission.
        </p>
      </Section>

      <Section heading="Liability">
        <p>
          The service is provided on an "as is" basis. To the extent permitted by law, our liability
          for any claim is limited to the value of the order concerned.
        </p>
      </Section>

      <Section heading="Governing law and contact">
        <p>
          These terms are governed by the laws of India, with jurisdiction in West Bengal. Questions:
          arikafactory@gmail.com or {WHATSAPP_NUMBER}.
        </p>
      </Section>
    </main>
  );
}
