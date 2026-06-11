/** Pilot catalog mirrored from configuration/seed-standard-offers.sql */
export const PILOT_LOCALITY_POSTAL = "IN:TN:600115";
export const PILOT_LOCALITY_STATE = "IN:TN";

export const PILOT_STANDARD_OFFERS = [
  {
    id: "so-breakfast-light",
    locality_key: PILOT_LOCALITY_POSTAL,
    menu_label: "Light breakfast (idli / pongal)",
    price_inr: 45
  },
  {
    id: "so-breakfast-full",
    locality_key: PILOT_LOCALITY_POSTAL,
    menu_label: "Full breakfast (combo meal)",
    price_inr: 80
  },
  {
    id: "so-lunch-full",
    locality_key: PILOT_LOCALITY_POSTAL,
    menu_label: "Full course lunch (veg meals)",
    price_inr: 120
  },
  {
    id: "so-dinner-light",
    locality_key: PILOT_LOCALITY_POSTAL,
    menu_label: "Light dinner (chapati / rice portion)",
    price_inr: 55
  },
  {
    id: "so-lunch-full-state",
    locality_key: PILOT_LOCALITY_STATE,
    menu_label: "Full course lunch (state default)",
    price_inr: 110
  }
];

export function pilotOfferRecords(now = new Date().toISOString()) {
  return PILOT_STANDARD_OFFERS.map((offer) => ({
    ...offer,
    created_at: now,
    updated_at: now
  }));
}
