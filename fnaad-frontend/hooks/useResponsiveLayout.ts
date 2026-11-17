import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  // Device categories
  const isSmallPhone = width < 380; // iPhone SE, iPhone 12/13 mini, 360px Android
  const isPhone = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024 && width < 1280;
  const isLargeDesktop = width >= 1280;

  // Responsive horizontal padding: gives small phones extra space so buttons & rows fit
  const horizontalPadding = isSmallPhone
    ? 12
    : width < 430
    ? 16
    : width < 768
    ? 20
    : 32;

  const maxContentWidth = isLargeDesktop ? 1180 : 1040;

  // Form width: fluid on phones with horizontalPadding breathing room, capped on desktop
  const formWidth = width < 520 ? Math.max(280, width - horizontalPadding * 2) : 480;

  // Products grid: 1 column on phones for full image clarity, 2 on tablets/wide screens, 3 on desktop
  const productColumns = isLargeDesktop ? 3 : (width >= 640 ? 2 : 1);

  // Top padding:
  // - On mobile web (iPhone Safari / Android Chrome): browser handles status bar, so 12px gives full screen usage.
  // - On tablet / desktop web: 24px gives a clean top margin.
  // - On native mobile (iOS notch/island / Android status bar): use safe area top inset.
  const topPadding = isWeb
    ? (width >= 768 ? 24 : 12)
    : Math.max(insets.top, 16);

  // Bottom padding: handle iPhone home indicator (34px) & Android gesture navigation bar
  const bottomPadding = isWeb ? 8 : Math.max(insets.bottom, 8);

  return {
    width,
    height,
    isWeb,
    isSmallPhone,
    isPhone,
    isTablet: width >= 768,
    isDesktop,
    isLargeDesktop,
    horizontalPadding,
    maxContentWidth,
    formWidth,
    productColumns,
    topPadding,
    bottomPadding,
    insets,
  };
}
