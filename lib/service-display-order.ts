/** Keep saved catalogue order; unknown/new services follow in their original order. */
export function orderServices<T extends {id:string}>(services:T[], order?:string[] | null):T[] {
  const ranks = new Map((order ?? []).map((id,index)=>[id,index]));
  return [...services].sort((a,b)=>(ranks.get(a.id) ?? Number.MAX_SAFE_INTEGER)-(ranks.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}
