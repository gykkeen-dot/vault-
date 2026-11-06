// Daily usage counters. Local for now (AsyncStorage); moves to the server (Supabase) in stage 2 so it cannot be bypassed.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIMITS } from '../config/limits';

const key = (feature) => `usage:${feature}:${new Date().toISOString().slice(0, 10)}`;

export async function getUsed(feature) {
  try { return parseInt((await AsyncStorage.getItem(key(feature))) || '0', 10); } catch { return 0; }
}
export async function consume(feature, plan = 'free') {
  const limit = LIMITS[plan][feature];
  const used = await getUsed(feature);
  if (limit !== -1 && used >= limit) return { ok: false, used, limit };
  try { await AsyncStorage.setItem(key(feature), String(used + 1)); } catch {}
  return { ok: true, used: used + 1, limit };
}
