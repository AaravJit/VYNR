import { router } from 'expo-router';
import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/ui';
import { useHaptics } from '@/state/AppProvider';
import { colors, radius, space } from '@/theme/tokens';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'garage', label: 'Garage', icon: 'garage' },
  { name: 'contracts', label: 'Contracts', icon: 'contracts' },
  { name: 'profile', label: 'Profile', icon: 'profile' },
];

/** Custom tab bar with a raised scanner trigger in the centre. */
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
        <Icon name={tab.icon} size={22} color={focused ? colors.accent : colors.textFaint} />
        <Txt variant="label" color={focused ? colors.text : colors.textFaint} style={{ fontSize: 10 }}>
          {tab.label.toUpperCase()}
        </Txt>
      </Pressable>
    );
  };
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
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
          style={({ pressed }) => [styles.scanButton, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <Icon name="scan" size={28} color={colors.accentInk} strokeWidth={2.2} />
        </Pressable>
      </View>
      {renderTab(2)}
      {renderTab(3)}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <VynrTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(10,11,13,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.sm,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 48 },
  scanSlot: { width: 84, alignItems: 'center' },
  scanButton: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    borderWidth: 4,
    borderColor: colors.bg,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
