// legit: true — бренды первой версии легитчека (больше всего подделок и открытых материалов).
export const BRANDS = [
  { id: 'rick-owens', name: 'Rick Owens', legit: true },
  { id: 'balenciaga', name: 'Balenciaga', legit: true },
  { id: 'gucci', name: 'Gucci', legit: true },
  { id: 'undercover', name: 'Undercover', legit: false },
  { id: 'lgb', name: 'LGB', legit: false },
  { id: 'tornado-mart', name: 'Tornado Mart', legit: false },
  { id: 'vivienne-westwood', name: 'Vivienne Westwood', legit: false },
  { id: '424', name: '424', legit: false },
  { id: 'kmrii', name: 'KMRii', legit: false },
  { id: 'cyberdog', name: 'Cyberdog', legit: false },
];
export const LEGIT_BRANDS = BRANDS.filter((b) => b.legit);
