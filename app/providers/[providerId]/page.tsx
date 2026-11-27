import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import BrandLogo from "@/components/brand/bandwhip-logo";
import {PublicProviderPreferences} from "@/components/provider/public-preferences";
import {formatDuration} from "@/components/provider/duration-input";
import {orderServices} from "@/lib/service-display-order";
import {businessStatus} from "@/lib/provider-status";
import {formatHour,WEEKDAYS,type BusinessHour} from "@/lib/booking";
import {normalizeBusinessWebsite} from "@/lib/service-listing";
import ProviderMap from "@/components/provider/provider-map";
export const dynamic="force-dynamic";
export default async function ProviderPage({params}:{params:Promise<{providerId:string}>}){
 const {providerId}=await params; const supabase=await createClient();
 const {data:p}=await supabase.from("service_providers").select("id,provider_type,business_name,address_line1,city,province,postal_code,public_phone,public_email,website,image_path,payment_methods,spoken_languages,service_display_order,latitude,longitude").eq("id",providerId).eq("status","approved").eq("is_listing_active",true).eq("booking_suspended",false).maybeSingle();
 if(!p)notFound();
 const [sr,hr,cr,rr]=await Promise.all([
 supabase.from("provider_services").select("id,name,description,price_cents,duration_minutes").eq("provider_id",providerId).eq("is_active",true).eq("pricing_type","fixed").order("name"),
 supabase.from("garage_business_hours").select("provider_id,weekday,is_open,open_time,close_time").eq("provider_id",providerId),
 supabase.from("garage_block_public_notes").select("block_id,starts_at,ends_at,public_note").eq("provider_id",providerId).gte("ends_at",new Date().toISOString()).order("starts_at"),
 supabase.from("garage_reviews").select("id,stars,comment,created_at").eq("provider_id",providerId).order("created_at",{ascending:false}).limit(10)]);
 const services=orderServices((sr.data??[]).filter(s=>s.price_cents!==null&&s.duration_minutes!==null&&s.duration_minutes>0),p.service_display_order);
 const hours=(hr.data??[]) as BusinessHour[];const closures=cr.data??[];const reviews=rr.data??[];
 const status=businessStatus(hours,closures,Date.now());const towing=p.provider_type==="towing";
 const image=p.image_path?supabase.storage.from("garage-images").getPublicUrl(p.image_path).data.publicUrl:"";
 const address=[p.address_line1,p.city,p.province,p.postal_code,"Canada"].filter(Boolean).join(", ");
 const website=normalizeBusinessWebsite(p.website??"");const back="/garages?type="+(towing?"towing":"garage")+"#garage-results";
 const panel="rounded-2xl border border-[#E4E7EC] bg-white p-5 sm:p-7 shadow-sm";
 const action=towing?"bg-[#F3C547] text-[#35290D]":"bg-[#FF5B13] text-white";
 return <main className="min-h-screen bg-[#F7F8FA] pb-16 text-[#101828]"><header className="border-b bg-white"><div className="mx-auto flex max-w-[1050px] items-center justify-between px-5 py-4"><BrandLogo href="/"/><Link href={back} className="text-sm font-bold">← All {towing?"towing companies":"garages"}</Link></div></header>
 <div className="mx-auto max-w-[1050px] space-y-5 px-4 pt-6">
 <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm"><div className="grid sm:grid-cols-2"><div className="relative aspect-video bg-[#EAF0F7]">{image?<img src={image} alt={p.business_name} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-5xl">{towing?"🚛":"🔧"}</div>}</div><div className="flex flex-col justify-center gap-3 p-6"><span className={`self-start rounded-full px-3 py-1 text-xs font-bold ${action}`}>{towing?"Towing company":"Garage"}</span><h1 className="text-3xl font-extrabold tracking-tight">{p.business_name}</h1><p className="text-sm font-semibold text-[#667085]">✓ Approved BandWhip provider</p><p className={`text-sm font-bold ${status==="Open now"?"text-[#027A48]":status==="Closed"?"text-[#B42318]":"text-[#667085]"}`}>● {status}</p><p className="text-sm text-[#475467]">{address}</p><div className="flex flex-wrap gap-2">{p.public_phone&&<a className="rounded-lg border px-3 py-2 text-sm font-bold" href={`tel:${p.public_phone.replace(/[^\d+]/g,"")}`}>Call</a>}{p.public_email&&<a className="rounded-lg border px-3 py-2 text-sm font-bold" href={`mailto:${p.public_email}`}>Email</a>}{website&&<a className="rounded-lg border px-3 py-2 text-sm font-bold" href={website} target="_blank" rel="noreferrer">Website ↗</a>}</div><Link className={`rounded-xl px-4 py-3 text-center text-sm font-bold ${action}`} href={towing?"/garages?type=garage#garage-results":`/book/${p.id}`}>{towing?"Find a garage to request towing":"Book this garage"} →</Link>{towing&&<p className="text-xs text-[#667085]">Towing requests accompany garage bookings.</p>}</div></div></section>
 <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]"><section className={panel}><h2 className="text-xl font-extrabold">Services & prices</h2><div className="mt-4 divide-y">{services.map(s=><div key={s.id} className="flex items-start justify-between gap-3 py-3"><div><p className="font-bold">{s.name}</p><p className="text-xs text-[#667085]">Approx. {formatDuration(s.duration_minutes)}</p>{s.description&&<p className="mt-1 text-xs text-[#475467]">{s.description}</p>}</div><span className="shrink-0 font-bold text-[#DD4E0D]">{new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(Number(s.price_cents)/100)}</span></div>)}{!services.length&&<p className="text-sm text-[#667085]">No services listed.</p>}</div></section><section className={panel}><h2 className="text-xl font-extrabold">Payment & languages</h2><PublicProviderPreferences payments={p.payment_methods} languages={p.spoken_languages}/></section></div>
 <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Location</h2><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm font-bold">Open in Maps ↗</a></div><p className="my-3 text-sm text-[#475467]">{address}</p><ProviderMap latitude={p.latitude} longitude={p.longitude}/></section>
 <section className={panel}><h2 className="text-xl font-extrabold">Opening hours</h2><p className="mt-1 text-xs text-[#667085]">Montréal time</p><div className="mt-4 divide-y">{WEEKDAYS.map((day,i)=>{const row=hours.find(h=>h.weekday===i);return <div key={day} className="flex justify-between gap-3 py-3 text-sm"><span className="font-semibold">{day}</span><span>{row?row.is_open?`${formatHour(row.open_time)} – ${formatHour(row.close_time)}`:"Closed":"Not specified"}</span></div>})}</div>{closures.map(c=><div key={c.block_id} className="mt-3 rounded-lg bg-[#FFFAEB] p-3 text-sm text-[#92400E]">{new Date(c.starts_at).toLocaleDateString("en-CA",{timeZone:"America/Toronto"})} · {c.public_note}</div>)}</section>
 <section className={panel}><h2 className="text-xl font-extrabold">Reviews</h2>{reviews.length?reviews.map(r=><div key={r.id} className="mt-3 rounded-lg bg-[#F8FAFC] p-3 text-sm"><p className="text-[#D97706]">{"★".repeat(r.stars)}</p>{r.comment&&<p>{r.comment}</p>}</div>):<p className="mt-3 text-sm text-[#667085]">No reviews yet.</p>}</section>
 </div></main>;
}
