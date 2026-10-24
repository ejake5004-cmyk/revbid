import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type Auction,
  type Bidder,
  EXTENSION_WINDOW_MS,
  MAX_EXTENSIONS,
  closeAuction,
  lowerReserve,
  minIncrement,
  minimumNextBid,
  placeBid,
  publicView,
  sellerFee,
} from "../src/engine.ts";

const MIN = 60 * 1000;
const T0 = Date.parse("2026-11-01T18:00:00Z");

const auction = (over: Partial<Auction> = {}): Auction => ({
  id: "camry-2013",
  sellerId: "casey",
  startingBid: 25,
  reserve: null,
  buyNowPrice: null,
  endsAt: T0 + 60 * MIN,
  extensionsUsed: 0,
  status: "live",
  bids: [],
  ...over,
});

const ivy: Bidder = { id: "ivy", verified: true };
const noor: Bidder = { id: "noor", verified: true };

function bid(a: Auction, who: Bidder, amount: number, at: number): Auction {
  const r = placeBid(a, who, amount, at);
  assert.ok(r.ok, `expected bid ${amount} by ${who.id} to be accepted`);
  return r.auction;
}

test("increments step up with the price", () => {
  assert.equal(minIncrement(0), 25);
  assert.equal(minIncrement(999), 25);
  assert.equal(minIncrement(1_000), 50);
  assert.equal(minIncrement(5_000), 100);
  assert.equal(minIncrement(25_000), 250);
  assert.equal(minIncrement(100_000), 500);
});

test("the first bid must be at least the starting bid", () => {
  const a = auction({ startingBid: 15_000 });
  const r = placeBid(a, ivy, 14_900, T0);
  assert.deepEqual(r, { ok: false, reason: "below_minimum", minimumNextBid: 15_000 });
  assert.ok(placeBid(a, ivy, 15_000, T0).ok);
});

test("later bids must clear the current bid plus the increment", () => {
  const a = bid(auction(), ivy, 1_700, T0);
  assert.equal(minimumNextBid(a), 1_750);
  const r = placeBid(a, noor, 1_725, T0 + MIN);
  assert.equal(r.ok, false);
  assert.ok(placeBid(a, noor, 1_750, T0 + MIN).ok);
});

test("unverified bidders, the seller, and the current high bidder are refused", () => {
  const a = bid(auction(), ivy, 100, T0);
  const reason = (who: Bidder, amount: number) => {
    const r = placeBid(a, who, amount, T0 + MIN);
    return r.ok ? "accepted" : r.reason;
  };
  assert.equal(reason({ id: "new", verified: false }, 500), "bidder_not_verified");
  assert.equal(reason({ id: "casey", verified: true }, 500), "seller_cannot_bid");
  assert.equal(reason(ivy, 500), "already_high_bidder");
  assert.equal(reason(noor, 500.5), "not_whole_dollars");
});

test("bids after the close or on a closed auction are refused", () => {
  const a = auction();
  const late = placeBid(a, ivy, 100, a.endsAt);
  assert.equal(late.ok ? "accepted" : late.reason, "auction_ended");
  const sold = placeBid(auction({ status: "sold" }), ivy, 100, T0);
  assert.equal(sold.ok ? "accepted" : sold.reason, "auction_not_live");
});

test("a bid in the last 2 minutes resets the clock to 2 minutes", () => {
  const a = auction();
  const at = a.endsAt - 30 * 1000;
  const r = placeBid(a, ivy, 100, at);
  assert.ok(r.ok);
  assert.equal(r.extended, true);
  assert.equal(r.auction.endsAt, at + EXTENSION_WINDOW_MS);
  assert.equal(r.auction.extensionsUsed, 1);
});

test("a bid earlier than the last 2 minutes does not move the clock", () => {
  const a = auction();
  const r = placeBid(a, ivy, 100, a.endsAt - 3 * MIN);
  assert.ok(r.ok);
  assert.equal(r.extended, false);
  assert.equal(r.auction.endsAt, a.endsAt);
});

test("the clock extends at most 10 times, then the close is fixed", () => {
  let a = auction();
  const bidders = [ivy, noor];
  for (let i = 0; i < MAX_EXTENSIONS; i++) {
    const at = a.endsAt - 1000;
    const r = placeBid(a, bidders[i % 2], minimumNextBid(a), at);
    assert.ok(r.ok && r.extended);
    a = r.auction;
  }
  assert.equal(a.extensionsUsed, MAX_EXTENSIONS);
  const finalEnd = a.endsAt;
  const r = placeBid(a, bidders[MAX_EXTENSIONS % 2], minimumNextBid(a), finalEnd - 1000);
  assert.ok(r.ok);
  assert.equal(r.extended, false);
  assert.equal(r.auction.endsAt, finalEnd);
});

test("buy now ends the auction at once at the buy now price", () => {
  const a = auction({ buyNowPrice: 9_000 });
  const r = placeBid(a, ivy, 9_500, T0);
  assert.ok(r.ok);
  assert.equal(r.boughtNow, true);
  assert.equal(r.auction.status, "sold");
  assert.equal(r.auction.bids.at(-1)?.amount, 9_000);
});

test("the reserve can be lowered or removed but never raised", () => {
  const a = auction({ reserve: 5_000 });
  assert.deepEqual(lowerReserve(a, "casey", 6_000), { ok: false, reason: "cannot_raise" });
  assert.deepEqual(lowerReserve(a, "ivy", 4_000), { ok: false, reason: "not_seller" });
  const lowered = lowerReserve(a, "casey", 4_000);
  assert.ok(lowered.ok && lowered.auction.reserve === 4_000);
  const removed = lowerReserve(a, "casey", null);
  assert.ok(removed.ok && removed.auction.reserve === null);
  assert.deepEqual(lowerReserve(auction(), "casey", 100), { ok: false, reason: "no_reserve" });
});

test("closing: sold when the reserve is met, unsold otherwise", () => {
  const withReserve = bid(auction({ reserve: 2_000 }), ivy, 1_750, T0);
  const unsold = closeAuction(withReserve, withReserve.endsAt);
  assert.equal(unsold.auction.status, "unsold");
  assert.equal(unsold.winner, null);

  const noReserve = bid(auction(), ivy, 1_750, T0);
  const sold = closeAuction(noReserve, noReserve.endsAt);
  assert.equal(sold.auction.status, "sold");
  assert.equal(sold.winner?.bidderId, "ivy");

  const empty = closeAuction(auction(), auction().endsAt);
  assert.equal(empty.auction.status, "unsold");
});

test("closing early does nothing", () => {
  const a = bid(auction(), ivy, 100, T0);
  const r = closeAuction(a, a.endsAt - 1);
  assert.equal(r.auction.status, "live");
});

test("seller fee is 5% with a $250 floor and $2,500 cap", () => {
  // The fee table on the mockup's How it works page.
  assert.equal(sellerFee(3_000), 250);
  assert.equal(sellerFee(5_000), 250);
  assert.equal(sellerFee(15_000), 750);
  assert.equal(sellerFee(40_000), 2_000);
  assert.equal(sellerFee(60_000), 2_500);
});

test("the public view never includes the reserve amount", () => {
  const a = bid(auction({ reserve: 2_000 }), ivy, 1_750, T0);
  const v = publicView(a);
  assert.equal("reserve" in v, false);
  assert.equal(v.hasReserve, true);
  assert.equal(v.reserveMet, false);
  assert.equal(v.minimumNextBid, 1_800);
  assert.equal(v.currentBid, 1_750);
});
