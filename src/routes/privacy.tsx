import { createFileRoute } from "@tanstack/react-router";
import { pageTitle, pageDescription, descriptionTags } from "@/lib/seo";
import { WHATSAPP_NUMBER } from "@/lib/site";

const TITLE = pageTitle("Privacy Policy");
const DESC = pageDescription(
  "How Sparkling Silver collects, uses, stores and deletes buyer account data across our website and mobile apps.",
);

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      ...descriptionTags(DESC),
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "https://sparklingsilver.in/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://sparklingsilver.in/privacy" }],
  }),
  component: PrivacyPage,
});

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-lg font-semibold text-foreground">{heading}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-serif text-3xl font-bold text-foreground">Privacy Policy</h1>
      <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
        Last updated 3 August 2026
      </p>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Sparkling Silver ("we", "us") operates a wholesale jewellery catalogue for approved
        business buyers, available on this website and as our Android and iOS applications. This
        policy explains what we collect, why, and how you can have it removed.
      </p>

      <Section heading="Information we collect">
        <p>
          <strong>Account information</strong> — business name, contact person, email address and
          mobile number. Buyer accounts are created by our team; we do not accept public
          self-registration.
        </p>
        <p>
          <strong>Order information</strong> — the SKUs, quantities, weights, delivery addresses,
          GSTIN and any per-item remarks you submit with an order.
        </p>
        <p>
          <strong>Technical information</strong> — sign-in session tokens stored on your own
          device, and standard server logs (IP address, timestamp, error traces) used to keep the
          service secure and working.
        </p>
        <p>We do not collect location, contacts, photos, microphone or advertising identifiers.</p>
      </Section>

      <Section heading="How we use it">
        <p>
          To authenticate you, show wholesale catalogue pricing, process and fulfil your orders,
          share dispatch and tracking updates, send order notifications you have opted into, and
          meet our tax and accounting obligations.
        </p>
        <p>We never sell your data and we do not use it for third-party advertising.</p>
      </Section>

      <Section heading="Camera use">
        <p>
          The camera is used only inside our admin catalogue tools to scan product barcodes and QR
          codes. Scans are processed on the device; no images are uploaded or stored.
        </p>
      </Section>

      <Section heading="Service providers">
        <p>
          Our database, authentication, file storage and push notification delivery are hosted on
          managed cloud infrastructure. Order confirmations may be relayed to our team over
          WhatsApp at your request. These providers process data solely on our instructions.
        </p>
      </Section>

      <Section heading="Data retention">
        <p>
          Account and order records are retained while your account is active, and afterwards only
          as long as required for statutory tax and audit purposes. Session tokens are removed from
          your device when you sign out.
        </p>
      </Section>

      <Section heading="Account and data deletion">
        <p>
          You can request deletion of your buyer account and its associated personal data at any
          time. Email <strong>arikafactory@gmail.com</strong> or message us on WhatsApp at{" "}
          <strong>{WHATSAPP_NUMBER}</strong> from your registered contact, with the subject
          "Delete my account".
        </p>
        <p>
          We verify the request and delete the account within 30 days. Your profile, addresses,
          cart, wishlist and saved contact details are removed. Completed invoices and order records
          are retained in anonymised form only where Indian tax law requires it.
        </p>
      </Section>

      <Section heading="Security">
        <p>
          Access is protected by password authentication and row-level database policies, so each
          buyer can only reach their own account, cart and orders. Traffic is encrypted in transit.
        </p>
      </Section>

      <Section heading="Children">
        <p>
          This is a business-to-business service and is not directed at anyone under 18. We do not
          knowingly collect data from children.
        </p>
      </Section>

      <Section heading="Changes and contact">
        <p>
          If this policy changes we will update the date above. For any privacy question, contact
          Sparkling Silver, Singur, Hooghly, West Bengal 712409, India — arikafactory@gmail.com,{" "}
          {WHATSAPP_NUMBER}.
        </p>
      </Section>
    </main>
  );
}
