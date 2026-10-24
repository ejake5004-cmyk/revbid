// The seller disclosure checklist. Shared by the sell form, the listing page and the server's validation.
// `good` is the answer a buyer hopes for; the other answer is shown as a flag. null means neither is a flag.
export const DISCLOSURES = [
  { key: "titleInHand", q: "Title is in the seller's name and in hand", good: "yes" },
  { key: "accident", q: "Any accident or frame damage history", good: "no" },
  { key: "rust", q: "Any rust on the body or underside", good: "no" },
  { key: "leaks", q: "Any fluid leaks", good: "no" },
  { key: "warningLights", q: "Any warning lights on the dash", good: "no" },
  { key: "modified", q: "Modified from stock", good: null },
  { key: "odometer", q: "Mileage is accurate (odometer not replaced or rolled over)", good: "yes" },
  { key: "records", q: "Service records available", good: "yes" },
];

export const ANSWERS = ["yes", "no", "unsure"];
