# RevBid

A working local version of RevBid: online auctions for enthusiast cars, built from the client preview mockup.

## Run it

1. Install Node.js once: go to https://nodejs.org, download the LTS version, and open the installer.
2. On a Mac, right-click **Start RevBid.command** and choose **Open** (the first time only; after that a double-click works). On Windows, double-click **Start RevBid (Windows).bat**.
3. Your browser opens RevBid. Keep the black window open while you use it, and close it to stop.

Developers can also run `npm start` and open http://localhost:3000. The first start fills the site with demo cars, bidders and bids.

Every demo account uses the password `revbid123`:

- `admin` sees the review queue (approve or reject new listings)
- `ivy_m3`, `noor_na`, `gus_garage` and others are verified bidders
- `casey_l_spk` is a seller with a sold Camry and a live BMW

Open two browser windows signed in as different bidders to watch bids land live in both.

When the site is online, set an `ADMIN_PASSWORD` environment variable on the host so the admin account doesn't use the shared demo password. It applies when the demo data is first created.

For the real site, also set `DEMO_DATA` to `off` (no fake cars or bidders, just the admin account) and point `REVBID_DATA` at a persistent disk so listings survive restarts.

Real text-message verification uses Twilio Verify. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_VERIFY_SID`. Without them, the demo accepts the code 123456 and the live site (DEMO_DATA off) lets the admin verify people by hand from the Admin page.

`npm test` runs the tests. `npm run reset` wipes the demo data so the next start begins fresh.

## What works

- **Accounts.** Sign up, sign in, sign out. Phone verification before your first bid (the demo code is always `123456`; the real site would use Stripe for the phone and card check).
- **Selling.** The sell form covers the car, details, story, modifications, required known issues, up to 12 photos, starting bid, hidden reserve, buy now price and length (including a 10-minute demo length). It shows the 5% fee as you type. Listings wait in a review queue until an admin approves them.
- **Live bidding.** Bids appear instantly for everyone on the page, on cards, and in the home page ticker. Bids are confirmed before they're placed. Bid increments, the 2-minute anti-sniping extension (up to 10 times), hidden reserves, buy now and "you've been outbid" all follow the bidding engine.
- **Reserve.** Bidders only see whether the reserve is met. Sellers can lower or remove it from their auction page, never raise it.
- **Auction close.** A job closes auctions the second they end. If the reserve is met, the buyer and seller each see the other's contact details to settle directly, and the seller sees the 5% fee (min $250, max $2,500). RevBid never holds money.
- **Browsing.** Home page, browse with category, no-reserve, live/ended and sort filters, search, watchlist, comments with seller replies, and an account page with your bids, listings and watchlist.

## Not in this version

Real payments (Stripe), real phone checks, email notifications, legal terms, and hosting. Bids aren't binding while it's a demo.

## How it's built

- `src/engine.ts`: the bidding rules, unchanged from the tested prototype.
- `src/app.ts`: the web server and JSON API. Each bid runs inside a database transaction so two bids at once are handled in order.
- `src/db.ts`: SQLite storage using Node's built-in `node:sqlite`. Data lives in `data/`.
- `src/seed.ts`: demo data.
- `public/`: the website (plain HTML, CSS and JavaScript, no build step).
- `src/phone.ts`: phone verification (Twilio Verify, demo code, or manual).
- `test/`: engine, API and phone verification tests.

Moving to the planned Next.js + Supabase + Stripe stack later is mostly a matter of porting `app.ts` routes; the engine moves as is.
