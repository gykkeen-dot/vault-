import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../theme';

export function GlassPill({ children, style }) {
  return <View style={[s.pill, style]}>{children}</View>;
}
export function PillButton({ label, onPress, style, tone = 'glass' }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.btn, tone === 'solid' && s.solid, pressed && { opacity: 0.7 }, style]}>
      <Text style={[s.btnText, tone === 'solid' && { color: '#000' }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}
export function Heading({ children, style }) {
  return <Text style={[s.heading, style]}>{String(children).toUpperCase()}</Text>;
}
export function Note({ children, style }) {
  return <Text style={[s.note, style]}>{children}</Text>;
}
const s = StyleSheet.create({
  pill: { backgroundColor: colors.glass, borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill },
  btn: { backgroundColor: colors.glassStrong, borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center' },
  solid: { backgroundColor: colors.accent, borderColor: colors.accent },
  btnText: { color: colors.text, fontFamily: fonts.mono, letterSpacing: 1.2, fontSize: 13 },
  heading: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 20, letterSpacing: 0.5, lineHeight: 28 },
  note: { color: colors.dim, fontFamily: fonts.mono, fontSize: 12, lineHeight: 18 },
});
