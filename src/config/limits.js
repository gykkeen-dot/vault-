// Limits per plan. -1 = unlimited.
export const LIMITS = {
  free:    { legit: 3,  outfit: 5,  search: 5 },
  premium: { legit: -1, outfit: -1, search: -1 },
};
export const FEATURES = {
  legit:  { title: 'Legit Check', freeNote: 'Score only', premiumNote: 'Detailed breakdown' },
  outfit: { title: 'Outfits',  freeNote: '5 per day',        premiumNote: 'Unlimited + wardrobe' },
  search: { title: 'Search',    freeNote: 'Name only', premiumNote: 'Links, prices, alerts' },
};
