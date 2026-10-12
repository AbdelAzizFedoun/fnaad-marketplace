import React from "react";
import { View, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface TabBarIconProps {
  /** The Ionicons glyph name when the tab is active */
  activeIcon: IoniconsName;
  /** The Ionicons glyph name when the tab is inactive (outline variant) */
  inactiveIcon: IoniconsName;
  /** Whether this tab is currently focused */
  focused: boolean;
  /** Active colour – passed by the tab bar */
  color: any;
  /** Optional override for the icon size (auto-calculated if omitted) */
  size?: number;
}

/**
 * A responsive, platform-consistent tab-bar icon built on Ionicons
 * (bundled with Expo — zero extra dependencies).
 *
 * Responsiveness:
 *  – Size scales with screen width so icons stay proportional on phones,
 *    tablets, and foldables.
 *  – Active state shows a subtle background indicator dot for clarity.
 */
export default function TabBarIcon({
  activeIcon,
  inactiveIcon,
  focused,
  color,
  size: sizeProp,
}: TabBarIconProps) {
  const { width } = useWindowDimensions();

  // Responsive sizing: clamp between 20 and 30 based on screen width
  const responsiveSize = sizeProp ?? Math.min(30, Math.max(20, Math.round(width * 0.06)));

  return (
    <View style={styles.wrapper}>
      {/* Active indicator dot */}
      {focused && (
        <View
          style={[
            styles.indicator,
            {
              backgroundColor: color,
              width: responsiveSize * 1.6,
              height: responsiveSize * 1.6,
              borderRadius: responsiveSize,
            },
          ]}
        />
      )}
      <Ionicons
        name={focused ? activeIcon : inactiveIcon}
        size={responsiveSize}
        color={focused ? "#fff" : color}
        style={{ zIndex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  indicator: {
    position: "absolute",
    opacity: 0.85,
  },
});
