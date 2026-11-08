import React, { useEffect, useRef, useState } from 'react';
import { Animated, AccessibilityInfo, Pressable } from 'react-native';
import { motion } from '../lib/motion';

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {}); }, []);
  return reduce;
}

// Fade + small rise on mount; `index` staggers siblings (capped).
export function Reveal({ index = 0, style, children }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: reduce ? 100 : motion.enter.duration, easing: motion.enter.easing,
      delay: reduce ? 0 : Math.min(index, motion.maxStagger) * motion.stagger, useNativeDriver: true }).start();
  }, [v, index, reduce]);
  const y = v.interpolate({ inputRange: [0, 1], outputRange: [reduce ? 0 : motion.distance, 0] });
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}

// Pressable with scale feedback and spring release.
export function PressScale({ style, children, ...rest }) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (value, spring) => (spring
    ? Animated.spring(s, { toValue: value, ...motion.spring, useNativeDriver: true })
    : Animated.timing(s, { toValue: value, duration: motion.pressIn, useNativeDriver: true })).start();
  return (
    <Pressable {...rest} onPressIn={() => to(motion.pressScale, false)} onPressOut={() => to(1, true)}>
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
