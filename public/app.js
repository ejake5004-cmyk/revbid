// RevBid front end: a small hash-routed single page app with no build step.
import { termsHtml, privacyHtml, LEGAL_UPDATED } from "./legal.js";

const app = document.getElementById("app");
const nav = document.getElementById("nav");
let me = null;
let clockOffset = 0; // server time minus browser time
let site = { contactEmail: "", demo: true, verifyMode: "demo" };
let pageEvent = null; // live event handler for the current page
let pageToken = 0;

const CATS = {
  jdm: { name: "JDM", blurb: "Japan's best, imported and domestic", ico: "🗾" },
  modified: { name: "Modified", blurb: "Tuned, built, and sorted", ico: "🔧" },
  project: { name: "Project", blurb: "Needs you to finish it", ico: "🛠" },
  performance: { name: "Performance", blurb: "Fast from the factory", ico: "⚡" },
  classic: { name: "Classic", blurb: "Older and better for it", ico: "🏁" },
  unique: { name: "Unique", blurb: "Odd, rare, affordable", ico: "✦" },
};
const DEMO_CODE = "123456";

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const usd = (n) => (n == null ? "—" : "$" + Number(n).toLocaleString("en-US"));
const now = () => Date.now() + clockOffset;
const title = (l) => `${l.year} ${l.make} ${l.model}`;
const lines = (s) => String(s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

function left(endsAt) {
  const ms = endsAt - now();
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

function ago(t) {
  const s = Math.max(1, Math.round((now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong.");
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

function toast(msg, cls = "") {
  const t = document.createElement("div");
  t.className = "toast " + cls;
  t.textContent = msg;
  document.getElementById("toasts").append(t);
  setTimeout(() => t.remove(), 4000);
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// ---------- car art for listings without photos ----------
const PAINT = [
  [/black|ebony|onyx/i, "#1c1f22"], [/white|pearl white|ivory/i, "#e7e6e1"], [/yellow/i, "#f0c22c"],
  [/silver|silverstone|platinum/i, "#b9bdc1"], [/gray|grey|graphite/i, "#6c7276"], [/red|cherry|hugger|maroon/i, "#b4252c"],
  [/orange/i, "#e8742a"], [/green/i, "#2f6b45"], [/blue|estoril|electron/i, "#2c58a8"], [/brown|bronze|tan/i, "#7a5434"],
];
function carArt(l) {
  const paint = (PAINT.find(([re]) => re.test(l.exterior || l.subtitle || "")) || [0, `hsl(${(l.id * 67) % 360} 45% 45%)`])[1];
  const tall = /suv|truck|wagon/i.test(l.body || "") || /jeep|outback|f-150|4runner/i.test(l.model);
  const roof = tall ? 70 : 92;
  const sky = ["#2b3a44", "#3b2f35", "#24352c", "#353a2a"][l.id % 4];
  const id = "g" + l.id + Math.random().toString(36).slice(2, 6);
  return `<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(title(l))}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="#101614"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <rect width="400" height="250" fill="url(#${id})"/>
    <ellipse cx="200" cy="196" rx="170" ry="14" fill="#000" opacity=".45"/>
    <path d="M42 176 Q40 150 70 142 L120 136 Q150 ${roof} 205 ${roof} L245 ${roof} Q280 ${roof} 305 132 L345 140 Q362 146 360 176 Z" fill="${paint}"/>
    <path d="M42 176 Q40 150 70 142 L120 136 Q150 ${roof} 205 ${roof} L245 ${roof} Q280 ${roof} 305 132 L345 140 Q362 146 360 176 Z" fill="url(#${id}b)"/>
    <path d="M132 134 Q156 ${roof + 8} 204 ${roof + 8} L214 ${roof + 8} L214 134 Z M224 134 L224 ${roof + 8} L244 ${roof + 8} Q272 ${roof + 8} 292 132 Z" fill="#0d1215" opacity=".85"/>
    <circle cx="112" cy="178" r="25" fill="#0b0d0e"/><circle cx="112" cy="178" r="13" fill="#555b60"/>
    <circle cx="292" cy="178" r="25" fill="#0b0d0e"/><circle cx="292" cy="178" r="13" fill="#555b60"/>
    <rect x="340" y="150" width="16" height="6" rx="3" fill="#ffd9a0" opacity=".9"/>
    <text x="200" y="232" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-size="13" fill="#9b9f9d" opacity=".7">${esc(l.year + " " + l.make)}</text>
  </svg>`;
}
const pic = (l, i = 0, eager = false) =>
  l.photos && l.photos[i]
    ? `<img src="${esc(l.photos[i])}" alt="${esc(title(l))}" ${eager ? "" : 'loading="lazy"'}>`
    : carArt(l);

function statusPill(l) {
  if (l.status === "sold") return `<span class="pill g">Sold</span>`;
  if (l.status === "unsold") return `<span class="pill r">Reserve not met</span>`;
  if (l.status === "pending") return `<span class="pill y">In review</span>`;
  if (l.status === "rejected") return `<span class="pill r">Not approved</span>`;
  if (!l.hasReserve) return `<span class="pill o">No reserve</span>`;
  if (l.reserveMet) return `<span class="pill g">Reserve met</span>`;
  return "";
}

function priceLabel(l) {
  if (l.status === "sold") return ["Sold for", l.finalPrice];
  if (l.status === "unsold") return ["Bid to", l.currentBid];
  if (l.currentBid == null) return ["Starting bid", l.startingBid];
  return ["Current bid", l.currentBid];
}

function card(l) {
  const [label, amount] = priceLabel(l);
  const live = l.status === "live";
  return `<a class="card" href="#/auction/${l.id}" data-card="${l.id}">
    <div class="pic">${pic(l)}
      <span class="time" ${live ? `data-ends="${l.endsAt}"` : ""}>${live ? left(l.endsAt) : "Ended"}</span>
      <span class="flag">${statusPill(l)}</span>
    </div>
    <div class="body">
      <div class="title">${esc(title(l))}</div>
      <div class="sub">${esc(l.subtitle)}</div>
      <div class="foot">
        <div><div class="label">${label}</div><div class="price ${l.status === "sold" ? "green" : ""}">${usd(amount)}</div></div>
        <div class="small muted" style="text-align:right">${l.bidCount} bid${l.bidCount === 1 ? "" : "s"}<br>${esc(l.location)}</div>
      </div>
    </div>
  </a>`;
}

const grid = (list, empty = "Nothing here yet.") =>
  list.length ? `<div class="grid">${list.map(card).join("")}</div>` : `<div class="empty">${empty}</div>`;

function gauge(l) {
  // The needle sweeps from full (left) to empty (right) over the last 24 hours.
  const ms = Math.max(0, (l.endsAt ?? 0) - now());
  const frac = l.status === "live" ? Math.min(1, ms / 86400000) : 0;
  const a = Math.PI * (1 - frac);
  const x = 21 - Math.cos(a) * 13, y = 26 - Math.sin(a) * 13;
  return `<svg class="gauge" viewBox="0 0 42 34"><path d="M5 26a16 16 0 1 1 32 0" fill="none" stroke="#2a302d" stroke-width="4" stroke-linecap="round"/>
    <path d="M5 26a16 16 0 0 1 32 0" fill="none" stroke="#f47724" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(frac * 50.3).toFixed(1)} 60"/>
    <line x1="21" y1="26" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#f0ede4" stroke-width="2.5" stroke-linecap="round"/><circle cx="21" cy="26" r="3" fill="#f47724"/></svg>`;
}

// ---------- header ----------
function renderNav() {
  nav.innerHTML = `
    <a href="#/browse" class="hide-sm">Auctions</a>
    <a href="#/browse?sort=ending" class="hide-sm">Ending soon</a>
    ${me?.isAdmin ? `<a href="#/admin" class="hide-sm">Admin</a>` : ""}
    <a href="#/sell" class="btn primary" style="padding:7px 14px">Sell a car</a>
    ${me
      ? `<a href="#/account" class="who" title="Your account"><span class="avatar">${esc(me.username.slice(0, 2))}</span><span class="hide-sm">${esc(me.username)}</span></a>`
      : `<a href="#/login" class="btn" style="padding:7px 14px">Sign in</a>`}`;
}

document.getElementById("search").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = e.target.q.value.trim();
  go("#/browse" + (q ? "?q=" + encodeURIComponent(q) : ""));
});

// ---------- pages ----------
async function home() {
  const [feat, ending, fresh, noRes, cats, recent] = await Promise.all([
    api("/api/listings?sort=bids&limit=1"),
    api("/api/listings?sort=ending&limit=8"),
    api("/api/listings?sort=newest&limit=8"),
    api("/api/listings?noReserve=1&sort=ending&limit=4"),
    api("/api/categories"),
    api("/api/recent-bids"),
  ]);
  const f = feat.listings[0];
  app.innerHTML = `<div class="wrap">
    ${f ? `<a class="hero" href="#/auction/${f.id}">
      <div class="art">${pic(f, 0, true)}</div>
      <div class="tag-line"><h1>Honest auctions for enthusiast cars.</h1><p class="hero-sub">JDM, modified, project and classic cars. Every car is reviewed by a real person, and every story is told honestly.</p>
        <div class="row"><span class="btn primary" onclick="event.preventDefault();location.hash='#/browse'">Browse auctions</span>
        <span class="btn" onclick="event.preventDefault();location.hash='#/sell'">Sell a car</span></div></div>
      <div class="bottom" data-card-hero="${f.id}">${heroBottom(f)}</div>
    </a>` : `<div class="cta"><h1>Honest auctions for enthusiast cars.</h1></div>`}
  </div>
  <div class="ticker"><div class="track" id="ticker">${tickerItems(recent.bids)}</div></div>
  <div class="wrap">
    <section class="section"><div class="section-head"><div><h2>Ending soon</h2><p>Last call. Bids in the final 2 minutes add 2 more.</p></div><a class="link" href="#/browse?sort=ending">See all ›</a></div>${grid(ending.listings, "No live auctions right now.")}</section>
    <section class="section"><div class="section-head"><div><h2>What kind of car?</h2></div></div>
      <div class="cats">${cats.categories.map((c) => `<a class="cat" href="#/browse?category=${c.id}"><span class="ico">${CATS[c.id].ico}</span><b>${CATS[c.id].name}</b><span class="small muted">${CATS[c.id].blurb}<br>${c.live} live</span></a>`).join("")}</div></section>
    <section class="section"><div class="section-head"><div><h2>Just listed</h2><p>Fresh this week.</p></div><a class="link" href="#/browse?sort=newest">See all ›</a></div>${grid(fresh.listings)}</section>
    <section class="section"><div class="section-head"><div><h2>No reserve</h2><p>They sell to the high bidder, whatever that is.</p></div><a class="link" href="#/browse?noReserve=1">See all ›</a></div>${grid(noRes.listings, "No no-reserve auctions live right now.")}</section>
    <div class="cta"><div><h2>Got something worth bidding on?</h2><p>We'll help you present it right, with guidance on photos and the write-up, and put it in front of serious enthusiast buyers nationwide. Free to list. One simple fee of 5% only if it sells, and nothing if it doesn't.</p></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn primary lg" href="#/sell">Sell a car</a><a class="btn lg" href="#/how">How it works</a></div></div>
  </div>`;
  pageEvent = (ev) => {
    if (ev.type === "bid") {
      const t = document.getElementById("ticker");
      if (t) t.insertAdjacentHTML("afterbegin", tickerItems([{ ...ev.listing, amount: ev.bid.amount }]));
      const hb = document.querySelector(`[data-card-hero="${ev.listing.id}"]`);
      if (hb) hb.innerHTML = heroBottom(ev.listing);
    }
  };
}

function heroBottom(f) {
  return `<div><span class="live-dot">Live now</span><h2>${esc(title(f))}</h2><div class="muted">${esc(f.subtitle)}</div><div class="muted small">📍 ${esc(f.location)}</div></div>
    <div class="bid-chip"><div><div class="label">Current bid</div><div class="price">${usd(f.currentBid ?? f.startingBid)}</div><div class="small muted">${f.bidCount} bids</div></div>
    <div style="text-align:center">${gauge(f)}<div class="small" data-ends="${f.endsAt}">${left(f.endsAt)}</div></div></div>`;
}

function tickerItems(bids) {
  if (!bids.length) return `<span class="item">Bids show up here the moment they land.</span>`;
  const html = bids.map((b) => `<a class="item" href="#/auction/${b.id}"><b>${usd(b.amount)}</b> bid on the ${esc(title(b))}</a>`).join("");
  return html + html; // doubled so the scroll loops without a gap
}

async function browse(q) {
  const params = new URLSearchParams(q);
  const status = params.get("status") || "live";
  const sort = params.get("sort") || "ending";
  const cat = params.get("category") || "";
  const text = params.get("q") || "";
  document.querySelector("#search input").value = text;
  const data = await api("/api/listings?" + params.toString());
  const link = (changes) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) v ? p.set(k, v) : p.delete(k);
    return "#/browse" + (p.toString() ? "?" + p : "");
  };
  app.innerHTML = `<div class="wrap">
    <div class="section-head" style="margin-top:28px"><div><h1>${text ? `Results for “${esc(text)}”` : status === "ended" ? "Auction results" : "Live auctions"}</h1>
      <p>${data.listings.length} ${status === "ended" ? "finished" : "live"} auction${data.listings.length === 1 ? "" : "s"}</p></div></div>
    <div class="filters">
      <a class="chip ${!cat ? "on" : ""}" href="${link({ category: "" })}">All</a>
      ${Object.entries(CATS).map(([id, c]) => `<a class="chip ${cat === id ? "on" : ""}" href="${link({ category: id })}">${c.name}</a>`).join("")}
      <a class="chip ${params.get("noReserve") ? "on" : ""}" href="${link({ noReserve: params.get("noReserve") ? "" : "1" })}">No reserve</a>
      <span style="flex:1"></span>
      <select id="f-status" aria-label="Status"><option value="live">Live</option><option value="ended">Ended</option></select>
      <select id="f-sort" aria-label="Sort"><option value="ending">Ending soonest</option><option value="newest">Newest</option><option value="bids">Most bids</option><option value="watched">Most watched</option></select>
    </div>
    ${grid(data.listings, text ? "No cars match that search." : "No auctions here yet.")}
  </div>`;
  const fs = document.getElementById("f-status"), fo = document.getElementById("f-sort");
  fs.value = status;
  fo.value = sort;
  fs.onchange = () => go(link({ status: fs.value === "live" ? "" : fs.value }));
  fo.onchange = () => go(link({ sort: fo.value }));
}

// ---------- auction page ----------
async function auction(id) {
  let L = (await api(`/api/listings/${id}?view=1`)).listing;
  let showAllBids = false;
  let photo = 0;

  const facts = (l) => [
    ["VIN", l.vin || "On request"], ["Mileage", l.mileage != null ? l.mileage.toLocaleString() + " mi" : "—"], ["Title", l.titleStatus],
    ["Runs", l.runs], ["Engine", l.engine], ["Transmission", l.transmission], ["Drivetrain", l.drivetrain], ["Body", l.body],
    ["Fuel", l.fuel], ["Exterior", l.exterior], ["Interior", l.interior], ["Location", l.location],
  ].filter(([, v]) => v);

  app.innerHTML = `<div class="wrap">
    <div class="crumbs"><a href="#/browse">Auctions</a> / <a href="#/browse?category=${L.category}">${CATS[L.category].name}</a></div>
    <div id="gallery"></div>
    <div class="layout">
      <div>
        <h1>${esc(title(L))}</h1>
        <div class="muted" style="font-size:18px;margin-top:6px">${esc(L.subtitle)}</div>
        <div class="meta-line"><span>📍 ${esc(L.location)}</span><span>👁 ${L.views.toLocaleString()} view${L.views === 1 ? "" : "s"}</span><span id="watchers">♡ ${L.watchers} watching</span></div>
        <div class="tags"><span class="pill">${CATS[L.category].name}</span>${L.hasReserve ? "" : `<span class="pill o">No reserve</span>`}</div>
        <div class="panel specs">${facts(L).map(([k, v]) => `<div><span class="label">${k}</span><b>${esc(v)}</b></div>`).join("")}</div>
        <div class="block"><h3>The story</h3><div class="prose">${esc(L.story)}</div></div>
        <div class="block"><h3>Modifications</h3><ul class="dots">${(lines(L.mods).length ? lines(L.mods) : ["Stock"]).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div class="block issues"><h3>⚠ Known issues and disclosures</h3><ul class="dots">${lines(L.issues).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          ${L.service ? `<p class="small" style="margin:12px 0 0"><b>Service history:</b> <span class="muted">${esc(L.service)}</span></p>` : ""}</div>
        <div class="block"><h3>Bid history <span class="muted small" id="bid-count"></span></h3><div id="history"></div></div>
        <div class="block"><h3>Comments and questions</h3><div id="comments"></div></div>
        <div class="panel terms"><h3 style="color:var(--c)">Auction terms</h3><ul class="dots">
          <li>Bids are binding offers to buy the car as described. They can't be retracted.</li>
          <li>A bid in the last 2 minutes extends the auction by 2 minutes, up to 10 times.</li>
          <li>If there's a reserve, the car sells only if bidding reaches it. The seller may lower the reserve, never raise it.</li>
          <li>Buyer and seller complete payment and title transfer directly. RevBid doesn't hold funds or titles.</li>
          <li>The seller pays RevBid 5% of the sale price (minimum $250, maximum $2,500) only if the car sells.</li>
        </ul></div>
      </div>
      <aside>
        <div class="bidbox"><div class="panel" id="bidbox"></div>
          <div class="panel" id="seller"></div></div>
      </aside>
    </div>
  </div>`;

  function drawGallery() {
    const n = L.photos.length;
    document.getElementById("gallery").innerHTML = n > 1
      ? `<div class="gallery"><div class="main">${pic(L, photo, true)}<span class="count">${photo + 1} / ${n} photos</span></div>
         <div class="side"><div data-p="${(photo + 1) % n}">${pic(L, (photo + 1) % n)}</div><div data-p="${(photo + 2) % n}">${pic(L, (photo + 2) % n)}</div></div></div>
         <div class="thumbs">${L.photos.map((p, i) => `<img src="${esc(p)}" data-p="${i}" class="${i === photo ? "on" : ""}" alt="">`).join("")}</div>`
      : `<div class="gallery" style="grid-template-columns:1fr"><div class="main" style="aspect-ratio:21/9">${pic(L, 0, true)}</div></div>`;
    document.querySelectorAll("#gallery [data-p]").forEach((el) => (el.onclick = () => { photo = Number(el.dataset.p); drawGallery(); }));
  }

  function drawSeller() {
    const s = L.seller;
    document.getElementById("seller").innerHTML = `<div class="label">Seller</div>
      <div style="display:flex;gap:12px;align-items:center;margin-top:10px"><span class="avatar" style="width:40px;height:40px">${esc(s.username.slice(0, 2))}</span>
      <div><b>${esc(s.username)}</b><div class="small muted">Member since ${new Date(s.since).getFullYear()} · ${esc(s.location)}</div></div></div>
      <div class="small muted" style="margin-top:10px">${s.sold} sold · ${s.listed} listed</div>`;
  }

  function drawHistory() {
    document.getElementById("bid-count").textContent = L.bids.length ? `(${L.bids.length})` : "";
    if (!L.bids.length) {
      document.getElementById("history").innerHTML = `<div class="empty">No bids yet. The first bid must be at least ${usd(L.startingBid)}.</div>`;
      return;
    }
    const rows = showAllBids ? L.bids : L.bids.slice(0, 12);
    document.getElementById("history").innerHTML = `<div class="history-wrap"><table class="history">${rows
      .map((b, i) => `<tr><td>${esc(b.username)} ${i === 0 ? `<span class="pill ${L.status === "sold" ? "g" : ""}">${L.status === "sold" ? "Winner" : "High bid"}</span>` : ""}</td><td class="when">${ago(b.at)}</td><td class="amt">${usd(b.amount)}</td></tr>`)
      .join("")}</table>${L.bids.length > 12 ? `<div class="more"><button class="link" id="all-bids">${showAllBids ? "Show fewer" : `Show all ${L.bids.length} bids`}</button></div>` : ""}</div>`;
    const btn = document.getElementById("all-bids");
    if (btn) btn.onclick = () => { showAllBids = !showAllBids; drawHistory(); };
  }

  function drawComments() {
    const box = document.getElementById("comments");
    const draft = box.querySelector("textarea")?.value || "";
    const top = L.comments.filter((c) => !c.parentId);
    const one = (c) => `<div><span class="who">${esc(c.username)}</span> ${c.bySeller ? `<span class="pill o">Seller</span>` : ""} <span class="small muted">${ago(c.at)}</span>
      <div style="white-space:pre-wrap">${esc(c.body)}</div></div>`;
    box.innerHTML = `${top.length ? "" : `<p class="muted">No questions yet. Ask the seller anything.</p>`}
      ${top.map((c) => `<div class="comment">${one(c)}
        ${L.comments.filter((r) => r.parentId === c.id).map((r) => `<div class="reply">${one(r)}</div>`).join("")}
        ${me ? `<button class="link small" data-reply="${c.id}" style="margin-top:6px">Reply</button>` : ""}</div>`).join("")}
      ${me
        ? `<form class="comment-form" id="cform"><textarea name="body" placeholder="Ask the seller a question" required>${esc(draft)}</textarea><input type="hidden" name="parentId"><button class="btn">Post</button></form><div id="reply-to" class="small muted"></div>`
        : `<p class="small"><a class="link" href="#/login?next=${encodeURIComponent(location.hash)}">Sign in</a> to ask the seller a question.</p>`}`;
    const form = document.getElementById("cform");
    if (!form) return;
    box.querySelectorAll("[data-reply]").forEach((b) => (b.onclick = () => {
      form.parentId.value = b.dataset.reply;
      const c = L.comments.find((x) => x.id === Number(b.dataset.reply));
      document.getElementById("reply-to").innerHTML = `Replying to ${esc(c.username)} · <button class="link small" type="button" id="no-reply">cancel</button>`;
      document.getElementById("no-reply").onclick = () => { form.parentId.value = ""; document.getElementById("reply-to").innerHTML = ""; };
      form.body.focus();
    }));
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        L = (await api(`/api/listings/${id}/comments`, { body: form.body.value, parentId: Number(form.parentId.value) || null })).listing;
        form.body.value = "";
        drawComments();
      } catch (err) { toast(err.message); }
    };
  }

  let confirming = null; // { amount, buyNow }
  let bidError = "";
  function drawBidbox() {
    const box = document.getElementById("bidbox");
    const typed = box.querySelector("#bid-amt")?.value;
    const live = L.status === "live";
    const [label, amount] = priceLabel(L);
    let action = "";
    if (L.status === "pending") action = `<div class="notice o">This listing is waiting for review. It goes live once it's approved.</div>`;
    else if (L.status === "rejected") action = `<div class="notice r">This listing wasn't approved: ${esc(L.rejectReason)}</div>`;
    else if (L.status === "sold") {
      const h = L.handover;
      action = h
        ? `<div class="notice g"><b>${h.role === "buyer" ? "You won this auction." : "Your car sold."}</b><br>
           Contact ${esc(h.contact.username)} at <a class="link" href="mailto:${esc(h.contact.email)}">${esc(h.contact.email)}</a> (${esc(h.contact.location)}) to arrange payment, title and pickup directly.
           ${h.role === "seller" ? `<br><span class="small">RevBid's 5% seller fee: <b>${usd(h.sellerFee)}</b>. You keep ${usd(h.price - h.sellerFee)}.</span>` : ""}</div>`
        : `<div class="notice">Sold. The buyer and seller are arranging the handover.</div>`;
    } else if (L.status === "unsold") action = `<div class="notice">The reserve wasn't met, so the car didn't sell.</div>`;
    else if (!me) action = `<a class="btn primary block lg" href="#/login?next=${encodeURIComponent(location.hash)}">Sign in to bid</a>`;
    else if (L.isSeller) {
      action = `<div class="notice">This is your auction.${L.reserve != null ? ` Your reserve is <b>${usd(L.reserve)}</b> (only you see this).` : " It has no reserve."}</div>
        ${L.reserve != null ? `<form id="reserve-form" class="bid-form"><label class="small">Lower the reserve</label>
          <div style="display:flex;gap:8px"><div class="bid-input" style="flex:1"><span>$</span><input id="new-reserve" type="number" min="0" max="${L.reserve}" step="1" placeholder="${L.reserve}"></div><button class="btn">Lower</button></div>
          <button type="button" class="link small" id="drop-reserve" style="text-align:left">Remove the reserve entirely</button></form>` : ""}`;
    } else if (!me.verified)
      action = `<div class="notice o">Verify your phone before you bid. It takes a minute.</div><a class="btn primary block" href="#/account">Verify my account</a>`;
    else if (L.highBidderIsYou)
      action = `<div class="notice g"><b>You're the high bidder.</b> We'll show it here if someone outbids you.</div>`;
    else if (confirming)
      action = `<div class="confirm"><b>${confirming.buyNow ? `Buy it now for ${usd(confirming.amount)}?` : `Bid ${usd(confirming.amount)}?`}</b><br>
        <span class="small">Bids are binding. If you win, you agree to buy the car as described and pay the seller directly.</span>
        <div style="display:flex;gap:8px;margin-top:10px"><button class="btn primary" id="confirm-bid" style="flex:1">Confirm</button><button class="btn" id="cancel-bid">Cancel</button></div></div>`;
    else
      action = `<form class="bid-form" id="bid-form">
        <div class="bid-input"><span>$</span><input id="bid-amt" type="number" inputmode="numeric" min="${L.minimumNextBid}" step="1" value="${esc(typed && Number(typed) >= L.minimumNextBid ? typed : L.minimumNextBid)}" aria-label="Your bid"></div>
        <div class="quick">${[0, 1, 4].map((k) => { const v = L.minimumNextBid + k * (L.minimumNextBid - (L.currentBid ?? L.minimumNextBid) || 25); return `<button type="button" class="btn" data-q="${v}">${usd(v)}</button>`; }).join("")}</div>
        ${bidError ? `<div class="err">${esc(bidError)}</div>` : ""}
        <button class="btn primary block lg">Place bid</button>
        <div class="small muted">Minimum bid ${usd(L.minimumNextBid)}</div>
        ${L.buyNowPrice ? `<button type="button" class="btn block" id="buy-now">Buy now for ${usd(L.buyNowPrice)}</button>` : ""}
      </form>`;

    box.innerHTML = `<div class="top"><div><div class="label">${label}</div><div class="big" id="big-price">${usd(amount)}</div>
        <div class="small muted" style="margin-top:6px">${L.bidCount} bid${L.bidCount === 1 ? "" : "s"} ${statusPill(L)}</div></div>${gauge(L)}</div>
      ${L.status === "pending" || L.status === "rejected" ? "" : `<div class="row2"><div><div class="label">${live ? "Time left" : "Closed"}</div><div class="clock" ${live ? `data-ends="${L.endsAt}" data-clock` : ""}>${live ? left(L.endsAt) : "Ended"}</div></div>
        <div><div class="label">${live ? "Ends" : "Ended"}</div><div class="small" style="margin-top:6px">${L.endsAt ? new Date(L.endsAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : "—"}${L.extensionsUsed ? `<br><span class="muted">Extended ${L.extensionsUsed}×</span>` : ""}</div></div></div>`}
      ${action}
      ${L.status !== "pending" && L.status !== "rejected" ? `<button class="btn block" id="watch">${L.watching ? "♥ Watching" : "♡ Watch"}</button>` : ""}
      ${site.demo ? `<div class="small muted" style="text-align:center">Demo auction. Bids aren't binding while RevBid is in preview.</div>` : `<div class="small muted" style="text-align:center">Bids are binding. <a class="link" href="#/terms">Terms</a></div>`}`;

    const q = (s) => box.querySelector(s);
    const form = q("#bid-form");
    if (form) {
      box.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => (q("#bid-amt").value = b.dataset.q)));
      form.onsubmit = (e) => {
        e.preventDefault();
        const amount = Number(q("#bid-amt").value);
        if (!Number.isInteger(amount) || amount < L.minimumNextBid) { bidError = `Bid at least ${usd(L.minimumNextBid)}, in whole dollars.`; return drawBidbox(); }
        bidError = "";
        confirming = { amount, buyNow: L.buyNowPrice != null && amount >= L.buyNowPrice };
        if (confirming.buyNow) confirming.amount = L.buyNowPrice;
        drawBidbox();
      };
      const bn = q("#buy-now");
      if (bn) bn.onclick = () => { confirming = { amount: L.buyNowPrice, buyNow: true }; drawBidbox(); };
    }
    if (q("#cancel-bid")) q("#cancel-bid").onclick = () => { confirming = null; drawBidbox(); };
    if (q("#confirm-bid")) q("#confirm-bid").onclick = async (e) => {
      e.target.disabled = true;
      try {
        const r = await api(`/api/listings/${id}/bids`, { amount: confirming.amount });
        L = r.listing;
        toast(r.boughtNow ? "It's yours. Check the panel for the seller's contact." : r.extended ? "Bid placed. The auction was extended by 2 minutes." : "Bid placed. You're the high bidder.", "o");
      } catch (err) {
        bidError = err.message;
        if (err.data?.minimumNextBid) L.minimumNextBid = err.data.minimumNextBid;
        refresh();
      }
      confirming = null;
      drawAll();
    };
    const rf = q("#reserve-form");
    if (rf) {
      const lower = async (value) => {
        try { L = (await api(`/api/listings/${id}/reserve`, { reserve: value })).listing; toast(value === null ? "Reserve removed. It now sells to the high bidder." : "Reserve lowered."); drawAll(); }
        catch (err) { toast(err.message); }
      };
      rf.onsubmit = (e) => { e.preventDefault(); lower(q("#new-reserve").value); };
      q("#drop-reserve").onclick = () => lower(null);
    }
    if (q("#watch")) q("#watch").onclick = async () => {
      if (!me) return go(`#/login?next=${encodeURIComponent(location.hash)}`);
      await api(`/api/listings/${id}/watch`, { watch: !L.watching });
      L.watching = !L.watching;
      L.watchers += L.watching ? 1 : -1;
      document.getElementById("watchers").textContent = `♡ ${L.watchers} watching`;
      drawBidbox();
    };
  }

  function drawAll() { drawBidbox(); drawHistory(); drawComments(); }
  async function refresh(flash) {
    L = (await api(`/api/listings/${id}`)).listing;
    drawAll();
    if (flash) document.getElementById("big-price")?.classList.add("flash");
  }

  drawGallery();
  drawSeller();
  drawAll();

  pageEvent = (ev) => {
    const lid = ev.listing?.id ?? ev.listingId;
    if (lid !== Number(id)) return;
    if (ev.type === "bid") {
      const mine = me && ev.bid.username === me.username;
      if (!mine) toast(`New bid: ${usd(ev.bid.amount)} by ${ev.bid.username}${ev.extended ? ". Clock extended 2 minutes." : ""}`, "o");
      if (!mine && L.highBidderIsYou) toast("You've been outbid.", "o");
      confirming = null;
      refresh(!mine);
    } else if (ev.type === "closed") {
      refresh(true).then(() => toast(L.status === "sold" ? `Sold for ${usd(L.finalPrice)}!` : "Auction over. The reserve wasn't met.", "o"));
    } else refresh();
  };
}

