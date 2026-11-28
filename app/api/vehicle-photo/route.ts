import { NextRequest, NextResponse } from "next/server";
export async function GET(req:NextRequest){
 const make=req.nextUrl.searchParams.get("make")?.trim()||"",model=req.nextUrl.searchParams.get("model")?.trim()||"",year=req.nextUrl.searchParams.get("year")||"";
 if(!make||!model||make.length>50||model.length>60||!/^\d{4}$/.test(year))return NextResponse.json({photo:null},{status:400});
 const clean=(x:string)=>x.replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").trim();
 try{
 const query=new URLSearchParams({action:"query",format:"json",generator:"search",gsrsearch:make+" "+model+" "+year+" filetype:bitmap",gsrnamespace:"6",gsrlimit:"12",prop:"imageinfo",iiprop:"url|extmetadata|mime",iiurlwidth:"800"});
 const res=await fetch("https://commons.wikimedia.org/w/api.php?"+query,{headers:{"User-Agent":"BandWhip/1.0 vehicle reference photos"},next:{revalidate:86400}});
 if(!res.ok)return NextResponse.json({photo:null});
 const data=await res.json();
 for(const page of (Object.values(data.query?.pages??{}) as any[]).sort((a,b)=>a.index-b.index)){
 const info=page.imageinfo?.[0],m=info?.extmetadata,license=m?.LicenseShortName?.value||"",licenseUrl=m?.LicenseUrl?.value||"";
 const title=String(page.title||"").toLowerCase().replace(/[^a-z0-9]/g,"");
 if(!title.includes(make.toLowerCase().replace(/[^a-z0-9]/g,""))||!title.includes(model.toLowerCase().replace(/[^a-z0-9]/g,"")))continue;
 if(!info?.thumburl||!/^https:\/\/upload\.wikimedia\.org\//.test(info.thumburl)||!/^image\/(jpeg|png|webp)$/.test(info.mime||"")||!(/^(CC BY(-SA)? [234]\.\d|CC0|Public domain)$/i.test(license)))continue;
 if(!/^https?:\/\//.test(licenseUrl)||!m?.Artist?.value)continue;
 return NextResponse.json({photo:{url:info.thumburl,author:clean(m.Artist.value),license,licenseUrl,source:info.descriptionurl}});
 }
 }catch{}
 return NextResponse.json({photo:null});
}
