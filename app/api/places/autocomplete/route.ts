import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Places API is not configured." },
      { status: 503 }
    );
  }

  const input = request.nextUrl.searchParams.get("input")?.trim() ?? "";
  const sessionToken = request.nextUrl.searchParams.get("sessionToken")?.trim() ?? "";

  if (input.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const googleResponse = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({
        input,
        sessionToken: sessionToken || undefined,
        includedRegionCodes: ["ca"],
        languageCode: "en",
        regionCode: "ca",
        locationRestriction: {
          circle: {
            center: {
              latitude: 45.5017,
              longitude: -73.5673,
            },
            radius: 25000,
          },
        },
      }),
      cache: "no-store",
    }
  );

  if (!googleResponse.ok) {
    const errorText = await googleResponse.text();
    console.error("Google Places autocomplete error:", errorText);

    return NextResponse.json(
      { error: "Could not load address suggestions." },
      { status: 502 }
    );
  }

  const data = (await googleResponse.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }>;
  };

  const suggestions = (data.suggestions ?? [])
    .map((item) => item.placePrediction)
    .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction?.placeId))
    .slice(0, 6)
    .map((prediction) => ({
      placeId: prediction.placeId!,
      text: prediction.text?.text ?? "",
      mainText: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? "",
      secondaryText: prediction.structuredFormat?.secondaryText?.text ?? "",
    }));

  return NextResponse.json({ suggestions });
}
