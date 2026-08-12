/**
 * Standard-offers catalog for automated tests (in-memory marketplace store).
 * Keep in sync with configuration/seed-standard-offers.sql when sample rows change.
 */

export const FIXTURE_LOCALITY_POSTAL = "IN:TN:600115";
export const FIXTURE_LOCALITY_STATE = "IN:TN";

/** @type {Array<{ id: string, locality_key: string, menu_label: string, price_inr: number }>} */
export const FIXTURE_STANDARD_OFFERS = [
  {
    id: "so-breakfast-light",
    locality_key: FIXTURE_LOCALITY_POSTAL,
    menu_label: "Light breakfast (idli / pongal)",
    price_inr: 45
  },
  {
    id: "so-breakfast-full",
    locality_key: FIXTURE_LOCALITY_POSTAL,
    menu_label: "Full breakfast (combo meal)",
    price_inr: 80
  },
  {
    id: "so-lunch-full",
    locality_key: FIXTURE_LOCALITY_POSTAL,
    menu_label: "Full course lunch (veg meals)",
    price_inr: 120
  },
  {
    id: "so-dinner-light",
    locality_key: FIXTURE_LOCALITY_POSTAL,
    menu_label: "Light dinner (chapati / rice portion)",
    price_inr: 55
  },
  {
    id: "so-lunch-full-state",
    locality_key: FIXTURE_LOCALITY_STATE,
    menu_label: "Full course lunch (state default)",
    price_inr: 110
  }
];

export function fixtureStandardOfferRecords(now = new Date().toISOString()) {
  return FIXTURE_STANDARD_OFFERS.map((offer) => ({
    ...offer,
    created_at: now,
    updated_at: now
  }));
}
