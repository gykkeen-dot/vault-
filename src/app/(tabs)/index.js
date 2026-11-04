import React, { useState } from 'react';
import FeatureScreen from '../../components/FeatureScreen';
import BrandChips from '../../components/BrandChips';
import { BRANDS } from '../../config/brands';

export default function OutfitsScreen() {
  const [brand, setBrand] = useState(null);
  return (
    <FeatureScreen feature="outfit" headline="Собери аутфит" cta="Загрузить вещь"
      blurb="Загрузи фото вещи: подберём образ по правилам цвета, силуэта и пропорций (вкус автора зашит в базу).">
      <BrandChips brands={BRANDS} selected={brand} onSelect={setBrand} />
    </FeatureScreen>
  );
}
