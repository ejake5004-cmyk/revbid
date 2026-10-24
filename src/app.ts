// RevBid web server: a JSON API, a live event stream, and the static site in public/.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, tx, loadAuction, type DB, type ListingRow } from "./db.ts";
import { normalizeUsPhone, verifierFromEnv, type PhoneVerifier } from "./phone.ts";
import {
  placeBid,
  closeAuction,
  lowerReserve,
  publicView,
  sellerFee,
  highBid,
  type BidRejection,
} from "./engine.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_BODY = 30 * 1024 * 1024;
const MAX_PHOTOS = 12;

export const CATEGORIES = ["jdm", "modified", "project", "classic", "performance", "unique"];
export const DURATIONS: Record<string, number> = {
  "10m": 10 * 60 * 1000, // short demo auctions, handy for trying the close
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const BID_MESSAGES: Record<BidRejection, string> = {
  auction_not_live: "This auction isn't taking bids.",
  auction_ended: "This auction has ended.",
  bidder_not_verified: "Verify your account before you bid.",
  seller_cannot_bid: "You can't bid on your own car.",
  already_high_bidder: "You're already the high bidder.",
  not_whole_dollars: "Bids are in whole dollars.",
  below_minimum: "Your bid is below the minimum.",
};

class HttpError extends Error {
  status: number;
  extra: object;
  constructor(status: number, message: string, extra: object = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

interface User {
  id: number;
  username: string;
  email: string;
  location: string;
  verified: number;
  is_admin: number;
  created_at: number;
}

interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: string[];
  user: User | null;
  body: any;
}

export interface AppOptions {
  dbFile: string;
  uploadsDir: string;
  now?: () => number;
  closeEveryMs?: number;
  // null means no automatic verification: the admin verifies people by hand.
  phoneVerifier?: PhoneVerifier | null;
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pw, salt, 32).toString("hex")}`;
}

function checkPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const got = scryptSync(pw, Buffer.from(salt, "hex"), 32);
  return timingSafeEqual(got, Buffer.from(hash, "hex"));
}

export function createApp(opts: AppOptions) {
  const db: DB = openDb(opts.dbFile);
  const now = opts.now ?? Date.now;
  const verifier = opts.phoneVerifier !== undefined ? opts.phoneVerifier : verifierFromEnv(process.env);
  const codeSends = new Map<number, number[]>(); // user id → recent send times, to cap texts per hour
  mkdirSync(opts.uploadsDir, { recursive: true });

  // ---- live events (server-sent events) ----
  const streams = new Set<ServerResponse>();
  function broadcast(event: object) {
    const line = `data: ${JSON.stringify(event)}\n\n`;
    for (const s of streams) s.write(line);
  }
  const heartbeat = setInterval(() => {
    for (const s of streams) s.write(": ping\n\n");
  }, 25_000);

  // ---- helpers ----
  const userById = (id: number) =>
    db.prepare("SELECT id, username, email, location, verified, is_admin, created_at FROM users WHERE id = ?").get(id) as
      | User
      | undefined;

  function getListing(id: number): ListingRow {
    const row = db.prepare("SELECT * FROM listings WHERE id = ?").get(id) as ListingRow | undefined;
    if (!row) throw new HttpError(404, "That listing doesn't exist.");
    return row;
  }

  function sellerStats(sellerId: number) {
    const r = db
      .prepare(
        `SELECT SUM(status = 'sold') sold, SUM(status IN ('live','sold','unsold')) listed FROM listings WHERE seller_id = ?`,
      )
      .get(sellerId) as { sold: number | null; listed: number | null };
    return { sold: r.sold ?? 0, listed: r.listed ?? 0 };
  }

  // Card-sized summary for grids and the live ticker. Never includes the reserve amount.
  function summary(row: ListingRow) {
    const view = row.status === "pending" || row.status === "rejected" ? null : publicView(loadAuction(db, row));
    const watchers = (db.prepare("SELECT COUNT(*) n FROM watches WHERE listing_id = ?").get(row.id) as { n: number }).n;
    return {
      id: row.id,
      year: row.year,
      make: row.make,
      model: row.model,
      subtitle: row.subtitle,
      exterior: row.exterior,
      body: row.body,
      category: row.category,
      location: row.location,
      photos: JSON.parse(row.photos as string),
      status: row.status,
      startingBid: row.starting_bid,
      currentBid: view?.currentBid ?? null,
      bidCount: view?.bidCount ?? 0,
      minimumNextBid: view?.minimumNextBid ?? row.starting_bid,
      endsAt: row.ends_at,
      hasReserve: row.reserve !== null,
      reserveMet: view?.reserveMet ?? false,
      buyNowPrice: row.buy_now,
      finalPrice: row.final_price,
      watchers,
      createdAt: row.created_at,
      startedAt: row.started_at,
    };
  }

  function detail(row: ListingRow, viewer: User | null) {
    const seller = userById(row.seller_id)!;
    const isSeller = viewer?.id === row.seller_id;
    const bids = db
      .prepare(
        `SELECT b.id, b.amount, b.at, u.username, b.bidder_id FROM bids b JOIN users u ON u.id = b.bidder_id
         WHERE listing_id = ? ORDER BY b.id DESC`,
      )
      .all(row.id) as { id: number; amount: number; at: number; username: string; bidder_id: number }[];
    const comments = db
      .prepare(
        `SELECT c.id, c.parent_id parentId, c.body, c.at, u.username, (c.user_id = ?) bySeller
         FROM comments c JOIN users u ON u.id = c.user_id WHERE listing_id = ? ORDER BY c.id`,
      )
      .all(row.seller_id, row.id);
    const watching = viewer
      ? !!db.prepare("SELECT 1 FROM watches WHERE user_id = ? AND listing_id = ?").get(viewer.id, row.id)
      : false;

    // Once sold, the buyer and seller see each other's contact details so they can settle directly.
    let handover = null;
    if (row.status === "sold" && viewer && (isSeller || viewer.id === row.winner_id)) {
      const other = userById(isSeller ? (row.winner_id as number) : row.seller_id)!;
      handover = {
        role: isSeller ? "seller" : "buyer",
        price: row.final_price,
        sellerFee: isSeller ? row.seller_fee : undefined,
        contact: { username: other.username, email: other.email, location: other.location },
      };
    }

    return {
      ...summary(row),
      vin: row.vin,
      mileage: row.mileage,
      titleStatus: row.title_status,
      runs: row.runs,
      engine: row.engine,
      transmission: row.transmission,
      drivetrain: row.drivetrain,
      body: row.body,
      exterior: row.exterior,
      interior: row.interior,
      fuel: row.fuel,
      story: row.story,
      mods: row.mods,
      issues: row.issues,
      service: row.service,
      views: row.views,
      extensionsUsed: row.extensions_used,
      rejectReason: isSeller || viewer?.is_admin ? row.reject_reason : undefined,
      reserve: isSeller || viewer?.is_admin ? row.reserve : undefined,
      seller: { username: seller.username, location: seller.location, since: seller.created_at, ...sellerStats(seller.id) },
      isSeller,
      highBidderIsYou: !!viewer && bids[0]?.bidder_id === viewer.id,
      bids: bids.map(({ bidder_id, ...b }) => b),
      comments,
      watching,
      handover,
    };
  }

  function finishSale(id: number, winnerId: number, price: number) {
    db.prepare("UPDATE listings SET status = 'sold', winner_id = ?, final_price = ?, seller_fee = ? WHERE id = ?").run(
      winnerId,
      price,
      sellerFee(price),
      id,
    );
  }

  // ---- auction close job ----
  function closeDue() {
    const due = db
      .prepare("SELECT * FROM listings WHERE status = 'live' AND ends_at <= ?")
      .all(now()) as ListingRow[];
    for (const r of due) {
      const closed = tx(db, () => {
        const row = getListing(r.id);
        if (row.status !== "live") return null;
        const { auction, winner } = closeAuction(loadAuction(db, row), now());
        if (auction.status === "live") return null;
        if (winner) finishSale(row.id, Number(winner.bidderId), winner.amount);
        else db.prepare("UPDATE listings SET status = 'unsold' WHERE id = ?").run(row.id);
        return getListing(row.id);
      });
      if (closed) broadcast({ type: "closed", listing: summary(closed) });
    }
  }
  const closer = setInterval(closeDue, opts.closeEveryMs ?? 1000);

  // ---- routes ----
  type Handler = (c: Ctx) => unknown;
  const routes: [string, RegExp, Handler][] = [];
  const route = (method: string, path: string, h: Handler) =>
    routes.push([method, new RegExp("^" + path.replace(/:\w+/g, "([^/]+)") + "$"), h]);

  const requireUser = (c: Ctx) => {
    if (!c.user) throw new HttpError(401, "Sign in first.");
    return c.user;
  };
  const requireAdmin = (c: Ctx) => {
    const u = requireUser(c);
    if (!u.is_admin) throw new HttpError(403, "Admins only.");
    return u;
  };
  const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const money = (v: unknown, label: string, optional = false): number | null => {
    if ((v === "" || v === null || v === undefined) && optional) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) throw new HttpError(400, `${label} must be a whole dollar amount.`);
    return n;
  };

  function startSession(res: ServerResponse, userId: number) {
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, now() + SESSION_MS);
    res.setHeader("Set-Cookie", `rb_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}`);
  }

  const me = (u: User) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    location: u.location,
    verified: !!u.verified,
    isAdmin: !!u.is_admin,
  });

  route("GET", "/api/me", (c) => ({
    user: c.user ? me(c.user) : null,
    serverTime: now(),
    contactEmail: process.env.CONTACT_EMAIL ?? "",
    verifyMode: verifier?.mode ?? "manual",
    demo: process.env.DEMO_DATA !== "off",
  }));

  route("POST", "/api/signup", (c) => {
    const username = str(c.body.username, 30);
    const email = str(c.body.email, 120).toLowerCase();
    const password = typeof c.body.password === "string" ? c.body.password : "";
    const location = str(c.body.location, 80);
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
      throw new HttpError(400, "Usernames are 3 to 30 letters, numbers or underscores.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Enter a valid email.");
    if (password.length < 8) throw new HttpError(400, "Passwords need at least 8 characters.");
    if (c.body.agreeTerms !== true) throw new HttpError(400, "Please agree to the Terms of Service and Privacy Policy.");
    if (db.prepare("SELECT 1 FROM users WHERE username = ? OR email = ?").get(username, email))
      throw new HttpError(409, "That username or email is already taken.");
    const r = db
      .prepare("INSERT INTO users (username, email, pass_hash, location, created_at, terms_accepted_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(username, email, hashPassword(password), location, now(), now());
    startSession(c.res, Number(r.lastInsertRowid));
    return { user: me(userById(Number(r.lastInsertRowid))!) };
  });

  route("POST", "/api/login", (c) => {
    const login = str(c.body.login, 120);
    const row = db.prepare("SELECT id, pass_hash FROM users WHERE username = ? OR email = ?").get(login, login) as
      | { id: number; pass_hash: string }
      | undefined;
    if (!row || !checkPassword(String(c.body.password ?? ""), row.pass_hash))
      throw new HttpError(401, "Wrong username or password.");
    startSession(c.res, row.id);
    return { user: me(userById(row.id)!) };
  });

  route("POST", "/api/logout", (c) => {
    const token = cookie(c.req, "rb_session");
    if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    c.res.setHeader("Set-Cookie", "rb_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return { ok: true };
  });

  // Phone verification: text a code, then check it. One account per phone number.
  function phoneFor(c: Ctx) {
    const u = requireUser(c);
    if (u.verified) throw new HttpError(409, "Your account is already verified.");
    if (!verifier) throw new HttpError(503, "Text verification isn't switched on yet. RevBid will verify your account by hand.");
    const phone = normalizeUsPhone(str(c.body.phone, 30));
    if (!phone) throw new HttpError(400, "Enter a US mobile number with area code.");
    const taken = db.prepare("SELECT id FROM users WHERE phone = ? AND id != ?").get(phone, u.id);
    if (taken) throw new HttpError(409, "That phone number is already used by another account.");
    return { u, phone };
  }

  route("POST", "/api/verify/start", async (c) => {
    const { u, phone } = phoneFor(c);
    const recent = (codeSends.get(u.id) ?? []).filter((t) => t > now() - 60 * 60 * 1000);
    if (recent.length >= 5) throw new HttpError(429, "That's a lot of codes. Wait an hour and try again.");
    codeSends.set(u.id, [...recent, now()]);
    try {
      await verifier!.start(phone);
    } catch (err) {
      throw new HttpError(502, (err as Error).message === "rate_limited"
        ? "Too many attempts for that number. Wait a few minutes and try again."
        : "We couldn't text that number. Check it and try again.");
    }
    return { sent: true, mode: verifier!.mode };
  });

  route("POST", "/api/verify", async (c) => {
    const { u, phone } = phoneFor(c);
    const code = str(c.body.code, 10).replace(/\D/g, "");
    if (code.length < 4) throw new HttpError(400, "Enter the code we texted you.");
    let ok = false;
    try {
      ok = await verifier!.check(phone, code);
    } catch {
      throw new HttpError(502, "We couldn't check that code right now. Try again in a minute.");
    }
    if (!ok) throw new HttpError(400, "That code is wrong or expired. Check the text, or send a new code.");
    db.prepare("UPDATE users SET verified = 1, phone = ? WHERE id = ?").run(phone, u.id);
    return { user: me(userById(u.id)!) };
  });

  // Until texts are switched on (and for edge cases after), the admin can verify people they know.
  route("GET", "/api/admin/users", (c) => {
    requireAdmin(c);
    const users = db
      .prepare("SELECT id, username, email, location, verified, created_at createdAt FROM users WHERE is_admin = 0 ORDER BY verified, id DESC LIMIT 200")
      .all();
    return { users };
  });

  route("POST", "/api/admin/users/:id/verify", (c) => {
    requireAdmin(c);
    const r = db.prepare("UPDATE users SET verified = ? WHERE id = ? AND is_admin = 0").run(c.body.verified === false ? 0 : 1, Number(c.params[0]));
    if (!r.changes) throw new HttpError(404, "No such user.");
    return { ok: true };
  });

  route("GET", "/api/listings", (c) => {
    const q = c.url.searchParams;
    const where = ["status IN ('live','sold','unsold')"];
    const args: (string | number)[] = [];
    const status = q.get("status") ?? "live";
    if (status === "live") where.push("status = 'live'");
    else if (status === "ended") where.push("status IN ('sold','unsold')");
    if (q.get("category")) {
      where.push("category = ?");
      args.push(q.get("category")!);
    }
    if (q.get("noReserve")) where.push("reserve IS NULL");
    if (q.get("q")) {
      for (const word of q.get("q")!.split(/\s+/).filter(Boolean).slice(0, 6)) {
        where.push("(CAST(year AS TEXT) || ' ' || make || ' ' || model || ' ' || subtitle || ' ' || location) LIKE ?");
        args.push(`%${word}%`);
      }
    }
    const sorts: Record<string, string> = {
      ending: "CASE status WHEN 'live' THEN 0 ELSE 1 END, CASE status WHEN 'live' THEN ends_at ELSE -ends_at END",
      newest: "started_at DESC",
      bids: "(SELECT COUNT(*) FROM bids WHERE listing_id = listings.id) DESC",
      watched: "(SELECT COUNT(*) FROM watches WHERE listing_id = listings.id) DESC",
    };
    const sort = sorts[q.get("sort") ?? "ending"] ?? sorts.ending;
    const limit = Math.min(Number(q.get("limit")) || 48, 100);
    const rows = db
      .prepare(`SELECT * FROM listings WHERE ${where.join(" AND ")} ORDER BY ${sort} LIMIT ${limit}`)
      .all(...args) as ListingRow[];
    return { listings: rows.map(summary) };
  });

  route("GET", "/api/categories", () => {
    const counts = db
      .prepare("SELECT category, COUNT(*) n FROM listings WHERE status = 'live' GROUP BY category")
      .all() as { category: string; n: number }[];
    return { categories: CATEGORIES.map((c) => ({ id: c, live: counts.find((x) => x.category === c)?.n ?? 0 })) };
  });

  route("GET", "/api/recent-bids", () => {
    const rows = db
      .prepare(
        `SELECT b.amount, b.at, l.id, l.year, l.make, l.model FROM bids b JOIN listings l ON l.id = b.listing_id
         ORDER BY b.at DESC, b.id DESC LIMIT 12`,
      )
      .all();
    return { bids: rows };
  });

  route("GET", "/api/listings/:id", (c) => {
    const row = getListing(Number(c.params[0]));
    const mine = c.user && (c.user.id === row.seller_id || c.user.is_admin);
    if ((row.status === "pending" || row.status === "rejected") && !mine) throw new HttpError(404, "That listing doesn't exist.");
    if (c.url.searchParams.get("view")) db.prepare("UPDATE listings SET views = views + 1 WHERE id = ?").run(row.id);
    return { listing: detail(getListing(row.id), c.user) };
  });

  route("POST", "/api/listings", (c) => {
    const u = requireUser(c);
    const b = c.body;
    const year = Number(b.year);
    if (!Number.isInteger(year) || year < 1900 || year > new Date(now()).getFullYear() + 1)
      throw new HttpError(400, "Enter the model year.");
    const make = str(b.make, 40);
    const model = str(b.model, 60);
    if (!make || !model) throw new HttpError(400, "Enter the make and model.");
    const category = str(b.category, 20);
    if (!CATEGORIES.includes(category)) throw new HttpError(400, "Pick a category.");
    const location = str(b.location, 80);
    if (!location) throw new HttpError(400, "Enter where the car is.");
    const story = str(b.story, 5000);
    if (story.length < 40) throw new HttpError(400, "Tell buyers a bit more about the car (at least 40 characters).");
    const issues = str(b.issues, 3000);
    if (!issues) throw new HttpError(400, "List the known issues. Write \"None known\" if there are none.");
    const duration = DURATIONS[str(b.duration, 5)];
    if (!duration) throw new HttpError(400, "Pick an auction length.");
    const startingBid = money(b.startingBid, "Starting bid")!;
    const reserve = money(b.reserve, "Reserve", true);
    const buyNow = money(b.buyNow, "Buy now price", true);
    if (reserve !== null && reserve < startingBid) throw new HttpError(400, "The reserve can't be below the starting bid.");
    if (buyNow !== null && buyNow <= Math.max(startingBid, reserve ?? 0))
      throw new HttpError(400, "Buy now has to be above the starting bid and the reserve.");
    const mileage = b.mileage === "" || b.mileage === undefined ? null : money(b.mileage, "Mileage");

    const photos: string[] = Array.isArray(b.photos) ? b.photos.slice(0, MAX_PHOTOS) : [];
    const listingId = Number(
      db
        .prepare(
          `INSERT INTO listings (seller_id, year, make, model, subtitle, category, location, vin, mileage, title_status, runs,
           engine, transmission, drivetrain, body, exterior, interior, fuel, story, mods, issues, service,
           starting_bid, reserve, buy_now, duration_ms, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          u.id, year, make, model, str(b.subtitle, 120), category, location, str(b.vin, 17).toUpperCase(), mileage,
          str(b.titleStatus, 30) || "Clean", str(b.runs, 40) || "Runs and drives", str(b.engine, 60),
          str(b.transmission, 40), str(b.drivetrain, 20), str(b.body, 30), str(b.exterior, 40), str(b.interior, 40),
          str(b.fuel, 20), story, str(b.mods, 3000), issues, str(b.service, 2000), startingBid, reserve, buyNow,
          duration, now(),
        ).lastInsertRowid,
    );
    const saved = photos.map((data, i) => {
      const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(data));
      if (!m) throw new HttpError(400, "Photos must be JPEG, PNG or WebP.");
      const name = `${listingId}-${i + 1}-${randomBytes(4).toString("hex")}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
      writeFileSync(join(opts.uploadsDir, name), Buffer.from(m[2], "base64"));
      return `/uploads/${name}`;
    });
    db.prepare("UPDATE listings SET photos = ? WHERE id = ?").run(JSON.stringify(saved), listingId);
    return { listing: detail(getListing(listingId), u) };
  });

  route("POST", "/api/listings/:id/bids", (c) => {
    const u = requireUser(c);
    const id = Number(c.params[0]);
    const amount = Number(c.body.amount);
    const result = tx(db, () => {
      const row = getListing(id);
      if (row.status !== "live") return { ok: false as const, reason: "auction_not_live" as const, minimumNextBid: 0 };
      const r = placeBid(loadAuction(db, row), { id: String(u.id), verified: !!u.verified }, amount, now());
      if (!r.ok) return r;
      const bid = highBid(r.auction)!;
      db.prepare("INSERT INTO bids (listing_id, bidder_id, amount, at) VALUES (?, ?, ?, ?)").run(id, u.id, bid.amount, bid.at);
      db.prepare("UPDATE listings SET ends_at = ?, extensions_used = ? WHERE id = ?").run(
        r.auction.endsAt,
        r.auction.extensionsUsed,
        id,
      );
      if (r.boughtNow) finishSale(id, u.id, bid.amount);
      return r;
    });
    if (!result.ok) throw new HttpError(409, BID_MESSAGES[result.reason], result);
    const listing = getListing(id);
    const amountPlaced = highBid(result.auction)!.amount;
    broadcast({
      type: "bid",
      listing: summary(listing),
      bid: { amount: amountPlaced, at: now(), username: u.username },
      extended: result.extended,
      boughtNow: result.boughtNow,
    });
    if (result.boughtNow) broadcast({ type: "closed", listing: summary(listing) });
    return { listing: detail(listing, u), extended: result.extended, boughtNow: result.boughtNow };
  });

  route("POST", "/api/listings/:id/reserve", (c) => {
    const u = requireUser(c);
    const id = Number(c.params[0]);
    const newReserve = money(c.body.reserve, "Reserve", true);
    const r = tx(db, () => {
      const row = getListing(id);
      const out = lowerReserve(loadAuction(db, row), String(u.id), newReserve);
      if (out.ok) db.prepare("UPDATE listings SET reserve = ? WHERE id = ?").run(out.auction.reserve, id);
      return out;
    });
    if (!r.ok) {
      const msg = {
        not_seller: "Only the seller can change the reserve.",
        auction_not_live: "The auction isn't live.",
        no_reserve: "This auction has no reserve.",
        cannot_raise: "Reserves can be lowered, never raised.",
      }[r.reason];
      throw new HttpError(409, msg);
    }
    const listing = getListing(id);
    broadcast({ type: "update", listing: summary(listing) });
    return { listing: detail(listing, u) };
  });

  route("POST", "/api/listings/:id/watch", (c) => {
    const u = requireUser(c);
    const id = getListing(Number(c.params[0])).id;
    if (c.body.watch) db.prepare("INSERT OR IGNORE INTO watches (user_id, listing_id) VALUES (?, ?)").run(u.id, id);
    else db.prepare("DELETE FROM watches WHERE user_id = ? AND listing_id = ?").run(u.id, id);
    return { watching: !!c.body.watch };
  });

  route("POST", "/api/listings/:id/comments", (c) => {
    const u = requireUser(c);
    const row = getListing(Number(c.params[0]));
    if (row.status === "pending" || row.status === "rejected") throw new HttpError(409, "This listing isn't public yet.");
    const body = str(c.body.body, 2000);
    if (!body) throw new HttpError(400, "Write a comment first.");
    let parent: number | null = null;
    if (c.body.parentId) {
      const p = db.prepare("SELECT id, parent_id FROM comments WHERE id = ? AND listing_id = ?").get(c.body.parentId, row.id) as
        | { id: number; parent_id: number | null }
        | undefined;
      if (!p) throw new HttpError(400, "That comment is gone.");
      parent = p.parent_id ?? p.id; // replies stay one level deep
    }
    db.prepare("INSERT INTO comments (listing_id, user_id, parent_id, body, at) VALUES (?, ?, ?, ?, ?)").run(
      row.id, u.id, parent, body, now(),
    );
    broadcast({ type: "comment", listingId: row.id });
    return { listing: detail(getListing(row.id), u) };
  });

  route("GET", "/api/account", (c) => {
    const u = requireUser(c);
    const listings = (db.prepare("SELECT * FROM listings WHERE seller_id = ? ORDER BY id DESC").all(u.id) as ListingRow[]).map(
      (r) => ({ ...summary(r), reserve: r.reserve, rejectReason: r.reject_reason, sellerFee: r.seller_fee }),
    );
    const bidOn = db
      .prepare(
        `SELECT l.*, MAX(b.amount) myMax FROM listings l JOIN bids b ON b.listing_id = l.id
         WHERE b.bidder_id = ? GROUP BY l.id ORDER BY l.ends_at DESC`,
      )
      .all(u.id) as (ListingRow & { myMax: number })[];
    const bids = bidOn.map((r) => {
      const top = highBid(loadAuction(db, r));
      return { ...summary(r), myMax: r.myMax, leading: top?.bidderId === String(u.id), won: r.winner_id === u.id };
    });
    const watching = (
      db.prepare("SELECT l.* FROM listings l JOIN watches w ON w.listing_id = l.id WHERE w.user_id = ? ORDER BY l.ends_at").all(
        u.id,
      ) as ListingRow[]
    ).map(summary);
    return { user: me(u), listings, bids, watching };
  });

  route("GET", "/api/admin/queue", (c) => {
    requireAdmin(c);
    const rows = db.prepare("SELECT * FROM listings WHERE status = 'pending' ORDER BY id").all() as ListingRow[];
    return { listings: rows.map((r) => detail(r, c.user)) };
  });

  route("POST", "/api/admin/listings/:id/approve", (c) => {
    requireAdmin(c);
    const row = getListing(Number(c.params[0]));
    if (row.status !== "pending") throw new HttpError(409, "Only pending listings can be approved.");
    const start = now();
    db.prepare("UPDATE listings SET status = 'live', started_at = ?, ends_at = ? WHERE id = ?").run(
      start,
      start + (row.duration_ms as number),
      row.id,
    );
    const listing = getListing(row.id);
    broadcast({ type: "listed", listing: summary(listing) });
    return { listing: summary(listing) };
  });

  route("POST", "/api/admin/listings/:id/reject", (c) => {
    requireAdmin(c);
    const row = getListing(Number(c.params[0]));
    if (row.status !== "pending") throw new HttpError(409, "Only pending listings can be rejected.");
    const reason = str(c.body.reason, 500) || "Didn't meet the listing guidelines.";
    db.prepare("UPDATE listings SET status = 'rejected', reject_reason = ? WHERE id = ?").run(reason, row.id);
    return { ok: true };
  });

  // ---- request plumbing ----
  function cookie(req: IncomingMessage, name: string): string | null {
    const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.cookie ?? "");
    return m ? m[1] : null;
  }

  function currentUser(req: IncomingMessage): User | null {
    const token = cookie(req, "rb_session");
    if (!token) return null;
    const s = db.prepare("SELECT user_id, expires_at FROM sessions WHERE token = ?").get(token) as
      | { user_id: number; expires_at: number }
      | undefined;
    if (!s || s.expires_at < now()) return null;
    return userById(s.user_id) ?? null;
  }

  async function readBody(req: IncomingMessage): Promise<any> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw new HttpError(413, "That upload is too big. Try fewer or smaller photos.");
      chunks.push(chunk);
    }
    if (!size) return {};
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new HttpError(400, "Bad JSON.");
    }
  }

  const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
  };

  function sendFile(res: ServerResponse, base: string, rel: string) {
    const file = normalize(join(base, rel));
    if (!file.startsWith(base) || !existsSync(file) || !statSync(file).isFile()) return false;
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
    return true;
  }

  function json(res: ServerResponse, status: number, data: unknown) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(data));
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (url.pathname === "/api/stream") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write(`data: ${JSON.stringify({ type: "hello", serverTime: now() })}\n\n`);
        streams.add(res);
        req.on("close", () => streams.delete(res));
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        for (const [method, re, handler] of routes) {
          const m = re.exec(url.pathname);
          if (!m || method !== req.method) continue;
          if (method === "POST" && !String(req.headers["content-type"]).startsWith("application/json"))
            throw new HttpError(415, "Send JSON.");
          const body = method === "POST" ? await readBody(req) : {};
          const out = await handler({ req, res, url, params: m.slice(1), user: currentUser(req), body });
          return json(res, 200, out);
        }
        throw new HttpError(404, "Not found.");
      }
      if (url.pathname.startsWith("/uploads/") && sendFile(res, opts.uploadsDir, url.pathname.slice(9))) return;
      if (url.pathname !== "/" && sendFile(res, PUBLIC, url.pathname)) return;
      sendFile(res, PUBLIC, "index.html");
    } catch (err) {
      if (err instanceof HttpError) return json(res, err.status, { error: err.message, ...err.extra });
      console.error(err);
      json(res, 500, { error: "Something went wrong on our end." });
    }
  });

  return {
    server,
    db,
    closeDue,
    stop() {
      clearInterval(closer);
      clearInterval(heartbeat);
      for (const s of streams) s.end();
      server.close();
      db.close();
    },
  };
}
