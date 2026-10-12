import { Tabs } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import TabBarIcon from "../../components/TabBarIcon";
import React, { useState, useCallback, useEffect } from "react";
import { getNotifications, getUnreadMessageCount } from "../../services/api";
import { useFocusEffect } from "expo-router";
import { subscribeAppDataRefresh } from "../../services/appRefresh";

export default function TabsLayout() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const loadUnreadCount = useCallback(() => {
    if (user) {
      getNotifications()
        .then((res) => {
          const count = res.data.filter((n: any) => !n.is_read).length;
          setUnreadCount(count);
        })
        .catch(() => undefined);
    }
  }, [user]);

  const loadUnreadMessageCount = useCallback(() => {
    if (user) {
      getUnreadMessageCount()
        .then((res) => {
          setUnreadMessageCount(res.data.unread_count || 0);
        })
        .catch(() => undefined);
    }
  }, [user]);

  useEffect(() => subscribeAppDataRefresh(() => {
    loadUnreadCount();
    loadUnreadMessageCount();
  }), [loadUnreadCount, loadUnreadMessageCount]);

  useFocusEffect(
    useCallback(() => {
      loadUnreadCount();
      loadUnreadMessageCount();
      const interval = setInterval(() => {
        loadUnreadCount();
        loadUnreadMessageCount();
      }, 30000);
      return () => clearInterval(interval);
    }, [loadUnreadCount, loadUnreadMessageCount])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("Home") || "Home",
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon activeIcon="home" inactiveIcon="home-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t("Favorites") || "Favorites",
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon activeIcon="heart" inactiveIcon="heart-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: t("Messages") || "Messages",
          tabBarBadge: unreadMessageCount > 0 ? (unreadMessageCount > 99 ? "99+" : String(unreadMessageCount)) : undefined,
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon activeIcon="chatbubble" inactiveIcon="chatbubble-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("Notifications") || "Alerts",
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon activeIcon="notifications" inactiveIcon="notifications-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="artist"
        options={{
          title: t("Artist") || "Artist",
          href: user?.is_artist ? undefined : null,
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon activeIcon="color-palette" inactiveIcon="color-palette-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("Profile") || "Profile",
          href: null,
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon activeIcon="person" inactiveIcon="person-outline" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
