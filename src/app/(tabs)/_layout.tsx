import { router } from 'expo-router';
import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientFill } from '@/components/Gradient';
import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/ui';
import { useHaptics } from '@/state/AppProvider';
import { colors, radius, shadow, space } from '@/theme/tokens';

/** Each destination owns one hue from the signal gradient, so colour tells you where you are. */
const TABS: { name: string; label: string; icon: IconName; hue: string; soft: string }[] = [
  { name: 'index', label: 'Home', icon: 'home', hue: colors.accent, soft: colors.accentSoft },
  { name: 'garage', label: 'Garage', icon: 'garage', hue: colors.violet, soft: colors.violetSoft },
  { name: 'contracts', label: 'Contracts', icon: 'contracts', hue: colors.blue, soft: colors.blueSoft },
  { name: 'profile', label: 'Profile', icon: 'profile', hue: colors.accent, soft: colors.accentSoft },
];

/** Floating glass tab bar with a gradient scanner orb in the centre. */
function VynrTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const renderTab = (index: number) => {
    const route = state.routes[index];
    const tab = TABS.find((t) => t.name === route?.name);
    if (!route || !tab) return null;
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
        style={styles.tab}
      >
        <View style={[styles.tabIcon, focused && { backgroundColor: tab.soft }]}>
          <Icon name={tab.icon} size={21} color={focused ? colors.text : colors.textFaint} strokeWidth={focused ? 2 : 1.75} />
        </View>
        <Txt variant="label" color={focused ? colors.text : colors.textFaint} style={{ fontSize: 9.5, letterSpacing: 0.8 }}>
          {tab.label.toUpperCase()}
        </Txt>
        {focused && <View style={[styles.tabDot, { backgroundColor: tab.hue }]} />}
      </Pressable>
    );
  };
  return (
    <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, space.md) }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {renderTab(0)}
        {renderTab(1)}
        <View style={styles.scanSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open scanner"
            accessibilityHint="Opens the camera to photograph a vehicle"
            onPress={() => {
              haptics.impact();
              router.push('/scan');
            }}
            style={({ pressed }) => [styles.scanButton, pressed && { transform: [{ scale: 0.94 }] }]}
          >
            <GradientFill />
            <View style={{ zIndex: 1 }}>
            <Icon name="scan" size={28} color={colors.accentInk} strokeWidth={2.2} />
          </View>
          </Pressable>
        </View>
        {renderTab(2)}
        {renderTab(3)}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <VynrTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21,15,36,0.96)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xl,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    ...shadow.card,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 52,
  },
  tabIcon: {
    width: 40,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabDot: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  scanSlot: { width: 76, alignItems: 'center' },
  scanButton: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
    borderWidth: 4,
    borderColor: colors.bg,
    backgroundColor: colors.accent,
    ...shadow.glow,
  },
});
