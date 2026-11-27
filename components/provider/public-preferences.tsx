export const PAYMENT_OPTIONS = [
  {label:"Cash",icon:"💵"}, {label:"Debit",icon:"💳"}, {label:"Credit",icon:"💳"}, {label:"Interac e-Transfer",icon:"🏦"},
];
export const LANGUAGE_OPTIONS = ["English","French","Arabic","Spanish","Mandarin","Cantonese","Italian","Portuguese","Greek","Hindi","Punjabi","Urdu","Russian","Vietnamese","Korean","German"];
export function PublicProviderPreferences({payments,languages}:{payments?:string[] | null;languages?:string[] | null}) {
  return <div className="mt-4 space-y-3 border-t border-[#EAECF0] pt-3 text-xs">
    <div className="flex flex-wrap items-center gap-2"><span className="w-[72px] shrink-0 font-extrabold uppercase tracking-wide text-[#667085]">Payment</span><div className="flex flex-1 flex-wrap gap-1.5">{payments?.length ? payments.map(value=><span key={value} className="inline-flex flex-col items-center justify-center gap-1 rounded-lg border border-[#E4E7EC] bg-[#F8FAFC] px-2 py-1.5 text-[10px] font-semibold text-[#475467]"><span aria-hidden="true" className="text-lg">{PAYMENT_OPTIONS.find(item=>item.label===value)?.icon ?? "💳"}</span>{value}</span>) : <span className="text-[#667085]">Not specified</span>}</div></div>
    <div className="flex flex-wrap items-center gap-2"><span className="w-[72px] shrink-0 font-extrabold uppercase tracking-wide text-[#667085]">Language</span><div className="flex flex-1 flex-wrap gap-1.5">{languages?.length ? languages.map(value=><span key={value} className="rounded-lg border border-[#E4E7EC] bg-[#F8FAFC] px-2 py-1.5 font-semibold text-[#475467]">{value}</span>) : <span className="text-[#667085]">Not specified</span>}</div></div>
  </div>;
}