// ---------- accounts ----------
function authPage(q, mode) {
  const next = new URLSearchParams(q).get("next") || "#/";
  const signup = mode === "signup";
  app.innerHTML = `<div class="wrap"><div class="narrow panel">
    <h2>${signup ? "Create your account" : "Sign in"}</h2>
    <p class="muted small">${signup ? "Free to join. You'll verify your phone before your first bid." : "Welcome back."}</p>
    <form id="auth" class="bid-form" style="margin-top:16px">
      ${signup ? `<div class="field"><label>Username</label><input type="text" name="username" autocomplete="username" required></div>
        <div class="field"><label>Email</label><input type="email" name="email" autocomplete="email" required></div>
        <div class="field"><label>City and state</label><input type="text" name="location" placeholder="Spokane, WA"></div>`
      : `<div class="field"><label>Username or email</label><input type="text" name="login" autocomplete="username" required></div>`}
      <div class="field"><label>Password</label><input type="password" name="password" autocomplete="${signup ? "new-password" : "current-password"}" required ${signup ? 'minlength="8"' : ""}></div>
      ${signup ? `<label class="check" style="margin-top:4px"><input type="checkbox" name="agreeTerms" required><span>I'm 18 or older and agree to the <a class="link" href="#/terms" target="_blank">Terms of Service</a> and <a class="link" href="#/privacy" target="_blank">Privacy Policy</a>, including that bids are binding.</span></label>` : ""}
      <div class="err" id="auth-err"></div>
      <button class="btn primary block lg">${signup ? "Create account" : "Sign in"}</button>
    </form>
    <p class="small muted" style="margin-top:14px">${signup ? `Already have an account? <a class="link" href="#/login?next=${encodeURIComponent(next)}">Sign in</a>` : `New to RevBid? <a class="link" href="#/signup?next=${encodeURIComponent(next)}">Create an account</a>`}</p>
    ${signup || !site.demo ? "" : `<p class="small muted">Demo accounts: <b>ivy_m3</b> or <b>noor_na</b>, password <b>revbid123</b>.</p>`}
  </div></div>`;
  document.getElementById("auth").onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    if (signup) body.agreeTerms = e.target.agreeTerms.checked;
    try {
      me = (await api(signup ? "/api/signup" : "/api/login", body)).user;
      renderNav();
      toast(signup ? `Welcome to RevBid, ${me.username}.` : `Signed in as ${me.username}.`);
      go(signup && next === "#/" ? "#/account" : next);
    } catch (err) {
      document.getElementById("auth-err").textContent = err.message;
    }
  };
}

function rowcard(l, extra) {
  const [label, amount] = priceLabel(l);
  return `<div class="rowcard"><a class="pic" href="#/auction/${l.id}">${pic(l)}</a>
    <div><a href="#/auction/${l.id}"><b>${esc(title(l))}</b></a> ${statusPill(l)}
      <div class="small muted">${l.status === "live" ? `Ends in <span data-ends="${l.endsAt}">${left(l.endsAt)}</span> · ` : ""}${label} ${usd(amount)} · ${l.bidCount} bids</div>
      ${extra.below || ""}</div>
    <div class="end">${extra.end || ""}</div></div>`;
}

async function account(q) {
  if (!me) return go("#/login?next=" + encodeURIComponent("#/account"));
  const tab = new URLSearchParams(q).get("tab") || "bids";
  const data = await api("/api/account");
  me = data.user;
  const tabs = { bids: `Bids (${data.bids.length})`, listings: `My listings (${data.listings.length})`, watching: `Watching (${data.watching.length})` };
  let body = "";
  if (tab === "bids")
    body = data.bids.length ? data.bids.map((l) => rowcard(l, {
      below: `<div class="small">Your top bid: <b>${usd(l.myMax)}</b></div>`,
      end: l.won ? `<span class="pill g">You won</span>` : l.status === "live" ? (l.leading ? `<span class="pill g">Winning</span>` : `<a class="btn primary" href="#/auction/${l.id}">Outbid · bid again</a>`) : `<span class="pill">Lost</span>`,
    })).join("") : `<div class="empty">You haven't bid yet. <a class="link" href="#/browse">Find a car</a></div>`;
  if (tab === "listings")
    body = data.listings.length ? data.listings.map((l) => rowcard(l, {
      below: l.status === "rejected" ? `<div class="small err">Not approved: ${esc(l.rejectReason)}</div>`
        : l.status === "sold" ? `<div class="small">Seller fee ${usd(l.sellerFee)} · you keep ${usd(l.finalPrice - l.sellerFee)}</div>`
        : l.reserve != null ? `<div class="small muted">Reserve ${usd(l.reserve)}</div>` : "",
      end: `<a class="btn" href="#/auction/${l.id}">${l.status === "sold" ? "Buyer contact" : "Open"}</a>`,
    })).join("") : `<div class="empty">Nothing listed yet. <a class="link" href="#/sell">Sell a car</a></div>`;
  if (tab === "watching")
    body = data.watching.length ? `<div class="grid">${data.watching.map(card).join("")}</div>` : `<div class="empty">Tap ♡ Watch on any auction to keep it here.</div>`;

  app.innerHTML = `<div class="wrap" style="max-width:900px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:28px;flex-wrap:wrap">
      <div style="display:flex;gap:14px;align-items:center"><span class="avatar" style="width:52px;height:52px;font-size:18px">${esc(me.username.slice(0, 2))}</span>
      <div><h2>${esc(me.username)}</h2><div class="small muted">${esc(me.email)}${me.location ? " · " + esc(me.location) : ""}</div></div></div>
      <div style="display:flex;gap:8px;align-items:center">${me.verified ? `<span class="pill g">✓ Verified bidder</span>` : `<span class="pill y">Not verified</span>`}<button class="btn" id="logout">Sign out</button></div>
    </div>
    ${me.verified ? "" : site.verifyMode === "manual" ? `<div class="fieldset" id="verify"><h3>Verification pending</h3>
      <p class="small muted">Every bidder on RevBid is verified before bidding. During early access, RevBid verifies new accounts by hand, usually within a day.${site.contactEmail ? ` Questions? Email <a class="link" href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a>.` : ""}</p></div>`
    : `<div class="fieldset" id="verify"><h3>Verify your account to bid</h3>
      <p class="small muted">Every bidder on RevBid has a checked mobile number, and each number can be used for one account. ${site.verifyMode === "demo" ? `In this demo the code is always <b>${DEMO_CODE}</b>.` : "We'll text you a 6-digit code. Message and data rates may apply."}</p>
      <form class="fields" id="vform"><div class="field"><label>Mobile number</label><input type="tel" name="phone" placeholder="(509) 555-0142" required></div>
      <div class="field hidden" id="code-field"><label>6-digit code</label><input type="text" name="code" inputmode="numeric" maxlength="6"></div>
      <div class="field" style="justify-content:flex-end"><button class="btn primary" id="vbtn">Text me a code</button></div></form><div class="err" id="verr"></div></div>`}
    <div class="tabs">${Object.entries(tabs).map(([k, v]) => `<a class="chip ${tab === k ? "on" : ""}" href="#/account?tab=${k}">${v}</a>`).join("")}</div>
    <div class="rows">${body}</div></div>`;

  document.getElementById("logout").onclick = async () => { await api("/api/logout", {}); me = null; renderNav(); go("#/"); };
  const vf = document.getElementById("vform");
  if (vf) vf.onsubmit = async (e) => {
    e.preventDefault();
    const codeField = document.getElementById("code-field");
    const btn = document.getElementById("vbtn");
    const verr = document.getElementById("verr");
    verr.textContent = "";
    if (codeField.classList.contains("hidden")) {
      btn.disabled = true;
      try {
        await api("/api/verify/start", { phone: vf.phone.value });
        codeField.classList.remove("hidden");
        btn.textContent = "Verify";
        vf.code.focus();
        verr.innerHTML = `<span class="muted">Code sent. <button type="button" class="link small" id="resend">Use a different number or resend</button></span>`;
        document.getElementById("resend").onclick = () => { codeField.classList.add("hidden"); btn.textContent = "Text me a code"; verr.textContent = ""; };
        toast(site.verifyMode === "demo" ? `Demo text message: your RevBid code is ${DEMO_CODE}` : "Code sent. Check your texts.", "o");
      } catch (err) { verr.textContent = err.message; }
      btn.disabled = false;
      return;
    }
    try {
      me = (await api("/api/verify", { phone: vf.phone.value, code: vf.code.value })).user;
      toast("You're verified. Happy bidding.");
      render();
    } catch (err) { document.getElementById("verr").textContent = err.message; }
  };
}

