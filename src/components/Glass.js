import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../theme';

export function GlassPill({ children, style }) {
  return <View style={[s.pill, style]}>{children}</View>;
}
// Black lacquer button: dark body, light top edge, thin inner ring, soft shadow.
export function PillButton({ label, onPress, style, tone = 'solid' }) {
  const solid = tone === 'solid';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.shadow, solid && s.shadowSolid, pressed && { transform: [{ translateY: 1 }], opacity: 0.92 }, style]}>
      <View style={[s.btn, solid ? s.solid : s.ghost]}>
        {solid && <View pointerEvents="none" style={s.ring} />}
        {solid && <View pointerEvents="none" style={s.gloss} />}
        <Text style={[s.btnText, solid ? { color: colors.onAccent } : { color: colors.text }]}>{label.toUpperCase()}</Text>
        <View style={[s.rule, { backgroundColor: solid ? colors.onAccent : colors.text }]} />
      </View>
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
  shadow: { borderRadius: radius.pill },
  shadowSolid: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 19, paddingHorizontal: 24, borderRadius: radius.pill, overflow: 'hidden' },
  solid: { backgroundColor: '#0A0A0A' },
  ghost: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '46%', backgroundColor: 'rgba(255,255,255,0.08)' },
  btnText: { fontFamily: fonts.display, letterSpacing: 3, fontSize: 11 },
  rule: { width: 22, height: 1, opacity: 0.7 },
  heading: { color: colors.text, fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.5, lineHeight: 30 },
  note: { color: colors.dim, fontFamily: fonts.mono, fontSize: 12, lineHeight: 19 },
});
