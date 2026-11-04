import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../theme';

export default function BrandChips({ brands, selected, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
      {brands.map((b) => {
        const on = selected === b.id;
        return (
          <Pressable key={b.id} onPress={() => onSelect(on ? null : b.id)} style={[s.chip, on && s.on]}>
            <Text style={[s.text, on && { color: '#000' }]}>{b.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  chip: { backgroundColor: colors.glass, borderColor: colors.border, borderWidth: 1, borderRadius: radius.chip, paddingVertical: 14, paddingHorizontal: 16, minWidth: 96 },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
  text: { color: colors.text, fontFamily: fonts.mono, fontSize: 12 },
});
