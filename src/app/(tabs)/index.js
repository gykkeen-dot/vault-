import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import FeatureScreen from '../../components/FeatureScreen';
import { Note } from '../../components/Glass';
import { analyzeItem } from '../../lib/analyze';
import { suggestLooks } from '../../lib/outfits';
import { colors, fonts, radius } from '../../theme';

export default function OutfitsScreen() {
  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const looks = result ? suggestLooks(result) : [];

  // spend() uses up one attempt only after a photo is picked. Returns a status message.
  const onRun = async (spend) => {
    setError(''); setResult(null);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.6, base64: true, allowsEditing: false,
    });
    if (picked.canceled) return 'No photo selected.';
    const asset = picked.assets[0];
    if (!(await spend())) return 'Daily limit reached. Premium removes the limits.';
    setPhoto(asset.uri);
    try {
      const r = await analyzeItem({ base64: asset.base64, mimeType: asset.mimeType || 'image/jpeg' });
      if (r.limit) return 'Daily limit reached. Premium removes the limits.';
      setResult(r);
      return '';
    } catch (e) {
      setError(e.message);
      return '';
    }
  };

  return (
    <FeatureScreen feature="outfit" headline="Build an outfit" cta="Upload a piece" onRun={onRun}
      blurb="Upload a photo of a piece: we identify the brand, collection and season, then build a look using rules of colour, silhouette and proportion.">
      {photo && <Image source={{ uri: photo }} style={s.photo} contentFit="cover" transition={150} />}
      {result && (
        <View style={s.card}>
          <Row k="Brand" v={result.brand} />
          <Row k="Collection" v={result.collection} />
          <Row k="Season" v={result.season} />
          <Row k="Confidence" v={`${Math.round((result.confidence ?? 0) * 100)}%`} />
          {!!result.note && <Note style={{ marginTop: 10 }}>{result.note}</Note>}
          <Note style={{ marginTop: 10 }}>A probability estimate, not a guarantee.</Note>
        </View>
      )}
      {looks.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Text style={s.section}>LOOKS THAT WORK WITH IT</Text>
          {looks.map((l) => (
            <View key={l.id} style={s.look}>
              <Text style={s.lookTitle}>{l.silhouette}</Text>
              <Text style={s.lookPalette}>{l.palette.join(' · ')}</Text>
              {l.rules.map((r) => <Note key={r} style={{ marginTop: 6 }}>• {r}</Note>)}
              {l.draft && <Note style={{ marginTop: 8, color: colors.faint }}>Draft rule, not yet confirmed.</Note>}
            </View>
          ))}
        </View>
      )}
      {!!error && <Note style={{ color: colors.warn }}>{error}</Note>}
    </FeatureScreen>
  );
}

function Row({ k, v }) {
  return (
    <View style={s.row}>
      <Text style={s.k}>{k}</Text>
      <Text style={s.v}>{v || '—'}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.card, backgroundColor: colors.surface },
  card: { marginTop: 14, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  section: { color: colors.text, fontFamily: fonts.display, fontSize: 12, letterSpacing: 2, marginBottom: 6 },
  look: { marginTop: 10, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  lookTitle: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 13 },
  lookPalette: { color: colors.dim, fontFamily: fonts.mono, fontSize: 12, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  k: { color: colors.dim, fontFamily: fonts.mono, fontSize: 12 },
  v: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 13, flexShrink: 1, textAlign: 'right' },
});
