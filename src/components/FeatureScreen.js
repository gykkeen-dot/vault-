import React, { useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Heading, Note, PillButton, GlassPill } from './Glass';
import { FEATURES, LIMITS } from '../config/limits';
import { consume, getUsed } from '../lib/usage';
import { colors } from '../theme';

// Общий каркас вкладки: заголовок, счётчик лимита, кнопка действия (заглушка до этапов 1–3).
export default function FeatureScreen({ feature, headline, blurb, cta, children }) {
  const f = FEATURES[feature];
  const limit = LIMITS.free[feature];
  const [used, setUsed] = useState(0);
  const [msg, setMsg] = useState('');
  useEffect(() => { getUsed(feature).then(setUsed); }, [feature]);

  const run = async () => {
    const r = await consume(feature, 'free');
    setUsed(r.used);
    setMsg(r.ok ? 'Скоро: функция подключается на следующем этапе.' : 'Лимит на сегодня исчерпан. Premium снимает ограничения.');
  };
  return (
    <ScrollView contentContainerStyle={s.body}>
      <Heading>{headline}</Heading>
      <Note style={{ marginTop: 8 }}>{blurb}</Note>
      <View style={{ marginTop: 20 }}>{children}</View>
      <GlassPill style={s.limit}>
        <Note>{f.title}: {used}/{limit} сегодня · Free: {f.freeNote} · Premium: {f.premiumNote}</Note>
      </GlassPill>
      <PillButton label={cta} onPress={run} tone="solid" style={{ marginTop: 20 }} />
      {!!msg && <Note style={{ marginTop: 14, color: colors.warn }}>{msg}</Note>}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 140 },
  limit: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 20 },
});
