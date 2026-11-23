// Shared reference options copied from the MECATREX homepage vehicle picker.
// Keep these lists in sync if the catalogue changes.
export const VEHICLE_YEARS = Array.from(
  { length: 38 },
  (_, index) => String(2027 - index)
);

export const VEHICLE_MAKES = [
  "Acura",
  "Audi",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Mazda",
  "Mercedes-Benz",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Porsche",
  "Ram",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

export const VEHICLE_COLORS = [
  "Black",
  "White",
  "Silver",
  "Grey",
  "Blue",
  "Red",
  "Green",
  "Brown",
  "Beige",
  "Gold",
  "Orange",
  "Yellow",
  "Purple",
  "Other",
];

export const VEHICLE_COLOR_SWATCHES: Record<string, string> = {
  Black: "#111827",
  White: "#FFFFFF",
  Silver: "#C0C5CC",
  Grey: "#667085",
  Blue: "#4771A6",
  Red: "#D92D20",
  Green: "#2F855A",
  Brown: "#7C4A32",
  Beige: "#D9C6A5",
  Gold: "#C89B3C",
  Orange: "#E97827",
  Yellow: "#EAB308",
  Purple: "#7F56D9",
  Other: "#D0D5DD",
};

export const VEHICLE_MODELS_BY_MAKE: Record<string, string[]> = {
  Acura: [
    "Integra",
    "TLX",
    "RDX",
    "MDX",
  ],

  Audi: [
    "A3",
    "A4",
    "A5",
    "A6",
    "A7",
    "A8",
    "Q3",
    "Q5",
    "Q7",
    "Q8",
  ],

  BMW: [
    "2 Series",
    "3 Series",
    "4 Series",
    "5 Series",
    "7 Series",
    "X1",
    "X2",
    "X3",
    "X4",
    "X5",
    "X6",
    "X7",
  ],

  Buick: [
    "Encore",
    "Encore GX",
    "Envision",
    "Enclave",
  ],

  Cadillac: [
    "CT4",
    "CT5",
    "XT4",
    "XT5",
    "XT6",
    "Escalade",
  ],

  Chevrolet: [
    "Malibu",
    "Trax",
    "Trailblazer",
    "Equinox",
    "Blazer",
    "Traverse",
    "Tahoe",
    "Suburban",
    "Silverado",
  ],

  Chrysler: [
    "300",
    "Pacifica",
  ],

  Dodge: [
    "Charger",
    "Challenger",
    "Durango",
    "Hornet",
  ],

  Ford: [
    "Mustang",
    "Escape",
    "Bronco Sport",
    "Bronco",
    "Edge",
    "Explorer",
    "F-150",
    "Maverick",
  ],

  Genesis: [
    "G70",
    "G80",
    "G90",
    "GV60",
    "GV70",
    "GV80",
  ],

  GMC: [
    "Terrain",
    "Acadia",
    "Yukon",
    "Canyon",
    "Sierra",
  ],

  Honda: [
    "Civic",
    "Accord",
    "HR-V",
    "CR-V",
    "Passport",
    "Pilot",
    "Ridgeline",
    "Odyssey",
  ],

  Hyundai: [
    "Elantra",
    "Sonata",
    "Venue",
    "Kona",
    "Tucson",
    "Santa Fe",
    "Palisade",
    "Ioniq 5",
  ],

  Infiniti: [
    "Q50",
    "QX50",
    "QX55",
    "QX60",
    "QX80",
  ],

  Jeep: [
    "Compass",
    "Cherokee",
    "Grand Cherokee",
    "Wrangler",
    "Gladiator",
    "Wagoneer",
  ],

  Kia: [
    "Forte",
    "K4",
    "K5",
    "Soul",
    "Seltos",
    "Sportage",
    "Sorento",
    "Telluride",
    "EV6",
  ],

  "Land Rover": [
    "Discovery Sport",
    "Discovery",
    "Defender",
    "Range Rover Evoque",
    "Range Rover Sport",
    "Range Rover",
  ],

  Lexus: [
    "IS",
    "ES",
    "UX",
    "NX",
    "RX",
    "GX",
    "TX",
    "LX",
  ],

  Lincoln: [
    "Corsair",
    "Nautilus",
    "Aviator",
    "Navigator",
  ],

  Mazda: [
    "Mazda3",
    "CX-30",
    "CX-5",
    "CX-50",
    "CX-70",
    "CX-90",
    "MX-5",
  ],

  "Mercedes-Benz": [
    "A-Class",
    "C-Class",
    "E-Class",
    "S-Class",
    "GLA",
    "GLB",
    "GLC",
    "GLE",
    "GLS",
  ],

  MINI: [
    "Cooper",
    "Countryman",
  ],

  Mitsubishi: [
    "Mirage",
    "RVR",
    "Outlander",
    "Outlander PHEV",
  ],

  Nissan: [
    "Sentra",
    "Altima",
    "Kicks",
    "Rogue",
    "Murano",
    "Pathfinder",
    "Frontier",
  ],

  Porsche: [
    "718",
    "911",
    "Macan",
    "Cayenne",
    "Panamera",
    "Taycan",
  ],

  Ram: [
    "1500",
    "2500",
    "3500",
  ],

  Subaru: [
    "Impreza",
    "Legacy",
    "Crosstrek",
    "Forester",
    "Outback",
    "Ascent",
    "WRX",
  ],

  Tesla: [
    "Model 3",
    "Model Y",
    "Model S",
    "Model X",
    "Cybertruck",
  ],

  Toyota: [
    "Corolla",
    "Camry",
    "Prius",
    "C-HR",
    "Corolla Cross",
    "RAV4",
    "Highlander",
    "4Runner",
    "Tacoma",
    "Tundra",
  ],

  Volkswagen: [
    "Jetta",
    "Golf",
    "Taos",
    "Tiguan",
    "Atlas",
    "ID.4",
  ],

  Volvo: [
    "S60",
    "S90",
    "XC40",
    "XC60",
    "XC90",
    "EX30",
    "EX90",
  ],
};

