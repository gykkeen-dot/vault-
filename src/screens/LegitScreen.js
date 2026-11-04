import React, { useState } from 'react';
import FeatureScreen from '../components/FeatureScreen';
import BrandChips from '../components/BrandChips';
import { Note } from '../components/Glass';
import { LEGIT_BRANDS } from '../config/brands';

export default function LegitScreen() {
  const [brand, setBrand] = useState(null);
  return (
    <FeatureScreen feature="legit" headline="Легитчек" cta="Проверить"
      blurb="Вердикт с процентом уверенности и разбором, что не сошлось. Это вероятностная оценка, а не гарантия подлинности.">
      <BrandChips brands={LEGIT_BRANDS} selected={brand} onSelect={setBrand} />
      <Note style={{ marginTop: 12 }}>Первая версия: Rick Owens, Balenciaga, Gucci. Остальные бренды добавим позже.</Note>
    </FeatureScreen>
  );
}
