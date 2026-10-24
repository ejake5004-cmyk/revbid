// RevBid bidding engine: the auction rules from the build plan, as pure functions.
// Amounts are whole US dollars; times are milliseconds since the epoch.
// The server is the only caller. The database wraps each call in a transaction
// that locks the auction row, so two bids at once are settled in save order.

export const EXTENSION_WINDOW_MS = 2 * 60 * 1000;
export const MAX_EXTENSIONS = 10;

export type AuctionStatus = "live" | "sold" | "unsold";

export interface Bid {
  bidderId: string;
  amount: number;
  at: number;
}

export interface Auction {
  id: string;
  sellerId: string;
  startingBid: number;
  reserve: number | null; // null means no reserve
  buyNowPrice: number | null;
  endsAt: number;
  extensionsUsed: number;
  status: AuctionStatus;
  bids: Bid[]; // oldest first; the last one is the high bid
}

export interface Bidder {
  id: string;
  verified: boolean; // phone and card checked
}

export type BidRejection =
  | "auction_not_live"
  | "auction_ended"
  | "bidder_not_verified"
  | "seller_cannot_bid"
  | "already_high_bidder"
  | "not_whole_dollars"
  | "below_minimum";

export type BidResult =
  | { ok: true; auction: Auction; extended: boolean; boughtNow: boolean }
  | { ok: false; reason: BidRejection; minimumNextBid: number };

export function minIncrement(currentBid: number): number {
  if (currentBid < 1_000) return 25;
  if (currentBid < 5_000) return 50;
  if (currentBid < 25_000) return 100;
  if (currentBid < 100_000) return 250;
  return 500;
}

export function highBid(auction: Auction): Bid | null {
  return auction.bids.at(-1) ?? null;
}

export function minimumNextBid(auction: Auction): number {
  const high = highBid(auction);
  if (!high) return auction.startingBid;
  return high.amount + minIncrement(high.amount);
}

export function reserveMet(auction: Auction): boolean {
  const high = highBid(auction);
  if (!high) return false;
  return auction.reserve === null || high.amount >= auction.reserve;
}

export function placeBid(auction: Auction, bidder: Bidder, amount: number, now: number): BidResult {
  const min = minimumNextBid(auction);
  const reject = (reason: BidRejection): BidResult => ({ ok: false, reason, minimumNextBid: min });

  if (auction.status !== "live") return reject("auction_not_live");
  if (now >= auction.endsAt) return reject("auction_ended");
  if (!bidder.verified) return reject("bidder_not_verified");
  if (bidder.id === auction.sellerId) return reject("seller_cannot_bid");
  if (highBid(auction)?.bidderId === bidder.id) return reject("already_high_bidder");
  if (!Number.isInteger(amount)) return reject("not_whole_dollars");
  if (amount < min) return reject("below_minimum");

  // Buy now ends the auction at once, at the buy now price.
  if (auction.buyNowPrice !== null && amount >= auction.buyNowPrice) {
    const bids = [...auction.bids, { bidderId: bidder.id, amount: auction.buyNowPrice, at: now }];
    return {
      ok: true,
      auction: { ...auction, bids, status: "sold", endsAt: now },
      extended: false,
      boughtNow: true,
    };
  }

  const bids = [...auction.bids, { bidderId: bidder.id, amount, at: now }];
  const late = auction.endsAt - now < EXTENSION_WINDOW_MS;
  const extended = late && auction.extensionsUsed < MAX_EXTENSIONS;
  return {
    ok: true,
    auction: {
      ...auction,
      bids,
      endsAt: extended ? now + EXTENSION_WINDOW_MS : auction.endsAt,
      extensionsUsed: auction.extensionsUsed + (extended ? 1 : 0),
    },
    extended,
    boughtNow: false,
  };
}

export type ReserveChange =
  | { ok: true; auction: Auction }
  | { ok: false; reason: "not_seller" | "auction_not_live" | "no_reserve" | "cannot_raise" };

// Sellers may lower the reserve mid-auction or drop it (null), never raise it.
export function lowerReserve(auction: Auction, sellerId: string, newReserve: number | null): ReserveChange {
  if (sellerId !== auction.sellerId) return { ok: false, reason: "not_seller" };
  if (auction.status !== "live") return { ok: false, reason: "auction_not_live" };
  if (auction.reserve === null) return { ok: false, reason: "no_reserve" };
  if (newReserve !== null && newReserve > auction.reserve) return { ok: false, reason: "cannot_raise" };
  return { ok: true, auction: { ...auction, reserve: newReserve } };
}

export interface CloseResult {
  auction: Auction;
  winner: Bid | null;
}

// Called by a scheduled job once the clock passes endsAt. Returns the auction unchanged before then.
export function closeAuction(auction: Auction, now: number): CloseResult {
  if (auction.status !== "live" || now < auction.endsAt) {
    return { auction, winner: auction.status === "sold" ? highBid(auction) : null };
  }
  const sold = reserveMet(auction);
  return {
    auction: { ...auction, status: sold ? "sold" : "unsold" },
    winner: sold ? highBid(auction) : null,
  };
}

// Seller fee: 5% of the winning bid, at least $250, at most $2,500. Nothing if unsold.
export function sellerFee(winningBid: number): number {
  return Math.min(2_500, Math.max(250, Math.round(winningBid * 0.05)));
}

export interface PublicAuction {
  id: string;
  currentBid: number | null;
  bidCount: number;
  minimumNextBid: number;
  endsAt: number;
  status: AuctionStatus;
  hasReserve: boolean;
  reserveMet: boolean;
  buyNowPrice: number | null;
}

// What browsers receive. The reserve amount never leaves the server.
export function publicView(auction: Auction): PublicAuction {
  return {
    id: auction.id,
    currentBid: highBid(auction)?.amount ?? null,
    bidCount: auction.bids.length,
    minimumNextBid: minimumNextBid(auction),
    endsAt: auction.endsAt,
    status: auction.status,
    hasReserve: auction.reserve !== null,
    reserveMet: reserveMet(auction),
    buyNowPrice: auction.buyNowPrice,
  };
}
