import { Platform, useWindowDimensions } from "react-native";

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const isLargeDesktop = width >= 1280;

  const horizontalPadding = width < 420 ? 16 : width < 768 ? 20 : 32;
  const maxContentWidth = isLargeDesktop ? 1180 : 1040;
  const formWidth = width < 560 ? width - horizontalPadding * 2 : 520;
  const productColumns = isLargeDesktop ? 3 : isTablet ? 2 : 1;

  return {
    width,
    height,
    isWeb,
    isTablet,
    isDesktop,
    isLargeDesktop,
    horizontalPadding,
    maxContentWidth,
    formWidth,
    productColumns,
    topPadding: isWeb && isTablet ? 32 : 60,
  };
}
