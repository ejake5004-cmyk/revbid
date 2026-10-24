// SQLite storage. node:sqlite ships with Node 22, so the app has no npm dependencies.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Auction } from "./engine.ts";

export type DB = DatabaseSync;

export function openDb(file: string): DB {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      pass_hash TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      verified INTEGER NOT NULL DEFAULT 0,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    -- status: pending (waiting for review), rejected, live, sold, unsold
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES users(id),
      year INTEGER NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      vin TEXT NOT NULL DEFAULT '',
      mileage INTEGER,
      title_status TEXT NOT NULL DEFAULT 'Clean',
      runs TEXT NOT NULL DEFAULT 'Runs and drives',
      engine TEXT NOT NULL DEFAULT '',
      transmission TEXT NOT NULL DEFAULT '',
      drivetrain TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      exterior TEXT NOT NULL DEFAULT '',
      interior TEXT NOT NULL DEFAULT '',
      fuel TEXT NOT NULL DEFAULT '',
      story TEXT NOT NULL DEFAULT '',
      mods TEXT NOT NULL DEFAULT '',
      issues TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL DEFAULT '',
      photos TEXT NOT NULL DEFAULT '[]',
      starting_bid INTEGER NOT NULL,
      reserve INTEGER,
      buy_now INTEGER,
      duration_ms INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reject_reason TEXT NOT NULL DEFAULT '',
      ends_at INTEGER,
      extensions_used INTEGER NOT NULL DEFAULT 0,
      winner_id INTEGER REFERENCES users(id),
      final_price INTEGER,
      seller_fee INTEGER,
      views INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      started_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS listings_status ON listings(status, ends_at);

    CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id),
      bidder_id INTEGER NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bids_listing ON bids(listing_id, id);

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      parent_id INTEGER REFERENCES comments(id),
      body TEXT NOT NULL,
      at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watches (
      user_id INTEGER NOT NULL REFERENCES users(id),
      listing_id INTEGER NOT NULL REFERENCES listings(id),
      PRIMARY KEY (user_id, listing_id)
    );
  `);
  // Columns added after launch. CREATE TABLE IF NOT EXISTS leaves an existing table alone, so add them here.
  const userCols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name);
  if (!userCols.includes("terms_accepted_at")) db.exec("ALTER TABLE users ADD COLUMN terms_accepted_at INTEGER");
  return db;
}

// Runs fn inside BEGIN IMMEDIATE, which takes the write lock up front. Two bids that
// arrive together are settled one after the other, the way the engine README asks.
export function tx<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export interface ListingRow {
  id: number;
  seller_id: number;
  starting_bid: number;
  reserve: number | null;
  buy_now: number | null;
  ends_at: number | null;
  extensions_used: number;
  status: string;
  [key: string]: unknown;
}

export function loadAuction(db: DB, row: ListingRow): Auction {
  const bids = db
    .prepare("SELECT bidder_id, amount, at FROM bids WHERE listing_id = ? ORDER BY id")
    .all(row.id) as { bidder_id: number; amount: number; at: number }[];
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    startingBid: row.starting_bid,
    reserve: row.reserve,
    buyNowPrice: row.buy_now,
    endsAt: row.ends_at ?? 0,
    extensionsUsed: row.extensions_used,
    status: row.status === "sold" || row.status === "unsold" ? row.status : "live",
    bids: bids.map((b) => ({ bidderId: String(b.bidder_id), amount: b.amount, at: b.at })),
  };
}
