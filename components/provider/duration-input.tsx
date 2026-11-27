export function formatDuration(value:number|null) {
  if(value===null)return "—";
  const hours=Math.floor(value/60),minutes=value%60;
  return [hours?hours+" h":"",minutes?minutes+" min":""].filter(Boolean).join(" ") || "0 min";
}
export function DurationInput({value,onChange}:{value:number;onChange:(value:number)=>void}) {
  const hours=Math.floor(value/60),minutes=value%60;
  return <fieldset className="min-w-0"><legend className="mb-2 text-[14px] font-bold">Approx. duration *</legend><div className="grid grid-cols-2 gap-2"><label className="min-w-0"><span className="mb-1 block text-xs text-[#667085]">Hours</span><input type="number" min={0} step={1} value={hours} onChange={e=>onChange(Math.max(0,Math.floor(Number(e.target.value)||0))*60+minutes)} className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm"/></label><label className="min-w-0"><span className="mb-1 block text-xs text-[#667085]">Minutes</span><input type="number" min={0} max={59} step={1} value={minutes} onChange={e=>onChange(hours*60+Math.min(59,Math.max(0,Math.floor(Number(e.target.value)||0))))} className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm"/></label></div></fieldset>;
}
