"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function ClientNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [flight,setFlight] = useState<{x:number;y:number}|null>(null);
  const pending = useRef(false);
  const timers = useRef<number[]>([]);
  useEffect(()=>()=>timers.current.forEach(window.clearTimeout),[]);
  useEffect(()=>{if(pathname==="/garages" && pending.current){pending.current=false;setFlight(null);}},[pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (pathname === "/" && link && !event.defaultPrevented && event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (!link.target || link.target==="_self") && !link.hasAttribute("download")) {
        const url = new URL(link.href,window.location.href);
        if(url.origin===window.location.origin && url.pathname==="/garages" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          event.preventDefault(); if(pending.current)return; pending.current=true;
          const rect=document.querySelector("header .bw-brand-symbol, .bw-brand-symbol")?.getBoundingClientRect();
          setFlight({x:rect?rect.left+rect.width/2:window.innerWidth/2,y:rect?rect.top+rect.height/2:window.innerHeight/2});
          const href=url.pathname+url.search+url.hash;
          router.prefetch(url.pathname+url.search);
          timers.current.push(window.setTimeout(()=>{router.push(href);},650));
          timers.current.push(window.setTimeout(()=>{pending.current=false;setFlight(null);},1600));
          return;
        }
      }
      const button = target?.closest("button");

      if (!button) {
        return;
      }

      // Never hijack buttons that belong to a real form. This keeps the
      // homepage navigation workaround from blocking login/signup submits.
      if (button.closest("form")) {
        return;
      }

      const label = button.textContent?.trim();

      if (label === "Sign up") {
        event.preventDefault();
        router.push("/signup");
      }

      if (label === "Log in") {
        event.preventDefault();
        router.push("/login");
      }
    }

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [router,pathname]);

  return flight ? <div aria-hidden="true" className="bw-flight-overlay" style={{position:"fixed",inset:0,zIndex:9999,pointerEvents:"none"}}>
    <style>{`@keyframes bwFlightVeil{0%{opacity:0}30%,70%{opacity:1}100%{opacity:0}}@keyframes bwFlightLogo{0%{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:1}55%{transform:translate(0,0) scale(1);opacity:1}72%{transform:scale(1.18);opacity:1}100%{transform:scale(2.2);opacity:0}}@keyframes bwFlightRing{0%,55%{transform:scale(.3);opacity:0}65%{opacity:.7}100%{transform:scale(3);opacity:0}}`}</style>
    <div style={{position:"absolute",inset:0,background:"white",animation:"bwFlightVeil 650ms ease both"}}/>
    <div style={{position:"absolute",left:"50%",top:"50%",width:132,height:132,marginLeft:-66,marginTop:-66,border:"3px solid #FF5B13",borderRadius:"50%",animation:"bwFlightRing 650ms ease-out both"}}/>
    <div style={{position:"absolute",left:"50%",top:"50%",width:132,height:132,marginLeft:-66,marginTop:-66,display:"grid",placeItems:"center",color:"#FF5B13",animation:"bwFlightLogo 650ms cubic-bezier(.22,.75,.22,1) both",...({"--dx":flight.x-window.innerWidth/2+"px","--dy":flight.y-window.innerHeight/2+"px"} as React.CSSProperties)}}><img src="/bandwhip-icon.svg" alt="" style={{width:120,height:120}}/></div>
  </div> : null;
}
