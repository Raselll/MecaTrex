import fs from "node:fs";

function patchFile(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) fs.writeFileSync(path, after);
}

function replaceOnce(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) throw new Error(`Patch target not found: ${label}`);
  return source.replace(oldValue, newValue);
}

patchFile("app/signup/signup-form.tsx", (input) => {
  let source = input;

  source = replaceOnce(
    source,
    'import { useEffect, useMemo, useRef, useState } from "react";\nimport { signup } from "./actions";',
    'import Link from "next/link";\nimport { useEffect, useMemo, useRef, useState } from "react";\nimport { signup } from "./actions";',
    "signup Link import"
  );

  source = replaceOnce(
    source,
    '  formattedAddress: string;\n};',
    '  formattedAddress: string;\n  latitude: number | null;\n  longitude: number | null;\n};',
    "address coordinates type"
  );

  source = replaceOnce(
    source,
    '  const [businessPlaceId, setBusinessPlaceId] = useState("");\n  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);',
    '  const [businessPlaceId, setBusinessPlaceId] = useState("");\n  const [businessLatitude, setBusinessLatitude] = useState<number | null>(null);\n  const [businessLongitude, setBusinessLongitude] = useState<number | null>(null);\n  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);',
    "coordinate state"
  );

  source = replaceOnce(
    source,
    '      setBusinessPlaceId(data.placeId);\n      setAddressSuggestions([]);',
    '      setBusinessPlaceId(data.placeId);\n      setBusinessLatitude(data.latitude ?? null);\n      setBusinessLongitude(data.longitude ?? null);\n      setAddressSuggestions([]);',
    "set selected coordinates"
  );

  source = replaceOnce(
    source,
    '      <input type="hidden" name="business_place_id" value={businessPlaceId} />',
    '      <input type="hidden" name="business_place_id" value={businessPlaceId} />\n      <input type="hidden" name="business_latitude" value={businessLatitude ?? ""} />\n      <input type="hidden" name="business_longitude" value={businessLongitude ?? ""} />',
    "coordinate hidden inputs"
  );

  source = replaceOnce(
    source,
    '                      setBusinessPlaceId("");\n                      setAddressMessage("");',
    '                      setBusinessPlaceId("");\n                      setBusinessLatitude(null);\n                      setBusinessLongitude(null);\n                      setAddressMessage("");',
    "clear coordinates on manual address edit"
  );

  source = replaceOnce(
    source,
    '      <label className="mt-7 flex cursor-pointer items-start gap-3 text-[13px] leading-5 text-[#667085]">\n        <input type="checkbox" required className="mt-1 h-4 w-4" />\n        <span>I agree to the MECATREX Terms of Service and Privacy Policy.</span>\n      </label>',
    '      <label className="mt-7 flex cursor-pointer items-start gap-3 text-[13px] leading-5 text-[#667085]">\n        <input name="legal_consent" value="accepted" type="checkbox" required className="mt-1 h-4 w-4" />\n        <span>\n          I agree to the MECATREX{" "}\n          <Link href="/terms" target="_blank" className="font-bold text-[#4771A6] underline underline-offset-2">\n            Terms of Service\n          </Link>{" "}\n          and{" "}\n          <Link href="/privacy" target="_blank" className="font-bold text-[#4771A6] underline underline-offset-2">\n            Privacy Policy\n          </Link>.\n        </span>\n      </label>',
    "legal links and consent"
  );

  return source;
});

patchFile("app/page.tsx", (input) => {
  let source = input;

  source = replaceOnce(
    source,
    'import Image from "next/image";\nimport Script from "next/script";',
    'import Image from "next/image";\nimport Script from "next/script";\nimport LiveGarages from "@/components/home/live-garages";\nimport WhenPicker from "@/components/home/when-picker";',
    "homepage component imports"
  );

  if (!source.includes("const garages = [")) {
    // already removed
  } else {
    const garageDataPattern = /const garages = \[[\s\S]*?\n\];\n\n(?=\/\* ========================================================= \*\/\n\/\* CARIMAGESAPI 3D VIEWER \*\/)/;
    if (!garageDataPattern.test(source)) throw new Error("Patch target not found: static garage data");
    source = source.replace(garageDataPattern, "");
  }

  source = replaceOnce(
    source,
    '                <div className="grid gap-2 lg:grid-cols-[1fr_1.3fr_1fr_0.8fr]">',
    '                <div className="grid gap-2 lg:grid-cols-[1fr_1.15fr_0.9fr_0.85fr_0.75fr]">',
    "homepage search grid"
  );

  source = replaceOnce(
    source,
    '                  {/* LOCATION */}',
    '                  {/* WHEN */}\n\n                  <WhenPicker />\n\n                  {/* LOCATION */}',
    "homepage when picker"
  );

  if (!source.includes("<LiveGarages />")) {
    const garageSectionPattern = /          <div className="grid gap-7 lg:grid-cols-3">[\s\S]*?        <\/section>\n\n        \{\/\* GARAGE BUSINESS \*\/\}/;
    if (!garageSectionPattern.test(source)) throw new Error("Patch target not found: homepage garage card grid");
    source = source.replace(
      garageSectionPattern,
      '          <LiveGarages />\n        </section>\n\n        {/* GARAGE BUSINESS */}'
    );
  }

  return source;
});

console.log("MECATREX targeted patches applied.");
