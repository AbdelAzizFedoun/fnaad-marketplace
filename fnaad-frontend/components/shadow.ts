import { Platform, StyleSheet } from "react-native";

export type ShadowLevel = 1 | 2 | 3 | 4;

const SHADOWS: Record<ShadowLevel, object> = {
  1: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  2: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  3: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 8,
  },
  4: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 14,
  },
};

const WEB_SHADOWS: Record<ShadowLevel, object> = {
  1: { boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.06)" },
  2: { boxShadow: "0px 3px 8px rgba(0, 0, 0, 0.10)" },
  3: { boxShadow: "0px 6px 14px rgba(0, 0, 0, 0.14)" },
  4: { boxShadow: "0px 10px 22px rgba(0, 0, 0, 0.18)" },
};

export function shadow(level: ShadowLevel = 1): StyleSheet.NamedStyles<any> {
  return (Platform.OS === "web" ? WEB_SHADOWS[level] : SHADOWS[level]) as any;
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};
