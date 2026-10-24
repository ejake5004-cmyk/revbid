// Demo data so a fresh install has auctions to look at. Runs only when the database is empty.
import { hashPassword } from "./app.ts";
import type { DB } from "./db.ts";
import { minIncrement, sellerFee } from "./engine.ts";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const DEMO_PASSWORD = "revbid123";

const PEOPLE = [
  ["admin", "Spokane, WA", 1, 1],
  ["casey_l_spk", "Cheney, WA", 1, 0],
  ["ivy_m3", "Seattle, WA", 1, 0],
  ["noor_na", "Portland, OR", 1, 0],
  ["gus_garage", "Boise, ID", 1, 0],
  ["wes_wagon", "Missoula, MT", 1, 0],
  ["avery_t", "Tacoma, WA", 1, 0],
  ["kit_wrench", "Tulsa, OK", 1, 0],
  ["bea_boost", "Austin, TX", 1, 0],
] as const;

type Car = {
  seller: string;
  year: number; make: string; model: string; subtitle: string; category: string; location: string;
  mileage: number; engine: string; transmission: string; drivetrain: string; body: string;
  exterior: string; interior: string; fuel: string; story: string; mods: string; issues: string; service: string;
  startingBid: number; reserve: number | null; buyNow?: number | null;
  // minutes relative to now: when it started and when it ends (negative = already over)
  startedAgo: number; endsIn: number; bidders: number; topBid: number;
};

