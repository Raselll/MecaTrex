import type { BusinessHour } from "@/lib/booking";
type PublicClosure = { starts_at:string; ends_at:string };
export function businessStatus(hours:BusinessHour[],closures:PublicClosure[],clock:number|null) {
  if(clock===null || !hours.length) return "Hours unavailable";
  if(closures.some(c=>Date.parse(c.starts_at)<=clock && clock<Date.parse(c.ends_at))) return "Closed";
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Toronto",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(clock));
  const get=(key:string)=>parts.find(p=>p.type===key)?.value ?? "";
  const weekday=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(get("weekday"));
  const now=Number(get("hour"))*60+Number(get("minute"));
  const minutes=(v:string|null)=>v?Number(v.slice(0,2))*60+Number(v.slice(3,5)):NaN;
  const today=hours.find(h=>h.weekday===weekday);
  const previous=hours.find(h=>h.weekday===(weekday+6)%7);
  const isOpen=(h:BusinessHour|undefined,overnight:boolean)=>{
    if(!h?.is_open)return false;
    const start=minutes(h.open_time),end=minutes(h.close_time);
    if(!Number.isFinite(start)||!Number.isFinite(end))return false;
    if(overnight)return end<start && now<end;
    return end<start?now>=start:now>=start&&now<end;
  };
  return isOpen(today,false)||isOpen(previous,true)?"Open now":today?"Closed":"Hours unavailable";
}
