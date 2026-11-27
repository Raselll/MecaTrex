"use client";
import {useRef,useState,useEffect} from "react";
import Script from "next/script";
type Maps={Map:new(el:HTMLElement,options:object)=>object;Marker:new(options:object)=>object};
export default function ProviderMap({latitude,longitude}:{latitude:number|null;longitude:number|null}){
 const el=useRef<HTMLDivElement>(null);const [ready,setReady]=useState(false);const [failed,setFailed]=useState(false);
 const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
 const lat=latitude===null?NaN:Number(latitude),lng=longitude===null?NaN:Number(longitude);
 const valid=Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
 useEffect(()=>{if(!ready||!el.current||!valid)return;try{const maps=(window as unknown as {google?:{maps?:Maps}}).google?.maps;if(!maps)throw Error();const center={lat,lng};const map=new maps.Map(el.current,{center,zoom:15,mapTypeControl:false,streetViewControl:false});new maps.Marker({map,position:center});}catch{setFailed(true);}},[ready,valid,lat,lng]);
 if(!key||!valid||failed)return <p className="rounded-xl bg-[#F8FAFC] p-4 text-sm text-[#667085]">Interactive map unavailable. Use Open in Maps for directions.</p>;
 return <><Script id="bandwhip-google-map" src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`} strategy="afterInteractive" onReady={()=>setReady(true)} onError={()=>setFailed(true)}/><div ref={el} className="h-[340px] w-full overflow-hidden rounded-xl bg-[#F2F4F7]" aria-label="Business location map"/></>;
}