const CARS: Car[] = [
  {
    seller: "kit_wrench", year: 2013, make: "Ford", model: "Shelby GT500", subtitle: "662 hp Trinity, 19k miles, SVT Performance Pack",
    category: "performance", location: "Oklahoma City, OK", mileage: 19_200, engine: "5.8L supercharged V8", transmission: "6-speed manual",
    drivetrain: "RWD", body: "Coupe", exterior: "Black", interior: "Black leather", fuel: "Gasoline",
    story: "Bought from the original owner in 2019. Garage kept, never tracked, and driven on dry weekends only. It has the SVT Performance Pack and the glass roof. I'm selling because I need the garage space for a project.",
    mods: "Borla ATAK cat-back exhaust (stock exhaust included)", issues: "Small rock chips on the front bumper\nDriver seat bolster shows light wear",
    service: "Oil changed every 3k miles with Motorcraft synthetic. New Michelin PS4S tires at 17k.",
    startingBid: 5_000, reserve: 32_000, buyNow: null, startedAgo: 5 * DAY / MIN, endsIn: 2 * DAY / MIN + 20 * 60, bidders: 9, topBid: 13_000,
  },
  {
    seller: "bea_boost", year: 2019, make: "Chevrolet", model: "Camaro ZL1 1LE", subtitle: "ZL1 1LE six-speed, 12k miles, four track days",
    category: "performance", location: "Tulsa, OK", mileage: 12_400, engine: "6.2L supercharged V8", transmission: "6-speed manual",
    drivetrain: "RWD", body: "Coupe", exterior: "Bright Yellow", interior: "Jet Black", fuel: "Gasoline",
    story: "Track-focused ZL1 1LE that has seen four HPDE days at Hallett. Fluids changed after each event. It's loud, sticky, and still feels brand new on the street.",
    mods: "Stock", issues: "Front splitter has scrapes underneath\nTires at about 40%",
    service: "Brake fluid and pads after every track day. Records included.",
    startingBid: 10_000, reserve: 48_000, startedAgo: 6 * DAY / MIN, endsIn: 3.5, bidders: 6, topBid: 17_000,
  },
  {
    seller: "wes_wagon", year: 2016, make: "Subaru", model: "Outback 2.5i Premium", subtitle: "AWD wagon with roof racks, starts at -20",
    category: "unique", location: "Spokane, WA", mileage: 142_000, engine: "2.5L flat-four", transmission: "CVT",
    drivetrain: "AWD", body: "Wagon", exterior: "Twilight Blue", interior: "Gray cloth", fuel: "Gasoline",
    story: "The family hauler. Ski trips, dog trips, Costco trips. It has never failed to start, even at twenty below. We bought a minivan, so the Outback needs a new home.",
    mods: "Thule roof box rails", issues: "Windshield has a small chip\nRear hatch strut is weak",
    service: "CVT fluid changed at 100k. Head gaskets were never an issue on this generation.",
    startingBid: 25, reserve: null, startedAgo: 4 * DAY / MIN, endsIn: 61, bidders: 7, topBid: 1_100,
  },
  {
    seller: "gus_garage", year: 2012, make: "Jeep", model: "Grand Cherokee Laredo", subtitle: "3.6 V6, 4WD, works, comfortable, no reserve",
    category: "project", location: "Post Falls, ID", mileage: 168_000, engine: "3.6L Pentastar V6", transmission: "5-speed automatic",
    drivetrain: "4WD", body: "SUV", exterior: "Deep Cherry Red", interior: "Black cloth", fuel: "Gasoline",
    story: "Daily driver for six years. It still does everything right, but the oil cooler is starting to weep and I don't have time to do it. A good weekend project.",
    mods: "Stock", issues: "Oil cooler housing seeps\nCheck engine light (P0456, small EVAP leak)\nCracked rear bumper cover",
    service: "Water pump and thermostat replaced at 140k.",
    startingBid: 25, reserve: null, startedAgo: 3 * DAY / MIN, endsIn: 97, bidders: 5, topBid: 700,
  },
  {
    seller: "noor_na", year: 1999, make: "Honda", model: "Civic Si EM1", subtitle: "K24 swapped EM1, Electron Blue, 240 whp",
    category: "modified", location: "San Jose, CA", mileage: 211_000, engine: "K24A2 swap", transmission: "6-speed manual",
    drivetrain: "FWD", body: "Coupe", exterior: "Electron Blue Pearl", interior: "Black", fuel: "Gasoline",
    story: "Built over four years with a clean K24 swap from a TSX. Tuned on Hondata KPro and makes 240 whp. It's a fun street car with a little noise.",
    mods: "K24A2 engine and 6-speed\nHondata KPro tune\nBC coilovers\nSpoon calipers\nKonig wheels",
    issues: "Paint fading on the roof\nWindow motor is slow on the passenger side",
    service: "Engine has 60k on it since the swap. New clutch at the swap.",
    startingBid: 2_000, reserve: 9_000, startedAgo: 2 * DAY / MIN, endsIn: 22 * 60 + 43, bidders: 6, topBid: 3_850,
  },
  {
    seller: "avery_t", year: 1987, make: "Saab", model: "900 Turbo SPG", subtitle: "Saab 900 SPG, 16-valve turbo, 141k miles",
    category: "classic", location: "Milwaukee, WI", mileage: 141_000, engine: "2.0L turbo four", transmission: "5-speed manual",
    drivetrain: "FWD", body: "Hatchback", exterior: "Pearl Blue", interior: "Gray leather", fuel: "Gasoline",
    story: "An honest SPG that has always been registered and driven. It has the original three-spoke wheels and the factory body kit. A great entry into classic Saabs.",
    mods: "Stock", issues: "Headliner sagging\nA/C needs a recharge\nSmall rust bubble on the left rear wheel arch",
    service: "Timing chain guides and water pump at 135k.",
    startingBid: 500, reserve: null, startedAgo: DAY / MIN, endsIn: DAY / MIN + 100, bidders: 5, topBid: 2_800,
  },
  {
    seller: "ivy_m3", year: 2005, make: "Honda", model: "S2000 AP2", subtitle: "One-owner AP2, Silverstone, 71k miles",
    category: "performance", location: "Tempe, AZ", mileage: 71_000, engine: "2.2L F22C1 four", transmission: "6-speed manual",
    drivetrain: "RWD", body: "Convertible", exterior: "Silverstone Metallic", interior: "Black leather", fuel: "Gasoline",
    story: "One owner from new. The top is the original glass-window soft top and it doesn't leak. Every service was done at the dealer and the records come with it.",
    mods: "Stock", issues: "Driver seat outer bolster worn\nSmall door ding on the passenger side",
    service: "Valves adjusted at 60k. Differential and transmission fluid at 65k.",
    startingBid: 5_000, reserve: 22_000, startedAgo: 3 * 60, endsIn: 6 * DAY / MIN, bidders: 4, topBid: 7_300,
  },
  {
    seller: "casey_l_spk", year: 2015, make: "BMW", model: "328i Sport Line", subtitle: "Sport seats, navigation, drives tight at 98k",
    category: "unique", location: "Coeur d'Alene, ID", mileage: 98_000, engine: "2.0L turbo four", transmission: "8-speed automatic",
    drivetrain: "RWD", body: "Sedan", exterior: "Estoril Blue", interior: "Black Dakota leather", fuel: "Gasoline",
    story: "A clean F30 with the Sport Line package. Commuter car for the last five years. It has new tires and the timing chain was done preventively.",
    mods: "Stock", issues: "Small scratch on the rear bumper", service: "Timing chain replaced at 80k. Oil every 7.5k.",
    startingBid: 1_000, reserve: null, startedAgo: 20 * 60, endsIn: 2 * DAY / MIN + 10 * 60, bidders: 4, topBid: 5_200,
  },
  {
    seller: "gus_garage", year: 1969, make: "Chevrolet", model: "Chevelle SS 396", subtitle: "Real SS 396, four-speed, frame-off in 2014",
    category: "classic", location: "Indianapolis, IN", mileage: 3_400, engine: "396 V8", transmission: "4-speed manual",
    drivetrain: "RWD", body: "Coupe", exterior: "Hugger Orange", interior: "Black vinyl", fuel: "Gasoline",
    story: "A documented SS with the build sheet. The frame-off restoration was finished in 2014 and it has only 3,400 miles since. It starts, runs, and stops the way it should.",
    mods: "Electronic ignition\nPower front disc brakes", issues: "Small chip on the hood edge\nClock doesn't work",
    service: "Fluids changed every spring.",
    startingBid: 15_000, reserve: 55_000, buyNow: 85_000, startedAgo: 60, endsIn: 7 * DAY / MIN - 60, bidders: 1, topBid: 15_000,
  },
  {
    seller: "casey_l_spk", year: 2013, make: "Toyota", model: "Camry LE", subtitle: "Reliable commuter, heat and A/C work, no reserve",
    category: "unique", location: "Cheney, WA", mileage: 133_420, engine: "2.5L inline-four", transmission: "Automatic",
    drivetrain: "FWD", body: "Sedan", exterior: "Super White", interior: "Ash cloth", fuel: "Gasoline",
    story: "I teach in Cheney and this has been the car that gets me there. It is a Camry LE with 133k miles and it does exactly what you'd expect: starts, drives, gets about 32 on the highway, and asks for nothing except oil changes.",
    mods: "Stock", issues: "Scuffs on the rear bumper\nScratches on the trunk lid\nOnly one key\nDriver's door speaker crackles at high volume",
    service: "Oil changes every 5k at a local shop. Brakes front and rear last fall. Tires at 110k.",
    startingBid: 25, reserve: null, startedAgo: 7 * DAY / MIN, endsIn: -18 * 60, bidders: 8, topBid: 1_750,
  },
  {
    seller: "bea_boost", year: 2004, make: "Volkswagen", model: "R32 Mk4", subtitle: "Mk4 R32, salvage title, needs transmission work",
    category: "project", location: "Cleveland, OH", mileage: 156_000, engine: "3.2L VR6", transmission: "6-speed manual",
    drivetrain: "AWD", body: "Hatchback", exterior: "Deep Blue Pearl", interior: "Black leather", fuel: "Gasoline",
    story: "Rare Mk4 R32 on a salvage title from a hail claim years ago. The 6-speed pops out of 3rd. Everything else works. A great project for the right person.",
    mods: "Stock", issues: "Salvage title (hail)\nTransmission pops out of 3rd gear\nHail dimples on the roof",
    service: "Timing chains were done at 120k.",
    startingBid: 1_000, reserve: 6_000, startedAgo: 8 * DAY / MIN, endsIn: -2 * DAY / MIN, bidders: 4, topBid: 2_250,
  },
];

