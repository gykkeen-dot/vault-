import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import PillTabBar from './src/components/PillTabBar';
import OutfitsScreen from './src/screens/OutfitsScreen';
import SearchScreen from './src/screens/SearchScreen';
import LegitScreen from './src/screens/LegitScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { colors, fonts } from './src/theme';

const TABS = [
  { id: 'outfit', label: 'Аутфиты', Screen: OutfitsScreen },
  { id: 'search', label: 'Поиск', Screen: SearchScreen },
  { id: 'legit', label: 'Легитчек', Screen: LegitScreen },
  { id: 'profile', label: 'Профиль', Screen: ProfileScreen },
];

export default function App() {
  const [loaded] = useFonts({ JetBrainsMono_400Regular, JetBrainsMono_700Bold });
  const [tab, setTab] = useState('outfit');
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  const { Screen } = TABS.find((t) => t.id === tab);
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={s.root}>
        <View style={s.top}><Text style={s.logo}>VAULT</Text></View>
        <Screen />
        <PillTabBar tabs={TABS} active={tab} onChange={setTab} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { marginHorizontal: 20, marginVertical: 14, paddingVertical: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass, alignItems: 'center' },
  logo: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 18, letterSpacing: 6 },
});
