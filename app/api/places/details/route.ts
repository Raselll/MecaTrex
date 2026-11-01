import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

function findComponent(components: AddressComponent[], type: string) {
  return components.find((component) => component.types?.includes(type));
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Places API is not configured." },
      { status: 503 }
    );
  }

  const placeId = request.nextUrl.searchParams.get("placeId")?.trim() ?? "";
  const sessionToken = request.nextUrl.searchParams.get("sessionToken")?.trim() ?? "";

  if (!placeId) {
    return NextResponse.json({ error: "Missing place ID." }, { status: 400 });
  }

  const params = new URLSearchParams({
    languageCode: "en",
    regionCode: "ca",
  });

  if (sessionToken) params.set("sessionToken", sessionToken);

  const googleResponse = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params.toString()}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,formattedAddress,addressComponents",
      },
      cache: "no-store",
    }
  );

  if (!googleResponse.ok) {
    const errorText = await googleResponse.text();
    console.error("Google Places details error:", errorText);

    return NextResponse.json(
      { error: "Could not validate this address." },
      { status: 502 }
    );
  }

  const data = (await googleResponse.json()) as {
    id?: string;
    formattedAddress?: string;
    addressComponents?: AddressComponent[];
  };

  const components = data.addressComponents ?? [];
  const streetNumber = findComponent(components, "street_number")?.longText ?? "";
  const route = findComponent(components, "route")?.longText ?? "";
  const locality =
    findComponent(components, "locality")?.longText ??
    findComponent(components, "postal_town")?.longText ??
    findComponent(components, "sublocality")?.longText ??
    "";
  const provinceLong = findComponent(components, "administrative_area_level_1")?.longText ?? "";
  const provinceShort = findComponent(components, "administrative_area_level_1")?.shortText ?? "";
  const countryShort = findComponent(components, "country")?.shortText ?? "";
  const postalCode = findComponent(components, "postal_code")?.longText ?? "";

  const isMontreal = normalize(locality) === "montreal";
  const isQuebec = normalize(provinceLong) === "quebec" || provinceShort.toUpperCase() === "QC";
  const isCanada = countryShort.toUpperCase() === "CA";

  if (!isMontreal || !isQuebec || !isCanada) {
    return NextResponse.json(
      { error: "Please select an address located in Montreal, Quebec." },
      { status: 422 }
    );
  }

  const streetAddress =
    [streetNumber, route].filter(Boolean).join(" ") ||
    data.formattedAddress?.split(",")[0] ||
    "";

  return NextResponse.json({
    placeId: data.id ?? placeId,
    streetAddress,
    city: "Montreal",
    province: "Quebec",
    postalCode: postalCode.toUpperCase(),
    formattedAddress: data.formattedAddress ?? streetAddress,
  });
}
