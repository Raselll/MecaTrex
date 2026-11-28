import {NextRequest,NextResponse} from "next/server";
import {verifyGoogleAddress} from "@/lib/google-address";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 try {return NextResponse.json(await verifyGoogleAddress(request.nextUrl.searchParams.get("placeId")?.trim()??"",request.nextUrl.searchParams.get("sessionToken")?.trim()??""));}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Address verification failed."},{status:422});}
}
