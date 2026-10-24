// Terms of Service and Privacy Policy. Plain-language drafts: have a Washington attorney review them before relying on them.
export const LEGAL_UPDATED = "October 24, 2026";

const contactLine = (email) =>
  email
    ? `email <a class="link" href="mailto:${email}">${email}</a>`
    : "use the contact details posted on this site";

export function termsHtml(email) {
  return `
<p>These terms are an agreement between you and RevBid ("RevBid," "we," "us"). By creating an account, listing a car, bidding, or commenting, you agree to them. If you don't agree, don't use RevBid.</p>

<h3>1. What RevBid is</h3>
<p>RevBid is an online venue where people auction their own enthusiast cars to other people. RevBid is not the buyer or the seller, and it is not a party to any sale. We never own, possess, inspect, store, or ship the cars listed here, and we never hold buyers' money or titles. Buyers and sellers complete payment, title transfer, and delivery directly with each other.</p>
<p>We review listings before they go live, but our review is not an inspection, appraisal, or guarantee. We can't promise that any car will sell or what it will sell for.</p>

<h3>2. Your account</h3>
<ul class="dots">
  <li>You must be at least 18, live in the United States, and be able to enter a binding contract.</li>
  <li>Give accurate information and keep it current. One account per person.</li>
  <li>You must verify your phone number before bidding. We may ask for more verification at any time.</li>
  <li>You're responsible for everything done with your account. Keep your password private and tell us right away if you think someone else is using it.</li>
</ul>

<h3>3. Selling</h3>
<ul class="dots">
  <li>You may list only a car you own, or one you are legally authorized to sell, and that you can transfer with the title status you state.</li>
  <li>Your listing must be accurate and complete. You must disclose every known issue, including mechanical problems, damage, rust, warning lights, modifications, and title brands such as salvage or rebuilt. Photos must be of the actual car.</li>
  <li>You may not list a car that is stolen, has a known odometer discrepancy you don't disclose, is subject to an undisclosed lien, or that you can't legally sell.</li>
  <li>We may edit listings for clarity and formatting, ask for changes, decline any listing, or remove a listing at any time.</li>
  <li>Once a listing is live, you may not end it early or change material facts, except to correct an error, which must be noted in the comments.</li>
  <li>If the auction ends with a bid that meets your reserve (or there is no reserve), or a bidder uses buy now, you agree to sell the car to the winning bidder for that amount, as described in your listing.</li>
  <li>You may lower or remove your reserve during the auction, but you may never raise it.</li>
  <li>You may not bid on your own car, or have anyone bid on your behalf to raise the price.</li>
</ul>

<h3>4. Bidding</h3>
<ul class="dots">
  <li>Every bid is a binding offer to buy the car as described in the listing, for the amount of your bid. Bids can't be retracted.</li>
  <li>Read the full listing, ask questions, and arrange any inspection you want before you bid. Cars are sold as-is unless the seller states otherwise in writing.</li>
  <li>A bid in the final 2 minutes extends the auction by 2 minutes, up to 10 times. Minimum bid increments are shown on each auction.</li>
  <li>The high bidder wins if the reserve is met or there is no reserve. A bid at the buy now price ends the auction at once.</li>
  <li>Shill bidding, bid collusion, and any attempt to manipulate an auction are prohibited.</li>
</ul>

<h3>5. After the auction</h3>
<ul class="dots">
  <li>When a car sells, we show the buyer and seller each other's username, email, and location so they can complete the sale.</li>
  <li>Buyer and seller must contact each other within 2 days. Unless they agree otherwise in writing, the buyer must pay in full within 7 days and arrange pickup or shipping within 14 days, at the buyer's cost.</li>
  <li>The seller must deliver a properly signed title and any required documents, such as an odometer disclosure, and the car in the condition described.</li>
  <li>Taxes, registration, and title fees are between the buyer, the seller, and the government. RevBid doesn't collect sales tax on cars.</li>
  <li>If a buyer or seller fails to complete a sale, we may suspend or close their account. Any legal claims about the sale are between the buyer and seller.</li>
</ul>

<h3>6. Fees</h3>
<ul class="dots">
  <li>Listing and bidding are free. Buyers pay RevBid nothing.</li>
  <li>When a car sells, the seller owes RevBid a fee of 5% of the final price, with a minimum of $250 and a maximum of $2,500.</li>
  <li>The fee is due within 7 days after the auction ends. If the sale falls through because the buyer doesn't pay, tell us and we'll waive the fee.</li>
  <li>If a buyer and seller who met on RevBid complete the sale outside RevBid to avoid the fee, the fee is still owed.</li>
  <li>We may change our fees for future listings. Changes never apply to an auction already live.</li>
</ul>

<h3>7. Your content</h3>
<p>You keep ownership of the photos, descriptions, and comments you post. You give RevBid a non-exclusive, worldwide, royalty-free license to host, display, reproduce, and use that content to run and promote RevBid, including keeping past auctions and results visible after an auction ends. You confirm you have the right to post it.</p>
<p>Comments must be honest and civil. No harassment, hate, spam, personal information about others, or links to sell elsewhere. We may remove content or accounts that break these rules.</p>

<h3>8. Disclaimers</h3>
<p>RevBid is provided "as is" and "as available." To the fullest extent the law allows, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We don't guarantee the accuracy of any listing, the condition or title of any car, the identity of any user, or that any buyer or seller will complete a sale. The site may sometimes be unavailable or have errors.</p>

<h3>9. Limit of liability</h3>
<p>To the fullest extent the law allows, RevBid is not liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, arising from your use of RevBid or any sale made through it. Our total liability to you for any claim is limited to the greater of the fees you paid RevBid in the 12 months before the claim, or $100.</p>

<h3>10. Indemnity</h3>
<p>You agree to defend and hold RevBid harmless from claims, losses, and costs (including reasonable attorneys' fees) arising from your listings, bids, sales, content, or breach of these terms.</p>

<h3>11. Disputes between users</h3>
<p>Disputes about a car or a sale are between the buyer and seller. We may try to help, but we have no obligation to, and we don't decide who is right.</p>

<h3>12. Ending your account</h3>
<p>You can stop using RevBid at any time and ask us to close your account. We may suspend or close accounts that break these terms or put other users at risk. Sections 5 through 13 continue to apply after your account closes, along with anything you still owe.</p>

<h3>13. Law and courts</h3>
<p>These terms are governed by the laws of the State of Washington, without regard to conflict of law rules. Any dispute with RevBid will be brought in the state or federal courts located in Spokane County, Washington, and you consent to their jurisdiction, except that either side may bring a claim in small claims court where it qualifies.</p>

<h3>14. Changes</h3>
<p>We may update these terms. If we make a material change, we'll post it here and update the date above, and where appropriate we'll tell you when you next sign in. Continuing to use RevBid after a change means you accept it.</p>

<h3>15. Contact</h3>
<p>Questions about these terms? ${contactLine(email)}.</p>`;
}

