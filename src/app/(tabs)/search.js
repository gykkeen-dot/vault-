import React, { useState } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import FeatureScreen from '../../components/FeatureScreen';
import { colors, fonts, radius } from '../../theme';

export default function SearchScreen() {
  const [q, setQ] = useState('');
  return (
    <FeatureScreen feature="search" headline="Найди вещь" cta="Искать"
      blurb="По фото или названию: бренд, коллекция, сезон. Ссылки на лоты, цены по площадкам и алерты в Premium.">
      <TextInput value={q} onChangeText={setQ} placeholder="Rick Owens Geobasket FW08…" placeholderTextColor={colors.faint} style={s.input} />
    </FeatureScreen>
  );
}
const s = StyleSheet.create({
  input: { color: colors.text, fontFamily: fonts.mono, fontSize: 14, borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 20, backgroundColor: colors.bg },
});
