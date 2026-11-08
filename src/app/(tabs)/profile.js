import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Heading, Note } from '../../components/Glass';
import { Reveal, PressScale } from '../../components/Motion';
import { isSupabaseConfigured } from '../../lib/supabase';
import { FEATURES, LIMITS } from '../../config/limits';
import { colors, fonts, radius } from '../../theme';

const cap = (n) => (n === -1 ? '∞' : String(n));

export default function ProfileScreen() {
  return (
    <ScrollView contentContainerStyle={s.body}>
      <Reveal index={0}>
        <Heading>Profile</Heading>
        <View style={s.status}>
          <View style={[s.dot, { backgroundColor: isSupabaseConfigured ? '#2E7D4F' : colors.warn }]} />
          <Note>Free plan · {isSupabaseConfigured ? 'Cloud connected' : 'Cloud not configured'}</Note>
        </View>
      </Reveal>

      <Text style={s.label}>DAILY LIMITS</Text>
      <View style={s.group}>
        {Object.entries(FEATURES).map(([k, f], i) => (
          <Reveal key={k} index={i + 1}>
            <PressScale style={s.row} accessibilityRole="button" accessibilityLabel={`${f.title}: ${cap(LIMITS.free[k])} per day`}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{f.title}</Text>
                <Note>Premium: {f.premiumNote}</Note>
              </View>
              <Text style={s.value}>{cap(LIMITS.free[k])}<Text style={s.unit}> /day</Text></Text>
            </PressScale>
          </Reveal>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 140 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { marginTop: 32, marginBottom: 12, color: colors.faint, fontFamily: fonts.display, fontSize: 10, letterSpacing: 2 },
  group: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: radius.card, backgroundColor: colors.surface },
  rowTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 14, letterSpacing: 0.3, marginBottom: 4 },
  value: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 24 },
  unit: { color: colors.faint, fontFamily: fonts.mono, fontSize: 11 },
});