// ---------- sell ----------
function fee(price) { return Math.min(2500, Math.max(250, Math.round(price * 0.05))); }

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.84));
    };
    img.onerror = () => reject(new Error(`${file.name} isn't an image we can read.`));
    img.src = URL.createObjectURL(file);
  });
}

function sell() {
  if (!me) {
    app.innerHTML = `<div class="wrap"><div class="narrow panel" style="text-align:center"><h2>Sell your car on RevBid</h2>
      <p class="muted">Free to list. A real person reviews every listing. You pay 5% only if it sells (minimum $250, maximum $2,500).</p>
      <a class="btn primary block lg" href="#/login?next=%23%2Fsell">Sign in to start</a>
      <p class="small muted">New here? <a class="link" href="#/signup?next=%23%2Fsell">Create an account</a></p></div></div>`;
    return;
  }
  const photos = [];
  const field = (name, label, attrs = "", hint = "", cls = "") =>
    `<div class="field ${cls}"><label for="s-${name}">${label}</label><input id="s-${name}" name="${name}" ${attrs}>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
  const area = (name, label, ph, hint = "", req = "") =>
    `<div class="field full"><label for="s-${name}">${label}</label><textarea id="s-${name}" name="${name}" placeholder="${ph}" ${req}></textarea>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
  const select = (name, label, opts) =>
    `<div class="field"><label for="s-${name}">${label}</label><select id="s-${name}" name="${name}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></div>`;

  app.innerHTML = `<div class="wrap"><div class="form-page">
    <h1>Sell a car</h1><p class="muted">Tell buyers the truth, good and bad. Enthusiasts trust honest listings, and project cars with clear disclosures are welcome here. A real person at RevBid reviews every listing, usually within a day, and will reach out if the photos or write-up could be stronger. We accept cars from any US state with a clear title.</p>
    <form id="sell" novalidate>
      <div class="fieldset"><h3>The car</h3><div class="fields">
        ${field("year", "Year", 'type="number" min="1900" max="2027" required placeholder="2013"')}
        ${field("make", "Make", 'type="text" required placeholder="Toyota"')}
        ${field("model", "Model and trim", 'type="text" required placeholder="Camry LE"')}
        ${select("category", "Category", Object.entries(CATS).map(([k, v]) => [k, v.name]))}
        ${field("subtitle", "One-line summary", 'type="text" maxlength="120" placeholder="Reliable commuter, heat and A/C work"', "", "full")}
        ${field("location", "Where is it?", `type="text" required value="${esc(me.location)}" placeholder="Cheney, WA"`)}
        ${field("vin", "VIN", 'type="text" maxlength="17" placeholder="17 characters"', "Shown on the listing.")}
        ${field("mileage", "Mileage", 'type="number" min="0" placeholder="133420"')}
      </div></div>
      <div class="fieldset"><h3>Details</h3><div class="fields">
        ${select("titleStatus", "Title", [["Clean", "Clean"], ["Rebuilt", "Rebuilt"], ["Salvage", "Salvage"], ["No title (bill of sale)", "No title"]])}
        ${select("runs", "Condition", [["Runs and drives", "Runs and drives"], ["Runs, doesn't drive", "Runs, doesn't drive"], ["Doesn't run", "Doesn't run"]])}
        ${field("engine", "Engine", 'type="text" placeholder="2.5L inline-four"')}
        ${field("transmission", "Transmission", 'type="text" placeholder="6-speed manual"')}
        ${select("drivetrain", "Drivetrain", [["FWD", "FWD"], ["RWD", "RWD"], ["AWD", "AWD"], ["4WD", "4WD"]])}
        ${field("body", "Body style", 'type="text" placeholder="Sedan"')}
        ${field("exterior", "Exterior color", 'type="text" placeholder="Super White"')}
        ${field("interior", "Interior", 'type="text" placeholder="Ash cloth"')}
        ${select("fuel", "Fuel", [["Gasoline", "Gasoline"], ["Diesel", "Diesel"], ["Hybrid", "Hybrid"], ["Electric", "Electric"]])}
      </div></div>
      <div class="fieldset"><h3>The story and the honest part</h3><div class="fields">
        ${area("story", "The story", "How long you've had it, how it's been used, why you're selling.", "At least 40 characters.", "required")}
        ${area("mods", "Modifications", "One per line. Leave blank if it's stock.")}
        ${area("issues", "Known issues", "One per line: dents, leaks, warning lights, anything a buyer should know.", "Required. Write \"None known\" if there really are none.", "required")}
        ${area("service", "Service history", "Recent maintenance and records you have.")}
      </div></div>
      <div class="fieldset"><h3>Photos</h3><p class="small muted">Up to 12. Start with a front three-quarter shot. Include the interior, engine bay, and any damage you listed.</p>
        <label class="drop" for="s-photos">📷 Click to add photos<input id="s-photos" type="file" accept="image/*" multiple hidden></label>
        <div class="photo-grid" id="photo-grid"></div></div>
      <div class="fieldset"><h3>Auction setup</h3><div class="fields">
        ${field("startingBid", "Starting bid", 'type="number" min="0" step="1" required value="25"', "Low starts draw more bidders.")}
        ${field("reserve", "Hidden reserve (optional)", 'type="number" min="0" step="1" placeholder="No reserve"', "Bidders never see it. You can lower it later, never raise it.")}
        ${field("buyNow", "Buy now price (optional)", 'type="number" min="0" step="1" placeholder="None"', "A bid at this price ends the auction at once.")}
        ${select("duration", "Auction length", [["7d", "7 days"], ["3d", "3 days"], ["1d", "1 day"], ["10m", "10 minutes (demo)"]])}
      </div>
        <div class="fee-box" id="fee-box"></div>
        <label class="check"><input type="checkbox" name="agree" required><span>I own this car or am authorized to sell it, the description is accurate and discloses every known issue, and I'll sell to the winning bidder if the reserve is met. I agree to the <a class="link" href="#/terms" target="_blank">Terms of Service</a>, including the 5% seller fee.</span></label>
      </div>
      <div class="err" id="sell-err" style="margin-top:14px"></div>
      <div style="display:flex;gap:10px;margin-top:18px"><button class="btn primary lg" id="sell-btn">Submit for review</button><a class="btn lg" href="#/">Cancel</a></div>
    </form></div></div>`;

  const form = document.getElementById("sell");
  const feeBox = () => {
    const at = Number(form.reserve.value) || Number(form.startingBid.value) || 0;
    document.getElementById("fee-box").innerHTML = `<div><div class="label">If it sells at</div><b>${usd(at)}</b></div>
      <div><div class="label">RevBid fee (5%)</div><b>${usd(fee(at))}</b></div><div><div class="label">You keep</div><b>${usd(Math.max(0, at - fee(at)))}</b></div>`;
  };
  form.oninput = feeBox;
  feeBox();
  const drawPhotos = () => {
    document.getElementById("photo-grid").innerHTML = photos.map((p, i) => `<div class="ph"><img src="${p}" alt=""><button type="button" data-rm="${i}" aria-label="Remove">✕</button></div>`).join("");
    document.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { photos.splice(Number(b.dataset.rm), 1); drawPhotos(); }));
  };
  document.getElementById("s-photos").onchange = async (e) => {
    for (const f of [...e.target.files].slice(0, 12 - photos.length)) {
      try { photos.push(await resizePhoto(f)); } catch (err) { toast(err.message); }
      drawPhotos();
    }
    e.target.value = "";
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById("sell-err");
    if (!form.agree.checked) { err.textContent = "Check the box to confirm the listing is accurate."; return; }
    const body = Object.fromEntries(new FormData(form));
    delete body.agree;
    body.photos = photos;
    const btn = document.getElementById("sell-btn");
    btn.disabled = true;
    btn.textContent = "Submitting…";
    try {
      const { listing } = await api("/api/listings", body);
      app.innerHTML = `<div class="wrap"><div class="narrow panel" style="text-align:center"><h2>Submitted for review</h2>
        <p class="muted">Thanks. Someone at RevBid will check your ${esc(title(listing))} and put it live, usually within a day. We'll show the status in your account.</p>
        <a class="btn primary block" href="#/auction/${listing.id}">Preview your listing</a><p><a class="link" href="#/account?tab=listings">Go to my listings</a></p></div></div>`;
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.textContent = "Submit for review";
    }
  };
}