export function privacyHtml(email) {
  return `
<p>This policy explains what information RevBid collects, how we use it, and the choices you have. We keep it short because we collect only what we need to run auctions.</p>

<h3>What we collect</h3>
<ul class="dots">
  <li><b>Account details:</b> username, email, password (stored only in scrambled form), and the city and state you give us.</li>
  <li><b>Verification:</b> the phone number you verify before bidding.</li>
  <li><b>Activity:</b> your listings, photos, bids, comments, and watchlist.</li>
  <li><b>Technical data:</b> a sign-in cookie that keeps you logged in, and standard server logs such as IP address and browser type, which our host keeps for security.</li>
</ul>
<p>We don't use advertising cookies or sell tracking data. If we add payments later, card details will go straight to the payment processor, and RevBid won't store full card numbers.</p>

<h3>What's public</h3>
<p>Your username, the city and state on your listings, your listings and photos, your bids and their amounts, and your comments are visible to everyone. Your email and phone number are not public.</p>

<h3>Who we share it with</h3>
<ul class="dots">
  <li><b>The other side of your sale.</b> When an auction ends in a sale, the buyer and seller see each other's username, email, and location so they can complete it.</li>
  <li><b>Service providers</b> that run RevBid for us, such as our web host, and later text message, email, and payment providers. They may use your information only to provide their service.</li>
  <li><b>When the law requires it,</b> or to protect RevBid's users from fraud or harm.</li>
  <li><b>If RevBid is sold or merged,</b> your information may transfer to the new owner under this policy.</li>
</ul>
<p>We do not sell your personal information.</p>

<h3>How we use it</h3>
<p>To run your account and auctions, verify bidders, review listings, prevent fraud, contact you about your auctions and account, and improve RevBid.</p>

<h3>How long we keep it</h3>
<p>We keep account information while your account is open. Completed auction pages, including bids and comments, stay public as a record of results. If you close your account, we delete or anonymize your private details unless we need them to resolve a dispute, prevent fraud, or meet a legal requirement.</p>

<h3>Your choices</h3>
<p>You can ask to see, correct, or delete your information, or close your account, at any time. ${email ? `Email <a class="link" href="mailto:${email}">${email}</a>.` : "Use the contact details posted on this site."} We'll respond within 30 days.</p>

<h3>Security</h3>
<p>Passwords are hashed, connections are encrypted, and access to the database is limited. No system is perfectly secure, so use a password you don't use anywhere else.</p>

<h3>Children</h3>
<p>RevBid is for adults 18 and older. We don't knowingly collect information from anyone under 18.</p>

<h3>Changes</h3>
<p>If we change this policy, we'll update it here and change the date above.</p>`;
}
