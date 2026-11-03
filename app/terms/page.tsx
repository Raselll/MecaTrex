import Image from "next/image";
import Link from "next/link";
import { MECATREX_LEGAL_LAST_UPDATED } from "@/lib/legal";

const sections = [
  {
    title: "1. Using MECATREX",
    body: "MECATREX is a marketplace that helps vehicle owners discover and connect with independent garages, towing companies, and other automotive service providers. By creating an account, submitting a provider application, or using MECATREX, you agree to these Terms of Service.",
  },
  {
    title: "2. MECATREX is a marketplace",
    body: "Unless a service is expressly identified as being provided directly by MECATREX, automotive repairs, maintenance, towing, inspections, estimates, and related services are performed by independent service providers. MECATREX is not the mechanic, repair shop, towing operator, manufacturer, or insurer. Providers remain responsible for their work, licences, permits, personnel, pricing, taxes, warranties, and compliance with applicable law.",
  },
  {
    title: "3. Accounts and accurate information",
    body: "You must provide accurate, current information and keep your account credentials secure. You are responsible for activity performed through your account. A client account is for obtaining services. A service-provider account is for operating a garage or towing business on MECATREX. Provider accounts may be reviewed before their listing is published.",
  },
  {
    title: "4. Provider listings, services and prices",
    body: "Providers are responsible for keeping their business information, contact details, service descriptions, prices, images, and availability accurate. A displayed price may be a fixed price, a starting price, an hourly price, or a request-for-quote price as clearly labelled. Additional work should not be performed or charged without the customer authorization required by applicable law or the provider's agreement with the customer.",
  },
  {
    title: "5. Bookings and availability",
    body: "MECATREX may let clients request ASAP service or choose a future date and time. A displayed opening or availability is not a guarantee until a booking is accepted or confirmed through the platform. Providers must manage their availability responsibly. MECATREX may introduce cancellation, no-show, late-arrival, refusal, and rescheduling rules as the booking system evolves; any applicable rule will be presented before it applies to a transaction.",
  },
  {
    title: "6. Estimates, repairs and vehicle condition",
    body: "Automotive problems can require diagnosis before a final scope or price is known. Information shown on MECATREX is not a mechanical diagnosis and does not replace an inspection by a qualified professional. Clients are responsible for providing truthful information about their vehicle and symptoms. Providers are responsible for explaining material changes to the scope or price of work.",
  },
  {
    title: "7. Towing and urgent situations",
    body: "MECATREX is not an emergency service. If there is an immediate risk to life, safety, or property, contact the appropriate emergency service. Towing providers are responsible for safe operation, insurance, licensing, vehicle handling, and compliance with applicable transportation rules.",
  },
  {
    title: "8. Payments, fees and promotions",
    body: "If MECATREX introduces in-platform payments, platform fees, deposits, refunds, discounts, or promotional deals, the applicable amounts and conditions will be shown before the customer confirms the transaction. Providers remain responsible for taxes and business obligations that apply to their services unless MECATREX expressly states otherwise.",
  },
  {
    title: "9. Acceptable use",
    body: "You may not use MECATREX for fraud, unlawful activity, harassment, misleading listings, fake reviews, scraping or automated abuse, interference with platform security, impersonation, or attempts to access another person's account or data. MECATREX may restrict or suspend accounts when reasonably necessary to protect users, providers, the platform, or comply with law.",
  },
  {
    title: "10. Reviews and user content",
    body: "If MECATREX allows reviews, photos, descriptions, or other user content, you remain responsible for what you submit. Content must be truthful, lawful, and must not violate another person's rights. You grant MECATREX the limited rights needed to host, display, format, and distribute that content as part of operating and promoting the platform.",
  },
  {
    title: "11. Platform availability",
    body: "We aim to keep MECATREX reliable, but we do not promise uninterrupted or error-free access. Features may change as the service develops. We may perform maintenance, correct errors, improve security, or remove functionality that is unsafe, unlawful, or no longer supported.",
  },
  {
    title: "12. Liability",
    body: "To the extent permitted by applicable law, MECATREX is not responsible for losses caused by an independent provider's workmanship, inaccurate provider information, vehicle defects, road conditions, or conduct outside MECATREX's reasonable control. Nothing in these Terms excludes rights or remedies that cannot legally be excluded, including mandatory consumer-protection rights.",
  },
  {
    title: "13. Privacy",
    body: "Our Privacy Policy explains how MECATREX collects, uses, shares, stores, and protects personal information. The Privacy Policy forms part of the rules governing your use of MECATREX.",
  },
  {
    title: "14. Changes and governing law",
    body: "We may update these Terms as MECATREX evolves. Material changes will be communicated when reasonably required. These Terms are governed by the laws applicable in Quebec and Canada, without limiting mandatory consumer rights that apply to you. Disputes should first be raised with MECATREX so the parties can try to resolve them in good faith.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F5F7FA] px-5 py-10 text-[#101828]">
      <div className="mx-auto max-w-[920px]">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center">
            <Image src="/mecatrex-logo-web.png" alt="MECATREX" width={280} height={78} priority className="h-[58px] w-auto" />
          </Link>
          <Link href="/signup" className="rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-[14px] font-bold text-[#344054] hover:bg-[#F9FAFB]">
            Back to sign up
          </Link>
        </div>

        <article className="mt-8 rounded-[30px] border border-[#EAECF0] bg-white p-7 shadow-[0_18px_60px_rgba(16,24,40,0.08)] sm:p-10">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">Legal</p>
          <h1 className="mt-3 text-[40px] font-bold tracking-[-0.04em] sm:text-[50px]">Terms of Service</h1>
          <p className="mt-3 text-[14px] font-medium text-[#667085]">Last updated {MECATREX_LEGAL_LAST_UPDATED}</p>
          <p className="mt-6 text-[17px] leading-8 text-[#475467]">
            These Terms explain the rules for using MECATREX as a vehicle owner or service provider. We have written them in plain language so the important points are easy to understand.
          </p>

          <div className="mt-10 space-y-9">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-[22px] font-bold tracking-[-0.02em]">{section.title}</h2>
                <p className="mt-3 text-[16px] leading-7 text-[#475467]">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-[18px] bg-[#EDF3FA] p-5 text-[14px] leading-6 text-[#475467]">
            Questions about these Terms can be sent through the MECATREX support/contact channel made available on the platform.
          </div>
        </article>
      </div>
    </main>
  );
}
