import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import FeatureScreen from '../../components/FeatureScreen';
import { Note } from '../../components/Glass';
import { analyzeItem } from '../../lib/analyze';
import { colors, fonts, radius } from '../../theme';

export default function OutfitsScreen() {
  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // spend() списывает попытку только после того, как фото выбрано. Возвращает текст статуса.
  const onRun = async (spend) => {
    setError(''); setResult(null);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.6, base64: true, allowsEditing: false,
    });
    if (picked.canceled) return 'Фото не выбрано.';
    const asset = picked.assets[0];
    if (!(await spend())) return 'Лимит на сегодня исчерпан. Premium снимает ограничения.';
    setPhoto(asset.uri);
    try {
      const r = await analyzeItem({ base64: asset.base64, mimeType: asset.mimeType || 'image/jpeg' });
      if (r.limit) return 'Лимит на сегодня исчерпан. Premium снимает ограничения.';
      setResult(r);
      return '';
    } catch (e) {
      setError(e.message);
      return '';
    }
  };

  return (
    <FeatureScreen feature="outfit" headline="Собери аутфит" cta="Загрузить вещь" onRun={onRun}
      blurb="Загрузи фото вещи: определим бренд, коллекцию и сезон, затем подберём образ по правилам цвета, силуэта и пропорций.">
      {photo && <Image source={{ uri: photo }} style={s.photo} contentFit="cover" transition={150} />}
      {result && (
        <View style={s.card}>
          <Row k="Бренд" v={result.brand} />
          <Row k="Коллекция" v={result.collection} />
          <Row k="Сезон" v={result.season} />
          <Row k="Уверенность" v={`${Math.round((result.confidence ?? 0) * 100)}%`} />
          {!!result.note && <Note style={{ marginTop: 10 }}>{result.note}</Note>}
          <Note style={{ marginTop: 10 }}>Оценка вероятностная, не гарантия.</Note>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  k: { color: colors.dim, fontFamily: fonts.mono, fontSize: 12 },
  v: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 13, flexShrink: 1, textAlign: 'right' },
});
