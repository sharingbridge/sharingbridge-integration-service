/** Pilot catalog mirrored from configuration/seed-standard-offers.sql for tests and in-memory mode. */
export const PILOT_STANDARD_OFFERS = [
  {
    id: "so-breakfast-light",
    locality_key: "12.936,80.236",
    menu_label: "Light breakfast (idli / pongal)",
    price_inr: 45
  },
  {
    id: "so-breakfast-full",
    locality_key: "12.936,80.236",
    menu_label: "Full breakfast (combo meal)",
    price_inr: 80
  },
  {
    id: "so-lunch-full",
    locality_key: "12.936,80.236",
    menu_label: "Full course lunch (veg meals)",
    price_inr: 120
  },
  {
    id: "so-dinner-light",
    locality_key: "12.936,80.236",
    menu_label: "Light dinner (chapati / rice portion)",
    price_inr: 55
  },
  {
    id: "so-breakfast-light-legacy-grid",
    locality_key: "12.94,80.24",
    menu_label: "Light breakfast (idli / pongal)",
    price_inr: 45
  },
  {
    id: "so-lunch-full-legacy-grid",
    locality_key: "12.94,80.24",
    menu_label: "Full course lunch (veg meals)",
    price_inr: 120
  },
  {
    id: "so-dinner-light-legacy-grid",
    locality_key: "12.94,80.24",
    menu_label: "Light dinner (chapati / rice portion)",
    price_inr: 55
  }
];

export function pilotOfferRecords(now = new Date().toISOString()) {
  return PILOT_STANDARD_OFFERS.map((offer) => ({
    ...offer,
    created_at: now,
    updated_at: now
  }));
}
