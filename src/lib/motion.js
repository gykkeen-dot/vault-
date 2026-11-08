// Motion tokens ("mac" feel: quick, soft start, crisp stop, a hair of spring). Do not mix with other feels.
import { Easing } from 'react-native';
export const motion = {
  enter: { duration: 240, easing: Easing.bezier(0.16, 1, 0.3, 1) },
  exit: { duration: 140, easing: Easing.in(Easing.quad) },
  pressIn: 90,
  pressScale: 0.97,
  spring: { damping: 20, stiffness: 220, mass: 1 },
  stagger: 30,
  maxStagger: 6,
  distance: 10,
};
