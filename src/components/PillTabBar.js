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
  bar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.92)', borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill, padding: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  item: { flex: 1, paddingVertical: 13, borderRadius: radius.pill, alignItems: 'center' },
  itemOn: { backgroundColor: colors.accent },
  label: { color: colors.faint, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2 },
  labelOn: { color: colors.onAccent },
});
