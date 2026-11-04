import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../theme';

export default function PillTabBar({ tabs, active, onChange }) {
  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.bar}>
        {tabs.map((t) => (
          <Pressable key={t.id} onPress={() => onChange(t.id)} style={[s.item, active === t.id && s.itemOn]}>
            <Text style={[s.label, active === t.id && s.labelOn]}>{t.label.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 22 },
  bar: { flexDirection: 'row', backgroundColor: 'rgba(40,40,42,0.92)', borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill, padding: 6 },
  item: { flex: 1, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  itemOn: { backgroundColor: colors.glassStrong },
  label: { color: colors.faint, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.8 },
  labelOn: { color: colors.text },
});
