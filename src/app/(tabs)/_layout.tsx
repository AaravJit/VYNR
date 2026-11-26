import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/ui';
import { useHaptics } from '@/state/AppProvider';
import { colors, layout, radius, space } from '@/theme/tokens';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Scan', icon: 'scan' },
  { name: 'garage', label: 'Garage', icon: 'garage' },
  { name: 'career', label: 'Career', icon: 'contracts' },
  { name: 'profile', label: 'Profile', icon: 'profile' },
];

/** Floating translucent tab bar. It sits over the camera on the scanner, so it stays compact and quiet. */
function VynrTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => {
                if (!focused) {
                  haptics.selection();
                  navigateToTab(route.key);
                }
              }}
              style={[styles.tab, focused && styles.tabFocused]}
            >
              <Icon name={tab.icon} size={20} color={focused ? colors.text : colors.textFaint} strokeWidth={focused ? 2 : 1.75} />
              {focused && (
                <Txt variant="label" color={colors.text} style={{ fontSize: 11, letterSpacing: 0.4 }}>
                  {tab.label}
                </Txt>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <VynrTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.tabBarHeight - 8,
    paddingHorizontal: 6,
    gap: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 52,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  tabFocused: { backgroundColor: 'rgba(255,255,255,0.10)' },
});