// ---------- admin review queue ----------
async function admin() {
  if (!me?.isAdmin) { app.innerHTML = `<div class="wrap"><div class="empty" style="margin-top:40px">Only RevBid staff can see the review queue.</div></div>`; return; }
  const [{ listings }, { users }] = await Promise.all([api("/api/admin/queue"), api("/api/admin/users")]);
  const unverified = users.filter((u) => !u.verified);
  app.innerHTML = `<div class="wrap" style="max-width:900px"><h1 style="margin-top:28px">Review queue</h1>
    <p class="muted">Check each listing for honesty and completeness. Approving starts the auction clock.</p>
    <div class="rows">${listings.length ? listings.map((l) => `<div class="panel">
      <div style="display:flex;gap:16px;flex-wrap:wrap"><a href="#/auction/${l.id}" style="width:200px;border-radius:10px;overflow:hidden;aspect-ratio:16/10;display:block">${pic(l)}</a>
      <div style="flex:1;min-width:240px"><h3><a href="#/auction/${l.id}">${esc(title(l))}</a></h3><div class="small muted">${esc(l.subtitle)} · ${esc(l.location)} · by ${esc(l.seller.username)}</div>
        <div class="small" style="margin-top:8px">Start ${usd(l.startingBid)} · Reserve ${l.reserve != null ? usd(l.reserve) : "none"} · Buy now ${l.buyNowPrice ? usd(l.buyNowPrice) : "none"} · ${l.photos.length} photos</div>
        <div class="small muted" style="margin-top:6px">Issues: ${esc(lines(l.issues).join("; "))}</div></div></div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn primary" data-approve="${l.id}">Approve and start</button>
        <input type="text" placeholder="Reason, if rejecting" data-reason="${l.id}" style="flex:1;min-width:200px"><button class="btn danger" data-reject="${l.id}">Reject</button></div>
    </div>`).join("") : `<div class="empty">The queue is empty.</div>`}</div>
    <h2 style="margin-top:40px">Unverified accounts (${unverified.length})</h2>
    <p class="muted">${site.verifyMode === "manual" ? "Text verification isn't switched on, so verify people you trust here." : "People normally verify themselves by text. Verify someone here only if they can't."} Verified accounts can bid.</p>
    <div class="rows">${unverified.length ? unverified.map((u) => `<div class="rowcard" style="grid-template-columns:1fr auto">
      <div><b>${esc(u.username)}</b><div class="small muted">${esc(u.email)}${u.location ? " · " + esc(u.location) : ""} · joined ${new Date(u.createdAt).toLocaleDateString()}</div></div>
      <button class="btn" data-verify="${u.id}">Verify</button></div>`).join("") : `<div class="empty">Everyone is verified.</div>`}</div></div>`;
  document.querySelectorAll("[data-verify]").forEach((b) => (b.onclick = async () => { await api(`/api/admin/users/${b.dataset.verify}/verify`, {}); toast("Verified. They can bid now."); render(); }));
  document.querySelectorAll("[data-approve]").forEach((b) => (b.onclick = async () => { await api(`/api/admin/listings/${b.dataset.approve}/approve`, {}); toast("Approved. The auction is live."); render(); }));
  document.querySelectorAll("[data-reject]").forEach((b) => (b.onclick = async () => {
    await api(`/api/admin/listings/${b.dataset.reject}/reject`, { reason: document.querySelector(`[data-reason="${b.dataset.reject}"]`).value });
    toast("Rejected. The seller will see your reason.");
    render();
  }));
}

