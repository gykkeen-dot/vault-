// Лимиты по плану монетизации. -1 = безлимит.
export const LIMITS = {
  free:    { legit: 3,  outfit: 5,  search: 5 },
  premium: { legit: -1, outfit: -1, search: -1 },
};
export const FEATURES = {
  legit:  { title: 'Легитчек', freeNote: 'Только процент', premiumNote: 'Подробный разбор' },
  outfit: { title: 'Аутфиты',  freeNote: '5 в день',        premiumNote: 'Безлимит + гардероб' },
  search: { title: 'Поиск',    freeNote: 'Только название', premiumNote: 'Ссылки, цены, алерты' },
};
