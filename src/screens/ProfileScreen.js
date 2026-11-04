import React from 'react';
import { ScrollView, View } from 'react-native';
import { Heading, Note, GlassPill } from '../components/Glass';
import { isSupabaseConfigured } from '../lib/supabase';
import { FEATURES, LIMITS } from '../config/limits';

export default function ProfileScreen() {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}>
      <Heading>Профиль</Heading>
      <Note style={{ marginTop: 8 }}>Тариф: Free. Supabase: {isSupabaseConfigured ? 'подключён' : 'не настроен (нужен anon-ключ)'}.</Note>
      <View style={{ marginTop: 20, gap: 10 }}>
        {Object.entries(FEATURES).map(([k, f]) => (
          <GlassPill key={k} style={{ padding: 16, borderRadius: 20 }}>
            <Note>{f.title}: Free {LIMITS.free[k]}/день · Premium: {f.premiumNote}</Note>
          </GlassPill>
        ))}
      </View>
    </ScrollView>
  );
}
