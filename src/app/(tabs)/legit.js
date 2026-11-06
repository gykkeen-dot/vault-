import React, { useState } from 'react';
import FeatureScreen from '../../components/FeatureScreen';
import BrandChips from '../../components/BrandChips';
import { Note } from '../../components/Glass';
import { LEGIT_BRANDS } from '../../config/brands';

export default function LegitScreen() {
  const [brand, setBrand] = useState(null);
  return (
    <FeatureScreen feature="legit" headline="Legit Check" cta="Check"
      blurb="A verdict with a confidence score and a breakdown of what did not match. This is a probability estimate, not a guarantee of authenticity.">
      <BrandChips brands={LEGIT_BRANDS} selected={brand} onSelect={setBrand} />
      <Note style={{ marginTop: 12 }}>First release: Rick Owens, Balenciaga, Gucci. More brands later.</Note>
    </FeatureScreen>
  );
}
