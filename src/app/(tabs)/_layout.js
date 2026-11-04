import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PillTabBar from '../../components/PillTabBar';
import { colors, fonts } from '../../theme';

const TABS = [
  { name: 'index', label: 'Аутфиты' },
  { name: 'search', label: 'Поиск' },
  { name: 'legit', label: 'Легитчек' },
  { name: 'profile', label: 'Профиль' },
];

// Свой капсульный бар поверх навигатора Expo Router: состояние и переходы остаются у роутера.
function TabBar({ state, navigateToTab }) {
  const active = state.routes[state.index].name;
  return (
    <PillTabBar
      tabs={TABS.map((t) => ({ id: t.name, label: t.label }))}
      active={active}
      onChange={(name) => {
        const route = state.routes.find((r) => r.name === name);
        if (route && active !== name) navigateToTab(route.key);
      }}
    />
  );
}

export default function TabsLayout() {
  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <View style={s.top}><Text style={s.logo}>VAULT</Text></View>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      >
        {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} />)}
      </Tabs>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { marginHorizontal: 20, marginVertical: 14, paddingVertical: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  logo: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 18, letterSpacing: 8 },
});
