"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function ClientNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [flight,setFlight] = useState<{x:number;y:number}|null>(null);
  const pending = useRef(false);
  const [burst,setBurst] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(()=>()=>timers.current.forEach(window.clearTimeout),[]);
  useEffect(()=>{if(pathname==="/garages" && pending.current){setBurst(true);}},[pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (pathname === "/" && link && !event.defaultPrevented && event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (!link.target || link.target==="_self") && !link.hasAttribute("download")) {
        const url = new URL(link.href,window.location.href);
        if(url.origin===window.location.origin && url.pathname==="/garages" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          event.preventDefault(); if(pending.current)return; pending.current=true; setBurst(false);
          const rect=document.querySelector("header .bw-brand-symbol, .bw-brand-symbol")?.getBoundingClientRect();
          setFlight({x:rect?rect.left+rect.width/2:window.innerWidth/2,y:rect?rect.top+rect.height/2:window.innerHeight/2});
          const href=url.pathname+url.search+url.hash;
          router.prefetch(url.pathname+url.search);
          timers.current.push(window.setTimeout(()=>{router.push(href);},780));
          timers.current.push(window.setTimeout(()=>{if(pending.current && window.location.pathname!=="/garages"){pending.current=false;setFlight(null);window.location.assign(href);}},10000));
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

  return flight ? <div aria-hidden="true" className="bw-flight-overlay" style={{position:"fixed",inset:0,zIndex:9999,pointerEvents:"auto",overflow:"hidden"}}>
    <style>{`@keyframes bwFlightVeilIn{from{opacity:0}to{opacity:1}}@keyframes bwFlightLogoIn{0%{transform:translate(var(--dx),var(--dy)) scale(.2)}48%{transform:translate(0,0) scale(.85)}100%{transform:scale(1.65)}}@keyframes bwFlightVeilOut{from{opacity:1}to{opacity:0}}@keyframes bwFlightLogoOut{0%{transform:scale(1.65);opacity:1}25%{transform:scale(2.05);opacity:1}100%{transform:scale(3.5);opacity:0}}@keyframes bwFlightRing{0%{transform:scale(1.4);opacity:0}20%{opacity:.85}100%{transform:scale(5);opacity:0}}`}</style>
    <div key={burst?"reveal":"cover"} style={{position:"absolute",inset:0,background:"white",animation:burst?"bwFlightVeilOut 480ms ease both":"bwFlightVeilIn 280ms ease both"}} onAnimationEnd={()=>{if(burst){timers.current.forEach(window.clearTimeout);timers.current=[];pending.current=false;setFlight(null);setBurst(false);}}}/>
    {burst&&<div style={{position:"absolute",left:"50%",top:"50%",width:132,height:132,marginLeft:-66,marginTop:-66,border:"3px solid #FF5B13",borderRadius:"50%",animation:"bwFlightRing 480ms ease-out both"}}/>}
    <div key={burst?"pop":"flight"} style={{position:"absolute",left:"50%",top:"50%",width:132,height:132,marginLeft:-66,marginTop:-66,display:"grid",placeItems:"center",color:"#FF5B13",animation:burst?"bwFlightLogoOut 480ms ease-out both":"bwFlightLogoIn 780ms cubic-bezier(.22,.75,.22,1) both",...({"--dx":flight.x-window.innerWidth/2+"px","--dy":flight.y-window.innerHeight/2+"px"} as React.CSSProperties)}}><img src="/bandwhip-icon.svg" alt="" style={{width:120,height:120}}/></div>
  </div> : null;
}
