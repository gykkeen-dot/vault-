import React, { useState } from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import FeatureScreen from '../../components/FeatureScreen';
import { Note } from '../../components/Glass';
import { searchLooks } from '../../lib/outfits';
import { colors, fonts, radius } from '../../theme';

export default function SearchScreen() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const onRun = async (spend) => {
    if (!(await spend())) return 'Daily limit reached. Premium removes the limits.';
    const r = searchLooks(q);
    setResults(r);
    return r.length ? '' : 'No looks match. Try a colour, a piece or a tag: "black scarf", "archive".';
  };
  return (
    <FeatureScreen feature="search" headline="Find a piece" cta="Search" onRun={onRun}
      blurb="Search the looks database by colour, piece, tag or silhouette. Listing links, prices per marketplace and alerts are Premium.">
      <TextInput value={q} onChangeText={setQ} placeholder="cream knit, archive, oversized…" placeholderTextColor={colors.faint} style={s.input} />
      {(results || []).map((l) => (
        <View key={l.id} style={s.card}>
          <Note style={s.title}>{l.silhouette} · {l.palette.join(', ')}{l.draft ? ' · draft' : ''}</Note>
          {l.pieces.map((p) => <Note key={p}>• {p}</Note>)}
        </View>
      ))}
    </FeatureScreen>
  );
}
const s = StyleSheet.create({
  input: { color: colors.text, fontFamily: fonts.mono, fontSize: 14, borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 20, backgroundColor: colors.bg },
  card: { marginTop: 12, padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, gap: 4 },
  title: { color: colors.text, fontFamily: fonts.monoBold, marginBottom: 4 },
});
