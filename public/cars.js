// Car makes and popular enthusiast models for the sell form's suggestions. Anyone can still type something
// that isn't listed. Models here are merged with NHTSA's full list for the chosen make and year.
export const MODELS = {
  Acura: ["Integra", "Integra Type R", "RSX", "RSX Type-S", "NSX", "TSX", "TL", "TLX", "ILX", "Legend", "CL", "RL", "MDX", "RDX"],
  "Alfa Romeo": ["Giulia", "Giulia Quadrifoglio", "Stelvio", "4C", "Spider", "GTV", "Milano", "164"],
  AMC: ["AMX", "Javelin", "Gremlin", "Hornet", "Pacer", "Eagle", "Rebel", "Matador"],
  "Aston Martin": ["DB7", "DB9", "DB11", "DBS", "Vantage", "V8 Vantage", "Vanquish", "Rapide"],
  Audi: ["A3", "A4", "A5", "A6", "A8", "S3", "S4", "S5", "S6", "S8", "RS3", "RS4", "RS5", "RS6", "RS7", "TT", "TT RS", "R8", "Q5", "SQ5", "Q7", "Allroad", "Quattro", "90", "100", "200"],
  "Austin-Healey": ["Sprite", "100", "3000"],
  Bentley: ["Continental GT", "Flying Spur", "Bentayga", "Arnage", "Mulsanne"],
  BMW: ["1 Series", "128i", "135i", "1M", "2 Series", "230i", "M235i", "M240i", "M2", "3 Series", "318i", "325i", "328i", "330i", "335i", "340i", "M3", "4 Series", "M4", "5 Series", "525i", "528i", "530i", "535i", "540i", "M5", "6 Series", "M6", "7 Series", "8 Series", "850i", "M8", "X3", "X5", "X5 M", "Z3", "Z3 M", "Z4", "Z4 M", "Z8", "2002", "i3", "i8"],
  Buick: ["Grand National", "GNX", "Regal", "Riviera", "Skylark", "LeSabre", "Century", "Electra", "Wildcat", "Roadmaster", "Enclave"],
  Cadillac: ["CTS", "CTS-V", "ATS", "ATS-V", "CT4-V", "CT5-V", "Escalade", "Eldorado", "DeVille", "Fleetwood", "Seville", "XLR"],
  Chevrolet: ["Camaro", "Camaro SS", "Camaro ZL1", "Corvette", "Chevelle", "Chevelle SS", "El Camino", "Impala", "Impala SS", "Nova", "Bel Air", "Monte Carlo", "Malibu", "SS", "Cobalt SS", "Cruze", "Sonic", "Spark", "Blazer", "K5 Blazer", "Tahoe", "Suburban", "Silverado", "C10", "C/K 1500", "S-10", "Colorado", "Astro", "Caprice", "Bolt", "Volt", "Trailblazer SS", "SSR", "HHR SS"],
  Chrysler: ["300", "300C SRT8", "Crossfire", "PT Cruiser", "Pacifica", "Town & Country", "New Yorker", "Imperial", "Prowler"],
  Datsun: ["240Z", "260Z", "280Z", "280ZX", "510", "620", "1200", "Fairlady", "Roadster"],
  DeLorean: ["DMC-12"],
  Dodge: ["Challenger", "Challenger SRT Hellcat", "Charger", "Viper", "Dart", "Neon SRT-4", "Caliber SRT4", "Durango", "Ram 1500", "Dakota", "Magnum", "Stealth", "Coronet", "Super Bee", "Demon", "Polara", "Power Wagon", "Grand Caravan"],
  Ferrari: ["308", "328", "348", "355", "360", "430", "458", "488", "F8", "California", "Portofino", "Roma", "Testarossa", "550 Maranello", "575M", "599", "612", "812"],
  Fiat: ["124 Spider", "500", "500 Abarth", "X1/9", "Spider 2000"],
  Ford: ["Mustang", "Mustang GT", "Mustang Mach 1", "Mustang SVT Cobra", "Shelby GT350", "Shelby GT500", "Mustang Mach-E", "Bronco", "Bronco Sport", "F-100", "F-150", "F-150 Raptor", "F-250", "Ranger", "Lightning", "Focus", "Focus ST", "Focus RS", "Fiesta", "Fiesta ST", "Fusion", "Taurus", "Taurus SHO", "Thunderbird", "Falcon", "Fairlane", "Galaxie", "Torino", "Crown Victoria", "Escort", "Probe", "Explorer", "Expedition", "Excursion", "Escape", "Maverick", "Model A", "Model T", "GT", "Ford GT"],
  Genesis: ["G70", "G80", "G90", "Coupe"],
  GMC: ["Sierra", "Syclone", "Typhoon", "Jimmy", "Yukon", "Canyon", "Sonoma", "Hummer EV"],
  Honda: ["Civic", "Civic Si", "Civic Type R", "Civic CRX", "CRX", "Accord", "Prelude", "S2000", "Integra", "NSX", "Del Sol", "Fit", "Insight", "CR-V", "Element", "Ridgeline", "Pilot", "Odyssey", "S600", "Beat"],
  Hummer: ["H1", "H2", "H3"],
  Hyundai: ["Elantra N", "Veloster N", "Veloster", "Genesis Coupe", "Ioniq 5 N", "Kona N", "Sonata", "Tiburon"],
  Infiniti: ["G35", "G37", "Q50", "Q60", "FX35", "FX45", "M35", "M45", "Q45", "QX56"],
  International: ["Scout", "Scout II", "Travelall", "Pickup"],
  Isuzu: ["Trooper", "Rodeo", "VehiCROSS", "Impulse", "Amigo", "Pickup"],
  Jaguar: ["E-Type", "XK", "XKR", "XJ", "XJS", "XJR", "XF", "XE", "F-Type", "F-Pace", "S-Type", "X-Type"],
  Jeep: ["Wrangler", "Wrangler Rubicon", "Cherokee", "Cherokee XJ", "Grand Cherokee", "Grand Cherokee SRT", "Grand Cherokee Trackhawk", "CJ-5", "CJ-7", "Scrambler", "Wagoneer", "Grand Wagoneer", "Gladiator", "Comanche", "Liberty", "Commander", "Renegade", "Willys"],
  Kia: ["Stinger", "Stinger GT", "Forte GT", "K5 GT", "EV6 GT", "Soul", "Telluride"],
  Lamborghini: ["Gallardo", "Huracán", "Murciélago", "Aventador", "Urus", "Diablo", "Countach"],
  "Land Rover": ["Defender", "Defender 90", "Defender 110", "Discovery", "Range Rover", "Range Rover Sport", "LR3", "LR4", "Series II", "Series III"],
  Lexus: ["IS 300", "IS 350", "IS F", "IS 500", "GS 300", "GS 400", "GS 430", "GS F", "LS 400", "LS 430", "LS 460", "SC 300", "SC 400", "SC 430", "RC F", "LC 500", "LFA", "GX 460", "GX 470", "LX 450", "LX 470", "RX"],
  Lincoln: ["Continental", "Town Car", "Mark VIII", "LS", "Navigator", "Mark LT", "Zephyr"],
  Lotus: ["Elise", "Exige", "Evora", "Esprit", "Elan", "Europa", "Emira", "Seven"],
  Maserati: ["GranTurismo", "Ghibli", "Quattroporte", "Levante", "MC20", "Biturbo", "Coupe", "Spyder"],
  Mazda: ["MX-5 Miata", "Miata", "RX-7", "RX-8", "Mazdaspeed3", "Mazdaspeed6", "MazdaSpeed Miata", "Mazda3", "Mazda6", "Protegé", "MP3", "323 GTX", "626", "929", "B-Series", "CX-5", "CX-9", "Cosmo", "RX-3", "RX-2"],
  McLaren: ["MP4-12C", "570S", "600LT", "650S", "675LT", "720S", "765LT", "Artura", "GT"],
  "Mercedes-Benz": ["C-Class", "C 63 AMG", "E-Class", "E 55 AMG", "E 63 AMG", "S-Class", "SL", "SL 55 AMG", "SLK", "SLK 55 AMG", "CLK", "CLK 63 AMG", "CLS", "G-Class", "G 500", "G 63 AMG", "GLK", "ML", "190E", "190E 2.3-16", "300SL", "280SL", "W123", "W124", "500E", "Sprinter", "AMG GT", "SLS AMG"],
  Mercury: ["Cougar", "Marauder", "Grand Marquis", "Capri", "Comet", "Cyclone", "Sable"],
  MG: ["MGB", "MGA", "Midget", "MG TD", "MG TF"],
  Mini: ["Cooper", "Cooper S", "John Cooper Works", "Clubman", "Countryman", "Classic Mini"],
  Mitsubishi: ["Lancer Evolution", "Lancer Evo VIII", "Lancer Evo IX", "Lancer Evo X", "Lancer Ralliart", "3000GT", "3000GT VR-4", "Eclipse", "Eclipse GSX", "Galant VR-4", "Starion", "Montero", "Pajero", "Delica", "Mirage"],
  Nissan: ["Skyline GT-R", "Skyline", "GT-R", "350Z", "370Z", "Z", "300ZX", "240SX", "Silvia", "180SX", "Sentra SE-R", "Sentra Spec-V", "Altima", "Maxima", "Frontier", "Hardbody", "Xterra", "Pathfinder", "Patrol", "Titan", "Leaf", "Juke Nismo", "Pao", "Figaro", "Cedric", "Laurel", "Stagea", "Cefiro"],
  Oldsmobile: ["442", "Cutlass", "Cutlass Supreme", "Toronado", "Delta 88", "Hurst/Olds", "Aurora", "Bravada"],
  Plymouth: ["Barracuda", "'Cuda", "Road Runner", "Superbird", "GTX", "Duster", "Fury", "Valiant", "Satellite", "Belvedere", "Prowler"],
  Pontiac: ["GTO", "Firebird", "Trans Am", "Fiero", "Grand Prix", "Bonneville", "Catalina", "LeMans", "Tempest", "Solstice", "G8", "G8 GT", "Vibe", "Aztek"],
  Porsche: ["911", "911 Carrera", "911 Turbo", "911 GT3", "911 GT2", "912", "914", "924", "928", "930", "944", "944 Turbo", "968", "993", "996", "997", "991", "992", "Boxster", "Boxster S", "Cayman", "Cayman S", "Cayman GT4", "Cayenne", "Macan", "Panamera", "Taycan", "356", "Carrera GT"],
  Ram: ["1500", "1500 TRX", "2500", "3500", "ProMaster"],
  "Rolls-Royce": ["Ghost", "Phantom", "Wraith", "Dawn", "Cullinan", "Silver Shadow", "Silver Spur"],
  Saab: ["900", "900 Turbo", "900 SPG", "9-3", "9-3 Viggen", "9-5", "9-5 Aero", "99", "96", "Sonett"],
  Saturn: ["Sky", "Sky Red Line", "Ion Red Line", "SL", "SC", "Vue"],
  Scion: ["FR-S", "tC", "xB", "xA", "xD", "iQ"],
  Shelby: ["Cobra", "GT350", "GT500", "Series 1"],
  Subaru: ["WRX", "WRX STI", "Impreza", "Impreza 2.5RS", "Impreza WRX", "Impreza WRX STI", "BRZ", "Legacy", "Legacy GT", "Legacy Spec B", "Outback", "Outback Sport", "Forester", "Forester XT", "Baja", "SVX", "XT", "XT6", "Brat", "Crosstrek", "Ascent", "Sambar", "GL"],
  Suzuki: ["Samurai", "Sidekick", "Jimny", "Swift", "Swift GT", "Cappuccino", "Grand Vitara", "X-90", "Kizashi"],
  Tesla: ["Model S", "Model 3", "Model X", "Model Y", "Roadster", "Cybertruck"],
  Toyota: ["Supra", "GR Supra", "MR2", "MR2 Spyder", "Celica", "Celica GT-Four", "Corolla", "Corolla AE86", "Corolla GR", "GR86", "86", "GR Corolla", "Camry", "Camry TRD", "Avalon", "Cressida", "Chaser", "Mark II", "Soarer", "Aristo", "Crown", "Century", "Land Cruiser", "Land Cruiser FJ40", "Land Cruiser FJ60", "Land Cruiser FJ80", "Land Cruiser 100", "FJ Cruiser", "4Runner", "Tacoma", "Tundra", "Pickup", "Hilux", "T100", "Sequoia", "Previa", "Sienna", "Prius", "Matrix", "Yaris", "Echo", "RAV4", "Highlander", "Sera", "Sprinter Trueno", "Starlet", "2000GT"],
  Triumph: ["TR6", "TR4", "TR3", "TR7", "Spitfire", "GT6", "Stag"],
  Volkswagen: ["Golf", "GTI", "Golf R", "R32", "Jetta", "Jetta GLI", "Beetle", "Super Beetle", "Bus", "Type 2", "Vanagon", "Westfalia", "Karmann Ghia", "Thing", "Corrado", "Scirocco", "Rabbit", "Rabbit Pickup", "Passat", "Passat W8", "Phaeton", "Touareg", "Tiguan", "Atlas", "ID.4"],
  Volvo: ["240", "242", "244", "245", "740", "760", "850", "850 R", "940", "960", "P1800", "Amazon", "C30", "S60", "S60 R", "V70 R", "V60", "V90", "XC70", "XC90"],
};

export const MAKES = Object.keys(MODELS).concat(["Other"]);

// Best match first: exact, then starts with, then a word starts with, then contains anywhere.
export function rank(list, query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, limit);
  const norm = (s) => s.toLowerCase();
  const scored = [];
  for (const item of list) {
    const s = norm(item);
    const squash = s.replace(/[^a-z0-9]/g, "");
    const qs = q.replace(/[^a-z0-9]/g, "");
    let score = -1;
    if (s === q) score = 0;
    else if (s.startsWith(q) || (qs && squash.startsWith(qs))) score = 1;
    else if (s.split(/[\s\-/]+/).some((w) => w.startsWith(q))) score = 2;
    else if (s.includes(q) || (qs && squash.includes(qs))) score = 3;
    if (score >= 0) scored.push([score, s.length, item]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]));
  return scored.slice(0, limit).map((x) => x[2]);
}
