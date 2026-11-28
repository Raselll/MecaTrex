import "server-only";

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

export async function verifyGoogleAddress(placeId: string, sessionToken = "") {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !placeId || placeId.length > 300) throw Error("Address verification unavailable.");
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
        "X-Goog-FieldMask": "id,formattedAddress,addressComponents,location",
      },
      cache: "no-store",
    }
  );

  if (!googleResponse.ok) {
    const errorText = await googleResponse.text();
    console.error("Google Places details error:", errorText);

    throw Error("Could not validate this address.");
  }

  const data = (await googleResponse.json()) as {
    id?: string;
    formattedAddress?: string;
    addressComponents?: AddressComponent[];
    location?: {
      latitude?: number;
      longitude?: number;
    };
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
    throw Error("Please select an address located in Montreal, Quebec.");
  }

  const streetAddress =
    [streetNumber, route].filter(Boolean).join(" ") ||
    data.formattedAddress?.split(",")[0] ||
    "";

  if (!streetNumber || !route || !postalCode || !data.formattedAddress) throw Error("Select a complete street address.");
  return {
    placeId: data.id ?? placeId,
    streetAddress,
    city: "Montreal",
    province: "Quebec",
    postalCode: postalCode.toUpperCase(),
    formattedAddress: data.formattedAddress ?? streetAddress,
    latitude: data.location?.latitude ?? null,
    longitude: data.location?.longitude ?? null,
  };
}