function how() {
  app.innerHTML = `<div class="wrap" style="max-width:960px"><h1 style="margin-top:32px">How RevBid works</h1>
    <p class="muted" style="font-size:18px">RevBid is an online auction marketplace for car enthusiasts: JDM imports, modified cars, project cars, classics and the odd ones in between. Sellers submit their cars, our team reviews them, and approved cars go live with photos, specs, the full story and a timed auction. You can see every bid and every question, and the seller answers in public.</p>
    <div class="steps">
      <div class="step"><div class="n">1</div><h3>Submit your car</h3><p class="muted">Describe it honestly, with photos and every known issue. A real person reviews each listing and helps you present it well before it goes live.</p></div>
      <div class="step"><div class="n">2</div><h3>Bid live</h3><p class="muted">Verified bidders bid in the open. Every bid shows up instantly for everyone watching. Bids in the last 2 minutes add 2 minutes, so nobody gets sniped.</p></div>
      <div class="step"><div class="n">3</div><h3>Settle directly</h3><p class="muted">When it ends, the winner and seller get each other's contact details and arrange payment, title and pickup directly. RevBid never holds money or titles.</p></div>
    </div>
    <div class="fieldset"><h3>Why RevBid</h3><ul class="dots" style="margin-top:10px">
      <li><b>Project cars get respect.</b> The honest, messy, cool stuff is welcome here, with every flaw disclosed so bidders know exactly what they're getting.</li>
      <li><b>Selling is personal.</b> You get a real person who helps with your photos and write-up, not just a form.</li>
      <li><b>Simple pricing.</b> One fee, only if it sells. No listing fees, no buyer's premium, no surprises.</li>
      <li><b>Every car has a story.</b> Listings tell how the car was built, driven and kept, and the comments let buyers ask the seller anything.</li>
      <li><b>Nationwide.</b> We're based in Country Homes, Washington, and accept cars from any US state with a clear title.</li>
    </ul><p class="small muted" style="margin:12px 0 0">We can't promise any car will sell or what it will sell for. We promise a great presentation and a room full of serious enthusiast buyers.</p></div>
    <div class="fieldset"><h3>The rules</h3><ul class="dots" style="margin-top:10px">
      <li>Bids are binding offers to buy the car as described.</li>
      <li>Each bid must beat the last by at least the increment: $25 under $1,000, $50 under $5,000, $100 under $25,000, $250 under $100,000, then $500.</li>
      <li>A bid in the final 2 minutes extends the auction by 2 minutes, up to 10 times.</li>
      <li>Sellers can set a hidden reserve. Bidders see only whether it's been met. Sellers can lower a reserve, never raise it.</li>
      <li>Sellers can set a buy now price. A bid at that price ends the auction at once.</li>
      <li>Every bidder verifies their phone before bidding.</li>
    </ul></div>
    <div class="fieldset"><h3>Fees</h3><p>Buyers pay nothing to RevBid. Sellers pay <b>5% of the sale price</b> only if the car sells, with a minimum of $250 and a maximum of $2,500. No sale, no fee.</p>
      <div class="fee-box">${[3000, 18000, 75000].map((p) => `<div><div class="label">Sells for ${usd(p)}</div><b>Fee ${usd(fee(p))}</b></div>`).join("")}</div></div>
  </div>`;
}

