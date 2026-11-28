import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createDispatchAdminClient} from "@/lib/supabase/dispatch-admin";
import {sendCustomerOffer} from "@/lib/email/brevo";
export async function POST(req:NextRequest){
 const fail=(error:string,status=400)=>NextResponse.json({error},{status});
 try{
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return fail("Sign in first.",401);
 const {providerId,clientId,message}=await req.json();
 const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v);
 if(!uuid(providerId)||!uuid(clientId)||typeof message!=="string"||!message.trim()||message.length>4000)return fail("Invalid offer.");
 const admin=createDispatchAdminClient();if(!admin)return fail("Email service not configured.",503);
 const {data:provider}=await admin.from("service_providers").select("id,owner_id,provider_type,status,is_removed,booking_suspended,business_name,address_line1,city,province,postal_code,public_email,public_phone").eq("id",providerId).eq("owner_id",user.id).maybeSingle();
 if(!provider||provider.status!=="approved"||provider.is_removed||provider.booking_suspended)return fail("Unauthorized provider.",403);
 const {data:history,error:historyError}=provider.provider_type==="garage"?await admin.from("garage_bookings").select("id,booking_visits!inner(client_picked_up_at)").eq("provider_id",providerId).eq("client_id",clientId).eq("status","confirmed").not("booking_visits.client_picked_up_at","is",null).limit(1):await admin.from("towing_requests").select("id").eq("towing_provider_id",providerId).eq("client_id",clientId).eq("status","accepted").limit(1);
 if(historyError||!history?.length)return fail("No eligible customer relationship.",403);
 const {data:consent}=await admin.from("customer_offer_preferences").select("enabled,unsubscribe_token").eq("client_id",clientId).maybeSingle();
 if(!consent?.enabled)return fail("This customer has not opted in to promotional emails.",403);
 const {data:customer}=await admin.from("profiles").select("email,first_name,last_name,account_type").eq("id",clientId).maybeSingle();
 if(!customer?.email||customer.account_type!=="client")return fail("Customer email unavailable.",404);
 const site=process.env.NEXT_PUBLIC_SITE_URL?.trim();if(!site)return fail("Public site URL must be configured for unsubscribe links.",503);
 const contact=provider.public_email||provider.public_phone;if(!contact)return fail("Add a public business contact first.");
 const {data:claim,error:claimError}=await admin.from("customer_offer_sends").insert({provider_id:providerId,client_id:clientId,day:new Date().toISOString().slice(0,10)}).select("id").single();
 if(claimError||!claim)return fail("One offer per customer per day is allowed, or sending is unavailable.",429);
 try{await sendCustomerOffer({email:customer.email,name:customer.first_name+" "+customer.last_name,businessName:provider.business_name,address:[provider.address_line1,provider.city,provider.province,provider.postal_code].filter(Boolean).join(", "),contact,message:message.trim(),unsubscribeUrl:site.replace(/\/$/,"")+"/api/customer-offers/unsubscribe?token="+encodeURIComponent(consent.unsubscribe_token)});}
 catch{await admin.from("customer_offer_sends").delete().eq("id",claim.id);return fail("Email provider rejected the send. Please retry.",502);}
 return NextResponse.json({ok:true});
 }catch{return fail("Unable to send offer.",500);}
}
