"use client";
import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
type Toast={id:number;message:string};
let nextId=0;
const eventName="bandwhip:success";
export function useSuccessToast(message:string){
 useEffect(()=>{if(message.trim())window.dispatchEvent(new CustomEvent(eventName,{detail:message}));},[message]);
}
export default function SuccessToasts(){
 const [items,setItems]=useState<Toast[]>([]);
 const [ready,setReady]=useState(false);
 useEffect(()=>{setReady(true);const timers=new Map<number,ReturnType<typeof setTimeout>>();
 const receive=(event:Event)=>{const message=(event as CustomEvent<string>).detail;if(!message)return;const id=++nextId;setItems(old=>[...old.slice(-3),{id,message}]);timers.set(id,setTimeout(()=>{setItems(old=>old.filter(t=>t.id!==id));timers.delete(id)},4500));};
 window.addEventListener(eventName,receive);return()=>{window.removeEventListener(eventName,receive);timers.forEach(clearTimeout)};},[]);
 return ready?createPortal(<div aria-live="polite" className="pointer-events-none fixed left-4 top-4 z-[9999] flex w-[min(390px,calc(100vw-2rem))] flex-col gap-2">{items.map(t=><div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[#B7E4CA] bg-white p-4 shadow-lg" style={{borderLeft:"4px solid #16A34A"}}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DCFCE7] font-bold text-[#166534]">✓</span><div className="flex-1"><p className="text-xs font-bold text-[#166534]">Success</p><p className="mt-1 text-sm font-semibold text-[#101828]">{t.message}</p></div><button type="button" aria-label="Dismiss notification" className="text-lg text-[#667085]" onClick={()=>setItems(old=>old.filter(x=>x.id!==t.id))}>×</button></div>)}</div>,document.body):null;
}