function legalPage(name, body) {
  app.innerHTML = `<div class="wrap legal" style="max-width:820px"><h1 style="margin-top:32px">${name}</h1>
    <p class="muted small">Last updated ${LEGAL_UPDATED}</p>${body(esc(site.contactEmail))}</div>`;
}

// ---------- router ----------
const ROUTES = [
  [/^\/$/, () => home()],
  [/^\/browse$/, (m, q) => browse(q)],
  [/^\/auction\/(\d+)$/, (m) => auction(m[1])],
  [/^\/sell$/, () => sell()],
  [/^\/how$/, () => how()],
  [/^\/terms$/, () => legalPage("Terms of Service", termsHtml)],
  [/^\/privacy$/, () => legalPage("Privacy Policy", privacyHtml)],
  [/^\/login$/, (m, q) => authPage(q, "login")],
  [/^\/signup$/, (m, q) => authPage(q, "signup")],
  [/^\/account$/, (m, q) => account(q)],
  [/^\/admin$/, () => admin()],
];

async function render() {
  const token = ++pageToken;
  pageEvent = null;
  const [path, q = ""] = (location.hash.slice(1) || "/").split("?");
  window.scrollTo(0, 0);
  const route = ROUTES.find(([re]) => re.test(path));
  try {
    if (!route) throw Object.assign(new Error("That page doesn't exist."), { status: 404 });
    await route[1](path.match(route[0]), q);
  } catch (err) {
    if (token !== pageToken) return;
    app.innerHTML = `<div class="wrap"><div class="empty" style="margin-top:40px"><h2>${err.status === 404 ? "Not found" : "Something went wrong"}</h2><p>${esc(err.message)}</p><a class="btn" href="#/">Go home</a></div></div>`;
  }
}

