"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ServiceNamePicker from "@/components/provider/service-name-picker";
import { isCompleteService, normalizeBusinessWebsite } from "@/lib/service-listing";

type ProviderStatus = "pending" | "approved" | "needs_information" | "rejected";
type PricingType = "fixed" | "from" | "hourly" | "quote";

export type ProviderRecord = {
  id: string;
  owner_id: string;
  provider_type: "garage" | "towing";
  business_name: string;
  address_line1: string;
  city: string;
  province: string;
  postal_code: string;
  status: ProviderStatus;
  business_description: string | null;
  public_email: string | null;
  public_phone: string | null;
  website: string | null;
  image_path: string | null;
  latitude: number | null;
  longitude: number | null;
  is_listing_active: boolean;
  provider_cancellation_count: number;
  booking_suspended: boolean;
};

export type ProviderService = {
  id: string;
  provider_id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  pricing_type: PricingType;
  duration_minutes: number | null;
  is_active: boolean;
};

function statusCopy(status: ProviderStatus) {
  return {
    pending: {
      title: "Application under review",
      description: "Build your listing now. We aim to review applications within 24 hours. You can publish once MECATREX approves your account.",
      className: "bg-[#FFF7E8] text-[#92400E]",
    },
    approved: {
      title: "Provider approved",
      description: "Your business is approved. Turn on Publish listing when your profile and services are ready.",
      className: "bg-[#ECFDF3] text-[#027A48]",
    },
    needs_information: {
      title: "More information requested",
      description: "MECATREX needs additional information before the provider application can be approved.",
      className: "bg-[#EFF6FF] text-[#1D4ED8]",
    },
    rejected: {
      title: "Application not approved",
      description: "This provider listing cannot be published. Contact MECATREX if you believe the application should be reviewed again.",
      className: "bg-[#FEF3F2] text-[#B42318]",
    },
  }[status];
}

function formatPrice(service: ProviderService) {
  if (service.pricing_type === "quote" || service.price_cents == null) return "Quote";
  const value = (service.price_cents / 100).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: service.price_cents % 100 === 0 ? 0 : 2,
  });
  if (service.pricing_type === "from") return `From ${value}`;
  if (service.pricing_type === "hourly") return `${value}/hr`;
  return value;
}

function toPriceInput(priceCents: number | null) {
  return priceCents == null ? "" : (priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2);
}

