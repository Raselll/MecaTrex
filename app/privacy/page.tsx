import Image from "next/image";
import Link from "next/link";
import { MECATREX_LEGAL_LAST_UPDATED } from "@/lib/legal";

const sections = [
  {
    title: "1. What this policy covers",
    body: "This Privacy Policy explains how MECATREX handles personal information when vehicle owners, garages, towing companies, administrators, and visitors use the platform. MECATREX is designed for an initial launch in Quebec and intends to handle personal information in accordance with applicable Quebec privacy law and, where applicable, Canadian federal privacy law.",
  },
  {
    title: "2. Information we collect",
    body: "Depending on how you use MECATREX, we may collect your name, email address, phone numbers, account and authentication information, vehicle details, requested automotive services, booking information, communications, and technical information such as device or security logs. For service providers, we also collect business names, addresses, public contact information, location coordinates, service descriptions, prices, photos, application status, and information needed to review and operate the listing.",
  },
  {
    title: "3. Why we use information",
    body: "We use personal information to create and secure accounts; verify email addresses; provide password-reset and authentication services; match clients with garages or towing providers; display provider listings; manage bookings and availability; send transaction and account notifications; review provider applications; provide customer support; prevent fraud and abuse; maintain platform security; improve MECATREX; and comply with legal obligations.",
  },
  {
    title: "4. Information displayed publicly",
    body: "Approved providers can choose to publish business information such as their business name, service descriptions, prices, business image, business address, public phone number, public email address, website, and general location. Personal account information that is not designated as listing information is not intended to be publicly displayed.",
  },
  {
    title: "5. Service providers and technology partners",
    body: "MECATREX relies on technology providers to operate the platform. These may include Supabase for authentication, database and file storage; Brevo for transactional email delivery; Google Places for address search and validation; CarImagesAPI for vehicle visualization; hosting and deployment providers; and future payment providers if payments are introduced. We share only the information reasonably required for those services.",
  },
  {
    title: "6. Processing outside Quebec or Canada",
    body: "Some technology providers may process or store information on infrastructure located outside Quebec or Canada. When that occurs, information may be subject to the laws of the jurisdiction where it is processed. MECATREX should assess service providers and contractual safeguards before production use and when materially changing where information is processed.",
  },
  {
    title: "7. Consent and choices",
    body: "We ask for consent when creating an account and when required for a new use of personal information. You can choose whether to provide optional information, such as a secondary phone number. Providers control whether an approved listing is published. Where consent is the legal basis for a non-essential use, you may withdraw it subject to legal or contractual restrictions and reasonable notice.",
  },
  {
    title: "8. Retention",
    body: "We retain personal information only as long as reasonably necessary for the purposes described in this policy, to provide the service, resolve disputes, maintain security and audit records, enforce agreements, and meet legal obligations. Retention periods may differ by category of information. Information that is no longer required should be securely deleted or anonymized where appropriate.",
  },
  {
    title: "9. Security",
    body: "MECATREX uses technical and organizational safeguards intended to protect personal information, including authenticated sessions, access controls, database row-level security, restricted administrative permissions, encrypted network connections, and controlled storage permissions. No system can guarantee absolute security, so we also monitor and improve safeguards as the platform evolves.",
  },
  {
    title: "10. Access and correction",
    body: "Subject to applicable law, you may request access to personal information MECATREX holds about you and ask for inaccurate or incomplete information to be corrected. You may also ask questions about how information is used or disclosed. Identity verification may be required before fulfilling a request.",
  },
  {
    title: "11. Account deletion and withdrawal",
    body: "You may request closure of your MECATREX account. Certain records may need to be retained where required for legal, security, accounting, fraud-prevention, dispute, or transaction-record purposes. Closing an account does not necessarily require immediate deletion of every record when a lawful retention reason exists.",
  },
  {
    title: "12. Cookies and local device storage",
    body: "MECATREX may use cookies or similar browser storage that are necessary for authentication, security, preferences, and product functionality. For example, vehicle preferences may be saved locally in your browser to make future searches faster. If analytics or advertising technologies are introduced later, MECATREX will assess whether additional notice or consent is required before using them.",
  },
  {
    title: "13. Children",
    body: "MECATREX is intended for people who can legally enter into the transactions offered through the platform. The service is not designed to knowingly collect personal information from children for independent use of automotive-service transactions.",
  },
  {
    title: "14. Changes to this policy",
    body: "We may update this Privacy Policy as MECATREX adds features, providers, payment capabilities, scheduling, or other services. When a change is material, we will provide notice where reasonably required and update the date shown at the top of this page.",
  },
];

export default function PrivacyPage() {
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
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">Privacy</p>
          <h1 className="mt-3 text-[40px] font-bold tracking-[-0.04em] sm:text-[50px]">Privacy Policy</h1>
          <p className="mt-3 text-[14px] font-medium text-[#667085]">Last updated {MECATREX_LEGAL_LAST_UPDATED}</p>
          <p className="mt-6 text-[17px] leading-8 text-[#475467]">
            MECATREX needs some personal and business information to connect drivers with automotive service providers. This policy explains what we collect, why we use it, and the choices available to you.
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
            Privacy questions, access requests, correction requests, or complaints can be submitted through the MECATREX support/contact channel made available on the platform. Before public launch, MECATREX should publish the designated privacy officer's direct business contact information here.
          </div>
        </article>
      </div>
    </main>
  );
}