// Live updates: one event stream for the whole site.
function connect() {
  const es = new EventSource("/api/stream");
  es.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (ev.type === "hello") { clockOffset = ev.serverTime - Date.now(); return; }
    if (ev.listing && (ev.type === "bid" || ev.type === "closed" || ev.type === "update")) {
      document.querySelectorAll(`[data-card="${ev.listing.id}"]`).forEach((el) => {
        el.outerHTML = card(ev.listing);
        document.querySelector(`[data-card="${ev.listing.id}"] .price`)?.classList.add("flash");
      });
    }
    pageEvent?.(ev);
  };
}

setInterval(() => {
  document.querySelectorAll("[data-ends]").forEach((el) => {
    const ends = Number(el.dataset.ends);
    el.textContent = left(ends);
    const urgent = ends - now() < 3600000;
    if (el.classList.contains("time") || el.hasAttribute("data-clock")) el.classList.toggle("urgent", urgent);
  });
}, 1000);

window.addEventListener("hashchange", render);
(async () => {
  try {
    const r = await api("/api/me");
    me = r.user;
    clockOffset = r.serverTime - Date.now();
    site = { contactEmail: r.contactEmail, demo: r.demo, verifyMode: r.verifyMode };
    if (!site.demo)
      document.querySelector(".demo-bar").textContent =
        "Early access. RevBid never holds funds or titles: buyers and sellers settle directly.";
  } catch {}
  renderNav();
  connect();
  render();
})();