export default function ProviderDashboard({
  userId,
  initialProvider,
  initialServices,
  adminMessage,
}: {
  userId: string;
  initialProvider: ProviderRecord;
  initialServices: ProviderService[];
  adminMessage?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [provider, setProvider] = useState(initialProvider);
  const [services, setServices] = useState(initialServices);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newServiceFormKey, setNewServiceFormKey] = useState(0);
  const [newService, setNewService] = useState({
    name: "",
    description: "",
    price: "",
    pricingType: "fixed" as PricingType,
    duration: "",
  });

  const status = statusCopy(provider.status);
  const imageUrl = provider.image_path
    ? supabase.storage.from("garage-images").getPublicUrl(provider.image_path).data.publicUrl
    : "";
  const activeServices = services.filter((service) => service.is_active && service.pricing_type === "fixed" && isCompleteService(service.name, service.pricing_type, service.price_cents, service.duration_minutes));
  const checklist = [
    { title: "Business details", complete: Boolean(provider.business_name && provider.address_line1 && provider.postal_code && provider.public_phone && provider.public_email), href: "#business-profile" },
    { title: "Garage photo", complete: Boolean(provider.image_path), href: "#business-profile" },
    { title: "Services & fixed prices", complete: activeServices.length > 0, href: "#services" },
    { title: "MECATREX approval", complete: provider.status === "approved", href: "#application-status" },
  ];
  const canPublish = provider.status === "approved" && !provider.booking_suspended && activeServices.length > 0;

  function field<K extends keyof ProviderRecord>(key: K, value: ProviderRecord[K]) {
    setProvider((current) => ({ ...current, [key]: value }));
  }

  async function refreshListingState() {
    const { data } = await supabase
      .from("service_providers")
      .select("is_listing_active")
      .eq("id", provider.id)
      .single();
    if (data) setProvider((current) => ({ ...current, is_listing_active: data.is_listing_active }));
  }

  async function persistProfile(): Promise<string | null> {
    const website = normalizeBusinessWebsite(provider.website ?? "");
    if (provider.website?.trim() && !website) return "Enter a valid website, such as https://example.com.";
    if (!provider.business_name.trim() || !provider.address_line1.trim() || !provider.postal_code.trim()) {
      return "Business name, address and postal code are required.";
    }
    const { error: updateError } = await supabase
      .from("service_providers")
      .update({
        business_name: provider.business_name.trim(),
        business_description: provider.business_description?.trim() || null,
        address_line1: provider.address_line1.trim(),
        city: "Montreal",
        province: "Quebec",
        postal_code: provider.postal_code.trim().toUpperCase(),
        public_email: provider.public_email?.trim().toLowerCase() || null,
        public_phone: provider.public_phone?.trim() || null,
        website,
      })
      .eq("id", provider.id);
    if (updateError) return updateError.message;
    setProvider((current) => ({ ...current, website, city: "Montreal", province: "Quebec" }));
    return null;
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setMessage("");
    setError("");
    try {
      const problem = await persistProfile();
      if (problem) setError(problem);
      else setMessage("Business profile saved.");
    } catch {
      setError("Could not save business profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveAllUpdates() {
    if (savingAll) return;
    setSavingAll(true);
    setMessage("");
    setError("");
    try {
      if (services.some((service) => !isCompleteService(service.name, service.pricing_type, service.price_cents, service.duration_minutes))) {
        setError("Every service needs a confirmed fixed price, service name and duration. Review and convert any older From/Hourly prices first.");
        return;
      }
      const problem = await persistProfile();
      if (problem) {
        setError(problem);
        return;
      }
      for (const service of services) {
        const { error: updateError } = await supabase
          .from("provider_services")
          .update({
            name: service.name.trim(),
            description: service.description?.trim() || null,
            price_cents: service.price_cents,
            pricing_type: service.pricing_type,
            duration_minutes: service.duration_minutes,
            is_active: service.is_active,
          })
          .eq("id", service.id);
        if (updateError) {
          setError("Profile saved, but service " + service.name + " failed: " + updateError.message);
          return;
        }
      }
      await refreshListingState();
      router.refresh();
      setMessage("All business information and service updates saved successfully.");
    } catch {
      setError("We could not save all updates. Please retry.");
    } finally {
      setSavingAll(false);
    }
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    setError("");
    setMessage("");

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Garage images must be 5 MB or smaller.");
      return;
    }

    setUploadingImage(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/garage-cover-${Date.now()}.${extension}`;
    const oldPath = provider.image_path;

    const { error: uploadError } = await supabase.storage
      .from("garage-images")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setUploadingImage(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("service_providers")
      .update({ image_path: path })
      .eq("id", provider.id);

    if (updateError) {
      await supabase.storage.from("garage-images").remove([path]);
      setError(updateError.message);
      setUploadingImage(false);
      return;
    }

    if (oldPath) await supabase.storage.from("garage-images").remove([oldPath]);
    setProvider((current) => ({ ...current, image_path: path }));
    setMessage("Garage image updated.");
    setUploadingImage(false);
  }

  async function addService(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const name = newService.name.trim();
    if (!name) {
      setError("Enter a service name.");
      return;
    }

    const priceNumber = Number(newService.price);
    const durationNumber = Number(newService.duration);
    const priceCents = newService.price.trim() && Number.isFinite(priceNumber) && priceNumber >= 0 ? Math.round(priceNumber * 100) : null;
    if (!isCompleteService(name, newService.pricingType, priceCents, newService.duration.trim() ? durationNumber : null)) {
      setError("Service name, fixed price and a positive duration are all required.");
      return;
    }
    const { data, error: insertError } = await supabase
      .from("provider_services")
      .insert({
        provider_id: provider.id,
        name,
        description: newService.description.trim() || null,
        price_cents: priceCents,
        pricing_type: newService.pricingType,
        duration_minutes: durationNumber,
        is_active: true,
      })
      .select("id, provider_id, name, description, price_cents, pricing_type, duration_minutes, is_active")
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setServices((current) => [...current, data as ProviderService]);
    await refreshListingState();
    setNewService({ name: "", description: "", price: "", pricingType: "fixed" as PricingType, duration: "" });
    setNewServiceFormKey((value) => value + 1);
    setMessage("Service added to your catalogue.");
  }

  async function saveService(service: ProviderService) {
    setError("");
    setMessage("");
    if (!isCompleteService(service.name, service.pricing_type, service.price_cents, service.duration_minutes)) {
      setError("Please confirm the fixed price, service name and duration before saving.");
      return;
    }
    const { error: updateError } = await supabase
      .from("provider_services")
      .update({
        name: service.name.trim(),
        description: service.description?.trim() || null,
        price_cents: service.price_cents,
        pricing_type: service.pricing_type,
        duration_minutes: service.duration_minutes,
        is_active: service.is_active,
      })
      .eq("id", service.id);

    if (updateError) setError(updateError.message);
    else {
      setMessage(service.name + " saved.");
      await refreshListingState();
    }
  }

  async function deleteService(service: ProviderService) {
    if (!window.confirm(`Remove ${service.name} from your MECATREX catalogue?`)) return;
    setError("");
    const { error: deleteError } = await supabase.from("provider_services").delete().eq("id", service.id);
    if (deleteError) setError(deleteError.message);
    else {
      setServices((current) => current.filter((item) => item.id !== service.id));
      setMessage("Service removed.");
      await refreshListingState();
    }
  }

  async function toggleListing() {
    if (!canPublish && !provider.is_listing_active) {
      setError(provider.booking_suspended ? "Bookings are suspended after three provider cancellations. Contact MECATREX administration." : provider.status !== "approved" ? "MECATREX must approve the provider before it can be published." : "Add at least one active service before publishing your listing.");
      return;
    }

    const nextValue = !provider.is_listing_active;
    setError("");
    const { error: updateError } = await supabase
      .from("service_providers")
      .update({ is_listing_active: nextValue })
      .eq("id", provider.id);

    if (updateError) setError(updateError.message);
    else {
      setProvider((current) => ({ ...current, is_listing_active: nextValue }));
      setMessage(nextValue ? "Your garage is now published under Garages ready to help." : "Your garage listing is hidden from the public homepage.");
      router.refresh();
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <nav aria-label="Business dashboard shortcuts" className="grid gap-3 sm:grid-cols-4">
        <a href="#garage-calendar" className="rounded-[17px] border border-[#BAC7D7] bg-[#EDF3FA] p-5 transition hover:border-[#4771A6] hover:bg-[#DFEAF7]">
          <span className="text-[12px] font-bold uppercase tracking-wide text-[#667085]">Availability</span>
          <span className="mt-2 block text-[18px] font-extrabold text-[#101828]">📅 Block time</span>
          <span className="mt-1 block text-[12px] font-semibold text-[#4771A6]">View availability →</span>
        </a>
        <a href="#application-status" className="rounded-[17px] border border-[#BAC7D7] bg-[#F8FAFC] p-5 transition hover:border-[#4771A6] hover:bg-[#EDF3FA]">
          <span className="text-[12px] font-bold uppercase tracking-wide text-[#667085]">01 · Account status</span>
          <span className="mt-2 block text-[18px] font-extrabold text-[#101828]">{provider.status === "approved" ? "✓ Approved" : provider.status === "pending" ? "⏳ Under review" : provider.status === "rejected" ? "Not approved" : "More info required"}</span>
          <span className="mt-1 block text-[12px] font-semibold text-[#4771A6]">View status →</span>
        </a>
        <a href="#business-profile" className="rounded-[17px] border border-[#BAC7D7] bg-[#F8FAFC] p-5 transition hover:border-[#4771A6] hover:bg-[#EDF3FA]">
          <span className="text-[12px] font-bold uppercase tracking-wide text-[#667085]">02 · Your business</span>
          <span className="mt-2 block text-[18px] font-extrabold text-[#101828]">📸 Photo & details</span>
          <span className="mt-1 block text-[12px] font-semibold text-[#4771A6]">Edit profile →</span>
        </a>
        <a href="#services" className="rounded-[17px] border border-[#BAC7D7] bg-[#F8FAFC] p-5 transition hover:border-[#4771A6] hover:bg-[#EDF3FA]">
          <span className="text-[12px] font-bold uppercase tracking-wide text-[#667085]">03 · Service catalogue</span>
          <span className="mt-2 block text-[18px] font-extrabold text-[#101828]">🔧 {activeServices.length} active {activeServices.length === 1 ? "service" : "services"}</span>
          <span className="mt-1 block text-[12px] font-semibold text-[#4771A6]">Edit services & prices →</span>
        </a>
      </nav>

      <div className="rounded-[19px] border border-[#D5DFEA] bg-white p-5">
        <h2 className="text-[17px] font-extrabold text-[#101828]">Your listing checklist</h2>
        <p className="mt-1 text-[13px] text-[#667085]">Complete these four steps to get your business ready for customers.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {checklist.map((item) => (
            <a key={item.title} href={item.href} className="flex items-center gap-3 rounded-[13px] bg-[#F8FAFC] px-4 py-3 hover:bg-[#EDF3FA]">
              <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${item.complete ? "bg-[#D1FADF] text-[#027A48]" : "bg-[#EDF3FA] text-[#4771A6]"}`}>{item.complete ? "✓" : "○"}</span>
              <span className="text-[13px] font-bold text-[#344054]">{item.title}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="sticky top-3 z-30 flex flex-col gap-3 rounded-[20px] border border-[#BAC7D7] bg-white/95 px-5 py-4 shadow-[0_12px_40px_rgba(16,24,40,0.12)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[15px] font-bold text-[#101828]">Business & service updates</p>
          <p className="text-[12px] text-[#667085]">Save your business profile and all existing services in one click.</p>
        </div>
        <button type="button" onClick={saveAllUpdates} disabled={savingAll || savingProfile} className="rounded-[13px] bg-[#101828] px-6 py-3.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#315C91] disabled:cursor-not-allowed disabled:opacity-50">
          {savingAll ? "Saving updates..." : "✓ Save all updates"}
        </button>
      </div>
      <section id="application-status" className={`scroll-mt-28 rounded-[22px] p-5 ${status.className}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] font-bold">{status.title}</p>
            <p className="mt-1 text-[13px] leading-5 opacity-80">{status.description}</p>
          </div>
          <button
            type="button"
            onClick={toggleListing}
            disabled={provider.status !== "approved" && !provider.is_listing_active}
            className={`shrink-0 rounded-[13px] px-5 py-3 text-[13px] font-bold transition ${provider.is_listing_active ? "bg-white text-[#B42318]" : "bg-[#101828] text-white hover:bg-[#4771A6] disabled:cursor-not-allowed disabled:bg-black/20"}`}
          >
            {provider.is_listing_active ? "Unpublish listing" : "Publish listing"}
          </button>
        </div>
        {adminMessage && (
          <div className="mt-4 rounded-[14px] border border-[#BAC7D7] bg-white/85 px-4 py-4 text-[14px] leading-6 text-[#344054]">
            <strong className="block text-[#101828]">Message from MECATREX</strong>
            {adminMessage}
            {provider.status === "needs_information" && <p className="mt-2 text-[12px] font-semibold text-[#4771A6]">Please reply to the notification email from MECATREX with the requested information.</p>}
          </div>
        )}
      </section>

      {(message || error) && (
        <div role={error ? "alert" : "status"} className={`rounded-[16px] px-4 py-3 text-[14px] font-semibold ${error ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#ECFDF3] text-[#027A48]"}`}>
          {error || message}
        </div>
      )}

      <div id="business-profile" className="grid scroll-mt-28 gap-7 xl:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-[28px] border border-[#BAC7D7] bg-white p-6 shadow-sm">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">Garage image</p>
          <div className="mt-4 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#14263A] to-[#4771A6]">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={provider.business_name} className="h-[260px] w-full object-cover" />
            ) : (
              <div className="flex h-[260px] items-center justify-center text-[68px]">🔧</div>
            )}
          </div>
          <label className="mt-4 block cursor-pointer rounded-[14px] border border-dashed border-[#98A2B3] px-4 py-4 text-center text-[13px] font-bold text-[#475467] hover:bg-[#F9FAFB]">
            {uploadingImage ? "Uploading..." : "Upload garage photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingImage}
              onChange={(event) => uploadImage(event.target.files?.[0])}
              className="sr-only"
            />
          </label>
          <p className="mt-3 text-center text-[12px] font-semibold text-[#475467]">Recommended: 1600 × 900 px (16:9 landscape)</p>
          <p className="mt-1 text-center text-[11px] leading-5 text-[#98A2B3]">Minimum 1200 × 675 px · JPG, PNG or WebP · maximum 5 MB. Keep important details centred; edges may be cropped.</p>
        </section>

        <form onSubmit={saveProfile} className="rounded-[28px] border border-[#BAC7D7] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-extrabold uppercase tracking-[0.1em] text-[#101828]">Public profile</p>
              <h2 className="mt-2 text-[26px] font-bold tracking-[-0.03em]">Business information</h2>
            </div>
            <span className="rounded-full bg-[#F2F4F7] px-3 py-2 text-[11px] font-bold uppercase text-[#667085]">{provider.provider_type}</span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ProviderField label="Business name" value={provider.business_name} onChange={(value) => field("business_name", value)} className="sm:col-span-2" />
            <label className="sm:col-span-2">
              <span className="mb-2 block text-[14px] font-bold text-[#101828]">Description</span>
              <textarea
                value={provider.business_description ?? ""}
                onChange={(event) => field("business_description", event.target.value)}
                rows={4}
                placeholder="Tell customers what your garage specializes in."
                className="w-full rounded-[14px] border border-[#98A2B3] px-4 py-3 text-[14px] outline-none focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10"
              />
            </label>
            <ProviderField label="Public phone" value={provider.public_phone ?? ""} onChange={(value) => field("public_phone", value)} />
            <ProviderField label="Public email" type="email" value={provider.public_email ?? ""} onChange={(value) => field("public_email", value)} />
            <ProviderField label="Website (optional)" value={provider.website ?? ""} onChange={(value) => field("website", value)} className="sm:col-span-2" placeholder="https://garage.example.com" />
            <ProviderField label="Address" value={provider.address_line1} onChange={(value) => field("address_line1", value)} className="sm:col-span-2" />
            <ProviderField label="City" value="Montreal" onChange={() => {}} disabled />
            <ProviderField label="Province" value="Quebec" onChange={() => {}} disabled />
            <ProviderField label="Postal code" value={provider.postal_code} onChange={(value) => field("postal_code", value.toUpperCase())} />
            <p className="sm:col-span-2 text-[12px] text-[#667085]">MECATREX currently serves Montreal, Quebec. Location coordinates are handled automatically.</p>
          </div>

          <button disabled={savingProfile} className="mt-6 rounded-[14px] bg-[#4771A6] px-6 py-3.5 text-[14px] font-bold text-white hover:bg-[#3C6190] disabled:opacity-60">
            {savingProfile ? "Saving..." : "Save business profile"}
          </button>
        </form>
      </div>

      <section id="services" className="scroll-mt-28 rounded-[28px] border border-[#BAC7D7] bg-white p-6 shadow-sm">
        <div>
          <p className="text-[14px] font-extrabold uppercase tracking-[0.1em] text-[#101828]">Service catalogue</p>
          <h2 className="mt-2 text-[28px] font-bold tracking-[-0.03em]">List your services and prices</h2>
          <p className="mt-2 text-[14px] leading-6 text-[#667085]">Choose an exact fixed price for each service. Customers always see the final CAD price — no starting-from or hourly rates.</p>
        </div>

        <form onSubmit={addService} className="mt-6 rounded-[22px] bg-[#F8FAFC] p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <ServiceNamePicker key={newServiceFormKey} label="Service name *" value={newService.name} onChange={(value) => setNewService((current) => ({ ...current, name: value }))} />
            <label className="block">
              <span className="mb-2 block text-[14px] font-bold text-[#101828]">Pricing</span>
              <input type="text" value="🔒 Fixed price" readOnly aria-label="Pricing is always fixed" className="h-[48px] w-full cursor-not-allowed rounded-[13px] border border-[#98A2B3] bg-[#EDF3FA] px-3 text-[14px] font-bold text-[#101828]" />
            </label>
            <ProviderField label="Price (CAD) *" type="number" step="0.01" min="0" required value={newService.price} onChange={(value) => setNewService((current) => ({ ...current, price: value }))} placeholder="89.00" />
            <ProviderField label="Approx. duration (minutes) *" type="number" step="1" min="1" required value={newService.duration} onChange={(value) => setNewService((current) => ({ ...current, duration: value }))} placeholder="60" />
            <label className="lg:col-span-2">
              <span className="mb-2 block text-[14px] font-bold text-[#101828]">Description (optional)</span>
              <input value={newService.description} onChange={(event) => setNewService((current) => ({ ...current, description: event.target.value }))} placeholder="What's included in this service?" className="h-[48px] w-full rounded-[13px] border border-[#98A2B3] bg-white px-4 text-[14px] outline-none focus:border-[#4771A6]" />
            </label>
          </div>
          <button className="mt-4 rounded-[13px] bg-[#101828] px-5 py-3 text-[13px] font-bold text-white hover:bg-[#4771A6]">+ Add service</button>
        </form>

        <div className="mt-6 space-y-4">
          {services.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[#98A2B3] px-5 py-8 text-center text-[14px] text-[#667085]">No services listed yet.</div>
          ) : (
            services.map((service) => (
              <ServiceEditor
                key={service.id}
                service={service}
                onChange={(next) => setServices((current) => current.map((item) => item.id === next.id ? next : item))}
                onSave={() => saveService(service)}
                onDelete={() => deleteService(service)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ProviderField({
  label,
  value,
  onChange,
  type = "text",
  step,
  placeholder,
  className = "",
  disabled = false,
  required = false,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-2 block text-[14px] font-bold text-[#101828]">{label}</span>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        min={min}
        className="h-[48px] w-full rounded-[13px] border border-[#98A2B3] bg-white px-4 text-[14px] outline-none focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10 disabled:bg-[#F2F4F7]"
      />
    </label>
  );
}

function ServiceEditor({ service, onChange, onSave, onDelete }: {
  service: ProviderService;
  onChange: (service: ProviderService) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-[20px] border border-[#BAC7D7] bg-white p-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.7fr_auto] lg:items-end">
        <ServiceNamePicker label="Service *" value={service.name} onChange={(value) => onChange({ ...service, name: value })} />
        <div>
          <label className="block">
            <span className="mb-2 block text-[14px] font-bold text-[#101828]">Pricing</span>
            <input readOnly type="text" value="🔒 Fixed price" aria-label="Pricing is fixed" className="h-[48px] w-full cursor-not-allowed rounded-[13px] border border-[#98A2B3] bg-[#EDF3FA] px-3 text-[14px] font-bold text-[#101828]" />
          </label>
        </div>
        <ProviderField
          label="Price (CAD) *"
          type="number"
          step="0.01"
          min="0"
          required
          value={toPriceInput(service.price_cents)}
          onChange={(value) => onChange({ ...service, price_cents: value === "" ? null : Math.round(Number(value) * 100) })}
        />
        <div className="flex gap-2">
          <button type="button" disabled={!isCompleteService(service.name, service.pricing_type, service.price_cents, service.duration_minutes)} onClick={onSave} className="h-[48px] rounded-[12px] bg-[#4771A6] px-4 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Save</button>
          <button type="button" onClick={onDelete} className="h-[48px] rounded-[12px] border border-[#FDA29B] px-3 text-[12px] font-bold text-[#B42318]">Delete</button>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_190px_auto] sm:items-end">
        <ProviderField label="Description" value={service.description ?? ""} onChange={(value) => onChange({ ...service, description: value })} />
        <ProviderField label="Duration (minutes) *" type="number" step="1" min="1" required value={service.duration_minutes?.toString() ?? ""} onChange={(value) => onChange({ ...service, duration_minutes: value === "" ? null : Number(value) })} />
        <label className="flex h-[48px] items-center gap-2 rounded-[12px] bg-[#F8FAFC] px-4 text-[12px] font-bold text-[#475467]">
          <input type="checkbox" checked={service.is_active} onChange={(event) => onChange({ ...service, is_active: event.target.checked })} className="h-4 w-4" />
          Active
        </label>
      </div>
      {service.pricing_type !== "fixed" ? (
        <div className="mt-4 rounded-[14px] border border-[#FEC84B] bg-[#FFFAEB] p-4 text-[#92400E]">
          <p className="text-[13px] font-bold">⚠️ Old pricing: {formatPrice(service)} — needs confirmation</p>
          <p className="mt-1 text-[12px] leading-5">Check the amount above. MECATREX now requires the exact final price for each service. This old pricing will not appear on the public garage card until confirmed.</p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Confirm the CAD amount shown is your EXACT fixed price for this service? You can edit the amount before saving.")) {
                onChange({ ...service, pricing_type: "fixed" });
              }
            }}
            className="mt-3 rounded-[11px] bg-[#101828] px-4 py-2.5 text-[12px] font-bold text-white hover:bg-[#315C91]"
          >
            Confirm this as a fixed price
          </button>
        </div>
      ) : (
        <p className="mt-3 text-[12px] font-semibold text-[#4771A6]">Public display: {formatPrice(service)}</p>
      )}
    </div>
  );
}