export function seed(db: DB, now = Date.now(), adminPassword = process.env.ADMIN_PASSWORD) {
  const n = (db.prepare("SELECT COUNT(*) n FROM users").get() as { n: number }).n;
  if (n > 0) return false;

  const hash = hashPassword(DEMO_PASSWORD);
  // On a public copy, set ADMIN_PASSWORD so strangers can't sign in as admin with the demo password.
  const adminHash = adminPassword ? hashPassword(adminPassword) : hash;
  const ids = new Map<string, number>();
  for (const [username, location, verified, admin] of PEOPLE) {
    const r = db
      .prepare("INSERT INTO users (username, email, pass_hash, location, verified, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(username, `${username}@example.com`, admin ? adminHash : hash, location, verified, admin, now - 400 * DAY);
    ids.set(username, Number(r.lastInsertRowid));
  }
  const bidders = PEOPLE.filter(([u, , , a]) => !a).map(([u]) => u);

  for (const car of CARS) {
    const startedAt = now - car.startedAgo * MIN;
    const endsAt = now + car.endsIn * MIN;
    const ended = car.endsIn < 0;
    const r = db
      .prepare(
        `INSERT INTO listings (seller_id, year, make, model, subtitle, category, location, vin, mileage, engine, transmission,
         drivetrain, body, exterior, interior, fuel, story, mods, issues, service, starting_bid, reserve, buy_now, duration_ms,
         status, ends_at, created_at, started_at, views)
         VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', ?, ?, ?, ?)`,
      )
      .run(
        ids.get(car.seller)!, car.year, car.make, car.model, car.subtitle, car.category, car.location, car.mileage, car.engine,
        car.transmission, car.drivetrain, car.body, car.exterior, car.interior, car.fuel, car.story, car.mods, car.issues,
        car.service, car.startingBid, car.reserve, car.buyNow ?? null, endsAt - startedAt, endsAt, startedAt - HOUR, startedAt,
        200 + Math.round(car.topBid / 7),
      );
    const id = Number(r.lastInsertRowid);

    // Walk bids up from the start to the top bid by valid increments, spread over the auction.
    const pool = bidders.filter((b) => b !== car.seller).slice(0, car.bidders);
    const amounts: number[] = [];
    let amt = car.startingBid;
    while (amt < car.topBid) {
      amounts.push(amt);
      amt += minIncrement(amt) * (amounts.length % 3 === 0 ? 2 : 1);
    }
    amounts.push(car.topBid);
    const lastAt = Math.min(now - 2 * MIN, endsAt - 10 * MIN);
    let prev = "";
    amounts.forEach((a, i) => {
      let who = pool[(i * 7 + a) % pool.length];
      if (who === prev) who = pool[(pool.indexOf(who) + 1) % pool.length];
      prev = who;
      const at = Math.round(startedAt + ((lastAt - startedAt) * (i + 1)) / amounts.length);
      db.prepare("INSERT INTO bids (listing_id, bidder_id, amount, at) VALUES (?, ?, ?, ?)").run(id, ids.get(who)!, a, at);
    });
    if (ended) {
      const sold = car.reserve === null || car.topBid >= car.reserve;
      if (sold)
        db.prepare("UPDATE listings SET status = 'sold', winner_id = ?, final_price = ?, seller_fee = ? WHERE id = ?").run(
          ids.get(prev)!, car.topBid, sellerFee(car.topBid), id,
        );
      else db.prepare("UPDATE listings SET status = 'unsold' WHERE id = ?").run(id);
    }
    for (const w of pool.slice(0, 1 + (id % 4))) {
      db.prepare("INSERT INTO watches (user_id, listing_id) VALUES (?, ?)").run(ids.get(w)!, id);
    }
  }

  // A couple of comment threads, including a seller reply.
  const camry = (db.prepare("SELECT id FROM listings WHERE model = 'Camry LE'").get() as { id: number }).id;
  const c1 = db
    .prepare("INSERT INTO comments (listing_id, user_id, body, at) VALUES (?, ?, ?, ?)")
    .run(camry, ids.get("noor_na")!, "Any rust underneath? Pictures of the rockers would help.", now - 4 * DAY);
  db.prepare("INSERT INTO comments (listing_id, user_id, parent_id, body, at) VALUES (?, ?, ?, ?, ?)").run(
    camry, ids.get("casey_l_spk")!, Number(c1.lastInsertRowid), "Good question. Underside is solid, I'll add photos tonight.", now - 4 * DAY + 3 * HOUR,
  );
  const gt = (db.prepare("SELECT id FROM listings WHERE model = 'Shelby GT500'").get() as { id: number }).id;
  db.prepare("INSERT INTO comments (listing_id, user_id, body, at) VALUES (?, ?, ?, ?)").run(
    gt, ids.get("gus_garage")!, "Is the stock exhaust really included? That's a nice touch.", now - DAY,
  );

  // One listing waiting in the review queue so the admin page has something to show.
  db.prepare(
    `INSERT INTO listings (seller_id, year, make, model, subtitle, category, location, mileage, engine, transmission, drivetrain,
     body, exterior, interior, fuel, story, mods, issues, service, starting_bid, reserve, duration_ms, created_at)
     VALUES (?, 1995, 'Ford', 'Mustang SVT Cobra', 'Cobra R tribute, 351W, Tremec', 'modified', 'Birmingham, AL', 88000,
     '351W V8', '5-speed manual', 'RWD', 'Coupe', 'Red', 'Gray cloth', 'Gasoline',
     'Built as a tribute to the 1995 Cobra R with a 351 Windsor and a Tremec five-speed. Strong, loud and very fun.',
     '351W swap\nTremec TKO 500\nCobra R hood', 'Clutch is heavy\nSmall tear in the driver seat', '', 4000, 14000, ?, ?)`,
  ).run(ids.get("kit_wrench")!, 7 * DAY, now - HOUR);
  return true;
}
